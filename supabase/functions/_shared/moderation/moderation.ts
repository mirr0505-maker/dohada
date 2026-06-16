// 🚀 콘텐츠 검수 순수 로직 — 자동 테스트 의무 영역 (CLAUDE.md: AI 콘텐츠 검수)
// Claude Haiku 호출은 EF(moderate-text/index.ts)가 담당하고, 여기엔 "API 없이 검증 가능한"
// 순수 로직만 둔다 — npm test(Node 러너)로 검증하기 위함 (결제 _shared 패턴과 동일).
//
// 두 모드:
//   text   — 일반 UGC(댓글·기록·완주이야기·대화). 기존 moderate-challenge 4카테고리 재사용. [Phase 3 배선]
//   pledge — 다짐(무현금 사회적 스테이크). 엄격: 금액 표기 일절 금지 + 고가/신체·성적/강요 차단.

export type ModerationMode = 'text' | 'pledge';
// 3b: text 모드는 allow/flag/block 3단 (flag=의심 애매 → 사후 자동숨김). pledge 는 allow/block 만 사용.
export type Verdict = 'allow' | 'flag' | 'block';
export interface ModerationResult {
  verdict: Verdict;
  reason: string | null;
  category: string | null;
}

// 명시적 금액(돈) 표기 탐지 — 다짐(pledge)은 "1천원이든 100만원이든" 금액이 보이면 무조건 차단.
// 이건 "빠른 차단" 사전 필터(API 호출 절약)일 뿐, 그물은 Haiku 가 친다(한글 숫자·우회 표기 등).
//   잡는 것: ₩5000 · 5,000원 · 1만원 · 10만 · 만 원 · 천원 · 백만원 · 3억 ...
const MONEY_PATTERNS: RegExp[] = [
  /₩\s*[\d,]+/, // ₩5000, ₩ 5,000
  /[\d,]+\s*원/, // 5000원, 10,000원
  /\d+\s*[만천억]/, // 10만, 5천, 3억 (원 생략도)
  /(백만|천만|[만천억])\s*원/, // 만 원, 천 원, 백만 원, 천만원
];

export function containsMoneyAmount(text: string): boolean {
  return MONEY_PATTERNS.some((re) => re.test(text));
}

// 일반 UGC 검수 — 기존 moderate-challenge 4카테고리(ethics/nation/violence/illegal) 재사용.
const TEXT_SYSTEM_PROMPT = `당신은 한국어 SNS "Do : 하다" 의 콘텐츠 검수자입니다.

사용자가 올린 짧은 글(댓글·기록·소감·대화)을 다음 4 카테고리 기준으로 판단합니다:

1. ethics — 비윤리 (선정성, 혐오, 차별, 미성년자 유해)
2. nation — 반국가 (국가 모독, 정치 선동)
3. violence — 폭력 (자해, 타해, 학대)
4. illegal — 불법 (마약, 도박, 사기, 음란물, 무기 거래)

3단계 판정:
- block — 위 카테고리에 명백히 해당 (분명한 욕설·혐오·음란·불법 등). 등록을 막습니다.
- flag — 위반이 의심되지만 애매하거나 경계선 (맥락상 공격적일 수 있음). 일단 숨기고 사람이 검토합니다.
- allow — 평범한 일상글·응원·감정 표현. 대부분 여기.

확실하지 않으면 allow 와 flag 중에서 고르고, block 은 명백할 때만.

응답은 JSON 한 줄만:
{"verdict": "allow", "reason": null, "category": null}
또는
{"verdict": "flag", "reason": "한국어 한 문장 사유", "category": "ethics|nation|violence|illegal"}
또는
{"verdict": "block", "reason": "한국어 한 문장 사유", "category": "ethics|nation|violence|illegal"}`;

// 다짐(pledge) 검수 — 엄격. 금액/고가/신체·성적/강요 차단.
const PLEDGE_SYSTEM_PROMPT = `당신은 한국어 SNS "Do : 하다" 의 "다짐" 검수자입니다.

다짐은 도전에 거는 무현금 약속입니다 — "지면 ___" 또는 "이기면 ___"
(예: 기부하기, 청소 해주기, 선플 달기, 칭찬하기, 커피 사주기). 돈이 오가지 않는 가벼운 사회적 약속이어야 합니다.

다음 중 하나라도 해당하면 차단(block):

1. money — 금액·돈 표기 (1천원·만원·100만원 등 액수 불문, 명시적 금액은 무조건 차단. 단 "기부하기"는 금액 없으면 허용)
2. luxury — 고가 재화 (명품, 전자기기, 여행, 고액 상품권 등)
3. body — 신체·성적 (자해, 성적 행위, 신체적 굴욕/벌칙). 단 팔굽혀펴기·러닝 같은 건전한 운동은 허용
4. coercion — 비윤리·비도덕적 강요·압박

허용(allow): 금액 없는 기부, 청소·심부름·선플·칭찬, 커피·밥 사주기(금액 미표기·소액 실물), 건전한 운동.
위 4개에 명백히 해당할 때만 block, 평범한 가벼운 약속은 allow.

응답은 JSON 한 줄만:
{"verdict": "allow", "reason": null, "category": null}
또는
{"verdict": "block", "reason": "한국어 한 문장 사유", "category": "money|luxury|body|coercion"}`;

// 모드별 시스템 프롬프트
export function buildSystemPrompt(mode: ModerationMode): string {
  return mode === 'pledge' ? PLEDGE_SYSTEM_PROMPT : TEXT_SYSTEM_PROMPT;
}

// Claude 응답 텍스트 → 검수 결과. JSON 외 텍스트가 섞여도 첫 { ~ 마지막 } 만 파싱.
// 파싱 실패/형식 위반은 안전 측 block (검수 못 했으면 통과시키지 않는다).
export function parseModerationVerdict(raw: string): ModerationResult {
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) {
    return { verdict: 'block', reason: '검수 응답을 해석하지 못했어요.', category: null };
  }
  try {
    const parsed = JSON.parse(match[0]);
    if (parsed.verdict !== 'allow' && parsed.verdict !== 'flag' && parsed.verdict !== 'block') {
      return { verdict: 'block', reason: '검수 응답을 해석하지 못했어요.', category: null };
    }
    return {
      verdict: parsed.verdict,
      reason: parsed.reason ?? null,
      category: parsed.category ?? null,
    };
  } catch {
    return { verdict: 'block', reason: '검수 응답을 해석하지 못했어요.', category: null };
  }
}
