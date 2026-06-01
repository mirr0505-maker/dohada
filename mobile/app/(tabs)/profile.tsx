// 🚀 내 정보 — 프로필 카드 + 알림 설정 + 로그아웃
import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, Pressable, StyleSheet, Alert, Switch, ScrollView,
  Modal, TextInput, KeyboardAvoidingView, Platform, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { Screen } from '@/components/Screen';
import { AppHeader } from '@/components/AppHeader';
import { Button } from '@/components/Button';
import { colors, fontFamily, fontSize, fontWeight, radius, shadow } from '@/lib/tokens';
import { useSession } from '@/lib/session';
import { signOut } from '@/lib/auth';
import { haptic } from '@/lib/haptics';
import { fetchNotificationPrefs, updateNotificationPrefs, type NotificationPrefs } from '@/lib/push';
import { fetchMyProfile, updateMyNickname, updateMyAvatar } from '@/lib/db';
import { uploadProofImage } from '@/lib/upload';
import { scheduleDailyReminder, cancelDailyReminder } from '@/lib/notifications';
import Constants from 'expo-constants';

export default function ProfileScreen() {
  const session = useSession();
  const [prefs, setPrefs] = useState<NotificationPrefs | null>(null);
  const [nickname, setNickname] = useState<string>('도전자');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [editingNick, setEditingNick] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const myUserId = session?.user?.id;

  useEffect(() => {
    if (session === null) router.replace('/login');
  }, [session]);

  // 알림 prefs + 프로필(닉네임+아바타) 로드 (users 테이블 기준)
  useEffect(() => {
    if (!myUserId || myUserId === 'dev') return;
    fetchNotificationPrefs(myUserId).then(setPrefs).catch(() => {});
    fetchMyProfile(myUserId).then(p => {
      setNickname(p.nickname);
      setAvatarUrl(p.avatar_url);
    }).catch(() => {});
  }, [myUserId]);

  // 보관함에서 아바타 사진 선택 → R2 업로드 → DB → state
  const onChangeAvatar = useCallback(async () => {
    if (!myUserId || uploadingAvatar) return;
    haptic.tap();
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (perm.status === 'denied') {
        Alert.alert('보관함 접근 권한이 필요해요', '설정 → Do:하다 → 사진 에서 켜주세요.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,         // iOS 정사각 crop
        aspect: [1, 1],
        quality: 0.85,
        exif: false,
      });
      if (result.canceled) return;
      const uri = result.assets?.[0]?.uri;
      if (!uri) return;
      setUploadingAvatar(true);
      const url = await uploadProofImage(uri, 'jpg');
      await updateMyAvatar(myUserId, url);
      setAvatarUrl(url);
      haptic.success();
    } catch (e: any) {
      Alert.alert('아바타 변경 실패', e?.message ?? String(e));
    } finally {
      setUploadingAvatar(false);
    }
  }, [myUserId, uploadingAvatar]);

  const togglePref = useCallback(async (key: keyof NotificationPrefs, value: boolean) => {
    if (!myUserId || !prefs) return;
    haptic.tap();
    const next = { ...prefs, [key]: value };
    setPrefs(next);
    try {
      await updateNotificationPrefs(myUserId, { [key]: value });
      // daily 토글은 로컬 알림 schedule/cancel 도 동기화
      if (key === 'daily_enabled') {
        if (value) await scheduleDailyReminder(20, 0);
        else await cancelDailyReminder();
      }
    } catch (e: any) {
      setPrefs(prefs);   // 롤백
      Alert.alert('설정 실패', e?.message ?? String(e));
    }
  }, [myUserId, prefs]);

  const email = session?.user?.email ?? '';
  const initial = (nickname || '도전자').slice(0, 1);
  const appVersion = Constants.expoConfig?.version ?? '0.1.0';
  // Apple Hide My Email 은 표시 안 함 (의미 없는 privaterelay 주소)
  const visibleEmail = email.endsWith('@privaterelay.appleid.com') ? '' : email;

  const onLogout = () => {
    Alert.alert('로그아웃', '다음에 또 만나요. 로그아웃할까요?', [
      { text: '취소', style: 'cancel' },
      {
        text: '로그아웃',
        style: 'destructive',
        onPress: async () => {
          haptic.warning();
          await signOut();
          router.replace('/login');
        },
      },
    ]);
  };

  return (
    <Screen backgroundColor={colors.background}>
      <AppHeader />
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        <View style={styles.subHeader}>
          <Text style={styles.subTitle}>내 정보</Text>
        </View>

        {/* 프로필 카드 — 아바타와 닉네임 각각 Pressable (변경 흐름 분리) */}
        <View style={styles.profileCard}>
          <Pressable onPress={onChangeAvatar} disabled={uploadingAvatar} hitSlop={6}>
            {avatarUrl ? (
              <Image source={{ uri: avatarUrl }} style={styles.avatar} />
            ) : (
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{initial}</Text>
              </View>
            )}
            <Text style={styles.avatarHint}>
              {uploadingAvatar ? '업로드 중…' : '사진 변경'}
            </Text>
          </Pressable>
          <Pressable
            onPress={() => { haptic.tap(); setEditingNick(true); }}
            hitSlop={6}
          >
            <View style={styles.nicknameRow}>
              <Text style={styles.nickname}>{nickname}</Text>
              <Text style={styles.editHint}>✏️</Text>
            </View>
          </Pressable>
          {visibleEmail ? <Text style={styles.email}>{visibleEmail}</Text> : null}
        </View>

        {/* 알림 설정 */}
        {prefs && (
          <View style={styles.notifSection}>
            <Text style={styles.sectionTitle}>알림</Text>
            <View style={styles.notifCard}>
              <ToggleRow
                label="채팅"
                desc="챌린지방 새 메시지 (즉시)"
                value={prefs.chat_enabled}
                onChange={(v) => togglePref('chat_enabled', v)}
              />
              <Divider />
              <ToggleRow
                label="댓글"
                desc="내 인증·기록의 댓글 (즉시)"
                value={prefs.comment_enabled}
                onChange={(v) => togglePref('comment_enabled', v)}
              />
              <Divider />
              <ToggleRow
                label="응원·좋아요"
                desc="1시간마다 묶어서 1건"
                value={prefs.cheer_batch_enabled}
                onChange={(v) => togglePref('cheer_batch_enabled', v)}
              />
              <Divider />
              <ToggleRow
                label="매일 안부"
                desc="저녁 8시 1회 로컬 알림"
                value={prefs.daily_enabled}
                onChange={(v) => togglePref('daily_enabled', v)}
              />
            </View>
            <Text style={styles.notifNote}>
              💛 밤 10시~아침 8시는 자동으로 조용해요.{'\n'}하루 최대 5건까지만 보내요.
            </Text>
          </View>
        )}

        {/* 액션 */}
        <View style={styles.actions}>
          <Button label="로그아웃" variant="ghost" block onPress={onLogout} />
        </View>

        {/* 버전 */}
        <View style={styles.footer}>
          <Text style={styles.version}>Do : 하다 v{appVersion}</Text>
          <Text style={styles.tagline}>같이 도전하는 사람의 응원이 진짜 힘이에요</Text>
        </View>
      </ScrollView>

      <NicknameEditModal
        visible={editingNick}
        current={nickname}
        userId={myUserId}
        onClose={() => setEditingNick(false)}
        onSaved={(next) => { setNickname(next); setEditingNick(false); }}
      />
    </Screen>
  );
}

// ─── 닉네임 편집 모달 ──────────────────────────
function NicknameEditModal({
  visible, current, userId, onClose, onSaved,
}: {
  visible: boolean;
  current: string;
  userId: string | undefined;
  onClose: () => void;
  onSaved: (nickname: string) => void;
}) {
  const [value, setValue] = useState(current);
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (visible) setValue(current); }, [visible, current]);

  const onSave = async () => {
    if (!userId || saving) return;
    const trimmed = value.trim();
    if (!trimmed) return;
    setSaving(true);
    try {
      await updateMyNickname(userId, trimmed);
      haptic.success();
      onSaved(trimmed);
    } catch (e: any) {
      Alert.alert('저장 실패', e?.message ?? String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.modalSafe} edges={['top', 'bottom']}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.modalHeader}>
            <Pressable onPress={onClose} hitSlop={12} disabled={saving}>
              <Text style={styles.modalCancel}>취소</Text>
            </Pressable>
            <Text style={styles.modalTitle}>닉네임</Text>
            <Pressable
              onPress={onSave}
              hitSlop={12}
              disabled={!value.trim() || saving || value.trim() === current}
            >
              <Text style={[
                styles.modalSave,
                (!value.trim() || saving || value.trim() === current) && { opacity: 0.4 },
              ]}>
                {saving ? '저장 중…' : '저장'}
              </Text>
            </Pressable>
          </View>
          <View style={styles.modalBody}>
            <TextInput
              value={value}
              onChangeText={setValue}
              placeholder="동료들에게 보일 이름"
              placeholderTextColor={colors.primary300}
              style={styles.nickInput}
              maxLength={20}
              autoFocus
              editable={!saving}
            />
            <Text style={styles.modalHint}>
              챌린지방·대화·기록에 표시돼요. 최대 20자.
            </Text>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

function ToggleRow({
  label, desc, value, onChange,
}: { label: string; desc: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <View style={styles.toggleRow}>
      <View style={{ flex: 1 }}>
        <Text style={styles.toggleLabel}>{label}</Text>
        <Text style={styles.toggleDesc}>{desc}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: colors.primary100, true: colors.accent }}
        thumbColor={colors.surface}
      />
    </View>
  );
}

function Divider() {
  return <View style={styles.divider} />;
}

const styles = StyleSheet.create({
  subHeader: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  subTitle: {
    fontSize: fontSize.lg,
    color: colors.primary,
    fontFamily: fontFamily.bold,
    fontWeight: fontWeight.bold,
    letterSpacing: -0.2,
  },
  profileCard: {
    marginHorizontal: 24,
    marginTop: 8,
    padding: 24,
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    alignItems: 'center',
    gap: 12,
    ...shadow.sm,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.accent50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 32,
    color: colors.accent700,
    fontFamily: fontFamily.bold,
    fontWeight: fontWeight.bold,
  },
  avatarHint: {
    marginTop: 6,
    fontSize: fontSize.xs,
    color: colors.primary500,
    fontFamily: fontFamily.medium,
    textAlign: 'center',
  },
  nicknameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  nickname: {
    fontSize: fontSize.xl,
    color: colors.primary,
    fontFamily: fontFamily.bold,
    fontWeight: fontWeight.bold,
  },
  editHint: {
    fontSize: 14,
    opacity: 0.5,
  },
  email: {
    fontSize: fontSize.sm,
    color: colors.primary500,
    fontFamily: fontFamily.regular,
  },
  // 알림 설정 섹션
  notifSection: {
    marginHorizontal: 24,
    marginTop: 24,
    gap: 8,
  },
  sectionTitle: {
    fontSize: fontSize.sm,
    color: colors.primary500,
    fontFamily: fontFamily.medium,
    fontWeight: fontWeight.semibold,
    marginBottom: 4,
  },
  notifCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    paddingHorizontal: 16,
    ...shadow.sm,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    gap: 12,
  },
  toggleLabel: {
    fontSize: fontSize.base,
    color: colors.primary,
    fontFamily: fontFamily.medium,
    fontWeight: fontWeight.semibold,
  },
  toggleDesc: {
    fontSize: fontSize.xs,
    color: colors.primary500,
    fontFamily: fontFamily.regular,
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: colors.primary100,
  },
  notifNote: {
    fontSize: fontSize.xs,
    color: colors.primary500,
    fontFamily: fontFamily.regular,
    lineHeight: 18,
    paddingHorizontal: 4,
    marginTop: 4,
  },

  actions: {
    marginHorizontal: 24,
    marginTop: 24,
  },
  footer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 32,
    gap: 6,
  },
  version: {
    fontSize: fontSize.sm,
    color: colors.primary500,
    fontFamily: fontFamily.medium,
    fontWeight: fontWeight.medium,
  },
  tagline: {
    fontSize: fontSize.xs,
    color: colors.primary300,
    fontFamily: fontFamily.regular,
  },

  // 닉네임 편집 모달
  modalSafe: { flex: 1, backgroundColor: colors.surface },
  modalHeader: {
    height: 52,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: colors.primary100,
  },
  modalCancel: {
    fontSize: fontSize.base,
    color: colors.primary500,
    fontFamily: fontFamily.medium,
  },
  modalTitle: {
    fontSize: fontSize.lg,
    color: colors.primary,
    fontFamily: fontFamily.bold,
    fontWeight: fontWeight.bold,
  },
  modalSave: {
    fontSize: fontSize.base,
    color: colors.accent,
    fontFamily: fontFamily.bold,
    fontWeight: fontWeight.bold,
  },
  modalBody: { padding: 20, gap: 12 },
  nickInput: {
    fontSize: fontSize.xl,
    color: colors.primary,
    fontFamily: fontFamily.bold,
    fontWeight: fontWeight.bold,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.primary100,
  },
  modalHint: {
    fontSize: fontSize.sm,
    color: colors.primary500,
    fontFamily: fontFamily.regular,
  },
});
