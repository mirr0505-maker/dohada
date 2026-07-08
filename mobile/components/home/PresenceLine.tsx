// 🚀 지금 함께 — 최근 30분 내 활동한 동료 수를 얇은 앰비언트 라인으로.
//   랭킹/비교 아님. 소단위 현존감(presence). count===0 이면 렌더 안 함(죽은 라인 방지).
import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Users } from 'lucide-react-native';
import { colors, fontFamily, fontSize, radius } from '@/lib/tokens';
import { fetchPresenceNow } from '@/lib/db';
import { formatCheerCount } from '@/lib/format';

export function PresenceLine() {
  const [count, setCount] = useState(0);

  const load = useCallback(() => {
    fetchPresenceNow()
      .then(setCount)
      .catch(() => setCount(0));   // 실패 시 조용히 숨김 (앰비언트 — 에러 노출 안 함)
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (count <= 0) return null;   // 🚀 아무도 없으면 렌더하지 않는다

  return (
    <View style={styles.line}>
      <Users size={14} color={colors.brand} strokeWidth={2} />
      <Text style={styles.text}>
        최근 30분, 동료 <Text style={styles.count}>{formatCheerCount(count)}명</Text>이 함께 걷고 있어요.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  line: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 20,   // 🚀 peekBar·카드와 같은 좌우 여백으로 정렬 (좌측 치우침 해소)
    marginBottom: 8,
    paddingHorizontal: 14,
    paddingVertical: 9,
    backgroundColor: colors.brandTint,
    borderRadius: radius.pill,
  },
  text: {
    fontSize: fontSize.sm,
    color: colors.sub,
    fontFamily: fontFamily.regular,
  },
  count: {
    color: colors.brandInk,
    fontFamily: fontFamily.bold,
  },
});
