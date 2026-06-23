// 🚀 ErrorState — 네트워크/RLS/알 수 없는 에러 공통 표시
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { CloudOff } from 'lucide-react-native';
import { Button } from './Button';
import { colors, fontFamily, fontSize, fontWeight } from '@/lib/tokens';
import { t } from '@/lib/i18n';

type Props = {
  message?: string;
  onRetry?: () => void;
};

export function ErrorState({ message, onRetry }: Props) {
  return (
    <View style={styles.wrap}>
      <View style={styles.emoji}><CloudOff size={56} color={colors.faint} strokeWidth={1.5} /></View>
      <Text style={styles.title}>{t('error.title')}</Text>
      {message ? <Text style={styles.message}>{message}</Text> : null}
      {onRetry ? (
        <Button label={t('common.retry')} size="md" onPress={onRetry} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 12,
  },
  emoji: { marginBottom: 4 },
  title: {
    fontSize: fontSize.xl,
    color: colors.primary,
    fontFamily: fontFamily.bold,
    fontWeight: fontWeight.bold,
  },
  message: {
    fontSize: fontSize.sm,
    color: colors.primary500,
    fontFamily: fontFamily.regular,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 8,
  },
});
