// 🚀 5탭 bottom navigation (v2.5 SNS-first 재설계)
// 탭: 홈 (피드) / 내도전 / + (가운데 큰 버튼) / 기록 / 해냈어요
// + 탭은 listener 로 /create 모달 트리거.
// profile 탭 제거 — MY 는 우상단 아바타로 일원화 (AppHeader).
import React from 'react';
import { Tabs, router } from 'expo-router';
import { Text, View, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fontFamily, fontSize, fontWeight, shadow } from '@/lib/tokens';
import { haptic } from '@/lib/haptics';

const TAB_ICON_SIZE = 24;

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.primary300,
        tabBarLabelStyle: {
          fontFamily: fontFamily.medium,
          fontWeight: fontWeight.medium,
          fontSize: fontSize.xs,
          marginTop: -2,
        },
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.primary100,
          borderTopWidth: 1,
          height: Platform.OS === 'ios' ? 84 : 64,
          paddingTop: 8,
          paddingBottom: Platform.OS === 'ios' ? 28 : 8,
        },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: '홈',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'home' : 'home-outline'} size={TAB_ICON_SIZE} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="my-challenges"
        options={{
          title: '내 챌린지',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'flag' : 'flag-outline'} size={TAB_ICON_SIZE} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="create-tab"
        options={{
          title: '',
          tabBarIcon: () => (
            <View style={{
              width: 52,
              height: 52,
              borderRadius: 26,
              backgroundColor: colors.accent,
              alignItems: 'center',
              justifyContent: 'center',
              marginTop: -18,   // tabBar 위로 살짝 돌출
              ...shadow.lg,
            }}>
              <Text style={{ color: colors.surface, fontSize: 28, fontWeight: '700', lineHeight: 32 }}>＋</Text>
            </View>
          ),
          tabBarLabel: () => null,
        }}
        listeners={{
          tabPress: (e) => {
            e.preventDefault();
            haptic.tap();
            router.push('/create');
          },
        }}
      />
      <Tabs.Screen
        name="record"
        options={{
          title: '기록',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'film' : 'film-outline'} size={TAB_ICON_SIZE} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="done"
        options={{
          title: '해냈어요',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'trophy' : 'trophy-outline'} size={TAB_ICON_SIZE} color={color} />
          ),
          // 🚀 알림 뱃지 데모 (조용한 알림 Dot)
          tabBarBadge: '',
          tabBarBadgeStyle: {
            backgroundColor: colors.accent,
            width: 6,
            height: 6,
            borderRadius: 3,
            minWidth: 6,
            fontSize: 0,
            lineHeight: 0,
            marginTop: Platform.OS === 'ios' ? 2 : 0,
          },
        }}
      />
      {/* discover / profile 은 v2.5 에서 탭 X — 라우트는 직접 접근 가능 유지 */}
      <Tabs.Screen name="discover" options={{ href: null }} />
      <Tabs.Screen name="profile"  options={{ href: null }} />
    </Tabs>
  );
}
