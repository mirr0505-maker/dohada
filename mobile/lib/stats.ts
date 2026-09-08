// 🚀 챌린지 통계 — 진행률 / Streak / 완주·성공 판정
// ⚠️ 완주(끝까지 감, didFinishThrough)와 성공(임계 달성, isSuccess)은 **다른 축**이다 (0078).
// 날짜 판정은 모두 사용자의 기준 시간대(users.timezone, 0077) — 기본 KST, 해외 거주자는 현지 자정 기준.
import type { DbChallenge, ProofWithRelations, ChallengeFrequency } from './types';
import { getTodayRange, toLocalDateStr } from './timezone';
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

// 인증을 "어느 날" 했는지 — 서버가 저장한 local_date(0077)를 우선한다.
//   local_date = 작성자 기준 시간대의 날짜라, 동료가 해외에 있어도 그 사람의 하루로 묶인다.
//   없으면(구 쿼리 경로) 내 기준 시간대로 환산한다.
function proofDateStr(p: { local_date?: string; created_at: string }): string {
  return p.local_date ?? toLocalDateStr(p.created_at);
}

// 🚀 0078 잠시 멈춤 구간 — challenge_pauses 한 행 (end_date 는 끝날 포함).
export type ChallengePause = { start_date: string; end_date: string };
// 여러 사람의 멈춤을 한 번에 다룰 때 (현황 탭·성공자 집계)
export type MemberPause = ChallengePause & { user_id: string };

// 🚀 0078 멈춤 인정 상한 — 실효 구간의 이 비율까지만 목표(분모)에서 빼준다.
//   상한을 넘겨도 멈춤 자체를 막지는 않는다. 초과분은 그냥 "못 한 날"로 세어져
//   성공(임계 달성)만 미달일 수 있고 완주(끝까지 감)는 유지된다
//   — 3주 입원한 사람의 유일한 선택지가 '포기'가 되면 안 되기 때문.
export const PAUSE_CREDIT_RATIO = 0.1;

// 하루 뒤 날짜 문자열. ms 로 24h 를 더하지 않고 UTC 자정 기준으로 옮긴다
//   (현지 ms 산술은 서머타임 전환일 23·25시간에 하루가 겹치거나 건너뛴다 — computeStreak 과 같은 이유)
function nextDayStr(dateStr: string): string {
  return new Date(Date.parse(dateStr + 'T00:00:00Z') + 86_400_000).toISOString().slice(0, 10);
}

// 시작~종료 포함 일수 (end - start + 1, 최소 1)
function inclusiveDays(startDate: string, endDate: string): number {
  const start = Date.parse(startDate + 'T00:00:00Z');
  const end = Date.parse(endDate + 'T00:00:00Z');
  return Math.max(1, Math.round((end - start) / 86_400_000) + 1);
}

// 멤버의 실효 시작일 — 늦합류자는 합류일부터 (v2.8 늦합류 비례)
function effectiveStartDate(challenge: DbChallenge, joinedAt?: string | null): string {
  const joinedDate = joinedAt ? toLocalDateStr(joinedAt) : null;
  return joinedDate && joinedDate > challenge.start_date ? joinedDate : challenge.start_date;
}

// 🚀 0078 멈춤 인정 날짜 — 목표(분모)와 달성(분자) 양쪽에서 빼줄 날짜 집합.
//   ① 각 구간을 실효 구간[effStart, endDate]으로 자르고 ② 겹치는 구간은 Set 으로 중복 제거한 뒤
//   ③ 상한(실효 구간 × PAUSE_CREDIT_RATIO)까지만 인정한다.
//   상한에 걸려 잘릴 때 어느 날을 인정할지는 **이른 날짜부터** — 판정이 결정적이어야 하므로.
function creditedPauseDates(
  pauses: ChallengePause[],
  effStart: string,
  endDate: string,
  totalDays: number,
): Set<string> {
  const cap = Math.floor(totalDays * PAUSE_CREDIT_RATIO);
  if (cap <= 0 || pauses.length === 0) return new Set();

  const dates = new Set<string>();
  for (const p of pauses) {
    let day = p.start_date < effStart ? effStart : p.start_date;
    const last = p.end_date > endDate ? endDate : p.end_date;
    while (day <= last) {
      dates.add(day);
      day = nextDayStr(day);
    }
  }
  return new Set([...dates].sort().slice(0, cap));
}

// 멤버 한 명의 실효 구간과 멈춤 인정일 — 분모(memberTargetProofCount)와 분자(goalStatus)가 같은 값을 쓰게 하는 창구.
function memberPauseCredit(
  challenge: DbChallenge,
  joinedAt: string | null | undefined,
  pauses: ChallengePause[],
): { totalDays: number; credited: Set<string> } {
  const effStart = effectiveStartDate(challenge, joinedAt);
  const totalDays = inclusiveDays(effStart, challenge.end_date);
  return { totalDays, credited: creditedPauseDates(pauses, effStart, challenge.end_date, totalDays) };
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
// ⚠️ DB is_recruiting()(0043→0064→0074)과 미러 — 한쪽만 고치면 "클라는 마감인데 DB 는 합류 허용" 불일치.
export function isRecruiting(
  challenge: {
    kind: string; start_date: string; end_date: string;
    recruit_locked?: boolean | null;
    recruit_cap_exempt?: boolean | null;
    host_tier?: string | null;
  },
  nowMs: number = Date.now(),
): boolean {
  // 🚀 0074: 조직(org) 하다는 모집 캡 면제. 0043 캡("기간 50% 자동 마감")은 "서로를 목격하는 동료"를
  //   지키는 장치인데 조직 하다는 애초에 광장이라 전제가 성립하지 않는다.
  //   ⚠️ 면제하는 것은 캡뿐 — 개설자가 손수 잠근 방은 org 라도 모집 중이 아니다.
  if (challenge.host_tier === 'org') return !challenge.recruit_locked;
  if (challenge.kind !== 'open') return true;
  if (challenge.recruit_locked) return false;
  // 🚀 0064: 면제(recruit_cap_exempt) 방은 기간 50% 자동 마감을 받지 않는다(1,000명까지 자라야 하므로).
  //   DB is_recruiting() open 갈래의 `c.recruit_cap_exempt or now() < recruit_close_at(...)` 와 미러.
  if (challenge.recruit_cap_exempt) return true;
  // 🚀 0082: 명사(figure) 무대도 캡 면제 — 광장 무대에 떠 있는데 못 들어가는 방을 만들지 않는다.
  //   org 와 달리 open 일 때만이다(위 kind 체크를 이미 지난 자리). DB is_recruiting() 과 미러.
  if (challenge.host_tier === 'figure') return true;
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
  
  const todayDate = new Date(getTodayRange().dateStr + 'T00:00:00');

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
  const dates = new Set(myProofs.map(proofDateStr));

  let streak = 0;
  // 하루 물러나기는 날짜 문자열로 — ms 로 24h 씩 빼면 서머타임 전환일에 하루가 겹치거나 건너뛴다
  const prevDay = (d: string) => new Date(Date.parse(d + 'T00:00:00Z') - 86_400_000).toISOString().slice(0, 10);
  let cursor = toLocalDateStr(new Date().toISOString());
  if (!dates.has(cursor)) cursor = prevDay(cursor);   // 오늘 인증 안 했으면 어제부터 카운트
  while (dates.has(cursor)) {
    streak += 1;
    cursor = prevDay(cursor);
  }
  return streak;
}

// 🚀 멤버별 목표 인증 수(= 성공 분모) — 시작 후 합류자는 "합류일~종료일" 구간 기준 비례 (v2.8 늦합류 완주)
//    합류일이 시작일보다 빠르거나 없으면 챌린지 전체 기간 기준.
//    0078 이후 두 가지가 더 곱해진다:
//      멈춤 인정일  : 실효 구간에서 빼준다 (상한 PAUSE_CREDIT_RATIO)
//      성공 임계(%) : ceil(목표 × success_threshold/100). 기본 100 이라 기존 하다는 종전과 완전히 동일.
//    ⚠️ 이 값은 "성공(목표 달성)"의 분모다. "완주(끝까지 감)" 판정과는 무관하다.
export function memberTargetProofCount(
  challenge: DbChallenge,
  joinedAt?: string | null,
  pauses: ChallengePause[] = [],
): number {
  const { totalDays, credited } = memberPauseCredit(challenge, joinedAt, pauses);
  const days = Math.max(1, totalDays - credited.size);
  const threshold = challenge.success_threshold ?? 100;
  return Math.ceil(targetProofCount(days, challenge.frequency ?? 'daily') * threshold / 100);
}

// 인증한 고유 날짜 수 (기준 시간대) — 완주율 표시 등 (UTC slice 묶음 오류 방지)
//   excludeDates 를 주면 그 날짜(= 멈춤 인정일)의 인증은 분자에서 제외한다 — 분모에서 뺀 날은 분자에서도 뺀다.
export function uniqueProofDays(proofs: ProofWithRelations[], excludeDates?: Set<string>): number {
  const days = new Set(proofs.map(proofDateStr));
  if (excludeDates) for (const d of excludeDates) days.delete(d);
  return days.size;
}

// 멤버별 경과일 — 늦합류자는 합류일부터 센다 (현황 탭 분모, 시작 전이면 0)
export function memberPassedDays(
  challenge: DbChallenge,
  joinedAt?: string | null,
  pauses: ChallengePause[] = [],
): number {
  const effStart = effectiveStartDate(challenge, joinedAt);
  const todayStr = getTodayRange().dateStr;
  // 종료일을 지났으면 종료일까지만 센다 (진행바가 100%를 넘지 않게)
  const capDate = todayStr < challenge.end_date ? todayStr : challenge.end_date;
  if (capDate < effStart) return 0;   // 아직 시작 전
  const passed = inclusiveDays(effStart, capDate);

  // 🚀 0078: 오늘까지 인정된 멈춤일은 '지나간 날'에서도 뺀다.
  //   멈춘 날은 인증 의무가 없던 날이므로 분모에 남겨두면 "멈출수록 진행률이 떨어지는" 모순이 생긴다.
  const { credited } = memberPauseCredit(challenge, joinedAt, pauses);
  let creditedSoFar = 0;
  for (const day of credited) if (day <= capDate) creditedSoFar += 1;
  return Math.max(0, passed - creditedSoFar);
}

// 🚀 0041 목표 진행 상태 — cadence/count 통합 (분자·분모·성공을 한 곳에서 산출)
//   ⚠️ 성공 ≠ 완주. 여기서 내는 건 **성공(목표 달성)** 이다 — 끝까지 갔는지(완주)는 didFinishThrough.
//   cadence : 분자 = 고유 인증 날짜수(멈춤 인정일 제외), 분모 = memberTargetProofCount(멈춤·임계 반영), 성공 = 종료 후 분자 ≥ 분모
//   count   : 분자 = 총 인증 수,                          분모 = ceil(target_count × 임계%),          성공 = 분자 ≥ 분모 (기간 내 언제든·조기 달성 인정)
//   ⚠️ count 유형에는 멈춤 제외를 적용하지 않는다 — 분모가 날짜가 아니라 개수라 뺄 대상이 없다.
export function goalStatus(
  challenge: DbChallenge,
  myProofs: ProofWithRelations[],
  joinedAt?: string | null,
  pauses: ChallengePause[] = [],
): { current: number; target: number; isSuccess: boolean } {
  const threshold = challenge.success_threshold ?? 100;
  if (challenge.goal_type === 'count') {
    const goal = challenge.target_count ?? 0;
    const target = Math.ceil(goal * threshold / 100);
    const current = myProofs.length;                 // 하루 다회 인증도 각 1개로 카운트 (몰아서 OK)
    return { current, target, isSuccess: target > 0 && current >= target };
  }
  // cadence: 고유 날짜수 ≥ 목표, 종료일 이후에만 성공 판정 (조기 성공 없음)
  const { credited } = memberPauseCredit(challenge, joinedAt, pauses);
  const target = memberTargetProofCount(challenge, joinedAt, pauses);
  const current = uniqueProofDays(myProofs, credited);
  const ended = getTodayRange().dateStr >= challenge.end_date;
  return { current, target, isSuccess: ended && current >= target };
}

// 🚀 성공(목표 달성) 여부 — goalStatus 단일 소스에 위임. **완주와 다른 축이다.**
//   성공 = 개설 시 정한 임계(success_threshold, 90/95/100%)를 채움
//        → 완주 화면·내기 본전 회수·스폰서 매칭 기부·다짐 정산의 근거
//   cadence : 종료일이 지났고 임계 목표를 채운 경우
//   count   : 임계 목표 개수를 채운 경우 (종료 무관, 조기 달성 인정)
//   joinedAt 을 주면 cadence 늦합류자는 합류일 기준 비례 목표로, pauses 를 주면 멈춤일을 빼고 판정.
export function isSuccess(
  challenge: DbChallenge,
  myProofs: ProofWithRelations[],
  joinedAt?: string | null,
  pauses: ChallengePause[] = [],
): boolean {
  return goalStatus(challenge, myProofs, joinedAt, pauses).isSuccess;
}

// 🚀 완주(끝까지 감) 여부 — **성공 ≠ 완주.** 목표를 다 못 채워도 포기하지 않고 종료일을 지났으면 완주다.
//   완주 = 포기 안 함 + 종료일 지남 + 인증 1회 이상 → 박제·해냈어요 자격
//   (100일 중 92일을 걸은 사람에게 "실패"라고 말하지 않기 위한 축. 임계·멈춤과 무관하다.)
//   인증 0회는 제외 — 박제할 게 없다.
//   count 유형은 종료 전이라도 목표를 채웠으면 완주로 본다 (조기 완주 인정 — 기존 동작 승계).
export function didFinishThrough(
  challenge: DbChallenge,
  myProofs: ProofWithRelations[],
  joinedAt?: string | null,
  gaveUpAt?: string | null,
): boolean {
  if (gaveUpAt) return false;
  if (myProofs.length === 0) return false;
  if (challenge.goal_type === 'count' && goalStatus(challenge, myProofs, joinedAt).isSuccess) return true;
  return isFinished(challenge);
}

// 🚀 0075: 이 하다의 **성공자 수** — 조직이 "1명당 N원 기부" 를 약정한 하다의 표시용 집계.
//   ⚠️ 완주자가 아니라 성공자다 — 조직 약정 금액이 여기 걸린다. 끝까지 갔지만 임계 미달인 사람은 세지 않는다.
//   판정은 goalStatus(단일 소스)에 그대로 위임한다 — 여기서 새로 세지 않는다
//   (기준 시간대·frequency·늦합류 비례·멈춤·임계·count 조기달성이 전부 그 함수에 이미 있다).
//   ⚠️ 주최자(role='host', 0069)는 방을 열었을 뿐 도전자가 아니므로 제외 — 세면 조직 자신이 기부 대상이 된다.
//   ⚠️ 포기한 멤버도 제외 — memberCount(db.ts) 와 같은 기준.
export function countSuccessfulMembers(
  challenge: DbChallenge,
  members: { user_id: string; joined_at: string; gave_up_at: string | null; role?: string | null }[],
  proofs: ProofWithRelations[],
  pauses: MemberPause[] = [],
): number {
  let successful = 0;
  for (const m of members) {
    if (m.role === 'host' || m.gave_up_at) continue;
    const myProofs = proofs.filter(p => p.user_id === m.user_id);
    const myPauses = pauses.filter(p => p.user_id === m.user_id);
    if (goalStatus(challenge, myProofs, m.joined_at, myPauses).isSuccess) successful += 1;
  }
  return successful;
}

// 🚀 목표 미달 여부: 종료일이 지났는데 임계 목표를 못 채운 경우 true (= isSuccess 의 보완).
//   ⚠️ '실패'가 아니다 — 끝까지 갔다면 완주(didFinishThrough)는 그대로다.
//   UI 문구로 '실패'를 쓰지 않는다. '실패'는 내기 정산 맥락에서만 허용.
export function isShortOfGoal(
  challenge: DbChallenge,
  myProofs: ProofWithRelations[],
  joinedAt?: string | null,
  pauses: ChallengePause[] = [],
): boolean {
  const today = getTodayRange().dateStr;
  if (today < challenge.end_date) return false;
  return !isSuccess(challenge, myProofs, joinedAt, pauses);
}

// 종료 여부: 진행 중인지 종료됐는지 (성공/실패 무관)
export function isFinished(challenge: DbChallenge): boolean {
  const today = getTodayRange().dateStr;
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
  const today = new Date(getTodayRange().dateStr + 'T00:00:00');
  const end = new Date(challenge.end_date + 'T00:00:00');
  const daysAfterEnd = Math.round((today.getTime() - end.getTime()) / 86_400_000);

  const left = FAREWELL_DAYS - daysAfterEnd + 1;   // 종료 다음날 = 7일 남음 … 7일째 = 1일 남음
  if (left > 0) return { finished: true, canWrite: true, farewellDaysLeft: left };
  return { finished: true, canWrite: false, farewellDaysLeft: 0 };
}
