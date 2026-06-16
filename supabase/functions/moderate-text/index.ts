// 🚀 콘텐츠 검수 (텍스트/다짐) — Claude Haiku 4.5
//
// 입력: { mode: "text" | "pledge", content: string }
// 출력: { verdict: "allow" | "block", reason: string | null, category: string | null }
//
//   text   — 일반 UGC(댓글·기록·완주이야기·대화). [Phase 3 배선 — 모드만 미리 둠]
//   pledge — 다짐(무현금 사회적 스테이크). 엄격. 명시적 금액은 API 전에 즉시 차단(이중 방어 1차).
//
// 순수 판정 로직은 _shared/moderation/moderation.ts 에 두고(자동 테스트 의무 영역),
// 여기선 Claude 호출만 담당 (결제 _shared 패턴과 동일).
//
// 환경변수: ANTHROPIC_API_KEY  — supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
// 배포: supabase functions deploy moderate-text
//       (--no-verify-jwt 안 씀. 로그인 사용자만 호출 가능하게 JWT 검증 ON.)
//
// @ts-nocheck — Deno globals

import {
  containsMoneyAmount, parseModerationVerdict, buildSystemPrompt,
  type ModerationMode,
} from '../_shared/moderation/moderation.ts';

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');

const MODEL = 'claude-haiku-4-5';

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return json({ error: 'Method Not Allowed' }, 405);
  }

  if (!ANTHROPIC_API_KEY) {
    return json({ error: 'ANTHROPIC_API_KEY not configured' }, 500);
  }

  let body: { mode?: ModerationMode; content?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  const mode: ModerationMode = body.mode === 'pledge' ? 'pledge' : 'text';
  const content = (body.content ?? '').trim();

  if (!content) {
    return json({ verdict: 'block', reason: '내용이 비어있어요.', category: null });
  }

  // 다짐 빠른 차단: 명시적 금액이 보이면 Claude 호출 없이 즉시 block (이중 방어의 1차)
  if (mode === 'pledge' && containsMoneyAmount(content)) {
    return json({
      verdict: 'block',
      reason: '다짐에는 금액(돈)을 넣을 수 없어요. 마음만 가볍게 걸어요.',
      category: 'money',
    });
  }

  // Claude API 호출
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 300,
      system: buildSystemPrompt(mode),
      messages: [{ role: 'user', content }],
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    console.error('[moderate-text] Claude API error', res.status, errText);
    // 검수 자체가 실패하면 안전 측 block. 사용자가 다시 시도 가능.
    return json({
      verdict: 'block',
      reason: '검수 시스템 일시 오류. 잠시 후 다시 시도해주세요.',
      category: null,
    }, 200);
  }

  const data = await res.json();
  const text: string = data?.content?.[0]?.text ?? '';
  return json(parseModerationVerdict(text));
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
