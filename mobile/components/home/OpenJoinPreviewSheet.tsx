// 🚀 누구나 합류 — 합류 전 미리보기 바텀시트
// 홈에서 "함께 합류하기"를 누르면 바로 합류 Alert 가 아니라, 이 도전이 어떤 도전인지
// (안내문 텍스트 + 이미지 + 기간·인원·개설자)를 충분히 보고 결정할 수 있게 한다.
import React from 'react';
import {
  View, Text, Pressable, Modal, StyleSheet, ScrollView, Image, ActivityIndicator,
} from 'react-native';
import { colors, fontFamily, fontSize, fontWeight, radius, shadow } from '@/lib/tokens';
import { getChallengeDDay } from '@/lib/format';
import { haptic } from '@/lib/haptics';
import type { OpenChallengeCard } from '@/lib/types';

type Props = {
  challenge: OpenChallengeCard | null;
  joining: boolean;
  onClose: () => void;
  onConfirm: () => void;
};

export function OpenJoinPreviewSheet({ challenge, joining, onClose, onConfirm }: Props) {
  const visible = challenge !== null;
  const hasIntro = !!(challenge?.description && challenge.description.trim() !== '');

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          {challenge && (
            <>
              <View style={styles.handle} />
              <ScrollView
                style={{ flexShrink: 1 }}
                contentContainerStyle={styles.scrollBody}
                showsVerticalScrollIndicator={false}
              >
                <Text style={styles.curation}>🌍 누구나 합류</Text>
                <Text style={styles.title}>{challenge.title}</Text>

                {challenge.category && (
                  <View style={styles.categoryChip}>
                    <Text style={styles.categoryText}>
                      {challenge.category.emoji} {challenge.category.name}
                    </Text>
                  </View>
                )}

                <View style={styles.metaBox}>
                  <Text style={styles.metaText}>👑 개설자: {challenge.creator?.nickname ?? '도전자'}</Text>
                  <Text style={styles.metaText}>👥 현재 {challenge.member_count}명 참여 중</Text>
                  <Text style={styles.metaText}>
                    📅 {challenge.start_date.slice(5)} ~ {challenge.end_date.slice(5)} ({getChallengeDDay(challenge.start_date, challenge.end_date)})
                  </Text>
                </View>

                {/* 안내문 — 개설자가 합류 전에 보여주려고 쓴 소개 */}
                {challenge.intro_image_url ? (
                  <Image source={{ uri: challenge.intro_image_url }} style={styles.introImage} resizeMode="cover" />
                ) : null}
                {hasIntro ? (
                  <View style={styles.introBox}>
                    <Text style={styles.introLabel}>📋 안내문</Text>
                    <Text style={styles.introText}>{challenge.description}</Text>
                  </View>
                ) : !challenge.intro_image_url ? (
                  <Text style={styles.noIntro}>개설자가 남긴 안내문이 아직 없어요.</Text>
                ) : null}
              </ScrollView>

              <View style={styles.btnRow}>
                <Pressable style={[styles.btn, styles.btnGhost]} onPress={onClose} disabled={joining}>
                  <Text style={styles.btnGhostText}>닫기</Text>
                </Pressable>
                <Pressable
                  style={[styles.btn, styles.btnPrimary, joining && styles.btnDisabled]}
                  onPress={() => { haptic.tap(); onConfirm(); }}
                  disabled={joining}
                >
                  {joining
                    ? <ActivityIndicator color={colors.surface} />
                    : <Text style={styles.btnPrimaryText}>함께 합류하기</Text>}
                </Pressable>
              </View>
            </>
          )}
        </Pressable>
      </Pressable>
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
    paddingHorizontal: 24,
    paddingTop: 10,
    paddingBottom: 32,
    maxHeight: '85%',
    ...shadow.lg,
  },
  handle: {
    alignSelf: 'center',
    width: 40, height: 4,
    borderRadius: 2,
    backgroundColor: colors.primary100,
    marginBottom: 14,
  },
  scrollBody: { gap: 10, paddingBottom: 8 },
  curation: {
    fontSize: fontSize.xs,
    fontFamily: fontFamily.bold,
    fontWeight: fontWeight.bold,
    color: colors.accent,
    letterSpacing: 0.3,
  },
  title: {
    fontSize: fontSize.xl,
    color: colors.primary,
    fontFamily: fontFamily.bold,
    fontWeight: fontWeight.bold,
    lineHeight: 28,
  },
  categoryChip: {
    alignSelf: 'flex-start',
    backgroundColor: colors.primary50,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.pill,
  },
  categoryText: {
    fontSize: fontSize.xs,
    fontFamily: fontFamily.bold,
    fontWeight: fontWeight.bold,
    color: colors.primary500,
  },
  metaBox: {
    backgroundColor: colors.background,
    borderRadius: radius.lg,
    padding: 14,
    gap: 8,
    marginTop: 2,
  },
  metaText: {
    fontSize: fontSize.sm,
    color: colors.primary,
    fontFamily: fontFamily.medium,
    fontWeight: fontWeight.medium,
  },
  introImage: {
    width: '100%',
    aspectRatio: 4 / 3,
    borderRadius: radius.lg,
    backgroundColor: colors.primary100,
    marginTop: 2,
  },
  introBox: {
    backgroundColor: colors.accent50,
    borderWidth: 1,
    borderColor: colors.accent100,
    borderRadius: radius.lg,
    padding: 16,
    gap: 6,
  },
  introLabel: {
    fontSize: fontSize.xs,
    fontFamily: fontFamily.bold,
    fontWeight: fontWeight.bold,
    color: colors.accent700,
  },
  introText: {
    fontSize: fontSize.sm,
    color: colors.primary,
    fontFamily: fontFamily.regular,
    lineHeight: 21,
  },
  noIntro: {
    fontSize: fontSize.sm,
    color: colors.primary500,
    fontFamily: fontFamily.regular,
    textAlign: 'center',
    paddingVertical: 12,
  },
  btnRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  btn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnGhost: {
    backgroundColor: colors.primary50,
  },
  btnGhostText: {
    fontSize: fontSize.base,
    color: colors.primary500,
    fontFamily: fontFamily.bold,
    fontWeight: fontWeight.bold,
  },
  btnPrimary: {
    backgroundColor: colors.accent,
  },
  btnPrimaryText: {
    fontSize: fontSize.base,
    color: colors.surface,
    fontFamily: fontFamily.bold,
    fontWeight: fontWeight.bold,
  },
  btnDisabled: { opacity: 0.5 },
});
