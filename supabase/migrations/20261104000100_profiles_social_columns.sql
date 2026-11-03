-- G5-S2 — Kcalculate AI profili için `profiles` sosyal kolonları (Instagram modeli)
-- version: 20261104000100  name: profiles_social_columns
--
-- DURUM: Bu dosya YALNIZCA yazıldı; canlıya/staging'e UYGULANMADI (gece kuralı).
-- STAGING'DE TEST EDİLMEDİ. Geri alma: 20261104000100_profiles_social_columns_rollback.sql
--
-- Sözleşme (G5-CONTRACT.md §Kayıt): handle (benzersiz, küçük harf), bio (<=160),
-- is_private (varsayılan false). `avatar_url` ZATEN var (profiles) → tekrar eklenmez.
-- `display_name` ayrı kolon olarak EKLENMEZ: mevcut `full_name` kullanılır
-- (bkz. update_public_profile / get_public_profile — 20261104000800_g5_rpcs.sql).
-- `verified` ayrı kolon DEĞİL; `role`'den türetilir (role <> 'customer').
-- Kolon silme/yeniden adlandırma YOK; mevcut kullanıcılarda handle NULL kalabilir
-- (ilk açılışta claim_handle ile seçtirilir).

begin;

alter table public.profiles
  add column if not exists handle     text,
  add column if not exists bio        text,
  add column if not exists is_private boolean not null default false;

-- Biçim ve uzunluk güvenceleri. NOT VALID: mevcut 754 satır (handle NULL)
-- kilitlemeden/zorlamadan geçer; yeni/güncellenen satırlar zorlanır.
-- İdempotent: dosya iki kez koşarsa "constraint zaten var" hatası vermesin diye
-- pg_constraint kontrolüyle (G7-S1 bulgusu).
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_handle_format_chk'
                   and conrelid = 'public.profiles'::regclass) then
    alter table public.profiles
      add constraint profiles_handle_format_chk
        check (handle is null or handle ~ '^[a-z0-9_]{3,30}$') not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'profiles_bio_len_chk'
                   and conrelid = 'public.profiles'::regclass) then
    alter table public.profiles
      add constraint profiles_bio_len_chk
        check (bio is null or char_length(bio) <= 160) not valid;
  end if;
end $$;

-- Büyük/küçük harf duyarsız benzersizlik; NULL handle'lar serbest.
create unique index if not exists profiles_handle_unique_idx
  on public.profiles (lower(handle)) where handle is not null;

comment on column public.profiles.handle is
  'Kullanıcı adı (@handle). Benzersiz (büyük/küçük harf duyarsız), küçük harf, 3-30, [a-z0-9_]. claim_handle ile atanır.';
comment on column public.profiles.bio is 'Kısa biyografi, en fazla 160 karakter.';
comment on column public.profiles.is_private is
  'Gizli hesap. true ise profil içeriği yalnızca onaylı takipçilere görünür (görünürlük sunucuda denetlenir).';

commit;
