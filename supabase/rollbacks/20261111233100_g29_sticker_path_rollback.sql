-- G29-S1 md.1 — 20261111233100_g29_sticker_path GERİ ALMA.
-- 1) CHECK kısıtı, 2) sticker_path sütunu kaldırılır (çıkartma yolları KAYBOLUR).
-- Kovadaki dosyalar (user-media/<uid>/stickers/…) SİLİNMEZ; gerekirse ayrıca temizlenir.
-- İstemci geri alma sonrası da güvenli: "sütun yok" → çıkartma okunmaz/yazılmaz, satır fotoğrafa düşer.
begin;

alter table public.meal_consumptions
  drop constraint if exists meal_consumptions_sticker_path_owner;

alter table public.meal_consumptions
  drop column if exists sticker_path;

commit;
