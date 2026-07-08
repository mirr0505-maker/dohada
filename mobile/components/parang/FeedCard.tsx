// 🚀 파장 피드 카드 — 자동 이벤트(참조/완주/기부) 한 줄 서사.
//   데코 이모지·틴트 없이 lucide 라인 아이콘 + 중립(surface/line/ink/sub) + 브랜드 오렌지만 사용.
//   비교/랭킹 아님 — 조용히 번진 이야기. (v1 = 자동 이벤트만, 반응 버튼은 v2)
import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { Repeat, Trophy, HeartHandshake } from 'lucide-react-native';
import { colors, fontFamily, fontSize, fontWeight } from '@/lib/tokens';
import type { ParangFeedItem } from '@/lib/db';

export function FeedCard({ item }: { item: ParangFeedItem }) {
  const router = useRouter();

  // 참조(파장 번짐) — 유일하게 CTA(따라하기) 있는 카드. 아이콘은 행동 톤이라 브랜드색.
  if (item.event_type === 'reference') {
    return (
      <View style={styles.card}>
        <View style={styles.iconWrap}>
          <Repeat size={15} color={colors.brand} strokeWidth={1.8} />
        </View>
        <View style={styles.body}>
          <Text style={styles.line}>
            어떤 이의 <Text style={styles.strong}>'{item.title}'</Text>을 따라{' '}
            <Text style={styles.strong}>{item.count ?? 0}명</Text>이 시작했어요
          </Text>
          {item.challenge_id ? (
            <Pressable
              onPress={() => router.push(`/create?ref=${item.challenge_id}`)}
              hitSlop={8}
            >
              <Text style={styles.cta}>나도 이 하다 하기</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    );
  }

  // 완주 — 목격만 (CTA 없음)
  if (item.event_type === 'completion') {
    return (
      <View style={styles.card}>
        <View style={styles.iconWrap}>
          <Trophy size={15} color={colors.faint} strokeWidth={1.8} />
        </View>
        <View style={styles.body}>
          <Text style={styles.line}>
            어떤 이가 <Text style={styles.strong}>'{item.title}'</Text>을 완주했어요
          </Text>
        </View>
      </View>
    );
  }

  // 기부 전환 — 익명. 한잔이 세상으로 흐른 온기.
  return (
    <View style={styles.card}>
      <View style={styles.iconWrap}>
        <HeartHandshake size={15} color={colors.faint} strokeWidth={1.8} />
      </View>
      <View style={styles.body}>
        <Text style={styles.line}>
          따뜻한 마음 <Text style={styles.strong}>{(item.amount ?? 0).toLocaleString('ko-KR')}원</Text>이 기부로 흘렀어요
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // 🚀 위계 차등(v2c): 자동 이벤트는 사용자 글(PostCard) 뒤 배경 앰비언트 —
  //   카드 테두리·흰 배경 없이 옅은 한 줄로 낮춰 나열식 잡음을 줄인다.
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingHorizontal: 6,
    paddingVertical: 9,
    marginBottom: 2,
  },
  iconWrap: {
    width: 22,
    alignItems: 'center',
    paddingTop: 1,
  },
  body: { flex: 1, gap: 4 },
  line: {
    fontSize: fontSize.sm,
    color: colors.sub,
    fontFamily: fontFamily.regular,
    lineHeight: 20,
  },
  strong: { color: colors.ink, fontFamily: fontFamily.medium, fontWeight: fontWeight.medium },
  cta: {
    fontSize: fontSize.xs,
    color: colors.brand,
    fontFamily: fontFamily.bold,
    fontWeight: fontWeight.bold,
  },
});
