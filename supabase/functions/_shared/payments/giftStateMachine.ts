// 🚀 gift_orders 상태머신 — 전이 검증의 단일 소스 (DB 트리거 이중 구현 없음)
// 흐름: created → paid → issued → delivered → redeemed
//   - 결제 실패/이탈: created → pay_failed | canceled
//   - 발급 실패: paid → issue_failed → auto_refund (돈만 받고 상품 못 주는 상태 금지)
//   - 기부 전환: paid → donated (수신자가 수령 대신 기부 선택 / 내기 미완주분)
//   - 내기 환불: paid → auto_refund (전원 미완주·방 폭파 — 정산 규칙은 betSettlement.ts)

export type GiftStatus =
  | 'created' | 'canceled' | 'pay_failed'
  | 'paid'
  | 'issued' | 'issue_failed' | 'auto_refund'
  | 'delivered' | 'donated' | 'redeemed'
  | 'refunded';

export const GIFT_STATUSES: GiftStatus[] = [
  'created', 'canceled', 'pay_failed',
  'paid',
  'issued', 'issue_failed', 'auto_refund',
  'delivered', 'donated', 'redeemed',
  'refunded',
];

// 상태별 허용 전이 — 여기 없는 전이는 전부 거부
const TRANSITIONS: Record<GiftStatus, GiftStatus[]> = {
  created: ['paid', 'pay_failed', 'canceled'],
  // 정산 환불(refunded) = pledge 미완주·다인 전원 미완주 (auto_refund 는 발급 실패 환불과 구분)
  paid: ['issued', 'issue_failed', 'donated', 'auto_refund', 'refunded'],
  issued: ['delivered'],
  delivered: ['redeemed'],
  issue_failed: ['auto_refund'],
  // 종결 상태 — 어디로도 못 감
  canceled: [],
  pay_failed: [],
  auto_refund: [],
  donated: [],
  redeemed: [],
  refunded: [],
};

export function canTransition(from: GiftStatus, to: GiftStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

export function isTerminal(status: GiftStatus): boolean {
  return TRANSITIONS[status].length === 0;
}

// 핵심 인변량 감시용: "돈은 받았는데 상품도 환불도 아닌" 잔류 위험 상태
// (운영에서 이 상태가 N분 이상 지속되면 알람 — Stage 4)
export function isMoneyHeldLimbo(status: GiftStatus): boolean {
  return status === 'paid' || status === 'issue_failed';
}
