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
