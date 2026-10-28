-- 🚀 0085 — 조직 계정 검증 기록 (org_verifications) + "검증 없이 org" 경로 봉쇄
--
-- 배경 (왜 필요한가): ORG_HADA_PLAN §9.2~9.4
--   사칭 방어선은 지금 **배지 하나뿐**이다 — users.host_tier='org' 면 🏛️ 공식 표식이 붙는다.
--   그런데 "왜 이 계정이 공식인가"에 대한 기록이 **0** 이다. 운영자가 무엇을 보고 org 로 올렸는지,
--   누가·언제 확인했는지 아무 데도 남지 않는다 → 나중에 문제가 생겨도 근거를 되짚을 수 없다.
--
--   9.2 의 세 가지 확인(① 조직 실재 ② 실무자 권한 ③ 계정 소유)을 마친 뒤
--   **"누가·언제·무엇을 확인했다"** 는 기록만 남긴다.
--
-- 📌 원본 서류는 저장하지 않는다 (개인정보 최소화).
--   사업자등록증·재직증명서엔 PII 가 섞인다. 원본은 운영 메일함에 보관하고, 여기엔 **증빙 종류(proofs)** 만 적는다.
--   담당자 이름·직책·이메일은 PII 지만 실무자 교체(9.3-7)에 필요해 남긴다 → admin 게이트 뒤에서만(0081 admin_search_users 와 같은 보호 수준).
--
-- 🔒 최상위 불변식(0059:6-10): 아래 RPC 는 전부 SECURITY DEFINER 라 RLS 를 우회한다
--   → 본문 첫 줄에서 public.is_admin() 을 검사하고 아니면 즉시 raise. 클라 게이트는 UX 용일 뿐 신뢰하지 않는다.
--   테이블엔 정책을 하나도 두지 않고 anon·authenticated 권한을 모두 회수한다 → **admin RPC 로만** 읽고 쓴다.
--
-- ⚠️ admin_set_user_host_tier 는 0081 본문을 **문자 그대로 승계**하고 가드 한 덩어리만 더한다(0083 패턴).
--   figure·individual 은 무관 — org 로 가는 지정에만 "유효한 검증 기록"을 요구한다.
-- [불변] 기존 데이터는 한 행도 바뀌지 않는다. 이미 org 인 계정은 그대로 — 앞으로의 지정만 달라진다.
--   (기존 org 계정을 다시 지정하는 일은 `이미 같은 tier → return` 이 먼저 걸러 가드를 타지 않는다.)
-- 재실행 안전 — if not exists / create or replace / drop if exists (시그니처 명시).

-- ═════════════════════════════════════════════
-- ① org_verifications — 조직 검증 기록 (해지해도 지우지 않는다 = 이력)
-- ═════════════════════════════════════════════
create table if not exists public.org_verifications (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references public.users(id) on delete cascade,   -- 조직 계정
  -- 기업 / 비영리(재단·사단·NPO) / 정부·공공기관 — 9.2 ① 증빙 종류가 유형별로 다르다
  org_type         text not null check (org_type in ('company', 'nonprofit', 'public')),
  legal_name       text not null check (char_length(btrim(legal_name)) between 1 and 100),
  registration_no  text,            -- 사업자등록번호·고유번호 (공공기관은 없을 수 있다)
  official_domain  text,            -- 9.2 ③ 계정 소유 확인 기준 (도메인 메일 없는 소규모 조직은 null)
  -- 확인한 증빙 종류 (원본 아님):
  --   biz_reg 사업자등록증 · nts_status 국세청 상태조회 · corp_registry 법인등기부 · unique_no 고유번호증
  --   official_letter 기관·조직 공문 · employment 재직증명·담당자 지정 · domain_email 공식 도메인 메일
  -- ⚠️ "조직이 실재한다"는 증빙(① 실재)이 최소 1개는 있어야 한다 — 도메인 메일·재직증명만으론 조직의 존재가 증명되지 않는다.
  proofs           text[] not null
    check (
      proofs <@ array['biz_reg', 'nts_status', 'corp_registry', 'unique_no',
                      'official_letter', 'employment', 'domain_email']::text[]
      and proofs && array['biz_reg', 'corp_registry', 'unique_no', 'official_letter']::text[]
    ),
  contact_name     text,            -- ⚠️ PII — 담당자 (9.3-7 실무자 교체 때 갱신)
  contact_role     text,
  contact_email    text,            -- ⚠️ PII
  note             text,
  verified_by      uuid not null references public.users(id),   -- 확인한 운영자
  verified_at      timestamptz not null default now(),
  revoked_at       timestamptz,     -- 해지·교체 시각 (null = 유효)
  revoked_by       uuid references public.users(id)
);

-- 유효한 기록은 계정당 1개 — 재기록 시 이전 행은 revoked 로 남는다(이력 보존)
create unique index if not exists org_verifications_one_active
  on public.org_verifications (user_id) where revoked_at is null;

alter table public.org_verifications enable row level security;
-- 정책 없음 + 권한 회수 = 클라에서 직접 select/insert 불가. admin RPC 만 통로다.
revoke all on public.org_verifications from anon, authenticated;

-- ═════════════════════════════════════════════
-- ② admin_record_org_verification — 검증 기록 (재기록 = 이전 행 해지 후 새 행)
--    재기록은 담당자 교체(9.3-7)·증빙 보강에 쓴다. 이전 행을 update 로 덮지 않는 이유:
--    "그때는 누가 무엇을 확인했는가"가 사라지면 기록을 두는 의미가 없다.
-- ═════════════════════════════════════════════
drop function if exists public.admin_record_org_verification(uuid, text, text, text, text, text[], text, text, text, text);

create function public.admin_record_org_verification(
  p_user_id         uuid,
  p_org_type        text,
  p_legal_name      text,
  p_registration_no text,
  p_official_domain text,
  p_proofs          text[],
  p_contact_name    text,
  p_contact_role    text,
  p_contact_email   text,
  p_note            text
)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_new_id uuid;
begin
  if not public.is_admin() then raise exception 'admin only' using errcode = '42501'; end if;   -- 🔒 게이트

  -- 없는 사람·탈퇴 계정(0053 익명화)엔 기록하지 않는다 — 조용히 성공하면 잘못 붙인 줄 모른다
  if not exists (select 1 from public.users where id = p_user_id and deleted_at is null) then
    raise exception '없거나 탈퇴한 사용자입니다: %', p_user_id;
  end if;

  -- 이전 유효 기록은 지우지 않고 해지로 남긴다 (partial unique index 때문에도 먼저 해지해야 한다)
  update public.org_verifications
     set revoked_at = now(), revoked_by = auth.uid()
   where user_id = p_user_id and revoked_at is null;

  -- 텍스트는 trim, 빈 문자열은 null — 형식·증빙 규칙은 테이블 check 가 최종 판정한다
  insert into public.org_verifications (
    user_id, org_type, legal_name, registration_no, official_domain, proofs,
    contact_name, contact_role, contact_email, note, verified_by
  ) values (
    p_user_id, p_org_type, btrim(p_legal_name),
    nullif(btrim(p_registration_no), ''), nullif(btrim(p_official_domain), ''), p_proofs,
    nullif(btrim(p_contact_name), ''), nullif(btrim(p_contact_role), ''),
    nullif(btrim(p_contact_email), ''), nullif(btrim(p_note), ''), auth.uid()
  ) returning id into v_new_id;

  return v_new_id;
end $$;

alter function public.admin_record_org_verification(uuid, text, text, text, text, text[], text, text, text, text) owner to postgres;
grant execute on function public.admin_record_org_verification(uuid, text, text, text, text, text[], text, text, text, text) to authenticated;

-- ═════════════════════════════════════════════
-- ③ admin_revoke_org_verification — 검증 해지
--    ⚠️ 아직 org 인 계정의 근거를 먼저 지우면 "근거 없는 공식 계정"이 남는다 → 순서를 강제한다:
--      사람 계층을 individual 로 내린 뒤에만 해지 (9.3-8).
-- ═════════════════════════════════════════════
drop function if exists public.admin_revoke_org_verification(uuid);

create function public.admin_revoke_org_verification(p_user_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'admin only' using errcode = '42501'; end if;   -- 🔒 게이트

  if exists (select 1 from public.users where id = p_user_id and host_tier = 'org') then
    raise exception '아직 공식(조직) 계정이에요. 먼저 사람 계층을 개인으로 내려 주세요.';
  end if;

  update public.org_verifications
     set revoked_at = now(), revoked_by = auth.uid()
   where user_id = p_user_id and revoked_at is null;
  -- 해지할 기록이 없는데 "성공"으로 보이면 안 된다 (조용한 실패 금지)
  if not found then raise exception '유효한 조직 검증 기록이 없어요.'; end if;
end $$;

alter function public.admin_revoke_org_verification(uuid) owner to postgres;
grant execute on function public.admin_revoke_org_verification(uuid) to authenticated;

-- ═════════════════════════════════════════════
-- ④ admin_list_org_verifications — 한 계정의 검증 이력 (최신순, 해지분 포함)
--    ⚠️ 담당자 PII 포함 — admin 게이트 뒤에서만.
-- ═════════════════════════════════════════════
drop function if exists public.admin_list_org_verifications(uuid);

create function public.admin_list_org_verifications(p_user_id uuid)
returns table (
  id                   uuid,
  org_type             text,
  legal_name           text,
  registration_no      text,
  official_domain      text,
  proofs               text[],
  contact_name         text,
  contact_role         text,
  contact_email        text,
  note                 text,
  verified_by_nickname text,
  verified_at          timestamptz,
  revoked_at           timestamptz
)
language plpgsql security definer stable set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'admin only' using errcode = '42501'; end if;   -- 🔒 게이트

  return query
  select v.id, v.org_type, v.legal_name, v.registration_no, v.official_domain, v.proofs,
         v.contact_name, v.contact_role, v.contact_email, v.note,
         a.nickname, v.verified_at, v.revoked_at
    from public.org_verifications v
    left join public.users a on a.id = v.verified_by
   where v.user_id = p_user_id
   order by v.verified_at desc;
end $$;

alter function public.admin_list_org_verifications(uuid) owner to postgres;
grant execute on function public.admin_list_org_verifications(uuid) to authenticated;

-- ═════════════════════════════════════════════
-- ⑤ admin_set_user_host_tier — 0081 본문 승계 + 가드 한 덩어리 (org 는 유효한 검증 기록 필수)
--    시그니처·grant 동일 → create or replace.
-- ═════════════════════════════════════════════
create or replace function public.admin_set_user_host_tier(p_user_id uuid, p_tier text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_prev_tier text;
  v_nickname  text;
  v_challenge_id uuid;   -- 알림에 달아줄 하다 (없으면 null — 컬럼은 nullable, 0009:79)
begin
  if not public.is_admin() then raise exception 'admin only' using errcode = '42501'; end if;   -- 🔒 게이트

  if p_tier not in ('individual', 'figure', 'org') then
    raise exception 'invalid host_tier: %', p_tier;
  end if;

  select host_tier, nickname into v_prev_tier, v_nickname
    from public.users where id = p_user_id;
  -- 없는 사용자는 조용히 넘어가지 않는다 — 운영자가 잘못된 id 를 붙였는데 "성공"으로 보이면
  -- 지정이 안 된 줄 모르고 넘어간다(조용한 실패 금지).
  if v_prev_tier is null then raise exception 'user not found'; end if;

  -- 이미 같은 티어면 무동작 — 두 번 눌러도 알림이 두 번 가거나 소급이 다시 돌지 않게.
  -- (0080 의 `if not found then return` 과 같은 역할)
  if v_prev_tier = p_tier then return; end if;

  -- 🚀 0085 가드 — 공식(org)은 유효한 조직 검증 기록이 있는 계정만.
  --   "검증 없이 org" 경로를 구조적으로 닫는다. figure·individual 은 무관.
  if p_tier = 'org' and not exists (
    select 1 from public.org_verifications
     where user_id = p_user_id and revoked_at is null
  ) then
    raise exception '조직 검증 기록이 없어요. 운영자 콘솔에서 조직 증빙(9.2)을 먼저 기록해 주세요.';
  end if;

  update public.users
     set host_tier  = p_tier,
         -- 승격일 때만 승격 시각을 새로 찍는다. 강등(individual)에서는 **host_since 를 지우지 않는다** —
         -- "언제 명사였는가"는 지워야 할 오류가 아니라 남겨야 할 기록이다(0064:134 '승격 시각, 영구 기록').
         host_since = case when p_tier in ('figure', 'org') then now() else host_since end
   where id = p_user_id;

  -- ─── 강등(individual)은 여기서 끝 ─────────────────────────────────────
  -- ⚠️ 강등은 users 만 바꾸고 **challenges 는 일절 건드리지 않는다.** (의도된 결정 — 되돌리기 금지)
  --   이유: 이 사람의 하다 중에는 운영자가 admin_set_host_tier 로 손수 'org'(예: '환경부') 지정해 둔 것이
  --   섞여 있을 수 있다. 사람 티어를 내렸다고 그 하다들까지 일괄 individual 로 쓸어버리면
  --   개별 지정 이력이 한 번에 증발한다 = 복구 불가능한 사고. 승격 소급이 `host_tier='individual'` 조건으로
  --   기존 지정을 보호하는 것과 정확히 같은 결이다.
  --   개별 하다를 내려야 하면 admin_set_host_tier('<하다 id>', 'individual', null) 로 하나씩.
  if p_tier = 'individual' then return; end if;

  -- ─── 승격(figure/org): 이미 열어둔 하다에 무대 표식 소급 ──────────────
  -- ⚠️ 조건은 0080 admin_review_promotion 의 소급 update 와 **문자 그대로 동일**해야 한다.
  --   두 승격 경로가 서로 다른 하다를 무대에 올리면 설명할 수 없는 상태가 된다.
  --     kind='open'                → 무대는 open 에만. 비멤버 SELECT 가 open 에만 열려 있어(0003 challenges_open_read)
  --                                  다른 kind 에 찍으면 광장에 영영 안 보이는 무대가 된다 = 조용한 실패 (0079 와 같은 이유)
  --     end_date >= current_date   → 이미 끝난 하다를 지금 와서 무대에 올릴 이유가 없다
  --     gave_up_at is null         → 개설자가 접은 하다 제외
  --     host_tier = 'individual'   → ⚠️ 이미 무대인 하다는 덮어쓰지 않는다.
  --                                  운영자가 손으로 'org' 로 지정해 둔 하다를 'figure' 로 깎으면 안 된다.
  update public.challenges
     set host_tier  = p_tier,
         host_label = v_nickname   -- 📌 닉네임 복사 (0080 상단 트레이드오프 주석 참조 — stale 감수)
   where creator_id = p_user_id
     and kind = 'open'
     and end_date >= current_date
     and gave_up_at is null
     and host_tier = 'individual';

  -- 조직(org)이면 위에서 갱신된 하다의 **개설자 멤버 행**도 role='host' 로 (0069).
  --   org 주최자는 도전자가 아니다 → 완주·인증·분모 집계에서 빠져야 한다.
  --   명사(figure)는 본인이 직접 도전하는 사람이므로 'member' 그대로 둔다(0080:181 과 동일).
  if p_tier = 'org' then
    update public.challenge_members m
       set role = 'host'
     where m.user_id = p_user_id
       and exists (
         select 1 from public.challenges c
          where c.id = m.challenge_id
            and c.creator_id = p_user_id
            and c.kind = 'open'
            and c.host_tier = p_tier            -- 바로 위에서 org 로 갱신된 하다만
            and c.host_label = v_nickname
            and c.end_date >= current_date
            and c.gave_up_at is null
       );
  end if;

  -- ─── 알림 1건 (승격일 때만) ───────────────────────────────────────────
  -- challenge_id 는 소급 대상 중 **가장 최근 진행 중 open 하다**. 하나도 없으면 null 로 둔다
  -- (컬럼 nullable — 아직 하다를 안 연 섭외 명사도 승격 사실은 알아야 한다).
  select c.id into v_challenge_id
    from public.challenges c
   where c.creator_id = p_user_id
     and c.kind = 'open'
     and c.end_date >= current_date
     and c.gave_up_at is null
   order by c.created_at desc
   limit 1;

  -- ⚠️ notification_queue_kind_check 는 **전체 kind 목록을 다시 쓰는 구조**라 건드리지 않는다 —
  --   재정의하면서 빠뜨린 kind 가 있으면 그 알림이 통째로 23514 로 죽는다.
  --   'host_promoted' 는 0064 에서 이미 목록에 있다.
  insert into public.notification_queue (user_id, kind, challenge_id, preview, scheduled_for)
    values (p_user_id, 'host_promoted', v_challenge_id,
      -- 문구 톤은 0067·0080 을 따른다. 다만 여기엔 "1,000명 하다"라는 근거가 없으므로(섭외 경로)
      -- 인원 이야기를 하지 않고 결과만 전한다.
      case when p_tier = 'org'
        then '이제 공식 주최자예요 — 여는 하다에 🏛️ 표식이 붙어요'
        else '이제 유명인이에요 — 아바타에 금빛 테두리가 생겼어요'
      end, now());
end $$;

alter function public.admin_set_user_host_tier(uuid, text) owner to postgres;
grant execute on function public.admin_set_user_host_tier(uuid, text) to authenticated;

-- 검증:
--   1) [게이트] 비-admin 계정으로
--        select * from admin_list_org_verifications('<user id>');                    → 'admin only' (42501)
--        select admin_record_org_verification('<user id>','company','x',null,null,array['biz_reg'],null,null,null,null);
--                                                                                     → 'admin only' (42501)
--        select admin_revoke_org_verification('<user id>');                           → 'admin only' (42501)
--      직접 접근도 막힌다: select * from public.org_verifications;                     → permission denied
--
--   2) [가드 — 기록 없이 org 거부] 검증 기록이 없는 individual 계정에
--        select admin_set_user_host_tier('<user id>', 'org');
--      → exception '조직 검증 기록이 없어요. …'  · users.host_tier 그대로 individual
--      figure 지정은 기록 없이도 성공 (가드 대상 아님).
--
--   3) [증빙 규칙] 존재 증빙 없이 기록:
--        select admin_record_org_verification('<user id>','company','주식회사 두이노',null,null,
--               array['domain_email','employment'],null,null,null,null);
--      → check 위반(23514). array['biz_reg','nts_status','domain_email'] 이면 성공.
--      허용 목록 밖 값(array['biz_reg','bogus']) → check 위반.
--
--   4) [기록 → org 성공] 3) 의 성공 후
--        select admin_set_user_host_tier('<user id>', 'org');   → 성공 · 소급·알림은 0081 과 동일
--
--   5) [재기록 = 이전 해지] 같은 계정에 담당자만 바꿔 다시 기록
--        select * from admin_list_org_verifications('<user id>');
--      → 2행, 최신 1행만 revoked_at null. 이전 행은 revoked_at·revoked_by 채워짐(이력 보존).
--
--   6) [org 상태에서 해지 거부]
--        select admin_revoke_org_verification('<user id>');   → exception '아직 공식(조직) 계정이에요. …'
--      순서대로: admin_set_user_host_tier('<user id>','individual') → admin_revoke_org_verification('<user id>') 성공.
--      다시 해지 → exception '유효한 조직 검증 기록이 없어요.'
--
--   7) [기존 org 계정 불변] 0085 이전에 org 가 된 계정은 그대로. 같은 tier 재지정은 가드 전에 return.
--
--   8) [탈퇴 계정] users.deleted_at 이 있는 계정에 기록 → exception '없거나 탈퇴한 사용자입니다'
