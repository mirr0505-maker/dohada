// 🚀 조직 홈 — 승인된 조직 계정의 유일한 메인 화면 (0087, ORG_HADA_PLAN §10.2 A-5)
//   조직은 소비자가 아니라 주최자 → 탭바 없이 "하다 열기" + 내가 연 하다 목록만.
//   카드 탭 → 기존 챌린지방(주최자 role='host' 라 인증 버튼 없음·집계 제외).
import React, { useCallback, useState } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet, RefreshControl } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Plus, Users, Lock, Globe } from 'lucide-react-native';
import { AppHeader } from '@/components/AppHeader';
import { fetchMyChallengesWithDetails } from '@/lib/db';
import type { MyChallengeDetail } from '@/lib/db';
import { getTodayRange, formatCheerCount } from '@/lib/format';
import { colors, fontFamily, fontSize, fontWeight, radius } from '@/lib/tokens';

type Props = { userId: string; onMenu: () => void };

// 기간 표시 — 같은 해면 월.일만, 해가 바뀌면 연도까지 (09.12 ~ 09.11 처럼 거꾸로 보이는 것 방지)
const formatPeriod = (start: string, end: string): string => {
  const dot = (d: string) => d.replace(/-/g, '.');
  return start.slice(0, 4) === end.slice(0, 4)
    ? `${dot(start.slice(5))} ~ ${dot(end.slice(5))}`
    : `${dot(start)} ~ ${dot(end)}`;
};

export function OrgHome({ userId, onMenu }: Props) {
  const [items, setItems] = useState<MyChallengeDetail[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const all = await fetchMyChallengesWithDetails(userId);
      setItems(all.filter(c => c.creator_id === userId));   // 내가 연 하다만 (조직 계정은 다른 방에 합류하지 않는다)
    } catch {
      // 실패 시 기존 목록 유지 — 빈 화면으로 덮지 않는다
    } finally {
      setLoading(false);
    }
  }, [userId]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const today = getTodayRange().dateStr;
  const active = items.filter(c => c.end_date >= today);
  const ended = items.filter(c => c.end_date < today);

  const renderCard = (c: MyChallengeDetail) => (
    <Pressable key={c.id} style={styles.card} onPress={() => router.push(`/room/${c.id}` as any)}>
      <View style={styles.cardTop}>
        <View style={styles.modeChip}>
          {c.kind === 'closed' ? <Lock size={12} color={colors.sub} /> : <Globe size={12} color={colors.sub} />}
          <Text style={styles.modeText}>{c.kind === 'closed' ? '구성원 전용' : '누구나 합류'}</Text>
        </View>
        <Text style={styles.period}>{formatPeriod(c.start_date, c.end_date)}</Text>
      </View>
      <Text style={styles.cardTitle} numberOfLines={2}>{c.title}</Text>
      <View style={styles.cardMeta}>
        <Users size={14} color={colors.sub} />
        <Text style={styles.metaText}>참여 {formatCheerCount(c.member_count)}명 · 오늘 인증 {formatCheerCount(c.today_check_count)}명</Text>
      </View>
    </Pressable>
  );

  return (
    <View style={{ flex: 1 }}>
      <AppHeader org={{ onMenu }} />
      <ScrollView
        refreshControl={<RefreshControl refreshing={false} onRefresh={load} />}
        contentContainerStyle={styles.body}
      >
        <Pressable style={styles.openBtn} onPress={() => router.push('/create?org=1' as any)}>
          <Plus size={20} color={colors.onBrand} strokeWidth={2.4} />
          <Text style={styles.openText}>조직 하다 열기</Text>
        </Pressable>

        {!loading && items.length === 0 && (
          <Text style={styles.empty}>
            아직 연 하다가 없어요.{'\n'}누구나 합류할 캠페인도, 우리 구성원만의 하다도 열 수 있어요.
          </Text>
        )}
        {active.length > 0 && <Text style={styles.section}>진행 중</Text>}
        {active.map(renderCard)}
        {ended.length > 0 && <Text style={styles.section}>끝난 하다</Text>}
        {ended.map(renderCard)}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 40, gap: 16 },
  openBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 16, borderRadius: radius.lg, backgroundColor: colors.brand,
  },
  openText: { fontSize: fontSize.lg, color: colors.onBrand, fontFamily: fontFamily.bold, fontWeight: fontWeight.bold },
  empty: { fontSize: fontSize.sm, color: colors.sub, fontFamily: fontFamily.regular, lineHeight: 21, textAlign: 'center', paddingVertical: 24 },
  section: { fontSize: fontSize.sm, color: colors.sub, fontFamily: fontFamily.bold, fontWeight: fontWeight.bold, marginTop: 8 },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, padding: 16, gap: 8 },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  modeChip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.pill, backgroundColor: colors.primary50 },
  modeText: { fontSize: fontSize.xs, color: colors.sub, fontFamily: fontFamily.medium, fontWeight: fontWeight.medium },
  period: { fontSize: fontSize.xs, color: colors.faint, fontFamily: fontFamily.regular },
  cardTitle: { fontSize: fontSize.lg, color: colors.ink, fontFamily: fontFamily.bold, fontWeight: fontWeight.bold },
  cardMeta: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  metaText: { fontSize: fontSize.sm, color: colors.sub, fontFamily: fontFamily.regular },
});
