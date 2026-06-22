// 🚀 완주 화면 — 챌린지 종료일이 지났고 목표 인증을 채운 경우 1회 표시
// MVP: 인증서 / 포토북은 X. 축하 화면 (celebration 모션) + 공유 + 홈으로.
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Share, Alert, ActivityIndicator } from 'react-native';
import Animated, { ZoomIn, FadeInDown, FadeInUp } from 'react-native-reanimated';
import { router, useLocalSearchParams } from 'expo-router';
import { Trophy } from 'lucide-react-native';
import { Screen } from '@/components/Screen';
import { Button } from '@/components/Button';
import { colors, fontFamily, fontSize, fontWeight, radius } from '@/lib/tokens';
import { useSession } from '@/lib/session';
import { fetchRoomData } from '@/lib/db';
import { computeProgress, memberTargetProofCount, uniqueProofDays } from '@/lib/stats';
import { fetchMyBet, isBetVisible } from '@/lib/payments';
import { haptic } from '@/lib/haptics';

export default function CompleteScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const session = useSession();
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState('');
  const [totalDays, setTotalDays] = useState(0);
  // 🚀 완주율 — 인증 일수/본인 목표 (늦합류자는 합류일 기준 비례 목표와 일관)
  const [provedDays, setProvedDays] = useState(0);
  const [targetDays, setTargetDays] = useState(0);
  const [isCount, setIsCount] = useState(false);   // 🚀 0041: 목표 횟수형이면 "개" 단위·조기 완주
  // 🎯 정산 대기(paid) 내기가 있으면 완주 화면에서 현황 탭 정산 동선 노출 (받기/기부)
  const [settleBetPending, setSettleBetPending] = useState(false);

  useEffect(() => {
    if (session === null) router.replace('/login');
  }, [session]);

  useEffect(() => {
    if (!id || !session?.user) return;
    (async () => {
      try {
        const data = await fetchRoomData(id, session.user.id);
        if (data.challenge) {
          setTitle(data.challenge.title);
          setTotalDays(computeProgress(data.challenge).totalDays);
          // 완주 판정 주체 = 본인 (cheered 응원자는 이 화면으로 redirect 되지 않음)
          const myProofs = data.proofs.filter(p => p.user_id === session.user.id);
          const myJoinedAt = data.members.find(m => m.id === session.user.id)?.joined_at ?? null;
          // 🚀 0041: count 유형은 총 인증 수 / 고정 목표, cadence 는 고유 날짜 수 / 비례 목표
          if (data.challenge.goal_type === 'count') {
            setIsCount(true);
            setProvedDays(myProofs.length);
            setTargetDays(data.challenge.target_count ?? 0);
          } else {
            setProvedDays(uniqueProofDays(myProofs));
            setTargetDays(memberTargetProofCount(data.challenge, myJoinedAt));
          }
          haptic.success();
          // 정산 대기 내기 확인 — 내기 노출 시에만 (fetchMyBet 은 RLS 로 본인 주문만). 베타엔 미노출
          if (isBetVisible()) {
            const bet = await fetchMyBet(id, session.user.id);
            if (bet && bet.status === 'paid') setSettleBetPending(true);
          }
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [id, session]);

  const completionRate = targetDays > 0 ? Math.min(100, Math.round((provedDays / targetDays) * 100)) : 100;

  const onShare = async () => {
    try {
      await Share.share({
        message: isCount
          ? `🏆 "${title}" 목표 ${targetDays}개 달성!\n\n더 나은 나, 더 나은 세상.`
          : `🏆 "${title}" 하다 ${totalDays}일 완주!\n\n더 나은 나, 더 나은 세상.`,
      });
    } catch (e) {
      Alert.alert('공유 실패', String(e));
    }
  };

  if (loading) {
    return (
      <Screen fullScreen backgroundColor={colors.accent} statusBarStyle="light">
        <View style={styles.center}>
          <ActivityIndicator color={colors.surface} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen fullScreen backgroundColor={colors.accent} statusBarStyle="light">
      <View style={styles.center}>
        {/* 🚀 celebration — 핵심 성취 순간에만 모션 집중 (조용한 SNS 원칙과 충돌 X) */}
        <Animated.View entering={ZoomIn.springify().delay(100)} style={styles.trophy}>
          <Trophy size={80} color={colors.surface} strokeWidth={1.5} />
        </Animated.View>
        <Animated.Text entering={FadeInDown.springify().delay(300)} style={styles.title}>완주!</Animated.Text>
        <Animated.Text entering={FadeInDown.springify().delay(420)} style={styles.challengeName}>"{title}"</Animated.Text>
        <Animated.Text entering={FadeInDown.springify().delay(540)} style={styles.days}>
          {isCount ? `목표 ${targetDays}개를 달성했어요` : `${totalDays}일을 끝까지 해냈어요`}
        </Animated.Text>
        {/* 🚀 완주율 — 가부만이 아니라 숫자로 성취를 보여줌 (목표 = 본인 합류일 기준) */}
        {targetDays > 0 && (
          <Animated.Text entering={FadeInDown.springify().delay(620)} style={styles.rate}>
            {isCount
              ? `인증 ${provedDays}개 / 목표 ${targetDays}개 · 완주율 ${completionRate}%`
              : `인증 ${provedDays}일 / 목표 ${targetDays}일 · 완주율 ${completionRate}%`}
          </Animated.Text>
        )}

        <Animated.View entering={FadeInUp.springify().delay(700)} style={styles.sloganBox}>
          <Text style={styles.slogan}>더 나은 나, 더 나은 세상</Text>
          <Text style={styles.sloganSub}>내가 하는 것이 나와 세상을 바꿨다</Text>
        </Animated.View>
      </View>

      <Animated.View entering={FadeInUp.delay(900)} style={styles.bottom}>
        <Button label="기록 공유하기" size="xl" block onPress={onShare} />
        {/* 🎯 걸어둔 한잔 정산 — 완주 직후 발견성. 현황 탭의 내기 카드로 (받기/기부 선택) */}
        {settleBetPending && (
          <Button
            label="내기 정산하러 가기"
            variant="secondary"
            size="lg"
            block
            onPress={() => router.replace(`/room/${id}?tab=status` as any)}
          />
        )}
        {/* 🚀 완주 방(박제)으로 돌아가는 길 — 이 버튼이 없으면 완주 방 진입 동선이 끊김 */}
        <Button
          label="박제 보러 가기"
          variant="ghost"
          size="lg"
          block
          onPress={() => router.replace(`/room/${id}?tab=archive` as any)}
        />
        <Button
          label="홈으로"
          variant="ghost"
          size="lg"
          block
          onPress={() => router.replace('/home')}
        />
      </Animated.View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 12,
  },
  trophy: { marginBottom: 16 },
  title: {
    fontSize: 56,
    color: colors.surface,
    fontFamily: fontFamily.bold,
    fontWeight: fontWeight.extrabold,
    letterSpacing: -1,
  },
  challengeName: {
    fontSize: fontSize.xl,
    color: colors.surface,
    fontFamily: fontFamily.medium,
    textAlign: 'center',
    marginTop: 8,
  },
  days: {
    fontSize: fontSize.base,
    color: 'rgba(255,255,255,0.85)',
    fontFamily: fontFamily.regular,
    marginTop: 4,
  },
  rate: {
    fontSize: fontSize.sm,
    color: 'rgba(255,255,255,0.95)',
    fontFamily: fontFamily.bold,
    fontWeight: fontWeight.bold,
    marginTop: 2,
  },
  sloganBox: {
    marginTop: 32,
    padding: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: radius.lg,
    alignItems: 'center',
    gap: 4,
  },
  slogan: {
    fontSize: fontSize.lg,
    color: colors.surface,
    fontFamily: fontFamily.bold,
    fontWeight: fontWeight.bold,
    letterSpacing: -0.3,
  },
  sloganSub: {
    fontSize: fontSize.sm,
    color: 'rgba(255,255,255,0.85)',
    fontFamily: fontFamily.regular,
  },
  bottom: {
    padding: 24,
    paddingBottom: 40,
    gap: 8,
  },
});
