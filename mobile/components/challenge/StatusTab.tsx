// 🚀 챌린지방 - 현황 탭 (멤버별 인증률 + 연속)
// v4: 카드 = 아바타 + 닉네임 + 연속 일수 + 인증률 % + 진행률 바. 본인 강조.
import React, { useMemo } from 'react';
import { View, Text, FlatList, StyleSheet, Image } from 'react-native';
import { colors, fontFamily, fontSize, fontWeight, radius, shadow } from '@/lib/tokens';
import { computeProgress, computeStreak } from '@/lib/stats';
import type { DbChallenge, MemberWithToday, ProofWithRelations } from '@/lib/types';

type Props = {
  challenge: DbChallenge;
  members: MemberWithToday[];
  proofs: ProofWithRelations[];
  myUserId: string | undefined;
};

export function StatusTab({ challenge, members, proofs, myUserId }: Props) {
  const progress = useMemo(() => computeProgress(challenge), [challenge]);

  // 멤버별 통계 (인증한 고유 날짜 수 / 진행일수)
  const rows = useMemo(() => {
    return members.map(m => {
      const myProofs = proofs.filter(p => p.user_id === m.id);
      const uniqDays = new Set(myProofs.map(p => p.created_at.slice(0, 10))).size;
      const denom = Math.max(1, progress.passedDays);
      const rate = Math.min(100, Math.round((uniqDays / denom) * 100));
      const streak = computeStreak(myProofs);
      const todayChecked = m.today_checked;
      return { member: m, uniqDays, rate, streak, todayChecked };
    });
  }, [members, proofs, progress.passedDays]);

  // 시간의 흐름 정렬 — 가입 순 (members 가 이미 joined_at asc).
  // 본인만 맨 위로 옮김. 인증률 desc 정렬 X (비교 압박 회피, v3.5 조용한 SNS).
  const sorted = useMemo(() => {
    const me = rows.find(r => r.member.id === myUserId);
    if (me) {
      const rest = rows.filter(r => r.member.id !== myUserId);
      return [me, ...rest];
    }
    return rows;
  }, [rows, myUserId]);

  return (
    <FlatList
      data={sorted}
      keyExtractor={r => r.member.id}
      contentContainerStyle={styles.list}
      renderItem={({ item }) => (
        <StatusCard
          row={item}
          isMine={item.member.id === myUserId}
          totalDays={progress.passedDays}
        />
      )}
      ListEmptyComponent={
        <View style={styles.empty}>
          <Text style={styles.emptyEmoji}>📊</Text>
          <Text style={styles.emptyText}>아직 멤버가 없어요.</Text>
        </View>
      }
    />
  );
}

function StatusCard({
  row, isMine, totalDays,
}: {
  row: { member: MemberWithToday; uniqDays: number; rate: number; streak: number; todayChecked: boolean };
  isMine: boolean;
  totalDays: number;
}) {
  const { member, uniqDays, rate, streak, todayChecked } = row;
  const gaveUp = !!member.gave_up_at;
  return (
    <View style={[styles.card, isMine && styles.cardMine, gaveUp && styles.cardGaveUp]}>
      <View style={styles.avatarWrap}>
        {member.avatar_url ? (
          <Image source={{ uri: member.avatar_url }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarFallback]}>
            <Text style={{ fontSize: 18 }}>{member.nickname?.slice(0, 1) || '🐰'}</Text>
          </View>
        )}
        {todayChecked && !gaveUp && (
          <View style={styles.checkBadge}>
            <Text style={styles.checkBadgeText}>✓</Text>
          </View>
        )}
      </View>

      <View style={{ flex: 1, gap: 4 }}>
        <View style={styles.row}>
          <Text style={styles.name} numberOfLines={1}>
            {member.nickname}{isMine ? ' (나)' : ''}
          </Text>
          {gaveUp ? (
            <Text style={styles.gaveUpTag}>포기</Text>
          ) : streak > 0 ? (
            <Text style={styles.streak}>🔥 {streak}</Text>
          ) : null}
        </View>
        <Text style={styles.subtext}>
          {gaveUp
            ? '도전을 포기했어요'
            : `${uniqDays}/${totalDays}일${isMine && !todayChecked ? '  · 오늘 인증 전 ⚠️' : ''}`}
        </Text>
        {!gaveUp && (
          <View style={styles.track}>
            <View
              style={[
                styles.fill,
                { width: `${rate}%`, backgroundColor: isMine ? colors.accent : colors.success },
              ]}
            />
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  list: { padding: 16, gap: 10 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: 14,
    ...shadow.sm,
  },
  cardMine: {
    borderWidth: 2,
    borderColor: colors.accent,
    backgroundColor: colors.accent50,
  },
  cardGaveUp: {
    opacity: 0.5,
    backgroundColor: colors.primary50,
  },
  gaveUpTag: {
    fontSize: fontSize.xs,
    color: colors.primary500,
    fontFamily: fontFamily.medium,
    fontWeight: fontWeight.medium,
    paddingHorizontal: 8,
    paddingVertical: 2,
    backgroundColor: colors.primary100,
    borderRadius: radius.pill,
  },
  avatarWrap: { width: 48, height: 48, position: 'relative' },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.primary50 },
  avatarFallback: { alignItems: 'center', justifyContent: 'center' },
  checkBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.success,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.surface,
  },
  checkBadgeText: {
    color: colors.surface,
    fontSize: 10,
    fontWeight: fontWeight.bold,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: {
    flex: 1,
    fontSize: fontSize.base,
    color: colors.primary,
    fontFamily: fontFamily.bold,
    fontWeight: fontWeight.bold,
  },
  streak: {
    fontSize: fontSize.sm,
    color: colors.accent,
    fontFamily: fontFamily.bold,
    fontWeight: fontWeight.bold,
  },
  subtext: {
    fontSize: fontSize.xs,
    color: colors.primary500,
    fontFamily: fontFamily.regular,
  },
  track: {
    height: 6,
    backgroundColor: colors.primary100,
    borderRadius: 3,
    overflow: 'hidden',
  },
  fill: { height: 6, borderRadius: 3 },
  rateNum: {
    fontSize: fontSize.xl,
    color: colors.primary,
    fontFamily: fontFamily.bold,
    fontWeight: fontWeight.bold,
    minWidth: 50,
    textAlign: 'right',
  },
  rateNumMine: { color: colors.accent },
  empty: { paddingVertical: 64, alignItems: 'center', gap: 12 },
  emptyEmoji: { fontSize: 56 },
  emptyText: {
    fontSize: fontSize.base, color: colors.primary500,
    fontFamily: fontFamily.regular, textAlign: 'center',
  },
});
