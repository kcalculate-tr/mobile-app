# G32-S1 — eatkcal (yeni sipariş) arayüz düzeltmeleri — LOG (12 Kas 2026)

Dal `release/1.1.0` · worktree `.claude/worktrees/g23-s1` · yalnız JS/TS (native yok → OTA) · yeni paket yok · deploy/OTA yok.

## ÖZET
1. md.1 Mağaza kartı: görsel 150 / alt bant ~50 → **~%75 / %25** (önce 92 / ~80 ≈ %53). Ad tek satır; puan tek yıldız + süre aynı satır, sığmazsa iki kısa satır (kırpma yok).
2. md.2 Mağaza yapışkan çubuğu: ScrollView stickyHeader kalktı → ayrı **opak başlık** (tema zemini, Dark dahil), safe area ALTINDAN başlar; [geri · küçük mağaza adı] + yatay kayan çipler tek blok; seçili çip görünür alana kayar; yapışıkken yüzen geri kalkar, dikişsiz geçiş.
3. md.3 Ürün sayfası: üstte safe area kadar **düz, boş, opak bant**; görsel + ScrollView bandın altından başlar (kaydırınca bant yerinde; Android edge-to-edge'de insets aynı). Geri görselin üst-solunda (top 8). İskelet de bant altında.
4. md.4 Gel-Al: seçilince şube bölümü **kendiliğinden açılır**; iki şube **yan yana kart** (cephe görseli / cam kase, ad, semt, Açık/Kapalı, uzaklık, "En yakın"); seçili lime çerçeve + tik; seçilmeden **Öde pasif + "Şube seç"**; Eve teslime dönünce Adres bölümü geri gelir.
5. md.5 Randevulu saat: 3 aralık **tek satır, eşit genişlik**, kaydırma yok; iki satır "09:30" / "13:30" (15/13 pt); dolu aralık soluk + "21:30 · Dolu".
6. md.6 Kontroller: hygiene + tsc ✅ · unit 1157/1157 ✅ · jest 94 suite / 518 test ✅ · `expo export` iOS ✅ Android ✅.
7. Ekran görüntüsü: Playwright/web kurulu değil → **bileşen testleri** (Light + Dark + EN): `g32Ui`, `g32Store`, `g32Product`, `g32Checkout`, `g32ThemeLang` + birim `branchCard.test.ts`.
8. Yeni dosyalar: `ui/store/StoreHeader.tsx`, `ui/checkout/BranchCards.tsx`, `model/branchCard.ts`.
9. i18n: `branch_pick`, `branch_open`, `branch_nearest` TR+EN (`core/i18n/dictionaries.ts`; `v2/i18n/cart.ts` aynası).
10. OTA (İlter yayınlar): `eas update --branch production --environment production --message "G32"`

## Commit tablosu
| Commit | Madde | Özet |
|---|---|---|
| dea98fb | md.1 | Mağaza kartı %75/%25, tek yıldız puan + süre |
| 73d8890 | md.2 | Mağaza opak yapışkan başlık (safe area altı, geri + ad + çipler) |
| 76e3286 | md.3 | Ürün sayfası düz opak safe area bandı |
| 5ded503 | md.4 | Gel-Al şube kartları, Öde pasif + "Şube seç" |
| e7a1764 | md.5 | Saat çipleri tek satır, iki satır metin, "Dolu" |
| a6ea081 | md.6 | navRule: StoreHeader PUSH listesine |
| ecded2f | md.6 | Light + Dark + EN bileşen kanıtı |
| (son) | — | `docs/night/G32-S1-LOG.md` + `docs/night/G32-S1-DONE` |

## KARAR
- md.1: toplam kart yüksekliği ~172 → ~201 (görsel 150). Aynı yükseklikte %75 için ad 13–14 pt'ye inmek gerekiyordu; okunurluk için yükseklik biraz arttı (madde "aynı kalabilir" diyor, zorunlu değil). Puan satırı `EkRatingLine mini` (tek yıldız + sayı) — 5 yıldız + süre 212 pt'ye sığmıyordu.
- md.2: yapışkan başlık yüksekliği = insets.top + 48 (geri/ad) + 60 (çipler). Kapak (hero) üstte tam taşmaya devam eder — yalnız yapışan çubuk düzeltildi.
- md.4: **otomatik en yakın şube seçimi kaldırıldı** ("seçim yapılmadan Öde pasif" ile çelişiyordu); konum izni varsa en yakın karta yalnız "En yakın" etiketi. `branch_auto` metni artık kullanılmıyor (silinmedi).
- md.4: `branches` tablosunda görsel/semt/çalışma saati alanı YOK → görsel `lib/branchBanner` yerel cephe fotoğrafı (slug), yoksa `assets/glass/bowl.png`; semt adres metninden ("Mansuroğlu Mah. … Bayraklı İzmir" → "Mansuroğlu, Bayraklı"); Açık/Kapalı ortak işletme saatinden (`shopOpenNow`, kurallar yüklenmeden gizli). Migration yazılmadı.
- md.4: akordeon tek bölüm açık tutar; Gel-Al seçilince "Yöntem ve zaman" kapanıp "Şube" açılır (Gel-Al'da zaman seçimi yok).
- md.5: 3. dilim (`EK_TIME_SLOTS` 17:30–21:30) kodda statik `disabled: true` — mevcut davranış, dokunulmadı.

## HIG denetimi (kod)
Dokunma: geri 44, şube kartı ≥ 150, saat çipi 56 yükseklik, kategori çipi 44 ✅ · VoiceOver: şube kartı radio + birleşik etiket (ad, semt, durum, uzaklık), saat çipi "…, Dolu" ✅ · en küçük metin 13 (mevcut "Yeni" rozeti 12 — önceden vardı) · renkler yalnız tema rolü ✅ · Dynamic Type: mağaza alt bandı sarabilir (kırpma yok); şube adı 2 satır.

## CANLIYA UYGULANACAK
- Yok (DB/migration/edge function değişikliği yok).

## DEPLOY GEREKİR
- Yalnız OTA (native değişiklik yok): `eas update --branch production --environment production --message "G32"` — İlter yayınlar.

## SORULAR
1. Şube görseli: yeni şube açılınca `src/assets/branches/<slug>.jpg` + `lib/branchBanner.ts` satırı gerekir (OTA ile gider). `branches.image_url` alanı istenir mi? (migration)
2. Şube başına çalışma saati yok; Açık/Kapalı tüm şubeler için ortak saatten. Şubeye özel saat gerekirse şema değişikliği gerekir.
3. md.1 kart yüksekliği ~201 kabul mü, yoksa ~172'de tutup ad puntosu küçülsün mü?
4. Ekran görüntüsü kanıtı bileşen testiyle verildi; simülatör görüntüsü istenirse G33'te alınabilir.
