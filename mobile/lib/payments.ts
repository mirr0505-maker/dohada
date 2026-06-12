// 🚀 응원 한잔 — 클라이언트 함수 (Phase 2 Stage 1.5, 결제는 전부 mock)
// 금액·정책의 진실원천은 서버(Edge Function + 카탈로그). 여기 가격표는 표시 전용.
// 실서비스 전환(Stage 3)은 서버 providers.ts 교체 — 이 파일의 mock 문자열 두 곳도 함께 교체.
import { supabase } from './supabase';

// ☕ 파일럿 게이트 — Stage 4 베타 오픈 전까지 지정 계정만 (mock 결제 노출 방지)
// 테스트 계정 추가 시 여기에 이메일 추가 후 OTA. 전체 오픈은 게이트 제거 (PHASE2 Stage 4)
export const GIFT_PILOT_EMAILS = ['mirr0505@gmail.com', 'marianne0519@gmail.com', 'longleg07@gmail.com'];

export function isGiftPilotEmail(email: string | undefined | null): boolean {
  return __DEV__ || GIFT_PILOT_EMAILS.includes(email ?? '');
}

// 상태 → 사용자 문구 (수령 화면·내역 화면 공용)
export const GIFT_STATUS_LABEL: Record<string, string> = {
  created: '결제 대기 중',
  paid: '도착 — 받기를 기다리고 있어요',
  issued: '교환권 발급됨',
  delivered: '받았어요 ☕',
  donated: '기부로 돌렸어요 💚',
  auto_refund: '발급 실패로 자동 환불되었어요',
  pay_failed: '결제가 완료되지 않았어요',
  canceled: '취소된 주문이에요',
};

export type GiftTier = 'one_cup' | 'hearty_cup';

// 표시 전용 가격표 — 서버 카탈로그(supabase/functions/_shared/payments/catalog.ts)와 동일해야 함
export const GIFT_TIERS: { tier: GiftTier; label: string; price: number; desc: string }[] = [
  { tier: 'one_cup', label: '☕ 한잔', price: 5_000, desc: '커피 한 잔의 응원' },
  { tier: 'hearty_cup', label: '🍰 든든한 한잔', price: 10_000, desc: '커피와 디저트까지' },
];

// 🚀 나와의 내기 — 티어 3종 (5천/1만/2만, grand_cup 포함). 서버 catalog.ts 와 동일해야 함.
export type BetTier = 'one_cup' | 'hearty_cup' | 'grand_cup';
export const BET_TIERS: { tier: BetTier; label: string; price: number; desc: string }[] = [
  { tier: 'one_cup', label: '☕ 한잔', price: 5_000, desc: '가볍게 거는 다짐' },
  { tier: 'hearty_cup', label: '🍰 든든한 한잔', price: 10_000, desc: '제대로 걸어보기' },
  { tier: 'grand_cup', label: '🎁 거하게 한잔', price: 20_000, desc: '배수의 진을 치고' },
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

// 🚀 생년월일 입력 자동 하이픈 — 숫자만 치면 YYYY-MM-DD 로 정형 (형식 맞추는 수고 제거)
// mock·실서비스 모두 토큰은 YYYY-MM-DD 를 요구하므로 입력 단계에서 보정한다.
export function formatBirthDateInput(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 8);   // YYYYMMDD 8자리까지
  if (digits.length > 6) return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6)}`;
  if (digits.length > 4) return `${digits.slice(0, 4)}-${digits.slice(4)}`;
  return digits;
}

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

// 주문 생성 — 금액은 서버가 결정해 돌려준다. proofId = 보낸 인증 카드 연결 (도착 버튼용)
export async function createGiftOrder(params: {
  challengeId: string; recipientId: string; tier: GiftTier; proofId?: string | null;
}): Promise<{ orderId: string; amount: number }> {
  const { data, error } = await supabase.functions.invoke('create-gift-order', {
    body: {
      challengeId: params.challengeId,
      recipientId: params.recipientId,
      productTier: params.tier,
      proofId: params.proofId ?? null,
    },
  });
  if (error) throw new Error(await describeFnError(error));
  return { orderId: data.orderId, amount: data.amount };
}

// 🚀 나와의 내기 주문 생성 — 자기 몫 1잔. 받는 사람은 서버가 본인으로 강제 (recipientId 안 보냄)
export async function createBetOrder(params: {
  challengeId: string; tier: BetTier;
}): Promise<{ orderId: string; amount: number }> {
  const { data, error } = await supabase.functions.invoke('create-gift-order', {
    body: { challengeId: params.challengeId, orderType: 'bet', productTier: params.tier },
  });
  if (error) throw new Error(await describeFnError(error));
  return { orderId: data.orderId, amount: data.amount };
}

// 이 방에서 내가 건 내기 1건 (1인 1내기) — 진입/진행/정산 카드용. 종결-실패 상태는 제외.
export type MyBet = {
  id: string;
  status: string;
  product_tier: string;
  amount: number;
  created_at: string;
};

export async function fetchMyBet(challengeId: string, myUserId: string | undefined): Promise<MyBet | null> {
  if (!myUserId) return null;
  const { data, error } = await supabase
    .from('gift_orders')
    .select('id, status, product_tier, amount, created_at')
    .eq('challenge_id', challengeId)
    .eq('sender_id', myUserId)
    .eq('order_type', 'bet')
    .not('status', 'in', '(canceled,pay_failed,auto_refund)')   // 진행 중인 내기만
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) return null;
  return (data as MyBet) ?? null;
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

// 이 방에서 내가 받은 한잔들 — 본인 인증 카드 "☕ 한잔 도착" 버튼 + 폴백 배너용
export type ReceivedGift = {
  id: string;
  proof_id: string | null;
  status: string;
  product_tier: string;
  created_at: string;
  sender_nickname: string;
};

export async function fetchMyReceivedGifts(challengeId: string, myUserId: string): Promise<ReceivedGift[]> {
  if (!myUserId) return [];
  const { data, error } = await supabase
    .from('gift_orders')
    .select('id, proof_id, status, product_tier, created_at, sender:sender_id(nickname)')
    .eq('challenge_id', challengeId)
    .eq('recipient_id', myUserId)
    .in('status', ['paid', 'issued', 'delivered', 'donated'])   // 결제 전·실패 건은 수신자에게 의미 없음
    .order('created_at', { ascending: true });
  if (error) return [];
  return (data ?? []).map((g: any) => ({
    id: g.id,
    proof_id: g.proof_id ?? null,
    status: g.status,
    product_tier: g.product_tier,
    created_at: g.created_at,
    sender_nickname: g.sender?.nickname ?? '동료',
  }));
}

// 나의 한잔 내역 (보낸 것 + 받은 것) — 내기 한잔도 같은 테이블이라 오픈 시 자동 포함
export type GiftHistoryRow = {
  id: string;
  direction: 'sent' | 'received';
  order_type: 'cheer' | 'bet';
  product_tier: string;
  amount: number;
  status: string;
  created_at: string;
  counterpart_nickname: string;   // 보냈으면 받는 사람, 받았으면 보낸 사람
  challenge_title: string;
};

export async function fetchMyGiftHistory(myUserId: string, limit = 50): Promise<GiftHistoryRow[]> {
  if (!myUserId) return [];
  const { data, error } = await supabase
    .from('gift_orders')
    .select(`
      id, order_type, product_tier, amount, status, created_at, sender_id, recipient_id,
      sender:sender_id(nickname), recipient:recipient_id(nickname),
      challenge:challenge_id(title)
    `)
    .or(`sender_id.eq.${myUserId},recipient_id.eq.${myUserId}`)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map((g: any) => {
    const sent = g.sender_id === myUserId;
    return {
      id: g.id,
      direction: (sent ? 'sent' : 'received') as 'sent' | 'received',
      order_type: g.order_type,
      product_tier: g.product_tier,
      amount: g.amount,
      status: g.status,
      created_at: g.created_at,
      counterpart_nickname: (sent ? g.recipient?.nickname : g.sender?.nickname) ?? '동료',
      challenge_title: g.challenge?.title ?? '',
    };
  });
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
