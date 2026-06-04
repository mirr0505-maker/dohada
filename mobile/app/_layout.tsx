// 🚀 Root Stack — 전체 라우트의 진입점
import { useEffect } from 'react';
import { Stack, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import * as Notifications from 'expo-notifications';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { initSentry } from '@/lib/sentry';
import { scheduleDailyReminder } from '@/lib/notifications';
import { registerExpoPushToken, ensureNotificationPrefs } from '@/lib/push';
import { useSession } from '@/lib/session';

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

  // 매일 저녁 8시 로컬 알림 (권한 거부 시 noop)
  useEffect(() => {
    scheduleDailyReminder(20, 0).catch(() => {});
  }, []);

  // 로그인 후 Expo Push Token 등록 + notification_prefs row ensure
  const session = useSession();
  useEffect(() => {
    const uid = session?.user?.id;
    if (!uid || uid === 'dev') return;     // UI-only 더미 세션은 skip
    registerExpoPushToken(uid).catch(() => {});
    ensureNotificationPrefs(uid).catch(() => {});
  }, [session?.user?.id]);

  // 푸시 알림 탭 시 해당 챌린지/인증/기록 화면으로 이동
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((resp) => {
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
