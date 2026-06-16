// 🚀 내 도전 (v2.5) — 참여 중인 모든 챌린지 목록
// 홈은 도전 인연들의 하루 피드, 여기는 내 작업 공간 입구 — 방 진행률 + D-N.
import React, { useCallback, useState } from 'react';
import {
  View, Text, Pressable, FlatList, StyleSheet, RefreshControl,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Screen } from '@/components/Screen';
import { AppHeader } from '@/components/AppHeader';
import { colors, fontFamily, fontSize, fontWeight, radius, shadow } from '@/lib/tokens';
import { useSession } from '@/lib/session';
import { fetchMyChallenges, fetchMyGivenUpChallenges, type GivenUpChallenge } from '@/lib/db';
import { ErrorState } from '@/components/ErrorState';
import { ChallengeCardSkeleton } from '@/components/Skeleton';
import { reportError } from '@/lib/sentry';
import { haptic } from '@/lib/haptics';
import type { ChallengeWithCount } from '@/lib/types';
import { getKstTodayRange } from '@/lib/format';

export default function MyChallengesScreen() {
  const session = useSession();
  const myUserId = session?.user?.id;
  const [challenges, setChallenges] = useState<ChallengeWithCount[]>([]);
  const [gaveUpChs, setGaveUpChs] = useState<GivenUpChallenge[]>([]);   // 🚀 조용한 보관함 (v2.8)
  const [gaveUpOpen, setGaveUpOpen] = useState(false);                  // 기본 접힘 — 포기를 들이밀지 않기
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  React.useEffect(() => {
    if (session === null) router.replace('/login');
  }, [session]);

  const load = useCallback(async () => {
    if (!session) return;
    try {
      setError(null);
      const data = await fetchMyChallenges(session.user.id);
      setChallenges(data);
      // 보관함은 부가 정보 — 실패해도 메인 목록을 막지 않음
      fetchMyGivenUpChallenges(session.user.id).then(setGaveUpChs).catch(() => {});
    } catch (e: any) {
      reportError(e, { where: 'my-challenges/fetch' });
      setError(e?.message ?? '하다 목록을 불러오지 못했어요.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [session]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load();
  }, [load]);

  return (
    <Screen backgroundColor={colors.background}>
      <AppHeader />
      <View style={styles.subHeader}>
        <Text style={styles.subTitle}>🚩 내 하다</Text>
        <Text style={styles.subDesc}>
          {challenges.length === 0
            ? '아직 하다가 없어요. 하단 ⊕ 로 시작해볼까요?'
            : `함께 가고 있는 하다 ${challenges.length}개`}
        </Text>
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
        (() => {
          // 🚀 내가 하는 하다(나홀로·다함께·누구나·응원받기 개설자) vs 내가 응원하는 하다(응원하기로 들어간 cheered) 분리
          const isCheererRoom = (c: ChallengeWithCount) => c.kind === 'cheered' && c.creator_id !== myUserId;
          const doing    = challenges.filter(c => !isCheererRoom(c));
          const cheering = challenges.filter(c => isCheererRoom(c));
          // 🚀 P-⑤: 진행 중 vs 종료 분리 (KST 자정 기준) — '내가 하는 하다' 기준
          const todayStr = getKstTodayRange().kstDateStr;
          const active   = doing.filter(c => todayStr <= c.end_date);
          const finished = doing.filter(c => todayStr >  c.end_date);
          return (
            <FlatList
              data={active}
              keyExtractor={c => c.id}
              contentContainerStyle={styles.list}
              refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />
              }
              renderItem={({ item }) => <Card challenge={item} myUserId={myUserId} />}
              ListEmptyComponent={
                <View style={styles.empty}>
                  <Text style={styles.emptyEmoji}>🌱</Text>
                  <Text style={styles.emptyText}>
                    참여 중인 하다가 없어요.{'\n'}하단 + 로 첫 하다를 만들어볼까요?
                  </Text>
                </View>
              }
              ListFooterComponent={
                <>
                  {/* 💛 내가 응원하는 하다 — '내가 하는 하다'와 '끝낸 하다' 사이 (도전자 아닌 응원자 역할) */}
                  {cheering.length > 0 && (
                    <View style={{ marginTop: 24, gap: 12 }}>
                      <Text style={styles.footerSectionTitle}>💛 응원하는 하다</Text>
                      {cheering.map(item => {
                        const isFin = todayStr > item.end_date;
                        return (
                          <View key={item.id} style={isFin ? { opacity: 0.85 } : undefined}>
                            <Card challenge={item} myUserId={myUserId} finished={isFin} />
                          </View>
                        );
                      })}
                    </View>
                  )}

                  {finished.length > 0 && (
                    <View style={{ marginTop: 24, gap: 12 }}>
                      <Text style={{
                        fontSize: fontSize.base,
                        color: colors.primary,
                        fontFamily: fontFamily.bold,
                        fontWeight: fontWeight.bold,
                        paddingHorizontal: 4,
                      }}>
                        🏆 끝낸 하다
                      </Text>
                      {finished.map(item => (
                        <View key={item.id} style={{ opacity: 0.85 }}>
                          <Card challenge={item} myUserId={myUserId} finished />
                        </View>
                      ))}
                    </View>
                  )}

                  {/* 🕊️ 조용한 보관함 — 포기한 도전 (기본 접힘, 들이밀지 않기 / 열람은 읽기 전용) */}
                  {gaveUpChs.length > 0 && (
                    <View style={{ marginTop: 24, gap: 10 }}>
                      <Pressable
                        onPress={() => { haptic.tap(); setGaveUpOpen(o => !o); }}
                        hitSlop={6}
                        accessibilityRole="button"
                        accessibilityLabel={`지난 하다 ${gaveUpChs.length}개 ${gaveUpOpen ? '접기' : '펼치기'}`}
                      >
                        <Text style={styles.gaveUpToggle}>
                          🕊️ 지난 하다 {gaveUpChs.length}개 {gaveUpOpen ? '접기 ▲' : '보기 ▼'}
                        </Text>
                      </Pressable>
                      {gaveUpOpen && gaveUpChs.map(item => (
                        <Pressable
                          key={item.id}
                          style={styles.gaveUpCard}
                          onPress={() => { haptic.tap(); router.push(`/room/${item.id}` as any); }}
                        >
                          <View style={{ flex: 1 }}>
                            <Text style={styles.gaveUpTitle} numberOfLines={1}>{item.title}</Text>
                            <Text style={styles.gaveUpMeta}>
                              🗓️ {item.start_date.replace(/-/g, '.')} ~ {item.end_date.replace(/-/g, '.')} · 열람만 가능
                            </Text>
                          </View>
                          <Text style={styles.gaveUpArrow}>→</Text>
                        </Pressable>
                      ))}
                      {gaveUpOpen && (
                        <Text style={styles.gaveUpHint}>
                          남긴 인증과 기록은 그대로 보존돼 있어요. 방에서 "다시 시작하기"로 이어갈 수 있어요.
                        </Text>
                      )}
                    </View>
                  )}
                </>
              }
            />
          );
        })()
      )}
    </Screen>
  );
}

function Card({ challenge, myUserId, finished = false }: { challenge: ChallengeWithCount; myUserId?: string; finished?: boolean }) {
  const { daysLeft, progress, dayN, totalDays } = computeProgress(challenge.start_date, challenge.end_date);

  // 🚀 날짜 포맷 예쁘게 변환 (YYYY-MM-DD -> YYYY.MM.DD)
  const formatDt = (d: string) => d.replace(/-/g, '.');

  // 🚀 cheered(응원받기) 응원 동료 — 인증 주체가 아님. '오늘 인증 전' 대신 '응원하기' 로.
  const isCheeredParticipant = challenge.kind === 'cheered' && challenge.creator_id !== myUserId;

  return (
    <Pressable
      style={styles.card}
      onPress={() => {
        haptic.tap();
        // 종료된 도전 카드는 박제 탭으로 직행 (홈 "끝낸 도전" 카드와 동일 동선)
        router.push(finished ? `/room/${challenge.id}?tab=archive` as any : `/room/${challenge.id}`);
      }}
    >
      {/* 🚀 1. 알림 배지 줄 (본인 외 다른 사람이 올린 새 대화 / 새 기록이 있는 경우에만 표시) */}
      {(challenge.has_new_chat || challenge.has_new_log) && (
        <View style={styles.alertBadgeRow}>
          {challenge.has_new_chat && (
            <View style={[styles.alertBadge, styles.chatAlert]}>
              <Text style={[styles.alertBadgeText, styles.chatAlertText]}>💬 새 대화</Text>
            </View>
          )}
          {challenge.has_new_log && (
            <View style={[styles.alertBadge, styles.logAlert]}>
              <Text style={[styles.alertBadgeText, styles.logAlertText]}>📝 새 기록</Text>
            </View>
          )}
        </View>
      )}

      {/* 🚀 2. 카드 헤더 (제목 + D-day + 인증 상태 배지) */}
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle} numberOfLines={1}>{challenge.title}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          {finished ? (
            // 🚀 종료된 도전 — 진행 중 톤(오늘 인증/D-day) 대신 종료 배지
            <View style={[styles.checkinBadge, styles.finishedBadge]}>
              <Text style={[styles.checkinBadgeText, styles.finishedBadgeText]}>🏁 종료 · 박제 보기</Text>
            </View>
          ) : challenge.goal_type === 'count' ? (
            <>
              {/* 🚀 0041: 목표 횟수형 — 일일 의무 없음. 진행 N/목표 + D-day */}
              <View style={[styles.checkinBadge, styles.checkedBadge]}>
                <Text style={[styles.checkinBadgeText, styles.checkedBadgeText]}>🎯 {challenge.my_proof_count ?? 0}/{challenge.target_count ?? 0}</Text>
              </View>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>D-{daysLeft}</Text>
              </View>
            </>
          ) : (
            <>
              {/* 🚀 오늘 인증 상태 배지 — 응원받기 동료는 인증 대신 응원 */}
              {isCheeredParticipant ? (
                <View style={[styles.checkinBadge, styles.cheerBadge]}>
                  <Text style={[styles.checkinBadgeText, styles.cheerBadgeText]}>💛 응원하기</Text>
                </View>
              ) : challenge.is_today_checked ? (
                <View style={[styles.checkinBadge, styles.checkedBadge]}>
                  <Text style={[styles.checkinBadgeText, styles.checkedBadgeText]}>✓ 오늘 인증 완료</Text>
                </View>
              ) : (
                <View style={[styles.checkinBadge, styles.uncheckedBadge]}>
                  <Text style={[styles.checkinBadgeText, styles.uncheckedBadgeText]}>📝 오늘 인증 전</Text>
                </View>
              )}
              {/* 🚀 D-day 배지 */}
              <View style={styles.badge}>
                <Text style={styles.badgeText}>D-{daysLeft}</Text>
              </View>
            </>
          )}
        </View>
      </View>

      {/* 🚀 3. 챌린지 상세 설명 (description) */}
      {challenge.description ? (
        <Text style={styles.cardDesc} numberOfLines={2}>
          "{challenge.description}"
        </Text>
      ) : null}

      {/* 🚀 4. 일정 범위 표기 */}
      <Text style={styles.cardDates}>
        🗓️ {formatDt(challenge.start_date)} ~ {formatDt(challenge.end_date)}
      </Text>

      {/* 🚀 5. 메타 정보 (참여 인원 + 진행 일수 + 스트릭) */}
      <Text style={styles.cardMeta}>
        👥 {challenge.member_count}명 참여 중 · {dayN}/{totalDays}일째
        {challenge.my_streak && challenge.my_streak > 0 ? (
          <Text style={styles.streakText}> · 🔥 {challenge.my_streak}일 연속 성공 중</Text>
        ) : null}
      </Text>

      {/* 🚀 6. 게이지 바 */}
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
      </View>
    </Pressable>
  );
}

function computeProgress(start: string, end: string) {
  const startDate = new Date(start + 'T00:00:00');
  const endDate = new Date(end + 'T00:00:00');

  // KST 기준 오늘 — UTC 기준이면 오전 9시까지 어제로 판정됨
  const todayDate = new Date(getKstTodayRange().kstDateStr + 'T00:00:00');

  const totalDays = Math.max(1, Math.round((endDate.getTime() - startDate.getTime()) / 86_400_000) + 1);
  const elapsed = Math.max(0, Math.round((todayDate.getTime() - startDate.getTime()) / 86_400_000));
  const dayN = Math.min(totalDays, elapsed + 1);
  const progress = Math.min(1, Math.max(0, elapsed / totalDays));
  const daysLeft = Math.max(0, Math.round((endDate.getTime() - todayDate.getTime()) / 86_400_000));

  return { daysLeft, progress, dayN, totalDays };
}

const styles = StyleSheet.create({
  subHeader: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  subTitle: {
    fontSize: fontSize['2xl'],
    color: colors.primary,
    fontFamily: fontFamily.bold,
    fontWeight: fontWeight.bold,
    letterSpacing: -0.5,
  },
  subDesc: {
    fontSize: fontSize.sm,
    color: colors.primary500,
    fontFamily: fontFamily.medium,
    fontWeight: fontWeight.medium,
    marginTop: 4,
  },
  footerSectionTitle: {
    fontSize: fontSize.base,
    color: colors.primary,
    fontFamily: fontFamily.bold,
    fontWeight: fontWeight.bold,
    paddingHorizontal: 4,
  },
  list: {
    paddingHorizontal: 24,
    paddingBottom: 24,
    gap: 12,
    flexGrow: 1,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: 20, // 🚀 16 -> 20으로 확장
    gap: 12,    // 🚀 간격을 넓혀 시각적으로 풍성하게 함
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
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: colors.accent50,
    borderRadius: radius.pill,
  },
  badgeText: {
    fontSize: fontSize.xs,
    color: colors.accent700,
    fontFamily: fontFamily.bold,
    fontWeight: fontWeight.bold,
  },
  cardDesc: {
    fontSize: fontSize.sm,
    color: colors.primary700,
    fontFamily: fontFamily.regular,
    fontStyle: 'italic', // 🚀 이탤릭체로 세련되게 표현
    lineHeight: 18,
  },
  cardDates: {
    fontSize: fontSize.xs,
    color: colors.primary500,
    fontFamily: fontFamily.medium,
    marginTop: 2,
  },
  cardMeta: {
    fontSize: fontSize.xs,
    color: colors.primary500,
    fontFamily: fontFamily.regular,
  },
  streakText: {
    color: colors.accent,
    fontFamily: fontFamily.bold,
    fontWeight: fontWeight.bold,
  },
  progressTrack: {
    height: 8, // 🚀 6 -> 8로 확장
    backgroundColor: colors.primary100,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: 8, // 🚀 6 -> 8로 확장
    backgroundColor: colors.accent,
    borderRadius: 4,
  },
  alertBadgeRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 4,
  },
  alertBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.sm,
  },
  chatAlert: {
    backgroundColor: 'rgba(239, 68, 68, 0.08)', // 🚀 danger 컬러 연한 배경
  },
  logAlert: {
    backgroundColor: 'rgba(59, 130, 246, 0.08)', // 🚀 info 컬러 연한 배경
  },
  alertBadgeText: {
    fontSize: fontSize.xs,
    fontFamily: fontFamily.bold,
    fontWeight: fontWeight.bold,
  },
  chatAlertText: {
    color: colors.danger,
  },
  logAlertText: {
    color: colors.info,
  },
  checkinBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.sm,
  },
  checkedBadge: {
    backgroundColor: 'rgba(34, 197, 94, 0.08)', // 🚀 success 컬러 연한 배경
  },
  uncheckedBadge: {
    backgroundColor: 'rgba(255, 107, 53, 0.08)', // 🚀 accent 컬러 연한 배경
  },
  cheerBadge: {
    backgroundColor: colors.accent50,   // 🚀 응원받기 동료 — 인증 의무 없음, 응원 톤
  },
  finishedBadge: {
    backgroundColor: colors.primary100,   // 종료 카드 — 차분한 회색 톤
  },
  checkinBadgeText: {
    fontSize: fontSize.xs,
    fontFamily: fontFamily.bold,
    fontWeight: fontWeight.bold,
  },
  checkedBadgeText: {
    color: colors.success,
  },
  uncheckedBadgeText: {
    color: colors.accent,
  },
  cheerBadgeText: {
    color: colors.accent700,
  },
  finishedBadgeText: {
    color: colors.primary700,
  },
  gaveUpToggle: {
    fontSize: fontSize.sm,
    color: colors.primary500,
    fontFamily: fontFamily.medium,
    fontWeight: fontWeight.medium,
    paddingHorizontal: 4,
  },
  gaveUpCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.primary50,
    borderRadius: radius.lg,
    paddingVertical: 12,
    paddingHorizontal: 16,
    opacity: 0.8,
  },
  gaveUpTitle: {
    fontSize: fontSize.base,
    color: colors.primary500,
    fontFamily: fontFamily.medium,
    fontWeight: fontWeight.medium,
  },
  gaveUpMeta: {
    fontSize: fontSize.xs,
    color: colors.primary300,
    fontFamily: fontFamily.regular,
    marginTop: 2,
  },
  gaveUpArrow: {
    fontSize: fontSize.base,
    color: colors.primary300,
  },
  gaveUpHint: {
    fontSize: fontSize.xs,
    color: colors.primary300,
    fontFamily: fontFamily.regular,
    paddingHorizontal: 4,
    lineHeight: 16,
  },
  empty: {
    flex: 1,
    paddingVertical: 80,
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
});
