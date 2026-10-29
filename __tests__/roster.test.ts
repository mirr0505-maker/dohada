// 🚀 주최자 명단 묶음 (rosterGroups) — ORG_HADA_PLAN §10.4 묶음 C
// 조직·모임이 이 명단으로 사은품 대상을 정한다 = 성공·완주 판정의 소비처라 자동 테스트 의무 영역.
// 핵심: 판정은 goalStatus·didFinishThrough 단일 소스를 그대로 따른다(여기서 새 규칙을 만들지 않는다).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rosterGroups, goalStatus, didFinishThrough } from '../mobile/lib/stats.ts';

// 이미 끝난 10일 daily 하다 (2020-01-01 ~ 2020-01-10) — 오늘 날짜와 무관하게 "종료 후" 고정
const ENDED: any = {
  id: 'c', creator_id: 'host', title: 't', description: null, kind: 'closed',
  start_date: '2020-01-01', end_date: '2020-01-10', created_at: '2019-12-31T00:00:00Z',
  frequency: 'daily', goal_type: 'cadence', gave_up_at: null, success_threshold: 90,
};
// 아직 진행 중인 하다 (먼 미래 종료)
const ONGOING: any = { ...ENDED, start_date: '2020-01-01', end_date: '2999-12-31' };

const days = (n: number) => Array.from({ length: n }, (_, i) => `2020-01-${String(i + 1).padStart(2, '0')}`);
const proofsOf = (userId: string, dates: string[]) =>
  dates.map(d => ({ user_id: userId, local_date: d, created_at: `${d}T12:00:00+09:00` })) as any[];
const member = (id: string, extra: Partial<{ gave_up_at: string | null; role: string }> = {}) =>
  ({ id, joined_at: '2020-01-01T00:00:00Z', gave_up_at: null, role: 'member', ...extra });

test('종료된 하다 — 성공 / 완주(미달) / 인증 0 / 포기 / 주최자 제외', () => {
  const members = [
    member('host', { role: 'host' }),
    member('a'),                                   // 10일 다 → 성공
    member('b'),                                   // 9일 → 임계 90% = 9 → 성공
    member('c'),                                   // 5일 → 완주(끝까지 감)·미달
    member('d'),                                   // 0일 → 끝까지 못 감
    member('e', { gave_up_at: '2020-01-05T00:00:00Z' }),   // 포기
  ];
  const proofs = [...proofsOf('a', days(10)), ...proofsOf('b', days(9)), ...proofsOf('c', days(5)), ...proofsOf('e', days(4))];
  const g = rosterGroups(ENDED, members, proofs);
  assert.deepEqual(g.success.map(r => r.member.id), ['a', 'b']);
  assert.deepEqual(g.finished.map(r => r.member.id), ['c']);
  assert.deepEqual(g.inProgress.map(r => r.member.id), []);
  assert.deepEqual(g.notFinished.map(r => r.member.id), ['d', 'e']);
  assert.equal(g.finished[0].proofCount, 5);
});

test('진행 중 하다 — 미달은 진행 중, 주최자는 어디에도 없다', () => {
  const members = [member('host', { role: 'host' }), member('a'), member('b')];
  const g = rosterGroups(ONGOING, members, proofsOf('a', days(3)));
  assert.deepEqual(g.inProgress.map(r => r.member.id), ['a', 'b']);
  const all = [...g.success, ...g.finished, ...g.inProgress, ...g.notFinished].map(r => r.member.id);
  assert.ok(!all.includes('host'));
});

test('목표 횟수형 — 종료 전이라도 목표를 채우면 성공', () => {
  const count: any = { ...ONGOING, goal_type: 'count', target_count: 3, success_threshold: 100 };
  const g = rosterGroups(count, [member('a'), member('b')], [...proofsOf('a', days(3)), ...proofsOf('b', days(1))]);
  assert.deepEqual(g.success.map(r => r.member.id), ['a']);
  assert.deepEqual(g.inProgress.map(r => r.member.id), ['b']);
});

test('입력 순서(가입 순) 유지 — 인증 많은 순으로 줄세우지 않는다', () => {
  const g = rosterGroups(ENDED, [member('x'), member('y')], [...proofsOf('x', days(9)), ...proofsOf('y', days(10))]);
  assert.deepEqual(g.success.map(r => r.member.id), ['x', 'y']);
});

test('단일 소스 교차 대조 — 무작위 300건이 goalStatus·didFinishThrough 와 같은 결론', () => {
  let seed = 7;
  const rand = (n: number) => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed % n; };
  for (let i = 0; i < 300; i++) {
    const ch = rand(2) ? ENDED : ONGOING;
    const gaveUp = rand(5) === 0 ? '2020-01-04T00:00:00Z' : null;
    const m = member('m', { gave_up_at: gaveUp });
    const ps = proofsOf('m', days(rand(11)));
    const g = rosterGroups(ch, [m], ps);
    const key = (Object.keys(g) as (keyof typeof g)[]).find(k => g[k].length === 1)!;
    const expected = gaveUp ? 'notFinished'
      : goalStatus(ch, ps, m.joined_at).isSuccess ? 'success'
      : didFinishThrough(ch, ps, m.joined_at, null) ? 'finished'
      : ch === ENDED ? 'notFinished' : 'inProgress';
    assert.equal(key, expected, `case ${i}`);
  }
});
