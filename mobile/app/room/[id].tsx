// 🚀 챌린지 방 — 인증 피드 단일 화면 (MVP_SCOPE: 5탭 X)
import React, { useMemo, useState } from 'react';
import { View, Text, Pressable, FlatList, StyleSheet, Share, Alert } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Screen } from '@/components/Screen';
import { colors, fontFamily, fontSize, fontWeight, radius, shadow } from '@/lib/tokens';
import {
  challenges, members, proofs as seedProofs, Proof, currentUser,
} from '@/lib/dummyData';

export default function ChallengeRoom() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const challenge = useMemo(() => challenges.find(c => c.id === id), [id]);

  // 로컬 상태 (Week 2 에서 Supabase realtime 으로 교체)
  const [proofList, setProofList] = useState<Proof[]>(
    seedProofs.filter(p => p.challengeId === id),
  );

  if (!challenge) {
    return (
      <Screen>
        <View style={styles.notFound}>
          <Text>챌린지를 찾을 수 없어요.</Text>
        </View>
      </Screen>
    );
  }

  const todayChecked = members.find(m => m.id === currentUser.id)?.todayChecked ?? false;

  const onCheer = (proofId: string) => {
    setProofList(prev =>
      prev.map(p =>
        p.id === proofId
          ? {
              ...p,
              cheeredByMe: !p.cheeredByMe,
              cheerCount: p.cheerCount + (p.cheeredByMe ? -1 : 1),
            }
          : p,
      ),
    );
  };

  const onShareInvite = async () => {
    try {
      // 더미 링크 (Week 2 에서 실제 dynamic link 로 교체)
      const link = `https://dohada.app/invite/${challenge.id}`;
      await Share.share({
        message: `"${challenge.title}" 챌린지에 함께해요!\n${link}`,
      });
    } catch (e) {
      Alert.alert('공유 실패', '다시 시도해주세요.');
    }
  };

  return (
    <Screen backgroundColor={colors.background}>
      {/* 헤더 */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Text style={styles.back}>←</Text>
        </Pressable>
        <View style={{ flex: 1, marginHorizontal: 12 }}>
          <Text style={styles.title} numberOfLines={1}>{challenge.title}</Text>
          <Text style={styles.subtitle}>
            {challenge.memberCount}명 함께 도전 중
          </Text>
        </View>
        <Pressable onPress={onShareInvite} hitSlop={12}>
          <Text style={styles.share}>초대</Text>
        </Pressable>
      </View>

      {/* 멤버 리스트 (화면 상단에 작게) */}
      <View style={styles.memberStrip}>
        <FlatList
          data={members}
          keyExtractor={m => m.id}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 24, gap: 12 }}
          renderItem={({ item }) => (
            <View style={styles.member}>
              <View style={[
                styles.memberAvatar,
                item.todayChecked && styles.memberAvatarChecked,
              ]}>
                <Text style={{ fontSize: 20 }}>{item.avatar}</Text>
              </View>
              <Text style={styles.memberName} numberOfLines={1}>
                {item.nickname}
              </Text>
            </View>
          )}
        />
      </View>

      {/* 인증 피드 */}
      <FlatList
        data={proofList}
        keyExtractor={p => p.id}
        contentContainerStyle={styles.feed}
        renderItem={({ item }) => (
          <ProofCard proof={item} onCheer={() => onCheer(item.id)} />
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyEmoji}>📸</Text>
            <Text style={styles.emptyText}>
              아직 인증이 없어요.{'\n'}오늘 첫 인증의 주인공이 되어볼까요?
            </Text>
          </View>
        }
      />

      {/* 인증하기 FAB */}
      <Pressable
        style={[
          styles.fab,
          todayChecked && styles.fabDone,
        ]}
        onPress={() =>
          todayChecked
            ? Alert.alert('오늘 인증 완료', '내일 다시 만나요.')
            : router.push(`/checkin/${challenge.id}`)
        }
      >
        <Text style={styles.fabLabel}>
          {todayChecked ? '✓ 오늘 인증 완료' : '📸 오늘 인증하기'}
        </Text>
      </Pressable>
    </Screen>
  );
}

function ProofCard({ proof, onCheer }: { proof: Proof; onCheer: () => void }) {
  return (
    <View style={styles.proofCard}>
      <View style={styles.proofHeader}>
        <Text style={{ fontSize: 22 }}>{proof.authorAvatar}</Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.proofAuthor}>{proof.authorNickname}</Text>
          <Text style={styles.proofTime}>{formatTime(proof.createdAt)}</Text>
        </View>
      </View>

      <View style={styles.proofPhoto}>
        <Text style={{ fontSize: 96 }}>{proof.photoUrl}</Text>
      </View>

      <Text style={styles.proofCaption}>{proof.caption}</Text>

      <View style={styles.proofFooter}>
        <Pressable style={styles.cheerBtn} onPress={onCheer} hitSlop={6}>
          <Text style={[
            styles.cheerIcon,
            proof.cheeredByMe && styles.cheerIconOn,
          ]}>
            ❤
          </Text>
          <Text style={[
            styles.cheerCount,
            proof.cheeredByMe && styles.cheerCountOn,
          ]}>
            {proof.cheerCount}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `오늘 ${hh}:${mm}`;
}

const styles = StyleSheet.create({
  header: {
    height: 56,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.primary100,
    backgroundColor: colors.surface,
  },
  back: {
    fontSize: 24,
    color: colors.primary,
    paddingHorizontal: 8,
    fontWeight: fontWeight.medium,
  },
  title: {
    fontSize: fontSize.lg,
    color: colors.primary,
    fontFamily: fontFamily.bold,
    fontWeight: fontWeight.bold,
  },
  subtitle: {
    fontSize: fontSize.xs,
    color: colors.primary500,
    fontFamily: fontFamily.regular,
    marginTop: 2,
  },
  share: {
    fontSize: fontSize.base,
    color: colors.accent,
    fontFamily: fontFamily.bold,
    fontWeight: fontWeight.bold,
    paddingHorizontal: 8,
  },
  memberStrip: {
    paddingVertical: 16,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.primary100,
  },
  member: {
    alignItems: 'center',
    gap: 6,
    width: 56,
  },
  memberAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary50,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  memberAvatarChecked: {
    borderColor: colors.accent,
  },
  memberName: {
    fontSize: fontSize.xs,
    color: colors.primary500,
    fontFamily: fontFamily.regular,
  },
  feed: {
    padding: 16,
    paddingBottom: 120,
    gap: 16,
  },
  proofCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: 16,
    gap: 12,
    ...shadow.sm,
  },
  proofHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  proofAuthor: {
    fontSize: fontSize.base,
    color: colors.primary,
    fontFamily: fontFamily.bold,
    fontWeight: fontWeight.bold,
  },
  proofTime: {
    fontSize: fontSize.xs,
    color: colors.primary500,
    fontFamily: fontFamily.regular,
    marginTop: 2,
  },
  proofPhoto: {
    height: 240,
    backgroundColor: colors.primary50,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  proofCaption: {
    fontSize: fontSize.base,
    color: colors.primary,
    fontFamily: fontFamily.regular,
    lineHeight: 22,
  },
  proofFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 4,
  },
  cheerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
  },
  cheerIcon: {
    fontSize: 22,
    color: colors.primary300,
  },
  cheerIconOn: {
    color: colors.danger,
  },
  cheerCount: {
    fontSize: fontSize.base,
    color: colors.primary500,
    fontFamily: fontFamily.medium,
    fontWeight: fontWeight.medium,
  },
  cheerCountOn: {
    color: colors.danger,
    fontWeight: fontWeight.bold,
  },
  empty: {
    paddingVertical: 80,
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
    left: 24,
    right: 24,
    paddingVertical: 18,
    backgroundColor: colors.accent,
    borderRadius: radius.pill,
    alignItems: 'center',
    ...shadow.lg,
  },
  fabDone: {
    backgroundColor: colors.success,
  },
  fabLabel: {
    color: colors.surface,
    fontSize: fontSize.lg,
    fontFamily: fontFamily.bold,
    fontWeight: fontWeight.bold,
  },
  notFound: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
