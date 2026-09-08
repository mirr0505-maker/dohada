// 🚀 나와의 내기 성공 판정 — 자동 테스트 의무 영역 (CLAUDE.md: 결제 로직)
// computeSelfBetOutcome 은 받기(본전) 허용의 서버 게이트 — stats.ts isSuccess 와 동일 규칙이어야 한다.
//   ⚠️ 성공 ≠ 완주 — 끝까지 갔다는 사실만으로는 본전을 회수할 수 없다(임계 달성이어야 한다).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  computeSelfBetOutcome, type Frequency,
} from '../supabase/functions/_shared/payments/betOutcome.ts';

// 헬퍼: 인증한 날짜 목록 = proofs.local_date (서버가 작성자 기준 시간대로 박아둔 날)
function proofsOn(...dates: string[]): string[] {
  return dates;
}

const DAILY = (over: Partial<Parameters<typeof computeSelfBetOutcome>[0]> = {}) => ({
  startDate: '2026-06-01', endDate: '2026-06-05', frequency: 'daily' as Frequency,
  joinedAt: null, proofDates: [], todayLocal: '2026-06-06', ...over,
});

test('완주 — 종료 후 daily 목표(5일) 전부 채움 → completed', () => {
  const out = computeSelfBetOutcome(DAILY({
    proofDates: proofsOn('2026-06-01', '2026-06-02', '2026-06-03', '2026-06-04', '2026-06-05'),
  }));
  assert.equal(out, 'completed');
});

test('실패 — 종료 후 목표 미달(4/5) → failed (받기 거부 = 기부 확정)', () => {
  const out = computeSelfBetOutcome(DAILY({
    proofDates: proofsOn('2026-06-01', '2026-06-02', '2026-06-03', '2026-06-04'),
  }));
  assert.equal(out, 'failed');
});

test('진행 중 — 아직 종료 전이면 목표를 채워도 completed 아님 (조기완주 금지, stats.ts 동일)', () => {
  const out = computeSelfBetOutcome(DAILY({
    todayLocal: '2026-06-03',
    proofDates: proofsOn('2026-06-01', '2026-06-02', '2026-06-03', '2026-06-04', '2026-06-05'),
  }));
  assert.equal(out, 'in_progress');
});

test('경계 — 종료일 당일(today == end_date) 목표 충족 → completed', () => {
  const out = computeSelfBetOutcome(DAILY({
    todayLocal: '2026-06-05',
    proofDates: proofsOn('2026-06-01', '2026-06-02', '2026-06-03', '2026-06-04', '2026-06-05'),
  }));
  assert.equal(out, 'completed');
});

test('경계 — 종료일 당일 목표 미달은 아직 failed 아님 (마지막 날 기회 보존)', () => {
  const out = computeSelfBetOutcome(DAILY({
    todayLocal: '2026-06-05',
    proofDates: proofsOn('2026-06-01', '2026-06-02', '2026-06-03'),
  }));
  assert.equal(out, 'in_progress');
});

test('weekly3 — 5일 도전 목표 ceil(5*3/7)=3, 3일 인증 → completed', () => {
  const out = computeSelfBetOutcome(DAILY({
    frequency: 'weekly3',
    proofDates: proofsOn('2026-06-01', '2026-06-03', '2026-06-05'),
  }));
  assert.equal(out, 'completed');
});

test('weekly1 — 5일 도전 목표 ceil(5/7)=1, 1일 인증 → completed', () => {
  const out = computeSelfBetOutcome(DAILY({
    frequency: 'weekly1',
    proofDates: proofsOn('2026-06-03'),
  }));
  assert.equal(out, 'completed');
});

test('늦합류 — 합류일(06-03)부터 종료(06-05)까지 3일이 목표, 3일 인증 → completed', () => {
  const out = computeSelfBetOutcome(DAILY({
    joinedAt: '2026-06-03T01:00:00.000Z',   // KST 06-03 10시
    proofDates: proofsOn('2026-06-03', '2026-06-04', '2026-06-05'),
  }));
  assert.equal(out, 'completed');
});

test('늦합류 — 합류 전 시작일 기준이었다면 미달이지만 합류일 기준이라 충족', () => {
  // 시작 06-01 기준이면 목표 5, 인증 3 → 미달. 합류 06-03 기준이면 목표 3, 인증 3 → 충족.
  const out = computeSelfBetOutcome(DAILY({
    joinedAt: '2026-06-03T01:00:00.000Z',
    proofDates: proofsOn('2026-06-03', '2026-06-04', '2026-06-05'),
  }));
  assert.equal(out, 'completed');
});

test('같은 날 2건은 1일로 카운트 (local_date 중복 제거)', () => {
  const out = computeSelfBetOutcome(DAILY({
    frequency: 'weekly1',                          // 목표 1
    proofDates: ['2026-06-01', '2026-06-01'],
  }));
  assert.equal(out, 'completed');   // 1 고유일 >= 목표 1
});

// 🚀 0077 — 하루 경계가 KST 고정이 아니라 도전자의 기준 시간대
test('해외 기준 시간대 — 런던 저녁 인증(KST 다음날)이 그날로 세어져 completed', () => {
  // 런던 06-05 20:00 = KST 06-06 04:00. local_date 는 06-05 로 저장된다(0077 트리거).
  const out = computeSelfBetOutcome(DAILY({
    timezone: 'Europe/London',
    todayLocal: '2026-06-06',
    proofDates: proofsOn('2026-06-01', '2026-06-02', '2026-06-03', '2026-06-04', '2026-06-05'),
  }));
  assert.equal(out, 'completed');
});

test('해외 기준 시간대 — 늦합류 시각도 그 시간대 날짜로 환산 (런던 06-02 23시 = KST 06-03)', () => {
  // KST 로 환산하면 합류일이 06-03 이라 목표 3, 런던 기준이면 06-02 라 목표 4.
  const out = computeSelfBetOutcome(DAILY({
    timezone: 'Europe/London',
    joinedAt: '2026-06-02T22:00:00.000Z',   // 런던 06-02 23시 / KST 06-03 07시
    proofDates: proofsOn('2026-06-02', '2026-06-03', '2026-06-04'),
  }));
  assert.equal(out, 'failed');   // 목표 4(06-02~06-05) 중 3일 → 미달
});

test('인증 0건 — 종료 후 → failed', () => {
  assert.equal(computeSelfBetOutcome(DAILY({ proofDates: [] })), 'failed');
});

// ─── 0078 성공 임계(success_threshold) + 잠시 멈춤(challenge_pauses) ──────────
// 이 두 가지가 본전 회수 허가의 분모를 바꾼다 → stats.ts 와 한 톨도 갈리면 안 된다.
// 100일 daily 하다 (2026-01-01 ~ 2026-04-10)
function daysFrom(start: string, n: number): string[] {
  const out: string[] = [];
  let ms = Date.parse(start + 'T00:00:00Z');
  for (let i = 0; i < n; i++) {
    out.push(new Date(ms).toISOString().slice(0, 10));
    ms += 86_400_000;
  }
  return out;
}
const ALL_100 = daysFrom('2026-01-01', 100);
const HUNDRED = (over: Partial<Parameters<typeof computeSelfBetOutcome>[0]> = {}) => ({
  startDate: '2026-01-01', endDate: '2026-04-10', frequency: 'daily' as Frequency,
  joinedAt: null, proofDates: [], todayLocal: '2026-04-11', ...over,
});

test('임계 90% — 100일 중 92일 인증이면 목표 90 충족 → completed (본전 회수 허용)', () => {
  const out = computeSelfBetOutcome(HUNDRED({
    successThreshold: 90, proofDates: ALL_100.slice(0, 92),
  }));
  assert.equal(out, 'completed');
});

test('임계 100% — 같은 92일 인증이 목표 100 미달 → failed (완주했어도 본전은 못 가져간다)', () => {
  const out = computeSelfBetOutcome(HUNDRED({ proofDates: ALL_100.slice(0, 92) }));
  assert.equal(out, 'failed');
});

test('임계 95% — 목표 95. 95일 충족 / 94일 미달 (반올림 경계)', () => {
  assert.equal(computeSelfBetOutcome(HUNDRED({
    successThreshold: 95, proofDates: ALL_100.slice(0, 95),
  })), 'completed');
  assert.equal(computeSelfBetOutcome(HUNDRED({
    successThreshold: 95, proofDates: ALL_100.slice(0, 94),
  })), 'failed');
});

test('멈춤 상한 이내(5일) — 목표 95 로 줄어 95일 인증이면 completed', () => {
  const proofDates = ALL_100.filter(d => d < '2026-02-01' || d > '2026-02-05');
  assert.equal(proofDates.length, 95);
  assert.equal(computeSelfBetOutcome(HUNDRED({
    proofDates, pauses: [{ startDate: '2026-02-01', endDate: '2026-02-05' }],
  })), 'completed');
});

test('멈춤 상한 초과(20일) — 10일만 인정, 초과분은 못 한 날 → failed (백도어 없음)', () => {
  const proofDates = ALL_100.filter(d => d < '2026-02-01' || d > '2026-02-20');   // 80일
  assert.equal(computeSelfBetOutcome(HUNDRED({
    proofDates, pauses: [{ startDate: '2026-02-01', endDate: '2026-02-20' }],
  })), 'failed');
});

test('멈춤 인정일의 인증은 분자에서도 뺀다 — 100일 전부 인증 + 멈춤 10일 = 90/90 completed', () => {
  assert.equal(computeSelfBetOutcome(HUNDRED({
    proofDates: ALL_100, pauses: [{ startDate: '2026-01-01', endDate: '2026-01-10' }],
  })), 'completed');
});

test('멈춤 구간이 겹쳐도 중복 카운트하지 않는다 (합집합 4일 → 목표 96)', () => {
  const proofDates = ALL_100.filter(d => d < '2026-02-01' || d > '2026-02-04').slice(0, 95);
  assert.equal(computeSelfBetOutcome(HUNDRED({
    proofDates,
    pauses: [
      { startDate: '2026-02-01', endDate: '2026-02-03' },
      { startDate: '2026-02-02', endDate: '2026-02-04' },
    ],
  })), 'failed');   // 95 < 96 (중복 세면 94 라 통과해버린다)
});

test('짧은 하다 — 5일 구간은 멈춤 인정 상한이 0일이라 목표가 줄지 않는다', () => {
  assert.equal(computeSelfBetOutcome(DAILY({
    proofDates: proofsOn('2026-06-01', '2026-06-02', '2026-06-03', '2026-06-04'),
    pauses: [{ startDate: '2026-06-05', endDate: '2026-06-05' }],
  })), 'failed');
});

test('임계·멈춤 미지정 — 기존 내기 판정과 완전히 동일 (회귀 안전망)', () => {
  assert.equal(computeSelfBetOutcome(HUNDRED({ proofDates: ALL_100 })), 'completed');
  assert.equal(computeSelfBetOutcome(HUNDRED({ proofDates: ALL_100.slice(0, 99) })), 'failed');
});
