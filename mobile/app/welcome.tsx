// 🚀 환영 화면 — 가입 직후. 약관 동의 + 휴대폰 인증 안내.
// 프로토타입 screen-welcome 그대로. 단, 휴대폰 인증/내기/명사챌린지는 Phase 2 라서
// UI 만 보여주고 실제 기능은 동작하지 않는다.
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
        <Text style={styles.sub}>시작하기 전 잠시 안내드릴게요</Text>

        {/* 슬로건 카드 */}
        <View style={styles.sloganCard}>
          <Text style={styles.sloganTitle}>더 나은 나, 더 나은 세상</Text>
          <Text style={styles.sloganDesc}>나의 도전이 나와 세상을 바꾼다</Text>
        </View>

        {/* 핵심 기능 안내 (Phase 2 기능들 — UI 만) */}
        <View style={styles.featureCard}>
          <Text style={styles.featureCardTitle}>📱 휴대폰 인증이 필요한 기능</Text>
          <Feature emoji="🤝" title="도전 동료 찾기" desc="연락처 매칭으로 지인 만나기" />
          <Feature emoji="💰" title="내기 챌린지" desc="진짜 동기부여를 더한 도전" />
          <Feature emoji="🎁" title="선물 응원 / 결제" desc="동료에게 응원 선물 보내기" />
          <Feature emoji="⭐" title="명사 챌린지 참여" desc="유명인과 함께 도전" />
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
        <View style={{ gap: 8 }}>
          <Button
            label="휴대폰 인증하기"
            size="lg"
            block
            disabled={!requiredOk}
            onPress={goMain}
          />
          <Pressable style={styles.skipBtn} onPress={goMain} disabled={!requiredOk}>
            <Text style={[styles.skipText, !requiredOk && { opacity: 0.5 }]}>
              나중에 인증할게요
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </Screen>
  );
}

function Feature({ emoji, title, desc }: { emoji: string; title: string; desc: string }) {
  return (
    <View style={styles.featureItem}>
      <Text style={styles.featureEmoji}>{emoji}</Text>
      <View style={{ flex: 1 }}>
        <Text style={styles.featureTitle}>{title}</Text>
        <Text style={styles.featureDesc}>{desc}</Text>
      </View>
    </View>
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
  featureCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: colors.primary100,
  },
  featureCardTitle: {
    fontSize: fontSize.base,
    color: colors.primary,
    fontFamily: fontFamily.bold,
    fontWeight: fontWeight.bold,
    marginBottom: 4,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  featureEmoji: { fontSize: 22 },
  featureTitle: {
    fontSize: fontSize.base,
    color: colors.primary,
    fontFamily: fontFamily.medium,
    fontWeight: fontWeight.semibold,
  },
  featureDesc: {
    fontSize: fontSize.sm,
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
  skipBtn: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  skipText: {
    fontSize: fontSize.base,
    color: colors.primary500,
    fontFamily: fontFamily.medium,
  },
});
