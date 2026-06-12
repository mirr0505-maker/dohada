// 🚀 나와의 내기 완주 판정 — 순수 함수 (자동 테스트 의무 영역: 결제 로직)
// "받기(본전)는 서버가 완주를 확인했을 때만" — 실패자가 본전을 회수하는 백도어를 막는 게 이 함수의 존재 이유.
// 판정 규칙은 mobile/lib/stats.ts(isCompleted/memberTargetProofCount)와 동일해야 한다 — 단일 진실원천 미러.
//   completed   : 종료일이 지났고(>=) frequency 목표 인증 수를 채움 → 받기 허용
//   failed      : 종료일이 완전히 지났는데(>) 목표 미달 → 기부만 가능 (커밋먼트 확정)
//   in_progress : 그 외 (아직 진행 중 / 마지막 날 아직 채울 기회 있음) → 정산 보류
//
// ⚠️ SQL 이 아니라 Edge Function 내 TS 로 둔 이유: CLAUDE.md 가 결제 로직을 자동 테스트
//    의무 영역으로 규정하는데 SQL 함수는 npm test(Node 러너)로 검증할 수 없기 때문.

export type SelfBetOutcome = 'completed' | 'failed' | 'in_progress';
export type Frequency = 'daily' | 'weekly3' | 'weekly1';

// ISO timestamp → KST 날짜 문자열(YYYY-MM-DD). 인증을 "어느 날" 했는지 KST 로 묶는다.
function toKstDateStr(iso: string): string {
  return new Date(new Date(iso).getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

// 현재 KST 날짜 — 호출 시점 기준 (테스트는 todayKst 를 주입)
function kstTodayStr(): string {
  return new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

// 시작~종료 포함 일수 (stats.ts 와 동일: end - start + 1, 최소 1)
function inclusiveDays(startDate: string, endDate: string): number {
  const start = Date.parse(startDate + 'T00:00:00Z');
  const end = Date.parse(endDate + 'T00:00:00Z');
  return Math.max(1, Math.round((end - start) / 86_400_000) + 1);
}

// frequency 별 목표 인증 수 (stats.ts targetProofCount 와 동일)
function targetProofCount(days: number, frequency: Frequency): number {
  if (frequency === 'weekly3') return Math.ceil(days * 3 / 7);
  if (frequency === 'weekly1') return Math.ceil(days / 7);
  return days; // daily
}

export function computeSelfBetOutcome(input: {
  startDate: string;            // 챌린지 시작일 (YYYY-MM-DD)
  endDate: string;              // 챌린지 종료일 (YYYY-MM-DD)
  frequency: Frequency;
  joinedAt: string | null;      // 도전자 합류 시각 ISO — 늦합류 비례 완주
  proofIso: string[];           // 도전자의 인증 created_at ISO 목록
  todayKst?: string;            // 테스트 주입용 (미지정 시 현재 KST)
}): SelfBetOutcome {
  const today = input.todayKst ?? kstTodayStr();

  // 늦합류자는 합류일 기준 비례 목표 (합류일이 시작일보다 늦을 때만)
  const joinedDate = input.joinedAt ? toKstDateStr(input.joinedAt) : null;
  const effectiveStart = joinedDate && joinedDate > input.startDate ? joinedDate : input.startDate;
  const target = targetProofCount(inclusiveDays(effectiveStart, input.endDate), input.frequency);

  // KST 고유 인증 일수 (UTC slice 묶음 오류 방지 — 23시·익일 01시 합쳐짐 방지)
  const uniqueDays = new Set(input.proofIso.map(toKstDateStr)).size;

  if (today >= input.endDate && uniqueDays >= target) return 'completed';
  if (today > input.endDate) return 'failed';
  return 'in_progress';
}
