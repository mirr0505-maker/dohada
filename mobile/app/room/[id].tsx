// 🚀 챌린지 방 — 인증 피드 (Supabase 실데이터 + Realtime)
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, Pressable, FlatList, StyleSheet, Share, Alert,
  Image, RefreshControl,
} from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Screen } from '@/components/Screen';
import { colors, fontFamily, fontSize, fontWeight, radius, shadow } from '@/lib/tokens';
import { useSession } from '@/lib/session';
import { fetchRoomData, toggleCheer, pauseMembership, resumeMembership } from '@/lib/db';
import { supabase } from '@/lib/supabase';
import { ErrorState } from '@/components/ErrorState';
import { ProofCardSkeleton } from '@/components/Skeleton';
import { CommentsSheet } from '@/components/CommentsSheet';
import { reportError } from '@/lib/sentry';
import { haptic } from '@/lib/haptics';
import { computeProgress, computeStreak, isCompleted } from '@/lib/stats';
import { joinChallenge } from '@/lib/invite';
import type {
  DbChallenge, MemberWithToday, ProofWithRelations,
} from '@/lib/types';

export default function ChallengeRoom() {
  const { id, fromCreate } = useLocalSearchParams<{ id: string; fromCreate?: string }>();
  const session = useSession();

  const [challenge, setChallenge] = useState<DbChallenge | null>(null);
  const [members, setMembers] = useState<MemberWithToday[]>([]);
  const [proofs, setProofs] = useState<ProofWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createPromptShown, setCreatePromptShown] = useState(false);
  const [completeRedirected, setCompleteRedirected] = useState(false);
  const [activeProofId, setActiveProofId] = useState<string | null>(null);    // 댓글 sheet 대상

  const myUserId = session?.user?.id;

  useEffect(() => {
    if (session === null) router.replace('/login');
  }, [session]);

  const load = useCallback(async () => {
    if (!id || !myUserId) return;
    try {
      setError(null);
      const data = await fetchRoomData(id, myUserId);
      setChallenge(data.challenge);
      setMembers(data.members);
      setProofs(data.proofs);
    } catch (e: any) {
      reportError(e, { where: 'room/fetchRoomData', challengeId: id });
      setError(e?.message ?? '챌린지를 불러오지 못했어요.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id, myUserId]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load();
  }, [load]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  // ─── Realtime — proofs INSERT, cheers INSERT/DELETE ──
  useEffect(() => {
    if (!id || !myUserId) return;

    const channel = supabase
      .channel(`room:${id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'proofs', filter: `challenge_id=eq.${id}` },
        () => { load(); },     // 새 인증은 단순 재조회 (작성자 join 필요)
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'cheers' },
        (payload) => {
          const c = payload.new as { proof_id: string; user_id: string };
          setProofs(prev => prev.map(p =>
            p.id === c.proof_id
              ? {
                  ...p,
                  cheer_count: p.cheer_count + 1,
                  cheered_by_me: p.cheered_by_me || c.user_id === myUserId,
                }
              : p,
          ));
        },
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'cheers' },
        (payload) => {
          const c = payload.old as { proof_id: string; user_id: string };
          setProofs(prev => prev.map(p =>
            p.id === c.proof_id
              ? {
                  ...p,
                  cheer_count: Math.max(0, p.cheer_count - 1),
                  cheered_by_me: c.user_id === myUserId ? false : p.cheered_by_me,
                }
              : p,
          ));
        },
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'comments' },
        (payload) => {
          const c = payload.new as { proof_id: string; user_id: string };
          // 내 댓글은 CommentsSheet 의 onCountChange 가 이미 반영했으니 중복 카운트 방지
          if (c.user_id === myUserId) return;
          setProofs(prev => prev.map(p =>
            p.id === c.proof_id
              ? { ...p, comment_count: p.comment_count + 1 }
              : p,
          ));
        },
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'comments' },
        (payload) => {
          const c = payload.old as { proof_id: string };
          setProofs(prev => prev.map(p =>
            p.id === c.proof_id
              ? { ...p, comment_count: Math.max(0, p.comment_count - 1) }
              : p,
          ));
        },
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [id, myUserId, load]);

  const onCheer = useCallback(async (proofId: string) => {
    if (!myUserId) return;
    const target = proofs.find(p => p.id === proofId);
    if (!target) return;

    haptic.tap();

    // 낙관적 업데이트
    setProofs(prev => prev.map(p =>
      p.id === proofId
        ? {
            ...p,
            cheered_by_me: !p.cheered_by_me,
            cheer_count: p.cheer_count + (p.cheered_by_me ? -1 : 1),
          }
        : p,
    ));

    try {
      await toggleCheer({
        proofId,
        userId: myUserId,
        currentlyCheered: target.cheered_by_me,
      });
    } catch (e: any) {
      // 실패 → 롤백
      setProofs(prev => prev.map(p =>
        p.id === proofId
          ? { ...p, cheered_by_me: target.cheered_by_me, cheer_count: target.cheer_count }
          : p,
      ));
      Alert.alert('응원 실패', e?.message ?? String(e));
    }
  }, [myUserId, proofs]);

  const onShareInvite = useCallback(async () => {
    if (!challenge) return;
    try {
      // Do : 하다 앱 설치된 사람만 동작. 베타 안내문에 TestFlight 링크 같이 보내야 함.
      const link = `dohada://invite/${challenge.id}`;
      await Share.share({
        message: `"${challenge.title}" 챌린지에 함께해요!\n\n📱 Do : 하다 앱에서 아래 링크를 누르세요:\n${link}`,
      });
    } catch (e) {
      Alert.alert('공유 실패', String(e));
    }
  }, [challenge]);

  // 챌린지 만든 직후(create.tsx 가 ?fromCreate=1 로 보냄) → 카톡 초대 안내 1회 모달
  useEffect(() => {
    if (fromCreate !== '1' || !challenge || createPromptShown) return;
    setCreatePromptShown(true);
    Alert.alert(
      'Do : 하다',
      '더 나은 나 더 나은 세상\n함께하면 완주 성공 3배',
      [
        { text: '나중에', style: 'cancel' },
        { text: '카톡으로 초대', onPress: onShareInvite },
      ],
    );
  }, [fromCreate, challenge, createPromptShown, onShareInvite]);

  const me = useMemo(
    () => members.find(m => m.id === myUserId),
    [members, myUserId],
  );
  const isMember = Boolean(me);
  const todayChecked = me?.today_checked ?? false;
  const [joining, setJoining] = useState(false);

  // 비멤버가 공개 챌린지에서 "참여하기" 누름 → DB insert → 다시 load
  const onJoin = useCallback(async () => {
    if (!challenge || !myUserId || joining) return;
    setJoining(true);
    try {
      await joinChallenge(challenge.id, myUserId);
      haptic.success();
      await load();
    } catch (e: any) {
      Alert.alert('참여 실패', e?.message ?? String(e));
    } finally {
      setJoining(false);
    }
  }, [challenge, myUserId, joining, load]);

  // 내가 한 인증만 필터해서 streak 계산
  const myProofs = useMemo(
    () => proofs.filter(p => p.user_id === myUserId),
    [proofs, myUserId],
  );
  const streak = useMemo(() => computeStreak(myProofs), [myProofs]);
  const progress = useMemo(
    () => (challenge ? computeProgress(challenge) : null),
    [challenge],
  );

  // 잠시 멈춤 상태 (오늘이 paused_until 이전)
  const isPaused = useMemo(() => {
    if (!me?.paused_until) return false;
    const today = new Date().toISOString().slice(0, 10);
    return today <= me.paused_until;
  }, [me]);

  // 완주 자동 감지 → complete 화면으로 1회 redirect
  useEffect(() => {
    if (!challenge || completeRedirected) return;
    if (isCompleted(challenge, myProofs)) {
      setCompleteRedirected(true);
      router.replace(`/complete/${challenge.id}` as any);
    }
  }, [challenge, myProofs, completeRedirected]);

  // ─── 잠시 멈춤 / 재개 ─────────────────────────────────
  const onTogglePause = useCallback(() => {
    if (!challenge || !myUserId) return;
    if (isPaused) {
      // 즉시 재개
      resumeMembership({ challengeId: challenge.id, userId: myUserId })
        .then(() => { haptic.success(); load(); })
        .catch(e => Alert.alert('재개 실패', e?.message ?? String(e)));
      return;
    }
    Alert.alert(
      '잠시 멈춤',
      '며칠 쉴까요? 그 동안 인증 의무가 면제돼요.',
      [
        { text: '취소', style: 'cancel' },
        {
          text: '3일',
          onPress: () => doPause(3),
        },
        {
          text: '7일',
          onPress: () => doPause(7),
        },
      ],
    );

    function doPause(days: number) {
      const until = new Date();
      until.setDate(until.getDate() + days);
      pauseMembership({
        challengeId: challenge!.id,
        userId: myUserId!,
        untilDate: until.toISOString().slice(0, 10),
      })
        .then(() => { haptic.success(); load(); })
        .catch(e => Alert.alert('멈춤 실패', e?.message ?? String(e)));
    }
  }, [challenge, myUserId, isPaused, load]);

  // ─── 렌더 ────────────────────────────────────────────
  if (loading) {
    return (
      <Screen backgroundColor={colors.background}>
        <View style={styles.feed}>
          <ProofCardSkeleton />
          <ProofCardSkeleton />
        </View>
      </Screen>
    );
  }

  if (error || !challenge) {
    return (
      <Screen backgroundColor={colors.background}>
        <ErrorState
          message={error ?? '챌린지를 찾을 수 없어요.'}
          onRetry={() => { setLoading(true); load(); }}
        />
      </Screen>
    );
  }

  return (
    <Screen backgroundColor={colors.background}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Text style={styles.back}>←</Text>
        </Pressable>
        <View style={{ flex: 1, marginHorizontal: 12 }}>
          <Text style={styles.title} numberOfLines={1}>{challenge.title}</Text>
          <Text style={styles.subtitle}>{members.length}명 함께 도전 중</Text>
        </View>
        {challenge.kind === 'closed' ? (
          <Pressable onPress={onShareInvite} hitSlop={12}>
            <Text style={styles.share}>초대</Text>
          </Pressable>
        ) : (
          <View style={{ width: 32 }} />
        )}
      </View>

      {/* 진행률 + Streak + 잠시멈춤 토글 */}
      <View style={styles.statsRow}>
        {progress && (
          <View style={styles.stat}>
            <Text style={styles.statValue}>{progress.passedDays}/{progress.totalDays}</Text>
            <Text style={styles.statLabel}>일 진행 ({progress.percent}%)</Text>
          </View>
        )}
        <View style={styles.stat}>
          <Text style={[styles.statValue, streak > 0 && { color: colors.accent }]}>
            🔥 {streak}
          </Text>
          <Text style={styles.statLabel}>연속 인증</Text>
        </View>
        {isMember && (
          <Pressable style={styles.pauseBtn} onPress={onTogglePause}>
            <Text style={styles.pauseLabel}>
              {isPaused ? '▶ 재개' : '⏸ 멈춤'}
            </Text>
          </Pressable>
        )}
      </View>

      <View style={styles.memberStrip}>
        <FlatList
          data={members}
          keyExtractor={m => m.id}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 24, gap: 12 }}
          renderItem={({ item }) => {
            const paused = isMemberPaused(item.paused_until);
            return (
              <View style={[styles.member, paused && { opacity: 0.45 }]}>
                <View style={[
                  styles.memberAvatar,
                  item.today_checked && styles.memberAvatarChecked,
                ]}>
                  {item.avatar_url ? (
                    <Image source={{ uri: item.avatar_url }} style={styles.avatarImg} />
                  ) : (
                    <Text style={{ fontSize: 20 }}>🐰</Text>
                  )}
                </View>
                <Text style={styles.memberName} numberOfLines={1}>
                  {paused ? '⏸ ' : ''}{item.nickname}
                </Text>
              </View>
            );
          }}
          ListEmptyComponent={
            <Text style={styles.memberEmpty}>아직 동료가 없어요. 카톡으로 초대하세요.</Text>
          }
        />
      </View>

      <FlatList
        data={proofs}
        keyExtractor={p => p.id}
        contentContainerStyle={styles.feed}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.accent}
          />
        }
        renderItem={({ item }) => (
          <ProofCard
            proof={item}
            onCheer={() => onCheer(item.id)}
            onComments={() => { haptic.tap(); setActiveProofId(item.id); }}
          />
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyEmoji}>📸</Text>
            <Text style={styles.emptyText}>
              아직 인증이 없어요.{'\n'}오늘 첫 인증의 주인공이 되어볼까요?
            </Text>
          </View>
        }
      />

      <Pressable
        style={[
          styles.fab,
          !isMember && styles.fabJoin,
          isMember && todayChecked && styles.fabDone,
          isMember && isPaused && styles.fabPaused,
        ]}
        onPress={() => {
          if (!isMember) { onJoin(); return; }
          if (isPaused) {
            Alert.alert('잠시 멈춤 중', `${me?.paused_until} 까지 인증 의무가 면제예요.`);
            return;
          }
          if (todayChecked) {
            Alert.alert('오늘 인증 완료', '내일 다시 만나요.');
            return;
          }
          haptic.tap();
          router.push(`/checkin/${challenge.id}`);
        }}
      >
        <Text style={styles.fabLabel}>
          {!isMember
            ? (joining ? '참여 중…' : '🌍 이 챌린지에 참여하기')
            : isPaused
              ? '⏸ 잠시 멈춤 중'
              : todayChecked
                ? '✓ 오늘 인증 완료'
                : '📸 오늘 인증하기'}
        </Text>
      </Pressable>

      <CommentsSheet
        proofId={activeProofId}
        myUserId={myUserId}
        onClose={() => setActiveProofId(null)}
        onCountChange={(pid, delta) => {
          setProofs(prev => prev.map(p =>
            p.id === pid
              ? { ...p, comment_count: Math.max(0, p.comment_count + delta) }
              : p,
          ));
        }}
      />
    </Screen>
  );
}

function ProofCard({
  proof, onCheer, onComments,
}: {
  proof: ProofWithRelations;
  onCheer: () => void;
  onComments: () => void;
}) {
  return (
    <View style={styles.proofCard}>
      <View style={styles.proofHeader}>
        {proof.author?.avatar_url ? (
          <Image source={{ uri: proof.author.avatar_url }} style={styles.proofAvatar} />
        ) : (
          <View style={[styles.proofAvatar, styles.proofAvatarFallback]}>
            <Text style={{ fontSize: 18 }}>🐰</Text>
          </View>
        )}
        <View style={{ flex: 1 }}>
          <Text style={styles.proofAuthor}>{proof.author?.nickname ?? '익명'}</Text>
          <Text style={styles.proofTime}>{formatTime(proof.created_at)}</Text>
        </View>
      </View>

      <Image source={{ uri: proof.photo_url }} style={styles.proofPhoto} resizeMode="cover" />

      {proof.caption ? (
        <Text style={styles.proofCaption}>{proof.caption}</Text>
      ) : null}

      <View style={styles.proofFooter}>
        <Pressable style={styles.cheerBtn} onPress={onCheer} hitSlop={6}>
          <Text style={[styles.cheerIcon, proof.cheered_by_me && styles.cheerIconOn]}>❤</Text>
          <Text style={[styles.cheerCount, proof.cheered_by_me && styles.cheerCountOn]}>
            {proof.cheer_count}
          </Text>
        </Pressable>
        <Pressable style={styles.cheerBtn} onPress={onComments} hitSlop={6}>
          <Text style={styles.cheerIcon}>💬</Text>
          <Text style={styles.cheerCount}>{proof.comment_count}</Text>
        </Pressable>
      </View>
    </View>
  );
}

function isMemberPaused(pausedUntil: string | null): boolean {
  if (!pausedUntil) return false;
  return new Date().toISOString().slice(0, 10) <= pausedUntil;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  if (sameDay) return `오늘 ${hh}:${mm}`;
  return `${d.getMonth() + 1}/${d.getDate()} ${hh}:${mm}`;
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  notFoundText: { fontSize: fontSize.base, color: colors.primary500 },

  header: {
    height: 56,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
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
  subtitle: {
    fontSize: fontSize.xs,
    color: colors.primary500,
    fontFamily: fontFamily.regular,
    marginTop: 2,
  },
  share: {
    fontSize: fontSize.base,
    color: colors.accent,
    fontFamily: fontFamily.bold,
    fontWeight: fontWeight.bold,
    paddingHorizontal: 8,
  },

  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingVertical: 14,
    paddingHorizontal: 24,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.primary100,
  },
  stat: { flex: 1 },
  statValue: {
    fontSize: fontSize.xl,
    color: colors.primary,
    fontFamily: fontFamily.bold,
    fontWeight: fontWeight.bold,
  },
  statLabel: {
    fontSize: fontSize.xs,
    color: colors.primary500,
    fontFamily: fontFamily.regular,
    marginTop: 2,
  },
  pauseBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: colors.primary50,
    borderRadius: radius.pill,
  },
  pauseLabel: {
    fontSize: fontSize.sm,
    color: colors.primary500,
    fontFamily: fontFamily.medium,
    fontWeight: fontWeight.medium,
  },
  memberStrip: {
    paddingVertical: 16,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.primary100,
  },
  member: { alignItems: 'center', gap: 6, width: 56 },
  memberAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary50,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
    overflow: 'hidden',
  },
  avatarImg: { width: '100%', height: '100%' },
  memberAvatarChecked: { borderColor: colors.accent },
  memberName: {
    fontSize: fontSize.xs,
    color: colors.primary500,
    fontFamily: fontFamily.regular,
  },
  memberEmpty: {
    paddingHorizontal: 8,
    fontSize: fontSize.sm,
    color: colors.primary500,
    fontFamily: fontFamily.regular,
  },

  feed: { padding: 16, paddingBottom: 120, gap: 16, flexGrow: 1 },
  proofCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: 16,
    gap: 12,
    ...shadow.sm,
  },
  proofHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  proofAvatar: { width: 36, height: 36, borderRadius: 18, overflow: 'hidden' },
  proofAvatarFallback: {
    backgroundColor: colors.primary50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  proofAuthor: {
    fontSize: fontSize.base,
    color: colors.primary,
    fontFamily: fontFamily.bold,
    fontWeight: fontWeight.bold,
  },
  proofTime: {
    fontSize: fontSize.xs,
    color: colors.primary500,
    fontFamily: fontFamily.regular,
    marginTop: 2,
  },
  proofPhoto: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: radius.md,
    backgroundColor: colors.primary50,
  },
  proofCaption: {
    fontSize: fontSize.base,
    color: colors.primary,
    fontFamily: fontFamily.regular,
    lineHeight: 22,
  },
  proofFooter: { flexDirection: 'row', alignItems: 'center', gap: 20, paddingTop: 4 },
  cheerBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 4 },
  cheerIcon: { fontSize: 22, color: colors.primary300 },
  cheerIconOn: { color: colors.danger },
  cheerCount: {
    fontSize: fontSize.base,
    color: colors.primary500,
    fontFamily: fontFamily.medium,
    fontWeight: fontWeight.medium,
  },
  cheerCountOn: { color: colors.danger, fontWeight: fontWeight.bold },

  empty: { paddingVertical: 80, alignItems: 'center', gap: 16 },
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
    left: 24,
    right: 24,
    paddingVertical: 18,
    backgroundColor: colors.accent,
    borderRadius: radius.pill,
    alignItems: 'center',
    ...shadow.lg,
  },
  fabDone: { backgroundColor: colors.success },
  fabPaused: { backgroundColor: colors.primary500 },
  fabJoin: { backgroundColor: colors.info },
  fabLabel: {
    color: colors.surface,
    fontSize: fontSize.lg,
    fontFamily: fontFamily.bold,
    fontWeight: fontWeight.bold,
  },
});
