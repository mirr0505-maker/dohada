// 🚀 초대 처리 — 카톡으로 받은 dohada://invite/<id> 링크 흐름
//
// 흐름:
//   미로그인 → setPendingInvite 로 SecureStore 저장 → /login → 로그인 후 getPendingInvite → /invite/<id>
//   로그인  → joinChallenge → /room/<id>
import * as SecureStore from 'expo-secure-store';
import { supabase } from './supabase';
import { getKstTodayRange } from './format';

const PENDING_KEY = 'pending_invite_id';

export async function setPendingInvite(challengeId: string) {
  await SecureStore.setItemAsync(PENDING_KEY, challengeId);
}

export async function getPendingInvite(): Promise<string | null> {
  return SecureStore.getItemAsync(PENDING_KEY);
}

export async function clearPendingInvite() {
  await SecureStore.deleteItemAsync(PENDING_KEY);
}

// 챌린지 가입 결과 — 신규 가입 / 이미 멤버 분기 (invite 화면에서 안내 메시지 분기용).
export type JoinResult = 'newly_joined' | 'already_member';

export async function joinChallenge(challengeId: string, userId: string): Promise<JoinResult> {
  // 🚀 종료/포기된 챌린지 신규 합류 차단 — 박제는 "함께 완주한 사람들"의 보존 공간.
  //    단, 이미 멤버라면 방(박제) 진입은 허용.
  const { data: ch, error: chErr } = await supabase
    .from('challenges')
    .select('end_date, gave_up_at, bet_tier')
    .eq('id', challengeId)
    .maybeSingle();
  if (chErr) throw chErr;
  if (!ch) throw new Error('챌린지를 찾을 수 없어요.');

  const isOver = ch.gave_up_at != null || getKstTodayRange().kstDateStr > ch.end_date;
  if (isOver) {
    const { data: mem } = await supabase
      .from('challenge_members')
      .select('user_id')
      .eq('challenge_id', challengeId)
      .eq('user_id', userId)
      .maybeSingle();
    if (mem) return 'already_member';
    throw new Error('이미 종료된 도전이에요.\n새로 합류할 수 없어요.');
  }

  // 🚀 내기 걸린 방(bet_tier != null)은 성인 본인인증된 사람만 합류 — 미성년/미인증 차단(처음부터)
  //    방을 성인으로만 채워 내기를 항상 유효하게. (real-money 전환 시 서버 RLS 로 격상 — 지금은 클라 게이트)
  if (ch.bet_tier) {
    const { data: isAdult } = await supabase.rpc('is_adult_verified', { p_user_id: userId });
    if (!isAdult) {
      throw new Error('adult_required');   // UI 가 이 코드를 받아 성인 인증 유도
    }
  }

  const { error } = await supabase
    .from('challenge_members')
    .insert({ challenge_id: challengeId, user_id: userId });

  if (error) {
    // 23505 = unique_violation: 이미 멤버
    if ((error as { code?: string }).code === '23505') return 'already_member';
    throw error;
  }
  return 'newly_joined';
}
