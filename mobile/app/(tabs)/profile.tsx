// 🚀 내 정보 — 프로필 카드 + 알림 설정 + 로그아웃
import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, Pressable, StyleSheet, Alert, Switch, ScrollView,
} from 'react-native';
import { router } from 'expo-router';
import { Screen } from '@/components/Screen';
import { Button } from '@/components/Button';
import { colors, fontFamily, fontSize, fontWeight, radius, shadow } from '@/lib/tokens';
import { useSession } from '@/lib/session';
import { signOut } from '@/lib/auth';
import { haptic } from '@/lib/haptics';
import { fetchNotificationPrefs, updateNotificationPrefs, type NotificationPrefs } from '@/lib/push';
import { scheduleDailyReminder, cancelDailyReminder } from '@/lib/notifications';
import Constants from 'expo-constants';

export default function ProfileScreen() {
  const session = useSession();
  const [prefs, setPrefs] = useState<NotificationPrefs | null>(null);
  const myUserId = session?.user?.id;

  useEffect(() => {
    if (session === null) router.replace('/login');
  }, [session]);

  // 알림 prefs 로드
  useEffect(() => {
    if (!myUserId || myUserId === 'dev') return;
    fetchNotificationPrefs(myUserId).then(setPrefs).catch(() => {});
  }, [myUserId]);

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

  const nickname = (session?.user?.user_metadata as any)?.full_name
    ?? session?.user?.email?.split('@')[0]
    ?? '도전자';
  const email = session?.user?.email ?? '';
  const initial = nickname.slice(0, 1);
  const appVersion = Constants.expoConfig?.version ?? '0.1.0';

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
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        <View style={styles.header}>
          <Text style={styles.title}>내 정보</Text>
        </View>

        {/* 프로필 카드 */}
        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initial}</Text>
          </View>
          <Text style={styles.nickname}>{nickname}</Text>
          {email ? <Text style={styles.email}>{email}</Text> : null}
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
    </Screen>
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
  header: {
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  title: {
    fontSize: fontSize['2xl'],
    color: colors.primary,
    fontFamily: fontFamily.bold,
    fontWeight: fontWeight.bold,
    letterSpacing: -0.4,
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
  nickname: {
    fontSize: fontSize.xl,
    color: colors.primary,
    fontFamily: fontFamily.bold,
    fontWeight: fontWeight.bold,
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
});
