// 🚀 하루 기준선 — 기준 시간대별 "오늘" 경계 (0077)
// 완주·연속 판정이 전부 이 경계 위에 서 있어서, 여기가 틀리면 인증이 하루씩 밀린다.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  setActiveTimezone, getActiveTimezone, toLocalDateStr, getTodayRange, DEFAULT_TIMEZONE,
} from '../mobile/lib/timezone.ts';

test('기본값은 KST — 설정 전에는 지금까지의 동작 그대로', () => {
  setActiveTimezone(null);
  assert.equal(getActiveTimezone(), DEFAULT_TIMEZONE);
  // 2026-06-05 23:00 UTC = KST 06-06 08:00
  assert.equal(toLocalDateStr('2026-06-05T23:00:00.000Z'), '2026-06-06');
});

test('런던 — KST 로는 다음날인 저녁 인증이 현지 그날로 묶인다', () => {
  setActiveTimezone('Europe/London');
  // 런던(BST) 06-05 20:00 = 19:00Z = KST 06-06 04:00
  assert.equal(toLocalDateStr('2026-06-05T19:00:00.000Z'), '2026-06-05');
  setActiveTimezone('Asia/Seoul');
  assert.equal(toLocalDateStr('2026-06-05T19:00:00.000Z'), '2026-06-06');   // 같은 순간, 다른 날
});

test('오늘 범위 — 시작~끝이 정확히 하루이고 시작 시각이 그 시간대의 자정', () => {
  for (const tz of ['Asia/Seoul', 'Europe/London', 'America/Los_Angeles']) {
    setActiveTimezone(tz);
    const { startUtc, endUtc, dateStr } = getTodayRange();
    const startMs = Date.parse(startUtc);
    const endMs = Date.parse(endUtc);
    assert.equal(endMs - startMs, 86_400_000, `${tz}: 하루 길이`);
    assert.equal(toLocalDateStr(startUtc), dateStr, `${tz}: 시작이 오늘의 자정`);
    // 시작 1ms 전은 어제여야 한다 (경계가 정확한가)
    assert.notEqual(toLocalDateStr(new Date(startMs - 1).toISOString()), dateStr, `${tz}: 경계 직전은 어제`);
    // 끝은 다음 날 자정 = 오늘에 포함되지 않는다
    assert.notEqual(toLocalDateStr(endUtc), dateStr, `${tz}: 끝은 내일`);
  }
  setActiveTimezone('Asia/Seoul');
});

test('UTC 기준선 — 오프셋 0 도 동일하게 동작', () => {
  setActiveTimezone('UTC');
  assert.equal(toLocalDateStr('2026-06-05T23:59:59.000Z'), '2026-06-05');
  assert.equal(toLocalDateStr('2026-06-06T00:00:01.000Z'), '2026-06-06');
  setActiveTimezone('Asia/Seoul');
});
