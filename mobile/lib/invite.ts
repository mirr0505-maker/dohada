// 🚀 초대 처리 — 카톡으로 받은 dohada://invite/<id> 링크 흐름
//
// 흐름:
//   미로그인 → setPendingInvite 로 SecureStore 저장 → /login → 로그인 후 getPendingInvite → /invite/<id>
//   로그인  → joinChallenge → /room/<id>
import * as SecureStore from 'expo-secure-store';
import { supabase } from './supabase';
import { getKstTodayRange } from './format';
import { isRecruiting } from './stats';   // 🚀 0043: 누구나 방 모집 마감 시 신규 합류 차단

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

// 이미 이 챌린지의 멤버인가 — 종료/마감 방이라도 박제 열람(재진입)은 허용하므로 분기 판단에 쓴다.
async function isExistingMember(challengeId: string, userId: string): Promise<boolean> {
  const { data } = await supabase
    .from('challenge_members')
    .select('user_id')
    .eq('challenge_id', challengeId)
    .eq('user_id', userId)
    .maybeSingle();
  return data != null;
}

export async function joinChallenge(challengeId: string, userId: string): Promise<JoinResult> {
  // 🚀 합류 전 게이트 정보를 보안definer RPC(get_invite_info)로 얻는다.
  //    비멤버는 RLS(challenges_member_read = is_member_of)로 closed/cheered 방의 challenges 행을
  //    직접 SELECT 하지 못한다 → 예전엔 초대받은 사람이 "하다를 찾을 수 없어요"로 전면 차단됐다.
  //    get_invite_info 는 anon/authenticated 누구나 호출 가능하고, 없는 방·solo·포기 방은 error 로 거부한다.
  //    (supabase.rpc 는 Postgres 예외를 throw 하지 않고 { error } 로 돌려준다.)
  const { data: info, error: infoErr } = await supabase.rpc('get_invite_info', { p_challenge_id: challengeId });
  if (infoErr || !info) {
    // RPC 가 거부(포기/solo/없음)했어도 이미 멤버라면 방(박제) 진입은 허용.
    if (await isExistingMember(challengeId, userId)) return 'already_member';
    throw infoErr ?? new Error('하다를 찾을 수 없어요.');
  }
  const ch = info as { kind: string; start_date: string; end_date: string; bet_tier: string | null };

  // 🚀 종료(시간 경과) 방 신규 합류 차단 — 포기 방은 위 RPC 가 이미 예외로 막음.
  //    단, 이미 멤버라면 방(박제) 진입은 허용.
  const isOver = getKstTodayRange().kstDateStr > ch.end_date;
  if (isOver) {
    if (await isExistingMember(challengeId, userId)) return 'already_member';
    throw new Error('이미 종료된 하다예요.\n새로 합류할 수 없어요.');
  }

  // 🚀 0043: 누구나(open) 방 모집 마감 시 신규 합류 차단.
  //    recruit_locked(개설자 수동 잠금)은 RPC 가 주지 않아 여기선 기간 50% 경과만 막고,
  //    수동 잠금은 서버 RLS(members_self_insert)가 INSERT 단에서 최종 차단한다(이중 가드).
  if (!isRecruiting({ kind: ch.kind, start_date: ch.start_date, end_date: ch.end_date })) {
    if (await isExistingMember(challengeId, userId)) return 'already_member';
    throw new Error('모집이 마감된 하다예요.\n이미 시작돼 멤버들끼리 진행 중이에요.');
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
