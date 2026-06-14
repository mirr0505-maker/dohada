// 🚀 전체화면 사진 뷰어 (라이트박스) — 인증/기록 사진 잘림 보완 + 여러 장 좌우 넘기기(0045)
//   - 카드 프리뷰는 크롭이지만, 탭하면 여기서 원본 전체를 contain 으로 봄
//   - 여러 장: 좌우 스와이프 페이징(FlatList) + "i/N" 인디케이터. 줌 중엔 페이징 잠금
//   - 줌: 핀치 + 더블탭. 닫기: 화면 탭(원래 크기일 때) 또는 ✕ 버튼
//   의존성 0 — 이미 설치된 react-native-gesture-handler + reanimated 사용 (OTA 가능)
import React, { useEffect, useState } from 'react';
import { Modal, StyleSheet, useWindowDimensions, Pressable, Text, FlatList, View } from 'react-native';
import { GestureHandlerRootView, GestureDetector, Gesture } from 'react-native-gesture-handler';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, runOnJS } from 'react-native-reanimated';

type Props = {
  photos: string[] | null;     // 보여줄 사진들 (null/빈 = 닫힘)
  initialIndex?: number;       // 시작 장 index
  onClose: () => void;
};

export function PhotoViewer({ photos, initialIndex = 0, onClose }: Props) {
  const { width, height } = useWindowDimensions();
  const [idx, setIdx] = useState(initialIndex);
  const [zoomed, setZoomed] = useState(false);   // 줌 중이면 페이징 잠금
  const list = photos ?? [];
  const open = list.length > 0;

  useEffect(() => {
    if (open) { setIdx(initialIndex); setZoomed(false); }
  }, [open, initialIndex]);

  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <GestureHandlerRootView style={styles.root}>
        <View style={styles.backdrop} />
        <FlatList
          data={list}
          keyExtractor={(uri, i) => `${uri}-${i}`}
          horizontal
          pagingEnabled
          scrollEnabled={!zoomed && list.length > 1}
          showsHorizontalScrollIndicator={false}
          initialScrollIndex={Math.min(initialIndex, Math.max(0, list.length - 1))}
          getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
          onMomentumScrollEnd={e => setIdx(Math.round(e.nativeEvent.contentOffset.x / width))}
          renderItem={({ item }) => (
            <ZoomablePage
              uri={item}
              width={width}
              height={height}
              onClose={onClose}
              onZoomChange={setZoomed}
            />
          )}
        />
        {list.length > 1 && (
          <View style={styles.indexBadge} pointerEvents="none">
            <Text style={styles.indexText}>{idx + 1} / {list.length}</Text>
          </View>
        )}
        <Pressable style={styles.closeBtn} onPress={onClose} hitSlop={12}>
          <Text style={styles.closeText}>✕</Text>
        </Pressable>
        <Text style={styles.hint} pointerEvents="none">
          {list.length > 1 ? '좌우로 넘기기 · 탭하여 닫기' : '탭하여 닫기'}
        </Text>
      </GestureHandlerRootView>
    </Modal>
  );
}

// 한 장 — 핀치/더블탭 줌 + (줌 상태에서) 이동, 원래 크기에서 단일탭 닫기
function ZoomablePage({
  uri, width, height, onClose, onZoomChange,
}: {
  uri: string; width: number; height: number; onClose: () => void; onZoomChange: (z: boolean) => void;
}) {
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const savedTx = useSharedValue(0);
  const savedTy = useSharedValue(0);
  const [zoomed, setZoomed] = useState(false);   // pan.enabled 토글용 (JS 상태)

  const setZoom = (z: boolean) => { setZoomed(z); onZoomChange(z); };
  const reset = () => {
    scale.value = withTiming(1); savedScale.value = 1;
    tx.value = withTiming(0); ty.value = withTiming(0); savedTx.value = 0; savedTy.value = 0;
  };

  const pinch = Gesture.Pinch()
    .onUpdate(e => { scale.value = Math.max(1, savedScale.value * e.scale); })
    .onEnd(() => {
      savedScale.value = scale.value;
      runOnJS(setZoom)(scale.value > 1.01);
      if (scale.value <= 1) { tx.value = withTiming(0); ty.value = withTiming(0); savedTx.value = 0; savedTy.value = 0; }
    });

  // 줌 상태일 때만 활성 — 평소엔 FlatList 가로 페이징이 제스처를 가져감
  const pan = Gesture.Pan().enabled(zoomed)
    .onUpdate(e => { tx.value = savedTx.value + e.translationX; ty.value = savedTy.value + e.translationY; })
    .onEnd(() => { savedTx.value = tx.value; savedTy.value = ty.value; });

  const doubleTap = Gesture.Tap().numberOfTaps(2)
    .onEnd(() => {
      if (scale.value > 1) { reset(); runOnJS(setZoom)(false); }
      else { scale.value = withTiming(2.5); savedScale.value = 2.5; runOnJS(setZoom)(true); }
    });

  const singleTap = Gesture.Tap().numberOfTaps(1)
    .onEnd(() => { if (scale.value <= 1) runOnJS(onClose)(); });

  const gesture = Gesture.Simultaneous(pinch, pan, Gesture.Exclusive(doubleTap, singleTap));

  const imgStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }, { translateY: ty.value }, { scale: scale.value }],
  }));

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View style={{ width, height, alignItems: 'center', justifyContent: 'center' }}>
        <Animated.Image source={{ uri }} style={[{ width, height }, imgStyle]} resizeMode="contain" />
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: '#000' },
  closeBtn: {
    position: 'absolute', top: 52, right: 18,
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center',
  },
  closeText: { color: '#fff', fontSize: 18, fontWeight: '600' },
  indexBadge: {
    position: 'absolute', top: 56, alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 4,
  },
  indexText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  hint: {
    position: 'absolute', bottom: 40, alignSelf: 'center',
    color: 'rgba(255,255,255,0.6)', fontSize: 13,
  },
});
