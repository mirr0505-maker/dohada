// 🚀 사진 인증 — 카메라 + 보관함 스크린샷 (v2.2)
// 운동·등산·사이클·걷기 앱의 자체 기록 화면 스샷을 인증으로 활용 (페르소나 직답).
// 흐름: 카메라 셔터 OR 보관함 선택 → 미리보기 + 캡션 → R2 업로드 + proofs insert
import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, Pressable, TextInput, StyleSheet, Alert, Image,
  ActivityIndicator,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { Screen } from '@/components/Screen';
import { Button } from '@/components/Button';
import { colors, fontFamily, fontSize, fontWeight, radius } from '@/lib/tokens';
import { uploadProofImage } from '@/lib/upload';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { haptic } from '@/lib/haptics';
import { getKstTodayRange } from '@/lib/format';
import type { ChallengeKind } from '@/lib/types';

export default function CheckinScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const cameraRef = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();

  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [caption, setCaption] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [pickerBusy, setPickerBusy] = useState(false);   // ImagePicker 호출 동안 CameraView unmount (native UI 충돌 방지)
  const [challengeKind, setChallengeKind] = useState<ChallengeKind | null>(null);   // 인증 완료 메시지 분류별 분기

  // 진입 시 challenge.kind 한 번 fetch — 분류별 톤
  // + 종료된 챌린지 인증 차단 (DB 0024 RLS 와 이중 방어 — raw 에러 대신 친절한 안내)
  useEffect(() => {
    if (!id || !isSupabaseConfigured) return;
    supabase.from('challenges').select('kind, end_date').eq('id', id).single()
      .then(({ data }) => {
        if (!data) return;
        if (data.kind) setChallengeKind(data.kind as ChallengeKind);
        if (data.end_date && getKstTodayRange().kstDateStr > data.end_date) {
          Alert.alert(
            '도전 종료',
            '이미 종료된 도전이에요.\n남긴 인증은 챌린지방 박제 탭에서 볼 수 있어요.',
            [{ text: '확인', onPress: () => router.back() }],
            { cancelable: false },
          );
        }
      });
  }, [id]);

  const onCapture = async () => {
    if (!cameraRef.current) return;
    try {
      haptic.medium();
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

  // 보관함에서 스크린샷 선택 (v2.2 — 운동/걷기 앱 기록 화면 활용)
  // CameraView 가 떠있으면 PHPicker 와 native UI 충돌해서 picker 가 즉시 닫힘 → CameraView 잠시 unmount.
  const onPickFromLibrary = async () => {
    haptic.tap();
    setPickerBusy(true);
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (perm.status === 'denied') {
        Alert.alert('보관함 접근 권한이 필요해요', '설정 → Do:하다 → 사진 에서 켜주세요.');
        return;
      }
      // CameraView unmount 가 commit 될 시간 한 박자
      await new Promise(r => setTimeout(r, 80));
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],   // v18 호환 — MediaTypeOptions 는 deprecated
        quality: 0.85,
        exif: false,
      });
      console.log('[checkin/picker]', JSON.stringify({
        canceled: result.canceled,
        count: result.assets?.length ?? 0,
        uri: result.assets?.[0]?.uri?.slice(0, 60),
      }));
      if (result.canceled) return;
      const uri = result.assets?.[0]?.uri;
      if (uri) {
        console.log('[checkin/setPhotoUri] calling with', uri.slice(0, 80));
        setPhotoUri(uri);
      } else {
        Alert.alert('사진을 못 가져왔어요', '다시 시도해주세요.');
      }
    } catch (e: any) {
      Alert.alert('사진 선택 실패', e?.message ?? String(e));
    } finally {
      setPickerBusy(false);
    }
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

      haptic.success();
      Alert.alert('인증 완료!', kindCompleteMessage(challengeKind), [
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
          <Text style={styles.title}>오늘 인증</Text>
          <View style={{ width: 32 }} />
        </View>
        <View style={styles.permWrap}>
          <Text style={styles.permEmoji}>📷</Text>
          <Text style={styles.permTitle}>카메라로 인증하면 가장 빨라요</Text>
          <Text style={styles.permDesc}>
            운동·걷기 앱 기록 화면 스샷도 인증으로 OK.{'\n'}시간 표시가 보이는 스샷이면 좋아요.
          </Text>
          <Button label="카메라 권한 허용" size="lg" onPress={requestPermission} />
          <Pressable style={styles.libBtnAlt} onPress={onPickFromLibrary}>
            <Text style={styles.libBtnAltText}>🖼️ 보관함에서 선택 (앱 스샷)</Text>
          </Pressable>
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
          <Image
            source={{ uri: photoUri }}
            style={styles.preview}
            resizeMode="cover"
            onLoad={() => console.log('[checkin/Image] loaded', photoUri.slice(0, 60))}
            onError={e => console.log('[checkin/Image] error', e.nativeEvent?.error ?? 'unknown')}
          />
        ) : pickerBusy ? (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: '#0A0A0A' }]} />
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
                다시 선택
              </Text>
            </Pressable>
          </View>
        ) : (
          <View style={{ alignItems: 'center', gap: 12 }}>
            <Pressable style={styles.shutter} onPress={onCapture}>
              <View style={styles.shutterInner} />
            </Pressable>
            <Pressable style={styles.libBtn} onPress={onPickFromLibrary}>
              <Text style={styles.libBtnText}>🖼️ 보관함 (앱 스샷)</Text>
            </Pressable>
            <Text style={styles.libHint}>
              운동·걷기 앱 기록 화면 — 시간 표시 보이게
            </Text>
          </View>
        )}
      </View>
    </Screen>
  );
}

// 챌린지 방 종류별 인증 완료 메시지 — solo 는 "동료" 단어 사용 X (조용한 SNS 톤)
function kindCompleteMessage(kind: ChallengeKind | null): string {
  if (kind === 'solo')    return '오늘 하루 잘 해냈어요.\n내일 또 만나요. 💛';
  if (kind === 'cheered') return '응원자들이 곧 응원하러 올 거예요. 💛';
  return '동료들이 응원하러 올 거예요. 💛';
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
    color: colors.primary500,
    fontSize: fontSize.base,
    fontFamily: fontFamily.medium,
  },
  libBtn: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: radius.pill,
  },
  libBtnText: {
    color: colors.surface,
    fontSize: fontSize.sm,
    fontFamily: fontFamily.medium,
    fontWeight: fontWeight.medium,
  },
  libHint: {
    color: colors.primary500,
    fontSize: fontSize.xs,
    fontFamily: fontFamily.regular,
  },
  libBtnAlt: {
    marginTop: 12,
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderRadius: radius.pill,
  },
  libBtnAltText: {
    color: colors.surface,
    fontSize: fontSize.base,
    fontFamily: fontFamily.medium,
    fontWeight: fontWeight.medium,
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
    color: colors.primary500,
    fontFamily: fontFamily.regular,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 16,
  },
});
