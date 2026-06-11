// 🚀 confirm-gift-payment — 결제 승인 대조 + 기프티콘 발급 (응원 한잔 핵심 경로)
//
// 호출: 결제창 성공 후 supabase.functions.invoke('confirm-gift-payment', { body: { orderId, paymentKey } })
//   - Stage 1: paymentKey = 'MOCKPAY:<orderId>:<amount>' (mock PG)
//   - Stage 2~3: 토스페이먼츠 승인 API 로 교체 (providers.ts 구현체만 교체)
//
// 흐름: created ─(PG 승인 + 금액 대조)→ paid ─(발급)→ issued
//   - 대조 실패: PG 취소 + pay_failed (돈을 받지 않은 상태 보장)
//   - 발급 실패: PG 취소 + issue_failed → auto_refund (돈만 받은 상태 즉시 해소)
//   - 모든 전이는 giftStateMachine 검증 통과 필수.

// @ts-nocheck — Deno 글로벌

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { paymentMatchesOrder } from '../_shared/payments/verifyPayment.ts';
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

  const { orderId, paymentKey } = await req.json().catch(() => ({}));
  if (!orderId || !paymentKey) return json(400, { error: 'missing_fields' });

  const service = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  // 상태 전이 헬퍼 — 상태머신 검증 + 현재 상태 조건부 update (동시 요청 경합 방지)
  async function transition(fromStatus: string, toStatus: string, extra = {}) {
    if (!canTransition(fromStatus, toStatus)) {
      throw new Error(`illegal_transition:${fromStatus}->${toStatus}`);
    }
    const { data, error } = await service
      .from('gift_orders')
      .update({ status: toStatus, updated_at: new Date().toISOString(), ...extra })
      .eq('id', orderId)
      .eq('status', fromStatus)     // 다른 요청이 먼저 전이시켰으면 0 rows — 중복 처리 차단
      .select('id')
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw new Error('concurrent_transition');
    return data;
  }

  // 1. 주문 로드 — 결제자 본인만 승인 요청 가능
  const { data: order } = await service
    .from('gift_orders')
    .select('id, sender_id, amount, status, product_tier, recipient_id')
    .eq('id', orderId)
    .maybeSingle();
  if (!order) return json(404, { error: 'order_not_found' });
  if (order.sender_id !== user.id) return json(403, { error: 'not_order_owner' });

  // 2. PG 승인 + 대조 (금액 위변조 방어의 핵심)
  const pgResult = await pg.confirm(paymentKey, orderId);
  const verdict = paymentMatchesOrder(order, pgResult);
  if (!verdict.ok) {
    // 승인은 됐는데 대조 실패 → 즉시 취소 (돈을 받지 않은 상태로 복귀)
    if (pgResult.status === 'DONE') {
      await pg.cancel(paymentKey, `verify_failed:${verdict.reason}`);
    }
    if (order.status === 'created') {
      await transition('created', 'pay_failed', { fail_reason: verdict.reason });
    }
    return json(400, { error: verdict.reason });
  }

  // 3. 승인 확정
  await transition('created', 'paid', { pg_payment_key: paymentKey });

  // 4. 기프티콘 발급 — 실패 시 자동 환불 (paid 잔류 = 최악 상태, 반드시 해소)
  try {
    const { voucherRef } = await gifticon.issue(order.product_tier, order.recipient_id);
    await transition('paid', 'issued', { voucher_ref: voucherRef });
    return json(200, { status: 'issued', voucherRef });
  } catch (_issueErr) {
    await transition('paid', 'issue_failed', { fail_reason: 'gifticon_issue_failed' });
    await pg.cancel(paymentKey, 'gifticon_issue_failed');
    await transition('issue_failed', 'auto_refund');
    return json(502, { status: 'auto_refund', error: 'gifticon_issue_failed' });
  }
});
