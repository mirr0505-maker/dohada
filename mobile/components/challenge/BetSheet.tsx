// 🚀 나와의 내기 걸기 시트 — 현황 탭 "이 도전, 한잔 걸기" 카드에서 진입
// 단계: 약속 안내 → 티어 선택(3종) → (첫 사용 시) 본인인증 → 결제 확인 → 완료
// 핵심 약속: 완주하면 본전(내 한잔 수령), 실패를 인정하면 기부 — stickK 커밋먼트 계약 (PHASE2 2.1-3).
// Stage 5 ⑤a: 본인인증·결제 전부 mock(실돈 0원). 실서비스 전환은 ⑤b(자문 후).
import React, { useEffect, useState } from 'react';
import {
  View, Text, Pressable, Modal, StyleSheet, TextInput, ActivityIndicator, Alert,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { colors, fontFamily, fontSize, fontWeight, radius, shadow } from '@/lib/tokens';
import { haptic } from '@/lib/haptics';
import {
  BET_TIERS, type BetTier, BET_DONATION_MODES, type BetDonationMode,
  fetchMyVerification, verifyIdentityMock, createBetOrder, confirmGiftPaymentMock,
  formatBirthDateInput,
} from '@/lib/payments';

type Props = {
  visible: boolean;
  onClose: () => void;     // 완료/닫기 — 닫힐 때 부모가 내기 상태 새로고침
  challengeId: string;
  myUserId: string | undefined;
  // 🚀 다인 내기(⑤c) — 챌린지에 걸린 티어·모드 고정. 둘 다 주면 group 모드(티어·모드 선택 생략)
  fixedTier?: BetTier | null;
  fixedMode?: BetDonationMode | null;
};

type Step = 'intro' | 'tier' | 'mode' | 'verify' | 'confirm' | 'done';

// 서버 거부 사유 → 사용자 문구
const REASON_LABEL: Record<string, string> = {
  identity_not_verified: '본인인증이 필요해요.',
  invalid_tier: '지금은 걸 수 없는 금액이에요.',
  not_a_member: '이 하다의 멤버만 걸 수 있어요.',
  bet_room_not_allowed: '나와의 내기는 나혼자·응원받기 방에서만 걸 수 있어요.',
  bet_challenger_only: '하다를 시작한 본인만 걸 수 있어요.',
  bet_challenge_finished: '이미 종료된 하다에는 걸 수 없어요.',
  bet_already_exists: '이미 이 하다에 한잔을 걸어두었어요.',
  amount_mismatch: '결제 금액이 맞지 않아 취소했어요.',
};

export function BetSheet({ visible, onClose, challengeId, myUserId, fixedTier = null, fixedMode = null }: Props) {
  const isGroup = !!(fixedTier && fixedMode);   // 다인 내기 = 티어·모드 고정
  const [step, setStep] = useState<Step>('intro');
  const [tier, setTier] = useState<BetTier | null>(null);
  const [donationMode, setDonationMode] = useState<BetDonationMode | null>(null);
  const [verified, setVerified] = useState<boolean | null>(null);   // null = 확인 중
  const [birthDate, setBirthDate] = useState('');
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);

  // 열릴 때마다 초기화 + 본인인증 여부 확인. 다인 내기는 티어·모드를 챌린지 설정으로 고정.
  useEffect(() => {
    if (!visible || !myUserId) return;
    setStep('intro'); setBusy(false);
    setTier(isGroup ? fixedTier : null);
    setDonationMode(isGroup ? fixedMode : null);
    setVerified(null);
    fetchMyVerification(myUserId)
      .then(v => setVerified(v.verified && v.isAdult))
      .catch(() => setVerified(false));
  }, [visible, myUserId, isGroup, fixedTier, fixedMode]);

  const selectedTier = BET_TIERS.find(t => t.tier === tier) ?? null;
  const selectedMode = BET_DONATION_MODES.find(m => m.mode === donationMode) ?? null;

  // 다인 내기는 티어·모드가 고정 — intro 에서 바로 인증/확인으로
  const onStart = () => {
    haptic.tap();
    if (isGroup) {
      setTier(fixedTier);
      setDonationMode(fixedMode);
      setStep(verified ? 'confirm' : 'verify');
    } else {
      setStep('tier');
    }
  };

  const onPickTier = (t: BetTier) => {
    haptic.tap();
    setTier(t);
    setStep('mode');     // 티어 → 기부 모드 선택
  };

  const onPickMode = (m: BetDonationMode) => {
    haptic.tap();
    setDonationMode(m);
    setStep(verified ? 'confirm' : 'verify');
  };

  const onVerify = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const { isAdult } = await verifyIdentityMock(birthDate.trim(), phone.trim());
      if (!isAdult) {
        Alert.alert('나와의 내기', '만 19세 이상만 걸 수 있어요.');
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
    if (!selectedTier || !donationMode || busy) return;
    setBusy(true);
    try {
      const { orderId, amount } = await createBetOrder({ challengeId, tier: selectedTier.tier, donationMode });
      await confirmGiftPaymentMock(orderId, amount);   // ⑤b: PG 결제창으로 교체
      haptic.success();
      setStep('done');
    } catch (e: any) {
      Alert.alert('내기 걸기 실패', REASON_LABEL[e?.message] ?? (e?.message ?? String(e)));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          {step === 'intro' && (
            <>
              <Text style={styles.emojiBig}>🎯</Text>
              <Text style={styles.title}>{isGroup ? '이 방의 내기에 참여하기' : '이 하다, 한잔 걸기'}</Text>
              {isGroup && selectedTier ? (
                <Text style={styles.sub}>
                  이 방에 <Text style={styles.bold}>{selectedTier.label} {selectedTier.price.toLocaleString()}원</Text> 내기가 걸려 있어요.{'\n'}
                  참여자 전원이 같은 한잔을 걸고 함께 해요.
                </Text>
              ) : (
                <Text style={styles.sub}>
                  나 자신과의 약속에 한 잔을 겁니다.{'\n'}
                  <Text style={styles.bold}>완주하면 본전</Text> — 내 한잔을 그대로 받아요.{'\n'}
                  <Text style={styles.bold}>실패를 인정하면 기부</Text> — 누군가의 한잔이 돼요.
                </Text>
              )}
              <View style={styles.promiseBox}>
                <Text style={styles.promiseText}>
                  {isGroup && selectedMode
                    ? `${selectedMode.label} — ${selectedMode.desc}`
                    : '상대가 없는, 오직 나와의 약속이에요. 그래서 실패해도 환불은 없어요 — 그 긴장이 이 한잔의 힘이에요.'}
                </Text>
              </View>
              <Pressable style={styles.primaryBtn} onPress={onStart}>
                <Text style={styles.primaryBtnText}>{isGroup ? '참여하기' : '한잔 고르기'}</Text>
              </Pressable>
              <Text style={styles.mockNote}>🧪 베타 테스트 — 모의 결제예요. 실제 결제·계좌 연결이 없어 돈이 빠져나가지 않아요.</Text>
            </>
          )}

          {step === 'tier' && (
            <>
              <Text style={styles.title}>얼마를 걸까요?</Text>
              <Text style={styles.sub}>걸수록 약속이 단단해져요</Text>
              {BET_TIERS.map(t => (
                <Pressable key={t.tier} style={styles.tierCard} onPress={() => onPickTier(t.tier)}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.tierLabel}>{t.label}</Text>
                    <Text style={styles.tierDesc}>{t.desc}</Text>
                  </View>
                  <Text style={styles.tierPrice}>{t.price.toLocaleString()}원</Text>
                </Pressable>
              ))}
            </>
          )}

          {step === 'mode' && (
            <>
              <Text style={styles.title}>어떻게 정산할까요?</Text>
              <Text style={styles.sub}>완주했을 때와 못 했을 때, 이 한잔이 어디로 갈지 골라요</Text>
              {BET_DONATION_MODES.map(m => (
                <Pressable key={m.mode} style={styles.tierCard} onPress={() => onPickMode(m.mode)}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.tierLabel}>{m.label}</Text>
                    <Text style={styles.tierDesc}>{m.desc}</Text>
                  </View>
                </Pressable>
              ))}
            </>
          )}

          {step === 'verify' && (
            <>
              <Text style={styles.title}>휴대폰 본인인증</Text>
              <Text style={styles.sub}>내기 걸기는 처음 한 번 본인인증이 필요해요 (만 19세 이상)</Text>
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

          {step === 'confirm' && selectedTier && selectedMode && (
            <>
              <Text style={styles.title}>{selectedTier.label} 걸기</Text>
              <Text style={styles.sub}>
                이 하다에 {selectedTier.price.toLocaleString()}원의 한잔을 겁니다.
              </Text>
              <View style={styles.promiseBox}>
                <Text style={styles.promiseText}>
                  <Text style={styles.bold}>{selectedMode.label}</Text> — {selectedMode.desc}
                </Text>
              </View>
              <Pressable
                style={[styles.primaryBtn, busy && styles.btnDisabled]}
                onPress={onPay}
                disabled={busy}
              >
                {busy
                  ? <ActivityIndicator color={colors.surface} />
                  : <Text style={styles.primaryBtnText}>{selectedTier.price.toLocaleString()}원 걸기 (모의 결제)</Text>}
              </Pressable>
              <Text style={styles.mockNote}>🧪 실제 결제·계좌 연결 없음 · 베타 모의 결제 (돈 안 빠져나가요)</Text>
            </>
          )}

          {step === 'done' && (
            <>
              <Text style={styles.emojiBig}>🎯</Text>
              <Text style={styles.title}>한잔을 걸었어요!</Text>
              <Text style={styles.sub}>이제 끝까지 완주해서 본전을 찾아오세요</Text>
              <Pressable style={styles.primaryBtn} onPress={() => { haptic.tap(); onClose(); }}>
                <Text style={styles.primaryBtnText}>좋아요</Text>
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
  emojiBig: { fontSize: 44, textAlign: 'center' },
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
  bold: {
    color: colors.primary,
    fontFamily: fontFamily.bold,
    fontWeight: fontWeight.bold,
  },
  promiseBox: {
    padding: 12,
    backgroundColor: colors.accent50,
    borderRadius: radius.lg,
    borderLeftWidth: 3,
    borderLeftColor: colors.accent,
  },
  promiseText: {
    fontSize: fontSize.xs,
    color: colors.primary500,
    fontFamily: fontFamily.regular,
    lineHeight: 18,
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
});
