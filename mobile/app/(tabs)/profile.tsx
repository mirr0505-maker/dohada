// 🚀 내 정보 — 프로필 카드 + 로그아웃 (베타 최소 구성)
// Phase 2: 박제/완주 기록, 도전 인연, 알림 설정 등.
import React from 'react';
import {
  View, Text, Pressable, StyleSheet, Alert,
} from 'react-native';
import { router } from 'expo-router';
import { Screen } from '@/components/Screen';
import { Button } from '@/components/Button';
import { colors, fontFamily, fontSize, fontWeight, radius, shadow } from '@/lib/tokens';
import { useSession } from '@/lib/session';
import { signOut } from '@/lib/auth';
import { haptic } from '@/lib/haptics';
import Constants from 'expo-constants';

export default function ProfileScreen() {
  const session = useSession();

  React.useEffect(() => {
    if (session === null) router.replace('/login');
  }, [session]);

  const nickname = (session?.user?.user_metadata as any)?.full_name
    ?? session?.user?.email?.split('@')[0]
    ?? '도전자';
  const email = session?.user?.email ?? '';
  const initial = nickname.slice(0, 1);
  const appVersion = Constants.expoConfig?.version ?? '0.1.0';

  const onLogout = () => {
    Alert.alert('로그아웃', '다음에 또 만나요. 로그아웃할까요?', [
      { text: '취소', style: 'cancel' },
      {
        text: '로그아웃',
        style: 'destructive',
        onPress: async () => {
          haptic.warning();
          await signOut();
          router.replace('/login');
        },
      },
    ]);
  };

  return (
    <Screen backgroundColor={colors.background}>
      <View style={styles.header}>
        <Text style={styles.title}>내 정보</Text>
      </View>

      {/* 프로필 카드 */}
      <View style={styles.profileCard}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initial}</Text>
        </View>
        <Text style={styles.nickname}>{nickname}</Text>
        {email ? <Text style={styles.email}>{email}</Text> : null}
      </View>

      {/* 액션 */}
      <View style={styles.actions}>
        <Button label="로그아웃" variant="ghost" block onPress={onLogout} />
      </View>

      {/* 버전 */}
      <View style={styles.footer}>
        <Text style={styles.version}>Do : 하다 v{appVersion}</Text>
        <Text style={styles.tagline}>같이 도전하는 사람의 응원이 진짜 힘이에요</Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  title: {
    fontSize: fontSize['2xl'],
    color: colors.primary,
    fontFamily: fontFamily.bold,
    fontWeight: fontWeight.bold,
    letterSpacing: -0.4,
  },
  profileCard: {
    marginHorizontal: 24,
    marginTop: 8,
    padding: 24,
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    alignItems: 'center',
    gap: 12,
    ...shadow.sm,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.accent50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 32,
    color: colors.accent700,
    fontFamily: fontFamily.bold,
    fontWeight: fontWeight.bold,
  },
  nickname: {
    fontSize: fontSize.xl,
    color: colors.primary,
    fontFamily: fontFamily.bold,
    fontWeight: fontWeight.bold,
  },
  email: {
    fontSize: fontSize.sm,
    color: colors.primary500,
    fontFamily: fontFamily.regular,
  },
  actions: {
    marginHorizontal: 24,
    marginTop: 24,
  },
  footer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 32,
    gap: 6,
  },
  version: {
    fontSize: fontSize.sm,
    color: colors.primary500,
    fontFamily: fontFamily.medium,
    fontWeight: fontWeight.medium,
  },
  tagline: {
    fontSize: fontSize.xs,
    color: colors.primary300,
    fontFamily: fontFamily.regular,
  },
});
