// 🚀 루트 에러 경계 — 화면이 흰색으로 죽는(white screen) 대신 실제 에러를 화면에 표시.
// 목적: ① 원격 베타 테스터가 흰 화면 대신 "에러 메시지 + 어느 컴포넌트"를 캡처해 보낼 수 있게,
//       ② 앱이 죽지 않으니 reportError 의 비동기 적재(client_errors)가 끝까지 완료되게 (치명 크래시의 로그 누락 방지).
// 무한 렌더 루프(Maximum update depth exceeded)도 React 가 throw 하므로 여기서 잡힌다.
import React from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import { AlertTriangle } from 'lucide-react-native';
import { colors, fontFamily, fontSize, fontWeight, radius } from '@/lib/tokens';
import { reportError } from '@/lib/sentry';

type Props = { children: React.ReactNode };
type State = { error: Error | null; componentStack: string | null };

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null, componentStack: null };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    // 앱이 죽지 않으므로 이 비동기 적재는 끝까지 완료됨 (흰 화면 크래시 때 누락되던 로그 확보)
    this.setState({ componentStack: info.componentStack });
    reportError(error, { where: 'root_boundary', componentStack: info.componentStack?.slice(0, 4000) });
  }

  reset = () => this.setState({ error: null, componentStack: null });

  render() {
    const { error, componentStack } = this.state;
    if (!error) return this.props.children;

    return (
      <View style={styles.container}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <View style={styles.emoji}><AlertTriangle size={44} color={colors.warning} strokeWidth={1.6} /></View>
          <Text style={styles.title}>오류가 발생했어요</Text>
          <Text style={styles.guide}>아래 내용을 캡처해서 개발자에게 보내주세요</Text>

          <Text style={styles.sectionLabel}>메시지</Text>
          <Text style={styles.code} selectable>{error.message || String(error)}</Text>

          {error.stack ? (
            <>
              <Text style={styles.sectionLabel}>스택</Text>
              <Text style={styles.code} selectable>{error.stack.slice(0, 1800)}</Text>
            </>
          ) : null}

          {componentStack ? (
            <>
              <Text style={styles.sectionLabel}>컴포넌트 위치</Text>
              <Text style={styles.code} selectable>{componentStack.slice(0, 1800)}</Text>
            </>
          ) : null}

          <Pressable style={styles.btn} onPress={this.reset}>
            <Text style={styles.btnText}>다시 시도</Text>
          </Pressable>
        </ScrollView>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: 20, paddingTop: 64, gap: 8 },
  emoji: { alignItems: 'center' },
  title: {
    fontSize: fontSize.xl,
    fontFamily: fontFamily.bold,
    fontWeight: fontWeight.bold,
    color: colors.primary,
    textAlign: 'center',
  },
  guide: {
    fontSize: fontSize.sm,
    fontFamily: fontFamily.regular,
    color: colors.primary500,
    textAlign: 'center',
    marginBottom: 12,
  },
  sectionLabel: {
    fontSize: fontSize.xs,
    fontFamily: fontFamily.bold,
    fontWeight: fontWeight.bold,
    color: colors.accent700,
    marginTop: 12,
  },
  code: {
    fontSize: 12,
    fontFamily: fontFamily.regular,
    color: colors.primary,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.primary100,
    borderRadius: radius.md,
    padding: 12,
    lineHeight: 17,
  },
  btn: {
    marginTop: 20,
    backgroundColor: colors.accent,
    borderRadius: radius.pill,
    paddingVertical: 14,
    alignItems: 'center',
  },
  btnText: {
    fontSize: fontSize.base,
    fontFamily: fontFamily.bold,
    fontWeight: fontWeight.bold,
    color: colors.surface,
  },
});
