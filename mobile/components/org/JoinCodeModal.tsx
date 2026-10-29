// 🚀 참여 코드 새로 정하기 — 구성원 전용 조직 하다 (0089)
//   서버는 해시만 남겨 기존 코드를 보여 줄 수 없다 → 잊었으면 새로 정한다. 기존 멤버는 그대로.
import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, Modal, Pressable, StyleSheet, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { Button } from '@/components/Button';
import { setJoinCode, JOIN_CODE_PATTERN } from '@/lib/org';
import { colors, fontFamily, fontSize, fontWeight, radius } from '@/lib/tokens';

type Props = { challengeId: string | null; title: string; onClose: () => void };

export function JoinCodeModal({ challengeId, title, onClose }: Props) {
  const [code, setCode] = useState('');
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (challengeId) setCode(''); }, [challengeId]);

  const onSave = async () => {
    if (!challengeId) return;
    try {
      setSaving(true);
      await setJoinCode(challengeId, code);
      Alert.alert('참여 코드를 바꿨어요', `${code.toUpperCase()}\n\n이미 합류한 구성원은 그대로예요. 새로 합류할 사람에게 알려 주세요.`);
      onClose();
    } catch (e: any) {
      Alert.alert('바꾸지 못했어요', e?.message ?? String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={!!challengeId} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.backdrop} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={styles.box}>
          <Text style={styles.title}>참여 코드 새로 정하기</Text>
          <Text style={styles.sub} numberOfLines={1}>{title}</Text>
          <TextInput
            style={styles.input} value={code} placeholder="영문·숫자 4~12자" placeholderTextColor={colors.faint}
            autoCapitalize="characters" autoCorrect={false} maxLength={12} autoFocus
            onChangeText={t => setCode(t.replace(/[^A-Za-z0-9]/g, ''))}
          />
          <Button label="저장" onPress={onSave} disabled={!JOIN_CODE_PATTERN.test(code)} loading={saving} block size="lg" />
          <Button label="닫기" onPress={onClose} variant="ghost" block size="md" />
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', paddingHorizontal: 24 },
  box: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: 20, gap: 12 },
  title: { fontSize: fontSize.lg, color: colors.ink, fontFamily: fontFamily.bold, fontWeight: fontWeight.bold },
  sub: { fontSize: fontSize.sm, color: colors.sub, fontFamily: fontFamily.regular },
  input: {
    backgroundColor: colors.bg, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line,
    paddingHorizontal: 14, paddingVertical: 12, fontSize: fontSize.base, color: colors.ink,
    fontFamily: fontFamily.bold, letterSpacing: 2, textAlign: 'center',
  },
});
