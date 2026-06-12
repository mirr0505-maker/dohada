// 🚀 나와의 내기 카드 — 현황 탭 상단. 도전자(개설자) 본인에게만 노출 (gift_orders RLS 가 sender 본인만 조회).
// 한 카드가 3가지 상태를 모두 표현 (진입 → 진행 → 정산):
//   내기 없음(걸 수 있음) → "이 도전, 한잔 걸기"
//   진행 중              → "한잔 걸린 도전 · 완주하면 받아요"
//   정산(완주)           → 한잔 받기 / 기부로 돌리기
//   정산(실패·포기)      → 실패를 인정하고 기부하기  (받기 버튼 없음 = 본전 회수 불가)
//   처리 완료            → 받았어요 / 기부로 돌렸어요
// 정산 행동의 서버 권위는 claim-gift (받기는 완주 확인 시에만). 여기 표시는 UX 용.
import React from 'react';
import { View, Text, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { colors, fontFamily, fontSize, fontWeight, radius, shadow } from '@/lib/tokens';
import { BET_TIERS, type MyBet } from '@/lib/payments';

type Props = {
  bet: MyBet | null;
  canPlace: boolean;             // 내기 없음 + 걸 자격 (도전자·종료 전 등 — 부모가 판정)
  challengerCompleted: boolean;  // 도전자가 완주했는가 (클라 stats.ts 판정, 표시용)
  finished: boolean;             // 챌린지 종료 여부
  iGaveUp: boolean;              // 도전자 본인이 포기했는가
  busy: boolean;
  onPlace: () => void;
  onSettle: (action: 'receive' | 'donate') => void;
};

function tierLabel(productTier: string): string {
  return BET_TIERS.find(t => t.tier === productTier)?.label
    ?? (productTier === 'grand_cup' ? '🎁 거하게 한잔' : productTier === 'hearty_cup' ? '🍰 든든한 한잔' : '☕ 한잔');
}

export function BetCard(props: Props) {
  const { bet, canPlace, challengerCompleted, finished, iGaveUp, busy, onPlace, onSettle } = props;

  // ── 내기 없음 → 진입 ──
  if (!bet) {
    if (!canPlace) return null;
    return (
      <View style={styles.card}>
        <Text style={styles.headline}>🎯 이 도전, 한잔 걸기</Text>
        <Text style={styles.body}>완주하면 본전, 실패를 인정하면 기부돼요. 나 자신과의 약속에 한 잔을 걸어보세요.</Text>
        <Pressable style={styles.primaryBtn} onPress={onPlace} disabled={busy}>
          <Text style={styles.primaryBtnText}>한잔 걸기</Text>
        </Pressable>
      </View>
    );
  }

  const label = tierLabel(bet.product_tier);
  const amountStr = `${bet.amount.toLocaleString()}원`;

  // ── 처리 완료 상태 ──
  if (bet.status === 'issued' || bet.status === 'delivered' || bet.status === 'redeemed') {
    return (
      <View style={styles.card}>
        <Text style={styles.headline}>☕ 완주! 한잔을 받았어요</Text>
        <Text style={styles.body}>{label} · {amountStr} — 끝까지 해낸 나에게 주는 한 잔.</Text>
      </View>
    );
  }
  if (bet.status === 'donated') {
    return (
      <View style={styles.card}>
        <Text style={styles.headline}>💚 한잔을 기부로 돌렸어요</Text>
        <Text style={styles.body}>{label} · {amountStr} — 누군가의 한잔이 됐어요.</Text>
      </View>
    );
  }

  // ── 결제 완료(paid) = 정산 대기 ──
  // 완주 → 받기/기부 선택
  if (challengerCompleted) {
    return (
      <View style={styles.card}>
        <Text style={styles.headline}>🏆 완주! 내기 정산</Text>
        <Text style={styles.body}>{label} · {amountStr} — 본전을 찾았어요. 받을지, 기부로 돌릴지 골라주세요.</Text>
        <Pressable style={[styles.primaryBtn, busy && styles.btnDisabled]} onPress={() => onSettle('receive')} disabled={busy}>
          {busy ? <ActivityIndicator color={colors.surface} /> : <Text style={styles.primaryBtnText}>☕ 한잔 받기</Text>}
        </Pressable>
        <Pressable style={[styles.donateBtn, busy && styles.btnDisabled]} onPress={() => onSettle('donate')} disabled={busy}>
          <Text style={styles.donateBtnText}>💚 기부로 돌리기 — 누군가의 한잔이 돼요</Text>
        </Pressable>
      </View>
    );
  }

  // 종료·포기 → 실패 정산 (받기 없음, 기부만)
  if (finished || iGaveUp) {
    return (
      <View style={styles.card}>
        <Text style={styles.headline}>🎯 내기 정산</Text>
        <Text style={styles.body}>이번엔 완주하지 못했어요. 약속대로 이 한잔은 기부로 마무리해요.</Text>
        <Pressable style={[styles.donateBtn, busy && styles.btnDisabled]} onPress={() => onSettle('donate')} disabled={busy}>
          {busy ? <ActivityIndicator color={colors.success} /> : <Text style={styles.donateBtnText}>💚 실패를 인정하고 기부하기</Text>}
        </Pressable>
      </View>
    );
  }

  // 진행 중
  return (
    <View style={styles.card}>
      <Text style={styles.headline}>🎯 한잔 걸린 도전</Text>
      <Text style={styles.body}>{label} · {amountStr} — 완주하면 이 한잔을 받아요. 끝까지 가봐요!</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: 16,
    marginBottom: 16,
    gap: 8,
    borderWidth: 1,
    borderColor: colors.accent,
    ...shadow.sm,
  },
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
  donateBtn: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    paddingVertical: 13,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.success,
  },
  donateBtnText: {
    fontSize: fontSize.sm,
    color: colors.success,
    fontFamily: fontFamily.bold,
    fontWeight: fontWeight.bold,
  },
  btnDisabled: { opacity: 0.5 },
});
