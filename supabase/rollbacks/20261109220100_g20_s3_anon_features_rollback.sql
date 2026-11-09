-- Rollback: 20261109220100_g20_s3_anon_features.sql
-- İstemci fonksiyon yokken önbellek/varsayılanla devam eder (bugünkü davranış).
begin;
drop function if exists public.get_anon_features(text, text, text);
commit;
