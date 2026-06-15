// 🚀 flush-notifications — 조용 알림 4원칙의 cron 처리기
//
// 호출:
//   - Supabase Dashboard > Database > Cron Jobs 에서 매 1분 호출
//   - 또는 외부 cron (e.g. cron-job.org) 으로 https://{project}.functions.supabase.co/flush-notifications 호출
//
// 4원칙:
//   1. 묶음 + 지연 — cheer_batch / log_like_batch 은 scheduled_for 가 1시간 미래.
//      이 시간이 되면 같은 (user_id, kind, proof_id|log_id) 그룹을 한 건으로 합쳐 발송.
//   2. 즉시 — chat / comment / log_comment 은 scheduled_for = now(). 즉시 처리.
//   3. 조용한 시간 (22-6 KST) — 그 시간에 fall 한 알림은 아침 6시 정각 묶음으로 미룸.
//   4. 일별 상한 — 사용자당 24h 내 5건. 초과는 다음날로 미룸.
//      (P1-8 보정: 그룹화된 묶음은 N건이라도 발송 1건으로 카운트)
//
// 인증 (P1-7 보강):
//   FLUSH_NOTIFICATIONS_SECRET 환경 변수와 Authorization 헤더 (Bearer ...) 일치 필수.
//   미일치 시 401. cron 호출 시 헤더에 동일 secret 포함시키도록 대시보드에서 설정.
//
// ⚠️ 배포는 반드시 --no-verify-jwt 로:
//     supabase functions deploy flush-notifications --no-verify-jwt --project-ref <ref>
//   게이트웨이 JWT 검증을 끄고 위 "자체 secret 인증"을 쓴다. 이 플래그를 빠뜨리면
//   cron(net.http_post)이 보내는 secret-Bearer 가 게이트웨이에서 JWT 형식 아님(401)으로 막혀
//   함수가 한 번도 안 돌고 → 푸시 전부 안 나감(알림함만 살아남음). (2026-06-13~15 실장애)
//
// 환경변수 (supabase secrets):
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY  (자동 주입)
//   FLUSH_NOTIFICATIONS_SECRET              (수동 설정 필요)

// @ts-nocheck — Deno 글로벌

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const EPN_ENDPOINT = 'https://exp.host/--/api/v2/push/send';
const KST_OFFSET_MIN = 9 * 60;
const DAILY_CAP = 5;

Deno.serve(async (req) => {
  // 🚀 P1-7: Authorization 검증 — secret 미일치 시 401
  const expected = Deno.env.get('FLUSH_NOTIFICATIONS_SECRET');
  if (!expected) {
    console.error('[flush] FLUSH_NOTIFICATIONS_SECRET not configured');
    return new Response(JSON.stringify({ error: 'server misconfigured' }), { status: 500 });
  }
  const authHeader = req.headers.get('authorization') ?? '';
  const presented = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (presented !== expected) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401 });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  // 🚀 0043: 도전 기간 50% 지난 누구나 방의 "모집 자동 마감" 안내를 큐에 1회 적재.
  //   마감 동작 자체는 날짜 파생이라 cron 불필요하지만, 개설자 안내 알림만 여기서 발생시킨다.
  //   (scheduled_for=now() 로 들어가 아래 일반 발송 플로우가 같은 실행에서 이어서 처리)
  const { error: acErr } = await supabase.rpc('notify_recruit_autoclose');
  if (acErr) console.error('[flush] autoclose notify failed', acErr);

  const nowUtc = new Date();
  const nowKst = new Date(nowUtc.getTime() + KST_OFFSET_MIN * 60_000);
  const kstHour = nowKst.getUTCHours();   // KST 시 (now+9 가 UTCHours 가 됨)
  const isQuiet = kstHour >= 22 || kstHour < 6;
  // 6시 정각엔 quiet 끝 묶음 발송 OK. 22시는 진입 시각.
  // → quiet 인 동안에는 모든 알림을 아침 6시로 reschedule.

  // 1. scheduled_for <= now & sent_at IS NULL 가져옴
  const { data: pending, error: pErr } = await supabase
    .from('notification_queue')
    .select('id, user_id, kind, challenge_id, proof_id, log_id, actor_id, preview')
    .lte('scheduled_for', nowUtc.toISOString())
    .is('sent_at', null)
    .limit(500);
  if (pErr) {
    console.error('[flush] pending fetch failed', pErr);
    return new Response(JSON.stringify({ error: pErr.message }), { status: 500 });
  }
  if (!pending || pending.length === 0) {
    return new Response(JSON.stringify({ processed: 0 }), { status: 200 });
  }

  // 2. 조용시간이면 모두 다음 8시 KST 로 reschedule
  if (isQuiet) {
    const next6 = nextKst6AM(nowKst);
    const next6Utc = new Date(next6.getTime() - KST_OFFSET_MIN * 60_000);
    await supabase
      .from('notification_queue')
      .update({ scheduled_for: next6Utc.toISOString() })
      .in('id', pending.map(p => p.id));
    return new Response(JSON.stringify({ rescheduled: pending.length, reason: 'quiet_hours' }), { status: 200 });
  }

  // 3. user 별 prefs / device_tokens / 일별 카운트 일괄 fetch
  //    🚀 P1-8: 카운팅을 "그룹 단위" 로 — cheer_batch/log_like_batch 같은 묶음은
  //    N row 라도 push 1건. 같은 (user_id, kind, proof_id|log_id) 가 같은 발송이므로
  //    distinct 집계로 보정.
  const userIds = [...new Set(pending.map(p => p.user_id))];
  const [prefsRes, tokensRes, dailyRes] = await Promise.all([
    supabase.from('notification_prefs').select('*').in('user_id', userIds),
    supabase.from('device_tokens').select('*').in('user_id', userIds),
    supabase.from('notification_queue')
      .select('user_id, kind, proof_id, log_id')
      .in('user_id', userIds)
      .gte('sent_at', startOfTodayUtcIso(nowKst))
      .not('sent_at', 'is', null),
  ]);
  const prefsByUser = new Map<string, any>();
  for (const p of (prefsRes.data ?? [])) prefsByUser.set(p.user_id, p);
  const tokensByUser = new Map<string, string[]>();
  for (const t of (tokensRes.data ?? [])) {
    const arr = tokensByUser.get(t.user_id) ?? [];
    arr.push(t.expo_token);
    tokensByUser.set(t.user_id, arr);
  }
  // 그룹 키로 dedupe — 같은 batch 발송 그룹은 1회만 카운트.
  // 개별 알림(chat/comment/log_comment/creator_notice) 은 row 별로 1회 push 이므로 그대로 카운트.
  const sentTodayByUser = new Map<string, number>();
  const seenBatchGroups = new Set<string>();
  for (const row of (dailyRes.data ?? []) as any[]) {
    if (row.kind === 'cheer_batch' || row.kind === 'log_like_batch') {
      const groupKey = `${row.user_id}|${row.kind}|${row.proof_id ?? row.log_id ?? ''}`;
      if (seenBatchGroups.has(groupKey)) continue;
      seenBatchGroups.add(groupKey);
    }
    sentTodayByUser.set(row.user_id, (sentTodayByUser.get(row.user_id) ?? 0) + 1);
  }

  // 4. 묶음 / 즉시 분리해 messages 조립
  type EpnMessage = { to: string; title: string; body: string; data?: any; sound?: 'default' | null };
  const messages: EpnMessage[] = [];
  const toMarkSent: string[] = [];
  const dailyLeft = new Map<string, number>();
  for (const uid of userIds) {
    dailyLeft.set(uid, Math.max(0, DAILY_CAP - (sentTodayByUser.get(uid) ?? 0)));
  }

  // 묶음 그룹: (user_id, kind, proof_id|log_id)
  const grouped: Record<string, typeof pending[number][]> = {};
  for (const row of pending) {
    const key = row.kind === 'cheer_batch' || row.kind === 'log_like_batch'
      ? `${row.user_id}|${row.kind}|${row.proof_id ?? row.log_id ?? ''}`
      : row.id;       // 즉시는 그룹 X (개별 처리)
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(row);
  }

  for (const key of Object.keys(grouped)) {
    const rows = grouped[key];
    const head = rows[0];
    const tokens = tokensByUser.get(head.user_id) ?? [];
    const prefs = prefsByUser.get(head.user_id) ?? { chat_enabled: true, comment_enabled: true, cheer_batch_enabled: true };

    // prefs 토글 체크
    const enabled = checkPref(head.kind, prefs);
    if (!enabled) {
      toMarkSent.push(...rows.map(r => r.id));     // 끄기 상태는 sent 로 마킹 (큐에 쌓이지 않게)
      continue;
    }
    // 일별 상한
    const left = dailyLeft.get(head.user_id) ?? 0;
    if (left <= 0) {
      // 다음날 아침 6시로 reschedule (in-app badge 만)
      await supabase.from('notification_queue').update({
        scheduled_for: tomorrowKst6Iso(nowKst),
      }).in('id', rows.map(r => r.id));
      continue;
    }

    // 메시지 조립
    const { title, body } = composeMessage(head.kind, rows);
    if (tokens.length === 0) {
      // device token 없어도 큐는 sent 로 (in-app 만 보임)
      toMarkSent.push(...rows.map(r => r.id));
      continue;
    }
    for (const tok of tokens) {
      messages.push({
        to: tok,
        title,
        body,
        sound: null,                                   // 무음 (진동만)
        badge: 1,                                      // 🚀 뱃지 강제 마킹 (홈화면 앱 로고 숫자 표시 활성화)
        data: {
          kind: head.kind,
          challenge_id: head.challenge_id,
          proof_id: head.proof_id,
          log_id: head.log_id,
        },
      });
    }
    toMarkSent.push(...rows.map(r => r.id));
    dailyLeft.set(head.user_id, left - 1);
  }

  // 5. EPN 발송 (batch)
  if (messages.length > 0) {
    const chunked = chunk(messages, 100);     // EPN 한 번에 100개 권장
    for (const c of chunked) {
      await fetch(EPN_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(c),
      }).catch(e => console.error('[flush] EPN POST failed', e));
    }
  }

  // 6. sent_at 마킹
  if (toMarkSent.length > 0) {
    await supabase
      .from('notification_queue')
      .update({ sent_at: nowUtc.toISOString() })
      .in('id', toMarkSent);
  }

  return new Response(JSON.stringify({
    processed: toMarkSent.length,
    sent: messages.length,
    kst_hour: kstHour,
  }), { status: 200 });
});

// ─── helpers ──────────────────────────
function checkPref(kind: string, prefs: any): boolean {
  if (kind === 'chat') return prefs.chat_enabled !== false;
  if (kind === 'comment' || kind === 'log_comment') return prefs.comment_enabled !== false;
  if (kind === 'cheer_batch' || kind === 'log_like_batch') return prefs.cheer_batch_enabled !== false;
  if (kind === 'proof' || kind === 'log') return prefs.proof_log_enabled !== false;   // 0027 토글
  return true;
}

function composeMessage(kind: string, rows: any[]): { title: string; body: string } {
  if (kind === 'creator_notice') {
    return { title: '📢 개설자 공지', body: rows[0].preview ?? '새로운 공지 메시지가 도착했습니다.' };
  }
  if (kind === 'cheer_batch') {
    const n = rows.length;
    return { title: 'Do : 하다 💛', body: `지난 1시간 동안 동료 ${n}명이 응원해줬어요` };
  }
  if (kind === 'log_like_batch') {
    const n = rows.length;
    return { title: 'Do : 하다 💚', body: `지난 1시간 동안 동료 ${n}명이 기록에 좋아요` };
  }
  // 즉시
  const head = rows[0];
  if (kind === 'chat')        return { title: '새 대화', body: head.preview ?? '동료가 메시지를 남겼어요' };
  if (kind === 'comment')     return { title: '인증에 댓글', body: head.preview ?? '동료가 댓글을 남겼어요' };
  if (kind === 'log_comment') return { title: '기록에 댓글', body: head.preview ?? '동료가 댓글을 남겼어요' };
  if (kind === 'proof')       return { title: '📸 동료 인증', body: head.preview ?? '동료가 오늘 인증을 남겼어요' };
  if (kind === 'log')         return { title: '🎥 새 기록', body: head.preview ?? '동료가 새 기록을 남겼어요' };
  if (kind === 'recruit_milestone')  return { title: '👥 참가 인원 도달', body: head.preview ?? '참가 인원이 도달했어요' };
  if (kind === 'recruit_autoclosed') return { title: '🔒 모집 자동 마감', body: head.preview ?? '도전 기간 절반이 지나 모집이 마감됐어요' };
  return { title: 'Do : 하다', body: head.preview ?? '' };
}

function nextKst6AM(nowKst: Date): Date {
  // nowKst 가 22-24 또는 0-6 이면 다음 아침 6시 KST 반환
  const k = new Date(nowKst.getTime());
  k.setUTCMinutes(0, 0, 0);
  if (k.getUTCHours() < 6) {
    k.setUTCHours(6);
  } else {
    k.setUTCDate(k.getUTCDate() + 1);
    k.setUTCHours(6);
  }
  return k;   // 이 값 자체는 UTC 시각이 아니라 'KST 를 UTC 처럼 다룬' 값
}

function tomorrowKst6Iso(nowKst: Date): string {
  const k = new Date(nowKst.getTime());
  k.setUTCDate(k.getUTCDate() + 1);
  k.setUTCHours(6, 0, 0, 0);
  const utc = new Date(k.getTime() - KST_OFFSET_MIN * 60_000);
  return utc.toISOString();
}

function startOfTodayUtcIso(nowKst: Date): string {
  // KST 의 오늘 0시 = UTC -9h
  const k = new Date(nowKst.getTime());
  k.setUTCHours(0, 0, 0, 0);
  const utc = new Date(k.getTime() - KST_OFFSET_MIN * 60_000);
  return utc.toISOString();
}

function chunk<T>(arr: T[], n: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}
