// 🚀 내기 한잔 정산 — 순수 함수 (Stage 1 선행 구현, 결제 연결은 법률 자문 게이트 통과 후)
//
// 기부 모드 3종 (개설 시 선택, ⑤a·⑤c 공통 — PHASE2_FINTECH_PLAN.md 2.1):
//   ① commitment (본전·커밋먼트, 기본):
//        완주 → 받기(issued) 또는 "기부로 돌리기"(donated) 본인 선택
//        미완주·포기 → 기부(donated) — 실패 인정 (self·group 동일, "전원 미완주 환불" 특례 없음)
//   ② pledge (완주 기부 서약):
//        완주 → 기부(donated) — 전원 완주면 "함께 기부"
//        미완주·포기 → 환불(refunded) — 기부 자격 없음(불이익), 돈은 안 나감
//   ③ always (무조건 기부):
//        완주·미완주 무관 → 전원 기부(donated)
//
//   중단(aborted: 방 폭파·개설자 포기 / 시스템 무효) → 모드 무관 전원 환불
//
// 불변 원칙(모든 모드): 참여자 간 이전은 0 — 자기 한잔은 자기가 받거나/기부/환불.
//   완주자가 미완주자 몫을 가져가는 구조는 어떤 모드에도 없음 (도박 구성요건 차단).

export type BetOutcome = 'completed' | 'failed' | 'gave_up';
export type BetMode = 'group' | 'self';
export type DonationMode = 'commitment' | 'pledge' | 'always';

export type BetParticipant = {
  userId: string;
  orderId: string;          // gift_orders.id (status = 'paid')
  outcome: BetOutcome;
  donateChoice?: boolean;   // commitment 모드 완주자의 "내 한잔, 기부로 돌리기" 선택 (다른 모드는 무시)
};

export type BetSettlement = {
  issued: string[];      // 발급할 주문 (완주 + 수령 선택)
  donated: string[];     // 기부 풀로
  refunded: string[];    // 전액 환불
};

export function settleBet(
  participants: BetParticipant[],
  opts: { aborted?: boolean; mode?: BetMode; donationMode?: DonationMode } = {},
): BetSettlement {
  // 중단(방 폭파·개설자 포기 / self 는 시스템 무효만): 승부 자체가 무효 — 전원 환불 (모드 무관)
  if (opts.aborted) {
    return { issued: [], donated: [], refunded: participants.map(p => p.orderId) };
  }

  const donationMode = opts.donationMode ?? 'commitment';

  // ③ 무조건 기부 — 완주 여부와 무관하게 전원 기부
  if (donationMode === 'always') {
    return { issued: [], donated: participants.map(p => p.orderId), refunded: [] };
  }

  // ② 완주 기부 서약 — 완주자만 기부, 미완주자는 환불(돈 안 나감). self/group 동일.
  if (donationMode === 'pledge') {
    const donated: string[] = [];
    const refunded: string[] = [];
    for (const p of participants) {
      if (p.outcome === 'completed') donated.push(p.orderId);
      else refunded.push(p.orderId);
    }
    return { issued: [], donated, refunded };
  }

  // ① 본전(커밋먼트) — 완주 → 받기/기부(선택), 실패 → 기부. self·group 동일.
  // (구 "전원 미완주 → 전원 환불" 특례 제거 — 환불을 원하면 pledge 모드. 포기=실패 인정=기부와도 일관)
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
