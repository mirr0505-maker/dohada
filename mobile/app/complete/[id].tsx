// 🚀 완주 화면 — 챌린지 종료일이 지났고 매일 인증한 경우 1회 표시
// MVP: 인증서 / 포토북은 X. 단순한 축하 화면 + 공유 + 홈으로.
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Share, Alert, ActivityIndicator } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Screen } from '@/components/Screen';
import { Button } from '@/components/Button';
import { colors, fontFamily, fontSize, fontWeight, radius } from '@/lib/tokens';
import { useSession } from '@/lib/session';
import { fetchRoomData } from '@/lib/db';
import { computeProgress } from '@/lib/stats';
import { haptic } from '@/lib/haptics';

export default function CompleteScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const session = useSession();
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState('');
  const [totalDays, setTotalDays] = useState(0);

  useEffect(() => {
    if (session === null) router.replace('/login');
  }, [session]);

  useEffect(() => {
    if (!id || !session?.user) return;
    (async () => {
      try {
        const data = await fetchRoomData(id, session.user.id);
        if (data.challenge) {
          setTitle(data.challenge.title);
          setTotalDays(computeProgress(data.challenge).totalDays);
          haptic.success();
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [id, session]);

  const onShare = async () => {
    try {
      await Share.share({
        message: `🏆 "${title}" 챌린지 ${totalDays}일 완주!\n\n더 나은 나, 더 나은 세상.`,
      });
    } catch (e) {
      Alert.alert('공유 실패', String(e));
    }
  };

  if (loading) {
    return (
      <Screen fullScreen backgroundColor={colors.accent} statusBarStyle="light">
        <View style={styles.center}>
          <ActivityIndicator color={colors.surface} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen fullScreen backgroundColor={colors.accent} statusBarStyle="light">
      <View style={styles.center}>
        <Text style={styles.trophy}>🏆</Text>
        <Text style={styles.title}>완주!</Text>
        <Text style={styles.challengeName}>"{title}"</Text>
        <Text style={styles.days}>{totalDays}일을 끝까지 해냈어요</Text>

        <View style={styles.sloganBox}>
          <Text style={styles.slogan}>더 나은 나, 더 나은 세상</Text>
          <Text style={styles.sloganSub}>나의 도전이 나와 세상을 바꿨다</Text>
        </View>
      </View>

      <View style={styles.bottom}>
        <Button label="기록 공유하기" size="xl" block onPress={onShare} />
        <Button
          label="홈으로"
          variant="ghost"
          size="lg"
          block
          onPress={() => router.replace('/home')}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 12,
  },
  trophy: { fontSize: 120, marginBottom: 16 },
  title: {
    fontSize: 56,
    color: colors.surface,
    fontFamily: fontFamily.bold,
    fontWeight: fontWeight.extrabold,
    letterSpacing: -1,
  },
  challengeName: {
    fontSize: fontSize.xl,
    color: colors.surface,
    fontFamily: fontFamily.medium,
    textAlign: 'center',
    marginTop: 8,
  },
  days: {
    fontSize: fontSize.base,
    color: 'rgba(255,255,255,0.85)',
    fontFamily: fontFamily.regular,
    marginTop: 4,
  },
  sloganBox: {
    marginTop: 32,
    padding: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: radius.lg,
    alignItems: 'center',
    gap: 4,
  },
  slogan: {
    fontSize: fontSize.lg,
    color: colors.surface,
    fontFamily: fontFamily.bold,
    fontWeight: fontWeight.bold,
    letterSpacing: -0.3,
  },
  sloganSub: {
    fontSize: fontSize.sm,
    color: 'rgba(255,255,255,0.85)',
    fontFamily: fontFamily.regular,
  },
  bottom: {
    padding: 24,
    paddingBottom: 40,
    gap: 8,
  },
});
