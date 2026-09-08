// 🚀 나와의 내기 성공 판정 — 순수 함수 (자동 테스트 의무 영역: 결제 로직)
// "받기(본전)는 서버가 **성공**을 확인했을 때만" — 목표 미달자가 본전을 회수하는 백도어를 막는 게 이 함수의 존재 이유.
//   ⚠️ 성공 ≠ 완주. 끝까지 간 것(완주)만으로는 본전을 회수할 수 없다 — 임계를 채운 성공이어야 한다.
// 판정 규칙은 mobile/lib/stats.ts(isSuccess/goalStatus/memberTargetProofCount)와 동일해야 한다 — 단일 진실원천 미러.
//   미러 항목: 기준 시간대 하루 경계(0077) · frequency 목표 · 늦합류 비례 · 멈춤 인정(0078, 상한 10%) · 성공 임계(0078, 90/95/100%)
//   completed   : 종료일이 지났고(>=) 임계 목표 인증 수를 채움 → 받기 허용
//   failed      : 종료일이 완전히 지났는데(>) 목표 미달 → 기부만 가능 (커밋먼트 확정)
//   in_progress : 그 외 (아직 진행 중 / 마지막 날 아직 채울 기회 있음) → 정산 보류
//
// ⚠️ SQL 이 아니라 Edge Function 내 TS 로 둔 이유: CLAUDE.md 가 결제 로직을 자동 테스트
//    의무 영역으로 규정하는데 SQL 함수는 npm test(Node 러너)로 검증할 수 없기 때문.

export type SelfBetOutcome = 'completed' | 'failed' | 'in_progress';
export type Frequency = 'daily' | 'weekly3' | 'weekly1';

// 어떤 시각을, 도전자의 기준 시간대(0077)의 날짜 문자열(YYYY-MM-DD)로.
// Deno 는 완전한 ICU 를 내장하므로 Intl 로 계산한다 (en-CA = YYYY-MM-DD 형식).
function toLocalDateStr(ms: number, timezone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date(ms));
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

// 하루 뒤 날짜 문자열 (stats.ts nextDayStr 와 동일 — UTC 자정 기준 이동으로 서머타임 겹침/건너뜀 방지)
function nextDayStr(dateStr: string): string {
  return new Date(Date.parse(dateStr + 'T00:00:00Z') + 86_400_000).toISOString().slice(0, 10);
}

// 🚀 0078 멈춤 인정 상한 — 실효 구간의 이 비율까지만 목표에서 빼준다 (stats.ts PAUSE_CREDIT_RATIO 미러).
//   상한 초과분은 그냥 못 한 날로 세어진다 (멈춤 자체를 막지는 않는다).
const PAUSE_CREDIT_RATIO = 0.1;

// 🚀 0078 멈춤 인정 날짜 (stats.ts creditedPauseDates 미러)
//   실효 구간으로 자르고 → 겹침 중복 제거 → 상한까지, 이른 날짜부터.
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

export function computeSelfBetOutcome(input: {
  startDate: string;            // 챌린지 시작일 (YYYY-MM-DD)
  endDate: string;              // 챌린지 종료일 (YYYY-MM-DD)
  frequency: Frequency;
  joinedAt: string | null;      // 도전자 합류 시각 ISO — 늦합류 비례 완주
  proofDates: string[];         // 도전자의 인증 날짜 목록 = proofs.local_date (작성자 기준 시간대의 날)
  timezone?: string;            // 도전자의 기준 시간대 (0077, 기본 Asia/Seoul)
  todayLocal?: string;          // 테스트 주입용 (미지정 시 그 시간대의 오늘)
  successThreshold?: number;    // 🚀 0078 성공 임계(%) 90/95/100. 개설 시 고정 — 여기서 재계산·덮어쓰기 금지
  pauses?: { startDate: string; endDate: string }[];  // 🚀 0078 잠시 멈춤 구간 (endDate 는 끝날 포함)
}): SelfBetOutcome {
  const timezone = input.timezone ?? 'Asia/Seoul';
  const today = input.todayLocal ?? toLocalDateStr(Date.now(), timezone);

  // 늦합류자는 합류일 기준 비례 목표 (합류일이 시작일보다 늦을 때만)
  const joinedDate = input.joinedAt ? toLocalDateStr(Date.parse(input.joinedAt), timezone) : null;
  const effectiveStart = joinedDate && joinedDate > input.startDate ? joinedDate : input.startDate;

  // 멈춤 인정일은 목표(분모)에서 빼고, 그 날의 인증은 달성(분자)에서도 뺀다
  const totalDays = inclusiveDays(effectiveStart, input.endDate);
  const credited = creditedPauseDates(input.pauses ?? [], effectiveStart, input.endDate, totalDays);
  const days = Math.max(1, totalDays - credited.size);
  const threshold = input.successThreshold ?? 100;
  const target = Math.ceil(targetProofCount(days, input.frequency) * threshold / 100);

  // 고유 인증 일수 — 날짜는 서버가 저장 시점에 박은 local_date 라 재환산하지 않는다
  const proofDays = new Set(input.proofDates);
  for (const d of credited) proofDays.delete(d);
  const uniqueDays = proofDays.size;

  if (today >= input.endDate && uniqueDays >= target) return 'completed';
  if (today > input.endDate) return 'failed';
  return 'in_progress';
}
