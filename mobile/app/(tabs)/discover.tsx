// 🚀 둘러보기 — v4 disc-card + 4가지 평가 (✨😱🥹💫) + 사회공헌 배너
// MVP 큐레이션: "지금 핫한" 단일 (가입자 폭증 — 베타엔 단순 created_at desc).
// 명사/브랜드/공익 뱃지는 Phase 2 (운영 큐레이션).
import React, { useCallback, useMemo, useState } from 'react';
import {
  View, Text, Pressable, FlatList, StyleSheet, RefreshControl, Alert, ScrollView,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Screen } from '@/components/Screen';
import { AppHeader } from '@/components/AppHeader';
import { ChallengeCardSkeleton } from '@/components/Skeleton';
import { ErrorState } from '@/components/ErrorState';
import { colors, fontFamily, fontSize, fontWeight, radius, shadow } from '@/lib/tokens';
import { useSession } from '@/lib/session';
import { fetchOpenChallenges, toggleChallengeVote } from '@/lib/db';
import { formatCheerCount } from '@/lib/format';
import { reportError } from '@/lib/sentry';
import { haptic } from '@/lib/haptics';
import type { OpenChallengeCard, ChallengeVoteType } from '@/lib/types';

const VOTE_OPTIONS: { type: ChallengeVoteType; emoji: string }[] = [
  { type: 'creative', emoji: '✨' },
  { type: 'hard',     emoji: '😱' },
  { type: 'touching', emoji: '🥹' },
  { type: 'fresh',    emoji: '💫' },
];

export default function DiscoverScreen() {
  const session = useSession();
  const myUserId = session?.user?.id;
  const [items, setItems] = useState<OpenChallengeCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // 🚀 카테고리 필터 — 로드된 챌린지에 존재하는 카테고리만 칩으로 (null = 전체)
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);

  const categories = useMemo(() => {
    const map = new Map<string, string>();   // name → emoji
    for (const c of items) {
      if (c.category) map.set(c.category.name, c.category.emoji);
    }
    return Array.from(map, ([name, emoji]) => ({ name, emoji }));
  }, [items]);

  const filteredItems = useMemo(
    () => (categoryFilter ? items.filter(c => c.category?.name === categoryFilter) : items),
    [items, categoryFilter],
  );

  React.useEffect(() => {
    if (session === null) router.replace('/login');
  }, [session]);

  const load = useCallback(async () => {
    try {
      setError(null);
      const data = await fetchOpenChallenges(myUserId);
      setItems(data);
    } catch (e: any) {
      reportError(e, { where: 'discover/fetchOpenChallenges' });
      setError(e?.message ?? '둘러보기를 불러오지 못했어요.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [myUserId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load();
  }, [load]);

  const onVote = useCallback(async (challengeId: string, voteType: ChallengeVoteType) => {
    if (!myUserId) return;
    const target = items.find(c => c.id === challengeId);
    if (!target) return;
    const currentlyVoted = target.my_votes.includes(voteType);
    haptic.tap();
    // 낙관적
    setItems(prev => prev.map(c => {
      if (c.id !== challengeId) return c;
      const has = c.my_votes.includes(voteType);
      const my = has ? c.my_votes.filter(t => t !== voteType) : [...c.my_votes, voteType];
      return {
        ...c,
        my_votes: my,
        votes_by_type: {
          ...c.votes_by_type,
          [voteType]: Math.max(0, (c.votes_by_type[voteType] ?? 0) + (has ? -1 : 1)),
        },
      };
    }));
    try {
      await toggleChallengeVote({
        challengeId, userId: myUserId, voteType, currentlyVoted,
      });
    } catch (e: any) {
      // 롤백
      setItems(prev => prev.map(c =>
        c.id === challengeId
          ? { ...c, my_votes: target.my_votes, votes_by_type: target.votes_by_type }
          : c,
      ));
      Alert.alert('평가 실패', e?.message ?? String(e));
    }
  }, [items, myUserId]);

  return (
    <Screen backgroundColor={colors.background}>
      <AppHeader />
      <View style={styles.subHeader}>
        <Text style={styles.subTitle}>둘러보기</Text>
      </View>

      {/* MVP 큐레이션 안내 */}
      <View style={styles.curationInfo}>
        <Text style={styles.curationEmoji}>🔥</Text>
        <Text style={styles.curationText}>
          <Text style={styles.curationStrong}>지금 핫한</Text> · 최근 만들어진 공개 하다
        </Text>
      </View>

      {/* 🚀 카테고리 필터 칩 — 챌린지가 있는 분류만 노출 */}
      {!loading && !error && categories.length > 1 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filterRow}
          contentContainerStyle={styles.filterRowInner}
        >
          <Pressable
            style={[styles.filterChip, !categoryFilter && styles.filterChipActive]}
            onPress={() => { haptic.tap(); setCategoryFilter(null); }}
          >
            <Text style={[styles.filterChipText, !categoryFilter && styles.filterChipTextActive]}>전체</Text>
          </Pressable>
          {categories.map(cat => {
            const active = categoryFilter === cat.name;
            return (
              <Pressable
                key={cat.name}
                style={[styles.filterChip, active && styles.filterChipActive]}
                onPress={() => { haptic.tap(); setCategoryFilter(active ? null : cat.name); }}
              >
                <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>
                  {cat.emoji} {cat.name}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      )}

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
          data={filteredItems}
          keyExtractor={c => c.id}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />
          }
          renderItem={({ item }) => (
            <DiscCard challenge={item} onVote={(t) => onVote(item.id, t)} />
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyEmoji}>🌍</Text>
              <Text style={styles.emptyText}>
                {categoryFilter
                  ? `${categoryFilter} 분류의 공개 하다가 없어요.`
                  : '아직 공개 하다가 없어요.\n하단 + 로 첫 공개 하다를 만들어볼까요?'}
              </Text>
            </View>
          }
        />
      )}
    </Screen>
  );
}

// ─── 둘러보기 카드 (v4 disc-card) ───
function DiscCard({
  challenge, onVote,
}: {
  challenge: OpenChallengeCard;
  onVote: (type: ChallengeVoteType) => void;
}) {
  const daysLeft = computeDaysLeft(challenge.end_date);
  const isImpact = !!challenge.category?.is_impact;
  const fillColor = isImpact ? colors.success : colors.accent;
  const progress = computeProgress(challenge.start_date, challenge.end_date);

  return (
    <Pressable
      style={[styles.card, isImpact && styles.cardImpact]}
      onPress={() => {
        haptic.tap();
        router.push(`/room/${challenge.id}`);
      }}
    >
      {/* 헤더: 뱃지 + D-N */}
      <View style={styles.cardHeader}>
        <View style={styles.badgeRow}>
          {isImpact ? (
            <View style={[styles.badge, styles.badgeImpact]}>
              <Text style={styles.badgeText}>🌍 사회공헌</Text>
            </View>
          ) : null}
        </View>
        <Text style={[styles.dday, isImpact && { color: colors.success }]}>D-{daysLeft}</Text>
      </View>

      <Text style={styles.cardTitle} numberOfLines={2}>{challenge.title}</Text>
      {challenge.description ? (
        <Text style={styles.cardDesc} numberOfLines={2}>{challenge.description}</Text>
      ) : null}

      <View style={styles.cardStats}>
        <Text style={styles.cardStat}>👥 {challenge.member_count}명</Text>
        <Text style={styles.cardStat}>
          {challenge.start_date.slice(5)} ~ {challenge.end_date.slice(5)}
        </Text>
      </View>

      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${progress}%`, backgroundColor: fillColor }]} />
      </View>

      {/* 사회공헌 배너 (있을 때만) */}
      {isImpact && (
        <View style={styles.impactBanner}>
          <Text style={styles.impactBannerText}>
            💚 함께 만든 변화를 모아가요
          </Text>
        </View>
      )}

      {/* 4가지 평가 chips */}
      <View style={styles.votesRow}>
        {VOTE_OPTIONS.map(({ type, emoji }) => {
          const count = challenge.votes_by_type[type] ?? 0;
          const active = challenge.my_votes.includes(type);
          return (
            <Pressable
              key={type}
              style={[styles.voteChip, active && styles.voteChipActive]}
              onPress={(e) => {
                e.stopPropagation?.();
                onVote(type);
              }}
              hitSlop={4}
            >
              <Text style={styles.voteEmoji}>{emoji}</Text>
              <Text style={[styles.voteCount, active && styles.voteCountActive]}>
                {formatCheerCount(count)}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* 푸터: @크리에이터 · 카테고리 + 도전/동참 */}
      <View style={styles.cardFooter}>
        <Text style={styles.creator} numberOfLines={1}>
          @{challenge.creator.nickname}
          {challenge.category ? ` · ${challenge.category.name}` : ''}
          {challenge.subcategory ? `/${challenge.subcategory.name}` : ''}
        </Text>
        <View style={[styles.joinBtn, isImpact && styles.joinBtnImpact]}>
          <Text style={[styles.joinBtnText, isImpact && styles.joinBtnTextImpact]}>
            {isImpact ? '+ 동참' : '+ 하다'}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

// ─── 유틸 ───
function computeDaysLeft(endDate: string): number {
  const end = new Date(endDate + 'T00:00:00');
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);
  const todayDate = new Date(todayStr + 'T00:00:00');
  return Math.max(0, Math.round((end.getTime() - todayDate.getTime()) / 86_400_000));
}

function computeProgress(startDate: string, endDate: string): number {
  const start = new Date(startDate + 'T00:00:00');
  const end = new Date(endDate + 'T00:00:00');
  
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);
  const todayDate = new Date(todayStr + 'T00:00:00');

  const total = Math.max(1, end.getTime() - start.getTime());
  const elapsed = Math.max(0, todayDate.getTime() - start.getTime());
  return Math.min(100, Math.round((elapsed / total) * 100));
}

const styles = StyleSheet.create({
  subHeader: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  subTitle: {
    fontSize: fontSize.lg,
    color: colors.primary,
    fontFamily: fontFamily.bold,
    fontWeight: fontWeight.bold,
    letterSpacing: -0.2,
  },
  curationInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 24,
    marginBottom: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: colors.accent50,
    borderRadius: radius.md,
  },
  curationEmoji: { fontSize: 18 },
  curationText: {
    flex: 1,
    fontSize: fontSize.sm,
    color: colors.primary500,
    fontFamily: fontFamily.regular,
  },
  curationStrong: {
    color: colors.accent700,
    fontFamily: fontFamily.bold,
    fontWeight: fontWeight.bold,
  },

  // 🚀 카테고리 필터 칩
  filterRow: {
    maxHeight: 44,
    marginBottom: 8,
  },
  filterRowInner: {
    paddingHorizontal: 24,
    gap: 8,
    alignItems: 'center',
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.primary50,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  filterChipActive: {
    backgroundColor: colors.accent50,
    borderColor: colors.accent,
  },
  filterChipText: {
    fontSize: fontSize.sm,
    color: colors.primary500,
    fontFamily: fontFamily.medium,
    fontWeight: fontWeight.medium,
  },
  filterChipTextActive: {
    color: colors.accent700,
    fontFamily: fontFamily.bold,
    fontWeight: fontWeight.bold,
  },
  list: {
    paddingHorizontal: 24,
    paddingBottom: 32,
    gap: 12,
    flexGrow: 1,
  },

  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: 16,
    gap: 10,
    ...shadow.sm,
  },
  cardImpact: {
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: colors.success,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  badgeRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
    backgroundColor: colors.primary100,
  },
  badgeImpact: { backgroundColor: colors.success, paddingHorizontal: 10 },
  badgeText: {
    fontSize: 10,
    color: colors.surface,
    fontFamily: fontFamily.bold,
    fontWeight: fontWeight.bold,
  },
  dday: {
    fontSize: fontSize.sm,
    color: colors.accent,
    fontFamily: fontFamily.bold,
    fontWeight: fontWeight.bold,
  },
  cardTitle: {
    fontSize: fontSize.lg,
    color: colors.primary,
    fontFamily: fontFamily.bold,
    fontWeight: fontWeight.bold,
    lineHeight: 22,
  },
  cardDesc: {
    fontSize: fontSize.sm,
    color: colors.primary500,
    fontFamily: fontFamily.regular,
    lineHeight: 18,
  },
  cardStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  cardStat: {
    fontSize: fontSize.xs,
    color: colors.primary500,
    fontFamily: fontFamily.regular,
  },
  progressTrack: {
    height: 6,
    backgroundColor: colors.primary100,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: { height: 6, borderRadius: 3 },
  impactBanner: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#DCFCE7',
    borderRadius: radius.md,
  },
  impactBannerText: {
    fontSize: fontSize.xs,
    color: '#15803D',
    fontFamily: fontFamily.medium,
    fontWeight: fontWeight.semibold,
  },
  votesRow: {
    flexDirection: 'row',
    gap: 6,
    paddingTop: 4,
  },
  voteChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.pill,
    backgroundColor: colors.primary50,
    borderWidth: 1,
    borderColor: 'transparent',
    minWidth: 42,
    justifyContent: 'center',
  },
  voteChipActive: { backgroundColor: colors.accent50, borderColor: colors.accent },
  voteEmoji: { fontSize: 13 },
  voteCount: {
    fontSize: fontSize.xs,
    color: colors.primary500,
    fontFamily: fontFamily.medium,
    fontWeight: fontWeight.medium,
  },
  voteCountActive: {
    color: colors.accent700,
    fontWeight: fontWeight.bold,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 4,
  },
  creator: {
    flex: 1,
    fontSize: fontSize.xs,
    color: colors.primary500,
    fontFamily: fontFamily.regular,
  },
  joinBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
  },
  joinBtnImpact: { backgroundColor: colors.success },
  joinBtnText: {
    fontSize: fontSize.xs,
    color: colors.surface,
    fontFamily: fontFamily.bold,
    fontWeight: fontWeight.bold,
  },
  joinBtnTextImpact: { color: colors.surface },

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
