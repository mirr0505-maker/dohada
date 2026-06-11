// 🚀 주문 생성 정책 — "클라이언트가 절대 결정하지 못하는 것" 의 서버측 판정 (순수 함수)
// Edge Function(create-gift-order)이 DB 조회 결과를 모아 이 함수 하나로 판정한다.
import { type OrderType, type ProductTier, priceOf } from './catalog.ts';

// 응원 한잔 일일 발신 한도 — 어뷰징·결제사고 폭발 반경 제한 (PHASE2_FINTECH_PLAN.md 1.2)
export const DAILY_CHEER_LIMIT = 3;

export type CreateOrderContext = {
  orderType: OrderType;
  tier: ProductTier;
  senderId: string;
  recipientId: string;
  senderVerifiedAdult: boolean;   // 휴대폰 본인인증 + 만 19세 (is_adult_verified)
  senderIsMember: boolean;        // 같은 챌린지 활성 멤버인가 (도전 인연 = 같은 방)
  recipientIsMember: boolean;
  sentTodayCount: number;         // 오늘(KST) 보낸 응원 한잔 건수 (취소·결제실패 제외)
};

export type CreateOrderVerdict =
  | { ok: true; amount: number }
  | { ok: false; reason: string };

export function validateCreateOrder(ctx: CreateOrderContext): CreateOrderVerdict {
  // 1. 본인인증 + 성인 — 돈 기능 공통 게이트 (미인증 사용자 결제 시도 엣지 케이스)
  if (!ctx.senderVerifiedAdult) {
    return { ok: false, reason: 'identity_not_verified' };
  }
  // 2. 상품이 해당 주문 종류에서 파는 티어인가 — 금액은 카탈로그가 결정
  const amount = priceOf(ctx.orderType, ctx.tier);
  if (amount === null) {
    return { ok: false, reason: 'invalid_tier' };
  }
  // 3. 도전 인연 검증 — 보내는/받는 사람 모두 같은 방 활성 멤버
  if (!ctx.senderIsMember || !ctx.recipientIsMember) {
    return { ok: false, reason: 'not_a_member' };
  }
  // 4. 응원 한잔 전용 규칙
  if (ctx.orderType === 'cheer') {
    if (ctx.senderId === ctx.recipientId) {
      return { ok: false, reason: 'self_cheer_not_allowed' };
    }
    if (ctx.sentTodayCount >= DAILY_CHEER_LIMIT) {
      return { ok: false, reason: 'daily_limit_exceeded' };
    }
  }
  // 5. 내기 한잔은 자기 몫 주문 — 수신자 = 본인만 허용 (남의 몫 결제 금지)
  if (ctx.orderType === 'bet' && ctx.senderId !== ctx.recipientId) {
    return { ok: false, reason: 'bet_order_must_be_self' };
  }
  return { ok: true, amount };
}
