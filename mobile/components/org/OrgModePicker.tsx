// 🚀 조직 하다 모드 선택 — 하다 만들기(create.tsx ?org=1)의 방 타입 스텝 대체 (ORG_HADA_PLAN §10.2 A-6)
//   누구나 합류 = open (광장 노출·누구나 합류)
//   구성원 전용 = closed (광장 노출·참여 코드 있어야 합류) — 묶음 B 에서 열린다
import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Globe, Lock, Check } from 'lucide-react-native';
import type { ChallengeKind } from '@/lib/types';
import { colors, fontFamily, fontSize, fontWeight, radius } from '@/lib/tokens';

// 묶음 B(0088 — 참여 코드·광장 쇼윈도) 전까지는 구성원 전용을 고를 수 없다
const MEMBER_ONLY_READY = false;

type Props = { value: ChallengeKind; setValue: (v: ChallengeKind) => void };

export function OrgModePicker({ value, setValue }: Props) {
  const card = (kind: ChallengeKind, Icon: typeof Globe, label: string, desc: string, enabled: boolean) => {
    const active = value === kind;
    return (
      <Pressable
        disabled={!enabled}
        style={[styles.option, active && styles.optionActive, !enabled && styles.optionDisabled]}
        onPress={() => setValue(kind)}
      >
        <Icon size={24} color={active ? colors.brandInk : enabled ? colors.sub : colors.faint2} strokeWidth={1.8} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={[styles.title, active && styles.titleActive, !enabled && { color: colors.faint2 }]}>
            {label}{!enabled ? ' · 곧 열려요' : ''}
          </Text>
          <Text style={styles.desc}>{desc}</Text>
        </View>
        {active && <Check size={20} color={colors.brand} strokeWidth={2.4} />}
      </Pressable>
    );
  };

  return (
    <View style={{ gap: 12 }}>
      {card('open', Globe, '누구나 합류', '시민·고객 누구나 광장에서 보고 함께해요', true)}
      {card('closed', Lock, '구성원 전용', '광장엔 보이지만, 참여 코드를 아는 구성원만 합류해요', MEMBER_ONLY_READY)}
      <Text style={styles.note}>완주 사은품이 있다면 아래 안내문에 적어 주세요. 지급은 주최측이 직접 해요.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  option: {
    flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16,
    backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line,
  },
  optionActive: { borderColor: colors.brand, backgroundColor: colors.brandTint },
  optionDisabled: { backgroundColor: colors.primary50 },
  title: { fontSize: fontSize.base, color: colors.ink, fontFamily: fontFamily.bold, fontWeight: fontWeight.bold },
  titleActive: { color: colors.brandInk },
  desc: { fontSize: fontSize.sm, color: colors.sub, fontFamily: fontFamily.regular, lineHeight: 19 },
  note: { fontSize: fontSize.xs, color: colors.sub, fontFamily: fontFamily.regular, lineHeight: 18 },
});
