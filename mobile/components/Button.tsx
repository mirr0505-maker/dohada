// 🚀 공통 버튼 — prototype HTML 의 .btn 시리즈 변환
import React from 'react';
import { Pressable, Text, StyleSheet, ViewStyle, TextStyle } from 'react-native';
import { colors, fontFamily, fontSize, fontWeight, radius } from '@/lib/tokens';

type Variant = 'primary' | 'secondary' | 'outline' | 'ghost';
type Size = 'md' | 'lg' | 'xl';

type Props = {
  label: string;
  onPress?: () => void;
  variant?: Variant;
  size?: Size;
  block?: boolean;       // 가로 가득 채움
  disabled?: boolean;
  leftIcon?: React.ReactNode;
  style?: ViewStyle;
};

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'lg',
  block = false,
  disabled = false,
  leftIcon,
  style,
}: Props) {
  const containerStyle: ViewStyle = {
    ...styles.base,
    ...sizeMap[size].container,
    ...variantMap[variant].container,
    ...(block ? { alignSelf: 'stretch' } : {}),
    ...(disabled ? { opacity: 0.5 } : {}),
    ...style,
  };
  const labelStyle: TextStyle = {
    ...sizeMap[size].label,
    ...variantMap[variant].label,
  };

  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      style={({ pressed }) => [
        containerStyle,
        pressed && !disabled ? { opacity: 0.85 } : null,
      ]}
    >
      {leftIcon}
      <Text style={labelStyle}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: radius.lg,
  },
});

const sizeMap = {
  md: {
    container: { paddingVertical: 12, paddingHorizontal: 16 } as ViewStyle,
    label: { fontSize: fontSize.base, fontWeight: fontWeight.semibold } as TextStyle,
  },
  lg: {
    container: { paddingVertical: 14, paddingHorizontal: 20 } as ViewStyle,
    label: { fontSize: fontSize.lg, fontWeight: fontWeight.semibold } as TextStyle,
  },
  xl: {
    container: { paddingVertical: 18, paddingHorizontal: 24 } as ViewStyle,
    label: { fontSize: fontSize.lg, fontWeight: fontWeight.bold } as TextStyle,
  },
};

const variantMap = {
  primary: {
    container: { backgroundColor: colors.accent } as ViewStyle,
    label: { color: colors.surface, fontFamily: fontFamily.bold } as TextStyle,
  },
  secondary: {
    container: { backgroundColor: colors.primary } as ViewStyle,
    label: { color: colors.surface, fontFamily: fontFamily.bold } as TextStyle,
  },
  outline: {
    container: {
      backgroundColor: 'transparent',
      borderWidth: 1,
      borderColor: colors.primary100,
    } as ViewStyle,
    label: { color: colors.primary, fontFamily: fontFamily.medium } as TextStyle,
  },
  ghost: {
    container: { backgroundColor: 'transparent' } as ViewStyle,
    label: { color: colors.primary500, fontFamily: fontFamily.medium } as TextStyle,
  },
};
