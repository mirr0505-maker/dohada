// 🚀 챌린지 통계 — 진행률 / Streak / 완주 여부 계산
import type { DbChallenge, ProofWithRelations } from './types';

// 진행률: 시작일~종료일 중 오늘까지 며칠 지났는지 %
export function computeProgress(challenge: DbChallenge): {
  totalDays: number;
  passedDays: number;
  percent: number;
} {
  const start = new Date(challenge.start_date);
  const end = new Date(challenge.end_date + 'T23:59:59');
  const now = new Date();
  const totalDays = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / 86_400_000));
  const passedDays = Math.min(
    totalDays,
    Math.max(0, Math.ceil((now.getTime() - start.getTime()) / 86_400_000)),
  );
  const percent = Math.round((passedDays / totalDays) * 100);
  return { totalDays, passedDays, percent };
}

// Streak: 오늘부터 거꾸로 연속으로 인증한 날 수.
//   - proofs 는 createdAt desc 정렬이라고 가정
//   - 오늘 인증 X 면 어제까지 연속 (자정 직후 끊김 방지)
export function computeStreak(myProofs: ProofWithRelations[]): number {
  if (myProofs.length === 0) return 0;

  // 인증한 날짜 (YYYY-MM-DD) set
  const dates = new Set(myProofs.map(p => p.created_at.slice(0, 10)));

  let streak = 0;
  const cursor = new Date();
  // 오늘 인증 안 했으면 어제부터 카운트
  if (!dates.has(cursor.toISOString().slice(0, 10))) {
    cursor.setDate(cursor.getDate() - 1);
  }
  while (dates.has(cursor.toISOString().slice(0, 10))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

// 완주 여부: 종료일이 지났고 매일 인증을 한 경우 true
export function isCompleted(
  challenge: DbChallenge,
  myProofs: ProofWithRelations[],
): boolean {
  const today = new Date().toISOString().slice(0, 10);
  if (today < challenge.end_date) return false; // 아직 진행 중

  const { totalDays } = computeProgress(challenge);
  const uniqueDays = new Set(myProofs.map(p => p.created_at.slice(0, 10))).size;
  return uniqueDays >= totalDays;
}
