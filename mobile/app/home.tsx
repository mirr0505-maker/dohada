// 🚀 홈 화면 — 내 챌린지 리스트 + 챌린지 만들기 진입점
import React from 'react';
import { View, Text, Pressable, FlatList, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { Screen } from '@/components/Screen';
import { colors, fontFamily, fontSize, fontWeight, radius, shadow } from '@/lib/tokens';
import { challenges, currentUser, Challenge } from '@/lib/dummyData';

export default function HomeScreen() {
  return (
    <Screen backgroundColor={colors.background}>
      {/* 헤더 */}
      <View style={styles.header}>
        <View>
          <Text style={styles.hello}>안녕하세요</Text>
          <Text style={styles.nickname}>{currentUser.nickname} {currentUser.avatar}</Text>
        </View>
        <Pressable style={styles.avatar}>
          <Text style={{ fontSize: 22 }}>{currentUser.avatar}</Text>
        </Pressable>
      </View>

      {/* 챌린지 리스트 */}
      <FlatList
        data={challenges}
        keyExtractor={c => c.id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <Text style={styles.sectionTitle}>참여 중인 챌린지 {challenges.length}</Text>
        }
        renderItem={({ item }) => <ChallengeCard challenge={item} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyEmoji}>🌱</Text>
            <Text style={styles.emptyText}>아직 챌린지가 없어요.{'\n'}첫 챌린지를 만들어볼까요?</Text>
          </View>
        }
      />

      {/* 챌린지 만들기 FAB */}
      <Pressable style={styles.fab} onPress={() => router.push('/create')}>
        <Text style={styles.fabPlus}>＋</Text>
        <Text style={styles.fabLabel}>챌린지 만들기</Text>
      </Pressable>
    </Screen>
  );
}

function ChallengeCard({ challenge }: { challenge: Challenge }) {
  const daysLeft = computeDaysLeft(challenge.endDate);
  return (
    <Pressable
      style={styles.card}
      onPress={() => router.push(`/room/${challenge.id}`)}
    >
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle} numberOfLines={1}>{challenge.title}</Text>
        <View style={styles.daysBadge}>
          <Text style={styles.daysBadgeText}>D-{daysLeft}</Text>
        </View>
      </View>
      <Text style={styles.cardDesc} numberOfLines={2}>{challenge.description}</Text>
      <View style={styles.cardFooter}>
        <Text style={styles.cardMeta}>👥 {challenge.memberCount}명</Text>
        <Text style={styles.cardMeta}>
          {challenge.startDate.slice(5)} ~ {challenge.endDate.slice(5)}
        </Text>
      </View>
    </Pressable>
  );
}

function computeDaysLeft(endDate: string): number {
  const end = new Date(endDate + 'T23:59:59');
  const now = new Date();
  const ms = end.getTime() - now.getTime();
  return Math.max(0, Math.ceil(ms / 86_400_000));
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 24,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  hello: {
    fontSize: fontSize.sm,
    color: colors.primary500,
    fontFamily: fontFamily.regular,
  },
  nickname: {
    fontSize: fontSize['2xl'],
    color: colors.primary,
    fontFamily: fontFamily.bold,
    fontWeight: fontWeight.bold,
    letterSpacing: -0.4,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.primary100,
  },
  list: {
    paddingHorizontal: 24,
    paddingBottom: 120,
    gap: 12,
  },
  sectionTitle: {
    fontSize: fontSize.base,
    color: colors.primary500,
    fontFamily: fontFamily.medium,
    fontWeight: fontWeight.semibold,
    marginBottom: 8,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: 16,
    gap: 8,
    ...shadow.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  cardTitle: {
    flex: 1,
    fontSize: fontSize.lg,
    color: colors.primary,
    fontFamily: fontFamily.bold,
    fontWeight: fontWeight.bold,
  },
  daysBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: colors.accent50,
    borderRadius: radius.pill,
  },
  daysBadgeText: {
    fontSize: fontSize.xs,
    color: colors.accent700,
    fontFamily: fontFamily.bold,
    fontWeight: fontWeight.bold,
  },
  cardDesc: {
    fontSize: fontSize.sm,
    color: colors.primary500,
    fontFamily: fontFamily.regular,
    lineHeight: 18,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  cardMeta: {
    fontSize: fontSize.xs,
    color: colors.primary500,
    fontFamily: fontFamily.regular,
  },
  empty: {
    paddingVertical: 64,
    alignItems: 'center',
    gap: 16,
  },
  emptyEmoji: { fontSize: 64 },
  emptyText: {
    fontSize: fontSize.base,
    color: colors.primary500,
    fontFamily: fontFamily.regular,
    textAlign: 'center',
    lineHeight: 22,
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: colors.accent,
    borderRadius: radius.pill,
    ...shadow.lg,
  },
  fabPlus: {
    color: colors.surface,
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
  },
  fabLabel: {
    color: colors.surface,
    fontSize: fontSize.base,
    fontFamily: fontFamily.bold,
    fontWeight: fontWeight.bold,
  },
});
