// 🚀 한잔 환불 — 주문을 찾아 이력을 보고 사유를 남겨 환불 (운영 내부 도구, PHASE2 §9 D5)
//   약관 10-3(청약철회·귀책 환불)을 집행하는 유일한 경로. PG 콘솔·SQL 수동 환불 금지 —
//   상태머신과 감사 로그를 우회하면 정산 대사가 깨진다.
//   허용 판정은 서버(refundPolicy)가 한다: paid → 환불 / 발급 실패 멈춤 → 자동 환불 마무리 / 그 외 거부.
import React, { useCallback, useState } from 'react';
import { View, Text, Pressable, TextInput, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import {
  adminSearchGiftOrders, adminListGiftEvents, adminRefundGiftOrder, GIFT_STATUS_LABEL,
  type AdminGiftOrder, type AdminGiftEvent,
} from '@/lib/payments';
import { colors, fontFamily, fontSize, fontWeight, radius } from '@/lib/tokens';

// 이 상태들만 환불 버튼을 연다 — 서버 planAdminRefund 와 같은 집합 (최종 판정은 서버)
const REFUNDABLE = ['paid', 'issue_failed'];

const ACTOR_LABEL: Record<AdminGiftEvent['actor_role'], string> = {
  sender: '보낸 사람', recipient: '받는 사람', admin: '운영자', system: '시스템',
};

export function GiftRefund() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<AdminGiftOrder[]>([]);
  const [searching, setSearching] = useState(false);

  const onSearch = useCallback(async () => {
    const q = query.trim();
    if (!q) return;
    setSearching(true);
    try {
      setResults(await adminSearchGiftOrders(q));
    } catch (e: any) {
      Alert.alert('실패', e?.message ?? String(e));
    } finally {
      setSearching(false);
    }
  }, [query]);

  return (
    <View style={styles.wrap}>
      <View style={styles.searchRow}>
        <TextInput
          style={styles.input}
          value={query}
          onChangeText={setQuery}
          placeholder="주문번호 앞자리 또는 닉네임"
          placeholderTextColor={colors.faint}
          returnKeyType="search"
          autoCapitalize="none"
          onSubmitEditing={onSearch}
        />
        <Pressable style={styles.searchBtn} onPress={onSearch}>
          <Text style={styles.searchBtnText}>검색</Text>
        </Pressable>
      </View>
      {searching ? (
        <View style={styles.center}><ActivityIndicator color={colors.accent} /></View>
      ) : (
        <View style={styles.list}>
          {results.map(o => <OrderRow key={o.id} order={o} onRefunded={onSearch} />)}
        </View>
      )}
    </View>
  );
}

function OrderRow({ order, onRefunded }: { order: AdminGiftOrder; onRefunded: () => void }) {
  const [events, setEvents] = useState<AdminGiftEvent[] | null>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const refundable = REFUNDABLE.includes(order.status);

  const toggleEvents = async () => {
    if (events) { setEvents(null); return; }
    try {
      setEvents(await adminListGiftEvents(order.id));
    } catch (e: any) {
      Alert.alert('실패', e?.message ?? String(e));
    }
  };

  const onRefund = () => {
    const r = reason.trim();
    if (!r) { Alert.alert('사유를 적어주세요', '감사 로그에 남는 문장이에요. 예: 청약철회 요청(메일 10/29)'); return; }
    Alert.alert(
      '환불할까요?',
      `${order.amount.toLocaleString()}원 · ${order.sender_nickname} → ${order.recipient_nickname}\n사유: ${r}\n\n결제가 취소되고 되돌릴 수 없어요.`,
      [
        { text: '취소', style: 'cancel' },
        {
          text: '환불', style: 'destructive', onPress: async () => {
            setBusy(true);
            try {
              const { status } = await adminRefundGiftOrder(order.id, r);
              Alert.alert('환불 완료', GIFT_STATUS_LABEL[status] ?? status);
              setReason('');
              setEvents(null);
              onRefunded();
            } catch (e: any) {
              Alert.alert('환불 실패', e?.message ?? String(e));
            } finally {
              setBusy(false);
            }
          },
        },
      ],
    );
  };

  return (
    <View style={styles.card}>
      <Text style={styles.title} numberOfLines={1}>{order.challenge_title}</Text>
      <Text style={styles.meta}>
        {order.order_type === 'bet' ? '내기' : '응원'} · {order.amount.toLocaleString()}원 · {order.sender_nickname} → {order.recipient_nickname}
      </Text>
      <Text style={styles.meta}>{GIFT_STATUS_LABEL[order.status] ?? order.status} · {order.id.slice(0, 8)}</Text>

      <Pressable onPress={toggleEvents} hitSlop={6}>
        <Text style={styles.link}>{events ? '이력 닫기' : '이력 보기'}</Text>
      </Pressable>
      {events && (
        events.length === 0
          ? <Text style={styles.eventLine}>기록된 이력이 없어요 (감사 로그 도입 전 주문)</Text>
          : events.map((e, i) => (
              <Text key={i} style={styles.eventLine}>
                {new Date(e.created_at).toLocaleString('ko-KR')} · {e.from_status ?? '생성'} → {e.to_status} · {ACTOR_LABEL[e.actor_role]}{e.reason ? ` · ${e.reason}` : ''}
              </Text>
            ))
      )}

      {refundable && (
        <View style={styles.refundRow}>
          <TextInput
            style={[styles.input, styles.reasonInput]}
            value={reason}
            onChangeText={setReason}
            placeholder="환불 사유 (필수)"
            placeholderTextColor={colors.faint}
            maxLength={200}
          />
          <Pressable style={[styles.refundBtn, busy && styles.disabled]} onPress={onRefund} disabled={busy}>
            {busy ? <ActivityIndicator color={colors.onBrand} /> : <Text style={styles.refundBtnText}>환불</Text>}
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 12 },
  searchRow: { flexDirection: 'row', gap: 8 },
  input: {
    flex: 1, backgroundColor: colors.surface, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.line, paddingHorizontal: 12, paddingVertical: 10,
    fontSize: fontSize.base, color: colors.ink, fontFamily: fontFamily.regular,
  },
  searchBtn: { justifyContent: 'center', paddingHorizontal: 16, borderRadius: radius.md, backgroundColor: colors.accent },
  searchBtnText: { fontSize: fontSize.base, color: colors.onBrand, fontFamily: fontFamily.bold, fontWeight: fontWeight.bold },
  center: { alignItems: 'center', justifyContent: 'center', paddingVertical: 24 },
  list: { gap: 10 },
  card: { backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, padding: 12, gap: 4 },
  title: { fontSize: fontSize.base, color: colors.ink, fontFamily: fontFamily.bold, fontWeight: fontWeight.bold },
  meta: { fontSize: fontSize.sm, color: colors.faint, fontFamily: fontFamily.regular },
  link: { fontSize: fontSize.sm, color: colors.accent, fontFamily: fontFamily.bold, fontWeight: fontWeight.bold, marginTop: 4 },
  eventLine: { fontSize: fontSize.xs, color: colors.ink, fontFamily: fontFamily.regular, lineHeight: 17 },
  refundRow: { flexDirection: 'row', gap: 8, marginTop: 6 },
  reasonInput: { paddingVertical: 8 },
  refundBtn: { justifyContent: 'center', paddingHorizontal: 16, borderRadius: radius.md, backgroundColor: colors.danger },
  refundBtnText: { fontSize: fontSize.base, color: colors.onBrand, fontFamily: fontFamily.bold, fontWeight: fontWeight.bold },
  disabled: { opacity: 0.5 },
});
