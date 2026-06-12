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
import { colors, fontFamily, fontSize, fontWeight, radius, shadow } from '@/lib/tokens';
import { useSession } from '@/lib/session';
import {
  fetchMyChallengesWithDetails, fetchOpenChallenges, fetchInterestingOpenChallenges,
  fetchPublicCompletionStories, fetchFellowProofs, giveUpMembership,
  type MyChallengeDetail, type InterestingChallenge,
  type FellowProof,
} from '@/lib/db';
import { ErrorState } from '@/components/ErrorState';
import { ChallengeCardSkeleton } from '@/components/Skeleton';
import { reportError } from '@/lib/sentry';
import { haptic } from '@/lib/haptics';
import type { CompletionStoryCard, OpenChallengeCard } from '@/lib/types';
import { getChallengeDDay, getKstTodayRange } from '@/lib/format';

// ─── 🚀 오늘 나의 도전용 헬퍼 및 메타 ─────────────────
const KIND_META: Record<string, { label: string; bg: string; text: string }> = {
  solo: { label: '🤫 나혼자', bg: colors.primary50, text: colors.primary500 },
  cheered_creator: { label: '🙋 응원받기', bg: colors.accent50, text: colors.accent700 },
  cheered_participant: { label: '🙋 응원하기', bg: colors.accent50, text: colors.accent700 },
  closed: { label: '🤝 다함께', bg: '#E0F2FE', text: '#0369A1' },
  open: { label: '🌍 누구나', bg: '#DCFCE7', text: '#15803D' },
};

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
        '참여 중인 도전',
        '이미 참여 중인 챌린지입니다. 챌린지방으로 이동하시겠습니까?',
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

    Alert.alert(
      '도전 합류',
      '정말 개설자와 함께 도전하시겠습니까?',
      [
        { text: '취소', style: 'cancel' },
        {
          text: '확인',
          onPress: async () => {
            try {
              setLoading(true);
              await joinChallenge(challengeId, myUserId);
              haptic.success();
              Alert.alert('합류 완료', '챌린지에 성공적으로 합류했습니다!');
              await load();
            } catch (err: any) {
              Alert.alert('합류 실패', err?.message ?? String(err));
            } finally {
              setLoading(false);
            }
          }
        }
      ]
    );
  };

  const load = useCallback(async () => {
    if (!myUserId) return;
    try {
      setError(null);
      const [mine, fellows, recentDone, interesting, opens] = await Promise.all([
        fetchMyChallengesWithDetails(myUserId),
        fetchFellowProofs(myUserId, 10),
        fetchPublicCompletionStories({ limit: 5 }).catch(() => []),
        fetchInterestingOpenChallenges(myUserId, 5).catch(() => []),
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
          '도전 종료',
          '개설자가 포기 선택하였습니다. 확인을 누르시면 내 챌린지에서 제거됩니다',
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
      }).slice(0, 5));
      
      // 🚀 클라이언트 단 더블 가드 필터링: 이미 가입하고 포기 안 한 내 챌린지 제외
      const myActiveChIds = new Set(mine.filter(c => c.gave_up_at === null).map(c => c.id));
      setInteresting(interesting.filter(c => !myActiveChIds.has(c.id)));
      setOpenChs(opens.filter(c => !myActiveChIds.has(c.id)));
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
  const cheeredRooms = myChs.filter(c => c.kind === 'cheered' && c.creator_id !== myUserId);

  // 🚀 P-⑤: 진행 중 vs 종료된 챌린지 분리 (KST 자정 기준).
  const todayStr = getKstTodayRange().kstDateStr;
  const activeChs   = myChs.filter(c => todayStr <= c.end_date);
  const finishedChs = myChs.filter(c => todayStr >  c.end_date);

  // 🚀 홈 노출 상한 — 참여 방이 많아도 홈 스크롤 폭증 방지 (전체는 내도전 탭에서)
  const HOME_ACTIVE_LIMIT = 5;
  const HOME_FINISHED_LIMIT = 3;
  const visibleActiveChs = [...activeChs]
    .sort((a, b) => Number(a.is_today_checked) - Number(b.is_today_checked))   // 미인증 먼저 (오늘 할 일 우선)
    .slice(0, HOME_ACTIVE_LIMIT);
  const visibleFinishedChs = finishedChs.slice(0, HOME_FINISHED_LIMIT);

  // 🚀 미인증 챌린지 (인증 의무 있는 것만 — cheered 응원자·시작 전 모집 기간 방은 제외)
  const kstTodayStr = getKstTodayRange().kstDateStr;
  const uncheckedChs = activeChs.filter(c =>
    !c.is_today_checked &&
    !(c.kind === 'cheered' && c.creator_id !== myUserId) &&
    c.start_date <= kstTodayStr,
  );
  const [checkinPickerOpen, setCheckinPickerOpen] = useState(false);

  // 오늘 인증 액션 — 0개면 완료 안내, 1개면 즉시 인증, 여러 개면 선택 모달
  const onCheckinAction = () => {
    haptic.tap();
    if (totalCount === 0) {
      router.push('/create' as any);
      return;
    }
    if (uncheckedChs.length === 0) {
      Alert.alert('오늘 인증 완료 🎉', '오늘 몫의 인증을 모두 마쳤어요.\n내일 또 만나요!');
      return;
    }
    if (uncheckedChs.length === 1) {
      router.push(`/checkin/${uncheckedChs[0].id}` as any);
      return;
    }
    setCheckinPickerOpen(true);
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
          {/* [구조 1] 오늘, 나의 도전 섹션 — 진행 중만 노출 */}
          <Text style={styles.sectionLabel}>오늘, 나의 도전</Text>
          {activeChs.length > 0 ? (
            <View style={styles.myChallengeList}>
              {visibleActiveChs.map(c => {
                const ddayText = getChallengeDDay(c.start_date, c.end_date);
                let km = KIND_META[c.kind] ?? KIND_META.solo;
                if (c.kind === 'cheered') {
                  km = c.creator_id === myUserId ? KIND_META.cheered_creator : KIND_META.cheered_participant;
                }
                return (
                  <View key={c.id} style={styles.myChallengeCard}>
                    <Pressable
                      style={styles.myChallengeInfo}
                      onPress={() => { haptic.tap(); router.push(`/room/${c.id}` as any); }}
                    >
                      <Text style={styles.myChallengeTitle} numberOfLines={1}>{c.title}</Text>
                      <View style={styles.myChallengeMetaRow}>
                        {/* 1. 개설/참여 역할 뱃지 */}
                        <View style={[
                          styles.metaBadge,
                          { backgroundColor: c.creator_id === myUserId ? colors.accent50 : colors.primary50 }
                        ]}>
                          <Text style={[
                            styles.metaBadgeText,
                            { color: c.creator_id === myUserId ? colors.accent700 : colors.primary500 }
                          ]}>
                            {c.creator_id === myUserId ? '👑 개설' : '👥 참여'}
                          </Text>
                        </View>

                        {/* 2. 기존 방 종류 뱃지 */}
                        <View style={[styles.metaBadge, { backgroundColor: km.bg }]}>
                          <Text style={[styles.metaBadgeText, { color: km.text }]}>{km.label}</Text>
                        </View>
                        <View style={styles.metaBadge}>
                          <Text style={styles.metaBadgeText}>{ddayText}</Text>
                        </View>
                        {c.kind !== 'solo' && (
                          <View style={styles.metaBadge}>
                            <Text style={styles.metaBadgeText}>👥 동료 {c.today_check_count}/{c.member_count} 완료</Text>
                          </View>
                        )}
                      </View>
                    </Pressable>
                    {c.is_today_checked ? (
                      <View style={styles.quickCheckedBadge}>
                        <Text style={styles.quickCheckedText}>✓ 완료</Text>
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
                  <Text style={styles.moreLinkText}>내 도전 {activeChs.length}개 모두 보기 →</Text>
                </Pressable>
              )}
            </View>
          ) : (
            /* 빈 상태 카드 — 본인 도전 0개 */
            <Pressable
              style={styles.emptyCard}
              onPress={() => { haptic.tap(); router.push('/create' as any); }}
            >
              <Text style={styles.emptyEmoji}>🌱</Text>
              <Text style={styles.emptyTitle}>아직 진행 중인 도전이 없어요</Text>
              <Text style={styles.emptyDesc}>
                조용히 응원받는 첫 한 걸음,{'\n'}시작해볼까요?
              </Text>
              <View style={styles.emptyCtaBox}>
                <Text style={styles.emptyCtaText}>+ 첫 도전 선언하기</Text>
              </View>
            </Pressable>
          )}

          {/* 🚀 P-⑤ 종료된 도전 분리 섹션 — 박제·회고용 */}
          {finishedChs.length > 0 && (
            <>
              <Text style={[styles.sectionLabel, { marginTop: 24 }]}>🏆 끝낸 도전</Text>
              <View style={styles.myChallengeList}>
                {visibleFinishedChs.map(c => (
                  <Pressable
                    key={c.id}
                    style={[styles.myChallengeCard, { opacity: 0.85 }]}
                    onPress={() => { haptic.tap(); router.push(`/room/${c.id}?tab=archive` as any); }}
                  >
                    <View style={styles.myChallengeInfo}>
                      <Text style={styles.myChallengeTitle} numberOfLines={1}>{c.title}</Text>
                      <View style={styles.myChallengeMetaRow}>
                        <View style={[styles.metaBadge, { backgroundColor: colors.primary100 }]}>
                          <Text style={[styles.metaBadgeText, { color: colors.primary700 }]}>
                            🏁 종료 · {c.start_date.slice(5)}~{c.end_date.slice(5)}
                          </Text>
                        </View>
                      </View>
                    </View>
                    <Text style={styles.quickCheckedText}>박제 →</Text>
                  </Pressable>
                ))}
                {finishedChs.length > HOME_FINISHED_LIMIT && (
                  <Pressable
                    style={styles.moreLink}
                    onPress={() => { haptic.tap(); router.push('/(tabs)/my-challenges' as any); }}
                  >
                    <Text style={styles.moreLinkText}>끝낸 도전 {finishedChs.length}개 모두 보기 →</Text>
                  </Pressable>
                )}
              </View>
            </>
          )}

          {/* [구조 2] 오늘, 도전 인연들의 하루 섹션 */}
          <Text style={styles.sectionLabel}>오늘, 도전 인연들의 하루</Text>
          {completions.length > 0 || todayProofs.length > 0 ? (
            <>
              {/* 1. 🎉 완주 리본 — 최근 공개 완주 이야기 */}
              {completions.map(c => (
                <CompletionRibbon key={c.id} story={c} />
              ))}
              {/* 2. 📸 오늘의 인증 — 동료 사진 카드 */}
              {todayProofs.map(p => (
                <TodayProofCard key={p.id} proof={p} />
              ))}
            </>
          ) : (
            /* 빈 상태 카드 — 동료 소식 없음 */
            <View style={styles.emptyFellowCard}>
              <Text style={styles.emptyFellowEmoji}>👣</Text>
              <Text style={styles.emptyFellowTitle}>아직 오늘 올라온 동료들의 인증이 없어요</Text>
              <Text style={styles.emptyFellowDesc}>
                혼자보다 함께할 때 완주 확률이 3배 높아집니다. 내 챌린지에 친구나 동료를 초대해 보거나, 아래 '누구나 합류'에서 함께 달릴 첫 도전 인연을 만들어보세요!
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
              <Text style={styles.emptyCheerEmoji}>🙋</Text>
              <Text style={styles.emptyCheerTitle}>오늘 응원할 수 있는 챌린지가 없어요</Text>
              <Text style={styles.emptyCheerDesc}>
                현재 가입된 응원받기 챌린지가 없거나, 이미 모든 동료들에게 오늘 자 응원을 완료했습니다.
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
              <Text style={styles.emptyOpenEmoji}>🌍</Text>
              <Text style={styles.emptyOpenTitle}>현재 합류 가능한 공개 챌린지가 없어요</Text>
              <Text style={styles.emptyOpenDesc}>
                직접 새로운 공개 챌린지를 개설하여 첫 번째 동료들을 모집해 볼까요?
              </Text>
            </View>
          )}

          {/* [구조 5] 내 관심 분야 도전 섹션 */}
          <Text style={styles.sectionLabel}>내 관심 분야 도전 (관심 추천)</Text>
          {interestingChs.length > 0 ? (
            interestingChs.slice(0, 5).map(c => (
              <InterestCard key={c.id} challenge={c} />
            ))
          ) : (
            /* 빈 상태 카드 — 관심사 매칭 챌린지 없음 */
            <View style={styles.emptyInterestCard}>
              <Text style={styles.emptyInterestEmoji}>✨</Text>
              <Text style={styles.emptyInterestTitle}>관심 분야의 추천 챌린지가 없어요</Text>
              <Text style={styles.emptyInterestDesc}>
                프로필 설정에서 관심 카테고리를 더 추가해 보시거나, 직접 나만의 멋진 관심 분야 챌린지를 개설해 보세요!
              </Text>
            </View>
          )}

          {/* 🌙 끝 마커 — 무한 스크롤 의도적 차단 */}
          <View style={styles.endMarker}>
            <Text style={styles.endMoon}>🌙</Text>
            <Text style={styles.endLine1}>오늘은 여기까지예요.</Text>
            <Text style={styles.endLine2}>내일 또, 한 걸음.</Text>
          </View>
        </ScrollView>
      )}

      {/* 🚀 미인증 챌린지 선택 모달 — 인증할 도전이 여러 개일 때 */}
      <Modal
        visible={checkinPickerOpen}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setCheckinPickerOpen(false)}
      >
        <Pressable style={styles.pickerOverlay} onPress={() => setCheckinPickerOpen(false)}>
          <Pressable style={styles.pickerCard} onPress={() => {}}>
            <Text style={styles.pickerTitle}>📸 어떤 도전을 인증할까요?</Text>
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
                  <Text style={styles.pickerRowTitle} numberOfLines={1}>{c.title}</Text>
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
              {/* 추론 매칭은 "관심 등록한 적 없는데?" 혼란 방지 — 매칭 이유를 정직하게 표기 */}
              {challenge.matched_by === 'explicit'
                ? `${challenge.matched_category.emoji} ${challenge.matched_category.name} 관심 · 함께 ${challenge.member_count}명`
                : `${challenge.matched_category.emoji} 내 도전과 같은 ${challenge.matched_category.name} 분야 · 함께 ${challenge.member_count}명`}
            </Text>
          )}
        </View>
      </View>
      <View style={[styles.joinBtn, { marginTop: 6 }]}>
        <Text style={styles.joinBtnText}>
          {challenge.matched_by === 'explicit' ? '관심 도전 살펴보기 →' : '비슷한 도전 살펴보기 →'}
        </Text>
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
    marginTop: 4,
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
  quickCheckedBadge: {
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
    fontSize: fontSize.lg, color: colors.primary,
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
  emptyFellowEmoji: {
    fontSize: 32,
    marginBottom: 2,
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
  emptyOpenEmoji: {
    fontSize: 32,
    marginBottom: 2,
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
  emptyCheerEmoji: {
    fontSize: 32,
    marginBottom: 2,
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
  emptyInterestCard: {
    marginHorizontal: 16,
    marginBottom: 14,
    backgroundColor: '#FAF5FF',
    borderRadius: radius.xl,
    paddingVertical: 24,
    paddingHorizontal: 20,
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: '#F3E8FF',
    borderStyle: 'dashed',
  },
  emptyInterestEmoji: {
    fontSize: 32,
    marginBottom: 2,
  },
  emptyInterestTitle: {
    fontSize: fontSize.base,
    color: colors.primary,
    fontFamily: fontFamily.bold,
    fontWeight: fontWeight.bold,
  },
  emptyInterestDesc: {
    fontSize: fontSize.xs,
    color: colors.primary500,
    fontFamily: fontFamily.regular,
    textAlign: 'center',
    lineHeight: 18,
  },

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
});
