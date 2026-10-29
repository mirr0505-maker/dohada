// 🚀 주최자 명단 — 조직·모임 주최자(role='host')만 보는 성공·완주 명단 (ORG_HADA_PLAN §10.4 묶음 C)
//   사은품은 주최측이 오프라인에서 직접 준다 → 이 명단(닉네임)으로 대상을 확인하고,
//   참가자는 현장에서 자기 앱을 열어 보여 준다. 실명·사번은 수집하지 않는다.
//   참가자끼리 보는 화면이 아니라 운영 화면이라 비교 압박 금지와 충돌하지 않는다. 정렬은 가입 순 그대로.
import React, { useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { ChevronDown, ChevronUp } from 'lucide-react-native';
import { rosterGroups } from '@/lib/stats';
import type { MemberPause, RosterGroupKey } from '@/lib/stats';
import type { DbChallenge, MemberWithToday, ProofWithRelations } from '@/lib/types';
import { formatCheerCount } from '@/lib/format';
import { colors, fontFamily, fontSize, fontWeight, radius } from '@/lib/tokens';

const GROUP_META: { key: RosterGroupKey; label: string; desc: string }[] = [
  { key: 'success',     label: '🏆 성공',      desc: '목표를 채웠어요' },
  { key: 'finished',    label: '🏁 완주',      desc: '끝까지 갔지만 목표엔 조금 못 미쳤어요' },
  { key: 'inProgress',  label: '🏃 진행 중',   desc: '아직 걷는 중이에요' },
  { key: 'notFinished', label: '🕊️ 끝까지 못 감', desc: '포기했거나 인증이 없어요' },
];

type Props = { challenge: DbChallenge; members: MemberWithToday[]; proofs: ProofWithRelations[]; pauses: MemberPause[] };

export function RosterSection({ challenge, members, proofs, pauses }: Props) {
  const [open, setOpen] = useState(false);
  const groups = useMemo(() => rosterGroups(challenge, members, proofs, pauses), [challenge, members, proofs, pauses]);
  const total = GROUP_META.reduce((n, g) => n + groups[g.key].length, 0);

  return (
    <View style={styles.card}>
      <Pressable style={styles.header} onPress={() => setOpen(o => !o)} hitSlop={6}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={styles.title}>성공·완주 명단</Text>
          <Text style={styles.summary}>
            참여 {formatCheerCount(total)}명 · 성공 {formatCheerCount(groups.success.length)} · 완주 {formatCheerCount(groups.finished.length)}
          </Text>
        </View>
        {open ? <ChevronUp size={18} color={colors.sub} /> : <ChevronDown size={18} color={colors.sub} />}
      </Pressable>

      {open && (
        <View style={{ gap: 14, marginTop: 12 }}>
          <Text style={styles.note}>주최자에게만 보여요. 사은품은 참가자가 앱을 열어 보여 주면 이 명단과 맞춰 확인해 주세요.</Text>
          {GROUP_META.filter(g => groups[g.key].length > 0).map(g => (
            <View key={g.key} style={{ gap: 6 }}>
              <Text style={styles.groupLabel}>{g.label} {groups[g.key].length}명 <Text style={styles.groupDesc}>· {g.desc}</Text></Text>
              {groups[g.key].map(({ member, proofCount }) => (
                <View key={member.id} style={styles.row}>
                  <Text style={styles.nick} numberOfLines={1}>{member.nickname}</Text>
                  <Text style={styles.meta}>인증 {proofCount} · {member.joined_at.slice(5, 10).replace('-', '.')} 합류</Text>
                </View>
              ))}
            </View>
          ))}
          {total === 0 && <Text style={styles.note}>아직 합류한 사람이 없어요.</Text>}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, padding: 16, marginBottom: 12 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontSize: fontSize.base, color: colors.ink, fontFamily: fontFamily.bold, fontWeight: fontWeight.bold },
  summary: { fontSize: fontSize.sm, color: colors.sub, fontFamily: fontFamily.regular },
  note: { fontSize: fontSize.xs, color: colors.faint, fontFamily: fontFamily.regular, lineHeight: 18 },
  groupLabel: { fontSize: fontSize.sm, color: colors.ink, fontFamily: fontFamily.bold, fontWeight: fontWeight.bold },
  groupDesc: { fontSize: fontSize.xs, color: colors.faint, fontFamily: fontFamily.regular, fontWeight: fontWeight.regular },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 6, borderTopWidth: 1, borderTopColor: colors.lineSoft },
  nick: { flex: 1, fontSize: fontSize.sm, color: colors.ink, fontFamily: fontFamily.medium, fontWeight: fontWeight.medium },
  meta: { fontSize: fontSize.xs, color: colors.sub, fontFamily: fontFamily.regular },
});
