// 🚀 refund-gift-order — 운영자 환불 (약관 10-3 청약철회·귀책 환불을 집행하는 유일한 경로)
//
// 호출: supabase.functions.invoke('refund-gift-order', { body: { orderId, reason } })  — 운영자 콘솔 전용
//
// 왜 EF 인가: PG 콘솔에서 취소하고 DB 를 손으로 고치면 상태머신을 우회하고 감사 로그가 비어
//   정산 대사(우리 DB 합계 = PG 정산 내역)가 깨진다. 환불은 반드시 이 경로로만 (PHASE2 §9 D5).
//
// 흐름: 관리자 확인 → 판정(refundPolicy) → PG 취소 → 상태 전이 → 감사 로그
//   - PG 취소가 먼저다: 전이를 먼저 하고 취소가 실패하면 "환불됨"으로 보이는데 돈은 안 돌아간 상태가 된다.
//   - 취소는 됐는데 전이가 경합으로 실패하면 409 + 감사 로그에 남겨 수동 대사로 잡는다.
//
// ⚠️ JWT 검증 ON 으로 배포 (--no-verify-jwt 금지). 관리자 판정은 is_admin() RPC — 호출자 JWT 기준.

// @ts-nocheck — Deno 글로벌

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { canTransition } from '../_shared/payments/giftStateMachine.ts';
import { planAdminRefund, normalizeRefundReason } from '../_shared/payments/refundPolicy.ts';
import { recordGiftEvent } from '../_shared/payments/audit.ts';
import { createMockPgClient } from '../_shared/payments/providers.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Stage 1 주입 지점 — 실서비스 전환 시 confirm-gift-payment·claim-gift 와 함께 교체
const pg = createMockPgClient();

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

  // 🔒 관리자만 — is_admin() 은 호출자 JWT(auth.uid()) 기준이라 authClient 로 부른다
  const { data: isAdmin } = await authClient.rpc('is_admin');
  if (isAdmin !== true) return json(403, { error: 'admin_only' });

  const body = await req.json().catch(() => ({}));
  const orderId = body?.orderId;
  const reason = normalizeRefundReason(body?.reason);
  if (!orderId) return json(400, { error: 'missing_order_id' });
  if (!reason) return json(400, { error: 'invalid_reason' });

  const service = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const { data: order } = await service
    .from('gift_orders')
    .select('id, status, pg_payment_key')
    .eq('id', orderId)
    .maybeSingle();
  if (!order) return json(404, { error: 'order_not_found' });

  const plan = planAdminRefund(order.status);
  if (!plan.ok) return json(409, { error: plan.reason, status: order.status });
  if (!canTransition(order.status, plan.to)) return json(409, { error: 'illegal_transition' });   // 이중 방어
  if (!order.pg_payment_key) return json(409, { error: 'missing_pg_payment_key' });

  // 1. PG 취소 — 실패하면 상태를 건드리지 않는다 (돈이 안 돌아갔는데 '환불됨'이 되면 안 됨)
  try {
    await pg.cancel(order.pg_payment_key, `admin_refund:${reason}`);
  } catch (e) {
    return json(502, { error: 'pg_cancel_failed', detail: String(e) });
  }

  // 2. 상태 전이 — 현재 상태 조건부 (그 사이 다른 전이가 있었으면 0 rows)
  const { data: moved, error: updErr } = await service
    .from('gift_orders')
    .update({ status: plan.to, updated_at: new Date().toISOString(), fail_reason: `admin_refund:${reason}` })
    .eq('id', orderId)
    .eq('status', order.status)
    .select('id')
    .maybeSingle();

  if (updErr || !moved) {
    // PG 는 취소됐는데 DB 는 못 바꿈 — 이력에 남겨 수동 대사로 잡는다
    await recordGiftEvent(service, {
      orderId, from: order.status, to: order.status, actorId: user.id, actorRole: 'admin',
      reason: `pg_canceled_but_transition_failed:${reason}`,
    });
    return json(409, { error: 'concurrent_transition' });
  }

  // 3. 감사 로그
  await recordGiftEvent(service, {
    orderId, from: order.status, to: plan.to, actorId: user.id, actorRole: 'admin', reason,
  });
  return json(200, { status: plan.to });
});
