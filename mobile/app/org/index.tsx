// 🚀 조직 영역 진입점 — 조직 계정(account_type='org')은 일반 5탭 대신 여기로 온다 (0087, ORG_HADA_PLAN §10.2 A-4·A-5)
//   승인 전(host_tier≠org) = 대기 화면 / 승인 후 = 조직 홈
import React, { useCallback, useEffect, useState } from 'react';
import { View, ActivityIndicator, Alert, Linking } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Screen } from '@/components/Screen';
import { OrgWaiting } from '@/components/org/OrgWaiting';
import { OrgHome } from '@/components/org/OrgHome';
import { useSession } from '@/lib/session';
import { signOut } from '@/lib/auth';
import { fetchMyOrgStatus } from '@/lib/org';
import type { MyOrgStatus } from '@/lib/org';
import { SUPPORT_EMAIL } from '@/lib/support';
import { colors } from '@/lib/tokens';

export default function OrgIndexScreen() {
  const session = useSession();
  const [status, setStatus] = useState<MyOrgStatus | null>(null);

  const load = useCallback(async () => {
    try {
      const s = await fetchMyOrgStatus();
      // 개인 계정이 여기로 잘못 들어왔으면 일반 홈으로 (안전망)
      if (s.account_type !== 'org') return router.replace('/(tabs)/home' as any);
      setStatus(s);
    } catch (e: any) {
      Alert.alert('불러오지 못했어요', e?.message ?? String(e));
    }
  }, []);

  // ⚠️ 세션 복원 전엔 조회하지 않는다 — 비로그인으로 조회하면 빈 상태가 와 개인 홈으로 튕긴다
  useFocusEffect(useCallback(() => { if (session?.user) load(); }, [session?.user?.id, load]));

  const onSignOut = async () => {
    await signOut();
    router.replace('/login');
  };

  const onMenu = () => Alert.alert('조직 계정', status?.nickname ?? undefined, [
    { text: '운영팀에 문의', onPress: () => Linking.openURL(`mailto:${SUPPORT_EMAIL}`) },
    { text: '로그아웃', style: 'destructive', onPress: onSignOut },
    { text: '닫기', style: 'cancel' },
  ]);

  // 로그아웃 상태로 남아 있으면 로그인으로
  useEffect(() => { if (session === null) router.replace('/login'); }, [session]);

  return (
    <Screen backgroundColor={colors.bg}>
      {!status || !session?.user ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={colors.brand} />
        </View>
      ) : status.host_tier === 'org' || status.host_tier === 'group' ? (
        <OrgHome userId={session.user.id} isGroup={status.host_tier === 'group'} onMenu={onMenu} />
      ) : (
        <OrgWaiting status={status} email={session.user.email ?? ''} onRefresh={load} onSignOut={onSignOut} />
      )}
    </Screen>
  );
}
