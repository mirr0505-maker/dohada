// 🚀 조직 메일 코드 입력 — 가입(signup) 또는 로그인(login) 마무리 (0087)
//   signup: 코드 확인 → 가입 신청(submit_org_application) → /org (대기 화면)
//   login : 코드 확인 → 조직 계정인지 확인 → /org. 아니면 로그아웃 + 안내
import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { Screen } from '@/components/Screen';
import { Button } from '@/components/Button';
import { OrgField } from '@/components/org/OrgField';
import { requestOrgLoginCode, verifyOrgLoginCode, signOut } from '@/lib/auth';
import { fetchMyOrgStatus, submitOrgApplication } from '@/lib/org';
import type { OrgType } from '@/lib/db';
import { colors, fontFamily, fontSize, fontWeight } from '@/lib/tokens';

const CODE_LENGTH = 6;
const RESEND_WAIT_SECONDS = 60;   // Supabase 기본 재발송 간격과 맞춘다

export default function OrgVerifyScreen() {
  const p = useLocalSearchParams<{
    mode: 'signup' | 'login'; email: string;
    orgType?: string; legalName?: string; registrationNo?: string; contactName?: string; contactPhone?: string;
    activityUrl?: string;   // 🚀 0090: 모임 활동 링크
  }>();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [wait, setWait] = useState(RESEND_WAIT_SECONDS);

  useEffect(() => {
    if (wait <= 0) return;
    const t = setTimeout(() => setWait(w => w - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);

  // 실패하면 세션을 남기지 않는다 — 조직이 아닌 계정으로 앱에 들어가 있으면 안 된다
  const failAndSignOut = async (title: string, message: string) => {
    await signOut();
    Alert.alert(title, message, [{ text: '확인', onPress: () => router.replace('/login') }]);
  };

  const onVerify = async () => {
    try {
      setBusy(true);
      await verifyOrgLoginCode(p.email, code);
      const status = await fetchMyOrgStatus();

      if (p.mode === 'login') {
        if (status.account_type !== 'org') {
          return failAndSignOut('조직 계정이 아니에요',
            status.account_type === 'personal'
              ? '이 메일은 개인 계정이에요. 처음 화면에서 Google·Apple 로 들어가 주세요.'
              : '아직 가입하지 않은 메일이에요. 조직 가입부터 해 주세요.');
        }
        return router.replace('/org' as any);
      }

      // signup — 이미 승인된 계정이면 신청을 다시 내지 않고 들어간다
      if (status.account_type === 'org' && status.status === 'approved') return router.replace('/org' as any);
      try {
        await submitOrgApplication({
          orgType: (p.orgType as OrgType) || 'company',
          legalName: p.legalName ?? '',
          registrationNo: p.registrationNo ?? '',
          contactName: p.contactName ?? '',
          contactPhone: p.contactPhone ?? '',
          activityUrl: p.activityUrl ?? '',
        });
      } catch (e: any) {
        return failAndSignOut('가입 신청을 하지 못했어요', e?.message ?? String(e));
      }
      router.replace('/org' as any);
    } catch (e: any) {
      Alert.alert('확인하지 못했어요', e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  };

  const onResend = async () => {
    try {
      await requestOrgLoginCode(p.email);
      setWait(RESEND_WAIT_SECONDS);
    } catch (e: any) {
      Alert.alert('다시 보내지 못했어요', e?.message ?? String(e));
    }
  };

  return (
    <Screen backgroundColor={colors.bg}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={12}><ChevronLeft size={24} color={colors.ink} /></Pressable>
          <Text style={styles.headerTitle}>메일 확인</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.body}>
          <Text style={styles.lead}>{p.email} 으로 보낸 {CODE_LENGTH}자리 코드를 입력해 주세요.</Text>
          <OrgField label="코드" value={code} onChangeText={t => setCode(t.replace(/\D/g, '').slice(0, CODE_LENGTH))}
            keyboardType="number-pad" autoFocus maxLength={CODE_LENGTH} style={styles.codeInput}
            hint="메일이 안 보이면 스팸함도 확인해 주세요." />
          <Button label="확인" onPress={onVerify} disabled={code.length !== CODE_LENGTH} loading={busy} block size="xl" />
          <Pressable style={styles.linkRow} onPress={onResend} disabled={wait > 0}>
            <Text style={[styles.link, wait > 0 && { color: colors.faint }]}>
              {wait > 0 ? `코드 다시 받기 (${wait}초)` : '코드 다시 받기'}
            </Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  headerTitle: { fontSize: fontSize.lg, color: colors.ink, fontFamily: fontFamily.bold, fontWeight: fontWeight.bold },
  body: { paddingHorizontal: 20, paddingTop: 12, gap: 18 },
  lead: { fontSize: fontSize.sm, color: colors.sub, fontFamily: fontFamily.regular, lineHeight: 21 },
  codeInput: { fontSize: fontSize['2xl'], letterSpacing: 8, textAlign: 'center' },
  linkRow: { alignItems: 'center', paddingVertical: 8 },
  link: { fontSize: fontSize.sm, color: colors.brandInk, fontFamily: fontFamily.bold, fontWeight: fontWeight.bold },
});
