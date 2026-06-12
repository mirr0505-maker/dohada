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

test('commitment — 전원 미완주여도 전원 기부 (환불 특례 제거, 실패=항상 기부)', () => {
  const ps = [p('a', 'failed'), p('b', 'gave_up'), p('c', 'failed')];
  const r = settleBet(ps);
  assert.deepEqual(r, { issued: [], donated: ['order-a', 'order-b', 'order-c'], refunded: [] });
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

test('commitment 1인 — 완주 시 수령, 미완주 시 기부 (실패=기부 일관)', () => {
  assert.deepEqual(settleBet([p('a', 'completed')]).issued, ['order-a']);
  assert.deepEqual(settleBet([p('a', 'failed')]).donated, ['order-a']);
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

test('commitment — self·group 동일 (실패는 어느 쪽이든 기부, 모드 분기 없음)', () => {
  const ps = [p('a', 'failed')];
  assert.deepEqual(settleBet(ps).donated, ['order-a']);                    // group commitment: 실패 → 기부
  assert.deepEqual(settleBet(ps, { mode: 'self' }).donated, ['order-a']);  // self commitment: 실패 → 기부
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

// ─── ② 완주 기부 서약 (donationMode: 'pledge') — 완주자 기부 / 미완주자 환불 ─────
test('서약 — 전원 완주 → 전원 함께 기부 (받기 없음)', () => {
  const ps = [p('a', 'completed'), p('b', 'completed', true), p('c', 'completed')];
  const r = settleBet(ps, { mode: 'group', donationMode: 'pledge' });
  assert.deepEqual(r, { issued: [], donated: ['order-a', 'order-b', 'order-c'], refunded: [] });
  assert.equal(settlementInvariantHolds(ps, r), true);
});

test('서약 — 일부만 완주 → 완주자만 기부, 미완주자는 환불(돈 안 나감)', () => {
  const ps = [p('a', 'completed'), p('b', 'failed'), p('c', 'gave_up')];
  const r = settleBet(ps, { mode: 'group', donationMode: 'pledge' });
  assert.deepEqual(r.donated, ['order-a']);              // 완주자만 기부
  assert.deepEqual(r.refunded, ['order-b', 'order-c']);  // 미완주·포기 환불 (불이익 = 기부 자격 없음)
  assert.deepEqual(r.issued, []);
  assert.equal(settlementInvariantHolds(ps, r), true);
});

test('서약 — 전원 미완주 → 전원 환불', () => {
  const ps = [p('a', 'failed'), p('b', 'gave_up')];
  const r = settleBet(ps, { mode: 'group', donationMode: 'pledge' });
  assert.deepEqual(r, { issued: [], donated: [], refunded: ['order-a', 'order-b'] });
});

test('서약 — 완주자의 donateChoice 는 무시 (서약 모드는 완주=무조건 기부)', () => {
  // donateChoice=false 여도 받기가 아니라 기부
  const r = settleBet([p('a', 'completed', false)], { mode: 'group', donationMode: 'pledge' });
  assert.deepEqual(r.donated, ['order-a']);
  assert.deepEqual(r.issued, []);
});

test('서약 — 나와의 내기(self): 완주 → 기부 / 실패 → 환불', () => {
  assert.deepEqual(settleBet([p('a', 'completed')], { mode: 'self', donationMode: 'pledge' }).donated, ['order-a']);
  assert.deepEqual(settleBet([p('a', 'failed')], { mode: 'self', donationMode: 'pledge' }).refunded, ['order-a']);
});

// ─── ③ 무조건 기부 (donationMode: 'always') — 완주 여부 무관 전원 기부 ─────
test('무조건 — 완주·미완주 섞여도 전원 기부', () => {
  const ps = [p('a', 'completed'), p('b', 'failed'), p('c', 'gave_up', true)];
  const r = settleBet(ps, { mode: 'group', donationMode: 'always' });
  assert.deepEqual(r, { issued: [], donated: ['order-a', 'order-b', 'order-c'], refunded: [] });
  assert.equal(settlementInvariantHolds(ps, r), true);
});

test('무조건 — 나와의 내기(self): 완주든 실패든 기부', () => {
  assert.deepEqual(settleBet([p('a', 'completed')], { mode: 'self', donationMode: 'always' }).donated, ['order-a']);
  assert.deepEqual(settleBet([p('a', 'failed')], { mode: 'self', donationMode: 'always' }).donated, ['order-a']);
});

// ─── 중단(aborted)은 모드보다 우선 — 전원 환불 ─────
test('중단 — pledge·always 모드여도 aborted 면 전원 환불', () => {
  const ps = [p('a', 'completed'), p('b', 'failed')];
  for (const donationMode of ['commitment', 'pledge', 'always'] as const) {
    const r = settleBet(ps, { mode: 'group', donationMode, aborted: true });
    assert.deepEqual(r, { issued: [], donated: [], refunded: ['order-a', 'order-b'] }, `mode=${donationMode}`);
  }
});

test('기본값 — donationMode 미지정은 commitment (기존 동작 보존)', () => {
  const ps = [p('a', 'completed'), p('b', 'failed')];
  assert.deepEqual(settleBet(ps), settleBet(ps, { donationMode: 'commitment' }));
});

test('인변량 — 전 donationMode × outcome × donateChoice × aborted 조합에서 증발·중복 없음 (전수)', () => {
  const outcomes: BetParticipant['outcome'][] = ['completed', 'failed', 'gave_up'];
  const modes = ['group', 'self'] as const;
  const donationModes = ['commitment', 'pledge', 'always'] as const;
  for (const o1 of outcomes) for (const o2 of outcomes) {
    for (const donate of [false, true]) {
      const ps = [p('a', o1, donate), p('b', o2)];
      for (const mode of modes) for (const donationMode of donationModes) for (const aborted of [false, true]) {
        const r = settleBet(ps, { mode, donationMode, aborted });
        assert.equal(
          settlementInvariantHolds(ps, r), true,
          `인변량 위반: ${o1}/${o2} donate=${donate} mode=${mode} donationMode=${donationMode} aborted=${aborted}`,
        );
      }
    }
  }
});

// 참여자 간 이전 0 — 모든 모드에서 "남의 주문이 내 결과에 섞이지 않는다" (도박 구성요건 차단)
test('이전 0 — 모든 모드 결과는 입력 주문의 순열일 뿐 (외부 주문 유입 없음)', () => {
  const ps = [p('a', 'completed'), p('b', 'failed'), p('c', 'gave_up', true)];
  const ids = new Set(ps.map(x => x.orderId));
  for (const donationMode of ['commitment', 'pledge', 'always'] as const) {
    const r = settleBet(ps, { mode: 'group', donationMode });
    for (const id of [...r.issued, ...r.donated, ...r.refunded]) {
      assert.equal(ids.has(id), true, `외부 주문 유입: ${id} (mode=${donationMode})`);
    }
  }
});
