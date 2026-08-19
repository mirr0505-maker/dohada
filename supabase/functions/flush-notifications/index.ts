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
//   3. 조용한 시간 (22-6시, **받는 사람의 기준 시간대** users.timezone/0077) —
//      그 시간에 fall 한 알림은 그 사람의 아침 6시로 미룬다. 해외 거주자도 현지 밤에만 조용하다.
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
const DEFAULT_TIMEZONE = 'Asia/Seoul';   // users.timezone 이 없거나 이상하면 이걸로 (0077 기본값과 동일)
const QUIET_START_HOUR = 22;             // 이 시각부터
const QUIET_END_HOUR = 6;                // 이 시각까지가 조용한 시간 (받는 사람 현지 기준)
const DAILY_CAP = 20;   // 묶음 알림(응원·좋아요) 1일 푸시 천장 (2026-06-20: 5→20 상향)
// 🚀 하루 상한은 "묶음(응원·좋아요)" 알림에만 적용한다.
//   댓글·대화·인증·기록 등 즉시 사회적 알림은 상한 면제 → 낮에도 항상 즉시 푸시.
//   (구버전은 모든 kind 를 상한에 넣어, 새벽 6시 백로그 flush 가 그날 상한 5건을 다 먹으면
//    낮에 생긴 알림이 전부 "내일 6시"로 밀리는 굶김 루프가 있었음. 2026-06-20 수정)
const CAPPED_KINDS = new Set(['cheer_batch', 'log_like_batch']);

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
  const nowMs = nowUtc.getTime();
  // 조용시간은 전역이 아니라 **받는 사람마다** 다르다 — 아래에서 수신자 시간대로 판정한다.
  // (구버전은 KST 22-6 을 전역으로 봐서, 런던 사용자는 현지 낮 알림이 통째로 보류됐다 밤에 몰려 왔다)

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

  // 2. 수신자별 기준 시간대(0077) 로드 → 지금 그 사람의 밤(22-6시)인 알림만 아침 6시로 미룬다
  const allUserIds = [...new Set(pending.map(p => p.user_id))];
  const { data: tzRows } = await supabase.from('users').select('id, timezone').in('id', allUserIds);
  const tzByUser = new Map<string, string>();
  for (const u of (tzRows ?? [])) tzByUser.set(u.id, u.timezone || DEFAULT_TIMEZONE);

  const quietRows = [];
  const awake = [];
  for (const row of pending) {
    const tz = tzByUser.get(row.user_id) ?? DEFAULT_TIMEZONE;
    if (isQuietHour(nowMs, tz)) quietRows.push(row);
    else awake.push(row);
  }
  // 깨어날 시각도 사람마다 다르다 → 같은 시각끼리 묶어 한 번씩 update
  if (quietRows.length > 0) {
    const byWakeUp = new Map<string, string[]>();
    for (const row of quietRows) {
      const tz = tzByUser.get(row.user_id) ?? DEFAULT_TIMEZONE;
      const wakeUpIso = new Date(next6amUtcMs(nowMs, tz)).toISOString();
      const ids = byWakeUp.get(wakeUpIso) ?? [];
      ids.push(row.id);
      byWakeUp.set(wakeUpIso, ids);
    }
    for (const [wakeUpIso, ids] of byWakeUp) {
      await supabase.from('notification_queue').update({ scheduled_for: wakeUpIso }).in('id', ids);
    }
  }
  if (awake.length === 0) {
    return new Response(JSON.stringify({ rescheduled: quietRows.length, reason: 'quiet_hours' }), { status: 200 });
  }

  // 3. user 별 prefs / device_tokens / 일별 카운트 일괄 fetch
  //    🚀 P1-8: 카운팅을 "그룹 단위" 로 — cheer_batch/log_like_batch 같은 묶음은
  //    N row 라도 push 1건. 같은 (user_id, kind, proof_id|log_id) 가 같은 발송이므로
  //    distinct 집계로 보정.
  const userIds = [...new Set(awake.map(p => p.user_id))];
  const [prefsRes, tokensRes, dailyRes] = await Promise.all([
    supabase.from('notification_prefs').select('*').in('user_id', userIds),
    supabase.from('device_tokens').select('*').in('user_id', userIds),
    supabase.from('notification_queue')
      // 상한 창(하루)도 사람마다 다르다 → 가장 이른 하루 시작으로 넓게 받아 아래에서 사람별로 자른다
      .select('user_id, kind, proof_id, log_id, sent_at')
      .in('user_id', userIds)
      .gte('sent_at', earliestLocalDayStartIso(nowMs, userIds, tzByUser))
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
    // 상한은 묶음 알림(응원·좋아요)만 소비 — 즉시 알림(댓글·대화·인증·기록)은 카운트 X
    if (!CAPPED_KINDS.has(row.kind)) continue;
    // 그 사람의 "오늘"(현지 자정 이후)에 나간 것만 상한에 넣는다
    if (Date.parse(row.sent_at) < startOfLocalDayUtcMs(nowMs, tzByUser.get(row.user_id) ?? DEFAULT_TIMEZONE)) continue;
    const groupKey = `${row.user_id}|${row.kind}|${row.proof_id ?? row.log_id ?? ''}`;
    if (seenBatchGroups.has(groupKey)) continue;   // 같은 묶음 그룹은 1회만
    seenBatchGroups.add(groupKey);
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
  const grouped: Record<string, typeof awake[number][]> = {};
  for (const row of awake) {
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
    // 🚀 일별 상한 — 묶음(응원·좋아요)에만 적용. 즉시 알림(댓글·대화·인증·기록)은 면제 → 낮에도 항상 푸시.
    //   초과 묶음은 더 이상 "내일 6시"로 미루지 않고 푸시만 생략(벨엔 그대로) → 굶김 루프 제거.
    const isCapped = CAPPED_KINDS.has(head.kind);
    if (isCapped && (dailyLeft.get(head.user_id) ?? 0) <= 0) {
      toMarkSent.push(...rows.map(r => r.id));      // 푸시 생략, 알림함엔 계속 보임
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
    if (isCapped) {
      // 상한 예산은 묶음 알림이 실제 발송될 때만 소비
      const left = dailyLeft.get(head.user_id) ?? 0;
      dailyLeft.set(head.user_id, left - 1);
    }
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
    quiet_rescheduled: quietRows.length,
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
  if (kind === 'host_promoted')      return { title: '⭐ 유명인이 되었어요', body: head.preview ?? '1,000명이 함께한 하다를 열었어요' };
  return { title: 'Do : 하다', body: head.preview ?? '' };
}

// ─── 시간대 계산 (0077) ─────
// Deno 는 완전한 ICU 를 내장하므로 Intl 로 계산한다. 알 수 없는 시간대는 기본값으로 폴백.
function localParts(ms: number, tz: string): { y: number; mo: number; d: number; h: number; mi: number } {
  try {
    const dtf = new Intl.DateTimeFormat('en-US', {
      timeZone: tz, hour12: false,
      year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
    });
    const p: Record<string, string> = {};
    for (const part of dtf.formatToParts(new Date(ms))) p[part.type] = part.value;
    // 분까지 읽는 이유: 인도(+5:30)처럼 30·45분 오프셋 시간대에서 시(hour)만 보면 오프셋이 어긋난다
    return { y: +p.year, mo: +p.month, d: +p.day, h: (+p.hour) % 24, mi: +p.minute };   // 자정을 24 로 주는 엔진 대비
  } catch {
    if (tz === DEFAULT_TIMEZONE) throw new Error('invalid default timezone');
    return localParts(ms, DEFAULT_TIMEZONE);
  }
}

// 그 시간대의 벽시계 시각(y-mo-d h시)이 가리키는 UTC 시각(ms).
// 오프셋은 시각에 따라 달라지므로(서머타임) 두 번 계산해 수렴시킨다.
function zonedMs(y: number, mo: number, d: number, h: number, tz: string): number {
  const naive = Date.UTC(y, mo - 1, d, h);
  const offsetAt = (ms: number) => {
    const p = localParts(ms, tz);
    return Date.UTC(p.y, p.mo - 1, p.d, p.h, p.mi) - Math.floor(ms / 60_000) * 60_000;
  };
  const guess = naive - offsetAt(naive);
  return naive - offsetAt(guess);
}

// 지금이 이 사람의 밤(22시~06시)인가
function isQuietHour(nowMs: number, tz: string): boolean {
  const h = localParts(nowMs, tz).h;
  return h >= QUIET_START_HOUR || h < QUIET_END_HOUR;
}

// 이 사람 기준 다음 아침 6시의 UTC 시각(ms)
function next6amUtcMs(nowMs: number, tz: string): number {
  const { y, mo, d, h } = localParts(nowMs, tz);
  if (h < QUIET_END_HOUR) return zonedMs(y, mo, d, QUIET_END_HOUR, tz);
  const next = new Date(Date.UTC(y, mo - 1, d) + 86_400_000);   // 현지 날짜 +1일
  return zonedMs(next.getUTCFullYear(), next.getUTCMonth() + 1, next.getUTCDate(), QUIET_END_HOUR, tz);
}

// 이 사람 기준 오늘 0시의 UTC 시각(ms) — 일별 상한 창
function startOfLocalDayUtcMs(nowMs: number, tz: string): number {
  const { y, mo, d } = localParts(nowMs, tz);
  return zonedMs(y, mo, d, 0, tz);
}

// 여러 수신자의 하루 시작 중 가장 이른 것 — 한 번의 쿼리로 넓게 받아오기 위한 하한
function earliestLocalDayStartIso(nowMs: number, userIds: string[], tzByUser: Map<string, string>): string {
  let earliest = startOfLocalDayUtcMs(nowMs, DEFAULT_TIMEZONE);
  for (const uid of userIds) {
    const ms = startOfLocalDayUtcMs(nowMs, tzByUser.get(uid) ?? DEFAULT_TIMEZONE);
    if (ms < earliest) earliest = ms;
  }
  return new Date(earliest).toISOString();
}

function chunk<T>(arr: T[], n: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}
