// 🚀 조직 가입 대기 화면 — 운영팀 승인 전 (0087, ORG_HADA_PLAN §10.2 A-5)
//   pending : 확인 중 안내 · rejected : 사유 + 다시 신청 · 신청 기록 없음 : 문의 안내
import React from 'react';
import { View, Text, StyleSheet, Linking } from 'react-native';
import { router } from 'expo-router';
import { Hourglass, CircleAlert } from 'lucide-react-native';
import { Button } from '@/components/Button';
import { SUPPORT_EMAIL } from '@/lib/support';
import type { MyOrgStatus } from '@/lib/org';
import { colors, fontFamily, fontSize, fontWeight, radius } from '@/lib/tokens';

type Props = { status: MyOrgStatus; email: string; onRefresh: () => void; onSignOut: () => void };

export function OrgWaiting({ status, email, onRefresh, onSignOut }: Props) {
  const rejected = status.status === 'rejected';

  const reapply = () => router.push({
    pathname: '/org/signup',
    params: {
      orgType: status.org_type ?? 'company', legalName: status.legal_name ?? '', registrationNo: status.registration_no ?? '',
      contactName: status.contact_name ?? '', contactPhone: status.contact_phone ?? '', email,
    },
  } as any);

  return (
    <View style={styles.wrap}>
      <View style={styles.card}>
        {rejected
          ? <CircleAlert size={32} color={colors.brandInk} strokeWidth={1.8} />
          : <Hourglass size={32} color={colors.brandInk} strokeWidth={1.8} />}
        <Text style={styles.org}>{status.legal_name ?? status.nickname ?? '조직'}</Text>
        <Text style={styles.title}>{rejected ? '확인이 더 필요해요' : '운영팀이 확인하고 있어요'}</Text>
        <Text style={styles.body}>
          {rejected
            ? (status.note ?? '운영팀에 문의해 주세요.')
            : `보통 1~2일 걸려요. 확인되면 공식 주최자로 열리고,\n이 화면에서 바로 하다를 열 수 있어요.`}
        </Text>
      </View>

      <View style={styles.actions}>
        {rejected
          ? <Button label="다시 신청하기" onPress={reapply} block size="xl" />
          : <Button label="상태 다시 확인" onPress={onRefresh} variant="outline" block size="lg" />}
        <Button label="운영팀에 문의" onPress={() => Linking.openURL(`mailto:${SUPPORT_EMAIL}`)} variant="ghost" block size="md" />
        <Button label="로그아웃" onPress={onSignOut} variant="ghost" block size="md" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, paddingHorizontal: 20, justifyContent: 'center', gap: 28 },
  card: {
    alignItems: 'center', gap: 10, paddingVertical: 32, paddingHorizontal: 20,
    backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line,
  },
  org: { fontSize: fontSize.sm, color: colors.sub, fontFamily: fontFamily.medium, fontWeight: fontWeight.medium, marginTop: 4 },
  title: { fontSize: fontSize.xl, color: colors.ink, fontFamily: fontFamily.bold, fontWeight: fontWeight.bold },
  body: { fontSize: fontSize.sm, color: colors.sub, fontFamily: fontFamily.regular, lineHeight: 21, textAlign: 'center' },
  actions: { gap: 8 },
});
