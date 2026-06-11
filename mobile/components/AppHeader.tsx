// 🚀 통합 헤더 — 4개 하단 탭 (홈/내챌린지/둘러보기/내정보) 공통
// 로고 + 닉네임 + 알람 + 아바타 (탭 → 내정보)
// 닉네임/아바타는 매 화면 진입 시 fetchMyProfile 로 동기화 (수정 시 즉시 반영).
// 벨 = 알림함: 폰 푸시와 동일 소스(notification_queue). dot 은 마지막 확인 이후 새 알림이 있을 때만.
// 푸시 탭 시 _layout 이 /(tabs)/home?bell=<ts> 로 보내면 알림함이 자동으로 열림.
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Image, Modal, ScrollView, useWindowDimensions } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store';
import { colors, fontFamily, fontSize, fontWeight, radius, shadow } from '@/lib/tokens';
import { useSession } from '@/lib/session';
import { fetchMyProfile, fetchMyNotifications, type MyNotification } from '@/lib/db';
import { notificationRoute } from '@/lib/push';
import { haptic } from '@/lib/haptics';
import { BrandMark } from '@/components/BrandMark';

const BELL_SEEN_KEY = 'bell_seen_at';   // 알림함 마지막 확인 시각 (디바이스 로컬)

// 알림 kind → 행 제목
const KIND_LABEL: Record<string, string> = {
  chat: '💬 새 대화',
  comment: '💬 인증 댓글',
  log_comment: '📝 기록 댓글',
  cheer_batch: '💛 응원',
  log_like_batch: '💚 기록 좋아요',
  creator_notice: '📢 개설자 공지',
  proof: '📸 동료 인증',
  log: '🎥 새 기록',
};

export function AppHeader() {
  const session = useSession();
  const { height: winHeight } = useWindowDimensions();   // 알림함 목록 높이 — 화면 비례
  const myUserId = session?.user?.id;
  const [nickname, setNickname] = useState<string>('도전자');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  // 🚀 알림함 모달 + dot
  const [modalVisible, setModalVisible] = useState(false);
  const [notifs, setNotifs] = useState<MyNotification[]>([]);
  const [bellDot, setBellDot] = useState(false);

  // 매 화면 진입 시 갱신 — 닉네임/아바타 동기화 + 알림함/dot 갱신
  useFocusEffect(
    useCallback(() => {
      if (!myUserId || myUserId === 'dev') return;
      fetchMyProfile(myUserId)
        .then(p => { setNickname(p.nickname); setAvatarUrl(p.avatar_url); })
        .catch(() => {});
      fetchMyNotifications(myUserId)
        .then(async list => {
          setNotifs(list);
          try {
            const seen = await SecureStore.getItemAsync(BELL_SEEN_KEY);
            const newest = list[0]?.created_at;
            setBellDot(Boolean(newest && (!seen || Date.parse(newest) > Date.parse(seen))));
          } catch {
            setBellDot(false);   // 확인 실패 시 dot 표시 안 함 (가짜 알림 방지 우선)
          }
        })
        .catch(() => {});
    }, [myUserId]),
  );

  // 알림함 열기 — 여는 순간 "확인"으로 기록하고 dot 해제
  const openBell = useCallback(() => {
    setModalVisible(true);
    setBellDot(false);
    SecureStore.setItemAsync(BELL_SEEN_KEY, new Date().toISOString()).catch(() => {});
  }, []);

  // 🚀 푸시 탭 진입: _layout 이 ?bell=<timestamp> 를 붙여 홈으로 보냄 → 알림함 자동 오픈
  const { bell } = useLocalSearchParams<{ bell?: string }>();
  useEffect(() => {
    if (bell) openBell();
  }, [bell, openBell]);

  return (
    <View style={styles.header}>
      {/* 좌: 로고 + Do:하다 (한 텍스트 라인) */}
      <View style={styles.brand}>
        <BrandMark size="md" color={colors.accent} />
        <Text style={styles.brandText}>
          Do<Text style={styles.brandColon}>:</Text>하다
        </Text>
      </View>

      {/* 우: 알림 + 아바타 */}
      <View style={styles.rightGroup}>
        <Pressable
          style={styles.headerIcon}
          onPress={() => { haptic.tap(); openBell(); }}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel={bellDot ? '알림함 — 새 알림 있음' : '알림함'}
        >
          <Ionicons name="notifications-outline" size={20} color={colors.primary} />
          {/* 🚀 조용한 알림 Dot — 마지막 확인 이후 새 알림이 있을 때만 (숫자 X, 점 하나) */}
          {bellDot && <View style={styles.badgeDot} />}
        </Pressable>
        <Pressable
          onPress={() => { haptic.tap(); router.push('/(tabs)/profile' as any); }}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel="내 정보"
        >
          {avatarUrl ? (
            <Image source={{ uri: avatarUrl }} style={styles.headerAvatar} />
          ) : (
            <View style={[styles.headerAvatar, styles.headerAvatarFallback]}>
              <Text style={styles.headerAvatarInit}>{nickname.slice(0, 1)}</Text>
            </View>
          )}
        </Pressable>
      </View>

      {/* 🚀 알림함 모달 — 푸시와 동일한 알림 목록. 행 탭 → 해당 내용(탭)으로 딥링크 */}
      <Modal
        visible={modalVisible}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>🔔 알림</Text>

            {notifs.length === 0 ? (
              <Text style={styles.newsEmpty}>
                아직 알림이 없어요.{'\n'}오늘도 조용히, 각자의 한 걸음.
              </Text>
            ) : (
              <ScrollView style={{ maxHeight: Math.round(winHeight * 0.5) }} contentContainerStyle={{ gap: 8 }}>
                {notifs.map(n => (
                  <Pressable
                    key={n.id}
                    style={styles.newsRow}
                    onPress={() => {
                      if (!n.challenge_id) return;
                      haptic.tap();
                      setModalVisible(false);
                      // 행 탭 → 해당 인증/기록 카드로 스크롤 포커스, 댓글 알림은 댓글 시트까지 자동 오픈
                      router.push(notificationRoute(n.kind, n.challenge_id, { proofId: n.proof_id, logId: n.log_id }) as any);
                    }}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.newsTitle} numberOfLines={1}>
                        {KIND_LABEL[n.kind] ?? '🔔 알림'}{n.count > 1 ? ` ${n.count}건` : ''}
                      </Text>
                      {n.challenge_title ? (
                        <Text style={styles.newsChallenge} numberOfLines={1}>📍 {n.challenge_title}</Text>
                      ) : null}
                      <Text style={styles.newsTags} numberOfLines={2}>
                        {n.count > 1
                          ? (n.kind === 'cheer_batch' ? `동료 ${n.count}명이 응원해줬어요` : `동료 ${n.count}명이 좋아요를 남겼어요`)
                          : (n.preview ?? '')}
                      </Text>
                    </View>
                    <Text style={styles.newsTime}>{formatNotifTime(n.created_at)}</Text>
                    <Text style={styles.newsArrow}>→</Text>
                  </Pressable>
                ))}
              </ScrollView>
            )}

            <View style={styles.modalInfoBox}>
              <Text style={styles.modalInfoText}>
                조용한 알림 원칙 — 숫자 대신 점 하나. 밤 10시~아침 6시의 푸시는 아침 6시에 모아 보내드려요.
              </Text>
            </View>

            <Pressable
              style={styles.modalCloseBtn}
              onPress={() => { haptic.tap(); setModalVisible(false); }}
            >
              <Text style={styles.modalCloseBtnText}>확인</Text>
            </Pressable>
          </View>
        </View>
      </Modal>


    </View>
  );
}

// 알림 시각 — 오늘이면 HH:mm, 이전이면 M/D
function formatNotifTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) {
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

const styles = StyleSheet.create({
  header: {
    position: 'relative',
    paddingHorizontal: 20,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.primary100,
    ...shadow.sm,
  },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  brandText: {
    fontSize: fontSize.xl,
    color: colors.primary,
    fontFamily: fontFamily.bold,
    fontWeight: fontWeight.bold,
    letterSpacing: -0.4,
  },
  brandColon: {
    color: colors.accent,
  },
  rightGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },

  headerIcon: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: colors.primary50,
    alignItems: 'center', justifyContent: 'center',
    position: 'relative', // 🚀 뱃지 도트 얹기 위해 포지션 추가
  },
  badgeDot: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.accent,
  },
  headerAvatar: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: colors.accent50,
    overflow: 'hidden',
  },
  headerAvatarFallback: { alignItems: 'center', justifyContent: 'center' },
  headerAvatarInit: {
    fontSize: 14,
    color: colors.accent700,
    fontFamily: fontFamily.bold,
    fontWeight: fontWeight.bold,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: 24,
    gap: 16,
    ...shadow.lg,
  },
  modalTitle: {
    fontSize: fontSize.lg,
    color: colors.primary,
    fontFamily: fontFamily.bold,
    fontWeight: fontWeight.bold,
    marginBottom: 8,
  },
  newsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: colors.primary50,
    borderRadius: radius.md,
  },
  newsTitle: {
    fontSize: fontSize.base,
    color: colors.primary,
    fontFamily: fontFamily.bold,
    fontWeight: fontWeight.bold,
  },
  newsChallenge: {
    fontSize: fontSize.xs,
    color: colors.accent700,
    fontFamily: fontFamily.medium,
    fontWeight: fontWeight.medium,
    marginTop: 2,
  },
  newsTags: {
    fontSize: fontSize.xs,
    color: colors.primary500,
    fontFamily: fontFamily.regular,
    marginTop: 2,
    lineHeight: 16,
  },
  newsTime: {
    fontSize: fontSize.xs,
    color: colors.primary500,
    fontFamily: fontFamily.regular,
  },
  newsArrow: {
    fontSize: fontSize.lg,
    color: colors.accent,
    fontFamily: fontFamily.bold,
    fontWeight: fontWeight.bold,
  },
  newsEmpty: {
    fontSize: fontSize.base,
    color: colors.primary500,
    fontFamily: fontFamily.regular,
    textAlign: 'center',
    lineHeight: 22,
    paddingVertical: 12,
  },
  modalInfoBox: {
    backgroundColor: colors.primary50,
    borderRadius: radius.md,
    padding: 12,
    marginTop: 4,
  },
  modalInfoText: {
    fontSize: 11,
    color: colors.primary500,
    fontFamily: fontFamily.regular,
    lineHeight: 16,
  },
  modalCloseBtn: {
    backgroundColor: colors.accent,
    borderRadius: radius.lg,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  modalCloseBtnText: {
    fontSize: fontSize.base,
    color: colors.surface,
    fontFamily: fontFamily.bold,
    fontWeight: fontWeight.bold,
  },
});
