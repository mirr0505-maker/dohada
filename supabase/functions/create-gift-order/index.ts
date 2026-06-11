// 🚀 create-gift-order — 응원 한잔 주문 생성 (결제창 띄우기 전 단계)
//
// 호출: supabase.functions.invoke('create-gift-order', { body: { challengeId, recipientId, productTier } })
// 반환: { orderId, amount } — 클라이언트는 이 금액으로 PG 결제창을 연다.
//
// 원칙 (PHASE2_FINTECH_PLAN.md 1.6):
//   - 금액·상품은 서버 카탈로그가 결정. 클라이언트 금액 입력란 자체가 없다.
//   - 본인인증(성인) + 같은 방 활성 멤버 + 일일 한도 — 전부 서버에서 판정 (orderPolicy.ts).
//   - 내기 한잔(bet) 주문은 법률 자문 게이트 통과 전까지 코드에서 차단.

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

  const { challengeId, recipientId, productTier } = await req.json().catch(() => ({}));
  if (!challengeId || !recipientId || !productTier) {
    return json(400, { error: 'missing_fields' });
  }

  const service = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  // 판정 재료 수집 — 멤버십(포기자 제외) / 성인 인증 / 오늘 발신 수
  const [memberships, adultRes, todayRes] = await Promise.all([
    service.from('challenge_members')
      .select('user_id')
      .eq('challenge_id', challengeId)
      .in('user_id', [user.id, recipientId])
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
    orderType: 'cheer',          // 🔒 내기(bet) 주문 생성은 자문 게이트 통과 후 별도 오픈
    tier: productTier,
    senderId: user.id,
    recipientId,
    senderVerifiedAdult: Boolean(adultRes.data),
    senderIsMember: memberIds.has(user.id),
    recipientIsMember: memberIds.has(recipientId),
    sentTodayCount: todayRes.count ?? 0,
  });
  if (!verdict.ok) return json(403, { error: verdict.reason });

  const { data: order, error: insErr } = await service
    .from('gift_orders')
    .insert({
      order_type: 'cheer',
      challenge_id: challengeId,
      sender_id: user.id,
      recipient_id: recipientId,
      product_tier: productTier,
      amount: verdict.amount,     // 서버 카탈로그 가격 — 유일한 금액 출처
      status: 'created',
    })
    .select('id, amount')
    .single();
  if (insErr) return json(500, { error: insErr.message });

  return json(200, { orderId: order.id, amount: order.amount });
});
