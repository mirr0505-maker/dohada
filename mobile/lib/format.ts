// 🚀 표시 포맷 — 조용한 SNS (통합기획서 v3.5) 정책
// 큰 숫자 단독 노출은 비교 압박을 만든다.
// 0~99 는 그대로, 100+ 는 '99+' 로 통일 → "이건 비교의 대상이 아니다" 시각 약속.
export function formatCheerCount(n: number): string {
  if (n < 0) return '0';
  return n >= 100 ? '99+' : String(n);
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

// 🚀 KST(Asia/Seoul) 기준 "오늘"의 UTC 경계 ISO — 디바이스 TZ 무관 일관성 확보 (P2-15).
// 사용: supabase 쿼리에서 .gte('created_at', getKstTodayRange().startUtc).lt(..., .endUtc)
//       모든 클라이언트가 동일한 "오늘" 경계로 쿼리하므로 UTC/KST 자정 직후 오/누락 제거.
export function getKstTodayRange(): { startUtc: string; endUtc: string; kstDateStr: string } {
  const nowMs = Date.now();
  const kstNowMs = nowMs + 9 * 60 * 60 * 1000;             // UTC+9
  const kstNow = new Date(kstNowMs);
  const y = kstNow.getUTCFullYear();
  const m = String(kstNow.getUTCMonth() + 1).padStart(2, '0');
  const d = String(kstNow.getUTCDate()).padStart(2, '0');
  const kstDateStr = `${y}-${m}-${d}`;
  // KST 00:00:00 == UTC 15:00:00 (전날). KST 23:59:59.999 == UTC 14:59:59.999 (당일).
  const startUtcMs = Date.UTC(y, kstNow.getUTCMonth(), kstNow.getUTCDate()) - 9 * 60 * 60 * 1000;
  const endUtcMs   = startUtcMs + 24 * 60 * 60 * 1000;
  return {
    startUtc:   new Date(startUtcMs).toISOString(),
    endUtc:     new Date(endUtcMs).toISOString(),
    kstDateStr,
  };
}

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
