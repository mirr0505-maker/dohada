// 🚀 챌린지방 - 기록 탭 (Vlog 형태)
// v4: "📝 인상깊은 순간을 기록해요" 버튼 + 카드 피드. 인증과 별개의 추억성 콘텐츠.
// MVP: 텍스트만 (제목 + 본문). 이미지/댓글은 Phase 1.5.
import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, TextInput, Pressable, StyleSheet, FlatList, Modal,
  KeyboardAvoidingView, Platform, Alert, Image,
} from 'react-native';
import { supabase } from '@/lib/supabase';
import {
  fetchLogs, createLog, toggleLogLike, type LogWithAuthor,
} from '@/lib/db';
import { colors, fontFamily, fontSize, fontWeight, radius, shadow } from '@/lib/tokens';
import { haptic } from '@/lib/haptics';

type Props = {
  challengeId: string;
  challengeStartDate: string;        // YYYY-MM-DD
  myUserId: string | undefined;
  isMember: boolean;
  canCreate: boolean;                // cheered 방은 creator 만 기록 가능
};

export function LogTab({ challengeId, challengeStartDate, myUserId, isMember, canCreate }: Props) {
  const [logs, setLogs] = useState<LogWithAuthor[]>([]);
  const [loading, setLoading] = useState(true);
  const [composerOpen, setComposerOpen] = useState(false);

  const load = useCallback(async () => {
    if (!challengeId || !myUserId) return;
    try {
      const data = await fetchLogs(challengeId, myUserId);
      setLogs(data);
    } catch (e: any) {
      Alert.alert('기록 불러오기 실패', e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  }, [challengeId, myUserId]);

  useEffect(() => { load(); }, [load]);

  // Realtime
  useEffect(() => {
    if (!challengeId) return;
    const channel = supabase
      .channel(`logs:${challengeId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'logs', filter: `challenge_id=eq.${challengeId}` },
        () => load(),
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'log_likes' },
        (payload) => {
          const l = payload.new as { log_id: string; user_id: string };
          setLogs(prev => prev.map(x =>
            x.id === l.log_id
              ? {
                  ...x,
                  like_count: x.like_count + 1,
                  liked_by_me: x.liked_by_me || l.user_id === myUserId,
                }
              : x,
          ));
        },
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'log_likes' },
        (payload) => {
          const l = payload.old as { log_id: string; user_id: string };
          setLogs(prev => prev.map(x =>
            x.id === l.log_id
              ? {
                  ...x,
                  like_count: Math.max(0, x.like_count - 1),
                  liked_by_me: l.user_id === myUserId ? false : x.liked_by_me,
                }
              : x,
          ));
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [challengeId, myUserId, load]);

  const onLike = useCallback(async (logId: string) => {
    if (!myUserId) return;
    const target = logs.find(l => l.id === logId);
    if (!target) return;
    haptic.tap();
    // 낙관적
    setLogs(prev => prev.map(x =>
      x.id === logId
        ? {
            ...x,
            liked_by_me: !x.liked_by_me,
            like_count: x.like_count + (x.liked_by_me ? -1 : 1),
          }
        : x,
    ));
    try {
      await toggleLogLike({ logId, userId: myUserId, currentlyLiked: target.liked_by_me });
    } catch (e: any) {
      setLogs(prev => prev.map(x =>
        x.id === logId
          ? { ...x, liked_by_me: target.liked_by_me, like_count: target.like_count }
          : x,
      ));
      Alert.alert('좋아요 실패', e?.message ?? String(e));
    }
  }, [logs, myUserId]);

  return (
    <View style={styles.wrap}>
      {/* 새 기록 작성 버튼 — 응원받기 방은 도전자만 */}
      {canCreate && (
        <View style={{ padding: 16, paddingBottom: 0 }}>
          <Pressable style={styles.newBtn} onPress={() => { haptic.tap(); setComposerOpen(true); }}>
            <Text style={styles.newBtnEmoji}>📝</Text>
            <Text style={styles.newBtnText}>인상깊은 순간을 기록해요</Text>
          </Pressable>
        </View>
      )}

      <FlatList
        data={logs}
        keyExtractor={l => l.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <LogCard
            log={item}
            startDate={challengeStartDate}
            onLike={() => onLike(item.id)}
          />
        )}
        ListEmptyComponent={
          loading ? (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>불러오는 중…</Text>
            </View>
          ) : (
            <View style={styles.empty}>
              <Text style={styles.emptyEmoji}>🎥</Text>
              <Text style={styles.emptyText}>
                아직 기록이 없어요.{'\n'}이 챌린지의 첫 추억을 남겨볼까요?
              </Text>
            </View>
          )
        }
      />

      <LogComposer
        visible={composerOpen}
        onClose={() => setComposerOpen(false)}
        challengeId={challengeId}
        myUserId={myUserId}
        onCreated={() => { setComposerOpen(false); load(); }}
      />
    </View>
  );
}

// ─── 기록 카드 ──────────────────────────
function LogCard({
  log, startDate, onLike,
}: {
  log: LogWithAuthor;
  startDate: string;
  onLike: () => void;
}) {
  const dayN = computeDayN(startDate, log.created_at);
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        {log.author.avatar_url ? (
          <Image source={{ uri: log.author.avatar_url }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarFallback]}>
            <Text style={{ fontSize: 14 }}>{log.author.nickname?.slice(0, 1) || '🐰'}</Text>
          </View>
        )}
        <View style={{ flex: 1 }}>
          <Text style={styles.authorName} numberOfLines={1}>{log.author.nickname || '동료'}</Text>
          <Text style={styles.authorMeta}>{dayN}일째 · {formatRel(log.created_at)}</Text>
        </View>
      </View>

      {log.photo_url ? (
        <Image source={{ uri: log.photo_url }} style={styles.photo} resizeMode="cover" />
      ) : null}

      <Text style={styles.title}>{log.title}</Text>
      <Text style={styles.content}>{log.content}</Text>

      <View style={styles.actions}>
        <Pressable style={styles.likeBtn} onPress={onLike} hitSlop={6}>
          <Text style={[styles.likeIcon, log.liked_by_me && styles.likeIconOn]}>
            {log.liked_by_me ? '❤️' : '🤍'}
          </Text>
          <Text style={[styles.likeCount, log.liked_by_me && styles.likeCountOn]}>
            {log.like_count}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

// ─── 작성 모달 ──────────────────────────
function LogComposer({
  visible, onClose, challengeId, myUserId, onCreated,
}: {
  visible: boolean;
  onClose: () => void;
  challengeId: string;
  myUserId: string | undefined;
  onCreated: () => void;
}) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [saving, setSaving] = useState(false);

  const reset = () => { setTitle(''); setContent(''); };

  const onSave = async () => {
    if (!myUserId || saving) return;
    setSaving(true);
    try {
      await createLog({ challengeId, userId: myUserId, title, content });
      haptic.success();
      reset();
      onCreated();
    } catch (e: any) {
      Alert.alert('기록 저장 실패', e?.message ?? String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: colors.background }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.modalHeader}>
          <Pressable onPress={() => { reset(); onClose(); }} hitSlop={12}>
            <Text style={styles.modalCancel}>취소</Text>
          </Pressable>
          <Text style={styles.modalTitle}>새 기록</Text>
          <Pressable
            onPress={onSave}
            disabled={!title.trim() || !content.trim() || saving}
            hitSlop={12}
          >
            <Text style={[
              styles.modalSave,
              (!title.trim() || !content.trim() || saving) && { opacity: 0.4 },
            ]}>
              {saving ? '저장 중…' : '저장'}
            </Text>
          </Pressable>
        </View>

        <View style={styles.modalBody}>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="제목 (예: 한라산 정상에서)"
            placeholderTextColor={colors.primary300}
            style={styles.titleInput}
            maxLength={80}
            editable={!saving}
          />
          <TextInput
            value={content}
            onChangeText={setContent}
            placeholder={'오늘 어떤 변화가 있었나요?\n작은 순간도 적어두면 나중에 보물이 돼요.'}
            placeholderTextColor={colors.primary300}
            style={styles.contentInput}
            multiline
            maxLength={4000}
            editable={!saving}
          />
          <Text style={styles.counter}>{content.length} / 4000</Text>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── 유틸 ──────────────────────────
function computeDayN(startDate: string, createdAt: string): number {
  const start = new Date(startDate + 'T00:00:00');
  const created = new Date(createdAt);
  return Math.max(1, Math.floor((created.getTime() - start.getTime()) / 86_400_000) + 1);
}

function formatRel(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return '방금';
  if (m < 60) return `${m}분 전`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}시간 전`;
  const d = Math.floor(h / 24);
  return `${d}일 전`;
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.background },
  list: { padding: 16, gap: 12, flexGrow: 1, paddingBottom: 80 },
  newBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 14,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.primary100,
  },
  newBtnEmoji: { fontSize: 18 },
  newBtnText: {
    fontSize: fontSize.base,
    color: colors.primary,
    fontFamily: fontFamily.medium,
    fontWeight: fontWeight.medium,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: 16,
    gap: 10,
    ...shadow.sm,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.accent50 },
  avatarFallback: { alignItems: 'center', justifyContent: 'center' },
  authorName: {
    fontSize: fontSize.base,
    color: colors.primary,
    fontFamily: fontFamily.bold,
    fontWeight: fontWeight.bold,
  },
  authorMeta: {
    fontSize: fontSize.xs,
    color: colors.primary500,
    fontFamily: fontFamily.regular,
    marginTop: 2,
  },
  photo: {
    width: '100%',
    aspectRatio: 16 / 10,
    borderRadius: radius.lg,
    backgroundColor: colors.primary100,
  },
  title: {
    fontSize: fontSize.lg,
    color: colors.primary,
    fontFamily: fontFamily.bold,
    fontWeight: fontWeight.bold,
  },
  content: {
    fontSize: fontSize.base,
    color: colors.primary,
    fontFamily: fontFamily.regular,
    lineHeight: 22,
  },
  actions: { flexDirection: 'row', gap: 16, paddingTop: 4 },
  likeBtn: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  likeIcon: { fontSize: 18 },
  likeIconOn: { },
  likeCount: {
    fontSize: fontSize.sm,
    color: colors.primary500,
    fontFamily: fontFamily.medium,
    fontWeight: fontWeight.medium,
  },
  likeCountOn: { color: colors.danger, fontWeight: fontWeight.bold },
  empty: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingVertical: 64, gap: 12,
  },
  emptyEmoji: { fontSize: 56 },
  emptyText: {
    fontSize: fontSize.base, color: colors.primary500,
    fontFamily: fontFamily.regular, textAlign: 'center', lineHeight: 22,
  },

  // Composer modal
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 56,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.primary100,
    backgroundColor: colors.surface,
  },
  modalCancel: { fontSize: fontSize.base, color: colors.primary500, fontFamily: fontFamily.medium },
  modalTitle: {
    fontSize: fontSize.lg,
    color: colors.primary,
    fontFamily: fontFamily.bold,
    fontWeight: fontWeight.bold,
  },
  modalSave: {
    fontSize: fontSize.base,
    color: colors.accent,
    fontFamily: fontFamily.bold,
    fontWeight: fontWeight.bold,
  },
  modalBody: { flex: 1, paddingHorizontal: 20, paddingTop: 16 },
  titleInput: {
    fontSize: fontSize.xl,
    color: colors.primary,
    fontFamily: fontFamily.bold,
    fontWeight: fontWeight.bold,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.primary100,
  },
  contentInput: {
    flex: 1,
    fontSize: fontSize.base,
    color: colors.primary,
    fontFamily: fontFamily.regular,
    paddingTop: 16,
    lineHeight: 22,
    textAlignVertical: 'top',
  },
  counter: {
    fontSize: fontSize.xs,
    color: colors.primary300,
    textAlign: 'right',
    paddingBottom: 16,
  },
});
