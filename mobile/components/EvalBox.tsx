// 🚀 평가 박스 1칸 (하다 구경) — 이모지 예외 4종(✨기발 😱대단 🥹뭉클 💫새로움) (DESIGN_GUIDE 7번)
// 화면에서 4칸을 가로로 배치. 선택 = brand 테두리 + brandTint. 이모지 24px.
import React from 'react';
import { Pressable, Text, StyleSheet } from 'react-native';
import { colors, fontFamily, fontSize, fontWeight, radius } from '@/lib/tokens';

export function EvalBox({
  emoji,
  label,
  count = 0,
  selected = false,
  onPress,
}: {
  emoji: string;
  label: string;
  count?: number;
  selected?: boolean;
  onPress?: () => void;
}) {
  const fg = selected ? colors.brandInk : colors.sub;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${label} ${count}`}
      style={[styles.box, selected && styles.boxOn]}
    >
      <Text style={styles.emoji}>{emoji}</Text>
      <Text style={[styles.label, { color: fg }]}>{label}</Text>
      <Text style={[styles.count, { color: selected ? colors.brandInk : colors.faint }]}>{count}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  box: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderRadius: radius.md,
    backgroundColor: colors.bg,         // 미선택 = 옅은 웜 면
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  boxOn: {
    backgroundColor: colors.brandTint,
    borderColor: colors.brand,
  },
  emoji: { fontSize: 24 },
  label: {
    fontSize: fontSize.sm,
    fontFamily: fontFamily.medium,
    fontWeight: fontWeight.medium,
  },
  count: {
    fontSize: fontSize.sm,
    fontFamily: fontFamily.bold,
    fontWeight: fontWeight.semibold,
  },
});
