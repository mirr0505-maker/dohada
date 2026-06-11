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

// 완주 여부: 종료일이 지났고 frequency 기준 목표 인증 횟수를 채운 경우 true
//   daily   : 모든 날 인증
//   weekly3 : 총일수의 3/7 이상 (반올림 올림)
//   weekly1 : 총일수의 1/7 이상 (반올림 올림)
export function isCompleted(
  challenge: DbChallenge,
  myProofs: ProofWithRelations[],
): boolean {
  const today = getKstTodayRange().kstDateStr;
  if (today < challenge.end_date) return false; // 아직 진행 중

  const { totalDays } = computeProgress(challenge);
  const target = targetProofCount(totalDays, challenge.frequency ?? 'daily');
  // UTC slice 로 묶으면 KST 23시·다음날 01시 인증이 같은 날로 합쳐져 완주가 누락될 수 있음
  const uniqueDays = new Set(myProofs.map(p => toKstDateStr(p.created_at))).size;
  return uniqueDays >= target;
}

// 실패 여부: 종료일이 지났고 목표 인증 횟수를 못 채운 경우 true (= isCompleted 의 보완)
export function isFailed(
  challenge: DbChallenge,
  myProofs: ProofWithRelations[],
): boolean {
  const today = getKstTodayRange().kstDateStr;
  if (today < challenge.end_date) return false;
  return !isCompleted(challenge, myProofs);
}

// 종료 여부: 진행 중인지 종료됐는지 (성공/실패 무관)
export function isFinished(challenge: DbChallenge): boolean {
  const today = getKstTodayRange().kstDateStr;
  return today > challenge.end_date;
}
