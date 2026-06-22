// 🚀 상태 배지 — 완료(세이지) / 인증 전(코랄) tag (DESIGN_GUIDE 14번, design_final 내 하다 카드)
// done = 완료/성공 세만틱(세이지), todo = 아직 인증 안 함(브랜드 코랄톤). 형광초록 금지.
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Check, Pencil } from 'lucide-react-native';
import { colors, fontFamily, fontSize, fontWeight, radius } from '@/lib/tokens';

export function StatusBadge({ status }: { status: 'done' | 'todo' }) {
  const done = status === 'done';
  const Icon = done ? Check : Pencil;
  const fg = done ? colors.doneInk : colors.brandInk;
  const bg = done ? colors.doneTint : colors.brandTint;
  return (
    <View style={[styles.tag, { backgroundColor: bg }]}>
      <Icon size={13} color={fg} strokeWidth={2} />
      <Text style={[styles.label, { color: fg }]}>{done ? '완료' : '인증 전'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: radius.pill,
  },
  label: {
    fontSize: fontSize.sm,
    fontFamily: fontFamily.medium,
    fontWeight: fontWeight.medium,
  },
});
