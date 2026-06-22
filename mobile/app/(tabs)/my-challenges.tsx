// 🚀 내 하다 (리디자인 v2) — 참여 중인 모든 하다 목록 (내 작업 공간 입구)
// 진행 카드 = 연속일수 큰 숫자 + 상태 tag + 두꺼운 진행바. 응원하는/끝낸/지난 밴드 분리.
// 하다 구경 진입점은 홈 최상단 1곳으로 통일(§12) — 여기 하단 진입점 제거.
import React, { useCallback, useState } from 'react';
import {
  View, Text, Pressable, FlatList, StyleSheet, RefreshControl,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Sprout } from 'lucide-react-native';
import { Screen } from '@/components/Screen';
import { AppHeader } from '@/components/AppHeader';
import { StatusBadge } from '@/components/StatusBadge';
import { colors, fontFamily, fontSize, fontWeight, radius, textStyle, shadow } from '@/lib/tokens';
import { useSession } from '@/lib/session';
import { fetchMyChallenges, fetchMyGivenUpChallenges, type GivenUpChallenge } from '@/lib/db';
import { ErrorState } from '@/components/ErrorState';
import { ChallengeCardSkeleton } from '@/components/Skeleton';
import { reportError } from '@/lib/sentry';
import { haptic } from '@/lib/haptics';
import type { ChallengeWithCount } from '@/lib/types';
import { getKstTodayRange, displayTitle } from '@/lib/format';

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
    <Screen backgroundColor={colors.bg}>
      <AppHeader />
      <View style={styles.subHeader}>
        <Text style={styles.subTitle}>내 하다</Text>
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
          // 내가 하는 하다(나홀로·다함께·누구나·응원받기 개설자) vs 내가 응원하는 하다(응원하기로 들어간 cheered) 분리
          const isCheererRoom = (c: ChallengeWithCount) => c.kind === 'cheered' && c.creator_id !== myUserId;
          const doing    = challenges.filter(c => !isCheererRoom(c));
          const cheering = challenges.filter(c => isCheererRoom(c));
          // 진행 중 vs 종료 분리 (KST 자정 기준)
          const todayStr = getKstTodayRange().kstDateStr;
          const active   = doing.filter(c => todayStr <= c.end_date);
          const finished = doing.filter(c => todayStr >  c.end_date);
          return (
            <FlatList
              data={active}
              keyExtractor={c => c.id}
              contentContainerStyle={styles.list}
              refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brand} />
              }
              renderItem={({ item }) => <Card challenge={item} myUserId={myUserId} />}
              ListEmptyComponent={
                <View style={styles.empty}>
                  <Sprout size={48} color={colors.faint} strokeWidth={1.5} />
                  <Text style={styles.emptyText}>
                    참여 중인 하다가 없어요.{'\n'}하단 + 로 첫 하다를 만들어볼까요?
                  </Text>
                </View>
              }
              ListFooterComponent={
                <>
                  {/* 💛 내가 응원하는 하다 — 도전자 아닌 응원자 역할 */}
                  {cheering.length > 0 && (
                    <View style={styles.band}>
                      <Text style={styles.bandTitle}>응원하는 하다</Text>
                      {cheering.map(item => {
                        const isFin = todayStr > item.end_date;
                        return <Card key={item.id} challenge={item} myUserId={myUserId} finished={isFin} />;
                      })}
                    </View>
                  )}

                  {finished.length > 0 && (
                    <View style={styles.band}>
                      <Text style={styles.bandTitle}>끝낸 하다</Text>
                      {finished.map(item => (
                        <Card key={item.id} challenge={item} myUserId={myUserId} finished />
                      ))}
                    </View>
                  )}

                  {/* 🕊️ 조용한 보관함 — 포기한 하다 (기본 접힘 / 열람은 읽기 전용) */}
                  {gaveUpChs.length > 0 && (
                    <View style={[styles.band, { gap: 10 }]}>
                      <Pressable
                        onPress={() => { haptic.tap(); setGaveUpOpen(o => !o); }}
                        hitSlop={6}
                        accessibilityRole="button"
                        accessibilityLabel={`지난 하다 ${gaveUpChs.length}개 ${gaveUpOpen ? '접기' : '펼치기'}`}
                      >
                        <Text style={styles.gaveUpToggle}>
                          지난 하다 {gaveUpChs.length}개 {gaveUpOpen ? '접기 ▲' : '보기 ▼'}
                        </Text>
                      </Pressable>
                      {gaveUpOpen && gaveUpChs.map(item => (
                        <Pressable
                          key={item.id}
                          style={styles.gaveUpCard}
                          onPress={() => { haptic.tap(); router.push(`/room/${item.id}` as any); }}
                        >
                          <View style={{ flex: 1 }}>
                            <Text style={styles.gaveUpTitle} numberOfLines={1}>{displayTitle(item.title)}</Text>
                            <Text style={styles.gaveUpMeta}>
                              {item.start_date.replace(/-/g, '.')} ~ {item.end_date.replace(/-/g, '.')} · 열람만 가능
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

// ─── 진행 카드 (mcard) ───
function Card({ challenge: c, myUserId, finished = false }: { challenge: ChallengeWithCount; myUserId?: string; finished?: boolean }) {
  const { daysLeft, progress, dayN, totalDays } = computeProgress(c.start_date, c.end_date);
  const isCheeredParticipant = c.kind === 'cheered' && c.creator_id !== myUserId;
  const isCount = c.goal_type === 'count';
  const formatDt = (d: string) => d.replace(/-/g, '.');

  return (
    <Pressable
      style={styles.card}
      onPress={() => {
        haptic.tap();
        router.push(finished ? `/room/${c.id}?tab=archive` as any : `/room/${c.id}`);
      }}
    >
      {/* 새 활동 마커 (본인 외 새 대화/기록) */}
      {(c.has_new_chat || c.has_new_log) && (
        <View style={styles.alertRow}>
          {c.has_new_chat && <View style={[styles.alertPill, styles.alertChat]}><Text style={styles.alertChatText}>새 대화</Text></View>}
          {c.has_new_log && <View style={[styles.alertPill, styles.alertLog]}><Text style={styles.alertLogText}>새 기록</Text></View>}
        </View>
      )}

      {/* 헤더: 제목 + 상태 tag */}
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle} numberOfLines={1}>{displayTitle(c.title)}</Text>
        {finished ? (
          <View style={styles.tagNeutral}><Text style={styles.tagNeutralText}>종료</Text></View>
        ) : isCount ? (
          <View style={styles.tagTodo}><Text style={styles.tagTodoText}>진행 {c.my_proof_count ?? 0}/{c.target_count ?? 0}</Text></View>
        ) : isCheeredParticipant ? (
          <View style={styles.tagTodo}><Text style={styles.tagTodoText}>응원하기</Text></View>
        ) : (
          <StatusBadge status={c.is_today_checked ? 'done' : 'todo'} />
        )}
      </View>

      {/* 숫자 — 연속일수 큰 숫자(번복금지 결정) / 끝낸·응원은 메타만 */}
      {finished ? (
        <Text style={styles.cardMeta}>{formatDt(c.start_date)} ~ {formatDt(c.end_date)} · 박제 보기 →</Text>
      ) : isCheeredParticipant ? (
        <Text style={styles.cardMeta}>응원 중 · 함께 {c.member_count}명 · D-{daysLeft}</Text>
      ) : (
        <View style={styles.nums}>
          {isCount ? (
            <Text style={styles.bigNum}>{c.my_proof_count ?? 0}<Text style={styles.bigUnit}>/{c.target_count ?? 0}개</Text></Text>
          ) : (
            <Text style={styles.bigNum}>{c.my_streak ?? 0}<Text style={styles.bigUnit}>일 연속</Text></Text>
          )}
          <Text style={styles.numsMeta}>{dayN}/{totalDays}일째 · {c.member_count}명 · D-{daysLeft}</Text>
        </View>
      )}

      {/* 진행바 — 두껍게. 끝낸 하다는 회색 */}
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, finished && styles.progressFillDone, { width: `${progress * 100}%` }]} />
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
  subHeader: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 },
  subTitle: { ...textStyle.greeting, color: colors.ink, letterSpacing: -0.5 },
  subDesc: { fontSize: fontSize.sm, color: colors.faint, fontFamily: fontFamily.regular, marginTop: 4 },

  list: { paddingHorizontal: 20, paddingBottom: 24, gap: 12, flexGrow: 1 },
  band: { marginTop: 28, gap: 12 },
  bandTitle: { ...textStyle.section, color: colors.sub, paddingHorizontal: 2 },

  // mcard
  card: {
    backgroundColor: colors.surface, borderRadius: radius.xl,
    borderWidth: 0.5, borderColor: colors.line,
    padding: 18, gap: 12, ...shadow.sm,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 },
  cardTitle: { flex: 1, ...textStyle.cardTitle, color: colors.ink, lineHeight: 21 },

  // 상태 tag (StatusBadge 외 보조 tag)
  tagTodo: { backgroundColor: colors.brandTint, paddingVertical: 5, paddingHorizontal: 10, borderRadius: radius.pill },
  tagTodoText: { fontSize: fontSize.sm, color: colors.brandInk, fontFamily: fontFamily.medium, fontWeight: fontWeight.medium },
  tagNeutral: { backgroundColor: colors.lineSoft, paddingVertical: 5, paddingHorizontal: 10, borderRadius: radius.pill },
  tagNeutralText: { fontSize: fontSize.sm, color: colors.sub, fontFamily: fontFamily.medium, fontWeight: fontWeight.medium },

  // 숫자
  nums: { flexDirection: 'row', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' },
  bigNum: { fontSize: 26, color: colors.ink, fontFamily: fontFamily.bold, fontWeight: fontWeight.bold },
  bigUnit: { fontSize: fontSize.base, color: colors.faint, fontFamily: fontFamily.regular, fontWeight: fontWeight.regular },
  numsMeta: { fontSize: fontSize.sm, color: colors.faint, fontFamily: fontFamily.regular },
  cardMeta: { fontSize: fontSize.sm, color: colors.faint, fontFamily: fontFamily.regular },

  // 진행바
  progressTrack: { height: 9, backgroundColor: colors.lineSoft, borderRadius: radius.pill, overflow: 'hidden' },
  progressFill: { height: 9, backgroundColor: colors.brand, borderRadius: radius.pill },
  progressFillDone: { backgroundColor: colors.primary300 },   // 끝낸 하다 — 회색

  // 새 활동 마커
  alertRow: { flexDirection: 'row', gap: 6 },
  alertPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.sm },
  alertChat: { backgroundColor: colors.brandTint },
  alertChatText: { fontSize: fontSize.xs, color: colors.brandInk, fontFamily: fontFamily.bold, fontWeight: fontWeight.bold },
  alertLog: { backgroundColor: colors.tintSage },
  alertLogText: { fontSize: fontSize.xs, color: colors.doneInk, fontFamily: fontFamily.bold, fontWeight: fontWeight.bold },

  // 지난(포기) 보관함
  gaveUpToggle: { fontSize: fontSize.sm, color: colors.sub, fontFamily: fontFamily.medium, fontWeight: fontWeight.medium, paddingHorizontal: 2 },
  gaveUpCard: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: colors.lineSoft, borderRadius: radius.lg,
    paddingVertical: 12, paddingHorizontal: 16, opacity: 0.85,
  },
  gaveUpTitle: { fontSize: fontSize.base, color: colors.sub, fontFamily: fontFamily.medium, fontWeight: fontWeight.medium },
  gaveUpMeta: { fontSize: fontSize.xs, color: colors.faint, fontFamily: fontFamily.regular, marginTop: 2 },
  gaveUpArrow: { fontSize: fontSize.base, color: colors.faint2 },
  gaveUpHint: { fontSize: fontSize.xs, color: colors.faint, fontFamily: fontFamily.regular, paddingHorizontal: 2, lineHeight: 16 },

  empty: { flex: 1, paddingVertical: 80, alignItems: 'center', justifyContent: 'center', gap: 16 },
  emptyText: { fontSize: fontSize.base, color: colors.faint, fontFamily: fontFamily.regular, textAlign: 'center', lineHeight: 22 },
});
