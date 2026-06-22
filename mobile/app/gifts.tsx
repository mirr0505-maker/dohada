// 🚀 나의 한잔 내역 — 건넨/받은/내기 한잔을 섹션으로 분리 (내기 한잔도 오픈 시 자동 포함 — 같은 gift_orders)
//   섹션(방향) 안에서 결과(받음 ☕ / 기부 💚 / 대기 / 환불)별로 정렬 + 색 배지로 한눈에 구분.
// 진입: 내정보 "☕ 한잔 내역" (파일럿 전용). 행 탭 → 수령/상세 화면.
import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, Pressable, SectionList, StyleSheet, ActivityIndicator } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Screen } from '@/components/Screen';
import { colors, fontFamily, fontSize, fontWeight, radius, shadow } from '@/lib/tokens';
import { useSession } from '@/lib/session';
import { haptic } from '@/lib/haptics';
import {
  fetchMyGiftHistory, GIFT_TIERS, GIFT_STATUS_LABEL, type GiftHistoryRow,
} from '@/lib/payments';

function tierLabel(tier: string): string {
  return GIFT_TIERS.find(t => t.tier === tier)?.label
    ?? (tier === 'grand_cup' ? '🎁 거하게 한잔' : '☕ 한잔');
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

// 행 제목 — 방향/종류별 문구 (섹션 헤더가 방향을 알려주므로 본문은 상대·티어 중심)
function rowTitle(item: GiftHistoryRow): string {
  if (item.order_type === 'bet') return `내기 한잔 · ${tierLabel(item.product_tier)}`;
  return item.direction === 'sent'
    ? `${item.counterpart_nickname}님에게 ${tierLabel(item.product_tier)}`
    : `${item.counterpart_nickname}님의 ${tierLabel(item.product_tier)}`;
}

// 결과 배지 — 받음 ☕ / 기부 💚 / 대기 / 환불. sort: 같은 섹션 안에서 결과끼리 묶기 위한 정렬 키(작을수록 위).
type ChipTone = 'receive' | 'donate' | 'pending' | 'closed';
function outcomeChip(item: GiftHistoryRow): { label: string; tone: ChipTone; sort: number } {
  const received = item.direction === 'received';
  switch (item.status) {
    case 'delivered':   return { label: '받음 ☕', tone: 'receive', sort: 1 };
    case 'donated':     return { label: '기부 💚', tone: 'donate',  sort: 2 };
    case 'paid':        return { label: received ? '받기 전' : item.order_type === 'bet' ? '진행 중' : '전달됨', tone: 'pending', sort: 0 };
    case 'issued':      return { label: '교환권',  tone: 'pending', sort: 0 };
    case 'created':     return { label: '결제 대기', tone: 'pending', sort: 3 };
    case 'auto_refund':
    case 'refunded':    return { label: '환불',    tone: 'closed',  sort: 4 };
    case 'pay_failed':  return { label: '결제 실패', tone: 'closed',  sort: 4 };
    case 'canceled':    return { label: '취소',    tone: 'closed',  sort: 4 };
    default:            return { label: GIFT_STATUS_LABEL[item.status] ?? item.status, tone: 'pending', sort: 3 };
  }
}

// 섹션 안 정렬 — 결과 묶음(sort) 우선, 같은 묶음은 최신순
function byOutcomeThenRecent(a: GiftHistoryRow, b: GiftHistoryRow): number {
  const d = outcomeChip(a).sort - outcomeChip(b).sort;
  return d !== 0 ? d : (a.created_at < b.created_at ? 1 : -1);
}

export default function GiftHistoryScreen() {
  const session = useSession();
  const myUserId = session?.user?.id;
  const [rows, setRows] = useState<GiftHistoryRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    if (!myUserId) return;
    fetchMyGiftHistory(myUserId)
      .then(setRows)
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, [myUserId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  // 방향별 섹션 — 건넨(보낸 응원) / 받은(받은 응원) / 내기(나와의 내기). 빈 섹션은 자동 제외.
  const sections = useMemo(() => {
    const sent     = rows.filter(r => r.order_type !== 'bet' && r.direction === 'sent').sort(byOutcomeThenRecent);
    const received = rows.filter(r => r.order_type !== 'bet' && r.direction === 'received').sort(byOutcomeThenRecent);
    const bets     = rows.filter(r => r.order_type === 'bet').sort(byOutcomeThenRecent);
    const out: { title: string; data: GiftHistoryRow[] }[] = [];
    if (sent.length)     out.push({ title: '📤 건넨 한잔', data: sent });
    if (received.length) out.push({ title: '📥 받은 한잔', data: received });
    if (bets.length)     out.push({ title: '🤝 내기 한잔', data: bets });
    return out;
  }, [rows]);

  return (
    <Screen backgroundColor={colors.bg}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} accessibilityRole="button" accessibilityLabel="뒤로가기">
          <Text style={styles.back}>←</Text>
        </Pressable>
        <Text style={styles.headerTitle}>☕ 한잔 내역</Text>
        <View style={{ width: 24 }} />
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={colors.accent} /></View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={r => r.id}
          contentContainerStyle={styles.list}
          stickySectionHeadersEnabled={false}
          renderSectionHeader={({ section }) => (
            <Text style={styles.sectionHeader}>{section.title}</Text>
          )}
          renderItem={({ item }) => {
            const oc = outcomeChip(item);
            return (
              <Pressable
                style={styles.row}
                onPress={() => { haptic.tap(); router.push(`/gift/${item.id}` as any); }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowTitle} numberOfLines={1}>{rowTitle(item)}</Text>
                  {item.challenge_title ? (
                    <Text style={styles.rowMeta} numberOfLines={1}>{item.challenge_title}</Text>
                  ) : null}
                </View>
                <View style={styles.rowRight}>
                  <View style={[styles.chip, CHIP_BG[oc.tone]]}>
                    <Text style={[styles.chipText, CHIP_TX[oc.tone]]}>{oc.label}</Text>
                  </View>
                  <Text style={styles.rowDate}>{formatDate(item.created_at)}</Text>
                </View>
              </Pressable>
            );
          }}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyEmoji}>☕</Text>
              <Text style={styles.emptyText}>
                아직 주고받은 한잔이 없어요.{'\n'}동료의 인증에서 따뜻한 한잔을 보내보세요.
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
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: 14,
    ...shadow.sm,
  },
  rowTitle: {
    fontSize: fontSize.base,
    color: colors.primary,
    fontFamily: fontFamily.bold,
    fontWeight: fontWeight.bold,
  },
  rowMeta: {
    fontSize: fontSize.xs,
    color: colors.primary500,
    fontFamily: fontFamily.regular,
    marginTop: 2,
  },
  rowRight: { alignItems: 'flex-end', gap: 4 },
  chip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.sm,
  },
  chipText: {
    fontSize: fontSize.xs,
    fontFamily: fontFamily.bold,
    fontWeight: fontWeight.bold,
  },
  // 결과 배지 색 — 받음=주황 / 기부=초록 / 대기=파랑 / 환불·종료=회색
  chipReceiveBg: { backgroundColor: colors.accent50 },
  chipReceiveText: { color: colors.accent700 },
  chipDonateBg: { backgroundColor: 'rgba(34, 197, 94, 0.10)' },
  chipDonateText: { color: colors.done },
  chipPendingBg: { backgroundColor: 'rgba(59, 130, 246, 0.10)' },
  chipPendingText: { color: colors.info },
  chipClosedBg: { backgroundColor: colors.primary100 },
  chipClosedText: { color: colors.primary500 },
  rowDate: {
    fontSize: fontSize.xs,
    color: colors.primary300,
    fontFamily: fontFamily.regular,
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

// 결과 톤 → 스타일 매핑 (styles 정의 이후라 안전)
const CHIP_BG: Record<ChipTone, object> = {
  receive: styles.chipReceiveBg,
  donate: styles.chipDonateBg,
  pending: styles.chipPendingBg,
  closed: styles.chipClosedBg,
};
const CHIP_TX: Record<ChipTone, object> = {
  receive: styles.chipReceiveText,
  donate: styles.chipDonateText,
  pending: styles.chipPendingText,
  closed: styles.chipClosedText,
};
