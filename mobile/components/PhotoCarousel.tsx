// 🚀 PhotoCarousel — 카드 안 인라인 사진 페이저 (인증 최대 3·기록 최대 4)
//   - 1장: 그냥 이미지. 2장 이상: 가로 pagingEnabled 스크롤 + 점 인디케이터 + "N/M" 배지
//   - 세로 피드 안 가로 페이저라 RN 방향 잠금으로 피드 스크롤과 충돌 안 남 (인스타 패턴)
//   - 탭하면 onPressPhoto(현재 index) → 부모가 전체화면 뷰어를 그 장부터 연다
//   의존성 0 (RN ScrollView). OTA 가능.
import React, { useState } from 'react';
import { View, Image, Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { colors, fontFamily, fontWeight, radius } from '@/lib/tokens';

export function PhotoCarousel({
  photos,
  aspectRatio = 1,
  borderRadius = radius.md,
  onPressPhoto,
  topRight,
}: {
  photos: string[];
  aspectRatio?: number;
  borderRadius?: number;
  onPressPhoto?: (index: number) => void;
  topRight?: React.ReactNode;   // 우상단 오버레이 슬롯 (예: 연속 인증 메달)
}) {
  const [w, setW] = useState(0);
  const [idx, setIdx] = useState(0);
  if (!photos || photos.length === 0) return null;
  const multi = photos.length > 1;

  return (
    <View
      style={[styles.frame, { aspectRatio, borderRadius }]}
      onLayout={e => setW(e.nativeEvent.layout.width)}
    >
      {multi && w > 0 ? (
        <ScrollView
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          style={StyleSheet.absoluteFill}
          onMomentumScrollEnd={e => setIdx(Math.round(e.nativeEvent.contentOffset.x / w))}
        >
          {photos.map((uri, i) => (
            <Pressable key={`${uri}-${i}`} onPress={() => onPressPhoto?.(i)}>
              <Image source={{ uri }} style={{ width: w, height: w / aspectRatio }} resizeMode="cover" />
            </Pressable>
          ))}
        </ScrollView>
      ) : (
        <Pressable onPress={() => onPressPhoto?.(0)}>
          <Image source={{ uri: photos[0] }} style={{ width: '100%', aspectRatio }} resizeMode="cover" />
        </Pressable>
      )}

      {topRight ? <View style={styles.topRight} pointerEvents="box-none">{topRight}</View> : null}

      {multi && (
        <>
          <View style={styles.countBadge}>
            <Text style={styles.countText}>{idx + 1}/{photos.length}</Text>
          </View>
          <View style={styles.dots} pointerEvents="none">
            {photos.map((_, i) => (
              <View key={i} style={[styles.dot, i === idx && styles.dotActive]} />
            ))}
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    width: '100%',
    overflow: 'hidden',
    backgroundColor: colors.primary50,
    position: 'relative',
  },
  topRight: { position: 'absolute', top: 10, right: 10 },
  countBadge: {
    position: 'absolute',
    top: 10,
    left: 10,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: radius.pill,
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  countText: {
    color: '#fff',
    fontSize: 11,
    fontFamily: fontFamily.bold,
    fontWeight: fontWeight.bold,
  },
  dots: {
    position: 'absolute',
    bottom: 8,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 5,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.55)',
  },
  dotActive: { backgroundColor: '#fff', width: 7, height: 7, borderRadius: 3.5 },
});
