// 🚀 표시 포맷 — 조용한 SNS (통합기획서 v3.5) 정책
// 큰 숫자 단독 노출은 비교 압박을 만든다.
// 0~99 는 그대로, 100+ 는 '99+' 로 통일 → "이건 비교의 대상이 아니다" 시각 약속.
export function formatCheerCount(n: number): string {
  if (n < 0) return '0';
  return n >= 100 ? '99+' : String(n);
}
