# G41 — Seçim grubu görsel denetimi (13 Kas)

**Yöntem ve sınırı:** Canlı DB salt okunur sorgusu (Supabase MCP `execute_sql`) bu oturumda izin
sınıflandırıcısı tarafından **reddedildi** ("Production Reads"). Engel aşılmaya çalışılmadı (anahtar
okuma / paket içinden anahtar çıkarma yok). Denetim bu yüzden **statik** yapıldı:

- kod: `src/modules/eatkcal/v2/model/optionImage.ts`, `EkProductScreen.tsx`
- G35 eşlemesi: `supabase/migrations/20261112120100_g35_option_images.sql`. Eşleme işlevi Python'da birebir taklit edildi.
- canlı seçenek adları: `docs/night/G38-ADISYO-AD-LISTESI.md`. Bu liste 12 Kas canlı DB okumasından; satır sayıları ve bağlı ürün id'leri orada.

Tam canlı tarama için aşağıdaki "Canlı tarama sorguları" bölümündeki sorgular İlter tarafından
(ya da izin verilirse bir sonraki oturumda) çalıştırılmalı. Sonuçlar bu tabloya eklenir.

## Kök neden (id 33 "Ana Yemek + Detoks/Shake Paketi", id 43 2 kişilik → "Ana Öğün Seçimi")

1. **Kod:** seçenek kartında `option_items.image_url` (çıkartma), bağlı ürün fotoğrafının
   (`linked_product_id → products.img`) ÖNÜNDEYDİ (G35 önceliği).
2. **Veri:** G35 eşlemesindeki gramaj LIKE'ı (`'Izgara Köfte' || ' %'`) ürün adlı seçenekleri de yakalıyor:
   - "Izgara Köfte Basmati ve Brokoli Sebze": 7 satır, bağlı ürün 11
   - G38 kısa adı "Izgara Köfte Bowl": 9 satır, bağlı ürün 14

   Bu satırlar köfte çıkartması alıyor. Elle girilmiş ya da başka yoldan yazılmış protein
   çıkartmaları da aynı kod önceliğiyle ürün fotoğrafını örtüyordu.

**Düzeltme (bu tur):**
- **Kod (uygulama 1.1.0, veriden bağımsız):** `groupOptionImageCandidates`
  - Bağlı ürün fotoğrafı ya da adı bir ürünle eşleşen seçeneğin fotoğrafı ÖNCE gelir.
  - Protein/şarküteri çıkartması YALNIZ gramaj grubunda gösterilir. Gramaj grubu iki şekilde tanınır:
    - `products.gramaj_options` (her zaman), ya da
    - başlığında "gramaj" geçen grup/şablon, ya da bütün seçenekleri "50g / 3 Yumurta" gibi çeşit olan grup.
  - Gramaj dışı grupta yalnız protein çıkartması varsa kart boş hâl gösterir (yanlış görsel yerine).
- **Veri (migration DOSYASI, uygulanmadı):** `supabase/migrations/20261113100100_g41_option_image_fix.sql`
  - Rollback: `supabase/rollbacks/20261113100100_g41_option_image_fix_rollback.sql`
  - Ne yapar: bağlı ürünlü satırlardaki protein çıkartmasını temizler; G38 kısa adlarıyla G35'ten düşen gramaj satırlarını doldurur.
  - Yedek tablo: `_g41_option_image_backup` (RLS açık, politika yok).

## Bulgular

Sorun türleri: **YG** = yanlış görsel · **BG** = boş görsel · **GA** = yanlış/eksik grup adı · **SR** = sıralama riski.

| Ürün | Grup | Seçenek (canlı ad → G38 sonrası) | Sorun | Önerilen düzeltme |
|---|---|---|---|---|
| 33 Ana Yemek + Detoks/Shake Paketi · 43 (2 kişilik) | Ana Öğün Seçimi | Izgara Köfte Basmati ve Brokoli Sebze → Dengeli Izgara Köfte (7 satır, bağlı ürün 11) | **YG** — G35 LIKE köfte çıkartması yazar; kod çıkartmayı ürün fotoğrafının önüne koyuyordu | Kod G41 (bağlı ürün fotoğrafı önce, köfte çıkartması gramaj dışı grupta yok) ✓ + migration 20261113100100 (image_url NULL) |
| 33 · 43 | Ana Öğün Seçimi | Brokoli Sebze Üzeri Izgara Köfte Bowl → Izgara Köfte Bowl (9 satır, bağlı ürün 14) | **YG** — G38 adından sonra G35 tekrar çalışırsa köfte çıkartması | Aynı ✓ |
| 33 · 43 | Ana Öğün Seçimi | Protein Tavuk Fileto / Protein Tavuk Sote / Protein Izgara Köfte / Dengeli Tavuk Fileto / Dengeli Tavuk Sote / Tavuk Fileto Bowl / Tavuk Sote Bowl (bağlı ürün 6, 7, 8, 9, 10, 12, 13) | G35 eşleşmesi yok. Ama elle girilmiş protein çıkartması varsa **YG** | Kod G41 ✓ (bağlı ürün fotoğrafı her zaman önce) |
| Paketler (detoks grubu, 12 satır) | Detoks seçimi | Yeşil Canlandırıcı Detoks (330ml) → Yeşil Canlandırıcı · Turuncu Metabolizma Hızlandırıcı (330ml) → Turuncu Metabolizma · Limonlu Zencefilli Arındırıcı (330ml) → Limonlu Zencefilli · Kırmızı Antioksidan Güç (330ml) → Kırmızı Antioksidan | **BG riski** — `linked_product_id` boşsa görsel ada göre bulunur. G38 kısa adı ürün adıyla ("Yeşil Canlandırıcı Detoks") tam eşleşmez, görsel boş kalır | Canlıda `linked_product_id` doluluğunu doğrula (sorgu 2). Boşsa ürün 17–22'ye bağla (panelden ya da ayrı migration; id'ler canlıdan doğrulanınca) |
| Paketler (detoks grubu) | Detoks seçimi | Tropikal Yağ Yakıcı · Salatalıklı Ferahlatıcı (yalnız parantez kalktı) | Ürün adları da aynı biçimde kısalıyor (G38 §1). Ada göre eşleşme sürer | — |
| Paketler (shake grubu, 6 satır) | Shake seçimi | Protein Shake Kakao Fıstık Ezmeli → Fıstık Ezmeli Shake · … Hindistan Cevizli → Hindistan Cevizli Shake · … Yulaf Vanilyalı → Yulaf Vanilyalı Shake | **BG riski** — bağlı değilse ada göre eşleşme G38 sonrası kopar (ürün adı kısalmıyor) | Sorgu 2 ile doğrula; boşsa ilgili shake ürününe bağla |
| tera / breaking_fast | Dana Roastbeef Seçimi | Dana Roastbeef 50g/80g/100g → Roastbeef 50g/80g/100g | **SR** — G38, G35'ten ÖNCE uygulanırsa G35 eşleşmez, gramaj kartı çıkartmasız kalır | Migration'ları zaman sırasıyla uygula (G35 → G38). G41 dosyası boş kalanı doldurur ✓ |
| tera / breaking_fast | Fıstıklı Mortadella Salam Seçimi | Fıstıklı Mortadella Salam 50g/80g/100g → Mortadella … | **SR** — aynı | Aynı ✓ (kod: grup başlığında "gramaj" yok ama bütün seçenekler gramaj çeşidi → gramaj grubu, çıkartma korunur) |
| tera / breaking_fast | Tavuk sote gramaj grubu | Soya Soslu Tavuk Sote 150g/250g/350g → Soya Soslu Sote … | **SR** — aynı | Aynı ✓ |
| (ekmek grubu) | Ekmek seçimi | Mavi Haşhaşlı Amerikan Bagel → Mavi Haşhaşlı Bagel | **SR** — G38 önce gelirse `ekmek-bagel` eşleşmez | Aynı ✓ |
| (baz grubu) | Baz seçimi | Basmati & Lolorosso Karışık → Basmati & Lolorosso | **SR** — aynı (`baz-basmati-lolorosso`) | Aynı ✓ |
| 43 (2 kişilik) | Ana Öğün Seçimi | — | **GA (doğrulanamadı)** — 2 kişilik pakette tek "Ana Öğün Seçimi" mi, yoksa kişi başı iki grup ("1. kişi / 2. kişi") mı olmalı? Grup adı ve `max` canlıdan okunamadı | Sorgu 3 ile kontrol. İki seçim gerekiyorsa `max_selection = 2` ya da iki ayrı grup |
| Tüm ürünler | Şablon değerleri (`product_option_template_values`) | — | G38 §4: sonda parantezli ad yok. Görsel kolonu G35 ile eklenir. Şablonlarda bağlı ürün alanı yok, protein çıkartması yalnız gramaj şablonunda görünür (kod) | — |

## Canlı tarama sorguları (yalnız okuma)

```sql
-- 1) Bağlı ürünlü seçenekte protein/şarküteri çıkartması (YG) — G41 migration'ı sonrası 0 olmalı
select p.id, p.name, og.name as grup, oi.name, oi.image_url
from option_items oi
join option_groups og on og.id = oi.group_id
join product_option_groups pog on pog.group_id = og.id
join products p on p.id = pog.product_id
where oi.linked_product_id is not null
  and oi.image_url ~ '/images/options/(protein|sarkuteri)-'
order by p.id, og.name, oi.sort_order;

-- 2) Görselsiz kalacak seçenek (BG): kendi görseli yok, bağlı ürün yok, adı bir ürünle eşleşmiyor
select p.id, p.name, og.name as grup, oi.name
from option_items oi
join option_groups og on og.id = oi.group_id
join product_option_groups pog on pog.group_id = og.id
join products p on p.id = pog.product_id
where oi.image_url is null
  and oi.linked_product_id is null
  and not exists (select 1 from products x where lower(btrim(x.name)) = lower(btrim(oi.name)) and x.img is not null)
order by p.id, og.name, oi.sort_order;

-- 3) Grup adları ve seçim sınırları (GA): paketler + gramaj dışı grupta protein çıkartması
select p.id, p.name, og.id, og.name, og.min_selection, og.max_selection,
       count(oi.*) as secenek,
       count(*) filter (where oi.image_url ~ '/images/options/(protein|sarkuteri)-') as protein_cikartma,
       count(*) filter (where oi.linked_product_id is not null) as bagli
from option_groups og
join product_option_groups pog on pog.group_id = og.id
join products p on p.id = pog.product_id
left join option_items oi on oi.group_id = og.id
group by p.id, p.name, og.id, og.name, og.min_selection, og.max_selection
order by p.id, og.name;

-- 4) Bağlı ürünün kendisinde fotoğraf yok (kart boş hâle düşer)
select oi.name, oi.linked_product_id, lp.name, lp.img
from option_items oi join products lp on lp.id = oi.linked_product_id
where lp.img is null or btrim(lp.img) = '';
```

Şema `CANLI_SEMA_2026-11-09.md` ile doğrulandı. Bir grup birden çok ürüne `product_option_groups`
üzerinden bağlanır, yani aynı grup birden çok üründe görünür. Seçim sınırları `min_selection` / `max_selection`.
