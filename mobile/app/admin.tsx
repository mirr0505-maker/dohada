// 🚀 운영자 콘솔 — 신고 큐 · 명사/조직 지정 · 숨김 복구를 한 화면에 조립 (내부 운영 도구)
//   권한 강제는 서버(RPC). 여기선 fetchIsAdmin 으로 노출 게이트만 두고, 비-admin 엔 안내만.
import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import { Screen } from '@/components/Screen';
import { colors, fontFamily, fontSize, fontWeight } from '@/lib/tokens';
import { fetchIsAdmin } from '@/lib/db';
import { ReportQueue } from '@/components/admin/ReportQueue';
import { PromotionQueue } from '@/components/admin/PromotionQueue';
import { HostTierAssign } from '@/components/admin/HostTierAssign';
import { HiddenRestore } from '@/components/admin/HiddenRestore';

export default function AdminScreen() {
  const [state, setState] = useState<'checking' | 'ok' | 'denied'>('checking');

  useEffect(() => {
    fetchIsAdmin()
      .then(ok => setState(ok ? 'ok' : 'denied'))
      .catch(() => setState('denied'));
  }, []);

  return (
    <Screen backgroundColor={colors.bg}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} accessibilityRole="button" accessibilityLabel="뒤로가기">
          <ArrowLeft size={24} color={colors.primary} strokeWidth={2} />
        </Pressable>
        <Text style={styles.headerTitle}>운영자 콘솔</Text>
        <View style={{ width: 24 }} />
      </View>

      {state === 'checking' ? (
        <View style={styles.center}><ActivityIndicator color={colors.accent} /></View>
      ) : state === 'denied' ? (
        <View style={styles.center}><Text style={styles.denied}>권한이 없어요</Text></View>
      ) : (
        <ScrollView contentContainerStyle={styles.body}>
          <Text style={styles.section}>신고 큐</Text>
          <ReportQueue />

          <Text style={styles.section}>승격 심사</Text>
          <PromotionQueue />

          <Text style={styles.section}>명사·조직 지정</Text>
          <HostTierAssign />

          <Text style={styles.section}>숨김 복구</Text>
          <HiddenRestore />
        </ScrollView>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.primary100,
  },
  headerTitle: {
    fontSize: fontSize.lg,
    color: colors.primary,
    fontFamily: fontFamily.bold,
    fontWeight: fontWeight.bold,
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  denied: { fontSize: fontSize.base, color: colors.sub, fontFamily: fontFamily.regular },
  body: { padding: 16, paddingBottom: 40, gap: 12 },
  section: {
    fontSize: fontSize.lg,
    color: colors.primary,
    fontFamily: fontFamily.bold,
    fontWeight: fontWeight.bold,
    marginTop: 16,
  },
});
