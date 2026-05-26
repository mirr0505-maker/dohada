// 🚀 로컬 알림 — 매일 저녁 8시 "오늘 인증했어?" 리마인더
// 푸시 인증서 불필요 (디바이스 자체 스케줄링).
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

const REMINDER_ID = 'daily-checkin-reminder';

// 앱 부팅 시 알림 표시 방식 (foreground 에서도 띄움)
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function ensurePermission(): Promise<boolean> {
  const cur = await Notifications.getPermissionsAsync();
  if (cur.granted) return true;
  if (!cur.canAskAgain) return false;

  const req = await Notifications.requestPermissionsAsync({
    ios: { allowAlert: true, allowBadge: false, allowSound: false },
  });
  return req.granted;
}

// 매일 정해진 시간에 인증 리마인더 1개 스케줄.
// 이미 같은 ID 가 있으면 덮어씀.
export async function scheduleDailyReminder(hour = 20, minute = 0): Promise<void> {
  const ok = await ensurePermission();
  if (!ok) return;

  await Notifications.cancelScheduledNotificationAsync(REMINDER_ID).catch(() => {});

  // Android 는 채널 명시 권장
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('daily-reminder', {
      name: '일일 인증 리마인더',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }

  await Notifications.scheduleNotificationAsync({
    identifier: REMINDER_ID,
    content: {
      title: '오늘 인증했어요?',
      body: '동료들이 응원하러 모이고 있어요. 📸',
      sound: false,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour,
      minute,
      ...(Platform.OS === 'android' ? { channelId: 'daily-reminder' } : {}),
    },
  });
}

export async function cancelDailyReminder(): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(REMINDER_ID).catch(() => {});
}
