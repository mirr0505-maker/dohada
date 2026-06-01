// 🚀 홈 — v2.2 SNS 정체성 강조 재구성
//   헤더: 로고 + 닉네임 + 알람 + 아바타 (탭 → 내정보)
//   Hero: gradient + 동적 헤드라인 (5단계 자아실현 톤)
//   섹션 1 — 내 챌린지: 상위 3 + 더보기 → 내챌린지 탭
//   섹션 2 — 둘러보기: 오픈 챌린지 상위 3 + 더보기 → 둘러보기 탭
//   푸터: "더 나은 나, 더 나은 세상" 슬로건 (정체성 마무리)
import React, { useCallback, useState } from 'react';
import {
  View, Text, Pressable, ScrollView, StyleSheet, RefreshControl, Alert, Image,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Screen } from '@/components/Screen';
import { AppHeader } from '@/components/AppHeader';
import { colors, fontFamily, fontSize, fontWeight, radius, shadow } from '@/lib/tokens';
import { useSession } from '@/lib/session';
import {
  fetchMyChallenges, fetchOpenChallenges,
  type OpenChallengeCard,
} from '@/lib/db';
import { ErrorState } from '@/components/ErrorState';
import { ChallengeCardSkeleton } from '@/components/Skeleton';
import { reportError } from '@/lib/sentry';
import { haptic } from '@/lib/haptics';
import type { ChallengeWithCount } from '@/lib/types';
import { formatCheerCount } from '@/lib/format';

const MAX_PREVIEW = 3;

export default function HomeScreen() {
  const session = useSession();
  const [challenges, setChallenges] = useState<ChallengeWithCount[]>([]);
  const [openChs, setOpenChs] = useState<OpenChallengeCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const myUserId = session?.user?.id;

  const load = useCallback(async () => {
    if (!myUserId) return;
    try {
      setError(null);
      const [chs, opens] = await Promise.all([
        fetchMyChallenges(myUserId),
        fetchOpenChallenges(myUserId),
      ]);
      setChallenges(chs);
      setOpenChs(opens);
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

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load();
  }, [load]);

  const myCount = challenges.length;
  // Hero 동적 헤드라인: 챌린지 수에 따라 5단계 자아실현 톤
  const heroLine = myCount > 0
    ? { top: '오늘도 한 걸음', bottom: `${myCount}개 챌린지 진행 중이에요` }
    : { top: '비교 없이 응원받는', bottom: '첫 한 걸음을 선언해볼까요?' };

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
          {/* ─── Hero — accent50 배경 + 동적 헤드라인 ─── */}
          <View style={styles.hero}>
            <Text style={styles.heroTop}>{heroLine.top}</Text>
            <Text style={styles.heroBottom}>{heroLine.bottom}</Text>
          </View>

          {/* ─── 섹션 1: 내 챌린지 ─── */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>내 챌린지</Text>
              {myCount > 0 && (
                <Pressable
                  onPress={() => { haptic.tap(); router.push('/(tabs)/my-challenges' as any); }}
                  hitSlop={8}
                >
                  <Text style={styles.more}>더보기 →</Text>
                </Pressable>
              )}
            </View>

            {myCount === 0 ? (
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
            ) : (
              challenges.slice(0, MAX_PREVIEW).map(c => (
                <MyChallengeCard key={c.id} challenge={c} />
              ))
            )}
          </View>

          {/* ─── 섹션 2: 둘러보기 ─── */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>둘러보기</Text>
              {openChs.length > 0 && (
                <Pressable
                  onPress={() => { haptic.tap(); router.push('/(tabs)/discover' as any); }}
                  hitSlop={8}
                >
                  <Text style={styles.more}>더보기 →</Text>
                </Pressable>
              )}
            </View>

            {openChs.length === 0 ? (
              <View style={styles.discEmpty}>
                <Text style={styles.discEmptyText}>아직 공개 챌린지가 없어요.</Text>
              </View>
            ) : (
              openChs.slice(0, MAX_PREVIEW).map(c => (
                <DiscoverMiniCard key={c.id} challenge={c} />
              ))
            )}
          </View>

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

// ─── 내 챌린지 카드 (v4 패턴 — 간략화) ─────────────────
function MyChallengeCard({ challenge }: { challenge: ChallengeWithCount }) {
  const { daysLeft, progress, dayN, totalDays } = computeProgress(challenge.start_date, challenge.end_date);
  return (
    <Pressable
      style={styles.myCard}
      onPress={() => { haptic.tap(); router.push(`/room/${challenge.id}` as any); }}
    >
      <View style={styles.myCardRow}>
        <Text style={styles.myCardTitle} numberOfLines={1}>{challenge.title}</Text>
        <Text style={styles.myCardDday}>D-{daysLeft}</Text>
      </View>
      <Text style={styles.myCardMeta}>
        {roomKindShort(challenge.kind)} · {dayN}/{totalDays}일
      </Text>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
      </View>
    </Pressable>
  );
}

// ─── 둘러보기 미니 카드 (4가지 평가 chips 포함) ────────
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
            <Text style={styles.badgeText}>🌍 임팩트</Text>
          </View>
        ) : (
          <View style={{ flex: 0 }} />
        )}
        <Text style={[styles.discDday, isImpact && { color: colors.success }]}>D-{daysLeft}</Text>
      </View>
      <Text style={styles.discTitle} numberOfLines={1}>{challenge.title}</Text>
      <View style={styles.discStats}>
        <Text style={styles.discStat}>👥 {challenge.member_count}명</Text>
        <Text style={styles.discStat}>
          @{challenge.creator?.nickname ?? '익명'}
        </Text>
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

// ─── 유틸 ─────────────────
function roomKindShort(kind: string): string {
  if (kind === 'solo')    return '혼자 도전';
  if (kind === 'cheered') return '응원받는 도전';
  if (kind === 'open')    return '누구나 합류';
  return '함께 도전';
}

function computeProgress(start: string, end: string) {
  const startDate = new Date(start + 'T00:00:00');
  const endDate = new Date(end + 'T23:59:59');
  const now = new Date();
  const totalDays = Math.max(1, Math.round((endDate.getTime() - startDate.getTime()) / 86_400_000) + 1);
  const elapsed = Math.max(0, Math.round((now.getTime() - startDate.getTime()) / 86_400_000));
  const dayN = Math.min(totalDays, elapsed + 1);
  const progress = Math.min(1, Math.max(0, elapsed / totalDays));
  const daysLeft = Math.max(0, Math.ceil((endDate.getTime() - now.getTime()) / 86_400_000));
  return { daysLeft, progress, dayN, totalDays };
}

function computeDaysLeft(endDate: string): number {
  const end = new Date(endDate + 'T23:59:59');
  return Math.max(0, Math.ceil((end.getTime() - Date.now()) / 86_400_000));
}

const styles = StyleSheet.create({
  // 헤더
  header: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.primary100,
    ...shadow.sm,
  },
  brand: { flexDirection: 'row', alignItems: 'baseline', gap: 0 },
  brandDo: {
    fontSize: fontSize.xl,
    color: colors.primary,
    fontFamily: fontFamily.bold,
    fontWeight: fontWeight.bold,
    letterSpacing: -0.4,
  },
  brandColon: {
    fontSize: fontSize.xl,
    color: colors.accent,
    fontFamily: fontFamily.bold,
    fontWeight: fontWeight.bold,
    marginHorizontal: 2,
  },
  brandHada: {
    fontSize: fontSize.xl,
    color: colors.primary,
    fontFamily: fontFamily.bold,
    fontWeight: fontWeight.bold,
    letterSpacing: -0.4,
  },
  headerNick: {
    flex: 1,
    fontSize: fontSize.base,
    color: colors.primary500,
    fontFamily: fontFamily.medium,
    fontWeight: fontWeight.medium,
    marginLeft: 6,
  },
  headerIcon: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: colors.primary50,
    alignItems: 'center', justifyContent: 'center',
  },
  headerAvatar: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: colors.accent50,
    overflow: 'hidden',
  },
  headerAvatarFallback: { alignItems: 'center', justifyContent: 'center' },
  headerAvatarInit: {
    fontSize: 14,
    color: colors.accent700,
    fontFamily: fontFamily.bold,
    fontWeight: fontWeight.bold,
  },

  // 본문 스크롤
  scroll: { paddingBottom: 40 },
  list: { paddingHorizontal: 24, paddingTop: 16, gap: 12 },

  // Hero
  hero: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 28,
    backgroundColor: colors.accent50,
  },
  heroTop: {
    fontSize: fontSize.base,
    color: colors.accent700,
    fontFamily: fontFamily.medium,
    fontWeight: fontWeight.semibold,
    marginBottom: 4,
  },
  heroBottom: {
    fontSize: fontSize['2xl'],
    color: colors.primary,
    fontFamily: fontFamily.bold,
    fontWeight: fontWeight.bold,
    letterSpacing: -0.4,
    lineHeight: 32,
  },

  // 섹션 공통
  section: {
    paddingHorizontal: 20,
    paddingTop: 20,
    gap: 10,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  sectionTitle: {
    fontSize: fontSize.lg,
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

  // 빈 상태 (내 챌린지)
  emptyCard: {
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

  // 내 챌린지 카드
  myCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: 14,
    gap: 6,
    ...shadow.sm,
  },
  myCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  myCardTitle: {
    flex: 1,
    fontSize: fontSize.base,
    color: colors.primary,
    fontFamily: fontFamily.bold,
    fontWeight: fontWeight.bold,
  },
  myCardDday: {
    fontSize: fontSize.sm,
    color: colors.accent,
    fontFamily: fontFamily.bold,
    fontWeight: fontWeight.bold,
  },
  myCardMeta: {
    fontSize: fontSize.xs,
    color: colors.primary500,
    fontFamily: fontFamily.regular,
  },
  progressTrack: {
    height: 6,
    backgroundColor: colors.primary100,
    borderRadius: 3,
    overflow: 'hidden',
    marginTop: 2,
  },
  progressFill: {
    height: 6,
    backgroundColor: colors.accent,
    borderRadius: 3,
  },

  // 둘러보기 미니 카드
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
  discRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    backgroundColor: colors.success,
    borderRadius: radius.pill,
  },
  badgeImpact: { backgroundColor: colors.success },
  badgeText: {
    fontSize: 10,
    color: colors.surface,
    fontFamily: fontFamily.bold,
    fontWeight: fontWeight.bold,
  },
  discDday: {
    fontSize: fontSize.sm,
    color: colors.accent,
    fontFamily: fontFamily.bold,
    fontWeight: fontWeight.bold,
  },
  discTitle: {
    fontSize: fontSize.base,
    color: colors.primary,
    fontFamily: fontFamily.bold,
    fontWeight: fontWeight.bold,
  },
  discStats: {
    flexDirection: 'row',
    gap: 12,
  },
  discStat: {
    fontSize: fontSize.xs,
    color: colors.primary500,
    fontFamily: fontFamily.regular,
  },
  votesRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 4,
  },
  voteChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
    backgroundColor: colors.primary50,
  },
  voteEmoji: { fontSize: 12 },
  voteCount: {
    fontSize: 11,
    color: colors.primary500,
    fontFamily: fontFamily.medium,
    fontWeight: fontWeight.medium,
  },
  discEmpty: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  discEmptyText: {
    fontSize: fontSize.sm,
    color: colors.primary500,
    fontFamily: fontFamily.regular,
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
