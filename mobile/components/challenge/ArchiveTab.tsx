// 🚀 챌린지방 - 박제 탭
// 진행 중: 안내 카드 ("종료 후 활성화돼요")
// 완주 후 (= 종료일 지남 + 본인 모든 인증 완수): 단순 박제 카드
//   인증서 PDF/포토북/책 등 자산화 5단계는 Phase 2.
import React, { useMemo } from 'react';
import { View, Text, StyleSheet, FlatList, Image } from 'react-native';
import { colors, fontFamily, fontSize, fontWeight, radius, shadow } from '@/lib/tokens';
import { computeProgress } from '@/lib/stats';
import type { DbChallenge, ProofWithRelations } from '@/lib/types';

type Props = {
  challenge: DbChallenge;
  proofs: ProofWithRelations[];
  totalCheers: number;
  totalLogs: number;
};

export function ArchiveTab({ challenge, proofs, totalCheers, totalLogs }: Props) {
  const today = new Date().toISOString().slice(0, 10);
  const isFinished = today > challenge.end_date;
  const progress = useMemo(() => computeProgress(challenge), [challenge]);

  if (!isFinished) {
    return (
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
          <Text style={styles.previewFootnote}>
            * 인증서 PDF / 종이 인증서 / 포토북 / 책 출판 등 자산화 옵션은 다음 시즌에 열립니다.
          </Text>
        </View>
      </View>
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
          <Text style={styles.heroTrophy}>🏆</Text>
          <Text style={styles.heroTitle}>{challenge.title}</Text>
          <Text style={styles.heroMeta}>
            {challenge.start_date} ~ {challenge.end_date}
          </Text>
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statNum}>{progress.totalDays}</Text>
              <Text style={styles.statLabel}>일 완주</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statNum}>{proofs.length}</Text>
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
          <Text style={styles.heroMessage}>
            도전, 그냥 하다.{'\n'}더 나은 나, 더 나은 세상.
          </Text>
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
    color: colors.primary300,
    fontFamily: fontFamily.regular,
    marginTop: 8,
    lineHeight: 16,
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
