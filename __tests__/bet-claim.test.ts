// 🚀 나와의 내기 per-주문 정산 정책 — 자동 테스트 의무 영역 (결제 로직)
// validateBetClaim: 기부 모드 × 완주 결과 → 받기/기부/환불 허용 여부. settleBet 규칙과 일치해야 함.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateBetClaim } from '../supabase/functions/_shared/payments/claimPolicy.ts';

const ok = (v: { ok: boolean }) => v.ok === true;
const no = (v: { ok: boolean }) => v.ok === false;

test('진행 중(종료 전)은 어떤 정산도 불가', () => {
  for (const mode of ['commitment', 'pledge', 'always'] as const) {
    for (const action of ['receive', 'donate', 'refund'] as const) {
      assert.ok(no(validateBetClaim(mode, 'in_progress', action)), `${mode}/${action}`);
    }
  }
});

test('commitment — 완주: 받기 O / 기부 O / 환불 X', () => {
  assert.ok(ok(validateBetClaim('commitment', 'completed', 'receive')));
  assert.ok(ok(validateBetClaim('commitment', 'completed', 'donate')));
  assert.ok(no(validateBetClaim('commitment', 'completed', 'refund')));
});

test('commitment — 실패: 받기 X / 기부 O(실패 인정) / 환불 X', () => {
  assert.ok(no(validateBetClaim('commitment', 'failed', 'receive')));
  assert.ok(ok(validateBetClaim('commitment', 'failed', 'donate')));
  assert.ok(no(validateBetClaim('commitment', 'failed', 'refund')));
});

test('pledge(서약) — 완주: 받기 X / 기부 O / 환불 X', () => {
  assert.ok(no(validateBetClaim('pledge', 'completed', 'receive')));
  assert.ok(ok(validateBetClaim('pledge', 'completed', 'donate')));
  assert.ok(no(validateBetClaim('pledge', 'completed', 'refund')));
});

test('pledge(서약) — 실패: 받기 X / 기부 X / 환불 O (돈 안 나감)', () => {
  assert.ok(no(validateBetClaim('pledge', 'failed', 'receive')));
  assert.ok(no(validateBetClaim('pledge', 'failed', 'donate')));
  assert.ok(ok(validateBetClaim('pledge', 'failed', 'refund')));
});

test('always(무조건) — 완주·실패 모두: 받기 X / 기부 O / 환불 X', () => {
  for (const outcome of ['completed', 'failed'] as const) {
    assert.ok(no(validateBetClaim('always', outcome, 'receive')), `${outcome}/receive`);
    assert.ok(ok(validateBetClaim('always', outcome, 'donate')), `${outcome}/donate`);
    assert.ok(no(validateBetClaim('always', outcome, 'refund')), `${outcome}/refund`);
  }
});

test('각 모드·결과마다 허용 액션은 정확히 1개 (받기는 기부와 양립 가능한 commitment-완주만 예외)', () => {
  const cases: [Parameters<typeof validateBetClaim>[0], Parameters<typeof validateBetClaim>[1], number][] = [
    ['commitment', 'completed', 2],  // 받기 + 기부 (선택)
    ['commitment', 'failed', 1],     // 기부
    ['pledge', 'completed', 1],      // 기부
    ['pledge', 'failed', 1],         // 환불
    ['always', 'completed', 1],      // 기부
    ['always', 'failed', 1],         // 기부
  ];
  for (const [mode, outcome, expected] of cases) {
    const allowed = (['receive', 'donate', 'refund'] as const).filter(a => ok(validateBetClaim(mode, outcome, a)));
    assert.equal(allowed.length, expected, `${mode}/${outcome} → ${allowed.join(',')}`);
  }
});
