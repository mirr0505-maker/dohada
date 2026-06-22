// 🚀 나와의 내기 카드 — 현황 탭 상단. 도전자(개설자) 본인에게만 노출 (gift_orders RLS 가 sender 본인만 조회).
// 한 카드가 진입 → 진행 → 정산을 모두 표현하며, 기부 모드(commitment/pledge/always)별로 정산이 갈린다:
//   commitment: 완주→받기/기부 선택 · 실패→기부(인정)
//   pledge    : 완주→기부(서약) · 실패→환불(돈 안 나감)
//   always    : 완주·실패 무관 기부
// 정산 행동의 서버 권위는 claim-gift(validateBetClaim). 여기 표시는 UX 용 — 최종 판정은 서버.
import React from 'react';
import { View, Text, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { colors, fontFamily, fontSize, fontWeight, radius, shadow } from '@/lib/tokens';
import { BET_TIERS, BET_DONATION_MODES, type MyBet } from '@/lib/payments';

type Props = {
  bet: MyBet | null;
  canPlace: boolean;             // 내기 없음 + 걸 자격 (도전자·종료 전 등 — 부모가 판정)
  challengerCompleted: boolean;  // 도전자가 완주했는가 (= 서버 outcome 'completed' 와 동일 시점)
  finished: boolean;             // 챌린지 종료(종료일 경과) — 미완주 정산 가능 시점
  busy: boolean;
  onPlace: () => void;
  onSettle: (action: 'receive' | 'donate' | 'refund') => void;
  onGiveUp?: () => void;   // 진행 중 내기 포기(실패 인증) — 없으면 미노출
};

function tierLabel(productTier: string): string {
  return BET_TIERS.find(t => t.tier === productTier)?.label
    ?? (productTier === 'grand_cup' ? '🎁 거하게 한잔' : productTier === 'hearty_cup' ? '🍰 든든한 한잔' : '☕ 한잔');
}
function modeLabel(mode: string): string {
  return BET_DONATION_MODES.find(m => m.mode === mode)?.label ?? '본전 내기';
}

export function BetCard(props: Props) {
  const { bet, canPlace, challengerCompleted, finished, busy, onPlace, onSettle, onGiveUp } = props;

  // ── 내기 없음 → 진입 ──
  if (!bet) {
    if (!canPlace) return null;
    return (
      <View style={styles.card}>
        <Text style={styles.headline}>🎯 이 하다, 한잔 걸기</Text>
        <Text style={styles.body}>완주하면 본전, 실패를 인정하면 기부 — 기부 방식은 걸 때 골라요. 나 자신과의 약속에 한 잔을 걸어보세요.</Text>
        <Pressable style={styles.primaryBtn} onPress={onPlace} disabled={busy}>
          <Text style={styles.primaryBtnText}>한잔 걸기</Text>
        </Pressable>
      </View>
    );
  }

  const mode = bet.donation_mode;
  const label = tierLabel(bet.product_tier);
  const meta = `${label} · ${modeLabel(mode)} · ${bet.amount.toLocaleString()}원`;

  // ── 처리 완료 상태 ──
  if (bet.status === 'issued' || bet.status === 'delivered' || bet.status === 'redeemed') {
    return <Done headline="☕ 완주! 한잔을 받았어요" body={`${meta} — 끝까지 해낸 나에게 주는 한 잔.`} />;
  }
  if (bet.status === 'donated') {
    return <Done headline="💚 한잔을 기부로 돌렸어요" body={`${meta} — 누군가의 한잔이 됐어요.`} />;
  }
  if (bet.status === 'refunded') {
    return <Done headline="↩️ 환불되었어요" body={`${meta} — 이번엔 완주하지 못해 한잔이 돌아왔어요.`} />;
  }

  // ── 결제 완료(paid) = 정산 대기 ──
  // 완주 정산
  if (challengerCompleted) {
    if (mode === 'commitment') {
      return (
        <View style={styles.card}>
          <Text style={styles.headline}>🏆 완주! 내기 정산</Text>
          <Text style={styles.body}>{meta} — 본전을 찾았어요. 받을지, 기부로 돌릴지 골라주세요.</Text>
          <SettleBtn label="☕ 한잔 받기" busy={busy} onPress={() => onSettle('receive')} />
          <DonateBtn label="💚 기부로 돌리기 — 누군가의 한잔이 돼요" busy={busy} onPress={() => onSettle('donate')} />
        </View>
      );
    }
    // pledge / always — 완주 시 기부 확정
    return (
      <View style={styles.card}>
        <Text style={styles.headline}>🏆 완주! {mode === 'pledge' ? '서약대로 기부' : '한잔 기부'}</Text>
        <Text style={styles.body}>{meta} — 끝까지 해낸 한잔을 기부로 보내요.</Text>
        <SettleBtn label="💚 기부하기" busy={busy} onPress={() => onSettle('donate')} />
      </View>
    );
  }

  // 미완주 정산 (종료 후)
  if (finished) {
    if (mode === 'pledge') {
      return (
        <View style={styles.card}>
          <Text style={styles.headline}>🎯 내기 정산 — 환불</Text>
          <Text style={styles.body}>{meta} — 이번엔 완주하지 못했어요. 서약 모드라 한잔은 환불돼요(기부는 다음 기회에).</Text>
          <DonateBtn label="↩️ 환불받기" busy={busy} onPress={() => onSettle('refund')} />
        </View>
      );
    }
    // commitment(실패 인정) / always — 기부
    return (
      <View style={styles.card}>
        <Text style={styles.headline}>🎯 내기 정산</Text>
        <Text style={styles.body}>{meta} — 이번엔 완주하지 못했어요. 약속대로 이 한잔은 기부로 마무리해요.</Text>
        <DonateBtn label={mode === 'commitment' ? '💚 실패를 인정하고 기부하기' : '💚 기부하기'} busy={busy} onPress={() => onSettle('donate')} />
      </View>
    );
  }

  // 진행 중
  const hint =
    mode === 'pledge' ? '완주하면 기부, 못 하면 환불돼요.'
    : mode === 'always' ? '완주하든 못하든 기부돼요.'
    : '완주하면 이 한잔을 받아요.';
  return (
    <View style={styles.card}>
      <Text style={styles.headline}>🎯 한잔 걸린 하다</Text>
      <Text style={styles.body}>{meta} — {hint} 끝까지 가봐요!</Text>
      {onGiveUp && (
        <Pressable onPress={onGiveUp} disabled={busy} hitSlop={6} style={{ alignSelf: 'flex-start' }}>
          <Text style={styles.giveUpLink}>🏳️ 포기하기 (실패 인증)</Text>
        </Pressable>
      )}
    </View>
  );
}

function Done({ headline, body }: { headline: string; body: string }) {
  return (
    <View style={styles.card}>
      <Text style={styles.headline}>{headline}</Text>
      <Text style={styles.body}>{body}</Text>
    </View>
  );
}
function SettleBtn({ label, busy, onPress }: { label: string; busy: boolean; onPress: () => void }) {
  return (
    <Pressable style={[styles.primaryBtn, busy && styles.btnDisabled]} onPress={onPress} disabled={busy}>
      {busy ? <ActivityIndicator color={colors.surface} /> : <Text style={styles.primaryBtnText}>{label}</Text>}
    </Pressable>
  );
}
function DonateBtn({ label, busy, onPress }: { label: string; busy: boolean; onPress: () => void }) {
  return (
    <Pressable style={[styles.donateBtn, busy && styles.btnDisabled]} onPress={onPress} disabled={busy}>
      {busy ? <ActivityIndicator color={colors.done} /> : <Text style={styles.donateBtnText}>{label}</Text>}
    </Pressable>
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
    borderColor: colors.done,
  },
  donateBtnText: {
    fontSize: fontSize.sm,
    color: colors.done,
    fontFamily: fontFamily.bold,
    fontWeight: fontWeight.bold,
  },
  btnDisabled: { opacity: 0.5 },
  giveUpLink: {
    fontSize: fontSize.xs,
    color: colors.primary500,
    fontFamily: fontFamily.medium,
    fontWeight: fontWeight.medium,
    textDecorationLine: 'underline',
    marginTop: 2,
  },
});
