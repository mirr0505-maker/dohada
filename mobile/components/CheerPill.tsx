// 🚀 응원 pill (인증 탭 반응) — 이모지 예외 4종(🔥👏💪❤️) (DESIGN_GUIDE 7번)
// 미선택 = 회색 / 선택 = brand 테두리 + brandTint + 카운트(brand). 높이 42, 이모지 19px.
import React from 'react';
import { Pressable, Text, StyleSheet } from 'react-native';
import { colors, fontFamily, fontSize, fontWeight, radius } from '@/lib/tokens';

export function CheerPill({
  emoji,
  count = 0,
  selected = false,
  onPress,
}: {
  emoji: string;
  count?: number;
  selected?: boolean;
  onPress?: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={[styles.pill, selected && styles.pillOn]}
    >
      <Text style={styles.emoji}>{emoji}</Text>
      {count > 0 && <Text style={styles.count}>{count}</Text>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pill: {
    height: 42,
    minWidth: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingHorizontal: 12,
    borderRadius: radius.pill,
    backgroundColor: colors.lineSoft,   // 미선택 = 회색
    borderWidth: 1.5,
    borderColor: 'transparent',         // 선택 시 brand 로 — 레이아웃 점프 방지용 투명 테두리
  },
  pillOn: {
    backgroundColor: colors.brandTint,
    borderColor: colors.brand,
  },
  emoji: { fontSize: 19 },
  count: {
    fontSize: fontSize.base,
    color: colors.brandInk,
    fontFamily: fontFamily.bold,
    fontWeight: fontWeight.semibold,
  },
});
