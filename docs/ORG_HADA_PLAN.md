# 조직 하다(host_tier='org') 운영 가능화 — 검토 + 실행 계획

작성 2026-07-17. **이 문서는 org 트랙의 단일 진실원천**이다.
상위 비전 = [`WORLDWIDE_EXECUTION_PLAN.md`](WORLDWIDE_EXECUTION_PLAN.md) W3(무대)·W4(스폰서십) · 결제 = [`PHASE2_FINTECH_PLAN.md`](PHASE2_FINTECH_PLAN.md) · 온보딩 정책 = [`MVP_SCOPE.md`](MVP_SCOPE.md) §5.1.

---

## 0. 한 줄 진단

> **`host_tier='org'` 는 배지 렌더링 2곳 + admin 칩 하나가 전부다.** 0058이 "토대"로 열어둔 컬럼 그대로이며, 이후 0064·0065·0066·0067의 투자는 전부 **figure(개인 명사) 축**으로 갔다. 지금 조직에 org 를 부여하면 **개인 하다에 🏛️ 스티커만 붙은 상태**로 굴러간다.

---

## 1. 결정 사항 (2026-07-17)

| # | 쟁점 | 결정 | 근거 |
|---|---|---|---|
| ① | users 권한상승 구멍 | **즉시 별건 처리** (0068) | 이미 배포돼 노출 중. 조직 인증 배지의 신뢰가 여기 걸림 |
| ② | 조직 계정 모델 | **조직 전용 계정 신규 개설** | `creator_id` 이전이 코드상 불가 → 계정 자체가 조직 소유여야 담당자 교체 시 인계 성립 |
| ③ | 후원 범위 | **완주 매칭 기부 = 구현 / 상품 후원 = 설계 문서까지** | 매칭 기부는 앱에 돈이 안 흐름(규제 무관). 상품은 경품류 규제 별도 자문 게이트 |
| ④ | 셀프서비스 신청 | **계속 금지** (0058:7 승계) | 큐레이션 품질 = 사칭 방어선. 문의(mailto) → 운영자 수동 온보딩 유지 |

②가 [`MVP_SCOPE.md:415`](MVP_SCOPE.md) 의 기존 결정("법인 = 담당자 개인 계정 + 플래그")을 **뒤집는다** — 해당 절은 이 문서 기준으로 갱신 필요.

---

## 2. AS-IS — 코드 실태

### 2.1 org 가 individual 과 실제로 다른 점 = 배지 이모지·색뿐

| 위치 | 분기 | figure 대비 |
|---|---|---|
| [`HostBadge.tsx:17-19`](../mobile/components/HostBadge.tsx) | org: 🏛️/'공식'/sage, figure: ⭐/'명사'/accent | **유일한 실질 차이** |
| [`HostMark.tsx:34`](../mobile/components/HostMark.tsx) | `h === 'figure' \|\| h === 'org'` → `colors.gold` | **완전 동일** (링 구분 불가) |
| [`0059_admin.sql:167`](../supabase/migrations/0059_admin.sql) | `p_tier not in ('individual','figure','org')` | 화이트리스트뿐 |
| [`0067_promotion_review.sql:97`](../supabase/migrations/0067_promotion_review.sql) | org 이면 figure 로 안 덮음 | 소극적 보호 |

**org 분기가 존재하지 않는 곳**: 모집 캡 면제 · 알림 · 노출/정렬 · 내기 게이팅 · 완주/멤버 집계 · 무대(0065).

### 2.2 두 개의 host_tier — 축이 다르다

- **`challenges.host_tier`** ([0058:9-15](../supabase/migrations/0058_host_tier.sql)) → `HostBadge`(방 배지). 세팅 = `admin_set_host_tier(challenge_id,…)` ([0059:163](../supabase/migrations/0059_admin.sql)). **하다 단위.**
- **`users.host_tier`** ([0064:132](../supabase/migrations/0064_host_promotion.sql)) → `HostMark`(사람 마크·금빛 링). 세팅 = `admin_review_promotion` ([0067:98](../supabase/migrations/0067_promotion_review.sql)) — **`'figure'` 하드코딩. `'org'` 를 users 에 넣는 코드는 저장소 전체에 없음.**

→ 조직 계정에 🏛️ 마크/금빛 링을 주려면 **SQL Editor 수동 UPDATE 밖에 없다.**

### 2.3 치명적 모델 불일치 — 개설자 = 도전자 가정

[`WORLDWIDE_EXECUTION_PLAN.md:177`](WORLDWIDE_EXECUTION_PLAN.md):
> org = 주최자는 완주 대상 아님(**개설자=도전자 가정이 깨짐**) → org 하다는 host 계정을 완주·멤버·박제 집계에서 제외하는 처리 필요

그런데 `create_challenge` 는 개설자를 무조건 `challenge_members` 에 넣는다 ([0041:92-93](../supabase/migrations/0041_goal_count_type.sql), [0001:172](../supabase/migrations/0001_init.sql)).
→ **환경부 계정이 매일 인증을 안 하면 완주 실패로 집계된다.** 현황 탭 분모, 인포바 `📸 N/N`, 박제, 내하다 배지 전부 오염.

### 2.4 소유권 이전 불가 (설계된 차단)

[`0022:49-53`](../supabase/migrations/0022_fix_p0_security_gaps.sql):
```sql
create policy challenges_creator_update on public.challenges
  for update using (creator_id = auth.uid()) with check (creator_id = auth.uid());
  -- with check 가 신규 row 의 creator_id 도 강제 → 소유권 이전 방지
```
이전 RPC 0건. **하다는 개설 계정에 영구 귀속** → 계정 모델을 처음부터 확정해야 한다(결정 ②의 근거).

### 2.5 배지가 거의 안 보인다

`HostBadge` 사용처 = [`StatusTab.tsx:116`](../mobile/components/challenge/StatusTab.tsx)(방 현황 탭) + [`home.tsx:955`](../mobile/app/(tabs)/home.tsx)(홈 JoinCard, **open 카드 전용**) **2곳뿐**.
→ 조직 하다가 `closed`/`cheered` 면 **어떤 목록·피드에도 🏛️ 가 안 뜨고**, 방에 들어가 현황 탭을 열어야만 보인다. 박제·공명 피드·내하다·하다 구경 전부 미노출.

### 2.6 운영 갭

| 갭 | 근거 |
|---|---|
| 조직 검증 수단 0 | `verified_hosts` 테이블도 `users.host_verified` 도 없음. `host_label` 은 **검증 없는 자유 텍스트** UPDATE ([0059:163-169](../supabase/migrations/0059_admin.sql)), 감사 로그 없음 |
| 다중 운영자 0 | 권한 전부 단일 `creator_id`. 운영 알림도 `v_creator` 1인에게만 ([0064:64-71](../supabase/migrations/0064_host_promotion.sql)) |
| 조직 프로필 0 | `host_label` 은 엔티티가 아니라 챌린지 행의 문자열 → 같은 조직 하다 2개를 묶을 방법 없음 |
| 지정 사실 미통지 | `admin_set_host_tier` 는 UPDATE 만, `notification_queue` 에 아무것도 안 넣음 |
| 콘솔에서 못 찾음 | `admin_list_growing_challenges()` 가 `where c.kind='open'` ([0065:42](../supabase/migrations/0065_admin_growing.sql)) → 조직의 closed 하다는 제목 검색으로만 도달 |
| closed 캡 면제 불가 | `admin_set_recruit_exempt` 가 `kind<>'open'` 이면 거부 ([0064:209](../supabase/migrations/0064_host_promotion.sql)) |

---

## 3. TO-BE — "운영 가능"의 정의

조직 파트너가 다음을 **운영자 수동 온보딩만으로** 할 수 있으면 완료로 본다.

1. 조직 전용 계정으로 하다를 연다.
2. 그 계정은 **도전자가 아니다** — 완주·멤버·인증 분모 어디에도 안 들어간다.
3. 운영자가 콘솔에서 org 배지 + 조직 마크를 부여하고, **부여 사실이 주최자에게 알림으로 간다.**
4. 배지가 **참여 결정 지점**(목록·초대·구경)에서 보인다.
5. org 하다에는 **내기가 구조적으로 안 걸린다.**
6. 조직이 "완주자 1명당 N원 기부" 를 약정하면 앱이 **약정과 완주 수를 표시**한다 (송금은 조직이 직접).

---

## 4. 실행 단계

### Step 0 — 🔒 users 권한상승 차단 (별건, 진행 중)
`supabase/migrations/0068_users_column_guard.sql`. 컬럼 단위 GRANT(주 방어선) + RLS `with check`(보조). 이 문서 범위 밖이나 **org 배지 신뢰의 전제**라 여기 기록.

### Step 1 — org 데이터 모델 정합 【핵심 blocker】

**1-a. 주최자를 도전자 집계에서 제외** — TO-BE 2 — ✅ **구현 완료 (0069, 운영 미적용)**

> **확정 설계 (2026-07-17 사용자 승인)**: `challenge_members.role`(`'member'|'host'`) 역할 컬럼. `admin_set_host_tier(tier='org')` 가 creator 행을 `role='host'` 로, `individual`/`figure` 로 되돌리면 `'member'` 원복.
> - 대안(집계 시점 분기: 매 호출부가 `challenge.host_tier` + `creator_id` 를 조합)은 호출부가 6곳 이상으로 흩어져 기각.
> - `gave_up_at` 재활용은 "포기" 시맨틱이 붙어 부적절.
> - 선례: cheered 방의 `isCheerer`(v2.17) — 같은 방 안에서 역할이 갈리는 구조는 이미 있다.
> - 주최자 행은 **남긴다** — 대화·공지·초대에 `is_member_of` RLS 가 필요.

> 🔒 **0069에 포함된 추가 방어 (구현 중 발견)**: `members_self_update`([0012:7-10](../supabase/migrations/0012_challenge_members_update_policy.sql))가 `with check (user_id = auth.uid())` 로 **행**만 제한하고 컬럼은 안 막아, 사용자가 자기 멤버십 행에 `role='host'` 를 직접 심어 ①분모에서 사라지고 ②완주 실패 판정을 회피하고 ③현황 탭에 '🏛️ 주최' 사칭 태그를 달 수 있었다. **0068과 같은 부류** → `challenge_members` 도 컬럼 단위 GRANT 로 좁힘(`update(paused_until, gave_up_at)` · `insert(challenge_id, user_id)`).
> **교훈**: RLS 는 "어느 *행*을 쓰냐"만 고른다. 집계·권한에 쓰이는 컬럼을 새로 추가할 때는 **반드시 컬럼 GRANT 를 같이 좁힌다.**

> ⚠️ **배포 순서 — migration 먼저 (하드 실패)**: 클라가 `challenge_members.select('challenge_id, role')` 을 하므로, 0069 미적용 상태로 OTA 하면 `fetchMyChallenges`/`fetchMyChallengesWithDetails` 가 **throw → 내하다 탭·홈이 통째로 깨진다.** 평소의 "미적용 시 폴백(무해)" 이 아니다.

`role='host'` 제외를 반영할 곳:
- [`stats.ts`](../mobile/lib/stats.ts) — `goalStatus`/`isCompleted`/`isFailed` 대상에서 host 제외
- [`StatusTab.tsx`](../mobile/components/challenge/StatusTab.tsx) — 인증률 분모, 멤버 목록(주최자는 별도 표시)
- [`room/[id].tsx`](../mobile/app/room/[id].tsx) — 인포바 `📸 N/N`, `memberCount`
- [`db.ts`](../mobile/lib/db.ts) — `fetchRoomData` 의 `memberCount`/`todayCheckedCount`
- [`ArchiveTab.tsx`](../mobile/components/challenge/ArchiveTab.tsx) · [`my-challenges.tsx`](../mobile/app/(tabs)/my-challenges.tsx) 배지
- 주최자 본인 화면: FAB 인증 버튼 숨김(주최자는 인증 주체가 아님)

**1-b. org 내기 강제 차단** — TO-BE 5
[`WORLDWIDE_EXECUTION_PLAN.md:170`](WORLDWIDE_EXECUTION_PLAN.md): *"**절대 금지**(기관의 도박성 유도 = 규제·평판 리스크) → org 는 `bet_tier` 강제 null"*
- DB: `admin_set_host_tier(tier='org')` 시 `challenges.bet_tier = null` 강제 + `create-gift-order` 서버 게이트에 org 거부 추가 (**클라 게이트만으론 부족** — EF 직호출 가능)
- 클라: [`create.tsx:213`](../mobile/app/create.tsx) 는 kind 로만 분기 중

**1-c. `users.host_tier='org'` 부여 수단**
현재 `admin_review_promotion` 은 `'figure'` 하드코딩([0067:98](../supabase/migrations/0067_promotion_review.sql)). admin RPC 신설 또는 확장 — **🔒 첫 줄 `is_admin()` 검사 필수**(0059:6-10 불변식).

**1-d. host_label 무결성**
자유 텍스트 UPDATE + 감사 로그 0. 최소: 길이/공백 검증 + 변경 이력 테이블 또는 `host_since` 류 타임스탬프.

### Step 2 — 배지 노출 확대 (TO-BE 4)
`HostBadge` 를 **참여 결정 지점**에 추가: 초대 미리보기([`invite/[id].tsx`](../mobile/app/invite/[id].tsx)) · 하다 구경([`discover.tsx`](../mobile/app/(tabs)/discover.tsx) — ⚠️ **익명 라이브러리라 신원 노출 충돌 검토 필요**) · 내하다.
⚠️ `HostMark` 가 figure/org 를 같은 금빛으로 칠함([`HostMark.tsx:34`](../mobile/components/HostMark.tsx)) — 구분 필요 여부 결정.

### Step 3 — 운영 동선 (TO-BE 3)
- `admin_set_host_tier` → `notification_queue` 에 지정 알림 (kind 화이트리스트 [0064:191-196](../supabase/migrations/0064_host_promotion.sql) 에 추가 — ⚠️ **kind 제약은 전체 목록이라 빠뜨리면 23514**)
- admin 콘솔에서 org 하다 조회 (현재 `kind='open'` 한정)
- closed 방 캡 면제 허용 여부 결정 ([0064:209](../supabase/migrations/0064_host_promotion.sql))

### Step 4 — 후원

**4-a. 완주 매칭 기부 【구현】** — [`WORLDWIDE_EXECUTION_PLAN.md:192`](WORLDWIDE_EXECUTION_PLAN.md):
> **MVP = 첫 조직 파트너 생기면 "완주 매칭 기부" 1형만 수동 운영**(조직이 완주 수 보고 직접 기부, 앱은 집계 노출만)

- **앱은 `gift_orders` 를 안 탄다.** 참여자↔돈 이전 0 → 결제·도박·전자금융·경품 규제 전부 무관, mock 상태와 무충돌.
- 필요한 것: 약정 문구 + 완주 수 표시(집계는 기존 완주 판정 재사용). 송금은 조직이 오프라인 직접.
- ⚠️ 표시광고법: 약정은 **조직의 약속**이지 앱의 보증이 아님을 카피에 명시.

**4-b. 상품 후원(완주자 기프티콘) 【설계 문서까지, 구현 금지】**
게이트 3중:
1. **경품류 제공 규제 자문** — [`PHASE2_FINTECH_PLAN.md:310`](PHASE2_FINTECH_PLAN.md) 이 *"별도 자문 필요"* 명시. **⑤b 4개 안건(ⓐ~ⓓ)에 미포함 = 추가 게이트**
2. **⑤b 미체크** — 실돈 전환 자체가 안 됨. PG·기프티콘·본인인증 전부 mock(네트워크 호출 0건, [`providers.ts`](../supabase/functions/_shared/payments/providers.ts))
3. **순서** — [`PHASE2_FINTECH_PLAN.md:300-309`](PHASE2_FINTECH_PLAN.md) §8: *"응원 한잔·나와의 내기 베타 오픈(⑤b) **후** 본격 설계"*

설계 문서에 담을 것(구조적 미비):
- `order_type` CHECK 가 `('cheer','bet')` 2종 고정 ([0032:69](../supabase/migrations/0032_identity_gift_orders.sql)) → sponsor 유형 신설
- `orderPolicy.ts:33-36` 이 sender·recipient 둘 다 **활성 멤버** 요구 → 방 외부 스폰서 차단됨
- 조건부(완주 시) 지급 로직은 자기 주문(bet)에만
- 1:N 배분·재고·추첨 개념 전무. `recipient_id` 는 단일 컬럼
- 기부처 실체 없음 — 4.3절 3안(a/b/c) 미택일, 공제율 미정 ([`PHASE2_FINTECH_PLAN.md:296`](PHASE2_FINTECH_PLAN.md))

---

## 5. 운영 런북 — 조직 온보딩 (코드 아님)

결정 ②에 따른 절차. **셀프서비스 없음** (0058:7).

1. 조직이 [`support.ts`](../mobile/lib/support.ts) `SUPPORT_EMAIL` 로 문의 ([`create.tsx:1008-1014`](../mobile/app/create.tsx) 안내 카드 → mailto)
2. 운영자가 조직 실재 확인 (사업자등록증 등 — **검증 절차 문서화 필요, 현재 없음**)
3. **조직 전용 구글 계정** 생성 → 조직이 자격증명 보유 (담당자 교체 = 계정 인계)
4. 그 계정으로 하다 개설 (⚠️ `creator_id` 이전 불가 → **이 단계에서 계정 확정**)
5. 운영자 콘솔에서 `host_tier='org'` + `host_label` 부여 → 주최자에게 알림(Step 3)
6. 매칭 기부 약정이 있으면 안내문에 명시 (Step 4-a)

⚠️ **잔여 리스크**: 닉네임·아바타에 사칭 방어가 전무하다([`db.ts:1457-1466`](../mobile/lib/db.ts) — trim + 20자뿐). 아무나 "환경부" 로 개명 가능. 방어선은 **오직 배지**이므로, 사용자에게 "배지 없는 조직명은 신뢰하지 말라" 는 신호가 필요할 수 있다.

---

## 6. 검증

- Step 1 = **인증/권한 + 박제 집계** 인접 → [`CLAUDE.md`](../CLAUDE.md) 자동 테스트 의무 영역. `stats.ts` 순수 로직 변경은 `__tests__/` 에 테스트 동반.
- Step 1-b(내기 차단) = **결제 로직** → `__tests__/` 필수.
- Step 4-a = 표시 로직 → 수동(실기기).
- 공통: `npx tsc --noEmit` 0 + `npm test` 전건 통과.
- 엣지: 주최자 1명 + 참여자 0명 / 주최자가 실수로 인증 시도 / org 지정을 individual 로 되돌릴 때 `role='host'` 원복.

---

## 7. 열린 질문 — 2026-07-17 정리

| # | 질문 | 결론 |
|---|---|---|
| 1 | Step 1-a 역할 컬럼 vs 집계 시점 분기 | ✅ **역할 컬럼** (0069 구현 완료) |
| 2 | org 를 하다 구경(익명)에 노출하나 | ✅ **노출 안 함.** 하다 구경은 **카드 탭→방 이동이 없어**(익명 보존, 0050) 애초에 참여 결정 지점이 아니다(따라하기 전용) → 신뢰 표식이 불필요하므로 익명 정체성을 깰 이유가 없다 |
| 3 | figure/org 링 색 구분 | ✅ **구분 안 함.** 금빛 링 = "무대에 선 사람" 공통 표식, ⭐/🏛️ 구분은 배지가 담당. 색 토큰만 늘리는 일 |
| 4 | closed org 하다에 캡 면제를 주나 | ✅ **org 는 캡 면제** (Step 3). 0043 의 "기간 50% 자동 마감" 은 *"서로를 목격하는 동료"* 를 지키려는 장치인데 **조직 하다는 애초에 광장**이라 전제가 다르다. `host_tier='org'` → `is_recruiting` 항상 true + `admin_set_recruit_exempt` 의 `kind='open'` 제한도 해제 |
| 5 | 조직 검증 절차 | **미해결** — 사업자등록증 확인을 수동 체크리스트로만 둘지, `host_label` 변경 이력을 남길지 (Step 1-d) |

**Step 4-a 매칭 기부 = 구조화 채택** (2026-07-17): `challenges` 에 1인당 금액 + 기부처 컬럼 → 앱이 *"지금까지 12명 완주 · 환경부가 120,000원을 ○○에 기부하기로 했어요"* 표시. 완주 수는 기존 판정 재사용. ⚠️ **약속의 주체가 조직임을 카피에 명시** — 앱의 보증이 아니다(표시광고법). 송금은 여전히 조직이 오프라인 직접(`gift_orders` 미사용). — ✅ **구현 완료 (0075)**: `sponsor_amount_per_completer`·`sponsor_beneficiary` + `admin_set_sponsor_matching` RPC(org 전용·grant 없음) · `countCompleters`(host·포기 제외, goalStatus 위임) · 노출 = 방 현황 탭 + 초대 미리보기 · 카피 주어 "「host_label」에서" + "하다가 대신 전달하지 않아요" 각주.

---

## 8. 완료 현황 (2026-07-17)

TO-BE 6항 중 6항 구현 완료 (전부 운영 적용 + OTA):

| TO-BE | 구현 | 마이그레이션 |
|---|---|---|
| ① 조직 전용 계정 개설 | 코드 불필요 (런북 §5) | — |
| ② 주최자 도전자 집계 제외 | `challenge_members.role` | 0069 |
| ③ 배지 부여 + 지정 알림 | `host_assigned` kind | 0074 |
| ④ 참여 지점 배지 노출 | 초대·내하다·합류 시트 | 0073 |
| ⑤ org 내기 차단 | bet_tier null + orderPolicy | 0072 |
| ⑥ 매칭 기부 표시 | sponsor 컬럼 2 + RPC | 0075 |

**부수 보안 (RLS 컬럼 갭)**: 0068(users)·0070(challenges)·0071(UGC 6테이블) + hidden 클라 전송 제거. [메모리 `reference_rls-column-grant-gap`].

**남은 것**:
- **Step 1-d** 조직 검증 절차 (사업자등록증 확인·`host_label` 변경 이력) — 운영 정책, 코드 아님.
- **기존 갭** 클라 `isRecruiting` 이 `recruit_cap_exempt` 미러 안 함 → 캡 면제받은 open 하다가 50% 후 "모집 마감" 오표시. 0064부터 존재. **첫 명사 하다 온보딩 시 표면화** → 그 전에 처리.
- **Step 4-b** 상품 후원(완주자 기프티콘) — 경품류 규제 자문(⑤b 밖) + ⑤b 실돈 게이트 후. 설계만.

---

## 9. 조직 증명 + 계정 분리 — 전체 프로세스 (2026-10-28 계획)

§7 열린 질문 5(조직 검증 절차)를 닫고, 유일한 조직 무대를 개인 계정에서 법인 계정으로 옮긴다.

### 9.1 모델 — 조직 = 계정, 실무자 = 그 계정을 맡은 사람

> ⚠️ **2026-10-28 폐기** — "조직 = Google/Apple 도메인 계정" 모델은 §10 (조직 메일 OTP 로그인 + 조직 전용 영역)으로 대체됐다. §9.2·9.4·9.5 는 유효.

조직 하다에는 **두 주체**가 있다: 법적 주체인 **조직**(기업·재단·기관)과, 실제로 앱을 만지는 **실무자**.

- **앱 안에서 계정 = 조직이다.** 실무자는 조직이 발급한 계정(조직 도메인 메일 등)으로 로그인한다. 실무자의 개인 계정은 조직 하다와 무관하다(원하면 참여자로만 합류).
- 이유: `creator_id` 이전 불가(0022) → 하다는 개설 계정에 영구 귀속. 실무자가 바뀌어도 **계정 자격증명을 넘기면** 인계가 성립한다(결정 ② 승계).
- **다중 실무자(한 조직에 운영자 여러 명)는 만들지 않는다.** 권한·RLS 가 전부 단일 `creator_id` 기준이라 큰 공사다. 실무자 여럿이 필요하면 지금은 한 계정을 공유하고, 수요가 확인되면 `org_operators` 류로 확장한다(scale-gated).

### 9.2 증명 — 세 가지를 따로 확인한다

| 확인 대상 | 질문 | 증빙 |
|---|---|---|
| **① 조직 실재** | 그 조직이 진짜 있고 살아 있나 | 기업: 사업자등록증 + 국세청 사업자 상태조회(휴·폐업 아님) · 법인은 법인등기부등본 선택 / 비영리(재단·사단·NPO): 고유번호증 또는 법인등기 / 정부·공공기관: 기관 직인 공문 |
| **② 실무자 권한** | 이 사람이 조직을 대표해 하다를 열어도 되나 | 조직 공문(담당자 지정) 또는 재직증명서. 대표자 본인이면 생략 |
| **③ 계정 소유** | 이 계정이 개인 것이 아니라 조직 것인가 | 로그인 이메일이 **조직 공식 도메인**(예: `@doinno.co.kr`, `@*.go.kr`). 도메인 메일이 없는 소규모 조직은 조직 명의로 새로 만든 계정 + 공문에 그 이메일 명시 |

- **원본 서류는 앱에 저장하지 않는다**(개인정보 최소화 — 사업자등록증·재직증명서엔 PII 가 섞인다). 운영 메일함에 보관하고, 앱에는 **"누가·언제·무엇을 확인했다"는 기록만** 남긴다.
- 국세청 상태조회는 당분간 운영자가 홈택스에서 수동 조회. 공공데이터포털 진위확인 API 자동화는 셀프서비스(2단계, MVP_SCOPE §5.1)와 함께.

### 9.3 온보딩 → 운영 → 해지 흐름 (§5 런북 대체)

1. **문의** — 조직이 `SUPPORT_EMAIL` 로 연락 (셀프서비스 없음, 0058:7 승계)
2. **서류 확인** — 운영자가 9.2 ①②③ 체크
3. **조직 계정 준비** — 조직 도메인 계정으로 앱에 한 번 로그인 → **닉네임을 조직명으로 먼저 설정**
   ⚠️ 순서 중요: 승격 시 `host_label` 은 그 순간의 닉네임을 복사한다(0080·0081). 닉네임을 나중에 바꾸면 기존 하다 배지는 옛 이름 그대로 남는다.
4. **검증 기록 + 조직 지정** — 운영자 콘솔에서 검증 기록 등록 → 「사람 계층 지정」으로 `org` (SQL 직접 update 금지 — 소급·알림이 빠진 반쪽 승격)
5. **하다 개설** — 그 계정으로 누구나(open) 하다를 열면 자동으로 공식 무대 + 주최자(`role='host'`)는 집계 제외 (0080·0069)
6. **매칭 기부 약정**(선택) — `admin_set_sponsor_matching` (0075)
7. **실무자 교체** — 조직이 계정 비밀번호·2단계 인증을 새 담당자에게 넘기고, 운영자는 검증 기록의 담당자 정보만 갱신
8. **해지** — 「사람 계층 지정」에서 `individual` 로 강등 + 검증 기록 `revoked`. 진행 중 하다는 `admin_set_host_tier` 로 하나씩 처리(0081 강등 주석 — 일괄 해제 금지)

### 9.4 코드 변경 (제안 — 최소)

| # | 무엇 | 왜 |
|---|---|---|
| a | **`0085_org_verifications.sql`** — `org_verifications` 테이블(조직 계정 user_id · 조직 유형 company/nonprofit/public · 법적 명칭 · 등록번호 · 공식 도메인 · 확인한 증빙 목록 · 담당자 이름/직책/연락처 · 확인한 운영자 · 확인 시각 · 해지 시각 · 메모). **authenticated 에 grant 없음**, admin RPC 로만 읽고 씀 | 지금은 "왜 이 계정이 공식인가"에 대한 기록이 0. 사칭 방어선이 배지뿐인데 그 배지의 근거가 남지 않는다 |
| b | `admin_record_org_verification` / `admin_revoke_org_verification` RPC — **🔒 첫 줄 `is_admin()`** | 0059 불변식 |
| c | `admin_set_user_host_tier(…, 'org')` 에 **유효한 검증 기록이 없으면 거부** 가드 추가 (0081 본문 승계 + 가드 한 덩어리) | "검증 없이 org" 경로를 구조적으로 닫는다. figure·individual 은 무관 |
| d | 운영자 콘솔 [`UserTierAssign.tsx`](../mobile/components/admin/UserTierAssign.tsx) — 조직 선택 시 검증 기록 입력 폼 | 운영자가 SQL 없이 4단계 수행 |
| e | `SUPPORT_EMAIL` + 법적 문서(privacy·terms·delete-account·guide·index) 문의처 교체 | "법인 후 교체" 주석 이행. 개인정보처리방침은 개정일 갱신 |

- 담당자 연락처 = PII → admin 게이트 뒤에서만(0081 `admin_search_users` 와 같은 보호 수준).
- 검증은 SQL 검증 쿼리를 migration 하단 주석으로(0083 패턴). 순수 TS 로직 변경 없음.
- **이번에 안 만드는 것**: 다중 실무자 · 진위확인 API · 셀프 신청 · 조직 계정의 셀프 탈퇴 차단(아래 9.6).

### 9.5 DO하다 자체 분리 — 첫 적용 사례

현황 (운영 DB, 2026-10-28):
- 「매일 8천보 걷기」 open · 2026-09-12 ~ **2027-09-11** · 공식 무대(`DO하다 운영팀`) · 모집 캡 면제
- 개설자 = `mirr0505@gmail.com`(개인 · is_admin) — `role='host'`, 인증 0건
- 참여자 2명 · 인증 84건 (마지막 2026-10-27)
- 법인 계정 `kidoo.kim@doinno.co.kr` — 아직 앱 로그인 이력 없음. doinno.co.kr = Google Workspace(MX smtp.google.com) → Google 로그인 가능

기존 무대 처리 선택지:

| 안 | 내용 | 기존 2명 | 문제 |
|---|---|---|---|
| **A. 1기로 마무리 (추천)** | 기존 방 제목을 「…· 1기」로, **모집 잠금**. 무대 표식은 유지한 채 2027-09-11 자연 종료. 법인 계정이 2기를 새로 연다 | 아무것도 안 바뀜(연속·인증 보존) | 개인 계정 무대가 종료일까지 남음 — 단 모집 잠금이라 새로 묶이는 사람 0, 예외에 **만료일**이 생긴다 |
| B. 개인 하다로 내림 | `individual` 로 강등 → 광장 무대에서 빠짐 | 그대로 걸음 | mirr0505 가 `role='member'` 로 돌아가 **인증 0건 도전자**로 현황에 찍힘. 캡 면제도 풀려 50% 시점에 모집 마감 |
| C. 그대로 | 예외 영구 | — | 0083 원칙과 정면 충돌 |

**✅ 결정 (2026-10-28, 사용자)** — 위 A·B·C 대신 **D. 같은 하다를 그대로 법인 계정 소유로 이전**:
- 하다 id 는 그대로 두고 `challenges.creator_id` 와 개인 계정의 이 방 활동을 법인 계정으로 바꾼다. 참여자 인증 84건·연속 기록·초대 링크·울림 글 연결이 전부 유지된다.
  (새로 만들어 복사하는 안은 기각 — id 가 바뀌어 초대 링크·알림·울림 연결이 끊기고, 인증 재삽입 시 연속 트리거·하루 1회 인덱스를 다시 맞춰야 한다.)
- 앱 경로로는 이전 불가(0022 `with check`)라 **운영 SQL 1회성 스크립트**로 한다 — `0086_transfer_seed_stage.sql`.
- 옮기는 것 (이 방 한정, 개인 계정 → 법인 계정): 멤버 행(`role='host'`·합류일 유지) · 멈춤 이력 2 · 기록 39 · 인증 댓글 7 · 기록 댓글 6 · 응원 67 · 기록 좋아요 50 · 평가 1. 인증·대화·다짐·하루 노트 = 0건.
- **옮기지 않는 것**: 한잔 주문 3건(모의 결제 — 결제 기록은 실제 결제자 이름으로 보존) · 받은 알림 이력(지난 벨 기록, 의미 없음).
- 확인한 부수효과: 대상 테이블의 UPDATE 트리거는 `challenges` 의 `gave_up_at` 1회 설정 가드뿐 → 알림 발송·연속 재계산 없음.
- 이전 후 개인 계정은 이 방 멤버가 아니다. 참여자로 걷고 싶으면 일반 합류.

운영자 권한 — ✅ **개인 계정에만 유지** (법인 무대 계정엔 주지 않는다). 무대 계정은 실무자에게 인계되는 공개 활동 계정이고, admin 은 전 사용자 이메일·신고를 열람하는 권한이다. 법인 소유 admin 이 필요해지면 별도 계정을 따로 둔다.

문의 메일 — ✅ `kidoo.kim@doinno.co.kr`.

실행 순서:
1. (코드) 9.4 a~e + `0086` 작성 → 검사
2. (운영) **0085 적용** → OTA (preview·production)
3. (사용자) `kidoo.kim@doinno.co.kr` 로 앱 Google 로그인 → 닉네임 「DO하다 운영팀」
4. (운영자=mirr0505) 콘솔에서 DO하다 검증 기록 등록(사업자등록증 + 도메인) → 법인 계정 `org` 지정
5. (운영) **0086 적용** — 법인 계정 users 행이 없으면 스크립트가 스스로 중단
6. 실기기 확인: 법인 계정으로 방 진입 → 주최 표시·기록 작성자·현황 분모(참여자 2명)
7. 문서·메모리 갱신 (§8, `project_org-hada-track`)

**✅ 완료 (2026-10-28)**: 0085 운영 적용 → OTA → 법인 계정 `kidoo.kim@doinno.co.kr` 검증 기록(디오이노베이션 · 기업) + 공식 지정 → 0086 적용. 결과: 개설자 = 법인 계정 · `org / DO하다 운영팀` · 멤버 host 1(법인)+member 2 · 인증 84 불변 · 이전 기록39·인증댓글7·기록댓글6·응원67·좋아요50·울림22·평가1·멈춤2 · 개인 계정 잔여 0 · 한잔 주문 3건 개인 계정 보존. §7 열린 질문 5 해소.

### 9.6 남는 리스크 (이번 범위 밖)

- **조직 계정 셀프 탈퇴**: 실무자가 퇴사하며 앱에서 계정 삭제를 누르면 조직 계정이 "탈퇴한 사람"으로 익명화·ban 된다(0053). 스토어 정책상 앱 내 삭제는 막기 어렵다 → 런북에서 "탈퇴 전 운영팀 연락" 안내로 대응, 실제 사고가 나면 재검토.
- **닉네임 사칭**(§5 잔여 리스크) 그대로. 검증 기록은 배지의 근거를 남길 뿐, 배지 없는 "환경부" 닉네임은 여전히 막지 못한다.

---

## 10. 조직 로그인 + 조직 전용 영역 + 두 가지 합류 모드 — 실행 계획 (2026-10-28, Fable 기획 · Opus 실행)

§9.1·§9.3 의 "조직 = Google/Apple 로 로그인하는 도메인 계정" 모델은 **폐기**한다. SK하이닉스 시나리오 점검(2026-10-28)에서 드러난 결함: 대부분의 기업·기관은 Google Workspace 가 아니라 **회사 메일로 Google/Apple 계정을 만들 수 없고**, 억지로 만들면 담당자 개인 폰의 2단계 인증에 묶여 인계가 깨진다. §9.2 증명 표·§9.4 a~e(0085)·§9.5(0086) 는 그대로 유효하며 이 절이 그 위에 얹힌다.

### 10.0 결정 (2026-10-28, 사용자)

| # | 결정 | 근거 |
|---|---|---|
| 1 | 문의 메일 = **`doinnovation@doinno.co.kr`** (역할 주소) | 개인 이름 주소로 기업 서류를 받는 어색함 제거. Workspace 에서 주소 생성은 사용자 |
| 2 | 조직 검증 = **조직 메일 코드 인증 + 사업자(고유)번호 기록**. 사원증·재직증명서·공문 등 **서류는 받지 않는다**. 추가 확인이 필요하면 운영팀이 메일로 요청(런북) | "그냥 메일로만" |
| 3 | **조직 로그인** 신설 — 조직 메일로 6자리 코드를 받아 로그인(**비밀번호 없음**). 열쇠 = 그 메일함. 담당자는 개인 계정(Google/Apple)과 조직 계정을 따로 가진다 | 비밀번호 공유·퇴사자 보유 문제가 구조적으로 없음. 로그인할 때마다 조직 메일 소유가 재확인됨 |
| 4 | 조직 계정은 **일반 5탭을 보지 않는다**. 조직 전용 영역 = 대기 화면 · 조직 홈 · 하다 만들기(조직 모드) · 챌린지방 | "조직 하다 개설만 하면 된다" — 조직은 소비자가 아니라 주최자 |
| 5 | 조직 하다 두 모드: **누구나 합류**(open) / **구성원 전용**(closed + 참여 코드). **둘 다 광장에 노출**, 구성원 전용은 코드 없이 합류 불가 | "다 노출되어야 어느 기업이 하는지 보인다". 정렬은 최신순 고정(줄세우기 금지) |
| 6 | **완주자·성공자 명단** = 앱 안, 닉네임, 주최자만 열람. 조직이 앱을 열어 확인하고 사은품은 오프라인에서 직접 지급 | 실명·사번 수집 안 함(개인정보 수탁 문제 회피). 참가자는 현장에서 자기 앱을 열어 보여준다 |
| 7 | **공지** = 고정 공지 1개(대화 탭 상단 + 현황 탭) + 갱신 알림 1건 | 대화 탭은 인원이 많으면 묻힌다. 목록형 공지 게시판은 안 만든다 |
| 8 | 인증서·전자사진첩·내보내기 = **이번 범위 밖**(Phase 2 박제 자산화 / 후속). 사진첩은 박제 탭이 이미 그 역할 | |
| 9 | 사은품 표기 = 조직이 **안내문**에 직접 쓴다(앱 컬럼 없음). 앱은 명단으로 증명만 → 결제·경품 게이트 무관 | |

### 10.1 AS-IS → TO-BE (한 장)

| | AS-IS | TO-BE |
|---|---|---|
| 조직 계정 | Google/Apple 로그인 계정에 운영자가 `org` 지정 | **조직 메일 OTP 로 가입·로그인**(`users.account_type='org'`) → 운영자 승인 → `org` |
| 조직이 보는 화면 | 일반 5탭 전부 | 대기 · 조직 홈 · 만들기(조직 모드) · 방 |
| 조직 하다 종류 | open 만(0079·0083) | open(누구나 합류) · closed(구성원 전용, 참여 코드) |
| 광장 무대 | open 만 직접 select | SECURITY DEFINER RPC — closed 조직 방도 **카드만** 노출(내용은 멤버만) |
| 공지 | 없음(대화뿐) | 고정 공지 1개 + 알림 |
| 명단 | 현황 탭 인증률 | 주최자 전용 완주·성공 명단 |
| 조직 계정 탈퇴 | 가능(사고 위험, §9.6) | 서버에서 거부 |

### 10.2 묶음 A — 조직 로그인 + 조직 전용 영역 (Week 1)

**A-0 인프라 (사용자·운영, 코드 아님)**
- Supabase Auth → Email provider ON. OTP 는 `signInWithOtp` + `verifyOtp({type:'email'})`(6자리 코드, 매직링크 아님 — 앱 안에서 입력). 이메일 템플릿 "Magic Link" 를 한국어 + `{{ .Token }}` 로.
- ⚠️ **자체 SMTP 필수** — Supabase 기본 SMTP 는 시간당 3~4통 제한이라 운영 불가. 후보: Google Workspace SMTP(`doinno.co.kr`, 일 2,000통) 또는 Resend. **사용자 결정 대기.**
- `doinnovation@doinno.co.kr` 메일함(그룹/별칭) 생성.

**A-1 DB `0087_org_login.sql`**
- `users.account_type text not null default 'personal' check in ('personal','org')`. **authenticated 에 insert/update grant 하지 않는다**(0068 화이트리스트 유지) → RPC 로만 'org' 가 된다 = 개인 계정이 스스로 조직이 되는 길 없음.
- `org_applications` (가입 신청): `user_id pk → users`, `org_type`(0085 와 같은 3종), `legal_name`, `registration_no`, `contact_name`, `contact_phone`(선택·⚠️PII), `contact_email`(=로그인 메일), `status`('pending'|'approved'|'rejected'), `note`(거절 사유), `created_at`, `reviewed_at`, `reviewed_by`. authenticated 권한 없음.
- `submit_org_application(p_org_type, p_legal_name, p_registration_no, p_contact_name, p_contact_phone)` SECURITY DEFINER — `auth.uid()` 본인만. ① auth 메일 도메인이 **개인 메일 도메인 차단 목록**(gmail.com·naver.com·daum.net·hanmail.net·kakao.com·nate.com·outlook.com·hotmail.com·icloud.com·yahoo.com 등)이면 raise ② `users` upsert(nickname=`legal_name`, email, account_type='org') ③ 신청 행 insert(기존 pending/rejected 면 덮어쓰기 재신청, approved 면 raise). 결과 = status.
- `my_org_status()` — 본인 `account_type`·신청 status·note·`host_tier` 한 번에(대기 화면·라우팅용).
- admin RPC(🔒 첫 줄 `is_admin()`): `admin_list_org_applications(status)` · `admin_approve_org_application(p_user_id, p_note)` = ① `org_verifications` insert(**proofs = `{'domain_email'}`**, official_domain = 메일 도메인, contact_* 복사, verified_by = 운영자) ② 기존 `admin_set_user_host_tier(p_user_id,'org')` 호출(소급·알림 포함) ③ status approved · `admin_reject_org_application(p_user_id, p_note)`.
- **0085 CHECK 완화**: `proofs && array['biz_reg','corp_registry','unique_no','official_letter']` 조건 제거(결정 2). `proofs <@ 목록 and cardinality(proofs) >= 1` 만 남긴다. 목록에 `'nts_status'` 는 이미 있음(후속 국세청 자동 확인용).
- `db.ts` 래퍼: `submitOrgApplication`·`fetchMyOrgStatus`·`adminListOrgApplications`·`adminApproveOrgApplication`·`adminRejectOrgApplication`.

**A-2 EF `delete-account`**: 삭제 대상 `users.account_type='org'` 면 **403 + "조직 계정은 운영팀을 통해 해지해요"**. 조직 영역엔 삭제 버튼 자체가 없지만 서버가 최종 방어선.

**A-3 클라 — 로그인·가입**
- [`auth.ts`](../mobile/lib/auth.ts): `requestOrgLoginCode(email)`(`signInWithOtp`, `shouldCreateUser:true`) · `verifyOrgLoginCode(email, code)`. **기기 provider 잠금(`PROVIDER_KEY`)은 조직 로그인에 적용하지 않는다**(읽지도 쓰지도 않음) — 담당자가 같은 폰에서 개인(Apple)↔조직(메일)을 번갈아 쓴다. Google/Apple 끼리의 잠금은 그대로.
- [`login.tsx`](../mobile/app/login.tsx) 하단 "조직으로 시작하기 →" 링크(작게, 개인 로그인이 주인공).
- `app/org/signup.tsx`(신규): 폼 = 조직명 · 유형(기업/비영리/공공) · 사업자·고유번호 · 담당자 이름 · 담당자 전화(선택) · 조직 메일. 안내 2줄: "가능하면 부서 공용 메일(예: walk@회사.co.kr) — 담당자가 바뀌어도 계정이 남아요" · "개인 메일(gmail·naver 등)로는 조직 가입이 안 돼요". 클라에서도 도메인 차단 목록 1차 검사(서버 RPC 가 최종). 제출 → 코드 화면.
- `app/org/verify.tsx`(신규): 6자리 입력 + 재전송(60초). 성공 → 세션 → `submitOrgApplication` → `/org`. 이미 신청·승인된 계정의 재로그인은 코드 확인 후 바로 `/org`(신청 재제출 없음 — `my_org_status` 로 분기).
- 자동 테스트 의무 영역(인증/권한): **개인 메일 도메인 판정**은 순수 함수 `isPersonalEmailDomain(email)` 로 두고 `__tests__/org-signup.test.ts` 로 검증(대소문자·서브도메인·공백). 위치는 기존 테스트가 import 하는 방식을 따른다(`supabase/functions/_shared/` 류). SQL 차단 목록과 **같은 배열**을 쓴다 — 목록을 한 파일에서 export 하고 SQL 주석이 그 파일을 가리킨다(한쪽만 고치는 사고 방지).

**A-4 클라 — 라우팅**
- [`_layout.tsx`](../mobile/app/_layout.tsx) / [`index.tsx`](../mobile/app/index.tsx) 세션 복원 후 `fetchMyOrgStatus` → `account_type==='org'` 면 **`(tabs)` 대신 `/org`** 로. 푸시 탭 진입의 `홈?bell=` 도 org 면 `/org?bell=` 로(알림함은 A-5).
- ⚠️ 세션 복원 전 load 경합(메모 `reference_session-restore-load-race`) — account_type 판정은 세션 확정 후에만.

**A-5 클라 — 조직 영역 `app/org/`**
- `index.tsx` = 분기: `host_tier!=='org'` → **대기 화면**(pending: "운영팀이 확인하고 있어요 · 보통 1~2일" / rejected: 사유 + "다시 신청" → signup 프리필) + 문의(mailto) + 로그아웃. `host_tier==='org'` → **조직 홈**.
- 조직 홈: 헤더(조직명 · 공식 배지 · 알림 벨 · 메뉴=문의·로그아웃) + 「조직 하다 열기」 큰 버튼 + 내가 연 하다 목록(진행 / 종료 2밴드, 카드 = 제목 · 기간 · 모드 칩(누구나 합류/구성원 전용) · 참여 인원 · 오늘 인증 N). 카드 탭 → `/room/[id]`. 탭바 없음. 알림 벨은 [`AppHeader`](../mobile/components/AppHeader.tsx) 의 알림함 시트를 **재사용**(추출이 필요하면 추출만, 동작 변경 없음). 데이터 = 기존 `fetchMyChallengesWithDetails` 를 creator 필터로(새 쿼리는 부족할 때만, 보고 후).
- 없는 것(일부러): 광장·울림·기록·해냈어요·다른 하다 합류·인증·기록·다짐·한잔·관심·완주 이야기·계정 삭제·차단. 서버 정책은 건드리지 않는다(화면에 없을 뿐).
- 챌린지방([`room/[id].tsx`](../mobile/app/room/[id].tsx)): 조직 계정은 이미 `role='host'` 라 인증 FAB 없음·집계 제외. 변경 = ⋯ 메뉴의 **차단 숨김**(role host) 1곳. 나머지 무변경.

**A-6 클라 — 만들기 조직 모드** ([`create.tsx`](../mobile/app/create.tsx) `?org=1`)
- 방 타입 스텝 → **모드 선택**: 누구나 합류(open) / 구성원 전용(closed, 참여 코드 입력 — 묶음 B 전까지는 비활성 + "곧 열려요"). 내기 스텝 없음(0072 가 이미 서버 차단). 안내문 placeholder 에 "완주 사은품이 있으면 여기에 적어 주세요(지급은 주최측이 직접)". 성공 임계·기간·빈도·인증방식 그대로.
- `create_challenge`(0080) 는 개설자 `users.host_tier='org'` 면 자동으로 무대+host — **closed 도 자동 부여되는지 확인**하고 open 한정이면 org 에 한해 closed 허용(0079 의 `admin_set_host_tier` 가드도 B 에서 같이 완화).

**A-7 운영자 콘솔** ([`admin.tsx`](../mobile/app/admin.tsx)): "조직 가입 신청" 섹션(신규 `components/admin/OrgApplicationQueue.tsx`) — pending 목록(조직명·유형·번호·담당자·메일 도메인·신청일) → 행 열면 승인/거절(사유). 승인 = `adminApproveOrgApplication` 한 번(검증 기록+org 지정이 서버에서 한 트랜잭션). 기존 `OrgVerifyForm`·`UserTierAssign` 은 그대로(섭외 조직을 손으로 넣는 경로로 존속).

**A-8 문구·문서**
- `SUPPORT_EMAIL` + docs 5곳(index·privacy·terms·delete-account·guide) → `doinnovation@doinno.co.kr`. privacy.html 에 **조직 가입 수집 항목**(조직명·사업자번호·담당자 이름·담당자 전화(선택)·조직 메일, 목적=조직 확인·연락, 보관=계정 존속 기간) 추가 + 개정일.
- 런북(§5·§9.3 대체): 담당자 교체 = 조직이 운영팀 메일로 요청 → 운영자가 Supabase 대시보드에서 auth 이메일 변경 + 콘솔 `OrgVerifyForm` 「새로 기록」으로 담당자 갱신. 코드 0.

**A 완료 기준**: tsc 0 · `npm test` 전체 + `org-signup.test.ts` · 실기기: ① gmail 로 조직 가입 시도 → 거부 ② 조직 메일 가입 → 코드 → 대기 화면 ③ 운영자 승인 → 조직 홈·배지 ④ 누구나 합류 하다 개설 → 광장 무대 노출·role host ⑤ 같은 폰에서 개인 Apple 로그인 ↔ 조직 로그인 전환 ⑥ 조직 계정 `delete-account` 직접 호출 → 403.
**배포 순서**: SMTP·Email provider 설정 → 0087 → `delete-account` EF → OTA(preview·production). ⚠️ migration 먼저(클라가 `account_type` 을 읽는다).

### 10.3 묶음 B — 구성원 전용 + 광장 쇼윈도 + 고정 공지 (Week 1)

**왜 closed 인가(길 2)**: open 방은 RLS 헬퍼 `is_open_challenge`(0005·0007, 정책 5개)가 비멤버에게 인증·기록·대화·댓글을 열어 준다. 구성원 전용을 open 으로 만들면 그 5개 정책을 전부 고쳐야 하고 회귀 위험이 크다. closed 는 **이미 멤버만** 읽는다 → 광장 노출만 RPC 로 해결(하다 구경 0050 과 같은 패턴).

**B-1 DB `0088_member_only_stage.sql`**
- `challenges.join_code_hash text`(nullable). 평문 저장 금지 — pgcrypto 해시. 클라가 컬럼을 읽어도 무해하므로 컬럼 grant 를 손대지 않는다.
- `set_join_code(p_challenge_id, p_code)` SECURITY DEFINER — 개설자만 · closed+org 만 · 코드 4~12자 영숫자 · null 이면 해제. 생성 마법사는 `create_challenge` 직후 이 RPC 를 호출(create_challenge 인자 확장 금지 — 15인자 RPC 를 또 늘리면 구 클라 불일치 사고 재현).
- `join_member_only(p_challenge_id, p_code)` SECURITY DEFINER — 하다 존재·closed·org·`gave_up_at is null`·종료 전·해시 일치 → `challenge_members` insert(role member, 중복이면 `already_member`). 실패 사유를 문자열로 반환(`wrong_code`·`ended`·…), 예외 아님.
- `members_self_insert`(0043) 에 조건 추가: `join_code_hash is not null` 인 방은 **직접 insert 거부**(초대 링크만으로 우회 불가). 0043 본문을 승계하고 and 절 하나 추가.
- `get_invite_info` 재생성: `requires_code boolean` 추가(0078 본문 승계 — drop·재생성 시 grant 포함).
- `admin_set_host_tier`(0079·0083) 가드 완화: **org 는 open·closed 허용**, figure 는 open 한정 유지(figure 캡 면제·광장 동선이 open 전제). `create_challenge`(0080) 도 org 개설자의 closed 에 무대·host 자동 부여(A-6 확인 결과에 따라).
- `stage_challenges()` SECURITY DEFINER RPC — `host_tier in ('figure','org') and gave_up_at is null and end_date >= today`, **kind in ('open','closed')**. 반환 화이트리스트: id·title·description·intro_image_url·kind·host_tier·host_label·category·start_date·end_date·frequency·goal_type·target_count·success_threshold·`member_count`(활성, role='host' 제외 — ddc57e4 기준)·`is_joined`·`is_host`(호출자 = creator — **creator_id 는 반환하지 않는다**)·`requires_code`·`is_recruiting`(open 만, 0082 로직). 최신순. `fetchStageChallenges` 를 이 RPC 로 교체, 광장 외 호출처 없음 확인.
- `challenges.notice text`(≤500자) + `notice_updated_at`. `grant update (notice, notice_updated_at)`(0070 패턴, RLS `challenges_creator_update` 가 개설자만 통과). 트리거: notice 가 바뀌면 `notification_queue` kind **`host_notice`** 를 활성 멤버(개설자 제외)에게 — **kind CHECK 는 최신 전체 목록(0080 기준)을 승계해 재정의**, 빠뜨리면 23514(v2.11 교훈). 솔로 방은 멤버 1명이라 자연히 0건.
- `db.ts`: `setJoinCode`·`joinMemberOnly`·`fetchStageChallenges`(RPC)·`updateChallengeNotice`(moderateUgcText 선검수).

**B-2 EF `flush-notifications`**: kind `host_notice` 라벨·본문("📌 {조직} 공지가 바뀌었어요") 추가. 즉시 알림(상한 면제 묶음에 포함할지는 기존 `notification-cap-starvation` 규칙 따름). ⚠️ 배포 `--no-verify-jwt`.

**B-3 클라**
- 광장 [`discover.tsx`](../mobile/app/(tabs)/discover.tsx) `StageCard`: 구성원 전용 칩(lucide `Lock`, 중립 톤 — 신규 색 금지) + CTA 4상태 유지하되 모집 중 자리를 "참여 코드로 합류". 탭 → 기존 [`OpenJoinPreviewSheet`](../mobile/components/home/OpenJoinPreviewSheet.tsx) 에 `requiresCode` 모드(코드 입력 1칸 + 합류 버튼 → `joinMemberOnly`). open 조직 방·개인 open 방은 무변경.
- 초대 [`invite/[id].tsx`](../mobile/app/invite/[id].tsx) + [`invite.ts`](../mobile/lib/invite.ts) `joinChallenge`: `requires_code` 면 코드 입력 후 `joinMemberOnly` 로(기존 insert 경로 안 탐). 코드 틀리면 안내. 시도 횟수 제한은 두지 않는다(해시 비교·수동 입력이라 현실적 위험 낮음 — 필요 시 후속).
- 홈 [`home.tsx`](../mobile/app/(tabs)/home.tsx) 누구나 합류 섹션: open 만이라 무변경. 조직 홈 카드 모드 칩 "구성원 전용"(개설자에게도 코드 **평문 표시 불가** — 해시만 있음 → "코드 새로 정하기" 버튼만).
- 공지: [`ChatTab.tsx`](../mobile/components/challenge/ChatTab.tsx) 상단 고정 카드(📌 + 본문 + 갱신일, 접기 가능) · [`StatusTab.tsx`](../mobile/components/challenge/StatusTab.tsx) info 카드 아래 동일 카드 · 개설자에겐 "공지 수정"(모달, 500자, 검수). 알림 라우팅 `host_notice` → `?tab=chat`([`push.ts`](../mobile/lib/push.ts)·`AppHeader` 라벨).
- 만들기 조직 모드의 구성원 전용 활성화 + 코드 입력(A-6 의 "곧 열려요" 해제).

**B 완료 기준**: tsc 0 · npm test · 실기기: ① 구성원 전용 개설(코드 설정) → 광장에 카드 노출·내용 비공개 ② 코드 없이 초대 링크 합류 시도 → 거부(RLS·RPC 둘 다) ③ 맞는 코드 → 합류 ④ 공지 갱신 → 멤버 알림 1건 → 탭 시 대화 탭 상단 ⑤ 개인 open 방·기존 8천보 무대 동작 불변.
**배포 순서**: 0088 → `flush-notifications`(`--no-verify-jwt`) → OTA. ⚠️ 0088 전 OTA 금지(`stage_challenges` RPC 없으면 광장 무대가 빈다).

### 10.4 묶음 C — 주최자 완주·성공 명단 (며칠)

- 진입: [`StatusTab.tsx`](../mobile/components/challenge/StatusTab.tsx) 상단, **`role='host'`(조직 주최자)에게만** "완주·성공 명단 →". 개인 개설자에겐 안 보인다(비교 압박 금지 — 개인 하다는 동료 관계).
- 화면 `app/roster/[id].tsx`(신규, 조직 홈 카드에서도 진입): 섹션 = 🏆 성공(임계 달성) / 🏁 완주(끝까지 갔으나 미달) / 🏃 진행 중 / 🕊️ 포기. 각 행 = 닉네임 · 인증 N · 합류일. **가입 순 정렬**(인증률 정렬 금지). 종료 전엔 전원 "진행 중"(완주는 종료 시점에 확정). 상단 요약 "참여 N명 · 성공 N · 완주 N"(99+ 캡 적용).
- 판정 = [`stats.ts`](../mobile/lib/stats.ts) `goalStatus`/`didFinishThrough`/`isSuccess` 재사용(joinedAt·멈춤·시간대·count 형 전부 기존 규칙). 멤버별 묶기 `rosterGroups(...)` 를 stats.ts 순수 함수로 두고 `__tests__/roster.test.ts`(박제·정산과 같은 판정 = 자동 테스트 의무 영역) — goalStatus 와 교차 대조.
- 데이터 = `fetchRoomData` 가 이미 주는 members·proofs + `challenge_pauses`(0078, 멤버별). RLS: host 는 멤버라 읽기 가능. **DB·EF 변경 없음.** 내보내기는 후속.
- 완료 기준: tsc 0 · npm test(+roster) · 실기기: 8천보 무대(법인 계정)에서 명단 진입 → 참여자 2명 진행 중 표시.

### 10.5 이번에 안 만드는 것 (요청이 오면)
회사 메일 도메인 합류 인증(참여 코드보다 강함 — A 의 OTP 장치 재사용) · 명단 CSV 내보내기 · 국세청 사업자 진위 자동 확인(EF 1개 + 공공데이터 키, 콘솔 "확인" 버튼) · 참가자 식별 정보(실명·사번) 수집(개인정보 수탁 정리 선행) · 계정 전환(로그아웃 없이 개인↔조직) · 조직 명의 댓글/대화 분리 · 1,000명+ 규모(pod 연합, scale-gated).

### 10.6 열린 항목 (사용자 결정 대기)
1. SMTP: Google Workspace SMTP(doinno.co.kr) vs Resend 등 외부
2. 담당자 전화 = 선택 입력(기본안). 필수로 할지
3. 구성원 전용 코드 분실 시 "새로 정하기"만(평문 미보관) — 동의 여부

### 10.7 Opus 실행 규칙 (브리프 공통)
- 묶음 단위로 진행: A → B → C. 각 묶음 끝에 tsc(`--noUnusedLocals --noUnusedParameters`) 0 · `npm test` 전체 · diff 검토 → 보고 후 다음 묶음.
- admin RPC 는 전부 SECURITY DEFINER + **첫 줄 `is_admin()`**. 새 테이블은 authenticated 권한 없음(RPC 로만).
- RPC drop·재생성 시 기존 본문 승계 + grant 재부여. `create_challenge` 인자 추가 금지.
- UI 색은 tokens 팔레트만, 데코 이모지 대신 lucide 아이콘(광장·조직 홈). "친구/팔로우" 단어 금지. 비교 정렬 금지.
- 커밋·push·OTA 는 사용자 OK 후. 마이그레이션 적용은 `npx supabase db query --linked -f <file>`(루트에서), `db push` 금지.
