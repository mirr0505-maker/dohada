// 🚀 claim-gift — 수신자의 "내가 받기 / 기부하기" 선택 (응원 한잔 수령)
//
// 호출: supabase.functions.invoke('claim-gift', { body: { orderId, action: 'receive' | 'donate' } })
//
// 흐름 (발급은 이 시점에 — 기프티콘 유효기간 + 기부 선택분 발급 낭비 방지):
//   받기:   paid ─(발급)→ issued → delivered (voucherRef 반환, 앱 내 바코드 표시)
//           발급 실패 → issue_failed → auto_refund (보낸 사람에게 환불 — 0033 트리거가 통지)
//   기부:   paid → donated (기부 풀 — 4절 기부 허브)
//   결과는 0033 트리거가 보낸 사람에게 피드백 알림 ("받았어요 ☕ / 기부로 돌렸어요 💚")

// @ts-nocheck — Deno 글로벌

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { validateClaim } from '../_shared/payments/claimPolicy.ts';
import { canTransition } from '../_shared/payments/giftStateMachine.ts';
import { createMockPgClient, createMockGifticonClient } from '../_shared/payments/providers.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Stage 1 주입 지점 — 실서비스 전환 시 이 두 줄만 교체
const pg = createMockPgClient();
const gifticon = createMockGifticonClient();

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
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

  const { orderId, action } = await req.json().catch(() => ({}));
  if (!orderId || !action) return json(400, { error: 'missing_fields' });

  const service = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  // 상태 전이 헬퍼 — 상태머신 검증 + 현재 상태 조건부 update (중복 탭 경합 방지)
  async function transition(fromStatus: string, toStatus: string, extra = {}) {
    if (!canTransition(fromStatus, toStatus)) {
      throw new Error(`illegal_transition:${fromStatus}->${toStatus}`);
    }
    const { data, error } = await service
      .from('gift_orders')
      .update({ status: toStatus, updated_at: new Date().toISOString(), ...extra })
      .eq('id', orderId)
      .eq('status', fromStatus)
      .select('id')
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw new Error('concurrent_transition');
    return data;
  }

  const { data: order } = await service
    .from('gift_orders')
    .select('id, recipient_id, status, product_tier, pg_payment_key')
    .eq('id', orderId)
    .maybeSingle();
  if (!order) return json(404, { error: 'order_not_found' });

  const verdict = validateClaim(order, user.id, action);
  if (!verdict.ok) return json(403, { error: verdict.reason });

  // 기부하기 — 발급 없이 기부 풀로
  if (action === 'donate') {
    await transition('paid', 'donated');
    return json(200, { status: 'donated' });
  }

  // 내가 받기 — 이 시점에 발급, 실패하면 자동 환불
  try {
    const { voucherRef } = await gifticon.issue(order.product_tier, order.recipient_id);
    await transition('paid', 'issued', { voucher_ref: voucherRef });
    await transition('issued', 'delivered');
    return json(200, { status: 'delivered', voucherRef });
  } catch (_issueErr) {
    await transition('paid', 'issue_failed', { fail_reason: 'gifticon_issue_failed' });
    await pg.cancel(order.pg_payment_key ?? '', 'gifticon_issue_failed');
    await transition('issue_failed', 'auto_refund');
    return json(502, { status: 'auto_refund', error: 'gifticon_issue_failed' });
  }
});
