// 🚀 완주 이야기 목표 배지 (0084) — 완주 ≠ 성공 두 축을 박제에 정직하게
//   🏁 완주 : 끝까지 감 (완주 이야기 자체의 자격 — 항상 표시)
//   🏆 성공 : 개설 시 정한 임계를 채움 (succeeded === true)
//   부족분  : "목표 90% 중 87% 달성" — 실패가 아니므로 빨강·경고색 금지, 중립 톤
//   목표 결과 미계산(null, 0084 이전 이야기) → 🏁 완주만
// 해냈어요 탭 카드 · 상세 · 작성 미리보기 세 화면이 같은 표시를 쓰도록 한 곳에 둔다.
import React from 'react';
import { View, Text, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { colors, fontFamily, fontSize, fontWeight, radius } from '@/lib/tokens';

export function StoryGoalBadges({
  succeeded, threshold, rate, style,
}: {
  succeeded: boolean | null;
  threshold: number | null;
  rate: number | null;
  style?: StyleProp<ViewStyle>;
}) {
  const goalPct = threshold ?? 100;
  return (
    <View style={[styles.row, style]}>
      <View style={[styles.pill, styles.finishPill]}>
        <Text style={[styles.pillText, styles.finishText]}>🏁 완주</Text>
      </View>
      {succeeded === true && <StorySuccessPill threshold={threshold} />}
      {succeeded === false && (
        <View style={[styles.pill, styles.shortPill]}>
          <Text style={[styles.pillText, styles.shortText]}>
            목표 {goalPct}% 중 {Math.round(rate ?? 0)}% 달성
          </Text>
        </View>
      )}
    </View>
  );
}

// 🏆 성공 배지 한 개 — 해냈어요 탭 카드처럼 좁은 자리에선 이것만 쓴다
export function StorySuccessPill({ threshold, style }: { threshold: number | null; style?: StyleProp<ViewStyle> }) {
  const goalPct = threshold ?? 100;
  return (
    <View style={[styles.pill, styles.successPill, style]}>
      <Text style={[styles.pillText, styles.successText]}>
        🏆 성공{goalPct < 100 ? ` · 목표 ${goalPct}%` : ''}
      </Text>
    </View>
  );
}

// 통계 4번째 칸 — 목표 결과가 있으면 "달성률", 없으면(구 이야기) 단순 비율을 "인증률" 로 정직하게
export function storyRateStat(story: { goal_rate: number | null; completion_rate: number }): { num: number; label: string } {
  if (story.goal_rate != null) return { num: Math.round(story.goal_rate), label: '달성률 %' };
  return { num: Math.round(story.completion_rate), label: '인증률 %' };
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  pill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill },
  pillText: { fontSize: fontSize.sm, fontFamily: fontFamily.bold, fontWeight: fontWeight.bold },
  finishPill: { backgroundColor: colors.tintCream },
  finishText: { color: colors.gold },
  successPill: { backgroundColor: colors.doneTint },
  successText: { color: colors.doneInk },
  shortPill: { backgroundColor: colors.primary50 },
  shortText: { color: colors.sub, fontFamily: fontFamily.medium, fontWeight: fontWeight.medium },
});
