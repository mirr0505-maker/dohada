// 🚀 동료 회고 목격 — 동료들의 오늘 회고 한 줄을 읽기 전용으로 지켜봄(목격받기).
//   되어가는 과정 피드. 좋아요/댓글 없음(W2 범위). 비면 렌더 안 함. 작성자 임베드 null 가드.
import React, { useCallback, useState } from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { colors, fontFamily, fontSize, fontWeight, radius } from '@/lib/tokens';
import { fetchFellowReflections, type FellowReflection } from '@/lib/db';

export function FellowReflections() {
  const [items, setItems] = useState<FellowReflection[]>([]);

  const load = useCallback(() => {
    fetchFellowReflections(8)
      .then(setItems)
      .catch(() => setItems([]));   // 실패 시 조용히 숨김 (목격 피드 — 에러 노출 안 함)
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (items.length === 0) return null;   // 🚀 오늘 동료 회고가 없으면 섹션 자체를 숨김

  return (
    <View>
      <Text style={styles.label}>동료들의 오늘 한 줄</Text>
      {items.map(r => {
        const name = r.nickname || '동료';   // 닉네임 임베드 null 폴백
        return (
          <View key={r.id} style={styles.card}>
            <View style={styles.head}>
              {r.avatar_url ? (
                <Image source={{ uri: r.avatar_url }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatar, styles.avatarFallback]}>
                  <Text style={styles.avatarInit}>{name.slice(0, 1)}</Text>
                </View>
              )}
              <Text style={styles.name}>{name}</Text>
            </View>
            <Text style={styles.content}>{r.content}</Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  label: {
    fontSize: fontSize.base,
    fontFamily: fontFamily.bold,
    fontWeight: fontWeight.bold,
    color: colors.sub,
    marginTop: 24,
    marginBottom: 10,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 14,
    marginBottom: 8,
    gap: 8,
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  avatar: { width: 24, height: 24, borderRadius: 12, backgroundColor: colors.primary100 },
  avatarFallback: { alignItems: 'center', justifyContent: 'center' },
  avatarInit: {
    fontSize: fontSize.xs,
    color: colors.sub,
    fontFamily: fontFamily.bold,
    fontWeight: fontWeight.bold,
  },
  name: {
    fontSize: fontSize.sm,
    color: colors.sub,
    fontFamily: fontFamily.medium,
    fontWeight: fontWeight.medium,
  },
  content: {
    fontSize: fontSize.base,
    color: colors.ink,
    fontFamily: fontFamily.regular,
    lineHeight: 21,
  },
});
