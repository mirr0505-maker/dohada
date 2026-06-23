// 🚀 홈 (v2.5) — SNS-first 피드: 도전 인연들의 하루
//
// 사상 전환: v2.1~v2.4 "X 빼기" 일변도 → "버릴 건 망가진 방식, 지킬 건 욕구 자체"
//   - 내 대시보드는 me-strip 1줄로 압축 (대시보드 X)
//   - 본문은 도전 인연들의 하루 — 피드 카드 5종:
//     🎉 완주 리본 · 📸 오늘의 인증 · 🙋 응원받기 · ✨ 관심 도전 · 🌍 누구나 합류
//   - 맨 아래 🌙 "오늘은 여기까지예요" 끝 마커 (무한 스크롤 차단)
//
// 도전 인연 정의 (베타 v2.5) = 현재 같은 챌린지의 멤버 (×횟수 누적은 Phase 2)
import React, { useCallback, useRef, useState } from 'react';
import {
  View, Text, Pressable, ScrollView, StyleSheet, RefreshControl, Image, Alert, Modal,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { joinChallenge } from '@/lib/invite';
import { Screen } from '@/components/Screen';
import { AppHeader } from '@/components/AppHeader';
import {
  Telescope, ChevronRight, ChevronUp, ChevronDown, Camera, PenLine, Globe,
  Sprout, Footprints, Heart, Moon, PartyPopper, Crown, Users, User, Handshake,
  Target, Repeat, Check, type LucideIcon,
} from 'lucide-react-native';
import { colors, fontFamily, fontSize, fontWeight, radius, shadow, textStyle } from '@/lib/tokens';
import { useSession } from '@/lib/session';
import {
  fetchMyChallengesWithDetails, fetchOpenChallenges,
  fetchPublicCompletionStories, fetchFellowProofs, giveUpMembership,
  fetchChallengeIdsWithPledges,
  type MyChallengeDetail,
  type FellowProof,
} from '@/lib/db';
import { ErrorState } from '@/components/ErrorState';
import { ChallengeCardSkeleton } from '@/components/Skeleton';
import { OpenJoinPreviewSheet } from '@/components/home/OpenJoinPreviewSheet';
import { PhotoViewer } from '@/components/PhotoViewer';
import { PhotoCarousel } from '@/components/PhotoCarousel';
import { StreakMedal } from '@/components/challenge/StreakMedal';
import { streakMilestone } from '@/lib/stats';
import { reportError } from '@/lib/sentry';
import { haptic } from '@/lib/haptics';
import type { CompletionStoryCard, OpenChallengeCard } from '@/lib/types';
import { getChallengeDDay, getKstTodayRange, formatCheerCount, displayTitle } from '@/lib/format';
import { CategoryIcon } from '@/components/CategoryIcon';
import { categorySlugByName } from '@/lib/icons';

// ─── 🚀 오늘 나의 도전용 헬퍼 및 메타 ─────────────────
const KIND_META: Record<string, { Icon: LucideIcon; label: string; bg: string; text: string }> = {
  solo: { Icon: User, label: '나혼자', bg: colors.primary50, text: colors.primary500 },
  cheered_creator: { Icon: Heart, label: '응원받기', bg: colors.accent50, text: colors.accent700 },
  cheered_participant: { Icon: Heart, label: '응원하기', bg: colors.accent50, text: colors.accent700 },
  closed: { Icon: Handshake, label: '다함께', bg: colors.tintCream, text: colors.gold },
  open: { Icon: Globe, label: '누구나', bg: colors.tintSage, text: colors.doneInk },
};

export default function HomeScreen() {
  const session = useSession();
  const [myChs, setMyChs]                   = useState<MyChallengeDetail[]>([]);
  const [completions, setCompletions]       = useState<CompletionStoryCard[]>([]);
  const [todayProofs, setTodayProofs]       = useState<FellowProof[]>([]);
  const [viewer, setViewer]                 = useState<{ photos: string[]; index: number } | null>(null);   // 🚀 사진 전체보기 뷰어 (여러 장)
  const [openChs, setOpenChs]               = useState<OpenChallengeCard[]>([]);
  const [loading, setLoading]               = useState(true);
  const [refreshing, setRefreshing]         = useState(false);
  const [error, setError]                   = useState<string | null>(null);
  // 🚀 누구나 합류 — 합류 전 안내문 미리보기 시트 대상 (null = 닫힘)
  const [previewCard, setPreviewCard]       = useState<OpenChallengeCard | null>(null);
  const [joiningPreview, setJoiningPreview]  = useState(false);
  // 🚀 콜드스타트 온램프 — '둘러보고 합류' 버튼이 합류 섹션으로 스크롤하도록 ref + 섹션 y 측정
  const scrollRef = useRef<ScrollView>(null);
  // 💛 다짐 배지 — 내 방 중 다짐이 걸린 challenge_id 집합 (홈 '오늘 나의 하다' 카드)
  const [pledgeChIds, setPledgeChIds] = useState<Set<string>>(new Set());

  const myUserId = session?.user?.id;
  // 🚀 같은 세션에서 한 챌린지에 대해 포기 Alert 중복 표시 차단 (P1-12 안전망).
  // P0-2 정책 추가로 challenges.gave_up_at 갱신이 정상 동작하면 자연 해소되지만,
  // 사용자가 alert "확인" 누르기 전 useFocusEffect 가 다시 load 를 트리거하는 경쟁 상황 방지.
  const abandonedAlertShownRef = useRef<Set<string>>(new Set());

  const handleJoinChallenge = async (challengeId: string) => {
    if (!myUserId) return;

    // 🚀 더블 가드: 이미 가입된 챌린지인지 체크
    const isAlreadyMember = myChs.some(c => c.id === challengeId);
    if (isAlreadyMember) {
      haptic.warning();
      Alert.alert(
        '참여 중인 하다',
        '이미 참여 중인 하다입니다. 하다 방으로 이동하시겠습니까?',
        [
          { text: '취소', style: 'cancel' },
          {
            text: '이동',
            onPress: () => {
              haptic.tap();
              router.push(`/room/${challengeId}` as any);
            }
          }
        ]
      );
      return;
    }

    // 🚀 즉시 합류 Alert 대신 — 안내문 미리보기 시트를 열어 내용을 보고 결정하게 한다
    const card = openChs.find(c => c.id === challengeId) ?? null;
    if (card) {
      haptic.tap();
      setPreviewCard(card);
      return;
    }
    // 카드 정보를 못 찾는 예외 케이스만 기존 즉시 합류 폴백
    Alert.alert('하다 합류', '정말 개설자와 함께 하시겠습니까?', [
      { text: '취소', style: 'cancel' },
      { text: '확인', onPress: () => doJoin(challengeId) },
    ]);
  };

  // 실제 합류 처리 — 미리보기 시트 확인 / 폴백 Alert 공용
  const doJoin = async (challengeId: string) => {
    if (!myUserId || joiningPreview) return;
    try {
      setJoiningPreview(true);
      await joinChallenge(challengeId, myUserId);
      haptic.success();
      setPreviewCard(null);
      Alert.alert('합류 완료', '하다에 성공적으로 합류했습니다!');
      await load();
    } catch (err: any) {
      if (err?.message === 'adult_required') {
        Alert.alert('성인 인증이 필요해요', '성인 전용 하다라 성인 본인인증을 마친 분만 합류할 수 있어요.\n본인인증을 먼저 진행해주세요.');
      } else {
        Alert.alert('합류 실패', err?.message ?? String(err));
      }
    } finally {
      setJoiningPreview(false);
    }
  };

  const load = useCallback(async () => {
    if (!myUserId) return;
    try {
      setError(null);
      const [mine, fellows, recentDone, opens] = await Promise.all([
        fetchMyChallengesWithDetails(myUserId),
        fetchFellowProofs(myUserId, 100),   // 🚀 챌린지별 그룹+더보기 위해 넉넉히 (오늘분만 필터됨)
        fetchPublicCompletionStories({ limit: 5 }).catch(() => []),
        fetchOpenChallenges(myUserId),
      ]);
      setMyChs(mine);
      
      // 🚀 개설자(방장)가 포기한 챌린지 감지 시 제거 얼럿 노출
      //    같은 세션에 같은 챌린지 alert 가 다시 뜨지 않도록 ref 가드.
      const abandoned = mine.find(
        c => c.gave_up_at !== null && !abandonedAlertShownRef.current.has(c.id)
      );
      if (abandoned) {
        abandonedAlertShownRef.current.add(abandoned.id);
        Alert.alert(
          '하다 종료',
          '개설자가 포기 선택하였습니다. 확인을 누르시면 내 하다에서 제거됩니다',
          [
            {
              text: '확인',
              onPress: async () => {
                try {
                  setLoading(true);
                  await giveUpMembership({ challengeId: abandoned.id, userId: myUserId });
                  haptic.warning();
                  // 포기 후 목록 리로드
                  const updatedMine = await fetchMyChallengesWithDetails(myUserId);
                  setMyChs(updatedMine);
                } catch (err: any) {
                  Alert.alert('제거 실패', err?.message ?? String(err));
                } finally {
                  setLoading(false);
                }
              }
            }
          ],
          { cancelable: false }
        );
      }

      setCompletions(recentDone);
      // 오늘 인증한 동료만 (KST 당일 범위 매칭)
      const { startUtc, endUtc } = getKstTodayRange();
      const dayStartMs = Date.parse(startUtc);
      const dayEndMs = Date.parse(endUtc);
      setTodayProofs(fellows.filter(p => {
        const t = Date.parse(p.created_at);
        return t >= dayStartMs && t < dayEndMs;
      }));   // 🚀 상한 slice 제거 — 챌린지별 묶고 그룹마다 인라인 더보기로 노출
      
      // 🚀 클라이언트 단 더블 가드 필터링: 이미 가입하고 포기 안 한 내 챌린지 제외
      const myActiveChIds = new Set(mine.filter(c => c.gave_up_at === null).map(c => c.id));
      setOpenChs(opens.filter(c => !myActiveChIds.has(c.id)));
      // 💛 다짐 배지용 — 내 방 중 다짐 걸린 방 id (RLS로 내가 볼 수 있는 것만). 비핵심이라 실패 무시.
      fetchChallengeIdsWithPledges(mine.map(c => c.id)).then(setPledgeChIds).catch(() => {});
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
  // 🚀 콜드스타트(도전 0개) = 빈 카드 스택 대신 살아있는 온램프 한 장으로 분기
  const isColdStart = totalCount === 0;
  // 🚀 P-⑤: 진행 중 vs 종료된 챌린지 분리 (KST 자정 기준).
  const todayStr = getKstTodayRange().kstDateStr;
  // 🚀 응원하기로만 들어간 cheered 방 = "내가 하는 하다"가 아니라 "내가 응원하는 하다".
  //   '오늘, 나의 하다'(myDoingChs)에서 빼고 아래 '오늘, 응원으로 힘주기'(cheeredRooms)에서만 노출
  //   → 두 섹션 중복 + 도전자/응원자 역할 혼선 제거.
  //   ⚠️ 종료된 응원방은 '오늘 응원' 섹션에서 제외 — 종료일이 지나면 '오늘 응원' 맥락이 아니다
  //     (완주·미완주 무관, 종료(todayStr > end_date)와 동일 기준). 종료 방은 내하다 탭에서 열람.
  const cheeredRooms = myChs.filter(
    c => c.kind === 'cheered' && c.creator_id !== myUserId && todayStr <= c.end_date,
  );
  const myDoingChs = myChs.filter(c => !(c.kind === 'cheered' && c.creator_id !== myUserId));

  const activeChs   = myDoingChs.filter(c => todayStr <= c.end_date);

  // 🚀 홈 노출 상한 — 참여 방이 많아도 홈 스크롤 폭증 방지 (전체는 내도전 탭에서)
  const HOME_ACTIVE_LIMIT = 5;
  const kstTodayStr = getKstTodayRange().kstDateStr;
  // 🚀 0041: 목표 횟수형(count)은 일일 의무 없음 — '오늘 인증' 잔소리·정렬·배지에서 제외
  const isCountGoal = (c: MyChallengeDetail) => c.goal_type === 'count';
  const goalDone = (c: MyChallengeDetail) =>
    isCountGoal(c) && c.target_count != null && c.my_proof_count >= c.target_count;
  // 오늘 인증이 필요한 방 (주기형 + 시작했고 + 오늘 미인증 + cheered 응원자 제외)
  const needsTodayCheck = (c: MyChallengeDetail) =>
    !isCountGoal(c) &&
    !c.is_today_checked &&
    !(c.kind === 'cheered' && c.creator_id !== myUserId) &&
    c.start_date <= kstTodayStr;

  const visibleActiveChs = [...activeChs]
    .sort((a, b) => Number(needsTodayCheck(b)) - Number(needsTodayCheck(a)))   // 오늘 할 일 우선
    .slice(0, HOME_ACTIVE_LIMIT);

  // 🚀 완주 리본 노출 규칙 ('하다 인연들의 하루' 피드):
  //   ① 내 완주 제외 — 내 완주는 '오늘, 나의 하다'·내 하다 탭에서 보임. 이 피드는 '하다 인연(타인)의 하루'.
  //   ② 완주 공유일 +1일까지만 — 오늘·어제 완주분만. 옛 완주가 며칠씩 박혀있던 문제 해소(오늘 KST 자정 −24h 기준).
  const completionCutoffMs = Date.parse(getKstTodayRange().startUtc) - 24 * 60 * 60 * 1000;
  const visibleCompletions = completions.filter(
    c => c.user_id !== myUserId && Date.parse(c.created_at) >= completionCutoffMs,
  );

  // 🚀 미인증 챌린지 (인증 의무 있는 것만 — count형·cheered 응원자·시작 전 모집 기간 방은 제외)
  const uncheckedChs = activeChs.filter(needsTodayCheck);

  // 🚀 오늘 할 일 앵커 = 가장 시급한(종료 임박) 미인증 1개. 나머지 진행중은 아래 압축 리스트로.
  const anchorCh = [...uncheckedChs].sort((a, b) => a.end_date.localeCompare(b.end_date))[0] ?? null;
  const restActiveChs = visibleActiveChs.filter(c => c.id !== anchorCh?.id);

  // 🚀 오늘 동료 인증을 챌린지별로 묶음 — 새 인증이 옛 인증을 홈에서 밀어내던 문제 해소 (그룹 + 인라인 더보기)
  //    todayProofs 는 최신순 → Map 삽입 순서가 곧 그룹 최신순, 그룹 내부도 최신순
  const todayProofGroups = React.useMemo(() => {
    const map = new Map<string, FellowProof[]>();
    for (const p of todayProofs) {
      const arr = map.get(p.challenge_id);
      if (arr) arr.push(p);
      else map.set(p.challenge_id, [p]);
    }
    return Array.from(map.values()).map(proofs => ({
      challengeId: proofs[0].challenge_id,
      title: proofs[0].challenge_title,
      proofs,
    }));
  }, [todayProofs]);
  const [checkinPickerOpen, setCheckinPickerOpen] = useState(false);

  // 오늘 인증 액션 — 0개면 완료 안내, 1개면 즉시 인증, 여러 개면 선택 모달
  const onCheckinAction = () => {
    haptic.tap();
    if (totalCount === 0) {
      router.push('/create' as any);
      return;
    }
    if (uncheckedChs.length === 0) {
      Alert.alert('오늘 인증 완료', '오늘 몫의 인증을 모두 마쳤어요.\n내일 또 만나요!');
      return;
    }
    if (uncheckedChs.length === 1) {
      router.push(`/checkin/${uncheckedChs[0].id}` as any);
      return;
    }
    setCheckinPickerOpen(true);
  };

  return (
    <Screen backgroundColor={colors.bg}>
      <AppHeader />

      {/* 🚀 홈 페이지 제목 — 다른 탭(내하다·구경·기록 24px)과 위계 통일 + 무게감(밋밋함 보완) */}
      <View style={styles.intro}>
        <Text style={styles.introTitle}>오늘, 나의 하다</Text>
        <Text style={styles.introSub}>하다 인연들과 함께</Text>
      </View>

      {loading ? (
        <View style={styles.list}>
          <ChallengeCardSkeleton />
          <ChallengeCardSkeleton />
        </View>
      ) : error ? (
        <ErrorState message={error} onRetry={() => { setLoading(true); load(); }} />
      ) : (
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={styles.scroll}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />
          }
          showsVerticalScrollIndicator={false}
        >
          {/* 🔭 하다 구경 — 최상단 얇은 바 1곳으로 통일 (DESIGN_GUIDE §12) */}
          <Pressable
            style={styles.peekBar}
            onPress={() => { haptic.tap(); router.push('/discover' as any); }}
            accessibilityRole="button"
            accessibilityLabel="하다 구경 — 남들은 무슨 하다 하나"
          >
            <Telescope size={18} color={colors.brand} strokeWidth={2} />
            <Text style={styles.peekBarText}>남들 하다, 구경</Text>
            <ChevronRight size={18} color={colors.brand} strokeWidth={2} />
          </Pressable>

          {isColdStart ? (
            /* 🚀 콜드스타트(도전 0개): 빈 카드 스택 → 살아있는 온램프 한 장 + 합류 우선 + 접힌 힌트 */
            <>
              {/* 온램프 카드 — ① 첫 걸음(선언) ② 둘러보고 합류 */}
              <View style={styles.onrampCard}>
                <Text style={styles.onrampTitle}>오늘, 첫 걸음을 떼어볼까요?</Text>
                <Text style={styles.onrampSub}>선언하면 지인들이 응원으로 함께해요.</Text>
                <Pressable
                  style={styles.onrampPrimaryBtn}
                  onPress={() => { haptic.tap(); router.push('/create?kind=cheered' as any); }}
                >
                  <PenLine size={16} color={colors.surface} strokeWidth={2} />
                  <Text style={styles.onrampPrimaryText}>첫 하다 선언하기</Text>
                </Pressable>
                <Pressable
                  style={styles.onrampSecondaryBtn}
                  onPress={() => { haptic.tap(); router.push('/discover' as any); }}
                >
                  <Telescope size={15} color={colors.accent700} strokeWidth={1.8} />
                  <Text style={styles.onrampSecondaryText}>하다 구경 — 이런 것도 하는구나</Text>
                </Pressable>
              </View>

              {/* 함께 합류하기 — 신규에게 '즉시 동료가 생기는' 길 (선언·구경과 균형, 제거 안 함) */}
              <View>
                <Text style={styles.sectionLabel}>함께 합류하기 (누구나 합류)</Text>
                {openChs.length > 0 ? (
                  openChs.slice(0, 5).map(c => (
                    <JoinCard key={c.id} challenge={c} onJoin={handleJoinChallenge} />
                  ))
                ) : (
                  <View style={styles.emptyOpenCard}>
                    <Globe size={40} color={colors.faint} strokeWidth={1.5} />
                    <Text style={styles.emptyOpenTitle}>현재 합류 가능한 공개 하다가 없어요</Text>
                    <Text style={styles.emptyOpenDesc}>
                      직접 새로운 공개 하다를 개설하여 첫 번째 동료들을 모집해 볼까요?
                    </Text>
                  </View>
                )}
              </View>

              {/* 오늘, 하다 인연들의 하루 — 실데이터(완주·동료 인증)가 있으면 그대로 노출 (절대 숨기지 않음) */}
              {(visibleCompletions.length > 0 || todayProofs.length > 0) && (
                <>
                  <Text style={styles.sectionLabel}>오늘, 하다 인연들의 하루</Text>
                  {visibleCompletions.map(c => (
                    <CompletionRibbon key={c.id} story={c} />
                  ))}
                  {todayProofGroups.map(g => (
                    <TodayChallengeProofGroup
                      key={g.challengeId}
                      title={g.title}
                      proofs={g.proofs}
                      onViewPhoto={(photos, index) => setViewer({ photos, index })}
                    />
                  ))}
                </>
              )}

              {/* 오늘, 응원으로 힘주기 — 응원 중인 방이 있으면 그대로 노출 */}
              {cheeredRooms.length > 0 && (
                <>
                  <Text style={styles.sectionLabel}>오늘, 응원으로 힘주기</Text>
                  {cheeredRooms.slice(0, 5).map(c => (
                    <CheeredCard key={c.id} challenge={c} />
                  ))}
                </>
              )}

              {/* 관심 분야 추천은 '하다 구경'으로 통합(DESIGN_GUIDE §12) — 홈 별도 섹션 제거 */}

              {/* 접힌 힌트 한 줄 — '동료의 하루'가 비었을 때만 (실데이터 있으면 위에서 노출되므로 생략) */}
              {visibleCompletions.length === 0 && todayProofs.length === 0 && (
                <View style={styles.onrampHint}>
                  <Text style={styles.onrampHintText}>도전을 시작하면 동료들의 하루가 여기 채워져요</Text>
                  <Text style={styles.onrampHintChevron}>›</Text>
                </View>
              )}

              {/* 🌙 끝 마커 — 무한 스크롤 의도적 차단 */}
              <View style={styles.endMarker}>
                <Moon size={28} color={colors.faint2} strokeWidth={1.5} />
                <Text style={styles.endLine1}>오늘은 여기까지예요.</Text>
                <Text style={styles.endLine2}>내일 또, 한 걸음.</Text>
              </View>
              <View style={styles.homeSign}>
                <Image source={require('../../assets/images/icon.png')} style={styles.homeSignIcon} resizeMode="contain" />
              </View>
            </>
          ) : (
          <>
          {/* [구조 1] 오늘, 나의 하다 — 페이지 제목(히어로)이 이 섹션을 대표하므로 라벨 중복 제거 */}
          {activeChs.length > 0 ? (
            <View style={styles.myChallengeList}>
              {anchorCh ? (
                <TodayAnchor challenge={anchorCh} todayStr={todayStr} />
              ) : (
                <View style={styles.allDoneCard}>
                  <Text style={styles.allDoneTitle}>오늘 할 일을 다 했어요</Text>
                  <Text style={styles.allDoneSub}>내일 또, 한 걸음.</Text>
                </View>
              )}
              {restActiveChs.map(c => {
                const ddayText = getChallengeDDay(c.start_date, c.end_date);
                let km = KIND_META[c.kind] ?? KIND_META.solo;
                if (c.kind === 'cheered') {
                  km = c.creator_id === myUserId ? KIND_META.cheered_creator : KIND_META.cheered_participant;
                }
                // 🚀 cheered(응원받기) = 도전자 1명만 인증, 나머지는 응원 동료.
                // 다함께처럼 '동료 N/N 완료'·'인증' 버튼을 보이면 안 됨 (정체성 분리).
                const isCheeredParticipant = c.kind === 'cheered' && c.creator_id !== myUserId;
                const isCheeredCreator     = c.kind === 'cheered' && c.creator_id === myUserId;
                return (
                  <View key={c.id} style={styles.myChallengeCard}>
                    <Pressable
                      style={styles.myChallengeInfo}
                      onPress={() => { haptic.tap(); router.push(`/room/${c.id}` as any); }}
                    >
                      <Text style={styles.myChallengeTitle} numberOfLines={1}>{displayTitle(c.title)}</Text>
                      <View style={styles.myChallengeMetaRow}>
                        {/* 1. 개설/참여 역할 뱃지 */}
                        <View style={[
                          styles.metaBadge,
                          { backgroundColor: c.creator_id === myUserId ? colors.accent50 : colors.primary50 }
                        ]}>
                          {c.creator_id === myUserId
                            ? <Crown size={11} color={colors.accent700} strokeWidth={2} />
                            : <Users size={11} color={colors.primary500} strokeWidth={2} />}
                          <Text style={[
                            styles.metaBadgeText,
                            { color: c.creator_id === myUserId ? colors.accent700 : colors.primary500 }
                          ]}>
                            {c.creator_id === myUserId ? '개설' : '참여'}
                          </Text>
                        </View>

                        {/* 2. 기존 방 종류 뱃지 */}
                        <View style={[styles.metaBadge, { backgroundColor: km.bg }]}>
                          <km.Icon size={11} color={km.text} strokeWidth={2} />
                          <Text style={[styles.metaBadgeText, { color: km.text }]}>{km.label}</Text>
                        </View>
                        <View style={styles.metaBadge}>
                          <Text style={styles.metaBadgeText}>{ddayText}</Text>
                        </View>
                        {/* 💛 다짐 배지 — 이 방에 다짐 있으면. 탭 시 방 현황 탭으로(다짐 내용은 방에서) */}
                        {pledgeChIds.has(c.id) && (
                          <Pressable
                            style={[styles.metaBadge, { backgroundColor: colors.accent50 }]}
                            onPress={(e) => { e.stopPropagation(); haptic.tap(); router.push(`/room/${c.id}?tab=status` as any); }}
                            hitSlop={6}
                          >
                            <Heart size={11} color={colors.accent700} strokeWidth={2} />
                            <Text style={[styles.metaBadgeText, { color: colors.accent700 }]}>다짐</Text>
                          </Pressable>
                        )}
                        {isCountGoal(c) ? (
                          <View style={styles.metaBadge}>
                            <Target size={11} color={colors.primary500} strokeWidth={2} />
                            <Text style={styles.metaBadgeText}>진행 {c.my_proof_count}/{c.target_count ?? 0}</Text>
                          </View>
                        ) : isCheeredParticipant ? (
                          // 응원 동료 — 인증 진척이 아니라 '도전자 응원' 이 할 일
                          <View style={styles.metaBadge}>
                            <Heart size={11} color={colors.primary500} strokeWidth={2} />
                            <Text style={styles.metaBadgeText}>도전자 응원하기</Text>
                          </View>
                        ) : isCheeredCreator ? (
                          // 도전자 — 응원받는 무대. '동료 완료' 대신 받은 응원을 강조
                          <View style={styles.metaBadge}>
                            <Heart size={11} color={colors.primary500} strokeWidth={2} />
                            <Text style={styles.metaBadgeText}>
                              {c.my_cheers_count > 0 ? `받은 응원 ${formatCheerCount(c.my_cheers_count)}개` : '응원 기다리는 중'}
                            </Text>
                          </View>
                        ) : c.kind !== 'solo' ? (
                          <View style={styles.metaBadge}>
                            <Users size={11} color={colors.primary500} strokeWidth={2} />
                            <Text style={styles.metaBadgeText}>동료 {c.today_check_count}/{c.member_count} 완료</Text>
                          </View>
                        ) : null}
                        {/* 🔁 0050: 내 하다가 '하다 구경'에서 따라하기로 참조된 횟수 (조용한 목격받기) */}
                        {(c.reference_count ?? 0) > 0 && (
                          <View style={styles.metaBadge}>
                            <Repeat size={11} color={colors.primary500} strokeWidth={2} />
                            <Text style={styles.metaBadgeText}>{formatCheerCount(c.reference_count ?? 0)}번 참조</Text>
                          </View>
                        )}
                      </View>
                    </Pressable>
                    {isCheeredParticipant ? (
                      // 응원 동료는 인증하지 않음 — '인증' 대신 '응원' (방에서 응원)
                      <Pressable
                        style={[styles.quickCheckinBtn, styles.quickCheerBtn]}
                        onPress={() => { haptic.tap(); router.push(`/room/${c.id}` as any); }}
                      >
                        <Heart size={14} color={colors.surface} strokeWidth={2} />
                        <Text style={styles.quickCheckinBtnText}>응원</Text>
                      </Pressable>
                    ) : isCountGoal(c) ? (
                      goalDone(c) ? (
                        <View style={styles.quickCheckedBadge}>
                          <Check size={14} color={colors.done} strokeWidth={2.4} />
                          <Text style={styles.quickCheckedText}>달성</Text>
                        </View>
                      ) : (
                        <Pressable
                          style={styles.quickCheckinBtn}
                          onPress={() => { haptic.tap(); router.push(`/room/${c.id}` as any); }}
                        >
                          <Text style={styles.quickCheckinBtnText}>인증 추가</Text>
                        </Pressable>
                      )
                    ) : c.is_today_checked ? (
                      <View style={styles.quickCheckedBadge}>
                        <Check size={14} color={colors.done} strokeWidth={2.4} />
                        <Text style={styles.quickCheckedText}>완료</Text>
                      </View>
                    ) : (
                      <Pressable
                        style={styles.quickCheckinBtn}
                        onPress={() => { haptic.tap(); router.push(`/room/${c.id}` as any); }}
                      >
                        <Text style={styles.quickCheckinBtnText}>인증</Text>
                      </Pressable>
                    )}
                  </View>
                );
              })}
              {/* 상한 초과분은 내도전 탭으로 — 홈 스크롤 폭증 방지 */}
              {activeChs.length > HOME_ACTIVE_LIMIT && (
                <Pressable
                  style={styles.moreLink}
                  onPress={() => { haptic.tap(); router.push('/(tabs)/my-challenges' as any); }}
                >
                  <Text style={styles.moreLinkText}>내 하다 {activeChs.length}개 모두 보기 →</Text>
                </Pressable>
              )}
            </View>
          ) : (
            /* 빈 상태 카드 — 본인 도전 0개 */
            <Pressable
              style={styles.emptyCard}
              onPress={() => { haptic.tap(); router.push('/create?kind=cheered' as any); }}
            >
              <Sprout size={44} color={colors.faint} strokeWidth={1.5} />
              <Text style={styles.emptyTitle}>아직 진행 중인 하다가 없어요</Text>
              <Text style={styles.emptyDesc}>
                조용히 응원받는 첫 한 걸음,{'\n'}시작해볼까요?
              </Text>
              <View style={styles.emptyCtaBox}>
                <Text style={styles.emptyCtaText}>+ 첫 하다 선언하기</Text>
              </View>
            </Pressable>
          )}

          {/* [구조 2] 오늘, 도전 인연들의 하루 섹션 */}
          <Text style={styles.sectionLabel}>오늘, 하다 인연들의 하루</Text>
          {visibleCompletions.length > 0 || todayProofs.length > 0 ? (
            <>
              {/* 1. 🎉 완주 리본 — 최근 공개 완주 이야기 */}
              {visibleCompletions.map(c => (
                <CompletionRibbon key={c.id} story={c} />
              ))}
              {/* 2. 📸 오늘의 인증 — 챌린지별 묶음 + 인라인 더보기 (옛 인증이 밀려 안 보이던 문제 해소) */}
              {todayProofGroups.map(g => (
                <TodayChallengeProofGroup
                  key={g.challengeId}
                  title={g.title}
                  proofs={g.proofs}
                  onViewPhoto={(photos, index) => setViewer({ photos, index })}
                />
              ))}
            </>
          ) : (
            /* 빈 상태 카드 — 동료 소식 없음 */
            <View style={styles.emptyFellowCard}>
              <Footprints size={40} color={colors.faint} strokeWidth={1.5} />
              <Text style={styles.emptyFellowTitle}>아직 오늘 올라온 동료들의 인증이 없어요</Text>
              <Text style={styles.emptyFellowDesc}>
                혼자보다 함께할 때 완주 확률이 3배 높아집니다. 내 하다에 친구나 동료를 초대해 보거나, 아래 '누구나 합류'에서 함께 달릴 첫 하다 인연을 만들어보세요!
              </Text>
            </View>
          )}

          {/* [구조 4] 오늘, 응원으로 힘주기 섹션 */}
          <Text style={styles.sectionLabel}>오늘, 응원으로 힘주기</Text>
          {cheeredRooms.length > 0 ? (
            cheeredRooms.slice(0, 5).map(c => (
              <CheeredCard key={c.id} challenge={c} />
            ))
          ) : (
            /* 빈 상태 카드 — 응원받기 챌린지 없음 */
            <View style={styles.emptyCheerCard}>
              <Heart size={40} color={colors.faint} strokeWidth={1.5} />
              <Text style={styles.emptyCheerTitle}>오늘 응원할 수 있는 하다가 없어요</Text>
              <Text style={styles.emptyCheerDesc}>
                현재 가입된 응원받기 하다가 없거나, 이미 모든 동료들에게 오늘 자 응원을 완료했습니다.
              </Text>
            </View>
          )}

          {/* [구조 3] 함께 합류하기 섹션 */}
          <Text style={styles.sectionLabel}>함께 합류하기 (누구나 합류)</Text>
          {openChs.length > 0 ? (
            openChs.slice(0, 5).map(c => (
              <JoinCard key={c.id} challenge={c} onJoin={handleJoinChallenge} />
            ))
          ) : (
            /* 빈 상태 카드 — 공개 챌린지 없음 */
            <View style={styles.emptyOpenCard}>
              <Globe size={40} color={colors.faint} strokeWidth={1.5} />
              <Text style={styles.emptyOpenTitle}>현재 합류 가능한 공개 하다가 없어요</Text>
              <Text style={styles.emptyOpenDesc}>
                직접 새로운 공개 하다를 개설하여 첫 번째 동료들을 모집해 볼까요?
              </Text>
            </View>
          )}

          {/* 관심 분야 추천은 '하다 구경'(최상단 바)으로 통합 — 홈 별도 섹션·하단 진입점 제거 (DESIGN_GUIDE §12) */}

          {/* 🌙 끝 마커 — 무한 스크롤 의도적 차단 */}
          <View style={styles.endMarker}>
            <Moon size={28} color={colors.faint2} strokeWidth={1.5} />
            <Text style={styles.endLine1}>오늘은 여기까지예요.</Text>
            <Text style={styles.endLine2}>내일 또, 한 걸음.</Text>
          </View>
          <View style={styles.homeSign}>
            <Image source={require('../../assets/images/icon.png')} style={styles.homeSignIcon} resizeMode="contain" />
          </View>
          </>
          )}
        </ScrollView>
      )}

      <PhotoViewer photos={viewer?.photos ?? null} initialIndex={viewer?.index ?? 0} onClose={() => setViewer(null)} />

      {/* 🚀 미인증 챌린지 선택 모달 — 인증할 도전이 여러 개일 때 */}
      <Modal
        visible={checkinPickerOpen}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setCheckinPickerOpen(false)}
      >
        <Pressable style={styles.pickerOverlay} onPress={() => setCheckinPickerOpen(false)}>
          <Pressable style={styles.pickerCard} onPress={() => {}}>
            <Text style={styles.pickerTitle}>어떤 하다를 인증할까요?</Text>
            <View style={{ gap: 8 }}>
              {uncheckedChs.map(c => (
                <Pressable
                  key={c.id}
                  style={styles.pickerRow}
                  onPress={() => {
                    haptic.tap();
                    setCheckinPickerOpen(false);
                    router.push(`/checkin/${c.id}` as any);
                  }}
                >
                  <Text style={styles.pickerRowTitle} numberOfLines={1}>{displayTitle(c.title)}</Text>
                  <Text style={styles.pickerRowArrow}>→</Text>
                </Pressable>
              ))}
            </View>
            <Pressable
              style={styles.pickerCancel}
              onPress={() => { haptic.tap(); setCheckinPickerOpen(false); }}
            >
              <Text style={styles.pickerCancelText}>다음에 할게요</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {/* 🌍 누구나 합류 — 안내문 미리보기 후 합류 결정 */}
      <OpenJoinPreviewSheet
        challenge={previewCard}
        joining={joiningPreview}
        onClose={() => setPreviewCard(null)}
        onConfirm={() => { if (previewCard) doJoin(previewCard.id); }}
      />
    </Screen>
  );
}

// ─── 오늘 할 일 앵커 — 가장 시급한 미인증 1개 (tintWarm + 오렌지 CTA) ───
function TodayAnchor({ challenge: c, todayStr }: { challenge: MyChallengeDetail; todayStr: string }) {
  const km = c.kind === 'cheered' ? KIND_META.cheered_creator : (KIND_META[c.kind] ?? KIND_META.solo);
  const ddayText = getChallengeDDay(c.start_date, c.end_date);
  const startMs = Date.parse(c.start_date + 'T00:00:00');
  const endMs = Date.parse(c.end_date + 'T00:00:00');
  const nowMs = Date.parse(todayStr + 'T00:00:00');
  const totalDays = Math.max(1, Math.round((endMs - startMs) / 86400000) + 1);
  const elapsedDays = Math.min(totalDays, Math.max(1, Math.round((nowMs - startMs) / 86400000) + 1));
  const pct = Math.min(100, Math.max(0, Math.round((elapsedDays / totalDays) * 100)));
  return (
    <Pressable style={styles.anchor} onPress={() => { haptic.tap(); router.push(`/room/${c.id}` as any); }}>
      <Text style={styles.anchorKind}>{km.label} · {ddayText}</Text>
      <Text style={styles.anchorTitle} numberOfLines={2}>{displayTitle(c.title)}</Text>
      <Text style={styles.anchorMeta}>{elapsedDays}/{totalDays}일째</Text>
      <View style={styles.anchorBar}><View style={[styles.anchorBarFill, { width: `${pct}%` }]} /></View>
      <Pressable
        style={styles.anchorCta}
        onPress={() => { haptic.tap(); router.push(`/checkin/${c.id}` as any); }}
      >
        <Camera size={19} color={colors.onBrand} strokeWidth={2} />
        <Text style={styles.anchorCtaText}>오늘 인증하기</Text>
      </Pressable>
    </Pressable>
  );
}

// ─── 카드 1: 🎉 완주 리본 ─────────────────────────────────
function CompletionRibbon({ story }: { story: CompletionStoryCard }) {
  return (
    <Pressable
      style={styles.ribbon}
      onPress={() => { haptic.tap(); router.push(`/done/${story.id}` as any); }}
    >
      <PartyPopper size={22} color={colors.accent} strokeWidth={1.8} />
      <View style={{ flex: 1 }}>
        <Text style={styles.ribbonTitle}>
          {story.author.nickname}님이 <Text style={{ color: colors.accent700 }}>
            {story.total_days}일</Text>을 완주했어요
        </Text>
        <Text style={styles.ribbonMeta} numberOfLines={1}>
          {displayTitle(story.challenge.title)} · 박제 보러가기 →
        </Text>
      </View>
    </Pressable>
  );
}

// ─── 카드 2 묶음: 📸 오늘의 인증 (챌린지별 + 인라인 더보기) ──────
function TodayChallengeProofGroup({
  title, proofs, onViewPhoto,
}: {
  title: string;
  proofs: FellowProof[];
  onViewPhoto: (photos: string[], index: number) => void;
}) {
  const INITIAL = 2;   // 기본 노출 개수, 나머지는 '더 보기'로 펼침
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? proofs : proofs.slice(0, INITIAL);
  const hidden = proofs.length - INITIAL;
  return (
    <View style={styles.proofGroup}>
      <View style={styles.proofGroupHead}>
        <Camera size={14} color={colors.primary700} strokeWidth={2} />
        <Text style={styles.proofGroupHeadText} numberOfLines={1}>
          {displayTitle(title)} · 오늘 {proofs.length}명 인증
        </Text>
      </View>
      {visible.map(p => (
        <TodayProofCard key={p.id} proof={p} onViewPhoto={onViewPhoto} />
      ))}
      {hidden > 0 && (
        <Pressable style={styles.moreToggle} onPress={() => { haptic.tap(); setExpanded(e => !e); }}>
          {expanded
            ? <ChevronUp size={15} color={colors.primary700} strokeWidth={2} />
            : <ChevronDown size={15} color={colors.primary700} strokeWidth={2} />}
          <Text style={styles.moreToggleText}>
            {expanded ? '접기' : `${hidden}명 더 보기`}
          </Text>
        </Pressable>
      )}
    </View>
  );
}

// ─── 카드 2: 📸 오늘의 인증 ───────────────────────────────
function TodayProofCard({ proof, onViewPhoto }: { proof: FellowProof; onViewPhoto: (photos: string[], index: number) => void }) {
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
      </View>
      {(() => {
        // 🚀 0045: 사진 여러 장 — 카드 좌우 스와이프 + 탭하면 전체화면. 연속 메달은 우상단.
        const photos = proof.photo_urls?.length ? proof.photo_urls : [proof.photo_url];
        const m = streakMilestone(proof.streak_count);
        return (
          <PhotoCarousel
            photos={photos}
            aspectRatio={16 / 10}
            borderRadius={radius.md}
            onPressPhoto={(i) => onViewPhoto(photos, i)}
            topRight={m ? <StreakMedal day={m.day} color={m.color} /> : undefined}
          />
        );
      })()}
      {proof.caption && (
        <Text style={styles.caption} numberOfLines={2}>{proof.caption}</Text>
      )}
      <Text style={styles.cheerHint}>하다 인연들이 응원했어요 →</Text>
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
        <View style={styles.cardKindEmoji}>
          <CategoryIcon slug={categorySlugByName[challenge.category_name ?? '']} size={22} color={colors.accent} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.who} numberOfLines={1}>{displayTitle(challenge.title)}</Text>
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

// ─── 카드 5: 🌍 누구나 합류 ────────────────────────────────
function JoinCard({ challenge, onJoin }: { challenge: OpenChallengeCard; onJoin: (id: string) => void }) {
  return (
    <Pressable
      style={styles.card}
      onPress={() => { haptic.tap(); router.push(`/room/${challenge.id}` as any); }}
    >
      <View style={styles.cardHead}>
        <View style={styles.cardKindEmoji}>
          <CategoryIcon slug={categorySlugByName[challenge.category?.name ?? '']} size={22} color={colors.done} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.who} numberOfLines={1}>{displayTitle(challenge.title)}</Text>
          <Text style={styles.sub}>
            누구나 합류 · 함께 {challenge.member_count}명
          </Text>
        </View>
      </View>
      {challenge.description && (
        <Text style={styles.caption} numberOfLines={2}>"{challenge.description}"</Text>
      )}
      <Pressable
        style={styles.joinBtn}
        onPress={(e) => {
          e.stopPropagation(); // 카드 전체 클릭 이벤트 전파 차단
          haptic.tap();
          onJoin(challenge.id);
        }}
      >
        <Text style={styles.joinBtnText}>함께 합류하기</Text>
      </Pressable>
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

  // 🚀 홈 페이지 제목 (다른 탭 24px 제목과 위계 통일)
  intro: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 4 },
  introTitle: { ...textStyle.greeting, color: colors.ink, letterSpacing: -0.5 },
  introSub: { fontSize: fontSize.sm, color: colors.faint, fontFamily: fontFamily.regular, marginTop: 3 },

  // 🔭 하다 구경 — 최상단 얇은 바
  peekBar: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: 20, marginTop: 12, marginBottom: 8,
    paddingVertical: 13, paddingHorizontal: 16,
    backgroundColor: colors.brandTint,
    borderRadius: radius.pill,
    borderWidth: 1, borderColor: colors.brand,
    ...shadow.sm,
  },
  peekBarText: { flex: 1, fontSize: fontSize.base, color: colors.brandInk, fontFamily: fontFamily.bold, fontWeight: fontWeight.bold },

  // 로고 서명 (홈 맨 아래, 헤더에서 뺀 로고의 정착지) — 앱 아이콘 로고
  homeSign: { alignItems: 'center', marginTop: 28 },
  homeSignIcon: { width: 40, height: 40, borderRadius: 10 },

  // 오늘 할 일 앵커 (tintWarm + 오렌지 CTA, 화면당 1 그림자)
  anchor: {
    marginHorizontal: 16, backgroundColor: colors.tintWarm,
    borderRadius: radius['2xl'], padding: 20,
    shadowColor: colors.brand, shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.10, shadowRadius: 18, elevation: 3,
  },
  anchorKind: { fontSize: fontSize.sm, color: colors.brandInk, fontFamily: fontFamily.medium, fontWeight: fontWeight.medium, marginBottom: 8 },
  anchorTitle: { fontSize: fontSize.xl, color: colors.ink, fontFamily: fontFamily.bold, fontWeight: fontWeight.bold, lineHeight: 24 },
  anchorMeta: { fontSize: fontSize.sm, color: colors.sub, fontFamily: fontFamily.regular, marginTop: 10 },
  anchorBar: { height: 7, backgroundColor: colors.tintCreamLine, borderRadius: radius.pill, overflow: 'hidden', marginTop: 12 },
  anchorBarFill: { height: '100%', backgroundColor: colors.brand, borderRadius: radius.pill },
  anchorCta: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7,
    height: 50, borderRadius: radius.pill, backgroundColor: colors.brand, marginTop: 16,
  },
  anchorCtaText: { fontSize: fontSize.md, color: colors.onBrand, fontFamily: fontFamily.bold, fontWeight: fontWeight.bold },

  // 오늘 다 했어요 (세이지)
  allDoneCard: { marginHorizontal: 16, backgroundColor: colors.doneTint, borderRadius: radius['2xl'], padding: 20, alignItems: 'center', gap: 4 },
  allDoneTitle: { fontSize: fontSize.lg, color: colors.doneInk, fontFamily: fontFamily.bold, fontWeight: fontWeight.bold },
  allDoneSub: { fontSize: fontSize.sm, color: colors.sub, fontFamily: fontFamily.regular },

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
  myChallengeList: {
    marginHorizontal: 16,
    marginTop: 16,
    gap: 10,
  },
  myChallengeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: 16,
    ...shadow.sm,
    borderWidth: 1,
    borderColor: colors.primary50,
  },
  myChallengeInfo: {
    flex: 1,
    marginRight: 12,
    gap: 6,
  },
  myChallengeTitle: {
    fontSize: fontSize.base,
    color: colors.primary,
    fontFamily: fontFamily.bold,
    fontWeight: fontWeight.bold,
    letterSpacing: -0.2,
  },
  myChallengeMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  metaBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: colors.primary50,
    borderRadius: radius.pill,
  },
  metaBadgeText: {
    fontSize: 10,
    color: colors.primary500,
    fontFamily: fontFamily.bold,
    fontWeight: fontWeight.bold,
  },
  quickCheckinBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: colors.accent,
    borderRadius: radius.pill,
    ...shadow.sm,
  },
  quickCheckinBtnText: {
    fontSize: fontSize.xs,
    color: colors.surface,
    fontFamily: fontFamily.bold,
    fontWeight: fontWeight.bold,
  },
  quickCheerBtn: { backgroundColor: colors.accent700 },   // 응원받기 동료용 — 인증(주황)과 구분


  quickCheckedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: colors.primary50,
    borderRadius: radius.pill,
  },
  quickCheckedText: {
    fontSize: fontSize.xs,
    color: colors.primary500,
    fontFamily: fontFamily.bold,
    fontWeight: fontWeight.bold,
  },

  // 섹션 라벨
  sectionLabel: {
    paddingHorizontal: 20, paddingTop: 24, paddingBottom: 10,
    fontSize: fontSize.base, color: colors.ink,
    fontFamily: fontFamily.bold, fontWeight: fontWeight.bold,
    letterSpacing: -0.3,
  },
  sectionSubLabel: {
    fontSize: fontSize.sm, color: colors.primary500,
    fontFamily: fontFamily.regular, fontWeight: fontWeight.regular,
  },

  // 도전 인연 빈 상태 카드
  emptyFellowCard: {
    marginHorizontal: 16,
    marginBottom: 14,
    backgroundColor: '#F5F8FC',
    borderRadius: radius.xl,
    paddingVertical: 24,
    paddingHorizontal: 20,
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: '#E1EBF5',
    borderStyle: 'dashed',
  },
  emptyFellowTitle: {
    fontSize: fontSize.base,
    color: colors.primary,
    fontFamily: fontFamily.bold,
    fontWeight: fontWeight.bold,
  },
  emptyFellowDesc: {
    fontSize: fontSize.xs,
    color: colors.primary500,
    fontFamily: fontFamily.regular,
    textAlign: 'center',
    lineHeight: 18,
  },

  // 누구나 합류 빈 상태 카드
  emptyOpenCard: {
    marginHorizontal: 16,
    marginBottom: 14,
    backgroundColor: '#F0FBF5',
    borderRadius: radius.xl,
    paddingVertical: 24,
    paddingHorizontal: 20,
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: '#D2F3E2',
    borderStyle: 'dashed',
  },
  emptyOpenTitle: {
    fontSize: fontSize.base,
    color: colors.primary,
    fontFamily: fontFamily.bold,
    fontWeight: fontWeight.bold,
  },
  emptyOpenDesc: {
    fontSize: fontSize.xs,
    color: colors.primary500,
    fontFamily: fontFamily.regular,
    textAlign: 'center',
    lineHeight: 18,
  },

  // 응원 빈 상태 카드
  emptyCheerCard: {
    marginHorizontal: 16,
    marginBottom: 14,
    backgroundColor: '#FFFBEB',
    borderRadius: radius.xl,
    paddingVertical: 24,
    paddingHorizontal: 20,
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: '#FEF3C7',
    borderStyle: 'dashed',
  },
  emptyCheerTitle: {
    fontSize: fontSize.base,
    color: colors.primary,
    fontFamily: fontFamily.bold,
    fontWeight: fontWeight.bold,
  },
  emptyCheerDesc: {
    fontSize: fontSize.xs,
    color: colors.primary500,
    fontFamily: fontFamily.regular,
    textAlign: 'center',
    lineHeight: 18,
  },

  // 관심 추천 빈 상태 카드
  // 조용한 마커
  quietMarker: {
    alignItems: 'center',
    paddingTop: 16,
    paddingBottom: 8,
    gap: 4,
  },
  quietEmoji: {
    fontSize: 24,
    marginBottom: 2,
  },
  quietText: {
    fontSize: fontSize.xs,
    color: colors.primary500,
    fontFamily: fontFamily.medium,
    fontWeight: fontWeight.semibold,
  },
  quietSubText: {
    fontSize: 11,
    color: colors.primary500,
    fontFamily: fontFamily.regular,
  },

  // 빈 상태
  emptyCard: {
    marginHorizontal: 20, marginTop: 16,
    backgroundColor: '#FFF9F5',
    borderRadius: radius.xl,
    paddingVertical: 32, paddingHorizontal: 24,
    alignItems: 'center', gap: 8,
    borderWidth: 1, borderColor: '#FFE5D9',
    borderStyle: 'dashed',
  },
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
  cardKindEmoji: { width: 28, alignItems: 'center' },
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
  streakMedalWrap: { position: 'absolute', top: 10, right: 10 },
  caption: {
    fontSize: fontSize.sm, color: colors.primary,
    fontFamily: fontFamily.regular, lineHeight: 20,
  },
  cheerHint: {
    fontSize: fontSize.xs, color: colors.primary500,
    fontFamily: fontFamily.regular,
  },

  // 오늘의 인증 — 챌린지별 묶음 + 더보기
  proofGroup: { marginBottom: 6 },
  proofGroupHead: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    marginHorizontal: 16, marginTop: 2, marginBottom: 4,
  },
  proofGroupHeadText: {
    flex: 1,
    fontSize: fontSize.sm, color: colors.primary700,
    fontFamily: fontFamily.bold, fontWeight: fontWeight.bold,
  },
  moreToggle: {
    marginHorizontal: 16, marginBottom: 10,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5,
    paddingVertical: 8,
    backgroundColor: colors.primary50, borderRadius: radius.lg,
  },
  moreToggleText: {
    fontSize: fontSize.sm, color: colors.primary700,
    fontFamily: fontFamily.medium, fontWeight: fontWeight.medium,
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
  endLine1: {
    fontSize: fontSize.sm, color: colors.primary500,
    fontFamily: fontFamily.bold, fontWeight: fontWeight.semibold,
  },
  endLine2: {
    fontSize: fontSize.xs, color: colors.primary500,
    fontFamily: fontFamily.regular,
  },

  // 홈 섹션 상한 초과 시 "모두 보기" 링크
  moreLink: {
    alignItems: 'center',
    paddingVertical: 12,
    backgroundColor: colors.primary50,
    borderRadius: radius.lg,
  },
  moreLinkText: {
    fontSize: fontSize.sm,
    color: colors.primary700,
    fontFamily: fontFamily.bold,
    fontWeight: fontWeight.semibold,
  },

  // 🚀 미인증 챌린지 선택 모달
  pickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  pickerCard: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: 20,
    gap: 14,
    ...shadow.lg,
  },
  pickerTitle: {
    fontSize: fontSize.lg,
    color: colors.primary,
    fontFamily: fontFamily.bold,
    fontWeight: fontWeight.bold,
    textAlign: 'center',
  },
  pickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 14,
    paddingHorizontal: 14,
    backgroundColor: colors.primary50,
    borderRadius: radius.md,
  },
  pickerRowTitle: {
    flex: 1,
    fontSize: fontSize.base,
    color: colors.primary,
    fontFamily: fontFamily.bold,
    fontWeight: fontWeight.semibold,
  },
  pickerRowArrow: {
    fontSize: fontSize.lg,
    color: colors.accent,
    fontFamily: fontFamily.bold,
    fontWeight: fontWeight.bold,
  },
  pickerCancel: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  pickerCancelText: {
    fontSize: fontSize.sm,
    color: colors.primary500,
    fontFamily: fontFamily.medium,
  },

  // 🚀 콜드스타트 온램프 카드 (accent50 + accent 보더, 디자인 토큰 내)
  onrampCard: {
    marginHorizontal: 20, marginTop: 16,
    paddingVertical: 24, paddingHorizontal: 20,
    backgroundColor: colors.accent50,
    borderRadius: radius.xl,
    borderWidth: 1, borderColor: colors.accent,
    gap: 8,
  },
  onrampTitle: {
    fontSize: fontSize.lg, color: colors.primary,
    fontFamily: fontFamily.bold, fontWeight: fontWeight.bold,
    textAlign: 'center', letterSpacing: -0.3,
  },
  onrampSub: {
    fontSize: fontSize.sm, color: colors.primary500,
    fontFamily: fontFamily.regular,
    textAlign: 'center', lineHeight: 20, marginBottom: 8,
  },
  onrampPrimaryBtn: {
    width: '100%', paddingVertical: 14,
    backgroundColor: colors.accent,
    borderRadius: radius.pill,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
  },
  onrampPrimaryText: {
    fontSize: fontSize.base, color: colors.surface,
    fontFamily: fontFamily.bold, fontWeight: fontWeight.bold,
  },
  onrampSecondaryBtn: {
    width: '100%', paddingVertical: 14, marginTop: 8,
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    borderWidth: 1.5, borderColor: colors.accent,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
  },
  onrampSecondaryText: {
    fontSize: fontSize.base, color: colors.accent700,
    fontFamily: fontFamily.bold, fontWeight: fontWeight.bold,
  },
  onrampHint: {
    marginHorizontal: 20, marginTop: 20,
    paddingVertical: 14, paddingHorizontal: 16,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: colors.primary50,
    borderRadius: radius.lg,
  },
  onrampHintText: {
    fontSize: fontSize.sm, color: colors.primary500,
    fontFamily: fontFamily.medium, fontWeight: fontWeight.medium,
  },
  onrampHintChevron: {
    fontSize: fontSize.base, color: colors.primary300,
    fontFamily: fontFamily.bold, fontWeight: fontWeight.bold,
  },
});
