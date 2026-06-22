// 🚀 동료들의 다짐 (읽기 전용) — 현황 탭. 목격받기 정체성: 동료의 약속을 함께 지켜봄.
// 비교/줄세우기 아님 — 질적 약속 + 지킨 흔적(✓)만. 본인 다짐은 PledgeCard 가, 여긴 동료 것만.
import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { Heart, Trophy, ArrowDown, Check } from 'lucide-react-native';
import { colors, fontFamily, fontSize, fontWeight, radius, shadow } from '@/lib/tokens';
import type { PledgeDirection } from '@/lib/db';

export type FellowPledgeRow = {
  id: string;
  nickname: string;
  avatarUrl: string | null;
  direction: PledgeDirection;
  content: string;
  fulfilled: boolean;
};

function DirTag({ d }: { d: PledgeDirection }) {
  const Icon = d === 'lose' ? ArrowDown : Trophy;
  return (
    <View style={styles.dirTag}>
      <Icon size={11} color={colors.accent700} strokeWidth={2} />
      <Text style={styles.dirTagText}>{d === 'lose' ? '못 하면' : '해내면'}</Text>
    </View>
  );
}

export function FellowPledges({ rows }: { rows: FellowPledgeRow[] }) {
  if (rows.length === 0) return null;
  return (
    <View style={styles.card}>
      <View style={styles.headlineRow}>
        <Heart size={16} color={colors.gold} strokeWidth={2} />
        <Text style={styles.headline}>동료들의 다짐</Text>
      </View>
      {rows.map(r => (
        <View key={r.id} style={styles.row}>
          {r.avatarUrl ? (
            <Image source={{ uri: r.avatarUrl }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarFallback]}>
              <Text style={{ fontSize: 14 }}>{r.nickname.slice(0, 1) || '🐰'}</Text>
            </View>
          )}
          <View style={{ flex: 1, gap: 2 }}>
            <View style={styles.head}>
              <Text style={styles.name} numberOfLines={1}>{r.nickname}</Text>
              <DirTag d={r.direction} />
            </View>
            <Text style={styles.content}>{r.content}</Text>
            {r.fulfilled && (
              <View style={styles.fulfilledRow}>
                <Check size={13} color={colors.done} strokeWidth={2.4} />
                <Text style={styles.fulfilled}>지켰어요</Text>
              </View>
            )}
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: 16,
    marginBottom: 16,
    gap: 10,
    ...shadow.sm,
  },
  headlineRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  headline: {
    fontSize: fontSize.base,
    color: colors.primary,
    fontFamily: fontFamily.bold,
    fontWeight: fontWeight.bold,
  },
  row: {
    flexDirection: 'row',
    gap: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.primary50,
  },
  avatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.primary50 },
  avatarFallback: { alignItems: 'center', justifyContent: 'center' },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: {
    flexShrink: 1,
    fontSize: fontSize.sm,
    color: colors.primary,
    fontFamily: fontFamily.bold,
    fontWeight: fontWeight.bold,
  },
  dirTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 2,
    backgroundColor: colors.accent50,
    borderRadius: radius.pill,
  },
  dirTagText: {
    fontSize: fontSize.xs,
    color: colors.accent700,
    fontFamily: fontFamily.bold,
    fontWeight: fontWeight.bold,
  },
  content: {
    fontSize: fontSize.sm,
    color: colors.primary500,
    fontFamily: fontFamily.regular,
    lineHeight: 20,
  },
  fulfilledRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  fulfilled: {
    fontSize: fontSize.xs,
    color: colors.done,
    fontFamily: fontFamily.bold,
    fontWeight: fontWeight.bold,
  },
});
