// 🚀 분야(category) → lucide 아이콘 매핑 (DESIGN_GUIDE.md 13번, 전 화면 고정)
// 키 = categories.slug (DB 의 안정적 키). 어느 화면이든 같은 분야는 같은 아이콘을 쓴다.
// 주의: 건강(health)=HeartPulse — 응원 ❤️/hand-heart 와 충돌하는 하트 아이콘은 분야에 쓰지 않는다.
// 이 매핑을 쓰는 <CategoryIcon> 컴포넌트는 Step 2 에서 만든다.
import {
  HeartPulse,
  Footprints,
  Book,
  Palette,
  Briefcase,
  Coins,
  Globe,
  Users,
  HeartHandshake,
  Ellipsis,
  type LucideIcon,
} from 'lucide-react-native';

export const categoryIcon: Record<string, LucideIcon> = {
  health: HeartPulse,        // 건강
  exercise: Footprints,      // 운동
  learn: Book,               // 학습
  create: Palette,           // 창작
  self: Briefcase,           // 자기계발
  money: Coins,              // 재테크
  life: Globe,               // 라이프
  relation: Users,           // 관계
  impact: HeartHandshake,    // 사회공헌
  other: Ellipsis,           // 기타
};

// slug 가 매핑에 없을 때(신규 분야 등)의 폴백.
export const fallbackCategoryIcon: LucideIcon = Ellipsis;

// slug 로 분야 아이콘 컴포넌트를 안전하게 가져온다.
export function getCategoryIcon(slug: string | null | undefined): LucideIcon {
  if (!slug) return fallbackCategoryIcon;
  return categoryIcon[slug] ?? fallbackCategoryIcon;
}
