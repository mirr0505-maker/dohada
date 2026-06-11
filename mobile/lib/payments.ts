// 🚀 응원 한잔 — 클라이언트 함수 (Phase 2 Stage 1.5, 결제는 전부 mock)
// 금액·정책의 진실원천은 서버(Edge Function + 카탈로그). 여기 가격표는 표시 전용.
// 실서비스 전환(Stage 3)은 서버 providers.ts 교체 — 이 파일의 mock 문자열 두 곳도 함께 교체.
import { supabase } from './supabase';

export type GiftTier = 'one_cup' | 'hearty_cup';

// 표시 전용 가격표 — 서버 카탈로그(supabase/functions/_shared/payments/catalog.ts)와 동일해야 함
export const GIFT_TIERS: { tier: GiftTier; label: string; price: number; desc: string }[] = [
  { tier: 'one_cup', label: '☕ 한잔', price: 5_000, desc: '커피 한 잔의 응원' },
  { tier: 'hearty_cup', label: '🍰 든든한 한잔', price: 10_000, desc: '커피와 디저트까지' },
];

export type GiftOrderRow = {
  id: string;
  order_type: 'cheer' | 'bet';
  challenge_id: string;
  sender_id: string;
  recipient_id: string;
  product_tier: string;
  amount: number;
  status: string;
  voucher_ref: string | null;
  created_at: string;
  sender: { nickname: string; avatar_url: string | null } | null;
  recipient: { nickname: string; avatar_url: string | null } | null;
};

// 본인인증 여부 — user_verifications 는 RLS 로 본인 행만 보임
export async function fetchMyVerification(myUserId: string): Promise<{ verified: boolean; isAdult: boolean }> {
  const { data: row } = await supabase
    .from('user_verifications')
    .select('user_id')
    .eq('user_id', myUserId)
    .maybeSingle();
  if (!row) return { verified: false, isAdult: false };
  const { data: isAdult } = await supabase.rpc('is_adult_verified', { p_user_id: myUserId });
  return { verified: true, isAdult: Boolean(isAdult) };
}

// 휴대폰 본인인증 — Stage 1 은 mock 토큰 (실서비스: PASS SDK 결과 토큰으로 교체)
export async function verifyIdentityMock(birthDate: string, phone: string): Promise<{ isAdult: boolean }> {
  const { data, error } = await supabase.functions.invoke('verify-identity', {
    body: { identityToken: `MOCKID:${birthDate}:${phone}` },
  });
  if (error) throw new Error(await describeFnError(error));
  return { isAdult: Boolean(data?.isAdult) };
}

// 주문 생성 — 금액은 서버가 결정해 돌려준다
export async function createGiftOrder(params: {
  challengeId: string; recipientId: string; tier: GiftTier;
}): Promise<{ orderId: string; amount: number }> {
  const { data, error } = await supabase.functions.invoke('create-gift-order', {
    body: { challengeId: params.challengeId, recipientId: params.recipientId, productTier: params.tier },
  });
  if (error) throw new Error(await describeFnError(error));
  return { orderId: data.orderId, amount: data.amount };
}

// 결제 승인 — Stage 1 은 mock 결제키 (실서비스: PG 결제창이 돌려준 paymentKey 로 교체)
export async function confirmGiftPaymentMock(orderId: string, amount: number): Promise<void> {
  const { error } = await supabase.functions.invoke('confirm-gift-payment', {
    body: { orderId, paymentKey: `MOCKPAY:${orderId}:${amount}` },
  });
  if (error) throw new Error(await describeFnError(error));
}

// 수령 선택 — 내가 받기 / 기부하기
export async function claimGift(orderId: string, action: 'receive' | 'donate'):
  Promise<{ status: string; voucherRef?: string }> {
  const { data, error } = await supabase.functions.invoke('claim-gift', { body: { orderId, action } });
  if (error) throw new Error(await describeFnError(error));
  return { status: data.status, voucherRef: data.voucherRef };
}

// 주문 단건 조회 (수령 화면) — RLS 가 당사자(보낸/받는 사람)만 허용
export async function fetchGiftOrder(orderId: string): Promise<GiftOrderRow | null> {
  const { data, error } = await supabase
    .from('gift_orders')
    .select(`
      id, order_type, challenge_id, sender_id, recipient_id, product_tier,
      amount, status, voucher_ref, created_at,
      sender:sender_id(nickname, avatar_url),
      recipient:recipient_id(nickname, avatar_url)
    `)
    .eq('id', orderId)
    .maybeSingle();
  if (error) throw error;
  return (data as unknown as GiftOrderRow) ?? null;
}

// 방 단위 기부 합계 (ImpactModal "함께 만든 기부") — security definer 집계
export async function fetchChallengeDonationCount(challengeId: string): Promise<number> {
  const { data, error } = await supabase.rpc('challenge_donation_stats', { p_challenge_id: challengeId });
  if (error) return 0;     // 집계 실패는 치명적이지 않음 — 0 으로 폴백
  return Number(data) || 0;
}

// Edge Function 에러 본문에서 서버 reason 추출 (예: daily_limit_exceeded)
async function describeFnError(error: any): Promise<string> {
  try {
    const body = await error?.context?.json?.();
    if (body?.error) return String(body.error);
  } catch { /* 본문 파싱 실패 시 기본 메시지 */ }
  return error?.message ?? String(error);
}
