// 🚀 통합 헤더 — 4개 하단 탭 (홈/내챌린지/둘러보기/내정보) 공통
// 로고 + 닉네임 + 알람 + 아바타 (탭 → 내정보)
// 닉네임/아바타는 매 화면 진입 시 fetchMyProfile 로 동기화 (수정 시 즉시 반영).
import React, { useCallback, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Alert, Image, Modal, Switch } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, fontFamily, fontSize, fontWeight, radius, shadow } from '@/lib/tokens';
import { useSession } from '@/lib/session';
import { fetchMyProfile } from '@/lib/db';
import { haptic } from '@/lib/haptics';
import { BrandMark } from '@/components/BrandMark';

export function AppHeader() {
  const session = useSession();
  const myUserId = session?.user?.id;
  const [nickname, setNickname] = useState<string>('도전자');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  // 🚀 알림 가짜 설정 모달 상태
  const [modalVisible, setModalVisible] = useState(false);

  // 매 화면 진입 시 갱신 — 닉네임/아바타 수정 후 다른 탭 갔다 오면 동기화
  useFocusEffect(
    useCallback(() => {
      if (!myUserId || myUserId === 'dev') return;
      fetchMyProfile(myUserId)
        .then(p => { setNickname(p.nickname); setAvatarUrl(p.avatar_url); })
        .catch(() => {});
    }, [myUserId]),
  );

  return (
    <View style={styles.header}>
      {/* 좌: 로고 + Do:하다 (한 텍스트 라인) */}
      <View style={styles.brand}>
        <BrandMark size="md" color={colors.accent} />
        <Text style={styles.brandText}>
          Do<Text style={styles.brandColon}>:</Text>하다
        </Text>
      </View>

      {/* 우: 알림 + 아바타 */}
      <View style={styles.rightGroup}>
        <Pressable
          style={styles.headerIcon}
          onPress={() => { haptic.tap(); setModalVisible(true); }}
        >
          <Ionicons name="notifications-outline" size={20} color={colors.primary} />
        </Pressable>
        <Pressable
          onPress={() => { haptic.tap(); router.push('/(tabs)/profile' as any); }}
          hitSlop={6}
        >
          {avatarUrl ? (
            <Image source={{ uri: avatarUrl }} style={styles.headerAvatar} />
          ) : (
            <View style={[styles.headerAvatar, styles.headerAvatarFallback]}>
              <Text style={styles.headerAvatarInit}>{nickname.slice(0, 1)}</Text>
            </View>
          )}
        </Pressable>
      </View>

      {/* 🚀 알림 설정 모달 (Phase 2 티저 및 앱 심사 대응) */}
      <Modal
        visible={modalVisible}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
              <Text style={styles.modalTitle}>🔔 알림 설정</Text>
              <Text style={{ fontSize: 13, color: colors.primary500, fontFamily: fontFamily.bold, fontWeight: fontWeight.bold }}>Phase 2 예정 🔒</Text>
            </View>
            
            <View style={[styles.settingRow, { opacity: 0.5 }]}>
              <View style={{ flex: 1 }}>
                <Text style={styles.settingLabel}>인증 응원 묶음 알림</Text>
                <Text style={styles.settingDesc}>동료들의 응원을 1시간 단위로 묶어서 받습니다.</Text>
              </View>
              <Switch
                value={false}
                disabled={true}
                trackColor={{ false: colors.primary100, true: colors.accent }}
                thumbColor={colors.primary300}
              />
            </View>

            <View style={[styles.settingRow, { opacity: 0.5 }]}>
              <View style={{ flex: 1 }}>
                <Text style={styles.settingLabel}>방 내 새 대화 무음 알림</Text>
                <Text style={styles.settingDesc}>도전 인연들의 실시간 채팅/댓글을 무음으로 받습니다.</Text>
              </View>
              <Switch
                value={false}
                disabled={true}
                trackColor={{ false: colors.primary100, true: colors.accent }}
                thumbColor={colors.primary300}
              />
            </View>

            <View style={styles.modalInfoBox}>
              <Text style={styles.modalInfoText}>
                Do : 하다의 알림은 도파민 자극을 방지하기 위해 묶음 전송, 즉시 무음 전송, 밤 10시 이후 보류, 하루 상한 5건 규정을 엄격하게 준수합니다.
              </Text>
              <Text style={[styles.modalInfoText, { marginTop: 6, color: colors.accent700, fontFamily: fontFamily.bold, fontWeight: fontWeight.bold }]}>
                * 현재 베타 테스트 중으로, 실제 푸시 알림 전송은 Phase 2 정식 출시와 함께 연결됩니다.
              </Text>
            </View>

            <Pressable
              style={styles.modalCloseBtn}
              onPress={() => { haptic.tap(); setModalVisible(false); }}
            >
              <Text style={styles.modalCloseBtnText}>확인</Text>
            </Pressable>
          </View>
        </View>
      </Modal>


    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    position: 'relative',
    paddingHorizontal: 20,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.primary100,
    ...shadow.sm,
  },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  brandText: {
    fontSize: fontSize.xl,
    color: colors.primary,
    fontFamily: fontFamily.bold,
    fontWeight: fontWeight.bold,
    letterSpacing: -0.4,
  },
  brandColon: {
    color: colors.accent,
  },
  rightGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },

  headerIcon: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: colors.primary50,
    alignItems: 'center', justifyContent: 'center',
  },
  headerAvatar: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: colors.accent50,
    overflow: 'hidden',
  },
  headerAvatarFallback: { alignItems: 'center', justifyContent: 'center' },
  headerAvatarInit: {
    fontSize: 14,
    color: colors.accent700,
    fontFamily: fontFamily.bold,
    fontWeight: fontWeight.bold,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: 24,
    gap: 16,
    ...shadow.lg,
  },
  modalTitle: {
    fontSize: fontSize.lg,
    color: colors.primary,
    fontFamily: fontFamily.bold,
    fontWeight: fontWeight.bold,
    marginBottom: 8,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 4,
  },
  settingLabel: {
    fontSize: fontSize.base,
    color: colors.primary,
    fontFamily: fontFamily.bold,
    fontWeight: fontWeight.bold,
  },
  settingDesc: {
    fontSize: fontSize.xs,
    color: colors.primary500,
    fontFamily: fontFamily.regular,
    marginTop: 2,
    paddingRight: 8,
  },
  modalInfoBox: {
    backgroundColor: colors.primary50,
    borderRadius: radius.md,
    padding: 12,
    marginTop: 4,
  },
  modalInfoText: {
    fontSize: 11,
    color: colors.primary500,
    fontFamily: fontFamily.regular,
    lineHeight: 16,
  },
  modalCloseBtn: {
    backgroundColor: colors.accent,
    borderRadius: radius.lg,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  modalCloseBtnText: {
    fontSize: fontSize.base,
    color: colors.surface,
    fontFamily: fontFamily.bold,
    fontWeight: fontWeight.bold,
  },
});
