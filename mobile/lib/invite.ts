// 🚀 초대 처리 — 카톡으로 받은 dohada://invite/<id> 링크 흐름
//
// 흐름:
//   미로그인 → setPendingInvite 로 SecureStore 저장 → /login → 로그인 후 getPendingInvite → /invite/<id>
//   로그인  → joinChallenge → /room/<id>
import * as SecureStore from 'expo-secure-store';
import { supabase } from './supabase';

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

// 챌린지 가입. 이미 멤버면 무시 (unique 위반).
export async function joinChallenge(challengeId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from('challenge_members')
    .insert({ challenge_id: challengeId, user_id: userId });

  if (error) {
    // 23505 = unique_violation: 이미 멤버 → noop
    if ((error as { code?: string }).code === '23505') return;
    throw error;
  }
}
