-- ROLLBACK — 20261103010000_review_reports
-- Tabloyu ve bağlı policy/index'leri düşürür. (UYGULANMADI — yalnızca dosya.)

begin;

drop policy if exists review_reports_insert_own on public.review_reports;
drop index if exists public.review_reports_content_idx;
drop index if exists public.review_reports_status_idx;
drop table if exists public.review_reports;

commit;
