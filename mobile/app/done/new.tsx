// 🚀 완주 이야기 작성 (v2.5 — 해냈어요 진입점)
//
// 진입: ArchiveTab "완주 이야기 공유하기" → /done/new?challengeId=...
// 정체성: 자랑 X · 증언 ✓.
//   - 시스템 통계 (총 기간 · 인증 횟수 · 최장 연속 · 완주율) 자동 잠금 (조작 불가)
//   - 6개 사용자 옵션 (한 줄 소감 · 어려웠던 점 · 포기 시 도움 · 시작하는 사람에게
//     · 나만의 꿀팁 · 무엇이 달라졌나) 모두 선택. 빈 항목은 상세에 노출 X.
//   - 대표 사진 (옵션, 최대 N장)
//   - 공개 범위: 해냈어요 탭 공개 / 도전 인연에게만
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, TextInput, Alert,
  ActivityIndicator, Image, Platform, KeyboardAvoidingView,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '@/components/Screen';
import { colors, fontFamily, fontSize, fontWeight, radius, shadow } from '@/lib/tokens';
import { useSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';
import { haptic } from '@/lib/haptics';
import { uploadProofImage } from '@/lib/upload';
import {
  createCompletionStory, fetchMyCompletionStoryForChallenge,
} from '@/lib/db';
import type { StoryVisibility } from '@/lib/types';

// ─── 이야기 6개 필드 — 라벨/플레이스홀더/길이 ─────────────
type FieldKey = 'story' | 'hardest' | 'helped' | 'advice' | 'ownTip' | 'whatChanged';
const FIELDS: { key: FieldKey; label: string; ph: string; maxLen: number; multiline: boolean }[] = [
  { key: 'story',       label: '한 줄 소감',                  ph: '어떻게 다 끝낸 기분인지 한 줄로 남겨주세요.',         maxLen: 500,  multiline: false },
  { key: 'hardest',     label: '가장 어려웠던 점은?',          ph: '예: 3일째 저녁이 제일 힘들었어요. 손이 자꾸 갔어요.', maxLen: 1000, multiline: true  },
  { key: 'helped',      label: '포기하고 싶을 때 뭐가 도왔나요?', ph: '예: 방 동료들이 솔직히 털어놔서 다 같이 버텼어요.', maxLen: 1500, multiline: true  },
  { key: 'advice',      label: '시작하는 사람에게 한마디',      ph: '예: 딱 3일만 버텨봐요. 그 다음은 쉬워져요.',          maxLen: 1000, multiline: true  },
  { key: 'ownTip',      label: '나만의 방법 · 꿀팁',           ph: '예: 알람을 신발 옆에 두면 안 일어날 수가 없어요.',    maxLen: 1000, multiline: true  },
  { key: 'whatChanged', label: '이 도전으로 무엇이 달라졌나요?', ph: '예: 아침 시간이 늘어났고, 가족과 시간이 생겼어요.',  maxLen: 1500, multiline: true  },
];

type Stats = {
  totalDays: number;
  proofCount: number;
  longestStreak: number;
  completionRate: number;   // 0~100
};

type Challenge = {
  id: string;
  title: string;
  start_date: string;
  end_date: string;
  category: { emoji: string; name: string } | null;
};

const MAX_PHOTOS = 3;

export default function NewCompletionStoryScreen() {
  const { challengeId } = useLocalSearchParams<{ challengeId: string }>();
  const session = useSession();
  const myUserId = session?.user?.id;

  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 6개 필드 상태
  const [fields, setFields] = useState<Record<FieldKey, string>>({
    story: '', hardest: '', helped: '', advice: '', ownTip: '', whatChanged: '',
  });
  // 대표 사진 (로컬 URI 또는 업로드된 publicUrl 혼재)
  const [photos, setPhotos] = useState<string[]>([]);
  // 공개 범위
  const [visibility, setVisibility] = useState<StoryVisibility>('public');
  // 제출 중
  const [submitting, setSubmitting] = useState(false);

  // ─── 초기 로드 — 챌린지 정보 + 본인 인증 → 시스템 통계 미리보기 ───
  useEffect(() => {
    if (!challengeId || !myUserId) return;
    (async () => {
      try {
        setError(null);
        // 이미 작성한 경우 → 차단
        const existing = await fetchMyCompletionStoryForChallenge({ challengeId, userId: myUserId });
        if (existing) {
          Alert.alert(
            '이미 이야기가 있어요',
            '이 도전의 완주 이야기는 이미 작성하셨어요.',
            [{ text: '확인', onPress: () => router.back() }],
          );
          return;
        }

        // 챌린지 정보
        const { data: ch, error: chErr } = await supabase
          .from('challenges')
          .select(`
            id, title, start_date, end_date,
            category:category_id (emoji, name)
          `)
          .eq('id', challengeId)
          .single();
        if (chErr) throw chErr;

        // 본인 인증
        const { data: proofs, error: pErr } = await supabase
          .from('proofs')
          .select('created_at')
          .eq('challenge_id', challengeId)
          .eq('user_id', myUserId);
        if (pErr) throw pErr;

        const c = ch as any as Challenge;
        setChallenge(c);
        setStats(computeStatsPreview(c, proofs ?? []));
      } catch (e: any) {
        setError(e?.message ?? '불러오지 못했어요.');
      } finally {
        setLoading(false);
      }
    })();
  }, [challengeId, myUserId]);

  // ─── 사진 추가 (보관함) ───
  const onAddPhoto = useCallback(async () => {
    if (photos.length >= MAX_PHOTOS) return;
    haptic.tap();
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('보관함 접근 권한이 필요해요', '설정 → Do:하다 → 사진 에서 켜주세요.');
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85,
      selectionLimit: 1,
    });
    if (res.canceled || !res.assets?.[0]?.uri) return;
    setPhotos(prev => [...prev, res.assets[0].uri]);
  }, [photos.length]);

  const removePhoto = (idx: number) => {
    haptic.tap();
    setPhotos(prev => prev.filter((_, i) => i !== idx));
  };

  // ─── 제출 ───
  const allEmpty = useMemo(
    () => FIELDS.every(f => !fields[f.key].trim()) && photos.length === 0,
    [fields, photos],
  );

  const onSubmit = useCallback(async () => {
    if (!challengeId || !myUserId) return;
    haptic.tap();

    // 모두 비어 있어도 통계만으로 증언 가능. 다만 한 번 확인.
    if (allEmpty) {
      const proceed = await new Promise<boolean>(resolve => {
        Alert.alert(
          '항목 없이 공유할까요?',
          '시스템 통계만 노출돼요. 한 줄이라도 남겨두면 다음 사람에게 큰 힘이 됩니다.',
          [
            { text: '조금 더 쓸게요', style: 'cancel', onPress: () => resolve(false) },
            { text: '통계만 공유', onPress: () => resolve(true) },
          ],
        );
      });
      if (!proceed) return;
    }

    setSubmitting(true);
    try {
      // 사진 R2 업로드 (로컬 URI → publicUrl)
      const uploadedUrls: string[] = [];
      for (const uri of photos) {
        try {
          const publicUrl = await uploadProofImage(uri);
          uploadedUrls.push(publicUrl);
        } catch {
          // 한 장 실패해도 나머지는 시도
        }
      }

      await createCompletionStory({
        challengeId,
        userId: myUserId,
        story: nullIfEmpty(fields.story),
        hardest: nullIfEmpty(fields.hardest),
        helpedWhenGivingUp: nullIfEmpty(fields.helped),
        adviceToStarters: nullIfEmpty(fields.advice),
        ownTip: nullIfEmpty(fields.ownTip),
        whatChanged: nullIfEmpty(fields.whatChanged),
        photoUrls: uploadedUrls,
        visibility,
      });

      haptic.success();
      Alert.alert(
        '공유했어요',
        '해냈어요 탭에서 다른 분들이 볼 수 있어요.\n다음 사람에게 용기가 될 거예요.',
        [{ text: '확인', onPress: () => router.replace('/(tabs)/done' as any) }],
      );
    } catch (e: any) {
      Alert.alert('공유 실패', e?.message ?? String(e));
    } finally {
      setSubmitting(false);
    }
  }, [challengeId, myUserId, fields, photos, visibility, allEmpty]);

  // ─── 렌더 ───
  if (loading) {
    return (
      <Screen backgroundColor={colors.background}>
        <View style={[styles.center, { flex: 1 }]}>
          <ActivityIndicator color={colors.accent} />
        </View>
      </Screen>
    );
  }
  if (error || !challenge || !stats) {
    return (
      <Screen backgroundColor={colors.background}>
        <View style={[styles.center, { flex: 1, paddingHorizontal: 24 }]}>
          <Text style={styles.errText}>{error ?? '챌린지 정보를 불러오지 못했어요.'}</Text>
          <Pressable style={styles.errBtn} onPress={() => router.back()}>
            <Text style={styles.errBtnText}>돌아가기</Text>
          </Pressable>
        </View>
      </Screen>
    );
  }

  return (
    <Screen backgroundColor={colors.background}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 12 : 0}
      >
        {/* 헤더 */}
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={8}>
            <Ionicons name="close" size={24} color={colors.primary} />
          </Pressable>
          <Text style={styles.headerTitle}>완주 이야기 공유</Text>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView
          contentContainerStyle={{ paddingBottom: 120 }}
          keyboardShouldPersistTaps="handled"
        >
          {/* 챌린지 메타 */}
          <View style={styles.meta}>
            {challenge.category && (
              <Text style={styles.metaCat}>
                {challenge.category.emoji} {challenge.category.name}
              </Text>
            )}
            <Text style={styles.metaTitle}>{challenge.title}</Text>
          </View>

          {/* 통계 — 시스템 자동 잠금 */}
          <View style={styles.statsBlock}>
            <View style={styles.lockRow}>
              <Ionicons name="lock-closed" size={12} color={colors.primary500} />
              <Text style={styles.lockText}>시스템이 증명 · 조작 불가</Text>
            </View>
            <View style={styles.statsGrid}>
              <StatCell num={stats.totalDays}      label="일 완주" />
              <StatCell num={stats.longestStreak}  label="연속 최고" />
              <StatCell num={stats.proofCount}     label="인증" />
              <StatCell num={Math.round(stats.completionRate)} label="완주율 %" />
            </View>
          </View>

          {/* 대표 사진 (옵션) */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>
              대표 사진 <Text style={styles.optional}>(선택)</Text>
            </Text>
            <View style={styles.photoRow}>
              {photos.map((uri, i) => (
                <View key={i} style={styles.photoSlot}>
                  <Image source={{ uri }} style={styles.photoImg} />
                  <Pressable style={styles.photoX} onPress={() => removePhoto(i)} hitSlop={8}>
                    <Ionicons name="close" size={14} color="#fff" />
                  </Pressable>
                </View>
              ))}
              {photos.length < MAX_PHOTOS && (
                <Pressable style={styles.photoAdd} onPress={onAddPhoto}>
                  <Ionicons name="add" size={28} color={colors.primary500} />
                </Pressable>
              )}
            </View>
          </View>

          {/* 이야기 — 6개 모두 선택 */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>이야기</Text>
            <Text style={styles.sectionGuide}>
              쓰고 싶은 것만 — 빈 항목은 공개되지 않아요.
            </Text>
            {FIELDS.map(f => (
              <Field
                key={f.key}
                label={f.label}
                value={fields[f.key]}
                placeholder={f.ph}
                maxLen={f.maxLen}
                multiline={f.multiline}
                onChange={v => setFields(prev => ({ ...prev, [f.key]: v }))}
              />
            ))}
          </View>

          {/* 공개 범위 */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>공개 범위</Text>
            <Pressable
              style={[styles.radio, visibility === 'public' && styles.radioOn]}
              onPress={() => { haptic.tap(); setVisibility('public'); }}
            >
              <View style={[styles.radioCircle, visibility === 'public' && styles.radioCircleOn]} />
              <View style={{ flex: 1 }}>
                <Text style={styles.radioLabel}>🏆 해냈어요 탭에 공개 · 누구나</Text>
                <Text style={styles.radioDesc}>다음 사람에게 용기를 전달해요</Text>
              </View>
            </Pressable>
            <Pressable
              style={[styles.radio, visibility === 'allies' && styles.radioOn]}
              onPress={() => { haptic.tap(); setVisibility('allies'); }}
            >
              <View style={[styles.radioCircle, visibility === 'allies' && styles.radioCircleOn]} />
              <View style={{ flex: 1 }}>
                <Text style={styles.radioLabel}>🙋 도전 인연에게만</Text>
                <Text style={styles.radioDesc}>같은 챌린지 멤버에게만 보여요</Text>
              </View>
            </Pressable>
          </View>
        </ScrollView>

        {/* 하단 공유 버튼 */}
        <View style={styles.submitBar}>
          <Pressable
            style={[styles.submitBtn, submitting && { opacity: 0.6 }]}
            onPress={onSubmit}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.submitText}>이야기 공유하기</Text>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

// ─── 시스템 통계 미리보기 — 클라이언트 추정 ───
// DB 트리거가 INSERT 시 정확히 다시 계산하므로 여기선 미리보기 용도.
function computeStatsPreview(ch: Challenge, proofs: { created_at: string }[]): Stats {
  const start = new Date(ch.start_date);
  const end = new Date(ch.end_date + 'T23:59:59');
  const totalDays = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / 86_400_000));

  // Asia/Seoul 기준 일별 unique 카운트
  const dailySet = new Set(
    proofs.map(p => {
      const d = new Date(p.created_at);
      // 간단히 로컬 날짜 (Expo dev 환경 가정)
      return d.toISOString().slice(0, 10);
    }),
  );
  const proofCount = proofs.length;

  // longest streak — 단순화 (gaps-and-islands 클라이언트 버전)
  const dates = [...dailySet].sort();
  let longest = 0;
  let cur = 0;
  let prev: string | null = null;
  for (const d of dates) {
    if (prev) {
      const diff = (new Date(d).getTime() - new Date(prev).getTime()) / 86_400_000;
      if (Math.round(diff) === 1) cur += 1;
      else cur = 1;
    } else cur = 1;
    if (cur > longest) longest = cur;
    prev = d;
  }

  const completionRate = Math.min(100, Math.round((proofCount / totalDays) * 100));
  return { totalDays, proofCount, longestStreak: longest, completionRate };
}

function nullIfEmpty(s: string): string | null {
  const t = s.trim();
  return t.length === 0 ? null : t;
}

// ─── 작은 컴포넌트 ───
function StatCell({ num, label }: { num: number; label: string }) {
  return (
    <View style={styles.statCell}>
      <Text style={styles.statNum}>{num}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function Field({
  label, value, placeholder, maxLen, multiline, onChange,
}: {
  label: string;
  value: string;
  placeholder: string;
  maxLen: number;
  multiline: boolean;
  onChange: (v: string) => void;
}) {
  return (
    <View style={styles.field}>
      <View style={styles.fieldHead}>
        <Text style={styles.fieldLabel}>{label}</Text>
        <Text style={styles.fieldOpt}>{value ? `${value.length}/${maxLen}` : '선택'}</Text>
      </View>
      <TextInput
        value={value}
        onChangeText={v => onChange(v.slice(0, maxLen))}
        placeholder={placeholder}
        placeholderTextColor={colors.primary300}
        multiline={multiline}
        style={[styles.fieldInput, multiline && { minHeight: 72, textAlignVertical: 'top' }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
  errText: {
    fontSize: fontSize.base, color: colors.primary, textAlign: 'center', marginBottom: 16,
    fontFamily: fontFamily.medium, fontWeight: fontWeight.medium,
  },
  errBtn: {
    paddingHorizontal: 20, paddingVertical: 12,
    backgroundColor: colors.accent, borderRadius: radius.pill,
  },
  errBtnText: { color: colors.surface, fontFamily: fontFamily.bold, fontWeight: fontWeight.bold },

  // 헤더
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 14,
    backgroundColor: colors.surface,
    borderBottomWidth: 1, borderBottomColor: colors.primary100,
  },
  headerTitle: {
    fontSize: fontSize.lg, color: colors.primary,
    fontFamily: fontFamily.bold, fontWeight: fontWeight.bold,
    letterSpacing: -0.3,
  },

  // 챌린지 메타
  meta: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 8 },
  metaCat: {
    fontSize: fontSize.xs, color: colors.accent700,
    fontFamily: fontFamily.medium, fontWeight: fontWeight.semibold,
    marginBottom: 4,
  },
  metaTitle: {
    fontSize: fontSize.xl, color: colors.primary,
    fontFamily: fontFamily.bold, fontWeight: fontWeight.bold,
    letterSpacing: -0.5,
  },

  // 통계
  statsBlock: {
    marginHorizontal: 20, marginTop: 12,
    padding: 16, backgroundColor: colors.accent50,
    borderRadius: radius.lg, borderWidth: 1, borderColor: colors.accent100,
  },
  lockRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 10 },
  lockText: {
    fontSize: fontSize.xs, color: colors.primary500,
    fontFamily: fontFamily.medium, fontWeight: fontWeight.medium,
  },
  statsGrid: { flexDirection: 'row', justifyContent: 'space-between', gap: 6 },
  statCell: {
    flex: 1, alignItems: 'center',
    paddingVertical: 10, backgroundColor: colors.surface,
    borderRadius: radius.md,
  },
  statNum: {
    fontSize: fontSize.xl, color: colors.primary,
    fontFamily: fontFamily.bold, fontWeight: fontWeight.bold,
  },
  statLabel: {
    fontSize: 10, color: colors.primary500,
    fontFamily: fontFamily.regular, marginTop: 2,
  },

  // 섹션
  section: { paddingHorizontal: 20, paddingTop: 22 },
  sectionLabel: {
    fontSize: fontSize.base, color: colors.primary,
    fontFamily: fontFamily.bold, fontWeight: fontWeight.bold,
    marginBottom: 6,
  },
  sectionGuide: {
    fontSize: fontSize.xs, color: colors.primary500,
    fontFamily: fontFamily.regular,
    marginBottom: 12,
  },
  optional: {
    fontSize: fontSize.xs, color: colors.primary500,
    fontFamily: fontFamily.regular, fontWeight: fontWeight.regular,
  },

  // 사진
  photoRow: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  photoSlot: {
    width: 84, height: 84, borderRadius: radius.md, position: 'relative',
    backgroundColor: colors.primary100,
  },
  photoImg: { width: '100%', height: '100%', borderRadius: radius.md },
  photoX: {
    position: 'absolute', top: 4, right: 4,
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center', justifyContent: 'center',
  },
  photoAdd: {
    width: 84, height: 84, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.primary100, borderStyle: 'dashed',
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.surface,
  },

  // 필드
  field: {
    marginBottom: 14, padding: 14,
    backgroundColor: colors.surface, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.primary100,
  },
  fieldHead: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline',
    marginBottom: 6,
  },
  fieldLabel: {
    fontSize: fontSize.sm, color: colors.primary,
    fontFamily: fontFamily.bold, fontWeight: fontWeight.semibold,
  },
  fieldOpt: {
    fontSize: 11, color: colors.primary500,
    fontFamily: fontFamily.regular,
  },
  fieldInput: {
    fontSize: fontSize.sm, color: colors.primary,
    fontFamily: fontFamily.regular,
    padding: 0,
  },

  // 라디오 (공개 범위)
  radio: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
    padding: 14, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.primary100,
    backgroundColor: colors.surface,
    marginBottom: 10,
  },
  radioOn: {
    borderColor: colors.accent,
    backgroundColor: colors.accent50,
  },
  radioCircle: {
    width: 18, height: 18, borderRadius: 9,
    borderWidth: 2, borderColor: colors.primary300,
    marginTop: 2,
  },
  radioCircleOn: {
    borderColor: colors.accent,
    backgroundColor: colors.accent,
  },
  radioLabel: {
    fontSize: fontSize.sm, color: colors.primary,
    fontFamily: fontFamily.bold, fontWeight: fontWeight.semibold,
  },
  radioDesc: {
    fontSize: fontSize.xs, color: colors.primary500,
    fontFamily: fontFamily.regular, marginTop: 2,
  },

  // 하단 공유
  submitBar: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    paddingHorizontal: 20, paddingTop: 12, paddingBottom: Platform.OS === 'ios' ? 28 : 16,
    backgroundColor: colors.surface,
    borderTopWidth: 1, borderTopColor: colors.primary100,
  },
  submitBtn: {
    paddingVertical: 16, borderRadius: radius.pill,
    backgroundColor: colors.accent, alignItems: 'center',
    ...shadow.sm,
  },
  submitText: {
    fontSize: fontSize.base, color: colors.surface,
    fontFamily: fontFamily.bold, fontWeight: fontWeight.bold,
    letterSpacing: -0.2,
  },
});
