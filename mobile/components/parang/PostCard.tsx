// 🚀 파장 피드 — 사용자 기여 글 카드 (v2b). "파장에 나누기"로 올린 인증/기록.
//   데코 이모지·틴트 없이 lucide 라인 아이콘 + 중립(surface/line/ink/sub) + 브랜드 오렌지만.
//   좋아요 카운터·랭킹 없음 — 조용히 번진 걸음. 익명 글은 신원 대신 "어떤 이의 걸음".
import React, { useEffect, useState } from 'react';
import { View, Text, Image, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { User, Footprints, Heart, MessageCircle } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { toggleParangCourage, type ParangPost } from '@/lib/db';
import { formatCheerCount } from '@/lib/format';
import { colors, fontFamily, fontSize, fontWeight, radius } from '@/lib/tokens';
import { haptic } from '@/lib/haptics';
import { PhotoCarousel } from '@/components/PhotoCarousel';
import { PhotoViewer } from '@/components/PhotoViewer';
import { ParangComments } from './ParangComments';

export function PostCard({ post }: { post: ParangPost }) {
  const router = useRouter();
  const anon = !post.author_nickname;   // 익명 나눔이면 신원 컬럼이 null
  // 🚀 0062: 사진 전체(폴백 = 커버 1장). 방·홈 기록처럼 여러 장 좌우 스와이프
  const photos = post.photo_urls?.length ? post.photo_urls : (post.photo_url ? [post.photo_url] : []);

  // 반응(용기받았어요) 낙관적 상태 — 세션 userId 는 로컬 스토리지에서 1회 읽음
  const [userId, setUserId] = useState<string | null>(null);
  const [couraged, setCouraged] = useState(post.mine_couraged);
  const [count, setCount] = useState(post.courage_count);
  const [showComments, setShowComments] = useState(false);
  const [commentCount, setCommentCount] = useState(post.comment_count);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);   // 사진 전체화면 뷰어
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setUserId(data.session?.user.id ?? null));
  }, []);

  const onCourage = async () => {
    if (!userId) return;
    haptic.tap();
    const prevCouraged = couraged;
    const prevCount = count;
    const next = !couraged;
    setCouraged(next);
    setCount(c => (next ? c + 1 : Math.max(0, c - 1)));
    try {
      await toggleParangCourage({
        postType: post.post_type,
        postId: post.post_id,
        userId,
        currentlyCouraged: prevCouraged,
      });
    } catch {
      setCouraged(prevCouraged);   // 실패 시 롤백
      setCount(prevCount);
    }
  };

  return (
    <View style={styles.card}>
      {/* 작성자 — 비익명은 아바타+닉네임, 익명은 중립 원 + "어떤 이의 걸음" */}
      <View style={styles.head}>
        {anon ? (
          <View style={[styles.avatar, styles.avatarNeutral]}>
            <User size={18} color={colors.faint} strokeWidth={1.8} />
          </View>
        ) : post.author_avatar ? (
          <Image source={{ uri: post.author_avatar }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarNeutral]}>
            <Text style={styles.avatarInitial}>{post.author_nickname?.slice(0, 1)}</Text>
          </View>
        )}
        <View style={{ flex: 1 }}>
          <Text style={styles.name} numberOfLines={1}>
            {anon ? '어떤 이의 걸음' : post.author_nickname}
          </Text>
          <Text style={styles.meta} numberOfLines={1}>
            {post.title} · {relTime(post.created_at)}
          </Text>
        </View>
      </View>

      {post.body ? <Text style={styles.body}>{post.body}</Text> : null}

      {photos.length > 0 ? (
        <PhotoCarousel
          photos={photos}
          aspectRatio={4 / 3}
          borderRadius={radius.lg}
          onPressPhoto={(i) => setViewerIndex(i)}
        />
      ) : null}

      {/* 은은한 "움직인 수" — 좋아요 아닌, 조용히 번진 걸음의 흔적.
          reference>0=따라 시작 / 둘 다 0=아직 조용 / 공명해요만 있으면 라인 숨김(모순 방지, count 는 로컬 반영) */}
      {post.reference_count > 0 ? (
        <Text style={styles.ripple}>이 공명에 {formatCheerCount(post.reference_count)}명이 반응했어요</Text>
      ) : count === 0 ? (
        <Text style={styles.ripple}>아직 조용하지만, 누군가 보고 있어요</Text>
      ) : null}

      {/* 반응 — 공명해요(주, 좌측·강조) · 나도 할래요(보조, 우측 끝).
          공명 = 이 걸음에 마음이 울렸다는 되돌림 (완주이야기 위계와 동일 결). */}
      <View style={styles.actions}>
        <Pressable style={[styles.courageBtn, couraged && styles.courageBtnOn]} onPress={onCourage} hitSlop={6}>
          <Heart
            size={16}
            color={couraged ? colors.surface : colors.brand}
            strokeWidth={1.8}
            fill={couraged ? colors.surface : 'none'}
          />
          <Text style={[styles.courageText, couraged && styles.courageTextOn]}>
            공명해요{count > 0 ? ` ${formatCheerCount(count)}` : ''}
          </Text>
        </Pressable>

        <Pressable
          style={styles.followBtn}
          onPress={() => router.push(`/create?ref=${post.challenge_id}`)}
          hitSlop={6}
        >
          <Footprints size={15} color={colors.sub} strokeWidth={1.8} />
          <Text style={styles.followText}>나도 할래요</Text>
        </Pressable>
      </View>

      {/* 댓글 — "댓글 N개" 탭 → 그 자리 인라인 펼침 (모달 아님) */}
      <Pressable
        style={styles.commentToggle}
        onPress={() => { haptic.tap(); setShowComments(s => !s); }}
        hitSlop={6}
      >
        <MessageCircle size={15} color={commentCount > 0 ? colors.brand : colors.sub} strokeWidth={1.8} />
        <Text style={[styles.commentToggleText, commentCount > 0 && styles.commentToggleTextOn]}>
          {commentCount > 0 ? `댓글 ${formatCheerCount(commentCount)}개` : '댓글 달기'}
        </Text>
      </Pressable>
      {showComments ? (
        <ParangComments
          postType={post.post_type}
          postId={post.post_id}
          userId={userId}
          onCountChange={setCommentCount}
        />
      ) : null}

      <PhotoViewer
        photos={viewerIndex !== null ? photos : null}
        initialIndex={viewerIndex ?? 0}
        onClose={() => setViewerIndex(null)}
      />
    </View>
  );
}

// 상대 시각 (한국어) — 방금 / N분 전 / N시간 전 / N일 전
function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return '방금';
  if (m < 60) return `${m}분 전`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}시간 전`;
  return `${Math.floor(h / 24)}일 전`;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.xl,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 10,
    gap: 10,
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.bg },
  avatarNeutral: { alignItems: 'center', justifyContent: 'center' },
  avatarInitial: { fontSize: 15, color: colors.sub, fontFamily: fontFamily.bold, fontWeight: fontWeight.bold },
  name: { fontSize: fontSize.md, color: colors.ink, fontFamily: fontFamily.bold, fontWeight: fontWeight.bold },
  meta: { fontSize: fontSize.xs, color: colors.faint, fontFamily: fontFamily.regular, marginTop: 2 },
  body: { fontSize: fontSize.md, color: colors.ink, fontFamily: fontFamily.regular, lineHeight: 22 },
  ripple: { fontSize: fontSize.sm, color: colors.faint, fontFamily: fontFamily.regular },
  actions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 2 },
  // 용기받았어요 = 주(강조): 브랜드 테두리·굵은 브랜드 글씨, 보낸 뒤엔 주황 채움
  courageBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.brand,
  },
  courageBtnOn: { backgroundColor: colors.brand },
  courageText: { fontSize: fontSize.sm, color: colors.brand, fontFamily: fontFamily.bold, fontWeight: fontWeight.bold },
  courageTextOn: { color: colors.surface },
  // 나도 할래요 = 보조: 중립 테두리·흐린 글씨 (우측 끝)
  followBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.line,
  },
  followText: { fontSize: fontSize.sm, color: colors.sub, fontFamily: fontFamily.medium, fontWeight: fontWeight.medium },
  commentToggle: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingTop: 2 },
  commentToggleText: { fontSize: fontSize.sm, color: colors.sub, fontFamily: fontFamily.medium, fontWeight: fontWeight.medium },
  commentToggleTextOn: { color: colors.brand, fontFamily: fontFamily.bold, fontWeight: fontWeight.bold },
});
