-- 🚀 W3 Step 1: 하다를 여는 3계층 무대의 토대 (host_tier)
-- 개인 외에 '명사(선한 영향력 인물)'·'조직(기업/정부/NGO)'이 하다를 열 수 있게 하는 계층 표식.
-- 참여구조(kind: solo/cheered/closed/open)와 직교 — kind 는 "어떻게 함께하나", host_tier 는 "누가 여나".
--
-- ⚠️ 이 스텝은 순수 additive·저위험만. pod 연합·모집 캡 면제·완주/박제 판정은 다음 스텝(W3-b) 소관.
--    create_challenge / get_invite_info 등 기존 RPC 는 건드리지 않는다 — 신규 하다는 default individual 로 생성되고,
--    무대 지정(figure/org)은 운영자가 아래 온보딩 SQL 로 사후 설정한다(셀프서비스 신청 UI 금지 = 큐레이션 품질).

alter table public.challenges
  add column if not exists host_tier text not null default 'individual'
    check (host_tier in ('individual', 'figure', 'org'));

-- 표시용 주최자명(예: '유재석', '환경부'). figure/org 일 때 운영자가 채운다. individual 은 null.
alter table public.challenges
  add column if not exists host_label text;

-- ── 운영 온보딩 SQL 예시 (수동 온보딩만 — 큐레이션=품질) ─────────────────────────
--   명사 하다:  update public.challenges set host_tier='figure', host_label='유재석'  where id='<challenge_id>';
--   조직 하다:  update public.challenges set host_tier='org',    host_label='환경부'    where id='<challenge_id>';
--   되돌리기:   update public.challenges set host_tier='individual', host_label=null   where id='<challenge_id>';
