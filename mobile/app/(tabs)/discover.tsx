// 🚀 광장 (IA 개편 2단계) — "아직 인연이 아닌 하다"를 모아 보는 탭.
//   ① 🏛️ 무대 (명사·조직이 연 하다, 상설) ② 🌍 지금 합류할 수 있는 하다 (누구나)
//   ③ 🔭 하다 구경 (익명 발상 라이브러리, 0050) — 개설자·참여자 신원을 지운 익명 카드.
//      제목·내용·인증방식·타입·4평가·참조수만 정형화 노출. 목적 = 탐색이 아니라 '참조'
//      (살펴보고 → 평가하고 → 따라하기). 카드 탭으로 방에 들어가지 않음(익명 보존).
//   세 섹션 모두 최신순 고정 — 참여자 수·인기 정렬 금지(비교/줄세우기 금지).
import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  View, Text, Pressable, FlatList, StyleSheet, RefreshControl, Alert, ScrollView, Image, Linking,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Telescope, User, Handshake, Globe, Heart, type LucideIcon } from 'lucide-react-native';
import { Screen } from '@/components/Screen';
import { AppHeader } from '@/components/AppHeader';
import { EvalBox } from '@/components/EvalBox';
import { CategoryIcon } from '@/components/CategoryIcon';
import { HostBadge } from '@/components/HostBadge';
import { OpenJoinPreviewSheet } from '@/components/home/OpenJoinPreviewSheet';
import { ChallengeCardSkeleton } from '@/components/Skeleton';
import { ErrorState } from '@/components/ErrorState';
import { colors, fontFamily, fontSize, fontWeight, radius, textStyle, shadow } from '@/lib/tokens';
import { categorySlugByName } from '@/lib/icons';
import { useSession } from '@/lib/session';
import {
  fetchBrowseChallenges, toggleChallengeVote, fetchMyInterests,
  fetchOpenChallenges, fetchStageChallenges,
} from '@/lib/db';
import { joinChallenge } from '@/lib/invite';
import { isRecruiting } from '@/lib/stats';   // 🚀 무대 카드의 모집 마감 표시
import { SUPPORT_EMAIL } from '@/lib/support';
import { formatCheerCount, displayTitle } from '@/lib/format';
import { reportError } from '@/lib/sentry';
import { haptic } from '@/lib/haptics';
import type { BrowseChallengeCard, ChallengeVoteType, OpenChallengeCard } from '@/lib/types';

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

// '내 관심' 필터 키 — categoryFilter 가 분류명이 아니라 이 값일 때, 내 정보에 등록한 관심 대분류만 노출
const INTEREST_FILTER_KEY = '__my_interests__';

// 🚀 광장 목록 노출 개수: 처음 3개만 보여주고 '더 보기'로 3개씩 펼친다
//   (광장은 무대 → 누구나 합류 → 구경 3단 구성 — 한 섹션이 길어지면 나머지가 묻힌다)
//   무대(명사·조직) · 지금 합류할 수 있는 하다 · 하다 구경 네 목록이 같은 상수를 쓴다.
const BROWSE_INITIAL_COUNT = 3;
const BROWSE_STEP_COUNT = 3;

export default function DiscoverScreen() {
  const session = useSession();
  const myUserId = session?.user?.id;
  const [items, setItems] = useState<BrowseChallengeCard[]>([]);
  // 🏛️ 무대 — 명사·조직이 연 하다 (최신순). 🌍 누구나 합류 — 지금 합류 가능한 하다 (최신순)
  const [stageItems, setStageItems] = useState<OpenChallengeCard[]>([]);
  const [openItems, setOpenItems] = useState<OpenChallengeCard[]>([]);
  // 합류 전 안내문 미리보기 시트 대상 (null = 닫힘) — 무대·누구나 공용
  const [previewCard, setPreviewCard] = useState<OpenChallengeCard | null>(null);
  const [joining, setJoining] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // 카테고리 필터 — 로드된 목록에 존재하는 분류만 칩으로 (null = 전체, INTEREST_FILTER_KEY = 내 관심)
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  // 내 정보(프로필)에 등록한 관심 대분류 id 집합 — '내 관심' 필터용
  const [myInterestIds, setMyInterestIds] = useState<Set<number>>(new Set());
  // 하다 구경에서 지금 보여줄 개수 — '더 보기'로만 늘어난다
  const [visibleCount, setVisibleCount] = useState(BROWSE_INITIAL_COUNT);
  // '지금 합류할 수 있는 하다'도 같은 방식 — 상한 없이 전부 나열되면 아래 하다 구경이 묻힌다
  const [joinVisibleCount, setJoinVisibleCount] = useState(BROWSE_INITIAL_COUNT);
  // 무대도 명사·조직 각각 3개씩 — 무대가 늘어도 아래 두 섹션이 밀리지 않게
  const [figureVisibleCount, setFigureVisibleCount] = useState(BROWSE_INITIAL_COUNT);
  const [orgVisibleCount, setOrgVisibleCount] = useState(BROWSE_INITIAL_COUNT);
  // 사용자가 칩을 직접 만졌는지 — 만진 뒤로는 '내 관심' 기본값을 다시 씌우지 않는다
  const filterTouched = useRef(false);

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const c of items) if (c.category) set.add(c.category.name);
    return Array.from(set);
  }, [items]);

  const filteredItems = useMemo(() => {
    // '내 관심' = 내가 등록한 관심 대분류에 속한 하다만
    if (categoryFilter === INTEREST_FILTER_KEY) {
      return items.filter(c => c.category_id != null && myInterestIds.has(c.category_id));
    }
    return categoryFilter ? items.filter(c => c.category?.name === categoryFilter) : items;
  }, [items, categoryFilter, myInterestIds]);

  // 지금 화면에 그릴 만큼만 잘라낸다 (전체 개수는 '더 보기' 판단에 filteredItems 로 유지)
  const visibleItems = useMemo(
    () => filteredItems.slice(0, visibleCount),
    [filteredItems, visibleCount],
  );

  // 🚀 필터 변경 — 칩 3종(전체/내 관심/분류)이 공유. 필터가 바뀌면 노출 개수도 처음 3개로 되돌린다
  const changeFilter = useCallback((next: string | null) => {
    haptic.tap();
    filterTouched.current = true;
    setCategoryFilter(next);
    setVisibleCount(BROWSE_INITIAL_COUNT);
  }, []);

  // 🚀 무대 2종 — ⭐명사 / 🏛️조직. 한쪽이 0개여도 자리를 지켜 "여기 열립니다"를 보여준다(상설)
  const figureItems = useMemo(() => stageItems.filter(c => c.host_tier === 'figure'), [stageItems]);
  const orgItems    = useMemo(() => stageItems.filter(c => c.host_tier === 'org'), [stageItems]);

  // 무대에 이미 올라온 하다는 '누구나 합류' 섹션에서 중복 제거
  const joinableItems = useMemo(() => {
    const stageIds = new Set(stageItems.map(c => c.id));
    return openItems.filter(c => !stageIds.has(c.id));
  }, [openItems, stageItems]);

  React.useEffect(() => {
    if (session === null) router.replace('/login');
  }, [session]);

  const load = useCallback(async () => {
    try {
      setError(null);
      // 세 섹션 + 내 관심 대분류를 병렬 로드 ('내 관심' 칩 필터용)
      // 무대·누구나 조회가 실패해도 하다 구경 목록은 막지 않는다 (개별 빈 배열 폴백)
      const [data, interests, stage, open] = await Promise.all([
        fetchBrowseChallenges(),
        myUserId ? fetchMyInterests(myUserId).catch(() => []) : Promise.resolve([]),
        fetchStageChallenges(myUserId).catch(() => []),
        fetchOpenChallenges(myUserId).catch(() => []),
      ]);
      setItems(data);
      const interestIds = new Set(interests.map(i => i.category_id));
      setMyInterestIds(interestIds);
      // 🚀 기본 필터 = '내 관심' (등록한 관심이 있을 때만).
      //   ⚠️ "첫 load 때 1회만" 으로 두면 안 된다 — 세션 복원 전에 load 가 먼저 돌면 myUserId 가
      //   없어 관심이 0개로 오고, 그 한 번으로 기본값 적용 기회가 영영 사라진다(전체로 고정).
      //   그래서 '사용자가 칩을 직접 만지기 전까지' 로 둔다 — 관심이 실제로 들어온 load 에서
      //   뒤늦게라도 적용되고, 사용자가 고른 칩은 여전히 덮어쓰지 않는다.
      if (!filterTouched.current && interestIds.size > 0) setCategoryFilter(INTEREST_FILTER_KEY);
      setStageItems(stage);
      setOpenItems(open);
    } catch (e: any) {
      reportError(e, { where: 'discover/fetchBrowseChallenges' });
      setError(e?.message ?? '하다 구경을 불러오지 못했어요.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [myUserId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = useCallback(() => { setRefreshing(true); load(); }, [load]);

  // 무대·누구나 카드 탭 — 바로 합류시키지 않고 안내문 미리보기 시트를 연다 (홈과 동일 동선)
  const openPreview = useCallback((c: OpenChallengeCard) => { haptic.tap(); setPreviewCard(c); }, []);

  const doJoin = useCallback(async () => {
    if (!myUserId || !previewCard || joining) return;
    try {
      setJoining(true);
      await joinChallenge(previewCard.id, myUserId);
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
      setJoining(false);
    }
  }, [myUserId, previewCard, joining, load]);

  // 무대 빈 상태 — 조직·명사 하다 제안 (운영팀 메일. 주소는 support.ts 단일 상수)
  const onProposeStage = useCallback(() => {
    haptic.tap();
    const subject = '[Do:하다] 우리 조직 하다 제안';
    const body = '안녕하세요, 운영팀.\n우리 조직(모임)의 하다를 무대에 열고 싶어요.\n\n· 조직(모임) 이름:\n· 열고 싶은 하다:\n· 담당자 연락처:\n';
    Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`)
      .catch(() => Alert.alert('제안하기', `메일 앱을 열 수 없어요. ${SUPPORT_EMAIL} 로 보내주세요.`));
  }, []);

  // 🚀 명사 무대 제안 — 조직 제안과 같은 결(운영팀 메일). "이런 분을 보고 싶다"는 수요 신호를 받는 자리
  const onProposeFigure = useCallback(() => {
    haptic.tap();
    const subject = '[Do:하다] 보고 싶은 명사 하다 제안';
    const body = '안녕하세요, 운영팀.\n이런 분의 하다를 무대에서 보고 싶어요.\n\n· 보고 싶은 분:\n· 함께하고 싶은 하다:\n';
    Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`)
      .catch(() => Alert.alert('제안하기', `메일 앱을 열 수 없어요. ${SUPPORT_EMAIL} 로 보내주세요.`));
  }, []);

  // 🚀 무대 카드 탭 — 모집이 닫힌 무대는 미리보기로 보내지 않는다. 합류 버튼까지 갔다가 거부당하는
  //   막다른 길이 된다(방 비멤버 FAB(v2.12)와 같은 '회색 비활성 + 안내' 결). 명사·조직 무대가 공유.
  const onStagePress = useCallback((c: OpenChallengeCard) => {
    if (!isRecruiting(c)) {
      haptic.warning();
      Alert.alert('모집 마감', '지금은 새로 합류할 수 없는 무대예요. 다음 무대를 기다려주세요.');
      return;
    }
    openPreview(c);
  }, [openPreview]);

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
        <Text style={styles.subTitle}>광장</Text>
        <Text style={styles.subCaption}>아직 만나지 못한 하다</Text>
      </View>

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
          data={visibleItems}
          keyExtractor={c => c.id}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brand} />
          }
          // 무대 · 누구나 합류 두 섹션은 헤더로 얹는다 (ScrollView 중첩 없이 리스트 가상화 유지)
          ListHeaderComponent={
            <View>
              {/* ① 🏛️ 무대 — 명사·조직이 연 하다. 명사/조직 각 자리는 0개여도 지킨다(상설) */}
              <Text style={styles.sectionLabel}>🏛️ 무대</Text>
              <Text style={styles.sectionHint}>명사와 조직이 여는 하다</Text>

              {/* ⭐ 명사의 하다 */}
              <Text style={styles.stageSubLabel}>⭐ 명사의 하다</Text>
              {figureItems.length > 0 ? (
                <>
                  {figureItems.slice(0, figureVisibleCount).map(c => (
                    <StageCard key={c.id} challenge={c} onPress={() => onStagePress(c)} />
                  ))}
                  {figureItems.length > figureVisibleCount && (
                    <Pressable
                      style={styles.moreBtn}
                      onPress={() => { haptic.tap(); setFigureVisibleCount(v => v + BROWSE_STEP_COUNT); }}
                    >
                      <Text style={styles.moreBtnText}>더 보기 ({figureItems.length - figureVisibleCount}개 남음)</Text>
                    </Pressable>
                  )}
                </>
              ) : (
                <View style={styles.stageEmpty}>
                  <Text style={styles.stageEmptyTitle}>아직 열린 명사의 하다가 없어요</Text>
                  <Text style={styles.stageEmptyText}>명사가 여는 하다가 여기 열립니다</Text>
                  <Pressable style={styles.proposeBtn} onPress={onProposeFigure}>
                    <Text style={styles.proposeBtnText}>보고 싶은 명사 제안하기</Text>
                  </Pressable>
                </View>
              )}

              {/* 🏛️ 조직의 하다 */}
              <Text style={styles.stageSubLabel}>🏛️ 조직의 하다</Text>
              {orgItems.length > 0 ? (
                <>
                  {orgItems.slice(0, orgVisibleCount).map(c => (
                    <StageCard key={c.id} challenge={c} onPress={() => onStagePress(c)} />
                  ))}
                  {orgItems.length > orgVisibleCount && (
                    <Pressable
                      style={styles.moreBtn}
                      onPress={() => { haptic.tap(); setOrgVisibleCount(v => v + BROWSE_STEP_COUNT); }}
                    >
                      <Text style={styles.moreBtnText}>더 보기 ({orgItems.length - orgVisibleCount}개 남음)</Text>
                    </Pressable>
                  )}
                </>
              ) : (
                <View style={styles.stageEmpty}>
                  <Text style={styles.stageEmptyTitle}>아직 열린 조직의 하다가 없어요</Text>
                  <Text style={styles.stageEmptyText}>조직과 모임이 여는 하다가 여기 열립니다</Text>
                  <Pressable style={styles.proposeBtn} onPress={onProposeStage}>
                    <Text style={styles.proposeBtnText}>우리 조직 하다 제안하기</Text>
                  </Pressable>
                </View>
              )}

              {/* ② 🌍 지금 합류할 수 있는 하다 (누구나) */}
              <Text style={[styles.sectionLabel, styles.sectionGap]}>🌍 지금 합류할 수 있는 하다</Text>
              {joinableItems.length > 0 ? (
                <>
                  {joinableItems.slice(0, joinVisibleCount).map(c => (
                    <JoinCard key={c.id} challenge={c} onJoin={() => openPreview(c)} />
                  ))}
                  {joinableItems.length > joinVisibleCount && (
                    <Pressable
                      style={styles.moreBtn}
                      onPress={() => { haptic.tap(); setJoinVisibleCount(v => v + BROWSE_STEP_COUNT); }}
                    >
                      <Text style={styles.moreBtnText}>더 보기 ({joinableItems.length - joinVisibleCount}개 남음)</Text>
                    </Pressable>
                  )}
                </>
              ) : (
                <Text style={styles.sectionEmptyText}>지금 합류할 수 있는 하다가 없어요. 곧 새 하다가 열려요.</Text>
              )}

              {/* ③ 🔭 하다 구경 — 익명 발상 라이브러리 (기존 목록·칩·4평가·따라하기 유지) */}
              <Text style={[styles.sectionLabel, styles.sectionGap]}>🔭 하다 구경</Text>

              {/* 안내 — 탐색이 아니라 '참조' 톤 */}
              <View style={styles.curationInfo}>
                <Telescope size={18} color={colors.brandInk} strokeWidth={1.8} />
                <Text style={styles.curationText}>
                  남들은 무슨 하다 하나 — <Text style={styles.curationStrong}>살펴보고 따라해 보세요</Text>
                </Text>
              </View>

              {/* 🚀 관심 미등록 안내 — 목록을 대체하지 않는다(아래에 전체 최신 하다가 그대로 보인다) */}
              {myInterestIds.size === 0 && (
                <View style={styles.interestNudge}>
                  <Text style={styles.interestNudgeTitle}>관심 분류를 정해보세요</Text>
                  <Text style={styles.interestNudgeText}>내 관심 분야의 하다를 먼저 보여드려요.</Text>
                  <Pressable
                    style={styles.interestNudgeBtn}
                    onPress={() => { haptic.tap(); router.push('/(tabs)/profile?interests=1' as any); }}
                  >
                    <Text style={styles.interestNudgeBtnText}>관심 정하기</Text>
                  </Pressable>
                </View>
              )}

              {/* 카테고리 필터 칩 — 전체 / 내 관심 / 목록에 있는 분류만 */}
              {(categories.length > 1 || (myInterestIds.size > 0 && items.length > 0)) && (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.filterRow}
                  contentContainerStyle={styles.filterRowInner}
                >
                  <Pressable
                    style={[styles.filterChip, !categoryFilter && styles.filterChipActive]}
                    onPress={() => changeFilter(null)}
                  >
                    <Text style={[styles.filterChipText, !categoryFilter && styles.filterChipTextActive]}>전체</Text>
                  </Pressable>
                  {/* 내 관심 — '전체' 다음, 기존 칩과 동일한 텍스트 버튼 (등록한 관심이 있을 때만) */}
                  {myInterestIds.size > 0 && (
                    <Pressable
                      style={[styles.filterChip, categoryFilter === INTEREST_FILTER_KEY && styles.filterChipActive]}
                      onPress={() => changeFilter(categoryFilter === INTEREST_FILTER_KEY ? null : INTEREST_FILTER_KEY)}
                    >
                      <Text style={[styles.filterChipText, categoryFilter === INTEREST_FILTER_KEY && styles.filterChipTextActive]}>내 관심</Text>
                    </Pressable>
                  )}
                  {categories.map(name => {
                    const active = categoryFilter === name;
                    return (
                      <Pressable
                        key={name}
                        style={[styles.filterChip, active && styles.filterChipActive]}
                        onPress={() => changeFilter(active ? null : name)}
                      >
                        <CategoryIcon slug={categorySlugByName[name]} size={14} color={active ? colors.brandInk : colors.sub} />
                        <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>{name}</Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              )}
            </View>
          }
          renderItem={({ item }) => (
            <BrowseCard challenge={item} onVote={(t) => onVote(item.id, t)} onCopy={() => onCopy(item)} />
          )}
          // 남은 하다는 '더 보기'로만 펼친다 (다 펼치면 조건이 거짓이 되어 버튼이 저절로 사라짐)
          ListFooterComponent={
            filteredItems.length > visibleCount ? (
              <Pressable
                style={styles.moreBtn}
                onPress={() => { haptic.tap(); setVisibleCount(v => v + BROWSE_STEP_COUNT); }}
              >
                <Text style={styles.moreBtnText}>더 보기 ({filteredItems.length - visibleCount}개 남음)</Text>
              </Pressable>
            ) : null
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Telescope size={48} color={colors.faint} strokeWidth={1.5} />
              <Text style={styles.emptyText}>
                {categoryFilter === INTEREST_FILTER_KEY
                  ? '내 관심 분류의 하다가 아직 없어요.'
                  : categoryFilter
                  ? `${categoryFilter} 분류의 하다가 아직 없어요.`
                  : '아직 살펴볼 하다가 없어요.'}
              </Text>
              {/* 필터 때문에 0개면 막다른 길이라 탈출구를 준다 (정말 하나도 없으면 띄우지 않음) */}
              {categoryFilter && (
                <Pressable style={styles.moreBtn} onPress={() => changeFilter(null)}>
                  <Text style={styles.moreBtnText}>전체 보기</Text>
                </Pressable>
              )}
            </View>
          }
        />
      )}

      {/* 무대·누구나 합류 공용 — 안내문 미리보기 후 합류 결정 */}
      <OpenJoinPreviewSheet
        challenge={previewCard}
        joining={joining}
        onClose={() => setPreviewCard(null)}
        onConfirm={doJoin}
      />
    </Screen>
  );
}

// ─── 🏛️ 무대 카드 — 명사·조직이 연 하다 (신원 공개가 전제인 별개 데이터) ───
function StageCard({ challenge, onPress }: { challenge: OpenChallengeCard; onPress: () => void }) {
  return (
    <Pressable style={[styles.card, styles.headerCard]} onPress={onPress}>
      <HostBadge hostTier={challenge.host_tier} hostLabel={challenge.host_label} />
      <Text style={styles.cardTitle} numberOfLines={2}>{displayTitle(challenge.title)}</Text>
      {challenge.description ? (
        <Text style={styles.cardDesc} numberOfLines={2}>{challenge.description}</Text>
      ) : null}
      <Text style={styles.metaText}>
        {challenge.category ? `${challenge.category.name} · ` : ''}함께 {formatCheerCount(challenge.member_count)}명
      </Text>
      {/* 🚀 모집이 닫힌 무대는 정직하게 밝힌다 — 개설자가 손수 잠갔거나 기간이 지난 경우.
          '종료'가 아니라 '모집 마감'이다: 기존 멤버의 인증·기록·대화는 그대로 이어진다. */}
      {!isRecruiting(challenge) && (
        <View style={styles.stageClosedChip}>
          <Text style={styles.stageClosedText}>모집 마감</Text>
        </View>
      )}
    </Pressable>
  );
}

// ─── 🌍 누구나 합류 카드 ───
function JoinCard({ challenge, onJoin }: { challenge: OpenChallengeCard; onJoin: () => void }) {
  return (
    <Pressable style={[styles.card, styles.headerCard]} onPress={onJoin}>
      <View style={styles.cardHeader}>
        <View style={[styles.typeBadge, { backgroundColor: colors.done }]}>
          <Globe size={12} color={colors.onBrand} strokeWidth={2.2} />
          <Text style={styles.typeBadgeText}>누구나</Text>
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
        <Text style={styles.cardDesc} numberOfLines={2}>{challenge.description}</Text>
      ) : null}
      <Text style={styles.metaText}>함께 {formatCheerCount(challenge.member_count)}명</Text>
      <View style={styles.cardFooter}>
        <View style={{ flex: 1 }} />
        <Pressable style={styles.copyBtn} onPress={onJoin} hitSlop={4}>
          <Text style={styles.copyBtnText}>함께 합류하기</Text>
        </Pressable>
      </View>
    </Pressable>
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
  subCaption: { fontSize: fontSize.sm, color: colors.faint, fontFamily: fontFamily.regular, marginTop: 3 },

  // 섹션 (무대 / 누구나 합류 / 하다 구경) — 리스트 헤더 안이라 좌우 여백은 list 가 담당
  sectionLabel: { fontSize: fontSize.lg, color: colors.ink, fontFamily: fontFamily.bold, fontWeight: fontWeight.bold },
  sectionHint: { fontSize: fontSize.xs, color: colors.faint, fontFamily: fontFamily.regular, marginTop: 2, marginBottom: 10 },
  sectionGap: { marginTop: 28, marginBottom: 10 },
  sectionEmptyText: {
    fontSize: fontSize.sm, color: colors.faint, fontFamily: fontFamily.regular,
    lineHeight: 20, paddingVertical: 8,
  },
  headerCard: { marginBottom: 12 },
  stageClosedChip: {
    alignSelf: 'flex-start', marginTop: 8,
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: radius.pill, backgroundColor: colors.primary50,
  },
  stageClosedText: {
    fontSize: fontSize.xs, color: colors.primary500,
    fontFamily: fontFamily.bold, fontWeight: fontWeight.bold,
    includeFontPadding: false,
  },

  // 무대 하위 라벨 (⭐명사 / 🏛️조직) — 섹션 라벨보다 한 단 낮은 위계
  stageSubLabel: {
    marginTop: 16, marginBottom: 8,
    fontSize: fontSize.sm, color: colors.sub,
    fontFamily: fontFamily.bold, fontWeight: fontWeight.bold,
    includeFontPadding: false,
  },

  // 무대 빈 상태 — 0개여도 숨기지 않고 "여기 열립니다"를 보여준다 (상설 자리)
  stageEmpty: {
    alignItems: 'center', gap: 8,
    paddingHorizontal: 20, paddingVertical: 24,
    borderRadius: radius.xl, borderWidth: 1, borderColor: colors.tintSageLine,
    backgroundColor: colors.tintSage,
  },
  stageEmptyTitle: { fontSize: fontSize.base, color: colors.ink, fontFamily: fontFamily.bold, fontWeight: fontWeight.bold },
  stageEmptyText: { fontSize: fontSize.sm, color: colors.sub, fontFamily: fontFamily.regular, textAlign: 'center', lineHeight: 20 },
  proposeBtn: {
    marginTop: 6, minHeight: 40, justifyContent: 'center',
    paddingHorizontal: 18, paddingVertical: 10,
    borderRadius: radius.pill, backgroundColor: colors.surface,
    borderWidth: 1, borderColor: colors.done,
  },
  proposeBtnText: {
    fontSize: fontSize.sm, includeFontPadding: false,
    color: colors.doneInk, fontFamily: fontFamily.bold, fontWeight: fontWeight.bold,
  },

  curationInfo: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginBottom: 12,
    paddingHorizontal: 14, paddingVertical: 10,
    backgroundColor: colors.brandTint, borderRadius: radius.md,
  },
  curationText: { flex: 1, fontSize: fontSize.sm, color: colors.sub, fontFamily: fontFamily.regular },
  curationStrong: { color: colors.brandInk, fontFamily: fontFamily.bold, fontWeight: fontWeight.bold },

  // 관심 미등록 안내 — 무대 빈 상태(초록)와 구분되게 하다 구경 톤(브랜드)
  interestNudge: {
    alignItems: 'center', gap: 6,
    marginBottom: 12,
    paddingHorizontal: 20, paddingVertical: 18,
    borderRadius: radius.xl, borderWidth: 1, borderColor: colors.brandTint,
    backgroundColor: colors.brandTint,
  },
  interestNudgeTitle: { fontSize: fontSize.base, color: colors.ink, fontFamily: fontFamily.bold, fontWeight: fontWeight.bold },
  interestNudgeText: { fontSize: fontSize.sm, color: colors.sub, fontFamily: fontFamily.regular, textAlign: 'center', lineHeight: 20 },
  interestNudgeBtn: {
    marginTop: 6, minHeight: 40, justifyContent: 'center',
    paddingHorizontal: 18, paddingVertical: 10,
    borderRadius: radius.pill, backgroundColor: colors.surface,
    borderWidth: 1, borderColor: colors.brand,
  },
  interestNudgeBtnText: {
    fontSize: fontSize.sm, includeFontPadding: false,
    color: colors.brandInk, fontFamily: fontFamily.bold, fontWeight: fontWeight.bold,
  },

  // 더 보기 / 전체 보기 — 가운데 정렬 pill (하다 구경 목록 하단·빈 상태 공용)
  moreBtn: {
    alignSelf: 'center', minHeight: 44, justifyContent: 'center',
    marginTop: 4,
    paddingHorizontal: 22, paddingVertical: 12,
    borderRadius: radius.pill, backgroundColor: colors.surface,
    borderWidth: 1, borderColor: colors.brand,
  },
  moreBtnText: {
    fontSize: fontSize.sm, includeFontPadding: false,
    color: colors.brandInk, fontFamily: fontFamily.bold, fontWeight: fontWeight.bold,
  },

  // 칩 높이를 lineHeight+height 로 결정화 (이모지·기기 무관, 갤S9 잘림 방지)
  filterRow: { flexGrow: 0, minHeight: 48, marginBottom: 8 },
  filterRowInner: { gap: 8, alignItems: 'center' },
  filterChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.lineSoft,
    borderWidth: 1, borderColor: 'transparent',
  },
  filterChipActive: { backgroundColor: colors.brandTint, borderColor: colors.brand },
  filterChipText: {
    // 🚀 갤S9 재발픽스: 고정 lineHeight 제거 — 시스템 글자 크기를 키우면 fontSize 는 배율만큼
    //   커지는데 고정 lineHeight(18)는 안 커져 글자 하단이 잘렸다. 자연 줄높이로 두면 박스가
    //   배율을 따라와 잘리지 않는다. 하드 클립하던 filterRow.height(48)→minHeight 와 짝.
    fontSize: fontSize.sm, includeFontPadding: false,
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
