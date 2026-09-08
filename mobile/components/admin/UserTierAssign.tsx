// 🚀 0081: 사람 티어 지정 — 운영팀이 섭외한 사람을 검색해 직접 명사·공식으로 올린다 (운영 내부 도구)
//   승격 심사 큐(0067)는 "누적 1,000명을 넘어 자라난 사람"용. 여긴 "밖에서 섭외한 사람"용 — 두 경로는 독립이다.
//   권한 강제는 서버(admin_set_user_host_tier 의 is_admin). 여긴 노출·UX 뿐이다.
import React, { useCallback, useState } from 'react';
import { View, Text, Pressable, TextInput, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { adminSearchUsers, adminSetUserHostTier, type AdminUserSearchResult } from '@/lib/db';
import { colors, fontFamily, fontSize, fontWeight, radius, shadow } from '@/lib/tokens';

type Tier = 'individual' | 'figure' | 'org';

// HostTierCard(하다 티어)와 같은 3택·같은 라벨 — 운영자가 두 섹션에서 같은 말을 본다
const TIER_OPTIONS: { tier: Tier; label: string }[] = [
  { tier: 'individual', label: '개인' },
  { tier: 'figure', label: '명사' },
  { tier: 'org', label: '공식' },
];

function tierLabel(t: string): string {
  return TIER_OPTIONS.find(o => o.tier === t)?.label ?? '개인';
}

// 확인 Alert 문구 — 지정이 실제로 무엇을 바꾸는지 정직하게 (칭호 + 광장 무대 + 알림)
function confirmMessage(tier: Tier, nickname: string): string {
  if (tier === 'individual') {
    return `${nickname}님의 칭호를 떼요. 금빛 링과 표식이 사라지고, 그 사람의 하다는 광장 무대에서 내려와요.`;
  }
  const title = tier === 'figure' ? '유명인 칭호(금빛 링·⭐)' : '공식 표식(금빛 링·🏛️)';
  return `${nickname}님에게 ${title}가 붙어요. 그 사람의 진행 중인 누구나 하다가 광장 무대에 올라가고, 본인에게 알림이 가요.`;
}

// 사람 1명 카드 — 탭하면 티어 3택이 펼쳐진다
function UserTierCard({ item, onChanged }: { item: AdminUserSearchResult; onChanged: () => void }) {
  const [open, setOpen] = useState(false);
  const [pickTier, setPickTier] = useState<Tier>('individual');
  const [applying, setApplying] = useState(false);

  const onToggleOpen = useCallback(() => {
    if (open) { setOpen(false); return; }
    setPickTier((item.host_tier as Tier) ?? 'individual');
    setOpen(true);
  }, [open, item.host_tier]);

  const apply = useCallback(async () => {
    if (applying) return;
    setApplying(true);
    try {
      await adminSetUserHostTier(item.id, pickTier);
      setOpen(false);
      onChanged();
      Alert.alert('적용됨');
    } catch (e: any) {
      Alert.alert('실패', e?.message ?? String(e));
    } finally {
      setApplying(false);
    }
  }, [applying, item.id, pickTier, onChanged]);

  // 칭호는 되돌리기 어려운 성격(알림이 이미 나간다) → 확인 1단계
  const onApply = useCallback(() => {
    Alert.alert(
      `${tierLabel(pickTier)}으로 지정`,
      confirmMessage(pickTier, item.nickname),
      [{ text: '취소', style: 'cancel' }, { text: '지정', onPress: apply }],
    );
  }, [pickTier, item.nickname, apply]);

  return (
    <View style={styles.card}>
      <Pressable onPress={onToggleOpen}>
        <Text style={styles.title} numberOfLines={1}>{item.nickname}</Text>
        {/* 이메일은 동명이인을 가려내는 유일한 단서 — 운영자 콘솔 안에서만 보인다 */}
        <Text style={styles.meta} numberOfLines={1}>{item.email ?? '이메일 없음'}</Text>
        <Text style={styles.meta}>
          {tierLabel(item.host_tier)}
          {item.early_tier ? ` · ${item.early_tier}` : ''}
          {` · 가입 ${item.created_at.slice(0, 10)}`}
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
          <Pressable style={styles.applyBtn} disabled={applying} onPress={onApply}>
            <Text style={styles.applyBtnText}>{applying ? '적용 중…' : '적용'}</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

export function UserTierAssign() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<AdminUserSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);   // 빈 결과 문구는 한 번이라도 검색한 뒤에만

  const onSearch = useCallback(async () => {
    const q = query.trim();
    if (!q) return;             // 빈 검색으로 전체를 긁지 않는다
    setSearching(true);
    try {
      setResults(await adminSearchUsers(q));
      setSearched(true);
    } catch (e: any) {
      Alert.alert('실패', e?.message ?? String(e));
    } finally {
      setSearching(false);
    }
  }, [query]);

  return (
    <View style={styles.wrap}>
      <Text style={styles.hint}>
        섭외한 사람을 직접 명사·공식으로 올려요. 자라난 사람은 위 승격 심사에서.
      </Text>

      <View style={styles.searchRow}>
        <TextInput
          style={styles.input}
          value={query}
          onChangeText={setQuery}
          placeholder="닉네임 또는 이메일 검색"
          placeholderTextColor={colors.faint}
          autoCapitalize="none"
          returnKeyType="search"
          onSubmitEditing={onSearch}
        />
        <Pressable style={styles.searchBtn} onPress={onSearch}>
          <Text style={styles.searchBtnText}>검색</Text>
        </Pressable>
      </View>

      {searching ? (
        <View style={styles.center}><ActivityIndicator color={colors.accent} /></View>
      ) : results.length === 0 ? (
        searched ? <Text style={styles.empty}>찾은 사람이 없어요</Text> : null
      ) : (
        <View style={styles.list}>
          {results.map(item => (
            <UserTierCard key={item.id} item={item} onChanged={onSearch} />
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 12 },
  hint: { fontSize: fontSize.xs, color: colors.faint, fontFamily: fontFamily.regular, lineHeight: 17 },
  searchRow: { flexDirection: 'row', gap: 8 },
  input: {
    flex: 1, backgroundColor: colors.surface, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.line, paddingHorizontal: 12, paddingVertical: 10,
    fontSize: fontSize.base, color: colors.ink, fontFamily: fontFamily.regular,
  },
  searchBtn: { justifyContent: 'center', paddingHorizontal: 16, borderRadius: radius.md, backgroundColor: colors.accent },
  searchBtnText: { fontSize: fontSize.base, color: colors.onBrand, fontFamily: fontFamily.bold, fontWeight: fontWeight.bold },
  center: { alignItems: 'center', justifyContent: 'center', paddingVertical: 24 },
  empty: { fontSize: fontSize.sm, color: colors.faint, fontFamily: fontFamily.regular, textAlign: 'center', paddingVertical: 16 },
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
