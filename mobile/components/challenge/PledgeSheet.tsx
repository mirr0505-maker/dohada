// 🚀 다짐 걸기 시트 — 현황 탭 "다짐" 카드에서 진입 (무현금 사회적 스테이크, 0046)
// 결제·본인인증 없음 — 단일 화면: 트리거(실패/성공) 토글 + 자유 문구 입력 → 검수 → 저장.
// 검수: moderate-text(pledge) 가 금액 표기·고가·신체/성적·강요를 생성 전 동기 차단.
// 명예제도 — 앱은 약속을 기록·표시만, 돈/검증 안 거침.
import React, { useEffect, useState } from 'react';
import {
  View, Text, Pressable, Modal, StyleSheet, TextInput, ActivityIndicator, Alert,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { colors, fontFamily, fontSize, fontWeight, radius, shadow } from '@/lib/tokens';
import { haptic } from '@/lib/haptics';
import { moderatePledge, createPledge, type PledgeDirection } from '@/lib/db';

type Props = {
  visible: boolean;
  onClose: () => void;       // 완료/닫기 — 닫힐 때 부모가 다짐 목록 새로고침
  challengeId: string;
  myUserId: string | undefined;
  usedDirections: PledgeDirection[];   // 이미 건 방향 (방향당 1개라 비활성 처리)
};

const DIRS: { dir: PledgeDirection; label: string; hint: string }[] = [
  { dir: 'lose', label: '🔻 못 하면', hint: '완주·달성 못했을 때 지킬 다짐' },
  { dir: 'win', label: '🏆 해내면', hint: '완주·달성했을 때 지킬 다짐' },
];

export function PledgeSheet({ visible, onClose, challengeId, myUserId, usedDirections }: Props) {
  const [direction, setDirection] = useState<PledgeDirection>('lose');
  const [content, setContent] = useState('');
  const [busy, setBusy] = useState(false);

  // 열릴 때마다 초기화 + 아직 안 쓴 방향을 기본 선택
  useEffect(() => {
    if (!visible) return;
    const firstFree = DIRS.find(d => !usedDirections.includes(d.dir))?.dir ?? 'lose';
    setDirection(firstFree);
    setContent('');
    setBusy(false);
  }, [visible, usedDirections]);

  const onSubmit = async () => {
    if (!myUserId || busy) return;
    const text = content.trim();
    if (!text) {
      Alert.alert('다짐', '어떤 다짐을 걸지 적어주세요.');
      return;
    }
    setBusy(true);
    try {
      // 검수 먼저 (생성 전 동기 게이트 — 우회 분기 없음)
      const mod = await moderatePledge(text);
      if (mod.verdict === 'block') {
        haptic.warning();
        Alert.alert('이 다짐은 걸 수 없어요', mod.reason ?? '금액·고가 선물·부적절한 내용은 넣을 수 없어요.');
        return;
      }
      await createPledge({ challengeId, userId: myUserId, direction, content: text });
      haptic.success();
      onClose();
    } catch (e: any) {
      Alert.alert('다짐 걸기 실패', e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={styles.backdrop} onPress={onClose}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <Text style={styles.emojiBig}>💛</Text>
            <Text style={styles.title}>다짐 걸기</Text>
            <Text style={styles.sub}>도전에 거는 가벼운 약속이에요. 돈이 오가지 않아요.</Text>

            {/* 트리거 선택 — 실패 시 / 성공 시 (방향당 1개) */}
            <View style={styles.dirRow}>
              {DIRS.map(d => {
                const used = usedDirections.includes(d.dir);
                const active = direction === d.dir;
                return (
                  <Pressable
                    key={d.dir}
                    style={[styles.dirBtn, active && styles.dirBtnActive, used && styles.dirBtnUsed]}
                    onPress={() => { if (!used) { haptic.tap(); setDirection(d.dir); } }}
                    disabled={used || busy}
                  >
                    <Text style={[styles.dirLabel, active && styles.dirLabelActive]}>{d.label}</Text>
                    <Text style={[styles.dirHint, active && styles.dirHintActive]}>
                      {used ? '이미 걸어둠' : d.hint}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {/* 자유 문구 — 조건 표현은 사용자 몫 */}
            <TextInput
              value={content}
              onChangeText={setContent}
              placeholder={direction === 'lose'
                ? '예: 다 채우지 못하면 일주일 금주 · 완주 못하면 동료에게 커피'
                : '예: 해내면 기부하기 · 완주하면 동료 칭찬 릴레이'}
              placeholderTextColor={colors.primary300}
              style={styles.input}
              multiline
              maxLength={200}
              editable={!busy}
            />

            <View style={styles.noteBox}>
              <Text style={styles.noteText}>
                🤝 명예제도 약속이에요 — 앱이 강제하지 않아요.{'\n'}
                금액(돈)·명품 같은 고가 선물은 넣을 수 없어요.
              </Text>
            </View>

            <Pressable
              style={[styles.primaryBtn, (busy || !content.trim()) && styles.btnDisabled]}
              onPress={onSubmit}
              disabled={busy || !content.trim()}
            >
              {busy ? <ActivityIndicator color={colors.surface} /> : <Text style={styles.primaryBtnText}>다짐 걸기</Text>}
            </Pressable>
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
  dirRow: { flexDirection: 'row', gap: 10 },
  dirBtn: {
    flex: 1,
    padding: 14,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: colors.primary100,
    backgroundColor: colors.background,
    gap: 4,
  },
  dirBtnActive: {
    borderColor: colors.accent,
    backgroundColor: colors.accent50,
  },
  dirBtnUsed: { opacity: 0.4 },
  dirLabel: {
    fontSize: fontSize.base,
    color: colors.primary,
    fontFamily: fontFamily.bold,
    fontWeight: fontWeight.bold,
  },
  dirLabelActive: { color: colors.accent700 },
  dirHint: {
    fontSize: fontSize.xs,
    color: colors.primary500,
    fontFamily: fontFamily.regular,
  },
  dirHintActive: { color: colors.accent700 },
  input: {
    borderWidth: 1,
    borderColor: colors.primary100,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    minHeight: 80,
    fontSize: fontSize.base,
    color: colors.primary,
    fontFamily: fontFamily.regular,
    backgroundColor: colors.background,
    textAlignVertical: 'top',
  },
  noteBox: {
    padding: 12,
    backgroundColor: colors.accent50,
    borderRadius: radius.lg,
    borderLeftWidth: 3,
    borderLeftColor: colors.accent,
  },
  noteText: {
    fontSize: fontSize.xs,
    color: colors.primary500,
    fontFamily: fontFamily.regular,
    lineHeight: 18,
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
});
