// 🚀 챌린지 방 — 인증 피드 (Supabase 실데이터 + Realtime)
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { InviteConfirmModal } from '@/components/challenge/InviteConfirmModal';
import { GiftSheet } from '@/components/challenge/GiftSheet';
import {
  isGiftPilotEmail, fetchMyReceivedGifts, GIFT_TIERS, GIFT_STATUS_LABEL, type ReceivedGift,
} from '@/lib/payments';
import { InviteLetterModal } from '@/components/challenge/InviteLetterModal';
import { ImpactModal } from '@/components/challenge/ImpactModal';
import { reportError } from '@/lib/sentry';
import { haptic } from '@/lib/haptics';
import { computeProgress, computeStreak, isCompleted, isFinished, getFarewellState } from '@/lib/stats';
import * as SecureStore from 'expo-secure-store';
import { joinChallenge } from '@/lib/invite';
import { formatCheerCount, getKstTodayRange } from '@/lib/format';
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
  const { id, fromCreate, tab, proofId, logId, comments } = useLocalSearchParams<{
    id: string; fromCreate?: string; tab?: string;
    proofId?: string;    // 알림 딥링크 — 인증 탭에서 해당 카드로 스크롤 포커스
    logId?: string;      // 알림 딥링크 — 기록 탭에서 해당 카드로 스크롤 포커스
    comments?: string;   // '1' 이면 댓글 시트까지 자동 오픈 (comment / log_comment)
  }>();
  const session = useSession();

  const [challenge, setChallenge] = useState<DbChallenge | null>(null);
  const [members, setMembers] = useState<MemberWithToday[]>([]);
  const [proofs, setProofs] = useState<ProofWithRelations[]>([]);
  const [totalLogs, setTotalLogs] = useState(0);   // 박제 통계·ImpactModal 용 기록 수
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createPromptShown, setCreatePromptShown] = useState(false);
  const [completeRedirected, setCompleteRedirected] = useState(false);
  const [activeProofId, setActiveProofId] = useState<string | null>(null);    // 댓글 sheet 대상
  const [activeTab, setActiveTab] = useState<RoomTab>((tab === 'chat' || tab === 'log' || tab === 'status' || tab === 'archive') ? tab : 'proof');               // v4 5탭 활성 탭
  const [logComposerOpen, setLogComposerOpen] = useState(false);              // 기록 탭 FAB → LogTab 컴포저
  const [memberSheetOpen, setMemberSheetOpen] = useState(false);              // 헤더 avatars → 멤버 시트
  const [impactModalOpen, setImpactModalOpen] = useState(false);              // info-bar 💚 → 함께 만든 변화 팝업
  const [inviteConfirmOpen, setInviteConfirmOpen] = useState(false);          // 🚀 초대 메시지 첨부 확인 모달 열림 여부
  const [inviteLetterOpen, setInviteLetterOpen] = useState(false);            // 🚀 초대 편지글 모달 열림 여부
  const [giftTarget, setGiftTarget] = useState<{ id: string; nickname: string; proofId?: string } | null>(null);   // ☕ 응원 한잔 대상

  const myUserId = session?.user?.id;
  // ☕ 파일럿 게이트 — 개발 모드이거나 지정 계정일 때만 한잔 버튼 노출
  const isGiftPilot = isGiftPilotEmail(session?.user?.email);
  // ☕ 내가 받은 한잔들 — 본인 인증 카드 도착 버튼 + 폴백 배너 (수신은 게이트 없음)
  const [receivedGifts, setReceivedGifts] = useState<ReceivedGift[]>([]);

  useEffect(() => {
    if (session === null) router.replace('/login');
  }, [session]);

  // 알림함/딥링크에서 ?tab= 으로 진입·재진입 시 탭 동기화 (mount 후 param 변경에도 반응)
  useEffect(() => {
    if (tab === 'chat' || tab === 'proof' || tab === 'log' || tab === 'status' || tab === 'archive') {
      setActiveTab(tab);
    }
  }, [tab]);

  // 🚀 알림 딥링크 정밀 포커스 — ?proofId= 진입 시 해당 인증 카드로 스크롤, &comments=1 이면 댓글 시트 자동 오픈
  const proofListRef = useRef<FlatList<ProofWithRelations>>(null);
  const focusedProofRef = useRef<string | null>(null);   // 같은 param 으로 재로드 시 반복 스크롤 방지
  useEffect(() => {
    if (!proofId || activeTab !== 'proof' || proofs.length === 0) return;
    if (focusedProofRef.current === proofId) return;
    const index = proofs.findIndex(p => p.id === proofId);
    if (index < 0) return;
    focusedProofRef.current = proofId;
    // FlatList 가 카드 높이를 측정할 시간을 준 뒤 스크롤 (직후 호출은 빈번히 실패)
    setTimeout(() => {
      proofListRef.current?.scrollToIndex({ index, viewPosition: 0.2, animated: true });
    }, 300);
    if (comments === '1') setActiveProofId(proofId);
  }, [proofId, comments, activeTab, proofs]);

  const load = useCallback(async () => {
    if (!id || !myUserId) return;
    try {
      setError(null);
      const data = await fetchRoomData(id, myUserId);
      setChallenge(data.challenge);
      setMembers(data.members);
      setProofs(data.proofs);
      setTotalLogs(data.totalLogs);
      // 받은 한잔은 부가 정보 — 실패해도 방 로딩을 막지 않음
      fetchMyReceivedGifts(id, myUserId).then(setReceivedGifts).catch(() => {});
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

    // 인스턴스별 유니크 채널 이름 — 같은 방 두 mount 시 동일 토픽 충돌 방지 (ChatTab 패턴)
    const channel = supabase
      .channel(`room:${id}:${Math.random().toString(36).slice(2, 8)}`)
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

  const executeShare = useCallback(async (attachedMessage: string | null) => {
    if (!challenge) return;
    // iOS 등 모달 닫히는 애니메이션 완료 후 공유창을 안정적으로 띄우기 위해 300ms 딜레이 적용
    setTimeout(async () => {
      try {
        const link = `https://bpffxeddkuekefphsolz.supabase.co/functions/v1/invite?id=${challenge.id}`;
        
        let messageText = '';
        if (attachedMessage && attachedMessage.trim() !== '') {
          messageText = `📨 초대의 말:\n"${attachedMessage}"\n\n`;
        }

        // 응원받기 방은 응원 요청 톤, 그 외는 함께 도전 톤
        const intro = challenge.kind === 'cheered'
          ? `"${challenge.title}" 챌린지를 시작합니다.\n와서 응원해주세요! 💛`
          : `"${challenge.title}" 챌린지에 함께해요!`;

        // 시작 전(모집 기간)이면 시작일을 초대글에 명시 — 합류자가 출발선을 알고 들어오게 (v2.8)
        const kstTodayStr = getKstTodayRange().kstDateStr;
        const startLine = kstTodayStr < challenge.start_date
          ? `🗓️ ${challenge.start_date.replace(/-/g, '.')} 시작 — 그 전까지 함께할 동료를 모아요!\n\n`
          : '';

        await Share.share({
          message:
            `${messageText}` +
            `${intro}\n\n` +
            `${startLine}` +
            `📱 아래 링크를 눌러 챌린지에 합류하세요:\n${link}`,
        });
      } catch (e) {
        Alert.alert('공유 실패', String(e));
      }
    }, 300);
  }, [challenge]);

  const onShareInvite = useCallback(() => {
    if (!challenge) return;
    setInviteConfirmOpen(true);
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

  // 🚀 포기한 멤버 = 조용한 보관 + 전면 읽기 전용 (v2.8 — 0034 가 SELECT 만 허용)
  // 진입 차단하던 기존 Alert 제거 — 열람·회고는 허용, 쓰기는 전면 잠금.
  const enterAlertShownRef = useRef(false);
  useEffect(() => {
    if (enterAlertShownRef.current) return;
    if (challenge?.gave_up_at && !isFinished(challenge) && !me?.gave_up_at) {
      // 종료일이 지난 방은 개설자가 포기했어도 제거 유도 X — 멤버의 박제 접근 보존 (박제=영구 원칙)
      enterAlertShownRef.current = true;
      Alert.alert(
        '도전 종료',
        '개설자가 포기 선택하였습니다. 확인을 누르시면 내 챌린지에서 제거됩니다',
        [
          {
            text: '확인',
            onPress: () => {
              giveUpMembership({ challengeId: challenge.id, userId: myUserId! })
                .then(() => {
                  haptic.warning();
                  router.replace('/(tabs)/home');
                })
                .catch(e => Alert.alert('제거 실패', e?.message ?? String(e)));
            }
          }
        ],
        { cancelable: false }
      );
    }
  }, [me, challenge, myUserId]);
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
  // 헤더 🏆/🏁 배지용 완주 판정 주체 — cheered 방은 도전 주체가 개설자 1명이므로
  // 응원자 본인 인증이 아니라 개설자(도전자) 인증 기준으로 판정.
  const badgeProofs = useMemo(
    () => challenge?.kind === 'cheered'
      ? proofs.filter(p => p.user_id === challenge.creator_id)
      : myProofs,
    [challenge, proofs, myProofs],
  );
  // 완주 판정 주체의 합류 시각 — 늦합류자는 합류일 기준 비례 완주 (v2.8)
  const subjectJoinedAt = useMemo(() => {
    const subjectId = challenge?.kind === 'cheered' ? challenge.creator_id : myUserId;
    return members.find(m => m.id === subjectId)?.joined_at ?? null;
  }, [challenge, members, myUserId]);
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

  // 완주 자동 감지 → complete 화면으로 디바이스당 1회 redirect.
  // (이미 한 번 봤다면 챌린지방 자유 진입 — 박제·기록·공유 모두 접근 가능)
  const completeCheckRunningRef = useRef(false);   // 비동기 검사 중 deps 변동 시 중복 redirect 방지
  useEffect(() => {
    if (!challenge || !myUserId || completeRedirected) return;
    if (!isCompleted(challenge, myProofs, me?.joined_at)) return;
    if (completeCheckRunningRef.current) return;
    completeCheckRunningRef.current = true;

    // SecureStore 키는 영숫자·`.`·`-`·`_` 만 허용 — `:` 사용 시 get/set 모두 throw 됨
    const key = `complete_seen_${challenge.id}_${myUserId}`;
    (async () => {
      try {
        const seen = await SecureStore.getItemAsync(key);
        if (seen === 'true') {
          setCompleteRedirected(true);   // 다시 안 띄움 — 챌린지방 자유 사용
          return;
        }
        await SecureStore.setItemAsync(key, 'true');
        setCompleteRedirected(true);
        router.replace(`/complete/${challenge.id}` as any);
      } catch {
        // SecureStore 실패 시엔 redirect 하지 않음 — "봤다" 기록이 안 남는 상태에서
        // redirect 하면 방 진입 때마다 완주 화면으로 튕기는 트랩이 되기 때문.
        setCompleteRedirected(true);
      }
    })();
  }, [challenge, myProofs, completeRedirected, myUserId, me]);

  // ─── 잠시 멈춤 / 재개 / 도전 포기 ─────────────────────
  const onTogglePause = useCallback(() => {
    if (!challenge || !myUserId) return;

    if (isCheeredCheerOnly) {
      Alert.alert(
        '응원 그만하기',
        '이 챌린지의 응원을 그만둘까요?\n내 목록에서 챌린지가 사라집니다.',
        [
          { text: '취소', style: 'cancel' },
          {
            text: '그만하기',
            style: 'destructive',
            onPress: () => {
              giveUpMembership({ challengeId: challenge.id, userId: myUserId })
                .then(() => { haptic.warning(); router.back(); })
                .catch(e => Alert.alert('그만하기 실패', e?.message ?? String(e)));
            },
          },
        ],
      );
      return;
    }

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
  }, [challenge, myUserId, isPaused, load, isCheeredCheerOnly]);

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
  // 종료 방 — 초대·멈춤은 회색 비활성 + 안내 (탭·열람은 회고용으로 유지)
  const finished = isFinished(challenge);
  const onFinishedNotice = () => {
    haptic.tap();
    Alert.alert(
      '이미 종료된 도전이에요',
      '종료된 방은 초대·멈춤·메시지 발송을 사용할 수 없어요.\n남긴 인증과 기록은 박제에 영구 보존됩니다.',
    );
  };
  // 🚀 마무리 인사 유예 (종료일 24시 KST + 7일, solo 는 즉시) — 지나면 대화·댓글·기록·응원 전면 잠금
  const farewell = getFarewellState(challenge);
  // 포기한 멤버는 즉시 전면 읽기 전용 (완주 유예보다 강한 잠금 — 서버는 0034 가 보장)
  const iGaveUp = Boolean(me?.gave_up_at);
  const writeLocked = iGaveUp || (farewell.finished && !farewell.canWrite);
  const onLockedNotice = () => {
    haptic.tap();
    if (iGaveUp) {
      Alert.alert(
        '포기한 도전이에요',
        '남긴 흔적은 열람만 가능해요.\n언제든 새 도전으로 다시 시작할 수 있어요.',
      );
      return;
    }
    Alert.alert(
      '박제된 도전이에요',
      '마무리 기간이 끝나 대화·응원·기록은 보존만 됩니다.',
    );
  };
  // 헤더 액션(초대·발송메시지·멈춤) 잠금 — 종료 방 + 포기 멤버 공통
  const headerLocked = finished || iGaveUp;
  const onHeaderLockedNotice = iGaveUp ? onLockedNotice : onFinishedNotice;
  // ☕ 한잔 도착 — 미수령이 있으면 수령 화면으로, 전부 처리됐으면 내역 팝업 (숫자 카운팅 표기 없음)
  const onGiftArrivedPress = (gifts: ReceivedGift[]) => {
    haptic.tap();
    const unclaimed = gifts.find(g => g.status === 'paid');
    if (unclaimed) {
      router.push(`/gift/${unclaimed.id}` as any);
      return;
    }
    const lines = gifts.map(g => {
      const tier = GIFT_TIERS.find(t => t.tier === g.product_tier)?.label ?? '☕ 한잔';
      return `${g.sender_nickname}님의 ${tier} — ${GIFT_STATUS_LABEL[g.status] ?? g.status}`;
    });
    Alert.alert('☕ 도착한 한잔', lines.join('\n'));
  };
  // 인증 카드와 연결되지 않은 미수령 한잔 (옛 주문·인증 삭제) — 인증 탭 상단 폴백 배너
  const visibleProofIds = new Set(proofs.map(p => p.id));
  const orphanUnclaimedGift = receivedGifts.find(
    g => g.status === 'paid' && (!g.proof_id || !visibleProofIds.has(g.proof_id)),
  );
  const daysLeft = progress ? Math.max(0, progress.totalDays - progress.passedDays) : 0;
  const todayCheckedCount = members.filter(m => m.today_checked).length;
  // 🚀 모집 기간 — 시작일 전이면 인증 대신 동료 모집 모드 (다함께·누구나 시작일 지정, v2.8)
  const kstToday = getKstTodayRange().kstDateStr;
  const notStarted = kstToday < challenge.start_date;
  const daysToStart = notStarted
    ? Math.max(1, Math.round((new Date(challenge.start_date + 'T00:00:00').getTime() - new Date(kstToday + 'T00:00:00').getTime()) / 86_400_000))
    : 0;

  return (
    <Screen
      backgroundColor={colors.background}
      edges={activeTab === 'chat' ? ['top'] : ['top', 'bottom']}
    >
      {/* ─── 헤더 — 챌린지명 라인에 stacked avatars (탭=멤버 시트) ─── */}
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="뒤로가기"
        >
          <Text style={styles.back}>←</Text>
        </Pressable>
        <View style={{ flex: 1, marginHorizontal: 8 }}>
          <View style={styles.headerTitleRow}>
            <Text style={styles.title} numberOfLines={1}>
              {/* 🚀 완주 / 종료 배지 (P-② 재진입 허용 후 시각 표지) — cheered 는 도전자 기준 */}
              {isCompleted(challenge, badgeProofs, subjectJoinedAt) ? '🏆 ' : isFinished(challenge) ? '🏁 ' : ''}
              {challenge.title}
            </Text>
            <Pressable
              onPress={() => { haptic.tap(); setMemberSheetOpen(true); }}
              hitSlop={6}
              accessibilityRole="button"
              accessibilityLabel={`멤버 ${members.length}명 보기`}
            >
              <StackedAvatars members={members} />
            </Pressable>
          </View>
          <View style={styles.headerSubtitleRow}>
            <Text style={styles.subtitle}>{roomKindLabel(challenge.kind, members.length)}</Text>
            {/* 🚀 개설자 전체 메시지 발송 버튼 — 종료 방은 초대·멈춤과 동일하게 회색 비활성 */}
            {isCreator && challenge.kind !== 'solo' && (
              <Pressable
                onPress={headerLocked ? onHeaderLockedNotice : () => { haptic.tap(); setInviteLetterOpen(true); }}
                style={[styles.headerLetterBtn, headerLocked && styles.headerLetterBtnDisabled]}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={headerLocked ? '발송메시지 — 사용 불가' : '전체 메시지 발송'}
              >
                <Text style={[styles.headerLetterBtnText, headerLocked && styles.headerLetterBtnTextDisabled]}>발송메시지</Text>
              </Pressable>
            )}
          </View>
        </View>
        {challenge.kind !== 'solo' ? (
          <Pressable
            onPress={headerLocked ? onHeaderLockedNotice : onShareInvite}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel={headerLocked ? '초대 — 사용 불가' : '동료 초대'}
          >
            <Text style={[styles.share, headerLocked && styles.shareDisabled]}>초대</Text>
          </Pressable>
        ) : (
          <View style={{ width: 32 }} />
        )}
      </View>

      {/* ─── 진행 info bar (D-N + 연속 + 멈춤) — 종료 방은 "종료" + 진행 숫자 취소선 ─── */}
      <View style={styles.infoBar}>
        <View style={styles.infoStats}>
          <Text style={[styles.infoStatItem, finished && styles.infoStatItemDone]}>🔥 {progress?.passedDays ?? 0}/{progress?.totalDays ?? 0}일</Text>
          <Text style={[styles.infoStatItem, finished && styles.infoStatItemDone]}>📸 {todayCheckedCount}/{Math.max(1, members.length)} 인증</Text>
        </View>
        <View style={styles.infoRight}>
          <Pressable onPress={() => { haptic.tap(); setImpactModalOpen(true); }} hitSlop={6}>
            <Text style={styles.impactBtn}>💚</Text>
          </Pressable>
          {finished ? (
            <Text style={[styles.ddayBig, styles.ddayDone]}>종료</Text>
          ) : notStarted ? (
            <Text style={styles.ddayBig}>시작 D-{daysToStart}</Text>
          ) : (
            <Text style={styles.ddayBig}>D-{daysLeft}</Text>
          )}
          {isMember && !iGaveUp && (
            <Pressable onPress={finished ? onFinishedNotice : onTogglePause} hitSlop={6}>
              <Text style={[styles.pauseInline, finished && styles.pauseInlineDisabled]}>
                {isCheeredCheerOnly ? '🏃 그만하기' : (isPaused ? '▶ 재개' : '⏸ 멈춤')}
              </Text>
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
          ref={proofListRef}
          data={proofs}
          keyExtractor={p => p.id}
          contentContainerStyle={styles.feed}
          onScrollToIndexFailed={(info) => {
            // 카드 높이가 가변이라 측정 전엔 scrollToIndex 가 실패할 수 있음 — 근사 위치로 이동 후 재시도
            proofListRef.current?.scrollToOffset({ offset: info.averageItemLength * info.index, animated: false });
            setTimeout(() => {
              proofListRef.current?.scrollToIndex({ index: info.index, viewPosition: 0.2, animated: true });
            }, 350);
          }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.accent}
            />
          }
          ListHeaderComponent={
            orphanUnclaimedGift ? (
              <Pressable
                style={styles.giftArrivedBanner}
                onPress={() => { haptic.tap(); router.push(`/gift/${orphanUnclaimedGift.id}` as any); }}
                accessibilityRole="button"
                accessibilityLabel="받지 않은 한잔 확인하기"
              >
                <Text style={styles.giftArrivedBannerText}>☕ 받지 않은 한잔이 있어요 — 눌러서 확인하기</Text>
              </Pressable>
            ) : null
          }
          renderItem={({ item }) => (
            <ProofCard
              proof={item}
              mine={item.user_id === myUserId}
              locked={writeLocked}
              onCheer={(type) => (writeLocked ? onLockedNotice() : onCheer(item.id, type))}
              onComments={() => { haptic.tap(); setActiveProofId(item.id); }}
              // ☕ 응원 한잔 — Stage 4 베타 오픈 전까지 파일럿 계정 전용 (isGiftPilot).
              // 동료의 인증에만 노출 (솔로 방·본인 인증·종료 방 제외 — 서버 정책과 동일 잣대)
              onGift={
                isGiftPilot && challenge.kind !== 'solo' && isMember && !finished && !iGaveUp && item.user_id !== myUserId
                  ? () => { haptic.tap(); setGiftTarget({ id: item.user_id, nickname: item.author?.nickname ?? '동료', proofId: item.id }); }
                  : null
              }
              // ☕ 한잔 도착 — 본인 인증 카드에 이 인증으로 받은 한잔이 있을 때만 (받은 적 있으면 계속 표시)
              onGiftArrived={(() => {
                if (item.user_id !== myUserId) return null;
                const gifts = receivedGifts.filter(g => g.proof_id === item.id);
                return gifts.length > 0 ? () => onGiftArrivedPress(gifts) : null;
              })()}
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
          farewellDaysLeft={farewell.farewellDaysLeft}
          writeLocked={writeLocked}
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
          writeLocked={writeLocked}
          farewellDaysLeft={farewell.farewellDaysLeft}
          focusLogId={typeof logId === 'string' ? logId : null}
          focusComments={comments === '1'}
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
          myUserId={myUserId}
          subjectJoinedAt={subjectJoinedAt}
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
        // 🚀 포기한 멤버 — 재도전의 출발점 (보관함이 실패의 전시가 되지 않게)
        if (iGaveUp) {
          if (activeTab !== 'proof' && activeTab !== 'log') return null;
          return (
            <Pressable
              style={[styles.fab, styles.fabPaused]}
              onPress={() => {
                haptic.tap();
                router.push(`/create?title=${encodeURIComponent(challenge.title)}` as any);
              }}
            >
              <Text style={styles.fabLabel}>🔄 이 도전, 다시 시작하기</Text>
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
          if (writeLocked) return null;   // 박제 후엔 새 기록 작성 X
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
        // 🚀 P-④: 종료된 챌린지엔 새 인증 차단. 박제 탭으로 안내.
        if (isFinished(challenge)) {
          return (
            <Pressable
              style={[styles.fab, styles.fabDone]}
              onPress={() => { haptic.tap(); setActiveTab('archive'); }}
            >
              <Text style={styles.fabLabel}>🏁 도전 종료 · 박제 보기</Text>
            </Pressable>
          );
        }
        // 🚀 모집 기간 — 시작 전엔 인증 대신 동료 초대 유도 (DB 도 0024 가 시작 전 인증 차단)
        if (notStarted) {
          return (
            <Pressable
              style={[styles.fab, styles.fabPaused]}
              onPress={() => {
                haptic.tap();
                Alert.alert(
                  '아직 시작 전이에요',
                  `${formatKoreanDate(challenge.start_date)}부터 인증할 수 있어요.\n그동안 함께할 동료를 모아보세요!`,
                  challenge.kind === 'solo'
                    ? [{ text: '확인' }]
                    : [{ text: '확인', style: 'cancel' }, { text: '카톡으로 초대', onPress: onShareInvite }],
                );
              }}
            >
              <Text style={styles.fabLabel}>🗓️ {daysToStart}일 뒤 시작 · 동료 모집 중</Text>
            </Pressable>
          );
        }
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
        writeLocked={writeLocked}
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
        creatorId={challenge.creator_id}
      />

      <InviteLetterModal
        visible={inviteLetterOpen}
        onClose={() => setInviteLetterOpen(false)}
        challengeId={challenge.id}
        onRefresh={load}
      />

      <InviteConfirmModal
        visible={inviteConfirmOpen}
        onClose={() => setInviteConfirmOpen(false)}
        invitationMessage={challenge.invitation_message ?? null}
        challengeId={challenge.id}
        myUserId={myUserId}
        creatorId={challenge.creator_id}
        onShare={executeShare}
      />

      <ImpactModal
        visible={impactModalOpen}
        onClose={() => setImpactModalOpen(false)}
        days={progress?.passedDays ?? 0}
        proofs={totalProofs}
        cheers={totalCheers}
        logs={totalLogs}
        challengeId={challenge.id}
      />

      {/* ☕ 응원 한잔 보내기 시트 (개발 빌드 전용 진입 — onGift 게이트) */}
      <GiftSheet
        visible={giftTarget !== null}
        onClose={() => setGiftTarget(null)}
        challengeId={challenge.id}
        recipientId={giftTarget?.id ?? ''}
        recipientNickname={giftTarget?.nickname ?? '동료'}
        proofId={giftTarget?.proofId ?? null}
        myUserId={myUserId}
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

const CHEER_OPTIONS: { type: CheerType; emoji: string; label: string }[] = [
  { type: 'fire',   emoji: '🔥', label: '불꽃 응원' },
  { type: 'clap',   emoji: '👏', label: '박수 응원' },
  { type: 'muscle', emoji: '💪', label: '힘내 응원' },
  { type: 'heart',  emoji: '❤️', label: '하트 응원' },
];

function ProofCard({
  proof, onCheer, onComments, locked = false, onGift = null, onGiftArrived = null, mine = false,
}: {
  proof: ProofWithRelations;
  onCheer: (type: CheerType) => void;
  onComments: () => void;
  locked?: boolean;   // 박제(쓰기 잠금) — 응원 칩 회색 처리
  onGift?: (() => void) | null;          // ☕ 응원 한잔 보내기 — 동료 카드 (파일럿)
  onGiftArrived?: (() => void) | null;   // ☕ 한잔 도착 — 본인 카드, 받은 적 있으면 표시 (카운팅 없음)
  mine?: boolean;                        // 본인 카드 — 🎁 선물 자리표시 제거
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

      {/* 4가지 응원 chips — type 별 독립 카운트 (박제 후엔 회색·카운트만 보존) */}
      <View style={[styles.cheerRow, locked && { opacity: 0.55 }]}>
        {CHEER_OPTIONS.map(({ type, emoji, label }) => {
          const count = proof.cheers_by_type[type] ?? 0;
          const active = proof.my_cheers.includes(type);
          return (
            <Pressable
              key={type}
              style={[styles.cheerChip, active && styles.cheerChipActive]}
              onPress={() => onCheer(type)}
              hitSlop={4}
              accessibilityRole="button"
              accessibilityLabel={`${label}${count > 0 ? ` ${count}개` : ''}${active ? ', 내가 보냄' : ''}`}
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
        {onGift ? (
          <Pressable
            style={styles.giftBtn}
            onPress={onGift}
            hitSlop={4}
            accessibilityRole="button"
            accessibilityLabel="응원 한잔 보내기"
          >
            <Text style={styles.giftBtnText}>☕ 한잔</Text>
          </Pressable>
        ) : onGiftArrived ? (
          <Pressable
            style={[styles.giftBtn, styles.giftArrivedBtn]}
            onPress={onGiftArrived}
            hitSlop={4}
            accessibilityRole="button"
            accessibilityLabel="도착한 한잔 확인하기"
          >
            <Text style={[styles.giftBtnText, styles.giftArrivedBtnText]}>☕ 한잔 도착</Text>
          </Pressable>
        ) : mine ? null : (
          <Pressable
            style={styles.giftBtn}
            onPress={() => Alert.alert('선물', '🎁 선물 응원은 Phase 2 에서 만나요.')}
            hitSlop={4}
          >
            <Text style={styles.giftBtnText}>🎁 선물</Text>
          </Pressable>
        )}
      </View>

      <Pressable
        style={styles.commentRow}
        onPress={onComments}
        hitSlop={6}
        accessibilityRole="button"
        accessibilityLabel={`댓글 ${proof.comment_count}개 보기`}
      >
        <Text style={styles.cheerIcon}>💬</Text>
        <Text style={styles.cheerCount}>댓글 {proof.comment_count}</Text>
      </Pressable>
    </View>
  );
}

// YYYY-MM-DD → "M월 D일" (모집 기간 안내용)
function formatKoreanDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return `${d.getMonth() + 1}월 ${d.getDate()}일`;
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
  headerLetterBtn: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: colors.accent50,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  headerLetterBtnText: {
    fontSize: 10,
    fontFamily: fontFamily.bold,
    fontWeight: fontWeight.bold,
    color: colors.accent,
  },
  headerLetterBtnDisabled: {
    backgroundColor: colors.primary50,
    borderColor: colors.primary300,   // 종료 방 — 회색 비활성 톤
  },
  headerLetterBtnTextDisabled: {
    color: colors.primary300,
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
    flex: 1,
    marginRight: 8,
  },
  subtitle: {
    fontSize: fontSize.xs,
    color: colors.primary500,
    fontFamily: fontFamily.regular,
  },
  headerSubtitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  share: {
    fontSize: fontSize.base,
    color: colors.accent,
    fontFamily: fontFamily.bold,
    fontWeight: fontWeight.bold,
    paddingHorizontal: 8,
  },
  shareDisabled: {
    color: colors.primary300,   // 종료 방 — 회색 비활성 톤
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
  giftArrivedBtn: {
    borderWidth: 1,
    borderColor: colors.accent,   // 도착 — 받을 게 있다는 신호 (숫자 배지 없이 테두리 톤만)
  },
  giftArrivedBtnText: {
    fontFamily: fontFamily.bold,
    fontWeight: fontWeight.bold,
  },
  giftArrivedBanner: {
    backgroundColor: colors.accent50,
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: radius.lg,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    marginBottom: 4,
  },
  giftArrivedBannerText: {
    fontSize: fontSize.sm,
    color: colors.accent700,
    fontFamily: fontFamily.bold,
    fontWeight: fontWeight.bold,
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
  infoStatItemDone: {
    textDecorationLine: 'line-through',   // 종료 방 — 더 이상 유효하지 않은 진행 정보
    color: colors.primary300,
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
  ddayDone: {
    color: colors.primary300,   // 종료 방 — D-0 대신 회색 "종료"
    fontSize: fontSize.lg,
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
  pauseInlineDisabled: {
    color: colors.primary300,   // 종료 방 — 회색 비활성 톤
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
