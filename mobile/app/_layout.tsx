// 🚀 Root Stack — 전체 라우트의 진입점
import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

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

          {/* 모달 */}
          <Stack.Screen name="create" options={{ presentation: 'modal' }} />
          <Stack.Screen name="checkin/[id]" options={{ presentation: 'modal' }} />
          <Stack.Screen name="room/[id]" options={{ animation: 'slide_from_right' }} />
        </Stack>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
