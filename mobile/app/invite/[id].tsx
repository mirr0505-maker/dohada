// 🚀 초대 진입점 — dohada://invite/<id> 또는 앱 내 push 로 진입
// 미로그인 → pending 저장하고 /login. 로그인 → joinChallenge → /room/<id>.
import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Screen } from '@/components/Screen';
import { Button } from '@/components/Button';
import { colors, fontFamily, fontSize, fontWeight } from '@/lib/tokens';
import { useSession } from '@/lib/session';
import { joinChallenge, setPendingInvite } from '@/lib/invite';

type Status = 'loading' | 'joining' | 'error';

export default function InviteScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const session = useSession();
  const [status, setStatus] = useState<Status>('loading');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (!id) return;
    if (session === undefined) return; // 세션 로딩 중

    if (session === null) {
      // 미로그인 → 챌린지 ID 를 pending 으로 저장하고 로그인 화면으로
      setPendingInvite(id).finally(() => router.replace('/login'));
      return;
    }

    // 로그인 됨 → 가입 처리
    setStatus('joining');
    joinChallenge(id, session.user.id)
      .then(() => router.replace(`/room/${id}`))
      .catch((e: unknown) => {
        setStatus('error');
        setErrorMsg((e as Error)?.message ?? String(e));
      });
  }, [id, session]);

  return (
    <Screen backgroundColor={colors.background}>
      <View style={styles.center}>
        {status === 'loading' && (
          <>
            <ActivityIndicator color={colors.accent} size="large" />
            <Text style={styles.label}>초대 확인 중…</Text>
          </>
        )}
        {status === 'joining' && (
          <>
            <Text style={styles.emoji}>👋</Text>
            <Text style={styles.title}>챌린지에 참여하는 중…</Text>
          </>
        )}
        {status === 'error' && (
          <>
            <Text style={styles.emoji}>⚠️</Text>
            <Text style={styles.title}>참여할 수 없어요</Text>
            <Text style={styles.errorText}>{errorMsg}</Text>
            <Button
              label="홈으로"
              onPress={() => router.replace('/home')}
            />
          </>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    paddingHorizontal: 32,
  },
  emoji: { fontSize: 72 },
  label: {
    fontSize: fontSize.base,
    color: colors.primary500,
    fontFamily: fontFamily.regular,
  },
  title: {
    fontSize: fontSize.xl,
    color: colors.primary,
    fontFamily: fontFamily.bold,
    fontWeight: fontWeight.bold,
    textAlign: 'center',
  },
  errorText: {
    fontSize: fontSize.sm,
    color: colors.primary500,
    fontFamily: fontFamily.regular,
    textAlign: 'center',
    marginBottom: 8,
  },
});
