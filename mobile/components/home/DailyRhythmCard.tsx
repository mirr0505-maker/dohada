// 🚀 하루 리듬 — 아침 다짐 · 저녁 회고 (인앱 프롬프트만, 푸시 없음).
//   시간대(KST)로 kind 결정: 15시 전=아침 다짐, 15시 이후=저녁 회고.
//   자기와의 조용한 약속 — 자랑/비교 아님. 이미 남겼으면 죄책감 없이 잔잔한 완료 상태.
import React, { useCallback, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { colors, fontFamily, fontSize, fontWeight, radius } from '@/lib/tokens';
import { haptic } from '@/lib/haptics';
import { fetchMyDailyNote, type DailyNote, type DailyNoteKind } from '@/lib/db';
import { DailyNoteComposeSheet } from './DailyNoteComposeSheet';

// kind별 카피 — 아침엔 앞을 보는 다짐, 저녁엔 돌아보는 회고 (particle 은 done 에 미리 포함)
const META: Record<DailyNoteKind, {
  badge: string; label: string; prompt: string; placeholder: string; done: string;
}> = {
  intention:  { badge: '🌅', label: '아침 다짐', prompt: '오늘 어떤 하다를 살아볼래요?',
                placeholder: '오늘의 다짐을 한 줄로…', done: '오늘 다짐을 남겼어요' },
  reflection: { badge: '🌙', label: '저녁 회고', prompt: '오늘 하루 어땠어요?',
                placeholder: '오늘 하루를 한 줄로…', done: '오늘 회고를 남겼어요' },
};

export function DailyRhythmCard({ userId }: { userId: string | undefined }) {
  // KST 현재 시각(시) — format.ts 와 동일하게 UTC+9 후 getUTCHours (디바이스 TZ 무관)
  const kstHour = new Date(Date.now() + 9 * 60 * 60 * 1000).getUTCHours();
  const kind: DailyNoteKind = kstHour < 15 ? 'intention' : 'reflection';
  const meta = META[kind];

  const [note, setNote] = useState<DailyNote | null>(null);
  const [ready, setReady] = useState(false);
  const [open, setOpen] = useState(false);

  const load = useCallback(() => {
    if (!userId) { setReady(true); return; }
    fetchMyDailyNote(userId, kind)
      .then(setNote)
      .catch(() => setNote(null))
      .finally(() => setReady(true));
  }, [userId, kind]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const openCompose = () => { haptic.tap(); setOpen(true); };

  if (!userId || !ready) return null;   // 세션·로딩 전엔 자리 비움 (깜빡임 방지)

  return (
    <>
      {note ? (
        // 이미 남김 — 조용한 완료. 내가 쓴 한 줄을 잔잔히, '수정' 여지만.
        <Pressable style={styles.doneCard} onPress={openCompose}>
          <Text style={styles.doneLabel}>{meta.badge} {meta.done}</Text>
          <Text style={styles.doneContent} numberOfLines={3}>{note.content}</Text>
          <Text style={styles.editHint}>수정</Text>
        </Pressable>
      ) : (
        <Pressable style={styles.promptCard} onPress={openCompose}>
          <Text style={styles.promptBadge}>{meta.badge} {meta.label}</Text>
          <Text style={styles.promptText}>{meta.prompt}</Text>
        </Pressable>
      )}

      <DailyNoteComposeSheet
        visible={open}
        kind={kind}
        label={`${meta.badge} ${meta.label}`}
        prompt={meta.prompt}
        placeholder={meta.placeholder}
        initialContent={note?.content ?? ''}
        initialVisibility={note?.visibility ?? 'fellow'}
        userId={userId}
        onClose={() => setOpen(false)}
        onSaved={load}
      />
    </>
  );
}

const styles = StyleSheet.create({
  promptCard: {
    backgroundColor: colors.brandTint,
    borderRadius: radius.xl,
    padding: 18,
    gap: 6,
  },
  promptBadge: {
    fontSize: fontSize.sm,
    color: colors.brandInk,
    fontFamily: fontFamily.bold,
    fontWeight: fontWeight.bold,
  },
  promptText: {
    fontSize: fontSize.lg,
    color: colors.ink,
    fontFamily: fontFamily.bold,
    fontWeight: fontWeight.bold,
  },
  doneCard: {
    // 🚀 내 하다 탭에서 흰 챌린지 카드와 섞이지 않게 따뜻한 틴트 (조용한 완료 톤은 유지)
    backgroundColor: colors.accent50,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.accent100,
    padding: 16,
    gap: 6,
  },
  doneLabel: {
    fontSize: fontSize.sm,
    color: colors.sub,
    fontFamily: fontFamily.medium,
    fontWeight: fontWeight.medium,
  },
  doneContent: {
    fontSize: fontSize.base,
    color: colors.ink,
    fontFamily: fontFamily.regular,
    lineHeight: 21,
  },
  editHint: {
    fontSize: fontSize.sm,
    color: colors.brandInk,
    fontFamily: fontFamily.medium,
    fontWeight: fontWeight.medium,
  },
});
