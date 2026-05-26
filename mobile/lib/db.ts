// 🚀 Supabase 자주 쓰는 쿼리 helpers
// RLS 가 알아서 가드해주니까 여기선 단순 fetch/insert/delete.
import { supabase } from './supabase';
import type {
  ChallengeWithCount, ChallengeKind, MemberWithToday, ProofWithRelations, DbChallenge,
} from './types';

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
      .select('*, users:user_id(*), cheers(user_id)')
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

  const proofs: ProofWithRelations[] = proofsRaw.map((p: any) => ({
    id: p.id,
    challenge_id: p.challenge_id,
    user_id: p.user_id,
    photo_url: p.photo_url,
    caption: p.caption,
    created_at: p.created_at,
    author: p.users,
    cheer_count: p.cheers?.length ?? 0,
    cheered_by_me: p.cheers?.some((c: any) => c.user_id === myUserId) ?? false,
  }));

  return { challenge: resChallenge.data as DbChallenge, members, proofs };
}

// ─── 챌린지 만들기 (create) ────────────────────────────
// trigger 가 자동으로 creator 를 challenge_members 에 넣음.
export async function createChallenge(args: {
  userId: string;
  title: string;
  description?: string;
  durationDays: number;
  kind: ChallengeKind;
}): Promise<DbChallenge> {
  const today = new Date();
  const end = new Date();
  end.setDate(end.getDate() + args.durationDays - 1);

  const { data, error } = await supabase
    .from('challenges')
    .insert({
      creator_id: args.userId,
      title: args.title.trim(),
      description: args.description?.trim() || null,
      kind: args.kind,
      start_date: today.toISOString().slice(0, 10),
      end_date: end.toISOString().slice(0, 10),
    })
    .select()
    .single();

  if (error) throw error;
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

// ─── 응원 토글 (room 의 ❤) ─────────────────────────────
// cheers 테이블의 unique(proof_id, user_id) 제약 활용.
export async function toggleCheer(args: {
  proofId: string;
  userId: string;
  currentlyCheered: boolean;
}): Promise<void> {
  if (args.currentlyCheered) {
    const { error } = await supabase
      .from('cheers')
      .delete()
      .match({ proof_id: args.proofId, user_id: args.userId });
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from('cheers')
      .insert({ proof_id: args.proofId, user_id: args.userId });
    if (error) throw error;
  }
}
