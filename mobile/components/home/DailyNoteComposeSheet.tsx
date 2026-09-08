// 🚀 하루 리듬 작성 시트 — 아침 다짐 / 저녁 회고 한 줄 입력.
//   아침 다짐 = 내 하다 안에서 나만 보는 기록이라 선택 없이 바로 저장(private 고정).
//   저녁 회고 = 홈에서 동료가 목격하는 글이라 공개(기본)/나만 보기 선택. 검수는 createDailyNote 내부 포함.
import React, { useEffect, useState } from 'react';
import {
  View, Text, Pressable, Modal, StyleSheet, TextInput, ActivityIndicator, Alert,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { colors, fontFamily, fontSize, fontWeight, radius, shadow } from '@/lib/tokens';
import { haptic } from '@/lib/haptics';
import { createDailyNote, type DailyNoteKind, type DailyNoteVisibility } from '@/lib/db';

type Props = {
  visible: boolean;
  kind: DailyNoteKind;
  label: string;
  prompt: string;
  placeholder: string;
  initialContent: string;
  initialVisibility: DailyNoteVisibility;
  userId: string | undefined;
  onClose: () => void;
  onSaved: () => void;
};

export function DailyNoteComposeSheet({
  visible, kind, label, prompt, placeholder,
  initialContent, initialVisibility, userId, onClose, onSaved,
}: Props) {
  const [text, setText] = useState(initialContent);
  const [visibility, setVisibility] = useState<DailyNoteVisibility>(initialVisibility);
  const [busy, setBusy] = useState(false);

  // 열릴 때마다 현재 값으로 초기화 (수정 진입 시 기존 한 줄 프리필)
  useEffect(() => {
    if (visible) { setText(initialContent); setVisibility(initialVisibility); setBusy(false); }
  }, [visible, initialContent, initialVisibility]);

  const onSave = async () => {
    if (!userId || busy || !text.trim()) return;
    setBusy(true);
    try {
      // 다짐은 나만 보는 기록(private 고정), 회고만 사용자가 고른 공개 범위를 따른다
      await createDailyNote({ userId, kind, content: text, visibility: kind === 'reflection' ? visibility : 'private' });
      haptic.success();
      onSaved();
      onClose();
    } catch (e: any) {
      Alert.alert('저장하지 못했어요', e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      {/* 안드로이드는 'height' 라야 키보드가 시트를 덮지 않는다 — Modal 은 별도 윈도우라
          매니페스트 adjustResize 가 안 먹고, edgeToEdgeEnabled=true 라 시스템 리사이즈도 없음
          (CommentsSheet 와 동일 패턴). undefined 면 회피 자체가 꺼져 갤럭시에서 입력칸이 가려졌다. */}
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <Pressable style={styles.backdrop} onPress={onClose}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <Text style={styles.title}>{label}</Text>
            <Text style={styles.prompt}>{prompt}</Text>
            <TextInput
              style={styles.input}
              value={text}
              onChangeText={setText}
              placeholder={placeholder}
              placeholderTextColor={colors.faint}
              multiline
              maxLength={200}
              autoFocus
            />
            <Text style={styles.counter}>{text.length}/200</Text>

            {kind === 'intention' ? (
              <Text style={styles.privateHint}>나만 볼 수 있어요 · 내 하다에만 남아요</Text>
            ) : (
              <View style={styles.visRow}>
                <Pressable
                  style={[styles.visChip, visibility === 'fellow' && styles.visChipOn]}
                  onPress={() => { haptic.tap(); setVisibility('fellow'); }}
                >
                  <Text style={[styles.visChipText, visibility === 'fellow' && styles.visChipTextOn]}>홈에 공개</Text>
                </Pressable>
                <Pressable
                  style={[styles.visChip, visibility === 'private' && styles.visChipOn]}
                  onPress={() => { haptic.tap(); setVisibility('private'); }}
                >
                  <Text style={[styles.visChipText, visibility === 'private' && styles.visChipTextOn]}>나만 보기</Text>
                </Pressable>
              </View>
            )}

            <Pressable
              style={[styles.saveBtn, (busy || !text.trim()) && styles.saveBtnOff]}
              onPress={onSave}
              disabled={busy || !text.trim()}
            >
              {busy ? <ActivityIndicator color={colors.onBrand} /> : <Text style={styles.saveBtnText}>남기기</Text>}
            </Pressable>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: 24,
    paddingBottom: 36,
    gap: 10,
    ...shadow.lg,
  },
  title: {
    fontSize: fontSize.lg,
    color: colors.ink,
    fontFamily: fontFamily.bold,
    fontWeight: fontWeight.bold,
  },
  prompt: {
    fontSize: fontSize.sm,
    color: colors.sub,
    fontFamily: fontFamily.regular,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    padding: 14,
    minHeight: 96,
    fontSize: fontSize.base,
    color: colors.ink,
    fontFamily: fontFamily.regular,
    backgroundColor: colors.bg,
    textAlignVertical: 'top',
  },
  counter: {
    fontSize: fontSize.xs,
    color: colors.faint,
    fontFamily: fontFamily.regular,
    textAlign: 'right',
  },
  privateHint: {
    fontSize: fontSize.xs,
    color: colors.faint,
    fontFamily: fontFamily.regular,
  },
  visRow: { flexDirection: 'row', gap: 8 },
  visChip: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: 'center',
  },
  visChipOn: { backgroundColor: colors.brandTint, borderColor: colors.brand },
  visChipText: {
    fontSize: fontSize.sm,
    color: colors.sub,
    fontFamily: fontFamily.medium,
    fontWeight: fontWeight.medium,
  },
  visChipTextOn: { color: colors.brandInk, fontFamily: fontFamily.bold, fontWeight: fontWeight.bold },
  saveBtn: {
    backgroundColor: colors.brand,
    borderRadius: radius.lg,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 2,
  },
  saveBtnOff: { opacity: 0.5 },
  saveBtnText: {
    fontSize: fontSize.base,
    color: colors.onBrand,
    fontFamily: fontFamily.bold,
    fontWeight: fontWeight.bold,
  },
});
