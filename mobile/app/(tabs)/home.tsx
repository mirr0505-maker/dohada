// 🚀 홈 — v4 통합기획서 디자인 기준
//   - 헤더: "Do : 하다" 브랜드 + 우상단 🔔 (Phase 1 placeholder)
//   - 내 챌린지 카드: 진행률 바 + 오늘 완료 배지 + D-N + 멤버 수
//   - 동료들의 인증: cross-section 으로 내가 멤버인 챌린지의 동료 인증 모음
import React, { useCallback, useState } from 'react';
import {
  View, Text, Pressable, FlatList, StyleSheet, RefreshControl, Alert,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Screen } from '@/components/Screen';
import { colors, fontFamily, fontSize, fontWeight, radius, shadow } from '@/lib/tokens';
import { useSession } from '@/lib/session';
import { fetchMyChallenges, fetchFellowProofs, type FellowProof } from '@/lib/db';
import { ErrorState } from '@/components/ErrorState';
import { ChallengeCardSkeleton } from '@/components/Skeleton';
import { reportError } from '@/lib/sentry';
import { haptic } from '@/lib/haptics';
import type { ChallengeWithCount } from '@/lib/types';

export default function HomeScreen() {
  const session = useSession();
  const [challenges, setChallenges] = useState<ChallengeWithCount[]>([]);
  const [fellowProofs, setFellowProofs] = useState<FellowProof[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const myUserId = session?.user?.id;

  const load = useCallback(async () => {
    if (!myUserId) return;
    try {
      setError(null);
      const [chs, fps] = await Promise.all([
        fetchMyChallenges(),
        fetchFellowProofs(myUserId),
      ]);
      setChallenges(chs);
      setFellowProofs(fps);
    } catch (e: any) {
      reportError(e, { where: 'home/load' });
      setError(e?.message ?? '불러오지 못했어요.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [myUserId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  // 미인증 시 로그인으로
  React.useEffect(() => {
    if (session === null) router.replace('/login');
  }, [session]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load();
  }, [load]);

  return (
    <Screen backgroundColor={colors.background}>
      <View style={styles.header}>
        <Text style={styles.brand}>
          <Text style={styles.brandDo}>Do</Text>
          <Text style={styles.brandColon}> : </Text>
          <Text style={styles.brandHada}>하다</Text>
        </Text>
        <Pressable
          style={styles.headerIcon}
          onPress={() => {
            haptic.tap();
            Alert.alert('알림', 'Phase 2 에서 활성화돼요.');
          }}
        >
          <Text style={{ fontSize: 18 }}>🔔</Text>
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.list}>
          <ChallengeCardSkeleton />
          <ChallengeCardSkeleton />
        </View>
      ) : error ? (
        <ErrorState message={error} onRetry={() => { setLoading(true); load(); }} />
      ) : (
        <FlatList
          data={fellowProofs}
          keyExtractor={p => p.id}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />
          }
          ListHeaderComponent={
            <View style={{ gap: 12 }}>
              {/* 내 챌린지 섹션 */}
              {challenges.length > 0 ? (
                <Text style={styles.sectionTitle}>참여 중인 챌린지 {challenges.length}</Text>
              ) : null}
              {challenges.map(c => (
                <ChallengeCard key={c.id} challenge={c} />
              ))}
              {challenges.length === 0 ? (
                <View style={styles.empty}>
                  <Text style={styles.emptyEmoji}>🌱</Text>
                  <Text style={styles.emptyText}>
                    아직 챌린지가 없어요.{'\n'}첫 챌린지를 만들어볼까요?
                  </Text>
                </View>
              ) : null}

              {/* 동료들의 인증 섹션 헤더 */}
              {fellowProofs.length > 0 ? (
                <View style={styles.fellowHeader}>
                  <Text style={styles.fellowTitle}>동료들의 인증</Text>
                  <Text style={styles.fellowSubtitle}>같이 도전 중인 분들의 최근 인증이에요</Text>
                </View>
              ) : null}
            </View>
          }
          renderItem={({ item }) => <FellowProofCard proof={item} />}
          ListEmptyComponent={null}
        />
      )}
    </Screen>
  );
}

// ─── 내 챌린지 카드 (진행률 바 + 오늘 완료 배지) ─────────────────
function ChallengeCard({ challenge }: { challenge: ChallengeWithCount }) {
  const { daysLeft, progress, dayN, totalDays } = computeProgress(challenge.start_date, challenge.end_date);

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
        <View style={styles.daysBadge}>
          <Text style={styles.daysBadgeText}>D-{daysLeft}</Text>
        </View>
      </View>
      <Text style={styles.cardMetaLine}>
        👥 {challenge.member_count}명 · {dayN}/{totalDays}일
      </Text>
      {/* 진행률 바 */}
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
      </View>
      {challenge.description ? (
        <Text style={styles.cardDesc} numberOfLines={2}>{challenge.description}</Text>
      ) : null}
    </Pressable>
  );
}

// ─── 동료 인증 카드 (작은 카드) ─────────────────
function FellowProofCard({ proof }: { proof: FellowProof }) {
  return (
    <Pressable
      style={styles.fellowCard}
      onPress={() => {
        haptic.tap();
        router.push(`/room/${proof.challenge_id}`);
      }}
    >
      <View style={styles.fellowAvatar}>
        <Text style={{ fontSize: 18 }}>{proof.nickname.slice(0, 1) || '🙂'}</Text>
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={styles.fellowName} numberOfLines={1}>
          {proof.nickname} · <Text style={styles.fellowChallenge}>{proof.challenge_title}</Text>
        </Text>
        <Text style={styles.fellowCaption} numberOfLines={2}>
          {proof.caption || '📷 인증 완료'}
        </Text>
        <Text style={styles.fellowTime}>{formatRelative(proof.created_at)}</Text>
      </View>
    </Pressable>
  );
}

// ─── 유틸 ─────────────────
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

function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return '방금';
  if (m < 60) return `${m}분 전`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}시간 전`;
  const d = Math.floor(h / 24);
  return `${d}일 전`;
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 24,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  brand: { letterSpacing: -0.4 },
  brandDo: {
    fontSize: fontSize['3xl'],
    color: colors.primary,
    fontFamily: fontFamily.bold,
    fontWeight: fontWeight.bold,
  },
  brandColon: {
    fontSize: fontSize['3xl'],
    color: colors.accent,
    fontFamily: fontFamily.bold,
    fontWeight: fontWeight.bold,
  },
  brandHada: {
    fontSize: fontSize['3xl'],
    color: colors.primary,
    fontFamily: fontFamily.bold,
    fontWeight: fontWeight.bold,
  },
  headerIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.primary100,
  },
  list: {
    paddingHorizontal: 24,
    paddingBottom: 24,
    gap: 12,
    flexGrow: 1,
  },
  sectionTitle: {
    fontSize: fontSize.base,
    color: colors.primary500,
    fontFamily: fontFamily.medium,
    fontWeight: fontWeight.semibold,
    marginBottom: 4,
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
  cardMetaLine: {
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
  progressFill: {
    height: 6,
    backgroundColor: colors.accent,
    borderRadius: 3,
  },
  cardDesc: {
    fontSize: fontSize.sm,
    color: colors.primary500,
    fontFamily: fontFamily.regular,
    lineHeight: 18,
    marginTop: 2,
  },
  empty: {
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
  // 동료 섹션
  fellowHeader: {
    marginTop: 16,
    marginBottom: 4,
  },
  fellowTitle: {
    fontSize: fontSize.lg,
    color: colors.primary,
    fontFamily: fontFamily.bold,
    fontWeight: fontWeight.bold,
  },
  fellowSubtitle: {
    fontSize: fontSize.xs,
    color: colors.primary500,
    fontFamily: fontFamily.regular,
    marginTop: 2,
  },
  fellowCard: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: 12,
    gap: 12,
    alignItems: 'flex-start',
    ...shadow.sm,
  },
  fellowAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.accent50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fellowName: {
    fontSize: fontSize.sm,
    color: colors.primary,
    fontFamily: fontFamily.medium,
    fontWeight: fontWeight.semibold,
  },
  fellowChallenge: {
    color: colors.primary500,
    fontFamily: fontFamily.regular,
    fontWeight: fontWeight.regular,
  },
  fellowCaption: {
    fontSize: fontSize.sm,
    color: colors.primary500,
    fontFamily: fontFamily.regular,
    lineHeight: 18,
  },
  fellowTime: {
    fontSize: fontSize.xs,
    color: colors.primary300,
    fontFamily: fontFamily.regular,
    marginTop: 2,
  },
});
