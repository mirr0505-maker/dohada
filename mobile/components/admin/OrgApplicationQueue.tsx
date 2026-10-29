// 🚀 조직 가입 신청 큐 — 조직 메일 코드로 가입한 계정을 운영자가 승인/거절 (0087, ORG_HADA_PLAN §10.2 A-7)
//   승인 = 검증 기록(메일) + 공식 지정(소급·알림) 이 서버 한 트랜잭션. 서류는 받지 않는다.
//   거절 사유는 신청자 대기 화면에 그대로 보인다.
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, Pressable, TextInput, StyleSheet, ActivityIndicator, Alert, Linking } from 'react-native';
import { adminListOrgApplications, adminApproveOrgApplication, adminRejectOrgApplication } from '@/lib/org';
import type { AdminOrgApplication } from '@/lib/org';
import { emailDomain, isPersonalEmailDomain } from '@/lib/orgEmail';
import { colors, fontFamily, fontSize, fontWeight, radius, shadow } from '@/lib/tokens';

const ORG_TYPE_LABEL: Record<string, string> = {
  company: '기업', sole: '개인사업자', nonprofit: '비영리·단체', public: '공공기관', group: '모임',
};

// 유형별로 운영자가 확인할 것 (0090) — 승인 시 서버가 같은 항목을 검증 기록에 남긴다
const CHECK_HINT: Record<string, string> = {
  sole: '홈택스 사업자 상태조회로 번호·상호가 살아 있는지 확인',
  group: '활동 링크를 열어 실제로 활동하는 모임인지 확인, 필요하면 메일로 의견 교환',
};

export function OrgApplicationQueue() {
  const [items, setItems] = useState<AdminOrgApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectNote, setRejectNote] = useState('');

  const reload = useCallback(async () => {
    try { setItems(await adminListOrgApplications('pending')); }
    catch (e: any) { Alert.alert('불러오지 못했어요', e?.message ?? String(e)); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { reload(); }, [reload]);

  const run = async (id: string, job: () => Promise<void>) => {
    setBusyId(id);
    try { await job(); setRejectingId(null); setRejectNote(''); await reload(); }
    catch (e: any) { Alert.alert('실패', e?.message ?? String(e)); }
    finally { setBusyId(null); }
  };

  // 승인은 알림이 나가고 공식 배지가 붙는다 → 확인 1단계
  const onApprove = (a: AdminOrgApplication) => Alert.alert(
    '조직 승인',
    `${a.legal_name} 을(를) 공식 주최자로 열어요. 계정에 알림이 가요.`,
    [{ text: '취소', style: 'cancel' }, { text: '승인', onPress: () => run(a.user_id, () => adminApproveOrgApplication(a.user_id, '')) }],
  );

  if (loading) return <View style={styles.center}><ActivityIndicator color={colors.accent} /></View>;

  return (
    <View style={styles.wrap}>
      <Text style={styles.hint}>
        메일 코드 인증을 마친 신청이에요. 조직은 이름·번호·메일 도메인을, 개인사업자는 사업자 상태를, 모임은 활동 링크를 보고 승인해 주세요.
      </Text>
      {items.length === 0 ? (
        <Text style={styles.empty}>대기 중인 신청이 없어요</Text>
      ) : items.map(a => {
        const busy = busyId === a.user_id;
        return (
          <View key={a.user_id} style={styles.card}>
            <Text style={styles.title}>{a.legal_name}</Text>
            <Text style={styles.meta}>
              {ORG_TYPE_LABEL[a.org_type] ?? a.org_type} · 번호 {a.registration_no ?? '없음'} · 도메인 {emailDomain(a.contact_email)}
              {isPersonalEmailDomain(a.contact_email) ? ' · ⚠️ 개인 메일' : ''}
            </Text>
            {!!a.activity_url && (
              <Pressable onPress={() => Linking.openURL(a.activity_url!.startsWith('http') ? a.activity_url! : `https://${a.activity_url}`)}>
                <Text style={styles.linkText} numberOfLines={1}>활동 링크 열기 · {a.activity_url}</Text>
              </Pressable>
            )}
            {!!CHECK_HINT[a.org_type] && <Text style={styles.meta}>확인: {CHECK_HINT[a.org_type]}</Text>}
            <Text style={styles.meta}>
              {a.contact_name} · {a.contact_email}{a.contact_phone ? ` · ${a.contact_phone}` : ''}
            </Text>
            <Text style={styles.meta}>신청 {a.created_at.slice(0, 10)}</Text>

            {rejectingId === a.user_id ? (
              <View style={{ gap: 6, marginTop: 6 }}>
                <TextInput
                  style={styles.input} value={rejectNote} onChangeText={setRejectNote}
                  placeholder="거절 사유 (신청자에게 보여요)" placeholderTextColor={colors.faint}
                />
                <View style={styles.actions}>
                  <Pressable style={styles.actionBtn} disabled={busy || !rejectNote.trim()}
                    onPress={() => run(a.user_id, () => adminRejectOrgApplication(a.user_id, rejectNote))}>
                    <Text style={styles.rejectText}>거절 확정</Text>
                  </Pressable>
                  <Pressable style={styles.actionBtn} onPress={() => { setRejectingId(null); setRejectNote(''); }}>
                    <Text style={styles.cancelText}>취소</Text>
                  </Pressable>
                </View>
              </View>
            ) : (
              <View style={styles.actions}>
                <Pressable style={styles.actionBtn} disabled={busy} onPress={() => onApprove(a)}>
                  <Text style={styles.approveText}>승인</Text>
                </Pressable>
                <Pressable style={styles.actionBtn} disabled={busy} onPress={() => setRejectingId(a.user_id)}>
                  <Text style={styles.cancelText}>거절</Text>
                </Pressable>
                {/* 🚀 0090: 승인 전 의견 교환 — 신청자 메일로 바로 */}
                <Pressable style={styles.actionBtn} onPress={() => Linking.openURL(`mailto:${a.contact_email}?subject=${encodeURIComponent(`[Do:하다] ${a.legal_name} 가입 확인`)}`)}>
                  <Text style={styles.cancelText}>메일 보내기</Text>
                </Pressable>
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 10 },
  center: { alignItems: 'center', justifyContent: 'center', paddingVertical: 24 },
  hint: { fontSize: fontSize.xs, color: colors.faint, fontFamily: fontFamily.regular, lineHeight: 17 },
  empty: { fontSize: fontSize.base, color: colors.faint, fontFamily: fontFamily.regular, textAlign: 'center', paddingVertical: 24 },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: 14, gap: 4, ...shadow.sm },
  title: { fontSize: fontSize.base, color: colors.ink, fontFamily: fontFamily.bold, fontWeight: fontWeight.bold },
  meta: { fontSize: fontSize.xs, color: colors.sub, fontFamily: fontFamily.regular },
  actions: { flexDirection: 'row', gap: 8, marginTop: 6 },
  actionBtn: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: radius.sm, backgroundColor: colors.primary50 },
  approveText: { fontSize: fontSize.sm, color: colors.brandInk, fontFamily: fontFamily.bold, fontWeight: fontWeight.bold },
  rejectText: { fontSize: fontSize.sm, color: colors.danger, fontFamily: fontFamily.bold, fontWeight: fontWeight.bold },
  linkText: { fontSize: fontSize.xs, color: colors.brandInk, fontFamily: fontFamily.bold, fontWeight: fontWeight.bold },
  cancelText: { fontSize: fontSize.sm, color: colors.sub, fontFamily: fontFamily.bold, fontWeight: fontWeight.bold },
  input: {
    backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line,
    paddingHorizontal: 12, paddingVertical: 8, fontSize: fontSize.sm, color: colors.ink, fontFamily: fontFamily.regular,
  },
});
