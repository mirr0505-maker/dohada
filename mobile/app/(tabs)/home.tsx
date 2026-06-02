// 🚀 홈 v2.3 — 분류별 SNS 톤이 다른 4개 그룹 컨테이너
//   순서: 🤫 혼자만의 다짐 → 🙋 응원받는 도전 → 🤝 함께 도전 → 🌍 누구나 합류
//   각 분류는 서로 다른 SNS 경험 — 같은 앱 안에 4개의 다른 정체성이 공존.
//   동료 활동은 챌린지방 안에서만 보임 (홈 Feed 로 옮기지 않음 — 컨텍스트 보존).
import React, { useCallback, useState } from 'react';
import {
  View, Text, Pressable, ScrollView, StyleSheet, RefreshControl, Image,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Screen } from '@/components/Screen';
import { AppHeader } from '@/components/AppHeader';
import { colors, fontFamily, fontSize, fontWeight, radius, shadow } from '@/lib/tokens';
import { useSession } from '@/lib/session';
import {
  fetchMyChallengesWithDetails, fetchOpenChallenges, fetchInterestingOpenChallenges,
  type MyChallengeDetail, type OpenChallengeCard, type InterestingChallenge,
} from '@/lib/db';
import { ErrorState } from '@/components/ErrorState';
import { ChallengeCardSkeleton } from '@/components/Skeleton';
import { MyChallengeCard } from '@/components/home/MyChallengeCard';
import { reportError } from '@/lib/sentry';
import { haptic } from '@/lib/haptics';
import { formatCheerCount } from '@/lib/format';
import type { ChallengeKind } from '@/lib/types';

const MAX_PER_GROUP = 3;
const DISCOVER_PREVIEW = 3;

type Group = {
  kind: ChallengeKind;
  title: string;
  items: MyChallengeDetail[];
};

export default function HomeScreen() {
  const session = useSession();
  const [details, setDetails] = useState<MyChallengeDetail[]>([]);
  const [openChs, setOpenChs] = useState<OpenChallengeCard[]>([]);
  const [interestingChs, setInterestingChs] = useState<InterestingChallenge[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const myUserId = session?.user?.id;

  const load = useCallback(async () => {
    if (!myUserId) return;
    try {
      setError(null);
      const [det, opens, interesting] = await Promise.all([
        fetchMyChallengesWithDetails(myUserId),
        fetchOpenChallenges(myUserId),
        fetchInterestingOpenChallenges(myUserId, 6).catch(() => []),   // 마이그레이션 0014 미적용 시 빈 배열
      ]);
      setDetails(det);
      setOpenChs(opens);
      setInterestingChs(interesting);
    } catch (e: any) {
      reportError(e, { where: 'home/load' });
      setError(e?.message ?? '불러오지 못했어요.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [myUserId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  React.useEffect(() => {
    if (session === null) router.replace('/login');
  }, [session]);

  const onRefresh = useCallback(() => { setRefreshing(true); load(); }, [load]);

  // 분류별 그룹화 — 순서: solo → cheered → closed → open
  const groups: Group[] = [
    { kind: 'solo',    title: '🤫 혼자만의 다짐', items: details.filter(c => c.kind === 'solo') },
    { kind: 'cheered', title: '🙋 응원받는 도전', items: details.filter(c => c.kind === 'cheered') },
    { kind: 'closed',  title: '🤝 함께 도전',     items: details.filter(c => c.kind === 'closed') },
    { kind: 'open',    title: '🌍 누구나 합류',   items: details.filter(c => c.kind === 'open') },
  ];

  const totalCount = details.length;
  // 본인 미니 상태 카피 — 단순 카운트 (5단계 자아실현 톤)
  const miniLine = totalCount > 0
    ? `오늘도 한 걸음 · ${totalCount}개 도전 진행 중`
    : '비교 없이 응원받는 곳, 첫 한 걸음을 선언해볼까요?';

  return (
    <Screen backgroundColor={colors.background}>
      <AppHeader />

      {loading ? (
        <View style={styles.list}>
          <ChallengeCardSkeleton />
          <ChallengeCardSkeleton />
        </View>
      ) : error ? (
        <ErrorState message={error} onRetry={() => { setLoading(true); load(); }} />
      ) : (
        <ScrollView
          contentContainerStyle={styles.scroll}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />
          }
          showsVerticalScrollIndicator={false}
        >
          {/* ─── 본인 미니 상태 (한 줄) ─── */}
          <View style={styles.mini}>
            <Text style={styles.miniText}>{miniLine}</Text>
          </View>

          {/* ─── 빈 상태 (챌린지 0개) ─── */}
          {totalCount === 0 && (
            <Pressable
              style={styles.emptyCard}
              onPress={() => { haptic.tap(); router.push('/create' as any); }}
            >
              <Text style={styles.emptyEmoji}>🌱</Text>
              <Text style={styles.emptyTitle}>아직 도전이 없어요</Text>
              <Text style={styles.emptyDesc}>
                조용히 응원받는 첫 한 걸음,{'\n'}시작해볼까요?
              </Text>
              <View style={styles.emptyCta}>
                <Text style={styles.emptyCtaText}>+ 첫 도전 선언하기</Text>
              </View>
            </Pressable>
          )}

          {/* ─── 4분류 그룹 컨테이너 ─── */}
          {groups.map(group => group.items.length === 0 ? null : (
            <View key={group.kind} style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>{group.title}</Text>
                {group.items.length > MAX_PER_GROUP && (
                  <Pressable
                    onPress={() => { haptic.tap(); router.push('/(tabs)/my-challenges' as any); }}
                    hitSlop={8}
                  >
                    <Text style={styles.more}>더보기 →</Text>
                  </Pressable>
                )}
              </View>
              <View style={{ gap: 10 }}>
                {group.items.slice(0, MAX_PER_GROUP).map(c => (
                  <MyChallengeCard key={c.id} challenge={c} />
                ))}
              </View>
            </View>
          ))}

          {/* ─── ✨ 관심 도전 — 본인 관심 분류 매칭 open 챌린지 ─── */}
          {interestingChs.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>✨ 관심 도전</Text>
                <Pressable
                  onPress={() => { haptic.tap(); router.push('/(tabs)/discover' as any); }}
                  hitSlop={8}
                >
                  <Text style={styles.more}>더보기 →</Text>
                </Pressable>
              </View>
              <View style={{ gap: 10 }}>
                {interestingChs.map(c => (
                  <View key={c.id}>
                    {c.matched_category && (
                      <Text style={styles.matchLabel}>
                        🎯 {c.matched_category.emoji} {c.matched_category.name} 관심
                      </Text>
                    )}
                    <DiscoverMiniCard challenge={c} />
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* ─── 둘러보기 미니 섹션 ─── */}
          {openChs.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>🔍 둘러보기</Text>
                <Pressable
                  onPress={() => { haptic.tap(); router.push('/(tabs)/discover' as any); }}
                  hitSlop={8}
                >
                  <Text style={styles.more}>더보기 →</Text>
                </Pressable>
              </View>
              <View style={{ gap: 10 }}>
                {openChs.slice(0, DISCOVER_PREVIEW).map(c => (
                  <DiscoverMiniCard key={c.id} challenge={c} />
                ))}
              </View>
            </View>
          )}

          {/* ─── 푸터 슬로건 ─── */}
          <View style={styles.footer}>
            <Text style={styles.footerSlogan}>도전, 그냥 하다.</Text>
            <Text style={styles.footerSub}>더 나은 나, 더 나은 세상.</Text>
          </View>
        </ScrollView>
      )}
    </Screen>
  );
}

// ─── 둘러보기 미니 카드 (기존 코드 유지) ────────────
function DiscoverMiniCard({ challenge }: { challenge: OpenChallengeCard }) {
  const isImpact = !!challenge.category?.is_impact;
  const daysLeft = computeDaysLeft(challenge.end_date);
  return (
    <Pressable
      style={[styles.discCard, isImpact && styles.discCardImpact]}
      onPress={() => { haptic.tap(); router.push(`/room/${challenge.id}` as any); }}
    >
      <View style={styles.discRow}>
        {isImpact ? (
          <View style={[styles.badge, styles.badgeImpact]}>
            <Text style={styles.badgeText}>🌍 사회공헌</Text>
          </View>
        ) : (
          <View style={{ flex: 0 }} />
        )}
        <Text style={[styles.discDday, isImpact && { color: colors.success }]}>D-{daysLeft}</Text>
      </View>
      <Text style={styles.discTitle} numberOfLines={1}>{challenge.title}</Text>
      <View style={styles.discStats}>
        <Text style={styles.discStat}>👥 {challenge.member_count}명</Text>
        <Text style={styles.discStat}>@{challenge.creator?.nickname ?? '익명'}</Text>
      </View>
      <View style={styles.votesRow}>
        {(['creative','hard','touching','fresh'] as const).map(t => {
          const count = challenge.votes_by_type?.[t] ?? 0;
          const emoji = { creative: '✨', hard: '😱', touching: '🥹', fresh: '💫' }[t];
          return (
            <View key={t} style={styles.voteChip}>
              <Text style={styles.voteEmoji}>{emoji}</Text>
              <Text style={styles.voteCount}>{formatCheerCount(count)}</Text>
            </View>
          );
        })}
      </View>
    </Pressable>
  );
}

function computeDaysLeft(endDate: string): number {
  const end = new Date(endDate + 'T23:59:59');
  return Math.max(0, Math.ceil((end.getTime() - Date.now()) / 86_400_000));
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: 40 },
  list: { paddingHorizontal: 24, paddingTop: 16, gap: 12 },

  // 본인 미니 상태 (한 줄)
  mini: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
  },
  miniText: {
    fontSize: fontSize.base,
    color: colors.primary,
    fontFamily: fontFamily.medium,
    fontWeight: fontWeight.medium,
    letterSpacing: -0.2,
  },

  // 빈 상태 카드
  emptyCard: {
    marginHorizontal: 20,
    marginTop: 8,
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    paddingVertical: 32,
    paddingHorizontal: 24,
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: colors.primary100,
    borderStyle: 'dashed',
  },
  emptyEmoji: { fontSize: 48, marginBottom: 4 },
  emptyTitle: {
    fontSize: fontSize.lg,
    color: colors.primary,
    fontFamily: fontFamily.bold,
    fontWeight: fontWeight.bold,
  },
  emptyDesc: {
    fontSize: fontSize.sm,
    color: colors.primary500,
    fontFamily: fontFamily.regular,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 8,
  },
  emptyCta: {
    marginTop: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: colors.accent,
    borderRadius: radius.pill,
  },
  emptyCtaText: {
    color: colors.surface,
    fontSize: fontSize.base,
    fontFamily: fontFamily.bold,
    fontWeight: fontWeight.bold,
  },

  // 섹션 (분류별 그룹 + 둘러보기 공통)
  section: {
    paddingHorizontal: 20,
    paddingTop: 16,
    gap: 8,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  sectionTitle: {
    fontSize: fontSize.base,
    color: colors.primary,
    fontFamily: fontFamily.bold,
    fontWeight: fontWeight.bold,
    letterSpacing: -0.2,
  },
  more: {
    fontSize: fontSize.sm,
    color: colors.accent,
    fontFamily: fontFamily.medium,
    fontWeight: fontWeight.semibold,
  },
  matchLabel: {
    fontSize: 11,
    color: colors.accent700,
    fontFamily: fontFamily.medium,
    fontWeight: fontWeight.semibold,
    marginBottom: 4,
    marginLeft: 4,
  },

  // 둘러보기 미니 카드 (기존 그대로)
  discCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: 14,
    gap: 8,
    ...shadow.sm,
  },
  discCardImpact: {
    backgroundColor: '#F1FBF3',
    borderWidth: 1,
    borderColor: colors.success,
  },
  discRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  badge: { paddingHorizontal: 10, paddingVertical: 3, backgroundColor: colors.success, borderRadius: radius.pill },
  badgeImpact: { backgroundColor: colors.success },
  badgeText: { fontSize: 10, color: colors.surface, fontFamily: fontFamily.bold, fontWeight: fontWeight.bold },
  discDday: { fontSize: fontSize.sm, color: colors.accent, fontFamily: fontFamily.bold, fontWeight: fontWeight.bold },
  discTitle: { fontSize: fontSize.base, color: colors.primary, fontFamily: fontFamily.bold, fontWeight: fontWeight.bold },
  discStats: { flexDirection: 'row', gap: 12 },
  discStat: { fontSize: fontSize.xs, color: colors.primary500, fontFamily: fontFamily.regular },
  votesRow: { flexDirection: 'row', gap: 6, marginTop: 4 },
  voteChip: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: radius.pill, backgroundColor: colors.primary50,
  },
  voteEmoji: { fontSize: 12 },
  voteCount: {
    fontSize: 11, color: colors.primary500,
    fontFamily: fontFamily.medium, fontWeight: fontWeight.medium,
  },

  // 푸터 슬로건
  footer: {
    marginTop: 32,
    paddingHorizontal: 24,
    paddingVertical: 20,
    alignItems: 'center',
    gap: 4,
  },
  footerSlogan: {
    fontSize: fontSize.base,
    color: colors.primary500,
    fontFamily: fontFamily.bold,
    fontWeight: fontWeight.bold,
    letterSpacing: -0.2,
  },
  footerSub: {
    fontSize: fontSize.xs,
    color: colors.primary300,
    fontFamily: fontFamily.regular,
  },
});
