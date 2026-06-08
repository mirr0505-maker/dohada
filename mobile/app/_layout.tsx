// 🚀 Root Stack — 전체 라우트의 진입점
import { useEffect } from 'react';
import { Stack, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import * as Notifications from 'expo-notifications';
import { AppState } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { initSentry } from '@/lib/sentry';
import { scheduleDailyReminder, cancelDailyReminder } from '@/lib/notifications';
import { registerExpoPushToken, ensureNotificationPrefs } from '@/lib/push';
import { useSession } from '@/lib/session';
import * as SecureStore from 'expo-secure-store';

// Sentry — module load 시점에 한 번
initSentry();

// 폰트 로딩이 끝날 때까지 네이티브 스플래시 유지
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    'Pretendard-Regular': require('../assets/fonts/Pretendard-Regular.otf'),
    'Pretendard-Medium': require('../assets/fonts/Pretendard-Medium.otf'),
    'Pretendard-Bold': require('../assets/fonts/Pretendard-Bold.otf'),
  });

  useEffect(() => {
    if (fontsLoaded || fontError) SplashScreen.hideAsync();
  }, [fontsLoaded, fontError]);

  // 🚀 로컬 알림 초기화 및 복원 (사용자가 설정한 시간 기준)
  //    P2-19: 기본값을 OFF 로 전환 — Apple 4.5.4 / Google Play 정책 대비.
  //    명시적으로 사용자가 daily_enabled='true' 로 설정해야 알림 스케줄링.
  //    기존 사용자(없으면)는 OFF 로 시작 → 프로필에서 켜는 흐름.
  useEffect(() => {
    const initReminder = async () => {
      try {
        const enabledStr = await SecureStore.getItemAsync('daily_enabled');
        const isEnabled = enabledStr === 'true';   // 없으면 false (기본 OFF)
        if (isEnabled) {
          const storedTime = await SecureStore.getItemAsync('daily_reminder_time');
          let hour = 20;
          let minute = 0;
          if (storedTime) {
            const [h, m] = storedTime.split(':').map(Number);
            if (!isNaN(h) && !isNaN(m)) {
              hour = h;
              minute = m;
            }
          }
          await scheduleDailyReminder(hour, minute);
        } else {
          await cancelDailyReminder();
        }
      } catch (e) {
        console.warn('[RootLayout] 로컬 알림 초기화 실패', e);
      }
    };
    initReminder();
  }, []);

  // 로그인 후 Expo Push Token 등록 + notification_prefs row ensure
  const session = useSession();
  useEffect(() => {
    const uid = session?.user?.id;
    if (!uid || uid === 'dev') return;     // UI-only 더미 세션은 skip
    registerExpoPushToken(uid).catch(() => {});
    ensureNotificationPrefs(uid).catch(() => {});
  }, [session?.user?.id]);

  // 🚀 앱이 활성화될 때 및 백그라운드 복귀 시 뱃지 초기화 및 알림 카드 클리어
  useEffect(() => {
    const clearBadges = async () => {
      try {
        await Notifications.setBadgeCountAsync(0);
        await Notifications.dismissAllNotificationsAsync();
      } catch (e) {
        console.warn('[RootLayout] 뱃지 및 알림 리셋 실패', e);
      }
    };

    // 1. 초기 마운트 시 실행
    clearBadges();

    // 2. 앱 상태가 active 로 전환될 때마다 실행
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active') {
        clearBadges();
      }
    });

    return () => {
      subscription.remove();
    };
  }, []);

  // 푸시 알림 탭 시 해당 챌린지/인증/기록 화면으로 이동
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((resp) => {
      // 알림 터치 시에도 뱃지/알림 리셋
      Notifications.setBadgeCountAsync(0).catch(() => {});
      Notifications.dismissAllNotificationsAsync().catch(() => {});

      const data = resp.notification.request.content.data as
        { kind?: string; challenge_id?: string; proof_id?: string; log_id?: string };
      if (!data) return;
      const cid = data.challenge_id;
      if (cid) {
        // 인증/응원/댓글/대화/기록 모두 챌린지 방으로 이동 (구체 탭은 사용자가 선택)
        router.push(`/room/${cid}` as any);
      }
    });
    return () => sub.remove();
  }, []);

  // 폰트 로딩 전엔 네이티브 splash 화면 그대로 둠
  if (!fontsLoaded && !fontError) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar style="auto" />
        <Stack
          screenOptions={{
            headerShown: false,
          }}
        >
          {/* 온보딩 흐름 */}
          <Stack.Screen name="index" />
          <Stack.Screen name="onb1" />
          <Stack.Screen name="onb2" />
          <Stack.Screen name="onb3" />
          <Stack.Screen name="onb4" />
          <Stack.Screen name="login" />
          <Stack.Screen name="welcome" />

          {/* 메인 — 5탭 bottom navigation */}
          <Stack.Screen name="(tabs)" />

          {/* 모달 / 동적 라우트 — modal 만 유지, slide/fade 모두 'none' 으로 */}
          <Stack.Screen name="create" options={{ presentation: 'modal' }} />
          <Stack.Screen name="checkin/[id]" options={{ presentation: 'modal' }} />
          <Stack.Screen name="room/[id]" />
          <Stack.Screen name="invite/[id]" />
          <Stack.Screen name="complete/[id]" options={{ gestureEnabled: false }} />
        </Stack>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
