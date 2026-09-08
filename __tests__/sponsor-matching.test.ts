// 🚀 완주 매칭 기부(0075) 표시용 순수 로직 — 성공자 집계(countSuccessfulMembers) + 금액 표시(formatWon).
// 이 숫자가 곧 조직이 실제로 낼 기부액("1명당 N원")이라 틀리면 잘못된 금액을 공개하게 된다.
// ⚠️ 세는 대상은 완주자가 아니라 **성공자**(임계 달성, 0078)다.
// 판정 자체는 goalStatus(단일 소스)가 하고, 여기서 검증하는 건 "누구를 세느냐"다.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { countSuccessfulMembers } from '../mobile/lib/stats.ts';
import { formatWon } from '../mobile/lib/format.ts';

// 이미 종료된 3일짜리 daily 하다 → 목표 3회 (오늘 날짜와 무관하게 판정이 고정되도록 과거로 둔다)
const CH: any = {
  id: 'c1', creator_id: 'org', title: '3일 걷기', description: null, kind: 'open',
  start_date: '2020-06-01', end_date: '2020-06-03', created_at: '2020-05-31T00:00:00Z',
  frequency: 'daily', goal_type: 'cadence', gave_up_at: null,
};

const member = (user_id: string, over: Record<string, unknown> = {}) => ({
  user_id, joined_at: '2020-06-01T00:00:00+09:00', gave_up_at: null, role: 'member', ...over,
});

// 3일 전부 인증 = 완주 / 1일만 = 미완주
const proofsOf = (user_id: string, days: number) =>
  ['2020-06-01', '2020-06-02', '2020-06-03'].slice(0, days)
    .map(d => ({ user_id, created_at: `${d}T12:00:00+09:00` }));

test('성공한 도전자만 센다', () => {
  const members = [member('a'), member('b')];
  const proofs: any = [...proofsOf('a', 3), ...proofsOf('b', 1)];
  assert.equal(countSuccessfulMembers(CH, members, proofs), 1);
});

test('주최자(role=host)는 성공해도 세지 않는다 — 도전자가 아니다 (0069)', () => {
  const members = [member('org', { role: 'host' }), member('a')];
  const proofs: any = [...proofsOf('org', 3), ...proofsOf('a', 3)];
  assert.equal(countSuccessfulMembers(CH, members, proofs), 1);
});

test('포기한 멤버는 세지 않는다', () => {
  const members = [member('a', { gave_up_at: '2020-06-02T00:00:00Z' }), member('b')];
  const proofs: any = [...proofsOf('a', 3), ...proofsOf('b', 3)];
  assert.equal(countSuccessfulMembers(CH, members, proofs), 1);
});

test('늦합류자는 합류일 기준 비례 목표 — goalStatus 위임 확인', () => {
  // 6/3 합류 → 목표 1회. 6/3 하루만 인증해도 완주.
  const members = [member('a', { joined_at: '2020-06-03T00:00:00+09:00' })];
  const proofs: any = [{ user_id: 'a', created_at: '2020-06-03T12:00:00+09:00' }];
  assert.equal(countSuccessfulMembers(CH, members, proofs), 1);
});

test('아무도 없으면 0', () => {
  assert.equal(countSuccessfulMembers(CH, [], []), 0);
});

test('count 유형 — 목표 개수를 채운 사람 (종료 무관·조기 완주)', () => {
  const countCh: any = { ...CH, goal_type: 'count', target_count: 2, end_date: '2099-12-31' };
  const members = [member('a'), member('b')];
  const proofs: any = [...proofsOf('a', 2), ...proofsOf('b', 1)];
  assert.equal(countSuccessfulMembers(countCh, members, proofs), 1);
});

// ─── 금액 표시 — 조직이 공개한 약속이라 '99+' 로 약화하지 않는다 ───────────
test('formatWon — 천 단위 구분 + 원', () => {
  assert.equal(formatWon(1000), '1,000원');
  assert.equal(formatWon(0), '0원');
  assert.equal(formatWon(12 * 1000), '12,000원');
  assert.equal(formatWon(1_234_567), '1,234,567원');
});
