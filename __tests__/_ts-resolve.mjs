// 🚀 테스트 전용 모듈 해석 훅 — mobile/lib/*.ts 를 Node 테스트 러너에서 import 하기 위한 것.
//
// 왜 필요한가: mobile/ 코드는 번들러(Metro) 관례대로 확장자 없는 상대 임포트(`from './format'`)를 쓴다.
//   Node ESM 은 확장자를 안 붙이면 파일을 못 찾아 mobile/lib/stats.ts 를 통째로 import 할 수 없었다.
//   (기존 테스트는 확장자를 명시하는 supabase/functions/_shared/** 만 다뤄서 이 문제가 없었다.)
// 하는 일: 상대 경로 해석이 실패하면 '.ts' 를 붙여 한 번만 더 시도한다. 그 외는 기본 동작 그대로.
import { registerHooks } from 'node:module';

registerHooks({
  resolve(specifier, context, nextResolve) {
    try {
      return nextResolve(specifier, context);
    } catch (err) {
      if (specifier.startsWith('.') && !specifier.endsWith('.ts')) {
        return nextResolve(`${specifier}.ts`, context);
      }
      throw err;
    }
  },
});
