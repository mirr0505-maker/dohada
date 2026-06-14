// 🚀 기록 탭 (v2.5) — 앱 전체 Vlog 피드
//
// 챌린지방 안의 LogTab 은 그 방의 기록만, 이 탭은 도전 인연들의 기록 union.
// "오늘의 인증" 과는 다른 추억성 콘텐츠 — 더 길고, 사진과 함께 이야기.
// 카드 탭 → 챌린지방 → 기록 탭 (Phase 1.5 에 기록 단일 라우트 추가 검토)
import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, Pressable, RefreshControl,
  ActivityIndicator, Image,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Screen } from '@/components/Screen';
import { AppHeader } from '@/components/AppHeader';
import { colors, fontFamily, fontSize, fontWeight, radius, shadow } from '@/lib/tokens';
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
    <Screen backgroundColor={colors.background}>
      <AppHeader />

      <View style={styles.intro}>
        <Text style={styles.title}>🎥 기록</Text>
        <Text style={styles.sub}>하다 인연들의 여정 이야기</Text>
      </View>

      {loading ? (
        <View style={[styles.center, { flex: 1 }]}>
          <ActivityIndicator color={colors.accent} />
        </View>
      ) : error ? (
        <ErrorState message={error} onRetry={() => { setLoading(true); load(); }} />
      ) : logs.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyEmoji}>📓</Text>
          <Text style={styles.emptyTitle}>아직 쌓인 기록이 없어요</Text>
          <Text style={styles.emptyDesc}>
            하다 방의 기록 탭에서{'\n'}
            여정의 한 장면을 남겨보세요.
          </Text>
        </View>
      ) : (
        <FlatList
          data={logs}
          keyExtractor={l => l.id}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40, paddingTop: 4, gap: 14 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />
          }
          renderItem={({ item }) => <RecordCard log={item} />}
        />
      )}
    </Screen>
  );
}

function RecordCard({ log }: { log: LogWithChallenge }) {
  const categoryEmoji = log.challenge.category?.emoji ?? '🎯';

  return (
    <Pressable
      style={styles.card}
      onPress={() => {
        haptic.tap();
        router.push(`/room/${log.challenge_id}?tab=log` as any);
      }}
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
          <Text style={styles.meta} numberOfLines={1}>
            {categoryEmoji} {log.challenge.title}
          </Text>
        </View>
        <Text style={styles.time}>{relTime(log.created_at)}</Text>
      </View>

      {/* 본문 */}
      <Text style={styles.recTitle} numberOfLines={2}>{log.title}</Text>
      <Text style={styles.recBody} numberOfLines={3}>{log.content}</Text>

      {/* 사진 */}
      {log.photo_url && (
        <Image source={{ uri: log.photo_url }} style={styles.photo} />
      )}

      {/* 푸터: 응원·댓글 카운트 (99+ 정책) */}
      <View style={styles.footer}>
        <View style={styles.metaRow}>
          <Text style={styles.metaIcon}>❤️</Text>
          <Text style={styles.metaCount}>{formatCheerCount(log.like_count)}</Text>
        </View>
        <View style={styles.metaRow}>
          <Text style={styles.metaIcon}>💬</Text>
          <Text style={styles.metaCount}>{formatCheerCount(log.comment_count)}</Text>
        </View>
        <Text style={styles.go}>이어 보기 →</Text>
      </View>
    </Pressable>
  );
}

function relTime(iso: string): string {
  const t = new Date(iso).getTime();
  const diff = Date.now() - t;
  if (diff < 60_000) return '방금';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}분 전`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}시간 전`;
  if (diff < 604_800_000) return `${Math.floor(diff / 86_400_000)}일 전`;
  return iso.slice(0, 10);
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },

  intro: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12 },
  title: {
    fontSize: fontSize['2xl'], color: colors.primary,
    fontFamily: fontFamily.bold, fontWeight: fontWeight.bold,
    letterSpacing: -0.5,
  },
  sub: {
    fontSize: fontSize.sm, color: colors.primary500,
    fontFamily: fontFamily.medium, fontWeight: fontWeight.medium,
    marginTop: 4,
  },

  empty: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 32, gap: 8,
  },
  emptyEmoji: { fontSize: 48 },
  emptyTitle: {
    fontSize: fontSize.lg, color: colors.primary,
    fontFamily: fontFamily.bold, fontWeight: fontWeight.bold,
  },
  emptyDesc: {
    fontSize: fontSize.sm, color: colors.primary500,
    fontFamily: fontFamily.regular,
    textAlign: 'center', lineHeight: 20,
  },

  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: 16,
    gap: 10,
    ...shadow.sm,
  },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: colors.accent50, overflow: 'hidden',
  },
  avatarFallback: { alignItems: 'center', justifyContent: 'center' },
  avatarInit: {
    fontSize: 14, color: colors.accent700,
    fontFamily: fontFamily.bold, fontWeight: fontWeight.bold,
  },
  who: {
    fontSize: fontSize.base, color: colors.primary,
    fontFamily: fontFamily.bold, fontWeight: fontWeight.semibold,
  },
  meta: {
    fontSize: fontSize.xs, color: colors.primary500,
    fontFamily: fontFamily.regular, marginTop: 1,
  },
  time: {
    fontSize: fontSize.xs, color: colors.primary500,
    fontFamily: fontFamily.regular,
  },

  recTitle: {
    fontSize: fontSize.lg, color: colors.primary,
    fontFamily: fontFamily.bold, fontWeight: fontWeight.bold,
    letterSpacing: -0.3,
    marginTop: 2,
  },
  recBody: {
    fontSize: fontSize.sm, color: colors.primary,
    fontFamily: fontFamily.regular,
    lineHeight: 20,
  },
  photo: {
    width: '100%', aspectRatio: 16 / 9,
    borderRadius: radius.md,
    backgroundColor: colors.primary100,
    marginTop: 2,
  },

  footer: {
    flexDirection: 'row', alignItems: 'center', gap: 16,
    marginTop: 4,
  },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaIcon: { fontSize: 13 },
  metaCount: {
    fontSize: fontSize.xs, color: colors.primary500,
    fontFamily: fontFamily.medium, fontWeight: fontWeight.medium,
  },
  go: {
    marginLeft: 'auto',
    fontSize: fontSize.sm, color: colors.accent,
    fontFamily: fontFamily.bold, fontWeight: fontWeight.bold,
  },
});
