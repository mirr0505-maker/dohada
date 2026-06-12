// 🚀 나의 한잔 내역 — 보낸/받은 응원 한잔 (내기 한잔도 오픈 시 자동 포함 — 같은 gift_orders)
// 진입: 내정보 "☕ 한잔 내역" (파일럿 전용). 행 탭 → 수령/상세 화면.
import React, { useCallback, useState } from 'react';
import { View, Text, Pressable, FlatList, StyleSheet, ActivityIndicator } from 'react-native';
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

  return (
    <Screen backgroundColor={colors.background}>
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
        <FlatList
          data={rows}
          keyExtractor={r => r.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <Pressable
              style={styles.row}
              onPress={() => { haptic.tap(); router.push(`/gift/${item.id}` as any); }}
            >
              <Text style={styles.rowDirection}>
                {item.order_type === 'bet' ? '🤝' : item.direction === 'sent' ? '📤' : '📥'}
              </Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle} numberOfLines={1}>
                  {item.order_type === 'bet'
                    ? `내기 한잔 · ${tierLabel(item.product_tier)}`
                    : item.direction === 'sent'
                      ? `${item.counterpart_nickname}님에게 ${tierLabel(item.product_tier)}`
                      : `${item.counterpart_nickname}님의 ${tierLabel(item.product_tier)}`}
                </Text>
                <Text style={styles.rowMeta} numberOfLines={1}>
                  {item.challenge_title ? `${item.challenge_title} · ` : ''}{GIFT_STATUS_LABEL[item.status] ?? item.status}
                </Text>
              </View>
              <Text style={styles.rowDate}>{formatDate(item.created_at)}</Text>
            </Pressable>
          )}
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
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: 14,
    ...shadow.sm,
  },
  rowDirection: { fontSize: 20 },
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
