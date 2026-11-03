-- ROLLBACK — 20261104000100_profiles_social_columns
-- Eklenen kolonları/kısıtları/indeksi geri alır. UYGULANMADI (yalnız dosya).
begin;
drop index  if exists public.profiles_handle_unique_idx;
alter table public.profiles drop constraint if exists profiles_handle_format_chk;
alter table public.profiles drop constraint if exists profiles_bio_len_chk;
alter table public.profiles drop column if exists is_private;
alter table public.profiles drop column if exists bio;
alter table public.profiles drop column if exists handle;
commit;
