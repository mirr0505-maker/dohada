-- 0015: 카테고리 표시명 '임팩트' → '사회공헌' 라벨 변경
-- 의미가 모호한 외래어 '임팩트' 를 한국어 '사회공헌' 으로 명확화.
-- 슬러그(slug='impact'), is_impact 컬럼, 이모지는 그대로. UI 표시명만 변경.

update categories
  set name = '사회공헌'
  where slug = 'impact';
