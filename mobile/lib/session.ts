// 🚀 useSession — 로그인 상태 추적
// 반환값: undefined (로딩) / null (로그아웃) / Session (로그인)
import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from './supabase';

export function useSession() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);

  useEffect(() => {
    // UI-only 모드: Supabase 미구성 시 가짜 세션으로 가드 통과. 운영 빌드에선 절대 안 탐.
    if (!isSupabaseConfigured) {
      setSession({ user: { id: 'dev', email: 'dev@dohada.app' } } as any);
      return;
    }

    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (mounted) setSession(data.session);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      if (mounted) setSession(s);
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return session;
}
