// 🚀 Root Stack — 전체 라우트의 진입점
import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { initSentry } from '@/lib/sentry';
import { scheduleDailyReminder } from '@/lib/notifications';

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

  // 폰트 로딩 전엔 네이티브 splash 화면 그대로 둠
  if (!fontsLoaded && !fontError) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar style="auto" />
        <Stack
          screenOptions={{
            headerShown: false,
            animation: 'fade',
          }}
        >
          {/* 온보딩 흐름 */}
          <Stack.Screen name="index" options={{ animation: 'none' }} />
          <Stack.Screen name="onb1" />
          <Stack.Screen name="onb2" />
          <Stack.Screen name="onb3" />
          <Stack.Screen name="onb4" />
          <Stack.Screen name="login" />
          <Stack.Screen name="welcome" />

          {/* 메인 */}
          <Stack.Screen name="home" />
          <Stack.Screen name="discover" options={{ animation: 'slide_from_right' }} />

          {/* 모달 / 동적 라우트 */}
          <Stack.Screen name="create" options={{ presentation: 'modal' }} />
          <Stack.Screen name="checkin/[id]" options={{ presentation: 'modal' }} />
          <Stack.Screen name="room/[id]" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="invite/[id]" />
          <Stack.Screen name="complete/[id]" options={{ animation: 'fade', gestureEnabled: false }} />
        </Stack>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
