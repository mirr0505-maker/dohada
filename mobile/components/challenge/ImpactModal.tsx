// 🚀 챌린지방 info-bar 의 💚 버튼 탭 → 함께 만든 변화 팝업
// 4 stats: 함께 N일 / N번 인증 / N번 응원 / N개 기록. + 기부 허브: 기부로 돌린 한잔 (있을 때만)
import React, { useEffect, useState } from 'react';
import { View, Text, Modal, Pressable, StyleSheet } from 'react-native';
import { HeartHandshake, Coffee } from 'lucide-react-native';
import { colors, fontFamily, fontSize, fontWeight, radius } from '@/lib/tokens';
import { fetchChallengeDonationCount } from '@/lib/payments';

type Props = {
  visible: boolean;
  onClose: () => void;
  days: number;          // 함께한 일수 (passedDays)
  proofs: number;        // 총 인증 횟수
  cheers: number;        // 총 응원 횟수
  logs: number;          // 총 기록 개수
  challengeId?: string;  // 있으면 기부 한잔 집계 표시 (열릴 때만 조회)
};

export function ImpactModal({ visible, onClose, days, proofs, cheers, logs, challengeId }: Props) {
  // ☕→💚 기부로 돌린 한잔 수 — 방 단위 합계 (개인 식별 없음, 비교 압박 금지 원칙)
  const [donatedCups, setDonatedCups] = useState(0);
  useEffect(() => {
    if (!visible || !challengeId) return;
    fetchChallengeDonationCount(challengeId).then(setDonatedCups).catch(() => {});
  }, [visible, challengeId]);

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.card} onPress={() => {}}>
          <View style={styles.titleRow}>
            <HeartHandshake size={18} color={colors.done} strokeWidth={2} />
            <Text style={styles.title}>함께 만든 변화</Text>
          </View>
          <View style={styles.stats}>
            <Stat num={`${days}일`} label="함께" />
            <Stat num={proofs} label="번 인증" />
            <Stat num={cheers} label="번 응원" />
            <Stat num={logs} label="개 기록" />
          </View>
          {donatedCups > 0 && (
            <View style={styles.donationRow}>
              <Coffee size={14} color={colors.accent700} strokeWidth={1.8} />
              <Text style={styles.donationText}>
                이 방에서 기부로 돌린 한잔 {donatedCups}잔 — 누군가의 한잔이 됐어요
              </Text>
            </View>
          )}
          <Pressable style={styles.closeBtn} onPress={onClose} hitSlop={6}>
            <Text style={styles.closeText}>닫기</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function Stat({ num, label }: { num: string | number; label: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statNum}>{num}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  card: {
    width: '100%',
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    paddingTop: 24, paddingBottom: 8,
    paddingHorizontal: 24,
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  title: {
    fontSize: fontSize.lg,
    color: colors.accent700,
    fontFamily: fontFamily.bold,
    fontWeight: fontWeight.bold,
    textAlign: 'center',
    marginBottom: 20,
  },
  stats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: colors.accent50,
    borderRadius: radius.lg,
    paddingVertical: 16,
    paddingHorizontal: 8,
    marginBottom: 8,
  },
  stat: { alignItems: 'center', flex: 1 },
  statNum: {
    fontSize: fontSize.xl,
    color: colors.primary,
    fontFamily: fontFamily.bold,
    fontWeight: fontWeight.bold,
  },
  statLabel: {
    fontSize: fontSize.xs,
    color: colors.primary500,
    fontFamily: fontFamily.regular,
    marginTop: 4,
  },
  donationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.accent50,
    borderRadius: radius.md,
    padding: 12,
    marginBottom: 4,
  },
  donationText: {
    flex: 1,
    fontSize: fontSize.xs,
    color: colors.accent700,
    fontFamily: fontFamily.medium,
    fontWeight: fontWeight.medium,
    lineHeight: 18,
  },
  closeBtn: {
    alignItems: 'center',
    paddingVertical: 14,
  },
  closeText: {
    fontSize: fontSize.base,
    color: colors.primary500,
    fontFamily: fontFamily.medium,
  },
});
