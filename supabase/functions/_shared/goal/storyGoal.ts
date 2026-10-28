// 🚀 완주 이야기 목표 결과 — 순수 함수 (자동 테스트 의무 영역: 박제 자산화)
// 완주 이야기(0016)의 completion_rate 는 "인증 수 ÷ 전체 일수" 단순 비율이라
// 주3회·주1회·목표 횟수형·잠시 멈춤·늦합류·성공 임계를 전혀 반영하지 못했다
// (주3회를 100% 채운 사람이 "완주율 43%" 로 박제되는 문제).
// 이 함수는 앱의 판정 단일 소스 mobile/lib/stats.ts goalStatus 와 **같은 규칙**으로 결과를 낸다.
//   ⚠️ 판정을 SQL 로 복제하지 않는다 — Edge Function(finalize-story-goal)이 이 함수로 계산해 저장.
//   ⚠️ stats.ts 는 확장자 없는 임포트라 Deno 에서 못 불러온다 → 작은 헬퍼만 "stats.ts 미러" 로 둔다.
//      (규칙이 어긋나지 않는지는 __tests__/story-goal.test.ts 의 무작위 교차 대조가 지킨다)
//
// 반환:
//   current    : 달성 수 (cadence = 고유 인증 날짜 수 - 멈춤 인정일 / count = 총 인증 수)
//   target     : 성공 기준 수 (임계% 반영) — goalStatus().target 과 동일
//   fullTarget : 임계 100% 기준 목표 수 — 달성률의 분모 ("목표의 몇 %를 걸었나")
//   rate       : min(100, round(current / fullTarget × 100))
//   succeeded  : 성공(임계 달성) — 완주(끝까지 감)와는 다른 축

export type StoryGoalFrequency = 'daily' | 'weekly3' | 'weekly1';

export type StoryGoalInput = {
  goalType: 'cadence' | 'count';
  startDate: string;              // 하다 시작일 (YYYY-MM-DD)
  endDate: string;                // 하다 종료일 (YYYY-MM-DD)
  frequency: StoryGoalFrequency;
  targetCount: number | null;     // count 형 목표 개수 (0041)
  successThreshold: number;       // 성공 임계 % (90/95/100, 0078) — 개설 시 고정값을 그대로
  joinedAt: string | null;        // 합류 시각 ISO — cadence 늦합류 비례
  proofDates: string[];           // 인증마다 local_date 1개 (0077, 작성자 기준 시간대의 날) — count 형은 개수가 곧 달성 수
  timezone: string;               // 작성자의 기준 시간대 (합류 시각 → 날짜 환산용)
  pauses: { startDate: string; endDate: string }[];  // 잠시 멈춤 구간 (끝날 포함)
  todayLocal?: string;            // 테스트 주입용 (미지정 시 그 시간대의 오늘)
};

export type StoryGoalResult = {
  current: number;
  target: number;
  fullTarget: number;
  rate: number;
  succeeded: boolean;
};

// stats.ts PAUSE_CREDIT_RATIO 미러 — 실효 구간의 10% 까지만 멈춤을 인정
const PAUSE_CREDIT_RATIO = 0.1;
const DAY_MS = 86_400_000;

// 시각 → 기준 시간대의 날짜 문자열 (en-CA = YYYY-MM-DD)
function toLocalDateStr(ms: number, timezone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date(ms));
}

// stats.ts nextDayStr 미러 — UTC 자정 기준 이동 (서머타임 겹침/건너뜀 방지)
function nextDayStr(dateStr: string): string {
  return new Date(Date.parse(dateStr + 'T00:00:00Z') + DAY_MS).toISOString().slice(0, 10);
}

// stats.ts inclusiveDays 미러 — 시작~종료 포함 일수 (최소 1)
function inclusiveDays(startDate: string, endDate: string): number {
  const start = Date.parse(startDate + 'T00:00:00Z');
  const end = Date.parse(endDate + 'T00:00:00Z');
  return Math.max(1, Math.round((end - start) / DAY_MS) + 1);
}

// stats.ts targetProofCount 미러 — frequency 별 목표 인증 수
function targetProofCount(days: number, frequency: StoryGoalFrequency): number {
  if (frequency === 'weekly3') return Math.ceil(days * 3 / 7);
  if (frequency === 'weekly1') return Math.ceil(days / 7);
  return days;
}

// stats.ts creditedPauseDates 미러 — 실효 구간으로 자르고 → 중복 제거 → 상한까지, 이른 날짜부터
function creditedPauseDates(
  pauses: { startDate: string; endDate: string }[],
  effStart: string,
  endDate: string,
  totalDays: number,
): Set<string> {
  const cap = Math.floor(totalDays * PAUSE_CREDIT_RATIO);
  if (cap <= 0 || pauses.length === 0) return new Set<string>();
  const dates = new Set<string>();
  for (const p of pauses) {
    let day = p.startDate < effStart ? effStart : p.startDate;
    const last = p.endDate > endDate ? endDate : p.endDate;
    while (day <= last) {
      dates.add(day);
      day = nextDayStr(day);
    }
  }
  return new Set([...dates].sort().slice(0, cap));
}

// 달성률 — 임계 100% 목표 대비, 100 상한 (분모 0 이면 0)
function rateOf(current: number, fullTarget: number): number {
  if (fullTarget <= 0) return 0;
  return Math.min(100, Math.round(current / fullTarget * 100));
}

export function computeStoryGoal(input: StoryGoalInput): StoryGoalResult {
  const threshold = input.successThreshold ?? 100;

  // count 형 — 총 인증 수 ≥ ceil(목표 × 임계%). 멈춤 제외 없음 (분모가 날짜가 아니라 개수)
  if (input.goalType === 'count') {
    const fullTarget = input.targetCount ?? 0;
    const target = Math.ceil(fullTarget * threshold / 100);
    const current = input.proofDates.length;
    return { current, target, fullTarget, rate: rateOf(current, fullTarget), succeeded: target > 0 && current >= target };
  }

  // cadence 형 — 늦합류자는 합류일부터 (stats.ts effectiveStartDate 미러)
  const joinedDate = input.joinedAt ? toLocalDateStr(Date.parse(input.joinedAt), input.timezone) : null;
  const effStart = joinedDate && joinedDate > input.startDate ? joinedDate : input.startDate;

  // 멈춤 인정일은 분모에서 빼고, 그 날의 인증은 분자에서도 뺀다
  const totalDays = inclusiveDays(effStart, input.endDate);
  const credited = creditedPauseDates(input.pauses, effStart, input.endDate, totalDays);
  const days = Math.max(1, totalDays - credited.size);
  const fullTarget = targetProofCount(days, input.frequency);
  const target = Math.ceil(fullTarget * threshold / 100);

  const proofDays = new Set(input.proofDates);
  for (const d of credited) proofDays.delete(d);
  const current = proofDays.size;

  // 종료일 이후에만 성공 판정 (조기 성공 없음 — goalStatus 와 동일)
  const today = input.todayLocal ?? toLocalDateStr(Date.now(), input.timezone);
  const succeeded = today >= input.endDate && current >= target;
  return { current, target, fullTarget, rate: rateOf(current, fullTarget), succeeded };
}
