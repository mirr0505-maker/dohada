// 🚀 Skeleton — 카드 모양 placeholder. ActivityIndicator 대신.
import React, { useEffect, useRef } from 'react';
import { Animated, View, StyleSheet, ViewStyle } from 'react-native';
import { colors, radius } from '@/lib/tokens';

type Props = {
  width?: number | `${number}%`;
  height?: number;
  borderRadius?: number;
  style?: ViewStyle;
};

export function Skeleton({ width = '100%', height = 16, borderRadius: r = 8, style }: Props) {
  const opacity = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.9, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.4, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[
        { width: width as any, height, borderRadius: r, backgroundColor: colors.primary100, opacity },
        style,
      ]}
    />
  );
}

// 챌린지 카드 모양 skeleton (home / room 리스트)
export function ChallengeCardSkeleton() {
  return (
    <View style={styles.card}>
      <Skeleton width="60%" height={18} />
      <Skeleton width="90%" height={14} />
      <View style={styles.row}>
        <Skeleton width={60} height={12} />
        <Skeleton width={80} height={12} />
      </View>
    </View>
  );
}

// 인증 카드 모양 skeleton (room 피드)
export function ProofCardSkeleton() {
  return (
    <View style={styles.card}>
      <View style={[styles.row, { gap: 10 }]}>
        <Skeleton width={36} height={36} borderRadius={18} />
        <View style={{ gap: 6, flex: 1 }}>
          <Skeleton width="40%" height={14} />
          <Skeleton width="20%" height={10} />
        </View>
      </View>
      <Skeleton width="100%" height={200} borderRadius={12} />
      <Skeleton width="70%" height={14} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: 16,
    gap: 10,
  },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
});
