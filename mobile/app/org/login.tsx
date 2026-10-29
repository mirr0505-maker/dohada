// 🚀 조직 로그인 — 이미 가입한 조직 계정이 메일로 코드를 받아 들어온다 (0087)
import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { router } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { Screen } from '@/components/Screen';
import { Button } from '@/components/Button';
import { OrgField } from '@/components/org/OrgField';
import { requestOrgLoginCode } from '@/lib/auth';
import { isLikelyEmail, isPersonalEmailDomain } from '@/lib/orgEmail';
import { colors, fontFamily, fontSize, fontWeight } from '@/lib/tokens';

export default function OrgLoginScreen() {
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);
  const personalMail = !!email.trim() && isPersonalEmailDomain(email);

  const onSend = async () => {
    try {
      setSending(true);
      await requestOrgLoginCode(email);
      router.push({ pathname: '/org/verify', params: { mode: 'login', email: email.trim().toLowerCase() } } as any);
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
          <Text style={styles.headerTitle}>조직 로그인</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.body}>
          <OrgField label="조직 메일" value={email} onChangeText={setEmail} placeholder="walk@company.co.kr"
            autoCapitalize="none" autoCorrect={false} keyboardType="email-address" autoFocus
            hint={personalMail ? '개인 메일은 조직 계정이 아니에요. 처음 화면에서 Google·Apple 로 시작해 주세요.' : '가입할 때 쓴 조직 메일로 코드를 보내요.'} />
          <Button label="코드 받기" onPress={onSend} disabled={!isLikelyEmail(email) || personalMail} loading={sending} block size="xl" />
          <Pressable style={styles.linkRow} onPress={() => router.push('/org/find-email' as any)}>
            <Text style={styles.subLink}>조직 메일이 기억나지 않아요</Text>
          </Pressable>
          <Pressable style={styles.linkRow} onPress={() => router.replace('/org/signup' as any)}>
            <Text style={styles.link}>처음이에요 · 조직 가입하기</Text>
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
  linkRow: { alignItems: 'center', paddingVertical: 8 },
  link: { fontSize: fontSize.sm, color: colors.brandInk, fontFamily: fontFamily.bold, fontWeight: fontWeight.bold },
  subLink: { fontSize: fontSize.sm, color: colors.sub, fontFamily: fontFamily.medium, fontWeight: fontWeight.medium, textDecorationLine: 'underline' },
});
