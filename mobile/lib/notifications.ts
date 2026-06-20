// 🚀 로컬 알림 — 매일 아침 8시 "아침 인사" (요일별 7개를 매주 반복으로 예약)
// 서버 푸시·인증서 불필요 (디바이스 자체 스케줄링). 잠금화면·배너에 푸시처럼 표시됨.
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// 구 단일 리마인더 ID — 업그레이드 시 정리(취소)용으로만 보관
const LEGACY_REMINDER_ID = 'daily-checkin-reminder';

// 요일별 아침 인사 7개. weekday = expo 규약(1=일 … 7=토).
// 수·금·토·일은 끝을 '…, 하다' 톤으로 마무리. 본문 끝줄엔 공통 안내(끄기)를 붙인다.
const REMINDER_OPT_OUT = '알림은 내 정보에서 끌 수 있어요';
const WEEKLY_GREETINGS = [
  { weekday: 2, id: 'daily-greeting-mon', title: '월요일 아침이에요 ☀️', body: '새 한 주, 가벼운 첫 걸음부터 함께해요' },
  { weekday: 3, id: 'daily-greeting-tue', title: '화요일도 하다 💛',     body: '어제의 한 걸음이 오늘의 나를 만들어요' },
  { weekday: 4, id: 'daily-greeting-wed', title: '벌써 수요일 🌿',       body: '한 주의 한가운데, 나만의 속도로, 하다' },
  { weekday: 5, id: 'daily-greeting-thu', title: '목요일 아침 ☀️',       body: '동료들도 각자의 하루를 시작하고 있어요' },
  { weekday: 6, id: 'daily-greeting-fri', title: '금요일이에요 🌸',       body: '한 주를 잘 걸어온 나에게, 오늘도 한 걸음, 하다' },
  { weekday: 7, id: 'daily-greeting-sat', title: '토요일 아침 🌤️',       body: '쉬어도, 한 걸음 떼어도 좋은 날, 하다' },
  { weekday: 1, id: 'daily-greeting-sun', title: '일요일이에요 🍃',       body: '지난 한 주를 돌아보며, 천천히, 하다' },
];

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

// 요일별 아침 인사 7개를 매주 반복으로 예약 (기본 아침 8시).
// 시간 변경/중복 방지를 위해 항상 기존 예약(구 단일 + 7개)을 먼저 취소하고 다시 건다.
export async function scheduleDailyReminder(hour = 8, minute = 0): Promise<void> {
  const ok = await ensurePermission();
  if (!ok) return;

  await cancelDailyReminder();

  // Android 는 채널 명시 권장
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('daily-reminder', {
      name: '아침 인사',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }

  // 요일별 7개를 WEEKLY 트리거로 — 7일 주기로 자동 반복(리필 불필요).
  for (const g of WEEKLY_GREETINGS) {
    await Notifications.scheduleNotificationAsync({
      identifier: g.id,
      content: {
        title: g.title,
        body: `${g.body}\n${REMINDER_OPT_OUT}`,
        sound: false,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
        weekday: g.weekday,
        hour,
        minute,
        ...(Platform.OS === 'android' ? { channelId: 'daily-reminder' } : {}),
      },
    });
  }
}

export async function cancelDailyReminder(): Promise<void> {
  // 구 단일 리마인더 + 요일별 7개 모두 취소
  await Notifications.cancelScheduledNotificationAsync(LEGACY_REMINDER_ID).catch(() => {});
  for (const g of WEEKLY_GREETINGS) {
    await Notifications.cancelScheduledNotificationAsync(g.id).catch(() => {});
  }
}
