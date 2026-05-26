# 🚀 Do : 하다 — 셋업 체크리스트

VS Code + Claude Code로 Day 1을 시작하기 전 점검표.
순서대로 따라가면 환경 셋업이 끝납니다.

---

## 📂 1. VS Code 폴더 구조

```
do-hada/                                # ⭐ 프로젝트 루트
├─ 📘 Do_하다_통합기획서_v4.0.1.docx     # 메인 문서 (Claude Code가 읽음)
├─ 📋 CLAUDE.md                         # Claude Code 작업 규칙
├─ 📋 README.md                         # 프로젝트 소개
├─ 📋 setup-checklist.md                # 이 파일
├─ 🔐 .env                              # 실제 키 (gitignore)
├─ 🔐 .env.example                      # 키 템플릿 (커밋)
├─ 📋 .gitignore
│
├─ 📱 prototype/
│  └─ do-hada-app-v3.html               # 시각 가이드
│
├─ 🎨 design/
│  ├─ tokens.ts                         # 디자인 토큰
│  ├─ tailwind.config.js                # NativeWind 매핑
│  └─ do-hada-tokens-preview.html       # 토큰 미리보기
│
├─ 📚 docs/
│  ├─ HTML-to-React-Native-가이드.md
│  └─ HTML-to-RN-치트시트.html
│
└─ 📦 src/                              # ← Day 1에서 Expo 프로젝트 생성
   └─ (Expo init 으로 자동 생성)
```

---

## ✅ 2. 사전 설치 체크 (Day 1 시작 전)

### 개발 도구
- [ ] Node.js LTS 설치 (≥ 20.x 권장) — `node -v` 확인
- [ ] npm 또는 pnpm 설치 — `npm -v`
- [ ] Git 설치 — `git --version`
- [ ] VS Code 설치 + 한국어 팩
- [ ] Claude Code 설치 — `npm install -g @anthropic-ai/claude-code`
- [ ] Expo CLI — `npm install -g expo`
- [ ] EAS CLI — `npm install -g eas-cli`

### 폰 (iPhone 12 Pro Max 기준)
- [ ] App Store에서 **Expo Go** 설치
- [ ] PC와 같은 Wi-Fi에 연결되어 있는지 확인

### VS Code 확장
- [ ] ESLint
- [ ] Prettier
- [ ] Tailwind CSS IntelliSense (NativeWind 자동 완성)
- [ ] React Native Tools
- [ ] TypeScript Vue Plugin (또는 기본 TS)

---

## 🔑 3. 외부 서비스 계정 + 키 발급

다음 서비스에 계정을 만들고 키를 `.env`에 채워 넣습니다.
**Phase 1 MVP는 Supabase + 카카오 + Anthropic 3개만 있으면 시작 가능.**

### 필수 (Phase 1 MVP 시작 시 필요)
- [ ] **Supabase 프로젝트 생성** — https://supabase.com
  - `EXPO_PUBLIC_SUPABASE_URL`
  - `EXPO_PUBLIC_SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY` (Edge Function 용)
- [ ] **카카오 디벨로퍼스 앱 등록** — https://developers.kakao.com
  - 네이티브 앱 키
  - REST API 키
  - 플랫폼: iOS 번들 ID + Android 패키지명 등록
- [ ] **Anthropic API 키** — https://console.anthropic.com
  - `ANTHROPIC_API_KEY` (Claude API 콘텐츠 검수용)

### Phase 1 후반 (베타 출시 직전)
- [ ] **토스페이먼츠** — https://docs.tosspayments.com (테스트 키부터)
- [ ] **Apple Developer Program** — $99/year (iOS 출시 필수)
- [ ] **Google Play Console** — $25 단발 (Android 출시 필수)
- [ ] **EAS Build** — Expo 계정 + 프로젝트 ID
- [ ] **Sentry** — 에러 모니터링
- [ ] **Mixpanel** 또는 **PostHog** — 행동 분석

### Phase 2+ (확장 시점)
- [ ] Stripe (글로벌 결제)
- [ ] Google OAuth (글로벌 로그인)

---

## 📋 4. .gitignore 필수 항목

```gitignore
# 환경변수
.env
.env.*
!.env.example

# Expo
.expo/
.expo-shared/
dist/
web-build/

# Node
node_modules/
npm-debug.*
yarn-debug.*
yarn-error.*

# IDE
.vscode/
.idea/
*.swp

# OS
.DS_Store
Thumbs.db

# 빌드
*.jks
*.p8
*.p12
*.key
*.mobileprovision
*.orig.*

# 로그
*.log

# Supabase 로컬
supabase/.temp/
```

---

## 🎬 5. Day 1 첫 명령어 (Claude Code)

VS Code에서 위 폴더 구조 셋업 + `.env` 채워 넣은 후:

```bash
cd do-hada/
claude code .
```

### 첫 프롬프트 (복사해서 사용)

```
이 프로젝트는 Do : 하다 챌린지 SNS 앱입니다.

📘 메인 문서: Do_하다_통합기획서_v4.0.1.docx 를 먼저 읽어주세요.
📋 작업 규칙: CLAUDE.md 를 반드시 준수합니다.
📱 시각 가이드: prototype/do-hada-app-v3.html (v3.4 기준 24화면)
🎨 디자인 토큰: design/tokens.ts, design/tailwind.config.js 를 src/ 에 그대로 적용

Phase 1 MVP를 시작합니다. 부록 E.8 의 Week 1 — Day 1 에 해당하는
"환경 셋업" 작업부터 진행해주세요.

다음을 순서대로 해주세요:
1. src/ 폴더에 Expo 프로젝트 생성 (TypeScript 템플릿)
2. NativeWind 셋업
3. design/tokens.ts → src/lib/tokens.ts 복사
4. design/tailwind.config.js → src/tailwind.config.js 복사
5. Pretendard 폰트 적용
6. 컬러 토큰이 잘 적용되는지 확인할 테스트 화면 1개

CLAUDE.md 의 "선보고 후실행" 규칙에 따라, 큰 결정(라이브러리 추가 등)은
먼저 AS-IS → TO-BE 로 설명해주세요. 작은 건 바로 진행 후 한 줄 보고면
충분합니다.
```

---

## 🛡️ 6. 보안 점검 (Day 1 끝나기 전)

- [ ] `.env` 파일이 git에 안 올라갔는지 `git status`로 확인
- [ ] `.gitignore`에 `.env` 들어있는지 확인
- [ ] Supabase **Anon Key**만 `EXPO_PUBLIC_` 으로 쓰고 Service Role Key는 별도
- [ ] 첫 커밋 메시지에 API 키가 포함되지 않았는지 확인
- [ ] GitHub 리포지토리는 **Private**로 만들기

---

## 🎯 7. Day 1 완료 기준

다음 3개가 모두 되면 Day 1 완료:

- [ ] `npx expo start` → QR 코드로 폰에서 앱이 열림
- [ ] 테스트 화면에서 디자인 토큰 컬러(오렌지 #FF6B35)가 정상 표시됨
- [ ] Pretendard 폰트가 적용됨 (시스템 폰트 아님)

---

## 📞 8. 막힐 때

1. Claude Code에 에러 메시지 통째로 붙여넣기
2. "Expo + NativeWind + TypeScript 환경" 명시
3. 그래도 안 되면 통합기획서 부록 **E.9 막힐 때 비상 대응** 참고
4. Expo Discord / Supabase Discord 커뮤니티

---

**마지막으로 ⚠️**

이 체크리스트는 **순서대로 따라가면 끝나도록** 만들어졌습니다.
도중에 막히면 다음 단계로 도망가지 말고, 그 자리에서 해결하세요.
1인 바이브 코딩의 함정은 "다음에 하지 뭐"가 누적되는 것입니다.

🚀 좋은 출발 되세요!
