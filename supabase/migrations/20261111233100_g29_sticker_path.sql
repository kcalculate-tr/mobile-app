-- G29-S1 md.1 (İlter 11 Kas 11:40) — Çıkartma (FinMoSticker): meal_consumptions.sticker_path.
-- DURUM: YALNIZ DOSYA (canlıya UYGULANMADI). İdempotent: tekrar çalıştırmak güvenli.
-- Rollback: supabase/rollbacks/20261111233100_g29_sticker_path_rollback.sql
-- Önkoşul: 20261104000500_day_shares (photo_path), 20261104000700_user_media_bucket.
--
-- Çıkartma cihazda üretilir (iOS 17+ Vision / Android ML Kit); sunucuya giden tek şey kullanıcının
-- kendi Tara fotoğrafından kesilmiş küçük (≤ 512 px, ~20 KB) WebP. Yol:
--   user-media / <uid>/stickers/<meal_consumptions.id>.webp
-- Kovanın mevcut sahiplik politikası (ilk klasör = auth.uid()) bu yolu zaten kapsar → STORAGE
-- POLİTİKASI DEĞİŞMEZ; hesap silme (delete-account `<uid>/` öneki) çıkartmaları da siler.
-- Gün kartı paylaşım politikası (user_media_select_day_share) yalnız photo_path'e bakar →
-- çıkartma takipçiye AÇILMAZ (yalnız sahibi görür).
--
-- İstemci bu migration uygulanmadan önce de güvenli: sticker_path güncellemesi / okuması
-- "sütun yok" (42703 / PGRST204) verir → oturumda bir daha denenmez, yüklenen dosya geri
-- silinir, satır fotoğrafa düşer (src/lib/sticker/stickerStore.ts). Mevcut liste sorguları
-- sticker_path SEÇMEZ (ayrı toplu okuma) → uygulanmamışken hiçbir ekran bozulmaz.
begin;

alter table public.meal_consumptions
  add column if not exists sticker_path text;

comment on column public.meal_consumptions.sticker_path is
  'G29: user-media (özel) kovasında cihazda üretilmiş çıkartma yolu (<uid>/stickers/<id>.webp). İstemci kısa ömürlü imzalı URL üretir. Public URL DEĞİL.';

-- Yol yalnız sahibinin klasöründe olabilir (başka kullanıcının dosyasına işaret edemez).
do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conname = 'meal_consumptions_sticker_path_owner'
       and conrelid = 'public.meal_consumptions'::regclass
  ) then
    alter table public.meal_consumptions
      add constraint meal_consumptions_sticker_path_owner
      check (
        sticker_path is null
        or (
          split_part(sticker_path, '/', 1) = user_id::text
          and split_part(sticker_path, '/', 2) = 'stickers'
          and sticker_path !~ '\.\.'
          and length(sticker_path) <= 200
        )
      ) not valid;
    -- Yeni sütun boş → doğrulama anında biter.
    alter table public.meal_consumptions validate constraint meal_consumptions_sticker_path_owner;
  end if;
end $$;

commit;
