// 🚀 챌린지 만들기 — 1화면 폼 (MVP_SCOPE: 7단계 마법사 X)
import React, { useState } from 'react';
import {
  View, Text, TextInput, StyleSheet, ScrollView, Pressable,
  KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { router, Stack } from 'expo-router';
import { Screen } from '@/components/Screen';
import { Button } from '@/components/Button';
import { colors, fontFamily, fontSize, fontWeight, radius } from '@/lib/tokens';
import { useSession } from '@/lib/session';
import { createChallenge } from '@/lib/db';

const DURATIONS = [
  { label: '7일', value: 7 },
  { label: '14일', value: 14 },
  { label: '30일', value: 30 },
  { label: '60일', value: 60 },
  { label: '100일', value: 100 },
] as const;

export default function CreateChallenge() {
  const session = useSession();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [duration, setDuration] = useState<number>(30);
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = title.trim().length >= 2 && !submitting;

  const onSubmit = async () => {
    if (!session?.user) {
      Alert.alert('로그인 필요', '먼저 로그인해주세요.');
      return;
    }
    setSubmitting(true);
    try {
      const challenge = await createChallenge({
        userId: session.user.id,
        title,
        description,
        durationDays: duration,
      });
      // 생성된 챌린지 방으로 바로 이동. fromCreate=1 → room 에서 초대 안내 모달 자동 노출.
      router.replace(`/room/${challenge.id}?fromCreate=1` as any);
    } catch (e: any) {
      Alert.alert('만들기 실패', e?.message ?? String(e));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Screen backgroundColor={colors.background}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* 헤더 */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Text style={styles.cancel}>취소</Text>
        </Pressable>
        <Text style={styles.headerTitle}>새 챌린지</Text>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.scroll}>
          {/* 제목 */}
          <Field label="챌린지 제목">
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder="예: 매일 아침 6시 기상"
              placeholderTextColor={colors.primary300}
              style={styles.input}
              maxLength={40}
              returnKeyType="next"
            />
            <Text style={styles.counter}>{title.length} / 40</Text>
          </Field>

          {/* 기간 */}
          <Field label="기간">
            <View style={styles.chipRow}>
              {DURATIONS.map(d => (
                <Pressable
                  key={d.value}
                  style={[
                    styles.chip,
                    duration === d.value && styles.chipActive,
                  ]}
                  onPress={() => setDuration(d.value)}
                >
                  <Text
                    style={[
                      styles.chipText,
                      duration === d.value && styles.chipTextActive,
                    ]}
                  >
                    {d.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </Field>

          {/* 설명 (선택) */}
          <Field label="설명 (선택)">
            <TextInput
              value={description}
              onChangeText={setDescription}
              placeholder="동료들에게 보여줄 한 문장"
              placeholderTextColor={colors.primary300}
              style={[styles.input, styles.inputMulti]}
              maxLength={200}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
            <Text style={styles.counter}>{description.length} / 200</Text>
          </Field>

          <View style={styles.note}>
            <Text style={styles.noteText}>
              만들면 카톡으로 공유할 초대 링크가 자동 생성돼요. 동료가 들어오면 함께 도전이 시작됩니다.
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* 하단 액션 */}
      <View style={styles.bottom}>
        <Button
          label={submitting ? '만드는 중…' : '만들기'}
          size="xl"
          block
          disabled={!canSubmit}
          onPress={onSubmit}
        />
      </View>
    </Screen>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: 8 }}>
      <Text style={styles.label}>{label}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    height: 52,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: colors.primary100,
  },
  cancel: {
    fontSize: fontSize.base,
    color: colors.primary500,
    fontFamily: fontFamily.medium,
    width: 40,
  },
  headerTitle: {
    fontSize: fontSize.lg,
    color: colors.primary,
    fontFamily: fontFamily.bold,
    fontWeight: fontWeight.bold,
  },
  scroll: {
    padding: 24,
    gap: 28,
  },
  label: {
    fontSize: fontSize.base,
    color: colors.primary,
    fontFamily: fontFamily.bold,
    fontWeight: fontWeight.bold,
  },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.primary100,
    borderRadius: radius.lg,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: fontSize.lg,
    fontFamily: fontFamily.regular,
    color: colors.primary,
  },
  inputMulti: {
    minHeight: 100,
  },
  counter: {
    fontSize: fontSize.xs,
    color: colors.primary300,
    fontFamily: fontFamily.regular,
    textAlign: 'right',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.primary100,
  },
  chipActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  chipText: {
    fontSize: fontSize.base,
    color: colors.primary500,
    fontFamily: fontFamily.medium,
  },
  chipTextActive: {
    color: colors.surface,
    fontFamily: fontFamily.bold,
    fontWeight: fontWeight.bold,
  },
  note: {
    padding: 14,
    backgroundColor: colors.accent50,
    borderRadius: radius.md,
  },
  noteText: {
    fontSize: fontSize.sm,
    color: colors.accent700,
    fontFamily: fontFamily.regular,
    lineHeight: 20,
  },
  bottom: {
    padding: 24,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.primary100,
    backgroundColor: colors.background,
  },
});
