// 🚀 명사·조직 지정 + 모집 캡 면제 — 검색 또는 두 목록에서 하다를 골라 지정 (운영 내부 도구)
//   0067: 검색어가 없으면 "성장 중인 누구나 하다"(면제 후보) + "면제된 하다" 두 소섹션.
//   면제를 주는 순간 후보에서 사라지므로, 면제된 하다를 따로 보여야 모니터링·해제가 가능하다.
import React, { useCallback, useState } from 'react';
import { View, Text, Pressable, TextInput, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import {
  adminSearchChallenges, adminListGrowingChallenges, adminListExemptChallenges,
  type AdminChallengeSearchResult,
} from '@/lib/db';
import { colors, fontFamily, fontSize, fontWeight, radius } from '@/lib/tokens';
import { HostTierCard } from './HostTierCard';
import { usePagedList, MoreButton } from './paged';

export function HostTierAssign() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<AdminChallengeSearchResult[]>([]);
  const [searching, setSearching] = useState(false);

  const growing = usePagedList(adminListGrowingChallenges);   // 면제 후보 (모집 중 + 미면제 + 100명↑)
  const exempt = usePagedList(adminListExemptChallenges);     // 이미 면제된 하다

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

  // 검색 결과에서 면제를 토글하면 두 목록 모두 달라진다 → 함께 갱신
  const reloadLists = useCallback(() => {
    growing.reload();
    exempt.reload();
  }, [growing, exempt]);

  // 검색 결과에서 바꾸면 검색 결과 자체도 최신화해야 토글 표시가 맞는다
  const onSearchResultChanged = useCallback(() => {
    onSearch();
    reloadLists();
  }, [onSearch, reloadLists]);

  const searchActive = query.trim().length > 0;

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

      {searchActive ? (
        searching ? (
          <View style={styles.center}><ActivityIndicator color={colors.accent} /></View>
        ) : (
          <View style={styles.list}>
            {results.map(item => (
              <HostTierCard key={item.id} item={item} onChanged={onSearchResultChanged} />
            ))}
          </View>
        )
      ) : (
        <>
          {/* 면제 후보 — 지금 면제를 줄지 판단하는 목록 */}
          <Text style={styles.sectionTitle}>성장 중인 하다 · 지정한 하다</Text>
          <Text style={styles.sectionHint}>
            모집 중이고 100명을 넘은 누구나 하다예요. 면제를 주면 기간 50% 자동 마감 없이 계속 자라요.
            {'\n'}이미 명사·공식으로 지정한 하다도 종류와 무관하게 여기 남아요.
          </Text>
          {growing.loading ? (
            <View style={styles.center}><ActivityIndicator color={colors.accent} /></View>
          ) : growing.items.length === 0 ? (
            <Text style={styles.empty}>성장 중인 하다가 없어요</Text>
          ) : (
            <View style={styles.list}>
              {growing.items.map(item => (
                <HostTierCard key={item.id} item={item} onChanged={reloadLists} />
              ))}
              {growing.hasMore && <MoreButton loading={growing.loadingMore} onPress={growing.loadMore} />}
            </View>
          )}

          {/* 면제된 하다 — 내가 무엇을 키우고 있는지 (해제도 여기서) */}
          <Text style={styles.sectionTitle}>면제된 하다</Text>
          <Text style={styles.sectionHint}>이미 면제된 하다예요. 해제할 수 있어요.</Text>
          {exempt.loading ? (
            <View style={styles.center}><ActivityIndicator color={colors.accent} /></View>
          ) : exempt.items.length === 0 ? (
            <Text style={styles.empty}>면제된 하다가 없어요</Text>
          ) : (
            <View style={styles.list}>
              {exempt.items.map(item => (
                <HostTierCard key={item.id} item={item} onChanged={reloadLists} />
              ))}
              {exempt.hasMore && <MoreButton loading={exempt.loadingMore} onPress={exempt.loadMore} />}
            </View>
          )}
        </>
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
  sectionTitle: { fontSize: fontSize.base, color: colors.ink, fontFamily: fontFamily.bold, fontWeight: fontWeight.bold, marginTop: 4 },
  sectionHint: { fontSize: fontSize.xs, color: colors.faint, fontFamily: fontFamily.regular, marginTop: -6, lineHeight: 17 },
  center: { alignItems: 'center', justifyContent: 'center', paddingVertical: 24 },
  empty: { fontSize: fontSize.sm, color: colors.faint, fontFamily: fontFamily.regular, textAlign: 'center', paddingVertical: 16 },
  list: { gap: 10 },
});
