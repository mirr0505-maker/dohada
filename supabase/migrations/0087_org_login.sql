-- 🚀 0087 — 조직 로그인 (조직 메일 코드 가입) + 가입 신청 큐 (ORG_HADA_PLAN §10.2 묶음 A)
--
-- 배경 (2026-10-28 결정, §10.0):
--   대부분의 기업·기관은 회사 메일로 Google/Apple 계정을 만들 수 없다 → 조직은 **조직 메일로 6자리 코드**를 받아
--   가입·로그인한다(비밀번호 없음, Supabase Auth email OTP). 가입 직후는 "검증 대기", 운영자가 승인하면 공식(org).
--   서류는 받지 않는다 — 검증 = 조직 메일 소유(코드) + 사업자·고유번호 기록.
--
-- 이 파일이 하는 일:
--   ① users.account_type ('personal'|'org') — 조직 계정은 일반 5탭 대신 조직 전용 영역으로 간다(클라 라우팅 근거)
--      authenticated 에 insert/update grant 를 주지 않는다(0068 화이트리스트 유지) → RPC 로만 'org' 가 된다.
--   ② org_applications — 가입 신청 (authenticated 권한 없음, RPC 로만)
--   ③ submit_org_application · my_org_status — 본인용 RPC
--   ④ admin_list_org_applications · admin_approve_org_application · admin_reject_org_application — 🔒 첫 줄 is_admin()
--   ⑤ org_verifications.proofs CHECK 완화 — "조직 실재 서류 1개 이상" 조건 제거 (결정 2: 메일만)
--   ⑥ 백필 — 이미 공식(org)인 계정은 account_type='org'
--
-- [불변] 개인 계정(personal)의 동작은 한 줄도 바뀌지 않는다. 기본값 'personal'.
-- 재실행 안전 — if not exists / create or replace / drop if exists.

-- ═════════════════════════════════════════════
-- ① users.account_type
-- ═════════════════════════════════════════════
alter table public.users add column if not exists account_type text not null default 'personal';
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'users_account_type_check') then
    alter table public.users add constraint users_account_type_check check (account_type in ('personal', 'org'));
  end if;
end $$;
-- ⚠️ grant 를 추가하지 않는다 — 0068 의 insert(id, google_sub, email, nickname, avatar_url) /
--    update(nickname, avatar_url) 에 account_type 이 없으므로 클라는 이 컬럼을 쓸 수 없다.

-- ═════════════════════════════════════════════
-- ② org_applications — 가입 신청 (계정당 1행, 재신청 = 덮어쓰기)
-- ═════════════════════════════════════════════
create table if not exists public.org_applications (
  user_id          uuid primary key references public.users(id) on delete cascade,
  org_type         text not null check (org_type in ('company', 'nonprofit', 'public')),
  legal_name       text not null check (char_length(btrim(legal_name)) between 1 and 100),
  registration_no  text,            -- 사업자등록번호·고유번호 (공공기관은 없을 수 있다)
  contact_name     text not null check (char_length(btrim(contact_name)) between 1 and 50),   -- ⚠️ PII
  contact_phone    text,            -- ⚠️ PII · 선택 입력 (§10.6-2 기본안)
  contact_email    text not null,   -- ⚠️ PII · 로그인 메일 = 조직 메일
  status           text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  note             text,            -- 거절 사유 (대기 화면에 보인다)
  created_at       timestamptz not null default now(),
  reviewed_at      timestamptz,
  reviewed_by      uuid references public.users(id)
);
alter table public.org_applications enable row level security;
-- 정책 없음 + 권한 회수 = 클라 직접 접근 불가. 본인은 my_org_status, 운영자는 admin RPC 로만.
revoke all on public.org_applications from anon, authenticated;

-- ═════════════════════════════════════════════
-- 개인 메일 도메인 판정 — ⚠️ 목록은 supabase/functions/_shared/org/personalEmailDomains.ts 와 **같아야 한다**.
--   __tests__/org-signup.test.ts 가 이 파일의 배열과 TS 배열을 비교한다(한쪽만 고치면 테스트가 깨진다).
-- ═════════════════════════════════════════════
create or replace function public.is_personal_email_domain(p_email text)
returns boolean language sql immutable as $$
  select lower(btrim(split_part(coalesce(p_email, ''), '@', 2))) = any (array[
    -- PERSONAL_EMAIL_DOMAINS:BEGIN
    'gmail.com', 'googlemail.com', 'naver.com', 'daum.net', 'hanmail.net', 'kakao.com', 'nate.com',
    'hotmail.com', 'outlook.com', 'live.com', 'msn.com', 'icloud.com', 'me.com', 'mac.com',
    'yahoo.com', 'yahoo.co.kr', 'proton.me', 'protonmail.com'
    -- PERSONAL_EMAIL_DOMAINS:END
  ]::text[]);
$$;

-- ═════════════════════════════════════════════
-- ③-a submit_org_application — 조직 메일 코드로 로그인한 본인이 가입 신청
--   반환: status 문자열. 실패는 예외(클라가 메시지를 그대로 보여준다).
-- ═════════════════════════════════════════════
drop function if exists public.submit_org_application(text, text, text, text, text);
create or replace function public.submit_org_application(
  p_org_type        text,
  p_legal_name      text,
  p_registration_no text,
  p_contact_name    text,
  p_contact_phone   text
) returns text language plpgsql security definer set search_path = public as $$
declare
  v_uid     uuid := auth.uid();
  v_email   text;
  v_account text;
  v_status  text;
begin
  if v_uid is null then raise exception '로그인이 필요해요.' using errcode = '42501'; end if;

  select email into v_email from auth.users where id = v_uid;
  if v_email is null then raise exception '메일 정보가 없는 계정이에요.'; end if;
  if public.is_personal_email_domain(v_email) then
    raise exception '개인 메일(gmail·naver 등)로는 조직 가입을 할 수 없어요. 조직 메일을 써 주세요.';
  end if;

  -- 이미 개인 계정으로 쓰이는 메일이면 거부 — 개인 활동이 있는 계정을 조직으로 바꾸면
  -- 그 사람의 인증·기록이 조직 이름으로 둔갑한다.
  select account_type into v_account from public.users where id = v_uid;
  if v_account = 'personal' then
    raise exception '이 메일은 이미 개인 계정으로 쓰이고 있어요. 조직용 다른 메일을 써 주세요.';
  end if;

  select status into v_status from public.org_applications where user_id = v_uid;
  if v_status = 'approved' then
    raise exception '이미 승인된 조직 계정이에요.';
  end if;

  -- users 행 — 닉네임 = 조직명 (승인 시 host_label 이 이 닉네임을 복사한다, 0081)
  insert into public.users (id, email, nickname, account_type)
    values (v_uid, v_email, btrim(p_legal_name), 'org')
  on conflict (id) do update set nickname = excluded.nickname, account_type = 'org';

  insert into public.org_applications
    (user_id, org_type, legal_name, registration_no, contact_name, contact_phone, contact_email, status, note, created_at, reviewed_at, reviewed_by)
  values
    (v_uid, p_org_type, btrim(p_legal_name), nullif(btrim(coalesce(p_registration_no, '')), ''),
     btrim(p_contact_name), nullif(btrim(coalesce(p_contact_phone, '')), ''), v_email,
     'pending', null, now(), null, null)
  on conflict (user_id) do update set
    org_type = excluded.org_type, legal_name = excluded.legal_name, registration_no = excluded.registration_no,
    contact_name = excluded.contact_name, contact_phone = excluded.contact_phone, contact_email = excluded.contact_email,
    status = 'pending', note = null, created_at = now(), reviewed_at = null, reviewed_by = null;

  return 'pending';
end $$;
alter function public.submit_org_application(text, text, text, text, text) owner to postgres;
grant execute on function public.submit_org_application(text, text, text, text, text) to authenticated;

-- ═════════════════════════════════════════════
-- ③-b my_org_status — 라우팅·대기 화면용 (본인 것만)
--   users 행이 없으면 account_type = null (막 코드 로그인만 한 신규)
-- ═════════════════════════════════════════════
create or replace function public.my_org_status()
returns json language sql stable security definer set search_path = public as $$
  select json_build_object(
    'account_type', u.account_type,
    'host_tier',    u.host_tier,
    'nickname',     u.nickname,
    'status',       a.status,
    'note',         a.note,
    'org_type',     a.org_type,
    'legal_name',   a.legal_name,
    'registration_no', a.registration_no,
    'contact_name', a.contact_name,
    'contact_phone', a.contact_phone
  )
  from (select auth.uid() as id) me
  left join public.users u on u.id = me.id
  left join public.org_applications a on a.user_id = me.id;
$$;
alter function public.my_org_status() owner to postgres;
grant execute on function public.my_org_status() to authenticated;

-- ═════════════════════════════════════════════
-- ④ 운영자 RPC — 🔒 전부 첫 줄 is_admin()
-- ═════════════════════════════════════════════
create or replace function public.admin_list_org_applications(p_status text default 'pending')
returns table (
  user_id uuid, org_type text, legal_name text, registration_no text,
  contact_name text, contact_phone text, contact_email text,
  status text, note text, created_at timestamptz, reviewed_at timestamptz
) language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'admin only' using errcode = '42501'; end if;   -- 🔒 게이트
  return query
    select a.user_id, a.org_type, a.legal_name, a.registration_no,
           a.contact_name, a.contact_phone, a.contact_email,
           a.status, a.note, a.created_at, a.reviewed_at
      from public.org_applications a
     where p_status is null or a.status = p_status
     order by a.created_at asc;   -- 먼저 온 신청부터
end $$;
alter function public.admin_list_org_applications(text) owner to postgres;
grant execute on function public.admin_list_org_applications(text) to authenticated;

-- 승인 = ① 검증 기록(domain_email) ② 사람 계층 org (0081 경로 — 소급·알림 포함) ③ 신청 approved.
--   한 함수 = 한 트랜잭션 → 중간 실패 시 아무것도 남지 않는다.
create or replace function public.admin_approve_org_application(p_user_id uuid, p_note text default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  a public.org_applications%rowtype;
begin
  if not public.is_admin() then raise exception 'admin only' using errcode = '42501'; end if;   -- 🔒 게이트

  select * into a from public.org_applications where user_id = p_user_id;
  if not found then raise exception '가입 신청을 찾을 수 없어요.'; end if;
  if a.status = 'approved' then return; end if;   -- 두 번 눌러도 무동작

  perform public.admin_record_org_verification(
    p_user_id, a.org_type, a.legal_name, a.registration_no,
    lower(split_part(a.contact_email, '@', 2)),   -- 공식 도메인 = 로그인 메일 도메인
    array['domain_email']::text[],
    a.contact_name, null, a.contact_email, p_note
  );
  perform public.admin_set_user_host_tier(p_user_id, 'org');

  update public.org_applications
     set status = 'approved', note = p_note, reviewed_at = now(), reviewed_by = auth.uid()
   where user_id = p_user_id;
end $$;
alter function public.admin_approve_org_application(uuid, text) owner to postgres;
grant execute on function public.admin_approve_org_application(uuid, text) to authenticated;

create or replace function public.admin_reject_org_application(p_user_id uuid, p_note text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'admin only' using errcode = '42501'; end if;   -- 🔒 게이트
  if coalesce(btrim(p_note), '') = '' then raise exception '거절 사유를 적어 주세요 — 신청자 대기 화면에 보여요.'; end if;

  update public.org_applications
     set status = 'rejected', note = btrim(p_note), reviewed_at = now(), reviewed_by = auth.uid()
   where user_id = p_user_id and status = 'pending';
  if not found then raise exception '대기 중인 신청이 아니에요.'; end if;
end $$;
alter function public.admin_reject_org_application(uuid, text) owner to postgres;
grant execute on function public.admin_reject_org_application(uuid, text) to authenticated;

-- ═════════════════════════════════════════════
-- ⑤ 0085 증빙 CHECK 완화 — 서류 없이 메일(domain_email)만으로도 기록 가능
-- ═════════════════════════════════════════════
alter table public.org_verifications drop constraint if exists org_verifications_proofs_check;
alter table public.org_verifications add constraint org_verifications_proofs_check check (
  proofs <@ array['biz_reg', 'nts_status', 'corp_registry', 'unique_no',
                  'official_letter', 'employment', 'domain_email']::text[]
  and cardinality(proofs) >= 1
);

-- ═════════════════════════════════════════════
-- ⑥ 백필 — 이미 공식(org)인 계정 (2026-10-28 기준 법인 계정 1개)
--   이 계정은 Google 로그인이지만 account_type 은 로그인 방식과 무관하다 → 다음 실행부터 조직 영역으로 간다.
-- ═════════════════════════════════════════════
update public.users set account_type = 'org' where host_tier = 'org' and account_type <> 'org';

-- 검증:
--   1) [게이트] 비-admin 으로 select admin_list_org_applications();            → 'admin only' (42501)
--   2) [개인 메일] gmail 계정으로 select submit_org_application('company','x',null,'담당',null) → 개인 메일 거부
--   3) [개인 계정] 기존 개인 계정(회사 도메인)으로 submit                       → '이미 개인 계정' 거부
--   4) [컬럼 가드] 클라에서 update users set account_type='org' where id=auth.uid() → permission denied
--   5) [승인] admin_approve_org_application(<id>) → users.host_tier='org' · org_verifications 1행(proofs={domain_email})
--             · host_promoted 알림 1건 · org_applications.status='approved'
--   6) [백필] select email, account_type from users where host_tier='org';      → 전부 org
