// 🚀 delete-account — 회원 탈퇴(계정 삭제): 익명화 + PII 삭제 + auth ban
//
// 호출: supabase.functions.invoke('delete-account')  (body 불필요 — JWT 로 본인 식별)
//
// 정책 (LAUNCH_CHECKLIST #4 — 하드삭제 금지):
//   모든 콘텐츠 FK 가 on delete cascade → auth.users 하드삭제 시 개설 방·동료 인증·댓글까지
//   연쇄 삭제 = 동료 박제 파괴. 그래서 "익명화 + 비활성" 으로 처리한다.
//
//   1) 개인정보(PII) 즉시 삭제: 본인인증·푸시토큰·관심분야·알림설정·알림함·내가 건 차단
//   2) users 익명화: nickname→"탈퇴한 사람", email/google_sub/avatar_url→null, deleted_at set
//   3) 진행 중 도전 종료: 활성 멤버십(challenge_members)에 gave_up_at set (proofs·박제는 보존)
//   4) auth: cascade 삭제 대신 admin API 로 ban(재로그인 영구 차단) + 이메일·메타 스크럽(PII 제거)
//
//   공유 콘텐츠(인증·댓글·기록·대화·완주이야기·다짐·평가)는 보존 — users 익명화로 작성자 자동 익명.
//   결제 내역(gift_orders)도 보존(법적 보관) — users 익명화로 PII 노출 없음.

// @ts-nocheck — Deno 글로벌

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json(405, { error: 'method_not_allowed' });

  // 본인 확인 — JWT 로 누구인지 식별 (남의 계정 삭제 차단)
  const authClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } },
  );
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) return json(401, { error: 'unauthorized' });
  const uid = user.id;

  const service = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const nowIso = new Date().toISOString();

  // 1) 개인정보(PII) 즉시 삭제 — 본인 데이터만
  await service.from('user_verifications').delete().eq('user_id', uid);   // 생년월일·전화·DI
  await service.from('device_tokens').delete().eq('user_id', uid);        // 푸시 토큰
  await service.from('user_interests').delete().eq('user_id', uid);       // 관심 분야
  await service.from('notification_prefs').delete().eq('user_id', uid);   // 알림 설정
  await service.from('notification_queue').delete().eq('user_id', uid);   // 알림함/큐
  await service.from('blocks').delete().or(`blocker_id.eq.${uid},blocked_id.eq.${uid}`);  // 🚀 양방향 차단 레코드 삭제


  // 2) users 익명화 — 공유 콘텐츠 작성자가 자동으로 "탈퇴한 사람" 이 됨
  const { error: anonErr } = await service.from('users').update({
    nickname: '탈퇴한 사람',
    email: null,
    google_sub: null,
    avatar_url: null,
    deleted_at: nowIso,
  }).eq('id', uid);
  if (anonErr) return json(500, { error: 'anonymize_failed', detail: anonErr.message });

  // 3) 진행 중 도전 종료 — 활성 멤버십에 gave_up_at set (proofs·박제는 그대로 보존)
  await service.from('challenge_members')
    .update({ gave_up_at: nowIso })
    .eq('user_id', uid)
    .is('gave_up_at', null);

  // 4) auth — 하드삭제(cascade) 대신 ban + PII 스크럽
  //    4a) ban (핵심): 같은 소셜 계정 재로그인 영구 차단. 다른 계정으론 신규 가입 가능.
  try {
    await service.auth.admin.updateUserById(uid, { ban_duration: '876000h' }); // ≈ 100년
  } catch (_e) {
    // ban 실패해도 users 익명화는 완료된 상태. 클라 signOut + deleted_at 으로 접근 차단됨.
  }
  //    4b) auth.users PII 스크럽 (best-effort): 이메일·메타데이터 제거. 실패해도 ban 으로 차단.
  try {
    await service.auth.admin.updateUserById(uid, {
      email: `deleted-${uid}@deleted.dohada.invalid`,
      email_confirm: true,
      user_metadata: {},
    });
  } catch (_e) { /* PII 스크럽 실패는 무시 — ban 이 접근을 막는다 */ }

  return json(200, { ok: true });
});
