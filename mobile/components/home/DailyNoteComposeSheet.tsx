// 🚀 하루 리듬 작성 시트 — 아침 다짐 / 저녁 회고 한 줄 입력.
//   저녁 회고는 fellow 고정, 아침 다짐만 공개(fellow)/사적(private) 토글. 검수는 createDailyNote 내부 포함.
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
      await createDailyNote({ userId, kind, content: text, visibility: kind === 'intention' ? visibility : 'fellow' });
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
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
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

            {kind === 'intention' && (
              <View style={styles.visRow}>
                <Pressable
                  style={[styles.visChip, visibility === 'fellow' && styles.visChipOn]}
                  onPress={() => { haptic.tap(); setVisibility('fellow'); }}
                >
                  <Text style={[styles.visChipText, visibility === 'fellow' && styles.visChipTextOn]}>동료에게 공개</Text>
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
