// 🚀 응원 한잔·내기 한잔 상품 카탈로그 — 금액의 단일 진실원천
// 클라이언트가 보낸 금액은 절대 신뢰하지 않는다. 모든 금액은 이 카탈로그에서 서버가 결정.
// 티어 확정: PHASE2_FINTECH_PLAN.md v0.4 — 응원 2종(5천/1만) · 내기 3종(5천/1만/2만)

export type OrderType = 'cheer' | 'bet';
export type ProductTier = 'one_cup' | 'hearty_cup' | 'grand_cup';

export const TIER_LABEL: Record<ProductTier, string> = {
  one_cup: '☕ 한잔',
  hearty_cup: '🍰 든든한 한잔',
  grand_cup: '🎁 거하게 한잔',
};

// 응원에는 2만원 티어가 없다 — 응원 2종 / 내기 3종 (사용자 확정)
const CATALOG: Record<OrderType, Partial<Record<ProductTier, number>>> = {
  cheer: { one_cup: 5_000, hearty_cup: 10_000 },
  bet: { one_cup: 5_000, hearty_cup: 10_000, grand_cup: 20_000 },
};

// 해당 주문 종류에서 파는 티어면 가격, 아니면 null (= 주문 거부)
export function priceOf(orderType: OrderType, tier: ProductTier): number | null {
  return CATALOG[orderType][tier] ?? null;
}
