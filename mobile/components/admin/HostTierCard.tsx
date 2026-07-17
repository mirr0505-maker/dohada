// 🚀 하다 1건 카드 — 캡 면제 토글 + host_tier(개인/명사/공식)·표시명 지정
//   HostTierAssign 의 세 목록(검색 결과 · 면제 후보 · 면제된 하다)이 같은 카드를 쓴다.
import React, { useCallback, useState } from 'react';
import { View, Text, Pressable, TextInput, StyleSheet, Alert } from 'react-native';
import { adminSetHostTier, adminSetRecruitExempt, type AdminChallengeSearchResult } from '@/lib/db';
import { colors, fontFamily, fontSize, fontWeight, radius, shadow } from '@/lib/tokens';

type Tier = 'individual' | 'figure' | 'org';
const TIER_OPTIONS: { tier: Tier; label: string }[] = [
  { tier: 'individual', label: '개인' },
  { tier: 'figure', label: '명사' },
  { tier: 'org', label: '공식' },
];

// 현재 host_tier 문자열 → 한글 표시
function tierLabel(t: string): string {
  return TIER_OPTIONS.find(o => o.tier === t)?.label ?? '개인';
}

// 검색 결과엔 member_count 가 없다 (누적은 목록 RPC 만 계산)
export type AdminChallengeCardItem = AdminChallengeSearchResult & { member_count?: number };

export function HostTierCard({ item, onChanged }: { item: AdminChallengeCardItem; onChanged: () => void }) {
  const [open, setOpen] = useState(false);            // 인라인 지정 UI 펼침
  const [pickTier, setPickTier] = useState<Tier>('individual');
  const [pickLabel, setPickLabel] = useState('');
  const [applying, setApplying] = useState(false);
  const [exempting, setExempting] = useState(false);

  // 펼칠 때 현재 값으로 초기화
  const onToggleOpen = useCallback(() => {
    if (open) { setOpen(false); return; }
    setPickTier((item.host_tier as Tier) ?? 'individual');
    setPickLabel(item.host_label ?? '');
    setOpen(true);
  }, [open, item.host_tier, item.host_label]);

  const onApply = useCallback(async () => {
    if (applying) return;
    setApplying(true);
    try {
      // individual 은 표시명 무시 → null
      const label = pickTier === 'individual' ? null : (pickLabel.trim() || null);
      await adminSetHostTier(item.id, pickTier, label);
      onChanged();
      setOpen(false);
      Alert.alert('적용됨');
    } catch (e: any) {
      Alert.alert('실패', e?.message ?? String(e));
    } finally {
      setApplying(false);
    }
  }, [applying, pickTier, pickLabel, item.id, onChanged]);

  // 🚀 0064: 모집 캡 면제 토글 — 면제된 누구나 하다만 기간 50% 자동 마감 없이 계속 자란다.
  //   승격은 별개 축이다 (0067 심사) — 면제는 성장 조건일 뿐 승격 조건이 아니다.
  const onToggleExempt = useCallback(async () => {
    if (exempting) return;
    setExempting(true);
    try {
      await adminSetRecruitExempt(item.id, !item.recruit_cap_exempt);
      onChanged();
    } catch (e: any) {
      Alert.alert('실패', e?.message ?? String(e));
    } finally {
      setExempting(false);
    }
  }, [exempting, item.id, item.recruit_cap_exempt, onChanged]);

  return (
    <View style={styles.card}>
      <Pressable onPress={onToggleOpen}>
        <Text style={styles.title} numberOfLines={1}>{item.title}</Text>
        <Text style={styles.meta}>
          {item.kind} · {tierLabel(item.host_tier)}
          {item.host_label ? ` · ${item.host_label}` : ''}
          {item.member_count !== undefined ? ` · 누적 ${item.member_count}명` : ''}
        </Text>
      </Pressable>

      {/* 캡 면제는 누구나(open) 하다에만 의미가 있다 — 서버도 거부.
          🚀 0074: 단 조직(org) 하다는 광장이라 kind 무관 면제 가능 → 토글 노출 */}
      {(item.kind === 'open' || item.host_tier === 'org') && (
        <Pressable
          style={[styles.exemptRow, item.recruit_cap_exempt && styles.exemptRowOn]}
          disabled={exempting}
          onPress={onToggleExempt}
        >
          <Text style={[styles.exemptText, item.recruit_cap_exempt && styles.exemptTextOn]}>
            {item.recruit_cap_exempt ? '✓ 모집 캡 면제 — 계속 자람' : '모집 캡 면제'}
          </Text>
          <Text style={styles.exemptAction}>
            {exempting ? '적용 중…' : item.recruit_cap_exempt ? '해제' : '부여'}
          </Text>
        </Pressable>
      )}

      {open && (
        <View style={styles.editArea}>
          <View style={styles.tierRow}>
            {TIER_OPTIONS.map(opt => {
              const on = pickTier === opt.tier;
              return (
                <Pressable
                  key={opt.tier}
                  style={[styles.tierChip, on && styles.tierChipOn]}
                  onPress={() => setPickTier(opt.tier)}
                >
                  <Text style={[styles.tierChipText, on && styles.tierChipTextOn]}>{opt.label}</Text>
                </Pressable>
              );
            })}
          </View>
          <TextInput
            style={[styles.input, pickTier === 'individual' && styles.inputDisabled]}
            value={pickTier === 'individual' ? '' : pickLabel}
            onChangeText={setPickLabel}
            editable={pickTier !== 'individual'}
            placeholder={pickTier === 'individual' ? '개인은 표시명 없음' : '주최자 표시명'}
            placeholderTextColor={colors.faint}
          />
          <Pressable style={styles.applyBtn} disabled={applying} onPress={onApply}>
            <Text style={styles.applyBtnText}>{applying ? '적용 중…' : '적용'}</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: 14, gap: 4, ...shadow.sm },
  title: { fontSize: fontSize.base, color: colors.ink, fontFamily: fontFamily.bold, fontWeight: fontWeight.bold },
  meta: { fontSize: fontSize.xs, color: colors.faint, fontFamily: fontFamily.regular, marginTop: 2 },
  input: {
    flex: 1, backgroundColor: colors.surface, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.line, paddingHorizontal: 12, paddingVertical: 10,
    fontSize: fontSize.base, color: colors.ink, fontFamily: fontFamily.regular,
  },
  inputDisabled: { backgroundColor: colors.primary50, color: colors.faint },
  exemptRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginTop: 8, paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.primary50,
  },
  exemptRowOn: { borderColor: colors.gold, backgroundColor: colors.surface },
  exemptText: { fontSize: fontSize.sm, color: colors.sub, fontFamily: fontFamily.medium, fontWeight: fontWeight.medium },
  exemptTextOn: { color: colors.gold, fontFamily: fontFamily.bold, fontWeight: fontWeight.bold },
  exemptAction: { fontSize: fontSize.xs, color: colors.faint, fontFamily: fontFamily.bold, fontWeight: fontWeight.bold },
  editArea: { gap: 10, marginTop: 10, paddingTop: 10, borderTopWidth: 0.5, borderTopColor: colors.line },
  tierRow: { flexDirection: 'row', gap: 8 },
  tierChip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.pill,
    backgroundColor: colors.primary50, borderWidth: 1, borderColor: colors.line,
  },
  tierChipOn: { backgroundColor: colors.brandTint, borderColor: colors.brand },
  tierChipText: { fontSize: fontSize.sm, color: colors.sub, fontFamily: fontFamily.medium, fontWeight: fontWeight.medium },
  tierChipTextOn: { color: colors.brandInk, fontFamily: fontFamily.bold, fontWeight: fontWeight.bold },
  applyBtn: { alignItems: 'center', paddingVertical: 10, borderRadius: radius.md, backgroundColor: colors.accent },
  applyBtnText: { fontSize: fontSize.base, color: colors.onBrand, fontFamily: fontFamily.bold, fontWeight: fontWeight.bold },
});
