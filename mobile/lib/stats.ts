// 🚀 챌린지 통계 — 진행률 / Streak / 완주 여부 계산
// 날짜 판정은 모두 KST(Asia/Seoul) 기준 — UTC 기준이면 한국 사용자는 오전 9시까지 어제로 판정됨.
import type { DbChallenge, ProofWithRelations, ChallengeFrequency } from './types';
import { getKstTodayRange } from './format';
import { streakTier } from './tokens';

// 🚀 연속 인증 마일스톤 (게시글 메달) — proofs.streak_count(연속 일수)가 이 값일 때만 메달 노출.
// 사람 아닌 게시글에 부착 → 비교/줄세우기 아님. 색은 tokens.streakTier 와 인덱스 1:1.
export const STREAK_MILESTONES = [3, 7, 21, 49, 99, 180, 365, 730] as const;
const STREAK_LABELS = [
  '작심삼일 돌파', '일주일 연속', '습관 형성', '강력한 습관 형성',
  '백일의 약속', '반년 연속', '1년 성공', '2년 성공',
];

// streak_count → 마일스톤 메달 정보 (해당 일수가 마일스톤일 때만, 아니면 null)
export function streakMilestone(streakCount?: number | null): { day: number; label: string; color: string } | null {
  if (!streakCount) return null;
  const i = (STREAK_MILESTONES as readonly number[]).indexOf(streakCount);
  if (i < 0) return null;
  return { day: streakCount, label: STREAK_LABELS[i], color: streakTier[i] };
}

// ISO timestamp → KST 날짜 문자열 (YYYY-MM-DD). 인증을 "어느 날" 했는지 묶을 때 사용.
function toKstDateStr(iso: string): string {
  return new Date(new Date(iso).getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

// 🚀 frequency 별 목표 인증 횟수 계산 (P-① — 0007 frequency 컬럼 활용)
//   daily   : 모든 날 인증
//   weekly3 : 주 3회 = ceil(totalDays * 3/7)
//   weekly1 : 주 1회 = ceil(totalDays / 7)
export function targetProofCount(totalDays: number, frequency: ChallengeFrequency = 'daily'): number {
  if (frequency === 'daily')   return totalDays;
  if (frequency === 'weekly3') return Math.ceil(totalDays * 3 / 7);
  if (frequency === 'weekly1') return Math.ceil(totalDays / 7);
  return totalDays;
}

// 🚀 누구나(open) 방 모집 마감 시점(KST) — 시작일 00:00 ~ 종료일 24:00 구간의 중간 지점(ms).
// 이 지점을 지나면 신규 합류 자동 마감(누구나 영역에서 제거 + 다함께처럼 진행). DB recruit_close_at 과 동일 계산.
export function recruitCloseAtMs(startDate: string, endDate: string): number {
  const startMs = Date.parse(`${startDate}T00:00:00+09:00`);
  // end_date 는 그날 24시까지 운영 → (end_date + 1일) 00:00 KST 가 구간 끝
  const endMs = Date.parse(`${endDate}T00:00:00+09:00`) + 86_400_000;
  return startMs + (endMs - startMs) / 2;
}

// 누구나 방 신규 합류 가능 여부 = 모집 중인가.
//   마감 조건: 개설자 수동 잠금(recruit_locked) 또는 도전 기간 50% 경과.
//   open 외 종류엔 이 개념이 없음 → true (호출부에서 open 카드/방에만 사용).
export function isRecruiting(
  challenge: { kind: string; start_date: string; end_date: string; recruit_locked?: boolean | null },
  nowMs: number = Date.now(),
): boolean {
  if (challenge.kind !== 'open') return true;
  if (challenge.recruit_locked) return false;
  return nowMs < recruitCloseAtMs(challenge.start_date, challenge.end_date);
}

// 진행률: 시작일~종료일 중 오늘까지 며칠 지났는지 %
export function computeProgress(challenge: DbChallenge): {
  totalDays: number;
  passedDays: number;
  percent: number;
} {
  const start = new Date(challenge.start_date + 'T00:00:00');
  const end = new Date(challenge.end_date + 'T00:00:00');
  
  const todayDate = new Date(getKstTodayRange().kstDateStr + 'T00:00:00');

  const totalDays = Math.max(1, Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1);
  const passedDays = Math.min(
    totalDays,
    Math.max(0, Math.round((todayDate.getTime() - start.getTime()) / 86_400_000) + 1),
  );
  const percent = Math.round((passedDays / totalDays) * 100);
  return { totalDays, passedDays, percent };
}

// Streak: 오늘부터 거꾸로 연속으로 인증한 날 수.
//   - proofs 는 createdAt desc 정렬이라고 가정
//   - 오늘 인증 X 면 어제까지 연속 (자정 직후 끊김 방지)
export function computeStreak(myProofs: ProofWithRelations[]): number {
  if (myProofs.length === 0) return 0;

  // 인증한 날짜 (YYYY-MM-DD, KST) set
  const dates = new Set(myProofs.map(p => toKstDateStr(p.created_at)));

  let streak = 0;
  let cursorMs = Date.now();
  const dayMs = 86_400_000;
  // 오늘 인증 안 했으면 어제부터 카운트
  if (!dates.has(toKstDateStr(new Date(cursorMs).toISOString()))) {
    cursorMs -= dayMs;
  }
  while (dates.has(toKstDateStr(new Date(cursorMs).toISOString()))) {
    streak += 1;
    cursorMs -= dayMs;
  }
  return streak;
}

// 🚀 멤버별 목표 인증 수 — 시작 후 합류자는 "합류일~종료일" 구간 기준 비례 (v2.8 늦합류 완주)
//    합류일이 시작일보다 빠르거나 없으면 챌린지 전체 기간 기준 (기존과 동일).
export function memberTargetProofCount(challenge: DbChallenge, joinedAt?: string | null): number {
  const joinedDate = joinedAt ? toKstDateStr(joinedAt) : null;
  const effectiveStart = joinedDate && joinedDate > challenge.start_date
    ? joinedDate
    : challenge.start_date;
  const start = new Date(effectiveStart + 'T00:00:00');
  const end = new Date(challenge.end_date + 'T00:00:00');
  const days = Math.max(1, Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1);
  return targetProofCount(days, challenge.frequency ?? 'daily');
}

// 인증한 고유 날짜 수 (KST) — 완주율 표시 등 (UTC slice 묶음 오류 방지)
export function uniqueProofDays(proofs: ProofWithRelations[]): number {
  return new Set(proofs.map(p => toKstDateStr(p.created_at))).size;
}

// 멤버별 경과일 — 늦합류자는 합류일부터 센다 (현황 탭 분모, 시작 전이면 0)
export function memberPassedDays(challenge: DbChallenge, joinedAt?: string | null): number {
  const joinedDate = joinedAt ? toKstDateStr(joinedAt) : null;
  const effectiveStart = joinedDate && joinedDate > challenge.start_date
    ? joinedDate
    : challenge.start_date;
  const start = new Date(effectiveStart + 'T00:00:00');
  const end = new Date(challenge.end_date + 'T00:00:00');
  const today = new Date(getKstTodayRange().kstDateStr + 'T00:00:00');
  const cap = Math.min(end.getTime(), today.getTime());
  return Math.max(0, Math.round((cap - start.getTime()) / 86_400_000) + 1);
}

// 🚀 0041 목표 진행 상태 — cadence/count 통합 (분자·분모·완주를 한 곳에서 산출)
//   cadence : 분자 = 고유 인증 날짜수, 분모 = 기간×빈도(늦합류 비례), 완주 = 종료 후 분자 ≥ 분모
//   count   : 분자 = 총 인증 수,      분모 = target_count(고정), 완주 = 분자 ≥ 분모 (기간 내 언제든·조기 완주 인정)
export function goalStatus(
  challenge: DbChallenge,
  myProofs: ProofWithRelations[],
  joinedAt?: string | null,
): { current: number; target: number; isComplete: boolean } {
  if (challenge.goal_type === 'count') {
    const target = challenge.target_count ?? 0;
    const current = myProofs.length;                 // 하루 다회 인증도 각 1개로 카운트 (몰아서 OK)
    return { current, target, isComplete: target > 0 && current >= target };
  }
  // cadence (기존 로직): KST 고유 날짜수 ≥ frequency 목표, 종료일 이후에만 완주 판정
  const target = memberTargetProofCount(challenge, joinedAt);
  const current = uniqueProofDays(myProofs);
  const ended = getKstTodayRange().kstDateStr >= challenge.end_date;
  return { current, target, isComplete: ended && current >= target };
}

// 완주 여부 — goalStatus 단일 소스에 위임.
//   cadence : 종료일이 지났고 frequency 기준 목표 인증 횟수를 채운 경우
//   count   : target_count 개를 채운 경우 (종료 무관, 조기 완주 인정)
//   joinedAt 을 주면 cadence 늦합류자는 합류일 기준 비례 목표로 판정 (다함께·누구나 방)
export function isCompleted(
  challenge: DbChallenge,
  myProofs: ProofWithRelations[],
  joinedAt?: string | null,
): boolean {
  return goalStatus(challenge, myProofs, joinedAt).isComplete;
}

// 실패 여부: 종료일이 지났고 목표 인증 횟수를 못 채운 경우 true (= isCompleted 의 보완)
export function isFailed(
  challenge: DbChallenge,
  myProofs: ProofWithRelations[],
  joinedAt?: string | null,
): boolean {
  const today = getKstTodayRange().kstDateStr;
  if (today < challenge.end_date) return false;
  return !isCompleted(challenge, myProofs, joinedAt);
}

// 종료 여부: 진행 중인지 종료됐는지 (성공/실패 무관)
export function isFinished(challenge: DbChallenge): boolean {
  const today = getKstTodayRange().kstDateStr;
  return today > challenge.end_date;
}

// 🚀 마무리 인사 유예 — 종료일 24시(KST)부터 7일간 대화·댓글·기록 작성 허용, 이후 완전 박제(읽기 전용).
//    solo 방은 인사 나눌 동료가 없으므로 유예 없이 종료 즉시 잠금. (DB 측은 0030 RESTRICTIVE 정책이 동일 기준)
export const FAREWELL_DAYS = 7;

export function getFarewellState(challenge: DbChallenge): {
  finished: boolean;          // 종료 여부
  canWrite: boolean;          // 대화·댓글·기록 작성 가능 여부
  farewellDaysLeft: number;   // 유예 잔여일 (유예 중일 때만 1~7)
} {
  if (!isFinished(challenge)) return { finished: false, canWrite: true, farewellDaysLeft: 0 };
  if (challenge.kind === 'solo') return { finished: true, canWrite: false, farewellDaysLeft: 0 };

  // 종료 후 경과일 — 종료 다음날(= 종료일 24시 이후 첫날) = 1
  const today = new Date(getKstTodayRange().kstDateStr + 'T00:00:00');
  const end = new Date(challenge.end_date + 'T00:00:00');
  const daysAfterEnd = Math.round((today.getTime() - end.getTime()) / 86_400_000);

  const left = FAREWELL_DAYS - daysAfterEnd + 1;   // 종료 다음날 = 7일 남음 … 7일째 = 1일 남음
  if (left > 0) return { finished: true, canWrite: true, farewellDaysLeft: left };
  return { finished: true, canWrite: false, farewellDaysLeft: 0 };
}
