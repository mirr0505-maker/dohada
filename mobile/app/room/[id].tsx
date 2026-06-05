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
import { fetchRoomData, toggleCheer, pauseMembership, resumeMembership, giveUpMembership } from '@/lib/db';
import type { CheerType } from '@/lib/types';
import { supabase } from '@/lib/supabase';
import { ErrorState } from '@/components/ErrorState';
import { ProofCardSkeleton } from '@/components/Skeleton';
import { CommentsSheet } from '@/components/CommentsSheet';
import { ChatTab } from '@/components/challenge/ChatTab';
import { LogTab } from '@/components/challenge/LogTab';
import { StatusTab } from '@/components/challenge/StatusTab';
import { ArchiveTab } from '@/components/challenge/ArchiveTab';
import { MemberSheet } from '@/components/challenge/MemberSheet';
import { ImpactModal } from '@/components/challenge/ImpactModal';
import { reportError } from '@/lib/sentry';
import { haptic } from '@/lib/haptics';
import { computeProgress, computeStreak, isCompleted } from '@/lib/stats';
import { joinChallenge } from '@/lib/invite';
import { formatCheerCount } from '@/lib/format';
import type {
  DbChallenge, MemberWithToday, ProofWithRelations, ChallengeKind,
} from '@/lib/types';

// v4 챌린지 방 5탭
type RoomTab = 'chat' | 'proof' | 'log' | 'status' | 'archive';
const ROOM_TABS: { key: RoomTab; emoji: string; label: string }[] = [
  { key: 'chat',    emoji: '💬', label: '대화' },
  { key: 'proof',   emoji: '📸', label: '인증' },
  { key: 'log',     emoji: '🎥', label: '기록' },
  { key: 'status',  emoji: '📊', label: '현황' },
  { key: 'archive', emoji: '🏆', label: '박제' },
];

// 방 종류 메타 라벨 — 분류 용어 X, 사람 단위 톤
function roomKindLabel(kind: ChallengeKind, memberCount: number): string {
  if (kind === 'solo') return '혼자만의 다짐';
  if (kind === 'cheered') return `응원받는 도전 · 함께 ${memberCount}명`;
  if (kind === 'open') return `누구나 합류 가능 · 함께 ${memberCount}명`;
  return `함께 도전하는 ${memberCount}명`;
}

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
  const [activeTab, setActiveTab] = useState<RoomTab>('proof');               // v4 5탭 활성 탭
  const [logComposerOpen, setLogComposerOpen] = useState(false);              // 기록 탭 FAB → LogTab 컴포저
  const [memberSheetOpen, setMemberSheetOpen] = useState(false);              // 헤더 avatars → 멤버 시트
  const [impactModalOpen, setImpactModalOpen] = useState(false);              // info-bar 💚 → 함께 만든 변화 팝업

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
          const c = payload.new as { proof_id: string; user_id: string; cheer_type: CheerType };
          const t = (c.cheer_type ?? 'heart') as CheerType;
          setProofs(prev => prev.map(p => {
            if (p.id !== c.proof_id) return p;
            const counts = { ...p.cheers_by_type, [t]: (p.cheers_by_type[t] ?? 0) + 1 };
            const my = c.user_id === myUserId && !p.my_cheers.includes(t)
              ? [...p.my_cheers, t]
              : p.my_cheers;
            return {
              ...p,
              cheer_count: p.cheer_count + 1,
              cheered_by_me: p.cheered_by_me || c.user_id === myUserId,
              cheers_by_type: counts,
              my_cheers: my,
            };
          }));
        },
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'cheers' },
        (payload) => {
          const c = payload.old as { proof_id: string; user_id: string; cheer_type: CheerType };
          const t = (c.cheer_type ?? 'heart') as CheerType;
          setProofs(prev => prev.map(p => {
            if (p.id !== c.proof_id) return p;
            const counts = { ...p.cheers_by_type, [t]: Math.max(0, (p.cheers_by_type[t] ?? 0) - 1) };
            const my = c.user_id === myUserId ? p.my_cheers.filter(x => x !== t) : p.my_cheers;
            return {
              ...p,
              cheer_count: Math.max(0, p.cheer_count - 1),
              cheered_by_me: c.user_id === myUserId ? my.length > 0 : p.cheered_by_me,
              cheers_by_type: counts,
              my_cheers: my,
            };
          }));
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

  const onCheer = useCallback(async (proofId: string, cheerType: CheerType) => {
    if (!myUserId) return;
    const target = proofs.find(p => p.id === proofId);
    if (!target) return;
    const currentlyCheered = target.my_cheers.includes(cheerType);

    haptic.tap();

    // 낙관적 업데이트
    setProofs(prev => prev.map(p => {
      if (p.id !== proofId) return p;
      const has = p.my_cheers.includes(cheerType);
      const my = has ? p.my_cheers.filter(t => t !== cheerType) : [...p.my_cheers, cheerType];
      const delta = has ? -1 : 1;
      return {
        ...p,
        my_cheers: my,
        cheered_by_me: my.length > 0,
        cheer_count: Math.max(0, p.cheer_count + delta),
        cheers_by_type: {
          ...p.cheers_by_type,
          [cheerType]: Math.max(0, (p.cheers_by_type[cheerType] ?? 0) + delta),
        },
      };
    }));

    try {
      await toggleCheer({
        proofId,
        userId: myUserId,
        cheerType,
        currentlyCheered,
      });
    } catch (e: any) {
      // 실패 → 롤백
      setProofs(prev => prev.map(p =>
        p.id === proofId
          ? {
              ...p,
              my_cheers: target.my_cheers,
              cheered_by_me: target.cheered_by_me,
              cheer_count: target.cheer_count,
              cheers_by_type: target.cheers_by_type,
            }
          : p,
      ));
      Alert.alert('응원 실패', e?.message ?? String(e));
    }
  }, [myUserId, proofs]);

  const onShareInvite = useCallback(async () => {
    if (!challenge) return;
    try {
      // 카카오톡 등 외부 메신저에서 항상 클릭이 가능한 HTTPS 중계 게이트웨이 링크 사용
      const link = `https://bpffxeddkuekefphsolz.supabase.co/functions/v1/invite?id=${challenge.id}`;
      // 응원받기 방은 도전자 1명 + 응원자 N명 — 메시지 톤 분기
      const intro = challenge.kind === 'cheered'
        ? `"${challenge.title}" 챌린지를 시작합니다.\n와서 응원해주세요! 💛`
        : `"${challenge.title}" 챌린지에 함께해요!`;
      await Share.share({
        message:
          `${intro}\n\n` +
          `📱 아래 링크를 눌러 챌린지에 합류하세요:\n${link}`,
      });
    } catch (e) {
      Alert.alert('공유 실패', String(e));
    }
  }, [challenge]);

  // 챌린지 만든 직후(create.tsx 가 ?fromCreate=1 로 보냄) → 카톡 초대 안내 1회 모달
  useEffect(() => {
    if (fromCreate !== '1' || !challenge || createPromptShown) return;
    setCreatePromptShown(true);
    // 응원받기 방은 응원 요청 톤, 그 외는 함께 도전 톤
    const isCheered = challenge.kind === 'cheered';
    Alert.alert(
      'Do : 하다',
      isCheered
        ? '응원받는 도전!\n지인들에게 응원을 부탁해보세요'
        : '더 나은 나 더 나은 세상\n함께하면 완주 성공 3배',
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
  const isCreator = challenge?.creator_id === myUserId;
  // cheered 방은 creator 만 인증/기록 가능, 나머지 멤버는 응원만
  const isCheeredCheerOnly = challenge?.kind === 'cheered' && isMember && !isCreator;
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
  // 헤더 "함께 만든 변화" 응원 총합 — early return 위로 (Hooks 순서 안정성)
  const totalCheers = useMemo(
    () => proofs.reduce((sum, p) => sum + p.cheer_count, 0),
    [proofs],
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

  // ─── 잠시 멈춤 / 재개 / 도전 포기 ─────────────────────
  const onTogglePause = useCallback(() => {
    if (!challenge || !myUserId) return;
    if (isPaused) {
      resumeMembership({ challengeId: challenge.id, userId: myUserId })
        .then(() => { haptic.success(); load(); })
        .catch(e => Alert.alert('재개 실패', e?.message ?? String(e)));
      return;
    }
    Alert.alert(
      '잠시 멈춤 / 도전 포기',
      '며칠 쉴까요? 또는 완전히 포기할 수 있어요.',
      [
        { text: '취소', style: 'cancel' },
        { text: '3일 쉼', onPress: () => doPause(3) },
        { text: '7일 쉼', onPress: () => doPause(7) },
        { text: '🚫 도전 포기', style: 'destructive', onPress: confirmGiveUp },
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

    function confirmGiveUp() {
      Alert.alert(
        '도전 포기',
        '정말 포기할까요?\n이 챌린지가 내 목록에서 사라져요.\n작성한 인증·기록은 보존돼요.',
        [
          { text: '취소', style: 'cancel' },
          {
            text: '포기',
            style: 'destructive',
            onPress: () => {
              giveUpMembership({ challengeId: challenge!.id, userId: myUserId! })
                .then(() => { haptic.warning(); router.back(); })
                .catch(e => Alert.alert('포기 실패', e?.message ?? String(e)));
            },
          },
        ],
      );
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

  // ─── 헤더 통계 (v4 함께 만든 변화) ───────────────────
  const totalProofs = proofs.length;
  const totalLogs = 0;                       // Step 4 의 logs 도입 후 fetch 로 채움
  const daysLeft = progress ? Math.max(0, progress.totalDays - progress.passedDays) : 0;
  const todayCheckedCount = members.filter(m => m.today_checked).length;

  return (
    <Screen backgroundColor={colors.background}>
      {/* ─── 헤더 — 챌린지명 라인에 stacked avatars (탭=멤버 시트) ─── */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Text style={styles.back}>←</Text>
        </Pressable>
        <View style={{ flex: 1, marginHorizontal: 8 }}>
          <View style={styles.headerTitleRow}>
            <Text style={styles.title} numberOfLines={1}>{challenge.title}</Text>
            <Pressable
              onPress={() => { haptic.tap(); setMemberSheetOpen(true); }}
              hitSlop={6}
            >
              <StackedAvatars members={members} />
            </Pressable>
          </View>
          <Text style={styles.subtitle}>{roomKindLabel(challenge.kind, members.length)}</Text>
        </View>
        {challenge.kind === 'closed' || challenge.kind === 'cheered' ? (
          <Pressable onPress={onShareInvite} hitSlop={12}>
            <Text style={styles.share}>초대</Text>
          </Pressable>
        ) : (
          <View style={{ width: 32 }} />
        )}
      </View>

      {/* ─── 진행 info bar (D-N + 연속 + 멈춤) ─── */}
      <View style={styles.infoBar}>
        <View style={styles.infoStats}>
          <Text style={styles.infoStatItem}>🔥 {progress?.passedDays ?? 0}/{progress?.totalDays ?? 0}일</Text>
          <Text style={styles.infoStatItem}>📸 {todayCheckedCount}/{Math.max(1, members.length)} 인증</Text>
        </View>
        <View style={styles.infoRight}>
          <Pressable onPress={() => { haptic.tap(); setImpactModalOpen(true); }} hitSlop={6}>
            <Text style={styles.impactBtn}>💚</Text>
          </Pressable>
          <Text style={styles.ddayBig}>D-{daysLeft}</Text>
          {isMember && (
            <Pressable onPress={onTogglePause} hitSlop={6}>
              <Text style={styles.pauseInline}>{isPaused ? '▶ 재개' : '⏸ 멈춤'}</Text>
            </Pressable>
          )}
        </View>
      </View>

      {/* ─── 진행률 바 ─── */}
      {progress && (
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${progress.percent}%` }]} />
        </View>
      )}

      {/* ─── 5탭 bar (재구성 후 progress 바 바로 아래로 — content 영역 최대화) ─── */}
      <View style={styles.tabsBar}>
        {ROOM_TABS.map(t => {
          const active = activeTab === t.key;
          return (
            <Pressable
              key={t.key}
              style={[styles.tabItem, active && styles.tabItemActive]}
              onPress={() => { haptic.tap(); setActiveTab(t.key); }}
            >
              <Text style={[styles.tabText, active && styles.tabTextActive]} numberOfLines={1}>
                {t.emoji} {t.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* ─── 탭별 컨텐츠 ─── */}
      {activeTab === 'proof' && (
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
              onCheer={(type) => onCheer(item.id, type)}
              onComments={() => { haptic.tap(); setActiveProofId(item.id); }}
            />
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyEmoji}>📸</Text>
              <Text style={styles.emptyText}>
                아직 인증이 없어요.{'\n'}오늘 어떤 한 걸음을 남기셨어요?
              </Text>
            </View>
          }
        />
      )}

      {activeTab === 'chat' && (
        <ChatTab
          challengeId={challenge.id}
          myUserId={myUserId}
          isMember={isMember}
        />
      )}
      {activeTab === 'log' && (
        <LogTab
          challengeId={challenge.id}
          challengeStartDate={challenge.start_date}
          myUserId={myUserId}
          isMember={isMember}
          canComment={challenge.kind !== 'solo'}
          composerOpen={logComposerOpen}
          onComposerClose={() => setLogComposerOpen(false)}
        />
      )}
      {activeTab === 'status' && (
        <StatusTab
          challenge={challenge}
          members={members}
          proofs={proofs}
          myUserId={myUserId}
        />
      )}
      {activeTab === 'archive' && (
        <ArchiveTab
          challenge={challenge}
          proofs={proofs}
          totalCheers={totalCheers}
          totalLogs={totalLogs}
        />
      )}

      {/* 탭별 적응형 FAB
         - 비멤버: 모든 탭에서 참여 권유
         - 응원받기 응원자: 기록 탭에서만 노출
         - 일반 멤버: 인증 탭(카메라) / 기록 탭(컴포저). 채팅·현황·박제는 숨김 (작업 흐름 방해 방지) */}
      {(() => {
        if (!isMember) {
          return (
            <Pressable style={[styles.fab, styles.fabJoin]} onPress={onJoin}>
              <Text style={styles.fabLabel}>
                {joining ? '참여 중…' : '🌍 이 챌린지에 참여하기'}
              </Text>
            </Pressable>
          );
        }
        if (isCheeredCheerOnly) {
          if (activeTab !== 'log') return null;
          return (
            <Pressable
              style={[styles.fab, styles.fabCheer]}
              onPress={() => { haptic.tap(); setActiveTab('chat'); }}
            >
              <Text style={styles.fabLabel}>💛 응원으로 함께해요</Text>
            </Pressable>
          );
        }
        if (activeTab === 'log') {
          return (
            <Pressable
              style={styles.fab}
              onPress={() => { haptic.tap(); setLogComposerOpen(true); }}
            >
              <Text style={styles.fabLabel}>📝 기록 쓰기</Text>
            </Pressable>
          );
        }
        if (activeTab !== 'proof') return null;
        if (isPaused) {
          return (
            <Pressable
              style={[styles.fab, styles.fabPaused]}
              onPress={() => Alert.alert('잠시 멈춤 중', `${me?.paused_until} 까지 인증 의무가 면제예요.`)}
            >
              <Text style={styles.fabLabel}>⏸ 잠시 멈춤 중</Text>
            </Pressable>
          );
        }
        if (todayChecked) {
          return (
            <Pressable style={[styles.fab, styles.fabDone]} onPress={() => haptic.tap()}>
              <Text style={styles.fabLabel}>✓ 오늘 인증 완료 · 내일 또 만나요</Text>
            </Pressable>
          );
        }
        return (
          <Pressable
            style={styles.fab}
            onPress={() => { haptic.tap(); router.push(`/checkin/${challenge.id}`); }}
          >
            <Text style={styles.fabLabel}>📸 오늘 인증하기</Text>
          </Pressable>
        );
      })()}

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

      <MemberSheet
        visible={memberSheetOpen}
        onClose={() => setMemberSheetOpen(false)}
        members={members}
        myUserId={myUserId}
      />

      <ImpactModal
        visible={impactModalOpen}
        onClose={() => setImpactModalOpen(false)}
        days={progress?.passedDays ?? 0}
        proofs={totalProofs}
        cheers={totalCheers}
        logs={totalLogs}
      />
    </Screen>
  );
}

// 헤더 stacked avatars — 최대 4개 + "+N"
function StackedAvatars({ members }: { members: MemberWithToday[] }) {
  const MAX_VISIBLE = 4;
  const visible = members.slice(0, MAX_VISIBLE);
  const remaining = Math.max(0, members.length - MAX_VISIBLE);
  return (
    <View style={styles.stackedRow}>
      {visible.map((m, i) => (
        <View key={m.id} style={[styles.stackedAvatar, { marginLeft: i === 0 ? 0 : -8 }]}>
          {m.avatar_url ? (
            <Image source={{ uri: m.avatar_url }} style={styles.stackedAvatarImg} />
          ) : (
            <Text style={{ fontSize: 12 }}>🐰</Text>
          )}
        </View>
      ))}
      {remaining > 0 && (
        <View style={[styles.stackedAvatar, styles.stackedAvatarMore, { marginLeft: -8 }]}>
          <Text style={styles.stackedMoreText}>+{remaining}</Text>
        </View>
      )}
    </View>
  );
}

// v4 탭 공용 placeholder (대화/기록/현황/박제)
function TabPlaceholder({
  emoji, title, desc,
}: { emoji: string; title: string; desc: string }) {
  return (
    <View style={styles.tabPlaceholder}>
      <Text style={styles.tabPlaceholderEmoji}>{emoji}</Text>
      <Text style={styles.tabPlaceholderTitle}>{title}</Text>
      <Text style={styles.tabPlaceholderDesc}>{desc}</Text>
    </View>
  );
}

const CHEER_OPTIONS: { type: CheerType; emoji: string }[] = [
  { type: 'fire',   emoji: '🔥' },
  { type: 'clap',   emoji: '👏' },
  { type: 'muscle', emoji: '💪' },
  { type: 'heart',  emoji: '❤️' },
];

function ProofCard({
  proof, onCheer, onComments,
}: {
  proof: ProofWithRelations;
  onCheer: (type: CheerType) => void;
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

      {/* 4가지 응원 chips — type 별 독립 카운트 */}
      <View style={styles.cheerRow}>
        {CHEER_OPTIONS.map(({ type, emoji }) => {
          const count = proof.cheers_by_type[type] ?? 0;
          const active = proof.my_cheers.includes(type);
          return (
            <Pressable
              key={type}
              style={[styles.cheerChip, active && styles.cheerChipActive]}
              onPress={() => onCheer(type)}
              hitSlop={4}
            >
              <Text style={styles.cheerChipEmoji}>{emoji}</Text>
              {count > 0 ? (
                <Text style={[styles.cheerChipCount, active && styles.cheerChipCountActive]}>
                  {formatCheerCount(count)}
                </Text>
              ) : null}
            </Pressable>
          );
        })}
        <Pressable
          style={styles.giftBtn}
          onPress={() => Alert.alert('선물', '🎁 선물 응원은 Phase 2 에서 만나요.')}
          hitSlop={4}
        >
          <Text style={styles.giftBtnText}>🎁 선물</Text>
        </Pressable>
      </View>

      <Pressable style={styles.commentRow} onPress={onComments} hitSlop={6}>
        <Text style={styles.cheerIcon}>💬</Text>
        <Text style={styles.cheerCount}>댓글 {proof.comment_count}</Text>
      </Pressable>
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
    minHeight: 56,
    paddingHorizontal: 16,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.primary100,
    backgroundColor: colors.surface,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stackedRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stackedAvatar: {
    width: 26, height: 26,
    borderRadius: 13,
    backgroundColor: colors.primary50,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.surface,
    overflow: 'hidden',
  },
  stackedAvatarImg: { width: '100%', height: '100%' },
  stackedAvatarMore: {
    backgroundColor: colors.accent50,
  },
  stackedMoreText: {
    fontSize: 10,
    color: colors.accent700,
    fontFamily: fontFamily.bold,
    fontWeight: fontWeight.bold,
  },
  impactBtn: {
    fontSize: 22,
    paddingHorizontal: 4,
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

  // 4가지 응원 chips + 선물 + 댓글 (v2)
  cheerRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
    paddingTop: 8,
    paddingHorizontal: 2,
  },
  cheerChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.primary50,
    borderWidth: 1,
    borderColor: 'transparent',
    minWidth: 44,
    justifyContent: 'center',
  },
  cheerChipActive: {
    backgroundColor: colors.accent50,
    borderColor: colors.accent,
  },
  cheerChipEmoji: { fontSize: 16 },
  cheerChipCount: {
    fontSize: fontSize.sm,
    color: colors.primary500,
    fontFamily: fontFamily.medium,
    fontWeight: fontWeight.medium,
  },
  cheerChipCountActive: {
    color: colors.accent700,
    fontWeight: fontWeight.bold,
  },
  giftBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.accent50,
    marginLeft: 4,
  },
  giftBtnText: {
    fontSize: fontSize.sm,
    color: colors.accent700,
    fontFamily: fontFamily.medium,
    fontWeight: fontWeight.semibold,
  },
  commentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingTop: 12,
    paddingHorizontal: 2,
  },

  // v4 헤더 강화 — info bar / progress / impact / 5탭 bar
  infoBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
    backgroundColor: colors.surface,
  },
  infoStats: {
    flexDirection: 'row',
    gap: 14,
  },
  infoStatItem: {
    fontSize: fontSize.sm,
    color: colors.primary500,
    fontFamily: fontFamily.medium,
    fontWeight: fontWeight.medium,
  },
  infoRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  ddayBig: {
    fontSize: fontSize['2xl'],
    color: colors.accent,
    fontFamily: fontFamily.bold,
    fontWeight: fontWeight.bold,
    letterSpacing: -0.4,
  },
  pauseInline: {
    fontSize: fontSize.xs,
    color: colors.primary500,
    fontFamily: fontFamily.medium,
    fontWeight: fontWeight.medium,
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: colors.primary50,
    borderRadius: radius.pill,
  },
  progressTrack: {
    height: 6,
    marginHorizontal: 20,
    marginBottom: 12,
    backgroundColor: colors.primary100,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: 6,
    backgroundColor: colors.accent,
    borderRadius: 3,
  },
  impact: {
    marginHorizontal: 16,
    marginBottom: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: colors.accent50,
    borderRadius: radius.lg,
  },
  impactLabel: {
    fontSize: fontSize.sm,
    color: colors.accent700,
    fontFamily: fontFamily.medium,
    fontWeight: fontWeight.semibold,
    marginBottom: 8,
  },
  impactStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  impactStat: { alignItems: 'center', flex: 1 },
  impactNum: {
    fontSize: fontSize.xl,
    color: colors.primary,
    fontFamily: fontFamily.bold,
    fontWeight: fontWeight.bold,
  },
  impactName: {
    fontSize: fontSize.xs,
    color: colors.primary500,
    fontFamily: fontFamily.regular,
    marginTop: 2,
  },
  tabsBar: {
    flexDirection: 'row',
    paddingHorizontal: 8,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.primary100,
  },
  tabItem: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabItemActive: {
    borderBottomColor: colors.accent,
  },
  tabText: {
    fontSize: fontSize.sm,
    color: colors.primary500,
    fontFamily: fontFamily.medium,
    fontWeight: fontWeight.medium,
  },
  tabTextActive: {
    color: colors.accent,
    fontFamily: fontFamily.bold,
    fontWeight: fontWeight.bold,
  },
  tabPlaceholder: {
    flex: 1,
    paddingHorizontal: 32,
    paddingTop: 64,
    alignItems: 'center',
    gap: 12,
  },
  tabPlaceholderEmoji: { fontSize: 56 },
  tabPlaceholderTitle: {
    fontSize: fontSize.lg,
    color: colors.primary,
    fontFamily: fontFamily.bold,
    fontWeight: fontWeight.bold,
    textAlign: 'center',
  },
  tabPlaceholderDesc: {
    fontSize: fontSize.sm,
    color: colors.primary500,
    fontFamily: fontFamily.regular,
    textAlign: 'center',
    lineHeight: 20,
  },

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
  fabCheer: { backgroundColor: colors.accent700 },     // 응원받기 방의 응원자용 (도전자 아닌 사람)
  fabLabel: {
    color: colors.surface,
    fontSize: fontSize.lg,
    fontFamily: fontFamily.bold,
    fontWeight: fontWeight.bold,
  },
});
