// 🚀 조직 메일 찾기 — 사업자·고유번호로 가입한 조직 메일을 (가려서) 알려 준다 (0088)
//   전체 메일은 서버가 돌려주지 않는다 — 번호는 공개 정보라 메일 수집에 악용될 수 있다.
import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet, Alert, KeyboardAvoidingView, Platform, Linking } from 'react-native';
import { router } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { Screen } from '@/components/Screen';
import { Button } from '@/components/Button';
import { OrgField } from '@/components/org/OrgField';
import { findOrgLoginEmail } from '@/lib/org';
import type { FoundOrgEmail } from '@/lib/org';
import { SUPPORT_EMAIL } from '@/lib/support';
import { colors, fontFamily, fontSize, fontWeight, radius } from '@/lib/tokens';

export default function OrgFindEmailScreen() {
  const [regNo, setRegNo] = useState('');
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<FoundOrgEmail[] | null>(null);   // null = 아직 안 찾음

  const onFind = async () => {
    try {
      setBusy(true);
      setResults(await findOrgLoginEmail(regNo));
    } catch (e: any) {
      Alert.alert('찾지 못했어요', e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen backgroundColor={colors.bg}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={12}><ChevronLeft size={24} color={colors.ink} /></Pressable>
          <Text style={styles.headerTitle}>조직 메일 찾기</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.body}>
          <OrgField label="사업자등록번호 · 고유번호" value={regNo} onChangeText={t => { setRegNo(t); setResults(null); }}
            keyboardType="numbers-and-punctuation" autoFocus
            hint="가입할 때 넣은 번호예요. 하이픈은 있어도 없어도 돼요." />
          <Button label="찾기" onPress={onFind} disabled={regNo.replace(/\D/g, '').length < 5} loading={busy} block size="xl" />

          {results && results.length > 0 && (
            <View style={styles.resultBox}>
              <Text style={styles.resultLead}>이 번호로 가입한 조직 메일이에요</Text>
              {results.map((r, i) => (
                <View key={i} style={styles.resultRow}>
                  <Text style={styles.resultOrg}>{r.legal_name}</Text>
                  <Text style={styles.resultMail}>{r.masked_email}</Text>
                </View>
              ))}
              <Text style={styles.resultHint}>개인정보 보호를 위해 일부를 가렸어요.</Text>
              <Button label="이 메일로 로그인하기" onPress={() => router.back()} variant="outline" block size="lg" />
            </View>
          )}

          {results && results.length === 0 && (
            <View style={styles.resultBox}>
              <Text style={styles.resultLead}>이 번호로 가입한 조직이 없어요</Text>
              <Text style={styles.resultHint}>번호 없이 가입했다면 운영팀이 확인해 드려요.</Text>
              <Button label="운영팀에 문의" variant="ghost" block size="md"
                onPress={() => Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent('[Do:하다] 조직 메일 찾기')}`)} />
            </View>
          )}
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  headerTitle: { fontSize: fontSize.lg, color: colors.ink, fontFamily: fontFamily.bold, fontWeight: fontWeight.bold },
  body: { paddingHorizontal: 20, paddingTop: 12, gap: 18 },
  resultBox: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, padding: 16, gap: 10 },
  resultLead: { fontSize: fontSize.sm, color: colors.ink, fontFamily: fontFamily.bold, fontWeight: fontWeight.bold },
  resultRow: { gap: 2 },
  resultOrg: { fontSize: fontSize.xs, color: colors.sub, fontFamily: fontFamily.regular },
  resultMail: { fontSize: fontSize.lg, color: colors.ink, fontFamily: fontFamily.bold, fontWeight: fontWeight.bold },
  resultHint: { fontSize: fontSize.xs, color: colors.faint, fontFamily: fontFamily.regular },
});
