// 🚀 파장 탭 — 기여 피드 (v1).
//   슬림 헤더(나의 응원·이번 주·세상 기부 3수치 컴팩트 스트립) + 자동 이벤트 피드(참조/완주/기부).
//   비교/랭킹 아님 — 숫자는 겨루는 점수가 아니라 조용히 번지는 이야기. (사용자 글·반응은 v2)
import React, { useCallback, useState } from 'react';
import { View, Text, FlatList, StyleSheet, ActivityIndicator } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Waves } from 'lucide-react-native';
import { Screen } from '@/components/Screen';
import { AppHeader } from '@/components/AppHeader';
import { FeedCard } from '@/components/parang/FeedCard';
import { PostCard } from '@/components/parang/PostCard';
import {
  fetchParangStats, fetchParangFeed, fetchParangPosts,
  type ParangStats, type ParangFeedItem, type ParangPost,
} from '@/lib/db';
import { formatCheerCount } from '@/lib/format';
import { colors, fontFamily, fontSize, fontWeight, radius, textStyle } from '@/lib/tokens';

// 🚀 파장 피드 v2b — 자동 이벤트(FeedCard)와 사용자 기여 글(PostCard)을 created_at 기준 하나로 병합.
//   타입이 달라 kind 로 분기해 렌더한다.
type MergedItem =
  | { kind: 'event'; created_at: string; event: ParangFeedItem }
  | { kind: 'post'; created_at: string; post: ParangPost };

export default function ParangScreen() {
  const [stats, setStats] = useState<ParangStats | null>(null);
  const [feed, setFeed] = useState<MergedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const load = useCallback(() => {
    setFailed(false);
    Promise.all([fetchParangStats(), fetchParangFeed(), fetchParangPosts()])
      .then(([s, events, posts]) => {
        setStats(s);
        const merged: MergedItem[] = [
          ...events.map(e => ({ kind: 'event' as const, created_at: e.created_at, event: e })),
          ...posts.map(p => ({ kind: 'post' as const, created_at: p.created_at, post: p })),
        ].sort((a, b) => (a.created_at < b.created_at ? 1 : -1));   // 최신순
        setFeed(merged);
      })
      .catch(() => setFailed(true))
      .finally(() => setLoading(false));
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  // 슬림 헤더 3수치 — 큰 3층 대시보드 대체. 100+ 는 99+ 로 약화(비교 압박 방지).
  const cells = stats
    ? [
        { label: '나의 응원', value: formatCheerCount(stats.mine.cheers_given) },
        { label: '이번 주', value: formatCheerCount(stats.ours.week_cheers) },
        { label: '세상 기부', value: formatCheerCount(stats.world.donated_count) },
      ]
    : [];

  const header = (
    <View>
      <View style={styles.intro}>
        <View style={styles.titleRow}>
          <Waves size={22} color={colors.sub} strokeWidth={1.8} />
          <Text style={styles.title}>파장</Text>
        </View>
        <Text style={styles.sub}>당신의 한 걸음이 번져가는 곳</Text>
      </View>

      <View style={styles.strip}>
        {cells.map((c, i) => (
          <React.Fragment key={c.label}>
            {i > 0 ? <View style={styles.divider} /> : null}
            <View style={styles.cell}>
              <Text style={styles.cellValue}>{c.value}</Text>
              <Text style={styles.cellLabel}>{c.label}</Text>
            </View>
          </React.Fragment>
        ))}
      </View>
    </View>
  );

  return (
    <Screen backgroundColor={colors.bg}>
      <AppHeader />

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={colors.brand} /></View>
      ) : failed ? (
        <View style={styles.center}>
          <Text style={styles.failText}>
            잠시 물결이 닿지 않았어요.{'\n'}다시 들어오면 담겨요.
          </Text>
        </View>
      ) : (
        <FlatList
          data={feed}
          keyExtractor={(item, i) =>
            item.kind === 'post' ? `post-${item.post.post_id}` : `event-${item.event.event_type}-${item.created_at}-${i}`
          }
          renderItem={({ item }) =>
            item.kind === 'post' ? <PostCard post={item.post} /> : <FeedCard item={item.event} />
          }
          ListHeaderComponent={header}
          ListEmptyComponent={
            <Text style={styles.empty}>
              아직 번진 파장은 조용해요.{'\n'}작은 걸음 하나가 곧 물결이 돼요.
            </Text>
          }
          ListFooterComponent={
            feed.length > 0
              ? <Text style={styles.footNote}>파장은 겨루는 점수가 아니라, 조용히 번지는 이야기예요.</Text>
              : null
          }
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  intro: { paddingTop: 8, paddingBottom: 12 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { ...textStyle.greeting, color: colors.ink, letterSpacing: -0.5 },
  sub: { fontSize: fontSize.sm, color: colors.faint, fontFamily: fontFamily.regular, marginTop: 4 },

  // 컴팩트 스트립 (중립 카드 + 브랜드 강조 숫자만)
  strip: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.xl,
    paddingVertical: 16,
    marginBottom: 16,
  },
  cell: { flex: 1, alignItems: 'center', gap: 4 },
  divider: { width: 1, backgroundColor: colors.line, marginVertical: 4 },
  cellValue: { fontSize: fontSize.xl, color: colors.brand, fontFamily: fontFamily.bold, fontWeight: fontWeight.bold },
  cellLabel: { fontSize: fontSize.sm, color: colors.sub, fontFamily: fontFamily.regular },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  failText: { fontSize: fontSize.base, color: colors.faint, fontFamily: fontFamily.regular, textAlign: 'center', lineHeight: 22 },

  empty: { fontSize: fontSize.base, color: colors.faint, fontFamily: fontFamily.regular, textAlign: 'center', lineHeight: 22, paddingTop: 24 },
  scroll: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 40 },
  footNote: {
    fontSize: fontSize.sm,
    color: colors.faint,
    fontFamily: fontFamily.regular,
    textAlign: 'center',
    lineHeight: 20,
    marginTop: 8,
  },
});
