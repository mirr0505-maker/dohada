// 🚀 5탭 bottom navigation (v2.5 SNS-first 재설계)
// 탭: 홈 (피드) / 내도전 / + (가운데 큰 버튼) / 기록 / 해냈어요
// + 탭은 listener 로 /create 모달 트리거.
// profile 탭 제거 — MY 는 우상단 아바타로 일원화 (AppHeader).
import React, { useEffect, useState } from 'react';
import { Tabs, router } from 'expo-router';
import { View, Platform } from 'react-native';
import { House, Flag, Plus, Film, Trophy } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as SecureStore from 'expo-secure-store';
import { colors, fontFamily, fontSize, fontWeight, shadow } from '@/lib/tokens';
import { haptic } from '@/lib/haptics';
import { fetchLatestPublicStoryAt } from '@/lib/db';

const TAB_ICON_SIZE = 24;
const DONE_SEEN_KEY = 'done_stories_seen_at';   // 해냈어요 탭 마지막 확인 시각 (디바이스 로컬)

export default function TabsLayout() {
  // 🚀 Android edge-to-edge 대응 — 제스처 내비 기기에서 시스템 바와 겹치지 않게 인셋 반영
  const insets = useSafeAreaInsets();
  const androidBottomPad = Math.max(insets.bottom, 8);

  // 🚀 해냈어요 dot — 마지막 확인 이후 새 공개 완주 이야기가 있을 때만 (가짜 dot 금지)
  const [doneDotVisible, setDoneDotVisible] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const latest = await fetchLatestPublicStoryAt();
        if (!latest) return;
        const seen = await SecureStore.getItemAsync(DONE_SEEN_KEY);
        if (!seen || Date.parse(latest) > Date.parse(seen)) setDoneDotVisible(true);
      } catch {
        // 조회 실패 시 dot 표시 안 함 (가짜 알림 방지 우선)
      }
    })();
  }, []);

  const markDoneSeen = () => {
    setDoneDotVisible(false);
    SecureStore.setItemAsync(DONE_SEEN_KEY, new Date().toISOString()).catch(() => {});
  };

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.brand,
        tabBarInactiveTintColor: colors.faint2,
        tabBarLabelStyle: {
          fontFamily: fontFamily.medium,
          fontWeight: fontWeight.medium,
          fontSize: fontSize.xs,
          marginTop: -2,
        },
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.line,
          borderTopWidth: 1,
          height: Platform.OS === 'ios' ? 84 : 56 + androidBottomPad,
          paddingTop: 8,
          paddingBottom: Platform.OS === 'ios' ? 28 : androidBottomPad,
        },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: '홈',
          tabBarIcon: ({ color }) => (
            <House size={TAB_ICON_SIZE} color={color} strokeWidth={1.8} />
          ),
        }}
      />
      <Tabs.Screen
        name="my-challenges"
        options={{
          title: '내 하다',
          tabBarIcon: ({ color }) => (
            <Flag size={TAB_ICON_SIZE} color={color} strokeWidth={1.8} />
          ),
        }}
      />
      <Tabs.Screen
        name="create-tab"
        options={{
          title: '',
          tabBarAccessibilityLabel: '하다 만들기',
          tabBarIcon: () => (
            <View style={{
              width: 52,
              height: 52,
              borderRadius: 26,
              backgroundColor: colors.brand,
              alignItems: 'center',
              justifyContent: 'center',
              marginTop: -18,   // tabBar 위로 살짝 돌출
              ...shadow.lg,
            }}>
              <Plus size={28} color={colors.onBrand} strokeWidth={2.5} />
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
          tabBarIcon: ({ color }) => (
            <Film size={TAB_ICON_SIZE} color={color} strokeWidth={1.8} />
          ),
        }}
      />
      <Tabs.Screen
        name="done"
        options={{
          title: '해냈어요',
          tabBarIcon: ({ color }) => (
            <Trophy size={TAB_ICON_SIZE} color={color} strokeWidth={1.8} />
          ),
          // 🚀 조용한 알림 Dot — 새 공개 완주 이야기가 있을 때만 (탭하면 해제)
          tabBarBadge: doneDotVisible ? '' : undefined,
          tabBarBadgeStyle: {
            backgroundColor: colors.brand,
            width: 6,
            height: 6,
            borderRadius: 3,
            minWidth: 6,
            fontSize: 0,
            lineHeight: 0,
            marginTop: Platform.OS === 'ios' ? 2 : 0,
          },
        }}
        listeners={{
          tabPress: markDoneSeen,
        }}
      />
      {/* discover / profile 은 v2.5 에서 탭 X — 라우트는 직접 접근 가능 유지 */}
      <Tabs.Screen name="discover" options={{ href: null }} />
      <Tabs.Screen name="profile"  options={{ href: null }} />
    </Tabs>
  );
}
