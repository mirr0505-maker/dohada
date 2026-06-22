// 🚀 나의 다짐 내역 — 내가 건 무현금 다짐(0046)을 하다별 카드로, 상태 섹션(진행 중/완주/못 채운)으로 묶어 보기.
//   완주 판정은 방 화면과 같은 단일 소스(stats.goalStatus, fetchMyPledges) 재사용.
//   이 화면은 '보기' 중심 — 지켰어요 토글은 카드 탭 → 그 방 현황 탭에서.
import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, Pressable, SectionList, StyleSheet, ActivityIndicator } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Screen } from '@/components/Screen';
import { colors, fontFamily, fontSize, fontWeight, radius, shadow } from '@/lib/tokens';
import { useSession } from '@/lib/session';
import { haptic } from '@/lib/haptics';
import { fetchMyPledges, type MyPledgeChallenge, type PledgeDirection } from '@/lib/db';

// 방향 라벨 — 방 다짐 카드(PledgeCard)와 동일 문구 유지
function dirLabel(d: PledgeDirection): string {
  return d === 'lose' ? '🔻 못 하면' : '🏆 해내면';
}

// 한 다짐의 표시 상태 — PledgeCard 의 pledgeState 와 같은 의미
//   in_progress(진행 중) / to_fulfill(지킬 차례) / fulfilled(지켰어요) / not_triggered(안 지켜도 됨)
type PledgeUiState = 'in_progress' | 'to_fulfill' | 'fulfilled' | 'not_triggered';
function uiState(status: MyPledgeChallenge['status'], isDue: boolean, fulfilled: boolean): PledgeUiState {
  if (status === 'active') return 'in_progress';
  if (!isDue) return 'not_triggered';
  return fulfilled ? 'fulfilled' : 'to_fulfill';
}

export default function PledgeHistoryScreen() {
  const session = useSession();
  const myUserId = session?.user?.id;
  const [rows, setRows] = useState<MyPledgeChallenge[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    if (!myUserId) return;
    fetchMyPledges(myUserId)
      .then(setRows)
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, [myUserId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  // 상태별 섹션 — 진행 중(곧 끝나는 순) / 완주(최근 순) / 못 채운(최근 순). 빈 섹션은 자동 제외.
  const sections = useMemo(() => {
    const active    = rows.filter(r => r.status === 'active').sort((a, b) => a.daysLeft - b.daysLeft);
    const completed = rows.filter(r => r.status === 'completed').sort((a, b) => (a.endDate < b.endDate ? 1 : -1));
    const missed    = rows.filter(r => r.status === 'missed').sort((a, b) => (a.endDate < b.endDate ? 1 : -1));
    const out: { title: string; data: MyPledgeChallenge[] }[] = [];
    if (active.length)    out.push({ title: '🏃 진행 중', data: active });
    if (completed.length) out.push({ title: '🏆 완주한 하다', data: completed });
    if (missed.length)    out.push({ title: '🌙 못 채운 하다', data: missed });
    return out;
  }, [rows]);

  return (
    <Screen backgroundColor={colors.bg}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} accessibilityRole="button" accessibilityLabel="뒤로가기">
          <Text style={styles.back}>←</Text>
        </Pressable>
        <Text style={styles.headerTitle}>💛 다짐 내역</Text>
        <View style={{ width: 24 }} />
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={colors.accent} /></View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={r => r.challengeId}
          contentContainerStyle={styles.list}
          stickySectionHeadersEnabled={false}
          renderSectionHeader={({ section }) => (
            <Text style={styles.sectionHeader}>{section.title}</Text>
          )}
          renderItem={({ item }) => (
            <Pressable
              style={styles.card}
              onPress={() => { haptic.tap(); router.push(`/room/${item.challengeId}?tab=status` as any); }}
            >
              {/* 하다 제목 + 상태 배지 */}
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text>
                {item.status === 'active' ? (
                  <View style={[styles.statusBadge, styles.badgeActive]}>
                    <Text style={[styles.statusBadgeText, styles.badgeActiveText]}>D-{item.daysLeft}</Text>
                  </View>
                ) : item.status === 'completed' ? (
                  <View style={[styles.statusBadge, styles.badgeDone]}>
                    <Text style={[styles.statusBadgeText, styles.badgeDoneText]}>완주 🏆</Text>
                  </View>
                ) : (
                  <View style={[styles.statusBadge, styles.badgeMissed]}>
                    <Text style={[styles.statusBadgeText, styles.badgeMissedText]}>미완주</Text>
                  </View>
                )}
              </View>

              {/* 내 다짐 (해내면/못 하면, 방향별 1~2개) */}
              {item.pledges.map(pl => {
                const st = uiState(item.status, pl.isDue, pl.fulfilled);
                return (
                  <View key={pl.id} style={styles.pledgeRow}>
                    <View style={styles.pledgeTop}>
                      <Text style={styles.dirTag}>{dirLabel(pl.direction)}</Text>
                      {st === 'to_fulfill' && (
                        <View style={[styles.outChip, styles.outDueBg]}>
                          <Text style={[styles.outChipText, styles.outDueText]}>💛 지킬 차례</Text>
                        </View>
                      )}
                      {st === 'fulfilled' && (
                        <View style={[styles.outChip, styles.outDoneBg]}>
                          <Text style={[styles.outChipText, styles.outDoneText]}>✓ 지켰어요</Text>
                        </View>
                      )}
                    </View>
                    <Text style={[styles.pledgeText, st === 'not_triggered' && styles.pledgeTextMuted]}>
                      {pl.content}
                    </Text>
                    {st === 'not_triggered' && (
                      <Text style={styles.pledgeNote}>
                        {pl.direction === 'lose' ? '완주했어요 — 안 지켜도 돼요' : '이번엔 못 채웠어요 — 다음 기회에'}
                      </Text>
                    )}
                  </View>
                );
              })}
            </Pressable>
          )}
          ListFooterComponent={
            rows.length > 0 ? (
              <Text style={styles.footerHint}>
                카드를 누르면 그 하다의 현황 탭에서 "지켰어요"를 표시할 수 있어요.
              </Text>
            ) : null
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyEmoji}>💛</Text>
              <Text style={styles.emptyText}>
                아직 건 다짐이 없어요.{'\n'}하다 방의 현황 탭에서 가벼운 다짐을 걸어보세요.
              </Text>
            </View>
          }
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.primary100,
  },
  back: { fontSize: 22, color: colors.primary },
  headerTitle: {
    fontSize: fontSize.lg,
    color: colors.primary,
    fontFamily: fontFamily.bold,
    fontWeight: fontWeight.bold,
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { padding: 16, gap: 10, flexGrow: 1 },
  sectionHeader: {
    fontSize: fontSize.base,
    color: colors.primary,
    fontFamily: fontFamily.bold,
    fontWeight: fontWeight.bold,
    paddingHorizontal: 4,
    paddingTop: 10,
    paddingBottom: 4,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: 14,
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
    fontSize: fontSize.base,
    color: colors.primary,
    fontFamily: fontFamily.bold,
    fontWeight: fontWeight.bold,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  statusBadgeText: {
    fontSize: fontSize.xs,
    fontFamily: fontFamily.bold,
    fontWeight: fontWeight.bold,
  },
  badgeActive: { backgroundColor: colors.accent50 },
  badgeActiveText: { color: colors.accent700 },
  badgeDone: { backgroundColor: 'rgba(34, 197, 94, 0.10)' },
  badgeDoneText: { color: colors.done },
  badgeMissed: { backgroundColor: colors.primary100 },
  badgeMissedText: { color: colors.primary500 },
  pledgeRow: {
    gap: 4,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.primary50,
  },
  pledgeTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  dirTag: {
    fontSize: fontSize.xs,
    color: colors.accent700,
    fontFamily: fontFamily.bold,
    fontWeight: fontWeight.bold,
    paddingHorizontal: 8,
    paddingVertical: 2,
    backgroundColor: colors.accent50,
    borderRadius: radius.pill,
  },
  outChip: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.pill,
  },
  outChipText: {
    fontSize: fontSize.xs,
    fontFamily: fontFamily.bold,
    fontWeight: fontWeight.bold,
  },
  outDueBg: { backgroundColor: colors.accent50 },
  outDueText: { color: colors.accent700 },
  outDoneBg: { backgroundColor: 'rgba(34, 197, 94, 0.10)' },
  outDoneText: { color: colors.done },
  pledgeText: {
    fontSize: fontSize.base,
    color: colors.primary,
    fontFamily: fontFamily.medium,
    fontWeight: fontWeight.medium,
    lineHeight: 22,
  },
  pledgeTextMuted: {
    color: colors.primary300,
    textDecorationLine: 'line-through',
  },
  pledgeNote: {
    fontSize: fontSize.xs,
    color: colors.primary500,
    fontFamily: fontFamily.regular,
  },
  footerHint: {
    fontSize: fontSize.xs,
    color: colors.primary300,
    fontFamily: fontFamily.regular,
    textAlign: 'center',
    paddingTop: 12,
    paddingHorizontal: 16,
    lineHeight: 16,
  },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingVertical: 64 },
  emptyEmoji: { fontSize: 56 },
  emptyText: {
    fontSize: fontSize.base,
    color: colors.primary500,
    fontFamily: fontFamily.regular,
    textAlign: 'center',
    lineHeight: 22,
  },
});
