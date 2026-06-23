// 🚀 응원 한잔 보내기 시트 — 인증 카드 ☕ 버튼에서 진입
// 단계: 티어 선택 → (첫 사용 시) 본인인증 → 결제 확인 → 완료
// Stage 1.5: 본인인증·결제 전부 mock (실돈 0원). 실서비스 전환은 PHASE2_FINTECH_PLAN.md Stage 3.
import React, { useEffect, useState } from 'react';
import {
  View, Text, Pressable, Modal, StyleSheet, TextInput, ActivityIndicator, Alert,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { Coffee } from 'lucide-react-native';
import { colors, fontFamily, fontSize, fontWeight, radius, shadow } from '@/lib/tokens';
import { haptic } from '@/lib/haptics';
import {
  GIFT_TIERS, type GiftTier,
  fetchMyVerification, verifyIdentityMock, createGiftOrder, confirmGiftPaymentMock,
  formatBirthDateInput,
} from '@/lib/payments';

type Props = {
  visible: boolean;
  onClose: () => void;
  challengeId: string;
  recipientId: string;
  recipientNickname: string;
  proofId?: string | null;   // 보낸 인증 카드 — 수신자의 "☕ 한잔 도착" 버튼 위치 (0035)
  myUserId: string | undefined;
};

type Step = 'tier' | 'verify' | 'confirm' | 'done';

// 서버 거부 사유 → 사용자 문구
const REASON_LABEL: Record<string, string> = {
  identity_not_verified: '본인인증이 필요해요.',
  invalid_tier: '지금은 보낼 수 없는 상품이에요.',
  not_a_member: '같은 하다의 동료에게만 보낼 수 있어요.',
  self_cheer_not_allowed: '나에게는 보낼 수 없어요.',
  daily_limit_exceeded: '응원 한잔은 하루 3건까지 보낼 수 있어요.',
  amount_mismatch: '결제 금액이 맞지 않아 취소했어요.',
};

export function GiftSheet({
  visible, onClose, challengeId, recipientId, recipientNickname, proofId = null, myUserId,
}: Props) {
  const [step, setStep] = useState<Step>('tier');
  const [tier, setTier] = useState<GiftTier | null>(null);
  const [verified, setVerified] = useState<boolean | null>(null);   // null = 확인 중
  const [birthDate, setBirthDate] = useState('');
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);

  // 열릴 때마다 초기화 + 본인인증 여부 확인
  useEffect(() => {
    if (!visible || !myUserId) return;
    setStep('tier'); setTier(null); setBusy(false);
    setVerified(null);
    fetchMyVerification(myUserId)
      .then(v => setVerified(v.verified && v.isAdult))
      .catch(() => setVerified(false));
  }, [visible, myUserId]);

  const selectedTier = GIFT_TIERS.find(t => t.tier === tier) ?? null;

  const onPickTier = (t: GiftTier) => {
    haptic.tap();
    setTier(t);
    setStep(verified ? 'confirm' : 'verify');
  };

  const onVerify = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const { isAdult } = await verifyIdentityMock(birthDate.trim(), phone.trim());
      if (!isAdult) {
        Alert.alert('응원 한잔', '만 19세 이상만 보낼 수 있어요.');
        setBusy(false);
        return;
      }
      setVerified(true);
      haptic.success();
      setStep('confirm');
    } catch (e: any) {
      Alert.alert('본인인증 실패', REASON_LABEL[e?.message] ?? '생년월일(YYYY-MM-DD)과 휴대폰 번호를 확인해주세요.');
    } finally {
      setBusy(false);
    }
  };

  const onPay = async () => {
    if (!selectedTier || busy) return;
    setBusy(true);
    try {
      const { orderId, amount } = await createGiftOrder({ challengeId, recipientId, tier: selectedTier.tier, proofId });
      await confirmGiftPaymentMock(orderId, amount);   // Stage 3: PG 결제창으로 교체
      haptic.success();
      setStep('done');
    } catch (e: any) {
      Alert.alert('보내기 실패', REASON_LABEL[e?.message] ?? (e?.message ?? String(e)));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          {step === 'tier' && (
            <>
              <View style={styles.titleRow}>
                <Coffee size={18} color={colors.accent} strokeWidth={2} />
                <Text style={styles.title}>{recipientNickname}님에게 한잔</Text>
              </View>
              <Text style={styles.sub}>오늘의 인증을 봤다면, 진짜 한 잔으로 응원해요</Text>
              {GIFT_TIERS.map(t => (
                <Pressable key={t.tier} style={styles.tierCard} onPress={() => onPickTier(t.tier)}>
                  <Coffee size={20} color={colors.accent} strokeWidth={1.8} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.tierLabel}>{t.label}</Text>
                    <Text style={styles.tierDesc}>{t.desc}</Text>
                  </View>
                  <Text style={styles.tierPrice}>{t.price.toLocaleString()}원</Text>
                </Pressable>
              ))}
              <Text style={styles.mockNote}>베타 테스트 — 모의 결제예요. 실제 결제·계좌 연결이 없어 돈이 빠져나가지 않아요.</Text>
            </>
          )}

          {step === 'verify' && (
            <>
              <Text style={styles.title}>휴대폰 본인인증</Text>
              <Text style={styles.sub}>한잔 보내기는 처음 한 번 본인인증이 필요해요 (만 19세 이상)</Text>
              <TextInput
                value={birthDate}
                onChangeText={(t) => setBirthDate(formatBirthDateInput(t))}
                placeholder="생년월일 8자리 (예: 19900521)"
                placeholderTextColor={colors.primary300}
                style={styles.input}
                keyboardType="number-pad"
                maxLength={10}
                editable={!busy}
              />
              <TextInput
                value={phone}
                onChangeText={setPhone}
                placeholder="휴대폰 번호 (예: 01012345678)"
                placeholderTextColor={colors.primary300}
                style={styles.input}
                keyboardType="phone-pad"
                maxLength={11}
                editable={!busy}
              />
              <Pressable
                style={[styles.primaryBtn, (busy || !birthDate || !phone) && styles.btnDisabled]}
                onPress={onVerify}
                disabled={busy || !birthDate || !phone}
              >
                {busy ? <ActivityIndicator color={colors.surface} /> : <Text style={styles.primaryBtnText}>인증하기</Text>}
              </Pressable>
              <Text style={styles.mockNote}>베타 모의 인증 — 정식 출시 시 통신사 본인인증으로 바뀌어요</Text>
            </>
          )}

          {step === 'confirm' && selectedTier && (
            <>
              <Text style={styles.title}>{selectedTier.label}</Text>
              <Text style={styles.sub}>
                {recipientNickname}님에게 {selectedTier.price.toLocaleString()}원의 한잔을 보내요{'\n'}
                받는 분이 "받기" 또는 "기부하기"를 선택하면 알려드릴게요
              </Text>
              <Pressable
                style={[styles.primaryBtn, busy && styles.btnDisabled]}
                onPress={onPay}
                disabled={busy}
              >
                {busy
                  ? <ActivityIndicator color={colors.surface} />
                  : <Text style={styles.primaryBtnText}>{selectedTier.price.toLocaleString()}원 보내기 (모의 결제)</Text>}
              </Pressable>
              <Text style={styles.mockNote}>실제 결제·계좌 연결 없음 · 베타 모의 결제 (돈 안 빠져나가요)</Text>
            </>
          )}

          {step === 'done' && (
            <>
              <View style={styles.doneEmoji}><Coffee size={40} color={colors.accent} strokeWidth={1.8} /></View>
              <Text style={styles.title}>한잔을 보냈어요!</Text>
              <Text style={styles.sub}>{recipientNickname}님이 받으면 알림으로 알려드릴게요</Text>
              <Pressable style={styles.primaryBtn} onPress={() => { haptic.tap(); onClose(); }}>
                <Text style={styles.primaryBtnText}>확인</Text>
              </Pressable>
            </>
          )}
        </Pressable>
      </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: 24,
    paddingBottom: 36,
    gap: 12,
    ...shadow.lg,
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  title: {
    fontSize: fontSize.lg,
    color: colors.primary,
    fontFamily: fontFamily.bold,
    fontWeight: fontWeight.bold,
    textAlign: 'center',
  },
  sub: {
    fontSize: fontSize.sm,
    color: colors.primary500,
    fontFamily: fontFamily.regular,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 4,
  },
  tierCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    backgroundColor: colors.accent50,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  tierLabel: {
    fontSize: fontSize.base,
    color: colors.primary,
    fontFamily: fontFamily.bold,
    fontWeight: fontWeight.bold,
  },
  tierDesc: {
    fontSize: fontSize.xs,
    color: colors.primary500,
    fontFamily: fontFamily.regular,
    marginTop: 2,
  },
  tierPrice: {
    fontSize: fontSize.base,
    color: colors.accent700,
    fontFamily: fontFamily.bold,
    fontWeight: fontWeight.bold,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.primary100,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: fontSize.base,
    color: colors.primary,
    fontFamily: fontFamily.regular,
    backgroundColor: colors.background,
  },
  primaryBtn: {
    backgroundColor: colors.accent,
    borderRadius: radius.lg,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  btnDisabled: { opacity: 0.5 },
  primaryBtnText: {
    fontSize: fontSize.base,
    color: colors.surface,
    fontFamily: fontFamily.bold,
    fontWeight: fontWeight.bold,
  },
  mockNote: {
    fontSize: 11,
    color: colors.primary300,
    fontFamily: fontFamily.regular,
    textAlign: 'center',
    marginTop: 4,
  },
  doneEmoji: { alignSelf: 'center', marginBottom: 4 },
});
