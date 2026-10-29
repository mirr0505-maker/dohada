// 🚀 운영자 환불 판정 — 약관 10-3(청약철회·귀책 환불)을 집행하는 유일한 경로의 규칙
// 순수 함수(DB·PG 무관) → npm test 로 검증. EF refund-gift-order 가 이 판정만 따른다.
//
// 왜 상태마다 다른가:
//   paid          → 돈은 받았고 상품은 아직 안 나감 = 전액 환불 가능 (정산 환불과 같은 'refunded')
//   issue_failed  → 발급이 실패했는데 자동 환불이 중간에 끊긴 경우 = 마저 환불 ('auto_refund')
//   issued/delivered/redeemed → 교환권이 이미 나감 = 여기서 환불하면 상품+돈 이중 지급.
//                   발급사 쪽 회수(미사용 확인)가 먼저라 이 경로로는 막는다 (약관 10-3 ②)
//   donated       → 기부 풀로 넘어감 = 집행 전이라도 여기서는 막는다 (약관 10-3 ③, 수동 판단)
//   그 외          → 돈을 받은 적이 없거나(created·canceled·pay_failed) 이미 환불됨
import type { GiftStatus } from './giftStateMachine.ts';

export type AdminRefundPlan =
  | { ok: true; to: Extract<GiftStatus, 'refunded' | 'auto_refund'> }
  | { ok: false; reason: string };

export function planAdminRefund(status: GiftStatus): AdminRefundPlan {
  switch (status) {
    case 'paid':
      return { ok: true, to: 'refunded' };
    case 'issue_failed':
      return { ok: true, to: 'auto_refund' };
    case 'issued':
    case 'delivered':
    case 'redeemed':
      return { ok: false, reason: 'voucher_already_issued' };
    case 'donated':
      return { ok: false, reason: 'already_donated' };
    case 'refunded':
    case 'auto_refund':
      return { ok: false, reason: 'already_refunded' };
    case 'created':
    case 'canceled':
    case 'pay_failed':
      return { ok: false, reason: 'not_paid' };
    default:
      return { ok: false, reason: 'unknown_status' };
  }
}

// 환불 사유 — 감사 로그에 남는 문장. 비어 있거나 지나치게 길면 거부 (나중에 왜 환불했는지 못 찾게 되므로)
export const REFUND_REASON_MAX = 200;

export function normalizeRefundReason(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const reason = raw.trim();
  if (reason.length === 0 || reason.length > REFUND_REASON_MAX) return null;
  return reason;
}
