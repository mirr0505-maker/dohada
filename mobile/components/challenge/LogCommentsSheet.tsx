// 🚀 기록 댓글 시트 — log 1건의 댓글 목록 + 입력
// CommentsSheet (인증 댓글) 패턴 그대로, 테이블만 log_comments.
// solo 방은 LogTab 에서 부르지 않음 (분류별 제한).
import React, { useCallback, useEffect, useState } from 'react';
import {
  Modal, View, Text, Pressable, TextInput, FlatList, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, fontFamily, fontSize, fontWeight, radius } from '@/lib/tokens';
import {
  fetchLogComments, addLogComment, updateLogComment, deleteLogComment,
  type LogCommentWithAuthor,
} from '@/lib/db';
import { supabase } from '@/lib/supabase';
import { haptic } from '@/lib/haptics';
import { reportError } from '@/lib/sentry';

type Props = {
  logId: string | null;          // null 이면 sheet 닫힘
  myUserId: string | undefined;
  onClose: () => void;
  onCountChange?: (logId: string, delta: 1 | -1) => void;
};

export function LogCommentsSheet({ logId, myUserId, onClose, onCountChange }: Props) {
  const [items, setItems] = useState<LogCommentWithAuthor[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);   // 수정 모드 (v2.2)

  const load = useCallback(async (lid: string) => {
    try {
      setLoading(true);
      const data = await fetchLogComments(lid);
      setItems(data);
    } catch (e) {
      reportError(e, { where: 'LogCommentsSheet/fetch', logId: lid });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (logId) load(logId);
    else { setItems([]); setText(''); setEditingCommentId(null); }
  }, [logId, load]);

  // Realtime: 다른 사람 댓글 즉시 반영
  useEffect(() => {
    if (!logId) return;
    const channel = supabase
      .channel(`log_comments:${logId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'log_comments', filter: `log_id=eq.${logId}` },
        () => { load(logId); },
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'log_comments' },
        (payload) => {
          const c = payload.old as { id: string };
          setItems(prev => prev.filter(x => x.id !== c.id));
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [logId, load]);

  const onSend = async () => {
    if (!logId || !myUserId || sending) return;
    const trimmed = text.trim();
    if (!trimmed) return;
    setSending(true);
    try {
      if (editingCommentId) {
        await updateLogComment({ commentId: editingCommentId, content: trimmed });
        haptic.tap();
        setText('');
        setEditingCommentId(null);
        await load(logId);
      } else {
        await addLogComment({ logId, userId: myUserId, content: trimmed });
        haptic.tap();
        setText('');
        onCountChange?.(logId, 1);
        await load(logId);
      }
    } catch (e: any) {
      Alert.alert('댓글 실패', e?.message ?? String(e));
    } finally {
      setSending(false);
    }
  };

  const onEdit = (commentId: string, currentContent: string) => {
    setEditingCommentId(commentId);
    setText(currentContent);
  };

  const cancelEdit = () => {
    setEditingCommentId(null);
    setText('');
  };

  const onMine = (commentId: string, currentContent: string) => {
    Alert.alert('이 댓글', '', [
      { text: '수정', onPress: () => onEdit(commentId, currentContent) },
      { text: '삭제', style: 'destructive', onPress: () => confirmDelete(commentId) },
      { text: '취소', style: 'cancel' },
    ]);
  };

  const confirmDelete = (commentId: string) => {
    Alert.alert('댓글 삭제', '이 댓글을 삭제할까요?', [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteLogComment(commentId);
            haptic.tap();
            if (logId) onCountChange?.(logId, -1);
            setItems(prev => prev.filter(x => x.id !== commentId));
          } catch (e: any) {
            Alert.alert('삭제 실패', e?.message ?? String(e));
          }
        },
      },
    ]);
  };

  return (
    <Modal
      visible={logId !== null}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <View style={{ width: 44 }} />
          <Text style={styles.title}>기록 댓글</Text>
          <Pressable onPress={onClose} hitSlop={12}>
            <Text style={styles.close}>닫기</Text>
          </Pressable>
        </View>

        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          {loading ? (
            <View style={styles.center}><ActivityIndicator color={colors.accent} /></View>
          ) : (
            <FlatList
              data={items}
              keyExtractor={c => c.id}
              contentContainerStyle={styles.list}
              renderItem={({ item }) => (
                <CommentItem
                  item={item}
                  mine={item.user_id === myUserId}
                  onMine={() => onMine(item.id, item.content)}
                />
              )}
              ListEmptyComponent={
                <View style={styles.empty}>
                  <Text style={styles.emptyEmoji}>💬</Text>
                  <Text style={styles.emptyText}>
                    이 기록에 첫 댓글을 남겨보세요.
                  </Text>
                </View>
              }
            />
          )}

          {editingCommentId && (
            <View style={styles.editingBar}>
              <Text style={styles.editingText}>수정 중</Text>
              <Pressable onPress={cancelEdit} hitSlop={6}>
                <Text style={styles.editingCancel}>✕</Text>
              </Pressable>
            </View>
          )}
          <View style={styles.inputBar}>
            <TextInput
              value={text}
              onChangeText={setText}
              placeholder={editingCommentId ? '수정할 내용' : '기록에 대한 한마디'}
              placeholderTextColor={colors.primary300}
              style={styles.input}
              maxLength={280}
              editable={!sending}
              multiline
            />
            <Pressable
              style={[
                styles.sendBtn,
                (!text.trim() || sending) && { opacity: 0.4 },
              ]}
              onPress={onSend}
              disabled={!text.trim() || sending}
            >
              <Text style={styles.sendText}>
                {sending ? '…' : editingCommentId ? '저장' : '전송'}
              </Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

function CommentItem({
  item, mine, onMine,
}: { item: LogCommentWithAuthor; mine: boolean; onMine: () => void }) {
  return (
    <Pressable style={styles.row} onLongPress={mine ? onMine : undefined} delayLongPress={400}>
      {item.author?.avatar_url ? (
        <Image source={{ uri: item.author.avatar_url }} style={styles.avatar} />
      ) : (
        <View style={[styles.avatar, styles.avatarFallback]}>
          <Text style={{ fontSize: 16 }}>🐰</Text>
        </View>
      )}
      <View style={{ flex: 1, gap: 2 }}>
        <View style={styles.rowHead}>
          <Text style={styles.author}>{item.author?.nickname ?? '익명'}</Text>
          <Text style={styles.time}>{formatTime(item.created_at)}</Text>
        </View>
        <Text style={styles.content}>{item.content}</Text>
        {mine ? <Text style={styles.deleteHint}>길게 눌러 수정/삭제</Text> : null}
      </View>
    </Pressable>
  );
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const ms = now.getTime() - d.getTime();
  if (ms < 60_000) return '방금';
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}분 전`;
  if (ms < 86_400_000) return `${Math.floor(ms / 3_600_000)}시간 전`;
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  header: {
    height: 52,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
    width: 44,
    textAlign: 'right',
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { padding: 16, gap: 14, flexGrow: 1 },
  row: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  avatar: { width: 36, height: 36, borderRadius: 18, overflow: 'hidden' },
  avatarFallback: {
    backgroundColor: colors.primary50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowHead: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  author: {
    fontSize: fontSize.sm,
    color: colors.primary,
    fontFamily: fontFamily.bold,
    fontWeight: fontWeight.bold,
  },
  time: {
    fontSize: fontSize.xs,
    color: colors.primary300,
    fontFamily: fontFamily.regular,
  },
  content: {
    fontSize: fontSize.base,
    color: colors.primary,
    fontFamily: fontFamily.regular,
    lineHeight: 20,
  },
  deleteHint: {
    fontSize: fontSize.xs,
    color: colors.primary300,
    fontFamily: fontFamily.regular,
    marginTop: 2,
  },
  empty: {
    flex: 1,
    paddingVertical: 64,
    alignItems: 'center',
    gap: 12,
  },
  emptyEmoji: { fontSize: 48 },
  emptyText: {
    fontSize: fontSize.base,
    color: colors.primary500,
    fontFamily: fontFamily.regular,
    textAlign: 'center',
    lineHeight: 22,
  },
  editingBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: colors.accent50,
  },
  editingText: {
    fontSize: fontSize.sm,
    color: colors.accent700,
    fontFamily: fontFamily.medium,
    fontWeight: fontWeight.medium,
  },
  editingCancel: {
    fontSize: 18,
    color: colors.accent700,
    paddingHorizontal: 8,
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: colors.primary100,
    backgroundColor: colors.surface,
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 100,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: colors.primary50,
    borderRadius: radius.lg,
    fontSize: fontSize.base,
    color: colors.primary,
    fontFamily: fontFamily.regular,
  },
  sendBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: colors.accent,
    borderRadius: radius.lg,
  },
  sendText: {
    color: colors.surface,
    fontSize: fontSize.base,
    fontFamily: fontFamily.bold,
    fontWeight: fontWeight.bold,
  },
});
