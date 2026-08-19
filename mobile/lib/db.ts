// 🚀 Supabase 자주 쓰는 쿼리 helpers
// RLS 가 알아서 가드해주니까 여기선 단순 fetch/insert/delete.
import { supabase } from './supabase';
import { getTodayRange } from './format';
import { toLocalDateStr, setActiveTimezone, DEFAULT_TIMEZONE } from './timezone';
import { isRecruiting, goalStatus, isFinished, countCompleters } from './stats';   // 🚀 0043: 모집 마감 판정 + 다짐 내역 완주 판정 + 0075 완주자 집계
import type {
  ChallengeWithCount, ChallengeKind, ChallengeGoalType, ChallengeMemberRole, ChallengeFrequency, MemberWithToday, ProofWithRelations, DbChallenge,
  CommentWithAuthor, CheerType,
  OpenChallengeCard, ChallengeVoteType, ChallengeVoteCounts, BrowseChallengeCard,
  DbCompletionStory, CompletionStoryCard, StoryVisibility,
} from './types';

// ─── 동료들의 최근 인증 (홈 cross-section) ───────────────────────────────
// 내가 참여 중인 모든 챌린지의 최근 인증 (본인 제외).
// RLS 가 알아서 멤버인 챌린지로 한정. open 챌린지 인증은 비멤버도 볼 수 있지만
// 여기선 user_id != me 만 적용 → 결과는 "내가 멤버인 챌린지의 동료 N명 인증".
export type FellowProof = {
  id: string;
  photo_url: string;
  photo_urls?: string[];   // 🚀 0045: 인증 사진 전체 (최대 3장)
  caption: string | null;
  created_at: string;
  challenge_id: string;
  challenge_title: string;
  streak_count?: number;   // 🚀 0044: 연속 인증 일수 (마일스톤 메달용)
  user_id: string;
  nickname: string;
  avatar_url: string | null;
  host_tier?: string | null;   // 🚀 0064: 작성자 계층 — 아바타 금빛 링 + 마크
  early_tier?: string | null;  // 🚀 0066: 작성자 창립 티어 — 아바타 오렌지 링 (마크 없음)
};

// "도전 인연 = 현재 같은 챌린지의 멤버" (v2.5) — 내가 멤버인 챌린지의 동료 인증만.
// (기존 creator_id !== myUserId 필터는 "내가 개설한 방의 동료 인증" 을 통째로 누락시키던 버그)
export async function fetchFellowProofs(myUserId: string, limit = 10): Promise<FellowProof[]> {
  // 0. 내가 멤버(포기 X)인 챌린지 ID 먼저 추림 — open 챌린지 RLS 로 남의 방 인증이 섞이는 것 방지
  const { data: memberships, error: mErr } = await supabase
    .from('challenge_members')
    .select('challenge_id')
    .eq('user_id', myUserId)
    .is('gave_up_at', null);
  if (mErr) throw mErr;
  const ids = (memberships ?? []).map((m: any) => m.challenge_id);
  if (!ids.length) return [];

  const { data, error } = await supabase
    .from('proofs')
    .select(`
      id, photo_url, photo_urls, caption, created_at, challenge_id, user_id, streak_count,
      users (nickname, avatar_url, host_tier, early_tier),
      challenges!inner (title, creator_id, gave_up_at)
    `)
    .in('challenge_id', ids)
    .neq('user_id', myUserId)
    .is('challenges.gave_up_at', null)
    .eq('hidden', false)   // 🚀 3b: 신고누적·flag 자동숨김 제외
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;

  const blocked = await fetchBlockedUserIds();   // 🚀 3b: 차단(양방향) 제외
  return (data ?? []).filter((p: any) => !blocked.has(p.user_id)).map((p: any) => ({
    id: p.id,
    photo_url: p.photo_url,
    photo_urls: (p.photo_urls?.length ? p.photo_urls : (p.photo_url ? [p.photo_url] : [])),
    caption: p.caption,
    created_at: p.created_at,
    challenge_id: p.challenge_id,
    challenge_title: p.challenges?.title ?? '',
    streak_count: p.streak_count ?? 0,
    user_id: p.user_id,
    nickname: p.users?.nickname ?? '',
    avatar_url: p.users?.avatar_url ?? null,
    host_tier: p.users?.host_tier ?? null,
    early_tier: p.users?.early_tier ?? null,
  }));
}

// ─── 내 챌린지 목록 (홈) ───────────────────────────────
// RLS 가 멤버인 챌린지만 보여줌. challenge_members(count) 로 멤버 수 같이.
// myUserId 전달 시 본인이 포기(gave_up_at) 한 챌린지는 hide (soft delete 패턴).
export async function fetchMyChallenges(myUserId?: string): Promise<ChallengeWithCount[]> {
  if (!myUserId) return [];

  // 1. 본인이 멤버인 (그리고 포기 X) challenge_id 만 먼저 추림
  //    RLS 가 open 챌린지를 비멤버에도 SELECT 허용하기 때문에 명시적 필터 필요.
  const { data: memberships, error: mErr } = await supabase
    .from('challenge_members')
    .select('challenge_id, role')   // 🚀 0069: role='host' = 조직 하다 주최자 (인증 의무·진행 배지 없음)
    .eq('user_id', myUserId)
    .is('gave_up_at', null);
  if (mErr) throw mErr;
  const ids = (memberships ?? []).map((m: any) => m.challenge_id);
  if (!ids.length) return [];
  const myRoleMap = new Map<string, ChallengeMemberRole>(
    (memberships ?? []).map((m: any) => [m.challenge_id, (m.role ?? 'member') as ChallengeMemberRole]),
  );

  // 2. 그 챌린지들만 fetch
  const { data, error } = await supabase
    .from('challenges')
    .select('*, challenge_members(count)')
    .in('id', ids)
    .order('created_at', { ascending: false });
  if (error) throw error;

  const { startUtc: todayStartUtc, endUtc: todayEndUtc } = getTodayRange();
  const oneDayAgo = new Date(Date.now() - 86_400_000).toISOString();

  // 3. 오늘 본인의 인증 데이터 가져오기 (KST 기준)
  const { data: todayProofs } = await supabase
    .from('proofs')
    .select('challenge_id')
    .in('challenge_id', ids)
    .eq('user_id', myUserId)
    .gte('created_at', todayStartUtc)
    .lt('created_at', todayEndUtc);
  const myTodayProofSet = new Set<string>();
  for (const p of (todayProofs ?? []) as any[]) {
    myTodayProofSet.add(p.challenge_id);
  }

  // 4. 연속 인증 일수 계산용 데이터 가져오기 (내 모든 인증글)
  const { data: myAllProofs } = await supabase
    .from('proofs')
    .select('challenge_id, created_at, local_date')
    .in('challenge_id', ids)
    .eq('user_id', myUserId)
    .order('created_at', { ascending: false });
  const proofsMap = new Map<string, string[]>();
  for (const p of (myAllProofs ?? []) as any[]) {
    const arr = proofsMap.get(p.challenge_id) ?? [];
    // 인증한 "날"은 서버가 저장한 local_date(0077, 작성자 기준 시간대)를 그대로 쓴다
    arr.push(p.local_date ?? toLocalDateStr(p.created_at));
    proofsMap.set(p.challenge_id, arr);
  }

  // 5. 최근 24시간 내 타인의 새 대화 및 새 기록 데이터 가져오기
  //    + 🚀 0069: 방별 주최자(role='host') 수 — challenge_members(count) 에서 빼서 '함께 N명' 을 도전자만으로.
  const [resNewChats, resNewLogs, resHosts] = await Promise.all([
    supabase
      .from('chat_messages')
      .select('challenge_id')
      .in('challenge_id', ids)
      .neq('user_id', myUserId)
      .gte('created_at', oneDayAgo),
    supabase
      .from('logs')
      .select('challenge_id')
      .in('challenge_id', ids)
      .neq('user_id', myUserId)
      .gte('created_at', oneDayAgo),
    supabase
      .from('challenge_members')
      .select('challenge_id')
      .in('challenge_id', ids)
      .eq('role', 'host')
  ]);

  const hostCountMap = new Map<string, number>();
  for (const h of (resHosts.data ?? []) as any[]) {
    hostCountMap.set(h.challenge_id, (hostCountMap.get(h.challenge_id) ?? 0) + 1);
  }

  const hasNewChatSet = new Set<string>();
  for (const c of (resNewChats.data ?? []) as any[]) {
    hasNewChatSet.add(c.challenge_id);
  }

  const hasNewLogSet = new Set<string>();
  for (const l of (resNewLogs.data ?? []) as any[]) {
    hasNewLogSet.add(l.challenge_id);
  }

  // 스트릭 일자 비교는 내 기준 시간대(0077) — UTC slice 는 오전 9시까지 어제로 판정되는 오차.
  //   하루 물러나기는 ms 가 아니라 날짜 문자열로 — 서머타임 전환일(23·25시간)에 하루가 겹치거나 건너뛴다.
  const todayLocal = toLocalDateStr(new Date().toISOString());
  const prevDay = (d: string) => new Date(Date.parse(d + 'T00:00:00Z') - 86_400_000).toISOString().slice(0, 10);

  return (data ?? []).map((c: any) => {
    // Streak 계산
    const myDates = proofsMap.get(c.id) ?? [];
    const datesSet = new Set(myDates);   // 이미 날짜 문자열(local_date)
    let streak = 0;
    let cursor = todayLocal;
    if (!datesSet.has(cursor)) cursor = prevDay(cursor);   // 오늘 인증 전이면 어제부터
    while (datesSet.has(cursor)) {
      streak += 1;
      cursor = prevDay(cursor);
    }

    return {
      id: c.id,
      creator_id: c.creator_id,
      title: c.title,
      description: c.description,
      kind: (c.kind ?? 'closed') as ChallengeKind,
      start_date: c.start_date,
      end_date: c.end_date,
      created_at: c.created_at,
      // 🚀 0069: 주최자는 도전자가 아니므로 '함께 N명' 에서 뺀다
      member_count: Math.max(0, (c.challenge_members?.[0]?.count ?? 0) - (hostCountMap.get(c.id) ?? 0)),
      is_today_checked: myTodayProofSet.has(c.id),
      my_streak: streak,
      my_role: myRoleMap.get(c.id) ?? 'member',   // 🚀 0069
      has_new_chat: c.kind !== 'solo' && hasNewChatSet.has(c.id),
      has_new_log: c.kind !== 'solo' && hasNewLogSet.has(c.id),
      goal_type: (c.goal_type ?? 'cadence') as ChallengeGoalType,   // 🚀 0041
      target_count: c.target_count ?? null,
      my_proof_count: myDates.length,
      reference_count: c.reference_count ?? 0,   // 🚀 0050: 따라하기 참조 횟수
      gave_up_at: c.gave_up_at ?? null,
    };
  });
}

// ─── 알림함 (AppHeader 벨) ──────────────────────────────
// 푸시와 "동일한 소스" — notification_queue 본인 행 (0025 RLS select).
// 폰 푸시가 나가는 모든 이벤트(대화/댓글/응원/기록반응/공지)가 여기에 그대로 보임.
// cheer/log_like 는 푸시와 동일하게 (kind, 대상) 그룹당 1건 + count 로 묶어서 반환.
export type MyNotification = {
  id: string;
  kind: string;             // chat | comment | log_comment | cheer_batch | log_like_batch | creator_notice
  challenge_id: string | null;
  challenge_title: string | null;   // 알림함 행에 "어느 챌린지인지" 표시용
  proof_id: string | null;
  log_id: string | null;
  gift_order_id: string | null;     // ☕ 응원 한잔 — 수령/상세 화면 딥링크용
  preview: string | null;
  created_at: string;
  count: number;            // 묶음 알림의 누적 건수 (즉시 알림은 1)
};

export async function fetchMyNotifications(myUserId: string, limit = 20): Promise<MyNotification[]> {
  if (!myUserId) return [];
  const { data, error } = await supabase
    .from('notification_queue')
    .select('id, kind, challenge_id, proof_id, log_id, gift_order_id, preview, created_at, challenge:challenge_id(title)')
    .eq('user_id', myUserId)
    .order('created_at', { ascending: false })
    .limit(limit * 3);   // 묶음 그룹화 후에도 limit 채우도록 넉넉히
  if (error) throw error;

  const grouped: MyNotification[] = [];
  const batchIndex = new Map<string, number>();   // (kind|대상) → grouped 인덱스
  for (const n of (data ?? []) as any[]) {
    if (n.kind === 'cheer_batch' || n.kind === 'log_like_batch') {
      const key = `${n.kind}|${n.proof_id ?? n.log_id ?? ''}`;
      const i = batchIndex.get(key);
      if (i != null) { grouped[i].count += 1; continue; }
      batchIndex.set(key, grouped.length);
    }
    grouped.push({
      id: n.id,
      kind: n.kind,
      challenge_id: n.challenge_id,
      challenge_title: n.challenge?.title ?? null,
      proof_id: n.proof_id,
      log_id: n.log_id,
      gift_order_id: n.gift_order_id ?? null,
      preview: n.preview,
      created_at: n.created_at,
      count: 1,
    });
  }
  return grouped.slice(0, limit);
}

// ─── 포기한 도전 (조용한 보관함, v2.8) ───────────────────
// 내도전 탭 하단 접힌 섹션 — 기본 숨김, 펼칠 때만 보임 (포기를 들이밀지 않기).
export type GivenUpChallenge = {
  id: string;
  title: string;
  kind: ChallengeKind;
  start_date: string;
  end_date: string;
  gave_up_at: string;   // 내 멤버십의 포기 시각
};

export async function fetchMyGivenUpChallenges(myUserId: string): Promise<GivenUpChallenge[]> {
  if (!myUserId) return [];
  const { data, error } = await supabase
    .from('challenge_members')
    .select('gave_up_at, challenges(id, title, kind, start_date, end_date)')
    .eq('user_id', myUserId)
    .not('gave_up_at', 'is', null)
    .order('gave_up_at', { ascending: false });
  if (error) throw error;
  return (data ?? [])
    .filter((m: any) => m.challenges)
    .map((m: any) => ({
      id: m.challenges.id,
      title: m.challenges.title,
      kind: (m.challenges.kind ?? 'closed') as ChallengeKind,
      start_date: m.challenges.start_date,
      end_date: m.challenges.end_date,
      gave_up_at: m.gave_up_at,
    }));
}

// ─── 홈 v2.3 — 분류별 카드용 상세 데이터 ─────────────────
// 4분류 카드 (Solo/Cheered/Closed/Open) 각자 다른 톤이라 데이터도 분류별.
export type MyChallengeDetail = ChallengeWithCount & {
  kind: ChallengeKind;
  is_impact: boolean;
  category_name: string | null;   // 🚀 홈 응원 카드 카테고리 아이콘용
  description: string | null;
  today_check_count: number;      // 오늘 인증한 멤버 수
  my_cheers_count: number;        // 본인 인증에 받은 응원 합계 (cheered 카드용)
  top_members: { id: string; nickname: string; avatar_url: string | null }[];   // 멤버 top 5 (아바타 가로용)
  is_today_checked: boolean;      // 오늘 내가 인증했는지 여부
  goal_type: ChallengeGoalType;   // 🚀 0041: 목표 유형 (cadence/count)
  target_count: number | null;    // 🚀 0041: count 유형의 목표 개수
  my_proof_count: number;         // 🚀 0041: 내 총 인증 수 (count 유형 진행도 N/목표)
};

export async function fetchMyChallengesWithDetails(myUserId: string): Promise<MyChallengeDetail[]> {
  // 0. 본인 멤버십 챌린지 ID 추림 (포기 안 한 것만)
  //    RLS 가 open 챌린지를 비멤버에도 SELECT 허용 → 명시적 필터 필요.
  const { data: memberships, error: mErr } = await supabase
    .from('challenge_members')
    .select('challenge_id, role')   // 🚀 0069: role='host' = 조직 하다 주최자 (인증 의무·진행 배지 없음)
    .eq('user_id', myUserId)
    .is('gave_up_at', null);
  if (mErr) throw mErr;
  const myIds = (memberships ?? []).map((m: any) => m.challenge_id);
  if (!myIds.length) return [];
  const myRoleMap = new Map<string, ChallengeMemberRole>(
    (memberships ?? []).map((m: any) => [m.challenge_id, (m.role ?? 'member') as ChallengeMemberRole]),
  );

  // 1. 본인 멤버 챌린지만 fetch
  const { data: challenges, error } = await supabase
    .from('challenges')
    .select(`
      *,
      category:category_id(name, is_impact),
      challenge_members(count)
    `)
    .in('id', myIds)
    .order('created_at', { ascending: false });
  if (error) throw error;
  if (!challenges?.length) return [];

  const filtered = challenges as any[];
  const challengeIds = filtered.map(c => c.id);
  const { startUtc: todayStartUtc, endUtc: todayEndUtc } = getTodayRange();

  // 3. 오늘 인증한 멤버 수 (챌린지별) 및 본인의 오늘 인증 여부 판별 (KST 기준)
  const { data: todayProofs } = await supabase
    .from('proofs')
    .select('challenge_id, user_id')
    .in('challenge_id', challengeIds)
    .gte('created_at', todayStartUtc)
    .lt('created_at', todayEndUtc);
  const todayCountMap = new Map<string, number>();
  const myTodayProofSet = new Set<string>();
  for (const p of (todayProofs ?? []) as any[]) {
    todayCountMap.set(p.challenge_id, (todayCountMap.get(p.challenge_id) ?? 0) + 1);
    if (p.user_id === myUserId) {
      myTodayProofSet.add(p.challenge_id);
    }
  }

  // 4. 본인 인증에 받은 응원 합계 (cheered 카드의 "응원 N개 받았어요")
  const { data: myProofs } = await supabase
    .from('proofs')
    .select('challenge_id, cheers(count)')
    .in('challenge_id', challengeIds)
    .eq('user_id', myUserId);
  const myCheersMap = new Map<string, number>();
  const myProofCountMap = new Map<string, number>();   // 🚀 0041: 내 총 인증 수 (count 유형 진행도)
  for (const p of (myProofs ?? []) as any[]) {
    const cheers = p.cheers?.[0]?.count ?? 0;
    myCheersMap.set(p.challenge_id, (myCheersMap.get(p.challenge_id) ?? 0) + cheers);
    myProofCountMap.set(p.challenge_id, (myProofCountMap.get(p.challenge_id) ?? 0) + 1);
  }

  // 5. 멤버 top 5 (가입 순 — 시간의 흐름 톤)
  //    + 🚀 0069: 방별 주최자(role='host') 수 — '동료 N/M 완료' 분모에서 빼려면 주최자 수를 알아야 한다.
  const { data: members } = await supabase
    .from('challenge_members')
    .select('challenge_id, joined_at, role, users(id, nickname, avatar_url)')
    .in('challenge_id', challengeIds)
    .is('gave_up_at', null)
    .order('joined_at', { ascending: true });
  const topMembersMap = new Map<string, MyChallengeDetail['top_members']>();
  const hostCountMap = new Map<string, number>();
  for (const m of (members ?? []) as any[]) {
    if (m.role === 'host') {
      hostCountMap.set(m.challenge_id, (hostCountMap.get(m.challenge_id) ?? 0) + 1);
      continue;   // 주최자는 도전자 얼굴 줄(top_members)에도 안 낀다
    }
    const arr = topMembersMap.get(m.challenge_id) ?? [];
    if (arr.length < 5 && m.users) {
      arr.push({ id: m.users.id, nickname: m.users.nickname, avatar_url: m.users.avatar_url });
      topMembersMap.set(m.challenge_id, arr);
    }
  }

  // 6. 합치기
  return filtered.map(c => ({
    id: c.id,
    creator_id: c.creator_id,
    title: c.title,
    description: c.description ?? null,
    kind: (c.kind ?? 'closed') as ChallengeKind,
    start_date: c.start_date,
    end_date: c.end_date,
    created_at: c.created_at,
    // 🚀 0069: 주최자는 도전자가 아니므로 '동료 N/M 완료' 분모에서 뺀다
    member_count: Math.max(0, (c.challenge_members?.[0]?.count ?? 0) - (hostCountMap.get(c.id) ?? 0)),
    is_impact: !!c.category?.is_impact,
    category_name: c.category?.name ?? null,
    today_check_count: todayCountMap.get(c.id) ?? 0,
    my_cheers_count: myCheersMap.get(c.id) ?? 0,
    top_members: topMembersMap.get(c.id) ?? [],
    is_today_checked: myTodayProofSet.has(c.id),
    goal_type: (c.goal_type ?? 'cadence') as ChallengeGoalType,
    target_count: c.target_count ?? null,
    my_proof_count: myProofCountMap.get(c.id) ?? 0,
    reference_count: c.reference_count ?? 0,   // 🚀 0050: 따라하기 참조 횟수
    my_role: myRoleMap.get(c.id) ?? 'member',   // 🚀 0069
    gave_up_at: c.gave_up_at ?? null,
  }));
}

// ─── 관심 분류 시스템 (v2.3) ─────────────────────────
// Hybrid: 명시 등록 (user_interests) + 자동 추론 (본인 챌린지 카테고리) 합집합.
// Phase 1 = 대분류만 매칭. Phase 1.5 에서 소분류 + 가중치 정교화.

export type MyInterest = {
  id: string;
  category_id: number;
  category_emoji: string;
  category_name: string;
};

export async function fetchMyInterests(userId: string): Promise<MyInterest[]> {
  const { data, error } = await supabase
    .from('user_interests')
    .select('id, category_id, categories(emoji, name)')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []).map((r: any) => ({
    id: r.id,
    category_id: r.category_id,
    category_emoji: r.categories?.emoji ?? '✨',
    category_name: r.categories?.name ?? '기타',
  }));
}

export async function addInterest(userId: string, categoryId: number): Promise<void> {
  const { error } = await supabase
    .from('user_interests')
    .insert({ user_id: userId, category_id: categoryId });
  // 중복(unique 위반)은 무시
  if (error && !error.message.includes('duplicate')) throw error;
}

export async function removeInterest(interestId: string): Promise<void> {
  const { error } = await supabase
    .from('user_interests')
    .delete()
    .eq('id', interestId);
  if (error) throw error;
}

// ─── 둘러보기 — 공개(open) 챌린지 카드 ──────────────────
// v2 풀: creator/category/subcategory + 4가지 평가 카운트 + 본인 vote.
export async function fetchOpenChallenges(myUserId: string | undefined): Promise<OpenChallengeCard[]> {
  let query = supabase
    .from('challenges')
    .select(`
      *,
      challenge_members(user_id, gave_up_at),
      creator:creator_id(nickname),
      category:category_id(emoji, name, is_impact),
      subcategory:subcategory_id(name),
      challenge_votes(user_id, vote_type)
    `)
    .eq('kind', 'open')
    .is('gave_up_at', null)
    .order('created_at', { ascending: false })
    .limit(50);

  if (myUserId) {
    query = query.neq('creator_id', myUserId);
  }

  const { data, error } = await query;

  if (error) throw error;

  // 🚀 0043: 모집 마감(개설자 수동 잠금 / 기간 50% 경과)된 방은 둘러보기에서 제외 (로그인 무관)
  const rawList = (data ?? []).filter((c: any) => isRecruiting(c));
  // 2. 이미 참여 중인 방은 필터링하여 제외 (대소문자/타입 싱크 등 완벽 보장)
  const filteredList = myUserId
    ? rawList.filter((c: any) => {
        const members = c.challenge_members ?? [];
        const isJoined = members.some((m: any) => m.user_id === myUserId && m.gave_up_at === null);
        return !isJoined;
      })
    : rawList;

  return filteredList.map((c: any) => {
    const votes: { user_id: string; vote_type: ChallengeVoteType }[] = c.challenge_votes ?? [];
    const votesByType: ChallengeVoteCounts = { creative: 0, hard: 0, touching: 0, fresh: 0 };
    const myVotes: ChallengeVoteType[] = [];
    for (const v of votes) {
      const t = v.vote_type as ChallengeVoteType;
      votesByType[t] = (votesByType[t] ?? 0) + 1;
      if (v.user_id === myUserId) myVotes.push(t);
    }
    const activeMembers = (c.challenge_members ?? []).filter((m: any) => m.gave_up_at === null);
    return {
      id: c.id,
      creator_id: c.creator_id,
      title: c.title,
      description: c.description,
      intro_image_url: c.intro_image_url ?? null,
      kind: 'open' as ChallengeKind,
      start_date: c.start_date,
      end_date: c.end_date,
      created_at: c.created_at,
      member_count: activeMembers.length,
      creator: { nickname: c.creator?.nickname ?? '도전자' },
      category: c.category
        ? { emoji: c.category.emoji, name: c.category.name, is_impact: !!c.category.is_impact }
        : null,
      subcategory: c.subcategory ? { name: c.subcategory.name } : null,
      votes_by_type: votesByType,
      my_votes: myVotes,
      host_tier: c.host_tier ?? 'individual',  // 🚀 0058: 주최 계층 (값 없으면 individual 폴백)
      host_label: c.host_label ?? null,         // 🚀 0058: 주최자명 (figure/org 만 채워짐)
      gave_up_at: c.gave_up_at ?? null,
    };
  });
}

// 둘러보기 카드의 4가지 평가 토글
export async function toggleChallengeVote(args: {
  challengeId: string;
  userId: string;
  voteType: ChallengeVoteType;
  currentlyVoted: boolean;
}): Promise<void> {
  if (args.currentlyVoted) {
    const { error } = await supabase
      .from('challenge_votes')
      .delete()
      .match({ challenge_id: args.challengeId, user_id: args.userId, vote_type: args.voteType });
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from('challenge_votes')
      .insert({ challenge_id: args.challengeId, user_id: args.userId, vote_type: args.voteType });
    if (error) throw error;
  }
}

// 🚀 하다 구경 (익명 발상 라이브러리, 0050) — 전체 유형 익명 목록.
//   browse_challenges RPC 가 신원 컬럼(creator_id·user_id)을 안 내려주므로 여기서도 신원을 다루지 않는다.
//   정렬은 RPC 가 최신순 고정 (참조수·평가수 desc 줄세우기 금지).
export async function fetchBrowseChallenges(limit = 60): Promise<BrowseChallengeCard[]> {
  const { data, error } = await supabase.rpc('browse_challenges', { p_limit: limit });
  if (error) throw error;

  return (data ?? []).map((r: any) => {
    // RPC 의 votes 는 jsonb 객체 {creative: n, ...} — 4종 카운트로 정규화
    const votesByType: ChallengeVoteCounts = { creative: 0, hard: 0, touching: 0, fresh: 0 };
    const raw = r.votes ?? {};
    for (const k of Object.keys(raw)) {
      if (k in votesByType) votesByType[k as ChallengeVoteType] = Number(raw[k]) || 0;
    }
    return {
      id: r.id,
      kind: r.kind as ChallengeKind,
      title: r.title,
      description: r.description ?? null,
      intro_image_url: r.intro_image_url ?? null,
      goal_type: (r.goal_type ?? 'cadence') as ChallengeGoalType,
      target_count: r.target_count ?? null,
      frequency: r.frequency,
      start_date: r.start_date,
      end_date: r.end_date,
      category_id: r.category_id ?? null,
      category: r.category_name
        ? { emoji: r.category_emoji ?? '✨', name: r.category_name, is_impact: !!r.category_is_impact }
        : null,
      reference_count: r.reference_count ?? 0,
      created_at: r.created_at,
      votes_by_type: votesByType,
      my_votes: (r.my_votes ?? []) as ChallengeVoteType[],
    };
  });
}

// 🚀 따라하기 — 원본 하다를 1회 참조했음을 기록 (멱등, 1인1회). 따라한 새 하다가 '생성 완료'된 직후 호출.
//   탭만 하고 안 만들면 호출하지 않음 = 참조수 정직.
export async function referenceChallenge(sourceChallengeId: string): Promise<void> {
  const { error } = await supabase.rpc('reference_challenge', { p_challenge_id: sourceChallengeId });
  if (error) throw error;
}

// 🚀 파장(선한 영향력) 탭 3층 집계 (0054) — 나 → 우리 → 세상.
//   parang_stats RPC 는 SECURITY DEFINER 로 RLS 를 우회하되 집계 스칼라만 내려준다(신원 컬럼 없음).
//   비교/랭킹 아님 — 숫자는 '번진 이야기'의 강조점일 뿐. 실패 시 throw 하여 화면이 빈 상태로 처리.
export interface ParangStats {
  mine:  { reference_total: number; cheers_given: number; courage_received: number };
  ours:  { week_cheers: number; week_new_starts: number };
  world: { donated_count: number; donated_amount: number };
}
export async function fetchParangStats(): Promise<ParangStats> {
  const { data, error } = await supabase.rpc('parang_stats');
  if (error) throw error;
  return data as ParangStats;
}

// 🚀 파장 = 기여 피드 (0060) — 자동 이벤트(참조·완주·기부) 통합 목록.
//   parang_feed RPC 는 SECURITY DEFINER 로 RLS 를 우회하되 신원 컬럼 없이 공개 콘텐츠만 내려준다.
//   v1 = 자동 이벤트만(사용자 글·반응은 v2). 실패 시 throw 하여 화면이 빈 상태로 처리.
export interface ParangFeedItem {
  event_type: 'reference' | 'completion' | 'donation';
  challenge_id: string | null;   // CTA용 (reference·completion). donation 은 익명 null.
  title: string | null;          // 하다 제목. donation 은 null.
  count: number | null;          // reference = 따라 시작한 사람 수. 그 외 null.
  amount: number | null;         // donation = 기부 금액. 그 외 null.
  created_at: string;
}
export async function fetchParangFeed(): Promise<ParangFeedItem[]> {
  const { data, error } = await supabase.rpc('parang_feed');
  if (error) throw error;
  return (data ?? []) as ParangFeedItem[];
}

// 🚀 파장 = 사용자 기여 글 (0061, 피드 v2) — 인증/기록을 "파장에 나누기"로 올린 공개 글.
//   parang_posts RPC 는 SECURITY DEFINER 로 멤버십 RLS 를 우회하되 화이트리스트 컬럼만 내려준다.
//   비익명 글은 사용자가 스스로 공개 나눔한 것이라 nickname/avatar 노출이 정상, 익명 글은 null.
//   (작성 화면·FeedCard·차단 필터는 v2b. 실패 시 throw 하여 화면이 빈 상태로 처리.)
export interface ParangPost {
  post_type: 'proof' | 'log';
  post_id: string;
  challenge_id: string;
  title: string;                       // 하다 제목
  body: string | null;                 // caption(proof) / content(log)
  photo_url: string | null;            // 커버(첫 장)
  photo_urls?: string[];               // 🚀 0062: 사진 전체(최대 3~4장). 비면 [photo_url] 폴백
  author_nickname: string | null;      // 익명이면 null → 클라가 "어떤 이의 걸음"
  author_avatar: string | null;        // 익명이면 null
  author_host_tier: string | null;     // 🚀 0064: 작성자 계층 (익명이면 null — 티어도 신원 힌트라 함께 가림)
  author_early_tier: string | null;    // 🚀 0066: 작성자 창립 티어 (익명이면 null — 창립 집합도 희소해서 신원 힌트)
  reference_count: number;             // 이 하다를 따라 시작한 사람 수(은은한 "움직인 수")
  courage_count: number;               // 공명해요 집계
  comment_count: number;               // 🚀 0063: 숨김 아닌 댓글 수
  mine_couraged: boolean;              // 내 반응 여부
  created_at: string;
}
export async function fetchParangPosts(): Promise<ParangPost[]> {
  const { data, error } = await supabase.rpc('parang_posts');
  if (error) throw error;
  return (data ?? []) as ParangPost[];
}

// 🚀 파장 "용기 받았어요" 반응 토글 (0061) — 사용자당 글당 1회, 취소 가능.
//   parang_reactions 는 (target_type, target_id, user_id) PK — insert/delete 로 토글.
export async function toggleParangCourage(args: {
  postType: 'proof' | 'log';
  postId: string;
  userId: string;
  currentlyCouraged: boolean;
}): Promise<void> {
  if (args.currentlyCouraged) {
    const { error } = await supabase
      .from('parang_reactions')
      .delete()
      .eq('target_type', args.postType)
      .eq('target_id', args.postId)
      .eq('user_id', args.userId);
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from('parang_reactions')
      .insert({ target_type: args.postType, target_id: args.postId, user_id: args.userId });
    if (error) throw error;
  }
}

// 🚀 공명 글 댓글 (0063) — 익명 토글 · SNS형 하단 댓글. 익명이면 작성자 null.
export type ParangComment = {
  id: string;
  content: string;
  anon: boolean;
  author_nickname: string | null;   // 익명이면 null → 클라가 "어떤 이"
  author_avatar: string | null;
  mine: boolean;                     // 내 댓글인지 (삭제 노출용)
  created_at: string;
};

// 한 글의 댓글 목록 — SECURITY DEFINER RPC(익명 신원 숨김·차단·숨김 필터 내부 처리).
export async function fetchParangComments(
  postType: 'proof' | 'log',
  postId: string,
): Promise<ParangComment[]> {
  const { data, error } = await supabase.rpc('parang_comments', {
    p_target_type: postType,
    p_target_id: postId,
  });
  if (error) throw error;
  return (data ?? []) as ParangComment[];
}

// 댓글 작성 — 검수(block→차단) 후 insert. anon 기본 true(기본 익명).
export async function addParangComment(args: {
  postType: 'proof' | 'log';
  postId: string;
  userId: string;
  content: string;
  anon?: boolean;
}): Promise<void> {
  const trimmed = args.content.trim();
  if (!trimmed) throw new Error('내용을 입력해주세요.');
  if (trimmed.length > 200) throw new Error('200자 이내로 적어주세요.');
  await moderateUgcText(trimmed);   // 🚀 검수 (block→throw)
  const { error } = await supabase.from('parang_comments').insert({
    target_type: args.postType,
    target_id: args.postId,
    user_id: args.userId,
    content: trimmed,
    anon: args.anon ?? true,
  });
  if (error) throw error;
}

// 내 댓글 삭제 (RLS 본인 한정)
export async function deleteParangComment(id: string): Promise<void> {
  const { error } = await supabase.from('parang_comments').delete().eq('id', id);
  if (error) throw error;
}

// ─── 카테고리 시스템 (0007 categories + subcategories) ─
// 10 대분류 + 소분류. 거의 변경 안 되므로 클라이언트 캐시 1회.
export type DbCategory = {
  id: number;
  slug: string;
  emoji: string;
  name: string;
  copy: string;
  is_impact: boolean;
  sort_order: number;
};

export type DbSubcategory = {
  id: number;
  category_id: number;
  name: string;
  sort_order: number;
};

let _catCache: { categories: DbCategory[]; subcategories: DbSubcategory[] } | null = null;

export async function fetchCategoryTree(force = false): Promise<{
  categories: DbCategory[];
  subcategories: DbSubcategory[];
}> {
  if (_catCache && !force) return _catCache;
  const [resCat, resSub] = await Promise.all([
    supabase.from('categories').select('*').order('sort_order', { ascending: true }),
    supabase.from('subcategories').select('*').order('sort_order', { ascending: true }),
  ]);
  if (resCat.error) throw resCat.error;
  if (resSub.error) throw resSub.error;
  _catCache = {
    categories: (resCat.data ?? []) as DbCategory[],
    subcategories: (resSub.data ?? []) as DbSubcategory[],
  };
  return _catCache;
}

// ─── 챌린지 방 기록 탭 (logs / log_likes / log_comments) — Vlog 형태 ─
export type LogWithAuthor = {
  id: string;
  challenge_id: string;
  user_id: string;
  title: string;
  content: string;
  photo_url: string | null;     // 커버(=첫 장)
  photo_urls: string[];         // 🚀 0045: 기록 사진 전체 (최대 4장)
  created_at: string;
  author: { id: string; nickname: string; avatar_url: string | null; host_tier?: string | null; early_tier?: string | null };
  like_count: number;
  liked_by_me: boolean;
  comment_count: number;
  hidden: boolean;              // 🚀 숨김(신고 3건 누적 자동숨김 등) — true 면 카드 자리에 '숨김' 플레이스홀더
};

export async function fetchLogs(challengeId: string, myUserId: string, limit = 30): Promise<LogWithAuthor[]> {
  const { data, error } = await supabase
    .from('logs')
    .select(`
      id, challenge_id, user_id, title, content, photo_url, photo_urls, hidden, created_at,
      users:user_id(id, nickname, avatar_url, host_tier, early_tier),
      log_likes(user_id),
      log_comments(count)
    `)
    .eq('challenge_id', challengeId)
    // 🚀 숨김 기록도 가져온다 — 목록에서 증발시키지 않고 '숨김 처리됨' 플레이스홀더로 노출(2026-06-18)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  const blocked = await fetchBlockedUserIds();   // 🚀 3b
  return (data ?? []).filter((l: any) => !blocked.has(l.user_id)).map((l: any) => {
    const likes: { user_id: string }[] = l.log_likes ?? [];
    return {
      id: l.id,
      challenge_id: l.challenge_id,
      user_id: l.user_id,
      title: l.title,
      content: l.content,
      photo_url: l.photo_url,
      photo_urls: (l.photo_urls?.length ? l.photo_urls : (l.photo_url ? [l.photo_url] : [])),
      created_at: l.created_at,
      author: {
        id: l.users?.id ?? l.user_id,
        nickname: l.users?.nickname ?? '',
        avatar_url: l.users?.avatar_url ?? null,
        host_tier: l.users?.host_tier ?? null,     // 임베드 null 폴백 가드 유지
        early_tier: l.users?.early_tier ?? null,
      },
      like_count: likes.length,
      liked_by_me: likes.some(x => x.user_id === myUserId),
      comment_count: l.log_comments?.[0]?.count ?? 0,
      hidden: !!l.hidden,
    };
  });
}

// 전체 기록 피드 (v2.5 — 기록 탭 신규)
// RLS 가 멤버 챌린지 + 오픈 챌린지 로그만 보여줌.
// 본인 + 도전 인연 (현재 같은 챌린지 멤버) 의 기록이 자연스럽게 union 됨.
export type LogWithChallenge = LogWithAuthor & {
  challenge: { title: string; category: { emoji: string; name: string } | null };
};

export async function fetchRecentLogs(myUserId: string, limit = 30): Promise<LogWithChallenge[]> {
  const { data, error } = await supabase
    .from('logs')
    .select(`
      id, challenge_id, user_id, title, content, photo_url, photo_urls, hidden, created_at,
      users:user_id(id, nickname, avatar_url, host_tier, early_tier),
      log_likes(user_id),
      log_comments(count),
      challenge:challenge_id (
        title,
        category:category_id (emoji, name)
      )
    `)
    // 🚀 숨김 기록도 가져온다 — 증발 대신 '숨김 처리됨' 플레이스홀더로 노출(2026-06-18)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  const blocked = await fetchBlockedUserIds();   // 🚀 3b
  return (data ?? []).filter((l: any) => !blocked.has(l.user_id)).map((l: any) => {
    const likes: { user_id: string }[] = l.log_likes ?? [];
    return {
      id: l.id,
      challenge_id: l.challenge_id,
      user_id: l.user_id,
      title: l.title,
      content: l.content,
      photo_url: l.photo_url,
      photo_urls: (l.photo_urls?.length ? l.photo_urls : (l.photo_url ? [l.photo_url] : [])),
      created_at: l.created_at,
      author: {
        id: l.users?.id ?? l.user_id,
        nickname: l.users?.nickname ?? '',
        avatar_url: l.users?.avatar_url ?? null,
        host_tier: l.users?.host_tier ?? null,     // 임베드 null 폴백 가드 유지
        early_tier: l.users?.early_tier ?? null,
      },
      like_count: likes.length,
      liked_by_me: likes.some(x => x.user_id === myUserId),
      comment_count: l.log_comments?.[0]?.count ?? 0,
      hidden: !!l.hidden,
      challenge: {
        title: l.challenge?.title ?? '',
        category: l.challenge?.category ?? null,
      },
    };
  });
}

// ─── 기록 댓글 (log_comments) ─────────────────────────
export type LogCommentWithAuthor = {
  id: string;
  log_id: string;
  user_id: string;
  content: string;
  created_at: string;
  author: { id: string; nickname: string; avatar_url: string | null; host_tier?: string | null; early_tier?: string | null };
};

export async function fetchLogComments(logId: string): Promise<LogCommentWithAuthor[]> {
  const { data, error } = await supabase
    .from('log_comments')
    .select('id, log_id, user_id, content, created_at, users:user_id(id, nickname, avatar_url, host_tier, early_tier)')
    .eq('log_id', logId)
    .eq('hidden', false)   // 🚀 3b
    .order('created_at', { ascending: true });
  if (error) throw error;
  const blocked = await fetchBlockedUserIds();   // 🚀 3b
  return (data ?? []).filter((c: any) => !blocked.has(c.user_id)).map((c: any) => ({
    id: c.id,
    log_id: c.log_id,
    user_id: c.user_id,
    content: c.content,
    created_at: c.created_at,
    author: {
      id: c.users?.id ?? c.user_id,
      nickname: c.users?.nickname ?? '',
      avatar_url: c.users?.avatar_url ?? null,
      host_tier: c.users?.host_tier ?? null,     // 임베드 null 폴백 가드 유지
      early_tier: c.users?.early_tier ?? null,
    },
  }));
}

// 🚀 3a/3b 일반 UGC 검수 — moderate-text(text 모드). block→throw(등록 차단), 그 외(allow·flag)→그대로 게시.
//   댓글·기록·완주이야기·대화 작성/편집 직전 호출하는 차단 게이트.
//   hidden 은 클라가 정하지 않는다 — 서버(신고 3건 누적 트리거 0047 · 운영자 RPC 0059)만 정하는 값.
//   (클라가 hidden 을 실어 보내면 작성자의 '수정' 한 번이 서버의 숨김을 되돌린다.)
//   우회 분기 없음. 검수 자체 실패(API 오류)도 EF 가 block 반환 → 안전 측 차단.
async function moderateUgcText(content: string): Promise<void> {
  const text = content.trim();
  if (!text) return;   // 빈 텍스트는 각 함수의 자체 검증이 이미 처리
  const { data, error } = await supabase.functions.invoke<{
    verdict: 'allow' | 'flag' | 'block'; reason: string | null; category: string | null;
  }>('moderate-text', { body: { mode: 'text', content: text } });
  if (error) {
    throw new Error('검수 시스템 통신에 실패했어요. 네트워크 연결을 확인하고 다시 시도해주세요.');
  }
  // 🚀 검수 강도 완화 (2026-06-18): 명백한 위반(block)만 작성을 막는다.
  //    flag(경계선 의심)는 더 이상 자동 숨김하지 않는다 — 사람이 검토하는 큐가 없는 상태에서
  //    AI 추측만으로 선량한 글(책 감상문 등)이 조용히 증발하던 문제 제거.
  //    잔여 안전망: ① block(명백한 위반) ② 신고 3건 누적 자동숨김(0047 트리거).
  if (!data || data.verdict === 'block') {
    throw new Error(data?.reason ?? '부적절한 내용이 포함되어 있어요. 표현을 바꿔주세요.');
  }
  // 통과 — 그대로 게시 (hidden 은 컬럼 default false, 서버만 true 로 바꾼다)
}

export async function addLogComment(args: {
  logId: string;
  userId: string;
  content: string;
}): Promise<void> {
  const trimmed = args.content.trim();
  if (!trimmed) throw new Error('댓글을 입력해주세요.');
  if (trimmed.length > 280) throw new Error('280자 이내로 적어주세요.');
  await moderateUgcText(trimmed);   // 🚀 검수 (v2.19: block→차단, flag·allow→통과·미숨김)
  const { error } = await supabase.from('log_comments').insert({
    log_id: args.logId,
    user_id: args.userId,
    content: trimmed,
  });
  if (error) throw error;
}

export async function deleteLogComment(commentId: string): Promise<void> {
  const { error } = await supabase.from('log_comments').delete().eq('id', commentId);
  if (error) throw error;
}

export async function createLog(args: {
  challengeId: string;
  userId: string;
  title: string;
  content: string;
  photoUrls?: string[];   // 🚀 0045: 기록 사진 (최대 4장). photo_url 은 커버(첫 장)
  shareToParang?: boolean;   // 🚀 파장에 나누기 (v2b) — 이 기록을 공개 파장 피드로
  parangAnon?: boolean;      // 🚀 익명으로 나누기 (share 켠 경우만 의미)
}): Promise<void> {
  const title = args.title.trim();
  const content = args.content.trim();
  if (!title) throw new Error('제목을 입력해주세요.');
  if (title.length > 80) throw new Error('제목은 80자 이내로 적어주세요.');
  if (!content) throw new Error('내용을 입력해주세요.');
  if (content.length > 4000) throw new Error('내용은 4000자 이내로 적어주세요.');
  await moderateUgcText(`${title}\n${content}`);   // 🚀 검수 (v2.19: block→차단, flag·allow→통과·미숨김)

  const photos = (args.photoUrls ?? []).slice(0, 4);
  const shareToParang = args.shareToParang ?? false;
  const { error } = await supabase.from('logs').insert({
    challenge_id: args.challengeId,
    user_id: args.userId,
    title,
    content,
    photo_url: photos[0] ?? null,
    photo_urls: photos,
    share_to_parang: shareToParang,                          // 🚀 파장 나누기 (기본 false)
    parang_anon: shareToParang ? (args.parangAnon ?? false) : false,   // 공유 안 하면 익명 플래그 무의미
  });
  if (error) throw error;
}

// 기록 본문 수정 — 본인만 (RLS)
export async function updateLog(args: {
  logId: string;
  title: string;
  content: string;
  photoUrls?: string[];   // 🚀 0045: 기록 사진 (최대 4장). photo_url 은 커버(첫 장)
}): Promise<void> {
  const title = args.title.trim();
  const content = args.content.trim();
  if (!title) throw new Error('제목을 입력해주세요.');
  if (title.length > 80) throw new Error('제목은 80자 이내로 적어주세요.');
  if (!content) throw new Error('내용을 입력해주세요.');
  if (content.length > 4000) throw new Error('내용은 4000자 이내로 적어주세요.');
  await moderateUgcText(`${title}\n${content}`);   // 🚀 검수 (v2.19: block→차단, flag·allow→통과·미숨김)

  const photos = (args.photoUrls ?? []).slice(0, 4);
  // hidden 은 payload 에서 제외 — 수정이 서버의 숨김(신고 3건 누적·운영자)을 되돌리면 안 된다
  const { error } = await supabase
    .from('logs')
    .update({ title, content, photo_url: photos[0] ?? null, photo_urls: photos })
    .eq('id', args.logId);
  if (error) throw error;
}

// 기록 삭제 — 본인만 (RLS) + log_likes / log_comments cascade
export async function deleteLog(logId: string): Promise<void> {
  const { error } = await supabase.from('logs').delete().eq('id', logId);
  if (error) throw error;
}

// 기록 댓글 수정 (v2.2)
export async function updateLogComment(args: {
  commentId: string;
  content: string;
}): Promise<void> {
  const trimmed = args.content.trim();
  if (!trimmed) throw new Error('댓글을 입력해주세요.');
  if (trimmed.length > 280) throw new Error('280자 이내로 적어주세요.');
  await moderateUgcText(trimmed);   // 🚀 검수 (v2.19: block→차단, flag·allow→통과·미숨김)
  const { error } = await supabase
    .from('log_comments')
    .update({ content: trimmed })
    .eq('id', args.commentId);
  if (error) throw error;
}

export async function toggleLogLike(args: {
  logId: string;
  userId: string;
  currentlyLiked: boolean;
}): Promise<void> {
  if (args.currentlyLiked) {
    const { error } = await supabase
      .from('log_likes')
      .delete()
      .match({ log_id: args.logId, user_id: args.userId });
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from('log_likes')
      .insert({ log_id: args.logId, user_id: args.userId });
    if (error) throw error;
  }
}

// ─── 챌린지 방 대화 (chat_messages) ──────────────────
export type ChatMessageWithAuthor = {
  id: string;
  challenge_id: string;
  user_id: string;
  content: string;
  created_at: string;
  is_notice?: boolean;
  author: { id: string; nickname: string; avatar_url: string | null; host_tier?: string | null; early_tier?: string | null };
};

export async function fetchChatMessages(challengeId: string, limit = 100): Promise<ChatMessageWithAuthor[]> {
  const { data, error } = await supabase
    .from('chat_messages')
    .select('id, challenge_id, user_id, content, created_at, is_notice, users:user_id(id, nickname, avatar_url, host_tier, early_tier)')
    .eq('challenge_id', challengeId)
    .eq('hidden', false)   // 🚀 3b
    .order('created_at', { ascending: true })
    .limit(limit);
  if (error) throw error;
  const blocked = await fetchBlockedUserIds();   // 🚀 3b
  return (data ?? []).filter((m: any) => !blocked.has(m.user_id)).map((m: any) => ({
    id: m.id,
    challenge_id: m.challenge_id,
    user_id: m.user_id,
    content: m.content,
    created_at: m.created_at,
    is_notice: !!m.is_notice,
    author: {
      id: m.users?.id ?? m.user_id,
      nickname: m.users?.nickname ?? '',
      avatar_url: m.users?.avatar_url ?? null,
      host_tier: m.users?.host_tier ?? null,     // 임베드 null 폴백 가드 유지
      early_tier: m.users?.early_tier ?? null,
    },
  }));
}

export async function sendChatMessage(args: {
  challengeId: string;
  userId: string;
  content: string;
}): Promise<void> {
  const trimmed = args.content.trim();
  if (!trimmed) throw new Error('메시지를 입력해주세요.');
  if (trimmed.length > 1000) throw new Error('1000자 이내로 적어주세요.');
  await moderateUgcText(trimmed);   // 🚀 검수 (v2.19: block→차단, flag·allow→통과·미숨김)
  const { error } = await supabase.from('chat_messages').insert({
    challenge_id: args.challengeId,
    user_id: args.userId,
    content: trimmed,
  });
  if (error) throw error;
}

// ─── 초대 수락용 단건 챌린지 상세 조회 ──────────────────
// closed/cheered 챌린지도 비멤버가 메타를 안전하게 볼 수 있도록 security definer RPC 경유.
// (직접 SELECT 시 RLS challenges_member_read 가 비멤버를 막아 invite 페이지가 깨졌었음.)
export type InviteInfo = {
  id: string;
  title: string;
  kind: 'closed' | 'open' | 'cheered';   // solo 는 RPC 가 거부
  start_date: string;
  end_date: string;
  invitation_message: string | null;
  description: string | null;            // 🚀 0037: 안내문 텍스트
  intro_image_url: string | null;        // 🚀 0037: 안내문 이미지
  bet_tier: string | null;               // 🚀 0040: 다인 내기 티어 (null=내기 없음)
  bet_donation_mode: string | null;      // 🚀 0040: 다인 내기 기부 모드
  host_tier?: 'individual' | 'figure' | 'org';  // 🚀 0073: 주최 계층 — 합류 결정 직전 신뢰 표식
  host_label?: string | null;                   // 🚀 0073: 표시용 주최자명 (figure/org 일 때)
  sponsor_amount_per_completer?: number | null; // 🚀 0075: 완주 매칭 기부 약정 — 완주자 1명당 금액(원)
  sponsor_beneficiary?: string | null;          // 🚀 0075: 기부처 표시명
  member_count: number;
  creator_nickname: string;
  category: { emoji: string; name: string } | null;
};

export async function fetchChallengeDetailForInvite(challengeId: string): Promise<InviteInfo> {
  const { data, error } = await supabase.rpc('get_invite_info', {
    p_challenge_id: challengeId,
  });
  if (error) throw error;
  if (!data) throw new Error('초대 정보를 불러오지 못했습니다.');
  return data as InviteInfo;
}

// ─── 챌린지 방 1개 + 멤버 + 인증 피드 (room/[id]) ──────
// 🚀 0043: 누구나 방 개설자 — 모집 잠금/해제.
// 해제(locked=false)는 기간 50% 자동마감 전까지만 가능 — 서버 RPC(set_recruit_lock)가 'auto_closed' 로 강제.
export async function setRecruitLock(challengeId: string, locked: boolean): Promise<void> {
  const { error } = await supabase.rpc('set_recruit_lock', {
    p_challenge_id: challengeId,
    p_locked: locked,
  });
  if (error) throw error;
}

export async function fetchRoomData(challengeId: string, myUserId: string) {
  const [resChallenge, resMembers, resProofs, resLogCount] = await Promise.all([
    supabase.from('challenges').select('*').eq('id', challengeId).single(),
    supabase
      .from('challenge_members')
      // user_id 직접 포함 — 비멤버는 users(*) 조인이 RLS 로 null 이라 프로필 없이도 멤버를 식별해야 함
      // role(0069) — 조직 하다 주최자('host')는 도전자가 아니라 인원·인증 집계에서 빠진다
      .select('user_id, paused_until, joined_at, gave_up_at, role, users(*)')
      .eq('challenge_id', challengeId)
      .order('joined_at', { ascending: true }),
    supabase
      .from('proofs')
      .select('*, users:user_id(*), cheers(user_id, cheer_type), comments(count)')
      .eq('challenge_id', challengeId)
      .eq('hidden', false)   // 🚀 3b: 신고누적·flag 자동숨김 제외
      .order('created_at', { ascending: false }),
    // 기록(Vlog) 총 개수 — 박제 통계·ImpactModal 용 (행 데이터 없이 count 만)
    supabase
      .from('logs')
      .select('id', { count: 'exact', head: true })
      .eq('challenge_id', challengeId),
  ]);

  if (resChallenge.error) throw resChallenge.error;
  if (resMembers.error) throw resMembers.error;
  if (resProofs.error) throw resProofs.error;

  // 오늘 인증 여부는 KST 기준 (UTC prefix 비교는 KST 00~09시에 어긋남)
  const { startUtc, endUtc } = getTodayRange();
  const todayStartMs = Date.parse(startUtc);
  const todayEndMs = Date.parse(endUtc);
  // 🚀 3b: 차단(양방향) user 인증 제외 (hidden 은 쿼리에서 이미 서버 필터)
  const blocked = await fetchBlockedUserIds();
  const proofsRaw = (resProofs.data ?? []).filter((p: any) => !blocked.has(p.user_id));

  // 🚀 참가자 수는 프로필 가시성과 분리해 센다.
  // 비멤버는 다른 멤버의 users(프로필) 행을 RLS(users_self_read)로 못 읽어 아래 members 가 적게 잡히지만,
  // challenge_members 행 자체는 open 방에서 열람 가능하므로 여기서 활성(포기 안 함) 수를 직접 센다.
  // (홈 '관심 도전' 카드의 member_count 와 같은 기준 — 홈/방 인원 표시 일치)
  // 🚀 0069: 조직 하다 주최자(role='host')는 도전자가 아니므로 인원 수에서 뺀다 —
  //   주최자를 세면 인포바 분모(📸 N/N)가 영원히 안 채워지는 1명을 안고 간다.
  const activeMembers = (resMembers.data ?? []).filter((m: any) => m.gave_up_at === null && m.role !== 'host');
  const memberCount = activeMembers.length;

  // 🚀 오늘 인증한 활성 멤버 수도 프로필 가시성과 분리해 센다.
  // 비멤버는 members(프로필 보이는 멤버)가 깎여 numerator 가 낮게 보이므로,
  // 활성 멤버 user_id 집합 × proofs(open 방은 비멤버도 열람 가능)로 직접 카운트 (KST 오늘 범위).
  const activeMemberIds = new Set(activeMembers.map((m: any) => m.user_id));
  const checkedTodayIds = new Set<string>();
  for (const p of proofsRaw) {
    const t = Date.parse(p.created_at);
    if (activeMemberIds.has(p.user_id) && t >= todayStartMs && t < todayEndMs) {
      checkedTodayIds.add(p.user_id);
    }
  }
  const todayCheckedCount = checkedTodayIds.size;

  // 🚀 0075: 완주 매칭 기부 표시용 완주자 수 — memberCount 와 같은 이유로 프로필 가시성과 분리해 센다
  //   (members 는 users 조인이 RLS 로 null 인 비멤버에게 깎여, 그 값으로 세면 조직의 기부액이 실제보다 적게 공개된다).
  //   판정·주최자 제외는 stats.countCompleters 단일 소스.
  const completerCount = countCompleters(
    resChallenge.data as DbChallenge,
    (resMembers.data ?? []) as any,
    proofsRaw as any,
  );

  const members: MemberWithToday[] = (resMembers.data ?? [])
    .filter((m: any) => m.users)
    .map((m: any) => ({
      ...m.users,
      paused_until: m.paused_until ?? null,
      gave_up_at:   m.gave_up_at   ?? null,
      joined_at: m.joined_at,
      role: (m.role ?? 'member') as ChallengeMemberRole,   // 🚀 0069
      today_checked: proofsRaw.some((p: any) => {
        if (p.user_id !== m.users.id) return false;
        const t = Date.parse(p.created_at);
        return t >= todayStartMs && t < todayEndMs;
      }),
    }));

  const proofs: ProofWithRelations[] = proofsRaw.map((p: any) => {
    const cheers: { user_id: string; cheer_type: CheerType }[] = p.cheers ?? [];
    const cheersByType: Record<CheerType, number> = { fire: 0, clap: 0, muscle: 0, heart: 0 };
    const myCheers: CheerType[] = [];
    for (const c of cheers) {
      const t = (c.cheer_type ?? 'heart') as CheerType;
      cheersByType[t] = (cheersByType[t] ?? 0) + 1;
      if (c.user_id === myUserId) myCheers.push(t);
    }
    return {
      id: p.id,
      challenge_id: p.challenge_id,
      user_id: p.user_id,
      photo_url: p.photo_url,
      photo_urls: (p.photo_urls?.length ? p.photo_urls : (p.photo_url ? [p.photo_url] : [])),
      caption: p.caption,
      created_at: p.created_at,
      streak_count: p.streak_count ?? 0,
      author: p.users,
      cheer_count: cheers.length,
      cheered_by_me: myCheers.length > 0,
      cheers_by_type: cheersByType,
      my_cheers: myCheers,
      comment_count: p.comments?.[0]?.count ?? 0,
    };
  });

  return {
    challenge: resChallenge.data as DbChallenge,
    members,
    memberCount,
    todayCheckedCount,
    completerCount,
    proofs,
    totalLogs: resLogCount.count ?? 0,
  };
}

// ─── 챌린지 만들기 (create) ────────────────────────────
// create_challenge RPC (0007) — challenges + challenge_members 두 INSERT 를
// 원자적으로 처리 + RLS 우회. v2 컬럼 (카테고리/빈도) 추가됨.
// 신규 파라미터는 default 가 있으므로 안 보내도 동작.
export type CreateChallengeFrequency = 'daily' | 'weekly3' | 'weekly1';
export type CreateChallengeProofType = 'photo' | 'screenshot';   // v2.2: GPS 는 Phase 2

export async function createChallenge(args: {
  userId: string;                   // 호환용 (실제로는 서버 auth.uid() 사용)
  title: string;
  description?: string;
  durationDays: number;
  kind: ChallengeKind;
  categoryId?: number | null;       // v2: 10 대분류 (없으면 null)
  subcategoryId?: number | null;    // v2: 소분류 (없으면 null)
  frequency?: CreateChallengeFrequency; // v2: 인증 빈도 (기본 daily)
  proofType?: CreateChallengeProofType; // v2.2: 사진(카메라) or 스크린샷(보관함)
  startDate?: string;               // 🚀 신규 추가: YYYY-MM-DD 포맷
  introImageUrl?: string | null;    // 🚀 0037: 안내문 이미지 R2 URL (나홀로 제외)
  betTier?: string | null;          // 🚀 0040: 다인 내기 티어 (다함께·누구나, null=내기 없음)
  betDonationMode?: string;         // 🚀 0040: 다인 내기 기부 모드 (기본 commitment)
  goalType?: 'cadence' | 'count';   // 🚀 0041: 목표 유형 (기본 cadence)
  targetCount?: number | null;      // 🚀 0041: count 유형의 목표 개수
}): Promise<DbChallenge> {
  const start = args.startDate ? new Date(args.startDate) : new Date();
  const end = new Date(start);
  end.setDate(end.getDate() + args.durationDays - 1);

  const { data, error } = await supabase.rpc('create_challenge', {
    p_title:          args.title.trim(),
    p_description:    args.description?.trim() || null,
    p_kind:           args.kind,
    p_start_date:     start.toISOString().slice(0, 10),
    p_end_date:       end.toISOString().slice(0, 10),
    p_category_id:    args.categoryId    ?? null,
    p_subcategory_id: args.subcategoryId ?? null,
    p_frequency:      args.frequency     ?? 'daily',
    p_proof_type:     args.proofType     ?? 'photo',
    p_intro_image_url: args.introImageUrl ?? null,
    p_bet_tier:        args.betTier        ?? null,
    p_bet_donation_mode: args.betDonationMode ?? 'commitment',
    p_goal_type:       args.goalType       ?? 'cadence',
    p_target_count:    args.targetCount    ?? null,
  });

  if (error) throw error;
  if (!data) throw new Error('하다 생성 응답이 비어있어요.');
  return data as DbChallenge;
}

// ─── 잠시 멈춤 / 재개 (room) ────────────────────────────
export async function pauseMembership(args: {
  challengeId: string;
  userId: string;
  untilDate: string;   // YYYY-MM-DD
}): Promise<void> {
  const { error } = await supabase
    .from('challenge_members')
    .update({ paused_until: args.untilDate })
    .match({ challenge_id: args.challengeId, user_id: args.userId });
  if (error) throw error;
}

export async function resumeMembership(args: {
  challengeId: string;
  userId: string;
}): Promise<void> {
  const { error } = await supabase
    .from('challenge_members')
    .update({ paused_until: null })
    .match({ challenge_id: args.challengeId, user_id: args.userId });
  if (error) throw error;
}

// 도전 포기 (soft delete) — 본인 화면 hide, 데이터는 보존 (Phase 2 박제 재활용)
// 개설자 포기 시: notify_creator_gave_up RPC 한 번으로 challenges.gave_up_at +
//                 멤버 전원 종료 알림 큐 적재를 원자적으로 처리 (security definer).
// 그 후 본인 challenge_members.gave_up_at 도 갱신 (0012 정책).
export async function giveUpMembership(args: {
  challengeId: string;
  userId: string;
}): Promise<void> {
  // 1. 개설자 여부 확인 — RPC 가 어차피 검증하지만 분기 판단 위해 미리 조회
  const { data: chData, error: chErr } = await supabase
    .from('challenges')
    .select('creator_id')
    .eq('id', args.challengeId)
    .single();
  if (chErr) throw chErr;

  // 2. 개설자 본인이 포기 → 챌린지 종료 RPC 호출
  //    (security definer 로 challenges.gave_up_at 갱신 + 멤버 전원 알림 큐 적재)
  if (chData && chData.creator_id === args.userId) {
    const { error: rpcErr } = await supabase.rpc('notify_creator_gave_up', {
      p_challenge_id: args.challengeId,
    });
    if (rpcErr) throw rpcErr;
  }

  // 3. 본인 멤버십 포기 처리 (개설자·일반 멤버 공통)
  const { error, data } = await supabase
    .from('challenge_members')
    .update({ gave_up_at: new Date().toISOString() })
    .match({ challenge_id: args.challengeId, user_id: args.userId })
    .select();
  if (error) throw error;
  if (!data || data.length === 0) {
    throw new Error('포기가 반영되지 않았어요. (RLS 또는 멤버십 누락 가능성)');
  }
}

// 🚀 기능명: 초대장 메시지 업데이트
// 설명: 개설자(방장)가 작성한 커스텀 초대장 문구를 challenges 테이블에 저장합니다.
export async function updateInvitationMessage(args: {
  challengeId: string;
  message: string | null;
}): Promise<void> {
  const { error } = await supabase
    .from('challenges')
    .update({ invitation_message: args.message })
    .eq('id', args.challengeId);
  if (error) throw error;
}

// 🚀 기능명: 전체 알림(공지) 메시지 발송
// 설명: 개설자가 챌린지 룸의 모든 멤버에게 알림(공지)을 발송하는 RPC를 호출합니다.
export async function sendCreatorNotice(args: {
  challengeId: string;
  message: string;
}): Promise<void> {
  const { error } = await supabase.rpc('send_creator_notice', {
    p_challenge_id: args.challengeId,
    p_message: args.message.trim(),
  });
  if (error) throw error;
}

// ─── 내 프로필 (닉네임 + 아바타 수정) ─────────────────
export type MyProfile = {
  nickname: string;
  avatar_url: string | null;
  host_tier: string | null;   // 🚀 0064: 내 계층 — 헤더 아바타 금빛 테두리·닉네임 마크
  early_tier: string | null;  // 🚀 0066: 내 창립 티어 — 헤더 아바타 오렌지 테두리 (마크 없음)
};

export async function fetchMyProfile(userId: string): Promise<MyProfile> {
  const { data, error } = await supabase
    .from('users')
    .select('nickname, avatar_url, host_tier, early_tier')
    .eq('id', userId)
    .single();
  if (error) throw error;
  return {
    nickname: data?.nickname ?? '도전자',
    avatar_url: data?.avatar_url ?? null,
    host_tier: data?.host_tier ?? null,
    early_tier: data?.early_tier ?? null,
  };
}

// 🚀 나의 발자취 (프로필 v2) — 완주 수·최고 연속·받은 응원.
// 마이그레이션 없이 클라에서 정확 집계: 완주 판정은 검증된 stats.goalStatus 단일 소스 재사용
// (KST·빈도·늦합류 비례·count 조기완주 동일 규칙). 비교/줄세우기 아닌 '내 여정' 자축용.
export type MyFootprints = { completed: number; bestStreak: number; cheersReceived: number };

export async function fetchMyFootprints(userId: string): Promise<MyFootprints> {
  // 1) 내 활성 멤버십(포기 제외) + 합류일 — 완주 판정의 늦합류 비례에 필요
  const { data: mems } = await supabase
    .from('challenge_members')
    .select('challenge_id, joined_at')
    .eq('user_id', userId)
    .is('gave_up_at', null);
  const memList = mems ?? [];
  const chIds = memList.map(m => m.challenge_id);
  const joinedMap = new Map<string, string | null>(memList.map(m => [m.challenge_id, m.joined_at]));

  // 2) 내 인증 — 최고 연속·받은 응원·챌린지별 완주 판정용 날짜를 한 번에
  const { data: proofs } = await supabase
    .from('proofs')
    .select('challenge_id, created_at, local_date, streak_count, cheers(count)')
    .eq('user_id', userId);

  let bestStreak = 0;
  let cheersReceived = 0;
  const proofsByCh = new Map<string, { created_at: string; local_date?: string }[]>();
  for (const p of (proofs ?? []) as any[]) {
    bestStreak = Math.max(bestStreak, p.streak_count ?? 0);
    cheersReceived += p.cheers?.[0]?.count ?? 0;
    const arr = proofsByCh.get(p.challenge_id) ?? [];
    arr.push({ created_at: p.created_at, local_date: p.local_date });   // 날짜 판정은 local_date(0077)
    proofsByCh.set(p.challenge_id, arr);
  }

  // 3) 완주 수 — 챌린지 파라미터로 goalStatus 판정 (count 조기완주 / cadence 종료 후)
  let completed = 0;
  if (chIds.length > 0) {
    const { data: chs } = await supabase.from('challenges').select('*').in('id', chIds);
    for (const c of (chs ?? []) as DbChallenge[]) {
      const myProofs = (proofsByCh.get(c.id) ?? []) as unknown as ProofWithRelations[];
      if (goalStatus(c, myProofs, joinedMap.get(c.id) ?? null).isComplete) completed++;
    }
  }

  return { completed, bestStreak, cheersReceived };
}

// 후방 호환 — profile.tsx 가 닉네임만 받던 시절 잔재
export async function fetchMyNickname(userId: string): Promise<string> {
  const p = await fetchMyProfile(userId);
  return p.nickname;
}

// 🚀 하루 기준선 — 내 기준 시간대(0077). 인증 날짜·연속·완주 판정의 경계를 정한다.
//   서버(proofs.local_date 트리거)와 화면 판정이 같은 경계를 쓰도록, 로그인 직후 읽어
//   setActiveTimezone 으로 앱 전역에 반영한다.
export async function fetchMyTimezone(userId: string): Promise<string> {
  const { data, error } = await supabase
    .from('users')
    .select('timezone')
    .eq('id', userId)
    .maybeSingle();
  if (error) throw error;
  return (data as any)?.timezone || DEFAULT_TIMEZONE;
}

// 변경은 하루 1회 (서버 트리거가 강제 — 경계를 밀어 '놓친 하루'를 되살리는 것 차단).
export async function updateMyTimezone(userId: string, timezone: string): Promise<void> {
  const { error } = await supabase
    .from('users')
    .update({ timezone })
    .eq('id', userId);
  if (error) throw error;
  setActiveTimezone(timezone);
}

export async function updateMyNickname(userId: string, nickname: string): Promise<void> {
  const trimmed = nickname.trim();
  if (!trimmed) throw new Error('닉네임을 입력해주세요.');
  if (trimmed.length > 20) throw new Error('20자 이내로 적어주세요.');
  const { error } = await supabase
    .from('users')
    .update({ nickname: trimmed })
    .eq('id', userId);
  if (error) throw error;
}

export async function updateMyAvatar(userId: string, avatarUrl: string): Promise<void> {
  const { error } = await supabase
    .from('users')
    .update({ avatar_url: avatarUrl })
    .eq('id', userId);
  if (error) throw error;
}

// ─── 인증 댓글 (proof 별) ──────────────────────────────
export async function fetchComments(proofId: string): Promise<CommentWithAuthor[]> {
  const { data, error } = await supabase
    .from('comments')
    .select('*, users:user_id(*)')
    .eq('proof_id', proofId)
    .eq('hidden', false)   // 🚀 3b
    .order('created_at', { ascending: true });

  if (error) throw error;

  const blocked = await fetchBlockedUserIds();   // 🚀 3b
  return (data ?? []).filter((c: any) => !blocked.has(c.user_id)).map((c: any) => ({
    id: c.id,
    proof_id: c.proof_id,
    user_id: c.user_id,
    content: c.content,
    created_at: c.created_at,
    author: c.users,
  }));
}

export async function addComment(args: {
  proofId: string;
  userId: string;
  content: string;
}): Promise<void> {
  const trimmed = args.content.trim();
  if (!trimmed) throw new Error('내용을 입력해주세요.');
  if (trimmed.length > 280) throw new Error('280자 이내로 적어주세요.');
  await moderateUgcText(trimmed);   // 🚀 검수 (v2.19: block→차단, flag·allow→통과·미숨김)

  const { error } = await supabase.from('comments').insert({
    proof_id: args.proofId,
    user_id: args.userId,
    content: trimmed,
  });
  if (error) throw error;
}

export async function deleteComment(commentId: string): Promise<void> {
  const { error } = await supabase.from('comments').delete().eq('id', commentId);
  if (error) throw error;
}

// ─── 응원 토글 (room 의 4가지 응원) ─────────────────────
// 0007 부터 cheers 의 unique 가 (proof_id, user_id, cheer_type) → type 별 독립 토글.
// 같은 인증에 동일 type 의 응원이 이미 있으면 DELETE, 없으면 INSERT.
export async function toggleCheer(args: {
  proofId: string;
  userId: string;
  cheerType: CheerType;
  currentlyCheered: boolean;
}): Promise<void> {
  if (args.currentlyCheered) {
    const { error } = await supabase
      .from('cheers')
      .delete()
      .match({ proof_id: args.proofId, user_id: args.userId, cheer_type: args.cheerType });
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from('cheers')
      .insert({ proof_id: args.proofId, user_id: args.userId, cheer_type: args.cheerType });
    if (error) throw error;
  }
}

// ─── v2.5: 해냈어요 (완주 이야기) CRUD ────────────────────────────────────
// 시스템 통계 (total_days/proof_count/longest_streak/completion_rate) 는 DB 트리거가 자동 채움.
// 사용자는 story/hardest/photo_urls/visibility 만 전달.

// 완주 이야기 작성 — 챌린지가 종료되고 본인이 멤버(미포기)일 때만 RLS 통과.
// 트리거가 시스템 통계 자동 채움. 6개 사용자 옵션 모두 선택.
export async function createCompletionStory(args: {
  challengeId: string;
  userId: string;
  story?: string | null;
  hardest?: string | null;
  helpedWhenGivingUp?: string | null;
  adviceToStarters?: string | null;
  ownTip?: string | null;
  whatChanged?: string | null;
  photoUrls?: string[];
  visibility?: StoryVisibility;
}): Promise<DbCompletionStory> {
  // 🚀 3a 검수 — 자유 서술 필드 전체를 합쳐 검수
  await moderateUgcText(
    [args.story, args.hardest, args.helpedWhenGivingUp, args.adviceToStarters, args.ownTip, args.whatChanged]
      .filter(Boolean).join('\n'),
  );
  const { data, error } = await supabase
    .from('completion_stories')
    .insert({
      challenge_id: args.challengeId,
      user_id: args.userId,
      // 시스템 통계는 트리거가 채움 — 일단 0 으로 전달 (NOT NULL 통과용)
      total_days: 0,
      proof_count: 0,
      longest_streak: 0,
      completion_rate: 0,
      story: args.story ?? null,
      hardest: args.hardest ?? null,
      helped_when_giving_up: args.helpedWhenGivingUp ?? null,
      advice_to_starters: args.adviceToStarters ?? null,
      own_tip: args.ownTip ?? null,
      what_changed: args.whatChanged ?? null,
      photo_urls: args.photoUrls ?? [],
      visibility: args.visibility ?? 'public',
    })
    .select()
    .single();
  if (error) throw error;
  return data as DbCompletionStory;
}

// 해냈어요 공개 탭 — visibility='public' 이야기 최신순
export async function fetchPublicCompletionStories(args: {
  limit?: number;
  offset?: number;
  myUserId?: string;     // 전달 시 couraged_by_me 계산
} = {}): Promise<CompletionStoryCard[]> {
  const { limit = 20, offset = 0, myUserId } = args;
  const { data, error } = await supabase
    .from('completion_stories')
    .select(`
      *,
      author:user_id (id, email, nickname, avatar_url, created_at, host_tier, early_tier),
      challenge:challenge_id (
        title,
        category:category_id (emoji, name)
      ),
      reactions:completion_story_reactions (user_id)
    `)
    .eq('visibility', 'public')
    .eq('hidden', false)   // 🚀 3b: 신고누적·flag 자동숨김 제외
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);
  if (error) throw error;
  const blocked = await fetchBlockedUserIds();   // 🚀 3b: 차단(양방향) 제외
  return (data ?? []).filter((row: any) => !blocked.has(row.user_id)).map((row: any) => mapStoryReactions(row, myUserId));
}

// 용기 받았어요 집계 — reactions 배열을 count + 내 반응 여부로 변환
function mapStoryReactions(row: any, myUserId?: string): CompletionStoryCard {
  const reactions: { user_id: string }[] = row.reactions ?? [];
  const { reactions: _drop, ...rest } = row;
  return {
    ...rest,
    // 🚀 RLS 가드: author(users) 임베드는 열람자가 작성자와 챌린지를 공유하지 않으면 null 이 된다.
    //   공개 완주 이야기를 모르는 사람이 보면 author=null → 렌더에서 'nickname of null' 크래시
    //   (홈 완주 리본·해냈어요 탭·완주 상세). 숨겨졌으면 '익명' 폴백으로 타입 불변식(author: DbUser) 회복.
    //   참고: reference_rls-users-join-undercount (비멤버는 users 조인을 못 읽음).
    //   (host_tier·early_tier 도 null 폴백 — 신원을 모르는 폴백에 링이 붙으면 안 된다)
    author: row.author ?? { id: row.user_id, email: null, nickname: '익명', avatar_url: null, created_at: row.created_at, host_tier: null, early_tier: null },
    // 🚀 RLS 가드(동일 계열): challenge(challenges) 임베드도 열람자가 방 멤버가 아니면 null 이 된다.
    //   (challenges SELECT = 멤버 전용). 비멤버가 공개 완주 이야기를 보면 challenge=null → 'title of null' 크래시.
    //   빈 제목 폴백으로 타입 불변식(challenge.title: string) 회복 — displayTitle('') 은 무해.
    challenge: row.challenge ?? { title: '', category: null },
    courage_count: reactions.length,
    couraged_by_me: myUserId ? reactions.some(r => r.user_id === myUserId) : false,
  } as CompletionStoryCard;
}

// 용기 받았어요 토글 — 사용자당 이야기당 1회 (본인 이야기는 RLS 가 거부)
export async function toggleStoryCourage(args: {
  storyId: string;
  userId: string;
  currentlyReacted: boolean;
}): Promise<void> {
  if (args.currentlyReacted) {
    const { error } = await supabase
      .from('completion_story_reactions')
      .delete()
      .eq('story_id', args.storyId)
      .eq('user_id', args.userId);
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from('completion_story_reactions')
      .insert({ story_id: args.storyId, user_id: args.userId });
    if (error) throw error;
  }
}

// 해냈어요 탭 dot — 가장 최근 공개 완주 이야기 작성 시각 (1건만)
export async function fetchLatestPublicStoryAt(): Promise<string | null> {
  const { data, error } = await supabase
    .from('completion_stories')
    .select('created_at')
    .eq('visibility', 'public')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data?.created_at ?? null;
}

// 상세 — id 로 한 건 (RLS 가 공개/인연/본인 분기)
export async function fetchCompletionStory(id: string, myUserId?: string): Promise<CompletionStoryCard | null> {
  const { data, error } = await supabase
    .from('completion_stories')
    .select(`
      *,
      author:user_id (id, email, nickname, avatar_url, created_at, host_tier, early_tier),
      challenge:challenge_id (
        title,
        category:category_id (emoji, name)
      ),
      reactions:completion_story_reactions (user_id)
    `)
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return mapStoryReactions(data, myUserId);
}

// 박제 탭에서 "이미 작성?" 체크용 — 본인 + 챌린지 한 건
export async function fetchMyCompletionStoryForChallenge(args: {
  challengeId: string;
  userId: string;
}): Promise<DbCompletionStory | null> {
  const { data, error } = await supabase
    .from('completion_stories')
    .select('*')
    .eq('challenge_id', args.challengeId)
    .eq('user_id', args.userId)
    .maybeSingle();
  if (error) throw error;
  return (data ?? null) as DbCompletionStory | null;
}

// 사용자 옵션·사진·공개범위만 수정 (시스템 통계는 트리거가 보호)
export async function updateCompletionStory(args: {
  id: string;
  story?: string | null;
  hardest?: string | null;
  helpedWhenGivingUp?: string | null;
  adviceToStarters?: string | null;
  ownTip?: string | null;
  whatChanged?: string | null;
  photoUrls?: string[];
  visibility?: StoryVisibility;
}): Promise<void> {
  const patch: Record<string, unknown> = {};
  if (args.story !== undefined)              patch.story = args.story;
  if (args.hardest !== undefined)            patch.hardest = args.hardest;
  if (args.helpedWhenGivingUp !== undefined) patch.helped_when_giving_up = args.helpedWhenGivingUp;
  if (args.adviceToStarters !== undefined)   patch.advice_to_starters = args.adviceToStarters;
  if (args.ownTip !== undefined)             patch.own_tip = args.ownTip;
  if (args.whatChanged !== undefined)        patch.what_changed = args.whatChanged;
  if (args.photoUrls !== undefined)          patch.photo_urls = args.photoUrls;
  if (args.visibility !== undefined)         patch.visibility = args.visibility;
  if (Object.keys(patch).length === 0) return;
  // 🚀 3a 검수 — 수정되는 자유 서술 텍스트
  const moderationText =
    [args.story, args.hardest, args.helpedWhenGivingUp, args.adviceToStarters, args.ownTip, args.whatChanged]
      .filter(Boolean).join('\n');
  // 🚀 검수 (v2.19: block→차단, flag·allow→통과·미숨김). hidden 은 patch 에 넣지 않는다 — 서버만 정한다
  if (moderationText) await moderateUgcText(moderationText);
  const { error } = await supabase
    .from('completion_stories')
    .update(patch)
    .eq('id', args.id);
  if (error) throw error;
}

export async function deleteCompletionStory(id: string): Promise<void> {
  const { error } = await supabase
    .from('completion_stories')
    .delete()
    .eq('id', id);
  if (error) throw error;
}

// 🚀 다짐(무현금 사회적 스테이크) — 0046. 결제·도박 무관, 명예제도.
// direction = settlement 트리거: lose=실패 시(완주/달성 못하면) / win=성공 시(완주/달성하면).
// 문구(content)는 자유 입력 — "다 채우지 못하면 ~하기" 처럼 표현은 사용자 몫, 타이밍만 이 이진값.
export type PledgeDirection = 'lose' | 'win';
export interface MyPledge {
  id: string;
  direction: PledgeDirection;
  content: string;
  fulfilled: boolean;
  created_at: string;
}

// 이 방의 모든 다짐 (같은 방 멤버 조회 — RLS is_viewer_of). 본인/동료 분리는 호출부에서.
export interface ChallengePledge extends MyPledge {
  user_id: string;
}
export async function fetchChallengePledges(challengeId: string): Promise<ChallengePledge[]> {
  const { data, error } = await supabase
    .from('pledges')
    .select('id, user_id, direction, content, fulfilled, created_at')
    .eq('challenge_id', challengeId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as ChallengePledge[];
}

// 🚀 다짐 배지 — 내가 속한 방 중 (내가 볼 수 있는) 다짐이 하나라도 걸린 challenge_id 집합.
//    홈 '오늘 나의 하다' 카드 '💛 다짐' 배지용. RLS is_viewer_of 라 내 방으로 자연 제한.
//    차단(양방향) 사용자의 다짐은 제외 — 홈 노출 범위가 방보다 넓어지므로 fellow proof 와 동일 기준.
export async function fetchChallengeIdsWithPledges(challengeIds: string[]): Promise<Set<string>> {
  if (!challengeIds.length) return new Set();
  const { data, error } = await supabase
    .from('pledges')
    .select('challenge_id, user_id')
    .in('challenge_id', challengeIds);
  if (error) throw error;
  const blocked = await fetchBlockedUserIds();
  const set = new Set<string>();
  for (const p of (data ?? []) as any[]) {
    if (blocked.has(p.user_id)) continue;
    set.add(p.challenge_id);
  }
  return set;
}

// 다짐 검수 — moderate-text(pledge 모드). 금액 표기·고가·신체/성적·강요 차단 (생성 전 동기 게이트).
export async function moderatePledge(
  content: string,
): Promise<{ verdict: 'allow' | 'block'; reason: string | null }> {
  const { data, error } = await supabase.functions.invoke<{
    verdict: 'allow' | 'block'; reason: string | null; category: string | null;
  }>('moderate-text', { body: { mode: 'pledge', content } });
  if (error) {
    throw new Error('검수 시스템 통신에 실패했어요. 네트워크 연결을 확인하고 다시 시도해주세요.');
  }
  if (!data) return { verdict: 'block', reason: '검수에 실패했어요. 잠시 후 다시 시도해주세요.' };
  return { verdict: data.verdict, reason: data.reason };
}

// 다짐 걸기 — 같은 방향이 이미 있으면 unique 충돌(방향당 1개). 검수 통과는 호출부가 책임.
export async function createPledge(args: {
  challengeId: string; userId: string; direction: PledgeDirection; content: string;
}): Promise<void> {
  const content = args.content.trim();
  if (!content) throw new Error('다짐 내용을 입력해주세요.');
  if (content.length > 200) throw new Error('다짐은 200자 이내로 적어주세요.');
  const { error } = await supabase.from('pledges').insert({
    challenge_id: args.challengeId,
    user_id: args.userId,
    direction: args.direction,
    content,
  });
  if (error) {
    if ((error as { code?: string }).code === '23505') {
      throw new Error('이미 이 조건의 다짐을 걸어두었어요.');
    }
    throw error;
  }
}

// "지켰어요" 토글 — 명예제도 자가 체크 (RLS: 본인·활성 멤버만)
export async function togglePledgeFulfilled(pledgeId: string, fulfilled: boolean): Promise<void> {
  const { error } = await supabase.from('pledges').update({ fulfilled }).eq('id', pledgeId);
  if (error) throw error;
}

// 다짐 거두기 (마음 바뀌면) — 본인 것만
export async function deletePledge(pledgeId: string): Promise<void> {
  const { error } = await supabase.from('pledges').delete().eq('id', pledgeId);
  if (error) throw error;
}

// 🚀 내 다짐 내역 (내정보 → 💛 다짐 내역) — 하다별로 묶고 상태(진행중/완주/못채운)까지 산출.
//   완주 판정은 방 화면과 같은 단일 소스(stats.goalStatus) 재사용 — KST·frequency·늦합류 비례 일관.
export type MyPledgeStatus = 'active' | 'completed' | 'missed';   // 진행 중 / 완주 / 못 채운(미완주·포기)
export interface MyPledgeChallenge {
  challengeId: string;
  title: string;
  kind: ChallengeKind;
  startDate: string;
  endDate: string;
  status: MyPledgeStatus;
  daysLeft: number;        // active 일 때 D-N
  pledges: {
    id: string;
    direction: PledgeDirection;
    content: string;
    fulfilled: boolean;
    isDue: boolean;        // 결과×방향으로 '지킬 차례'인지 (active 면 false)
  }[];
}

export async function fetchMyPledges(userId: string): Promise<MyPledgeChallenge[]> {
  if (!userId) return [];

  // 1. 내 다짐 전부
  const { data: pledgeRows, error: pErr } = await supabase
    .from('pledges')
    .select('id, challenge_id, direction, content, fulfilled, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });
  if (pErr) throw pErr;
  const pledges = (pledgeRows ?? []) as {
    id: string; challenge_id: string; direction: PledgeDirection; content: string; fulfilled: boolean;
  }[];
  if (!pledges.length) return [];
  const challengeIds = Array.from(new Set(pledges.map(p => p.challenge_id)));

  // 2. 해당 하다 정보 (완주 판정용 컬럼 포함)
  const { data: chRows, error: cErr } = await supabase
    .from('challenges')
    .select('id, title, kind, goal_type, frequency, target_count, start_date, end_date, created_at, gave_up_at')
    .in('id', challengeIds);
  if (cErr) throw cErr;
  const chMap = new Map<string, any>();
  for (const c of (chRows ?? []) as any[]) chMap.set(c.id, c);

  // 3. 내 인증(완주 판정 분자) + 4. 내 멤버십(합류일=늦합류 비례, 포기 여부)
  const [proofRes, memRes] = await Promise.all([
    supabase.from('proofs').select('challenge_id, created_at, local_date').eq('user_id', userId).in('challenge_id', challengeIds),
    supabase.from('challenge_members').select('challenge_id, joined_at, gave_up_at').eq('user_id', userId).in('challenge_id', challengeIds),
  ]);
  const proofMap = new Map<string, { created_at: string; local_date?: string }[]>();
  for (const p of (proofRes.data ?? []) as any[]) {
    const arr = proofMap.get(p.challenge_id) ?? [];
    arr.push({ created_at: p.created_at, local_date: p.local_date });   // 날짜 판정은 local_date(0077)
    proofMap.set(p.challenge_id, arr);
  }
  const memMap = new Map<string, { joined_at: string | null; gave_up_at: string | null }>();
  for (const m of (memRes.data ?? []) as any[]) {
    memMap.set(m.challenge_id, { joined_at: m.joined_at ?? null, gave_up_at: m.gave_up_at ?? null });
  }

  const todayStr = getTodayRange().dateStr;
  const result: MyPledgeChallenge[] = [];
  for (const cid of challengeIds) {
    const c = chMap.get(cid);
    if (!c) continue;   // RLS 등으로 못 읽으면 스킵 (방어)
    const myProofs = proofMap.get(cid) ?? [];
    const mem = memMap.get(cid);
    const joinedAt = mem?.joined_at ?? null;
    const gaveUp = !!mem?.gave_up_at;

    const ch: DbChallenge = {
      id: c.id, creator_id: '', title: c.title, description: null,
      kind: (c.kind ?? 'closed') as ChallengeKind,
      start_date: c.start_date, end_date: c.end_date, created_at: c.created_at,
      frequency: (c.frequency ?? 'daily') as ChallengeFrequency,
      goal_type: (c.goal_type ?? 'cadence') as ChallengeGoalType,
      target_count: c.target_count ?? null,
      gave_up_at: c.gave_up_at ?? null,
    };
    const { isComplete } = goalStatus(ch, myProofs as any, joinedAt);
    const finished = isFinished(ch);
    // count 유형은 종료 전에도 조기 완주 인정(goalStatus) → isComplete 우선. 포기/종료 미달은 못 채운.
    const status: MyPledgeStatus = isComplete ? 'completed' : (gaveUp || finished) ? 'missed' : 'active';

    const end = new Date(c.end_date + 'T00:00:00');
    const today = new Date(todayStr + 'T00:00:00');
    const daysLeft = Math.max(0, Math.round((end.getTime() - today.getTime()) / 86_400_000));

    const myPledges = pledges.filter(p => p.challenge_id === cid).map(p => ({
      id: p.id,
      direction: p.direction,
      content: p.content,
      fulfilled: p.fulfilled,
      // 지킬 차례: 해내면(win)=완주 시 / 못 하면(lose)=못 채운 시. 진행 중이면 아직 아님.
      isDue: status === 'completed' ? p.direction === 'win'
        : status === 'missed' ? p.direction === 'lose'
        : false,
    }));

    result.push({
      challengeId: cid,
      title: c.title,
      kind: (c.kind ?? 'closed') as ChallengeKind,
      startDate: c.start_date,
      endDate: c.end_date,
      status,
      daysLeft,
      pledges: myPledges,
    });
  }
  return result;
}

// 🚀 3b 신고·차단 (UGC) — 0047. 애플/구글 UGC 필수.
export type ReportTargetType = 'proof' | 'comment' | 'log_comment' | 'log' | 'story' | 'chat';
export type ReportReason = 'spam' | 'abuse' | 'sexual' | 'violence' | 'impersonation' | 'other';

// 신고 — 같은 대상 중복은 unique 거부(친절 메시지). 누적 3건 → 서버 트리거(0047)가 자동숨김.
export async function createReport(args: {
  reporterId: string;
  targetType: ReportTargetType;
  targetId: string;
  reason: ReportReason;
  detail?: string;
}): Promise<void> {
  const { error } = await supabase.from('reports').insert({
    reporter_id: args.reporterId,
    target_type: args.targetType,
    target_id: args.targetId,
    reason: args.reason,
    detail: args.detail?.trim() || null,
  });
  if (error) {
    if ((error as { code?: string }).code === '23505') throw new Error('이미 신고한 콘텐츠예요.');
    throw error;
  }
}

// 차단 — 본인 outgoing. 양방향 숨김은 blocked_user_ids() + 클라 필터.
export async function blockUser(blockerId: string, blockedId: string): Promise<void> {
  if (blockerId === blockedId) throw new Error('자기 자신은 차단할 수 없어요.');
  const { error } = await supabase.from('blocks').insert({ blocker_id: blockerId, blocked_id: blockedId });
  if (error && (error as { code?: string }).code !== '23505') throw error;   // 중복 차단은 조용히 무시
}

export async function unblockUser(blockerId: string, blockedId: string): Promise<void> {
  const { error } = await supabase
    .from('blocks').delete()
    .eq('blocker_id', blockerId).eq('blocked_id', blockedId);
  if (error) throw error;
}

// 양방향 차단 id (내가 차단 + 나를 차단) — 클라 필터용 Set. 방향은 RPC 가 숨김.
export async function fetchBlockedUserIds(): Promise<Set<string>> {
  const { data, error } = await supabase.rpc('blocked_user_ids');
  if (error) throw error;
  const rows = (data ?? []) as (string | { blocked_user_ids: string })[];
  return new Set(rows.map(r => (typeof r === 'string' ? r : r.blocked_user_ids)));
}

// ─── W2: 하루의 리듬(아침 다짐·저녁 회고) + 지금 함께(presence) — 0056 ───────────────
// 아침 다짐(intention) / 저녁 회고(reflection). 전역 노트(challenge_id 항상 null).
// note_date 는 서버가 KST 로 결정 → 클라는 날짜를 넘기지 않는다(하루 경계 일관).
export type DailyNoteKind = 'intention' | 'reflection';
export type DailyNoteVisibility = 'fellow' | 'private';

export type DailyNote = {
  id: string;
  user_id: string;
  challenge_id: string | null;
  kind: DailyNoteKind;
  content: string;
  note_date: string;
  visibility: DailyNoteVisibility;
  created_at: string;
};

// 동료의 오늘 회고(홈 목격 피드용) — 작성자 표시용 최소 정보만.
export type FellowReflection = {
  id: string;
  content: string;
  created_at: string;
  user_id: string;
  nickname: string;
  avatar_url: string | null;
  host_tier?: string | null;   // 🚀 0064: 작성자 계층 — 아바타 금빛 링
  early_tier?: string | null;  // 🚀 0066: 작성자 창립 티어 — 아바타 오렌지 링
};

// 🚀 오늘(KST) 다짐/회고 작성 — 1인 1일 kind별 1개(upsert 덮어쓰기).
//   UGC 검수(block→차단)는 다른 작성 함수와 동일하게 재사용. note_date 는 서버 KST 기본값에 맡긴다.
export async function createDailyNote(args: {
  userId: string;
  kind: DailyNoteKind;
  content: string;
  visibility?: DailyNoteVisibility;
}): Promise<void> {
  const trimmed = args.content.trim();
  if (!trimmed) throw new Error('내용을 입력해주세요.');
  if (trimmed.length > 200) throw new Error('200자 이내로 적어주세요.');
  await moderateUgcText(trimmed);   // 🚀 검수 (block→차단, flag·allow→통과·미숨김 — v2.19)
  const { error } = await supabase.from('daily_notes').upsert(
    {
      user_id: args.userId,
      kind: args.kind,
      content: trimmed,
      visibility: args.visibility ?? 'fellow',
      // note_date 미포함 — 서버 기본값(KST 오늘)이 채우고, 같은 날 재작성은 onConflict 로 덮어쓴다.
    },
    { onConflict: 'user_id,kind,note_date' },
  );
  if (error) throw error;
}

// 🚀 오늘(KST) 내 해당 kind 노트 1개 or null — 프롬프트가 이미 작성됐는지 판단용.
export async function fetchMyDailyNote(
  userId: string,
  kind: DailyNoteKind,
): Promise<DailyNote | null> {
  const { dateStr } = getTodayRange();   // 내 기준 시간대의 오늘 "YYYY-MM-DD"
  const { data, error } = await supabase
    .from('daily_notes')
    .select('id, user_id, challenge_id, kind, content, note_date, visibility, created_at')
    .eq('user_id', userId)
    .eq('kind', kind)
    .eq('note_date', dateStr)
    .maybeSingle();
  if (error) throw error;
  return (data as DailyNote) ?? null;
}

// 🚀 동료들의 오늘(KST) 회고 — 목격받기 피드. RLS 가 가시성(fellow + 하다 공유) 보장.
//   차단(양방향) 사용자는 제외 — 모든 동료 피드 공통 안전 규칙.
export async function fetchFellowReflections(limit = 20): Promise<FellowReflection[]> {
  const { dateStr } = getTodayRange();
  const { data, error } = await supabase
    .from('daily_notes')
    .select(`
      id, content, created_at, user_id,
      users:user_id(nickname, avatar_url, host_tier, early_tier)
    `)
    .eq('kind', 'reflection')
    .eq('visibility', 'fellow')
    .eq('note_date', dateStr)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  const blocked = await fetchBlockedUserIds();   // 🚀 차단(양방향) 제외
  return (data ?? [])
    .filter((n: any) => !blocked.has(n.user_id))
    .map((n: any) => ({
      id: n.id,
      content: n.content,
      created_at: n.created_at,
      user_id: n.user_id,
      nickname: n.users?.nickname ?? '',   // 작성자 임베드 null 폴백 가드
      avatar_url: n.users?.avatar_url ?? null,
      host_tier: n.users?.host_tier ?? null,
      early_tier: n.users?.early_tier ?? null,
    }));
}

// 🚀 지금 함께 — 최근 30분 내 활동한 동료 수(본인 제외, 신원 없음). 홈 상단 앰비언트 라인.
export async function fetchPresenceNow(): Promise<number> {
  const { data, error } = await supabase.rpc('presence_now');
  if (error) throw error;
  return (data as number | null) ?? 0;
}

// ─── 운영자(Admin) 콘솔 Step A1 (0059) ────────────────────────────────
// 🔒 모든 admin RPC 는 서버(DB)에서 is_admin() 게이트로 강제된다. 아래 클라 래퍼는 UX 노출용일 뿐 —
//    비-admin 이 호출하면 RPC 가 'admin only' exception 을 던져 throw 로 전파된다(화면 처리).
//    ReportTargetType 은 위 3b 신고·차단 정의를 재사용.
export type AdminReport = {
  report_id: string;
  target_type: ReportTargetType;
  target_id: string;
  reason: string;
  detail: string | null;
  created_at: string;
  reporter_nickname: string | null;
  author_nickname: string | null;
  preview: string | null;
  is_hidden: boolean;
};

export type AdminHiddenItem = {
  target_type: ReportTargetType;
  target_id: string;
  preview: string | null;
  author_nickname: string | null;
  created_at: string;
};

export type AdminChallengeSearchResult = {
  id: string;
  title: string;
  kind: ChallengeKind;
  host_tier: string;
  host_label: string | null;
  recruit_cap_exempt: boolean;   // 🚀 0064: 모집 캡 면제 (이 하다를 1,000명까지 키울지)
  created_at: string;
};

// 현재 로그인 사용자가 운영자인지. admin 진입점 노출 판단용(권한 강제는 서버).
export async function fetchIsAdmin(): Promise<boolean> {
  const { data, error } = await supabase.rpc('is_admin');
  if (error) throw error;
  return (data as boolean | null) ?? false;
}

// pending 신고 큐 (미리보기·작성자·현재 hidden 포함, 최신순).
export async function adminListReports(): Promise<AdminReport[]> {
  const { data, error } = await supabase.rpc('admin_list_reports');
  if (error) throw error;
  return (data ?? []) as AdminReport[];
}

// 대상 콘텐츠 숨김/복구 (숨김=true, 복구=false).
export async function adminSetContentHidden(
  targetType: ReportTargetType,
  targetId: string,
  hidden: boolean,
): Promise<void> {
  const { error } = await supabase.rpc('admin_set_content_hidden', {
    p_target_type: targetType,
    p_target_id: targetId,
    p_hidden: hidden,
  });
  if (error) throw error;
}

// 신고 처리 (검토완료 reviewed / 무시 dismissed).
export async function adminResolveReport(reportId: string, status: 'reviewed' | 'dismissed'): Promise<void> {
  const { error } = await supabase.rpc('admin_resolve_report', { p_report_id: reportId, p_status: status });
  if (error) throw error;
}

// 숨김된 콘텐츠 전체 (오판 복구용, 6종 union, 최신순).
export async function adminListHidden(): Promise<AdminHiddenItem[]> {
  const { data, error } = await supabase.rpc('admin_list_hidden');
  if (error) throw error;
  return (data ?? []) as AdminHiddenItem[];
}

// 명사/조직 무대 지정 (host_tier: individual/figure/org, host_label: 표시용 주최자명).
export async function adminSetHostTier(
  challengeId: string,
  tier: 'individual' | 'figure' | 'org',
  label: string | null,
): Promise<void> {
  const { error } = await supabase.rpc('admin_set_host_tier', {
    p_challenge_id: challengeId,
    p_tier: tier,
    p_label: label,
  });
  if (error) throw error;
}

// 🚀 0075: 완주 매칭 기부 약정 설정/해제 — 조직(org) 하다만 (서버가 거부).
//   앱은 약정과 완주 수를 표시만 한다. 송금은 조직이 오프라인으로 직접 — gift_orders 를 타지 않는다.
//   amount=null 이면 약정 해제(기부처도 함께 지워짐).
export async function adminSetSponsorMatching(
  challengeId: string,
  amount: number | null,
  beneficiary: string | null,
): Promise<void> {
  const { error } = await supabase.rpc('admin_set_sponsor_matching', {
    p_challenge_id: challengeId,
    p_amount: amount,
    p_beneficiary: beneficiary,
  });
  if (error) throw error;
}

// 🚀 0064: 모집 캡 면제 부여/해제 — 누구나(open) 하다만.
//   면제된 하다는 기간 50% 자동 마감을 받지 않고 계속 자란다. 승격은 별개 — 0067 심사(adminReviewPromotion).
export async function adminSetRecruitExempt(challengeId: string, exempt: boolean): Promise<void> {
  const { error } = await supabase.rpc('admin_set_recruit_exempt', {
    p_challenge_id: challengeId,
    p_exempt: exempt,
  });
  if (error) throw error;
}

// host_tier 지정 대상 하다 검색 (title ilike, ≤30).
export async function adminSearchChallenges(q: string): Promise<AdminChallengeSearchResult[]> {
  const { data, error } = await supabase.rpc('admin_search_challenges', { p_q: q });
  if (error) throw error;
  return (data ?? []) as AdminChallengeSearchResult[];
}

// 🚀 0065: 성장 중인 누구나 하다 (0067 에서 조건·페이지네이션 개편).
export type AdminGrowingChallenge = AdminChallengeSearchResult & {
  member_count: number;   // 누적 참여 (포기 포함 — 0067 승격 임계와 같은 기준)
};

// 🚀 0067: 면제 후보 — 아직 모집 중 + 미면제 + 누적 100명 이상 (누적 desc). 면제를 줄지 판단하는 목록.
export async function adminListGrowingChallenges(limit = 10, offset = 0): Promise<AdminGrowingChallenge[]> {
  const { data, error } = await supabase.rpc('admin_list_growing_challenges', { p_limit: limit, p_offset: offset });
  if (error) throw error;
  return (data ?? []) as AdminGrowingChallenge[];
}

// 🚀 0067: 이미 면제된 누구나 하다 — 면제를 주면 후보 목록에서 사라져 다시 찾을 길이 없다. 모니터링·해제용.
export async function adminListExemptChallenges(limit = 10, offset = 0): Promise<AdminGrowingChallenge[]> {
  const { data, error } = await supabase.rpc('admin_list_exempt_challenges', { p_limit: limit, p_offset: offset });
  if (error) throw error;
  return (data ?? []) as AdminGrowingChallenge[];
}

// 🚀 0067: 승격 심사 큐 — 1,000명을 넘은 누구나 하다 (개설자가 아직 individual 인 것만).
//   ⚠️ 면제 여부는 조건이 아니라 표시일 뿐 — 면제 없이 바이럴로 자란 하다도 심사 대상이다.
export type AdminPromotionCandidate = {
  id: string;
  title: string;
  creator_id: string;
  creator_nickname: string | null;
  member_count: number;          // 누적 참여 (라이브 — 심사 대기 중에도 계속 는다)
  recruit_cap_exempt: boolean;
  created_at: string;
};

export async function adminListPromotionQueue(limit = 10, offset = 0): Promise<AdminPromotionCandidate[]> {
  const { data, error } = await supabase.rpc('admin_list_promotion_queue', { p_limit: limit, p_offset: offset });
  if (error) throw error;
  return (data ?? []) as AdminPromotionCandidate[];
}

// 🚀 0067: 심사 액션 — 승인(개설자 유명인 승격 + 알림) / 보류(큐에서 제외). 승인은 되돌릴 수 없다.
export async function adminReviewPromotion(challengeId: string, approve: boolean): Promise<void> {
  const { error } = await supabase.rpc('admin_review_promotion', {
    p_challenge_id: challengeId,
    p_approve: approve,
  });
  if (error) throw error;
}
