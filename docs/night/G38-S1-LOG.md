# G38-S1 — eatkcal son rötuşlar (12 Kas)

Dal `release/1.1.0` · worktree `.claude/worktrees/g23-s1` · JS/TS (OTA) + veri değişikliği yalnız migration DOSYASI (+ rollback) · yeni paket yok · deploy/OTA/canlı DB yazma yok · canlı DB yalnız salt-okunur sorgu.

## ÖZET
1. **md.1 seçenek kartı 2 satır**: `OptionCard` adı `numberOfLines={2}`, `ellipsizeMode="tail"` (son çare), `maxFontSizeMultiplier` 1,4. Ad SABİT yükseklikte bir kutuda: 2 satır × 19 pt × min(fontScale, 1,4). Böylece 1 satırlık ad ile 2 satırlık ad aynı kart yüksekliğini veriyor (aynı sıradaki kartlar eşit, gruptan gruba zıplamıyor). Kart 136×166 korundu. Kırpılmaması için önce veri tarafında kısa ad var (md.2).
2. **md.2 ad sadeleştirme**: 6 detoks ürününden "(330ml)" kaldırıldı. Ürün adları kısaltılmadı. Seçenek adlarında 31 ad / 200 satır güncellendi: parantez kaldırıldı, 2 satıra sığmayanlara kısa ad verildi. Kısa adlar GERÇEK font ölçüsüyle seçildi (PlusJakartaSans SemiBold 15 pt, metin alanı 117 pt, 112 pt güvenlik payı). Hepsi ≤ 26 karakter ve ≤ 2 satır. Migration id ile çalışıyor ve eski adla korumalı. id listesi canlıyla md5 karşılaştırmasıyla doğrulandı (31 ad / 200 satır eşleşti). Adisyo listesi `docs/night/G38-ADISYO-AD-LISTESI.md`.
3. **md.3 soslar**: Acı Sweet Chili, Ranch, Ballı Hardal, Remoulade ve Chipotle "Sos" adıyla, "(50cc)" olmadan, 40 TL, kcalculate / "Soslar" olarak eklendi. Görsel `images/options/sos-*.webp` (Remoulade görselsiz). Kalori/makro Tera "Ekstra Sos" değerlerinden alındı (Remoulade boş). Ürünler **gizli** ekleniyor. Adisyo eşlemesinden sonra elle çalıştırılacak açma dosyası yalnız eşlenen sosları ve kategoriyi açıyor (bkz. KARAR 1).
4. **md.4 parantezsiz sayı/fiyat**: Yeni ortak `CountPill` rozeti eklendi.
   - "Sepet (N)" → "Sepet" + sayı hapı: eatkcal yüzen sepet çubuğu ve kabuk sepet hapı.
   - "Sepete ekle (285 TL)" → etiket + 10 pt boşluk + ayrı ExtraBold fiyat: ürün düğmesi ve plan sepeti.
   - "Siparişe devam (…)" → etiket + ayrı fiyat.
   - Rozete dönen sayaçlar: "Alındı (N)", alışveriş kategori başlıkları, "Yorumlar (N)", kupon/kampanya başlıkları.
   - Düz metne dönenler: gün görüntüleyici sayacı, OTP geri sayımı, sesli/foto çevrimdışı notları, eşleşme hapı, doğum yılı/yaş.
   - VoiceOver etiketleri virgüllü düz metin ("Sepet, 2 ürün", "Sepete ekle, 285 TL"). TR + EN.
5. **md.5 gramaj görseli**: Kök neden: kcalculate ürünlerinde gramaj (200/300/350 g) `products.gramaj_options` jsonb'de tutuluyor ve ekran bu grubu `imageUrl: null` ile kuruyordu. Bu yüzden görsel hiç yoktu. Şimdi kart sırasıyla şunlardan birini gösteriyor:
   - jsonb'deki `image_url`,
   - ürün adından G35 protein/şarküteri çıkartması (tavuk fileto → `protein-tavuk-bonfile`, sote → `protein-tavuk-sote`, köfte → `protein-izgara-kofte` …),
   - ürün fotoğrafı,
   - boş hâl.

   Tera / Breaking Fast gramaj grupları (Tavuk, Köfte, Ton Balığı, Dana Fajita, Falafel, Yumurta …) canlıda zaten `image_url` taşıyor (G35 uygulanmış). Bileşen bunları zaten gösteriyordu, değişiklik gerekmedi.
6. **md.6 kontroller**:

   | Kontrol | Sonuç |
   |---|---|
   | hygiene + tsc | ✓ |
   | unit | 1275/1275 ✓ (+ yeni `g38Names` 13) |
   | jest | 102 suite / 602 test ✓ (+ yeni `g38Product` 8; 5 eski test yeni metne göre güncellendi) |
   | `expo export` | iOS ✓ · Android ✓ |
   | eslint (değişen dosyalar) | yeni hata yok |

   `OffersAndCouponsScreen.tsx:143`'teki 2 `no-unescaped-entities` hatası önceden vardı; satır yalnız kaydı.

## Commit tablosu
| Commit | Konu |
|---|---|
| f6b6434 | md.2 + md.3 migration dosyaları (+ rollback, manuel açma + rollback) ve Adisyo ad listesi |
| 068313d | md.1 kart 2 satır, md.4 rozet / ayrı fiyat, md.5 gramaj görseli; birim + bileşen testleri |
| (bu) | docs: G38-S1 LOG |
| (son) | docs/night/G38-S1-DONE |

## Testler (md.6)
- `src/modules/eatkcal/v2/__tests__/g38Names.test.ts` (tsx --test):
  - Migration: tam 37 update, hepsi `id` koşullu ve eski ad korumalı. id'ler tekil, 200 satır.
  - Rollback birebir ters.
  - Yeni adlarda hacim parantezi yok. Ürün adları yalnız parantezden arınıyor.
  - **Gerçek TTF ölçümüyle** (cmap + hmtx okuyucu) her seçenek adı ≤ 2 satır; kısalan eski adlar 3+ satırdı.
  - Seriler ayırt ediliyor (Protein / Dengeli / Bowl); soya alerjeni korunuyor.
  - Adisyo belgesi; sos migration'ı (gizli, 40 TL, "(50cc)" yok, idempotent, kategori yok); açma dosyası `migrations/` dışında ve eşleme koşullu.
  - Sözlüklerde "(%{…})" sayı/fiyat kalıbı yok (TR + EN). `cart_n` kaldırıldı.
  - `gramajStickerCode` / `gramajImageCandidates` / jsonb `image_url`.
- `src/modules/eatkcal/v2/__component_tests__/g38Product.test.tsx`:
  - Ad `numberOfLines` 2 + üç nokta + 1,4 sınırı.
  - Kısa / uzun / tek kelimelik adlı üç kart aynı ad kutusu yüksekliği ve aynı kart ölçüsü.
  - `optionNameBlockHeight` ölçek davranışı; VoiceOver etiketi tam ad.
  - `CountPill`: 99+, VoiceOver'dan gizli, ≥ 22 pt.
  - Sepete ekle (light + dark): etiket ve fiyat ayrı düğümler, fiyat ExtraBold, gap 10, hiçbir metinde parantez veya nokta ayracı yok, etiket "Sepete ekle, 285 TL".
  - EkProductScreen gramaj: 3 kartın üçünde de protein çıkartması (contain). Yüklenemezse ürün fotoğrafına (cover) düşüyor, seçim çalışıyor.
- Güncellenen eski testler: g18Layers (Sepet + rozet, ayrı fiyat), TabBarR3 (Sepet hapı), g33PlanScreens (Alındı rozeti, sepet fiyatı), g22Voice, FinPhotoResult.

## KARAR
1. **Soslar gizli eklendi.** `adisyo-save-order`, Adisyo productUnitId'si olmayan ürün içeren siparişi BÜTÜNÜYLE reddediyor (`unmapped_products`). Sos eklenmiş bir sipariş mutfağa hiç inmezdi.
   - Sosların Adisyo kodu canlı veride bulunamadı: `adisyo_orders` ve ürün tablolarında yok, repoda Adisyo katalog dökümü yok. Sipariş günlüğü (`adisyo_api_log` istek gövdesi) kişisel veri içerdiği için okunmadı.
   - Açma işlemi `supabase/migrations-manual/20261112T1403_g38_soslar_ac.sql` dosyasında (db push ile çalışmaz). Yalnız merkez eşlemesi (`adisyo_product_unit_id`) VE Bayraklı şube eşlemesi (`branch_product_adisyo`) olan sosları açar.
   - "Soslar" kategorisi de bu dosyada ekleniyor (sıra 55). Ana sayfa tüm kategorileri döşeme olarak gösterdiği için ürünsüz boş bir döşeme çıkmasın istendi.
2. **Ürün adları kısaltılmadı, yalnız seçenek adları kısaldı.** Kısa ad hedefi seçenek kartı. Ürün listesi ve ürün sayfası tam adı gösteriyor. Adisyo eşleşmesi yalnız ürünlerde, seçenekler Adisyo'ya fiş notu olarak gidiyor. Böylece Adisyo'da yalnız 6 ürün adı değişiyor.
3. **Seri adları** aynı gruptaki benzer öğünleri ayırt etmek için kategori diliyle kuruldu:
   - Yüksek Protein → "Protein …"
   - Dengeli ve Sağlıklı → "Dengeli …"
   - Yağ Yakımı (brokoli tabanlı) → "… Bowl"

   Detokslarda renk / tat adı korundu ("Turuncu Metabolizma", "Kırmızı Antioksidan"). Shake'lerde tat + "Shake" ("Fıstık Ezmeli Shake"). Alerjen kelimeleri korundu: "Soya Soslu Sote …". Mortadella'da "Fıstıklı" grup başlığında kalıyor ("Fıstıklı Mortadella Salam Seçimi").
4. **Grup içi tutarlılık**: "Dana Roastbeef 100g" 3 satırdı. Aynı gruptaki 50g ve 80g da "Roastbeef …" yapıldı. "Protein Shake Kakao Muzlu" 2 satıra sığdığı için olduğu gibi kaldı (görev: yalnız sığmayanlar).
5. **Sos makroları** Tera "Ekstra Sos" grubundan alındı (Breaking Fast "Sos & Ezme" değerleri daha düşük, muhtemelen daha küçük porsiyon). "Acı Sweet Chili" için "Sweet Chili Sos" değeri kullanıldı.
6. **md.4 kapsamı**: Yalnız SAYI / FİYAT içeren parantezler kaldırıldı. Kalanlar:
   - İçeriği metin olan parantezler: "Hemen (Kapalı)", "(Yakında)", "No. 12 (İlk kez)", "Kupon (KOD)", birim "(g)".
   - Koç'a giden soru cümleleri.
   - Abonelik dipnotundaki tarih.
   - Formül gruplama parantezi.
   - Paylaşım metnindeki hafta aralığı.
   - Destek e-postası eki sayacı.
   - Geliştirici ekranları.

   Kullanılmayan `checkout.place` / `complete` / `kesfet.detail.replies` metinleri de parantezsiz yazıldı.
7. Kabuk sepet hapına `hitSlop={4}` eklendi (görsel 40 pt → dokunma 48 pt).

## HIG (kod denetimi, apple-design-skill)
- Dokunma alanları: sepete ekle 52 pt ✓ · sepet çubuğu 56 pt ✓ · kabuk sepet hapı 40 + hitSlop 4 = 48 pt ✓ (`accessibility.md`: iOS 44×44 varsayılan). Rozet etkileşimsiz.
- VoiceOver: rozet gizli, sayı ebeveynin etiketinde. Başlık + rozet tek erişilebilir "header" öğesi ("Alındı, 3 ürün", "Yorumlar, 12"). Seçenek kartı etiketi tam adı okuyor.
- Kontrast (hex):
  - sepet çubuğu rozeti #C6F04F / koyu ≈ 15:1
  - yorum rozeti açık temada mürekkep / #C3C7CC ≈ 11:1, koyu temada beyaz / #48484A ≈ 8:1
  - plan rozeti mürekkep / çizgi rengi yüksek

  Hepsi ≥ 4,5:1. Rozet metni 13 pt bold (≥ 11 pt).
- **Ödünleşim (Medium)**: seçenek adı Dynamic Type'ta %140'ta sabitleniyor (grup başlığıyla aynı). `accessibility.md › Support larger text sizes` "ideally … at least 200 percent" diyor. Sabit 136 pt kart buna izin vermiyor. Tam ad VoiceOver etiketinde ve ürün sayfasında. İstenirse büyük metin boyutunda kart genişliği artırılabilir (SORU 4).

## CANLIYA UYGULANACAK
Sıra önemli:
1. `supabase/migrations/20261112140100_g38_urun_adlari.sql` — rollback: `supabase/rollbacks/20261112140100_g38_urun_adlari_rollback.sql`
2. `supabase/migrations/20261112140200_g38_soslar.sql` — rollback: `supabase/rollbacks/20261112140200_g38_soslar_rollback.sql` (soslar GİZLİ eklenir)
3. Adisyo'da 5 sos ürününün adı uygulamadaki adla eşleşmeli (parantez yok sayılır; bkz. Adisyo listesi). Sonra `adisyo-sync-products` merkez kipi, ardından Bayraklı için `{ "branch_id": "921d0a7b-fe2f-47ce-95a9-f7bb5fb16bd0", "dry_run": false }`.
4. ELLE: `supabase/migrations-manual/20261112T1403_g38_soslar_ac.sql` — rollback: `…_soslar_ac_rollback.sql`. Eşlemesi eksik sos kapalı kalır; kontrol sorgusu dosyanın sonunda.

`supabase db push` 1 ve 2'yi uygular. G35 (`20261112120100`) canlıda uygulanmış görünüyor (`image_url` kolonları dolu); G38 ondan sonra geliyor.

## Adisyo listesi
`docs/night/G38-ADISYO-AD-LISTESI.md`:
- Adisyo panelinde güncellenecek 6 ürün adı (KCAL-17 … KCAL-22).
- **Kodsuz mevcut ürün YOK.** 65 ürünün hepsinde `adisyo_product_code` var; ad değişikliği eşleşmeyi koparmaz.
- Yeni 5 sos kodsuz ve ADLA eşleşecek.
- Yalnız uygulamada kısalan 31 seçenek adının tablosu: mutfak fişinde kısa ad görünecek, ekibe haber verilmeli.

## DEPLOY GEREKİR
- OTA (native değişiklik yok, yeni paket yok). İlter yayınlar; production OTA onaysız yasak:
  `eas update --branch production --environment production --message "G38-S1 secenek karti 2 satir, parantezsiz sayi/fiyat, gramaj gorselleri"`
- Uygulama kodu migration'dan bağımsız çalışır: adlar eskiyse kart 2 satırda üç noktayla kırpar, soslar gizliyken görünmez.

## SORULAR
1. Sosların Adisyo'daki tam adı / kodu nedir? Özellikle "Acı Sweet Chili" Adisyo'da "Sweet Chili" olarak geçiyorsa sync ADLA eşleşmez. Adisyo adını "Acı Sweet Chili Sos (50cc)" yapın ya da Adisyo ürün koduna `KCAL-<id>` yazın.
2. Soslar başka markada (Tera / Breaking Fast) da ayrı ürün olarak satılacak mı? Şimdilik yalnız kcalculate.
3. Remoulade için görsel (`images/options/sos-remoulade.webp`) ve 50 cc kalori/makro değeri gerekli. Şimdilik yer tutucu ve boş.
4. Seçenek kartı büyük metin boyutunda (%140 üstü) genişlesin mi? HIG %200 öneriyor; tasarım 136 pt sabit.
5. CLAUDE.md'ye göre backend commit'leri main'e de cherry-pick edilir. Gece kuralı main'e commit'i yasakladığı için `f6b6434` (supabase/ dosyaları) main'e taşınmadı. İlter onaylarsa: `git cherry-pick f6b6434`.
6. Görsel doğrulama simülatörde yapılmadı. Bileşen testi, gerçek font ölçümü ve export ile doğrulandı. OTA sonrası seçenek kartı ve sepet rozeti göz ile kontrol edilmeli.
