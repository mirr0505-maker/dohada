// 🚀 공통 화면 래퍼 — SafeArea + background 컬러 처리
import React from 'react';
import { View, StyleSheet, ViewStyle, StatusBar } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '@/lib/tokens';

type Props = {
  children: React.ReactNode;
  // 풀스크린은 SafeArea 무시하고 노치 영역까지 배경 컬러 채움 (스플래시/로그인용)
  fullScreen?: boolean;
  backgroundColor?: string;
  // 상태바 컬러: 'dark' = 검은 글씨 (밝은 배경), 'light' = 흰 글씨 (어두운 배경)
  statusBarStyle?: 'dark' | 'light';
  style?: ViewStyle;
};

export function Screen({
  children,
  fullScreen = false,
  backgroundColor = colors.background,
  statusBarStyle = 'dark',
  style,
}: Props) {
  const insets = useSafeAreaInsets();

  if (fullScreen) {
    // 노치/홈인디케이터까지 컬러로 덮음. children 쪽에서 내부 padding 으로 SafeArea 처리.
    return (
      <View style={[styles.full, { backgroundColor }, style]}>
        <StatusBar
          barStyle={statusBarStyle === 'dark' ? 'dark-content' : 'light-content'}
          backgroundColor={backgroundColor}
        />
        <View style={{ paddingTop: insets.top, flex: 1 }}>{children}</View>
      </View>
    );
  }

  return (
    <SafeAreaView style={[styles.full, { backgroundColor }, style]} edges={['top', 'bottom']}>
      <StatusBar
        barStyle={statusBarStyle === 'dark' ? 'dark-content' : 'light-content'}
        backgroundColor={backgroundColor}
      />
      {children}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  full: { flex: 1 },
});
