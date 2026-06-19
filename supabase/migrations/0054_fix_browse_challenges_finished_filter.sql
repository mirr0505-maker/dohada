-- 🚀 0054 — 하다 구경(browse_challenges) RPC 내 종료된 방 필터 보완
--
-- 문제점:
--   기존 `browse_challenges` RPC에 `c.gave_up_at is null` 필터만 적용되어 있어,
--   기간이 지나 종료된(end_date < 오늘) 방이 계속 구경 목록에 노출되던 문제를 보완합니다.
--
-- 해결책:
--   where 절에 `and c.end_date >= (now() at time zone 'Asia/Seoul')::date` 조건을 추가하여
--   KST 기준 종료된 챌린지는 "하다 구경" 라이브러리 노출에서 완전히 제외합니다.

create or replace function public.browse_challenges(p_limit int default 60)
returns table (
  id uuid, kind text, title text, description text, intro_image_url text,
  goal_type text, target_count int, frequency text,
  start_date date, end_date date,
  category_id int, category_name text, category_emoji text, category_is_impact boolean,
  reference_count int, created_at timestamptz,
  votes jsonb, my_votes text[]
)
language sql security definer stable set search_path = public as $$
  select
    c.id, c.kind, c.title, c.description,
    case when c.browse_image_visible then c.intro_image_url else null end,
    c.goal_type, c.target_count, c.frequency,
    c.start_date, c.end_date,
    c.category_id, cat.name, cat.emoji, cat.is_impact,
    c.reference_count, c.created_at,
    coalesce((
      select jsonb_object_agg(t.vote_type, t.cnt)
        from (select vote_type, count(*) as cnt
                from public.challenge_votes
               where challenge_id = c.id
                group by vote_type) t
    ), '{}'::jsonb),
    coalesce((
      select array_agg(vote_type)
        from public.challenge_votes
       where challenge_id = c.id and user_id = auth.uid()
    ), '{}'::text[])
  from public.challenges c
  left join public.categories cat on cat.id = c.category_id
  where c.browse_visible = true
    and c.gave_up_at is null
    and c.end_date >= (now() at time zone 'Asia/Seoul')::date   -- 🚀 KST 기준 종료방 제외
    -- 미성년 가드(부분): 결제 본인인증에서 만 19세 미만으로 '확정된' 개설자만 제외.
    and not exists (
      select 1 from public.user_verifications uv
       where uv.user_id = c.creator_id
         and uv.birth_date > ((now() at time zone 'Asia/Seoul')::date - interval '19 years')::date
    )
  order by c.created_at desc
  limit greatest(1, least(p_limit, 100));
$$;

grant execute on function public.browse_challenges(int) to authenticated;

comment on function public.browse_challenges(int) is
  '익명 하다 구경 라이브러리 (신원 누수 차단). KST 기준 포기/종료된 방 및 만 19세 미만 개설자 방 제외.';
