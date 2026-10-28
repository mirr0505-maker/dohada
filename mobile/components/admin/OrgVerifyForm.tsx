// 🚀 0085: 조직 검증 기록 — org 지정 전에 9.2 ①실재 ②실무자 권한 ③계정 소유 확인 결과를 남긴다 (운영 내부 도구)
//   서버(admin_set_user_host_tier)가 유효 기록 없는 org 지정을 거부한다. 여긴 입력·노출 UX 뿐.
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, Pressable, TextInput, StyleSheet, Alert } from 'react-native';
import { adminListOrgVerifications, adminRecordOrgVerification, adminRevokeOrgVerification } from '@/lib/db';
import type { AdminOrgVerification, OrgProof, OrgType } from '@/lib/db';
import { colors, fontFamily, fontSize, fontWeight, radius } from '@/lib/tokens';

const ORG_TYPES: { v: OrgType; label: string }[] = [
  { v: 'company', label: '기업' }, { v: 'nonprofit', label: '비영리' }, { v: 'public', label: '공공기관' },
];
const PROOFS: { v: OrgProof; label: string }[] = [
  { v: 'biz_reg', label: '사업자등록증' }, { v: 'nts_status', label: '국세청 상태조회' },
  { v: 'corp_registry', label: '법인등기부' }, { v: 'unique_no', label: '고유번호증' },
  { v: 'official_letter', label: '기관·조직 공문' }, { v: 'employment', label: '재직증명·담당자 지정' },
  { v: 'domain_email', label: '공식 도메인 메일' },
];
// 조직이 "실재한다"는 증빙 — 서버 check 와 같은 규칙(서버가 최종 판정)
const EXISTENCE_PROOFS: OrgProof[] = ['biz_reg', 'corp_registry', 'unique_no', 'official_letter'];
const label = (list: { v: string; label: string }[], v: string) => list.find(o => o.v === v)?.label ?? v;

type User = { id: string; nickname: string; email: string | null; host_tier: string };
type Draft = Record<'legalName' | 'registrationNo' | 'officialDomain' | 'contactName' | 'contactRole' | 'contactEmail' | 'note', string>;
const EMPTY: Draft = { legalName: '', registrationNo: '', officialDomain: '', contactName: '', contactRole: '', contactEmail: '', note: '' };

// 9.2 ③ 참고 — 로그인 이메일 도메인이 공식 도메인(또는 그 하위)인지
function domainMatches(email: string | null, domain: string): boolean {
  const d = domain.trim().toLowerCase().replace(/^@/, '');
  const at = email?.toLowerCase().split('@')[1];
  return !!at && !!d && (at === d || at.endsWith('.' + d));
}

export function OrgVerifyForm({ user, onActiveChange }: { user: User; onActiveChange: (hasActive: boolean) => void }) {
  const [active, setActive] = useState<AdminOrgVerification | null>(null);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [orgType, setOrgType] = useState<OrgType>('company');
  const [proofs, setProofs] = useState<OrgProof[]>([]);
  const [draft, setDraft] = useState<Draft>(EMPTY);

  const load = useCallback(async () => {
    try {
      const cur = (await adminListOrgVerifications(user.id)).find(r => r.revoked_at === null) ?? null;
      setActive(cur);
      onActiveChange(!!cur);
    } catch (e: any) {
      Alert.alert('실패', e?.message ?? String(e));
    }
  }, [user.id, onActiveChange]);
  useEffect(() => { load(); }, [load]);

  // 새로 기록 — 유효 기록이 있으면 그 내용으로 채워 담당자만 바꾸기 쉽게
  const openForm = useCallback(() => {
    setOrgType(active?.org_type ?? 'company');
    setProofs(active?.proofs ?? []);
    setDraft(active ? {
      legalName: active.legal_name, registrationNo: active.registration_no ?? '',
      officialDomain: active.official_domain ?? '', contactName: active.contact_name ?? '',
      contactRole: active.contact_role ?? '', contactEmail: active.contact_email ?? '', note: active.note ?? '',
    } : EMPTY);
    setEditing(true);
  }, [active]);

  const save = useCallback(async () => {
    if (busy) return;
    if (!draft.legalName.trim()) { Alert.alert('법적 명칭을 적어 주세요'); return; }
    if (!proofs.some(p => EXISTENCE_PROOFS.includes(p))) {
      Alert.alert('조직 실재 증빙이 필요해요', '사업자등록증·법인등기부·고유번호증·공문 중 하나 이상');
      return;
    }
    setBusy(true);
    try {
      await adminRecordOrgVerification({ userId: user.id, orgType, proofs, ...draft });
      setEditing(false);
      await load();
    } catch (e: any) {
      Alert.alert('실패', e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  }, [busy, draft, proofs, orgType, user.id, load]);

  const onRevoke = useCallback(() => {
    Alert.alert('검증 해지', `${user.nickname}님의 조직 검증 기록을 해지해요. 기록은 이력으로 남아요.`, [
      { text: '취소', style: 'cancel' },
      { text: '해지', style: 'destructive', onPress: async () => {
        try { await adminRevokeOrgVerification(user.id); await load(); }
        catch (e: any) { Alert.alert('실패', e?.message ?? String(e)); }
      } },
    ]);
  }, [user.id, user.nickname, load]);

  const field = (key: keyof Draft, placeholder: string) => (
    <TextInput
      style={styles.input} value={draft[key]} placeholder={placeholder} placeholderTextColor={colors.faint}
      autoCapitalize="none" onChangeText={t => setDraft(d => ({ ...d, [key]: t }))}
    />
  );
  const chip = (on: boolean, text: string, onPress: () => void, key: string) => (
    <Pressable key={key} style={[styles.chip, on && styles.chipOn]} onPress={onPress}>
      <Text style={[styles.chipText, on && styles.chipTextOn]}>{text}</Text>
    </Pressable>
  );

  return (
    <View style={styles.wrap}>
      <Text style={styles.heading}>조직 검증 기록</Text>
      {active ? (
        <View style={styles.summary}>
          <Text style={styles.body}>{label(ORG_TYPES, active.org_type)} · {active.legal_name}</Text>
          <Text style={styles.meta}>
            {[active.registration_no, active.official_domain].filter(Boolean).join(' · ') || '등록번호·도메인 없음'}
          </Text>
          <View style={styles.chipRow}>
            {active.proofs.map(p => <Text key={p} style={styles.tag}>{label(PROOFS, p)}</Text>)}
          </View>
          <Text style={styles.meta}>
            담당 {[active.contact_name, active.contact_role, active.contact_email].filter(Boolean).join(' · ') || '없음'}
          </Text>
          <Text style={styles.meta}>확인 {active.verified_by_nickname ?? '?'} · {active.verified_at.slice(0, 10)}</Text>
        </View>
      ) : (
        <Text style={styles.meta}>기록 없음 — 공식 지정 전에 먼저 기록해야 해요.</Text>
      )}

      {!editing && (
        <View style={styles.chipRow}>
          <Pressable style={styles.linkBtn} onPress={openForm}>
            <Text style={styles.linkText}>{active ? '새로 기록 (담당자 교체 등)' : '검증 기록하기'}</Text>
          </Pressable>
          {active && user.host_tier !== 'org' && (
            <Pressable style={styles.linkBtn} onPress={onRevoke}>
              <Text style={styles.dangerText}>검증 해지</Text>
            </Pressable>
          )}
        </View>
      )}

      {editing && (
        <View style={styles.form}>
          <View style={styles.chipRow}>
            {ORG_TYPES.map(o => chip(orgType === o.v, o.label, () => setOrgType(o.v), o.v))}
          </View>
          {field('legalName', '법적 명칭 (필수)')}
          {field('registrationNo', '사업자·고유번호')}
          {field('officialDomain', '공식 도메인 (예: doinno.co.kr)')}
          {!!draft.officialDomain.trim() && (
            <Text style={styles.meta}>
              로그인 이메일 {domainMatches(user.email, draft.officialDomain) ? '✓ 도메인 일치' : '도메인 불일치'} (계정 소유 확인 ③ 참고)
            </Text>
          )}
          <Text style={styles.meta}>확인한 증빙 (조직 실재 증빙 1개 이상)</Text>
          <View style={styles.chipRow}>
            {PROOFS.map(p => chip(proofs.includes(p.v), p.label, () =>
              setProofs(cur => cur.includes(p.v) ? cur.filter(x => x !== p.v) : [...cur, p.v]), p.v))}
          </View>
          {field('contactName', '담당자 이름')}
          {field('contactRole', '담당자 직책')}
          {field('contactEmail', '담당자 이메일')}
          {field('note', '메모')}
          <Text style={styles.meta}>원본 서류는 앱에 저장하지 않아요 — 운영 메일함에 보관해요.</Text>
          <View style={styles.chipRow}>
            <Pressable style={styles.saveBtn} disabled={busy} onPress={save}>
              <Text style={styles.saveText}>{busy ? '저장 중…' : '저장'}</Text>
            </Pressable>
            <Pressable style={styles.linkBtn} onPress={() => setEditing(false)}>
              <Text style={styles.linkText}>취소</Text>
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  heading: { fontSize: fontSize.sm, color: colors.ink, fontFamily: fontFamily.bold, fontWeight: fontWeight.bold },
  summary: { gap: 4 },
  body: { fontSize: fontSize.sm, color: colors.ink, fontFamily: fontFamily.medium, fontWeight: fontWeight.medium },
  meta: { fontSize: fontSize.xs, color: colors.faint, fontFamily: fontFamily.regular },
  form: { gap: 8 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center' },
  chip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: radius.pill, backgroundColor: colors.primary50, borderWidth: 1, borderColor: colors.line },
  chipOn: { backgroundColor: colors.brandTint, borderColor: colors.brand },
  chipText: { fontSize: fontSize.xs, color: colors.sub, fontFamily: fontFamily.medium, fontWeight: fontWeight.medium },
  chipTextOn: { color: colors.brandInk, fontFamily: fontFamily.bold, fontWeight: fontWeight.bold },
  tag: { fontSize: fontSize.xs, color: colors.sub, fontFamily: fontFamily.regular, backgroundColor: colors.primary50, borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 2 },
  input: {
    backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line,
    paddingHorizontal: 12, paddingVertical: 8, fontSize: fontSize.sm, color: colors.ink, fontFamily: fontFamily.regular,
  },
  linkBtn: { paddingVertical: 6, paddingHorizontal: 4 },
  linkText: { fontSize: fontSize.sm, color: colors.brandInk, fontFamily: fontFamily.bold, fontWeight: fontWeight.bold },
  dangerText: { fontSize: fontSize.sm, color: colors.danger, fontFamily: fontFamily.bold, fontWeight: fontWeight.bold },
  saveBtn: { paddingVertical: 8, paddingHorizontal: 20, borderRadius: radius.md, backgroundColor: colors.accent },
  saveText: { fontSize: fontSize.sm, color: colors.onBrand, fontFamily: fontFamily.bold, fontWeight: fontWeight.bold },
});
