// 🚀 하루 기준선 — 사용자별 기준 시간대(IANA)로 "오늘"을 판정한다.
//
// 왜 필요한가: 하루 경계가 KST 고정이면 해외 거주·출장 사용자는 인증을 놓친다.
//   런던(BST)에서 KST 자정 = 현지 오후 4시 → 오후 4시 이후 인증이 "내일"로 들어가
//   그날은 미인증, 다음 날은 1일 1회 제약에 막힘 = 이틀이 하루로 뭉개진다.
//
// 저장의 진실원천은 서버다 — proofs.local_date 를 트리거가 박는다(0077).
//   이 파일은 화면 판정("오늘 인증했나", 연속·완주 계산)이 서버와 같은 경계를 쓰게 맞춘다.
export const DEFAULT_TIMEZONE = 'Asia/Seoul';

// 내 정보 → 하루 기준선 에서 고를 수 있는 목록. IANA 이름이라 서머타임은 자동 반영된다.
export const TIMEZONE_OPTIONS: { tz: string; label: string }[] = [
  { tz: 'Asia/Seoul',          label: '서울' },
  { tz: 'Asia/Tokyo',          label: '도쿄' },
  { tz: 'Asia/Shanghai',       label: '상하이·베이징' },
  { tz: 'Asia/Singapore',      label: '싱가포르' },
  { tz: 'Asia/Bangkok',        label: '방콕·하노이' },
  { tz: 'Asia/Dubai',          label: '두바이' },
  { tz: 'Europe/London',       label: '런던' },
  { tz: 'Europe/Paris',        label: '파리·베를린·로마' },
  { tz: 'America/New_York',    label: '뉴욕·토론토' },
  { tz: 'America/Chicago',     label: '시카고' },
  { tz: 'America/Los_Angeles', label: '로스앤젤레스·밴쿠버' },
  { tz: 'Australia/Sydney',    label: '시드니' },
  { tz: 'Pacific/Auckland',    label: '오클랜드' },
  { tz: 'UTC',                 label: '세계표준시(UTC)' },
];

// ─────────────────────────────────────────────
// 활성 기준 시간대 (세션 로드 시 users.timezone 으로 설정)
// ─────────────────────────────────────────────
// 화면 판정은 대부분 동기 함수(stats.ts 등)라 모듈 상태로 들고 있는다.
// 아직 못 읽어온 동안은 기본값(KST) — 지금까지의 동작과 같다.
let activeTimezone = DEFAULT_TIMEZONE;

export function setActiveTimezone(tz: string | null | undefined): void {
  activeTimezone = tz && tz.trim() ? tz.trim() : DEFAULT_TIMEZONE;
}

export function getActiveTimezone(): string {
  return activeTimezone;
}

// 기기의 시간대 (설정 화면에서 "지금 계신 곳" 제안용)
//   Intl 우선 — 의존성 없이 얻는다. 엔진이 지원 안 하면 expo-localization 으로 폴백.
//   (모듈 최상단 import 를 피한 이유: 순수 로직 테스트가 네이티브 모듈 없이 이 파일을 불러온다)
export function getDeviceTimezone(): string {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (tz) return tz;
  } catch {}
  try {
    return require('expo-localization').getCalendars()[0]?.timeZone || DEFAULT_TIMEZONE;
  } catch {
    return DEFAULT_TIMEZONE;
  }
}

// 목록에 있으면 한글 이름, 없으면 IANA 이름 그대로
export function timezoneLabel(tz: string): string {
  return TIMEZONE_OPTIONS.find(o => o.tz === tz)?.label ?? tz;
}

// "UTC+9" · "UTC-7:30" 형태 — 설정 화면 보조 표기용
export function timezoneOffsetLabel(tz: string = activeTimezone): string {
  const min = Math.round(offsetMs(Date.now(), tz) / 60_000);
  const sign = min < 0 ? '-' : '+';
  const abs = Math.abs(min);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  return `UTC${sign}${h}${m ? `:${String(m).padStart(2, '0')}` : ''}`;
}

// ─────────────────────────────────────────────
// 시간대 계산 (Intl 기반, 실패 시 기기 오프셋 폴백)
// ─────────────────────────────────────────────
// Intl.DateTimeFormat 은 RN(Hermes) 엔진에 따라 timeZone 지원이 다를 수 있어 전부 폴백을 둔다.
// 폴백이 기기 오프셋인 이유: 기준 시간대는 기기 시간대에서 제안·확정되는 게 보통이라 가장 가깝다.
type Parts = { y: number; mo: number; d: number; h: number; mi: number; s: number };

function tzParts(ms: number, tz: string): Parts | null {
  try {
    const dtf = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hour12: false,
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    });
    const map: Record<string, string> = {};
    for (const part of dtf.formatToParts(new Date(ms))) map[part.type] = part.value;
    if (!map.year || !map.month || !map.day) return null;
    return {
      y: Number(map.year), mo: Number(map.month), d: Number(map.day),
      h: Number(map.hour) % 24,           // 자정을 24 로 주는 엔진 대비
      mi: Number(map.minute), s: Number(map.second),
    };
  } catch {
    return null;
  }
}

// 그 시각의 시간대 오프셋(ms). Intl 을 못 쓰면 기기 오프셋.
function offsetMs(ms: number, tz: string): number {
  const p = tzParts(ms, tz);
  if (!p) return -new Date(ms).getTimezoneOffset() * 60_000;
  const asUtc = Date.UTC(p.y, p.mo - 1, p.d, p.h, p.mi, p.s);
  return Math.round((asUtc - Math.floor(ms / 1000) * 1000) / 60_000) * 60_000;
}

// "YYYY-MM-DD" (해당 시간대의 날짜)
function dateStrOf(ms: number, tz: string): string {
  const p = tzParts(ms, tz);
  if (p) return `${p.y}-${String(p.mo).padStart(2, '0')}-${String(p.d).padStart(2, '0')}`;
  const shifted = new Date(ms + offsetMs(ms, tz));
  return shifted.toISOString().slice(0, 10);
}

// 그 시간대의 자정(00:00)에 해당하는 UTC 시각(ms).
// 오프셋은 시각에 따라 달라지므로(서머타임 경계) 두 번 계산해 수렴시킨다.
function localMidnightMs(dateStr: string, tz: string): number {
  const [y, mo, d] = dateStr.split('-').map(Number);
  const naive = Date.UTC(y, mo - 1, d);
  const guess = naive - offsetMs(naive, tz);
  return naive - offsetMs(guess, tz);
}

// ─────────────────────────────────────────────
// 공개 API — 앱 전체의 "오늘"
// ─────────────────────────────────────────────
// 사용: supabase 쿼리에서 .gte('created_at', getTodayRange().startUtc).lt(..., .endUtc)
export function getTodayRange(): { startUtc: string; endUtc: string; dateStr: string } {
  const nowMs = Date.now();
  const tz = activeTimezone;
  const dateStr = dateStrOf(nowMs, tz);
  const startMs = localMidnightMs(dateStr, tz);
  // 다음 날 자정으로 끝을 잡는다 — 서머타임 전환일(23·25시간)에도 경계가 정확하다
  const nextStr = dateStrOf(startMs + 36 * 3_600_000, tz);
  const endMs = localMidnightMs(nextStr, tz);
  return {
    startUtc: new Date(startMs).toISOString(),
    endUtc: new Date(endMs).toISOString(),
    dateStr,
  };
}

// 기준 시간대의 현재 시각(0~23) — 아침/저녁 프롬프트 분기 등
export function getLocalHour(): number {
  const p = tzParts(Date.now(), activeTimezone);
  return p ? p.h : new Date().getHours();
}

// ISO timestamp → 기준 시간대의 날짜 문자열 (인증을 "어느 날" 했는지 묶을 때)
export function toLocalDateStr(iso: string): string {
  return dateStrOf(new Date(iso).getTime(), activeTimezone);
}
