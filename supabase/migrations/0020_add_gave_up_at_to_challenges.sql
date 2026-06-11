-- 0020_add_gave_up_at_to_challenges.sql
-- v2.5: 개설자가 챌린지를 포기했을 때의 시각을 기록하여 전체 비활성화 상태를 판단
alter table public.challenges 
  add column if not exists gave_up_at timestamptz;

-- 검색 인덱스 추가 (활성 챌린지 조회 속도 향상)
create index if not exists idx_challenges_active_creator 
  on public.challenges(id) 
  where gave_up_at is null;
