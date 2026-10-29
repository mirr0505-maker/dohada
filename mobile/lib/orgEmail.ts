// 🚀 조직 가입 메일 판정 — 개인 메일(gmail·naver 등)로는 조직 계정을 만들 수 없다 (ORG_HADA_PLAN §10.2 A-3)
//
// 클라 1차 검사용. 최종 판정은 서버 SQL is_personal_email_domain (0087) 이 한다.
// ⚠️ 아래 목록은 0087_org_login.sql 의 PERSONAL_EMAIL_DOMAINS 배열과 **같아야 한다** —
//    __tests__/org-signup.test.ts 가 두 목록을 비교한다.
export const PERSONAL_EMAIL_DOMAINS = [
  'gmail.com', 'googlemail.com', 'naver.com', 'daum.net', 'hanmail.net', 'kakao.com', 'nate.com',
  'hotmail.com', 'outlook.com', 'live.com', 'msn.com', 'icloud.com', 'me.com', 'mac.com',
  'yahoo.com', 'yahoo.co.kr', 'proton.me', 'protonmail.com',
] as const;

// '@' 뒤 도메인 (소문자·공백 제거). 형식이 아니면 빈 문자열.
export function emailDomain(email: string): string {
  const trimmed = email.trim().toLowerCase();
  const at = trimmed.lastIndexOf('@');
  if (at <= 0 || at === trimmed.length - 1) return '';
  return trimmed.slice(at + 1);
}

// 정확히 일치할 때만 개인 메일 — 회사 서브도메인(hr.company.co.kr)은 통과해야 한다
export function isPersonalEmailDomain(email: string): boolean {
  return (PERSONAL_EMAIL_DOMAINS as readonly string[]).includes(emailDomain(email));
}

// 코드 요청 전 형식 검사 — 아주 느슨하게(서버가 실제 발송으로 최종 확인)
export function isLikelyEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

// 🚀 0090: 개인 메일로 가입할 수 있는 유형 — 개인사업자·모임만 (서버 submit_org_application 과 같은 규칙)
//   기업·비영리·공공은 조직 도메인 메일이 곧 '이 조직의 계정'이라는 증명이라 개인 메일을 받지 않는다.
export const PERSONAL_EMAIL_ALLOWED_TYPES = ['sole', 'group'] as const;

export function personalEmailAllowed(orgType: string): boolean {
  return (PERSONAL_EMAIL_ALLOWED_TYPES as readonly string[]).includes(orgType);
}
