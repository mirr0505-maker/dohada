// 🚀 승격 심사 — 1,000명을 넘은 누구나 하다를 운영자가 승인/보류 (0067, 운영 내부 도구)
//   자동 승격은 폐지됐다 — 유명인 칭호는 사람이 축복해서 붙는다.
//   ⚠️ 면제(recruit_cap_exempt)는 승격 조건이 아니다 — 면제 없이 자란 하다도 큐에 온다(표시만).
import React, { useCallback, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { adminListPromotionQueue, adminReviewPromotion, type AdminPromotionCandidate } from '@/lib/db';
import { colors, fontFamily, fontSize, fontWeight, radius, shadow } from '@/lib/tokens';
import { usePagedList, MoreButton } from './paged';

export function PromotionQueue() {
  const { items, loading, loadingMore, hasMore, loadMore, reload } = usePagedList(adminListPromotionQueue);
  const [busyId, setBusyId] = useState<string | null>(null);

  const review = useCallback(async (item: AdminPromotionCandidate, approve: boolean) => {
    if (busyId) return;
    setBusyId(item.id);
    try {
      await adminReviewPromotion(item.id, approve);
      await reload();
    } catch (e: any) {
      Alert.alert('실패', e?.message ?? String(e));
    } finally {
      setBusyId(null);
    }
  }, [busyId, reload]);

  // 승인은 되돌릴 수 없다 (영구 승격 + 개설자에게 알림 발송) → 확인 1단계
  const onApprove = useCallback((item: AdminPromotionCandidate) => {
    Alert.alert(
      '승격 승인',
      `${item.creator_nickname ?? '개설자'}님에게 유명인 칭호가 붙고 알림이 가요. 되돌릴 수 없어요.`,
      [{ text: '취소', style: 'cancel' }, { text: '승인', onPress: () => review(item, true) }],
    );
  }, [review]);

  if (loading) {
    return <View style={styles.center}><ActivityIndicator color={colors.accent} /></View>;
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.hint}>
        1,000명을 넘은 누구나 하다예요. 승인하면 개설자에게 금빛 링과 ⭐이 붙어요.
      </Text>

      {items.length === 0 ? (
        <Text style={styles.empty}>심사할 하다가 없어요</Text>
      ) : (
        <View style={styles.list}>
          {items.map(item => {
            const busy = busyId === item.id;
            return (
              <View key={item.id} style={styles.card}>
                <Text style={styles.title} numberOfLines={1}>{item.title}</Text>
                <Text style={styles.meta}>
                  {item.creator_nickname ?? '알수없음'} · 누적 {item.member_count}명
                  {item.recruit_cap_exempt ? ' · 캡 면제' : ''}
                </Text>
                <View style={styles.actions}>
                  <Pressable style={styles.actionBtn} disabled={busy} onPress={() => onApprove(item)}>
                    <Text style={styles.approveText}>승인</Text>
                  </Pressable>
                  <Pressable style={styles.actionBtn} disabled={busy} onPress={() => review(item, false)}>
                    <Text style={styles.declineText}>보류</Text>
                  </Pressable>
                </View>
              </View>
            );
          })}
          {hasMore && <MoreButton loading={loadingMore} onPress={loadMore} />}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 10 },
  center: { alignItems: 'center', justifyContent: 'center', paddingVertical: 24 },
  hint: { fontSize: fontSize.xs, color: colors.faint, fontFamily: fontFamily.regular, lineHeight: 17 },
  empty: { fontSize: fontSize.base, color: colors.faint, fontFamily: fontFamily.regular, textAlign: 'center', paddingVertical: 24 },
  list: { gap: 10 },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: 14, gap: 4, ...shadow.sm },
  title: { fontSize: fontSize.base, color: colors.ink, fontFamily: fontFamily.bold, fontWeight: fontWeight.bold },
  meta: { fontSize: fontSize.xs, color: colors.faint, fontFamily: fontFamily.regular, marginTop: 2 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 6 },
  actionBtn: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: radius.sm, backgroundColor: colors.primary50 },
  approveText: { fontSize: fontSize.sm, color: colors.gold, fontFamily: fontFamily.bold, fontWeight: fontWeight.bold },
  declineText: { fontSize: fontSize.sm, color: colors.sub, fontFamily: fontFamily.bold, fontWeight: fontWeight.bold },
});
