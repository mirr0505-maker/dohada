-- 🚀 0088 — 조직 메일 찾기 (사업자·고유번호 → 가려진 로그인 메일) (ORG_HADA_PLAN §10.2 A 후속)
--
-- 배경 (2026-10-29): 조직 계정은 메일이 곧 열쇠(비밀번호 없음, 0087) → 메일을 잊으면 들어올 방법이 없었다.
-- ⚠️ 사업자등록번호는 공개 정보다(국세청 조회·홈페이지 하단). 번호만으로 전체 메일을 돌려주면
--    누구나 기업 번호를 넣어 담당자 메일을 수집할 수 있다 → **전체 메일은 절대 반환하지 않는다.**
--    앞 2글자 + *** + @도메인. 도메인은 전부 보여 준다(담당자가 어느 메일인지 떠올리는 데 필요).
--
-- 로그인 전(anon)에도 호출된다 — 메일을 모르면 로그인을 못 하니까.
-- 비교는 숫자만(하이픈·공백 무시). 번호 없이 가입한 조직(공공기관 등)은 찾을 수 없다 → 운영팀 문의.
-- 거절(rejected) 신청도 포함한다 — 다시 신청하려면 그 메일로 로그인해야 한다.
-- 재실행 안전 — create or replace.

create or replace function public.mask_email(p_email text)
returns text language sql immutable as $$
  select case
    when position('@' in coalesce(p_email, '')) <= 1 then '***'
    else
      left(split_part(p_email, '@', 1), case when char_length(split_part(p_email, '@', 1)) <= 2 then 1 else 2 end)
      || '***@' || split_part(p_email, '@', 2)
  end;
$$;

create or replace function public.find_org_login_email(p_registration_no text)
returns table (legal_name text, masked_email text)
language sql stable security definer set search_path = public as $$
  select a.legal_name, public.mask_email(a.contact_email)
    from public.org_applications a
   where length(regexp_replace(coalesce(p_registration_no, ''), '\D', '', 'g')) >= 5   -- 너무 짧은 입력으로 훑기 방지
     and regexp_replace(coalesce(a.registration_no, ''), '\D', '', 'g')
       = regexp_replace(p_registration_no, '\D', '', 'g')
   order by a.created_at asc;
$$;
alter function public.find_org_login_email(text) owner to postgres;
grant execute on function public.find_org_login_email(text) to anon, authenticated;

-- 검증:
--   1) select mask_email('walk@skhynix.com');   → 'wa***@skhynix.com'
--      select mask_email('a@x.kr');             → 'a***@x.kr'
--      select mask_email('ab@x.kr');            → 'a***@x.kr'
--      select mask_email('nope');               → '***'
--   2) select * from find_org_login_email('123-45-67890');  → 신청 시 넣은 번호와 숫자만 같으면 1행 이상
--   3) select * from find_org_login_email('12');            → 0행 (짧은 입력)
--   4) 반환 컬럼에 전체 메일·user_id 가 없다 (legal_name, masked_email 만)
