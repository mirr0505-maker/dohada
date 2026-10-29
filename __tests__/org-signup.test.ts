// 🚀 조직 가입 메일 판정 — 인증/권한 = 자동 테스트 의무 영역 (ORG_HADA_PLAN §10.2 A-3)
// 개인 메일로 조직 계정이 만들어지면 아무나 "공식" 신청을 할 수 있다. 클라(orgEmail.ts)와 서버(0087 SQL)
// 두 목록이 어긋나면 "앱은 통과시켰는데 서버가 거부" 또는 그 반대가 된다 → 목록 동일성을 여기서 지킨다.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PERSONAL_EMAIL_DOMAINS, emailDomain, isPersonalEmailDomain, isLikelyEmail, personalEmailAllowed } from '../mobile/lib/orgEmail.ts';

test('개인 메일 도메인은 거부', () => {
  for (const email of ['a@gmail.com', 'b@naver.com', 'c@daum.net', 'd@hanmail.net', 'e@kakao.com', 'f@icloud.com']) {
    assert.equal(isPersonalEmailDomain(email), true, email);
  }
});

test('대소문자·앞뒤 공백 무관', () => {
  assert.equal(isPersonalEmailDomain('  Park@GMAIL.com '), true);
  assert.equal(emailDomain('  Walk@SKHynix.COM '), 'skhynix.com');
});

test('조직 메일·회사 서브도메인은 통과', () => {
  assert.equal(isPersonalEmailDomain('walk@skhynix.com'), false);
  assert.equal(isPersonalEmailDomain('team@hr.company.co.kr'), false);
  assert.equal(isPersonalEmailDomain('health@city.cheongju.go.kr'), false);
  assert.equal(isPersonalEmailDomain('doinnovation@doinno.co.kr'), false);
});

test('개인 도메인을 흉내 낸 회사 도메인은 통과 (정확 일치만 차단)', () => {
  assert.equal(isPersonalEmailDomain('a@gmail.com.example.kr'), false);
  assert.equal(isPersonalEmailDomain('a@mail.naver.com'), false);
});

test('형식이 아니면 도메인 없음', () => {
  assert.equal(emailDomain('no-at-sign'), '');
  assert.equal(emailDomain('@gmail.com'), '');
  assert.equal(emailDomain('trailing@'), '');
  assert.equal(isLikelyEmail('walk@skhynix.com'), true);
  assert.equal(isLikelyEmail('walk@skhynix'), false);
  assert.equal(isLikelyEmail('wa lk@skhynix.com'), false);
});

test('클라 목록 = 서버 SQL 목록 (0087 PERSONAL_EMAIL_DOMAINS)', () => {
  const sql = readFileSync(new URL('../supabase/migrations/0087_org_login.sql', import.meta.url), 'utf8');
  const block = sql.split('-- PERSONAL_EMAIL_DOMAINS:BEGIN')[1]?.split('-- PERSONAL_EMAIL_DOMAINS:END')[0];
  assert.ok(block, 'SQL 에 PERSONAL_EMAIL_DOMAINS 표식이 있어야 한다');
  const sqlDomains = [...block.matchAll(/'([^']+)'/g)].map((m) => m[1]).sort();
  assert.deepEqual(sqlDomains, [...PERSONAL_EMAIL_DOMAINS].sort());
});

test('개인 메일 허용 유형 = 개인사업자·모임만 (0090)', () => {
  assert.equal(personalEmailAllowed('sole'), true);
  assert.equal(personalEmailAllowed('group'), true);
  for (const t of ['company', 'nonprofit', 'public', '']) assert.equal(personalEmailAllowed(t), false, t);
});

test('개인 메일 허용 유형 = 서버 SQL 조건 (0090 submit_org_application)', () => {
  const sql = readFileSync(new URL('../supabase/migrations/0090_group_sole_tracks.sql', import.meta.url), 'utf8');
  assert.ok(sql.includes("and p_org_type not in ('sole', 'group')"), '서버 조건이 sole·group 이어야 한다');
});
