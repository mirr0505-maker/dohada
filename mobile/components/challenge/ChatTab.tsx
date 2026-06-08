// 🚀 챌린지방 - 대화 탭 (Realtime chat_messages)
// v4: 카톡식 말풍선. 본인 메시지는 오른쪽 accent, 타인은 왼쪽 회색 + 닉네임.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, TextInput, Pressable, StyleSheet, FlatList, KeyboardAvoidingView,
  Platform, Alert, Image, Keyboard
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { fetchChatMessages, sendChatMessage, type ChatMessageWithAuthor } from '@/lib/db';
import { colors, fontFamily, fontSize, fontWeight, radius } from '@/lib/tokens';
import { haptic } from '@/lib/haptics';

type Props = {
  challengeId: string;
  myUserId: string | undefined;
  isMember: boolean;
};

export function ChatTab({ challengeId, myUserId, isMember }: Props) {
  const [messages, setMessages] = useState<ChatMessageWithAuthor[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const [isNoticeExpanded, setIsNoticeExpanded] = useState(false);
  
  const listRef = useRef<FlatList<ChatMessageWithAuthor>>(null);
  
  const notices = useMemo(() => messages.filter(m => m.is_notice), [messages]);
  const chatMessages = useMemo(() => messages.filter(m => !m.is_notice), [messages]);
  const latestNotice = useMemo(() => notices[notices.length - 1], [notices]);
  
  const insets = useSafeAreaInsets();
  
  // 🚀 대화 탭은 하단 SafeArea가 해제된 레이아웃이므로 iOS 오프셋을 0으로 교정
  const keyboardOffset = useMemo(() => {
    return Platform.OS === 'ios' ? 0 : 20;
  }, []);

  const load = useCallback(async () => {
    if (!challengeId) return;
    try {
      const data = await fetchChatMessages(challengeId);
      setMessages(data);
    } catch (e: any) {
      Alert.alert('대화 불러오기 실패', e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  }, [challengeId]);

  useEffect(() => { load(); }, [load]);

  // Realtime — chat_messages INSERT 구독.
  // 🚀 P2-18 보정: 전체 load() 대신 새 row 1건 + author 정보만 단건 조회 후 prepend/append.
  // (100명 챌린지의 활발한 채팅에서 INSERT 마다 100건 재조회되던 부하 해소.)
  useEffect(() => {
    if (!challengeId) return;
    const channel = supabase
      .channel(`chat:${challengeId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `challenge_id=eq.${challengeId}` },
        async (payload) => {
          const newRow = payload.new as { id: string; user_id: string; content: string; created_at: string; is_notice?: boolean; challenge_id: string };
          // 본인 메시지는 optimistic 삽입이 이미 처리. 중복 방지.
          if (newRow.user_id === myUserId) return;
          // 작성자 정보 fetch (단건)
          const { data: authorRow } = await supabase
            .from('users')
            .select('id, nickname, avatar_url')
            .eq('id', newRow.user_id)
            .maybeSingle();
          setMessages(prev => {
            // 이미 동일 id 가 있으면 noop
            if (prev.some(m => m.id === newRow.id)) return prev;
            return [...prev, {
              id: newRow.id,
              challenge_id: newRow.challenge_id,
              user_id: newRow.user_id,
              content: newRow.content,
              created_at: newRow.created_at,
              is_notice: !!newRow.is_notice,
              author: {
                id: authorRow?.id ?? newRow.user_id,
                nickname: authorRow?.nickname ?? '',
                avatar_url: authorRow?.avatar_url ?? null,
              },
            }];
          });
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [challengeId, myUserId]);

  const onSend = useCallback(async () => {
    if (!myUserId || !isMember || sending) return;
    const text = input.trim();
    if (!text) return;
    setSending(true);
    setInput('');
    haptic.tap();

    // 낙관적 추가 — Realtime self-broadcast 가 늦거나 누락돼도 즉시 보이게.
    // 본인 메시지는 UI 에서 author 정보 안 보므로 빈 author 로 OK. load() 가 진짜 row 로 교체.
    const tempId = `temp-${Date.now()}`;
    const optimistic: ChatMessageWithAuthor = {
      id: tempId,
      challenge_id: challengeId,
      user_id: myUserId,
      content: text,
      created_at: new Date().toISOString(),
      author: { id: myUserId, nickname: '', avatar_url: null },
    };
    setMessages(prev => [...prev, optimistic]);

    try {
      await sendChatMessage({ challengeId, userId: myUserId, content: text });
    } catch (e: any) {
      setMessages(prev => prev.filter(m => m.id !== tempId));
      setInput(text);
      Alert.alert('전송 실패', e?.message ?? String(e));
    } finally {
      setSending(false);
    }
  }, [challengeId, myUserId, isMember, sending, input]);

  // 메시지 추가될 때 맨 아래로 스크롤
  useEffect(() => {
    if (chatMessages.length === 0) return;
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50);
  }, [chatMessages.length]);

  // 🚀 키보드가 활성화될 때 스크롤을 맨 아래로 강제 이동하고 상태 동기화
  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSubscription = Keyboard.addListener(showEvent, () => {
      setIsKeyboardVisible(true);
      setTimeout(() => {
        listRef.current?.scrollToEnd({ animated: true });
      }, 100);
    });

    const hideSubscription = Keyboard.addListener(hideEvent, () => {
      setIsKeyboardVisible(false);
    });

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  if (loading) {
    return (
      <View style={styles.center}>
        <Text style={styles.loading}>대화 불러오는 중…</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.wrap}
      behavior="height"
      keyboardVerticalOffset={keyboardOffset}
    >
      {latestNotice && (
        <View style={styles.noticeContainer}>
          {!isNoticeExpanded ? (
            <Pressable style={styles.noticeHeader} onPress={() => { haptic.tap(); setIsNoticeExpanded(true); }}>
              <Text style={styles.noticeIcon}>📢</Text>
              <Text style={styles.noticeSummary} numberOfLines={1}>
                {latestNotice.content}
              </Text>
              <Text style={styles.arrowIcon}>▼</Text>
            </Pressable>
          ) : (
            <View style={styles.noticeContent}>
              <Pressable style={styles.noticeHeader} onPress={() => { haptic.tap(); setIsNoticeExpanded(false); }}>
                <Text style={styles.noticeIcon}>📢</Text>
                <Text style={styles.noticeTitle}>공지사항 모아보기</Text>
                <Text style={styles.arrowIcon}>▲</Text>
              </Pressable>
              
              <View style={styles.noticeDivider} />
              
              <FlatList
                data={[...notices].reverse()}
                keyExtractor={n => n.id}
                style={styles.noticeScroll}
                contentContainerStyle={styles.noticeScrollList}
                renderItem={({ item: n }) => (
                  <View style={styles.noticeItem}>
                    <View style={styles.noticeItemHeader}>
                      <Text style={styles.noticeItemNick}>{n.author?.nickname || '개설자'}</Text>
                      <Text style={styles.noticeItemDate}>{formatNoticeDate(n.created_at)}</Text>
                    </View>
                    <Text style={styles.noticeItemText}>{n.content}</Text>
                  </View>
                )}
                nestedScrollEnabled
              />
            </View>
          )}
        </View>
      )}

      <FlatList
        ref={listRef}
        data={chatMessages}
        keyExtractor={m => m.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => {
          const mine = item.user_id === myUserId;
          return (
            <View style={[styles.row, mine && styles.rowMine]}>
              {!mine && (
                item.author.avatar_url ? (
                  <Image source={{ uri: item.author.avatar_url }} style={styles.avatar} />
                ) : (
                  <View style={[styles.avatar, styles.avatarFallback]}>
                    <Text style={{ fontSize: 14 }}>{item.author.nickname?.slice(0, 1) || '🐰'}</Text>
                  </View>
                )
              )}
              <View style={{ maxWidth: '75%' }}>
                {!mine && (
                  <Text style={styles.name}>{item.author.nickname || '동료'}</Text>
                )}
                <View style={[styles.bubble, mine && styles.bubbleMine]}>
                  <Text style={[styles.bubbleText, mine && styles.bubbleTextMine]}>
                    {item.content}
                  </Text>
                </View>
                <Text style={[styles.time, mine && styles.timeMine]}>
                  {formatTime(item.created_at)}
                </Text>
              </View>
            </View>
          );
        }}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyEmoji}>💬</Text>
            <Text style={styles.emptyText}>
              아직 대화가 없어요.{'\n'}동료들에게 첫 인사를 건네볼까요?
            </Text>
          </View>
        }
      />

      {isMember ? (
        <View style={[
          styles.inputBar,
          {
            paddingBottom: (Platform.OS === 'ios' && !isKeyboardVisible && insets.bottom > 0)
              ? insets.bottom
              : 8
          }
        ]}>
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder="메시지를 입력하세요"
            placeholderTextColor={colors.primary300}
            style={styles.input}
            multiline
            maxLength={1000}
            editable={!sending}
          />
          <Pressable
            style={[styles.sendBtn, (!input.trim() || sending) && styles.sendBtnDisabled]}
            onPress={onSend}
            disabled={!input.trim() || sending}
          >
            <Text style={styles.sendBtnText}>전송</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.guestBar}>
          <Text style={styles.guestText}>대화는 참여 멤버만 작성할 수 있어요.</Text>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

function formatNoticeDate(iso: string): string {
  const d = new Date(iso);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${mm}/${dd} ${hh}:${min}`;
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 40 },
  noticeContainer: {
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.primary100,
  },
  noticeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
  },
  noticeIcon: {
    fontSize: 16,
  },
  noticeSummary: {
    flex: 1,
    fontSize: fontSize.sm,
    fontFamily: fontFamily.medium,
    color: colors.primary700,
  },
  noticeTitle: {
    flex: 1,
    fontSize: fontSize.sm,
    fontFamily: fontFamily.bold,
    fontWeight: fontWeight.bold,
    color: colors.primary,
  },
  arrowIcon: {
    fontSize: 10,
    color: colors.primary300,
    fontFamily: fontFamily.regular,
  },
  noticeContent: {
    backgroundColor: colors.primary50,
  },
  noticeDivider: {
    height: 1,
    backgroundColor: colors.primary100,
    marginHorizontal: 16,
  },
  noticeScroll: {
    maxHeight: 180,
  },
  noticeScrollList: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 16,
    gap: 12,
  },
  noticeItem: {
    backgroundColor: colors.surface,
    padding: 12,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.primary100,
  },
  noticeItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  noticeItemNick: {
    fontSize: fontSize.xs,
    fontFamily: fontFamily.bold,
    fontWeight: fontWeight.bold,
    color: colors.primary700,
  },
  noticeItemDate: {
    fontSize: 10,
    fontFamily: fontFamily.regular,
    color: colors.primary300,
  },
  noticeItemText: {
    fontSize: fontSize.sm,
    fontFamily: fontFamily.regular,
    color: colors.primary,
    lineHeight: 18,
  },
  loading: { fontSize: fontSize.sm, color: colors.primary500, fontFamily: fontFamily.regular },
  list: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 28, gap: 12, flexGrow: 1 },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  rowMine: {
    flexDirection: 'row-reverse',
  },
  avatar: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: colors.accent50,
  },
  avatarFallback: {
    alignItems: 'center', justifyContent: 'center',
  },
  name: {
    fontSize: fontSize.xs,
    color: colors.primary500,
    fontFamily: fontFamily.regular,
    marginBottom: 2,
    marginLeft: 4,
  },
  bubble: {
    backgroundColor: colors.surface,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: radius.lg,
    borderTopLeftRadius: 4,
    borderWidth: 1,
    borderColor: colors.primary100,
  },
  bubbleMine: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: 4,
  },
  bubbleText: {
    fontSize: fontSize.base,
    color: colors.primary,
    fontFamily: fontFamily.regular,
    lineHeight: 20,
  },
  bubbleTextMine: {
    color: colors.surface,
  },
  time: {
    fontSize: 10,
    color: colors.primary300,
    fontFamily: fontFamily.regular,
    marginTop: 2,
    marginLeft: 4,
  },
  timeMine: {
    textAlign: 'right',
    marginLeft: 0,
    marginRight: 4,
  },
  empty: {
    flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 64, gap: 12,
  },
  emptyEmoji: { fontSize: 56 },
  emptyText: {
    fontSize: fontSize.base, color: colors.primary500,
    fontFamily: fontFamily.regular, textAlign: 'center', lineHeight: 22,
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
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
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: { opacity: 0.4 },
  sendBtnText: {
    fontSize: fontSize.sm,
    color: colors.surface,
    fontFamily: fontFamily.bold,
    fontWeight: fontWeight.bold,
  },
  guestBar: {
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: colors.primary50,
    borderTopWidth: 1,
    borderTopColor: colors.primary100,
  },
  guestText: {
    fontSize: fontSize.sm,
    color: colors.primary500,
    fontFamily: fontFamily.regular,
  },
});
