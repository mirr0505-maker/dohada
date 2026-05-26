// 🚀 로그인 화면 — 구글만 사용 (2026-05-26 변경: 카카오 → 구글)
// 실제 OAuth 는 Week 2 에서 expo-auth-session + Supabase 연동. 지금은 더미.
import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { Screen } from '@/components/Screen';
import { colors, fontFamily, fontSize, fontWeight, radius } from '@/lib/tokens';

export default function LoginScreen() {
  const onGoogleSignIn = () => {
    router.replace('/welcome');
  };

  return (
    <Screen backgroundColor={colors.background}>
      <View style={styles.container}>
        <View style={styles.logoBlock}>
          <Text style={styles.logoCircle}>(  ◯  )</Text>
          <Text style={styles.logoTitle}>Do : 하다</Text>
          <Text style={styles.logoSub}>더 나은 나, 더 나은 세상</Text>
        </View>

        <View style={styles.greetingBlock}>
          <Text style={styles.greeting}>시작해볼까요?</Text>
          <Text style={styles.greetingSub}>3초만에 가입하고 첫 챌린지 시작</Text>
        </View>

        {/* Google 로그인 버튼 — 실제 SVG 로고는 Week 2 의 Google Sign-In SDK 와 함께 옴 */}
        <View style={styles.providers}>
          <Pressable style={styles.googleBtn} onPress={onGoogleSignIn}>
            <View style={styles.googleBadge}>
              <Text style={styles.googleBadgeText}>G</Text>
            </View>
            <Text style={styles.googleLabel}>Google로 시작하기</Text>
          </Pressable>
        </View>

        <Text style={styles.footer}>
          계속 진행하면 약관에 동의하는 단계로 넘어가요.
        </Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'space-between',
    paddingTop: 48,
    paddingBottom: 32,
  },
  logoBlock: {
    alignItems: 'center',
    gap: 8,
    marginTop: 24,
  },
  logoCircle: {
    fontSize: fontSize['4xl'],
    color: colors.accent,
    fontFamily: fontFamily.bold,
    fontWeight: fontWeight.bold,
  },
  logoTitle: {
    fontSize: fontSize['5xl'],
    color: colors.primary,
    fontFamily: fontFamily.bold,
    fontWeight: fontWeight.extrabold,
    letterSpacing: -1,
  },
  logoSub: {
    fontSize: fontSize.sm,
    color: colors.primary500,
    fontFamily: fontFamily.regular,
  },
  greetingBlock: {
    alignItems: 'center',
    gap: 6,
  },
  greeting: {
    fontSize: fontSize['3xl'],
    color: colors.primary,
    fontFamily: fontFamily.bold,
    fontWeight: fontWeight.bold,
    letterSpacing: -0.5,
  },
  greetingSub: {
    fontSize: fontSize.base,
    color: colors.primary500,
    fontFamily: fontFamily.regular,
  },
  providers: {
    gap: 12,
  },
  googleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingVertical: 16,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.primary100,
  },
  googleBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#4285F4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  googleBadgeText: {
    color: colors.surface,
    fontFamily: fontFamily.bold,
    fontWeight: fontWeight.bold,
    fontSize: fontSize.base,
  },
  googleLabel: {
    fontSize: fontSize.lg,
    color: colors.primary,
    fontFamily: fontFamily.medium,
    fontWeight: fontWeight.semibold,
  },
  footer: {
    fontSize: fontSize.xs,
    color: colors.primary300,
    fontFamily: fontFamily.regular,
    textAlign: 'center',
  },
});
