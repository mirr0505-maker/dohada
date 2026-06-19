// 🚀 내 정보 — 프로필 카드 + 알림 설정 + 로그아웃
import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, Pressable, StyleSheet, Alert, Switch, ScrollView,
  Modal, TextInput, KeyboardAvoidingView, Platform, Image, Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { Screen } from '@/components/Screen';
import { AppHeader } from '@/components/AppHeader';
import { Button } from '@/components/Button';
import { SUPPORT_EMAIL } from '@/lib/support';
import { colors, fontFamily, fontSize, fontWeight, radius, shadow } from '@/lib/tokens';
import { useSession } from '@/lib/session';
import { signOut, deleteAccount } from '@/lib/auth';
import { haptic } from '@/lib/haptics';
import { fetchNotificationPrefs, updateNotificationPrefs, type NotificationPrefs } from '@/lib/push';
import {
  fetchMyProfile, updateMyNickname, updateMyAvatar,
  fetchMyInterests, addInterest, removeInterest, fetchCategoryTree,
  fetchMyChallenges,
  type MyInterest, type DbCategory,
} from '@/lib/db';
import type { ChallengeWithCount } from '@/lib/types';
import { getKstTodayRange } from '@/lib/format';
import { uploadProofImage } from '@/lib/upload';
import { scheduleDailyReminder, cancelDailyReminder } from '@/lib/notifications';
import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';
import * as Updates from 'expo-updates';
import { isGiftPilotEmail, isBetVisible } from '@/lib/payments';

export default function ProfileScreen() {
  const session = useSession();
  const [prefs, setPrefs] = useState<NotificationPrefs | null>(null);
  const [nickname, setNickname] = useState<string>('도전자');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [editingNick, setEditingNick] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [interests, setInterests] = useState<MyInterest[]>([]);
  const [categories, setCategories] = useState<DbCategory[]>([]);
  const [editingInterests, setEditingInterests] = useState(false);
  // 🚀 P-⑤ 내 완주 영구 보관함
  const [finishedChs, setFinishedChs] = useState<ChallengeWithCount[]>([]);
  const myUserId = session?.user?.id;

  // 🚀 로컬 알림 시간 상태 및 초기화
  const [reminderHour, setReminderHour] = useState(20);
  const [reminderMinute, setReminderMinute] = useState(0);
  const [timePickerOpen, setTimePickerOpen] = useState(false);

  // 🚀 회원 탈퇴(계정 삭제) — 2단계 확인 모달
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);

  useEffect(() => {
    const restoreTime = async () => {
      try {
        const stored = await SecureStore.getItemAsync('daily_reminder_time');
        if (stored) {
          const [h, m] = stored.split(':').map(Number);
          if (!isNaN(h) && !isNaN(m)) {
            setReminderHour(h);
            setReminderMinute(m);
          }
        }
      } catch (e) {
        console.warn('[ProfileScreen] 알림 시간 복원 실패', e);
      }
    };
    restoreTime();
  }, []);

  useEffect(() => {
    if (session === null) router.replace('/login');
  }, [session]);

  // 알림 prefs + 프로필 + 관심 분야 + 카테고리 트리 + 내 완주 보관함 로드
  useEffect(() => {
    if (!myUserId || myUserId === 'dev') return;
    fetchNotificationPrefs(myUserId).then(setPrefs).catch(() => {});
    fetchMyProfile(myUserId).then(p => {
      setNickname(p.nickname);
      setAvatarUrl(p.avatar_url);
    }).catch(() => {});
    fetchMyInterests(myUserId).then(setInterests).catch(() => {});
    fetchCategoryTree().then(t => setCategories(t.categories)).catch(() => {});
    // 🚀 P-⑤: 내 완주 영구 보관함 — 종료된 챌린지만 추출 (KST 자정 기준)
    fetchMyChallenges(myUserId).then(all => {
      const today = getKstTodayRange().kstDateStr;
      setFinishedChs(all.filter(c => today > c.end_date));
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
        await SecureStore.setItemAsync('daily_enabled', value ? 'true' : 'false');
        if (value) {
          const stored = await SecureStore.getItemAsync('daily_reminder_time');
          let h = 20;
          let m = 0;
          if (stored) {
            const [sh, sm] = stored.split(':').map(Number);
            if (!isNaN(sh) && !isNaN(sm)) {
              h = sh;
              m = sm;
            }
          }
          await scheduleDailyReminder(h, m);
        } else {
          await cancelDailyReminder();
        }
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

  // 🚀 3b 운영팀 문의 (UGC 연락수단) — 화면엔 "운영팀", mailto 는 상수(법인 후 교체)
  const onContact = () => {
    haptic.tap();
    Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent('[Do:하다] 문의·신고')}`)
      .catch(() => Alert.alert('문의', `메일 앱을 열 수 없어요. ${SUPPORT_EMAIL} 로 보내주세요.`));
  };
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

        {/* 관심 분야 — 명시 등록 (자동 추론은 백그라운드 합집합) */}
        <View style={styles.notifSection}>
          <Text style={styles.sectionTitle}>관심 분야</Text>
          <Pressable
            style={styles.notifCard}
            onPress={() => { haptic.tap(); setEditingInterests(true); }}
          >
            <View style={styles.interestRow}>
              {interests.length === 0 ? (
                <Text style={styles.interestHint}>
                  관심 분야를 등록하면 매칭되는 오픈 하다가 홈에 올라와요
                </Text>
              ) : (
                <View style={styles.chipsWrap}>
                  {interests.map(i => (
                    <View key={i.id} style={styles.chip}>
                      <Text style={styles.chipText}>{i.category_emoji} {i.category_name}</Text>
                    </View>
                  ))}
                </View>
              )}
              <Text style={styles.editHint}>✏️</Text>
            </View>
          </Pressable>
          <Text style={styles.notifNote}>
            🎯 등록한 관심 분야의 오픈 하다가 만들어지면 홈의 "✨ 관심 하다" 에 자동으로 올라와요.
          </Text>
        </View>

        {/* 알림 설정 */}
        {prefs && (
          <View style={styles.notifSection}>
            <Text style={styles.sectionTitle}>알림</Text>
            <View style={styles.notifCard}>
              <ToggleRow
                label="채팅"
                desc="하다 방 새 메시지 (즉시)"
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
                label="동료 인증·기록"
                desc="동료가 인증/기록을 올렸을 때 (즉시)"
                value={prefs.proof_log_enabled}
                onChange={(v) => togglePref('proof_log_enabled', v)}
              />
              <Divider />
              <ToggleRow
                label="매일 안부"
                desc="지정한 시간에 하루 1회 로컬 알림"
                value={prefs.daily_enabled}
                onChange={(v) => togglePref('daily_enabled', v)}
              >
                {prefs.daily_enabled && (
                  <Pressable
                    style={styles.timeBtn}
                    onPress={() => { haptic.tap(); setTimePickerOpen(true); }}
                  >
                    <Text style={styles.timeBtnText}>
                      {formatReminderTime(reminderHour, reminderMinute)}
                    </Text>
                  </Pressable>
                )}
              </ToggleRow>
            </View>
            <Text style={styles.notifNote}>
              💛 밤 10시~아침 8시는 자동으로 조용해요.{'\n'}하루 최대 5건까지만 보내요.
            </Text>
          </View>
        )}

        {/* 🚀 P-⑤: 내 완주 영구 보관함 — 종료된 챌린지만 시간 역순 */}
        {finishedChs.length > 0 && (
          <View style={{ marginTop: 24, paddingHorizontal: 20 }}>
            <Text style={{
              fontSize: 16, fontWeight: '700', color: colors.primary,
              marginBottom: 12, fontFamily: 'Pretendard-Bold',
            }}>
              🏆 내 완주 보관함 · {finishedChs.length}개
            </Text>
            <Text style={{
              fontSize: 12, color: colors.primary500, fontFamily: 'Pretendard-Regular',
              marginBottom: 12,
            }}>
              종료된 모든 하다는 영구히 박제됩니다 · 탭하여 박제 보기
            </Text>
            <View style={{ gap: 8 }}>
              {finishedChs.map(c => (
                <Pressable
                  key={c.id}
                  onPress={() => { haptic.tap(); router.push(`/room/${c.id}?tab=archive` as any); }}
                  style={{
                    backgroundColor: colors.surface,
                    borderRadius: 12,
                    padding: 14,
                    borderWidth: 1,
                    borderColor: colors.primary100,
                  }}
                >
                  <Text style={{
                    fontSize: 14, fontWeight: '600', color: colors.primary,
                    fontFamily: 'Pretendard-Bold',
                  }} numberOfLines={1}>
                    🏁 {c.title}
                  </Text>
                  <Text style={{
                    fontSize: 11, color: colors.primary500, marginTop: 4,
                    fontFamily: 'Pretendard-Regular',
                  }}>
                    {c.start_date} ~ {c.end_date} · 박제 보기 →
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}

        {/* 🚀 업데이트 예정 로드맵 (Phase 2 티저) */}
        <View style={styles.roadmapSection}>
          <Text style={styles.sectionTitle}>로드맵 예고 🔒</Text>
          <View style={styles.roadmapCard}>
            {/* 🎯 내기 한잔 — 법률 자문(⑤b) 전까지 베타 비노출 (출시 후 BET_ENABLED 시 다시 노출) */}
            {isBetVisible() && (
              <>
                <View style={styles.roadmapRow}>
                  <Text style={styles.roadmapEmoji}>💸</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.roadmapLabel}>내기 한잔 — 개발 완료 ✅</Text>
                    <Text style={styles.roadmapDesc}>
                      완주하면 본전, 실패하면 기부 — 나·동료와 거는 "내기 한잔"(가상 교환권). 받기·기부·환불 정산까지 개발을 마쳤어요. 법률 자문을 거쳐 오픈되며, 실제 결제·계좌 연결은 정식 출시 후예요.
                    </Text>
                  </View>
                </View>
                <View style={styles.roadmapDivider} />
              </>
            )}
            <View style={styles.roadmapRow}>
              <Text style={styles.roadmapEmoji}>🤝</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.roadmapLabel}>하다 인연 ×횟수 누적 시스템</Text>
                <Text style={styles.roadmapDesc}>
                  함께 한 동료들과의 누적 횟수(×횟수)가 기록되며, QR 명함 및 연락처 매칭 기능이 추가됩니다.
                </Text>
              </View>
            </View>
            <View style={styles.roadmapDivider} />
            <View style={styles.roadmapRow}>
              <Text style={styles.roadmapEmoji}>📚</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.roadmapLabel}>완주 박제 자산화 (실물 인쇄)</Text>
                <Text style={styles.roadmapDesc}>
                  100일 완주 성공 시 나의 하다 이야기를 책(인쇄/제본)으로 영구 소장할 수 있는 실물 인프라 결제 시스템이 연동됩니다.
                </Text>
              </View>
            </View>
            <View style={styles.roadmapDivider} />
            <View style={styles.roadmapRow}>
              <Text style={styles.roadmapEmoji}>☕</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.roadmapLabel}>응원 한잔 — 베타 체험 중</Text>
                <Text style={styles.roadmapDesc}>
                  동료의 인증에 "한잔"을 보내 응원해요. 베타에선 가상 교환권(모의 결제 · 실제 결제·계좌 연결 없음)으로 미리 체험하고, 정식 출시 때 실물 기프티콘으로 열려요.
                </Text>
              </View>
            </View>
            <View style={styles.roadmapDivider} />
            <View style={styles.roadmapRow}>
              <Text style={styles.roadmapEmoji}>💚</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.roadmapLabel}>함께 만든 변화 — 기부 허브</Text>
                <Text style={styles.roadmapDesc}>
                  받은 응원을 "기부로 돌리기" — 내 한 잔이 누군가의 한 잔이 돼요. "더 나은 나, 더 나은 세상"이 실제 기부로 이어집니다.
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* 액션 */}
        <View style={styles.actions}>
          {/* 💛 다짐 내역 — 무현금 기능이라 전체 공개 (게이트 없음) */}
          <Button
            label="💛 다짐 내역"
            variant="ghost"
            block
            onPress={() => { haptic.tap(); router.push('/pledges' as any); }}
          />
          {/* ☕ 한잔 내역 — 파일럿 전용 (Stage 4 베타 오픈 시 전체 공개) */}
          {isGiftPilotEmail(session?.user?.email) && (
            <Button
              label="☕ 한잔 내역"
              variant="ghost"
              block
              onPress={() => { haptic.tap(); router.push('/gifts' as any); }}
            />
          )}
          <Button label="문의·신고 (운영팀)" variant="ghost" block onPress={onContact} />
          <Button label="로그아웃" variant="ghost" block onPress={onLogout} />
          {/* 계정 삭제 — 구글·애플 의무 진입점. 눈에 띄지 않게(빨강 작은 링크) → 2단계 확인 모달 */}
          <Pressable
            style={styles.deleteLink}
            onPress={() => { haptic.tap(); setDeleteModalOpen(true); }}
            hitSlop={8}
          >
            <Text style={styles.deleteLinkText}>계정 삭제</Text>
          </Pressable>
        </View>

        {/* 버전 — 베타 테스터 소통용: OTA 업데이트가 실제 적용됐는지 이 줄로 확인 */}
        <View style={styles.footer}>
          <Text style={styles.version}>Do : 하다 v{appVersion}</Text>
          <Text style={styles.version}>
            {Updates.updateId
              ? `업데이트 ${Updates.updateId.slice(0, 8)} · ${formatUpdateTime(Updates.createdAt)} 적용`
              : '업데이트: 빌드 내장 버전'}
          </Text>
          <Text style={styles.tagline}>같이 하는 사람의 응원이 진짜 힘이에요</Text>
        </View>
      </ScrollView>

      <NicknameEditModal
        visible={editingNick}
        current={nickname}
        userId={myUserId}
        onClose={() => setEditingNick(false)}
        onSaved={(next) => { setNickname(next); setEditingNick(false); }}
      />

      <InterestEditModal
        visible={editingInterests}
        userId={myUserId}
        categories={categories}
        interests={interests}
        onClose={() => setEditingInterests(false)}
        onChanged={(next) => setInterests(next)}
      />

      <TimePickerModal
        visible={timePickerOpen}
        currentHour={reminderHour}
        currentMinute={reminderMinute}
        onClose={() => setTimePickerOpen(false)}
        onSaved={async (h, m) => {
          try {
            await SecureStore.setItemAsync('daily_reminder_time', `${h}:${m}`);
            setReminderHour(h);
            setReminderMinute(m);
            await scheduleDailyReminder(h, m);
            haptic.success();
          } catch (e: any) {
            Alert.alert('알림 설정 실패', e?.message ?? String(e));
          } finally {
            setTimePickerOpen(false);
          }
        }}
      />

      <DeleteAccountModal
        visible={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        onDeleted={() => {
          setDeleteModalOpen(false);
          router.replace('/login');
        }}
      />
    </Screen>
  );
}

// ─── 관심 분야 편집 모달 ──────────────────────
function InterestEditModal({
  visible, userId, categories, interests, onClose, onChanged,
}: {
  visible: boolean;
  userId: string | undefined;
  categories: DbCategory[];
  interests: MyInterest[];
  onClose: () => void;
  onChanged: (next: MyInterest[]) => void;
}) {
  const [saving, setSaving] = useState<number | null>(null);   // 진행 중 categoryId

  const isSelected = (catId: number) => interests.some(i => i.category_id === catId);

  const onToggle = async (cat: DbCategory) => {
    if (!userId || saving) return;
    haptic.tap();
    setSaving(cat.id);
    try {
      if (isSelected(cat.id)) {
        const existing = interests.find(i => i.category_id === cat.id);
        if (existing) {
          await removeInterest(existing.id);
          onChanged(interests.filter(i => i.id !== existing.id));
        }
      } else {
        await addInterest(userId, cat.id);
        const fresh = await fetchMyInterests(userId);
        onChanged(fresh);
      }
    } catch (e: any) {
      Alert.alert('저장 실패', e?.message ?? String(e));
    } finally {
      setSaving(null);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.modalSafe} edges={['top', 'bottom']}>
        <View style={styles.modalHeader}>
          <View style={{ width: 40 }} />
          <Text style={styles.modalTitle}>관심 분야</Text>
          <Pressable onPress={onClose} hitSlop={12}>
            <Text style={styles.modalCancel}>완료</Text>
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
          <Text style={styles.modalHint}>
            관심 분야의 오픈 하다가 만들어지면 홈에서 발견할 수 있어요.{'\n'}
            여러 개 선택 가능.
          </Text>
          <View style={styles.catGrid}>
            {categories.map(cat => {
              const selected = isSelected(cat.id);
              const busy = saving === cat.id;
              return (
                <Pressable
                  key={cat.id}
                  style={[styles.catCard, selected && styles.catCardSelected]}
                  onPress={() => onToggle(cat)}
                  disabled={busy}
                >
                  {selected && (
                    <View style={styles.catCheckBadge}>
                      <Text style={styles.catCheckBadgeText}>✓</Text>
                    </View>
                  )}
                  <Text style={styles.catEmojiBig}>{cat.emoji}</Text>
                  <Text style={[styles.catNameBig, selected && styles.catNameSelected]}>
                    {cat.name}
                  </Text>
                  {cat.copy ? (
                    <Text style={styles.catCopySmall} numberOfLines={2}>{cat.copy}</Text>
                  ) : null}
                </Pressable>
              );
            })}
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
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
              하다 방·대화·기록에 표시돼요. 최대 20자.
            </Text>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

// OTA 적용 시각 — 테스터가 "어느 업데이트인지" 말로 전달할 수 있는 형태 (M/D HH:mm)
function formatUpdateTime(d: Date | null): string {
  if (!d) return '';
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function formatReminderTime(h: number, m: number): string {
  const ampm = h >= 12 ? '오후' : '오전';
  const displayHour = h % 12 === 0 ? 12 : h % 12;
  const displayMin = String(m).padStart(2, '0');
  return `${ampm} ${String(displayHour).padStart(2, '0')}:${displayMin}`;
}

// ─── 시간 선택 모달 ──────────────────────
function TimePickerModal({
  visible, currentHour, currentMinute, onClose, onSaved,
}: {
  visible: boolean;
  currentHour: number;
  currentMinute: number;
  onClose: () => void;
  onSaved: (hour: number, minute: number) => void;
}) {
  const [ampm, setAmpm] = useState<'AM' | 'PM'>(currentHour >= 12 ? 'PM' : 'AM');
  const [hour, setHour] = useState(currentHour % 12 === 0 ? 12 : currentHour % 12);
  const [minute, setMinute] = useState(currentMinute);

  useEffect(() => {
    if (visible) {
      setAmpm(currentHour >= 12 ? 'PM' : 'AM');
      setHour(currentHour % 12 === 0 ? 12 : currentHour % 12);
      setMinute(currentMinute);
    }
  }, [visible, currentHour, currentMinute]);

  const handleSave = () => {
    let finalHour = hour % 12;
    if (ampm === 'PM') finalHour += 12;
    onSaved(finalHour, minute);
  };

  const adjustHour = (delta: number) => {
    haptic.tap();
    setHour(prev => {
      let next = prev + delta;
      if (next > 12) return 1;
      if (next < 1) return 12;
      return next;
    });
  };

  const adjustMinute = (delta: number) => {
    haptic.tap();
    setMinute(prev => {
      let next = prev + delta;
      if (next >= 60) return 0;
      if (next < 0) return 50;
      return next;
    });
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <View style={styles.pickerCard} onStartShouldSetResponder={() => true}>
          <Text style={styles.pickerTitle}>🔔 알림 시간 설정</Text>
          
          <View style={styles.pickerRow}>
            {/* AM/PM */}
            <View style={styles.column}>
              <Pressable 
                style={[styles.pickerBtn, ampm === 'AM' && styles.pickerBtnActive]}
                onPress={() => { haptic.tap(); setAmpm('AM'); }}
              >
                <Text style={[styles.pickerBtnText, ampm === 'AM' && styles.pickerBtnTextActive]}>오전</Text>
              </Pressable>
              <Pressable 
                style={[styles.pickerBtn, ampm === 'PM' && styles.pickerBtnActive]}
                onPress={() => { haptic.tap(); setAmpm('PM'); }}
              >
                <Text style={[styles.pickerBtnText, ampm === 'PM' && styles.pickerBtnTextActive]}>오후</Text>
              </Pressable>
            </View>

            {/* Hour */}
            <View style={styles.spinnerColumn}>
              <Pressable style={styles.arrowBtn} onPress={() => adjustHour(1)}>
                <Text style={styles.arrowText}>▲</Text>
              </Pressable>
              <View style={styles.valueWrap}>
                <Text style={styles.valueText}>{String(hour).padStart(2, '0')}</Text>
                <Text style={styles.valueUnit}>시</Text>
              </View>
              <Pressable style={styles.arrowBtn} onPress={() => adjustHour(-1)}>
                <Text style={styles.arrowText}>▼</Text>
              </Pressable>
            </View>

            {/* Minute */}
            <View style={styles.spinnerColumn}>
              <Pressable style={styles.arrowBtn} onPress={() => adjustMinute(10)}>
                <Text style={styles.arrowText}>▲</Text>
              </Pressable>
              <View style={styles.valueWrap}>
                <Text style={styles.valueText}>{String(minute).padStart(2, '0')}</Text>
                <Text style={styles.valueUnit}>분</Text>
              </View>
              <Pressable style={styles.arrowBtn} onPress={() => adjustMinute(-10)}>
                <Text style={styles.arrowText}>▼</Text>
              </Pressable>
            </View>
          </View>

          <View style={styles.pickerActions}>
            <Pressable style={styles.pickerCancelBtn} onPress={onClose}>
              <Text style={styles.pickerCancelText}>취소</Text>
            </Pressable>
            <Pressable style={styles.pickerSaveBtn} onPress={handleSave}>
              <Text style={styles.pickerSaveText}>설정 완료</Text>
            </Pressable>
          </View>
        </View>
      </Pressable>
    </Modal>
  );
}

function ToggleRow({
  label, desc, value, onChange, children,
}: { 
  label: string; 
  desc: string; 
  value: boolean; 
  onChange: (v: boolean) => void;
  children?: React.ReactNode;
}) {
  return (
    <View style={styles.toggleRow}>
      <View style={{ flex: 1 }}>
        <Text style={styles.toggleLabel}>{label}</Text>
        <Text style={styles.toggleDesc}>{desc}</Text>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        {children}
        <Switch
          value={value}
          onValueChange={onChange}
          trackColor={{ false: colors.primary100, true: colors.accent }}
          thumbColor={colors.surface}
        />
      </View>
    </View>
  );
}

// ─── 회원 탈퇴(계정 삭제) 모달 — 2단계 확인 ──────────────
// 1단계: 영향 안내 + 확인 체크박스 → 2단계: 최종 재확인 Alert → delete-account EF
function DeleteAccountModal({
  visible, onClose, onDeleted,
}: {
  visible: boolean;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const [checked, setChecked] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // 모달 열 때마다 체크 초기화 (실수 방지)
  useEffect(() => { if (visible) { setChecked(false); setDeleting(false); } }, [visible]);

  const runDelete = async () => {
    setDeleting(true);
    try {
      await deleteAccount();
      haptic.success();
      onDeleted();
    } catch (e: any) {
      setDeleting(false);
      Alert.alert('탈퇴 실패', '잠시 후 다시 시도해주세요.\n계속되면 운영팀에 문의해주세요.');
    }
  };

  // 2단계 — 최종 재확인
  const onConfirm = () => {
    if (!checked || deleting) return;
    haptic.warning();
    Alert.alert(
      '마지막 확인',
      '계정을 삭제하면 되돌릴 수 없어요.\n정말 삭제할까요?',
      [
        { text: '취소', style: 'cancel' },
        { text: '계정 삭제', style: 'destructive', onPress: runDelete },
      ],
    );
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.modalSafe} edges={['top', 'bottom']}>
        <View style={styles.modalHeader}>
          <View style={{ width: 40 }} />
          <Text style={styles.modalTitle}>계정 삭제</Text>
          <Pressable onPress={onClose} hitSlop={12} disabled={deleting}>
            <Text style={styles.modalCancel}>취소</Text>
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 32 }}>
          <Text style={styles.delLead}>계정을 삭제하면 아래 내용이 적용돼요.</Text>

          <View style={styles.delSection}>
            <Text style={styles.delSectionTitle}>삭제되는 정보</Text>
            <Text style={styles.delBullet}>• 프로필(닉네임·사진·이메일)</Text>
            <Text style={styles.delBullet}>• 본인인증 정보·알림 설정·관심 분야·알림함</Text>
          </View>

          <View style={styles.delSection}>
            <Text style={styles.delSectionTitle}>남는 것 (동료의 박제 보호)</Text>
            <Text style={styles.delBullet}>
              • 내가 올린 인증·기록·댓글·대화·완주 이야기는 동료의 기록을 지키기 위해 "탈퇴한 사람"으로 익명 처리되어 남아요.
            </Text>
          </View>

          <View style={styles.delSection}>
            <Text style={styles.delSectionTitle}>그 밖에</Text>
            <Text style={styles.delBullet}>• 진행 중인 도전과 응원은 모두 종료돼요.</Text>
            <Text style={styles.delBullet}>• 삭제는 즉시 처리되며 되돌릴 수 없어요.</Text>
            <Text style={styles.delBullet}>
              • 지금 로그인한 계정으로는 다시 가입할 수 없어요. 다른 계정으로는 새로 시작할 수 있어요.
            </Text>
          </View>

          {/* 확인 체크박스 — 체크해야 삭제 버튼 활성 */}
          <Pressable
            style={styles.delCheckRow}
            onPress={() => { haptic.tap(); setChecked(v => !v); }}
            disabled={deleting}
          >
            <View style={[styles.delCheckbox, checked && styles.delCheckboxOn]}>
              {checked && <Text style={styles.delCheckMark}>✓</Text>}
            </View>
            <Text style={styles.delCheckLabel}>위 내용을 모두 확인했어요</Text>
          </Pressable>

          <Pressable
            style={[styles.delButton, (!checked || deleting) && styles.delButtonDisabled]}
            onPress={onConfirm}
            disabled={!checked || deleting}
          >
            <Text style={styles.delButtonText}>
              {deleting ? '삭제 중…' : '계정 삭제하기'}
            </Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    </Modal>
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

  // 계정 삭제 — 진입 링크(빨강, 눈에 띄지 않게) + 모달 본문
  deleteLink: {
    alignItems: 'center',
    paddingVertical: 12,
    marginTop: 4,
  },
  deleteLinkText: {
    fontSize: fontSize.sm,
    color: colors.danger,
    fontFamily: fontFamily.medium,
    fontWeight: fontWeight.medium,
  },
  delLead: {
    fontSize: fontSize.base,
    color: colors.primary,
    fontFamily: fontFamily.medium,
    fontWeight: fontWeight.medium,
    lineHeight: 22,
    marginBottom: 8,
  },
  delSection: {
    marginTop: 16,
    gap: 6,
  },
  delSectionTitle: {
    fontSize: fontSize.sm,
    color: colors.primary,
    fontFamily: fontFamily.bold,
    fontWeight: fontWeight.bold,
  },
  delBullet: {
    fontSize: fontSize.sm,
    color: colors.primary500,
    fontFamily: fontFamily.regular,
    lineHeight: 21,
  },
  delCheckRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 28,
    paddingVertical: 4,
  },
  delCheckbox: {
    width: 24,
    height: 24,
    borderRadius: radius.sm,
    borderWidth: 1.5,
    borderColor: colors.primary100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  delCheckboxOn: {
    backgroundColor: colors.danger,
    borderColor: colors.danger,
  },
  delCheckMark: {
    color: colors.surface,
    fontSize: 14,
    fontWeight: fontWeight.bold,
  },
  delCheckLabel: {
    flex: 1,
    fontSize: fontSize.base,
    color: colors.primary,
    fontFamily: fontFamily.medium,
    fontWeight: fontWeight.medium,
  },
  delButton: {
    marginTop: 20,
    minHeight: 50,
    borderRadius: radius.lg,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
  },
  delButtonDisabled: {
    opacity: 0.4,
  },
  delButtonText: {
    fontSize: fontSize.lg,
    color: colors.surface,
    fontFamily: fontFamily.bold,
    fontWeight: fontWeight.bold,
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
    color: colors.primary500,
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
    paddingHorizontal: 4,
    paddingBottom: 16,
    lineHeight: 20,
  },

  // 관심 분야 — 프로필 섹션 (chips)
  interestRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    gap: 12,
  },
  interestHint: {
    flex: 1,
    fontSize: fontSize.sm,
    color: colors.primary500,
    fontFamily: fontFamily.regular,
    lineHeight: 20,
  },
  chipsWrap: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: colors.accent50,
    borderRadius: radius.pill,
  },
  chipText: {
    fontSize: fontSize.sm,
    color: colors.accent700,
    fontFamily: fontFamily.medium,
    fontWeight: fontWeight.medium,
  },

  // 관심 분야 모달 — 2-column grid
  catGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  catCard: {
    width: '48%',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    paddingVertical: 18,
    paddingHorizontal: 14,
    alignItems: 'center',
    gap: 6,
    borderWidth: 2,
    borderColor: colors.primary100,
    position: 'relative',
    ...shadow.sm,
  },
  catCardSelected: {
    borderColor: colors.accent,
    backgroundColor: colors.accent50,
  },
  catCheckBadge: {
    position: 'absolute',
    top: 8, right: 8,
    width: 20, height: 20,
    borderRadius: 10,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  catCheckBadgeText: {
    color: colors.surface,
    fontSize: 12,
    fontFamily: fontFamily.bold,
    fontWeight: fontWeight.bold,
  },
  catEmojiBig: { fontSize: 38, marginBottom: 4 },
  catNameBig: {
    fontSize: fontSize.base,
    color: colors.primary,
    fontFamily: fontFamily.bold,
    fontWeight: fontWeight.bold,
    textAlign: 'center',
  },
  catNameSelected: { color: colors.accent700 },
  catCopySmall: {
    fontSize: fontSize.xs,
    color: colors.primary500,
    fontFamily: fontFamily.regular,
    textAlign: 'center',
    lineHeight: 16,
  },
  roadmapSection: {
    marginHorizontal: 24,
    marginTop: 24,
    gap: 8,
  },
  roadmapCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    paddingHorizontal: 16,
    paddingVertical: 8,
    ...shadow.sm,
  },
  roadmapRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 14,
    gap: 12,
  },
  roadmapEmoji: {
    fontSize: 22,
    marginTop: 2,
    textAlign: 'center',
    width: 28,
  },
  roadmapLabel: {
    fontSize: fontSize.base,
    color: colors.primary,
    fontFamily: fontFamily.bold,
    fontWeight: fontWeight.bold,
  },
  roadmapDesc: {
    fontSize: fontSize.xs,
    color: colors.primary500,
    fontFamily: fontFamily.regular,
    marginTop: 4,
    lineHeight: 16,
  },
  roadmapDivider: {
    height: 1,
    backgroundColor: colors.primary100,
  },
  timeBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: colors.accent50,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.accent100,
  },
  timeBtnText: {
    fontSize: fontSize.sm,
    color: colors.accent700,
    fontFamily: fontFamily.bold,
    fontWeight: fontWeight.bold,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  pickerCard: {
    width: '100%',
    maxWidth: 320,
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: 24,
    alignItems: 'center',
    gap: 20,
    ...shadow.md,
  },
  pickerTitle: {
    fontSize: fontSize.base,
    color: colors.primary,
    fontFamily: fontFamily.bold,
    fontWeight: fontWeight.bold,
  },
  pickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: 8,
    gap: 12,
  },
  column: {
    gap: 8,
    justifyContent: 'center',
  },
  spinnerColumn: {
    alignItems: 'center',
    gap: 6,
  },
  pickerBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: radius.md,
    backgroundColor: colors.primary100,
    alignItems: 'center',
    width: 60,
  },
  pickerBtnActive: {
    backgroundColor: colors.accent,
  },
  pickerBtnText: {
    fontSize: fontSize.sm,
    color: colors.primary700,
    fontFamily: fontFamily.medium,
  },
  pickerBtnTextActive: {
    color: colors.surface,
    fontFamily: fontFamily.bold,
  },
  arrowBtn: {
    padding: 8,
  },
  arrowText: {
    fontSize: 14,
    color: colors.primary500,
  },
  valueWrap: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    width: 64,
  },
  valueText: {
    fontSize: 28,
    fontFamily: fontFamily.bold,
    fontWeight: fontWeight.bold,
    color: colors.primary,
  },
  valueUnit: {
    fontSize: fontSize.xs,
    color: colors.primary500,
    marginLeft: 2,
  },
  pickerActions: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
    marginTop: 8,
  },
  pickerCancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: radius.lg,
    backgroundColor: colors.primary100,
    alignItems: 'center',
  },
  pickerCancelText: {
    fontSize: fontSize.base,
    color: colors.primary700,
    fontFamily: fontFamily.medium,
  },
  pickerSaveBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: radius.lg,
    backgroundColor: colors.accent,
    alignItems: 'center',
  },
  pickerSaveText: {
    fontSize: fontSize.base,
    color: colors.surface,
    fontFamily: fontFamily.bold,
    fontWeight: fontWeight.bold,
  },
});
