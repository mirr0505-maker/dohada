// 🚀 수령 정책 — 받는 사람의 "내가 받기 / 기부하기" 판정 (순수 함수)
// 발급은 수령 확정 시점에 한다 (기프티콘 유효기간 + 기부 선택분 발급 낭비 방지).

export type ClaimAction = 'receive' | 'donate';

export type ClaimOrderView = {
  recipient_id: string;
  status: string;        // 'paid' 여야만 수령/기부 선택 가능
};

export type ClaimVerdict = { ok: true } | { ok: false; reason: string };

export function validateClaim(order: ClaimOrderView, userId: string, action: ClaimAction): ClaimVerdict {
  if (action !== 'receive' && action !== 'donate') {
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
