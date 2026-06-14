-- 🚀 0045 — 인증/기록 사진 여러 장 (인증 최대 3장, 기록 최대 4장)
--
-- AS-IS: proofs·logs 모두 photo_url 단일 컬럼(1장).
-- TO-BE: photo_urls text[] 추가(전체 사진). photo_url 은 **커버(=첫 장)** 로 유지 →
--   기존 읽기(피드 카드·홈·연속 메달·완주 통계 등 전부 photo_url 참조)가 하나도 안 깨짐.
--   새 글: photo_url = photos[0] + photo_urls = 전체. 기존 글: photo_urls = [photo_url] 백필.
--
-- 재실행 안전 — add column if not exists / drop constraint if exists.

-- ─── 인증(proofs) — 최대 3장 ───
alter table public.proofs add column if not exists photo_urls text[] not null default '{}';
update public.proofs
  set photo_urls = array[photo_url]
  where photo_url is not null and cardinality(photo_urls) = 0;
alter table public.proofs drop constraint if exists proofs_photo_urls_max;
alter table public.proofs add constraint proofs_photo_urls_max check (cardinality(photo_urls) <= 3);

-- ─── 기록(logs) — 최대 4장 ───
alter table public.logs add column if not exists photo_urls text[] not null default '{}';
update public.logs
  set photo_urls = array[photo_url]
  where photo_url is not null and cardinality(photo_urls) = 0;
alter table public.logs drop constraint if exists logs_photo_urls_max;
alter table public.logs add constraint logs_photo_urls_max check (cardinality(photo_urls) <= 4);

-- 검증:
--   1) 기존 인증/기록 → photo_urls = [photo_url] (1장) 백필 확인
--   2) 인증 4장·기록 5장 insert 시도 → CHECK 위반 거부
--   3) photo_url 은 그대로 유지(커버) — 기존 피드/메달/완주 통계 무탈
