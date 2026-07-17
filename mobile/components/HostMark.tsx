// 🚀 HostMark: 사용자 계층 표식 (users.host_tier — 0064 자동 승격)
// 누구나 하다에 1,000명을 모은 개설자는 figure(유명인)로 자라난다. 그 표식은 딱 두 가지 —
//   ① 아바타 금빛 테두리(hostRingStyle) ② 닉네임 옆 작은 마크(HostMark).
// 칭호 텍스트·순위·수치는 만들지 않는다 (비교 압박 금지 수칙).
//
// HostBadge(하다 단위 무대 배지, 큰 필)와는 다른 축이다:
//   HostBadge = challenges.host_tier (이 하다를 누가 여는가), HostMark = users.host_tier (이 사람이 누구인가).
//   여긴 닉네임 옆에 붙는 인라인 마크라 필이 아니라 글자 하나.
import React from 'react';
import { Text, StyleSheet } from 'react-native';
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

// 아바타 금빛 테두리 — 아바타 style 배열에 펼쳐 쓰는 헬퍼.
//   figure|org 가 아니면 null 이라 기존 스타일 그대로(테두리 없음).
//   반환 타입을 테두리 두 속성으로 좁혀 둔다 — View/Image(ImageStyle) 아바타 양쪽에 그대로 쓰기 위함.
export function hostRingStyle(hostTier?: HostTier): { borderWidth: number; borderColor: string } | null {
  if (hostTier !== 'figure' && hostTier !== 'org') return null;
  return { borderWidth: 2, borderColor: colors.gold };
}

const styles = StyleSheet.create({
  mark: {
    fontSize: fontSize.xs,
    marginLeft: 4,
  },
});
