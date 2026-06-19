# 🎯 Do : 하다 — MVP_SCOPE (v2.5)

**이 문서가 Phase 1 의 단일 진실원천이다.**
통합기획서 v4.0.1 은 정체성/철학/장기 비전 자산이며, MVP 단계에서는 **이 문서만** 따른다.
프로토타입 [`prototype/do-hada-app-v4.html`](../prototype/do-hada-app-v4.html) 이 UI/UX 의 절대 기준이다.
**베타 모집 HTML 의 청사진은 [`beta-landing-plan.md`](beta-landing-plan.md) 참조.**

> **2026-05-31 v2 재설계 메모**
> v1 은 "같이 응원" 한 가지에만 좁혀서 "챌린지 인증 도구" 처럼 보였다.
> Do:하다는 **차세대 SNS** 이며 매슬로우 5단계 자아실현에 답한다.
> v2 는 통합기획서 + v4 프로토타입의 정체성·UI 를 베타 단계로 끌어올린다.

> **2026-06-01 v2.1 추가 메모** — 미르의 두 추가 제안 반영
> 1. **🙋 응원받기 방 (cheered) 신규** — 도전자 1명 + 초대 지인 N명 응원.
>    원래 Do:하다의 가장 본질적 기능. 통합기획서 페르소나 2 (워킹맘 혈당) 직답.
> 2. **🔔 조용 알림 4원칙** — SNS 기본인 실시간 알림 도입, 단 도파민 루프 차단.
>    (1) 응원·좋아요는 1시간 묶음 (2) 채팅·댓글만 즉시 무음+진동 (3) 22-8시 KST 보류
>    (4) 사용자당 하루 5건 상한. 학생 핸드폰 중독 메커니즘 정면 반대.
> 3. **큰 숫자 단독 노출 금지** 정책화 — 0~99 그대로, 100+ → "99+" 통일.

> **2026-06-01 v2.2 추가 메모** — 베타 시작 전 인증 흐름 핵심 보강
> **인증 = 카메라 + 보관함 스크린샷 양쪽 허용.**
> 운동·등산·사이클·걷기 앱은 자체 기록 화면 (시간/거리/경로 표시) 이 진짜 인증의 증거.
> 카메라로 폰 화면 다시 찍는 건 부자연스러움 → 보관함 직접 선택 허용.
> 베타는 사용자 자발적 신뢰 ("시간 표시가 보이는 스샷이면 좋아요" 안내) 로 운영.
> 베타 30명 인터뷰에서 어뷰징 실제 발생 여부 확인 후 Phase 1.5 에 EXIF/시간/AI 검증 활성화 결정.
> 기록 (Vlog) 사진 첨부도 같은 인프라로 동시 허용 (MVP_SCOPE §3.6 의 "선택 이미지" 가시화).

> **2026-06-02 v2.3 추가 메모** — 베타 출시 직전 정체성·UX 보강
> 1. **🚫 도전 포기 (soft delete)** — 잠시 멈춤과 본질 다름. challenge_members.gave_up_at 컬럼으로 영구 중단.
>    본인 화면 hide, 다른 멤버 화면엔 "포기" 라벨. 데이터 보존 → Phase 2 박제 재활용.
> 2. **📝 기록·댓글 수정/삭제** — 본인 글만. RLS UPDATE policy 추가 (마이그레이션 0013).
> 3. **🏠 홈 v2.3 — 분류별 그룹 컨테이너** — 4분류 = 4가지 SNS 톤이 한 앱에 공존.
>    순서: 🤫 혼자만의 다짐 → 🙋 응원받는 도전 → 🤝 함께 도전 → 🌍 누구나 합류.
>    각 분류 카드 디자인·카피·매칭 알림 다름. 동료 활동 Feed 는 만들지 않음 (챌린지방 안 컨텍스트 보존).
> 4. **👤 통합 AppHeader** — 4 탭 (홈/내챌린지/둘러보기/내정보) 공통 헤더. 닉네임/아바타 자동 동기화.

> **2026-06-02 v2.4 추가 메모** — 관심 분류 시스템
> **명시 관심 등록 → 매칭 오픈 도전 자동 노출.** 알고리즘 도파민 X · 사용자 의도 명확.
> - 내정보 → 관심 분야 → 10 대분류 토글 (2-column 모던 grid).
> - 홈에 "✨ 관심 도전" 섹션 (4그룹 다음 + 둘러보기 전).
> - 매칭 = 대분류만 (Phase 1). 소분류 + 가중치 + 인연 연계는 Phase 1.5.
> - 자동 추론 (본인 챌린지 카테고리 union) 도입 검토했으나 **베타에선 제외** — 사용자 명시 의도만.

> **2026-06-04 v2.5 추가 메모** — 홈 SNS-first 재설계 + 톤 완화
>
> **사상 진단** — v2.1~v2.4 는 "X 빼기" 4개 (비교·친구신청·알림·무한스크롤) 에 집중하다가 챌린지 도구로 끌려갔다.
> 빼기만 하면 사회성 자체가 사라진 도구가 된다. **버릴 건 망가진 방식, 지킬 건 욕구 자체** 가 v2.5 정체성.
>
> | 욕구 | 기존 SNS 표현 (버림) | Do:하다 새 표현 (살림) |
> |---|---|---|
> | 인정받기 | 좋아요 수 | 목격받기 (동료가 내 여정을 지켜봄) |
> | 소속 | 팔로우 | 도전 인연 (목적 기반 관계) |
> | 타인과 이어짐 | 도파민 피드 | 되어가는 과정 피드 |
>
> 1. **🏠 홈 = SNS-first 피드** — v2.3 의 "동료 활동 Feed 안 만듦" 정책 뒤집기.
>    내 대시보드는 me-strip 1줄로 압축, 본문은 도전 인연들의 하루 피드.
>    피드 카드 5종: 🎉 완주 리본 · 📸 오늘의 인증 · 🙋 응원받기 · 🌍 누구나 합류 · ✨ 관심 도전.
>    맨 아래 🌙 "오늘은 여기까지예요" 끝 마커 (무한 스크롤 차단 — 차별점).
>    **챌린지방 5탭 컨텍스트는 그대로 유지** (이중 보존 — 방 안에서도 보이고 홈에서도 보임).
>
> 2. **하단 탭 5개 재구성** — 홈(피드) / 내도전 / ⊕ / 기록 / 해냈어요.
>    profile 탭 제거 → 우상단 아바타로 MY 일원화. + 버튼 = 만들기 5단계 마법사 (3.2 참조).
>    매일 액션 (오늘 인증하기) = me-strip 의 [인증하기] 버튼.
>
> 3. **🏆 "해냈어요" 신규 탭** — 박제 → "완주 이야기 공유" 공개 무대.
>    "자랑 X · 증언 ✓" 톤. 카드엔 좋아요 수 대신 **"N명에게 용기를 줬어요"**.
>    각 이야기 끝에 "나도 비슷한 도전 시작하기" → 신규 유입 루프 (바이럴 엔진).
>    시스템 통계 (기간·연속·인증 횟수·완주율) 자동 잠금 (조작 불가). 사진·소감·"가장 어려웠던 점" 옵션.
>    공개 범위: public / 도전 인연에게만.
>
> 4. **도전 인연 정의 (베타 v2.5)** — **현재 같은 챌린지의 멤버만**.
>    홈 피드의 "도전 인연들의 하루" = 지금 함께 도전 중인 방의 동료. 과거 인연 누적 (×횟수) 은 Phase 2.
>    응원받기 방의 응원자도 동일 챌린지 멤버 (RLS 기준) → 인연 포함.
>
> 5. **박제 자산화 4단계 상품** — UI 노출은 하되 **가격은 "추후 결정"** 표기.
>    디지털 인증서 (PDF, 무료) / 종이 인증서 / 포토북 / 굿즈 — 4단계. 책 단계는 베타 노출 보류.
>    Phase 2 정산·제휴 변동 시 신뢰 손실 방지 목적 (베타에 가격 못박지 않음).
>
> 6. **현황 탭 카피 조정** — "오늘 5명 중 4명 함께함" 동행 표현.
>    인증률 순위·랭킹 그대로 X. 집단 성취 ("우리 방이 함께 쌓은 322번의 인증") 톤 추가.
>
> 7. **톤 완화** — "절대 / 반드시 / 금지" 강한 부정 어조 → "원칙적으로 / 지양 / 권장" 부드러운 톤.
>    정책 본질 (친구 신청 없음, 비교 압박 없음, 박제 영구 등) 은 유지.
>    "왜 안 만드나" 가 아니라 **"어떤 욕구를 어떻게 살리나"** 로 설명.

> **2026-06-11~13 v2.6 → v2.14 증분 메모** — 베타 출시 후 OTA 로 즉시 반영 (상세 = [`CLAUDE.md`](../CLAUDE.md) 신규 코드 위치 / [`FEEDBACK.md`](../FEEDBACK.md) 대장). 모두 v2.5 정체성 강화 방향:
> - **연속 인증 메달** (0044) — 3·7·21·49·99·180·365·730일을 *사람(아바타/닉네임) 아닌 인증 게시글* 에 오각형 숫자 메달로 자축. 비교·줄세우기 아닌 자기 자축 (거대숫자 상시노출 금지 유지).
> - **누구나 방 모집 마감** (0043) — 개설자 수동 잠금 + 50·100명 임계 알림 + 도전 기간 50% 자동 마감. "목격하는 동료" 친밀성 보존 (군중화 방지). 공식 미션은 별도 트랙(§5.1, 수만 명 전제·캡 없음).
> - **인증/기록 여러 장** (0045) — 인증 3장·기록 4장. 카드 인라인 + 전체화면 좌우 스와이프. `photo_url` 은 커버로 유지(기존 무탈).
> - **비멤버 읽기 전용** (0042) — 누구나 방 비멤버는 인증·기록 열람만, 응원·댓글·현황은 합류 후.
> - **목표 횟수형 도전** (0041) — "기간 내 N개 달성" 유형 (100대명산·올레). 매일 의무 X·하루 다회 OK·조기 완주 인정.
> - **응원 한잔 / 나와의 내기 / 다인 내기** — Phase 2 핀테크 mock 파일럿 (실돈 0원, 단일 진실원천 [`PHASE2_FINTECH_PLAN.md`](PHASE2_FINTECH_PLAN.md)).
> - 알림 통일(푸시+벨)·종료 방 박제 유예·포기=조용한 보관·완주 동선·전체화면 사진 뷰어·참가자 수/오늘 인증 수 정확화·워드마크 등 안정화 다수.

> **2026-06-16~17 v2.15 → v2.18 증분 메모**:
> - **다짐 / 신고·차단 / cheered 응원자 시선** (0046·0047·0048) — 무현금 약속(다짐)·UGC 안전(신고·차단·신고3건 자동숨김)·응원받기 역할(응원자 시선) 정리.
> - **하다 구경(익명 발상 라이브러리)** (0050, v2.18) — 구 '둘러보기(discover)'가 진입점 0개로 사장되어 4평가까지 비노출이던 걸 재설계: 개설자·참여자 **신원 제거(익명)** + 전체 유형 노출 + 4평가(✨😱🥹💫) 살림 + **따라하기(복제)·참조수**. 진입점 = 내하다 맨 아래 + 홈. **§3.8 갱신**.

> **2026-06-18 v2.19 증분 메모**:
> - **검수 숨김 강도 완화 + 숨김 정직화** (FEEDBACK #44) — AI 검수가 책 감상 기록을 과민 `flag`→`hidden`으로 조용히 숨겨 작성자조차 못 보던 문제. ① 명백한 위반(`block`)만 작성 차단, `flag`는 더 이상 자동 숨김 안 함(전 UGC 공통, 잔여 안전망 = block + 신고3건 자동숨김) ② 숨김 기록은 증발 대신 카드 자리에 "🙈 숨김 처리된 기록이에요" 플레이스홀더(참여/응원 인원 모두 목격). JS만(OTA), DB·EF 무변경.

---

## 1. 왜 만드는가 — 차세대 SNS 의 자리잡기

> "비교 없이 응원받고, 친구 신청 없이 동료를 만나고, 내가 나아지면서 세상도 나아지는 SNS"

### 1.1 SNS 시대의 한계 (통합기획서 서문)

인스타그램은 광고판이 되었고, 페이스북은 노년의 공간이 되었고, 카카오톡은 업무 도구가 되었다.
MZ세대는 이미 이 흐름을 거부하고 있다 — 인스타 스토리 닫기, 카톡 프로필 안 바꾸기, 친구 추가 망설이기. 이건 단순 트렌드가 아니라 **디지털 시대의 자기보호**다.

그러나 사람들은 여전히 연결을 원한다. 다만 **다른 방식의 연결**이다.

### 1.2 Do:하다가 답하는 세 질문

1. "비교 없이 응원받을 수 있을까?"
2. "친구 신청 없이 동료를 만날 수 있을까?"
3. "내가 더 나아지면서, 세상도 함께 나아질 수 있을까?"

### 1.3 매슬로우 5단계와 Do:하다 (통합기획서 2.4)

대부분 SNS 는 매슬로우 3단계 (소속/애정) 에서 멈춘다.

- 인스타: "내가 얼마나 예쁜지 보세요" (3단계 — 피상적 인정)
- 카톡: "친구야 잘 지내?" (3단계 — 피상적 소속)
- **Do:하다: "오늘도 한 걸음 나아갔어요"** (5단계 — 자아실현)

5단계 자아실현을 핵심으로 삼되, 1~4단계는 **자연 발생하는 부산물** 로 처리한다.

| 단계 | 욕구 | Do:하다 |
|---|---|---|
| 1 | 생리적 | 건강 챌린지 (수면/식사/운동) |
| 2 | 안전 | 금연/금주, 재테크 |
| 3 | 소속/애정 | 도전 동료 (목적 기반, 친구 신청 X) |
| 4 | 존중/인정 | 4가지 평가, 박제, ×횟수 |
| 5 | 자아실현 | 100일 완주, 사회공헌, "더 나은 나, 더 나은 세상" |

매슬로우는 **UI 에 명시적으로 표시하지 않는다**. 온보딩 카피, 챌린지방 헤더의 "함께 만든 변화", 내정보 태그라인에 자연스럽게 녹인다.

### 1.4 슬로건

> **도전, 그냥 하다. 더 나은 나, 더 나은 세상.**

---

## 2. 성공 기준

- 베타 사용자 **30명**이 챌린지 만들어서 **1주일 이상 인증 지속**
- 30명 중 **10명 이상**이 "친구에게 추천하고 싶다" 응답
- 챌린지당 **평균 3명 이상** 모임
- 인증 사진뿐 아니라 **기록 (Vlog) 1개 이상** 작성한 사용자 10명 이상 (SNS 정체성 검증)

이게 안 되면 기능 더 만들지 말고 **왜 안 쓰는지** 인터뷰부터 한다.

---

## 3. ✅ Phase 1 만드는 것 — 7대 영역

### 3.1 SNS 로그인 (Google + Apple)
- Google: Android + iOS 공통
- Apple Sign In: iOS 만 (App Store 정책 필수)
- 카카오: Phase 1.5
- SNS 로그인 = 가입. 약관 동의 화면(`welcome`)에서 통합.

### 3.2 챌린지 만들기 — 5단계 마법사 (2026-06-11: 7→5 압축)

각 단계는 한 화면에 큰 질문 + 옵션 카드. 죽은 단계 제거 — 내기 단계 삭제(마지막 화면 한 줄 티저), 기간+빈도 병합.

| 단계 | 항목 | 옵션 |
|---|---|---|
| 1 | 제목 | 직접 입력 (최대 40자) + 인기 추천 칩 6개 (📚 100일 책 읽기, 🏃 매일 5km 러닝 등) |
| 2 | 카테고리 | **10 대분류** + 소분류 (3.3 참조) |
| 3 | 방 타입 | **4종 (3.6 참조)** 🤫 혼자만의 다짐 / 🙋 **응원받기 (cheered)** / 🤝 함께 도전하기 / 🌍 누구나 합류 |
| 4 | 기간 + 빈도 | ⏱️ 1일 / ⚡ 3일 / 🌱 7일 / 🌿 30일 / 🌳 100일 ⭐추천 / 🏔️ 180일 / 🌟 1년 + 🔥 매일 / 📅 주 3회 / 📆 주 1회. 1일 선택 시 당일 고정 + 시작 날짜 예약 달력 (오늘~100일) |
| 5 | 인증 방식 | 📸 사진 / 🖼️ 앱 스크린샷 (v2.2 양쪽 허용) — GPS 는 Phase 2 비활성. 하단에 "내기는 Phase 2" 한 줄 티저 |

톤·레이아웃·이모지는 프로토타입 v4 를 따르되, 단계 구성은 본 표(코드 `create.tsx`)가 기준 (v4 HTML 은 7단계 시절).

### 3.3 카테고리 시스템 — 10 대분류 + 소분류

| 이모지 | 대분류 | 정체성 카피 | 소분류 예시 |
|---|---|---|---|
| 💪 | 건강 | 건강을 가꾸는 사람들 | 금연/금주/다이어트/영양/수면/정신건강/명상 |
| 🏃 | 운동 | 몸을 단련하는 사람들 | 러닝/헬스/등산/자전거/수영/요가/필라테스/구기종목 |
| 📚 | 학습 | 배움을 쌓는 사람들 | 독서/외국어/자격증/코딩/온라인강의/시험준비 |
| 🎨 | 창작 | 새로움을 만드는 사람들 | 글쓰기/그림/사진/음악/영상/디자인/공예 |
| 💼 | 자기계발 | 꾸준함을 쌓는 사람들 | 루틴/습관/시간관리/생산성/마인드/리더십 |
| 💰 | 재테크 | 미래를 준비하는 사람들 | 저축/투자/가계부/부채상환/창업 |
| 🌍 | 라이프 | 일상을 가꾸는 사람들 | 여행/맛집/취미/봉사/환경/패션 |
| 🤝 | 관계 | 마음을 나누는 사람들 | 가족/연인/친구/육아/반려동물 |
| 🌍 | **사회공헌** | 세상에 변화를 만드는 사람들 | 환경/기부/봉사/공익 (자동 "사회공헌 챌린지" 뱃지) |
| ✨ | 기타 | 새로운 길을 여는 사람들 | 자유 입력 (진화 모델 진입) |

진화 모델 (기타 → 정식 분류) 은 Phase 1.5. MVP 는 자유 입력만 받아 카운트 누적.

### 3.4 카톡 초대 (임시 안내)

- 챌린지 생성 시 `dohada://invite/<id>` 딥링크 자동 생성
- RN `Share` API 로 공유
- 카톡 인앱 브라우저 제한 회피용 안내 문구: "카톡에서 안 열리면 메시지를 길게 눌러 복사 → Safari 주소창에 붙여넣어 주세요"
- Universal Links 정석 셋업은 Phase 1.5
- 카카오 SDK 는 Phase 1.5

### 3.5 사진 인증 (v2.2 — 보관함 스크린샷 허용)

- **카메라 직접 촬영** + **보관함 스크린샷 선택** 양쪽 허용
- 보관함 선택 시 안내 문구:
  > "운동·걷기 앱 등의 기록 화면을 스샷으로 올릴 수 있어요. **시간 표시가 보이는 스샷**이면 좋아요."
- 이미지 저장소: **Cloudflare R2** (Edge Function 의 SigV4 presigned PUT)
- 인증 빈도에 따른 가드:
  - 매일: 하루 1회
  - 주 3회: 7일 내 3회까지
  - 주 1회: 7일 내 1회까지
- EXIF/GPS 검증 ❌ (Phase 1.5)
- 인증 사진 AI 검수 ❌ (Phase 1.5 — 챌린지 텍스트 검수만 적용, 3.8 K 참고)
- 같은 사진 재사용 방지 (hash 비교) ❌ (Phase 1.5)

### 3.6 챌린지 방 — 4종 + v4 5탭 구조

**방 타입 4종** (DB: `challenges.kind` enum):

| 이모지 | 종류 | slug | 도전자 | 응원자 | 둘러보기 | 핵심 페르소나 |
|:-:|---|---|---|---|:-:|---|
| 🤫 | 혼자만의 다짐 | `solo` | 본인 | 본인 | X | 조용히 나만의 기록 |
| 🙋 | **응원받기** ⭐ | `cheered` | **본인 1명** | **초대 지인 N명** | X | **워킹맘 + 가족 응원 / 100일 다이어트 선언** |
| 🤝 | 함께 도전하기 | `closed` | 멤버 다수 | 멤버 다수 | X | 토익 스터디 / 운동 메이트 |
| 🌍 | 누구나 합류 | `open` | 멤버 다수 | 멤버 다수 | O | 명사 / 공익 / 사회공헌 |

**응원받기 방의 특수 RLS** (0008):
- 인증 INSERT / 기록 INSERT → **creator 만**
- 채팅 / 응원 / 댓글 / 평가 → 모든 멤버 (응원자도 가능)
- 초대 흐름 = closed 와 동일 (만들기 직후 카톡 안내 모달)
- 응원자가 FAB 누르면 → 라벨 `💛 응원으로 함께해요` (accent700) → 채팅 탭으로

방 헤더 (모든 탭 공통):
- 챌린지명 + 메타 (방 종류별 라벨, 분류 용어 X 사람 단위 톤):
  - solo → "혼자만의 다짐"
  - cheered → "응원받는 도전 · 함께 N명"
  - closed → "함께 도전하는 N명"
  - open → "누구나 합류 가능 · 함께 N명"
- **room-info-bar**: 🔥 N/M일 + 📸 N명 인증 + **D-N 큰 숫자**
- 진행률 바 (full-width)
- 멤버 아바타 가로 배치 (5명 이상이면 +N)
- **room-today** (오늘 카드): "📅 오늘 [아바타들] X/Y ›" — 사이즈 적응형 (small/medium/large 자동)
- **💚 함께 만든 변화** 4 stats: `N일 함께 / N번 인증 / N번 응원 / N개 기록`

5탭:

| 탭 | 내용 |
|---|---|
| 💬 **대화** | Realtime 채팅 (말풍선). 본인 메시지는 오른쪽 오렌지. 멤버 전용. |
| 📸 **인증** (기본 활성) | 일별 인증 사진 카드 피드. 인증 응원 4가지 (🔥👏💪❤️) + 🎁 선물 (Phase 2 placeholder). 댓글 (instagram 식). |
| 🎥 **기록** | Vlog 카드. "📝 인상깊은 순간을 기록해요" 버튼. 카드: 닉네임 + N일째 + 시간 + 제목 + 본문 + 선택 이미지 + 좋아요/댓글/응원. 인증과 별개 영구 보존. |
| 📊 **현황** | 멤버별 카드 — 아바타 + 닉네임 + 연속 일수 + 인증률 % + 진행률 바. 본인 강조 + 오늘 미인증 시 경고. |
| 🏆 **박제** | 챌린지 종료 후 활성화. 진행 중엔 안내 카드 + 완주율 진행률 + 인증서 미리보기. **v2.5 변경**: "완주 이야기 공유" 버튼 (박제 → 해냈어요 작성). 4단계 상품 (디지털 인증서 PDF · 종이 인증서 · 포토북 · 굿즈) 잠금 상태로 노출 — **가격은 "추후 결정"** 표기 (베타에 가격 못박지 않음). 책 (3개월 모음) 단계는 베타 노출 보류. |

### 3.7 응원/평가 — 이중 시스템

#### A. 인증 응원 (챌린지방 인증 탭)
- 🔥 (불꽃) / 👏 (박수) / 💪 (근육) / ❤️ (하트) — 각 독립 카운트
- 🎁 선물 = Phase 2 placeholder (탭 시 "출시 예정" 안내)
- Realtime 반영 (Supabase Realtime)

#### B. 챌린지 평가 (둘러보기 카드)
- ✨ 기발 (creative) / 😱 대단 (hard) / 🥹 뭉클 (touching) / 💫 새로움 (fresh)
- 통합기획서 v3.1 4가지 평가. 각 독립 카운트, 본인 vote 표시.
- 한 사용자가 한 챌린지에 각 평가 최대 1표.

> ⚠️ 8가지가 한 화면에 같이 보이지 않는다. 인증 응원 = 방 안, 챌린지 평가 = 둘러보기 카드. 둘은 다른 단어 / 다른 의미.

### 3.7.5 큰 숫자 노출 금지 (`lib/format.ts`)

통합기획서 v3.5 "조용한 SNS" 정책. 인스타식 좋아요 비교의 도파민 메커니즘 차단.

`formatCheerCount(n)`:
- `n < 100` → 그대로 (작은 동료 단위 — 응원이 반영됐는지 확인 가능)
- `n >= 100` → **"99+"** ("이건 비교의 대상이 아니다" 시각 약속)

적용처: 인증 응원 카운트 (room/ProofCard), 챌린지 평가 카운트 (discover/DiscCard).

### 3.7.6 조용 알림 4원칙 (v2.1 추가)

SNS 의 기본인 실시간 알림을 제공하되, 도파민 루프는 차단.
학생 핸드폰 중독의 주 메커니즘 (즉시 알림 + 무한 도파민) 의 정면 반대.

| 원칙 | 구현 |
|:-:|---|
| **1. 묶음 + 지연** | 응원·좋아요는 1시간 단위로 묶음 → "지난 1시간 동료 N명이 응원했어요" 한 건 |
| **2. 즉시 채팅·댓글만** | 챌린지방 채팅 + 내 인증 댓글 + 내 기록 댓글 = 즉시. **단 무음 + 진동만**. |
| **3. 조용한 시간** | 22시~다음날 6시 (KST) 모든 알림 자동 보류 → 아침 6시 정각 묶음 발송. 옵션 X — default 강제. (2026-06-11: 8시→6시) |
| **4. 일별 상한** | 사용자당 24h 5건 (`DAILY_CAP=5`). 초과는 다음날 6시 reschedule. |

**스택** (2026-06-11 알림 정책 개편 반영):
- DB: `device_tokens` / `notification_prefs` / `notification_queue` + **7개 INSERT 트리거**
  (chat / comment / log_comment / cheers_batch / log_likes_batch — 0009 · **proof / log — 0026**)
- 알림함: `notification_queue` 본인 행 SELECT (0025) — **푸시와 헤더 벨이 동일 소스**. 푸시 탭 → 홈 + 알림함 자동 오픈 → 행 탭 시 해당 탭 딥링크
- 클라이언트: `lib/push.ts` (토큰 등록 + kind→탭 딥링크 매핑) + `_layout.tsx` (응답 핸들러 → 알림함) + `AppHeader.tsx` (알림함 모달)
- Edge Function: `flush-notifications` (매 1분 cron → 4원칙 처리 + EPN 발송)
- UI: 내정보 **5 토글** (`chat / comment / cheer_batch / proof_log(0027) / daily`) + 안내 "밤 10시~아침 6시 자동 조용 · 하루 최대 5건"

**APNs**: Expo Push Service (EPN) 사용 → Apple Push Certificate 직접 셋업 X.
미닝플로의 Apple Push Key (PL5DM4Z5JH) 그대로 재사용.

### 3.8 하다 구경 (익명 발상 라이브러리, v2.18 — 구 '둘러보기')

> v2.18 재설계: '둘러보기'는 진입점 0개로 사장돼 4평가까지 비노출이었음. **탐색이 아니라 '참조'** — "남들은 무슨 하다 하나" 살펴보고 → 평가하고 → 따라하기. 개설자·참여자 **신원 제거(익명)** → 비교/줄세우기 대상 자체가 없음(조용한 SNS 강화).

- **범위**: 전체 유형(solo/cheered/closed/open) 익명 노출. 개설자 opt-out(`browse_visible`) 시 제외, 안내문 이미지 별도 opt-out(`browse_image_visible`).
- 필터: 카테고리 칩(로드된 목록 기반). 정렬 = **최신순 고정** (참조수·평가수 desc 줄세우기 금지).
- 익명 카드:
  - 타입 배지 4색 뚜렷 구분 (🧍나홀로 · 🤝다함께 · 🌍누구나 · 💛응원받기)
  - 제목 + 내용 + 정형 "기간 · 인증방식" (목표 횟수형은 "목표 N개")
  - 안내문 이미지 (opt-out 시 숨김)
  - **4가지 평가 chips**: ✨기발 / 😱대단 / 🥹뭉클 / 💫새로움 (이모지 + 두 글자 라벨)
  - 🔁 참조수(99+ 캡) + **따라하기** (→ 생성 마법사 프리필, 생성 완료 시 원본 참조 +1)
  - 신원 미표시 · **카드 탭으로 방 이동 없음** (익명 보존)
- 진입점: 내하다 맨 아래 "🔭 하다 구경" 카드 + 홈 끝마커 직전 링크. (구 5탭 `discover` 라우트 재사용, UI 명칭 = '하다 구경')
- DB: `browse_challenges()` RPC (신원 컬럼 미반환) + `challenge_references`(1인1회) + `reference_count` — `supabase/migrations/0050_browse_anonymous_library.sql`
- **사회공헌 카드 전용**: 💚 "함께 만든 변화" 배너 (`예: "축구장 2.3개 분량 정화"`), 진행률 바 초록.

### 3.9 챌린지 종류 뱃지 시스템

| 뱃지 | 라벨 | 색 | 자동/수동 |
|---|---|---|---|
| (없음) | 일반 | — | MVP 모든 사용자 챌린지 default |
| 🌍 사회공헌 | 사회공헌 | 짙은 초록 | 카테고리 "사회공헌" 선택 시 자동 |
| ⭐ 명사 | 명사 | 금색 | Phase 2 (운영 큐레이션) |
| 🏢 브랜드 | 브랜드 | 파랑 | Phase 2 |
| 🌱 공익 | 공익 | 초록 | Phase 2 |
| ✨ 기발한 | 기발한 | 노랑 | 자동 (✨ 기발 평가가 다른 평가의 5배 이상일 때 — Phase 1.5 부터) |
| 🔥 인기 | 인기 | 빨강 | 자동 (가입자 폭증 — Phase 1.5 부터) |

MVP 단계:
- 일반 (라벨 X) + 사회공헌 (자동) 활성
- 명사/브랜드/공익 = 카드 헤더에 회색 placeholder ("Phase 2 도입 예정") 안 보임 (디자인은 v4 톤 유지)

---

## 4. 🎁 베타 완성도 항목

기존 v1 의 A~L 모두 유지 + v2 추가:

| 항목 | 내용 |
|---|---|
| A. 완주 화면 | 🏆 종료일 통과 + 모든 인증 완수 시 |
| B. 단독(solo) 방 | challenges.kind |
| C. 잠시 멈춤 | 3일/7일 멈춤, paused_until |
| D. 챌린지 진행률 | 방 헤더 + 카드 |
| E. Haptic | 주요 액션 진동 |
| F. Streak 카운터 | 🔥 N 연속 인증 |
| G. 매일 로컬 알림 | 저녁 8시 "오늘 인증했어?" |
| H. Skeleton 로딩 | |
| I. Pull-to-refresh | |
| J. 둘러보기 | 큐레이션 3가지 + 카테고리 |
| K. AI 콘텐츠 검수 | Claude Haiku 4.5, 챌린지 텍스트 |
| L. 인증 댓글 | Realtime |
| **M. 방 5탭 풀 구성** | 대화 / 인증 / 기록 / 현황 / 박제 안내 |
| **N. 이중 평가 시스템** | 인증 응원 4가지 + 챌린지 평가 4가지 |
| **O. 카테고리 10 + 소분류** | 사회공헌 자동 뱃지 |
| **P. 만들기 5단계 마법사** | 스텝 dot bar + 인기 추천 칩 |
| **Q. 내기 placeholder** | "Phase 2 출시 예정" 회색 안내 |
| **R. 동료 인증 cross-section** | 홈에 표시 (이미 적용) |
| **S. 🙋 응원받기 방 (v2.1)** | challenges.kind='cheered' + RLS (creator 만 인증·기록) + FAB 분기 |
| **T. 조용 알림 4원칙 (v2.1)** | EPN + Edge Function cron + 4 토글 + 묶음/조용시간/일별상한 |
| **U. 큰 숫자 노출 → '99+' (v2.1)** | `lib/format.ts` 정책 — 인증 응원·챌린지 평가 양쪽 적용 |
| **V. 정체성 카피 (A~J, v2.1)** | 온보딩·welcome·현황·둘러보기·매일알림·로그아웃 톤 정렬 |

추가 인프라:
- Pretendard 폰트 (3 weights)
- Sentry (DSN 채우면 활성)
- i18n 골격 (ko/en, Phase 2 본격)

---

## 5. ⏳ Phase 1 보류 항목 — 욕구는 살리되 방식은 Phase 1.5/2

v2.5 톤 — "안 만든다" 가 아니라 **"지금은 이렇게 살리고, 본 방식은 다음 단계에"**.
Claude Code 가 친절하게 제안하면 "보류 이유" 컬럼을 보여주고 사용자 확인 후 진행.

| 기능 | 통합기획서 위치 | 보류 이유 · 욕구는 어떻게 살리나 |
|---|---|---|
| 휴대폰 인증 | 4.4 | SNS 로그인이 약관 처리. Phase 1 에선 제외. |
| 사이즈 적응형 UI (5명/23명/8.9k명) | v3.3 | MVP small 고정. 사용자 모이면 Phase 1.5 부터. |
| 도전 인연 ×횟수 시스템 | v3.4 | Phase 2. 베타는 "현재 같은 챌린지 멤버만" 인연 정의 (v2.5 §3) — 이게 임시로 욕구를 살린다. |
| QR 명함 + 연락처 매칭 | v3.4 | Phase 2. 베타는 챌린지 참여 자체가 명함 역할. |
| 박제 자산화 — 결제 흐름 | 4.10 | Phase 2 토스페이먼츠 결합. v2.5 베타는 4단계 UI 노출 + 가격 "추후 결정" — 욕구는 미리 시각화. |
| 내기 시스템 (에스크로) | 4.14 | 결제/정산/환불 복잡 → Phase 2. 만들기 마법사에서 내기 단계는 제거 — 마지막 화면 한 줄 티저만. |
| GPS / 스크린샷 인증 강화 | 4.6.3 | Phase 2. 베타는 사용자 자발 신뢰 — 보관함 스샷도 허용 (v2.2). |
| AI 콘텐츠 검수 (인증 사진 vision) | 4.6.3 | Phase 1.5. 챌린지 텍스트 검수(K)는 적용 중. |
| 유배지 / 보석금 | 8장 | Phase 2. MVP 는 단순 잠시 멈춤(C). |
| **공식 미션** (명사·기업·정부·공익 통합) | 4.2·4.11 | Phase 2. 누구나합류에서 미션형(주최자형) 분리 — 아래 **§5.1 공식 미션** 참조. 베타는 일반 사용자 챌린지만, 공익은 사회공헌 카테고리로 일부 욕구 살림. |
| 카테고리 진화 모델 자동 승급 | 4.3.2 | Phase 1.5. MVP 는 자유 입력만 받음. |
| 뱃지/칭호 5등급 | 4.12 | Phase 2. 베타는 "해냈어요" 탭의 완주 이야기가 인정 욕구를 살림 (v2.5). |
| 선물 응원 (🎁) | 4.7.3 | Phase 2. 방 인증 탭에 placeholder. |
| 음성 메시지 | Phase 2 | 채팅 텍스트 + 인증 사진으로 충분. |
| 카카오톡 공유 SDK | 4.7 | Phase 1.5. MVP 는 RN Share + 안내 문구. |
| 카카오 로그인 | 4.3 | Phase 1.5. Apple 은 App Store 정책상 MVP. |
| 다국어/글로벌 (한국어 외) | 14장 | 한국어만. i18n 골격은 유지. |

### 5.1 공식 미션 (조직·명사 주최 미션형) — 결정 2026-06-13

기존 `누구나 합류`(open) 안에 성질이 다른 두 종류가 섞여 있다는 진단.
**동료형**(개설자도 같이 인증하는 수평 도전 = 지금의 누구나 합류 유지) vs **미션형**(조직·명사가 미션을 주고 본인은 인증 안 하는 수직 도전).
미션형을 **`공식 미션`** 이라는 별도 타입으로 분리하기로 결정.

- **포함 대상**: 명사(개인 명의) · 기업 · 정부/공공기관 · 사단법인 · 법무법인 등 법인. 조직은 내부 담당자가 운영.
- **이름 확정**: 동료형 = "누구나 합류" / 미션형 = **"공식 미션"**.
- **핵심 가치 = 조직 로그인이 아니라 "공식 인증 배지(✓)"**. 사용자가 신뢰하는 건 "진짜 그 조직/명사"라서지 로그인해서가 아님. 사칭 방지는 자동 검증이 아닌 **관리자 게이트**로 충분.
- **구조 차이**: 개설자=도전자 가정이 깨짐 — 주최자는 완주 대상이 아님(미션만 주고 본인은 인증 X). 단순 라벨이 아니라 데이터 모델이 다른 새 타입.
- **내기 없음**: 공식 미션은 `bet_tier` 안 붙음. 공공 캠페인 특성상 미성년 참여가 오히려 핵심일 수 있어 내기 비활성과 자연스럽게 맞물림. 후원은 별도 트랙(B2B 수익원 가능).

**단계 (현재 = 0단계):**
- **0단계 (현재)**: 개념·이름만 확정. 코드/DB 안 건드림. 첫 실제 파트너가 들어오면 **관리자 수동 온보딩**(관리자가 계정 생성 + "공식 주최자" 플래그 수동 ON)으로 미션형 1개 실제 운영. 명사 = 개인 계정 + 인증 플래그 / 법인 = 담당자 개인 계정 + "○○ 공식 주최자" 플래그.
- **1단계 (첫 파트너 생기면)**: `host_type`/`is_official` 컬럼 + 미션형 전용 화면(주최자 인증 안 함 / 완주자 명단·박제 / ✓ 배지). 진입 시 AS-IS→TO-BE 보고 후 진행.
- **2단계 (수요 확인 후)**: 셀프 온보딩 포털 + 사업자등록번호 검증 + 후원 결제(B2B 수익).

> 🔗 협찬(완주 보상·기부 매칭 등 공식 미션 위에 올라가는 핀테크)은 [`PHASE2_FINTECH_PLAN.md`](PHASE2_FINTECH_PLAN.md) §8(명사/누구나 협찬). **공식 미션 = 제품 구조 / 협찬 = 그 위 결제 레이어.**

---

## 6. 📅 진행 상황 (2026-06-01)

### Week 1~3 — UI + DB + Realtime + 베타 완성도 A~L ✅
- 5탭 기본 (홈/내챌린지/+/둘러보기/내정보) ✓
- Supabase + R2 + Edge Function + Google/Apple OAuth ✓
- 챌린지 생성 (RPC 우회) + 인증 + 댓글 + 응원 (❤ 1개) ✓
- 둘러보기 + 잠시 멈춤 + 진행률 + Streak + 로컬 알림 ✓
- 마이그레이션 0001~0006

### Week 4 — v2 재설계 적용 ✅
- 만들기 1화면 → **5단계 마법사** ✓ (v4 는 7단계 → 2026-06-11 압축)
- 카테고리 자유 텍스트 → **10 대분류 + 소분류** (`categories` / `subcategories`) ✓
- 응원 ❤ 1개 → **인증 응원 4가지 (🔥👏💪❤️) + 선물 placeholder** ✓
- 둘러보기 카드 → **챌린지 평가 4가지 (✨😱🥹💫) + 뱃지** ✓
- 챌린지방 1탭 → **5탭** (대화 / 인증 / 기록 / 현황 / 박제) ✓
- 대화 탭: Realtime 채팅 (`chat_messages`) ✓
- 기록 탭: Vlog (`logs` + `log_likes` / `log_comments`) ✓
- 현황 탭: 멤버별 인증률 + 가입 순 정렬 (비교 압박 회피) ✓
- 박제 탭: 진행 중 안내 + 완주 시 단순 트로피 ✓
- 챌린지 종류 뱃지 (일반 자동 + 사회공헌 자동) ✓
- 마이그레이션 0007

### Week 5 — 정체성 업그레이드 + v2.1 추가 제안 ✅
- 정체성 카피 A~J (온보딩·welcome·현황·둘러보기·매일알림·로그아웃) ✓
- 큰 숫자 노출 → '99+' 통일 (E·J) ✓
- 🙋 **응원받기 방 (cheered)** 신규 — 0008 + 5 파일 ✓
- 🔔 **조용 알림 4원칙** — 0009 + EPN + Edge Function flush-notifications + 4 토글 ✓
- 마이그레이션 0008, 0009
- Edge Function `flush-notifications` 배포 + cron 매 1분 ✓
- EAS 새 빌드 (`expo-notifications` plugin) ✓

### Week 6 — 베타 출시 직전 v2.2 ~ v2.4 ✅
- 보관함 스크린샷 인증 + 기록 사진 첨부 (마이그레이션 0010) ✓
- 도전 포기 soft delete + RLS UPDATE policy (마이그레이션 0011·0012) ✓
- 기록·댓글 수정/삭제 + RLS UPDATE policy (마이그레이션 0013) ✓
- 홈 v2.3 — 4분류 그룹 컨테이너 (solo → cheered → closed → open) ✓
- 통합 AppHeader (4 탭 공통) ✓
- 닉네임·아바타 편집 + Provider lock (Apple/Google) ✓
- 관심 분류 시스템 v2.4 (마이그레이션 0014) ✓
- TestFlight production 빌드 + ASC 외부 그룹 + 공개 링크 (jXrf3QpW) ✓
- '임팩트' → '사회공헌' 일괄 (마이그레이션 0015) ✓
- BLUEPRINT 기반 베타 모집 HTML + GitHub Pages 배포 ✓
- Apple Beta App Review 통과 ✓ (v0.1.0 build 2 승인됨, 88일 유효)
- 사이트 카피 정렬 + BrandMark 컴포넌트 ( ⊙ ) + Ionicons 탭바 ✓

### Week 7 — v2.5 SNS-first IA 재설계 ✅ (2026-06-04 ~ 06-11, 출시 완료)
**사상 전환**: "X 빼기" 일변도 → "욕구 살림" (망가진 방식만 버리고 인정·소속·연결 욕구는 살림).
**베타 모집 흐름**: v2.5 적용 → 개발자 테스트 → EAS 새 빌드 → Apple 재심사 (24h 예상) → 30명 모집.
> ✅ 아래 v2.5 항목은 전부 출시 완료(TestFlight·production). 이후 v2.6 → v2.14 증분은 **문서 상단 증분 메모** + [`CLAUDE.md`](../CLAUDE.md) 참조.

- [x] 정책 문서 갱신 (MVP_SCOPE v2.5 메모 추가) — 진행 중
- [ ] CLAUDE.md / BLUEPRINT.md v2.5 톤 갱신
- [ ] 마이그레이션 0016 — `completion_stories` (시스템 통계 자동 잠금 + 사진·소감·"가장 어려웠던 점" + 반응 + 공개 범위 + 용기 받은 N명 카운터)
- [ ] 하단 탭 5개 재구성: 홈(피드) / 내도전 / ⊕ / 기록 / 해냈어요 — profile 탭 제거, 우상단 아바타로 MY 일원화
- [ ] `home.tsx` 전면 재작성 — me-strip 1줄 + 피드 카드 5종 (🎉 완주리본 · 📸 오늘인증 · 🙋 응원받기 · 🌍 누구나합류 · ✨ 관심도전) + 🌙 끝 마커
- [ ] `my-challenges.tsx` → 내도전 리브랜드 (방 진행률 · 오늘 상태)
- [ ] `record.tsx` 신규 — 앱 전체 기록(Vlog) 피드
- [ ] `done.tsx` 신규 — 해냈어요 공개 탭 ("줄세우지 않고, 서로에게 용기를")
- [ ] `done/[id].tsx` 신규 — 완주 이야기 상세 + "나도 도전 시작하기" CTA (신규 유입 루프)
- [ ] `done/new.tsx` 신규 — 완주 이야기 작성 (시스템 통계 자동 잠금)
- [ ] `ArchiveTab.tsx` — "완주 이야기 공유" 버튼 + 4단계 상품 잠금 노출 (가격 "추후 결정")
- [ ] `StatusTab.tsx` — "오늘 5명 중 4명 함께함" 동행 카피
- [ ] me-strip 의 [인증하기] 빠른 액션 — 오늘 인증 안 한 챌린지 1개면 즉시, 여러개면 선택 모달
- [ ] 개발자 테스트 (미르 본인 폰 dev build)
- [ ] EAS production 빌드 + ASC Test Information "What to Test" v2.5 변경점 기재 + Beta App Review 제출
- [ ] Apple 재심사 통과
- [ ] 인터뷰 5질문 + 1추가 ("홈 화면이 챌린지 도구 같았나 SNS 같았나")
- [ ] 베타 30명 모집 시작

---

## 7. 🗄️ DB 스키마 (Phase 1 v2 확장)

기존 5개 (users, challenges, challenge_members, proofs, cheers) + comments + 신규.

### 변경/신규

```sql
-- challenges 추가 컬럼 (마이그레이션 0007 예정)
alter table challenges
  add column category_id    int references categories(id),
  add column subcategory    text,
  add column frequency      text check (frequency in ('daily','weekly3','weekly1')) default 'daily',
  add column proof_type     text check (proof_type in ('photo')) default 'photo';  -- gps/screenshot Phase 2

-- categories (10 대분류, seed)
create table categories (
  id          int primary key,
  slug        text unique not null,
  emoji       text not null,
  name        text not null,
  copy        text not null,           -- "건강을 가꾸는 사람들"
  is_impact   boolean not null default false
);

-- subcategories (대분류별 표준 소분류)
create table subcategories (
  id          int primary key,
  category_id int references categories(id),
  name        text not null
);

-- cheers 확장 (4가지 응원 종류)
alter table cheers
  add column cheer_type text not null default 'heart'
    check (cheer_type in ('fire','clap','muscle','heart'));
-- 기존 unique (proof_id, user_id) → unique (proof_id, user_id, cheer_type)

-- challenge_votes (둘러보기 4가지 평가)
create table challenge_votes (
  id           uuid primary key default gen_random_uuid(),
  challenge_id uuid references challenges(id) on delete cascade,
  user_id      uuid references users(id) on delete cascade,
  vote_type    text check (vote_type in ('creative','hard','touching','fresh')),
  created_at   timestamptz default now(),
  unique (challenge_id, user_id, vote_type)
);

-- chat_messages (대화 탭)
create table chat_messages (
  id           uuid primary key default gen_random_uuid(),
  challenge_id uuid references challenges(id) on delete cascade,
  user_id      uuid references users(id) on delete cascade,
  content      text not null check (char_length(content) between 1 and 1000),
  created_at   timestamptz default now()
);

-- logs (기록/Vlog 탭)
create table logs (
  id           uuid primary key default gen_random_uuid(),
  challenge_id uuid references challenges(id) on delete cascade,
  user_id      uuid references users(id) on delete cascade,
  title        text not null check (char_length(title) between 1 and 80),
  content      text not null check (char_length(content) between 1 and 4000),
  photo_url    text,                          -- nullable
  created_at   timestamptz default now()
);

-- log_likes, log_comments — 패턴은 cheers/comments 와 동일

-- ─── v2.1 (0008/0009) ───

-- 0008: 응원받기 방 타입 추가
alter table challenges drop constraint challenges_kind_check;
alter table challenges
  add constraint challenges_kind_check
  check (kind in ('closed','solo','open','cheered'));
-- + RLS: cheered 방의 proofs/logs INSERT 는 creator 만 (helper can_create_in_challenge)

-- 0009: 조용 알림 4원칙
create table device_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id),
  expo_token text,
  platform text check (platform in ('ios','android','web')),
  unique (user_id, expo_token)
);
create table notification_prefs (
  user_id uuid primary key references users(id),
  chat_enabled boolean default true,
  comment_enabled boolean default true,
  cheer_batch_enabled boolean default true,
  daily_enabled boolean default true
);
create table notification_queue (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id),
  kind text check (kind in ('chat','comment','log_comment','cheer_batch','log_like_batch')),
  challenge_id uuid, proof_id uuid, log_id uuid, actor_id uuid,
  preview text,
  scheduled_for timestamptz, sent_at timestamptz
);
-- + 5 INSERT 트리거 (chat/comment/cheer/log_comment/log_like → enqueue)
-- + Edge Function `flush-notifications` (매 1분 cron)

-- ─── v2.2~v2.4 (0010 ~ 0014) ───

-- 0010: proof_type 제약 확장 (photo + screenshot)
-- 0011: challenge_members.gave_up_at (도전 포기 soft delete)
-- 0012: challenge_members UPDATE policy (paused_until/gave_up_at 본인만)
-- 0013: logs / log_comments UPDATE policy (기록·댓글 수정)

-- 0014: 관심 분류 (v2.4)
create table user_interests (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid references users(id) on delete cascade,
  category_id     int  references categories(id) on delete cascade,
  subcategory_id  int  references subcategories(id) on delete cascade,   -- null = 대분류 전체
  created_at      timestamptz default now(),
  unique (user_id, category_id, subcategory_id)
);
-- + RLS: 본인만 select/insert/delete

-- 0015: '임팩트' → '사회공헌' 라벨 변경 (categories.name)

-- ─── v2.5 (0016) — 해냈어요 (완주 이야기) ───

create table completion_stories (
  id              uuid primary key default gen_random_uuid(),
  challenge_id    uuid references challenges(id) on delete cascade,
  user_id         uuid references users(id) on delete cascade,
  -- 시스템 통계 (자동 계산 — 사용자 입력 불가, 조작 방지)
  total_days      int not null,                  -- 챌린지 총 기간
  proof_count     int not null,                  -- 인증 횟수
  longest_streak  int not null,                  -- 최장 연속 일수
  completion_rate numeric not null,              -- 완주율 (0~100)
  -- 사용자 옵션 (작성 시 입력)
  story           text check (char_length(story) <= 4000),       -- 소감
  hardest         text check (char_length(hardest) <= 1000),     -- 가장 어려웠던 점
  photo_urls      text[],                                         -- 대표 사진 (옵션, 최대 N개)
  visibility      text check (visibility in ('public','allies')) default 'public',
  -- 메타
  created_at      timestamptz default now(),
  updated_at      timestamptz default now(),
  unique (challenge_id, user_id)
);
-- + RLS:
--   - SELECT: visibility='public' 누구나 / visibility='allies' 같은 챌린지 멤버만 / 본인은 항상
--   - INSERT/UPDATE/DELETE: 본인만, 챌린지가 완주 상태일 때만 (서버 함수 검증)
-- + 시스템 통계 INSERT 트리거: 완주 시점 challenges + proofs 집계로 자동 채움

-- 0016 의 사이드 효과:
-- - 박제(ArchiveTab) → "완주 이야기 공유" 진입점
-- - 해냈어요 탭 = SELECT completion_stories where visibility='public' order by created_at desc
-- - "용기 받은 N명" 카운터 → 0029 `completion_story_reactions` 로 구현 완료 (2026-06-11, 사용자당 1회·본인 글 거부)
```

테이블 17개 → **18개** 로 확장 (completion_stories 추가).
마이그레이션 0001~0016 + Edge Function 3개 (`moderate-challenge`, `r2-presign`, `flush-notifications`).
Phase 1.5 의 도전 인연 ×횟수 / 박제 결제 흐름 / 내기 추가 시 +5~7.

---

## 8. 🚫 Claude Code 작업 시 규칙

1. **이 문서에 없는 기능은 만들지 않는다.**
   거절 멘트: "MVP_SCOPE v2 에 없어요. Phase 1.5 / 2 에서 봅시다."

2. **통합기획서 v4.0.1 은 정체성·정책·디자인 톤 참고.**
   기능 목록은 이 문서 우선.

3. **`prototype/do-hada-app-v4.html` 은 UI/UX 의 절대 기준.**
   화면 디자인 결정 시 반드시 해당 화면의 HTML/CSS 를 먼저 본다.

4. **30명 베타 결과 보기 전엔 Phase 2 일절 안 만든다.**

---

## 9. 🎯 핵심

> **"차세대 SNS — 매슬로우 5단계 자아실현. 8대 영역 풀 구현 + 응원받기 방 + 조용 알림. 베타 30명에게 보여준다."**

남은 일:
1. 미르 며칠 실기기 풀 검증 (응원받기 방 + 알림 4원칙 + 5탭 + 만들기 5단계 + 정체성 카피)
2. [`beta-landing-plan.md`](beta-landing-plan.md) 기반 베타 모집 HTML 작성
3. production 빌드 + TestFlight + 베타 30명 모집
4. 베타 인터뷰 결과로 Phase 1.5 / 2 기능 우선순위 결정 (박제 자산화 5단계, 내기, 도전 인연, 명사·브랜드·공익 챌린지, 글로벌)

### 약속

> **30명 중 10명이 "친구에게 추천하고 싶다" 라고 답하지 않으면 우리는 멈춥니다.**
> 그게 안 되면 인스타와 같은 카테고리가 되는 거고, 만들 가치가 없어요.
> ([`beta-landing-plan.md`](beta-landing-plan.md) §7)
