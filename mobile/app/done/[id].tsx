// 🚀 완주 이야기 상세 (v2.5 — 해냈어요)
//
// 진입: 해냈어요 공개 탭 카드 또는 박제 → 본인 이야기 보기
// 정체성: 자랑 X · 증언 ✓
//   - 시스템 통계 4칸 (조작 불가)
//   - 작성한 옵션 필드만 노출 (빈 항목은 표시 X)
//   - "나도 [카테고리] 도전 시작하기" CTA → 신규 유입 루프
//   - 반응 ("용기 받았어요") 은 Phase 1.5 placeholder (베타엔 안내 Alert)
//   - 본인 글이면 우상단 메뉴 → 삭제
import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, Image, Alert, ActivityIndicator,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '@/components/Screen';
import { colors, fontFamily, fontSize, fontWeight, radius, shadow } from '@/lib/tokens';
import { useSession } from '@/lib/session';
import { fetchCompletionStory, deleteCompletionStory } from '@/lib/db';
import { haptic } from '@/lib/haptics';
import type { CompletionStoryCard } from '@/lib/types';

// 작성된 옵션 필드만 노출 — 외부 결과물 순서 그대로
const FIELD_ORDER: { key: keyof CompletionStoryCard; label: string }[] = [
  { key: 'story',                 label: '한 줄 소감' },
  { key: 'hardest',               label: '가장 어려웠던 점은?' },
  { key: 'helped_when_giving_up', label: '포기하고 싶을 때 뭐가 도왔나?' },
  { key: 'advice_to_starters',    label: '시작하는 사람에게 한마디' },
  { key: 'own_tip',               label: '나만의 방법 · 꿀팁' },
  { key: 'what_changed',          label: '이 도전으로 무엇이 달라졌나?' },
];

export default function CompletionStoryDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const session = useSession();
  const myUserId = session?.user?.id;

  const [story, setStory] = useState<CompletionStoryCard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        setError(null);
        const s = await fetchCompletionStory(id);
        if (!s) {
          setError('이야기를 찾을 수 없거나 열람 권한이 없어요.');
          return;
        }
        setStory(s);
      } catch (e: any) {
        setError(e?.message ?? '불러오지 못했어요.');
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const isMine = story?.user_id === myUserId;

  // 본인 글 삭제
  const onDelete = useCallback(() => {
    if (!story) return;
    haptic.tap();
    Alert.alert(
      '이 이야기를 삭제할까요?',
      '한 번 삭제하면 되돌릴 수 없어요.',
      [
        { text: '취소', style: 'cancel' },
        {
          text: '삭제',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteCompletionStory(story.id);
              haptic.success();
              router.back();
            } catch (e: any) {
              Alert.alert('삭제 실패', e?.message ?? String(e));
            }
          },
        },
      ],
    );
  }, [story]);

  // "용기 받았어요" — 베타엔 Phase 1.5 placeholder
  const onCourage = useCallback(() => {
    haptic.tap();
    Alert.alert(
      '용기 받았어요',
      '반응을 보낼 수 있는 기능은 Phase 1.5 에서 열려요.\n지금은 이야기로만 응원해주세요.',
    );
  }, []);

  // "나도 도전 시작하기" — 신규 유입 루프
  const onStartSimilar = useCallback(() => {
    if (!story) return;
    haptic.tap();
    // 카테고리 prefill — create.tsx 가 query 받도록 베타 단계에선 단순 라우팅
    router.push('/create' as any);
  }, [story]);

  if (loading) {
    return (
      <Screen backgroundColor={colors.background}>
        <View style={[styles.center, { flex: 1 }]}>
          <ActivityIndicator color={colors.accent} />
        </View>
      </Screen>
    );
  }
  if (error || !story) {
    return (
      <Screen backgroundColor={colors.background}>
        <View style={[styles.center, { flex: 1, paddingHorizontal: 24 }]}>
          <Text style={styles.errText}>{error ?? '이야기를 불러오지 못했어요.'}</Text>
          <Pressable style={styles.errBtn} onPress={() => router.back()}>
            <Text style={styles.errBtnText}>돌아가기</Text>
          </Pressable>
        </View>
      </Screen>
    );
  }

  const year = new Date(story.created_at).getFullYear();
  const categoryName = story.challenge.category?.name ?? '도전';

  return (
    <Screen backgroundColor={colors.background}>
      {/* 헤더 */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="arrow-back" size={24} color={colors.primary} />
        </Pressable>
        <Text style={styles.headerTitle}>완주 이야기</Text>
        {isMine ? (
          <Pressable onPress={onDelete} hitSlop={8}>
            <Ionicons name="trash-outline" size={20} color={colors.primary500} />
          </Pressable>
        ) : (
          <View style={{ width: 24 }} />
        )}
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 100 }}>
        {/* 트로피 카드 */}
        <View style={styles.trophyCard}>
          <Text style={styles.trophyEmoji}>🏆</Text>
          <Text style={styles.trophyTitle}>{story.challenge.title}</Text>
          <Text style={styles.trophyMeta}>
            {story.author.nickname} · {year} · Do : 하다
          </Text>
        </View>

        {/* 통계 — 시스템 자동 잠금 */}
        <View style={styles.statsGrid}>
          <StatCell num={story.total_days}                    label="일 완주" />
          <StatCell num={story.longest_streak}                label="연속 최고" />
          <StatCell num={story.proof_count}                   label="인증" />
          <StatCell num={Math.round(story.completion_rate)}   label="완주율 %" />
        </View>

        {/* 사진 (있을 때만) */}
        {story.photo_urls.length > 0 && (
          <View style={styles.photoWrap}>
            {story.photo_urls.map((url, i) => (
              <Image key={i} source={{ uri: url }} style={styles.photo} />
            ))}
          </View>
        )}

        {/* 작성한 옵션 필드만 노출 */}
        <View style={{ paddingHorizontal: 20, paddingTop: 8 }}>
          {FIELD_ORDER.map(f => {
            const value = story[f.key] as string | null;
            if (!value || !value.trim()) return null;
            return (
              <View key={f.key as string} style={styles.qa}>
                <Text style={styles.qaLabel}>{f.label}</Text>
                <Text style={styles.qaBody}>{value}</Text>
              </View>
            );
          })}
        </View>

        {/* 용기 받았어요 (Phase 1.5 placeholder) */}
        <View style={styles.courageRow}>
          <Pressable style={styles.courageBtn} onPress={onCourage} hitSlop={6}>
            <Text style={styles.courageBtnText}>🤝 용기 받았어요</Text>
          </Pressable>
          <Text style={styles.courageHint}>
            반응은 Phase 1.5 에 열려요
          </Text>
        </View>

        {/* CTA — 신규 유입 루프 */}
        {!isMine && (
          <View style={styles.ctaWrap}>
            <Pressable style={styles.ctaBtn} onPress={onStartSimilar}>
              <Text style={styles.ctaText}>나도 {categoryName} 도전 시작하기</Text>
            </Pressable>
            <Text style={styles.ctaHint}>
              이 이야기에 닿았다면, 다음은 당신 차례예요.
            </Text>
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}

function StatCell({ num, label }: { num: number; label: string }) {
  return (
    <View style={styles.statCell}>
      <Text style={styles.statNum}>{num}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
  errText: {
    fontSize: fontSize.base, color: colors.primary, textAlign: 'center', marginBottom: 16,
    fontFamily: fontFamily.medium, fontWeight: fontWeight.medium,
  },
  errBtn: {
    paddingHorizontal: 20, paddingVertical: 12,
    backgroundColor: colors.accent, borderRadius: radius.pill,
  },
  errBtnText: { color: colors.surface, fontFamily: fontFamily.bold, fontWeight: fontWeight.bold },

  // 헤더
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 14,
    backgroundColor: colors.surface,
    borderBottomWidth: 1, borderBottomColor: colors.primary100,
  },
  headerTitle: {
    fontSize: fontSize.lg, color: colors.primary,
    fontFamily: fontFamily.bold, fontWeight: fontWeight.bold,
    letterSpacing: -0.3,
  },

  // 트로피 카드
  trophyCard: {
    marginHorizontal: 20, marginTop: 18,
    paddingVertical: 28, paddingHorizontal: 20,
    backgroundColor: colors.accent50,
    borderRadius: radius.xl,
    alignItems: 'center', gap: 8,
    borderWidth: 1, borderColor: colors.accent100,
  },
  trophyEmoji: { fontSize: 48 },
  trophyTitle: {
    fontSize: fontSize['2xl'], color: colors.primary,
    fontFamily: fontFamily.bold, fontWeight: fontWeight.bold,
    textAlign: 'center', letterSpacing: -0.5,
  },
  trophyMeta: {
    fontSize: fontSize.sm, color: colors.primary500,
    fontFamily: fontFamily.regular,
    marginTop: 2,
  },

  // 통계
  statsGrid: {
    flexDirection: 'row', justifyContent: 'space-between',
    marginHorizontal: 20, marginTop: 12,
    gap: 6,
  },
  statCell: {
    flex: 1, alignItems: 'center',
    paddingVertical: 14, backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.primary100,
  },
  statNum: {
    fontSize: fontSize.xl, color: colors.primary,
    fontFamily: fontFamily.bold, fontWeight: fontWeight.bold,
  },
  statLabel: {
    fontSize: 10, color: colors.primary500,
    fontFamily: fontFamily.regular, marginTop: 2,
  },

  // 사진
  photoWrap: {
    marginTop: 16, marginHorizontal: 20,
    gap: 10,
  },
  photo: {
    width: '100%', aspectRatio: 4 / 3,
    borderRadius: radius.lg,
    backgroundColor: colors.primary100,
  },

  // Q&A
  qa: {
    marginTop: 18,
    paddingTop: 14,
    borderTopWidth: 1, borderTopColor: colors.primary100,
  },
  qaLabel: {
    fontSize: fontSize.sm, color: colors.accent700,
    fontFamily: fontFamily.bold, fontWeight: fontWeight.bold,
    marginBottom: 6,
  },
  qaBody: {
    fontSize: fontSize.base, color: colors.primary,
    fontFamily: fontFamily.regular,
    lineHeight: 22,
  },

  // 용기 받았어요 (placeholder)
  courageRow: {
    marginTop: 28, paddingHorizontal: 20,
    alignItems: 'center', gap: 6,
  },
  courageBtn: {
    paddingHorizontal: 18, paddingVertical: 10,
    backgroundColor: colors.primary50,
    borderRadius: radius.pill,
  },
  courageBtnText: {
    fontSize: fontSize.sm, color: colors.primary500,
    fontFamily: fontFamily.medium, fontWeight: fontWeight.medium,
  },
  courageHint: {
    fontSize: fontSize.xs, color: colors.primary500,
    fontFamily: fontFamily.regular,
  },

  // CTA
  ctaWrap: {
    marginTop: 28,
    marginHorizontal: 20,
    paddingTop: 20,
    borderTopWidth: 1, borderTopColor: colors.primary100,
    alignItems: 'center',
  },
  ctaBtn: {
    paddingHorizontal: 28, paddingVertical: 16,
    backgroundColor: colors.accent,
    borderRadius: radius.pill,
    ...shadow.sm,
  },
  ctaText: {
    fontSize: fontSize.base, color: colors.surface,
    fontFamily: fontFamily.bold, fontWeight: fontWeight.bold,
    letterSpacing: -0.2,
  },
  ctaHint: {
    fontSize: fontSize.xs, color: colors.primary500,
    fontFamily: fontFamily.regular,
    marginTop: 12, textAlign: 'center',
  },
});
