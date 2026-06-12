// 🚀 수령/정산 정책 — "내가 받기 / 기부하기 / 환불" 판정 (순수 함수)
// 발급은 수령 확정 시점에 한다 (기프티콘 유효기간 + 기부 선택분 발급 낭비 방지).
import type { DonationMode } from './betSettlement.ts';
import type { SelfBetOutcome } from './betOutcome.ts';

export type ClaimAction = 'receive' | 'donate' | 'refund';

export type ClaimOrderView = {
  recipient_id: string;
  status: string;        // 'paid' 여야만 수령/기부 선택 가능
};

export type ClaimVerdict = { ok: true } | { ok: false; reason: string };

export function validateClaim(order: ClaimOrderView, userId: string, action: ClaimAction): ClaimVerdict {
  if (action !== 'receive' && action !== 'donate') {       // 응원 한잔은 receive/donate 만
    return { ok: false, reason: 'invalid_action' };
  }
  if (order.recipient_id !== userId) {
    return { ok: false, reason: 'not_recipient' };       // 받는 사람 본인만 선택 가능
  }
  if (order.status !== 'paid') {
    return { ok: false, reason: 'not_claimable' };       // 이미 처리됐거나 결제 전
  }
  return { ok: true };
}

// 🚀 나와의 내기(self) per-주문 정산 정책 — 기부 모드 × 완주 결과 → 허용 액션 (settleBet 과 동일 규칙)
//   commitment: 완주→받기/기부 선택 / 실패→기부(인정)
//   pledge    : 완주→기부 / 실패→환불(돈 안 나감)
//   always    : 완주·실패 무관 기부
//   in_progress(종료 전)는 어떤 정산도 불가.
// ※ 다인(group)의 "전원 미완주→전원 환불"은 집단 조건이라 per-주문이 아니라 배치 정산(settleBet)에서 처리.
export function validateBetClaim(
  donationMode: DonationMode,
  outcome: SelfBetOutcome,
  action: ClaimAction,
): ClaimVerdict {
  if (outcome === 'in_progress') return { ok: false, reason: 'bet_in_progress' };
  const completed = outcome === 'completed';

  if (action === 'receive') {
    // 본전 수령은 commitment 모드 완주자만 — 그 외(서약·무조건·실패자)는 받기 불가
    return (donationMode === 'commitment' && completed)
      ? { ok: true } : { ok: false, reason: 'bet_receive_not_allowed' };
  }
  if (action === 'donate') {
    const ok =
      donationMode === 'commitment' ||                    // 완주 선택 / 실패 인정 둘 다 기부 가능
      (donationMode === 'pledge' && completed) ||          // 서약: 완주해야 기부
      donationMode === 'always';                           // 무조건 기부
    return ok ? { ok: true } : { ok: false, reason: 'bet_donate_not_allowed' };
  }
  // refund — 서약 모드에서 완주 못 했을 때만 (돈 안 나감)
  const ok = donationMode === 'pledge' && !completed;
  return ok ? { ok: true } : { ok: false, reason: 'bet_refund_not_allowed' };
}
