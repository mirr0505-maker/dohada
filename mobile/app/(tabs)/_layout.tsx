// 🚀 5탭 bottom navigation (탭바 재구성)
// 탭: 홈 (피드) / 광장 / 파장 / 기록 / 해냈어요
// IA 개편 2단계 — '내 하다' 탭을 내리고 그 자리에 '광장'(아직 인연이 아닌 하다).
//   내 하다 라우트는 살아 있다 (홈·내 정보에서 push 진입).
// 생성(+)은 하단 탭이 아닌 우하단 FAB 로 이동 — 눌러 /create 모달 트리거.
// profile 탭 제거 — MY 는 우상단 아바타로 일원화 (AppHeader).
import React, { useEffect, useState } from 'react';
import { Tabs, router } from 'expo-router';
import { View, Pressable, Platform } from 'react-native';
import { House, Compass, Waves, Plus, Film, Trophy } from 'lucide-react-native';
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

  // 🚀 FAB 위치 — 탭바 높이 위로 띄운다 (Android edge-to-edge 인셋 재사용)
  const tabBarHeight = Platform.OS === 'ios' ? 84 : 56 + androidBottomPad;

  return (
    <View style={{ flex: 1 }}>
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
        name="discover"
        options={{
          title: '광장',
          tabBarIcon: ({ color }) => (
            <Compass size={TAB_ICON_SIZE} color={color} strokeWidth={1.8} />
          ),
        }}
      />
      <Tabs.Screen
        name="parang"
        options={{
          title: '공명',
          tabBarIcon: ({ color }) => (
            <Waves size={TAB_ICON_SIZE} color={color} strokeWidth={1.8} />
          ),
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
      {/* create-tab / my-challenges / profile 은 탭 X — 라우트는 직접 접근 가능 유지 */}
      <Tabs.Screen name="create-tab"    options={{ href: null }} />
      <Tabs.Screen name="my-challenges" options={{ href: null }} />
      <Tabs.Screen name="profile"       options={{ href: null }} />
    </Tabs>

      {/* 🚀 하다 만들기 FAB — 우하단 플로팅, 탭바 위로 뜬다 */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="하다 만들기"
        onPress={() => { haptic.tap(); router.push('/create'); }}
        style={{
          position: 'absolute',
          right: 20,
          bottom: tabBarHeight + 16,
          width: 56,
          height: 56,
          borderRadius: 28,
          backgroundColor: colors.brand,
          alignItems: 'center',
          justifyContent: 'center',
          ...shadow.lg,
        }}
      >
        <Plus size={28} color={colors.onBrand} strokeWidth={2.5} />
      </Pressable>
    </View>
  );
}
