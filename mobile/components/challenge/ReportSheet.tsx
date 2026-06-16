// 🚀 신고 시트 — 사유 6종 선택 + 선택적 상세 → createReport (0047)
// 같은 대상 신고 3건 누적 시 서버 트리거가 자동숨김. 중복 신고는 친절 거부.
import React, { useEffect, useState } from 'react';
import {
  View, Text, Pressable, Modal, StyleSheet, TextInput, ActivityIndicator, Alert,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { colors, fontFamily, fontSize, fontWeight, radius, shadow } from '@/lib/tokens';
import { haptic } from '@/lib/haptics';
import { createReport, type ReportTargetType, type ReportReason } from '@/lib/db';

type Props = {
  visible: boolean;
  onClose: () => void;
  reporterId: string | undefined;
  targetType: ReportTargetType;
  targetId: string | null;
};

const REASONS: { value: ReportReason; label: string }[] = [
  { value: 'spam',          label: '스팸·광고' },
  { value: 'abuse',         label: '욕설·혐오' },
  { value: 'sexual',        label: '음란물' },
  { value: 'violence',      label: '폭력·자해' },
  { value: 'impersonation', label: '사칭' },
  { value: 'other',         label: '기타' },
];

export function ReportSheet({ visible, onClose, reporterId, targetType, targetId }: Props) {
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [detail, setDetail] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setReason(null);
    setDetail('');
    setBusy(false);
  }, [visible]);

  const onSubmit = async () => {
    if (!reporterId || !targetId || !reason || busy) return;
    setBusy(true);
    try {
      await createReport({ reporterId, targetType, targetId, reason, detail });
      haptic.success();
      onClose();
      Alert.alert('신고 접수', '신고가 접수됐어요. 검토 후 조치할게요. 감사합니다.');
    } catch (e: any) {
      Alert.alert('신고', e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={styles.backdrop} onPress={onClose}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <Text style={styles.title}>신고하기</Text>
            <Text style={styles.sub}>어떤 점이 문제인가요?</Text>

            <View style={styles.reasonWrap}>
              {REASONS.map(r => {
                const active = reason === r.value;
                return (
                  <Pressable
                    key={r.value}
                    style={[styles.reasonChip, active && styles.reasonChipActive]}
                    onPress={() => { haptic.tap(); setReason(r.value); }}
                    disabled={busy}
                  >
                    <Text style={[styles.reasonText, active && styles.reasonTextActive]}>{r.label}</Text>
                  </Pressable>
                );
              })}
            </View>

            <TextInput
              value={detail}
              onChangeText={setDetail}
              placeholder="자세한 내용 (선택)"
              placeholderTextColor={colors.primary300}
              style={styles.input}
              multiline
              maxLength={500}
              editable={!busy}
            />

            <Pressable
              style={[styles.primaryBtn, (busy || !reason) && styles.btnDisabled]}
              onPress={onSubmit}
              disabled={busy || !reason}
            >
              {busy ? <ActivityIndicator color={colors.surface} /> : <Text style={styles.primaryBtnText}>신고 접수</Text>}
            </Pressable>
            <Text style={styles.note}>접수된 신고는 운영팀이 검토합니다. 허위 신고는 제재될 수 있어요.</Text>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: 24,
    paddingBottom: 36,
    gap: 12,
    ...shadow.lg,
  },
  title: {
    fontSize: fontSize.lg,
    color: colors.primary,
    fontFamily: fontFamily.bold,
    fontWeight: fontWeight.bold,
    textAlign: 'center',
  },
  sub: {
    fontSize: fontSize.sm,
    color: colors.primary500,
    fontFamily: fontFamily.regular,
    textAlign: 'center',
    marginBottom: 4,
  },
  reasonWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
  },
  reasonChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.primary100,
    backgroundColor: colors.background,
  },
  reasonChipActive: {
    borderColor: colors.accent,
    backgroundColor: colors.accent50,
  },
  reasonText: {
    fontSize: fontSize.sm,
    color: colors.primary500,
    fontFamily: fontFamily.medium,
    fontWeight: fontWeight.medium,
  },
  reasonTextActive: { color: colors.accent700, fontFamily: fontFamily.bold, fontWeight: fontWeight.bold },
  input: {
    borderWidth: 1,
    borderColor: colors.primary100,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    minHeight: 64,
    fontSize: fontSize.base,
    color: colors.primary,
    fontFamily: fontFamily.regular,
    backgroundColor: colors.background,
    textAlignVertical: 'top',
  },
  primaryBtn: {
    backgroundColor: colors.accent,
    borderRadius: radius.lg,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 2,
  },
  btnDisabled: { opacity: 0.5 },
  primaryBtnText: {
    fontSize: fontSize.base,
    color: colors.surface,
    fontFamily: fontFamily.bold,
    fontWeight: fontWeight.bold,
  },
  note: {
    fontSize: 11,
    color: colors.primary300,
    fontFamily: fontFamily.regular,
    textAlign: 'center',
  },
});
