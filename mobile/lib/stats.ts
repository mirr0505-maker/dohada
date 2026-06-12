// 🚀 챌린지 통계 — 진행률 / Streak / 완주 여부 계산
// 날짜 판정은 모두 KST(Asia/Seoul) 기준 — UTC 기준이면 한국 사용자는 오전 9시까지 어제로 판정됨.
import type { DbChallenge, ProofWithRelations, ChallengeFrequency } from './types';
import { getKstTodayRange } from './format';

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

// 완주 여부: 종료일이 지났고 frequency 기준 목표 인증 횟수를 채운 경우 true
//   daily   : 모든 날 인증
//   weekly3 : 총일수의 3/7 이상 (반올림 올림)
//   weekly1 : 총일수의 1/7 이상 (반올림 올림)
//   joinedAt 을 주면 늦합류자는 합류일 기준 비례 목표로 판정 (다함께·누구나 방)
export function isCompleted(
  challenge: DbChallenge,
  myProofs: ProofWithRelations[],
  joinedAt?: string | null,
): boolean {
  const today = getKstTodayRange().kstDateStr;
  if (today < challenge.end_date) return false; // 아직 진행 중

  const target = memberTargetProofCount(challenge, joinedAt);
  // UTC slice 로 묶으면 KST 23시·다음날 01시 인증이 같은 날로 합쳐져 완주가 누락될 수 있음
  const uniqueDays = new Set(myProofs.map(p => toKstDateStr(p.created_at))).size;
  return uniqueDays >= target;
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
