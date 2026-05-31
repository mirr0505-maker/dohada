// 🚀 Supabase 자주 쓰는 쿼리 helpers
// RLS 가 알아서 가드해주니까 여기선 단순 fetch/insert/delete.
import { supabase } from './supabase';
import type {
  ChallengeWithCount, ChallengeKind, MemberWithToday, ProofWithRelations, DbChallenge,
  CommentWithAuthor, CheerType,
} from './types';

// ─── 동료들의 최근 인증 (홈 cross-section) ───────────────────────────────
// 내가 참여 중인 모든 챌린지의 최근 인증 (본인 제외).
// RLS 가 알아서 멤버인 챌린지로 한정. open 챌린지 인증은 비멤버도 볼 수 있지만
// 여기선 user_id != me 만 적용 → 결과는 "내가 멤버인 챌린지의 동료 N명 인증".
export type FellowProof = {
  id: string;
  photo_url: string;
  caption: string | null;
  created_at: string;
  challenge_id: string;
  challenge_title: string;
  user_id: string;
  nickname: string;
  avatar_url: string | null;
};

export async function fetchFellowProofs(myUserId: string, limit = 10): Promise<FellowProof[]> {
  const { data, error } = await supabase
    .from('proofs')
    .select(`
      id, photo_url, caption, created_at, challenge_id, user_id,
      users (nickname, avatar_url),
      challenges (title)
    `)
    .neq('user_id', myUserId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map((p: any) => ({
    id: p.id,
    photo_url: p.photo_url,
    caption: p.caption,
    created_at: p.created_at,
    challenge_id: p.challenge_id,
    challenge_title: p.challenges?.title ?? '',
    user_id: p.user_id,
    nickname: p.users?.nickname ?? '',
    avatar_url: p.users?.avatar_url ?? null,
  }));
}

// ─── 내 챌린지 목록 (홈) ───────────────────────────────
// RLS 가 멤버인 챌린지만 보여줌. challenge_members(count) 로 멤버 수 같이.
export async function fetchMyChallenges(): Promise<ChallengeWithCount[]> {
  const { data, error } = await supabase
    .from('challenges')
    .select('*, challenge_members(count)')
    .order('created_at', { ascending: false });

  if (error) throw error;

  return (data ?? []).map((c: any) => ({
    id: c.id,
    creator_id: c.creator_id,
    title: c.title,
    description: c.description,
    kind: (c.kind ?? 'closed') as ChallengeKind,
    start_date: c.start_date,
    end_date: c.end_date,
    created_at: c.created_at,
    member_count: c.challenge_members?.[0]?.count ?? 0,
  }));
}

// ─── 둘러보기 — 공개(open) 챌린지 목록 ──────────────────
// RLS 가 kind='open' 만 보여줌. 멤버 여부 무관.
export async function fetchOpenChallenges(): Promise<ChallengeWithCount[]> {
  const { data, error } = await supabase
    .from('challenges')
    .select('*, challenge_members(count)')
    .eq('kind', 'open')
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) throw error;

  return (data ?? []).map((c: any) => ({
    id: c.id,
    creator_id: c.creator_id,
    title: c.title,
    description: c.description,
    kind: 'open' as ChallengeKind,
    start_date: c.start_date,
    end_date: c.end_date,
    created_at: c.created_at,
    member_count: c.challenge_members?.[0]?.count ?? 0,
  }));
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

// ─── 챌린지 방 기록 탭 (logs / log_likes) — Vlog 형태 ─
export type LogWithAuthor = {
  id: string;
  challenge_id: string;
  user_id: string;
  title: string;
  content: string;
  photo_url: string | null;
  created_at: string;
  author: { id: string; nickname: string; avatar_url: string | null };
  like_count: number;
  liked_by_me: boolean;
};

export async function fetchLogs(challengeId: string, myUserId: string, limit = 30): Promise<LogWithAuthor[]> {
  const { data, error } = await supabase
    .from('logs')
    .select(`
      id, challenge_id, user_id, title, content, photo_url, created_at,
      users:user_id(id, nickname, avatar_url),
      log_likes(user_id)
    `)
    .eq('challenge_id', challengeId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map((l: any) => {
    const likes: { user_id: string }[] = l.log_likes ?? [];
    return {
      id: l.id,
      challenge_id: l.challenge_id,
      user_id: l.user_id,
      title: l.title,
      content: l.content,
      photo_url: l.photo_url,
      created_at: l.created_at,
      author: {
        id: l.users?.id ?? l.user_id,
        nickname: l.users?.nickname ?? '',
        avatar_url: l.users?.avatar_url ?? null,
      },
      like_count: likes.length,
      liked_by_me: likes.some(x => x.user_id === myUserId),
    };
  });
}

export async function createLog(args: {
  challengeId: string;
  userId: string;
  title: string;
  content: string;
  photoUrl?: string | null;
}): Promise<void> {
  const title = args.title.trim();
  const content = args.content.trim();
  if (!title) throw new Error('제목을 입력해주세요.');
  if (title.length > 80) throw new Error('제목은 80자 이내로 적어주세요.');
  if (!content) throw new Error('내용을 입력해주세요.');
  if (content.length > 4000) throw new Error('내용은 4000자 이내로 적어주세요.');

  const { error } = await supabase.from('logs').insert({
    challenge_id: args.challengeId,
    user_id: args.userId,
    title,
    content,
    photo_url: args.photoUrl ?? null,
  });
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
  author: { id: string; nickname: string; avatar_url: string | null };
};

export async function fetchChatMessages(challengeId: string, limit = 100): Promise<ChatMessageWithAuthor[]> {
  const { data, error } = await supabase
    .from('chat_messages')
    .select('id, challenge_id, user_id, content, created_at, users:user_id(id, nickname, avatar_url)')
    .eq('challenge_id', challengeId)
    .order('created_at', { ascending: true })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map((m: any) => ({
    id: m.id,
    challenge_id: m.challenge_id,
    user_id: m.user_id,
    content: m.content,
    created_at: m.created_at,
    author: {
      id: m.users?.id ?? m.user_id,
      nickname: m.users?.nickname ?? '',
      avatar_url: m.users?.avatar_url ?? null,
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
  const { error } = await supabase.from('chat_messages').insert({
    challenge_id: args.challengeId,
    user_id: args.userId,
    content: trimmed,
  });
  if (error) throw error;
}

// ─── 챌린지 방 1개 + 멤버 + 인증 피드 (room/[id]) ──────
export async function fetchRoomData(challengeId: string, myUserId: string) {
  const [resChallenge, resMembers, resProofs] = await Promise.all([
    supabase.from('challenges').select('*').eq('id', challengeId).single(),
    supabase
      .from('challenge_members')
      .select('paused_until, users(*)')
      .eq('challenge_id', challengeId),
    supabase
      .from('proofs')
      .select('*, users:user_id(*), cheers(user_id, cheer_type), comments(count)')
      .eq('challenge_id', challengeId)
      .order('created_at', { ascending: false }),
  ]);

  if (resChallenge.error) throw resChallenge.error;
  if (resMembers.error) throw resMembers.error;
  if (resProofs.error) throw resProofs.error;

  const today = new Date().toISOString().slice(0, 10);
  const proofsRaw = resProofs.data ?? [];

  const members: MemberWithToday[] = (resMembers.data ?? [])
    .filter((m: any) => m.users)
    .map((m: any) => ({
      ...m.users,
      paused_until: m.paused_until ?? null,
      today_checked: proofsRaw.some(
        (p: any) => p.user_id === m.users.id && (p.created_at as string).startsWith(today),
      ),
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
      caption: p.caption,
      created_at: p.created_at,
      author: p.users,
      cheer_count: cheers.length,
      cheered_by_me: myCheers.length > 0,
      cheers_by_type: cheersByType,
      my_cheers: myCheers,
      comment_count: p.comments?.[0]?.count ?? 0,
    };
  });

  return { challenge: resChallenge.data as DbChallenge, members, proofs };
}

// ─── 챌린지 만들기 (create) ────────────────────────────
// create_challenge RPC (0007) — challenges + challenge_members 두 INSERT 를
// 원자적으로 처리 + RLS 우회. v2 컬럼 (카테고리/빈도) 추가됨.
// 신규 파라미터는 default 가 있으므로 안 보내도 동작.
export type CreateChallengeFrequency = 'daily' | 'weekly3' | 'weekly1';

export async function createChallenge(args: {
  userId: string;                   // 호환용 (실제로는 서버 auth.uid() 사용)
  title: string;
  description?: string;
  durationDays: number;
  kind: ChallengeKind;
  categoryId?: number | null;       // v2: 10 대분류 (없으면 null)
  subcategoryId?: number | null;    // v2: 소분류 (없으면 null)
  frequency?: CreateChallengeFrequency; // v2: 인증 빈도 (기본 daily)
}): Promise<DbChallenge> {
  const today = new Date();
  const end = new Date();
  end.setDate(end.getDate() + args.durationDays - 1);

  const { data, error } = await supabase.rpc('create_challenge', {
    p_title:          args.title.trim(),
    p_description:    args.description?.trim() || null,
    p_kind:           args.kind,
    p_start_date:     today.toISOString().slice(0, 10),
    p_end_date:       end.toISOString().slice(0, 10),
    p_category_id:    args.categoryId    ?? null,
    p_subcategory_id: args.subcategoryId ?? null,
    p_frequency:      args.frequency     ?? 'daily',
    p_proof_type:     'photo',           // GPS/스크린샷은 Phase 2
  });

  if (error) throw error;
  if (!data) throw new Error('챌린지 생성 응답이 비어있어요.');
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

// ─── 인증 댓글 (proof 별) ──────────────────────────────
export async function fetchComments(proofId: string): Promise<CommentWithAuthor[]> {
  const { data, error } = await supabase
    .from('comments')
    .select('*, users:user_id(*)')
    .eq('proof_id', proofId)
    .order('created_at', { ascending: true });

  if (error) throw error;

  return (data ?? []).map((c: any) => ({
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
