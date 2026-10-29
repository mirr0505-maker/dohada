// 🚀 조직 하다 모드 선택 — 하다 만들기(create.tsx ?org=1)의 방 타입 스텝 대체 (ORG_HADA_PLAN §10.2 A-6)
//   누구나 합류 = open (광장 노출·누구나 합류)
//   구성원 전용 = closed (광장 노출·참여 코드 있어야 합류, 0089)
import React from 'react';
import { View, Text, Pressable, TextInput, StyleSheet } from 'react-native';
import { Globe, Lock, Check } from 'lucide-react-native';
import type { ChallengeKind } from '@/lib/types';
import { colors, fontFamily, fontSize, fontWeight, radius } from '@/lib/tokens';

type Props = {
  value: ChallengeKind; setValue: (v: ChallengeKind) => void;
  joinCode: string; setJoinCode: (v: string) => void;   // 구성원 전용일 때만 쓰인다
};

export function OrgModePicker({ value, setValue, joinCode, setJoinCode }: Props) {
  const card = (kind: ChallengeKind, Icon: typeof Globe, label: string, desc: string) => {
    const active = value === kind;
    return (
      <Pressable
        style={[styles.option, active && styles.optionActive]}
        onPress={() => setValue(kind)}
      >
        <Icon size={24} color={active ? colors.brandInk : colors.sub} strokeWidth={1.8} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={[styles.title, active && styles.titleActive]}>{label}</Text>
          <Text style={styles.desc}>{desc}</Text>
        </View>
        {active && <Check size={20} color={colors.brand} strokeWidth={2.4} />}
      </Pressable>
    );
  };

  return (
    <View style={{ gap: 12 }}>
      {card('open', Globe, '누구나 합류', '시민·고객 누구나 광장에서 보고 함께해요')}
      {card('closed', Lock, '구성원 전용', '광장엔 보이지만, 참여 코드를 아는 구성원만 합류해요')}
      {value === 'closed' && (
        <View style={{ gap: 6 }}>
          <TextInput
            style={styles.codeInput} value={joinCode} placeholder="참여 코드 (영문·숫자 4~12자)"
            placeholderTextColor={colors.faint} autoCapitalize="characters" autoCorrect={false} maxLength={12}
            onChangeText={t => setJoinCode(t.replace(/[^A-Za-z0-9]/g, ''))}
          />
          <Text style={styles.note}>
            사내 공지로 구성원에게만 알려 주세요. 코드는 저장되지 않아 다시 볼 수 없어요 — 잊으면 조직 홈에서 새로 정해요.
          </Text>
        </View>
      )}
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
  title: { fontSize: fontSize.base, color: colors.ink, fontFamily: fontFamily.bold, fontWeight: fontWeight.bold },
  titleActive: { color: colors.brandInk },
  desc: { fontSize: fontSize.sm, color: colors.sub, fontFamily: fontFamily.regular, lineHeight: 19 },
  codeInput: {
    backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line,
    paddingHorizontal: 14, paddingVertical: 12, fontSize: fontSize.base, color: colors.ink, fontFamily: fontFamily.bold, letterSpacing: 2,
  },
  note: { fontSize: fontSize.xs, color: colors.sub, fontFamily: fontFamily.regular, lineHeight: 18 },
});
