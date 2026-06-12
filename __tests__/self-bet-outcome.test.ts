// 🚀 나와의 내기 완주 판정 — 자동 테스트 의무 영역 (CLAUDE.md: 결제 로직)
// computeSelfBetOutcome 은 받기(본전) 허용의 서버 게이트 — stats.ts isCompleted 와 동일 규칙이어야 한다.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  computeSelfBetOutcome, type Frequency,
} from '../supabase/functions/_shared/payments/betOutcome.ts';

// 헬퍼: 특정 KST 날짜들에 인증한 것으로 ISO 생성 (정오 KST = 03:00 UTC — 날짜 안 넘어감)
function proofsOn(...kstDates: string[]): string[] {
  return kstDates.map(d => `${d}T03:00:00.000Z`);
}

const DAILY = (over: Partial<Parameters<typeof computeSelfBetOutcome>[0]> = {}) => ({
  startDate: '2026-06-01', endDate: '2026-06-05', frequency: 'daily' as Frequency,
  joinedAt: null, proofIso: [], todayKst: '2026-06-06', ...over,
});

test('완주 — 종료 후 daily 목표(5일) 전부 채움 → completed', () => {
  const out = computeSelfBetOutcome(DAILY({
    proofIso: proofsOn('2026-06-01', '2026-06-02', '2026-06-03', '2026-06-04', '2026-06-05'),
  }));
  assert.equal(out, 'completed');
});

test('실패 — 종료 후 목표 미달(4/5) → failed (받기 거부 = 기부 확정)', () => {
  const out = computeSelfBetOutcome(DAILY({
    proofIso: proofsOn('2026-06-01', '2026-06-02', '2026-06-03', '2026-06-04'),
  }));
  assert.equal(out, 'failed');
});

test('진행 중 — 아직 종료 전이면 목표를 채워도 completed 아님 (조기완주 금지, stats.ts 동일)', () => {
  const out = computeSelfBetOutcome(DAILY({
    todayKst: '2026-06-03',
    proofIso: proofsOn('2026-06-01', '2026-06-02', '2026-06-03', '2026-06-04', '2026-06-05'),
  }));
  assert.equal(out, 'in_progress');
});

test('경계 — 종료일 당일(today == end_date) 목표 충족 → completed', () => {
  const out = computeSelfBetOutcome(DAILY({
    todayKst: '2026-06-05',
    proofIso: proofsOn('2026-06-01', '2026-06-02', '2026-06-03', '2026-06-04', '2026-06-05'),
  }));
  assert.equal(out, 'completed');
});

test('경계 — 종료일 당일 목표 미달은 아직 failed 아님 (마지막 날 기회 보존)', () => {
  const out = computeSelfBetOutcome(DAILY({
    todayKst: '2026-06-05',
    proofIso: proofsOn('2026-06-01', '2026-06-02', '2026-06-03'),
  }));
  assert.equal(out, 'in_progress');
});

test('weekly3 — 5일 도전 목표 ceil(5*3/7)=3, 3일 인증 → completed', () => {
  const out = computeSelfBetOutcome(DAILY({
    frequency: 'weekly3',
    proofIso: proofsOn('2026-06-01', '2026-06-03', '2026-06-05'),
  }));
  assert.equal(out, 'completed');
});

test('weekly1 — 5일 도전 목표 ceil(5/7)=1, 1일 인증 → completed', () => {
  const out = computeSelfBetOutcome(DAILY({
    frequency: 'weekly1',
    proofIso: proofsOn('2026-06-03'),
  }));
  assert.equal(out, 'completed');
});

test('늦합류 — 합류일(06-03)부터 종료(06-05)까지 3일이 목표, 3일 인증 → completed', () => {
  const out = computeSelfBetOutcome(DAILY({
    joinedAt: '2026-06-03T01:00:00.000Z',   // KST 06-03 10시
    proofIso: proofsOn('2026-06-03', '2026-06-04', '2026-06-05'),
  }));
  assert.equal(out, 'completed');
});

test('늦합류 — 합류 전 시작일 기준이었다면 미달이지만 합류일 기준이라 충족', () => {
  // 시작 06-01 기준이면 목표 5, 인증 3 → 미달. 합류 06-03 기준이면 목표 3, 인증 3 → 충족.
  const out = computeSelfBetOutcome(DAILY({
    joinedAt: '2026-06-03T01:00:00.000Z',
    proofIso: proofsOn('2026-06-03', '2026-06-04', '2026-06-05'),
  }));
  assert.equal(out, 'completed');
});

test('KST 묶음 — 같은 KST 날짜의 인증 2건은 1일로 카운트 (UTC 자정 넘김 방어)', () => {
  // 2026-06-01 KST 23시(=14:00Z) 와 같은 날 09시(=00:00Z) → 같은 KST 날짜 1일
  const out = computeSelfBetOutcome(DAILY({
    frequency: 'weekly1',                          // 목표 1
    proofIso: ['2026-06-01T14:00:00.000Z', '2026-06-01T00:00:00.000Z'],
  }));
  assert.equal(out, 'completed');   // 1 고유일 >= 목표 1
});

test('인증 0건 — 종료 후 → failed', () => {
  assert.equal(computeSelfBetOutcome(DAILY({ proofIso: [] })), 'failed');
});
