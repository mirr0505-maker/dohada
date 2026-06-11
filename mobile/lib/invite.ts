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
    .select('end_date, gave_up_at')
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
