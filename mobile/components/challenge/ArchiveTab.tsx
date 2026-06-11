// 🚀 챌린지방 - 박제 탭 (v2.5 — 해냈어요 진입점 추가)
// 진행 중: 안내 카드 + 박제 자산화 4단계 잠금 노출 (가격 "추후 결정")
// 완주 후: 박제 카드 + "완주 이야기 공유" 버튼 → /done/new (해냈어요 작성)
//   결제 흐름 (종이/포토북/굿즈) 은 Phase 2.
import React, { useMemo } from 'react';
import { View, Text, StyleSheet, FlatList, Image, Pressable, Alert } from 'react-native';
import { router } from 'expo-router';
import { colors, fontFamily, fontSize, fontWeight, radius, shadow } from '@/lib/tokens';
import { computeProgress, isCompleted, isFinished } from '@/lib/stats';
import { haptic } from '@/lib/haptics';
import type { DbChallenge, ProofWithRelations } from '@/lib/types';

// 박제 자산화 4단계 — 베타 노출용. 가격은 "추후 결정" (책 단계는 베타 보류).
const ARCHIVE_TIERS = [
  { emoji: '📜', label: '디지털 인증서 (PDF)', price: '무료', note: '정식 출시 예정' },
  { emoji: '✉️', label: '종이 인증서 · 우편', price: '추후 결정', note: '인쇄·우편 발송' },
  { emoji: '📖', label: '포토북',           price: '추후 결정', note: '30일 분량 사진 모음' },
  { emoji: '👕', label: '굿즈 (티셔츠·키링)', price: '추후 결정', note: '완주 기념' },
];

type Props = {
  challenge: DbChallenge;
  proofs: ProofWithRelations[];
  totalCheers: number;
  totalLogs: number;
  myUserId: string | undefined;
};

export function ArchiveTab({ challenge, proofs, totalCheers, totalLogs, myUserId }: Props) {
  // 🚀 P-③: isFinished 만 보던 분기를 성공/실패로 세분화.
  //   진행 중     → 박제 안내 placeholder
  //   실패한 종료 → 인증 타임라인은 그대로 노출 (회고), "완주 이야기 공유" X + 격려 메시지
  //   완주       → 박제 카드 + "완주 이야기 공유" 버튼
  // 완주 판정·통계 주체 — cheered 방은 도전 주체가 개설자 1명 (응원자는 인증 의무 없음).
  // 응원자 본인 인증 기준으로 판정하면 항상 "실패" 톤이 되므로 도전자(개설자) 기준 사용.
  const subjectUserId = challenge.kind === 'cheered' ? challenge.creator_id : myUserId;
  const subjectProofs = useMemo(
    () => proofs.filter(p => p.user_id === subjectUserId),
    [proofs, subjectUserId],
  );
  const finished  = isFinished(challenge);
  const completed = isCompleted(challenge, subjectProofs);
  const progress  = useMemo(() => computeProgress(challenge), [challenge]);

  if (!finished) {
    return (
      <FlatList
        data={[]}
        keyExtractor={() => '_'}
        renderItem={() => null}
        contentContainerStyle={{ paddingBottom: 32 }}
        ListHeaderComponent={
          <View style={styles.placeholder}>
            <Text style={styles.placeholderEmoji}>🏆</Text>
            <Text style={styles.placeholderTitle}>박제는 챌린지 종료 후</Text>
            <Text style={styles.placeholderDesc}>
              {challenge.title} 이(가) 끝나면{'\n'}
              여기에 모든 추억이 박제됩니다.
            </Text>
            <View style={styles.previewCard}>
              <Text style={styles.previewLabel}>박제될 항목</Text>
              <View style={{ gap: 6 }}>
                <Text style={styles.previewItem}>📸 모든 인증 사진 ({proofs.length}장)</Text>
                <Text style={styles.previewItem}>💬 동료들의 응원 ({totalCheers}번)</Text>
                <Text style={styles.previewItem}>🎥 기록 (Vlog) ({totalLogs}개)</Text>
                <Text style={styles.previewItem}>🏆 완주 인증 (도전 끝까지 함께한 분들)</Text>
              </View>
            </View>
            <ArchiveTiersCard />
          </View>
        }
      />
    );
  }

  // ─── 완주 후 박제 화면 ───
  const photos = proofs
    .slice()
    .sort((a, b) => a.created_at.localeCompare(b.created_at));

  return (
    <FlatList
      data={photos}
      keyExtractor={p => p.id}
      numColumns={3}
      contentContainerStyle={styles.archiveBody}
      ListHeaderComponent={
        <View style={styles.hero}>
          <Text style={styles.heroTrophy}>{completed ? '🏆' : '🏁'}</Text>
          <Text style={styles.heroTitle}>{challenge.title}</Text>
          <Text style={styles.heroMeta}>
            {challenge.start_date} ~ {challenge.end_date}
          </Text>
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statNum}>{progress.totalDays}</Text>
              <Text style={styles.statLabel}>{completed ? '일 완주' : '일 도전'}</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statNum}>{subjectProofs.length}</Text>
              <Text style={styles.statLabel}>인증샷</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statNum}>{totalCheers}</Text>
              <Text style={styles.statLabel}>응원</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statNum}>{totalLogs}</Text>
              <Text style={styles.statLabel}>기록</Text>
            </View>
          </View>

          {completed ? (
            <>
              <Text style={styles.heroMessage}>
                도전, 그냥 하다.{'\n'}더 나은 나, 더 나은 세상.
              </Text>
              {/* 완주 이야기 작성은 도전 주체만 — cheered 방 응원자는 축하 톤만 보고 작성 X */}
              {myUserId === subjectUserId && (
                <>
                  <Pressable
                    style={styles.shareBtn}
                    onPress={() => {
                      haptic.tap();
                      router.push(`/done/new?challengeId=${challenge.id}` as any);
                    }}
                  >
                    <Text style={styles.shareBtnText}>✍️ 완주 이야기 공유하기</Text>
                  </Pressable>
                  <Text style={styles.shareBtnHint}>
                    줄세우기 X · 서로에게 용기를 주는 증언
                  </Text>
                </>
              )}
            </>
          ) : (
            <View style={styles.failBox}>
              <Text style={styles.failTitle}>도전이 종료되었어요</Text>
              <Text style={styles.failDesc}>
                완주 기준에 못 닿았지만, 시작한 것 자체가 한 걸음이에요.{'\n'}
                남긴 인증·기록은 그대로 박제됩니다.
              </Text>
            </View>
          )}

          <ArchiveTiersCard />

          <Text style={styles.sectionTitle}>📸 인증 타임라인</Text>
        </View>
      }
      renderItem={({ item }) => (
        <View style={styles.thumbWrap}>
          <Image source={{ uri: item.photo_url }} style={styles.thumb} />
        </View>
      )}
      ListEmptyComponent={
        <Text style={styles.emptyText}>저장된 인증 사진이 없어요.</Text>
      }
    />
  );
}

// ─── 박제 자산화 4단계 잠금 노출 (v2.5) ─────────────────
// 가격은 "추후 결정". 베타에 가격 못박지 않음.
function ArchiveTiersCard() {
  return (
    <View style={styles.tiersCard}>
      <Text style={styles.tiersLabel}>완주하면 남길 수 있어요</Text>
      <View style={{ gap: 10, marginTop: 8 }}>
        {ARCHIVE_TIERS.map(t => (
          <View key={t.label} style={styles.tierRow}>
            <Text style={styles.tierEmoji}>{t.emoji}</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.tierLabel}>{t.label}</Text>
              <Text style={styles.tierNote}>{t.note}</Text>
            </View>
            <Text style={[
              styles.tierPrice,
              t.price === '무료' && { color: colors.accent700 },
            ]}>
              {t.price}
            </Text>
          </View>
        ))}
      </View>
      <Text style={styles.tiersFootnote}>
        디지털 인증서를 제외한 상품은 정식 출시 시점에 가격이 결정돼요.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  placeholder: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 32,
    alignItems: 'center',
    gap: 12,
  },
  placeholderEmoji: { fontSize: 56 },
  placeholderTitle: {
    fontSize: fontSize.lg,
    color: colors.primary,
    fontFamily: fontFamily.bold,
    fontWeight: fontWeight.bold,
    textAlign: 'center',
  },
  placeholderDesc: {
    fontSize: fontSize.sm,
    color: colors.primary500,
    fontFamily: fontFamily.regular,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 8,
  },
  previewCard: {
    marginTop: 16,
    padding: 16,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    width: '100%',
    gap: 8,
    ...shadow.sm,
  },
  previewLabel: {
    fontSize: fontSize.sm,
    color: colors.primary500,
    fontFamily: fontFamily.medium,
    fontWeight: fontWeight.semibold,
    marginBottom: 4,
  },
  previewItem: {
    fontSize: fontSize.sm,
    color: colors.primary,
    fontFamily: fontFamily.regular,
    lineHeight: 20,
  },
  previewFootnote: {
    fontSize: fontSize.xs,
    color: colors.primary500,
    fontFamily: fontFamily.regular,
    marginTop: 8,
    lineHeight: 16,
  },

  // v2.5 — 4단계 상품 잠금 카드
  tiersCard: {
    marginTop: 16,
    padding: 16,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    width: '100%',
    borderWidth: 1,
    borderColor: colors.accent100,
    ...shadow.sm,
  },
  tiersLabel: {
    fontSize: fontSize.sm,
    color: colors.accent700,
    fontFamily: fontFamily.bold,
    fontWeight: fontWeight.bold,
  },
  tierRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  tierEmoji: {
    fontSize: 22,
    width: 28,
    textAlign: 'center',
  },
  tierLabel: {
    fontSize: fontSize.sm,
    color: colors.primary,
    fontFamily: fontFamily.medium,
    fontWeight: fontWeight.semibold,
  },
  tierNote: {
    fontSize: fontSize.xs,
    color: colors.primary500,
    fontFamily: fontFamily.regular,
    marginTop: 1,
  },
  tierPrice: {
    fontSize: fontSize.sm,
    color: colors.primary500,
    fontFamily: fontFamily.medium,
    fontWeight: fontWeight.medium,
  },
  tiersFootnote: {
    fontSize: fontSize.xs,
    color: colors.primary500,
    fontFamily: fontFamily.regular,
    marginTop: 12,
    lineHeight: 16,
  },

  // v2.5 — 완주 이야기 공유 버튼 (완주 후)
  shareBtn: {
    marginTop: 16,
    paddingVertical: 14,
    paddingHorizontal: 24,
    backgroundColor: colors.accent,
    borderRadius: radius.pill,
    width: '100%',
    alignItems: 'center',
    ...shadow.sm,
  },
  shareBtnText: {
    fontSize: fontSize.base,
    color: colors.surface,
    fontFamily: fontFamily.bold,
    fontWeight: fontWeight.bold,
    letterSpacing: -0.2,
  },
  shareBtnHint: {
    fontSize: fontSize.xs,
    color: colors.primary500,
    fontFamily: fontFamily.regular,
    marginTop: 6,
    textAlign: 'center',
  },

  // 실패 분기 박스 (P-③)
  failBox: {
    marginTop: 16,
    padding: 16,
    backgroundColor: colors.primary50,
    borderRadius: radius.lg,
    width: '100%',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.primary100,
  },
  failTitle: {
    fontSize: fontSize.base,
    color: colors.primary700,
    fontFamily: fontFamily.bold,
    fontWeight: fontWeight.bold,
    marginBottom: 6,
  },
  failDesc: {
    fontSize: fontSize.sm,
    color: colors.primary500,
    fontFamily: fontFamily.regular,
    textAlign: 'center',
    lineHeight: 20,
  },

  // 완주 후
  archiveBody: { paddingBottom: 48 },
  hero: {
    alignItems: 'center',
    padding: 24,
    gap: 8,
  },
  heroTrophy: { fontSize: 72 },
  heroTitle: {
    fontSize: fontSize['2xl'],
    color: colors.primary,
    fontFamily: fontFamily.bold,
    fontWeight: fontWeight.bold,
    textAlign: 'center',
  },
  heroMeta: {
    fontSize: fontSize.sm,
    color: colors.primary500,
    fontFamily: fontFamily.regular,
    marginBottom: 12,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    paddingVertical: 12,
    paddingHorizontal: 8,
    backgroundColor: colors.accent50,
    borderRadius: radius.lg,
  },
  statItem: { flex: 1, alignItems: 'center' },
  statNum: {
    fontSize: fontSize.xl,
    color: colors.primary,
    fontFamily: fontFamily.bold,
    fontWeight: fontWeight.bold,
  },
  statLabel: {
    fontSize: fontSize.xs,
    color: colors.primary500,
    fontFamily: fontFamily.regular,
    marginTop: 2,
  },
  heroMessage: {
    fontSize: fontSize.base,
    color: colors.accent700,
    fontFamily: fontFamily.medium,
    fontWeight: fontWeight.semibold,
    textAlign: 'center',
    lineHeight: 22,
    marginTop: 16,
  },
  sectionTitle: {
    fontSize: fontSize.base,
    color: colors.primary,
    fontFamily: fontFamily.bold,
    fontWeight: fontWeight.bold,
    alignSelf: 'flex-start',
    marginTop: 16,
    marginBottom: 8,
  },
  thumbWrap: {
    flex: 1 / 3,
    padding: 4,
  },
  thumb: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: radius.md,
    backgroundColor: colors.primary100,
  },
  emptyText: {
    fontSize: fontSize.sm,
    color: colors.primary500,
    fontFamily: fontFamily.regular,
    textAlign: 'center',
    paddingVertical: 32,
  },
});
