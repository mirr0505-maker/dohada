// 🚀 완주 이야기 목표 결과 (finalize-story-goal 의 순수 판정) — 박제 자산화 = 자동 테스트 의무 영역
// computeStoryGoal 은 stats.ts goalStatus 와 같은 규칙이어야 한다 — 아래 무작위 교차 대조가 그 계약을 지킨다.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeStoryGoal, type StoryGoalInput } from '../supabase/functions/_shared/goal/storyGoal.ts';
import { goalStatus } from '../mobile/lib/stats.ts';
import { setActiveTimezone } from '../mobile/lib/timezone.ts';

// 연속된 날짜 n개 (YYYY-MM-DD)
function daysFrom(start: string, n: number): string[] {
  const out: string[] = [];
  let ms = Date.parse(start + 'T00:00:00Z');
  for (let i = 0; i < n; i++) {
    out.push(new Date(ms).toISOString().slice(0, 10));
    ms += 86_400_000;
  }
  return out;
}

// 이미 끝난 100일 daily 하다 (2020-01-01 ~ 2020-04-09)
const BASE: StoryGoalInput = {
  goalType: 'cadence', startDate: '2020-01-01', endDate: '2020-04-09', frequency: 'daily',
  targetCount: null, successThreshold: 100, joinedAt: null, proofDates: [],
  timezone: 'Asia/Seoul', pauses: [], todayLocal: '2020-05-01',
};
const ALL_100 = daysFrom('2020-01-01', 100);
const goal = (over: Partial<StoryGoalInput>) => computeStoryGoal({ ...BASE, ...over });

test('daily 100일 전부 인증 → 100% · 성공', () => {
  assert.deepEqual(goal({ proofDates: ALL_100 }), { current: 100, target: 100, fullTarget: 100, rate: 100, succeeded: true });
});

test('daily 92일 인증 · 임계 100 → 92% · 미달 (부족분도 정직하게)', () => {
  const r = goal({ proofDates: ALL_100.slice(0, 92) });
  assert.equal(r.rate, 92);
  assert.equal(r.succeeded, false);
});

test('같은 날 여러 번 인증해도 cadence 는 하루 1번으로 센다', () => {
  const r = goal({ proofDates: [...ALL_100.slice(0, 50), ...ALL_100.slice(0, 50)] });
  assert.equal(r.current, 50);
});

test('주3회 · 4주 12회 전부 → 100% 성공 (구 completion_rate 는 43% 로 박제됐다)', () => {
  // 2020-01-01 ~ 2020-01-28 = 28일, 목표 = ceil(28*3/7) = 12
  const r = goal({ endDate: '2020-01-28', frequency: 'weekly3', proofDates: daysFrom('2020-01-01', 12) });
  assert.equal(r.target, 12);
  assert.equal(r.rate, 100);
  assert.equal(r.succeeded, true);
  assert.equal(Math.round(12 / 28 * 100), 43);   // 옛 단순 비율이 내던 값
});

test('count 형 — 종료 전이라도 목표 개수를 채우면 성공 (조기 완주)', () => {
  const r = goal({ goalType: 'count', targetCount: 100, endDate: '2099-12-31', proofDates: daysFrom('2020-01-01', 100) });
  assert.deepEqual(r, { current: 100, target: 100, fullTarget: 100, rate: 100, succeeded: true });
});

test('count 형 — 하루 다회 인증은 각각 센다 · 부족하면 미달', () => {
  const r = goal({ goalType: 'count', targetCount: 100, proofDates: [...ALL_100.slice(0, 30), ...ALL_100.slice(0, 30)] });
  assert.equal(r.current, 60);
  assert.equal(r.rate, 60);
  assert.equal(r.succeeded, false);
});

test('count 형 — 멈춤은 분모에서 빼지 않는다', () => {
  const r = goal({ goalType: 'count', targetCount: 100, pauses: [{ startDate: '2020-02-01', endDate: '2020-02-10' }] });
  assert.equal(r.target, 100);
});

test('count 형 — target_count 가 없으면 성공 아님 · 달성률 0', () => {
  const r = goal({ goalType: 'count', targetCount: null, proofDates: ['2020-01-01'] });
  assert.equal(r.succeeded, false);
  assert.equal(r.rate, 0);
});

test('임계 90 — 92일이면 성공, 89일이면 미달 (달성률은 100% 목표 기준)', () => {
  const ok = goal({ successThreshold: 90, proofDates: ALL_100.slice(0, 92) });
  assert.equal(ok.target, 90);
  assert.equal(ok.fullTarget, 100);
  assert.equal(ok.rate, 92);
  assert.equal(ok.succeeded, true);
  assert.equal(goal({ successThreshold: 90, proofDates: ALL_100.slice(0, 89) }).succeeded, false);
});

test('멈춤 10일(상한 이내) — 분모·분자 모두에서 빼고 성공', () => {
  const r = goal({ proofDates: ALL_100.slice(10), pauses: [{ startDate: '2020-01-01', endDate: '2020-01-10' }] });
  assert.equal(r.target, 90);
  assert.equal(r.current, 90);
  assert.equal(r.succeeded, true);
});

test('멈춤 20일(상한 초과) — 10일까지만 인정, 나머지는 못 한 날', () => {
  const r = goal({ proofDates: ALL_100.slice(20), pauses: [{ startDate: '2020-01-01', endDate: '2020-01-20' }] });
  assert.equal(r.target, 90);
  assert.equal(r.current, 80);
  assert.equal(r.rate, 89);
  assert.equal(r.succeeded, false);
});

test('멈춤일에 올린 인증은 분자에서도 빠진다', () => {
  const r = goal({ proofDates: ALL_100, pauses: [{ startDate: '2020-01-01', endDate: '2020-01-05' }] });
  assert.equal(r.current, 95);
  assert.equal(r.target, 95);
});

test('늦합류 — 합류일부터 비례 목표', () => {
  // 02-20 합류 → 02-20 ~ 04-09 = 50일
  const r = goal({ joinedAt: '2020-02-20T03:00:00+09:00', proofDates: daysFrom('2020-02-20', 50) });
  assert.equal(r.target, 50);
  assert.equal(r.succeeded, true);
});

test('런던 시간대 — 합류 시각을 그 사람의 날짜로 환산', () => {
  const base = { startDate: '2020-06-01', endDate: '2020-06-05', joinedAt: '2020-06-02T22:00:00.000Z',
    proofDates: ['2020-06-02', '2020-06-03', '2020-06-04', '2020-06-05'], todayLocal: '2020-07-01' };
  const london = goal({ ...base, timezone: 'Europe/London' });   // 06-02 23시 합류 → 4일
  assert.equal(london.target, 4);
  assert.equal(london.succeeded, true);
  const seoul = goal({ ...base, timezone: 'Asia/Seoul' });       // 같은 순간 = 06-03 07시 → 3일
  assert.equal(seoul.target, 3);
});

test('종료 전 cadence 는 다 채워도 아직 성공 아님 (조기 성공 없음)', () => {
  assert.equal(goal({ proofDates: ALL_100, todayLocal: '2020-04-08' }).succeeded, false);
});

// ─── stats.ts goalStatus 와 무작위 교차 대조 ───────────────────────────
// 결정적 의사난수 (실패 재현 가능하게)
function rng(seed: number) {
  return () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
}

test('무작위 400건 — current·target·succeeded 가 stats.ts goalStatus 와 일치', () => {
  const rand = rng(20261028);
  const pick = <T,>(arr: readonly T[]): T => arr[Math.floor(rand() * arr.length)];
  const timezones = ['Asia/Seoul', 'Europe/London', 'America/New_York', 'Asia/Kolkata'];
  try {
    for (let i = 0; i < 400; i++) {
      const timezone = pick(timezones);
      const startDate = daysFrom('2020-01-01', 1 + Math.floor(rand() * 300)).pop()!;
      const length = 1 + Math.floor(rand() * 120);
      // 일부는 진행 중(종료일이 먼 미래)이라 '오늘' 판정도 함께 대조
      const endDate = rand() < 0.15 ? '2099-12-31' : daysFrom(startDate, length).pop()!;
      const span = daysFrom(startDate, Math.min(length + 5, 130));
      const proofDates = span.filter(() => rand() < 0.85);
      if (rand() < 0.3) proofDates.push(...proofDates.slice(0, 5));   // 하루 다회
      const joinedAt = rand() < 0.4 ? `${pick(span)}T${pick(['01', '12', '23'])}:30:00.000Z` : null;
      const pauses = rand() < 0.4
        ? [{ startDate: pick(span), endDate: pick(span) }, ...(rand() < 0.3 ? [{ startDate: pick(span), endDate: pick(span) }] : [])]
        : [];
      const goalType = rand() < 0.3 ? 'count' : 'cadence';
      const frequency = pick(['daily', 'weekly3', 'weekly1'] as const);
      const successThreshold = pick([90, 95, 100]);
      const targetCount = goalType === 'count' ? Math.floor(rand() * 120) : null;

      const mine = computeStoryGoal({
        goalType, startDate, endDate, frequency, targetCount, successThreshold,
        joinedAt, proofDates, timezone, pauses,
      });

      setActiveTimezone(timezone);
      const challenge: any = {
        start_date: startDate, end_date: endDate, frequency, goal_type: goalType,
        target_count: targetCount, success_threshold: successThreshold,
      };
      const proofs: any = proofDates.map(d => ({ local_date: d, created_at: `${d}T12:00:00Z` }));
      const pz = pauses.map(p => ({ start_date: p.startDate, end_date: p.endDate }));
      const ref = goalStatus(challenge, proofs, joinedAt, pz);
      const refFull = goalStatus({ ...challenge, success_threshold: 100 }, proofs, joinedAt, pz);

      const ctx = JSON.stringify({ i, goalType, startDate, endDate, frequency, successThreshold, joinedAt, pauses, timezone });
      assert.equal(mine.current, ref.current, ctx);
      assert.equal(mine.target, ref.target, ctx);
      assert.equal(mine.succeeded, ref.isSuccess, ctx);
      assert.equal(mine.fullTarget, refFull.target, ctx);
    }
  } finally {
    setActiveTimezone('Asia/Seoul');
  }
});
