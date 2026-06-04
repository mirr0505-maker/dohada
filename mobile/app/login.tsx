// 🚀 로그인 화면 — Google OAuth + Supabase signInWithIdToken
import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import { Screen } from '@/components/Screen';
import { BrandMark } from '@/components/BrandMark';
import { colors, fontFamily, fontSize, fontWeight, radius } from '@/lib/tokens';
import {
  useGoogleAuth, signInWithGoogleIdToken,
  isAppleSignInAvailable, signInWithApple,
} from '@/lib/auth';
import { isSupabaseConfigured } from '@/lib/supabase';
import { getPendingInvite, clearPendingInvite } from '@/lib/invite';

// 구글 공식 4색 G 로고
function GoogleLogo({ size = 20 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <Path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <Path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <Path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </Svg>
  );
}

export default function LoginScreen() {
  const [, response, promptAsync] = useGoogleAuth();
  const [signingIn, setSigningIn] = useState(false);
  const [appleAvailable, setAppleAvailable] = useState(false);

  useEffect(() => {
    isAppleSignInAvailable().then(setAppleAvailable);
  }, []);

  // Google 응답이 success 면 ID token 으로 Supabase 세션 생성
  useEffect(() => {
    if (!response) return;
    if (response.type === 'cancel' || response.type === 'dismiss') return;
    if (response.type === 'error') {
      Alert.alert('로그인 오류', response.error?.message ?? '알 수 없는 오류가 발생했어요.');
      return;
    }
    if (response.type !== 'success') return;

    const idToken = response.authentication?.idToken;
    if (!idToken) {
      Alert.alert('로그인 실패', 'Google ID 토큰을 받지 못했어요.');
      return;
    }
    (async () => {
      try {
        setSigningIn(true);
        await signInWithGoogleIdToken(idToken);

        // 카톡 초대 링크로 진입한 경우 → 초대 화면으로 다시
        // (`as any` 는 typed-routes 캐시가 아직 invite/[id] 를 모르기 때문 — 다음 expo start 후 자동 갱신)
        const pending = await getPendingInvite();
        if (pending) {
          await clearPendingInvite();
          router.replace(`/invite/${pending}` as any);
        } else {
          router.replace('/welcome');
        }
      } catch (e: any) {
        Alert.alert('로그인 실패', e?.message ?? String(e));
      } finally {
        setSigningIn(false);
      }
    })();
  }, [response]);

  const onGoogleSignIn = async () => {
    // .env 미설정 시 더미 흐름 (UI 검증용)
    if (!isSupabaseConfigured) {
      router.replace('/welcome');
      return;
    }
    await promptAsync();
  };

  const onAppleSignIn = async () => {
    if (!isSupabaseConfigured) {
      router.replace('/welcome');
      return;
    }
    try {
      setSigningIn(true);
      await signInWithApple();
      router.replace('/welcome');
    } catch (e: any) {
      // 사용자 취소는 알림 안 띄움
      if (e?.code === 'ERR_REQUEST_CANCELED') return;
      Alert.alert('로그인 실패', e?.message ?? String(e));
    } finally {
      setSigningIn(false);
    }
  };

  return (
    <Screen backgroundColor={colors.background}>
      <View style={styles.container}>
        <View style={styles.logoBlock}>
          <BrandMark size="xl" color={colors.accent} />
          <Text style={styles.logoTitle}>Do : 하다</Text>
          <Text style={styles.logoSub}>더 나은 나, 더 나은 세상</Text>
        </View>

        <View style={styles.greetingBlock}>
          <Text style={styles.greeting}>시작해볼까요?</Text>
          <Text style={styles.greetingSub}>3초만에 가입하고 첫 챌린지 시작</Text>
        </View>

        <View style={styles.providers}>
          <Pressable
            style={[styles.googleBtn, signingIn && { opacity: 0.6 }]}
            onPress={onGoogleSignIn}
            disabled={signingIn}
          >
            {signingIn ? (
              <ActivityIndicator color={colors.primary} />
            ) : (
              <>
                <GoogleLogo size={20} />
                <Text style={styles.googleLabel}>Google로 시작하기</Text>
              </>
            )}
          </Pressable>

          {/* Apple Sign In — iOS 만 표시. App Store 정책상 SNS 로그인 있으면 필수. */}
          {appleAvailable && (
            <Pressable
              style={[styles.appleBtnCustom, signingIn && { opacity: 0.6 }]}
              onPress={onAppleSignIn}
              disabled={signingIn}
            >
              {signingIn ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <Svg width={18} height={22} viewBox="0 0 170 170" style={{ marginRight: 4 }}>
                    <Path
                      fill="#FFFFFF"
                      d="M150.37 130.25c-2.45 5.66-5.35 10.87-8.71 15.66-4.58 6.53-8.33 11.05-11.22 13.56-4.48 4.12-9.28 6.23-14.42 6.35-3.69 0-8.14-1.05-13.32-3.18-5.19-2.12-9.97-3.17-14.34-3.17-4.58 0-9.49 1.05-14.75 3.17-5.26 2.13-9.5 3.24-12.74 3.35-4.34.13-9.13-1.92-14.36-6.15-3.29-2.62-7.07-7.16-11.36-13.63-8.91-13.57-15.52-29.41-19.83-47.53-4.32-18.13-4.63-34.92-.93-50.37 3.7-15.46 10.96-27.69 21.78-36.68 10.82-8.99 22.86-13.6 36.12-13.84 5.34-.12 11.2 1.44 17.58 4.67 6.38 3.23 10.85 4.86 13.39 4.86 2.2 0 6.43-1.5 12.72-4.5 6.29-3 12.21-4.43 17.77-4.3 16.42.37 29.56 6.57 39.42 18.59-14.7 8.92-21.84 21.61-21.41 38.07.43 13.06 5.39 24 14.88 32.84 9.49 8.84 20.61 13.72 33.37 14.65-2.69 7.82-6.52 16.03-11.48 24.63zM119.22 30.15c0-8.12 2.87-15.82 8.62-23.1 7.25-9.12 16.27-14.15 27.05-15.05.12 1.01.18 1.96.18 2.84 0 7.86-2.92 15.51-8.77 22.95-5.85 7.43-14.62 12.56-26.3 15.38-.52-1.92-.78-3.92-.78-6.02z"
                    />
                  </Svg>
                  <Text style={styles.appleLabelCustom}>Apple로 시작하기</Text>
                </>
              )}
            </Pressable>
          )}
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
  appleBtnCustom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingVertical: 16,
    backgroundColor: '#000000',
    borderRadius: radius.lg,
    height: 54,
    width: '100%',
  },
  appleLabelCustom: {
    fontSize: fontSize.lg,
    color: '#FFFFFF',
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
