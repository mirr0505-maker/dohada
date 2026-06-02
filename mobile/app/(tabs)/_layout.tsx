// 🚀 5탭 bottom navigation — v4 통합기획서 홈 화면 디자인 기준
// 탭: 홈 / 내챌린지 / + (가운데 큰 버튼) / 둘러보기 / 내정보
// + 탭은 listener 로 /create 모달 트리거 (라우트 자체는 빈 화면)
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
        name="discover"
        options={{
          title: '둘러보기',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'compass' : 'compass-outline'} size={TAB_ICON_SIZE} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: '내정보',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'person-circle' : 'person-circle-outline'} size={TAB_ICON_SIZE + 2} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
