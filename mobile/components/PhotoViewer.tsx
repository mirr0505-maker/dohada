// 🚀 전체화면 사진 뷰어 (라이트박스) — 인증/기록 사진 잘림 보완
//   - 카드 프리뷰는 크롭이지만, 탭하면 여기서 원본 전체를 contain 으로 봄
//   - 닫기: 화면 탭 또는 아래로 쓸어내리기 (X 안 눌러도 됨) + 백업 ✕ 버튼
//   - 줌: 핀치 + 더블탭 (스샷의 시간/거리 등 세부 확대)
//   의존성 0 — 이미 설치된 react-native-gesture-handler + reanimated 사용 (OTA 가능)
import React, { useEffect } from 'react';
import { Modal, StyleSheet, useWindowDimensions, Pressable, Text } from 'react-native';
import { GestureHandlerRootView, GestureDetector, Gesture } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue, useAnimatedStyle, withTiming, runOnJS, interpolate, Extrapolation,
} from 'react-native-reanimated';

export function PhotoViewer({ uri, onClose }: { uri: string | null; onClose: () => void }) {
  const { width, height } = useWindowDimensions();
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const savedTx = useSharedValue(0);
  const savedTy = useSharedValue(0);

  // 새 사진을 열 때마다 줌/위치 초기화 (뷰어는 항상 마운트되어 shared value 가 남기 때문)
  useEffect(() => {
    if (uri) {
      scale.value = 1; savedScale.value = 1;
      tx.value = 0; ty.value = 0; savedTx.value = 0; savedTy.value = 0;
    }
  }, [uri]);

  // 핀치 줌 (최소 1배 — 축소는 막아 항상 화면 채움)
  const pinch = Gesture.Pinch()
    .onUpdate(e => { scale.value = Math.max(1, savedScale.value * e.scale); })
    .onEnd(() => { savedScale.value = scale.value; });

  // 팬 — 줌 상태면 이미지 이동, 원래 크기면 아래로 끌어 닫기
  const pan = Gesture.Pan()
    .onUpdate(e => {
      if (scale.value > 1) {
        tx.value = savedTx.value + e.translationX;
        ty.value = savedTy.value + e.translationY;
      } else {
        ty.value = e.translationY;
      }
    })
    .onEnd(e => {
      if (scale.value > 1) {
        savedTx.value = tx.value; savedTy.value = ty.value;
      } else if (Math.abs(e.translationY) > 120) {
        runOnJS(onClose)();
      } else {
        ty.value = withTiming(0);
      }
    });

  // 더블탭 — 줌 토글 (2.5배 ↔ 원래)
  const doubleTap = Gesture.Tap().numberOfTaps(2)
    .onEnd(() => {
      if (scale.value > 1) {
        scale.value = withTiming(1); savedScale.value = 1;
        tx.value = withTiming(0); ty.value = withTiming(0);
        savedTx.value = 0; savedTy.value = 0;
      } else {
        scale.value = withTiming(2.5); savedScale.value = 2.5;
      }
    });

  // 단일탭 — 원래 크기일 때 닫기 (더블탭과 충돌 방지 위해 Exclusive)
  const singleTap = Gesture.Tap().numberOfTaps(1)
    .onEnd(() => { if (scale.value <= 1) runOnJS(onClose)(); });

  const gesture = Gesture.Simultaneous(pinch, pan, Gesture.Exclusive(doubleTap, singleTap));

  const imgStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }, { translateY: ty.value }, { scale: scale.value }],
  }));
  // 아래로 끌수록 배경이 옅어짐 (닫히는 느낌)
  const backdropStyle = useAnimatedStyle(() => ({
    opacity: scale.value > 1
      ? 1
      : interpolate(Math.abs(ty.value), [0, 250], [1, 0.3], Extrapolation.CLAMP),
  }));

  return (
    <Modal visible={!!uri} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <GestureHandlerRootView style={styles.root}>
        <Animated.View style={[styles.backdrop, backdropStyle]} />
        <GestureDetector gesture={gesture}>
          <Animated.View style={styles.center}>
            {uri ? (
              <Animated.Image source={{ uri }} style={[{ width, height }, imgStyle]} resizeMode="contain" />
            ) : null}
          </Animated.View>
        </GestureDetector>
        <Pressable style={styles.closeBtn} onPress={onClose} hitSlop={12}>
          <Text style={styles.closeText}>✕</Text>
        </Pressable>
        <Text style={styles.hint}>탭 또는 아래로 쓸어내려 닫기</Text>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: '#000' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  closeBtn: {
    position: 'absolute', top: 52, right: 18,
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center',
  },
  closeText: { color: '#fff', fontSize: 18, fontWeight: '600' },
  hint: {
    position: 'absolute', bottom: 40, alignSelf: 'center',
    color: 'rgba(255,255,255,0.6)', fontSize: 13,
  },
});
