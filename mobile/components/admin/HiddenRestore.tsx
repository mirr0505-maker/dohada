// 🚀 숨김 복구 — 숨겨진 콘텐츠 전체를 카드로 나열, [복구] 로 오판 되돌리기 (운영 내부 도구)
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import {
  adminListHidden, adminSetContentHidden,
  type AdminHiddenItem, type ReportTargetType,
} from '@/lib/db';
import { colors, fontFamily, fontSize, fontWeight, radius, shadow } from '@/lib/tokens';

// 🚀 대상 유형 한글 배지 라벨 (HiddenRestore 로컬 — 공용 파일 만들지 않음, 중복 허용)
function targetLabel(t: ReportTargetType): string {
  switch (t) {
    case 'proof': return '인증';
    case 'comment': return '댓글';
    case 'log_comment': return '기록댓글';
    case 'log': return '기록';
    case 'story': return '완주이야기';
    case 'chat': return '대화';
  }
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

export function HiddenRestore() {
  const [items, setItems] = useState<AdminHiddenItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    adminListHidden()
      .then(setItems)
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const onRestore = useCallback(async (item: AdminHiddenItem) => {
    if (busyId) return;
    setBusyId(item.target_id);
    try {
      await adminSetContentHidden(item.target_type, item.target_id, false);
      load();
    } catch (e: any) {
      Alert.alert('실패', e?.message ?? String(e));
    } finally {
      setBusyId(null);
    }
  }, [busyId, load]);

  if (loading) {
    return <View style={styles.center}><ActivityIndicator color={colors.accent} /></View>;
  }
  if (items.length === 0) {
    return <Text style={styles.empty}>숨겨진 콘텐츠가 없어요</Text>;
  }

  return (
    <View style={styles.list}>
      {items.map(item => {
        const busy = busyId === item.target_id;
        return (
          <View key={`${item.target_type}-${item.target_id}`} style={styles.card}>
            <View style={styles.topRow}>
              <View style={styles.badge}><Text style={styles.badgeText}>{targetLabel(item.target_type)}</Text></View>
              <Text style={styles.date}>{formatDate(item.created_at)}</Text>
            </View>
            {item.preview ? (
              <Text style={styles.preview} numberOfLines={2}>{item.preview.slice(0, 80)}</Text>
            ) : null}
            <Text style={styles.meta}>작성자 {item.author_nickname ?? '알수없음'}</Text>
            <View style={styles.actions}>
              <Pressable style={styles.actionBtn} disabled={busy} onPress={() => onRestore(item)}>
                <Text style={styles.restoreText}>복구</Text>
              </Pressable>
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center', paddingVertical: 24 },
  empty: { fontSize: fontSize.base, color: colors.faint, fontFamily: fontFamily.regular, textAlign: 'center', paddingVertical: 24 },
  list: { gap: 12 },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: 14, gap: 8, ...shadow.sm },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  badge: { backgroundColor: colors.primary100, borderRadius: radius.sm, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { fontSize: fontSize.xs, color: colors.primary700, fontFamily: fontFamily.medium, fontWeight: fontWeight.medium },
  date: { fontSize: fontSize.xs, color: colors.faint, fontFamily: fontFamily.regular },
  preview: { fontSize: fontSize.sm, color: colors.sub, fontFamily: fontFamily.regular, lineHeight: 18 },
  meta: { fontSize: fontSize.xs, color: colors.faint, fontFamily: fontFamily.regular },
  actions: { flexDirection: 'row', marginTop: 2 },
  actionBtn: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: radius.sm, backgroundColor: colors.primary50 },
  restoreText: { fontSize: fontSize.sm, color: colors.done, fontFamily: fontFamily.bold, fontWeight: fontWeight.bold },
});
