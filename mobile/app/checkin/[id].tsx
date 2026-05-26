// 🚀 사진 인증 — 앱 내 카메라로 직접 촬영 (MVP_SCOPE: 갤러리 X)
// Week 1 단계는 카메라 UI 만 더미로. expo-camera 실제 연동은 Week 2 에서.
import React, { useState } from 'react';
import { View, Text, Pressable, TextInput, StyleSheet, Alert } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Screen } from '@/components/Screen';
import { Button } from '@/components/Button';
import { colors, fontFamily, fontSize, fontWeight, radius } from '@/lib/tokens';

export default function CheckinScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [captured, setCaptured] = useState(false);
  const [caption, setCaption] = useState('');

  const onCapture = () => {
    // Week 2 에서 expo-camera takePictureAsync 로 교체
    setCaptured(true);
  };

  const onRetake = () => {
    setCaptured(false);
    setCaption('');
  };

  const onSubmit = () => {
    // Week 2 에서 Supabase storage upload + proofs insert 로 교체
    Alert.alert('인증 완료!', '동료들이 응원하러 올 거예요. 💛', [
      { text: '확인', onPress: () => router.back() },
    ]);
  };

  return (
    <Screen backgroundColor={colors.primary} statusBarStyle="light">
      {/* 헤더 */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Text style={styles.close}>✕</Text>
        </Pressable>
        <Text style={styles.title}>오늘 인증</Text>
        <View style={{ width: 32 }} />
      </View>

      {/* 카메라 / 미리보기 영역 */}
      <View style={styles.viewfinder}>
        {captured ? (
          <View style={styles.preview}>
            <Text style={{ fontSize: 120 }}>📸</Text>
            <Text style={styles.previewLabel}>촬영 완료 (더미)</Text>
          </View>
        ) : (
          <View style={styles.cameraView}>
            <View style={styles.cameraGrid} />
            <Text style={styles.cameraGuide}>
              카메라로 직접 촬영{'\n'}갤러리 업로드는 어뷰징 방지를 위해 막혀 있어요
            </Text>
          </View>
        )}
      </View>

      {/* 캡션 입력 (촬영 후에만) */}
      {captured && (
        <View style={styles.captionBox}>
          <TextInput
            value={caption}
            onChangeText={setCaption}
            placeholder="한 줄 코멘트 (선택)"
            placeholderTextColor={colors.primary300}
            style={styles.captionInput}
            maxLength={140}
          />
        </View>
      )}

      {/* 액션 */}
      <View style={styles.bottom}>
        {captured ? (
          <View style={{ gap: 8 }}>
            <Button label="이 사진으로 인증" size="xl" block onPress={onSubmit} />
            <Pressable style={styles.retake} onPress={onRetake}>
              <Text style={styles.retakeText}>다시 찍기</Text>
            </Pressable>
          </View>
        ) : (
          <Pressable style={styles.shutter} onPress={onCapture}>
            <View style={styles.shutterInner} />
          </Pressable>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    height: 56,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  close: {
    fontSize: 24,
    color: colors.surface,
    width: 32,
  },
  title: {
    fontSize: fontSize.lg,
    color: colors.surface,
    fontFamily: fontFamily.bold,
    fontWeight: fontWeight.bold,
  },
  viewfinder: {
    flex: 1,
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: radius['2xl'],
    overflow: 'hidden',
    backgroundColor: '#0A0A0A',
  },
  cameraView: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  cameraGrid: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  cameraGuide: {
    fontSize: fontSize.sm,
    color: colors.primary300,
    fontFamily: fontFamily.regular,
    textAlign: 'center',
    lineHeight: 20,
  },
  preview: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  previewLabel: {
    color: colors.primary300,
    fontSize: fontSize.sm,
    fontFamily: fontFamily.regular,
  },
  captionBox: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  captionInput: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: fontSize.base,
    color: colors.surface,
    fontFamily: fontFamily.regular,
  },
  bottom: {
    padding: 16,
    paddingTop: 8,
    alignItems: 'center',
  },
  shutter: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 4,
    borderColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterInner: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.surface,
  },
  retake: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  retakeText: {
    color: colors.primary300,
    fontSize: fontSize.base,
    fontFamily: fontFamily.medium,
  },
});
