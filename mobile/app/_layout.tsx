// 🚀 Root Stack — 전체 라우트의 진입점
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

export default function RootLayout() {
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
