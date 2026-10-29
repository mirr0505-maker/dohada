// 🚀 조직·모임 가입 — 정보 입력 → 메일로 코드 받기 (0087 · 0090, ORG_HADA_PLAN §10)
//   track=org   : 기업·개인사업자·비영리·공공 — 조직 메일 (개인사업자만 개인 메일 허용, 사업자번호 필수)
//   track=group : 밴드·카페·오픈톡 같은 모임 — 대표 메일(개인 메일 허용) + 활동 링크
// 서류는 받지 않는다. 운영자 승인 후 공식(🏛️) 또는 모임(👥) 주최자가 된다.
import React, { useState } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { Screen } from '@/components/Screen';
import { Button } from '@/components/Button';
import { OrgField } from '@/components/org/OrgField';
import { requestOrgLoginCode } from '@/lib/auth';
import { isLikelyEmail, isPersonalEmailDomain, personalEmailAllowed } from '@/lib/orgEmail';
import type { OrgType } from '@/lib/db';
import { colors, fontFamily, fontSize, fontWeight, radius } from '@/lib/tokens';

const ORG_TYPES: { v: OrgType; label: string }[] = [
  { v: 'company', label: '기업' }, { v: 'sole', label: '개인사업자' },
  { v: 'nonprofit', label: '비영리·단체' }, { v: 'public', label: '공공기관' },
];
const BIZ_NO_LENGTH = 10;   // 사업자등록번호 자릿수 (개인사업자 필수)

export default function OrgSignupScreen() {
  // 거절 후 "다시 신청" 으로 오면 이전 입력을 채워 준다 (OrgWaiting)
  const prev = useLocalSearchParams<{
    track?: string; orgType?: string; legalName?: string; registrationNo?: string;
    contactName?: string; contactPhone?: string; activityUrl?: string; email?: string;
  }>();
  const isGroup = prev.track === 'group' || prev.orgType === 'group';
  const [orgType, setOrgType] = useState<OrgType>(isGroup ? 'group' : ((prev.orgType as OrgType) || 'company'));
  const [legalName, setLegalName] = useState(prev.legalName ?? '');
  const [registrationNo, setRegistrationNo] = useState(prev.registrationNo ?? '');
  const [contactName, setContactName] = useState(prev.contactName ?? '');
  const [contactPhone, setContactPhone] = useState(prev.contactPhone ?? '');
  const [activityUrl, setActivityUrl] = useState(prev.activityUrl ?? '');
  const [email, setEmail] = useState(prev.email ?? '');
  const [sending, setSending] = useState(false);

  const isSole = orgType === 'sole';
  const mailBlocked = !!email.trim() && isPersonalEmailDomain(email) && !personalEmailAllowed(orgType);
  const ready = !!legalName.trim() && !!contactName.trim() && isLikelyEmail(email) && !mailBlocked
    && (!isSole || registrationNo.length === BIZ_NO_LENGTH)
    && (!isGroup || !!activityUrl.trim());

  const onSend = async () => {
    if (!ready) return;
    try {
      setSending(true);
      await requestOrgLoginCode(email);
      router.push({
        pathname: '/org/verify',
        params: { mode: 'signup', email: email.trim().toLowerCase(), orgType, legalName, registrationNo, contactName, contactPhone, activityUrl },
      } as any);
    } catch (e: any) {
      Alert.alert('코드를 보내지 못했어요', e?.message ?? String(e));
    } finally {
      setSending(false);
    }
  };

  const mailLabel = isGroup || isSole ? '대표 메일' : '조직 메일';
  const mailHint = mailBlocked
    ? '개인 메일(gmail·naver 등)은 개인사업자·모임만 쓸 수 있어요. 조직 메일을 넣거나 유형을 확인해 주세요.'
    : isGroup || isSole
      ? '이 메일로 로그인 코드와 운영팀 확인 연락이 가요. 개인 메일도 괜찮아요.'
      : '이 메일로 로그인 코드가 와요. 담당자가 바뀌어도 계정이 남도록 부서 공용 메일을 권해요.';

  return (
    <Screen backgroundColor={colors.bg}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={12}><ChevronLeft size={24} color={colors.ink} /></Pressable>
          <Text style={styles.headerTitle}>{isGroup ? '모임으로 시작하기' : '조직으로 시작하기'}</Text>
          <View style={{ width: 24 }} />
        </View>
        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          <Text style={styles.lead}>
            {isGroup
              ? '밴드·카페·오픈톡처럼 함께하는 모임이, 참여 코드를 아는 회원끼리만 하다를 여는 계정이에요.\n운영팀이 확인하면 모임 주최자로 열려요.'
              : '기업·기관·단체가 구성원이나 시민과 함께할 하다를 여는 계정이에요.\n운영팀이 확인하면 공식 주최자로 열려요.'}
          </Text>

          {!isGroup && (
            <View style={styles.chips}>
              {ORG_TYPES.map(o => (
                <Pressable key={o.v} style={[styles.chip, orgType === o.v && styles.chipOn]} onPress={() => setOrgType(o.v)}>
                  <Text style={[styles.chipText, orgType === o.v && styles.chipTextOn]}>{o.label}</Text>
                </Pressable>
              ))}
            </View>
          )}

          <OrgField label={isGroup ? '모임 이름' : '조직 이름'} value={legalName} onChangeText={setLegalName} maxLength={100}
            placeholder={isGroup ? '예: 청주 당뇨 함께걷기 카페' : '예: 청주시 보건소'} hint="앱에 주최자 이름으로 보여요." />

          {isGroup ? (
            <OrgField label="활동 중인 모임 주소" value={activityUrl} onChangeText={setActivityUrl}
              placeholder="https://band.us/… · cafe.naver.com/… · 오픈톡 링크" autoCapitalize="none" autoCorrect={false} keyboardType="url"
              hint="운영팀이 실제로 활동하는 모임인지 확인하는 데만 써요." />
          ) : (
            // 번호 칸은 숫자만 받는다 — 하이픈을 넣어도 자동으로 빠진다
            <OrgField label={isSole ? '사업자등록번호' : '사업자등록번호 · 고유번호'} value={registrationNo}
              onChangeText={t => setRegistrationNo(t.replace(/\D/g, ''))} placeholder="1234567890" keyboardType="number-pad" maxLength={13}
              hint={isSole ? '- 없이 숫자 10자리를 입력하세요. (필수)' : '- 없이 숫자만 입력하세요. 없으면 비워 두세요.'} />
          )}

          <OrgField label={isGroup ? '모임장 이름' : '담당자 이름'} value={contactName} onChangeText={setContactName} placeholder="홍길동" maxLength={50} />
          <OrgField label={isGroup ? '모임장 연락처 (선택)' : '담당자 연락처 (선택)'} value={contactPhone}
            onChangeText={t => setContactPhone(t.replace(/\D/g, ''))} placeholder="01012345678" keyboardType="number-pad" maxLength={11}
            hint="- 없이 숫자만 입력하세요. 운영팀이 확인 연락할 때만 써요." />
          <OrgField label={mailLabel} value={email} onChangeText={setEmail} placeholder={isGroup || isSole ? 'name@naver.com' : 'walk@company.co.kr'}
            autoCapitalize="none" autoCorrect={false} keyboardType="email-address" hint={mailHint} />

          <Button label="코드 받기" onPress={onSend} disabled={!ready} loading={sending} block size="xl" />

          <Pressable style={styles.linkRow} onPress={() => router.replace('/org/login' as any)}>
            <Text style={styles.link}>이미 계정이 있어요 · 메일로 로그인</Text>
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
