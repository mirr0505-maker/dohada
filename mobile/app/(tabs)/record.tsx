// 🚀 기록 탭 (리디자인 v2) — 앱 전체 Vlog 피드
// 챌린지방 LogTab 은 그 방 기록만, 이 탭은 도전 인연들의 기록 union. 카드 탭 → 방 기록 탭.
import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, Pressable, RefreshControl, ActivityIndicator, Image,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Film, MessageCircle, BookOpen, EyeOff } from 'lucide-react-native';
import { Screen } from '@/components/Screen';
import { AppHeader } from '@/components/AppHeader';
import { CategoryIcon } from '@/components/CategoryIcon';
import { colors, fontFamily, fontSize, fontWeight, radius, textStyle, shadow } from '@/lib/tokens';
import { categorySlugByName } from '@/lib/icons';
import { useSession } from '@/lib/session';
import { fetchRecentLogs } from '@/lib/db';
import { ErrorState } from '@/components/ErrorState';
import { haptic } from '@/lib/haptics';
import { formatCheerCount } from '@/lib/format';
import { reportError } from '@/lib/sentry';
import type { LogWithChallenge } from '@/lib/db';

export default function RecordScreen() {
  const session = useSession();
  const myUserId = session?.user?.id;
  const [logs, setLogs] = useState<LogWithChallenge[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!myUserId) return;
    try {
      setError(null);
      const list = await fetchRecentLogs(myUserId, 30);
      setLogs(list);
    } catch (e: any) {
      reportError(e, { where: 'record/load' });
      setError(e?.message ?? '불러오지 못했어요.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [myUserId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = useCallback(() => { setRefreshing(true); load(); }, [load]);

  return (
    <Screen backgroundColor={colors.bg}>
      <AppHeader />

      <View style={styles.intro}>
        <View style={styles.titleRow}>
          <Film size={22} color={colors.sub} strokeWidth={1.8} />
          <Text style={styles.title}>기록</Text>
        </View>
        <Text style={styles.sub}>하다 인연들의 여정 이야기</Text>
      </View>

      {loading ? (
        <View style={[styles.center, { flex: 1 }]}>
          <ActivityIndicator color={colors.brand} />
        </View>
      ) : error ? (
        <ErrorState message={error} onRetry={() => { setLoading(true); load(); }} />
      ) : logs.length === 0 ? (
        <View style={styles.empty}>
          <BookOpen size={48} color={colors.faint} strokeWidth={1.5} />
          <Text style={styles.emptyTitle}>아직 쌓인 기록이 없어요</Text>
          <Text style={styles.emptyDesc}>
            하다 방의 기록 탭에서{'\n'}여정의 한 장면을 남겨보세요.
          </Text>
        </View>
      ) : (
        <FlatList
          data={logs}
          keyExtractor={l => l.id}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40, paddingTop: 4, gap: 14 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brand} />
          }
          renderItem={({ item }) => <RecordCard log={item} />}
        />
      )}
    </Screen>
  );
}

function RecordCard({ log }: { log: LogWithChallenge }) {
  const catName = log.challenge.category?.name;

  return (
    <Pressable
      style={styles.card}
      onPress={() => { haptic.tap(); router.push(`/room/${log.challenge_id}?tab=log` as any); }}
    >
      {/* 헤더 */}
      <View style={styles.cardHead}>
        {log.author.avatar_url ? (
          <Image source={{ uri: log.author.avatar_url }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarFallback]}>
            <Text style={styles.avatarInit}>{log.author.nickname.slice(0, 1)}</Text>
          </View>
        )}
        <View style={{ flex: 1 }}>
          <Text style={styles.who} numberOfLines={1}>{log.author.nickname}</Text>
          <View style={styles.metaRow}>
            {catName ? <CategoryIcon slug={categorySlugByName[catName]} size={12} color={colors.faint} /> : null}
            <Text style={styles.meta} numberOfLines={1}>{log.challenge.title}</Text>
          </View>
        </View>
        <Text style={styles.time}>{relTime(log.created_at)}</Text>
      </View>

      {/* 🚀 숨김 기록: 증발 대신 자리에 '숨김 처리됨' 메시지 노출 */}
      {log.hidden ? (
        <View style={styles.hiddenBox}>
          <View style={styles.hiddenTitleRow}>
            <EyeOff size={16} color={colors.sub} strokeWidth={1.8} />
            <Text style={styles.hiddenTitle}>숨김 처리된 기록이에요</Text>
          </View>
          <Text style={styles.hiddenDesc}>운영 검토 중이에요</Text>
        </View>
      ) : (
        <>
          <Text style={styles.recTitle} numberOfLines={2}>{log.title}</Text>
          <Text style={styles.recBody} numberOfLines={3}>{log.content}</Text>

          {log.photo_url && <Image source={{ uri: log.photo_url }} style={styles.photo} />}

          {/* 푸터: 좋아요(❤️ 예외) · 댓글(lucide) — 99+ 정책 */}
          <View style={styles.footer}>
            <View style={styles.footMeta}>
              <Text style={styles.heart}>❤️</Text>
              <Text style={styles.footCount}>{formatCheerCount(log.like_count)}</Text>
            </View>
            <View style={styles.footMeta}>
              <MessageCircle size={15} color={colors.faint} strokeWidth={1.8} />
              <Text style={styles.footCount}>{formatCheerCount(log.comment_count)}</Text>
            </View>
            <Text style={styles.go}>이어 보기 →</Text>
          </View>
        </>
      )}
    </Pressable>
  );
}

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60_000) return '방금';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}분 전`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}시간 전`;
  if (diff < 604_800_000) return `${Math.floor(diff / 86_400_000)}일 전`;
  return iso.slice(0, 10);
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
  meta: { flex: 1, fontSize: fontSize.xs, color: colors.faint, fontFamily: fontFamily.regular },
  time: { fontSize: fontSize.xs, color: colors.faint, fontFamily: fontFamily.regular },

  recTitle: { ...textStyle.cardTitle, fontSize: fontSize.lg, color: colors.ink, letterSpacing: -0.3, marginTop: 2 },
  recBody: { fontSize: fontSize.sm, color: colors.ink, fontFamily: fontFamily.regular, lineHeight: 20 },
  photo: { width: '100%', aspectRatio: 16 / 9, borderRadius: radius.md, backgroundColor: colors.line, marginTop: 2 },

  hiddenBox: { backgroundColor: colors.lineSoft, borderRadius: radius.md, paddingVertical: 16, paddingHorizontal: 14, gap: 4, alignItems: 'center' },
  hiddenTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  hiddenTitle: { fontSize: fontSize.base, color: colors.ink, fontFamily: fontFamily.bold, fontWeight: fontWeight.semibold },
  hiddenDesc: { fontSize: fontSize.sm, color: colors.sub, fontFamily: fontFamily.regular, textAlign: 'center' },

  footer: { flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 4 },
  footMeta: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  heart: { fontSize: 14 },
  footCount: { fontSize: fontSize.xs, color: colors.sub, fontFamily: fontFamily.medium, fontWeight: fontWeight.medium },
  go: { marginLeft: 'auto', fontSize: fontSize.sm, color: colors.brandInk, fontFamily: fontFamily.bold, fontWeight: fontWeight.bold },
});
