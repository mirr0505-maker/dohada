// 🚀 응원 한잔 수령/상세 화면 — 알림 "한잔 도착" 탭으로 진입
// 받는 사람: 내가 받기 / 기부하기 2택 → 선택 결과는 보낸 사람에게 피드백 알림 (0033 트리거)
// 보낸 사람: 진행 상태 확인용 (도착 대기 / 받음 / 기부됨 / 환불)
import React, { useCallback, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Screen } from '@/components/Screen';
import { colors, fontFamily, fontSize, fontWeight, radius, shadow } from '@/lib/tokens';
import { useSession } from '@/lib/session';
import { haptic } from '@/lib/haptics';
import { fetchGiftOrder, claimGift, GIFT_TIERS, type GiftOrderRow } from '@/lib/payments';

// 상태 → 사용자 문구 (수신자/발신자 공용 표시)
const STATUS_LABEL: Record<string, string> = {
  created: '결제 대기 중',
  paid: '도착 — 받기를 기다리고 있어요',
  issued: '교환권 발급됨',
  delivered: '받았어요 ☕',
  donated: '기부로 돌렸어요 💚',
  auto_refund: '발급 실패로 자동 환불되었어요',
  pay_failed: '결제가 완료되지 않았어요',
  canceled: '취소된 주문이에요',
};

export default function GiftDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const session = useSession();
  const myUserId = session?.user?.id;

  const [order, setOrder] = useState<GiftOrderRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    if (!id) return;
    fetchGiftOrder(id)
      .then(setOrder)
      .catch(() => setOrder(null))
      .finally(() => setLoading(false));
  }, [id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onClaim = async (action: 'receive' | 'donate') => {
    if (!order || busy) return;
    haptic.tap();
    setBusy(true);
    try {
      const result = await claimGift(order.id, action);
      haptic.success();
      if (result.status === 'auto_refund') {
        Alert.alert('응원 한잔', '교환권 발급이 실패해 보낸 분에게 자동 환불되었어요.');
      }
      load();
    } catch (e: any) {
      Alert.alert('처리 실패', e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  };

  const tierMeta = GIFT_TIERS.find(t => t.tier === order?.product_tier);
  const tierLabel = tierMeta?.label
    ?? (order?.product_tier === 'grand_cup' ? '🎁 거하게 한잔' : '☕ 한잔');
  const isRecipient = Boolean(order && myUserId && order.recipient_id === myUserId);
  const claimable = isRecipient && order?.status === 'paid';

  return (
    <Screen backgroundColor={colors.bg}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} accessibilityRole="button" accessibilityLabel="뒤로가기">
          <Text style={styles.back}>←</Text>
        </Pressable>
        <Text style={styles.headerTitle}>응원 한잔</Text>
        <View style={{ width: 24 }} />
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={colors.accent} /></View>
      ) : !order ? (
        <View style={styles.center}>
          <Text style={styles.emptyText}>주문을 찾을 수 없어요.</Text>
        </View>
      ) : (
        <View style={styles.body}>
          <View style={styles.card}>
            <Text style={styles.tierBig}>{tierLabel}</Text>
            <Text style={styles.fromTo}>
              {isRecipient
                ? `${order.sender?.nickname ?? '동료'}님이 보냈어요`
                : `${order.recipient?.nickname ?? '동료'}님에게 보냈어요`}
            </Text>
            <Text style={styles.amount}>{order.amount.toLocaleString()}원</Text>
            <Text style={styles.status}>{STATUS_LABEL[order.status] ?? order.status}</Text>

            {/* 발급된 교환권 — Stage 1 은 mock 참조 문자열, Stage 3 에서 바코드 이미지로 교체 */}
            {isRecipient && order.voucher_ref && (order.status === 'issued' || order.status === 'delivered') && (
              <View style={styles.voucherBox}>
                <Text style={styles.voucherLabel}>교환권 (베타 모의 발급)</Text>
                <Text style={styles.voucherRef}>{order.voucher_ref}</Text>
              </View>
            )}
          </View>

          {/* 받는 사람의 2택 — 선택 결과는 보낸 사람에게 알림으로 전달 */}
          {claimable && (
            <View style={{ gap: 10 }}>
              <Pressable
                style={[styles.primaryBtn, busy && styles.btnDisabled]}
                onPress={() => onClaim('receive')}
                disabled={busy}
              >
                <Text style={styles.primaryBtnText}>☕ 내가 받기</Text>
              </Pressable>
              <Pressable
                style={[styles.donateBtn, busy && styles.btnDisabled]}
                onPress={() => {
                  Alert.alert(
                    '기부하기',
                    '이 한잔을 기부로 돌릴까요?\n보낸 분에게도 따뜻한 소식으로 전해져요.',
                    [
                      { text: '취소', style: 'cancel' },
                      { text: '기부하기', onPress: () => onClaim('donate') },
                    ],
                  );
                }}
                disabled={busy}
              >
                <Text style={styles.donateBtnText}>💚 기부하기 — 누군가의 한잔이 돼요</Text>
              </Pressable>
            </View>
          )}

          <Text style={styles.mockFootnote}>🧪 베타 테스트 — 실제 결제·계좌 연결이 없는 모의 한잔이에요.</Text>
        </View>
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
  emptyText: {
    fontSize: fontSize.base,
    color: colors.primary500,
    fontFamily: fontFamily.regular,
  },
  body: { padding: 20, gap: 16 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: 24,
    alignItems: 'center',
    gap: 8,
    ...shadow.sm,
  },
  tierBig: { fontSize: 40 },
  fromTo: {
    fontSize: fontSize.base,
    color: colors.primary,
    fontFamily: fontFamily.bold,
    fontWeight: fontWeight.bold,
  },
  amount: {
    fontSize: fontSize.lg,
    color: colors.accent700,
    fontFamily: fontFamily.bold,
    fontWeight: fontWeight.bold,
  },
  status: {
    fontSize: fontSize.sm,
    color: colors.primary500,
    fontFamily: fontFamily.regular,
  },
  voucherBox: {
    marginTop: 12,
    padding: 14,
    backgroundColor: colors.accent50,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.accent,
    alignItems: 'center',
    gap: 4,
    alignSelf: 'stretch',
  },
  voucherLabel: {
    fontSize: fontSize.xs,
    color: colors.primary500,
    fontFamily: fontFamily.regular,
  },
  voucherRef: {
    fontSize: fontSize.sm,
    color: colors.primary,
    fontFamily: fontFamily.bold,
    fontWeight: fontWeight.bold,
  },
  primaryBtn: {
    backgroundColor: colors.accent,
    borderRadius: radius.lg,
    paddingVertical: 16,
    alignItems: 'center',
  },
  primaryBtnText: {
    fontSize: fontSize.base,
    color: colors.surface,
    fontFamily: fontFamily.bold,
    fontWeight: fontWeight.bold,
  },
  donateBtn: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.done,
  },
  donateBtnText: {
    fontSize: fontSize.base,
    color: colors.done,
    fontFamily: fontFamily.bold,
    fontWeight: fontWeight.bold,
  },
  btnDisabled: { opacity: 0.5 },
  mockFootnote: {
    fontSize: 11,
    color: colors.primary300,
    fontFamily: fontFamily.regular,
    textAlign: 'center',
    marginTop: 8,
  },
});
