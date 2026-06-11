// 🚀 응원 한잔 주문 — 자동 테스트 의무 영역 (CLAUDE.md: 결제 로직)
// 실행: npm test  (Node 내장 러너 — 외부 의존성 없음)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { priceOf } from '../supabase/functions/_shared/payments/catalog.ts';
import {
  GIFT_STATUSES, canTransition, isTerminal, isMoneyHeldLimbo,
  type GiftStatus,
} from '../supabase/functions/_shared/payments/giftStateMachine.ts';
import {
  validateCreateOrder, DAILY_CHEER_LIMIT, type CreateOrderContext,
} from '../supabase/functions/_shared/payments/orderPolicy.ts';
import { paymentMatchesOrder } from '../supabase/functions/_shared/payments/verifyPayment.ts';
import { createMockPgClient, createMockGifticonClient } from '../supabase/functions/_shared/payments/providers.ts';

// ─── 카탈로그: 금액의 단일 진실원천 ──────────────────────
test('카탈로그 — 확정 티어와 가격 (응원 2종 / 내기 3종)', () => {
  assert.equal(priceOf('cheer', 'one_cup'), 5_000);
  assert.equal(priceOf('cheer', 'hearty_cup'), 10_000);
  assert.equal(priceOf('cheer', 'grand_cup'), null);   // 응원에 2만원 티어 없음
  assert.equal(priceOf('bet', 'one_cup'), 5_000);
  assert.equal(priceOf('bet', 'hearty_cup'), 10_000);
  assert.equal(priceOf('bet', 'grand_cup'), 20_000);
});

// ─── 상태머신: 허용 전이 전수 검증 ──────────────────────
test('상태머신 — 허용된 전이만 통과 (전수)', () => {
  // 스펙: 허용 전이의 완전한 목록. 여기 없는 (from,to) 조합은 전부 거부돼야 한다.
  const ALLOWED = new Set([
    'created->paid', 'created->pay_failed', 'created->canceled',
    'paid->issued', 'paid->issue_failed', 'paid->donated', 'paid->auto_refund',
    'issued->delivered',
    'delivered->redeemed',
    'issue_failed->auto_refund',
  ]);
  for (const from of GIFT_STATUSES) {
    for (const to of GIFT_STATUSES) {
      const expected = ALLOWED.has(`${from}->${to}`);
      assert.equal(
        canTransition(from as GiftStatus, to as GiftStatus), expected,
        `${from} -> ${to} 는 ${expected ? '허용' : '거부'}여야 함`,
      );
    }
  }
});

test('상태머신 — 종결 상태와 돈-잔류 위험 상태', () => {
  for (const s of ['canceled', 'pay_failed', 'auto_refund', 'donated', 'redeemed']) {
    assert.equal(isTerminal(s as GiftStatus), true, `${s} 는 종결 상태`);
  }
  assert.equal(isTerminal('paid'), false);
  // 돈은 받았는데 상품도 환불도 아닌 상태 = 운영 알람 대상
  assert.equal(isMoneyHeldLimbo('paid'), true);
  assert.equal(isMoneyHeldLimbo('issue_failed'), true);
  assert.equal(isMoneyHeldLimbo('issued'), false);
});

// ─── 주문 생성 정책 ──────────────────────────────────────
const baseCtx: CreateOrderContext = {
  orderType: 'cheer',
  tier: 'one_cup',
  senderId: 'user-a',
  recipientId: 'user-b',
  senderVerifiedAdult: true,
  senderIsMember: true,
  recipientIsMember: true,
  sentTodayCount: 0,
};

test('주문 정책 — 정상 주문은 서버 카탈로그 금액으로 승인', () => {
  const v = validateCreateOrder(baseCtx);
  assert.deepEqual(v, { ok: true, amount: 5_000 });
});

test('주문 정책 — 미인증 사용자 결제 시도 거부', () => {
  const v = validateCreateOrder({ ...baseCtx, senderVerifiedAdult: false });
  assert.deepEqual(v, { ok: false, reason: 'identity_not_verified' });
});

test('주문 정책 — 응원에 없는 티어(2만원) 거부', () => {
  const v = validateCreateOrder({ ...baseCtx, tier: 'grand_cup' });
  assert.deepEqual(v, { ok: false, reason: 'invalid_tier' });
});

test('주문 정책 — 같은 방 멤버가 아니면 거부 (보낸/받는 쪽 각각)', () => {
  assert.equal(validateCreateOrder({ ...baseCtx, senderIsMember: false }).ok, false);
  assert.equal(validateCreateOrder({ ...baseCtx, recipientIsMember: false }).ok, false);
});

test('주문 정책 — 자기 자신에게 응원 한잔 금지', () => {
  const v = validateCreateOrder({ ...baseCtx, recipientId: 'user-a' });
  assert.deepEqual(v, { ok: false, reason: 'self_cheer_not_allowed' });
});

test('주문 정책 — 일일 한도 경계값 (한도-1 허용, 한도 도달 거부)', () => {
  assert.equal(validateCreateOrder({ ...baseCtx, sentTodayCount: DAILY_CHEER_LIMIT - 1 }).ok, true);
  const v = validateCreateOrder({ ...baseCtx, sentTodayCount: DAILY_CHEER_LIMIT });
  assert.deepEqual(v, { ok: false, reason: 'daily_limit_exceeded' });
});

test('주문 정책 — 내기 주문은 자기 몫만 (남의 몫 결제 금지)', () => {
  const ok = validateCreateOrder({ ...baseCtx, orderType: 'bet', tier: 'grand_cup', recipientId: 'user-a' });
  assert.deepEqual(ok, { ok: true, amount: 20_000 });
  const bad = validateCreateOrder({ ...baseCtx, orderType: 'bet', tier: 'grand_cup' });
  assert.deepEqual(bad, { ok: false, reason: 'bet_order_must_be_self' });
});

// ─── 결제 대조: 금액 위변조 방어 ─────────────────────────
const order = { id: 'order-1', amount: 5_000, status: 'created' };

test('결제 대조 — 정상 승인 통과', () => {
  const v = paymentMatchesOrder(order, { orderId: 'order-1', amount: 5_000, status: 'DONE' });
  assert.deepEqual(v, { ok: true });
});

test('결제 대조 — 금액 위변조(1원이라도 다름) 거부', () => {
  for (const amount of [4_999, 5_001, 0, 50_000]) {
    const v = paymentMatchesOrder(order, { orderId: 'order-1', amount, status: 'DONE' });
    assert.deepEqual(v, { ok: false, reason: 'amount_mismatch' }, `amount=${amount}`);
  }
});

test('결제 대조 — 다른 주문의 결제키 재사용 거부', () => {
  const v = paymentMatchesOrder(order, { orderId: 'order-999', amount: 5_000, status: 'DONE' });
  assert.deepEqual(v, { ok: false, reason: 'order_id_mismatch' });
});

test('결제 대조 — 이미 처리된 주문 재승인 거부 (중복 결제 방지)', () => {
  for (const status of ['paid', 'issued', 'auto_refund', 'donated']) {
    const v = paymentMatchesOrder({ ...order, status }, { orderId: 'order-1', amount: 5_000, status: 'DONE' });
    assert.deepEqual(v, { ok: false, reason: 'order_not_payable' }, `status=${status}`);
  }
});

test('결제 대조 — PG 미승인(DONE 아님) 거부', () => {
  const v = paymentMatchesOrder(order, { orderId: 'order-1', amount: 5_000, status: 'FAILED' });
  assert.deepEqual(v, { ok: false, reason: 'pg_not_done' });
});

// ─── Mock 제공자 (Edge Function 이 쓰는 동작 그대로) ──────
test('mock PG — paymentKey 의 주문·금액을 승인 결과로 반환, 형식 오류는 FAILED', async () => {
  const pg = createMockPgClient();
  assert.deepEqual(
    await pg.confirm('MOCKPAY:order-1:5000', 'order-1'),
    { orderId: 'order-1', amount: 5_000, status: 'DONE' },
  );
  const bad = await pg.confirm('garbage-key', 'order-1');
  assert.equal(bad.status, 'FAILED');
});

test('mock 기프티콘 — 발급 성공/실패 경로 (실패 → 자동 환불 시나리오의 재료)', async () => {
  const okClient = createMockGifticonClient();
  const { voucherRef } = await okClient.issue('one_cup', 'user-b-uuid');
  assert.match(voucherRef, /^MOCK-VOUCHER-one_cup-/);

  const failClient = createMockGifticonClient(['one_cup']);
  await assert.rejects(() => failClient.issue('one_cup', 'user-b-uuid'), /mock_issue_failed/);
});
