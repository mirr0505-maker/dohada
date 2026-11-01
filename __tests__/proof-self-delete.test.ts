// 🚀 인증 본인 삭제 창 (0093) — 인증/권한 = 자동 테스트 의무 영역
// 서버 정책(created_at > now() - 10분)과 같은 경계여야 한다: 정확히 10분이면 불가.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canSelfDeleteProof, PROOF_SELF_DELETE_WINDOW_MS } from '../mobile/lib/proofDelete.ts';

const CREATED = '2026-10-30T03:00:00.000Z';
const createdMs = Date.parse(CREATED);

test('창 길이는 10분', () => {
  assert.equal(PROOF_SELF_DELETE_WINDOW_MS, 600_000);
});

test('방금 올린 인증 → 삭제 가능', () => {
  assert.equal(canSelfDeleteProof({ createdAt: CREATED, nowMs: createdMs }), true);
});

test('9분 59초 → 삭제 가능', () => {
  assert.equal(canSelfDeleteProof({ createdAt: CREATED, nowMs: createdMs + 9 * 60_000 + 59_000 }), true);
});

test('정확히 10분 → 삭제 불가 (서버 경계와 동일)', () => {
  assert.equal(canSelfDeleteProof({ createdAt: CREATED, nowMs: createdMs + 10 * 60_000 }), false);
});

test('11분 → 삭제 불가', () => {
  assert.equal(canSelfDeleteProof({ createdAt: CREATED, nowMs: createdMs + 11 * 60_000 }), false);
});

test('created_at 이 기기 시계보다 미래(시계 오차) → 삭제 가능', () => {
  assert.equal(canSelfDeleteProof({ createdAt: CREATED, nowMs: createdMs - 30_000 }), true);
});
