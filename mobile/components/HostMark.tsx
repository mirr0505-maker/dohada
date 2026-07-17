// 🚀 HostMark: 사용자 계층 표식 (users.host_tier — 0064 자동 승격)
// 누구나 하다에 1,000명을 모은 개설자는 figure(유명인)로 자라난다. 그 표식은 딱 두 가지 —
//   ① 아바타 금빛 링(HostAvatarRing) ② 닉네임 옆 작은 마크(HostMark).
// 칭호 텍스트·순위·수치는 만들지 않는다 (비교 압박 금지 수칙).
//
// HostBadge(하다 단위 무대 배지, 큰 필)와는 다른 축이다:
//   HostBadge = challenges.host_tier (이 하다를 누가 여는가), HostMark = users.host_tier (이 사람이 누구인가).
//   여긴 닉네임 옆에 붙는 인라인 마크라 필이 아니라 글자 하나.
import React from 'react';
import { Text, View, StyleSheet } from 'react-native';
import { colors, fontSize } from '@/lib/tokens';

type HostTier = string | null | undefined;

// 계층별 마크 — 명사=사람(⭐), 조직=기관(🏛️). HostBadge 의 이모지와 1:1로 맞춘다.
const TIER_MARK: Record<string, string> = {
  figure: '⭐',
  org: '🏛️',
};

export function HostMark({ hostTier }: { hostTier?: HostTier }) {
  // individual(대다수)·미지정은 표식 없음 — 조용한 기본값
  const mark = hostTier ? TIER_MARK[hostTier] : undefined;
  if (!mark) return null;
  return <Text style={styles.mark}>{mark}</Text>;
}

// 🚀 아바타 금빛 링 — 아바타를 감싸는 래퍼.
//   테두리를 아바타에 직접 그리면 사진 위에서 금색이 묻힌다 → 아바타와 링 사이에 흰 간격(padding 2)을 둔다.
//   individual(대다수)·미지정은 래퍼 없이 children 그대로 → 일반 사용자 레이아웃은 이전과 픽셀 동일.
//   size = 감쌀 아바타의 지름(px). 링 포함 총 지름은 size + 8 (간격 2 + 선 2, 상하좌우).
export function HostAvatarRing({ hostTier, size, children }: {
  hostTier?: HostTier;
  size: number;
  children: React.ReactNode;
}) {
  if (hostTier !== 'figure' && hostTier !== 'org') return <>{children}</>;
  const outer = size + 8;
  return (
    <View style={[styles.ring, { width: outer, height: outer, borderRadius: outer / 2 }]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  mark: {
    fontSize: fontSize.xs,
    marginLeft: 4,
  },
  ring: {
    padding: 2,                          // 아바타와 링 사이 흰 간격 — 사진 위에서도 금색이 살아난다
    borderWidth: 2,
    borderColor: colors.gold,
    backgroundColor: colors.surface,     // 간격을 흰색으로 채움
    alignItems: 'center',
    justifyContent: 'center',
  },
});
