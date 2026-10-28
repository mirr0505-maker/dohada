// 🚀 finalize-story-goal — 완주 이야기의 "목표 결과"(달성 수·목표·달성률·성공) 계산·저장 (0084)
//
// 호출 ① 작성 직후 (클라):
//   supabase.functions.invoke('finalize-story-goal', { body: { storyId } })
//   → 200 { goal_current, goal_target, goal_rate, succeeded, success_threshold }
//   본인 이야기만 (story.user_id === JWT 사용자). 다시 불러도 같은 값 (재계산 = 멱등).
//
// 호출 ② 백필 (1회성 — 0084 이전에 쓴 이야기 채우기, 운영자가 직접):
//   Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>, body { backfill: true }
//   → 200 { processed, failed } — succeeded 가 null 인 이야기 전부
//
// 왜 Edge Function 인가: 판정 단일 소스는 mobile/lib/stats.ts — SQL 로 복제하지 않는다(0078 원칙).
//   같은 규칙의 순수 함수(_shared/goal/storyGoal.ts, 자동 테스트로 교차 대조)로 계산하고
//   결과 컬럼은 클라에 grant 가 없어 service_role 로만 쓴다 = 조작 불가.

// @ts-nocheck — Deno 글로벌

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { computeStoryGoal } from '../_shared/goal/storyGoal.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// 백필 한 번에 처리할 최대 이야기 수 — 남으면 다시 호출
const BACKFILL_BATCH = 500;

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// 이야기 한 건의 목표 결과를 계산해 저장 — claim-gift selfBetOutcome 과 같은 재료를 모은다
async function finalizeStory(service: any, story: { id: string; challenge_id: string; user_id: string }) {
  const { challenge_id: challengeId, user_id: userId } = story;
  const [chRes, memRes, proofRes, userRes, pauseRes] = await Promise.all([
    service.from('challenges')
      .select('start_date, end_date, frequency, success_threshold, goal_type, target_count')
      .eq('id', challengeId).maybeSingle(),
    service.from('challenge_members').select('joined_at').eq('challenge_id', challengeId).eq('user_id', userId).maybeSingle(),
    // 인증한 "날" = 저장 시점에 박힌 local_date(0077). count 형은 행 개수가 곧 달성 수
    service.from('proofs').select('local_date').eq('challenge_id', challengeId).eq('user_id', userId),
    service.from('users').select('timezone').eq('id', userId).maybeSingle(),
    service.from('challenge_pauses').select('start_date, end_date').eq('challenge_id', challengeId).eq('user_id', userId),
  ]);
  const ch = chRes.data;
  if (!ch) throw new Error('challenge_not_found');
  if (proofRes.error) throw new Error(proofRes.error.message);

  const threshold = ch.success_threshold ?? 100;
  const result = computeStoryGoal({
    goalType: ch.goal_type === 'count' ? 'count' : 'cadence',
    startDate: ch.start_date,
    endDate: ch.end_date,
    frequency: ch.frequency ?? 'daily',
    targetCount: ch.target_count ?? null,
    successThreshold: threshold,
    joinedAt: memRes.data?.joined_at ?? null,
    proofDates: (proofRes.data ?? []).map((r: { local_date: string }) => r.local_date),
    timezone: userRes.data?.timezone ?? 'Asia/Seoul',
    pauses: (pauseRes.data ?? []).map((r: { start_date: string; end_date: string }) => ({
      startDate: r.start_date, endDate: r.end_date,
    })),
  });

  const values = {
    goal_current: result.current,
    goal_target: result.target,
    goal_rate: result.rate,
    succeeded: result.succeeded,
    success_threshold: threshold,
  };
  const { error } = await service.from('completion_stories').update(values).eq('id', story.id);
  if (error) throw new Error(error.message);
  return values;
}

// JWT payload 의 role — 서명 검증은 게이트웨이(verify_jwt)가 이미 했다. 형식이 깨졌으면 null
function jwtRole(authHeader: string): string | null {
  try {
    const payload = authHeader.replace(/^Bearer\s+/, '').split('.')[1];
    const b64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
    return JSON.parse(atob(padded)).role ?? null;
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json(405, { error: 'method_not_allowed' });

  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const service = createClient(Deno.env.get('SUPABASE_URL')!, serviceKey);
  const authHeader = req.headers.get('Authorization') ?? '';
  const body = await req.json().catch(() => ({}));

  // ② 백필 — service role 토큰을 든 호출만 (일반 사용자 JWT 는 role='authenticated' 라 불가)
  //   키 문자열 비교는 쓰지 않는다 — 함수 안의 SUPABASE_SERVICE_ROLE_KEY 와 CLI 가 주는 키의 형태가 달라 403 이 났다.
  //   역할만 읽어도 안전한 이유: 이 함수는 JWT 검증 ON 으로 배포 → 게이트웨이가 서명을 먼저 검증한다.
  //   ⚠️ 그래서 --no-verify-jwt 로 배포하면 안 된다 (서명 없는 위조 토큰이 통과).
  if (body.backfill === true) {
    if (jwtRole(authHeader) !== 'service_role') return json(403, { error: 'forbidden' });
    const { data: stories, error } = await service
      .from('completion_stories')
      .select('id, challenge_id, user_id')
      .is('succeeded', null)
      .limit(BACKFILL_BATCH);
    if (error) return json(500, { error: error.message });
    let processed = 0;
    let failed = 0;
    for (const story of stories ?? []) {
      try {
        await finalizeStory(service, story);
        processed += 1;
      } catch (_e) {
        failed += 1;   // 한 건 실패가 나머지를 막지 않게 — 실패분은 null 로 남아 다음 호출에 다시 시도
      }
    }
    return json(200, { processed, failed });
  }

  // ① 작성 직후 — 본인 이야기만
  const authClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } },
  );
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) return json(401, { error: 'unauthorized' });

  const storyId = body.storyId;
  if (!storyId) return json(400, { error: 'missing_fields' });

  const { data: story } = await service
    .from('completion_stories')
    .select('id, challenge_id, user_id')
    .eq('id', storyId)
    .maybeSingle();
  if (!story) return json(404, { error: 'story_not_found' });
  if (story.user_id !== user.id) return json(403, { error: 'not_author' });

  try {
    return json(200, await finalizeStory(service, story));
  } catch (e) {
    return json(500, { error: (e as Error).message });
  }
});
