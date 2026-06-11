// 🚀 내기 한잔 정산 — 순수 함수 (Stage 1 선행 구현, 결제 연결은 법률 자문 게이트 통과 후)
// 규칙 (PHASE2_FINTECH_PLAN.md 2.1):
//   완주          → 자기 몫 수령 (issued). 단 "기부로 돌리기" 선택 시 donated
//   미완주·중도포기 → 자기 몫 기부 (donated) — 완주자 분배 영구 금지 (도박 구성요건 차단의 전제)
//   전원 미완주    → 전원 전액 환불 (refunded)
//   방 폭파·개설자 포기 (aborted) → 전원 전액 환불

export type BetOutcome = 'completed' | 'failed' | 'gave_up';

export type BetParticipant = {
  userId: string;
  orderId: string;          // gift_orders.id (status = 'paid')
  outcome: BetOutcome;
  donateChoice?: boolean;   // 완주자의 "내 한잔, 기부로 돌리기" 선택
};

export type BetSettlement = {
  issued: string[];      // 발급할 주문 (완주 + 수령 선택)
  donated: string[];     // 기부 풀로 (미완주·중도포기 + 완주자 기부 선택)
  refunded: string[];    // 전액 환불 (전원 미완주 / 중단)
};

export function settleBet(
  participants: BetParticipant[],
  opts: { aborted?: boolean } = {},
): BetSettlement {
  // 중단(방 폭파·개설자 포기): 승부 자체가 무효 — 완주 여부와 무관하게 전원 환불
  if (opts.aborted) {
    return { issued: [], donated: [], refunded: participants.map(p => p.orderId) };
  }

  const anyoneCompleted = participants.some(p => p.outcome === 'completed');

  // 전원 미완주: 기부가 아니라 전원 환불 — "벌칙"이 아니라 "약속 무산" 으로 취급
  if (!anyoneCompleted) {
    return { issued: [], donated: [], refunded: participants.map(p => p.orderId) };
  }

  const issued: string[] = [];
  const donated: string[] = [];
  for (const p of participants) {
    if (p.outcome === 'completed' && !p.donateChoice) issued.push(p.orderId);
    else donated.push(p.orderId);   // 완주+기부 선택 / 미완주 / 중도포기
  }
  return { issued, donated, refunded: [] };
}

// 핵심 인변량: issued + donated + refunded = 전체 주문, 중복·증발 없음
// (정산 실행 전 Edge Function 이 이 검사를 통과해야 DB 반영)
export function settlementInvariantHolds(
  participants: BetParticipant[],
  result: BetSettlement,
): boolean {
  const all = [...result.issued, ...result.donated, ...result.refunded];
  if (all.length !== participants.length) return false;
  const unique = new Set(all);
  if (unique.size !== all.length) return false;                       // 중복 없음
  return participants.every(p => unique.has(p.orderId));              // 증발 없음
}
