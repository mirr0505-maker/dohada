// 🚀 조직 영역 공용 입력 칸 — 라벨 + TextInput (가입·로그인·코드 화면)
import React from 'react';
import { View, Text, TextInput, StyleSheet, TextInputProps } from 'react-native';
import { colors, fontFamily, fontSize, fontWeight, radius } from '@/lib/tokens';

type Props = TextInputProps & { label: string; hint?: string };

export function OrgField({ label, hint, style, ...input }: Props) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <TextInput style={[styles.input, style]} placeholderTextColor={colors.faint} {...input} />
      {!!hint && <Text style={styles.hint}>{hint}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  label: { fontSize: fontSize.sm, color: colors.ink, fontFamily: fontFamily.bold, fontWeight: fontWeight.bold },
  input: {
    backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line,
    paddingHorizontal: 14, paddingVertical: 12, fontSize: fontSize.base, color: colors.ink, fontFamily: fontFamily.regular,
  },
  hint: { fontSize: fontSize.xs, color: colors.sub, fontFamily: fontFamily.regular, lineHeight: 18 },
});
