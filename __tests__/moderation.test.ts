// 🚀 콘텐츠 검수 순수 로직 테스트 — 자동 테스트 의무 영역 (CLAUDE.md: AI 콘텐츠 검수)
// 금액 사전탐지(다짐=금액 무조건 차단의 빠른 경로)와 Claude 응답 파싱(실패 시 안전 측 block)을 검증.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  containsMoneyAmount, parseModerationVerdict,
} from '../supabase/functions/_shared/moderation/moderation.ts';

// ── 금액 탐지 ──
test('금액 탐지 — 명시적 금액 다양한 형태를 잡는다 (액수 불문)', () => {
  const withMoney = [
    '지면 5000원 줄게', '₩10000', '지면 1만원', '10만 기부',
    '천원', '백만원', '3억 기부', '지면 10,000원', '지면 만 원 줄게',
  ];
  for (const s of withMoney) {
    assert.equal(containsMoneyAmount(s), true, `잡아야 함: ${s}`);
  }
});

test('금액 탐지 — 금액 없는 평범한 다짐은 통과(false)', () => {
  const clean = [
    '지면 커피 사주기', '이기면 기부하기', '지면 청소 해주기',
    '지면 선플 100개', '이기면 칭찬 릴레이', '지면 팔굽혀펴기 50개', '지면 만나서 밥',
  ];
  for (const s of clean) {
    assert.equal(containsMoneyAmount(s), false, `통과해야 함: ${s}`);
  }
});

// ── 검수 응답 파싱 ──
test('파싱 — 정상 allow', () => {
  const r = parseModerationVerdict('{"verdict":"allow","reason":null,"category":null}');
  assert.equal(r.verdict, 'allow');
  assert.equal(r.category, null);
});

test('파싱 — 정상 block (앞뒤 잡담 섞여도 추출)', () => {
  const r = parseModerationVerdict('판단: {"verdict":"block","reason":"고가 상품","category":"luxury"} 끝');
  assert.equal(r.verdict, 'block');
  assert.equal(r.category, 'luxury');
});

test('파싱 — flag verdict 정상 (3b 애매→자동숨김 티어)', () => {
  const r = parseModerationVerdict('{"verdict":"flag","reason":"경계선 표현","category":"ethics"}');
  assert.equal(r.verdict, 'flag');
  assert.equal(r.category, 'ethics');
});

test('파싱 — JSON 없음 → 안전 측 block', () => {
  assert.equal(parseModerationVerdict('그냥 텍스트').verdict, 'block');
});

test('파싱 — 잘못된 verdict 값 → 안전 측 block', () => {
  assert.equal(parseModerationVerdict('{"verdict":"maybe"}').verdict, 'block');
});

test('파싱 — 깨진 JSON → 안전 측 block', () => {
  assert.equal(parseModerationVerdict('{"verdict":"allow",').verdict, 'block');
});
