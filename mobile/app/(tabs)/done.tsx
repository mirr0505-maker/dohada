// 🚀 해냈어요 공개 탭 (리디자인 v2)
// 정체성: "줄세우지 않고, 서로에게 용기를" — 최신순만(랭킹 X), 시스템 통계 미니 + 발췌 + 용기 받은 N명.
// 카드 탭 → /done/[id] 상세 ("나도 도전 시작하기" CTA)
import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, Pressable, RefreshControl, ActivityIndicator, Image,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Trophy, HeartHandshake, Sprout } from 'lucide-react-native';
import { Screen } from '@/components/Screen';
import { AppHeader } from '@/components/AppHeader';
import { CategoryIcon } from '@/components/CategoryIcon';
import { colors, fontFamily, fontSize, fontWeight, radius, textStyle, shadow } from '@/lib/tokens';
import { categorySlugByName } from '@/lib/icons';
import { fetchPublicCompletionStories } from '@/lib/db';
import { formatCheerCount, displayTitle } from '@/lib/format';
import { ErrorState } from '@/components/ErrorState';
import { haptic } from '@/lib/haptics';
import { reportError } from '@/lib/sentry';
import type { CompletionStoryCard } from '@/lib/types';

export default function DoneScreen() {
  const [stories, setStories] = useState<CompletionStoryCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const list = await fetchPublicCompletionStories({ limit: 30 });
      setStories(list);
    } catch (e: any) {
      reportError(e, { where: 'done/load' });
      setError(e?.message ?? '불러오지 못했어요.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = useCallback(() => { setRefreshing(true); load(); }, [load]);

  return (
    <Screen backgroundColor={colors.bg}>
      <AppHeader />

      <View style={styles.intro}>
        <View style={styles.titleRow}>
          <Trophy size={22} color={colors.gold} strokeWidth={1.8} />
          <Text style={styles.title}>해냈어요</Text>
        </View>
        <Text style={styles.sub}>줄세우지 않고, 서로에게 용기를.</Text>
      </View>

      {loading ? (
        <View style={[styles.center, { flex: 1 }]}>
          <ActivityIndicator color={colors.brand} />
        </View>
      ) : error ? (
        <ErrorState message={error} onRetry={() => { setLoading(true); load(); }} />
      ) : stories.length === 0 ? (
        <View style={styles.empty}>
          <Sprout size={48} color={colors.faint} strokeWidth={1.5} />
          <Text style={styles.emptyTitle}>아직 공개된 이야기가 없어요</Text>
          <Text style={styles.emptyDesc}>
            완주한 동료들의 증언이{'\n'}여기에 차곡차곡 쌓일 거예요.
          </Text>
        </View>
      ) : (
        <FlatList
          data={stories}
          keyExtractor={s => s.id}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40, paddingTop: 4, gap: 14 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brand} />
          }
          renderItem={({ item }) => <StoryCard story={item} />}
        />
      )}
    </Screen>
  );
}

// ─── 카드 ───
function StoryCard({ story }: { story: CompletionStoryCard }) {
  const excerpt = pickFirst([
    story.story, story.advice_to_starters, story.helped_when_giving_up,
    story.hardest, story.own_tip, story.what_changed,
  ]);
  const catName = story.challenge.category?.name;

  return (
    <Pressable
      style={styles.card}
      onPress={() => { haptic.tap(); router.push(`/done/${story.id}` as any); }}
    >
      {/* 헤더: 아바타 + 닉네임 + 카테고리 + 트로피 */}
      <View style={styles.cardHead}>
        {story.author.avatar_url ? (
          <Image source={{ uri: story.author.avatar_url }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarFallback]}>
            <Text style={styles.avatarInit}>{story.author.nickname.slice(0, 1)}</Text>
          </View>
        )}
        <View style={{ flex: 1 }}>
          <Text style={styles.who} numberOfLines={1}>{story.author.nickname}</Text>
          <View style={styles.metaRow}>
            {catName ? <CategoryIcon slug={categorySlugByName[catName]} size={12} color={colors.faint} /> : null}
            <Text style={styles.sub2} numberOfLines={1}>{catName ?? '하다'}</Text>
          </View>
        </View>
        <Trophy size={20} color={colors.gold} strokeWidth={1.8} />
      </View>

      <Text style={styles.chTitle} numberOfLines={2}>{displayTitle(story.challenge.title)}</Text>

      {/* 통계 미니 4칸 */}
      <View style={styles.statsRow}>
        <MiniStat num={story.total_days}                  label="일" />
        <MiniStat num={story.longest_streak}              label="연속" />
        <MiniStat num={story.proof_count}                 label="인증" />
        <MiniStat num={Math.round(story.completion_rate)} label="% 완주" />
      </View>

      {excerpt && <Text style={styles.excerpt} numberOfLines={3}>"{excerpt}"</Text>}

      {story.photo_urls.length > 0 && (
        <Image source={{ uri: story.photo_urls[0] }} style={styles.photoPreview} />
      )}

      {/* 푸터: 용기 받은 N명 + 보러 가기 */}
      <View style={styles.cardFooter}>
        <View style={styles.courageRow}>
          <HeartHandshake size={16} color={colors.gold} strokeWidth={1.8} />
          <Text style={styles.courageHint}>
            {story.courage_count > 0
              ? `${formatCheerCount(story.courage_count)}명이 용기를 얻었어요`
              : '다음 사람에게 용기가 되는 이야기'}
          </Text>
        </View>
        <Text style={styles.go}>읽으러 →</Text>
      </View>
    </Pressable>
  );
}

function MiniStat({ num, label }: { num: number; label: string }) {
  return (
    <View style={styles.miniCell}>
      <Text style={styles.miniNum}>{num}</Text>
      <Text style={styles.miniLabel}>{label}</Text>
    </View>
  );
}

function pickFirst(list: (string | null | undefined)[]): string | null {
  for (const s of list) if (s && s.trim()) return s.trim();
  return null;
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },

  intro: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { ...textStyle.greeting, color: colors.ink, letterSpacing: -0.5 },
  sub: { fontSize: fontSize.sm, color: colors.faint, fontFamily: fontFamily.regular, marginTop: 4 },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, gap: 10 },
  emptyTitle: { fontSize: fontSize.lg, color: colors.ink, fontFamily: fontFamily.bold, fontWeight: fontWeight.bold },
  emptyDesc: { fontSize: fontSize.sm, color: colors.faint, fontFamily: fontFamily.regular, textAlign: 'center', lineHeight: 20 },

  card: {
    backgroundColor: colors.surface, borderRadius: radius.xl,
    borderWidth: 0.5, borderColor: colors.line,
    padding: 16, gap: 10, ...shadow.sm,
  },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.brandTint, overflow: 'hidden' },
  avatarFallback: { alignItems: 'center', justifyContent: 'center' },
  avatarInit: { fontSize: 14, color: colors.brandInk, fontFamily: fontFamily.bold, fontWeight: fontWeight.bold },
  who: { fontSize: fontSize.base, color: colors.ink, fontFamily: fontFamily.bold, fontWeight: fontWeight.semibold },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 1 },
  sub2: { flex: 1, fontSize: fontSize.xs, color: colors.faint, fontFamily: fontFamily.regular },

  chTitle: { ...textStyle.cardTitle, fontSize: fontSize.lg, color: colors.ink, letterSpacing: -0.3, marginTop: 2 },

  statsRow: { flexDirection: 'row', gap: 6, backgroundColor: colors.tintWarm, borderRadius: radius.md, padding: 12 },
  miniCell: { flex: 1, alignItems: 'center' },
  miniNum: { fontSize: fontSize.xl, color: colors.ink, fontFamily: fontFamily.bold, fontWeight: fontWeight.bold },
  miniLabel: { fontSize: 11, color: colors.faint, fontFamily: fontFamily.regular, marginTop: 1 },

  excerpt: { fontSize: fontSize.sm, color: colors.ink, fontFamily: fontFamily.regular, lineHeight: 20 },
  photoPreview: { width: '100%', aspectRatio: 16 / 9, borderRadius: radius.md, backgroundColor: colors.line, marginTop: 2 },

  cardFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
  courageRow: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 },
  courageHint: { flex: 1, fontSize: fontSize.xs, color: colors.sub, fontFamily: fontFamily.regular },
  go: { fontSize: fontSize.sm, color: colors.brandInk, fontFamily: fontFamily.bold, fontWeight: fontWeight.bold },
});
