// 🚀 create-gift-order — 응원 한잔 / 나와의 내기 주문 생성 (결제창 띄우기 전 단계)
//
// 호출: supabase.functions.invoke('create-gift-order', { body: { challengeId, recipientId, productTier, orderType? } })
//   - 응원 한잔: orderType 생략(기본 'cheer'), recipientId = 받는 동료
//   - 나와의 내기: orderType = 'bet', recipientId 무시 → 서버가 본인(=발신자)으로 강제
// 반환: { orderId, amount } — 클라이언트는 이 금액으로 PG 결제창을 연다.
//
// 원칙 (PHASE2_FINTECH_PLAN.md 1.6 · 2.1-3):
//   - 금액·상품은 서버 카탈로그가 결정. 클라이언트 금액 입력란 자체가 없다.
//   - 본인인증(성인) + 같은 방 활성 멤버 + 일일 한도 — 전부 서버에서 판정 (orderPolicy.ts).
//   - 나와의 내기(self-bet)만 오픈: 나홀로(solo)·응원받기(cheered) 방의 도전자(개설자) 본인 1잔.
//     다인 내기(group: 다함께·누구나)는 법률 자문 게이트(⑤c) 통과 전까지 여기서 차단.

// @ts-nocheck — Deno 글로벌

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { validateCreateOrder } from '../_shared/payments/orderPolicy.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// KST 자정(UTC) — 일일 한도 카운트 기준
function kstDayStartUtcIso(): string {
  const kstNow = new Date(Date.now() + 9 * 3600_000);
  const dayStartKst = Date.UTC(kstNow.getUTCFullYear(), kstNow.getUTCMonth(), kstNow.getUTCDate());
  return new Date(dayStartKst - 9 * 3600_000).toISOString();
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json(405, { error: 'method_not_allowed' });

  const authClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } },
  );
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) return json(401, { error: 'unauthorized' });

  const { challengeId, recipientId, productTier, proofId, orderType, donationMode } = await req.json().catch(() => ({}));
  // 나와의 내기는 자기 몫 주문 — 받는 사람은 항상 본인 (클라가 보낸 recipientId 는 무시·신뢰 안 함)
  const type = orderType === 'bet' ? 'bet' : 'cheer';
  const effectiveRecipient = type === 'bet' ? user.id : recipientId;
  // 기부 모드 — 내기만 유효, 화이트리스트 외 값은 기본(commitment)으로 (클라 입력 불신)
  const betDonationMode = (type === 'bet' && ['commitment', 'pledge', 'always'].includes(donationMode))
    ? donationMode : 'commitment';
  if (!challengeId || !productTier || (type === 'cheer' && !recipientId)) {
    return json(400, { error: 'missing_fields' });
  }

  const service = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  // 내기 주문에서 실제 적용할 티어·모드 — 다인 내기는 챌린지 설정을 서버가 강제(클라값 무시)
  let effectiveTier = productTier;
  let effectiveMode = betDonationMode;

  // 🚀 내기 주문 서버 게이트 — 클라이언트가 절대 결정 못 하는 것 (PHASE2 2.1)
  if (type === 'bet') {
    const { data: ch } = await service
      .from('challenges')
      .select('kind, creator_id, end_date, bet_tier, bet_donation_mode')
      .eq('id', challengeId)
      .maybeSingle();
    if (!ch) return json(404, { error: 'challenge_not_found' });
    // 이미 종료된 챌린지엔 새 내기 금지 (KST)
    const todayKst = new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10);
    if (todayKst > ch.end_date) return json(403, { error: 'bet_challenge_finished' });

    if (ch.kind === 'solo' || ch.kind === 'cheered') {
      // ⑤a 나와의 내기 — 도전자(개설자) 본인만, 티어·모드는 본인 선택(클라값)
      if (ch.creator_id !== user.id) return json(403, { error: 'bet_challenger_only' });
    } else if (ch.kind === 'closed' || ch.kind === 'open') {
      // ⑤c 다인 내기 — 챌린지에 내기가 걸려 있어야 하고, 티어·모드는 챌린지 설정을 강제
      if (!ch.bet_tier) return json(403, { error: 'bet_not_enabled' });
      effectiveTier = ch.bet_tier;
      effectiveMode = ['commitment', 'pledge', 'always'].includes(ch.bet_donation_mode)
        ? ch.bet_donation_mode : 'commitment';
      // 활성 멤버 여부는 아래 orderPolicy(senderIsMember) 가 검증 (개설자 아니어도 멤버면 참여)
    } else {
      return json(403, { error: 'bet_room_not_allowed' });
    }

    // 1인 1내기 — 이미 건 내기가 있으면 거부 (생성 실패분 canceled/pay_failed 만 재시도 허용)
    const { data: existing } = await service
      .from('gift_orders')
      .select('id')
      .eq('challenge_id', challengeId)
      .eq('sender_id', user.id)
      .eq('order_type', 'bet')
      .not('status', 'in', '(canceled,pay_failed)')
      .limit(1);
    if (existing && existing.length > 0) return json(409, { error: 'bet_already_exists' });
  }

  // 판정 재료 수집 — 멤버십(포기자 제외) / 성인 인증 / 오늘 발신 수(응원 한도용)
  const [memberships, adultRes, todayRes] = await Promise.all([
    service.from('challenge_members')
      .select('user_id')
      .eq('challenge_id', challengeId)
      .in('user_id', [user.id, effectiveRecipient])
      .is('gave_up_at', null),
    service.rpc('is_adult_verified', { p_user_id: user.id }),
    service.from('gift_orders')
      .select('id', { count: 'exact', head: true })
      .eq('sender_id', user.id)
      .eq('order_type', 'cheer')
      .gte('created_at', kstDayStartUtcIso())
      .not('status', 'in', '(canceled,pay_failed)'),
  ]);

  const memberIds = new Set((memberships.data ?? []).map((m) => m.user_id));
  const verdict = validateCreateOrder({
    orderType: type,             // 'cheer' | 'bet' (bet 은 위 게이트 통과 — self 또는 group)
    tier: effectiveTier,         // 다인 내기는 챌린지 설정 티어
    senderId: user.id,
    recipientId: effectiveRecipient,
    senderVerifiedAdult: Boolean(adultRes.data),
    senderIsMember: memberIds.has(user.id),
    recipientIsMember: memberIds.has(effectiveRecipient),
    sentTodayCount: todayRes.count ?? 0,
  });
  if (!verdict.ok) return json(403, { error: verdict.reason });

  // 한잔을 보낸 인증 카드 연결 (0035) — 응원 한잔 전용. 검증: 해당 챌린지의 수신자 인증일 때만 기록
  let linkedProofId: string | null = null;
  if (type === 'cheer' && proofId && typeof proofId === 'string') {
    const { data: proof } = await service
      .from('proofs')
      .select('id')
      .eq('id', proofId)
      .eq('challenge_id', challengeId)
      .eq('user_id', effectiveRecipient)
      .maybeSingle();
    linkedProofId = proof?.id ?? null;
  }

  const { data: order, error: insErr } = await service
    .from('gift_orders')
    .insert({
      order_type: type,
      challenge_id: challengeId,
      sender_id: user.id,
      recipient_id: effectiveRecipient,   // bet 은 본인(=sender)
      product_tier: effectiveTier,        // 다인 내기는 챌린지 설정 티어
      amount: verdict.amount,     // 서버 카탈로그 가격 — 유일한 금액 출처
      status: 'created',
      proof_id: linkedProofId,
      donation_mode: effectiveMode,   // 내기 기부 모드 (cheer 는 commitment / 다인은 챌린지 설정)
    })
    .select('id, amount')
    .single();
  if (insErr) return json(500, { error: insErr.message });

  return json(200, { orderId: order.id, amount: order.amount });
});
