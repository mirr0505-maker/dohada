// 🚀 Do : 하다 — 디자인 토큰
// prototype/do-hada-app-v4.html 의 :root 변수 그대로 추출.
// 직접 컬러/폰트/여백을 정의하지 말고 항상 이 파일에서 import.

// ─── 컬러 ─────────────────────────────────────
export const colors = {
  primary: '#1A1A1A',
  primary700: '#404040',
  primary500: '#737373',
  primary300: '#A3A3A3',
  primary100: '#E5E5E5',
  primary50: '#F5F5F5',

  accent700: '#E55A2B',
  accent: '#FF6B35',      // 메인 오렌지 (Do : 하다 핵심 컬러)
  accent100: '#FFE4D6',
  accent50: '#FFF4ED',

  background: '#FAFAFA',
  surface: '#FFFFFF',

  success: '#22C55E',
  warning: '#F59E0B',
  danger: '#EF4444',
  info: '#3B82F6',

  // 챌린지 타입 라벨 컬러
  typeGeneral: '#737373',
  typeBrand: '#3B82F6',
  typeCeleb: '#F59E0B',
  typePublic: '#22C55E',

  // ─── 🚀 리디자인 v2 웜 시맨틱 팔레트 (가산식 — 기존 키는 유지, 화면은 Step 3에서 점진 이전) ───
  // 정본 = DESIGN_GUIDE.md 2번. 신규/리팩터 화면은 아래 토큰을 쓴다.
  bg: '#FAF7F2',            // 웜 크림 배경 (기존 background #FAFAFA 대체 예정)
  line: '#ECE6DE',          // 구분선
  lineSoft: '#F1EBE3',      // 더 옅은 구분선
  brand: '#FF6B35',         // 앵커 액션·활성 탭·D-day (= 기존 accent 동일색)
  brandPress: '#E85A28',    // 눌림
  brandTint: '#FFF1E9',     // 브랜드 면색 (응원·오늘의 나)
  brandInk: '#C7461F',      // 브랜드 텍스트
  tintWarm: '#FFF1E9',      // 면색: 응원·오늘의 나
  tintCream: '#FBF3E4',     // 면색: 완주·박제
  tintCreamLine: '#EFE3CE',
  tintSage: '#EDF1EC',      // 면색: 합류·발견
  tintSageLine: '#DCE8E0',
  done: '#5C8A6A',          // 완료/성공 세만틱 — 기존 초록 CTA·💚·🟢 전부 이걸로 대체
  doneTint: '#EAF1EC',
  doneInk: '#4A7657',
  gold: '#B8862F',          // 박제·트로피
  ink: '#2A2622',           // 본문 텍스트
  sub: '#6B645C',           // 보조 텍스트
  faint: '#9B938A',         // 흐린 텍스트
  faint2: '#B0A899',        // 더 흐림
  onBrand: '#FFFFFF',       // 브랜드 위 텍스트
} as const;

// 🚀 연속 인증 마일스톤 메달 색 (3·7·21·49·99·180·365·730일 순, stats.STREAK_MILESTONES 와 인덱스 일치).
// 초반 비비드 → 후반 금속(실버·골드·다이아)으로 격상 — 유튜브 골드 버튼 톤. 게시글 오각형 메달에만 사용.
export const streakTier = [
  '#22C55E',  // 3일  — 초록 (작심삼일 돌파)
  '#14B8A6',  // 7일  — 청록
  '#3B82F6',  // 21일 — 파랑 (습관 형성)
  '#8B5CF6',  // 49일 — 보라 (강력한 습관)
  '#EC4899',  // 99일 — 핑크 (백일의 약속)
  '#9CA3AF',  // 180일 — 실버
  '#EAB308',  // 365일 — 골드 (1년)
  '#22D3EE',  // 730일 — 다이아 (2년)
] as const;

// ─── 폰트 ─────────────────────────────────────
// Pretendard OTF 3개를 _layout.tsx 의 useFonts 에서 로드. iOS/Android 동일 이름.
export const fontFamily = {
  regular: 'Pretendard-Regular',
  medium: 'Pretendard-Medium',
  bold: 'Pretendard-Bold',
};

export const fontSize = {
  xs: 11,
  sm: 12,
  base: 14,
  md: 15,
  lg: 16,
  xl: 18,
  '2xl': 20,
  '3xl': 24,
  '4xl': 28,
  '5xl': 32,
  '6xl': 40,
} as const;

export const fontWeight = {
  regular: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,
  extrabold: '800' as const,
};

// 🚀 리디자인 v2 타이포 역할 (DESIGN_GUIDE.md 3번). 섹션 제목을 일부러 작게(14) — 무게는 면색·여백으로.
// Pretendard OTF 가 Regular/Medium/Bold 3종만 로드돼 600(semibold)은 Bold OTF 로 렌더한다.
export const textStyle = {
  greeting: { fontSize: fontSize['3xl'], fontFamily: fontFamily.bold, fontWeight: fontWeight.bold },     // 24/700
  section: { fontSize: fontSize.base, fontFamily: fontFamily.bold, fontWeight: fontWeight.bold },         // 14/700 (작은 안내판)
  cardTitle: { fontSize: fontSize.lg, fontFamily: fontFamily.bold, fontWeight: fontWeight.semibold },     // 16/600
  body: { fontSize: fontSize.base, fontFamily: fontFamily.regular, fontWeight: fontWeight.regular },      // 14/400
  caption: { fontSize: fontSize.sm, fontFamily: fontFamily.medium, fontWeight: fontWeight.medium },       // 12/500
  button: { fontSize: fontSize.md, fontFamily: fontFamily.bold, fontWeight: fontWeight.bold },            // 15/700
} as const;

// ─── 여백 ─────────────────────────────────────
export const spacing = {
  '0.5': 2,
  '1': 4,
  '2': 8,
  '3': 12,
  '4': 16,
  '5': 20,
  '6': 24,
  '7': 28,
  '8': 32,
  '10': 40,
  '12': 48,
  '16': 64,
} as const;

// ─── 모서리 ─────────────────────────────────────
export const radius = {
  sm: 8,
  md: 12,
  lg: 14,
  xl: 16,
  '2xl': 20,
  '3xl': 24,
  pill: 999,
} as const;

// ─── 그림자 ─────────────────────────────────────
// iOS / Android 양쪽에서 비슷한 효과를 내려면 elevation + shadow* 묶음 필요.
export const shadow = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 6,
  },
} as const;
