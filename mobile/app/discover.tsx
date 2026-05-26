// 🚀 둘러보기 — 공개(open) 챌린지 목록
// home 의 "둘러보기" 진입점 → 공개 챌린지 카드 리스트 → 탭하면 room 으로 (비멤버 상태)
import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, Pressable, FlatList, StyleSheet,
  RefreshControl,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Screen } from '@/components/Screen';
import { ChallengeCardSkeleton } from '@/components/Skeleton';
import { ErrorState } from '@/components/ErrorState';
import { colors, fontFamily, fontSize, fontWeight, radius, shadow } from '@/lib/tokens';
import { useSession } from '@/lib/session';
import { fetchOpenChallenges } from '@/lib/db';
import { reportError } from '@/lib/sentry';
import { haptic } from '@/lib/haptics';
import type { ChallengeWithCount } from '@/lib/types';

export default function DiscoverScreen() {
  const session = useSession();
  const [items, setItems] = useState<ChallengeWithCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (session === null) router.replace('/login');
  }, [session]);

  const load = useCallback(async () => {
    try {
      setError(null);
      const data = await fetchOpenChallenges();
      setItems(data);
    } catch (e: any) {
      reportError(e, { where: 'discover/fetchOpenChallenges' });
      setError(e?.message ?? '둘러보기를 불러오지 못했어요.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load();
  }, [load]);

  return (
    <Screen backgroundColor={colors.background}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Text style={styles.back}>←</Text>
        </Pressable>
        <Text style={styles.title}>둘러보기</Text>
        <View style={{ width: 32 }} />
      </View>

      {loading ? (
        <View style={styles.list}>
          <ChallengeCardSkeleton />
          <ChallengeCardSkeleton />
          <ChallengeCardSkeleton />
        </View>
      ) : error ? (
        <ErrorState message={error} onRetry={() => { setLoading(true); load(); }} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={c => c.id}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.accent}
            />
          }
          renderItem={({ item }) => <OpenCard challenge={item} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyEmoji}>🌍</Text>
              <Text style={styles.emptyText}>
                아직 공개 챌린지가 없어요.{'\n'}첫 공개 챌린지를 만들어볼까요?
              </Text>
            </View>
          }
        />
      )}
    </Screen>
  );
}

function OpenCard({ challenge }: { challenge: ChallengeWithCount }) {
  return (
    <Pressable
      style={styles.card}
      onPress={() => {
        haptic.tap();
        router.push(`/room/${challenge.id}`);
      }}
    >
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle} numberOfLines={1}>{challenge.title}</Text>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>🌍 공개</Text>
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

const styles = StyleSheet.create({
  header: {
    height: 56,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: colors.primary100,
    backgroundColor: colors.surface,
  },
  back: {
    fontSize: 24,
    color: colors.primary,
    paddingHorizontal: 8,
    fontWeight: fontWeight.medium,
  },
  title: {
    fontSize: fontSize.lg,
    color: colors.primary,
    fontFamily: fontFamily.bold,
    fontWeight: fontWeight.bold,
  },
  list: {
    paddingHorizontal: 24,
    paddingVertical: 16,
    paddingBottom: 80,
    gap: 12,
    flexGrow: 1,
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
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: colors.accent50,
    borderRadius: radius.pill,
  },
  badgeText: {
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
    paddingVertical: 80,
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
});
