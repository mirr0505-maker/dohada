// 🚀 명사·조직 지정 — 하다 검색 후 host_tier(개인/명사/공식) + 표시명 지정 (운영 내부 도구)
import React, { useCallback, useState } from 'react';
import { View, Text, Pressable, TextInput, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import {
  adminSearchChallenges, adminSetHostTier,
  type AdminChallengeSearchResult,
} from '@/lib/db';
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

export function HostTierAssign() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<AdminChallengeSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null); // 인라인 지정 UI 펼친 항목
  const [pickTier, setPickTier] = useState<Tier>('individual');
  const [pickLabel, setPickLabel] = useState('');
  const [applyingId, setApplyingId] = useState<string | null>(null);

  const onSearch = useCallback(async () => {
    const q = query.trim();
    if (!q) return;
    setSearching(true);
    try {
      setResults(await adminSearchChallenges(q));
    } catch (e: any) {
      Alert.alert('실패', e?.message ?? String(e));
    } finally {
      setSearching(false);
    }
  }, [query]);

  // 항목 펼치기 — 현재 값으로 tier/label 초기화
  const onOpen = useCallback((item: AdminChallengeSearchResult) => {
    if (openId === item.id) { setOpenId(null); return; }
    setOpenId(item.id);
    setPickTier((item.host_tier as Tier) ?? 'individual');
    setPickLabel(item.host_label ?? '');
  }, [openId]);

  const onApply = useCallback(async (item: AdminChallengeSearchResult) => {
    if (applyingId) return;
    setApplyingId(item.id);
    try {
      // individual 은 표시명 무시 → null
      const label = pickTier === 'individual' ? null : (pickLabel.trim() || null);
      await adminSetHostTier(item.id, pickTier, label);
      setResults(await adminSearchChallenges(query.trim()));
      setOpenId(null);
      Alert.alert('적용됨');
    } catch (e: any) {
      Alert.alert('실패', e?.message ?? String(e));
    } finally {
      setApplyingId(null);
    }
  }, [applyingId, pickTier, pickLabel, query]);

  return (
    <View style={styles.wrap}>
      <View style={styles.searchRow}>
        <TextInput
          style={styles.input}
          value={query}
          onChangeText={setQuery}
          placeholder="하다 제목 검색"
          placeholderTextColor={colors.faint}
          returnKeyType="search"
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
          {results.map(item => {
            const open = openId === item.id;
            const applying = applyingId === item.id;
            return (
              <View key={item.id} style={styles.card}>
                <Pressable onPress={() => onOpen(item)}>
                  <Text style={styles.title} numberOfLines={1}>{item.title}</Text>
                  <Text style={styles.meta}>
                    {item.kind} · {tierLabel(item.host_tier)}
                    {item.host_label ? ` · ${item.host_label}` : ''}
                  </Text>
                </Pressable>

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
                    <Pressable style={styles.applyBtn} disabled={applying} onPress={() => onApply(item)}>
                      <Text style={styles.applyBtnText}>{applying ? '적용 중…' : '적용'}</Text>
                    </Pressable>
                  </View>
                )}
              </View>
            );
          })}
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
  inputDisabled: { backgroundColor: colors.primary50, color: colors.faint },
  searchBtn: { justifyContent: 'center', paddingHorizontal: 16, borderRadius: radius.md, backgroundColor: colors.accent },
  searchBtnText: { fontSize: fontSize.base, color: colors.onBrand, fontFamily: fontFamily.bold, fontWeight: fontWeight.bold },
  center: { alignItems: 'center', justifyContent: 'center', paddingVertical: 24 },
  list: { gap: 10 },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: 14, gap: 4, ...shadow.sm },
  title: { fontSize: fontSize.base, color: colors.ink, fontFamily: fontFamily.bold, fontWeight: fontWeight.bold },
  meta: { fontSize: fontSize.xs, color: colors.faint, fontFamily: fontFamily.regular, marginTop: 2 },
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
