-- G35-S1 md.1 — 20261112120100_g35_option_images GERİ ALMA.
-- DİKKAT: `image_url` kolonları SİLİNİR — migration'ın yazdığı 58 görsel adresinin yanında,
-- sonradan panelden elle girilmiş seçenek görselleri de kaybolur (gerekirse önce dışa aktar:
--   select id, image_url from public.option_items where image_url is not null;
--   select id, image_url from public.product_option_template_values where image_url is not null;).
-- İstemci geri alma sonrası güvenli: uygulama `image_url` kolonu yoksa eski sorguya düşer
-- (bağlı ürün görseli → ada göre ürün görseli → boş hâl).
-- Storage `images/options/` dosyalarına dokunulmaz.
begin;

alter table public.option_items
  drop column if exists image_url;

alter table public.product_option_template_values
  drop column if exists image_url;

commit;
