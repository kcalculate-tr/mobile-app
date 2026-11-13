# G39-S1 — Logo SVG'leri, koç maskotu, ana sayfa eatkcal alanı (13 Kas)

Dal `release/1.1.0` · worktree `.claude/worktrees/g23-s1` · yalnız JS/TS + asset (OTA uyumlu) · yeni paket yok · deploy / OTA / canlı DB yazma yok (canlı DB hiç sorgulanmadı).

## ÖZET
1. **md.1 BrandLogo**: `assets/brand/{kcal,eatkcal,kcalculate}-logo.svg` kopyalandı. Yol verisi `brandLogoPaths.ts`'e üretildi (SVG transformer yok → `Svg`/`Path`).
   - `<BrandLogo name height color? />`: en-boy viewBox'tan (2,81 · 4,57 · 6,43). Renk varsayılanı tema metni (Light #0A0A0A · Dark #F5F5F5). VoiceOver etiketi marka adı; başlıkta `accessibilityRole="header"` + başlık adı.
   - Eski base64 PNG (`constants/kcalculateLogo.ts`) silindi. İki PDF raporu aynı SVG'yi satır içi `<svg>` olarak basıyor (`brandLogoSvgMarkup`).
2. **md.2**: 13 yerde başlık/logo yazısı logoya döndü (liste aşağıda). Cümle içi, yasal, bildirim ve i18n cümleleri metin kaldı. Sekme çubuğunda yazı yok (G22-S2'den beri yalnız ikon) → değişiklik gerekmedi.
3. **md.3 Paywall**: üstteki "kcalAI" → kcalculate logosu + ayrı "AI" (`KcalAiMark`).
   - "AI" Bricolage Bold. Büyük harf yüksekliği = logo yüksekliği: font cap 660/1000 OS/2'den okundu → fontSize = h / 0,66. Taban çizgisi hizalı, arada h × 0,25 boşluk.
   - Satın alma sonucu hapında da aynı işaret var.
   - Koç slaytı ikonu, "Balance'a yükselt" satırı ve "kcalAI Koç dahil" satırları maskot oldu. Kamera, mikrofon, barkod ve sonsuz ikonları aynı kaldı.
4. **md.4 Koç = maskot**: sohbet başlığı ve mesaj avatarı, boş hâl, tanıtım, geçmiş boş hâli, upsell sheet'i, "Koça sor" (Tara) ve "Bu tarif bana uyar mı?" düğmeleri, plan oluşturmadaki koç öğeleri. Öğün anlamındaki kaseler kaldı (liste aşağıda).
5. **md.5 Koç kartı**: dolgu `palette.brandLime` #B9EF14; metin ve düğme her temada siyah.
   - Maskot sağ kenarda -15°, kart yüksekliğinin %90'ı, kısmen kırpık. Arkasında radyal siyah ışıma (merkez %32 → 0).
   - Süzülme ±6 pt / ±3°, 3,5 sn döngü, ease-in-out sinüs. 3–5 sn'de bir 90 ms göz kırpma.
   - Ekran blur olunca ya da uygulama arka plandayken durur. Azaltılmış harekette statik.
   - Metin, "Koçuna sor", kota ve Balance mantığı aynı.
6. **md.6 Ana sayfa eatkcal**: tek ürün kartı kalktı. Yerine:
   - Başlık: eatkcal logosu + "İzmir'de 30–45 dk" (adres bölgesinin gerçek süresi varsa o).
   - Adres yoksa "Adresini gir…" kartı + "Adres ekle" (→ EkAddressAdd). Adres kaydedilince alan yeniden yüklenir.
   - Kampanya bannerları (yatay) ve en fazla 6 mağaza + "Tümü" (→ eatkcal sekmesi). EkHome bileşenleri (`CampaignCard` / `StoreCard` / `HRow`) ve ortak model (`model/showcase.ts`) yeniden kullanıldı.
   - Hâller: iskelet · "Şu an açık restoran yok" · sessiz hata (alan gizli). Ana sayfa bu veriyi beklemiyor.
7. **md.7 Dil**: cihazın birincil dili Türkçe → TR, diğer HER dil → EN (`pickDeviceLang`). Önceden desteklenmeyen diller TR'ye düşüyordu (düzeltildi). EN sözlüğünde Türkçe kalan anahtar yok. Teslim süresi birimi "dk" EN'de "min" oldu.
8. **md.8 Kontroller**:

   | Kontrol | Sonuç |
   |---|---|
   | hygiene + tsc | ✓ |
   | unit | 1276/1276 ✓ |
   | jest | 106 suite / 638 test ✓ (yeni 3 dosya, 30 test) |
   | `expo export` iOS / Android | ✓ / ✓ (son hâl, 2 kez) |
   | eslint (değişen dosyalar) | yeni hata yok |

   Simülatör görüntüleri: 8 sahne × Light/Dark = 16 (`docs/night/g39/`).

## Commit'ler
| Commit | Konu |
|---|---|
| b6b67b6 | md.1–5: BrandLogo, logoya çevrilen başlıklar, paywall işareti, maskot, koç kartı |
| d20390a | md.6 eatkcal vitrini + ortak showcase modeli + EN süre birimi; md.8 bileşen testleri; G39 vitrin sahneleri |
| 551dafe | md.7 cihaz dili kuralı + test tipleri |
| 3ecd229 | vitrin sağlayıcısı senkron hata atarsa da sessiz hata (TrackerScreen flagOn testleri) |
| 9a4314f | koç kartı düzeni (kota satırı metin sütununda, düğme solda), vitrin demo fiyat/limit, ekran görüntüleri |
| (bu) | docs: G39-S1 LOG |
| (son) | docs/night/G39-S1-DONE |

## Logoya çevrilen yerler (md.1–md.3)
| Dosya:satır | Önce → Sonra |
|---|---|
| `src/modules/kesfet/ui/KesfetScreen.tsx:117` | "Keşfet/Discover" başlığı → kcal. logosu, 26 pt (VoiceOver "Keşfet", header). Sağdaki ikonlar aynı |
| `src/modules/eatkcal/v2/screens/EkHomeScreen.tsx:308` | eatkcal sekmesi üst başlığı "eatkcal" → eatkcal logosu, 24 pt (header) |
| `src/modules/gun/home/HomeRegion.tsx:59` | Ana sayfa eatkcal başlığı → eatkcal logosu, 20 pt |
| `src/modules/profil/ui/screens/FinPrProfileScreen.tsx:324` | Profil bölüm başlığı "eatkcal" → logo, 13 pt, ikincil renk (header) |
| `src/modules/subscription/screens/PaywallScreen.tsx:246` | "kcalAI" → kcalculate logosu + "AI" (16 pt) |
| `src/modules/subscription/ui/SubResult.tsx:95` | sonuç hapı "kcalAI" → logo + "AI" (12 pt, lime üstünde siyah) |
| `src/modules/onboarding/OnboardingNavigator.tsx:116` | karşılama "kcal." yazısı → kcal. logosu, 20 pt |
| `src/components/onboarding/TopBar.tsx:27` | giriş/karşılama üst barı PNG → kcal. SVG logosu, 24 pt |
| `src/modules/onboarding/first/CelebrateProfile.tsx:111` | paylaşım kartı "kcal." → logo (beyaz) |
| `src/modules/collection/CollectionWon.tsx:122` | koleksiyon kartı "kcal." → logo (ikincil) |
| `src/modules/coach/ui/cards.tsx:199` | koç ürün kartı "eatkcal" etiketi → logo (dekoratif; kart etiketi okunuyor) |
| `src/components/share/DeepLinkLanding.tsx:64` | paylaşım açılış sayfası "Kcalculate" → kcalculate logosu |
| `src/screens/TrackerScreen.tsx:2378`, `src/modules/profil/exportNutritionReport.ts:99` | PDF base64 PNG → satır içi SVG |

Metin kalanlar:
- Sekme VoiceOver adı `shell.tab.eat`.
- "Kcalculate" resmî rozeti (`badge_role_official`).
- Keşfet filtre çipi ve plan segmenti "eatkcal" (kontrol, başlık değil).
- Bildirim kanal adı, yasal metinler, cümleler.
- Mağaza adı "kcalculate" (canlı veri).
- Eski kabuk (bayrak kapalı) PNG logoları: `HomeScreen.tsx:494`, `ProfileScreen.tsx:681`, `TrackerScreen.tsx:2694`. Bayrak kapalı = 1.0.7 bayt bayt kuralı nedeniyle dokunulmadı.

## Maskota geçen yerler (md.3–md.4)
| Dosya:satır | Ne |
|---|---|
| `src/modules/coach/ui/parts.tsx:57` | `CoachGlass` (kase + alev → maskot + lime ışıma). Kullananlar: `CoachChatScreen.tsx:383` (boş hâl) · `CoachIntroScreen.tsx:55` · `CoachHistoryScreen.tsx:71` · `sheets.tsx:34` (upsell) |
| `src/modules/coach/ui/parts.tsx:67` | `CoachAvatar`. Kullananlar: `CoachChatScreen.tsx:363` (başlık) · `:507` (mesaj avatarı) · `parts.tsx:98` (yazıyor) |
| `src/modules/coach/ui/entries.tsx:113` | Tara sonucu "Koça sor" düğmesi |
| `src/modules/coach/ui/entries.tsx:171` | Tarif "Bu tarif bana uyar mı?" |
| `src/modules/coach/ui/CoachHomeMascot.tsx:132–133` | Ana sayfa koç kartı (açık / kapalı göz) |
| `src/modules/subscription/screens/PaywallScreen.tsx:42` | `FEATURE_IMG.coach` → koç slaytı üst ikonu (`:450`), "Balance'a yükselt" (`:312`), "kcalAI Koç dahil" (`:502`) |
| `src/modules/plan/screens/PlanGenerateScreen.tsx:236, 256, 527, 596, 650` | "kcalAI Koç oluşturur" kartı · Balance + Koç upsell satırı · "Koç oluşturuyor" · koç notu avatarı · sonuç upsell kartı |

Kase olarak kalanlar (öğün / sipariş / tarif anlamı):
- koç öğün fikri kartı (`cards.tsx:111`)
- Ana sayfa öğün yuvaları ve log tostu
- sipariş başarı ve şube kartı
- plan boş hâlleri ve alışveriş listesi
- kişisel plan ekranları
- onboarding

`koc-bos` yalnız `assets/coach/`'ta, hiçbir yerde require edilmiyor (pakete girmez).

## EN eksik anahtarlar (md.7)
- Sözlük taraması (`translations.en`, 2 901 yaprak):
  - Türkçe karakterli / TR ile aynı / Türkçe kelimeli 43 aday çıktı. Hepsi meşru: yer tutucu biçimler (`%{n} kcal`), özel adlar ("Türkiye", ilçe listesi), "börek" örneği, "Kcalculate AI".
  - "WORD" adayları "You’**ve**" yanlış eşleşmesi.
  - Çevrilmemiş anahtar **0**. TR ↔ EN anahtar eşitliği testi zaten var (`i18nKeys.test.ts`).
- Yeni eklenenler TR + EN: `home.ek_eta_default`, `ek_addr_title`, `ek_addr_cta`, `ek_none`, `ek_all`, `ek_all_a11y`; `coach.glass_a11y` güncellendi.
- Düzeltilen sızıntı: sunucu süre metni "30-45 dk" EN arayüzde "30-45 min" (`etaForLang`, `useDeliveryChip`). eatkcal sekmesi çipine de uygulanıyor.
- **Dil kuralı**:
  - önce: ilk desteklenen dil, yoksa TR. Almanca cihaz → Türkçe.
  - şimdi: birincil dil `tr` → TR, aksi hâlde EN. Desteklenmeyen kayıtlı cihaz dili → EN.
  - Sağlayıcısız iç varsayılan (`DEFAULT_LANG`, testler) 'tr' kaldı.
  - i18n-js anahtar geri düşüşü TR. Anahtar eşitliği testi eksik anahtarı engellediği için pratikte devreye girmiyor.
- **Mevcut native durum (değiştirilmedi)**: `app.config.js` `locales: { tr, en }` (izin metinleri). Varsayılan infoPlist metinleri TR. `CFBundleDevelopmentRegion` config'te tanımlı değil (Expo varsayılanı). `ios/` klasörü bu worktree'de yok (CNG).

## KARAR
1. **Bölge 'unknown' artık vitrin gösteriyor** (önce İzmir dışı bekleme listesi). README: adres yoksa da restoranlar listelensin. Açıkça başka şehir (adres / il kapısı / konum) → bekleme listesi aynen.
2. Mağaza / ürün açma, eatkcal sekmesiyle aynı il kapısı kuralıyla (`homeEatkcalNav.ts`). `yeni_siparis` kapalıyken her eylem eatkcal sekmesini açar.
3. "Şu an açık restoran yok" = mağaza listesi boş. Mutfak saatine göre filtre yok: tek mutfak, kapalıyken kartta "Randevulu" yazıyor.
4. Kampanya verisi düşerse yalnız banner satırı gizlenir. Restoran verisi düşerse bütün alan gizlenir (sessiz hata).
5. Koç kartı düzeni: kota satırı metin sütununa alındı, düğme solda. Böylece sağdaki maskot düğmeyle çakışmıyor. Düğme siyah, üstünde lime yazı.
6. Maskot hareket değerleri `motion.tsx › COACH_MASCOT_MOTION`'da. "Yerel süre / eğri yok" kuralı nedeniyle tek kaynak burası. 3,5 sn döngü token setinin dışında, README isteği.
7. Maskot PNG'leri @1x/@2x/@3x = 240 / 512 / 1024 px (iOS paketinde açık + kapalı ≈ 714 kB).
8. "kcalAI" hapı (SubResult) da logo + "AI" oldu (paywall ile tutarlılık).

## HIG (kod denetimi)
- **Dokunma alanı**: "Koçuna sor" 44 pt · "Adres ekle" 44 pt · "Tümü" 44 × 44 · kart düğmeleri ≥ 44 ✓.
- **Kontrast** (WCAG):
  - siyah / lime 14,5:1
  - ikincil (siyah %72) / lime 7,1:1
  - lime yazı / siyah düğme 14,5:1 ✓
- **VoiceOver**:
  - Logolar tek "image" ya da "header" öğesi, marka veya başlık adını okur.
  - Maskot ve ışıma gizli. "kcalAI" işareti tek öğe.
- **Reduce Motion**: süzülme ve kırpma yok, statik maskot ✓. Odak dışı / arka planda hareket durur.
- **Dynamic Type**: logo ve "AI" ölçeklenmez (marka imi). Kart metinleri ölçeklenir. Koç kartı yüksekliği metne göre büyür, maskot buna göre ölçeklenir.

## Ekran görüntüleri (`docs/night/g39/`, Light + Dark)
`Home` (adres var) · `HomeNoAddr` · `HomeCoach` (koç kartı) · `PaywallFresh` · `PaywallBalance` · `Kesfet` (üst) · `EkHome` (eatkcal sekmesi üstü) · `CoachChat`. Toplam 16 JPEG.

Nasıl alındı:
- Vitrin `kcal://dev/screen/G39-<Sahne>(-Dark)` (yeni `G39-` çözücüsü, `screenCatalog.ts`; Final pano listesine girmez).
- Sahte oturum ve mock veri. Koç ve abonelik bayrakları açık, demo fiyatlar.

## CANLIYA UYGULANACAK
Yok (migration / DB değişikliği yok).

## DEPLOY GEREKİR
- OTA: yalnız JS + asset, native değişiklik yok. Production OTA onaysız yasak, İlter yayınlar:
  `eas update --branch production --environment production --message "G39-S1 logo SVG, koc maskotu, ana sayfa eatkcal vitrini, EN birincil dil"`

## SORULAR
1. Simülatör: diskte 13 GB boş vardı (kural ≥ 20 GB), native derleme yapılmadı.
   - 9 Kas tarihli 1.1.0 dev build (`jobs/9a487857/tmp/Kcalculate.app`) yeni bir **"G39 iPhone"** simülatörüne (`5F5A6792…`) kuruldu. İlter'in "iPhone 17" simülatörüne ve oradaki 1.0.6 kurulumuna dokunulmadı.
   - Sonradan eklenen native modüller (RevenueCat, konuşma tanıma, çıkartma) bu build'de yok. Vitrin bunları kullanmadığı için görüntüler etkilenmedi.
   - İstenirse `xcrun simctl delete 5F5A6792-71EE-454C-848A-F73D8D650D98`.
2. Tab çubuğu ikon-only. eatkcal sekme ikonunun yerine logo istenirse ayrı karar gerekir (HIG: sekme ikonları sade glif).
3. Eski kabuk (bayrak kapalı) PNG logoları da SVG'ye geçsin mi? Parite kuralı nedeniyle bırakıldı.
4. Ana sayfa vitrin bannerlarının hedefi olmayanlar eatkcal sekmesini açıyor. eatkcal sekmesinde aynı durum "Kampanyalar ve kuponlar"a gidiyor. Ana sayfada da öyle mi olsun?
5. CLAUDE.md'deki backend cherry-pick kuralı: bu oturumda `supabase/` değişikliği yok.
