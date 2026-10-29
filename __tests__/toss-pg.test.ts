// 🚀 토스페이먼츠 PG 클라이언트 — 자동 테스트 의무 영역 (CLAUDE.md: 결제 로직)
// 실제 토스 API 는 부르지 않는다 — 가짜 fetch 로 응답 해석·재시도·라우팅만 검증.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createTossPgClient, createMockPgClient, createStage2PgClient, parseTossPayment, isMockPaymentKey,
} from '../supabase/functions/_shared/payments/providers.ts';
import { paymentMatchesOrder } from '../supabase/functions/_shared/payments/verifyPayment.ts';

type Call = { url: string; init?: { method?: string; headers?: Record<string, string>; body?: string } };

// 호출을 기록하고 미리 정한 응답을 순서대로 돌려주는 가짜 fetch
function fakeFetch(responses: { ok: boolean; body: unknown }[]) {
  const calls: Call[] = [];
  const impl = async (url: string, init?: any) => {
    calls.push({ url, init });
    const r = responses.shift();
    if (!r) throw new Error('no more fake responses');
    return { ok: r.ok, json: async () => r.body };
  };
  return { impl, calls };
}

const DONE = { paymentKey: 'pk_1', orderId: 'order-1', status: 'DONE', totalAmount: 5000 };

test('토스 응답 해석 — DONE 만 승인, 금액은 totalAmount', () => {
  assert.deepEqual(parseTossPayment(DONE), { orderId: 'order-1', amount: 5000, status: 'DONE' });
  assert.equal(parseTossPayment({ ...DONE, status: 'CANCELED' }).status, 'CANCELED');
  assert.equal(parseTossPayment({ ...DONE, status: 'PARTIAL_CANCELED' }).status, 'CANCELED');
  assert.equal(parseTossPayment({ ...DONE, status: 'ABORTED' }).status, 'FAILED');
  assert.equal(parseTossPayment({ ...DONE, status: 'WAITING_FOR_DEPOSIT' }).status, 'FAILED');
  assert.deepEqual(parseTossPayment(null), { orderId: '', amount: 0, status: 'FAILED' });
});

test('토스 승인 — 시크릿 키로 Basic 인증, DB 금액을 그대로 보낸다', async () => {
  const { impl, calls } = fakeFetch([{ ok: true, body: DONE }]);
  const pg = createTossPgClient('test_sk_abc', impl);
  const r = await pg.confirm('pk_1', 'order-1', 5000);
  assert.deepEqual(r, { orderId: 'order-1', amount: 5000, status: 'DONE' });
  assert.equal(calls[0].url, 'https://api.tosspayments.com/v1/payments/confirm');
  assert.equal(calls[0].init?.method, 'POST');
  assert.equal(calls[0].init?.headers?.Authorization, `Basic ${btoa('test_sk_abc:')}`);
  assert.deepEqual(JSON.parse(calls[0].init?.body ?? '{}'), { paymentKey: 'pk_1', orderId: 'order-1', amount: 5000 });
});

test('토스 승인 — 거절(금액 불일치 등)은 FAILED → 우리 대조도 실패', async () => {
  const { impl } = fakeFetch([{ ok: false, body: { code: 'INVALID_REQUEST', message: '금액 불일치' } }]);
  const r = await createTossPgClient('test_sk_abc', impl).confirm('pk_1', 'order-1', 5000);
  assert.equal(r.status, 'FAILED');
  assert.equal(paymentMatchesOrder({ id: 'order-1', amount: 5000, status: 'created' }, r).ok, false);
});

test('토스 승인 — 이미 승인된 결제(응답 유실 후 재시도)는 조회해서 실제 상태를 쓴다', async () => {
  const { impl, calls } = fakeFetch([
    { ok: false, body: { code: 'ALREADY_PROCESSED_PAYMENT' } },
    { ok: true, body: DONE },
  ]);
  const r = await createTossPgClient('test_sk_abc', impl).confirm('pk_1', 'order-1', 5000);
  assert.equal(r.status, 'DONE');   // "돈은 빠졌는데 주문 실패" 방지
  assert.equal(calls[1].url, 'https://api.tosspayments.com/v1/payments/pk_1');
  assert.equal(calls[1].init?.method, 'GET');
});

test('토스 승인 — 네트워크 오류는 FAILED 로 확정하지 않고 그대로 던진다 (주문은 created 로 남아 재시도 가능)', async () => {
  const pg = createTossPgClient('test_sk_abc', async () => { throw new Error('network down'); });
  await assert.rejects(() => pg.confirm('pk_1', 'order-1', 5000), /network down/);
});

test('토스 — 시크릿 키가 없으면 실패한다 (모의로 넘어가는 폴백 없음)', async () => {
  const { impl, calls } = fakeFetch([]);
  await assert.rejects(() => createTossPgClient(undefined, impl).confirm('pk_1', 'order-1', 5000), /toss_secret_missing/);
  await assert.rejects(() => createTossPgClient('', impl).cancel('pk_1', 'x'), /toss_secret_missing/);
  assert.equal(calls.length, 0);
});

test('토스 취소 — 성공 / 이미 취소됨은 성공으로 / 그 외는 실패', async () => {
  const ok = fakeFetch([{ ok: true, body: { status: 'CANCELED' } }]);
  await createTossPgClient('test_sk_abc', ok.impl).cancel('pk_1', '청약철회');
  assert.equal(ok.calls[0].url, 'https://api.tosspayments.com/v1/payments/pk_1/cancel');
  assert.deepEqual(JSON.parse(ok.calls[0].init?.body ?? '{}'), { cancelReason: '청약철회' });

  const already = fakeFetch([{ ok: false, body: { code: 'ALREADY_CANCELED_PAYMENT' } }]);
  await createTossPgClient('test_sk_abc', already.impl).cancel('pk_1', 'x');

  const bad = fakeFetch([{ ok: false, body: { code: 'NOT_CANCELABLE_PAYMENT' } }]);
  await assert.rejects(() => createTossPgClient('test_sk_abc', bad.impl).cancel('pk_1', 'x'), /NOT_CANCELABLE_PAYMENT/);
});

test('Stage 2 라우팅 — MOCKPAY: 키는 모의로, 그 외는 토스로 (production 앱 보호)', async () => {
  assert.equal(isMockPaymentKey('MOCKPAY:o:5000'), true);
  assert.equal(isMockPaymentKey('tgen_20261029abc'), false);

  const { impl, calls } = fakeFetch([{ ok: true, body: DONE }]);
  const pg = createStage2PgClient(createTossPgClient('test_sk_abc', impl), createMockPgClient());

  const mockResult = await pg.confirm('MOCKPAY:order-9:10000', 'order-9', 10000);
  assert.deepEqual(mockResult, { orderId: 'order-9', amount: 10000, status: 'DONE' });
  assert.equal(calls.length, 0);   // 모의 키는 토스에 닿지 않는다

  const tossResult = await pg.confirm('pk_1', 'order-1', 5000);
  assert.equal(tossResult.status, 'DONE');
  assert.equal(calls.length, 1);
});
