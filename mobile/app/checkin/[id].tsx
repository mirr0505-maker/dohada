// 🚀 사진 인증 — 카메라 + 보관함 스크린샷 (v2.2)
// 운동·등산·사이클·걷기 앱의 자체 기록 화면 스샷을 인증으로 활용 (페르소나 직답).
// 흐름: 카메라 셔터 OR 보관함 선택 → 미리보기 + 캡션 → R2 업로드 + proofs insert
import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, Pressable, TextInput, StyleSheet, Alert, Image,
  ActivityIndicator, AppState, Platform,
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
import { streakMilestone } from '@/lib/stats';
import type { ChallengeKind } from '@/lib/types';

export default function CheckinScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const cameraRef = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();

  const [photoUris, setPhotoUris] = useState<string[]>([]);   // 🚀 0045: 인증 사진 최대 3장
  const [cameraMode, setCameraMode] = useState(true);         // 카메라 촬영 vs 선택 사진 검토
  const [reviewIndex, setReviewIndex] = useState(0);          // 검토 중 보고 있는 장
  const [caption, setCaption] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [pickerBusy, setPickerBusy] = useState(false);   // ImagePicker 호출 동안 CameraView unmount (native UI 충돌 방지)
  const MAX_PROOF_PHOTOS = 3;
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
            '하다 종료',
            '이미 종료된 하다예요.\n남긴 인증은 하다 방 박제 탭에서 볼 수 있어요.',
            [{ text: '확인', onPress: () => router.back() }],
            { cancelable: false },
          );
        }
      });
  }, [id]);

  // 🚀 안드로이드 보관함 결과 복구 — MainActivity 파괴로 유실된 선택을 되살림
  // 보관함(별도 액티비티)이 떠 있는 동안 안드로이드가 메모리를 회수하려고 MainActivity 를
  // 파괴하면, launchImageLibraryAsync 가 await 하던 결과가 통째로 유실된다(고른 사진이 안 들어옴).
  // expo 권장대로 getPendingResultAsync 로 보류된 결과를 받아 적용한다.
  //  - 마운트 시:        JS 가 리로드되며 이 화면으로 복귀한 경우
  //  - 포그라운드 복귀 시: JS 는 살아남고 액티비티만 재생성된 경우 (AppState 'active')
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const recoverPendingPick = async () => {
      try {
        const pending = await ImagePicker.getPendingResultAsync();
        // null(보류 없음) / 에러 결과(code 보유) / 취소는 복구 대상 아님
        if (!pending || 'code' in pending || pending.canceled) return;
        const uris = (pending.assets ?? []).map(a => a.uri).filter(Boolean) as string[];
        if (uris.length) {
          setPhotoUris(prev => [...prev, ...uris].slice(0, MAX_PROOF_PHOTOS));
          setCameraMode(false);
        }
      } catch {
        // 복구 실패는 조용히 무시 — 사용자는 다시 선택하면 됨
      } finally {
        // 유실로 picker await 가 영영 안 풀려 black 화면에 갇히는 것 방지
        setPickerBusy(false);
      }
    };
    recoverPendingPick();
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') recoverPendingPick();
    });
    return () => sub.remove();
  }, []);

  const onCapture = async () => {
    if (!cameraRef.current) return;
    try {
      haptic.medium();
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.8 });
      if (photo?.uri) {
        setPhotoUris(prev => [...prev, photo.uri].slice(0, MAX_PROOF_PHOTOS));
        setCameraMode(false);   // 한 장 찍으면 검토 화면으로 (더 찍기는 버튼으로)
      }
    } catch (e) {
      Alert.alert('촬영 실패', String(e));
    }
  };

  const onRetake = () => {
    setPhotoUris([]);
    setReviewIndex(0);
    setCaption('');
    setCameraMode(true);
  };

  const removePhoto = (i: number) => {
    setPhotoUris(prev => {
      const next = prev.filter((_, j) => j !== i);
      if (next.length === 0) setCameraMode(true);
      return next;
    });
    setReviewIndex(0);
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
      const remaining = MAX_PROOF_PHOTOS - photoUris.length;
      if (remaining <= 0) return;
      // CameraView unmount commit + (안드로이드) 카메라 네이티브 자원 해제까지 한 박자 더.
      // 카메라가 메모리를 쥐고 있으면 보관함 도중 MainActivity 가 회수돼 결과가 유실되기 쉬움.
      await new Promise(r => setTimeout(r, Platform.OS === 'android' ? 250 : 80));
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],   // v18 호환 — MediaTypeOptions 는 deprecated
        quality: 0.85,
        exif: false,
        allowsMultipleSelection: true,
        selectionLimit: remaining,
      });
      if (result.canceled) return;
      const uris = (result.assets ?? []).map(a => a.uri).filter(Boolean) as string[];
      if (uris.length) {
        setPhotoUris(prev => [...prev, ...uris].slice(0, MAX_PROOF_PHOTOS));
        setCameraMode(false);
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
    if (photoUris.length === 0) return;
    setSubmitting(true);
    try {
      // 1) R2 업로드 — 장수만큼 순서 보존 (Supabase 미연동 시 로컬 URI 그대로 반환)
      const urls: string[] = [];
      for (const u of photoUris) urls.push(await uploadProofImage(u, 'jpg'));

      // 2) Supabase 가 구성된 경우만 proofs insert (photo_url = 커버, photo_urls = 전체)
      //    streak_count 는 서버 BEFORE INSERT 트리거(0044)가 등록 시점에 계산 → 돌려받아 즉시 축하.
      let milestoneLine = '';
      if (isSupabaseConfigured) {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('로그인이 필요합니다.');
        const { data: inserted, error } = await supabase.from('proofs').insert({
          challenge_id: id,
          user_id: user.id,
          photo_url: urls[0],
          photo_urls: urls,
          caption: caption.trim() || null,
        }).select('streak_count').maybeSingle();   // maybeSingle: RLS 로 못 돌려받아도 인증 자체는 성공 처리
        if (error) throw error;
        // 🚀 연속 인증 마일스톤(3·7·21…)이면 등록 즉시 알럿에서 축하 — 메달은 게시글에도 그대로 부착
        const milestone = streakMilestone(inserted?.streak_count);
        if (milestone) milestoneLine = `🔥 ${milestone.day}일 연속 — ${milestone.label}!\n\n`;
      }

      haptic.success();
      Alert.alert('인증 완료!', milestoneLine + kindCompleteMessage(challengeKind), [
        { text: '확인', onPress: () => router.back() },
      ]);
    } catch (e: any) {
      // 같은 KST 날 이미 인증한 경우(서버 1일 1회 제약, cadence) — 날것 SQL 대신 친절 안내
      const dup = e?.code === '23505'
        || String(e?.message ?? '').includes('uniq_proofs_per_day');
      if (dup) {
        Alert.alert('오늘은 이미 인증했어요', '오늘 몫의 인증은 이미 완료됐어요.\n내일 또 만나요!', [
          { text: '확인', onPress: () => router.back() },
        ]);
      } else {
        Alert.alert('인증 실패', e?.message ?? String(e));
      }
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
        {cameraMode ? (
          pickerBusy ? (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: '#0A0A0A' }]} />
          ) : (
            <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing="back" />
          )
        ) : (
          <>
            <Image source={{ uri: photoUris[reviewIndex] }} style={styles.preview} resizeMode="cover" />
            {photoUris.length > 1 && (
              <View style={styles.reviewBadge}>
                <Text style={styles.reviewBadgeText}>{reviewIndex + 1}/{photoUris.length}</Text>
              </View>
            )}
            {/* 선택한 사진 썸네일 줄 — 탭하여 보기, ✕ 로 제거 */}
            <View style={styles.thumbRow}>
              {photoUris.map((uri, i) => (
                <Pressable key={`${uri}-${i}`} onPress={() => setReviewIndex(i)} style={styles.thumbWrap}>
                  <Image source={{ uri }} style={[styles.thumb, i === reviewIndex && styles.thumbActive]} />
                  <Pressable style={styles.thumbX} onPress={() => removePhoto(i)} hitSlop={6} disabled={submitting}>
                    <Text style={styles.thumbXText}>✕</Text>
                  </Pressable>
                </Pressable>
              ))}
            </View>
          </>
        )}
      </View>

      {!cameraMode && photoUris.length > 0 && (
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
        {!cameraMode && photoUris.length > 0 ? (
          <View style={{ gap: 8 }}>
            <Button
              label={submitting ? '업로드 중…' : `이 사진으로 인증${photoUris.length > 1 ? ` (${photoUris.length}장)` : ''}`}
              size="xl"
              block
              disabled={submitting}
              onPress={onSubmit}
            />
            {photoUris.length < MAX_PROOF_PHOTOS && (
              <View style={styles.addRow}>
                <Pressable style={styles.addBtn} onPress={() => setCameraMode(true)} disabled={submitting}>
                  <Text style={styles.addBtnText}>📷 더 찍기</Text>
                </Pressable>
                <Pressable style={styles.addBtn} onPress={onPickFromLibrary} disabled={submitting}>
                  <Text style={styles.addBtnText}>🖼️ 보관함</Text>
                </Pressable>
              </View>
            )}
            <Pressable style={styles.retake} onPress={onRetake} disabled={submitting}>
              <Text style={[styles.retakeText, submitting && { opacity: 0.4 }]}>처음부터 다시</Text>
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
            {photoUris.length > 0 ? (
              <Pressable onPress={() => setCameraMode(false)} hitSlop={8}>
                <Text style={styles.libHint}>← 선택한 {photoUris.length}장 보기</Text>
              </Pressable>
            ) : (
              <Text style={styles.libHint}>운동·걷기 앱 기록 화면 — 시간 표시 보이게</Text>
            )}
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
  reviewBadge: {
    position: 'absolute', top: 12, left: 12,
    backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: radius.pill,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  reviewBadgeText: { color: colors.surface, fontSize: 12, fontFamily: fontFamily.bold, fontWeight: fontWeight.bold },
  thumbRow: {
    position: 'absolute', bottom: 12, left: 12, right: 12,
    flexDirection: 'row', gap: 8,
  },
  thumbWrap: { position: 'relative' },
  thumb: {
    width: 56, height: 56, borderRadius: radius.sm,
    borderWidth: 2, borderColor: 'transparent',
  },
  thumbActive: { borderColor: colors.surface },
  thumbX: {
    position: 'absolute', top: -6, right: -6,
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.7)', alignItems: 'center', justifyContent: 'center',
  },
  thumbXText: { color: colors.surface, fontSize: 11, fontWeight: fontWeight.bold },
  addRow: { flexDirection: 'row', gap: 8 },
  addBtn: {
    flex: 1, alignItems: 'center', paddingVertical: 11,
    backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: radius.pill,
  },
  addBtnText: { color: colors.surface, fontSize: fontSize.sm, fontFamily: fontFamily.medium, fontWeight: fontWeight.medium },
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
