// 🚀 StreakMedal — 인증 연속 마일스톤 메달 (채운 오각형 + 흰 숫자)
// 사람 아닌 "인증 게시글"에 부착되는 성취 표식. 유튜브 골드 버튼 톤.
// day = 연속 일수(3·7·21·49·99·180·365·730), color = tokens.streakTier. 노출 판정은 stats.streakMilestone.
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Polygon } from 'react-native-svg';
import { colors, fontFamily, fontWeight, shadow } from '@/lib/tokens';

// 꼭짓점 위(point-up) 정오각형 — viewBox 0~100 기준 좌표 (정오각형 외접원 r≈48, 중심 50,52)
const PENTAGON = '50,4 95,38 78,92 22,92 5,38';

export function StreakMedal({ day, color, size = 36 }: { day: number; color: string; size?: number }) {
  const digits = String(day).length;
  // 자릿수에 맞춰 숫자 크기 조정 (3자리 730 도 안 넘치게)
  const numSize = digits >= 3 ? size * 0.30 : digits === 2 ? size * 0.40 : size * 0.46;
  return (
    <View style={[styles.wrap, { width: size, height: size }, shadow.sm]} accessibilityLabel={`연속 ${day}일 달성 메달`}>
      <Svg width={size} height={size} viewBox="0 0 100 100">
        <Polygon points={PENTAGON} fill={color} stroke={colors.surface} strokeWidth={7} strokeLinejoin="round" />
      </Svg>
      {/* 오각형은 아래가 무거워 광학 중심이 살짝 아래 → 숫자를 약간 내려 배치 */}
      <View style={[StyleSheet.absoluteFill, styles.center, { paddingTop: size * 0.1 }]} pointerEvents="none">
        <Text style={[styles.num, { fontSize: numSize }]} numberOfLines={1}>{day}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center' },
  center: { alignItems: 'center', justifyContent: 'center' },
  num: {
    color: colors.surface,
    fontFamily: fontFamily.bold,
    fontWeight: fontWeight.extrabold,
    textAlign: 'center',
  },
});
