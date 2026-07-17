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

## 7. 열린 질문

1. **Step 1-a 역할 컬럼** — `challenge_members.role` 신설 vs 집계 시점 분기. (Advisor 추천 = 역할 컬럼)
2. **org 를 하다 구경(익명)에 노출하나** — 익명 라이브러리 정체성([0050](../supabase/migrations/0050_browse_anonymous_library.sql))과 조직 배지(신원 노출)가 정면 충돌.
3. **figure/org 링 색 구분** — 현재 둘 다 금빛.
4. **closed org 하다에 캡 면제를 주나** — 현재 open 전용.
5. **조직 검증 절차** — 사업자등록번호 확인을 수동 체크리스트로만 둘지, 기록을 남길지.
