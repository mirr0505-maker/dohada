-- 🚀 0059 — 운영자(Admin) 콘솔 Step A1: is_admin 인프라 + admin 전용 RPC
--
-- 운영 수작업(Supabase SQL Editor)을 앱 내 admin 화면으로 옮기기 위한 DB 게이트.
-- Phase A 스코프: ① 신고 큐 검토(숨김/해제/무시) ② 명사/조직(host_tier) 지정 ③ 숨김 복구.
--
-- 🔒 최상위 보안 불변식:
--   아래 admin RPC 는 전부 SECURITY DEFINER 라 RLS 를 우회한다(admin 이 모든 신고·콘텐츠를 봐야 하므로).
--   따라서 모든 admin RPC 는 본문 첫 줄에서 public.is_admin() 을 검사하고, 아니면 즉시 raise exception 한다.
--   게이트가 없으면 아무 로그인 사용자나 전체 신고·콘텐츠를 열람/수정하게 된다 = 치명적. (인증/권한 영역)
--   클라 게이트(is_admin 노출)는 UX 용일 뿐, 신뢰하지 않는다.
--
-- target_type ↔ 테이블 매핑은 0047 apply_report_autohide 를 그대로 미러:
--   proof→proofs · comment→comments · log_comment→log_comments · log→logs · story→completion_stories · chat→chat_messages.
--   6 테이블 모두 hidden boolean 존재(0047). 기존 RLS·트리거·apply_report_autohide 는 건드리지 않는다(읽기만·미러).
-- 재실행 안전.

-- ─── ① is_admin 컬럼 + seed ───────────────────────────────────────────
alter table public.users add column if not exists is_admin boolean not null default false;

-- 초기 운영자: mirr0505@gmail.com (재실행해도 멱등)
update public.users set is_admin = true where email = 'mirr0505@gmail.com';

-- ─── ② is_admin() 헬퍼 (SECURITY DEFINER, stable) ─────────────────────
-- users.is_admin RLS 와 무관하게 현재 로그인 사용자가 운영자인지 판정. 모든 admin RPC 게이트의 단일 소스.
create or replace function public.is_admin()
returns boolean language sql security definer stable set search_path = public as $$
  select coalesce((select is_admin from public.users where id = auth.uid()), false);
$$;
alter function public.is_admin() owner to postgres;
grant execute on function public.is_admin() to authenticated;

-- ─── ③ admin_list_reports() — pending 신고 큐 ─────────────────────────
-- 검토 대기(status='pending') 신고 목록 + 대상 콘텐츠 미리보기(텍스트 스니펫 or '(사진 인증)') +
-- 대상 현재 hidden + 작성자 닉네임 + 신고자 닉네임 + reason/detail. 최신순.
create or replace function public.admin_list_reports()
returns table (
  report_id         uuid,
  target_type       text,
  target_id         uuid,
  reason            text,
  detail            text,
  created_at        timestamptz,
  reporter_nickname text,
  author_nickname   text,
  preview           text,
  is_hidden         boolean
)
language plpgsql security definer stable set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'admin only'; end if;   -- 🔒 게이트
  return query
  with base as (
    select
      r.id, r.target_type, r.target_id, r.reason, r.detail, r.created_at, r.reporter_id,
      -- 작성자 id (target_type 별 테이블 분기 — apply_report_autohide 미러)
      case r.target_type
        when 'proof'       then (select p.user_id  from public.proofs             p  where p.id  = r.target_id)
        when 'comment'     then (select c.user_id  from public.comments           c  where c.id  = r.target_id)
        when 'log_comment' then (select lc.user_id from public.log_comments       lc where lc.id = r.target_id)
        when 'log'         then (select l.user_id  from public.logs               l  where l.id  = r.target_id)
        when 'story'       then (select cs.user_id from public.completion_stories cs where cs.id = r.target_id)
        when 'chat'        then (select cm.user_id from public.chat_messages      cm where cm.id = r.target_id)
      end as author_id,
      -- 미리보기 텍스트 (proofs 는 사진이라 caption 없으면 폴백)
      case r.target_type
        when 'proof'       then (select coalesce(p.caption, '(사진 인증)') from public.proofs             p  where p.id  = r.target_id)
        when 'comment'     then (select c.content                         from public.comments           c  where c.id  = r.target_id)
        when 'log_comment' then (select lc.content                        from public.log_comments       lc where lc.id = r.target_id)
        when 'log'         then (select l.content                         from public.logs               l  where l.id  = r.target_id)
        when 'story'       then (select coalesce(cs.story, '(완주 이야기)') from public.completion_stories cs where cs.id = r.target_id)
        when 'chat'        then (select cm.content                        from public.chat_messages      cm where cm.id = r.target_id)
      end as preview,
      -- 대상 현재 숨김 여부
      case r.target_type
        when 'proof'       then (select p.hidden  from public.proofs             p  where p.id  = r.target_id)
        when 'comment'     then (select c.hidden  from public.comments           c  where c.id  = r.target_id)
        when 'log_comment' then (select lc.hidden from public.log_comments       lc where lc.id = r.target_id)
        when 'log'         then (select l.hidden  from public.logs               l  where l.id  = r.target_id)
        when 'story'       then (select cs.hidden from public.completion_stories cs where cs.id = r.target_id)
        when 'chat'        then (select cm.hidden from public.chat_messages      cm where cm.id = r.target_id)
      end as is_hidden
    from public.reports r
    where r.status = 'pending'
  )
  select
    b.id, b.target_type, b.target_id, b.reason, b.detail, b.created_at,
    (select u.nickname from public.users u where u.id = b.reporter_id) as reporter_nickname,
    (select u.nickname from public.users u where u.id = b.author_id)   as author_nickname,
    left(b.preview, 80) as preview,
    coalesce(b.is_hidden, false) as is_hidden
  from base b
  order by b.created_at desc;
end $$;
alter function public.admin_list_reports() owner to postgres;
grant execute on function public.admin_list_reports() to authenticated;

-- ─── ④ admin_set_content_hidden() — 숨김/복구 공용 ────────────────────
-- 대상 콘텐츠의 hidden 을 p_hidden 으로 설정(숨김=true, 복구=false). apply_report_autohide CASE 미러.
create or replace function public.admin_set_content_hidden(p_target_type text, p_target_id uuid, p_hidden boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'admin only'; end if;   -- 🔒 게이트
  if    p_target_type = 'proof'       then update public.proofs             set hidden = p_hidden where id = p_target_id;
  elsif p_target_type = 'comment'     then update public.comments           set hidden = p_hidden where id = p_target_id;
  elsif p_target_type = 'log_comment' then update public.log_comments       set hidden = p_hidden where id = p_target_id;
  elsif p_target_type = 'log'         then update public.logs               set hidden = p_hidden where id = p_target_id;
  elsif p_target_type = 'story'       then update public.completion_stories set hidden = p_hidden where id = p_target_id;
  elsif p_target_type = 'chat'        then update public.chat_messages      set hidden = p_hidden where id = p_target_id;
  else  raise exception 'unknown target_type: %', p_target_type;
  end if;
end $$;
alter function public.admin_set_content_hidden(text, uuid, boolean) owner to postgres;
grant execute on function public.admin_set_content_hidden(text, uuid, boolean) to authenticated;

-- ─── ⑤ admin_resolve_report() — 신고 처리(검토완료/무시) ──────────────
create or replace function public.admin_resolve_report(p_report_id uuid, p_status text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'admin only'; end if;   -- 🔒 게이트
  if p_status not in ('reviewed', 'dismissed') then raise exception 'invalid status: %', p_status; end if;
  update public.reports set status = p_status where id = p_report_id;
end $$;
alter function public.admin_resolve_report(uuid, text) owner to postgres;
grant execute on function public.admin_resolve_report(uuid, text) to authenticated;

-- ─── ⑥ admin_list_hidden() — 숨김된 콘텐츠 전체(오판 복구용) ──────────
-- 6 테이블 hidden=true union. 미리보기·작성자·생성시각. 최신순.
create or replace function public.admin_list_hidden()
returns table (
  target_type     text,
  target_id       uuid,
  preview         text,
  author_nickname text,
  created_at      timestamptz
)
language plpgsql security definer stable set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'admin only'; end if;   -- 🔒 게이트
  return query
  select 'proof'::text,       p.id,  left(coalesce(p.caption, '(사진 인증)'), 80),  u.nickname, p.created_at
    from public.proofs p             join public.users u on u.id = p.user_id  where p.hidden
  union all
  select 'comment'::text,     c.id,  left(c.content, 80),                          u.nickname, c.created_at
    from public.comments c           join public.users u on u.id = c.user_id  where c.hidden
  union all
  select 'log_comment'::text, lc.id, left(lc.content, 80),                         u.nickname, lc.created_at
    from public.log_comments lc      join public.users u on u.id = lc.user_id where lc.hidden
  union all
  select 'log'::text,         l.id,  left(l.content, 80),                          u.nickname, l.created_at
    from public.logs l               join public.users u on u.id = l.user_id  where l.hidden
  union all
  select 'story'::text,       cs.id, left(coalesce(cs.story, '(완주 이야기)'), 80), u.nickname, cs.created_at
    from public.completion_stories cs join public.users u on u.id = cs.user_id where cs.hidden
  union all
  select 'chat'::text,        cm.id, left(cm.content, 80),                         u.nickname, cm.created_at
    from public.chat_messages cm     join public.users u on u.id = cm.user_id where cm.hidden
  order by 5 desc;   -- created_at
end $$;
alter function public.admin_list_hidden() owner to postgres;
grant execute on function public.admin_list_hidden() to authenticated;

-- ─── ⑦ admin_set_host_tier() — 명사/조직 무대 지정 (0058 host_tier/label) ──
create or replace function public.admin_set_host_tier(p_challenge_id uuid, p_tier text, p_label text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'admin only'; end if;   -- 🔒 게이트
  if p_tier not in ('individual', 'figure', 'org') then raise exception 'invalid host_tier: %', p_tier; end if;
  update public.challenges set host_tier = p_tier, host_label = p_label where id = p_challenge_id;
end $$;
alter function public.admin_set_host_tier(uuid, text, text) owner to postgres;
grant execute on function public.admin_set_host_tier(uuid, text, text) to authenticated;

-- ─── ⑧ admin_search_challenges() — host_tier 지정 대상 하다 검색 ───────
create or replace function public.admin_search_challenges(p_q text)
returns table (
  id         uuid,
  title      text,
  kind       text,
  host_tier  text,
  host_label text,
  created_at timestamptz
)
language plpgsql security definer stable set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'admin only'; end if;   -- 🔒 게이트
  return query
  select c.id, c.title, c.kind, c.host_tier, c.host_label, c.created_at
  from public.challenges c
  where c.title ilike '%' || p_q || '%'
  order by c.created_at desc
  limit 30;
end $$;
alter function public.admin_search_challenges(text) owner to postgres;
grant execute on function public.admin_search_challenges(text) to authenticated;

-- 검증:
--   1) admin seed:  select id, email, is_admin from public.users where email='mirr0505@gmail.com';  → is_admin=true
--   2) 비-admin 계정으로 각 RPC 호출(select admin_list_reports() 등) → 전부 'admin only' exception
--   3) admin 계정으로:
--      - select * from admin_list_reports();                              → pending 신고 + 미리보기/작성자/hidden
--      - select admin_set_content_hidden('comment','<id>', true);          → 해당 comment hidden=true
--      - select admin_resolve_report('<report_id>', 'reviewed');           → reports.status='reviewed'
--      - select * from admin_list_hidden();                                → hidden=true 콘텐츠 6종 union
--      - select admin_set_host_tier('<challenge_id>', 'figure', '유재석');  → challenges.host_tier/label
--      - select * from admin_search_challenges('금연');                     → title ilike 매칭 ≤30
