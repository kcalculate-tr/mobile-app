# G35-S1 — Seçenek görselleri (option_items) uygulama + panel · LOG (12 Kas)

## ÖZET
1. Worktree `g35-s1`, dal `night35/secenek-gorsel` (taban `release/1.1.0` @ 7ddc988). Yalnız JS/TS → OTA; yeni paket yok; canlı DB / deploy / OTA yok.
2. md.1 Migration DOSYASI `20261112120100_g35_option_images.sql` + rollback: `option_items.image_url` ve `product_option_template_values.image_url` (nullable, `add column if not exists`). Aynı migration'da 58 kod ad → kod eşlemesi (60 ad satırı: Guacamole/Guacamole Sos, Ranch Sos/Ranch aynı görsel). Yalnız `image_url is null` satırlar güncellenir → tekrar çalıştırılabilir. Kodlar `webp/` klasöründeki 58 dosyayla birebir doğrulandı.
3. md.2 eatkcal ürün sayfası seçenek kartı (`OptionCard`): öncelik `image_url` (şeffaf çıkartma, contain, köşesiz, yer tutucusuz, 54 pt, kart zeminine oturur — seçiliyken lime) → bağlı ürün görseli (`products.img` join, cover) → ada göre ürün görseli (G18'den kalan yedek) → mevcut boş hâl. Yüklenemeyen aday atlanır (Storage'a henüz yüklenmemiş çıkartma bağlı ürüne / boş hâle düşer). Önbellek mevcut `CachedImage` (expo-image, memory-disk).
4. Veri: `option_items` ve şablon değerleri önce `image_url` ile okunur; kolon yoksa (migration uygulanmamış) görselsiz eski sorguya düşer — sayfa kırılmaz.
5. md.3 Panel (kcal-web `apps/panel`, dal `panel/secenek-gorsel`, worktree `p-s9`, taban `panel/canli-1.1.0` @ b505701): Seçim grupları + Opsiyon şablonları çekmecelerinde "Seçenek görseli" alanı (yükleme `images/options/`, Kaldır, mobil kart önizlemesi Açık/Koyu/Seçili 54×54 contain), listelerde küçük görsel. Yazma ayrı kolonda (`setOptionItemImage` / `setTemplateValueImage`), diğer kayıtları etkilemez; kolon yoksa anlaşılır hata.
6. md.4 Testler: mobil birim 8 (öncelik, eksik URL, tekrarsız, veri katmanı + düşüş, migration sözleşmesi/eşleme) + bileşen 10 (Light/Dark, contain, lime, cover, boş hâl, onError düşüşü, VoiceOver). Panel birim 5.
7. Kontroller (dalda ve `release/1.1.0` üzerinde yeniden): hygiene + tsc ✅ · unit 1236/1236 ✅ · jest 97 suite / 567 test ✅ · expo export iOS ✅ (3300 modül) · Android ✅ (3307 modül). Panel: tsc ✅ · eslint 0 hata ✅ · playwright unit + şema kolon testi 384/384 ✅.
8. md.5 `release/1.1.0`'a `git merge --no-ff night35/secenek-gorsel` — çakışma yok, force/reset yok (birleştirme `g23-s1` worktree'sinde, önceki oturumlar gibi).
9. Push: `night35/secenek-gorsel`, `release/1.1.0`, kcal-web `panel/secenek-gorsel`.
10. Canlıya: önce görseller `images/options/`'a yüklenir, sonra migration uygulanır (sıra ters olsa da uygulama kırılmaz).

## Commit tablosu
| Commit | Madde | Açıklama |
|---|---|---|
| af65703 | md.1 | migration DOSYASI 20261112120100 + rollback |
| c21f23c | md.2 | seçenek kartı görsel önceliği, veri katmanı image_url + products.img, CachedImage placeholder=null |
| 40d8533 | md.4 | birim + bileşen testleri |
| 0f317c1 | md.5 | `merge --no-ff night35/secenek-gorsel` → `release/1.1.0` |
| kcal-web 081fd4b | md.3 | panel seçenek görseli alanı + önizleme + testler, migration kopyası (dal `panel/secenek-gorsel`) |

## KARAR
- Yumurta eşlemesi: tablodaki "% Yumurta (2–5 Yumurta)" → `^[0-9].* Yumurta$` (rakamla başlayıp " Yumurta" ile biten ad) + tam "Yumurta". "Yumurta akı" gibi adlar EŞLEŞMEZ. Canlı adlar okunamadı (Supabase MCP okuma izni reddedildi); gramaj adlarının biçimi repodaki örnekten ("Izgara Tavuk Bonfile 150g") alındı.
- Gramaj türü hem tam adı hem `Ad %`'yi kapsar; diğerleri yalnız tam ad (btrim, büyük/küçük harf duyarlı). Eşleşme önceliği: tam ad önce, sonra uzun ad.
- Çıkartmalar Supabase render (dönüştürme) uç noktasından geçirilmez — 512 px WebP olduğu gibi (render `resize=cover` kırpabilirdi). Fotoğraflar eski ön ayarla.
- Ada göre ürün görseli yedeği korunuyor (bağlı ürün görselinden sonra); kendi/bağlı görseli olan seçenekler için ada göre sorgu yapılmıyor.
- Eski `ProductDetailScreen` (yeni_siparis bayrağı kapalıyken) seçenek görseli göstermiyor; DOKUNULMADI.
- Panel: görsel ayrı kolon yazımıyla anında kaydedilir (kategori görseliyle aynı desen); yeni seçenekte önce kayıt gerekir. Migration kcal-web `supabase/migrations`'a BİREBİR kopyalandı (panel şema kolon testi yazılan kolonu migration'dan doğruluyor); aynı sürüm, idempotent. `tests/unit/p-s8.test.ts` P-S8 migration listesi kendi aralığına (20261111220000–230000) sınırlandı.
- Panel `next build` koşulmadı (disk ~12 GB boş); tsc + eslint + playwright unit yeterli sayıldı.

## HIG (kod denetimi)
- Kart boyutu/dokunma alanı değişmedi (136×166 ≥ 44 pt). Görsel VoiceOver'da gizli; kart etiketi ad + fiyat + kcal (değişmedi). Dynamic Type: ad metni değişmedi. Kontrast: şeffaf çıkartma beyaz kenarlı → koyu yüzeyde (#1C1C1E) ve lime'da okunur. Hareket: expo-image `transition 200` (mevcut bileşen); azaltılmış hareket için ek animasyon eklenmedi.

## CANLIYA UYGULANACAK
1. İlter: 58 WebP'yi Storage `images` kovası `options/` klasörüne yükle (`<kod>.webp`).
2. `supabase db push` ile `20261112120100_g35_option_images.sql` (kcal-mobile veya kcal-web'den TEK kez). Rollback: `supabase/rollbacks/20261112120100_g35_option_images_rollback.sql`.
3. Kontrol: migration dosyasının sonundaki üç okuma sorgusu (eşleşmeyen, bağlı ürünü de olmayan seçenekleri listeler).

## DEPLOY GEREKİR
- Mobil: OTA (yalnız JS/TS) — onaysız YAPILMADI.
- Panel: `panel/secenek-gorsel` → `panel/canli-1.1.0` birleştirme + Vercel — YAPILMADI.

## SORULAR
- Canlı seçenek adlarında tablo dışında kalanlar var mı (ör. "Haşlanmış Yumurta", farklı gramaj biçimi "150 gr")? Migration sonrası kontrol sorgusu ile bakılmalı; eşleşmeyenler panelden elle eklenebilir.
- "Yumurta" (tam ad) da yumurta çıkartmasını alıyor — istenmiyorsa haritadan çıkarılabilir.
