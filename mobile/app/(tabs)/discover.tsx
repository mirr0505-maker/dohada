// 🚀 하다 구경 (익명 발상 라이브러리, 0050 · 리디자인 v2) — "남들은 무슨 하다 하나?"
//   개설자·참여자 신원을 지운 익명 카드. 제목·내용·인증방식·타입·4평가·참조수만 정형화 노출.
//   목적 = 탐색이 아니라 '참조' (살펴보고 → 평가하고 → 따라하기). 카드 탭으로 방에 들어가지 않음(익명 보존).
import React, { useCallback, useMemo, useState } from 'react';
import {
  View, Text, Pressable, FlatList, StyleSheet, RefreshControl, Alert, ScrollView, Image,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Telescope, User, Handshake, Globe, Heart, type LucideIcon } from 'lucide-react-native';
import { Screen } from '@/components/Screen';
import { AppHeader } from '@/components/AppHeader';
import { EvalBox } from '@/components/EvalBox';
import { CategoryIcon } from '@/components/CategoryIcon';
import { ChallengeCardSkeleton } from '@/components/Skeleton';
import { ErrorState } from '@/components/ErrorState';
import { colors, fontFamily, fontSize, fontWeight, radius, textStyle, shadow } from '@/lib/tokens';
import { categorySlugByName } from '@/lib/icons';
import { useSession } from '@/lib/session';
import { fetchBrowseChallenges, toggleChallengeVote } from '@/lib/db';
import { formatCheerCount, displayTitle } from '@/lib/format';
import { reportError } from '@/lib/sentry';
import { haptic } from '@/lib/haptics';
import type { BrowseChallengeCard, ChallengeVoteType } from '@/lib/types';

// 4가지 평가 — 이모지 예외 4종 (수칙 #8: 각 의미 독립 보존)
const VOTE_OPTIONS: { type: ChallengeVoteType; emoji: string; label: string }[] = [
  { type: 'creative', emoji: '✨', label: '기발' },
  { type: 'hard',     emoji: '😱', label: '대단' },
  { type: 'touching', emoji: '🥹', label: '뭉클' },
  { type: 'fresh',    emoji: '💫', label: '새로움' },
];

// 방 타입 4종 — lucide 라인 아이콘 (§8 방종류 매핑) + 솔리드 배지색(토큰 내)
const KIND_BADGE: Record<string, { Icon: LucideIcon; label: string; color: string }> = {
  solo:    { Icon: User,      label: '나홀로',   color: colors.faint },
  closed:  { Icon: Handshake, label: '다함께',   color: colors.brand },
  open:    { Icon: Globe,     label: '누구나',   color: colors.done },
  cheered: { Icon: Heart,     label: '응원받기', color: colors.gold },
};

export default function DiscoverScreen() {
  const session = useSession();
  const myUserId = session?.user?.id;
  const [items, setItems] = useState<BrowseChallengeCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // 카테고리 필터 — 로드된 목록에 존재하는 분류만 칩으로 (null = 전체)
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const c of items) if (c.category) set.add(c.category.name);
    return Array.from(set);
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

  const onRefresh = useCallback(() => { setRefreshing(true); load(); }, [load]);

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
      setItems(prev => prev.map(c =>
        c.id === challengeId ? { ...c, my_votes: target.my_votes, votes_by_type: target.votes_by_type } : c,
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
    <Screen backgroundColor={colors.bg}>
      <AppHeader />
      <View style={styles.subHeader}>
        <Text style={styles.subTitle}>하다 구경</Text>
      </View>

      {/* 안내 — 탐색이 아니라 '참조' 톤 */}
      <View style={styles.curationInfo}>
        <Telescope size={18} color={colors.brandInk} strokeWidth={1.8} />
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
          {categories.map(name => {
            const active = categoryFilter === name;
            return (
              <Pressable
                key={name}
                style={[styles.filterChip, active && styles.filterChipActive]}
                onPress={() => { haptic.tap(); setCategoryFilter(active ? null : name); }}
              >
                <CategoryIcon slug={categorySlugByName[name]} size={14} color={active ? colors.brandInk : colors.sub} />
                <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>{name}</Text>
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
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brand} />
          }
          renderItem={({ item }) => (
            <BrowseCard challenge={item} onVote={(t) => onVote(item.id, t)} onCopy={() => onCopy(item)} />
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Telescope size={48} color={colors.faint} strokeWidth={1.5} />
              <Text style={styles.emptyText}>
                {categoryFilter ? `${categoryFilter} 분류의 하다가 아직 없어요.` : '아직 살펴볼 하다가 없어요.'}
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
  const KindIcon = badge.Icon;

  return (
    <View style={styles.card}>
      {/* 헤더: 타입 배지 + 카테고리 */}
      <View style={styles.cardHeader}>
        <View style={[styles.typeBadge, { backgroundColor: badge.color }]}>
          <KindIcon size={12} color={colors.onBrand} strokeWidth={2.2} />
          <Text style={styles.typeBadgeText}>{badge.label}</Text>
        </View>
        {challenge.category && (
          <View style={styles.categoryRow}>
            <CategoryIcon slug={categorySlugByName[challenge.category.name]} size={13} color={colors.sub} />
            <Text style={styles.categoryText} numberOfLines={1}>{challenge.category.name}</Text>
          </View>
        )}
      </View>

      <Text style={styles.cardTitle} numberOfLines={2}>{displayTitle(challenge.title)}</Text>
      {challenge.description ? (
        <Text style={styles.cardDesc} numberOfLines={3}>{challenge.description}</Text>
      ) : null}

      {/* 정형화된 기간 · 인증방식 */}
      <Text style={styles.metaText}>{periodText(challenge)} · {methodText(challenge)}</Text>

      {/* 안내문 이미지 (개설자 opt-out 시 RPC 가 null → 표시 안 함) */}
      {challenge.intro_image_url && (
        <Image source={{ uri: challenge.intro_image_url }} style={styles.introImage} resizeMode="cover" />
      )}

      {/* 4가지 평가 — EvalBox (이모지 예외) */}
      <View style={styles.votesRow}>
        {VOTE_OPTIONS.map(({ type, emoji, label }) => (
          <EvalBox
            key={type}
            emoji={emoji}
            label={label}
            count={challenge.votes_by_type[type] ?? 0}
            selected={challenge.my_votes.includes(type)}
            onPress={() => onVote(type)}
          />
        ))}
      </View>

      {/* 푸터: 참조수 + 따라하기 */}
      <View style={styles.cardFooter}>
        <Text style={styles.refText} numberOfLines={1}>
          {challenge.reference_count > 0
            ? `${formatCheerCount(challenge.reference_count)}번 따라 했어요`
            : '아직 따라한 사람이 없어요'}
        </Text>
        <Pressable style={styles.copyBtn} onPress={onCopy} hitSlop={4}>
          <Text style={styles.copyBtnText}>따라하기</Text>
        </Pressable>
      </View>
    </View>
  );
}

// ─── 유틸 ───
function periodText(c: BrowseChallengeCard): string {
  const start = new Date(c.start_date + 'T00:00:00');
  const end = new Date(c.end_date + 'T00:00:00');
  const days = Math.max(1, Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1);
  return `${days}일`;
}

function methodText(c: BrowseChallengeCard): string {
  if (c.goal_type === 'count') return `목표 ${c.target_count ?? 0}개`;
  switch (c.frequency) {
    case 'weekly3': return '주 3회 인증';
    case 'weekly1': return '주 1회 인증';
    default:        return '매일 인증';
  }
}

const styles = StyleSheet.create({
  subHeader: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 },
  subTitle: { ...textStyle.greeting, color: colors.ink, letterSpacing: -0.3 },

  curationInfo: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginHorizontal: 20, marginBottom: 12,
    paddingHorizontal: 14, paddingVertical: 10,
    backgroundColor: colors.brandTint, borderRadius: radius.md,
  },
  curationText: { flex: 1, fontSize: fontSize.sm, color: colors.sub, fontFamily: fontFamily.regular },
  curationStrong: { color: colors.brandInk, fontFamily: fontFamily.bold, fontWeight: fontWeight.bold },

  // 칩 높이를 lineHeight+height 로 결정화 (이모지·기기 무관, 갤S9 잘림 방지)
  filterRow: { flexGrow: 0, height: 48, marginBottom: 8 },
  filterRowInner: { paddingHorizontal: 20, gap: 8, alignItems: 'center' },
  filterChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.lineSoft,
    borderWidth: 1, borderColor: 'transparent',
  },
  filterChipActive: { backgroundColor: colors.brandTint, borderColor: colors.brand },
  filterChipText: {
    fontSize: fontSize.sm, lineHeight: 18, includeFontPadding: false,
    color: colors.sub, fontFamily: fontFamily.medium, fontWeight: fontWeight.medium,
  },
  filterChipTextActive: { color: colors.brandInk, fontFamily: fontFamily.bold, fontWeight: fontWeight.bold },

  list: { paddingHorizontal: 20, paddingBottom: 32, gap: 12, flexGrow: 1 },

  card: {
    backgroundColor: colors.surface, borderRadius: radius.xl,
    borderWidth: 0.5, borderColor: colors.line,
    padding: 16, gap: 10, ...shadow.sm,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  typeBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill,
  },
  typeBadgeText: { fontSize: fontSize.xs, color: colors.onBrand, fontFamily: fontFamily.bold, fontWeight: fontWeight.bold },
  categoryRow: { flexShrink: 1, flexDirection: 'row', alignItems: 'center', gap: 4 },
  categoryText: { flexShrink: 1, fontSize: fontSize.xs, color: colors.sub, fontFamily: fontFamily.medium, fontWeight: fontWeight.medium },
  cardTitle: { ...textStyle.cardTitle, fontSize: fontSize.xl, color: colors.ink, lineHeight: 26 },
  cardDesc: { fontSize: fontSize.sm, color: colors.sub, fontFamily: fontFamily.regular, lineHeight: 20 },
  metaText: { fontSize: fontSize.sm, color: colors.sub, fontFamily: fontFamily.medium, fontWeight: fontWeight.medium },
  introImage: { width: '100%', aspectRatio: 4 / 3, borderRadius: radius.lg, backgroundColor: colors.line },

  votesRow: { flexDirection: 'row', gap: 8, paddingTop: 2 },

  cardFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 4 },
  refText: { flex: 1, fontSize: fontSize.xs, color: colors.faint, fontFamily: fontFamily.medium, fontWeight: fontWeight.medium },
  copyBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: radius.pill, backgroundColor: colors.brand },
  copyBtnText: { fontSize: fontSize.sm, color: colors.onBrand, fontFamily: fontFamily.bold, fontWeight: fontWeight.bold },

  empty: { flex: 1, paddingVertical: 80, alignItems: 'center', justifyContent: 'center', gap: 16 },
  emptyText: { fontSize: fontSize.base, color: colors.faint, fontFamily: fontFamily.regular, textAlign: 'center', lineHeight: 22 },
});
