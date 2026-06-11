// 🚀 verify-identity — 휴대폰 본인인증 (돈 기능 첫 사용 게이트)
//
// 호출: 앱에서 supabase.functions.invoke('verify-identity', { body: { identityToken } })
//   - Stage 1: identityToken = 'MOCKID:<YYYY-MM-DD>:<phone>' (mock)
//   - Stage 3: PASS/NICE/KCB 인증 완료 토큰으로 교체 (providers.ts 구현체만 교체)
//
// 동작: 인증 결과(생년월일·전화번호·DI)를 user_verifications 에 upsert.
//   - DI 가 이미 다른 계정에 묶여 있으면 409 — 1인 다계정 돈기능 차단.
//   - user_verifications 는 RLS 로 본인 SELECT 만 허용, 쓰기는 이 함수(service role) 전용.

// @ts-nocheck — Deno 글로벌

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { createMockIdentityClient } from '../_shared/payments/providers.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Stage 1 주입 지점 — 실서비스 전환 시 이 한 줄만 교체
const identityClient = createMockIdentityClient();

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json(405, { error: 'method_not_allowed' });

  // 1. 호출자 확인 (사용자 JWT)
  const authClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } },
  );
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) return json(401, { error: 'unauthorized' });

  const { identityToken } = await req.json().catch(() => ({}));
  if (!identityToken || typeof identityToken !== 'string') {
    return json(400, { error: 'identity_token_required' });
  }

  // 2. 본인인증 수행 (Stage 1: mock)
  let identity;
  try {
    identity = await identityClient.verify(identityToken);
  } catch (_e) {
    return json(400, { error: 'identity_verification_failed' });
  }

  const service = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  // 3. DI 중복 — 같은 사람이 다른 계정으로 이미 인증했으면 거부
  const { data: diOwner } = await service
    .from('user_verifications')
    .select('user_id')
    .eq('di', identity.di)
    .maybeSingle();
  if (diOwner && diOwner.user_id !== user.id) {
    return json(409, { error: 'di_already_bound' });
  }

  // 4. 저장 (재인증 시 갱신) — 저장 최소화: 생년월일·전화번호·DI 만
  const { error: upsertErr } = await service.from('user_verifications').upsert({
    user_id: user.id,
    birth_date: identity.birthDate,
    phone: identity.phone,
    di: identity.di,
    verified_at: new Date().toISOString(),
  });
  if (upsertErr) return json(500, { error: upsertErr.message });

  // 성인 여부는 저장값 기반 SQL 단일 소스로 판정 (클라 재계산 금지)
  const { data: isAdult } = await service.rpc('is_adult_verified', { p_user_id: user.id });
  return json(200, { verified: true, isAdult: Boolean(isAdult) });
});
