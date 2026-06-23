// 🚀 다짐 카드 — 현황 탭 상단. 무현금 사회적 스테이크(0046), 멤버 본인의 다짐 표시·관리.
// 정산은 본인 완주/실패 기준 맞춤:
//   진행 중      → 걸어둔 다짐 표시 (거두기 가능)
//   못 하면(lose) + 실패 → "다짐 지킬 시간" + 지켰어요 토글 / + 완주 → 안도(안 지켜도 됨)
//   해내면(win)  + 완주 → "해냈어요! 지킬 시간" + 지켰어요 토글 / + 실패 → 다음 기회에
// 명예제도 — 앱은 표시·기록만, 강제·검증 없음.
import React from 'react';
import { View, Text, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { Heart, Trophy, ArrowDown, Check } from 'lucide-react-native';
import { colors, fontFamily, fontSize, fontWeight, radius, shadow } from '@/lib/tokens';
import type { MyPledge, PledgeDirection } from '@/lib/db';

type Props = {
  pledges: MyPledge[];
  canAdd: boolean;        // 활성 멤버 · 미종료 · 방향 여유 있음
  canManage: boolean;     // 활성 멤버(포기 X) — 지켰어요/거두기 가능
  myCompleted: boolean;   // 본인 완주 (종료 + 목표 달성)
  myFailed: boolean;      // 본인 실패 (종료 + 미달)
  busy: boolean;
  onAdd: () => void;
  onToggleFulfilled: (id: string, next: boolean) => void;
  onDelete: (id: string) => void;
};

function DirTag({ d }: { d: PledgeDirection }) {
  const Icon = d === 'lose' ? ArrowDown : Trophy;
  return (
    <View style={styles.dirTag}>
      <Icon size={11} color={colors.accent700} strokeWidth={2} />
      <Text style={styles.dirTagText}>{d === 'lose' ? '못 하면' : '해내면'}</Text>
    </View>
  );
}

type PledgeState = 'in_progress' | 'not_triggered' | 'to_fulfill' | 'fulfilled';
function pledgeState(p: MyPledge, myCompleted: boolean, myFailed: boolean): PledgeState {
  if (!myCompleted && !myFailed) return 'in_progress';
  const triggered = (p.direction === 'lose' && myFailed) || (p.direction === 'win' && myCompleted);
  if (!triggered) return 'not_triggered';
  return p.fulfilled ? 'fulfilled' : 'to_fulfill';
}

export function PledgeCard(props: Props) {
  const { pledges, canAdd, canManage, myCompleted, myFailed, busy, onAdd, onToggleFulfilled, onDelete } = props;

  // 다짐 없음 → 진입 권유 (없고 걸 수도 없으면 아무것도 안 보임)
  if (pledges.length === 0) {
    if (!canAdd) return null;
    return (
      <View style={styles.card}>
        <View style={styles.headlineRow}>
          <Heart size={16} color={colors.gold} strokeWidth={2} />
          <Text style={styles.headline}>다짐 걸기</Text>
        </View>
        <Text style={styles.body}>도전에 가벼운 약속을 걸어보세요. 못 하면 / 해내면 무엇을 할지 — 돈은 오가지 않아요.</Text>
        <Pressable style={styles.primaryBtn} onPress={onAdd} disabled={busy}>
          <Text style={styles.primaryBtnText}>다짐 걸기</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <View style={styles.headlineRow}>
        <Heart size={16} color={colors.gold} strokeWidth={2} />
        <Text style={styles.headline}>나의 다짐</Text>
      </View>
      {pledges.map(p => {
        const state = pledgeState(p, myCompleted, myFailed);
        return (
          <View key={p.id} style={styles.pledgeRow}>
            <View style={styles.pledgeHead}>
              <DirTag d={p.direction} />
              {state === 'in_progress' && canManage && (
                <Pressable onPress={() => onDelete(p.id)} disabled={busy} hitSlop={6}>
                  <Text style={styles.removeLink}>거두기</Text>
                </Pressable>
              )}
            </View>
            <Text style={[styles.pledgeText, state === 'not_triggered' && styles.pledgeTextMuted]}>
              {p.content}
            </Text>

            {state === 'to_fulfill' && (
              <>
                <Text style={styles.settleNote}>
                  {p.direction === 'win' ? '해냈어요! 다짐을 지킬 시간이에요.' : '이번엔 아쉬웠어요. 다짐을 지킬 시간이에요.'}
                </Text>
                {canManage && (
                  <Pressable
                    style={[styles.fulfillBtn, busy && styles.btnDisabled]}
                    onPress={() => onToggleFulfilled(p.id, true)}
                    disabled={busy}
                  >
                    {busy ? <ActivityIndicator color={colors.done} /> : (
                      <>
                        <Check size={15} color={colors.done} strokeWidth={2.4} />
                        <Text style={styles.fulfillBtnText}>지켰어요</Text>
                      </>
                    )}
                  </Pressable>
                )}
              </>
            )}

            {state === 'fulfilled' && (
              <Pressable
                style={styles.fulfilledRow}
                onPress={() => canManage && !busy && onToggleFulfilled(p.id, false)}
                disabled={!canManage || busy}
              >
                <Check size={15} color={colors.done} strokeWidth={2.4} />
                <Text style={styles.fulfilledText}>지켰어요</Text>
              </Pressable>
            )}

            {state === 'not_triggered' && (
              <Text style={styles.settleNoteMuted}>
                {p.direction === 'lose' ? '완주했으니 이 다짐은 안 지켜도 돼요.' : '이번엔 못 채웠어요 — 다음 기회에.'}
              </Text>
            )}
          </View>
        );
      })}

      {/* 다른 조건도 걸 수 있으면 */}
      {canAdd && (
        <Pressable onPress={onAdd} disabled={busy} hitSlop={6} style={{ alignSelf: 'flex-start' }}>
          <Text style={styles.addLink}>+ 다른 조건도 걸기</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: 16,
    marginBottom: 16,
    gap: 10,
    borderWidth: 1,
    borderColor: colors.accent,
    ...shadow.sm,
  },
  headlineRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  headline: {
    fontSize: fontSize.base,
    color: colors.primary,
    fontFamily: fontFamily.bold,
    fontWeight: fontWeight.bold,
  },
  body: {
    fontSize: fontSize.sm,
    color: colors.primary500,
    fontFamily: fontFamily.regular,
    lineHeight: 20,
  },
  pledgeRow: {
    gap: 4,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: colors.primary50,
  },
  pledgeHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dirTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 2,
    backgroundColor: colors.accent50,
    borderRadius: radius.pill,
  },
  dirTagText: {
    fontSize: fontSize.xs,
    color: colors.accent700,
    fontFamily: fontFamily.bold,
    fontWeight: fontWeight.bold,
  },
  removeLink: {
    fontSize: fontSize.xs,
    color: colors.primary500,
    fontFamily: fontFamily.medium,
    fontWeight: fontWeight.medium,
    textDecorationLine: 'underline',
  },
  pledgeText: {
    fontSize: fontSize.base,
    color: colors.primary,
    fontFamily: fontFamily.medium,
    fontWeight: fontWeight.medium,
    lineHeight: 22,
  },
  pledgeTextMuted: {
    color: colors.primary300,
    textDecorationLine: 'line-through',
  },
  settleNote: {
    fontSize: fontSize.sm,
    color: colors.accent700,
    fontFamily: fontFamily.bold,
    fontWeight: fontWeight.bold,
    marginTop: 2,
  },
  settleNoteMuted: {
    fontSize: fontSize.xs,
    color: colors.primary500,
    fontFamily: fontFamily.regular,
    marginTop: 2,
  },
  fulfillBtn: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    paddingVertical: 11,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: colors.done,
    marginTop: 4,
  },
  fulfillBtnText: {
    fontSize: fontSize.sm,
    color: colors.done,
    fontFamily: fontFamily.bold,
    fontWeight: fontWeight.bold,
  },
  fulfilledRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 },
  fulfilledText: {
    fontSize: fontSize.sm,
    color: colors.done,
    fontFamily: fontFamily.bold,
    fontWeight: fontWeight.bold,
  },
  addLink: {
    fontSize: fontSize.sm,
    color: colors.accent,
    fontFamily: fontFamily.bold,
    fontWeight: fontWeight.bold,
    marginTop: 2,
  },
  primaryBtn: {
    backgroundColor: colors.accent,
    borderRadius: radius.lg,
    paddingVertical: 13,
    alignItems: 'center',
    marginTop: 2,
  },
  primaryBtnText: {
    fontSize: fontSize.base,
    color: colors.surface,
    fontFamily: fontFamily.bold,
    fontWeight: fontWeight.bold,
  },
  btnDisabled: { opacity: 0.5 },
});
