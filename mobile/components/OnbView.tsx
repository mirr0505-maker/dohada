// 🚀 온보딩 공통 뷰 — onb1~4 가 동일 구조라 step 만 받아서 렌더
import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { Screen } from '@/components/Screen';
import { Button } from '@/components/Button';
import { colors, fontFamily, fontSize, fontWeight } from '@/lib/tokens';

// 온보딩 카피 — 프로토타입 do-hada-app-v4.html onb1~4 그대로
const SLIDES = [
  {
    illust: '🔥',
    title: '혼자가 아닌',
    accent: '함께 도전해요',
    desc: '작심삼일이 작심백일이 되는 마법.\n동료들과 함께면 다르게 끝나요.',
    next: '/onb2',
    nextLabel: '다음 →',
  },
  {
    illust: '📸',
    title: '매일 인증하고',
    accent: '응원받아요',
    desc: '카메라로 직접 촬영. 거짓 없는 진짜 도전.\n동료들의 응원이 힘이 됩니다.',
    next: '/onb3',
    nextLabel: '다음 →',
  },
  {
    illust: '🤝',
    title: '친구 신청 없이도',
    accent: '동료가 자연스럽게',
    desc: '같은 도전을 가는 사람이 자동으로 모여요.\n신청도, 수락도, 어색함도 없이.',
    next: '/onb4',
    nextLabel: '다음 →',
  },
  {
    illust: '🌍',
    title: '나의 도전이',
    accent: '세상도 바꿔요',
    desc: '환경, 기부, 봉사 — 사회공헌 카테고리로\n내가 나아질수록 세상도 함께 나아져요.',
    next: '/login',
    nextLabel: '시작하기 →',
  },
] as const;

type Props = { step: 1 | 2 | 3 | 4 };

export function OnbView({ step }: Props) {
  const idx = step - 1;
  const slide = SLIDES[idx];

  return (
    <Screen backgroundColor={colors.background}>
      {/* 좌상단: 정체성 마크 (모든 슬라이드 공통) */}
      <View style={styles.brand}>
        <Text style={styles.brandMark}>( ⊙ )</Text>
        <Text style={styles.brandLabel}>Do : 하다</Text>
      </View>

      {/* 우상단: 건너뛰기 (마지막 화면엔 없음) */}
      {step < 4 && (
        <Pressable style={styles.skip} onPress={() => router.replace('/login')}>
          <Text style={styles.skipText}>건너뛰기</Text>
        </Pressable>
      )}

      <View style={styles.content}>
        <Text style={styles.illust}>{slide.illust}</Text>
        <Text style={styles.title}>
          {slide.title}
          {'\n'}
          <Text style={styles.accent}>{slide.accent}</Text>
        </Text>
        <Text style={styles.desc}>{slide.desc}</Text>
      </View>

      <View style={styles.bottom}>
        <View style={styles.dots}>
          {[0, 1, 2, 3].map(i => (
            <View
              key={i}
              style={[
                styles.dot,
                i === idx ? styles.dotActive : null,
              ]}
            />
          ))}
        </View>
        <Button
          label={slide.nextLabel}
          size="xl"
          block
          onPress={() =>
            step === 4 ? router.replace('/login') : router.push(slide.next)
          }
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  brand: {
    position: 'absolute',
    top: 16,
    left: 20,
    zIndex: 10,
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
    paddingVertical: 8,
  },
  brandMark: {
    fontSize: fontSize.base,
    color: colors.accent,
    fontFamily: fontFamily.bold,
    fontWeight: fontWeight.bold,
    letterSpacing: 0.5,
  },
  brandLabel: {
    fontSize: fontSize.sm,
    color: colors.primary500,
    fontFamily: fontFamily.medium,
    fontWeight: fontWeight.medium,
  },
  skip: {
    position: 'absolute',
    top: 16,
    right: 20,
    zIndex: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  skipText: {
    fontSize: fontSize.base,
    color: colors.primary500,
    fontFamily: fontFamily.medium,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 24,
  },
  illust: {
    fontSize: 96,
    marginBottom: 8,
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
  accent: {
    color: colors.accent,
  },
  desc: {
    fontSize: fontSize.lg,
    color: colors.primary500,
    fontFamily: fontFamily.regular,
    textAlign: 'center',
    lineHeight: 24,
  },
  bottom: {
    paddingHorizontal: 24,
    paddingBottom: 32,
    gap: 24,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary100,
  },
  dotActive: {
    width: 24,
    backgroundColor: colors.accent,
  },
});
