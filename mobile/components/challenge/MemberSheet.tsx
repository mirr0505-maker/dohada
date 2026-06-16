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
  memberCount: number;   // 🚀 실제 참가자 수 (프로필 가시성과 분리 — 비멤버도 정확한 인원 표시)
  isMember: boolean;     // 🚀 비멤버는 동료 명단(이름) 비공개 — 인원 수만 노출 (현황 탭 잠금과 동일 기준)
  myUserId: string | undefined;
  creatorId: string;
  onBlock?: (userId: string, nickname: string) => void;   // 🚀 3b: 차단 (부모가 confirm+차단+새로고침)
};

export function MemberSheet({
  visible,
  onClose,
  members,
  memberCount,
  isMember,
  myUserId,
  creatorId,
  onBlock,
}: Props) {
  // 포기한 멤버는 조용한 보관 — 활성 명단에서 제외 (헤더 memberCount 와 동일 기준)
  // 본인을 맨 위로, 나머지는 가입 순
  const ordered = members
    .filter(m => !m.gave_up_at)
    .sort((a, b) => {
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
            <Text style={styles.title}>함께하는 동료 {memberCount}명</Text>
            <Pressable onPress={onClose} hitSlop={12}>
              <Text style={styles.close}>닫기</Text>
            </Pressable>
          </View>

          {/* 🚀 비멤버는 동료 명단 비공개 — 인원 수만 보고 합류 유도 (현황 탭 잠금과 동일 기준) */}
          {!isMember ? (
            <View style={styles.guestNote}>
              <Text style={styles.guestNoteText}>
                합류하면 함께하는 동료들을 볼 수 있어요.
              </Text>
            </View>
          ) : (
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
                  {!isMe && onBlock && (
                    <Pressable onPress={() => onBlock(item.id, item.nickname)} hitSlop={8}>
                      <Text style={styles.blockBtn}>차단</Text>
                    </Pressable>
                  )}
                </View>
              );
            }}
          />
          )}
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
  guestNote: {
    paddingHorizontal: 24,
    paddingVertical: 28,
    alignItems: 'center',
  },
  guestNoteText: {
    fontSize: fontSize.sm,
    color: colors.primary500,
    fontFamily: fontFamily.regular,
    textAlign: 'center',
  },
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
  blockBtn: {
    fontSize: fontSize.xs,
    color: colors.primary500,
    fontFamily: fontFamily.medium,
    fontWeight: fontWeight.medium,
    textDecorationLine: 'underline',
    paddingHorizontal: 6,
  },
});
