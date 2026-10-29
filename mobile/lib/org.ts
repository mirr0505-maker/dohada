// 🚀 조직 계정 — 가입 신청·상태 조회·운영자 승인 (0087, ORG_HADA_PLAN §10.2 묶음 A)
//
// 조직 계정(users.account_type='org')은 일반 5탭 대신 조직 전용 영역(app/org/)을 쓴다.
// 가입 = 조직 메일 코드 로그인(auth.ts requestOrgLoginCode/verifyOrgLoginCode) → submitOrgApplication
//       → 운영자 승인(adminApproveOrgApplication) → 공식(host_tier='org').
import { supabase } from './supabase';
import type { OrgType } from './db';

export type OrgApplicationStatus = 'pending' | 'approved' | 'rejected';

// 내 계정 상태 — 라우팅·대기 화면의 단일 근거
export type MyOrgStatus = {
  account_type: 'personal' | 'org' | null;   // null = users 행 없음(코드 로그인만 한 신규)
  host_tier: 'individual' | 'figure' | 'org' | 'group' | null;   // 0090: group = 승인된 모임
  nickname: string | null;
  status: OrgApplicationStatus | null;       // null = 신청 기록 없음 (예: 운영자가 손으로 지정한 조직)
  note: string | null;                       // 거절 사유
  org_type: OrgType | null;
  legal_name: string | null;
  registration_no: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  activity_url: string | null;   // 🚀 0090: 모임 활동 링크(밴드·카페·오픈톡)
};

export async function fetchMyOrgStatus(): Promise<MyOrgStatus> {
  const { data, error } = await supabase.rpc('my_org_status');
  if (error) throw error;
  return data as MyOrgStatus;
}

// 조직 계정인가 — 공식 승인 여부와 무관 (대기 중이어도 조직 영역으로 보낸다)
export async function isOrgAccount(): Promise<boolean> {
  try {
    return (await fetchMyOrgStatus()).account_type === 'org';
  } catch {
    // 조회 실패 시 개인 동선으로 — 0087 적용 전 구 서버에서도 앱이 열려야 한다
    return false;
  }
}

export type OrgApplicationInput = {
  orgType: OrgType;
  legalName: string;
  registrationNo: string;
  contactName: string;
  contactPhone: string;   // 선택 — 빈 문자열이면 서버가 null 로
  activityUrl: string;    // 🚀 0090: 모임 필수, 그 외 빈 문자열
};

// 코드 로그인 직후 호출. 개인 메일·개인 계정 메일은 서버가 거부(메시지 그대로 노출).
export async function submitOrgApplication(input: OrgApplicationInput): Promise<void> {
  const { error } = await supabase.rpc('submit_org_application', {
    p_org_type: input.orgType,
    p_legal_name: input.legalName,
    p_registration_no: input.registrationNo,
    p_contact_name: input.contactName,
    p_contact_phone: input.contactPhone,
    p_activity_url: input.activityUrl,
  });
  if (error) throw new Error(error.message);
}

// 🚀 0088: 조직 메일 찾기 — 로그인 전 호출. 서버가 메일을 가려서(wa***@도메인) 돌려준다.
export type FoundOrgEmail = { legal_name: string; masked_email: string };

export async function findOrgLoginEmail(registrationNo: string): Promise<FoundOrgEmail[]> {
  const { data, error } = await supabase.rpc('find_org_login_email', { p_registration_no: registrationNo });
  if (error) throw error;
  return (data ?? []) as FoundOrgEmail[];
}

// 🚀 0089: 구성원 전용 조직 하다 — 참여 코드 (영문·숫자 4~12자, 대소문자 무시)
export const JOIN_CODE_PATTERN = /^[A-Za-z0-9]{4,12}$/;

// 개설자가 코드를 정하거나 새로 정한다. 서버는 해시만 남긴다 — 잊으면 새로 정하는 수밖에 없다.
export async function setJoinCode(challengeId: string, code: string): Promise<void> {
  const { error } = await supabase.rpc('set_join_code', { p_challenge_id: challengeId, p_code: code });
  if (error) throw new Error(error.message);
}

export type JoinMemberOnlyResult =
  | 'joined' | 'already_member' | 'wrong_code' | 'ended' | 'locked' | 'gave_up' | 'not_member_only';

// 코드로 합류. 실패 사유는 문자열로 돌려준다(joinMemberOnlyMessage 로 안내 문구).
export async function joinMemberOnly(challengeId: string, code: string): Promise<JoinMemberOnlyResult> {
  const { data, error } = await supabase.rpc('join_member_only', { p_challenge_id: challengeId, p_code: code });
  if (error) throw new Error(error.message);
  return data as JoinMemberOnlyResult;
}

// 합류 실패 안내 — joined·already_member 는 성공으로 다룬다(null)
export function joinMemberOnlyMessage(result: JoinMemberOnlyResult): string | null {
  switch (result) {
    case 'joined':
    case 'already_member': return null;
    case 'wrong_code': return '참여 코드가 맞지 않아요. 주최측에 다시 확인해 주세요.';
    case 'ended': return '이미 끝난 하다예요.';
    case 'locked': return '지금은 새로 합류할 수 없는 하다예요.';
    case 'gave_up': return '그만둔 하다에는 다시 합류할 수 없어요.';
    case 'not_member_only': return '참여 코드가 필요한 하다가 아니에요.';
  }
}

// ─── 운영자 (🔒 서버가 is_admin() 으로 최종 차단) ─────────────
export type AdminOrgApplication = {
  user_id: string;
  org_type: OrgType;
  legal_name: string;
  registration_no: string | null;
  contact_name: string;           // ⚠️ PII — 운영자 콘솔 밖으로 내보내지 않는다
  contact_phone: string | null;   // ⚠️ PII
  contact_email: string;          // ⚠️ PII
  activity_url: string | null;    // 🚀 0090: 모임 활동 링크
  status: OrgApplicationStatus;
  note: string | null;
  created_at: string;
  reviewed_at: string | null;
};

export async function adminListOrgApplications(status: OrgApplicationStatus = 'pending'): Promise<AdminOrgApplication[]> {
  const { data, error } = await supabase.rpc('admin_list_org_applications', { p_status: status });
  if (error) throw error;
  return (data ?? []) as AdminOrgApplication[];
}

// 승인 = 검증 기록(메일) + 공식 지정(소급·알림 포함) + 신청 approved — 서버 한 트랜잭션
export async function adminApproveOrgApplication(userId: string, note: string): Promise<void> {
  const { error } = await supabase.rpc('admin_approve_org_application', { p_user_id: userId, p_note: note || null });
  if (error) throw new Error(error.message);
}

// 거절 — 사유 필수 (신청자 대기 화면에 그대로 보인다)
export async function adminRejectOrgApplication(userId: string, note: string): Promise<void> {
  const { error } = await supabase.rpc('admin_reject_org_application', { p_user_id: userId, p_note: note });
  if (error) throw new Error(error.message);
}
