// 🚀 사진 인증 — expo-camera 로 직접 촬영 (MVP_SCOPE: 갤러리 X)
// 흐름: 권한 요청 → 카메라 → 셔터 → 미리보기 + 캡션 → R2 업로드 + proofs insert
import React, { useRef, useState } from 'react';
import {
  View, Text, Pressable, TextInput, StyleSheet, Alert, Image,
  ActivityIndicator,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Screen } from '@/components/Screen';
import { Button } from '@/components/Button';
import { colors, fontFamily, fontSize, fontWeight, radius } from '@/lib/tokens';
import { uploadProofImage } from '@/lib/upload';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';

export default function CheckinScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const cameraRef = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();

  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [caption, setCaption] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const onCapture = async () => {
    if (!cameraRef.current) return;
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.8 });
      if (photo?.uri) setPhotoUri(photo.uri);
    } catch (e) {
      Alert.alert('촬영 실패', String(e));
    }
  };

  const onRetake = () => {
    setPhotoUri(null);
    setCaption('');
  };

  const onSubmit = async () => {
    if (!photoUri) return;
    setSubmitting(true);
    try {
      // 1) R2 업로드 (Supabase 미연동 시 로컬 URI 그대로 반환)
      const photoUrl = await uploadProofImage(photoUri, 'jpg');

      // 2) Supabase 가 구성된 경우만 proofs insert
      if (isSupabaseConfigured) {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('로그인이 필요합니다.');
        const { error } = await supabase.from('proofs').insert({
          challenge_id: id,
          user_id: user.id,
          photo_url: photoUrl,
          caption: caption.trim() || null,
        });
        if (error) throw error;
      }

      Alert.alert('인증 완료!', '동료들이 응원하러 올 거예요. 💛', [
        { text: '확인', onPress: () => router.back() },
      ]);
    } catch (e: any) {
      Alert.alert('인증 실패', e?.message ?? String(e));
    } finally {
      setSubmitting(false);
    }
  };

  // ─── 권한 분기 ────────────────────────────────────────
  if (!permission) {
    return (
      <Screen backgroundColor={colors.primary} statusBarStyle="light">
        <View style={styles.permWrap}>
          <ActivityIndicator color={colors.accent} />
        </View>
      </Screen>
    );
  }

  if (!permission.granted) {
    return (
      <Screen backgroundColor={colors.primary} statusBarStyle="light">
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Text style={styles.close}>✕</Text>
          </Pressable>
          <Text style={styles.title}>카메라 권한 필요</Text>
          <View style={{ width: 32 }} />
        </View>
        <View style={styles.permWrap}>
          <Text style={styles.permEmoji}>📷</Text>
          <Text style={styles.permTitle}>카메라로 직접 촬영해야 인증돼요</Text>
          <Text style={styles.permDesc}>
            갤러리 업로드는 어뷰징 방지를 위해 막혀 있어요.
          </Text>
          <Button label="카메라 권한 허용" size="lg" onPress={requestPermission} />
        </View>
      </Screen>
    );
  }

  // ─── 본 화면 ────────────────────────────────────────
  return (
    <Screen backgroundColor={colors.primary} statusBarStyle="light">
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} disabled={submitting}>
          <Text style={styles.close}>✕</Text>
        </Pressable>
        <Text style={styles.title}>오늘 인증</Text>
        <View style={{ width: 32 }} />
      </View>

      <View style={styles.viewfinder}>
        {photoUri ? (
          <Image source={{ uri: photoUri }} style={styles.preview} resizeMode="cover" />
        ) : (
          <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing="back" />
        )}
      </View>

      {photoUri && (
        <View style={styles.captionBox}>
          <TextInput
            value={caption}
            onChangeText={setCaption}
            placeholder="한 줄 코멘트 (선택)"
            placeholderTextColor={colors.primary300}
            style={styles.captionInput}
            maxLength={140}
            editable={!submitting}
          />
        </View>
      )}

      <View style={styles.bottom}>
        {photoUri ? (
          <View style={{ gap: 8 }}>
            <Button
              label={submitting ? '업로드 중…' : '이 사진으로 인증'}
              size="xl"
              block
              disabled={submitting}
              onPress={onSubmit}
            />
            <Pressable style={styles.retake} onPress={onRetake} disabled={submitting}>
              <Text style={[styles.retakeText, submitting && { opacity: 0.4 }]}>
                다시 찍기
              </Text>
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
  close: { fontSize: 24, color: colors.surface, width: 32 },
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
    position: 'relative',
  },
  preview: { flex: 1, width: '100%', height: '100%' },
  captionBox: { paddingHorizontal: 16, paddingBottom: 12 },
  captionInput: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: fontSize.base,
    color: colors.surface,
    fontFamily: fontFamily.regular,
  },
  bottom: { padding: 16, paddingTop: 8, alignItems: 'center' },
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
  retake: { paddingVertical: 12, alignItems: 'center' },
  retakeText: {
    color: colors.primary300,
    fontSize: fontSize.base,
    fontFamily: fontFamily.medium,
  },
  permWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 16,
  },
  permEmoji: { fontSize: 80, marginBottom: 8 },
  permTitle: {
    fontSize: fontSize.xl,
    color: colors.surface,
    fontFamily: fontFamily.bold,
    fontWeight: fontWeight.bold,
    textAlign: 'center',
  },
  permDesc: {
    fontSize: fontSize.sm,
    color: colors.primary300,
    fontFamily: fontFamily.regular,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 16,
  },
});
