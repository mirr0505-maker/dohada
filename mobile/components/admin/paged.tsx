// 🚀 운영 콘솔 목록 공통 — 10건씩 "더보기" 페이지네이션 (승격 심사 큐 · 면제 후보 · 면제된 하다)
//   목록이 3개로 늘면서 같은 상태(items/offset/hasMore/중복탭 방지)를 세 번 쓰게 돼 한 곳으로 묶었다.
import React from 'react';
import { Pressable, Text, StyleSheet, Alert } from 'react-native';
import { colors, fontFamily, fontSize, fontWeight, radius } from '@/lib/tokens';

const PAGE_SIZE = 10;

// fetchPage 는 호출부에서 안정된 참조여야 한다 (모듈 함수 또는 useCallback) — 아니면 매 렌더 재조회.
export function usePagedList<T>(fetchPage: (limit: number, offset: number) => Promise<T[]>) {
  const [items, setItems] = React.useState<T[]>([]);
  const [loading, setLoading] = React.useState(true);          // 첫 페이지 로드
  const [loadingMore, setLoadingMore] = React.useState(false); // 더보기 진행 중 (중복 탭 방지)
  const [hasMore, setHasMore] = React.useState(false);

  // 첫 페이지부터 다시 — 목록을 바꾸는 액션(면제 토글·심사) 후 호출
  const reload = React.useCallback(async () => {
    setLoading(true);
    try {
      const rows = await fetchPage(PAGE_SIZE, 0);
      setItems(rows);
      setHasMore(rows.length === PAGE_SIZE);   // 꽉 찼으면 다음 페이지가 있을 수 있다
    } catch (e: any) {
      Alert.alert('실패', e?.message ?? String(e));
      setItems([]);
      setHasMore(false);
    } finally {
      setLoading(false);
    }
  }, [fetchPage]);

  React.useEffect(() => { reload(); }, [reload]);

  const loadMore = React.useCallback(async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const rows = await fetchPage(PAGE_SIZE, items.length);
      setItems(prev => [...prev, ...rows]);
      setHasMore(rows.length === PAGE_SIZE);   // 마지막 페이지(10건 미만)면 더보기 숨김
    } catch (e: any) {
      Alert.alert('실패', e?.message ?? String(e));
    } finally {
      setLoadingMore(false);
    }
  }, [fetchPage, hasMore, items.length, loadingMore]);

  return { items, loading, loadingMore, hasMore, loadMore, reload };
}

export function MoreButton({ loading, onPress }: { loading: boolean; onPress: () => void }) {
  return (
    <Pressable style={styles.moreBtn} disabled={loading} onPress={onPress}>
      <Text style={styles.moreText}>{loading ? '불러오는 중…' : '더보기'}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  moreBtn: {
    alignItems: 'center', paddingVertical: 10, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface,
  },
  moreText: { fontSize: fontSize.sm, color: colors.sub, fontFamily: fontFamily.bold, fontWeight: fontWeight.bold },
});
