// 🚀 HostBadge: 하다 주최 계층 표식 (host_tier)
// 명사(figure)·조직(org)이 연 하다에만 은은한 신뢰 배지 + 주최자명을 노출한다.
// 광고 배너처럼 튀지 않게 — 회색 스폰서 배너가 아니라 '인증 표식' 톤(수칙 승계).
// individual(일반)이면 아무것도 그리지 않는다. 참여구조(kind)와 직교하는 별도 축.
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, fontSize, fontFamily, fontWeight, radius } from '@/lib/tokens';

type HostTier = 'individual' | 'figure' | 'org' | null | undefined;

type Props = {
  hostTier: HostTier;
  hostLabel?: string | null;   // 표시용 주최자명 (예: '유재석', '환경부')
};

// 계층별 표식 — 명사=사람(따뜻한 accent), 조직=기관(차분한 sage)
const TIER_META: Record<'figure' | 'org', { emoji: string; label: string; bg: string; border: string; text: string }> = {
  figure: { emoji: '⭐', label: '명사', bg: colors.accent50, border: colors.accent100, text: colors.accent700 },
  org:    { emoji: '🏛️', label: '공식', bg: colors.tintSage, border: colors.tintSage, text: colors.doneInk },
};

export function HostBadge({ hostTier, hostLabel }: Props) {
  // 일반(individual)·미지정은 배지 없음 — 대다수 하다는 표식 없이 조용히
  if (hostTier !== 'figure' && hostTier !== 'org') return null;

  const meta = TIER_META[hostTier];
  const name = hostLabel && hostLabel.trim() !== '' ? hostLabel.trim() : null;

  return (
    <View style={[styles.pill, { backgroundColor: meta.bg, borderColor: meta.border }]}>
      <Text style={[styles.text, { color: meta.text }]}>
        {meta.emoji} {meta.label}{name ? ` · ${name}` : ''}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  text: {
    fontSize: fontSize.xs,
    fontFamily: fontFamily.bold,
    fontWeight: fontWeight.bold,
    letterSpacing: 0.2,
  },
});
