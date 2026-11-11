-- G35-S1 md.1 — Seçenek görselleri. DURUM: YALNIZ DOSYA (canlıya UYGULANMADI).
-- İdempotent: tekrar çalıştırmak güvenli. Rollback: supabase/rollbacks/20261112120100_g35_option_images_rollback.sql
-- Önkoşul: option_items, product_option_template_values (canlıda var, görsel kolonu YOK).
--
-- 1) İki tabloya nullable `image_url text` eklenir (yoksa).
-- 2) 58 seçenek görseli (Storage `images/options/<kod>.webp`, genel adres) ad → kod eşlemesiyle
--    yazılır. YALNIZ `image_url is null` satırlar güncellenir (elle girilmiş görsel ezilmez;
--    tekrar çalıştırılabilir).
--    Eşleşme türleri:
--      e = tam ad (btrim ile; büyük/küçük harf DUYARLI — "Salatalık" ≠ "Salatalık Turşu",
--          "Lolorosso" ≠ "Akdeniz Lolorosso").
--      g = gramaj çeşidi: tam ad VEYA `Ad %` (ör. "Izgara Tavuk Bonfile 150g").
--      y = yumurta adet çeşidi: rakamla başlayıp " Yumurta" ile biten ad (ör. "2 Yumurta" … "5 Yumurta").
--    İki grupta geçen aynı ad aynı görseli alır (ad bazlı eşleşme).
-- ÖNEMLİ: Görseller İlter tarafından `images/options/` altına yüklenmeden uygulanırsa uygulama
-- kırılmaz (görsel yüklenemezse kart bağlı ürün görseline / boş hâle düşer), ama önce yükleme önerilir.
begin;

alter table public.option_items
  add column if not exists image_url text;

alter table public.product_option_template_values
  add column if not exists image_url text;

comment on column public.option_items.image_url is
  'Seçenek görseli (şeffaf çıkartma, genel URL). Boşsa uygulama bağlı ürün görselini kullanır. G35.';
comment on column public.product_option_template_values.image_url is
  'Seçenek görseli (şeffaf çıkartma, genel URL). Boşsa uygulama yer tutucu gösterir. G35.';

create temporary table g35_option_image_map (name text not null, code text not null, kind text not null)
  on commit drop;

insert into g35_option_image_map (name, code, kind) values
    ('Akdeniz Lolorosso', 'baz-akdeniz-lolorosso', 'e'),
    ('Basmati', 'baz-basmati', 'e'),
    ('Basmati & Lolorosso Karışık', 'baz-basmati-lolorosso', 'e'),
    ('Izgara Tavuk Bonfile', 'protein-tavuk-bonfile', 'g'),
    ('Soya Soslu Tavuk Sote', 'protein-tavuk-sote', 'g'),
    ('Izgara Köfte', 'protein-izgara-kofte', 'g'),
    ('Dana Fajita', 'protein-dana-fajita', 'g'),
    ('Ton Balığı', 'protein-ton-baligi', 'g'),
    ('Falafel', 'protein-falafel', 'g'),
    ('Yumurta', 'protein-yumurta', 'y'),
    ('Dana Jambon', 'sarkuteri-dana-jambon', 'g'),
    ('Dana Roastbeef', 'sarkuteri-dana-roastbeef', 'g'),
    ('Fıstıklı Mortadella Salam', 'sarkuteri-mortadella', 'g'),
    ('Hindi Füme', 'sarkuteri-hindi-fume', 'g'),
    ('Ciabatta Ekmeği', 'ekmek-ciabatta', 'e'),
    ('Ekşi Maya Ekmeği', 'ekmek-eksi-maya', 'e'),
    ('Focaccia Ekşi Maya', 'ekmek-focaccia', 'e'),
    ('Mavi Haşhaşlı Amerikan Bagel', 'ekmek-bagel', 'e'),
    ('Klasik Lavaş', 'lavas-klasik', 'e'),
    ('Ekşi Hamur Lavaş', 'lavas-eksi-hamur', 'e'),
    ('Tam Buğday Lavaş', 'lavas-tam-bugday', 'e'),
    ('Garnitür (Karışık)', 'garnitur-karisik', 'e'),
    ('Beluga', 'garnitur-beluga', 'e'),
    ('Maş Fasulye', 'garnitur-mas-fasulye', 'e'),
    ('Meksika Fasulye', 'garnitur-meksika-fasulye', 'e'),
    ('Cheddarlı Patates Püresi', 'meze-cheddarli-pure', 'e'),
    ('Dilimli Zeytin', 'meze-dilimli-zeytin', 'e'),
    ('Guacamole', 'meze-guacamole', 'e'),
    ('Guacamole Sos', 'meze-guacamole', 'e'),
    ('Havuç Tarator', 'meze-havuc-tarator', 'e'),
    ('Köz Biberli Humus', 'meze-koz-biberli-humus', 'e'),
    ('Közlenmiş Biber', 'meze-kozlenmis-biber', 'e'),
    ('Közlenmiş Patlıcan', 'meze-kozlenmis-patlican', 'e'),
    ('Yoğurt', 'meze-yogurt', 'e'),
    ('Cheddar Peyniri', 'peynir-cheddar', 'e'),
    ('Eski Kaşar', 'peynir-eski-kasar', 'e'),
    ('Labne Peyniri', 'peynir-labne', 'e'),
    ('Mozarella', 'peynir-mozarella', 'e'),
    ('Lolorosso', 'yesillik-lolorosso', 'e'),
    ('Maskolin', 'yesillik-maskolin', 'e'),
    ('Roka', 'yesillik-roka', 'e'),
    ('Brokoli', 'sebze-brokoli', 'e'),
    ('Domates', 'sebze-domates', 'e'),
    ('Salatalık', 'sebze-salatalik', 'e'),
    ('Tatlı Patates', 'sebze-tatli-patates', 'e'),
    ('Ballı Hardal Sos', 'sos-balli-hardal', 'e'),
    ('Chipotle Sos', 'sos-chipotle', 'e'),
    ('Pesto Sos', 'sos-pesto', 'e'),
    ('Ranch Sos', 'sos-ranch', 'e'),
    ('Ranch', 'sos-ranch', 'e'),
    ('Sezar Sos', 'sos-sezar', 'e'),
    ('Sweet Chili Sos', 'sos-sweet-chili', 'e'),
    ('Vişne Reçeli', 'sos-visne-receli', 'e'),
    ('Beyaz Turp Turşusu', 'tursu-beyaz-turp', 'e'),
    ('Jalapeno', 'tursu-jalapeno', 'e'),
    ('Kapari', 'tursu-kapari', 'e'),
    ('Pancar Turşu', 'tursu-pancar', 'e'),
    ('Salatalık Turşu', 'tursu-salatalik', 'e'),
    ('Kruton', 'citir-kruton', 'e'),
    ('Taco Chips', 'citir-taco', 'e');

-- Satır adı → kod (ilk eşleşen; tam ad önce gelir).
create or replace function pg_temp.g35_option_code(p_name text)
returns text
language sql
stable
as $$
  select m.code
  from g35_option_image_map m
  where btrim(p_name) = m.name
     or (m.kind = 'g' and btrim(p_name) like m.name || ' %')
     or (m.kind = 'y' and btrim(p_name) ~ ('^[0-9].* ' || m.name || '$'))
  order by (btrim(p_name) = m.name) desc, length(m.name) desc
  limit 1
$$;

update public.option_items oi
set image_url = 'https://xtjakvinklthlvsfcncu.supabase.co/storage/v1/object/public/images/options/'
                || pg_temp.g35_option_code(oi.name) || '.webp'
where oi.image_url is null
  and pg_temp.g35_option_code(oi.name) is not null;

update public.product_option_template_values v
set image_url = 'https://xtjakvinklthlvsfcncu.supabase.co/storage/v1/object/public/images/options/'
                || pg_temp.g35_option_code(v.name) || '.webp'
where v.image_url is null
  and pg_temp.g35_option_code(v.name) is not null;

commit;

-- Uygulama sonrası kontrol (yalnız okuma):
--   select name, image_url from public.option_items where image_url like '%/images/options/%' order by name;
--   select name from public.option_items where image_url is null and linked_product_id is null order by name;
--   select name, image_url from public.product_option_template_values where image_url is not null order by name;
