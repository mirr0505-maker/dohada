// 🚀 ListRow — 좌측 라인 아이콘 + 라벨(+보조) + 우측 텍스트 + chevron (DESIGN_GUIDE 14번)
// 설정·프로필 내역 등 좌측정렬 리스트 행에 공통 사용. design_final 의 .setrow / .listline 기준.
import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { ChevronRight, type LucideIcon } from 'lucide-react-native';
import { colors, fontFamily, fontSize, fontWeight } from '@/lib/tokens';

export function ListRow({
  icon: Icon,
  label,
  sub,
  rightText,
  onPress,
  showChevron = true,
}: {
  icon?: LucideIcon;
  label: string;
  sub?: string;
  rightText?: string;
  onPress?: () => void;
  showChevron?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      style={styles.row}
    >
      {Icon && <Icon size={19} color={colors.sub} strokeWidth={1.8} />}
      <View style={styles.textWrap}>
        <Text style={styles.label}>{label}</Text>
        {sub ? <Text style={styles.sub}>{sub}</Text> : null}
      </View>
      {rightText ? <Text style={styles.rightText}>{rightText}</Text> : null}
      {showChevron ? <ChevronRight size={18} color={colors.faint2} strokeWidth={1.8} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 15,
    paddingHorizontal: 16,
  },
  textWrap: { flex: 1 },
  label: {
    fontSize: fontSize.md,
    color: colors.ink,
    fontFamily: fontFamily.regular,
    fontWeight: fontWeight.regular,
  },
  sub: {
    fontSize: fontSize.sm,
    color: colors.faint,
    fontFamily: fontFamily.regular,
    marginTop: 1,
  },
  rightText: {
    fontSize: fontSize.sm,
    color: colors.faint,
    fontFamily: fontFamily.regular,
  },
});
