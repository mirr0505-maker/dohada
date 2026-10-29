// 🚀 운영자 환불·감사 로그 — 자동 테스트 의무 영역 (CLAUDE.md: 결제 로직)
// 약관 10-3 을 집행하는 유일한 경로라, 상태별 허용/거부가 한 칸이라도 어긋나면 이중 지급·미환불 사고가 난다.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { planAdminRefund, normalizeRefundReason, REFUND_REASON_MAX } from '../supabase/functions/_shared/payments/refundPolicy.ts';
import { GIFT_STATUSES, canTransition, type GiftStatus } from '../supabase/functions/_shared/payments/giftStateMachine.ts';
import { buildGiftEventRow } from '../supabase/functions/_shared/payments/audit.ts';

test('환불 — 돈을 받았고 상품이 안 나간 paid 만 refunded 로', () => {
  assert.deepEqual(planAdminRefund('paid'), { ok: true, to: 'refunded' });
});

test('환불 — 발급 실패로 멈춘 issue_failed 는 auto_refund 로 마저 처리', () => {
  assert.deepEqual(planAdminRefund('issue_failed'), { ok: true, to: 'auto_refund' });
});

test('환불 — 교환권이 이미 나간 건은 거부 (상품+돈 이중 지급 방지, 약관 10-3 ②)', () => {
  for (const s of ['issued', 'delivered', 'redeemed'] as GiftStatus[]) {
    assert.deepEqual(planAdminRefund(s), { ok: false, reason: 'voucher_already_issued' }, s);
  }
});

test('환불 — 기부로 넘어간 건은 거부 (약관 10-3 ③)', () => {
  assert.deepEqual(planAdminRefund('donated'), { ok: false, reason: 'already_donated' });
});

test('환불 — 이미 환불됐거나 결제된 적 없는 건은 거부', () => {
  assert.equal(planAdminRefund('refunded').ok, false);
  assert.equal(planAdminRefund('auto_refund').ok, false);
  for (const s of ['created', 'canceled', 'pay_failed'] as GiftStatus[]) {
    assert.deepEqual(planAdminRefund(s), { ok: false, reason: 'not_paid' }, s);
  }
});

test('환불 — 허용되는 모든 전이는 상태머신이 인정하는 전이다 (우회 금지)', () => {
  for (const s of GIFT_STATUSES) {
    const plan = planAdminRefund(s);
    if (plan.ok) assert.ok(canTransition(s, plan.to), `${s} → ${plan.to}`);
  }
});

test('환불 — 모든 상태에 대해 판정이 정의돼 있다 (unknown_status 없음)', () => {
  for (const s of GIFT_STATUSES) {
    const plan = planAdminRefund(s);
    if (!plan.ok) assert.notEqual(plan.reason, 'unknown_status', s);
  }
});

test('환불 사유 — 공백·빈 값·비문자·초과 길이는 거부, 앞뒤 공백은 정리', () => {
  assert.equal(normalizeRefundReason(''), null);
  assert.equal(normalizeRefundReason('   '), null);
  assert.equal(normalizeRefundReason(undefined), null);
  assert.equal(normalizeRefundReason(42), null);
  assert.equal(normalizeRefundReason('x'.repeat(REFUND_REASON_MAX + 1)), null);
  assert.equal(normalizeRefundReason('  청약철회 요청(메일)  '), '청약철회 요청(메일)');
  assert.equal(normalizeRefundReason('x'.repeat(REFUND_REASON_MAX))?.length, REFUND_REASON_MAX);
});

test('감사 로그 — 행 모양 (생성은 from=null, 선택 필드는 null 로 채움)', () => {
  assert.deepEqual(
    buildGiftEventRow({ orderId: 'o1', from: null, to: 'created', actorId: 'u1', actorRole: 'sender' }),
    { order_id: 'o1', from_status: null, to_status: 'created', actor_id: 'u1', actor_role: 'sender', reason: null, pg_payload: null },
  );
  assert.deepEqual(
    buildGiftEventRow({ orderId: 'o2', from: 'paid', to: 'refunded', actorId: 'a1', actorRole: 'admin', reason: '청약철회', pgPayload: { canceled: true } }),
    { order_id: 'o2', from_status: 'paid', to_status: 'refunded', actor_id: 'a1', actor_role: 'admin', reason: '청약철회', pg_payload: { canceled: true } },
  );
});
