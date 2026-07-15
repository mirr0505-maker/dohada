// 🚀 하다 시작 안내 모달 — create.tsx 마운트 시 노출. "7일 동안 보지 않기" 체크 시 숨김.
//   숨김 판단은 이 컴포넌트가 자체적으로(SecureStore) 한다 (props 없음).
import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, Modal, ScrollView, StyleSheet } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { Check } from 'lucide-react-native';
import { colors, fontFamily, fontSize, fontWeight, radius } from '@/lib/tokens';
import { haptic } from '@/lib/haptics';

// 숨김 만료 시각(ISO 문자열)을 저장. 키는 영숫자·. -_ 만 허용.
const HIDE_KEY = 'create_guide_hidden_until';
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

// 이렇게 만들어요 — 3줄
const HOW_LINES = [
  '무엇을, 어떤 분야인지 정하고',
  '누구와 함께할지 고르고',
  '얼마 동안, 어떻게 인증할지 정하면 끝나요.',
];

// 세 갈래의 하다
const BRANCHES = [
  { label: '🏠 내 하다', text: '혼자 조용히, 또는 지인의 응원을 받으며. 나에게 집중하는 하다예요.' },
  { label: '🤝 우리 하다', text: '아는 사람과 함께, 혹은 누구나 합류해 서로를 목격해요.' },
  { label: '⭐ 특별 하다', text: '유명인과 공식 기관이 이끄는 무대예요.' },
];

// 기억해주세요 — 3줄
const REMEMBER_LINES = [
  '완주한 하다의 박제는 지워지지 않아요. 함께한 사람들의 기록이니까요.',
  '여기엔 좋아요도, 줄 세우기도 없어요. 숫자보다 한 걸음을요.',
  '모든 글은 조용히 검수돼요. 서로를 지키기 위해서예요.',
];

export function CreateGuideModal() {
  const [visible, setVisible] = useState(false);
  const [dontShow, setDontShow] = useState(false);

  useEffect(() => {
    SecureStore.getItemAsync(HIDE_KEY)
      .then(saved => {
        // 저장값 없음 → 노출. 있으면 파싱해 만료 시각 이후일 때만 노출.
        if (!saved) { setVisible(true); return; }
        const until = Date.parse(saved);
        if (Number.isNaN(until) || Date.now() >= until) setVisible(true);
      })
      .catch(() => setVisible(true));   // 읽기 실패해도 안내는 보여준다
  }, []);

  const close = () => {
    haptic.tap();
    setVisible(false);
    // 체크된 상태로 닫으면 지금+7일을 숨김 만료로 저장. 아니면 저장 안 함(다음 진입 때 또 노출).
    if (dontShow) {
      const until = new Date(Date.now() + SEVEN_DAYS_MS).toISOString();
      SecureStore.setItemAsync(HIDE_KEY, until).catch(() => {});
    }
  };

  const toggleDontShow = () => {
    haptic.tap();
    setDontShow(v => !v);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={close}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.title}>하다를 시작하기 전에</Text>

          <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
            <Text style={styles.intro}>
              하다는 '더 잘하려는' 곳이 아니에요. 되어가는 과정을 조용히 남기고, 서로 목격해주는 곳이에요.
            </Text>

            <Text style={styles.sectionTitle}>이렇게 만들어요</Text>
            {HOW_LINES.map((line, i) => (
              <View key={i} style={styles.lineRow}>
                <Text style={styles.dot}>·</Text>
                <Text style={styles.lineText}>{line}</Text>
              </View>
            ))}

            <Text style={styles.sectionTitle}>세 갈래의 하다</Text>
            {BRANCHES.map((b, i) => (
              <View key={i} style={styles.branchRow}>
                <Text style={styles.branchLabel}>{b.label}</Text>
                <Text style={styles.branchText}>{b.text}</Text>
              </View>
            ))}

            {/* 특별 하다 강조 박스 — 이 문단이 핵심 */}
            <View style={styles.specialBox}>
              <Text style={styles.specialText}>
                언젠가 당신이 좋아하는 사람이 '나와 함께 100일 달려요' 하고 문을 열 수도 있어요. 기업이나 공공기관이 '우리 함께 지구를 지켜요' 하고 손 내밀 수도 있고요.
              </Text>
              <Text style={styles.specialText}>
                특별 하다는 아무나 만들 수 없어요 — 유명인은 누구나 합류 하다에 1,000명이 모이면 그 사람에게 조용히 칭호가 붙고(아바타에 금빛 테두리가 생겨요), 공식은 운영팀 확인을 거쳐 열려요.
              </Text>
              <Text style={styles.specialText}>
                그래서 특별 하다는 '만드는 것'이 아니라 '자라나는 것'이에요.
              </Text>
            </View>

            <Text style={styles.sectionTitle}>기억해주세요</Text>
            {REMEMBER_LINES.map((line, i) => (
              <View key={i} style={styles.lineRow}>
                <Text style={styles.dot}>·</Text>
                <Text style={styles.lineText}>{line}</Text>
              </View>
            ))}
          </ScrollView>

          {/* 7일 동안 보지 않기 체크박스 (라이브러리 없이 Pressable + 박스) */}
          <Pressable style={styles.checkRow} onPress={toggleDontShow} accessibilityRole="checkbox" accessibilityState={{ checked: dontShow }}>
            <View style={[styles.checkBox, dontShow && styles.checkBoxOn]}>
              {dontShow && <Check size={14} color={colors.surface} strokeWidth={3} />}
            </View>
            <Text style={styles.checkText}>7일 동안 보지 않기</Text>
          </Pressable>

          <Pressable style={styles.btn} onPress={close} accessibilityRole="button">
            <Text style={styles.btnText}>좋아요, 시작할게요</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: colors.surface,
    borderRadius: radius['2xl'],
    padding: 22,
    gap: 14,
  },
  title: { fontSize: fontSize.xl, color: colors.ink, fontFamily: fontFamily.bold, fontWeight: fontWeight.bold },
  body: { maxHeight: 360 },
  intro: { fontSize: fontSize.base, color: colors.sub, fontFamily: fontFamily.regular, lineHeight: 22 },
  sectionTitle: {
    fontSize: fontSize.base,
    color: colors.ink,
    fontFamily: fontFamily.bold,
    fontWeight: fontWeight.bold,
    marginTop: 18,
    marginBottom: 8,
  },
  lineRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  dot: { fontSize: fontSize.base, color: colors.brand, fontFamily: fontFamily.bold, lineHeight: 22 },
  lineText: { flex: 1, fontSize: fontSize.base, color: colors.ink, fontFamily: fontFamily.regular, lineHeight: 22 },
  branchRow: { marginBottom: 10 },
  branchLabel: { fontSize: fontSize.base, color: colors.ink, fontFamily: fontFamily.bold, fontWeight: fontWeight.bold, marginBottom: 2 },
  branchText: { fontSize: fontSize.sm, color: colors.sub, fontFamily: fontFamily.regular, lineHeight: 20 },
  specialBox: {
    marginTop: 12,
    backgroundColor: colors.accent50,
    borderRadius: radius.lg,
    padding: 14,
    gap: 10,
  },
  specialText: { fontSize: fontSize.sm, color: colors.sub, fontFamily: fontFamily.regular, lineHeight: 20 },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  checkBox: {
    width: 22,
    height: 22,
    borderRadius: radius.sm,
    borderWidth: 1.5,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  checkBoxOn: { backgroundColor: colors.brand, borderColor: colors.brand },
  checkText: { fontSize: fontSize.sm, color: colors.sub, fontFamily: fontFamily.regular },
  btn: {
    backgroundColor: colors.brand,
    borderRadius: radius.pill,
    paddingVertical: 14,
    alignItems: 'center',
  },
  btnText: { fontSize: fontSize.base, color: colors.surface, fontFamily: fontFamily.bold, fontWeight: fontWeight.bold },
});
