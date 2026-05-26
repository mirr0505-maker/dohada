// 🚀 홈 화면 — 내 챌린지 리스트 (Supabase 실데이터)
import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, Pressable, FlatList, StyleSheet,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Screen } from '@/components/Screen';
import { colors, fontFamily, fontSize, fontWeight, radius, shadow } from '@/lib/tokens';
import { useSession } from '@/lib/session';
import { fetchMyChallenges } from '@/lib/db';
import type { ChallengeWithCount } from '@/lib/types';

export default function HomeScreen() {
  const session = useSession();
  const [challenges, setChallenges] = useState<ChallengeWithCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // 미인증 시 login 으로
  useEffect(() => {
    if (session === null) router.replace('/login');
  }, [session]);

  const load = useCallback(async () => {
    if (!session) return;
    try {
      const data = await fetchMyChallenges();
      setChallenges(data);
    } catch (e) {
      console.warn('[home] fetchMyChallenges failed', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [session]);

  // 화면 포커스 들어올 때마다 새로고침 (챌린지 만든 후 돌아오면 즉시 반영)
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load();
  }, [load]);

  const nickname = (session?.user?.user_metadata as any)?.full_name
    ?? session?.user?.email?.split('@')[0]
    ?? '도전자';

  return (
    <Screen backgroundColor={colors.background}>
      <View style={styles.header}>
        <View>
          <Text style={styles.hello}>안녕하세요</Text>
          <Text style={styles.nickname}>{nickname} 🐰</Text>
        </View>
        <Pressable style={styles.avatar}>
          <Text style={{ fontSize: 22 }}>🐰</Text>
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.accent} />
        </View>
      ) : (
        <FlatList
          data={challenges}
          keyExtractor={c => c.id}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.accent}
            />
          }
          ListHeaderComponent={
            challenges.length > 0
              ? <Text style={styles.sectionTitle}>참여 중인 챌린지 {challenges.length}</Text>
              : null
          }
          renderItem={({ item }) => <ChallengeCard challenge={item} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyEmoji}>🌱</Text>
              <Text style={styles.emptyText}>
                아직 챌린지가 없어요.{'\n'}첫 챌린지를 만들어볼까요?
              </Text>
            </View>
          }
        />
      )}

      <Pressable style={styles.fab} onPress={() => router.push('/create')}>
        <Text style={styles.fabPlus}>＋</Text>
        <Text style={styles.fabLabel}>챌린지 만들기</Text>
      </Pressable>
    </Screen>
  );
}

function ChallengeCard({ challenge }: { challenge: ChallengeWithCount }) {
  const daysLeft = computeDaysLeft(challenge.end_date);
  return (
    <Pressable
      style={styles.card}
      onPress={() => router.push(`/room/${challenge.id}`)}
    >
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle} numberOfLines={1}>{challenge.title}</Text>
        <View style={styles.daysBadge}>
          <Text style={styles.daysBadgeText}>D-{daysLeft}</Text>
        </View>
      </View>
      {challenge.description ? (
        <Text style={styles.cardDesc} numberOfLines={2}>{challenge.description}</Text>
      ) : null}
      <View style={styles.cardFooter}>
        <Text style={styles.cardMeta}>👥 {challenge.member_count}명</Text>
        <Text style={styles.cardMeta}>
          {challenge.start_date.slice(5)} ~ {challenge.end_date.slice(5)}
        </Text>
      </View>
    </Pressable>
  );
}

function computeDaysLeft(endDate: string): number {
  const end = new Date(endDate + 'T23:59:59');
  const now = new Date();
  return Math.max(0, Math.ceil((end.getTime() - now.getTime()) / 86_400_000));
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 24,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  hello: {
    fontSize: fontSize.sm,
    color: colors.primary500,
    fontFamily: fontFamily.regular,
  },
  nickname: {
    fontSize: fontSize['2xl'],
    color: colors.primary,
    fontFamily: fontFamily.bold,
    fontWeight: fontWeight.bold,
    letterSpacing: -0.4,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.primary100,
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: {
    paddingHorizontal: 24,
    paddingBottom: 120,
    gap: 12,
    flexGrow: 1,
  },
  sectionTitle: {
    fontSize: fontSize.base,
    color: colors.primary500,
    fontFamily: fontFamily.medium,
    fontWeight: fontWeight.semibold,
    marginBottom: 8,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: 16,
    gap: 8,
    ...shadow.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  cardTitle: {
    flex: 1,
    fontSize: fontSize.lg,
    color: colors.primary,
    fontFamily: fontFamily.bold,
    fontWeight: fontWeight.bold,
  },
  daysBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: colors.accent50,
    borderRadius: radius.pill,
  },
  daysBadgeText: {
    fontSize: fontSize.xs,
    color: colors.accent700,
    fontFamily: fontFamily.bold,
    fontWeight: fontWeight.bold,
  },
  cardDesc: {
    fontSize: fontSize.sm,
    color: colors.primary500,
    fontFamily: fontFamily.regular,
    lineHeight: 18,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  cardMeta: {
    fontSize: fontSize.xs,
    color: colors.primary500,
    fontFamily: fontFamily.regular,
  },
  empty: {
    flex: 1,
    paddingVertical: 64,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  emptyEmoji: { fontSize: 64 },
  emptyText: {
    fontSize: fontSize.base,
    color: colors.primary500,
    fontFamily: fontFamily.regular,
    textAlign: 'center',
    lineHeight: 22,
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: colors.accent,
    borderRadius: radius.pill,
    ...shadow.lg,
  },
  fabPlus: {
    color: colors.surface,
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
  },
  fabLabel: {
    color: colors.surface,
    fontSize: fontSize.base,
    fontFamily: fontFamily.bold,
    fontWeight: fontWeight.bold,
  },
});
