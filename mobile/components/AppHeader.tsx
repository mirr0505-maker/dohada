// 🚀 통합 헤더 — 4개 하단 탭 (홈/내챌린지/둘러보기/내정보) 공통
// 로고 + 닉네임 + 알람 + 아바타 (탭 → 내정보)
// 닉네임/아바타는 매 화면 진입 시 fetchMyProfile 로 동기화 (수정 시 즉시 반영).
import React, { useCallback, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Alert, Image } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, fontFamily, fontSize, fontWeight, radius, shadow } from '@/lib/tokens';
import { useSession } from '@/lib/session';
import { fetchMyProfile } from '@/lib/db';
import { haptic } from '@/lib/haptics';
import { BrandMark } from '@/components/BrandMark';

export function AppHeader() {
  const session = useSession();
  const myUserId = session?.user?.id;
  const [nickname, setNickname] = useState<string>('도전자');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  // 매 화면 진입 시 갱신 — 닉네임/아바타 수정 후 다른 탭 갔다 오면 동기화
  useFocusEffect(
    useCallback(() => {
      if (!myUserId || myUserId === 'dev') return;
      fetchMyProfile(myUserId)
        .then(p => { setNickname(p.nickname); setAvatarUrl(p.avatar_url); })
        .catch(() => {});
    }, [myUserId]),
  );

  return (
    <View style={styles.header}>
      {/* 좌: 로고 + Do:하다 (한 텍스트 라인) */}
      <View style={styles.brand}>
        <BrandMark size="md" color={colors.accent} />
        <Text style={styles.brandText}>
          Do<Text style={styles.brandColon}>:</Text>하다
        </Text>
      </View>

      {/* 우: 알림 + 아바타 */}
      <View style={styles.rightGroup}>
        <Pressable
          style={styles.headerIcon}
          onPress={() => { haptic.tap(); Alert.alert('알림', 'Phase 2 에서 활성화돼요.'); }}
        >
          <Ionicons name="notifications-outline" size={20} color={colors.primary} />
        </Pressable>
        <Pressable
          onPress={() => { haptic.tap(); router.push('/(tabs)/profile' as any); }}
          hitSlop={6}
        >
          {avatarUrl ? (
            <Image source={{ uri: avatarUrl }} style={styles.headerAvatar} />
          ) : (
            <View style={[styles.headerAvatar, styles.headerAvatarFallback]}>
              <Text style={styles.headerAvatarInit}>{nickname.slice(0, 1)}</Text>
            </View>
          )}
        </Pressable>
      </View>

      {/* 중앙: 닉네임 pill (accent 배경 + 흰 글씨) */}
      <View style={styles.nickWrap} pointerEvents="none">
        <View style={styles.nickPill}>
          <Text style={styles.headerNick} numberOfLines={1}>{nickname}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    position: 'relative',
    paddingHorizontal: 20,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.primary100,
    ...shadow.sm,
  },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  brandText: {
    fontSize: fontSize.xl,
    color: colors.primary,
    fontFamily: fontFamily.bold,
    fontWeight: fontWeight.bold,
    letterSpacing: -0.4,
  },
  brandColon: {
    color: colors.accent,
  },
  rightGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  nickWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nickPill: {
    backgroundColor: colors.accent,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 5,
    maxWidth: 140,
  },
  headerNick: {
    fontSize: fontSize.lg,
    color: colors.surface,
    fontFamily: fontFamily.bold,
    fontWeight: fontWeight.bold,
    letterSpacing: -0.2,
  },
  headerIcon: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: colors.primary50,
    alignItems: 'center', justifyContent: 'center',
  },
  headerAvatar: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: colors.accent50,
    overflow: 'hidden',
  },
  headerAvatarFallback: { alignItems: 'center', justifyContent: 'center' },
  headerAvatarInit: {
    fontSize: 14,
    color: colors.accent700,
    fontFamily: fontFamily.bold,
    fontWeight: fontWeight.bold,
  },
});
