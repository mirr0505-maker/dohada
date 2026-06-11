// 🚀 초대 진입점 — dohada://invite/<id> 또는 앱 내 push 로 진입
// 개선: 자동 참여 차단 → 챌린지 기본 정보 및 초대 메시지를 확인하고 참여 여부를 수락/거절 선택하는 랜딩페이지
import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, StyleSheet, Alert, Pressable } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Screen } from '@/components/Screen';
import { Button } from '@/components/Button';
import { colors, fontFamily, fontSize, fontWeight, radius, shadow } from '@/lib/tokens';
import { useSession } from '@/lib/session';
import { joinChallenge, setPendingInvite, clearPendingInvite } from '@/lib/invite';
import { fetchChallengeDetailForInvite } from '@/lib/db';
import { getChallengeDDay } from '@/lib/format';
import { haptic } from '@/lib/haptics';

type Status = 'loading' | 'confirming' | 'joining' | 'error';

export default function InviteScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const session = useSession();
  const [status, setStatus] = useState<Status>('loading');
  const [errorMsg, setErrorMsg] = useState('');
  const [challenge, setChallenge] = useState<any>(null);

  useEffect(() => {
    if (!id) return;
    if (session === undefined) return; // 세션 로딩 중

    if (session === null) {
      // 미로그인 → 챌린지 ID 를 pending 으로 저장하고 로그인 화면으로
      setPendingInvite(id).finally(() => router.replace('/login'));
      return;
    }

    // 로그인 됨 → 챌린지 상세 정보 로드
    loadChallengeDetail();
  }, [id, session]);

  const loadChallengeDetail = async () => {
    if (!id) return;
    try {
      setStatus('loading');
      const data = await fetchChallengeDetailForInvite(id);
      setChallenge(data);
      setStatus('confirming');
    } catch (e: any) {
      setStatus('error');
      setErrorMsg(e?.message ?? '챌린지 정보를 불러오지 못했습니다.');
    }
  };

  const handleAccept = async () => {
    if (!id || !session?.user?.id) return;
    haptic.tap();
    try {
      setStatus('joining');
      const result = await joinChallenge(id, session.user.id);
      // pendingInvite 가 남아있으면 정리 (로그인 후 자동 진입 흐름 종료)
      await clearPendingInvite().catch(() => {});
      haptic.success();
      const msg = result === 'already_member'
        ? '이미 참여 중인 챌린지입니다. 챌린지방으로 이동합니다.'
        : '챌린지에 참여했습니다! 매일 함께 도전해요.';
      Alert.alert('합류 완료', msg);
      router.replace(`/room/${id}`);
    } catch (e: any) {
      setStatus('error');
      setErrorMsg(e?.message ?? '참여 처리에 실패했습니다.');
    }
  };

  const handleReject = () => {
    haptic.tap();
    Alert.alert(
      '도전 거절',
      '초대를 거절하시겠습니까? 홈 화면으로 이동합니다.',
      [
        { text: '취소', style: 'cancel' },
        {
          text: '확정',
          style: 'destructive',
          onPress: async () => {
            // 거절 시 pendingInvite 도 함께 정리 — 다음 로그인 때 다시 끌려가지 않도록.
            await clearPendingInvite().catch(() => {});
            haptic.warning();
            router.replace('/home');
          }
        }
      ]
    );
  };

  return (
    <Screen backgroundColor={colors.background}>
      <View style={styles.center}>
        {status === 'loading' && (
          <View style={styles.loadingBox}>
            <ActivityIndicator color={colors.accent} size="large" />
            <Text style={styles.label}>초대 정보 확인 중…</Text>
          </View>
        )}

        {status === 'confirming' && challenge && (
          <View style={styles.card}>
            <Text style={styles.cardHeaderEmoji}>🌍</Text>
            <Text style={styles.cardCuration}>도전 인연 초대장</Text>
            
            <Text style={styles.title}>{challenge.title}</Text>
            
            {/* 카테고리 정보 */}
            {challenge.category && (
              <View style={styles.categoryRow}>
                <Text style={styles.categoryText}>
                  {challenge.category.emoji} {challenge.category.name}
                </Text>
              </View>
            )}

            {/* 개설자 및 인원 정보 */}
            <View style={styles.metaBox}>
              <Text style={styles.metaText}>👑 개설자: @{challenge.creator_nickname}</Text>
              <Text style={styles.metaText}>
                👥 현재 {challenge.member_count}명 참여 중
              </Text>
              <Text style={styles.metaText}>
                📅 기간: {challenge.start_date.slice(5)} ~ {challenge.end_date.slice(5)} ({getChallengeDDay(challenge.start_date, challenge.end_date)})
              </Text>
            </View>

            {/* 개설자가 보낸 메시지 */}
            {challenge.invitation_message && challenge.invitation_message.trim() !== '' ? (
              <View style={styles.messageBox}>
                <Text style={styles.messageLabel}>💌 개설자의 한마디</Text>
                <Text style={styles.messageText}>"{challenge.invitation_message}"</Text>
              </View>
            ) : (
              <View style={styles.emptyMessageBox}>
                <Text style={styles.emptyMessageText}>새로운 도전을 함께 개시해보세요! 🌱</Text>
              </View>
            )}

            <View style={styles.buttonRow}>
              <Pressable style={[styles.btn, styles.btnReject]} onPress={handleReject}>
                <Text style={styles.btnRejectText}>나중에 하기</Text>
              </Pressable>
              <Pressable style={[styles.btn, styles.btnAccept]} onPress={handleAccept}>
                <Text style={styles.btnAcceptText}>함께 도전하기</Text>
              </Pressable>
            </View>
          </View>
        )}

        {status === 'joining' && (
          <View style={styles.loadingBox}>
            <ActivityIndicator color={colors.accent} size="large" />
            <Text style={styles.title}>챌린지에 참여하는 중…</Text>
          </View>
        )}

        {status === 'error' && (
          <View style={styles.card}>
            <Text style={styles.cardHeaderEmoji}>⚠️</Text>
            <Text style={styles.title}>참여할 수 없어요</Text>
            <Text style={styles.errorText}>{errorMsg}</Text>
            <Button
              label="홈으로 돌아가기"
              onPress={() => router.replace('/home')}
            />
          </View>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    backgroundColor: colors.background,
  },
  loadingBox: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  label: {
    fontSize: fontSize.base,
    color: colors.primary500,
    fontFamily: fontFamily.regular,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: 24,
    ...shadow.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.primary50,
  },
  cardHeaderEmoji: {
    fontSize: 48,
    marginBottom: 8,
  },
  cardCuration: {
    fontSize: fontSize.xs,
    fontFamily: fontFamily.bold,
    fontWeight: fontWeight.bold,
    color: colors.accent,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  title: {
    fontSize: fontSize.lg + 2,
    color: colors.primary,
    fontFamily: fontFamily.bold,
    fontWeight: fontWeight.bold,
    textAlign: 'center',
    marginBottom: 12,
    lineHeight: 26,
  },
  categoryRow: {
    backgroundColor: colors.primary50,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.pill,
    marginBottom: 16,
  },
  categoryText: {
    fontSize: fontSize.xs,
    fontFamily: fontFamily.bold,
    fontWeight: fontWeight.bold,
    color: colors.primary500,
  },
  metaBox: {
    width: '100%',
    backgroundColor: colors.background,
    borderRadius: radius.lg,
    padding: 14,
    marginBottom: 16,
    gap: 8,
  },
  metaText: {
    fontSize: fontSize.sm,
    color: colors.primary,
    fontFamily: fontFamily.medium,
    fontWeight: fontWeight.medium,
  },
  messageBox: {
    width: '100%',
    backgroundColor: colors.accent50,
    borderWidth: 1,
    borderColor: colors.accent100,
    borderRadius: radius.lg,
    padding: 16,
    marginBottom: 24,
  },
  messageLabel: {
    fontSize: fontSize.xs,
    fontFamily: fontFamily.bold,
    fontWeight: fontWeight.bold,
    color: colors.accent700,
    marginBottom: 6,
  },
  messageText: {
    fontSize: fontSize.sm,
    color: colors.primary,
    fontFamily: fontFamily.regular,
    lineHeight: 20,
    fontStyle: 'italic',
  },
  emptyMessageBox: {
    width: '100%',
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 24,
  },
  emptyMessageText: {
    fontSize: fontSize.sm,
    color: colors.primary500,
    fontFamily: fontFamily.medium,
  },
  buttonRow: {
    flexDirection: 'row',
    width: '100%',
    gap: 10,
  },
  btn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.sm,
  },
  btnReject: {
    backgroundColor: colors.primary100,
  },
  btnRejectText: {
    fontSize: fontSize.sm,
    fontFamily: fontFamily.bold,
    fontWeight: fontWeight.bold,
    color: colors.primary500,
  },
  btnAccept: {
    backgroundColor: colors.accent,
  },
  btnAcceptText: {
    fontSize: fontSize.sm,
    fontFamily: fontFamily.bold,
    fontWeight: fontWeight.bold,
    color: colors.surface,
  },
  errorText: {
    fontSize: fontSize.sm,
    color: colors.primary500,
    fontFamily: fontFamily.regular,
    textAlign: 'center',
    marginBottom: 16,
  },
});
