-- 🚀 0055 — 하다 구경(browse_challenges) RPC 종료방 노출 기획 의도 주석 보완
--
-- 문제점:
--   0054 마이그레이션에서 종료방을 목록에서 필터링하도록 수정하였으나,
--   이는 기획 의도("어떤 하다들이 진행되었는지 히스토리를 둘러보고 영감을 얻는 익명 라이브러리")와 달랐음이 확인되었습니다.
--
-- 해결책:
--   종료방 필터(`and c.end_date >= ...`)를 제거하여 원래대로 복구하고,
--   종료방이 노출되는 것이 의도된 동작임을 명시하는 한국어 주석을 추가합니다.

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
    -- 🚀 종료된 방(end_date < 오늘)도 노출하는 것이 의도된 스펙입니다.
    --    (사용자들이 과거에 어떤 '하다'들이 진행되었는지 히스토리를 둘러보고 따라할 수 있도록 영감을 제공하기 위함)
    
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
  '익명 하다 구경 라이브러리 (신원 누수 차단). KST 기준 포기방 및 만 19세 미만 개설자 방 제외 (종료방은 기획 의도에 따라 포함).';
