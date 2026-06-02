// 🚀 Splash 화면 — 프로토타입 screen-splash
import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { Screen } from '@/components/Screen';
import { BrandMark } from '@/components/BrandMark';
import { colors, fontFamily, fontSize, fontWeight } from '@/lib/tokens';

export default function SplashScreen() {
  return (
    <Screen fullScreen backgroundColor={colors.accent} statusBarStyle="light">
      <Pressable style={styles.tapArea} onPress={() => router.push('/onb1')}>
        <View style={styles.center}>
          <BrandMark size="xl" color={colors.surface} />
          <Text style={styles.title}>Do : 하다</Text>
          <Text style={styles.tagline}>더 나은 나, 더 나은 세상</Text>
          <Text style={styles.subTagline}>나의 도전이 나와 세상을 바꾼다</Text>
        </View>
        <Text style={styles.tap}>탭하여 시작 →</Text>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  tapArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 80,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  logo: {
    fontSize: fontSize['5xl'],
    color: colors.surface,
    fontFamily: fontFamily.bold,
  },
  title: {
    fontSize: fontSize['6xl'],
    color: colors.surface,
    fontFamily: fontFamily.bold,
    fontWeight: fontWeight.extrabold,
    letterSpacing: -1,
  },
  tagline: {
    fontSize: fontSize.lg,
    color: colors.surface,
    fontFamily: fontFamily.medium,
    marginTop: 8,
  },
  subTagline: {
    fontSize: fontSize.sm,
    color: 'rgba(255,255,255,0.85)',
    fontFamily: fontFamily.regular,
  },
  tap: {
    fontSize: fontSize.sm,
    color: 'rgba(255,255,255,0.7)',
    fontFamily: fontFamily.medium,
  },
});
