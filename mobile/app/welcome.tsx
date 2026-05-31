// 🚀 환영 화면 — 가입 직후 약관 동의. (MVP: 휴대폰 인증 없음)
import React, { useState } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { Screen } from '@/components/Screen';
import { Button } from '@/components/Button';
import { colors, fontFamily, fontSize, fontWeight, radius } from '@/lib/tokens';

type Term = 'age' | 'service' | 'privacy' | 'marketing';
const REQUIRED: Term[] = ['age', 'service', 'privacy'];

export default function WelcomeScreen() {
  const [agreed, setAgreed] = useState<Record<Term, boolean>>({
    age: false,
    service: false,
    privacy: false,
    marketing: false,
  });

  const allOn = (Object.keys(agreed) as Term[]).every(k => agreed[k]);
  const requiredOk = REQUIRED.every(k => agreed[k]);

  const toggle = (k: Term) => setAgreed(prev => ({ ...prev, [k]: !prev[k] }));
  const toggleAll = () => {
    const next = !allOn;
    setAgreed({ age: next, service: next, privacy: next, marketing: next });
  };

  const goMain = () => router.replace('/home');

  return (
    <Screen backgroundColor={colors.background}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.emoji}>🎉</Text>
        <Text style={styles.title}>
          환영합니다,{'\n'}
          <Text style={styles.accent}>도전자</Text>님!
        </Text>
        <Text style={styles.sub}>비교에 지친 SNS 와 작별,{'\n'}오늘도 한 걸음 나아가는 곳</Text>

        {/* 슬로건 카드 */}
        <View style={styles.sloganCard}>
          <Text style={styles.sloganTitle}>더 나은 나, 더 나은 세상</Text>
          <Text style={styles.sloganDesc}>나의 도전이 나와 세상을 바꾼다</Text>
        </View>

        {/* 약관 동의 */}
        <View style={styles.termsBlock}>
          <TermRow checked={allOn} label="전체 동의" bold onPress={toggleAll} />
          <View style={styles.divider} />
          <TermRow
            checked={agreed.age}
            label="만 14세 이상입니다"
            required
            onPress={() => toggle('age')}
          />
          <TermRow
            checked={agreed.service}
            label="서비스 이용약관"
            required
            link
            onPress={() => toggle('service')}
          />
          <TermRow
            checked={agreed.privacy}
            label="개인정보 처리방침"
            required
            link
            onPress={() => toggle('privacy')}
          />
          <TermRow
            checked={agreed.marketing}
            label="마케팅 정보 수신"
            link
            onPress={() => toggle('marketing')}
          />
        </View>

        {/* 액션 */}
        <Button
          label="시작하기"
          size="xl"
          block
          disabled={!requiredOk}
          onPress={goMain}
        />
      </ScrollView>
    </Screen>
  );
}

function TermRow({
  checked,
  label,
  required = false,
  link = false,
  bold = false,
  onPress,
}: {
  checked: boolean;
  label: string;
  required?: boolean;
  link?: boolean;
  bold?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable style={styles.termRow} onPress={onPress}>
      <View style={[styles.checkbox, checked && styles.checkboxOn]}>
        {checked && <Text style={styles.checkmark}>✓</Text>}
      </View>
      <Text style={[styles.termText, bold && styles.termTextBold]}>
        {required ? <Text style={styles.required}>[필수] </Text> : <Text style={styles.optional}>[선택] </Text>}
        {label}
        {link && <Text style={styles.link}>  보기</Text>}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  scroll: {
    paddingHorizontal: 24,
    paddingVertical: 24,
    gap: 16,
  },
  emoji: {
    fontSize: 72,
    textAlign: 'center',
    marginTop: 16,
  },
  title: {
    fontSize: fontSize['4xl'],
    color: colors.primary,
    fontFamily: fontFamily.bold,
    fontWeight: fontWeight.extrabold,
    textAlign: 'center',
    letterSpacing: -0.8,
    lineHeight: 38,
  },
  accent: { color: colors.accent },
  sub: {
    fontSize: fontSize.base,
    color: colors.primary500,
    fontFamily: fontFamily.regular,
    textAlign: 'center',
  },
  sloganCard: {
    padding: 16,
    backgroundColor: colors.accent50,
    borderRadius: radius.lg,
    alignItems: 'center',
    gap: 4,
  },
  sloganTitle: {
    fontSize: fontSize.base,
    fontFamily: fontFamily.bold,
    fontWeight: fontWeight.bold,
    color: colors.accent700,
    letterSpacing: -0.3,
  },
  sloganDesc: {
    fontSize: fontSize.xs,
    color: colors.primary500,
    fontFamily: fontFamily.regular,
  },
  termsBlock: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    paddingVertical: 8,
    paddingHorizontal: 16,
    gap: 4,
    borderWidth: 1,
    borderColor: colors.primary100,
  },
  termRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: colors.primary300,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxOn: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  checkmark: {
    color: colors.surface,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
  },
  termText: {
    flex: 1,
    fontSize: fontSize.base,
    color: colors.primary,
    fontFamily: fontFamily.regular,
  },
  termTextBold: {
    fontWeight: fontWeight.bold,
    fontFamily: fontFamily.bold,
  },
  required: { color: colors.accent, fontWeight: fontWeight.semibold },
  optional: { color: colors.primary500 },
  link: { color: colors.primary500, textDecorationLine: 'underline' },
  divider: { height: 1, backgroundColor: colors.primary100 },
});
