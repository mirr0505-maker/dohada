// 🚀 조직 가입 — 조직 정보 입력 → 조직 메일로 코드 받기 (0087, ORG_HADA_PLAN §10.2 A-3)
// 서류는 받지 않는다. 검증 = 조직 메일 코드 + 사업자·고유번호 기록 → 운영자 승인.
import React, { useState } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { Screen } from '@/components/Screen';
import { Button } from '@/components/Button';
import { OrgField } from '@/components/org/OrgField';
import { requestOrgLoginCode } from '@/lib/auth';
import { isLikelyEmail, isPersonalEmailDomain } from '@/lib/orgEmail';
import type { OrgType } from '@/lib/db';
import { colors, fontFamily, fontSize, fontWeight, radius } from '@/lib/tokens';

const ORG_TYPES: { v: OrgType; label: string }[] = [
  { v: 'company', label: '기업' }, { v: 'nonprofit', label: '비영리·단체' }, { v: 'public', label: '공공기관' },
];

export default function OrgSignupScreen() {
  // 거절 후 "다시 신청" 으로 오면 이전 입력을 채워 준다 (org/index.tsx)
  const prev = useLocalSearchParams<{ orgType?: string; legalName?: string; registrationNo?: string; contactName?: string; contactPhone?: string; email?: string }>();
  const [orgType, setOrgType] = useState<OrgType>((prev.orgType as OrgType) || 'company');
  const [legalName, setLegalName] = useState(prev.legalName ?? '');
  const [registrationNo, setRegistrationNo] = useState(prev.registrationNo ?? '');
  const [contactName, setContactName] = useState(prev.contactName ?? '');
  const [contactPhone, setContactPhone] = useState(prev.contactPhone ?? '');
  const [email, setEmail] = useState(prev.email ?? '');
  const [sending, setSending] = useState(false);

  const personalMail = !!email.trim() && isPersonalEmailDomain(email);
  const ready = legalName.trim() && contactName.trim() && isLikelyEmail(email) && !personalMail;

  const onSend = async () => {
    if (!ready) return;
    try {
      setSending(true);
      await requestOrgLoginCode(email);
      router.push({
        pathname: '/org/verify',
        params: { mode: 'signup', email: email.trim().toLowerCase(), orgType, legalName, registrationNo, contactName, contactPhone },
      } as any);
    } catch (e: any) {
      Alert.alert('코드를 보내지 못했어요', e?.message ?? String(e));
    } finally {
      setSending(false);
    }
  };

  return (
    <Screen backgroundColor={colors.bg}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={12}><ChevronLeft size={24} color={colors.ink} /></Pressable>
          <Text style={styles.headerTitle}>조직으로 시작하기</Text>
          <View style={{ width: 24 }} />
        </View>
        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          <Text style={styles.lead}>
            기업·기관·단체가 구성원이나 시민과 함께할 하다를 여는 계정이에요.{'\n'}
            운영팀이 확인하면 공식 주최자로 열려요.
          </Text>

          <View style={styles.chips}>
            {ORG_TYPES.map(o => (
              <Pressable key={o.v} style={[styles.chip, orgType === o.v && styles.chipOn]} onPress={() => setOrgType(o.v)}>
                <Text style={[styles.chipText, orgType === o.v && styles.chipTextOn]}>{o.label}</Text>
              </Pressable>
            ))}
          </View>

          <OrgField label="조직 이름" value={legalName} onChangeText={setLegalName} placeholder="예: 청주시 보건소" maxLength={100}
            hint="앱에 주최자 이름으로 보여요." />
          <OrgField label="사업자등록번호 · 고유번호" value={registrationNo} onChangeText={setRegistrationNo} placeholder="없으면 비워 두세요"
            keyboardType="numbers-and-punctuation" />
          <OrgField label="담당자 이름" value={contactName} onChangeText={setContactName} maxLength={50} />
          <OrgField label="담당자 연락처 (선택)" value={contactPhone} onChangeText={setContactPhone} keyboardType="phone-pad"
            hint="운영팀이 확인 연락할 때만 써요." />
          <OrgField label="조직 메일" value={email} onChangeText={setEmail} placeholder="walk@company.co.kr"
            autoCapitalize="none" autoCorrect={false} keyboardType="email-address"
            hint={personalMail
              ? '개인 메일(gmail·naver 등)로는 조직 가입을 할 수 없어요.'
              : '이 메일로 로그인 코드가 와요. 담당자가 바뀌어도 계정이 남도록 부서 공용 메일을 권해요.'} />

          <Button label="코드 받기" onPress={onSend} disabled={!ready} loading={sending} block size="xl" />

          <Pressable style={styles.linkRow} onPress={() => router.replace('/org/login' as any)}>
            <Text style={styles.link}>이미 조직 계정이 있어요 · 메일로 로그인</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  headerTitle: { fontSize: fontSize.lg, color: colors.ink, fontFamily: fontFamily.bold, fontWeight: fontWeight.bold },
  body: { paddingHorizontal: 20, paddingBottom: 40, gap: 18 },
  lead: { fontSize: fontSize.sm, color: colors.sub, fontFamily: fontFamily.regular, lineHeight: 21 },
  chips: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.pill, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line },
  chipOn: { backgroundColor: colors.brandTint, borderColor: colors.brand },
  chipText: { fontSize: fontSize.sm, color: colors.sub, fontFamily: fontFamily.medium, fontWeight: fontWeight.medium },
  chipTextOn: { color: colors.brandInk, fontFamily: fontFamily.bold, fontWeight: fontWeight.bold },
  linkRow: { alignItems: 'center', paddingVertical: 8 },
  link: { fontSize: fontSize.sm, color: colors.brandInk, fontFamily: fontFamily.bold, fontWeight: fontWeight.bold },
});
