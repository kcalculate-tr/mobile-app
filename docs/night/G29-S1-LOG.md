# G29-S1 — Çıkartma (subject lift) 1.1.0 · G28 SORULAR kararları · kontroller · 11 Kas 2026

Dal `release/1.1.0` (worktree `.claude/worktrees/g23-s1`, G28-S1-DONE üstüne). Tasarım: `FinMoSticker.webp` + `FinMoSticker.dc.html` (zamanlama/eğri buradan ölçüldü), FinMoLogA (uçuş).
Yeni bağımlılık YALNIZ Android `com.google.android.gms:play-services-mlkit-subject-segmentation:16.0.0-beta1` (yerel modülün gradle'ı; İlter onayı 11 Kas). npm paketi yok. Deploy yok, canlı DB yazma yok, migration yalnız DOSYA.

## ÖZET
1. **Yerel Expo modülü `modules/subject-lift`** (repo içi, autolinking `./modules` — iOS ve Android'de çözüldüğü doğrulandı). iOS 17+ Vision `VNGenerateForegroundInstanceMaskRequest` → tam çözünürlüklü maske → kutu → şeffaf zemin → kırpma → ≤ 512 px WebP (SDWebImageWebPCoder zaten derlemede; yoksa PNG). Android ML Kit Subject Segmentation → ön plan bitmap → kırpma → ≤ 512 px WEBP_LOSSY. Tamamen cihazda.
2. **Yedek yollar (hepsi sessiz, akış beklemez)**: native yok (eski derleme/OTA) · iOS 17 altı · modül "yok" · hata (Android modeli inmemiş dahil) · 1,5 sn aşımı · geçersiz sonuç → normal fotoğraf. Çıkartma analizle PARALEL başlar; Logla çıkartma yüklemesini beklemez.
3. **Kayıt**: `user-media/<uid>/stickers/<kayıt id>.webp` + `meal_consumptions.sticker_path` — migration DOSYASI `20261111233100_g29_sticker_path` + rollback + sahiplik CHECK. PGlite 13/13. Sütun yokken istemci bozulmaz (yüklenen dosya geri silinir, oturumda tekrar denenmez; liste sorguları sticker_path seçmez).
4. **Tara sonucu kalkış** (FinMoSticker): 400 ms'de çıkartma fotoğrafın üstüne birebir oturur (cover kutusu), karartma 0,55 (base 300 standard), kalkış −8 / 1,04 AI yayı + gölge, ~780 ms haptik light, eşleşme hapı 800 ms (base 300 enter). Azaltılmış: kalkış yok, 200 ms opaklık.
5. **Ana sayfa / Gün öğün satırı**: çıkartma (şeffaf, contain) → fotoğraf → ürün görseli → kase cam nesnesi. Az önce loglanan kayıt yerel çıkartmayı ağsız gösterir.
6. **Logla izi**: uçan görsel çıkartma (kırpılmaz/yuvarlanmaz, contain), çıkartmanın ekran konumundan başlar; yoksa G28 gibi tabak fotoğrafı.
7. **`app.config` eklentisi** `./modules/subject-lift/app.plugin.js`: ML Kit meta-data `subject_segment`, expo-camera'nın `barcode_ui` değeriyle birleştirilip `tools:replace` ile yazılır (aksi halde manifest birleştirme ÇAKIŞMASI — bulundu, önlendi). iOS dağıtım hedefi 15.1 korunur; iOS 17 altı çalışma anında kapalı.
8. **md.2**: Profil › Destek'e "Destek ve SSS" web bağlantısı (`/destek`, EN `/en/support` — ikisinin de gerçek sayfa olduğu başlıktan doğrulandı); EN hesap silme `/account-deletion` (TR ile aynı) teyit + test. (2) ve (4) değişiklik yok.
9. **Kontroller**: tsc 0 · hygiene OK · unit 1144/0 (1 atlanan) · jest 486/486 (86 dosya) · expo export iOS (3247 modül) + Android (3254) OK · prebuild Android manifest OK · HIG denetimi (düzeltme gerekmedi).
10. **Native derleme burada yapılamadı**: Swift kodu iOS 26.5 SDK'ya karşı `swiftc -typecheck` (hedef iOS 15.1, ExpoModulesCore taklidiyle) TEMİZ; Kotlin derlenemedi (Android SDK/kotlinc yok) — EAS derlemesinde doğrulanacak.

## Commit tablosu
| Madde | Commit | Özet |
|---|---|---|
| 2 | `b6604e0` | Destek ekranı web "Destek ve SSS" bağlantısı (rol link, ≥ 56 pt, VoiceOver etiketi), TR/EN metin, legalUrls testi |
| 1 | `765d6ec` | `modules/subject-lift` (Swift + Kotlin + podspec + gradle + config eklentisi), `lib/sticker` (liftSticker, stickerStore, saveSticker), StickerLift, FinPhotoResult/ScanScreen bağlantısı, MealThumb, LogTraceHost cutout, migration + rollback + PGlite kontrolü, testler |
| 3 | (bu commit) | LOG; ardından `G29-S1-DONE` |

## KARAR
1. **Depolama yolu `<uid>/stickers/<id>.webp`** (görevde `stickers/<user>/<id>.webp`). Kovanın sahiplik politikası ilk klasörün `auth.uid()` olmasını istiyor ve hesap silme (`delete-account`) `<uid>/` önekini temizliyor. Görevdeki yol için hem yeni storage politikası hem edge function değişikliği (DEPLOY) gerekirdi; aksi halde çıkartmalar hesap silmede KALIRDI (KVKK). Aynı anlam (kullanıcı başına çıkartma klasörü), sıfır sunucu değişikliği. SORULAR 1.
2. **`<id>` = `meal_consumptions.id`**; yükleme Logla'dan SONRA arka planda (Logla'yı geciktirmez; loglanmayan sonuç için kovada artık dosya kalmaz).
3. **Liste sorguları `sticker_path` seçmiyor**: migration canlıda yokken `CONSUMED_SELECT` / `todayConsumptions` 42703 ile bütün Ana sayfayı düşürürdü. Satır çıkartması ayrı, toplu (kare başına tek `in(id)` sorgusu), önbellekli okuma; yalnız fotoğraflı (Tara) kayıtlarda sorulur.
4. **Bayrak yok**: bayrak varsayılanları `false` ve canlı satır ister (canlı DB yazma yasak). Kapı = native modülün varlığı (yeni derleme) + iOS 17 + Android model durumu. Acil kapatma gerekirse: SORULAR 3.
5. **Kalkış yalnız kompakt (tek tabak, T18F1) sonuçta** — pano "Birleşen T18F1"; çok öğeli sonuçta (FinPhotoR1) kalkış yok, Logla izi yine çıkartmayla uçar (çıkartma hazırsa).
6. **Haptik**: sonuçta mevcut `success` (FinMoScan) + kalkışta pano `light` (playing-haptics.md › Impact: "a tap when a view snaps into place"). Azaltılmış harekette de light (hareket değil).
7. **Satırda çıkartma gelirken** hazır fotoğraf (yerel/önbellek) beklemeden çizilir, çıkartma gelince değişir (G28 "aynı kare, ağ beklemez" korunur).
8. **iOS WebP** SDWebImageWebPCoder ile (expo-image-manipulator bağımlılığı olarak zaten derlemede; yeni pod indirilmez); `canImport` yoksa PNG yedeği (`.png`, `image/png`; CHECK ikisini de kabul eder).
9. **Android meta-data**: `barcode_ui,subject_segment` + `tools:replace="android:value"` — expo-camera ve expo-dev-launcher aynı anahtarı `barcode_ui` ile yazıyor.
10. **Ölçüm olayı eklenmedi** (olay sözlüğü beyaz listesi + sunucu tablosu); teşhis yalnız cihaz içi `stickerStats()` / dev konsolu.
11. Geri alınan (silinip yeniden eklenen) kayıt yeni id alır → çıkartması gider, fotoğraf kalır (undo yeniden yazımı sticker_path'i taşımaz; migration yokken insert'i bozmamak için).
12. Çevrimdışı kuyruk / öksüz sonuçtan dönen kayıtlarda çıkartma üretilmez (ön planda foto yok/kayıt kuyrukta).

## HIG (apple-design-skill, kod denetimi)
- motion.md › "Make motion optional": azaltılmış harekette kalkış yok, çıkartma + karartma 200 ms opaklık; bilgi hareketle taşınmıyor (sonuç metni/hap aynı). › "Let people cancel motion": katman `pointerEvents=none`, Logla/kapat kalkış sırasında kullanılabilir. › brevity: tek sefer, ~500 ms.
- playing-haptics.md › "Use haptics consistently" / Impact: light yalnız kalkışta, görsel "oturma" ile eş zamanlı; tekrar etmez.
- voiceover.md › "Exclude purely decorative images": kalkış katmanı `accessible={false}` + `no-hide-descendants`; satır görseli zaten dekoratif (satır etiketi ad/kaynak/saat/kcal okur); uçuş dekoratif.
- Kontrast: karartma fotoğrafın üstünde, hap/kapat düğmesi karartmanın ÜSTÜNDE (etkilenmez). Destek satırı alt metni #6B6B70 / #FFFFFF ≈ 5,3:1, koyu #A1A1A6 / #1C1C1E ≈ 6,9:1 (≥ 4,5:1).
- Destek bağlantısı: rol `link`, ≥ 56 pt yükseklik, metin sarar (Dynamic Type), dış bağlantı ikonu, VoiceOver etiketi "…legal.eatkcal.com sitesinde aç".
- Düzeltme gerektiren bulgu yok. Not (Low): koyu modda koyu renkli çıkartma 44 pt satırda kenar tanımını kaybedebilir — cihazda bakılacak.

## CANLIYA UYGULANACAK
- `supabase/migrations/20261111233100_g29_sticker_path.sql` (rollback `supabase/rollbacks/20261111233100_g29_sticker_path_rollback.sql`). Yalnız sütun + CHECK; storage politikası DEĞİŞMEZ. Uygulanana kadar istemci çıkartmayı yazmaz/okumaz (fotoğraf gösterilir).
- Kontrol: `PGLITE_DIR=<pglite node_modules üstü> node supabase/tests/g29_s1.check.mjs` → 13/13.

## DEPLOY GEREKİR
- **Yeni native derleme** (iOS + Android): yerel modül + ML Kit gradle bağımlılığı + manifest meta-data. OTA ile gelen JS eski derlemede modülü bulamaz → normal fotoğraf (çökme yok, test: `no_native`).
- EAS derlemesinde doğrulanacak: Kotlin derlemesi (burada Android araç zinciri yok), Swift tam derleme (tip denetimi temiz), `pod install` (podspec `pod ipc spec` ile geçerli).
- Edge function / storage değişikliği YOK.

## Cihaz test listesi
1. iPhone iOS 17+/18: Tara → tek tabak → sonuçta 400 ms'de çıkartma fotoğrafla tam örtüşür (kayma ≤ 4 pt), karartma, kalkış + gölge, ~780 ms hafif titreşim, hap 800 ms'de. Konsolda `[sticker] ok … ms` (dev).
2. Aynısı Ayarlar › Erişilebilirlik › Hareketi Azalt açıkken: kalkış yok, yalnız solma; titreşim var.
3. iOS 16 cihaz (varsa): çıkartma yok, normal fotoğraf; hiçbir gecikme yok.
4. Logla: uçan görsel çıkartma (kare çerçeve/yuvarlak köşe yok), Ana sayfa satırında çıkartma; uygulamayı kapat-aç → satır yine çıkartma (migration uygulandıysa; değilse fotoğraf).
5. Geri al (uçuş sırasında ve sonrasında): kayıt silinir, satır kalkar; tekrar Logla çalışır.
6. Android (Play hizmetleri güncel): ilk kurulumda model iner → çıkartma; uçak modunda ilk açılışta model yoksa → normal fotoğraf, hata/gecikme yok.
7. Android Go / Play hizmetsiz cihaz: normal fotoğraf.
8. Arka planı karmaşık / tabaksız fotoğraf (manzara): çıkartma yok ya da makul; 1,5 sn'yi aşan büyük fotoğrafta normal fotoğraf.
9. Migration uygulanmadan: Ana sayfa listesi açılır (hata yok), satır fotoğraf; Storage'da `<uid>/stickers/` altında artık dosya kalmaz.
10. Migration uygulandıktan sonra: `meal_consumptions.sticker_path` dolu, imzalı URL ile satırda görünür; başka kullanıcı yolu yazılamaz (CHECK).
11. Koyu mod: satırda koyu çıkartma okunuyor mu (HIG Low notu).
12. Hesap silme: `user-media/<uid>/stickers/` de silinir (öneki `<uid>/`).
13. Profil › Destek › "Destek ve SSS" TR'de `/destek`, EN'de `/en/support` açılır; VoiceOver bağlantı olarak okur.

## SORULAR
1. Depolama yolu `<uid>/stickers/<id>.webp` olarak uygulandı (KARAR 1: mevcut RLS + hesap silme kapsıyor, deploy gerekmiyor). Görevdeki `stickers/<user>/<id>.webp` şart mı? Şartsa yeni storage politikası + `delete-account` öneki + deploy gerekir.
2. Migration canlıya ne zaman uygulansın? Uygulanmadan çıkartma yalnız o oturumda (yerel) görünür.
3. Uzaktan kapatma anahtarı istenir mi (ör. `cikartma` bayrağı, sunucu satırı AÇIK)? Şu an kapı yalnız native modül + iOS 17 + Android model.
4. Çok öğeli sonuçta (FinPhotoR1) da kalkış hareketi istenir mi? Pano yalnız T18F1'i gösteriyor.
