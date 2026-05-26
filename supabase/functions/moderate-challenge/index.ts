// 🚀 챌린지 콘텐츠 검수 — Claude Haiku 4.5
//
// 입력: { title: string, description?: string }
// 출력: { verdict: "allow" | "block", reason: string | null, category: string | null }
//
// 기획서 4.6.3 어뷰징 방지 6가지 중 "AI 검증" 적용.
// 4 카테고리: ethics(비윤리) / nation(반국가) / violence(폭력) / illegal(불법)
//
// 환경변수:
//   ANTHROPIC_API_KEY  — supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
//
// 배포: supabase functions deploy moderate-challenge
//       (--no-verify-jwt 안 씀. 로그인 사용자만 호출 가능하게 JWT 검증 ON.)
//
// @ts-nocheck — Deno globals

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');

const MODEL = 'claude-haiku-4-5';

const SYSTEM_PROMPT = `당신은 한국어 챌린지 SNS "Do : 하다" 의 콘텐츠 검수자입니다.

사용자가 만들려는 챌린지의 제목과 설명을 받아 다음 4 카테고리 중 하나라도 해당하면 차단합니다:

1. ethics — 비윤리 (선정성, 혐오, 차별, 미성년자 유해)
2. nation — 반국가 (국가 모독, 정치 선동, 국가 안보 위협)
3. violence — 폭력 (자해, 타해, 학대)
4. illegal — 불법 (마약, 도박, 사기, 음란물, 무기 거래)

판단 기준:
- "다이어트", "금연", "운동" 같은 자기계발은 모두 허용.
- "단식 100일" 같은 건강 위협 챌린지는 violence 로 차단.
- 정치 의견은 평범한 토론 수준이면 허용, 선동/모독은 차단.
- 애매하면 allow. 명백한 위반만 차단.

응답은 JSON 한 줄만:
{"verdict": "allow", "reason": null, "category": null}
또는
{"verdict": "block", "reason": "한국어 한 문장 사유", "category": "ethics|nation|violence|illegal"}`;

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return json({ error: 'Method Not Allowed' }, 405);
  }

  if (!ANTHROPIC_API_KEY) {
    return json({ error: 'ANTHROPIC_API_KEY not configured' }, 500);
  }

  let body: { title?: string; description?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  const title = (body.title ?? '').trim();
  const description = (body.description ?? '').trim();

  if (!title) {
    return json({ verdict: 'block', reason: '제목이 비어있어요.', category: null });
  }

  const userMessage = description
    ? `제목: ${title}\n설명: ${description}`
    : `제목: ${title}`;

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
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }],
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    console.error('[moderate-challenge] Claude API error', res.status, errText);
    // 검수 자체가 실패하면 안전 측 block. 사용자가 다시 시도 가능.
    return json({
      verdict: 'block',
      reason: '검수 시스템 일시 오류. 잠시 후 다시 시도해주세요.',
      category: null,
    }, 200);
  }

  const data = await res.json();
  const text: string = data?.content?.[0]?.text ?? '';

  // Claude 가 JSON 외 텍스트를 섞을 가능성 — 첫 { ~ 마지막 } 만 추출
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) {
    console.error('[moderate-challenge] non-JSON response:', text);
    // 파싱 실패 시도 안전 측 block
    return json({ verdict: 'block', reason: '검수 응답을 해석하지 못했어요.', category: null });
  }

  try {
    const parsed = JSON.parse(match[0]);
    if (parsed.verdict !== 'allow' && parsed.verdict !== 'block') {
      throw new Error('invalid verdict');
    }
    return json({
      verdict: parsed.verdict,
      reason: parsed.reason ?? null,
      category: parsed.category ?? null,
    });
  } catch (e) {
    console.error('[moderate-challenge] JSON parse failed', e, text);
    return json({ verdict: 'block', reason: '검수 응답을 해석하지 못했어요.', category: null });
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
