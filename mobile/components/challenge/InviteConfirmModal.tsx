// 🚀 초대 메시지 첨부 여부 확인 및 즉석 작성 유도 모달
import React, { useState, useEffect } from 'react';
import {
  View, Text, Modal, Pressable, StyleSheet, TextInput, ActivityIndicator, Alert, KeyboardAvoidingView, Platform
} from 'react-native';
import { colors, fontFamily, fontSize, fontWeight, radius, shadow } from '@/lib/tokens';
import { updateInvitationMessage } from '@/lib/db';
import { haptic } from '@/lib/haptics';

type Props = {
  visible: boolean;
  onClose: () => void;
  invitationMessage: string | null;
  challengeId: string;
  myUserId: string | undefined;
  creatorId: string;
  onShare: (messageToAttach: string | null) => void;
};

export function InviteConfirmModal({
  visible,
  onClose,
  invitationMessage,
  challengeId,
  myUserId,
  creatorId,
  onShare,
}: Props) {
  const isCreator = myUserId === creatorId;
  const hasMessage = !!(invitationMessage && invitationMessage.trim() !== '');

  const [quickMessage, setQuickMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [addingOwn, setAddingOwn] = useState(false);   // 일반 참여자: 기존 메시지 있을 때 본인 글귀 폼 토글

  // close 시점에만 reset — 모달이 닫혔다 다시 열릴 때 직전 입력이 초기화되도록.
  // (열릴 때마다 reset 하면 빠르게 toggle 시 입력이 날아갈 수 있음.)
  useEffect(() => {
    if (!visible) {
      setQuickMessage('');
      setAddingOwn(false);
    }
  }, [visible]);

  const handleShareWithExisting = () => {
    haptic.tap();
    onShare(invitationMessage);
    onClose();
  };

  const handleShareWithoutMessage = () => {
    haptic.tap();
    onShare(null);
    onClose();
  };

  const handleQuickSaveAndShare = async () => {
    if (quickMessage.trim() === '') {
      Alert.alert('알림', '초대 메시지를 입력해 주세요.');
      return;
    }
    haptic.tap();
    setSaving(true);
    try {
      await updateInvitationMessage({
        challengeId,
        message: quickMessage.trim(),
      });
      haptic.success();
      onShare(quickMessage.trim());
      onClose();
    } catch (e: any) {
      Alert.alert('오류', '메시지 저장 중 문제가 발생했습니다: ' + (e?.message ?? String(e)));
    } finally {
      setSaving(false);
    }
  };

  const handleParticipantShare = () => {
    if (quickMessage.trim() === '') {
      Alert.alert('알림', '초대 메시지를 입력해 주세요.');
      return;
    }
    haptic.tap();
    onShare(quickMessage.trim());
    onClose();
  };

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ width: '100%', alignItems: 'center' }}
        >
          <Pressable style={styles.card} onPress={() => {}}>
            <Text style={styles.title}>초대장 발송</Text>
          
          {hasMessage ? (
            /* 시나리오 A: 이미 작성된 초대 메시지가 있는 경우 */
            <View style={styles.body}>
              <Text style={styles.question}>초대 메시지를 첨부하시겠습니까?</Text>
              <View style={styles.previewBox}>
                <Text style={styles.previewLabel}>작성된 초대 메시지 미리보기</Text>
                <Text style={styles.previewText} numberOfLines={4}>
                  {invitationMessage}
                </Text>
              </View>

              {/* 일반 참여자가 본인 글귀를 추가하려고 토글한 경우 폼 노출 */}
              {!isCreator && addingOwn ? (
                <View style={styles.quickInputArea}>
                  <Text style={styles.quickInputLabel}>나만의 초대 메시지 작성하기</Text>
                  <TextInput
                    style={styles.textInput}
                    multiline
                    numberOfLines={3}
                    placeholder="개설자 메시지 대신 보낼 본인 글귀를 적어주세요."
                    placeholderTextColor={colors.primary300}
                    value={quickMessage}
                    onChangeText={setQuickMessage}
                    maxLength={200}
                  />
                  <Text style={styles.charCount}>{quickMessage.length}/200자</Text>
                  <View style={styles.buttonCol}>
                    <Pressable style={[styles.btn, styles.btnPrimary]} onPress={handleParticipantShare}>
                      <Text style={styles.btnTextPrimary}>내 글귀로 보내기</Text>
                    </Pressable>
                    <Pressable style={[styles.btn, styles.btnSecondary]} onPress={() => setAddingOwn(false)}>
                      <Text style={styles.btnTextSecondary}>← 뒤로</Text>
                    </Pressable>
                  </View>
                </View>
              ) : (
                <View style={styles.buttonCol}>
                  <Pressable style={[styles.btn, styles.btnPrimary]} onPress={handleShareWithExisting}>
                    <Text style={styles.btnTextPrimary}>위 메시지 첨부하여 공유</Text>
                  </Pressable>
                  {!isCreator && (
                    <Pressable
                      style={[styles.btn, styles.btnSecondary]}
                      onPress={() => { haptic.tap(); setAddingOwn(true); }}
                    >
                      <Text style={styles.btnTextSecondary}>나만의 글귀로 보내기</Text>
                    </Pressable>
                  )}
                  <Pressable style={[styles.btn, styles.btnSecondary]} onPress={handleShareWithoutMessage}>
                    <Text style={styles.btnTextSecondary}>메시지 없이 링크만 공유</Text>
                  </Pressable>
                </View>
              )}
            </View>
          ) : (
            /* 시나리오 B: 아직 초대 메시지가 작성되지 않은 경우 */
            <View style={styles.body}>
              {isCreator ? (
                /* 개설자인 경우: 즉석에서 바로 작성할 수 있는 폼 노출 */
                <View style={styles.quickInputArea}>
                  <Text style={styles.quickInputLabel}>즉시 초대 메시지 작성하기</Text>
                  <TextInput
                    style={styles.textInput}
                    multiline
                    numberOfLines={3}
                    placeholder="초대받은 동료들에게 보낼 글귀를 입력하세요."
                    placeholderTextColor={colors.primary300}
                    value={quickMessage}
                    onChangeText={setQuickMessage}
                    maxLength={200}
                  />
                  <Text style={styles.charCount}>{quickMessage.length}/200자</Text>
                  
                  <View style={styles.buttonCol}>
                    <Pressable
                      style={[styles.btn, styles.btnPrimary]}
                      onPress={handleQuickSaveAndShare}
                      disabled={saving}
                    >
                      {saving ? (
                        <ActivityIndicator color="white" size="small" />
                      ) : (
                        <Text style={styles.btnTextPrimary}>작성하고 초대 보내기</Text>
                      )}
                    </Pressable>
                    <Pressable
                      style={[styles.btn, styles.btnSecondary]}
                      onPress={handleShareWithoutMessage}
                      disabled={saving}
                    >
                      <Text style={styles.btnTextSecondary}>그냥 링크만 공유</Text>
                    </Pressable>
                  </View>
                </View>
              ) : (
                /* 일반 참여자인 경우: 임시 개별 초대 메시지 작성 폼 노출 */
                <View style={styles.quickInputArea}>
                  <Text style={styles.quickInputLabel}>나만의 초대 메시지 작성하기</Text>
                  <TextInput
                    style={styles.textInput}
                    multiline
                    numberOfLines={3}
                    placeholder="초대받은 동료들에게 보낼 글귀를 입력하세요."
                    placeholderTextColor={colors.primary300}
                    value={quickMessage}
                    onChangeText={setQuickMessage}
                    maxLength={200}
                  />
                  <Text style={styles.charCount}>{quickMessage.length}/200자</Text>
                  
                  <View style={styles.buttonCol}>
                    <Pressable
                      style={[styles.btn, styles.btnPrimary]}
                      onPress={handleParticipantShare}
                    >
                      <Text style={styles.btnTextPrimary}>작성하고 초대 보내기</Text>
                    </Pressable>
                    <Pressable
                      style={[styles.btn, styles.btnSecondary]}
                      onPress={handleShareWithoutMessage}
                    >
                      <Text style={styles.btnTextSecondary}>그냥 링크만 공유</Text>
                    </Pressable>
                  </View>
                </View>
              )}
            </View>
          )}

          <Pressable style={styles.closeBtn} onPress={onClose} hitSlop={12}>
            <Text style={styles.closeBtnText}>닫기</Text>
          </Pressable>
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
    maxWidth: 340,
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: 24,
    ...shadow.md,
    position: 'relative',
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
    marginBottom: 16,
  },
  question: {
    fontSize: fontSize.base,
    fontFamily: fontFamily.bold,
    fontWeight: fontWeight.bold,
    color: colors.primary,
    textAlign: 'center',
    marginBottom: 12,
  },
  previewBox: {
    backgroundColor: colors.primary50,
    borderRadius: radius.md,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.primary100,
  },
  previewLabel: {
    fontSize: 10,
    fontFamily: fontFamily.medium,
    color: colors.primary500,
    marginBottom: 6,
  },
  previewText: {
    fontSize: fontSize.sm,
    fontFamily: fontFamily.regular,
    color: colors.primary,
    lineHeight: 18,
  },
  warningBox: {
    alignItems: 'center',
    backgroundColor: colors.primary50,
    borderWidth: 1,
    borderColor: colors.primary100,
    borderRadius: radius.lg,
    padding: 16,
    marginBottom: 16,
  },
  warningEmoji: {
    fontSize: 28,
    marginBottom: 8,
  },
  warningTitle: {
    fontSize: fontSize.sm,
    fontFamily: fontFamily.bold,
    fontWeight: fontWeight.bold,
    color: colors.primary,
    marginBottom: 4,
    textAlign: 'center',
  },
  warningText: {
    fontSize: fontSize.xs,
    fontFamily: fontFamily.medium,
    color: colors.primary700,
    textAlign: 'center',
    lineHeight: 16,
  },
  quickInputArea: {
    marginTop: 8,
  },
  quickInputLabel: {
    fontSize: fontSize.xs,
    fontFamily: fontFamily.bold,
    fontWeight: fontWeight.bold,
    color: colors.primary700,
    marginBottom: 6,
  },
  textInput: {
    backgroundColor: colors.primary50,
    borderWidth: 1,
    borderColor: colors.primary100,
    borderRadius: radius.md,
    padding: 10,
    fontSize: fontSize.base,
    fontFamily: fontFamily.regular,
    color: colors.primary,
    minHeight: 110,
    textAlignVertical: 'top',
  },
  charCount: {
    fontSize: 10,
    fontFamily: fontFamily.regular,
    color: colors.primary500,
    alignSelf: 'flex-end',
    marginTop: 2,
    marginBottom: 12,
  },
  buttonCol: {
    gap: 8,
  },
  btn: {
    height: 48,
    borderRadius: radius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  btnPrimary: {
    backgroundColor: colors.accent,
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
  closeBtn: {
    alignSelf: 'center',
    paddingVertical: 4,
    marginTop: 8,
  },
  closeBtnText: {
    fontSize: fontSize.sm,
    color: colors.primary500,
    fontFamily: fontFamily.medium,
  },
});
