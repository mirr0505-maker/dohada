// 🚀 표시 포맷 — 조용한 SNS (통합기획서 v3.5) 정책
// 큰 숫자 단독 노출은 비교 압박을 만든다.
// 0~99 는 그대로, 100+ 는 '99+' 로 통일 → "이건 비교의 대상이 아니다" 시각 약속.
export function formatCheerCount(n: number): string {
  if (n < 0) return '0';
  return n >= 100 ? '99+' : String(n);
}

// 🚀 0075: 원화 표시 — 완주 매칭 기부의 약정 금액·누적 매칭액.
// ⚠️ 위 formatCheerCount 의 '99+' 약화를 여기에 적용하면 안 된다.
//    그건 응원·평가 카운트의 비교 압박을 피하려는 정책이고, 이 금액은 조직이 공개한 약속이라 정확해야 한다(표시광고).
export function formatWon(amount: number): string {
  return `${Math.max(0, Math.round(amount)).toLocaleString('ko-KR')}원`;
}

// 🚀 제목 표시 정리 — 맨 앞 이모지(+뒤따르는 공백) 1덩어리 제거.
// 옛 추천 제목("📚 100일 책 읽기")이나 사용자가 앞에 붙인 이모지를 표시 시점에 가린다
// (DB 원본은 보존 — 리디자인 "8개 예외 외 이모지 금지" 정체성을 기존 데이터에도 적용).
// 본문 중간 이모지·한글·영문은 건드리지 않음. 전부 이모지면 원본 유지.
export function displayTitle(title: string | null | undefined): string {
  if (!title) return '';
  // /u 플래그·astral \u{} 없이 BMP 이스케이프 + 서러게이트 페어로 매칭 — 구형 Hermes 포함 전 엔진 안전.
  // 맨 앞: (astral 이모지 | BMP 기호·딩벳·화살표) + 변형선택자(FE0F)/ZWJ(200D) + 공백 의 반복 덩어리.
  const stripped = title.replace(
    /^(?:(?:[\uD800-\uDBFF][\uDC00-\uDFFF]|[☀-➿⬀-⯿←-⇿])[️‍]*\s*)+/,
    '',
  );
  return stripped.length > 0 ? stripped : title;
}

// 🚀 "오늘"의 경계 판정은 lib/timezone.ts 로 옮겼다 — 사용자별 기준 시간대(0077).
//   하루 경계가 KST 고정이면 해외 거주·출장 사용자가 인증을 놓친다(런던 오후 4시 = KST 자정).
//   기존 호출부가 '@/lib/format' 에서 그대로 가져다 쓰도록 여기서 재수출한다.
export { getTodayRange } from './timezone';

export function getChallengeDDay(startStr: string, endStr: string): string {
  const today = new Date().toISOString().slice(0, 10);
  if (today < startStr) return '시작 대기';
  if (today > endStr) return '하다 종료';
  
  const t = new Date(today + 'T00:00:00');
  const s = new Date(startStr + 'T00:00:00');
  const e = new Date(endStr + 'T00:00:00');
  
  const total = Math.round((e.getTime() - s.getTime()) / 86_400_000) + 1;
  const current = Math.round((t.getTime() - s.getTime()) / 86_400_000) + 1;
  const dday = Math.round((e.getTime() - t.getTime()) / 86_400_000);
  
  return `D-${dday} (${current}/${total}일)`;
}
