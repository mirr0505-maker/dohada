// 🚀 모집 중 판정(isRecruiting) — DB is_recruiting()(0043→0064→0074)과 미러여야 하는 순수 로직.
// 어긋나면 "클라는 마감으로 보이는데 DB 는 합류를 허용"(또는 반대) 불일치가 난다.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isRecruiting, recruitCloseAtMs } from '../mobile/lib/stats.ts';

// 6/1 ~ 6/10 하다 → 모집 마감선 = 6/1 00:00 KST 와 6/11 00:00 KST 의 중간 = 6/6 00:00 KST
const OPEN = (over: Record<string, unknown> = {}) => ({
  kind: 'open', start_date: '2026-06-01', end_date: '2026-06-10', ...over,
});
const BEFORE_HALF = Date.parse('2026-06-05T12:00:00+09:00');   // 기간 50% 전
const AFTER_HALF = Date.parse('2026-06-08T12:00:00+09:00');    // 기간 50% 후

test('마감선 = 시작 00:00 ~ 종료 24:00 KST 의 중간', () => {
  assert.equal(recruitCloseAtMs('2026-06-01', '2026-06-10'), Date.parse('2026-06-06T00:00:00+09:00'));
});

// ─── [불변] org 아닌 방 — 0074 전후 동작이 100% 같아야 한다 ───────────────
test('누구나 방 — 기간 50% 전이면 모집 중', () => {
  assert.equal(isRecruiting(OPEN(), BEFORE_HALF), true);
});

test('누구나 방 — 기간 50% 경과 시 자동 마감', () => {
  assert.equal(isRecruiting(OPEN(), AFTER_HALF), false);
});

test('누구나 방 — 개설자 수동 잠금이면 기간과 무관하게 마감', () => {
  assert.equal(isRecruiting(OPEN({ recruit_locked: true }), BEFORE_HALF), false);
});

test('개인 다함께 방 — 모집 캡 개념 자체가 없어 항상 true', () => {
  assert.equal(isRecruiting(OPEN({ kind: 'closed' }), AFTER_HALF), true);
});

test('개인(individual)로 명시된 누구나 방 — 캡 그대로 적용', () => {
  assert.equal(isRecruiting(OPEN({ host_tier: 'individual' }), AFTER_HALF), false);
});

test('명사(figure) 하다 — 캡 면제 아님 (면제는 org 뿐)', () => {
  assert.equal(isRecruiting(OPEN({ host_tier: 'figure' }), AFTER_HALF), false);
});

// ─── 🚀 0074: 조직(org) = 광장 → 캡 면제 ────────────────────────────────
test('조직 하다 — 기간 50% 경과해도 계속 모집 중 (캡 면제)', () => {
  assert.equal(isRecruiting(OPEN({ host_tier: 'org' }), AFTER_HALF), true);
});

test('조직 하다 — 다함께(closed)여도 모집 중 (kind 무관)', () => {
  assert.equal(isRecruiting(OPEN({ kind: 'closed', host_tier: 'org' }), AFTER_HALF), true);
});

test('조직 하다 — 기간이 한참 지나도 캡으로는 안 닫힌다', () => {
  const longAfter = Date.parse('2026-12-31T12:00:00+09:00');
  assert.equal(isRecruiting(OPEN({ host_tier: 'org' }), longAfter), true);
});

// 면제되는 것은 "캡"뿐 — 주최자가 손수 잠근 방은 org 라도 모집 중이 아니다.
// (이걸 뚫으면 잠금 토글 set_recruit_lock 이 무력해진다)
test('조직 하다 — 수동 잠금은 org 라도 존중', () => {
  assert.equal(isRecruiting(OPEN({ host_tier: 'org', recruit_locked: true }), BEFORE_HALF), false);
});
