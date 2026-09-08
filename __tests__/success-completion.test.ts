// 🚀 완주(끝까지 감) vs 성공(임계 달성) — 0078 판정 코어
// 이 판정이 내기 본전 회수·스폰서 매칭 기부·다짐 정산의 근거라 자동 테스트 의무 영역에 붙여 검증한다.
// 핵심: 성공 ≠ 완주. 목표를 다 못 채워도 포기하지 않고 종료일을 지났으면 완주다.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  goalStatus, isSuccess, isShortOfGoal, didFinishThrough,
  countSuccessfulMembers, memberTargetProofCount, PAUSE_CREDIT_RATIO,
} from '../mobile/lib/stats.ts';
import { setActiveTimezone } from '../mobile/lib/timezone.ts';

// 이미 지난 100일짜리 daily 하다 (2020-01-01 ~ 2020-04-09 = 100일, 2020 윤년)
//   과거로 두는 이유: 오늘 날짜와 무관하게 "종료 후" 판정이 고정되도록.
const CH100: any = {
  id: 'c1', creator_id: 'u1', title: '100일 걷기', description: null, kind: 'closed',
  start_date: '2020-01-01', end_date: '2020-04-09', created_at: '2019-12-31T00:00:00Z',
  frequency: 'daily', goal_type: 'cadence', gave_up_at: null,
};

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
const ALL_100 = daysFrom('2020-01-01', 100);

// 인증 목록 — 날짜는 서버가 박아둔 local_date(0077)
function proofsOn(dates: string[], userId = 'me'): any[] {
  return dates.map(d => ({ user_id: userId, local_date: d, created_at: `${d}T12:00:00+09:00` }));
}
const pause = (start_date: string, end_date: string) => ({ start_date, end_date });

// ─── 성공 임계(success_threshold) — 분모 계산 ─────────────────────────────
test('임계 100% — 100일 daily 분모는 100 (기본값·기존 동작)', () => {
  assert.equal(memberTargetProofCount(CH100), 100);
});

test('임계 95% — 100일 daily 분모는 95', () => {
  assert.equal(memberTargetProofCount({ ...CH100, success_threshold: 95 }), 95);
});

test('임계 90% — 100일 daily 분모는 90', () => {
  assert.equal(memberTargetProofCount({ ...CH100, success_threshold: 90 }), 90);
});

test('임계 반올림 경계 — 30일 주3회(=13) × 90% = ceil(11.7) = 12', () => {
  // 2020-01-01 ~ 2020-01-30 = 30일, weekly3 목표 = ceil(30*3/7) = 13
  const ch: any = { ...CH100, end_date: '2020-01-30', frequency: 'weekly3' };
  assert.equal(memberTargetProofCount(ch), 13);
  assert.equal(memberTargetProofCount({ ...ch, success_threshold: 90 }), 12);
  assert.equal(memberTargetProofCount({ ...ch, success_threshold: 95 }), 13);  // ceil(12.35)
});

// ─── 사용자 시나리오 회귀 — 두 축이 갈리는가 ──────────────────────────────
test('100일 · 임계 90% · 인증 92일 · 멈춤 0 → 성공 ✓ 완주 ✓', () => {
  const ch: any = { ...CH100, success_threshold: 90 };
  const proofs = proofsOn(ALL_100.slice(0, 92));
  const { current, target, isSuccess: ok } = goalStatus(ch, proofs);
  assert.equal(target, 90);
  assert.equal(current, 92);
  assert.equal(ok, true);
  assert.equal(didFinishThrough(ch, proofs), true);
});

test('100일 · 임계 100% · 인증 92일 → 미달 ✗ 이지만 완주 ✓ (성공 ≠ 완주)', () => {
  const proofs = proofsOn(ALL_100.slice(0, 92));
  assert.equal(isSuccess(CH100, proofs), false);
  assert.equal(isShortOfGoal(CH100, proofs), true);
  assert.equal(didFinishThrough(CH100, proofs), true);   // 끝까지 갔다 → 박제·해냈어요 자격
});

test('포기(gave_up_at) → 완주 ✗ (목표를 채웠어도)', () => {
  const proofs = proofsOn(ALL_100);
  assert.equal(isSuccess(CH100, proofs), true);
  assert.equal(didFinishThrough(CH100, proofs, null, '2020-03-01T00:00:00Z'), false);
});

test('인증 0회로 종료 → 완주 ✗ (박제할 게 없다)', () => {
  assert.equal(didFinishThrough(CH100, []), false);
  assert.equal(isShortOfGoal(CH100, []), true);
});

test('아직 진행 중이면 완주도 미달도 아니다', () => {
  const ch: any = { ...CH100, start_date: '2099-01-01', end_date: '2099-04-09' };
  const proofs = proofsOn(['2099-01-01']);
  assert.equal(didFinishThrough(ch, proofs), false);
  assert.equal(isShortOfGoal(ch, proofs), false);
  assert.equal(isSuccess(ch, proofs), false);
});

// ─── 잠시 멈춤(challenge_pauses) — 진짜로 목표에서 빼주는가 ─────────────────
test('멈춤 0일 — 분모가 줄지 않는다 (기존 하다 회귀 안전망)', () => {
  assert.equal(memberTargetProofCount(CH100, null, []), 100);
});

test('멈춤 상한 이내(5일) — 분모 100 → 95, 나머지 95일 인증하면 성공', () => {
  const pauses = [pause('2020-02-01', '2020-02-05')];
  assert.equal(memberTargetProofCount(CH100, null, pauses), 95);
  const proofs = proofsOn(ALL_100.filter(d => d < '2020-02-01' || d > '2020-02-05'));
  assert.equal(goalStatus(CH100, proofs, null, pauses).current, 95);
  assert.equal(isSuccess(CH100, proofs, null, pauses), true);
});

test('멈춤 인정일의 인증은 분자에서도 뺀다 — 분모에서 뺀 날은 분자에서도 뺀다', () => {
  const pauses = [pause('2020-01-01', '2020-01-10')];   // 10일 = 상한 딱 맞음
  const proofs = proofsOn(ALL_100);                      // 멈춤 기간에도 인증했다
  const { current, target } = goalStatus(CH100, proofs, null, pauses);
  assert.equal(target, 90);
  assert.equal(current, 90);                             // 100 - 10 (멈춤 인정일 제외)
  assert.equal(isSuccess(CH100, proofs, null, pauses), true);
});

test('멈춤 상한 초과(20일) — 10일만 인정, 초과분은 못 한 날로 세어진다 (완주는 유지)', () => {
  const pauses = [pause('2020-02-01', '2020-02-20')];
  const cap = Math.floor(100 * PAUSE_CREDIT_RATIO);      // 10일
  assert.equal(cap, 10);
  assert.equal(memberTargetProofCount(CH100, null, pauses), 100 - cap);   // 90

  const proofs = proofsOn(ALL_100.filter(d => d < '2020-02-01' || d > '2020-02-20'));  // 80일
  const { current, target } = goalStatus(CH100, proofs, null, pauses);
  assert.equal(target, 90);
  assert.equal(current, 80);                              // 초과 10일이 그냥 못 한 날
  assert.equal(isSuccess(CH100, proofs, null, pauses), false);
  assert.equal(didFinishThrough(CH100, proofs), true);    // 그래도 완주 — 유일한 선택지가 '포기'가 되면 안 된다
});

test('멈춤 구간이 겹쳐도 중복 카운트하지 않는다', () => {
  const pauses = [pause('2020-02-01', '2020-02-03'), pause('2020-02-02', '2020-02-04')];
  // 합집합 4일 → 분모 96 (중복 세면 94)
  assert.equal(memberTargetProofCount(CH100, null, pauses), 96);
  const proofs = proofsOn(ALL_100.filter(d => d < '2020-02-01' || d > '2020-02-04').slice(0, 95));
  assert.equal(isSuccess(CH100, proofs, null, pauses), false);   // 95 < 96
});

test('멈춤 구간은 도전 구간 밖으로 삐져나가도 잘린다', () => {
  const pauses = [pause('2019-12-01', '2020-01-03')];   // 시작 전부터 멈춤
  assert.equal(memberTargetProofCount(CH100, null, pauses), 97);   // 01-01~01-03 = 3일만 인정
});

// ─── 늦합류 — 실효 구간 기준으로 임계·멈춤 상한이 계산되는가 ────────────────
test('늦합류 — 임계 분모가 합류일~종료일 구간 기준', () => {
  const ch: any = { ...CH100, success_threshold: 90 };
  const joinedAt = '2020-03-31T00:00:00+09:00';           // 3/31~4/9 = 10일 구간
  assert.equal(memberTargetProofCount(ch, joinedAt), 9);  // ceil(10 * 0.9)
  assert.equal(memberTargetProofCount(ch), 90);           // 합류일 없으면 전체 기간 기준
});

test('늦합류 — 멈춤 상한도 실효 구간(10일)의 10% = 1일까지만', () => {
  const ch: any = { ...CH100, success_threshold: 90 };
  const joinedAt = '2020-03-31T00:00:00+09:00';
  const pauses = [pause('2020-03-31', '2020-04-09')];     // 구간 전체를 멈춤 신청
  // 상한 = floor(10 * 0.1) = 1일만 인정 → 분모 ceil(9 * 0.9) = 9
  assert.equal(memberTargetProofCount(ch, joinedAt, pauses), 9);
  const proofs = proofsOn(daysFrom('2020-04-02', 8));      // 8일 인증
  assert.equal(isSuccess(ch, proofs, joinedAt, pauses), false);
});

// ─── 해외 기준 시간대 — 날짜 경계가 어긋나지 않는가 ─────────────────────────
test('런던 사용자 — 합류 시각이 현지 날짜로 환산돼 분모가 달라진다', () => {
  const ch: any = { ...CH100, start_date: '2020-06-01', end_date: '2020-06-05' };
  const joinedAt = '2020-06-02T22:00:00.000Z';   // 런던(BST) 06-02 23시 / KST 06-03 07시

  setActiveTimezone('Europe/London');
  assert.equal(memberTargetProofCount(ch, joinedAt), 4);   // 06-02 ~ 06-05
  // 인증 날짜는 local_date 라 재환산하지 않는다
  assert.equal(isSuccess(ch, proofsOn(['2020-06-02', '2020-06-03', '2020-06-04', '2020-06-05']), joinedAt), true);

  setActiveTimezone('Asia/Seoul');
  assert.equal(memberTargetProofCount(ch, joinedAt), 3);   // 같은 순간이지만 06-03 합류
  setActiveTimezone('Asia/Seoul');
});

// ─── 목표 횟수형(count) — 임계는 적용, 멈춤 제외는 미적용 ──────────────────
const CH_COUNT: any = {
  ...CH100, goal_type: 'count', target_count: 100, end_date: '2099-12-31',
};

test('count 유형 — 임계 90% 면 100개 중 90개로 성공', () => {
  const ch: any = { ...CH_COUNT, success_threshold: 90 };
  const proofs = proofsOn(daysFrom('2020-01-01', 90));
  assert.equal(goalStatus(ch, proofs).target, 90);
  assert.equal(isSuccess(ch, proofs), true);
  assert.equal(isSuccess(CH_COUNT, proofs), false);        // 임계 100% 면 미달
});

test('count 유형 — 멈춤은 분모에서 빼지 않는다 (분모가 날짜가 아니라 개수)', () => {
  const pauses = [pause('2020-02-01', '2020-02-20')];
  assert.equal(goalStatus(CH_COUNT, [], null, pauses).target, 100);
});

test('count 유형 — 종료 전이라도 목표를 채우면 성공 ✓ 완주 ✓ (조기 완주)', () => {
  const proofs = proofsOn(daysFrom('2020-01-01', 100));
  assert.equal(isSuccess(CH_COUNT, proofs), true);
  assert.equal(didFinishThrough(CH_COUNT, proofs), true);
});

// ─── 기존 하다 회귀 — 임계 100 + 멈춤 이력 없음이면 종전과 완전히 동일 ──────
test('기존 하다 — 임계·멈춤이 없으면 판정이 종전과 동일', () => {
  assert.equal(memberTargetProofCount(CH100), 100);
  assert.equal(isSuccess(CH100, proofsOn(ALL_100)), true);
  assert.equal(isSuccess(CH100, proofsOn(ALL_100.slice(0, 99))), false);
  assert.equal(isShortOfGoal(CH100, proofsOn(ALL_100)), false);
});

// ─── 성공자 집계 (0075 스폰서 매칭 기부) ────────────────────────────────────
test('성공자 집계 — 멤버별 멈춤을 각자 것으로만 적용', () => {
  const members = [
    { user_id: 'a', joined_at: '2020-01-01T00:00:00+09:00', gave_up_at: null, role: 'member' },
    { user_id: 'b', joined_at: '2020-01-01T00:00:00+09:00', gave_up_at: null, role: 'member' },
  ];
  // 둘 다 90일 인증. a 만 멈춤 10일 인정 → a 는 성공, b 는 미달.
  const proofs: any = [
    ...proofsOn(ALL_100.slice(10), 'a'),
    ...proofsOn(ALL_100.slice(10), 'b'),
  ];
  const pauses = [{ user_id: 'a', start_date: '2020-01-01', end_date: '2020-01-10' }];
  assert.equal(countSuccessfulMembers(CH100, members, proofs, pauses), 1);
});

test('성공자 집계 — 끝까지 갔지만 임계 미달인 사람은 세지 않는다 (약정 금액의 근거)', () => {
  const members = [{ user_id: 'a', joined_at: '2020-01-01T00:00:00+09:00', gave_up_at: null, role: 'member' }];
  const proofs: any = proofsOn(ALL_100.slice(0, 92), 'a');
  assert.equal(didFinishThrough(CH100, proofs), true);            // 완주는 했다
  assert.equal(countSuccessfulMembers(CH100, members, proofs), 0); // 그래도 성공자는 아니다
});
