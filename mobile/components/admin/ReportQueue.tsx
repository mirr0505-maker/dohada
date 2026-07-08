// 🚀 신고 큐 — pending 신고를 카드로 나열, 숨기기/처리완료/무시 액션 (운영 내부 도구)
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import {
  adminListReports, adminSetContentHidden, adminResolveReport,
  type AdminReport, type ReportTargetType,
} from '@/lib/db';
import { colors, fontFamily, fontSize, fontWeight, radius, shadow } from '@/lib/tokens';

// 🚀 대상 유형 한글 배지 라벨 (ReportQueue 로컬 — 공용 파일 만들지 않음, 중복 허용)
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

export function ReportQueue() {
  const [reports, setReports] = useState<AdminReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    adminListReports()
      .then(setReports)
      .catch(() => setReports([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  // 액션 공통 — 진행 중 중복 방지 + 실패 Alert + 성공 시 목록 새로고침
  const runAction = useCallback(async (id: string, fn: () => Promise<void>) => {
    if (busyId) return;
    setBusyId(id);
    try {
      await fn();
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
  if (reports.length === 0) {
    return <Text style={styles.empty}>검토할 신고가 없어요</Text>;
  }

  return (
    <View style={styles.list}>
      {reports.map(r => {
        const busy = busyId === r.report_id;
        return (
          <View key={r.report_id} style={styles.card}>
            <View style={styles.topRow}>
              <View style={styles.badge}><Text style={styles.badgeText}>{targetLabel(r.target_type)}</Text></View>
              <Text style={styles.reason}>{r.reason}</Text>
              {r.is_hidden ? <Text style={styles.hiddenTag}>숨김 중</Text> : null}
            </View>
            {r.preview ? (
              <Text style={styles.preview} numberOfLines={2}>{r.preview.slice(0, 80)}</Text>
            ) : null}
            {r.detail ? <Text style={styles.detail}>{r.detail}</Text> : null}
            <Text style={styles.meta}>
              작성자 {r.author_nickname ?? '알수없음'} · 신고자 {r.reporter_nickname ?? '알수없음'}
            </Text>
            <View style={styles.actions}>
              <Pressable
                style={styles.actionBtn}
                disabled={busy}
                onPress={() => runAction(r.report_id, () => adminSetContentHidden(r.target_type, r.target_id, !r.is_hidden))}
              >
                <Text style={styles.dangerText}>{r.is_hidden ? '숨김 해제' : '숨기기'}</Text>
              </Pressable>
              <Pressable
                style={styles.actionBtn}
                disabled={busy}
                onPress={() => runAction(r.report_id, () => adminResolveReport(r.report_id, 'reviewed'))}
              >
                <Text style={styles.doneText}>처리완료</Text>
              </Pressable>
              <Pressable
                style={styles.actionBtn}
                disabled={busy}
                onPress={() => runAction(r.report_id, () => adminResolveReport(r.report_id, 'dismissed'))}
              >
                <Text style={styles.dangerText}>무시</Text>
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
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  badge: { backgroundColor: colors.primary100, borderRadius: radius.sm, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { fontSize: fontSize.xs, color: colors.primary700, fontFamily: fontFamily.medium, fontWeight: fontWeight.medium },
  reason: { fontSize: fontSize.base, color: colors.ink, fontFamily: fontFamily.bold, fontWeight: fontWeight.bold },
  hiddenTag: { fontSize: fontSize.xs, color: colors.danger, fontFamily: fontFamily.bold, fontWeight: fontWeight.bold },
  preview: { fontSize: fontSize.sm, color: colors.sub, fontFamily: fontFamily.regular, lineHeight: 18 },
  detail: { fontSize: fontSize.sm, color: colors.primary500, fontFamily: fontFamily.regular, lineHeight: 18 },
  meta: { fontSize: fontSize.xs, color: colors.faint, fontFamily: fontFamily.regular },
  actions: { flexDirection: 'row', gap: 8, marginTop: 2 },
  actionBtn: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: radius.sm, backgroundColor: colors.primary50 },
  dangerText: { fontSize: fontSize.sm, color: colors.danger, fontFamily: fontFamily.bold, fontWeight: fontWeight.bold },
  doneText: { fontSize: fontSize.sm, color: colors.done, fontFamily: fontFamily.bold, fontWeight: fontWeight.bold },
});
