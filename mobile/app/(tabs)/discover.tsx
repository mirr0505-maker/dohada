// 🚀 하다 구경 (익명 발상 라이브러리, 0050) — "남들은 무슨 하다 하나?"
//   개설자·참여자 신원을 지운 익명 카드. 제목·내용·인증방식·타입·4평가·참조수만 정형화 노출.
//   목적 = 탐색이 아니라 '참조' (살펴보고 → 평가하고 → 따라하기). 카드 탭으로 방에 들어가지 않음(익명 보존).
import React, { useCallback, useMemo, useState } from 'react';
import {
  View, Text, Pressable, FlatList, StyleSheet, RefreshControl, Alert, ScrollView, Image,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Screen } from '@/components/Screen';
import { AppHeader } from '@/components/AppHeader';
import { ChallengeCardSkeleton } from '@/components/Skeleton';
import { ErrorState } from '@/components/ErrorState';
import { colors, fontFamily, fontSize, fontWeight, radius, shadow } from '@/lib/tokens';
import { useSession } from '@/lib/session';
import { fetchBrowseChallenges, toggleChallengeVote } from '@/lib/db';
import { formatCheerCount } from '@/lib/format';
import { reportError } from '@/lib/sentry';
import { haptic } from '@/lib/haptics';
import type { BrowseChallengeCard, ChallengeVoteType } from '@/lib/types';

// 4가지 평가 — 이모지 + 두 글자 의미 라벨 (수칙 #8: 각 의미 독립 보존)
const VOTE_OPTIONS: { type: ChallengeVoteType; emoji: string; label: string }[] = [
  { type: 'creative', emoji: '✨', label: '기발' },
  { type: 'hard',     emoji: '😱', label: '대단' },
  { type: 'touching', emoji: '🥹', label: '뭉클' },
  { type: 'fresh',    emoji: '💫', label: '새로움' },
];

// 방 타입 4종 — 뚜렷이 구분 (이모지 + 라벨 + 색, 토큰 내 색만 사용)
const KIND_BADGE: Record<string, { emoji: string; label: string; color: string }> = {
  solo:    { emoji: '🧍', label: '나홀로',   color: colors.primary500 },
  closed:  { emoji: '🤝', label: '다함께',   color: colors.accent },
  open:    { emoji: '🌍', label: '누구나',   color: colors.success },
  cheered: { emoji: '💛', label: '응원받기', color: colors.warning },
};

export default function DiscoverScreen() {
  const session = useSession();
  const myUserId = session?.user?.id;
  const [items, setItems] = useState<BrowseChallengeCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // 🚀 카테고리 필터 — 로드된 목록에 존재하는 분류만 칩으로 (null = 전체)
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
      const data = await fetchBrowseChallenges();
      setItems(data);
    } catch (e: any) {
      reportError(e, { where: 'discover/fetchBrowseChallenges' });
      setError(e?.message ?? '하다 구경을 불러오지 못했어요.');
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

  const onVote = useCallback(async (challengeId: string, voteType: ChallengeVoteType) => {
    if (!myUserId) return;
    const target = items.find(c => c.id === challengeId);
    if (!target) return;
    const currentlyVoted = target.my_votes.includes(voteType);
    haptic.tap();
    // 낙관적 업데이트
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
      await toggleChallengeVote({ challengeId, userId: myUserId, voteType, currentlyVoted });
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

  // 따라하기 — 생성 마법사로 프리필 + 원본 id(ref) 전달. 참조 카운트는 '생성 완료' 시점에 기록(create.tsx).
  const onCopy = useCallback((c: BrowseChallengeCard) => {
    haptic.tap();
    router.push({
      pathname: '/create',
      params: {
        ref: c.id,
        title: c.title,
        kind: c.kind,
        goalType: c.goal_type,
        frequency: c.frequency,
        ...(c.category_id != null ? { categoryId: String(c.category_id) } : {}),
        ...(c.target_count != null ? { targetCount: String(c.target_count) } : {}),
        ...(c.description ? { desc: c.description } : {}),
      },
    });
  }, []);

  return (
    <Screen backgroundColor={colors.background}>
      <AppHeader />
      <View style={styles.subHeader}>
        <Text style={styles.subTitle}>하다 구경</Text>
      </View>

      {/* 안내 — 탐색이 아니라 '참조' 톤 */}
      <View style={styles.curationInfo}>
        <Text style={styles.curationEmoji}>🔭</Text>
        <Text style={styles.curationText}>
          남들은 무슨 하다 하나 — <Text style={styles.curationStrong}>살펴보고 따라해 보세요</Text>
        </Text>
      </View>

      {/* 카테고리 필터 칩 — 목록에 있는 분류만 */}
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
            <BrowseCard
              challenge={item}
              onVote={(t) => onVote(item.id, t)}
              onCopy={() => onCopy(item)}
            />
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyEmoji}>🔭</Text>
              <Text style={styles.emptyText}>
                {categoryFilter
                  ? `${categoryFilter} 분류의 하다가 아직 없어요.`
                  : '아직 살펴볼 하다가 없어요.'}
              </Text>
            </View>
          }
        />
      )}
    </Screen>
  );
}

// ─── 익명 구경 카드 ───
function BrowseCard({
  challenge, onVote, onCopy,
}: {
  challenge: BrowseChallengeCard;
  onVote: (type: ChallengeVoteType) => void;
  onCopy: () => void;
}) {
  const badge = KIND_BADGE[challenge.kind] ?? KIND_BADGE.closed;
  const showImage = !!challenge.intro_image_url;

  return (
    <View style={styles.card}>
      {/* 헤더: 타입 배지 + 카테고리 */}
      <View style={styles.cardHeader}>
        <View style={[styles.typeBadge, { backgroundColor: badge.color }]}>
          <Text style={styles.typeBadgeText}>{badge.emoji} {badge.label}</Text>
        </View>
        {challenge.category && (
          <Text style={styles.categoryText} numberOfLines={1}>
            {challenge.category.emoji} {challenge.category.name}
          </Text>
        )}
      </View>

      <Text style={styles.cardTitle} numberOfLines={2}>{challenge.title}</Text>
      {challenge.description ? (
        <Text style={styles.cardDesc} numberOfLines={3}>{challenge.description}</Text>
      ) : null}

      {/* 정형화된 기간 · 인증방식 */}
      <Text style={styles.metaText}>🗓️ {periodText(challenge)} · {methodText(challenge)}</Text>

      {/* 안내문 이미지 (개설자 opt-out 시 RPC 가 null → 표시 안 함) */}
      {showImage && (
        <Image source={{ uri: challenge.intro_image_url! }} style={styles.introImage} resizeMode="cover" />
      )}

      {/* 4가지 평가 — 이모지 + 라벨 + 카운트 */}
      <View style={styles.votesRow}>
        {VOTE_OPTIONS.map(({ type, emoji, label }) => {
          const count = challenge.votes_by_type[type] ?? 0;
          const active = challenge.my_votes.includes(type);
          return (
            <Pressable
              key={type}
              style={[styles.voteChip, active && styles.voteChipActive]}
              onPress={() => onVote(type)}
              hitSlop={4}
            >
              <Text style={styles.voteEmoji}>{emoji}</Text>
              <Text style={[styles.voteLabel, active && styles.voteLabelActive]}>{label}</Text>
              <Text style={[styles.voteCount, active && styles.voteCountActive]}>
                {formatCheerCount(count)}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* 푸터: 참조수 + 따라하기 */}
      <View style={styles.cardFooter}>
        <Text style={styles.refText} numberOfLines={1}>
          {challenge.reference_count > 0
            ? `🔁 ${formatCheerCount(challenge.reference_count)}번 따라 했어요`
            : '🔁 아직 따라한 사람이 없어요'}
        </Text>
        <Pressable style={styles.copyBtn} onPress={onCopy} hitSlop={4}>
          <Text style={styles.copyBtnText}>따라하기</Text>
        </Pressable>
      </View>
    </View>
  );
}

// ─── 유틸 ───
// 기간 (시작~종료 포함 일수)
function periodText(c: BrowseChallengeCard): string {
  const start = new Date(c.start_date + 'T00:00:00');
  const end = new Date(c.end_date + 'T00:00:00');
  const days = Math.max(1, Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1);
  return `${days}일`;
}

// 인증방식 — count 유형은 "목표 N개", cadence 유형은 빈도
function methodText(c: BrowseChallengeCard): string {
  if (c.goal_type === 'count') return `목표 ${c.target_count ?? 0}개`;
  switch (c.frequency) {
    case 'weekly3': return '주 3회 인증';
    case 'weekly1': return '주 1회 인증';
    default:        return '매일 인증';
  }
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

  // 칩 텍스트에 lineHeight 를 고정해 칩 높이를 결정적으로 만들고(이모지 유무·기기와 무관),
  // 스크롤뷰엔 그보다 넉넉한 명시적 height 를 줌 — 자동 높이 추정에 기대지 않아 이모지 칩이 안 잘림
  filterRow: { flexGrow: 0, height: 48, marginBottom: 8 },
  filterRowInner: { paddingHorizontal: 24, gap: 8, alignItems: 'center' },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.primary50,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  filterChipActive: { backgroundColor: colors.accent50, borderColor: colors.accent },
  filterChipText: {
    fontSize: fontSize.sm,
    lineHeight: 18,   // 이모지가 줄 높이를 키워 칩이 잘리던 문제 방지 (칩 높이 = 8+18+8+2 = 36)
    color: colors.primary500,
    fontFamily: fontFamily.medium,
    fontWeight: fontWeight.medium,
  },
  filterChipTextActive: {
    color: colors.accent700,
    fontFamily: fontFamily.bold,
    fontWeight: fontWeight.bold,
  },
  list: { paddingHorizontal: 24, paddingBottom: 32, gap: 12, flexGrow: 1 },

  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: 16,
    gap: 10,
    ...shadow.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  typeBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  typeBadgeText: {
    fontSize: fontSize.xs,
    color: colors.surface,
    fontFamily: fontFamily.bold,
    fontWeight: fontWeight.bold,
  },
  categoryText: {
    flexShrink: 1,
    fontSize: fontSize.xs,
    color: colors.primary500,
    fontFamily: fontFamily.medium,
    fontWeight: fontWeight.medium,
  },
  cardTitle: {
    fontSize: fontSize.xl,
    color: colors.primary,
    fontFamily: fontFamily.bold,
    fontWeight: fontWeight.bold,
    lineHeight: 26,
  },
  cardDesc: {
    fontSize: fontSize.sm,
    color: colors.primary500,
    fontFamily: fontFamily.regular,
    lineHeight: 20,
  },
  metaText: {
    fontSize: fontSize.sm,
    color: colors.primary700,
    fontFamily: fontFamily.medium,
    fontWeight: fontWeight.medium,
  },
  introImage: {
    width: '100%',
    aspectRatio: 4 / 3,
    borderRadius: radius.lg,
    backgroundColor: colors.primary100,
  },

  votesRow: { flexDirection: 'row', gap: 8, paddingTop: 2 },
  voteChip: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
    paddingVertical: 8,
    borderRadius: radius.md,
    backgroundColor: colors.primary50,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  voteChipActive: { backgroundColor: colors.accent50, borderColor: colors.accent },
  voteEmoji: { fontSize: 18 },
  voteLabel: {
    fontSize: fontSize.xs,
    color: colors.primary500,
    fontFamily: fontFamily.medium,
    fontWeight: fontWeight.medium,
  },
  voteLabelActive: { color: colors.accent700, fontFamily: fontFamily.bold, fontWeight: fontWeight.bold },
  voteCount: {
    fontSize: fontSize.sm,
    color: colors.primary700,
    fontFamily: fontFamily.bold,
    fontWeight: fontWeight.bold,
  },
  voteCountActive: { color: colors.accent700 },

  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 4,
  },
  refText: {
    flex: 1,
    fontSize: fontSize.xs,
    color: colors.primary500,
    fontFamily: fontFamily.medium,
    fontWeight: fontWeight.medium,
  },
  copyBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
  },
  copyBtnText: {
    fontSize: fontSize.sm,
    color: colors.surface,
    fontFamily: fontFamily.bold,
    fontWeight: fontWeight.bold,
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
