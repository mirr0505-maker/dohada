// 🚀 챌린지방 헤더 stacked avatars 탭 → 멤버 시트
// 가입 순 정렬 (시간의 흐름 — 비교 압박 회피, MVP_SCOPE 3.7.5).
// 각 멤버: 아바타 + 닉네임 + 오늘 인증 / 잠시 멈춤 상태.
import React from 'react';
import {
  View, Text, Modal, Pressable, FlatList, StyleSheet, Image
} from 'react-native';
import type { MemberWithToday } from '@/lib/types';
import { colors, fontFamily, fontSize, fontWeight, radius } from '@/lib/tokens';

type Props = {
  visible: boolean;
  onClose: () => void;
  members: MemberWithToday[];
  myUserId: string | undefined;
  creatorId: string;
};

export function MemberSheet({
  visible,
  onClose,
  members,
  myUserId,
  creatorId,
}: Props) {
  // 본인을 맨 위로, 나머지는 가입 순
  const ordered = [...members].sort((a, b) => {
    if (a.id === myUserId) return -1;
    if (b.id === myUserId) return 1;
    return (a.joined_at ?? '').localeCompare(b.joined_at ?? '');
  });

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <Text style={styles.title}>함께하는 동료 {members.length}명</Text>
            <Pressable onPress={onClose} hitSlop={12}>
              <Text style={styles.close}>닫기</Text>
            </Pressable>
          </View>
          
          <FlatList
            data={ordered}
            keyExtractor={m => m.id}
            contentContainerStyle={styles.list}
            renderItem={({ item }) => {
              const isMe = item.id === myUserId;
              const isCreator = item.id === creatorId;
              const paused = isPaused(item.paused_until);
              return (
                <View style={[styles.row, isMe && styles.rowMine]}>
                  <View style={[styles.avatar, item.today_checked && styles.avatarChecked, paused && { opacity: 0.5 }]}>
                    {item.avatar_url ? (
                      <Image source={{ uri: item.avatar_url }} style={styles.avatarImg} />
                    ) : (
                      <Text style={{ fontSize: 18 }}>🐰</Text>
                    )}
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={styles.nameRow}>
                      <Text style={styles.name} numberOfLines={1}>
                        {item.nickname}{isMe ? ' (나)' : ''}
                      </Text>
                      {isCreator && (
                        <View style={styles.creatorBadge}>
                          <Text style={styles.creatorBadgeText}>👑 개설자</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.status}>
                      {paused ? '⏸ 잠시 멈춤 중' : item.today_checked ? '✓ 오늘 인증' : '오늘 미인증'}
                    </Text>
                  </View>
                </View>
              );
            }}
          />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function isPaused(pausedUntil: string | null): boolean {
  if (!pausedUntil) return false;
  return new Date().toISOString().slice(0, 10) <= pausedUntil;
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
    maxHeight: '75%',
    paddingBottom: 24,
  },
  handle: {
    alignSelf: 'center',
    width: 36, height: 4,
    backgroundColor: colors.primary100,
    borderRadius: 2,
    marginTop: 10, marginBottom: 4,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.primary100,
  },
  title: {
    fontSize: fontSize.lg,
    color: colors.primary,
    fontFamily: fontFamily.bold,
    fontWeight: fontWeight.bold,
  },
  close: {
    fontSize: fontSize.base,
    color: colors.primary500,
    fontFamily: fontFamily.medium,
  },
  list: { paddingHorizontal: 20, paddingTop: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.primary50,
  },
  rowMine: {
    backgroundColor: colors.accent50,
    marginHorizontal: -8,
    paddingHorizontal: 8,
    borderRadius: radius.md,
    borderBottomWidth: 0,
  },
  avatar: {
    width: 44, height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary50,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
    overflow: 'hidden',
  },
  avatarChecked: { borderColor: colors.accent },
  avatarImg: { width: '100%', height: '100%' },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  name: {
    fontSize: fontSize.base,
    color: colors.primary,
    fontFamily: fontFamily.bold,
    fontWeight: fontWeight.bold,
  },
  creatorBadge: {
    backgroundColor: colors.primary100,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
  creatorBadgeText: {
    fontSize: 10,
    color: colors.primary700,
    fontFamily: fontFamily.bold,
    fontWeight: fontWeight.bold,
  },
  status: {
    fontSize: fontSize.xs,
    color: colors.primary500,
    fontFamily: fontFamily.regular,
    marginTop: 2,
  },
});
