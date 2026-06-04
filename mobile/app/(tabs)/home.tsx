// 🚀 홈 (v2.5) — SNS-first 피드: 도전 인연들의 하루
//
// 사상 전환: v2.1~v2.4 "X 빼기" 일변도 → "버릴 건 망가진 방식, 지킬 건 욕구 자체"
//   - 내 대시보드는 me-strip 1줄로 압축 (대시보드 X)
//   - 본문은 도전 인연들의 하루 — 피드 카드 5종:
//     🎉 완주 리본 · 📸 오늘의 인증 · 🙋 응원받기 · ✨ 관심 도전 · 🌍 누구나 합류
//   - 맨 아래 🌙 "오늘은 여기까지예요" 끝 마커 (무한 스크롤 차단)
//
// 도전 인연 정의 (베타 v2.5) = 현재 같은 챌린지의 멤버 (×횟수 누적은 Phase 2)
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
  fetchPublicCompletionStories, fetchFellowProofs,
  type MyChallengeDetail, type OpenChallengeCard, type InterestingChallenge,
  type FellowProof,
} from '@/lib/db';
import { ErrorState } from '@/components/ErrorState';
import { ChallengeCardSkeleton } from '@/components/Skeleton';
import { reportError } from '@/lib/sentry';
import { haptic } from '@/lib/haptics';
import type { CompletionStoryCard } from '@/lib/types';

export default function HomeScreen() {
  const session = useSession();
  const [myChs, setMyChs]                   = useState<MyChallengeDetail[]>([]);
  const [completions, setCompletions]       = useState<CompletionStoryCard[]>([]);
  const [todayProofs, setTodayProofs]       = useState<FellowProof[]>([]);
  const [interestingChs, setInteresting]    = useState<InterestingChallenge[]>([]);
  const [openChs, setOpenChs]               = useState<OpenChallengeCard[]>([]);
  const [loading, setLoading]               = useState(true);
  const [refreshing, setRefreshing]         = useState(false);
  const [error, setError]                   = useState<string | null>(null);

  const myUserId = session?.user?.id;

  const load = useCallback(async () => {
    if (!myUserId) return;
    try {
      setError(null);
      const [mine, fellows, recentDone, interesting, opens] = await Promise.all([
        fetchMyChallengesWithDetails(myUserId),
        fetchFellowProofs(myUserId, 5),
        fetchPublicCompletionStories({ limit: 3 }).catch(() => []),
        fetchInterestingOpenChallenges(myUserId, 3).catch(() => []),
        fetchOpenChallenges(myUserId),
      ]);
      setMyChs(mine);
      setCompletions(recentDone);
      // 오늘 인증한 동료만 (당일 날짜 매칭)
      const today = new Date().toISOString().slice(0, 10);
      setTodayProofs(fellows.filter(p => p.created_at.slice(0, 10) === today).slice(0, 3));
      setInteresting(interesting);
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

  const onRefresh = useCallback(() => { setRefreshing(true); load(); }, [load]);

  // ─── me-strip 카피 ───
  const totalCount = myChs.length;
  const cheeredRooms = myChs.filter(c => c.kind === 'cheered');

  // 오늘 인증 액션 — 미인증 챌린지 1개면 즉시, 여러개면 내도전 탭
  const onCheckinAction = () => {
    haptic.tap();
    if (totalCount === 0) {
      router.push('/create' as any);
      return;
    }
    // 베타 단순화: 내도전 탭으로 이동 → 사용자가 선택. (Phase 1.5 에 미인증 모달)
    router.push('/(tabs)/my-challenges' as any);
  };

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
          {/* me-strip — 1줄 + [인증하기] */}
          <View style={styles.meStrip}>
            <Text style={styles.meText}>
              {totalCount === 0
                ? '비교 없이 응원받는 곳에 오신 걸 환영해요.'
                : `오늘도 한 걸음 · 진행 중 ${totalCount}개`}
            </Text>
            <Pressable style={styles.meCta} onPress={onCheckinAction}>
              <Text style={styles.meCtaText}>
                {totalCount === 0 ? '시작하기' : '인증하기'}
              </Text>
            </Pressable>
          </View>

          {/* 빈 상태 카드 */}
          {totalCount === 0 && completions.length === 0 && openChs.length === 0 && (
            <Pressable
              style={styles.emptyCard}
              onPress={() => { haptic.tap(); router.push('/create' as any); }}
            >
              <Text style={styles.emptyEmoji}>🌱</Text>
              <Text style={styles.emptyTitle}>아직 도전이 없어요</Text>
              <Text style={styles.emptyDesc}>
                조용히 응원받는 첫 한 걸음,{'\n'}시작해볼까요?
              </Text>
              <View style={styles.emptyCtaBox}>
                <Text style={styles.emptyCtaText}>+ 첫 도전 선언하기</Text>
              </View>
            </Pressable>
          )}

          {(completions.length > 0 || todayProofs.length > 0 || cheeredRooms.length > 0 ||
            interestingChs.length > 0 || openChs.length > 0) && (
            <Text style={styles.sectionLabel}>오늘, 도전 인연들의 하루</Text>
          )}

          {/* 1. 🎉 완주 리본 — 최근 공개 완주 이야기 */}
          {completions.map(c => (
            <CompletionRibbon key={c.id} story={c} />
          ))}

          {/* 2. 📸 오늘의 인증 — 동료 사진 카드 */}
          {todayProofs.map(p => (
            <TodayProofCard key={p.id} proof={p} />
          ))}

          {/* 3. 🙋 응원받기 — cheered 방 */}
          {cheeredRooms.slice(0, 2).map(c => (
            <CheeredCard key={c.id} challenge={c} />
          ))}

          {/* 4. ✨ 관심 도전 */}
          {interestingChs.slice(0, 2).map(c => (
            <InterestCard key={c.id} challenge={c} />
          ))}

          {/* 5. 🌍 누구나 합류 */}
          {openChs.slice(0, 2).map(c => (
            <JoinCard key={c.id} challenge={c} />
          ))}

          {/* 🌙 끝 마커 — 무한 스크롤 의도적 차단 */}
          <View style={styles.endMarker}>
            <Text style={styles.endMoon}>🌙</Text>
            <Text style={styles.endLine1}>오늘은 여기까지예요.</Text>
            <Text style={styles.endLine2}>내일 또, 한 걸음.</Text>
          </View>
        </ScrollView>
      )}
    </Screen>
  );
}

// ─── 카드 1: 🎉 완주 리본 ─────────────────────────────────
function CompletionRibbon({ story }: { story: CompletionStoryCard }) {
  return (
    <Pressable
      style={styles.ribbon}
      onPress={() => { haptic.tap(); router.push(`/done/${story.id}` as any); }}
    >
      <Text style={styles.ribbonEmoji}>🎉</Text>
      <View style={{ flex: 1 }}>
        <Text style={styles.ribbonTitle}>
          {story.author.nickname}님이 <Text style={{ color: colors.accent700 }}>
            {story.total_days}일</Text>을 완주했어요
        </Text>
        <Text style={styles.ribbonMeta} numberOfLines={1}>
          {story.challenge.title} · 박제 보러가기 →
        </Text>
      </View>
    </Pressable>
  );
}

// ─── 카드 2: 📸 오늘의 인증 ───────────────────────────────
function TodayProofCard({ proof }: { proof: FellowProof }) {
  return (
    <Pressable
      style={styles.card}
      onPress={() => { haptic.tap(); router.push(`/room/${proof.challenge_id}` as any); }}
    >
      <View style={styles.cardHead}>
        {proof.avatar_url ? (
          <Image source={{ uri: proof.avatar_url }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarFallback]}>
            <Text style={styles.avatarInit}>{proof.nickname.slice(0, 1)}</Text>
          </View>
        )}
        <View style={{ flex: 1 }}>
          <Text style={styles.who}>{proof.nickname}</Text>
          <Text style={styles.sub}>{relTime(proof.created_at)} · 오늘의 인증</Text>
        </View>
        <View style={styles.tag}>
          <Text style={styles.tagText} numberOfLines={1}>{proof.challenge_title}</Text>
        </View>
      </View>
      <Image source={{ uri: proof.photo_url }} style={styles.proofPhoto} />
      {proof.caption && (
        <Text style={styles.caption} numberOfLines={2}>{proof.caption}</Text>
      )}
      <Text style={styles.cheerHint}>도전 인연들이 응원했어요 →</Text>
    </Pressable>
  );
}

// ─── 카드 3: 🙋 응원받기 ──────────────────────────────────
function CheeredCard({ challenge }: { challenge: MyChallengeDetail }) {
  return (
    <Pressable
      style={[styles.card, styles.cheeredCard]}
      onPress={() => { haptic.tap(); router.push(`/room/${challenge.id}` as any); }}
    >
      <View style={styles.cardHead}>
        <Text style={styles.cardKindEmoji}>🙋</Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.who} numberOfLines={1}>{challenge.title}</Text>
          <Text style={styles.sub}>응원받기 방 · 함께 {challenge.member_count}명</Text>
        </View>
      </View>
      <View style={styles.faceRow}>
        {challenge.top_members.slice(0, 3).map((m, i) => (
          m.avatar_url ? (
            <Image key={m.id} source={{ uri: m.avatar_url }} style={[styles.face, { marginLeft: i === 0 ? 0 : -8 }]} />
          ) : (
            <View key={m.id} style={[styles.face, styles.faceFallback, { marginLeft: i === 0 ? 0 : -8 }]}>
              <Text style={styles.faceInit}>{m.nickname.slice(0, 1)}</Text>
            </View>
          )
        ))}
        {challenge.member_count > 3 && (
          <Text style={styles.faceMore}>+{challenge.member_count - 3}</Text>
        )}
        <Text style={styles.faceText}>지켜보는 동료</Text>
      </View>
      <View style={styles.cheerBtn}>
        <Text style={styles.cheerBtnText}>오늘의 응원 보내기</Text>
      </View>
    </Pressable>
  );
}

// ─── 카드 4: ✨ 관심 도전 ─────────────────────────────────
function InterestCard({ challenge }: { challenge: InterestingChallenge }) {
  return (
    <Pressable
      style={styles.card}
      onPress={() => { haptic.tap(); router.push(`/room/${challenge.id}` as any); }}
    >
      <View style={styles.cardHead}>
        <Text style={styles.cardKindEmoji}>✨</Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.who} numberOfLines={1}>{challenge.title}</Text>
          {challenge.matched_category && (
            <Text style={styles.sub}>
              {challenge.matched_category.emoji} {challenge.matched_category.name} 관심 · 함께 {challenge.member_count}명
            </Text>
          )}
        </View>
      </View>
      <View style={[styles.joinBtn, { marginTop: 6 }]}>
        <Text style={styles.joinBtnText}>관심 도전 살펴보기 →</Text>
      </View>
    </Pressable>
  );
}

// ─── 카드 5: 🌍 누구나 합류 ────────────────────────────────
function JoinCard({ challenge }: { challenge: OpenChallengeCard }) {
  return (
    <Pressable
      style={styles.card}
      onPress={() => { haptic.tap(); router.push(`/room/${challenge.id}` as any); }}
    >
      <View style={styles.cardHead}>
        <Text style={styles.cardKindEmoji}>🌍</Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.who} numberOfLines={1}>{challenge.title}</Text>
          <Text style={styles.sub}>
            누구나 합류 · 함께 {challenge.member_count}명
          </Text>
        </View>
      </View>
      {challenge.description && (
        <Text style={styles.caption} numberOfLines={2}>"{challenge.description}"</Text>
      )}
      <View style={styles.joinBtn}>
        <Text style={styles.joinBtnText}>함께 합류하기</Text>
      </View>
    </Pressable>
  );
}

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60_000) return '방금';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}분 전`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}시간 전`;
  return iso.slice(0, 10);
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: 40 },
  list: { paddingHorizontal: 24, paddingTop: 16, gap: 12 },

  // me-strip
  meStrip: {
    marginHorizontal: 20, marginTop: 16,
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.primary100,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    gap: 10,
  },
  meText: {
    flex: 1,
    fontSize: fontSize.sm, color: colors.primary,
    fontFamily: fontFamily.medium, fontWeight: fontWeight.semibold,
    letterSpacing: -0.2,
  },
  meCta: {
    paddingHorizontal: 14, paddingVertical: 7,
    backgroundColor: colors.accent50,
    borderRadius: radius.pill,
  },
  meCtaText: {
    fontSize: fontSize.xs, color: colors.accent700,
    fontFamily: fontFamily.bold, fontWeight: fontWeight.bold,
  },

  // 섹션 라벨
  sectionLabel: {
    paddingHorizontal: 20, paddingTop: 20, paddingBottom: 8,
    fontSize: fontSize.xs, color: colors.primary500,
    fontFamily: fontFamily.bold, fontWeight: fontWeight.bold,
    letterSpacing: 0.5,
  },

  // 빈 상태
  emptyCard: {
    marginHorizontal: 20, marginTop: 16,
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    paddingVertical: 32, paddingHorizontal: 24,
    alignItems: 'center', gap: 8,
    borderWidth: 1, borderColor: colors.primary100,
    borderStyle: 'dashed',
  },
  emptyEmoji: { fontSize: 48, marginBottom: 4 },
  emptyTitle: {
    fontSize: fontSize.lg, color: colors.primary,
    fontFamily: fontFamily.bold, fontWeight: fontWeight.bold,
  },
  emptyDesc: {
    fontSize: fontSize.sm, color: colors.primary500,
    fontFamily: fontFamily.regular,
    textAlign: 'center', lineHeight: 20, marginBottom: 8,
  },
  emptyCtaBox: {
    marginTop: 8,
    paddingHorizontal: 20, paddingVertical: 12,
    backgroundColor: colors.accent, borderRadius: radius.pill,
  },
  emptyCtaText: {
    color: colors.surface, fontSize: fontSize.base,
    fontFamily: fontFamily.bold, fontWeight: fontWeight.bold,
  },

  // 카드 공통
  card: {
    marginHorizontal: 16, marginBottom: 14,
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: 14,
    gap: 8,
    ...shadow.sm,
  },
  cheeredCard: {
    backgroundColor: '#FFFBF6',
    borderWidth: 1, borderColor: colors.accent100,
  },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  cardKindEmoji: { fontSize: 22, width: 28, textAlign: 'center' },
  avatar: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: colors.accent50, overflow: 'hidden',
  },
  avatarFallback: { alignItems: 'center', justifyContent: 'center' },
  avatarInit: {
    fontSize: 14, color: colors.accent700,
    fontFamily: fontFamily.bold, fontWeight: fontWeight.bold,
  },
  who: {
    fontSize: fontSize.base, color: colors.primary,
    fontFamily: fontFamily.bold, fontWeight: fontWeight.semibold,
  },
  sub: {
    fontSize: fontSize.xs, color: colors.primary500,
    fontFamily: fontFamily.regular, marginTop: 1,
  },
  tag: {
    paddingHorizontal: 10, paddingVertical: 4,
    backgroundColor: colors.accent50,
    borderRadius: radius.pill,
    maxWidth: 130,
  },
  tagText: {
    fontSize: 11, color: colors.accent700,
    fontFamily: fontFamily.bold, fontWeight: fontWeight.bold,
  },

  // 인증 카드
  proofPhoto: {
    width: '100%', aspectRatio: 4 / 3,
    borderRadius: radius.md,
    backgroundColor: colors.primary100,
  },
  caption: {
    fontSize: fontSize.sm, color: colors.primary,
    fontFamily: fontFamily.regular, lineHeight: 20,
  },
  cheerHint: {
    fontSize: fontSize.xs, color: colors.primary500,
    fontFamily: fontFamily.regular,
  },

  // 리본
  ribbon: {
    marginHorizontal: 16, marginBottom: 14,
    paddingVertical: 14, paddingHorizontal: 16,
    backgroundColor: colors.accent50,
    borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.accent100,
    flexDirection: 'row', alignItems: 'center', gap: 12,
  },
  ribbonEmoji: { fontSize: 22 },
  ribbonTitle: {
    fontSize: fontSize.sm, color: colors.primary,
    fontFamily: fontFamily.bold, fontWeight: fontWeight.bold,
  },
  ribbonMeta: {
    fontSize: fontSize.xs, color: colors.primary500,
    fontFamily: fontFamily.regular, marginTop: 2,
  },

  // 응원받기 얼굴
  faceRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  face: {
    width: 28, height: 28, borderRadius: 14,
    borderWidth: 2, borderColor: colors.surface,
  },
  faceFallback: {
    backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center',
  },
  faceInit: {
    color: '#fff', fontSize: 11,
    fontFamily: fontFamily.bold, fontWeight: fontWeight.bold,
  },
  faceMore: {
    fontSize: 11, color: colors.primary500,
    fontFamily: fontFamily.bold, fontWeight: fontWeight.bold,
    marginLeft: 4,
  },
  faceText: {
    fontSize: fontSize.xs, color: colors.primary500,
    fontFamily: fontFamily.regular, marginLeft: 8,
  },

  // 응원·합류 버튼
  cheerBtn: {
    marginTop: 6,
    paddingVertical: 12,
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  cheerBtnText: {
    color: colors.surface, fontSize: fontSize.sm,
    fontFamily: fontFamily.bold, fontWeight: fontWeight.bold,
  },
  joinBtn: {
    marginTop: 4,
    paddingVertical: 12,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1.5, borderColor: colors.accent,
    alignItems: 'center',
  },
  joinBtnText: {
    color: colors.accent700, fontSize: fontSize.sm,
    fontFamily: fontFamily.bold, fontWeight: fontWeight.bold,
  },

  // 끝 마커
  endMarker: {
    alignItems: 'center', paddingVertical: 32, paddingHorizontal: 24,
    gap: 4,
  },
  endMoon: { fontSize: 28, marginBottom: 4 },
  endLine1: {
    fontSize: fontSize.sm, color: colors.primary500,
    fontFamily: fontFamily.bold, fontWeight: fontWeight.semibold,
  },
  endLine2: {
    fontSize: fontSize.xs, color: colors.primary300,
    fontFamily: fontFamily.regular,
  },
});
