// 🚀 내기 한잔 정산 — 자동 테스트 의무 영역 (CLAUDE.md: 결제 로직)
// 정산 규칙: 완주 → 자기 몫 수령(또는 기부 선택) / 미완주·중도포기 → 기부 /
//            전원 미완주·중단(방 폭파 등) → 전원 환불. 완주자 분배는 영구 금지.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  settleBet, settlementInvariantHolds, type BetParticipant,
} from '../supabase/functions/_shared/payments/betSettlement.ts';

function p(userId: string, outcome: BetParticipant['outcome'], donateChoice = false): BetParticipant {
  return { userId, orderId: `order-${userId}`, outcome, donateChoice };
}

test('전원 완주 → 전원 자기 몫 수령', () => {
  const ps = [p('a', 'completed'), p('b', 'completed'), p('c', 'completed')];
  const r = settleBet(ps);
  assert.deepEqual(r, { issued: ['order-a', 'order-b', 'order-c'], donated: [], refunded: [] });
  assert.equal(settlementInvariantHolds(ps, r), true);
});

test('일부 미완주 → 미완주 몫만 기부, 완주자에게 분배되지 않음', () => {
  const ps = [p('a', 'completed'), p('b', 'failed'), p('c', 'completed')];
  const r = settleBet(ps);
  assert.deepEqual(r.issued, ['order-a', 'order-c']);
  assert.deepEqual(r.donated, ['order-b']);     // 완주자가 가져가는 게 아니라 기부 — 도박 구성요건 차단의 핵심
  assert.deepEqual(r.refunded, []);
  assert.equal(settlementInvariantHolds(ps, r), true);
});

test('완주자의 "기부로 돌리기" 선택 → 기부', () => {
  const ps = [p('a', 'completed', true), p('b', 'completed')];
  const r = settleBet(ps);
  assert.deepEqual(r.issued, ['order-b']);
  assert.deepEqual(r.donated, ['order-a']);
});

test('중도포기(gave_up) → 미완주와 동일하게 기부', () => {
  const ps = [p('a', 'completed'), p('b', 'gave_up')];
  const r = settleBet(ps);
  assert.deepEqual(r.donated, ['order-b']);
});

test('전원 미완주 → 기부가 아니라 전원 환불 (약속 무산 취급)', () => {
  const ps = [p('a', 'failed'), p('b', 'gave_up'), p('c', 'failed')];
  const r = settleBet(ps);
  assert.deepEqual(r, { issued: [], donated: [], refunded: ['order-a', 'order-b', 'order-c'] });
  assert.equal(settlementInvariantHolds(ps, r), true);
});

test('중단(방 폭파·개설자 포기) → 완주자가 있어도 전원 환불', () => {
  const ps = [p('a', 'completed'), p('b', 'failed')];
  const r = settleBet(ps, { aborted: true });
  assert.deepEqual(r, { issued: [], donated: [], refunded: ['order-a', 'order-b'] });
  assert.equal(settlementInvariantHolds(ps, r), true);
});

test('참여자 0명 → 빈 정산 (인변량 유지)', () => {
  const r = settleBet([]);
  assert.deepEqual(r, { issued: [], donated: [], refunded: [] });
  assert.equal(settlementInvariantHolds([], r), true);
});

test('1인 내기(솔로) — 완주 시 수령, 미완주 시 환불(전원 미완주에 해당)', () => {
  assert.deepEqual(settleBet([p('a', 'completed')]).issued, ['order-a']);
  assert.deepEqual(settleBet([p('a', 'failed')]).refunded, ['order-a']);
});

// ─── 나와의 내기 (mode: 'self' — 나홀로·응원받기 방) ─────
test('나와의 내기 — 완주 시 본전(수령), 기부 선택 시 기부', () => {
  assert.deepEqual(settleBet([p('a', 'completed')], { mode: 'self' }).issued, ['order-a']);
  assert.deepEqual(settleBet([p('a', 'completed', true)], { mode: 'self' }).donated, ['order-a']);
});

test('나와의 내기 — 실패·중도포기 시 환불이 아니라 기부 확정 (커밋먼트 핵심)', () => {
  for (const outcome of ['failed', 'gave_up'] as const) {
    const r = settleBet([p('a', outcome)], { mode: 'self' });
    assert.deepEqual(r, { issued: [], donated: ['order-a'], refunded: [] }, `outcome=${outcome}`);
    assert.equal(settlementInvariantHolds([p('a', outcome)], r), true);
  }
});

test('나와의 내기 — 시스템 무효(aborted)만 환불', () => {
  const r = settleBet([p('a', 'failed')], { mode: 'self', aborted: true });
  assert.deepEqual(r, { issued: [], donated: [], refunded: ['order-a'] });
});

test('나와의 내기 — group 모드와의 분기 확인 (같은 입력, 다른 규칙)', () => {
  const ps = [p('a', 'failed')];
  assert.deepEqual(settleBet(ps).refunded, ['order-a']);                   // group: 전원 미완주 → 환불
  assert.deepEqual(settleBet(ps, { mode: 'self' }).donated, ['order-a']);  // self: 실패 → 기부
});

test('인변량 — 모든 outcome 조합에서 한 장도 증발·중복되지 않음 (전수)', () => {
  const outcomes: BetParticipant['outcome'][] = ['completed', 'failed', 'gave_up'];
  // 3인 방 × outcome 3종 × 완주자 기부선택 2종 — 전 조합
  for (const o1 of outcomes) for (const o2 of outcomes) for (const o3 of outcomes) {
    for (const donate of [false, true]) {
      const ps = [p('a', o1, donate), p('b', o2), p('c', o3)];
      for (const aborted of [false, true]) {
        const r = settleBet(ps, { aborted });
        assert.equal(
          settlementInvariantHolds(ps, r), true,
          `인변량 위반: ${o1}/${o2}/${o3} donate=${donate} aborted=${aborted}`,
        );
      }
    }
  }
});

test('인변량 검사기 자체 검증 — 증발·중복을 실제로 잡아내는가', () => {
  const ps = [p('a', 'completed'), p('b', 'failed')];
  // 증발 (b 몫 누락)
  assert.equal(settlementInvariantHolds(ps, { issued: ['order-a'], donated: [], refunded: [] }), false);
  // 중복 (a 몫이 두 곳에)
  assert.equal(settlementInvariantHolds(ps, { issued: ['order-a'], donated: ['order-a'], refunded: [] }), false);
  // 외부 주문 혼입
  assert.equal(settlementInvariantHolds(ps, { issued: ['order-a'], donated: ['order-x'], refunded: [] }), false);
});
