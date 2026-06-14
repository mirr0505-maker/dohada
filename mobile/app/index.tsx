// 🚀 Splash 화면 — 프로토타입 screen-splash
// 이미 로그인된 사용자는 온보딩 없이 곧장 홈으로 (베타 피드백: 온보딩 반복 노출 식상).
// 미로그인 재방문자는 하단 "건너뛰기" 로 온보딩 생략 → 로그인 직행.
import React, { useEffect } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { Screen } from '@/components/Screen';
import { BrandMark } from '@/components/BrandMark';
import { useSession } from '@/lib/session';
import { colors, fontFamily, fontSize, fontWeight } from '@/lib/tokens';

export default function SplashScreen() {
  const session = useSession();

  // 세션 복원되면 (자동 로그인) 스플래시·온보딩 건너뛰고 홈으로
  useEffect(() => {
    if (session?.user) router.replace('/(tabs)/home' as any);
  }, [session]);

  return (
    <Screen fullScreen backgroundColor={colors.accent} statusBarStyle="light">
      <Pressable style={styles.tapArea} onPress={() => router.push('/onb1')}>
        <View style={styles.center}>
          <BrandMark size="xl" color={colors.surface} />
          <Text style={styles.title}>Do : 하다</Text>
          <Text style={styles.tagline}>더 나은 나, 더 나은 세상</Text>
          <Text style={styles.subTagline}>내가 하는 것이 나와 세상을 바꾼다</Text>
        </View>
        <View style={styles.bottomActions}>
          <Text style={styles.tap}>탭하여 시작 →</Text>
          {/* 재방문자용 — 온보딩 생략하고 바로 로그인 */}
          <Pressable
            onPress={() => router.replace('/login')}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="온보딩 건너뛰기"
          >
            <Text style={styles.skip}>건너뛰기</Text>
          </Pressable>
        </View>
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
  bottomActions: {
    alignItems: 'center',
    gap: 14,
  },
  skip: {
    fontSize: fontSize.sm,
    color: 'rgba(255,255,255,0.55)',
    fontFamily: fontFamily.medium,
    textDecorationLine: 'underline',
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
});
