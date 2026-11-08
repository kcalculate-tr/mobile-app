# G18-S1 — İlk 60 saniye (8 Kas, Tur 26 birebir)

## ÖZET (10 satır)
(1) **FinOpen + FinMoOpen:** tabak → cam kase → Enerji halkası → lime nokta "kcal." logosuna → Karşılama'ya erir; 900 enter → 500 standard → 900 exit (FinMoTokens eğrileri, İstisna 2). Atla ilk kareden (44 pt), yalnız ilk kullanım (`@kcal_onb_open_seen`), azaltılmışta durağan logo 900 + 200 ms. Splash kopyasıyla siyah splash → açılış 300 ms çözülme: video 10 fps karelerinde flaş YOK.
(2) **Karşılama:** "Takip et. Üret. Paylaş." (700/40, B üç satır panodaki gibi) + tek destek cümlesi; B/C `onb_welcome_variant_b/_c` (varsayılan A); EN = FinOnbWelcomeEN (panodaki EN metinleri).
(3) **Hesap:** Apple/Google sayfada sabit; "E-posta ile devam et" → kaydırılabilir sheet (e-posta + Kod gönder formda; kod adımı aynı sheet'te), klavye açık hâli simülatör yazılım klavyesiyle çekildi. Auth mantığı AYNEN.
(4) **Akış:** FinOpen → Welcome → Account → Ana sayfa (her hesap). Bildirim izni ilk öğün kutlamasından SONRA bir kez (mevcut HomeCelebrations yolu).
(5) **Profil kartı** (hero ile makro satırı arasında, panodaki yerde) → Takibe başla → **"Profil hazır"** (900 ms tek sahne) → oryantasyon; kapatılırsa bir daha zorla açılmaz, oryantasyon yine başlar.
(6) **FinOrient1–4:** gerçek ekran üstünde delikli örtü + balon (n/4 · Atla · Sonraki/Tamam); `useOrientTarget(id)` + kök `OrientHost`; kutlama/izin sheet'i açıkken bekler. **(7)** FinHomeEmptyR1 içerik bileşenleri (montaj S2). **(8)** Kalıcı bayraklar AsyncStorage + `profiles.onboarding_state` (CANLIYA UYGULANACAK).
(9) **Ölçülmüş karşılaştırma** (SSIM, negatif kontrollü — aşağıda): kendi bileşen bölgeleri 0,80–0,96 (σ1,5), yanlış ekran kontrolleri 0,47–0,76; dikey konum farkı ≤ 4 pt (alta sabitli öğelerde 6–10 pt = 874/852 cihaz ölçeği).
(10) Kontrol: tsc 0 · unit 653/653 (1 skip önceden) · jest 31/165, snapshot 2/2 · `noLegacyWhenFlagsOn` 11/11 · `expo export` iOS 9.98 MB ✓ Android 10 MB ✓ · **Eski tasarım: 0** · bayrak kapalı = 1.0.7. Dal `night18/onb`, simülatör "G18-1 iPhone" `AEAE20D2-…65CC`, Metro 8101, kanıt `~/kcal-reports/g18-s1/`.

## Commit'ler
| Madde | Commit | Özet |
|---|---|---|
| 8 | `3da8e5d` | `first/state.ts` (saf), `first/store.ts` (zustand + AsyncStorage + profil), migration + rollback, registry `onb_welcome_variant_b/_c` |
| 1–4 | `24e22c0` | `OpenSignature`, Karşılama varyantı, `AccountEmailSheet`, akış → Ana sayfa, i18n TR+EN |
| 5–7 | `e259aeb` | `ProfileCard`, `CelebrateProfile`, `HomeOnboardingSlot`, `OrientHost` + `useOrientTarget` + `geometry`, `overlayGate`, `HomeEmptyR1`, Tb Sonuç → Profil hazır, bileşen testleri |
| temas | `0b34da9`, `aff5f4d` | diğer oturum dosyalarına bağlar; profil kartı yuvası FinTopBlock'ta hero ile makro satırı arasına taşındı, Orient3 hedefi Enerji sütunu |
| 9 | `90b4eb3`, `e6558f9`, `e26f37a` | vitrin (12 pano + Dark), `EN-<Pano>`, `FinMoOpen~1–7`, `Part-HomeEmptyR1` (ölçüm) |
| düzeltme | `b0ab891`, `b785c1b`, `4dceffb` | e-posta sheet yüzeyi; FinTbHow hizası; onboarding tipografisi panolarla (karşılaştırmada bulundu) |
| — | bu LOG + `docs/night/G18-S1-DONE` | |

## Maddeler
**1 — FinOpen/FinMoOpen** (`src/modules/onboarding/first/OpenSignature.tsx`, Karşılama'nın üstünde katman). Zaman çizelgesi `OPEN_T` (birim testli): 0–300 tabak+iz (enter) · 300–900 kase (enter) · 900–1400 halka 0→%100 + nokta halka ucunda (standard), nokta 900–1000 belirir · 1400–1900 grup 0.6'ya küçülüp söner (exit), nokta logoya (enter) · 1600–1900 "kcal" (standard) · 2000–2300 katman erir (exit). FinOpen'daki yerel eğriler CURVE.enter/standard/exit'e çevrildi (İstisna 2). İlk kare = `app.config.js` splash kopyası (siyah + icon.png 170 pt), bayrak okunurken kalır, 300 ms çözülür. Görüldü bayrağı yalnız cihazda (silip yeniden kurunca tekrar oynar). Haptik/ses yok.
**2 — Karşılama:** `onboarding.welcome.headline/_b/_c/sub` (TR+EN, panodaki metinler). Kart: 32 köşe, iç boşluk 28/20/20, "kcal." 700/18, başlık 700/40 satır 1.08, alt metin 15/1.4. Nokta göstergesi 2.
**3 — Hesap:** `AccountEmailSheet` (Modal + KeyboardAvoidingView): başlık 22/700 + 32 pt dairede X (sağ), açıklama, etiket, 52 pt alan (odakta 2 pt mürekkep halka), lime "Kod gönder"; gönderilince "Kod gönderildi…" + Kod + "Doğrula ve devam et" + "E-postayı değiştir". base 300 enter / fast 200 exit, scrim %32; azaltılmış 200 ms.
**4 — Akış:** `AccountScreen.afterAuth` → `Tabs/Tracker` her hesapta. OnbNotify/OnbIntent rotaları kayıtlı kalır (vitrin), düğme gitmez. Bildirim izni `HomeCelebrations` (ilk öğün kutlaması kapanınca, `@kcal_celebrate_notify_offered` ile bir kez) — jest `TrackerScreen.flagOn` "ilk öğün … ardından bildirim izni sheet'i" geçiyor.
**5 — Profil kartı:** `HomeOnboardingSlot` FinTopBlock'ta (hero + "İlk öğününü logla" altında, makro satırının üstünde — FinHomeProfileCard ve FinHomeEmptyR1 sırası). Yalnız hedefi olmayan hesapta (`hasNutritionGoal`, hata → gösterme) ve kart `open` iken. Sonuç "Devam et" → `saveTakibeProfile` → kart `done` → `CelebrateProfile` (gerçek hedef kcal; yoksa sayı satırları gizli) → oryantasyon. X → `dismissed` + oryantasyon.
**6 — Oryantasyon:** `nextOrientStep` (1 önce; sonra ekrandaki görülmemiş en küçük adım). Hedefler: 1 `scan` (Tara dairesi, yalnız Ana sayfa sekmesinde), 2 `log` (Tara sonucu logla hapı), 3 `ring` (Enerji sütunu, ilk kayıttan sonra), 4 `kesfet` (Sana Özel/Takip). Delik + balon 236 pt + 12 pt aralık + ok konumu panolardan (geometri birim testli). Tam ekran tanıtım YOK.
**7 — Boş hâl:** `HomeEmptyRing`, `HomeFirstMealCard`, `HomeEmptyToday` (+ `HomeEmptyR1`) — Demo kart dokunulamaz, kayıt fonksiyonu yok (test).
**8 — Kalıcı bayraklar:** `@kcal_onb_first_v1` + `profiles.onboarding_state`; "ileri durum kazanır"; kolon yokken sessizce yalnız cihaz.

## Temas (diğer oturumların dosyaları — S5 bağlar)
| Dosya | Sahip | Satır |
|---|---|---|
| `src/screens/tracker/FinTopBlock.tsx` | S2 | import + `<HomeOnboardingSlot />` (makro satırından önce) + `useOrientTarget('ring', { ready: !empty })` → Enerji StatusRing kökü (`targetProps`). **S2:** FinHomeR3 kahramanına geçerken aynı iki bağı yeni hero'ya taşı. |
| `src/modules/shell/TabBarR3.tsx` | S4 | `useOrientTarget('scan', { ready: aktif sekme Tracker })` + Tara dairesi |
| `src/modules/ai/scan/ui/FinPhotoResult.tsx` | S4 | `useOrientTarget('log')` + iki logla hapı |
| `src/modules/kesfet/ui/KesfetScreen.tsx` | S4 | sekme satırına `{...useOrientTarget('kesfet')}` |
| `src/modules/celebrate/CelebrateOverlay.tsx`, `NotifyPermissionSheet.tsx` | kutlama | `useOverlayGate(visible)` |
| `src/navigation/AppNavigator.tsx` | S4 | kökte `<OrientHost />` (fragment) |
| `src/dev/*` | ortak | katalog/vitrin; `PENDING_TUR26`'dan 12 pano(+Dark) silindi; `noLegacyWhenFlagsOn` yeni klasör; `vitrinFixtures` HOME_SCENES +profileCard/orient3 |
Bayrak kapalıyken: `useOrientTarget` `{}` (prop yok), `OrientHost`/`HomeOnboardingSlot` null.

## CANLIYA UYGULANACAK
- `supabase/migrations/20261108000100_g18_onboarding_state.sql` — `profiles.onboarding_state jsonb not null default '{}'` + `feature_flags` `onb_welcome_variant_b/_c` (kapalı, min 1.1.0). Rollback `supabase/rollbacks/20261108000100_g18_onboarding_state_rollback.sql`. Uygulanana dek yalnız cihaz, hata yok. `profiles_update_own` yeterli.

## Karşılaştırma tablosu — ÖLÇÜLMÜŞ
**Yöntem.** Pano `design/final/png/<P>.webp` (393×852) ↔ vitrin çekimi "G18-1 iPhone" (1206×2622 → 393×852), ffmpeg `ssim`. İki skor: **bölge** = panodaki bileşen kutusu (ör. kart, sheet, balon) — uygulamada dikey −20…+20 pt aranır, en iyi hizada SSIM; **σ1,5** = iki yana gaussian bulanıklık (tarayıcı/iOS yazı kenar yumuşatma gürültüsünü bastırır, yerleşim/renk/blok kıyası), **ham** = bulanıksız. **dy** = bulunan dikey kayma (pt). **Tam ekran** = durum çubuğu kırpılmış bütün ekran (bileşen dışı alan — S2'nin Ana sayfa kahramanı, Keşfet akışı, gerçek klavye — dahil olduğundan bileşen uyumunu ölçmez; bilgi için). Betikler `~/kcal-reports/g18-s1/ssim-*.tsv` + `roi.sh`.
**Negatif kontroller (yanlış ekran, aynı bölge):** Karşılama kartı ↔ Hesap çekimi 0,761 · Profil kartı ↔ Keşfet çekimi 0,600 · e-posta sheet'i ↔ Nasıl hesaplanır 0,684 · Orient1 balonu ↔ Orient4 çekimi 0,472. Yani σ1,5 bölge skoru ≳ 0,80 + dy ≤ 4 = aynı yerleşim; 0,76 altı = farklı ekran.

| Pano | Bölge (x,y,w×h) | σ1,5 | ham | dy | Tam ekran | Fark / not | Düzeltildi mi |
|---|---|---|---|---|---|---|---|
| FinOpen | tam (0,54) | 0,961 | 0,940 | −8 | 0,919 | 2150 ms karesi | — |
| FinOpen-Dark | tam | 0,932 | 0,908 | −6 | 0,893 | | — |
| FinMoOpen ~1–6 | — | — | — | — | — | Pano tek kare değil (storyboard); 150/600/1150/1650/1950/2300 kareleri sırayla panodaki 6 kareyle aynı içerik (`FinMoOpen-storyboard.png`) | — |
| FinOnbWelcome | kart 16,430,361×396 | 0,874 | 0,840 | −8 | 0,868 | başlık 34/800 → 40/700, kcal. 20→18 | ✓ `4dceffb` (0,836→0,874) |
| FinOnbWelcome-Dark | kart | 0,820 | 0,790 | 4 | 0,832 | | ✓ |
| FinOnbWelcomeB | kart | 0,860 | 0,827 | −8 | 0,861 | B iki satırdı → panodaki gibi üç satır | ✓ `4dceffb` (0,791→0,860) |
| FinOnbWelcomeC | kart | 0,873 | 0,838 | −8 | 0,863 | | ✓ |
| FinOnbWelcomeEN | kart | 0,862 | 0,835 | −8 | 0,864 | EN B/C metinleri panodaki | ✓ |
| FinOnbAccount | kart 16,262,361×566 | 0,899 | 0,874 | 4 | 0,890 | başlık 32→30, Apple/Google ikonları resmî logo (SORULAR 2) | ✓ tipografi / ikon soru |
| FinOnbAccount-Dark | kart | 0,890 | 0,851 | 4 | 0,857 | | ✓ |
| FinOnbAccountEmail | sheet 0,562,393×290 | 0,846 | 0,804 | 0 | 0,880 | ilk çekimde bulanıklık lekesi + alt boşluk +30 pt | ✓ `b0ab891` |
| FinOnbAccountEmail-Dark | sheet | 0,847 | 0,802 | 0 | 0,856 | | ✓ |
| FinOnbAccountKeyboard | sheet 0,262,393×290 | 0,881 | 0,842 | 2 | 0,794* | *tam ekran: gerçek iOS klavyesi ↔ panodaki gri "Klavye" kutusu | — |
| FinOnbAccountKeyboard-Dark | sheet | 0,879 | 0,838 | 2 | 0,717* | aynı | — |
| FinHomeProfileCard | kart 16,283,361×158 | 0,896 | 0,834 | 2 | 0,776* | kart makro satırının altındaydı → hero ile makro arası | ✓ `aff5f4d`; *tam ekran: Ana sayfa kahramanı S2 |
| FinHomeProfileCard-Dark | kart | 0,887 | 0,825 | 2 | 0,735* | | ✓ |
| FinCelebrateProfile | kart+metin 60,120,273×450 | 0,804 | 0,767 | −8 | 0,870 | [N]/[Tarih] gerçek veri (2.180 · 8 Kas) | — |
| FinCelebrateProfile (düğme) | 16,764,361×54 | 0,959 | 0,927 | −6 | | | — |
| FinCelebrateProfile-Dark | kart+metin | 0,830 | 0,777 | −8 | 0,869 | | — |
| FinOrient1 / -Dark | balon 145,628,236×122 | 0,815 / 0,810 | 0,726 / 0,725 | −10 | 0,736* / 0,690* | dy −10: Tara altta sabit, cihaz 874 pt; *arka Ana sayfa S2 | — |
| FinOrient2 / -Dark | balon 16,628,236×122 | 0,814 / 0,803 | 0,723 / 0,697 | 2 / 0 | 0,802 / 0,830 | | — |
| FinOrient3 / -Dark | balon 16,297,236×120 | 0,839 / 0,837 | 0,752 / 0,752 | 0 | 0,796* / 0,781* | delik yalnız halkaydı → Enerji sütunu (≈127×170 r24; pano 123×178 r24) | ✓ `aff5f4d` |
| FinOrient4 / -Dark | balon 16,159,236×100 | 0,838 / 0,839 | 0,701 / 0,702 | 4 | 0,653* / 0,681* | *akış içeriği farklı gönderiler | — |
| FinHomeEmptyR1 — halka | 12,110,160×160 (`Part-`) | 0,930 | 0,855 | −10 | — | Pano 393×2160 kaydırma çekimi; bileşenler `Part-HomeEmptyR1` sahnesinde ölçüldü (montaj S2) | — |
| FinHomeEmptyR1 — İlk öğün kartı | 16,283,361×166 | 0,914 | 0,830 | −6 | — | | — |
| FinHomeEmptyR1 — Profil kartı | 16,461,361×160 | 0,901 | 0,827 | −4 | — | | — |
| FinHomeEmptyR1 — Bugün/Demo | 16,760,361×180 | 0,889 | 0,791 | −6 | — | | — |
| FinTbHow | sheet hizalı 0,400,393×380 | 0,847 | 0,795 | −2 | 0,779 | satırlar 20 pt içeride + 16/15 yazı → 15/14; kalan ≈12 pt sheet başlık/alt boşluğu ortak `Sheet` bileşeninde (S4) | ✓ `b785c1b`, `4dceffb` |
| FinTbFirst | kart 16,213,361×615 | 0,920 | 0,890 | −4 | 0,882 | başlık 32→30 | ✓ `4dceffb` |
Kanıt: `~/kcal-reports/g18-s1/` (her pano PNG, `cmp-*.png` yan yana, `ssim-full.tsv`, `ssim-roi.tsv`).

## Yeni hesap simülasyonu — video kareleri (md.9)
`xcrun simctl io recordVideo` (47 sn, `~/kcal-reports/g18-s1/flow/flow.mov`), vitrin zinciri `FinMoOpen~7` (canlı) → `FinHomeEmptyR1` → `FinTbGoal` → `FinTbResult` → `FinCelebrateProfile` → `FinOrient1`. Gerçek hesap AÇILMADI (canlı DB yazma yasağı); oturum vitrin oturumu.
| sn | Kare | Ekran |
|---|---|---|
| 7.0–7.3 | siyah + beyaz "kcal." | native splash |
| 7.4–7.6 | splash logosu tabağa çözülüyor | FinOpen 0–300 (flaş yok) |
| 7.7–8.2 | cam kase, halka izi | FinOpen 300–900 |
| 8.3–8.9 | lime halka dolar, nokta ucunda | FinOpen 900–1400 |
| 9.0–9.3 | küçülme, "kcal" + nokta | FinOpen 1400–1900 |
| 9.4–9.9 | "kcal." → Karşılama | FinOpen 2000–2300 → FinOnbWelcome |
| ~15–17 | Ana sayfa + "Profilini oluşturalım" | FinHomeEmptyR1 + FinHomeProfileCard |
| ~22–25 | "Hedefin ne?" | FinTbGoal |
| ~30–33 | Günlük hedefin 1684 kcal | FinTbResult |
| ~38–41 | koyu kart + halka, "Profil hazır" | FinCelebrateProfile |
| ~44–47 | örtü + "Tabağını tara 1/4" | FinOrient1 |
Kareler: `flow/flow-contact-1fps.png`, `flow/open-10fps.png`, `FinMoOpen-storyboard.png`.

## EN (cihaz dili EN — `EN-<Pano>`)
`en/EN-FinOpen, EN-FinOnbAccount, EN-FinOnbAccountEmail, EN-FinHomeProfileCard, EN-FinCelebrateProfile, EN-FinOrient1…4, EN-FinHomeEmptyR1` + `FinOnbWelcomeEN` — hepsi EN; sabit TR metin yok. i18n: tr ve en aynı anahtarlar ✓.

## Kontrol
- `npx tsc --noEmit` → 0.
- `npm run test:unit` → 654 test, 653 geçti, 0 kaldı, 1 atlandı (önceden). Yeni: `first/__tests__/first.test.ts` 12/12; `flagOffRoutes` güncel.
- `npm run test:components` → 31 suite / 165 test, snapshot 2/2. Yeni: `first/__component_tests__/first.test.tsx` 9/9.
- `noLegacyWhenFlagsOn` 11/11 (yeni `modules/onboarding/first` dahil).
- `expo export --platform ios` ✓ 9.98 MB · `--platform android` ✓ 10 MB (son kod commit'inden sonra). Native/yeni paket YOK.
- Bayrak kapalı parite: `Off-Tracker`/`Off-Home` = 1.0.7 kabuğu; `TrackerScreen.flagOff` snapshot aynı; hedef kancası kapalıyken prop eklemiyor (jest); FinTopBlock yalnız yeni kabukta çizilir.

**Eski tasarım: 0** — yeni ekranlar yalnız Fin dili (onbTheme/homeTokens, FinMoTokens); eski COLORS/BottomSheet/logo import yok (test).
**Yeniden giydirilen (Final'de yok):** yok.

## SORULAR
1. **FinTbFirst akıştaki yeri:** FinTur26 #5 kartlı akışı "FinTbGoal … FinTbResult → FinCelebrateProfile" veriyor (TbFirst yok) ve "Profil hazır" metni "dört kısa ipucu"na geçiyor → Sonuç → Profil hazır → oryantasyon uygulandı. TbFirst rotası kayıtlı ve panoyla aynı (0,920); istenirse Sonuç'tan sonra tek satır.
2. **Apple/Google düğme ikonları:** FinOnbAccount Phosphor çizgi ikonları çiziyor (tek renk "G", çizgi elma). Kodda resmî Apple logosu + 4 renkli Google "G" KALDI: Apple "Sign in with Apple" ve Google marka kuralları resmî işaret istiyor; App Review reddi riski. Tek fark bu; karar İlter'in (değişirse `pieces.tsx` AuthButton, 2 ikon).
3. **Canlı şema okuması reddedildi** (`supabase-prod execute_sql`, otomatik mod) → `profiles` kolonları `docs/night/S1-SCHEMA_DUMP.md`'den; migration dosyası yazıldı.
