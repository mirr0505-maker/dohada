// 🚀 분야 아이콘 — slug 로 lucide 라인 아이콘을 그린다 (DESIGN_GUIDE 13번)
// 매핑은 lib/icons.ts 단일 소스. 어느 화면이든 같은 분야는 같은 아이콘.
import React from 'react';
import { getCategoryIcon } from '@/lib/icons';
import { colors } from '@/lib/tokens';

export function CategoryIcon({
  slug,
  size = 18,
  color = colors.brandInk,
  strokeWidth = 1.8,   // 가이드: 라인 아이콘 stroke 1.6~1.8
}: {
  slug: string | null | undefined;
  size?: number;
  color?: string;
  strokeWidth?: number;
}) {
  const Icon = getCategoryIcon(slug);
  return <Icon size={size} color={color} strokeWidth={strokeWidth} />;
}
