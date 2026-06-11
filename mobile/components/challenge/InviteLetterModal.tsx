// 🚀 개설자(방장) 전체 메시지 발송 모달
import React, { useState, useEffect } from 'react';
import {
  View, Text, Modal, Pressable, StyleSheet, TextInput, ActivityIndicator, Alert, KeyboardAvoidingView, Platform
} from 'react-native';
import { colors, fontFamily, fontSize, fontWeight, radius, shadow } from '@/lib/tokens';
import { sendCreatorNotice } from '@/lib/db';
import { haptic } from '@/lib/haptics';

type Props = {
  visible: boolean;
  onClose: () => void;
  challengeId: string;
  onRefresh?: () => void;
};

export function InviteLetterModal({
  visible,
  onClose,
  challengeId,
  onRefresh,
}: Props) {
  const [messageDraft, setMessageDraft] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (visible) {
      setMessageDraft('');
    }
  }, [visible]);

  const handleSendNotice = async () => {
    const text = messageDraft.trim();
    if (!text) {
      Alert.alert('발송 실패', '메시지 내용을 입력해주세요.');
      return;
    }
    haptic.tap();
    setSending(true);
    try {
      await sendCreatorNotice({
        challengeId,
        message: text,
      });
      haptic.success();
      if (onRefresh) onRefresh();
      Alert.alert('발송 완료', '멤버들에게 전체 메시지가 발송되었습니다.');
      onClose();
    } catch (e: any) {
      Alert.alert('발송 실패', e?.message ?? String(e));
    } finally {
      setSending(false);
    }
  };

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ width: '100%', alignItems: 'center' }}
        >
          <Pressable style={styles.card} onPress={() => {}}>
            <Text style={styles.title}>📢 전체 메시지 발송</Text>
          
            <View style={styles.body}>
              <Text style={styles.label}>동료들에게 전체 푸시 알림을 보내고, 대화방 상단 공지판에 등록합니다.</Text>
              <TextInput
                style={styles.textInput}
                multiline
                numberOfLines={5}
                placeholder="예: 오늘 인증 마감 3시간 전입니다! 모두 서둘러주세요 🔥"
                placeholderTextColor={colors.primary300}
                value={messageDraft}
                onChangeText={setMessageDraft}
                maxLength={200}
                editable={!sending}
              />
              <Text style={styles.charCount}>{messageDraft.length}/200자</Text>
              
              <View style={styles.buttonRow}>
                <Pressable
                  style={[styles.btn, styles.btnSecondary]}
                  onPress={() => { haptic.tap(); onClose(); }}
                  disabled={sending}
                >
                  <Text style={styles.btnTextSecondary}>취소</Text>
                </Pressable>
                <Pressable
                  style={[styles.btn, styles.btnPrimary, (!messageDraft.trim() || sending) && styles.btnDisabled]}
                  onPress={handleSendNotice}
                  disabled={sending || !messageDraft.trim()}
                >
                  {sending ? (
                    <ActivityIndicator color="white" size="small" />
                  ) : (
                    <Text style={styles.btnTextPrimary}>발송하기</Text>
                  )}
                </Pressable>
              </View>
            </View>
          </Pressable>
        </KeyboardAvoidingView>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 320,
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: 24,
    ...shadow.md,
  },
  title: {
    fontSize: fontSize.md + 2,
    fontFamily: fontFamily.bold,
    fontWeight: fontWeight.bold,
    color: colors.primary,
    textAlign: 'center',
    marginBottom: 16,
  },
  body: {
    gap: 12,
  },
  label: {
    fontSize: fontSize.xs,
    fontFamily: fontFamily.medium,
    color: colors.primary500,
    lineHeight: 16,
    marginBottom: 4,
  },
  textInput: {
    backgroundColor: colors.primary50,
    borderWidth: 1,
    borderColor: colors.primary100,
    borderRadius: radius.md,
    padding: 12,
    fontSize: fontSize.base,
    fontFamily: fontFamily.regular,
    color: colors.primary,
    minHeight: 120,
    textAlignVertical: 'top',
  },
  charCount: {
    fontSize: 10,
    fontFamily: fontFamily.regular,
    color: colors.primary500,
    alignSelf: 'flex-end',
    marginTop: -4,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  btn: {
    flex: 1,
    height: 44,
    borderRadius: radius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  btnPrimary: {
    backgroundColor: colors.accent,
  },
  btnDisabled: {
    opacity: 0.5,
  },
  btnTextPrimary: {
    color: 'white',
    fontSize: fontSize.sm,
    fontFamily: fontFamily.bold,
    fontWeight: fontWeight.bold,
  },
  btnSecondary: {
    backgroundColor: colors.primary100,
  },
  btnTextSecondary: {
    color: colors.primary700,
    fontSize: fontSize.sm,
    fontFamily: fontFamily.medium,
  },
});
