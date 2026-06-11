// 🚀 홈 v2.3 — 분류별 챌린지 카드 (4 variants)
// 같은 앱 안의 4개 다른 SNS 톤을 시각으로 분리:
//   🤫 Solo     — 사적 일기 (미니멀, 회색)
//   🙋 Cheered  — 도전자 무대 (받은 응원 강조, 노랑)
//   🤝 Closed   — 친밀 모임 (동료 아바타, 오렌지)
//   🌍 Open     — 광장 (사회공헌면 초록, 일반이면 오렌지+멤버수)
import React from 'react';
import { View, Text, Pressable, StyleSheet, Image } from 'react-native';
import { router } from 'expo-router';
import { colors, fontFamily, fontSize, fontWeight, radius, shadow } from '@/lib/tokens';
import { haptic } from '@/lib/haptics';
import { formatCheerCount } from '@/lib/format';
import type { MyChallengeDetail } from '@/lib/db';

export function MyChallengeCard({ challenge }: { challenge: MyChallengeDetail }) {
  const onPress = () => { haptic.tap(); router.push(`/room/${challenge.id}` as any); };

  if (challenge.kind === 'solo')    return <SoloCard challenge={challenge} onPress={onPress} />;
  if (challenge.kind === 'cheered') return <CheeredCard challenge={challenge} onPress={onPress} />;
  if (challenge.kind === 'open')    return <OpenCard challenge={challenge} onPress={onPress} />;
  return <ClosedCard challenge={challenge} onPress={onPress} />;
}

// ─── 🤫 Solo — 미니멀, 조용한 자기와의 약속 ───────────
function SoloCard({ challenge, onPress }: { challenge: MyChallengeDetail; onPress: () => void }) {
  const { progress, dayN, totalDays, daysLeft } = computeProgress(challenge.start_date, challenge.end_date);
  return (
    <Pressable style={styles.cardBase} onPress={onPress}>
      <View style={styles.row}>
        <Text style={styles.titleQuiet} numberOfLines={1}>{challenge.title}</Text>
        <Text style={styles.ddayQuiet}>D-{daysLeft}</Text>
      </View>
      <Text style={styles.metaQuiet}>혼자만의 다짐 · {dayN}/{totalDays}일</Text>
      <View style={styles.trackQuiet}>
        <View style={[styles.fill, { width: `${progress * 100}%`, backgroundColor: colors.primary500 }]} />
      </View>
    </Pressable>
  );
}

// ─── 🙋 Cheered — 받은 응원 강조, 응원자 아바타 ──────
function CheeredCard({ challenge, onPress }: { challenge: MyChallengeDetail; onPress: () => void }) {
  const { progress, dayN, totalDays, daysLeft } = computeProgress(challenge.start_date, challenge.end_date);
  const cheers = challenge.my_cheers_count;
  return (
    <Pressable style={[styles.cardBase, styles.cardCheered]} onPress={onPress}>
      <View style={styles.row}>
        <Text style={styles.title} numberOfLines={1}>{challenge.title}</Text>
        <Text style={styles.dday}>D-{daysLeft}</Text>
      </View>
      <View style={styles.cheerRow}>
        <Text style={styles.cheerHeart}>💛</Text>
        <Text style={styles.cheerText}>
          {cheers > 0 ? `응원 ${formatCheerCount(cheers)}개 받았어요` : '응원자들이 기다리고 있어요'}
        </Text>
      </View>
      {challenge.top_members.length > 1 && (
        <StackedAvatars members={challenge.top_members.slice(1)} max={4} />
      )}
      <Text style={styles.metaSmall}>응원받는 도전 · {dayN}/{totalDays}일</Text>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${progress * 100}%`, backgroundColor: colors.accent }]} />
      </View>
    </Pressable>
  );
}

// ─── 🤝 Closed — 동료 아바타 + 오늘 인증 N/M ─────────
function ClosedCard({ challenge, onPress }: { challenge: MyChallengeDetail; onPress: () => void }) {
  const { progress, dayN, totalDays, daysLeft } = computeProgress(challenge.start_date, challenge.end_date);
  const todayN = challenge.today_check_count;
  const total  = Math.max(1, challenge.member_count);
  return (
    <Pressable style={styles.cardBase} onPress={onPress}>
      <View style={styles.row}>
        <Text style={styles.title} numberOfLines={1}>{challenge.title}</Text>
        <Text style={styles.dday}>D-{daysLeft}</Text>
      </View>
      <View style={styles.memberRow}>
        <StackedAvatars members={challenge.top_members} max={5} />
        <Text style={styles.todayText}>
          {todayN > 0 ? `오늘 ${todayN}/${total} 인증` : `오늘 0/${total} 시작 전`}
        </Text>
      </View>
      <Text style={styles.metaSmall}>함께 도전 · {dayN}/{totalDays}일</Text>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${progress * 100}%`, backgroundColor: colors.accent }]} />
      </View>
    </Pressable>
  );
}

// ─── 🌍 Open — 사회공헌면 초록, 일반이면 오렌지 ─────────
function OpenCard({ challenge, onPress }: { challenge: MyChallengeDetail; onPress: () => void }) {
  const { progress, dayN, totalDays, daysLeft } = computeProgress(challenge.start_date, challenge.end_date);
  const isImpact = challenge.is_impact;
  const fill = isImpact ? colors.success : colors.accent;
  return (
    <Pressable style={[styles.cardBase, isImpact && styles.cardImpact]} onPress={onPress}>
      <View style={styles.row}>
        <Text style={styles.title} numberOfLines={1}>{challenge.title}</Text>
        <Text style={[styles.dday, isImpact && { color: colors.success }]}>D-{daysLeft}</Text>
      </View>
      {isImpact ? (
        <View style={styles.impactBanner}>
          <Text style={styles.impactBannerText}>💚 {challenge.member_count}명과 함께 만든 변화</Text>
        </View>
      ) : (
        <View style={styles.memberRow}>
          <StackedAvatars members={challenge.top_members} max={5} />
          <Text style={styles.todayText}>{challenge.member_count}명과 함께</Text>
        </View>
      )}
      <Text style={styles.metaSmall}>누구나 합류 · {dayN}/{totalDays}일</Text>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${progress * 100}%`, backgroundColor: fill }]} />
      </View>
    </Pressable>
  );
}

// ─── 공통 — Stacked Avatars (최대 N + "+N") ──────────
function StackedAvatars({
  members, max = 5,
}: {
  members: MyChallengeDetail['top_members'];
  max?: number;
}) {
  const visible = members.slice(0, max);
  const remaining = Math.max(0, members.length - max);
  if (visible.length === 0) return null;
  return (
    <View style={styles.stackedRow}>
      {visible.map((m, i) => (
        <View key={m.id} style={[styles.stackedAvatar, { marginLeft: i === 0 ? 0 : -8 }]}>
          {m.avatar_url ? (
            <Image source={{ uri: m.avatar_url }} style={styles.stackedImg} />
          ) : (
            <Text style={{ fontSize: 11 }}>🐰</Text>
          )}
        </View>
      ))}
      {remaining > 0 && (
        <View style={[styles.stackedAvatar, styles.stackedMore, { marginLeft: -8 }]}>
          <Text style={styles.stackedMoreText}>+{remaining}</Text>
        </View>
      )}
    </View>
  );
}

// ─── 유틸 ──────────────────────────────────────────
function computeProgress(start: string, end: string) {
  const startDate = new Date(start + 'T00:00:00');
  const endDate = new Date(end + 'T00:00:00');
  
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);
  const todayDate = new Date(todayStr + 'T00:00:00');

  const totalDays = Math.max(1, Math.round((endDate.getTime() - startDate.getTime()) / 86_400_000) + 1);
  const elapsed = Math.max(0, Math.round((todayDate.getTime() - startDate.getTime()) / 86_400_000));
  const dayN = Math.min(totalDays, elapsed + 1);
  const progress = Math.min(1, Math.max(0, elapsed / totalDays));
  const daysLeft = Math.max(0, Math.round((endDate.getTime() - todayDate.getTime()) / 86_400_000));

  return { dayN, totalDays, progress, daysLeft };
}

const styles = StyleSheet.create({
  cardBase: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: 14,
    gap: 8,
    ...shadow.sm,
  },
  cardCheered: {
    backgroundColor: '#FFFCF0',     // 응원받기 = 옅은 노랑 (받는 톤)
    borderWidth: 1,
    borderColor: '#F7E59C',
  },
  cardImpact: {
    backgroundColor: '#F1FBF3',     // 사회공헌 = 옅은 초록
    borderWidth: 1,
    borderColor: colors.success,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  // 강조 / 조용 (분류별 톤 차이)
  title: {
    flex: 1,
    fontSize: fontSize.base,
    color: colors.primary,
    fontFamily: fontFamily.bold,
    fontWeight: fontWeight.bold,
  },
  titleQuiet: {
    flex: 1,
    fontSize: fontSize.base,
    color: colors.primary500,        // 솔로 = 조용 톤
    fontFamily: fontFamily.medium,
    fontWeight: fontWeight.medium,
  },
  dday: {
    fontSize: fontSize.sm,
    color: colors.accent,
    fontFamily: fontFamily.bold,
    fontWeight: fontWeight.bold,
  },
  ddayQuiet: {
    fontSize: fontSize.sm,
    color: colors.primary500,
    fontFamily: fontFamily.bold,
    fontWeight: fontWeight.bold,
  },
  metaSmall: {
    fontSize: fontSize.xs,
    color: colors.primary500,
    fontFamily: fontFamily.regular,
  },
  metaQuiet: {
    fontSize: fontSize.xs,
    color: colors.primary500,
    fontFamily: fontFamily.regular,
  },
  track: {
    height: 5,
    backgroundColor: colors.primary100,
    borderRadius: 3,
    overflow: 'hidden',
    marginTop: 2,
  },
  trackQuiet: {
    height: 4,
    backgroundColor: colors.primary50,
    borderRadius: 2,
    overflow: 'hidden',
    marginTop: 2,
  },
  fill: { height: '100%', borderRadius: 3 },

  // Cheered — 응원 카운트 강조
  cheerRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  cheerHeart: { fontSize: 16 },
  cheerText: {
    fontSize: fontSize.sm,
    color: colors.accent700,
    fontFamily: fontFamily.medium,
    fontWeight: fontWeight.semibold,
  },

  // Closed/Open — 멤버 아바타 row
  memberRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  todayText: {
    fontSize: fontSize.xs,
    color: colors.primary500,
    fontFamily: fontFamily.medium,
    fontWeight: fontWeight.medium,
    flex: 1,
  },

  // Impact — 초록 배너
  impactBanner: {
    backgroundColor: '#DFF5E2',
    borderRadius: radius.md,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  impactBannerText: {
    fontSize: fontSize.xs,
    color: colors.success,
    fontFamily: fontFamily.bold,
    fontWeight: fontWeight.bold,
  },

  // Stacked avatars
  stackedRow: { flexDirection: 'row', alignItems: 'center' },
  stackedAvatar: {
    width: 24, height: 24,
    borderRadius: 12,
    backgroundColor: colors.primary50,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.surface,
    overflow: 'hidden',
  },
  stackedImg: { width: '100%', height: '100%' },
  stackedMore: { backgroundColor: colors.accent50 },
  stackedMoreText: {
    fontSize: 9,
    color: colors.accent700,
    fontFamily: fontFamily.bold,
    fontWeight: fontWeight.bold,
  },
});
