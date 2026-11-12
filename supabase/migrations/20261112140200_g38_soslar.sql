-- G38-S1 md.3 — 50 cc soslar ayrı ürün olarak (kcalculate). DURUM: YALNIZ DOSYA (canlıya UYGULANMADI).
-- Rollback: supabase/rollbacks/20261112140200_g38_soslar_rollback.sql
-- Sonraki adım (ELLE, Adisyo eşlemesinden SONRA): supabase/migrations-manual/20261112T1403_g38_soslar_ac.sql
--
-- NEDEN GİZLİ (is_available = false) EKLENİYOR:
--   adisyo-save-order, Adisyo productUnitId'si olmayan bir ürün içeren siparişi BÜTÜNÜYLE
--   reddediyor ("unmapped_products") → sos eklenmiş bir sipariş mutfağa hiç inmez.
--   Sosların Adisyo kodu canlı veride bulunamadı (adisyo_orders/adisyo_api_log'da yok; Adisyo
--   katalog dökümü repoda yok). Bu yüzden ürünler önce gizli eklenir; Adisyo eşlemesi
--   (adisyo-sync-products — merkez + Bayraklı şube kipi) tamamlanınca manuel dosya yalnız
--   EŞLENMİŞ sosları ve "Soslar" kategorisini açar. Kategori burada EKLENMEZ: ana sayfa tüm
--   kategorileri döşeme olarak gösteriyor, ürünü olmayan boş bir "Soslar" döşemesi çıkmasın.
--
-- Adisyo ad eşleşmesi: adisyo-sync-products adı normalize ederken parantez içini siler
--   ("Ranch Sos (50cc)" → "ranch sos"), yani Adisyo'daki "(50cc)"li adlar buradaki parantezsiz
--   adlarla İSİMLE eşleşir. adisyo_product_code bilinmediği için NULL bırakılır.
--
-- Değerler:
--   fiyat 40 TL (görev tanımı) · marka kcalculate · kategori "Soslar" · açıklama "50 cc".
--   Kalori/makro: option_items'taki aynı sosun Tera "Ekstra Sos" grubundaki değeri (Tera'nın
--   50 cc ekstra sos porsiyonu; Breaking Fast "Sos & Ezme" değerleri daha küçük porsiyon).
--   "Acı Sweet Chili Sos" için "Sweet Chili Sos" değeri kullanıldı (acı sürümün ayrı değeri yok).
--   Remoulade: option_items'ta YOK → kalori/makro NULL, görsel NULL (uygulama yer tutucu gösterir).
--   Görsel: G35 seçenek çıkartmaları (Storage images/options/sos-*.webp, genel adres).
-- İdempotent: aynı slug'lı kcalculate ürünü varsa tekrar eklenmez.
begin;

-- products.id identity'si elle verilmiş id'lerin gerisinde kalmış olabilir → çakışmasın.
do $$
declare
  seq text := pg_get_serial_sequence('public.products', 'id');
  mx bigint;
  lv bigint;
begin
  if seq is null then
    return;
  end if;
  select coalesce(max(id), 0) into mx from public.products;
  execute format('select last_value from %s', seq) into lv;
  -- >= : last_value = max ve is_called = false ise sıradaki değer max olurdu.
  if mx > 0 and mx >= lv then
    perform setval(seq, mx);  -- is_called = true → sıradaki max + 1
  end if;
end $$;

insert into public.products
  (name, "desc", price, category, brand, img, slug,
   cal, calories, protein, carbs, fats,
   type, is_available, "order", allow_immediate, allow_scheduled, is_bundle, is_crosssell)
select v.name, '50 cc', 40, 'Soslar', 'kcalculate', v.img, v.slug,
       v.kcal, v.kcal, v.protein, v.carbs, v.fats,
       'meal', false, v.ord, true, true, false, false
from (values
  ('Acı Sweet Chili Sos', 'aci-sweet-chili-sos',
   'https://xtjakvinklthlvsfcncu.supabase.co/storage/v1/object/public/images/options/sos-sweet-chili.webp',
   44::smallint, 0.2::numeric, 10.8::numeric, 0.0::numeric, 900),
  ('Ranch Sos', 'ranch-sos',
   'https://xtjakvinklthlvsfcncu.supabase.co/storage/v1/object/public/images/options/sos-ranch.webp',
   47::smallint, 0.9::numeric, 3.5::numeric, 3.3::numeric, 901),
  ('Ballı Hardal Sos', 'balli-hardal-sos',
   'https://xtjakvinklthlvsfcncu.supabase.co/storage/v1/object/public/images/options/sos-balli-hardal.webp',
   81::smallint, 2.8::numeric, 3.3::numeric, 6.3::numeric, 902),
  ('Remoulade Sos', 'remoulade-sos',
   null,
   null::smallint, null::numeric, null::numeric, null::numeric, 903),
  ('Chipotle Sos', 'chipotle-sos',
   'https://xtjakvinklthlvsfcncu.supabase.co/storage/v1/object/public/images/options/sos-chipotle.webp',
   63::smallint, 0.4::numeric, 2.0::numeric, 6.1::numeric, 904)
) as v(name, slug, img, kcal, protein, carbs, fats, ord)
where not exists (
  select 1 from public.products p where p.brand = 'kcalculate' and p.slug = v.slug
);

commit;

-- Uygulama sonrası kontrol (yalnız okuma):
--   select id, name, price, category, is_available, adisyo_product_unit_id from public.products
--   where brand = 'kcalculate' and category = 'Soslar' order by "order";
-- Sonra: adisyo-sync-products (merkez) + { branch_id: Bayraklı, dry_run: false } → manuel açma dosyası.
