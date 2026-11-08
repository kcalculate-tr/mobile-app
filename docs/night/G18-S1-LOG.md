# G18-S1 — İlk 60 saniye (8 Kas, Tur 26 birebir)

## ÖZET (10 satır)
(1) **FinOpen + FinMoOpen:** tabak → cam kase → Enerji halkası → lime nokta "kcal." logosuna → Karşılama'ya erir; 900 enter → 500 standard → 900 exit (FinMoTokens eğrileri, İstisna 2). Atla ilk kareden (44 pt), yalnız ilk kullanım (`@kcal_onb_open_seen`), azaltılmışta durağan logo 900 + 200 ms opaklık. Splash kopyasıyla siyah splash → açılış zemini 300 ms çözülme: video 10 fps karelerinde flaş YOK.
(2) **Karşılama:** "Takip et. Üret. Paylaş." + tek destek cümlesi; B/C `onb_welcome_variant_b/_c` bayrağıyla (varsayılan A); EN = FinOnbWelcomeEN. Eski satırlar ("Ne yediğini gör" …) yok.
(3) **Hesap:** Apple/Google sayfada sabit; "E-posta ile devam et" → kaydırılabilir sheet (e-posta + Kod gönder formda, kod adımı aynı sheet'te), klavye açık hâli (2 pt mürekkep halka, sheet klavyenin üstünde). Auth mantığı AYNEN (`signInWithOtp`/`verifyEmailOtp`).
(4) **Akış:** FinOpen → Welcome → Account → Ana sayfa (her hesap). Niyet/Bildirim adımı akış dışı; bildirim izni ilk öğün kutlamasından SONRA bir kez (mevcut HomeCelebrations yolu).
(5) **Profil kartı → Takibe başla → "Profil hazır" (900 ms tek sahne) → oryantasyon;** kapatılırsa bir daha zorla açılmaz, oryantasyon yine başlar.
(6) **FinOrient1–4:** gerçek ekran üstünde delikli örtü + FinFeedTip balonu (n/4 · Atla · Sonraki/Tamam); `useOrientTarget(id)` + kök `OrientHost`; kutlama/izin sheet'i açıkken bekler.
(7) **FinHomeEmptyR1 içerik bileşenleri** (montaj S2): boş halka/"Hedef belirlenmedi", "İlk öğününü ekle" (Tara + Elle gir), tek Demo kart (yazmaz). **Kalıcı bayraklar:** AsyncStorage + `profiles.onboarding_state` (migration — CANLIYA UYGULANACAK).
(8) Kontrol: tsc 0 · unit 652/652 (1 skip önceden) · jest 31 suite / 165 test, snapshot 2/2 · `noLegacyWhenFlagsOn` 11/11 (yeni klasör dahil) · i18n tr=en anahtar ✓ · `expo export` iOS ✓ (9.98 MB) Android ✓ (10 MB).
(9) **Eski tasarım: 0.** Bayrak kapalı = 1.0.7 (Off-Tracker/Off-Home çekimi; hedef kancası kapalıyken prop eklemez — jest kanıtı; flagOff snapshot'ları aynı).
(10) Dal `night18/onb` (taban `night17/camera` `249b89b`), worktree `.claude/worktrees/g18-s1`, simülatör "G18-1 iPhone" `AEAE20D2-6FCC-4856-8C8D-0F4BB63E65CC`, Metro 8101. Kanıt görselleri `~/kcal-reports/g18-s1/`. SORULAR 3 madde.

## Commit'ler
| Madde | Commit | Özet |
|---|---|---|
| 8 | `3da8e5d` | `first/state.ts` (saf), `first/store.ts` (zustand + AsyncStorage + profil), migration + rollback, registry `onb_welcome_variant_b/_c` |
| 1–4 | `24e22c0` | `OpenSignature`, Karşılama varyantı, `AccountEmailSheet`, akış → Ana sayfa, i18n TR+EN |
| 5–7 | `e259aeb` | `ProfileCard`, `CelebrateProfile`, `HomeOnboardingSlot`, `OrientHost` + `useOrientTarget` + `geometry`, `overlayGate`, `HomeEmptyR1`, Tb Sonuç → Profil hazır, bileşen testleri |
| temas | `0b34da9` | diğer oturum dosyalarına tek satırlık bağlar (aşağıda) |
| 9 | `90b4eb3`, `e6558f9` | vitrin kataloğu (12 pano + Dark), `EN-<Pano>`, `FinMoOpen~1–7`; Tur 26 bekleme listesinden çıkarıldı |
| düzeltme | `b0ab891`, `b785c1b` | e-posta sheet yüzeyi/alt boşluk; FinTbHow satır hizası (karşılaştırmada bulundu) |
| — | bu LOG + `docs/night/G18-S1-DONE` | |

## Maddeler
**1 — FinOpen/FinMoOpen** (`src/modules/onboarding/first/OpenSignature.tsx`, Karşılama'nın üstünde katman). Zaman çizelgesi `OPEN_T` (state.ts, birim testli): 0–300 tabak+iz (enter) · 300–900 kase (enter) · 900–1400 halka 0→%100 + nokta halka ucunda döner (standard), nokta 900–1000 belirir · 1400–1900 grup 0.6'ya küçülüp söner (exit), nokta logoya gider (enter) · 1600–1900 "kcal" belirir (standard) · 2000–2300 katman erir (exit, yalnız opaklık). Yerel eğriler (0.25,0.9,0.3,1 / 0.4,0,1,1) kanonik CURVE.enter/standard/exit'e çevrildi (SON_HAL İstisna 2). Splash: `app.config.js` splash = siyah + icon.png 170 pt; ilk kare bu kopya (bayrak AsyncStorage'dan okunurken), sonra 300 ms çözülür. Görüldü bayrağı yalnız cihazda (FinMoOpen: "silinip yeniden kurulursa tekrar oynar"). Süreç başına bir kez (Karşılama'ya geri dönüşte yeniden çizilmez). Haptik/ses yok.
**2 — Karşılama:** `onboarding.welcome.headline / headline_b / headline_c / sub` (TR+EN). Seçim `welcomeVariant({b,c})` (B > C > A). Nokta göstergesi 2 (Welcome · Account).
**3 — Hesap:** `AccountEmailSheet` (Modal + KeyboardAvoidingView): başlık 22/700 + 32 pt dairede X (sağ — gezinme kuralı), açıklama, "E-posta" etiketi, 52 pt alan (odakta 2 pt mürekkep halka), lime "Kod gönder"; gönderilince "Kod gönderildi…" + Kod alanı + "Doğrula ve devam et" + "E-postayı değiştir" (panodaki `sent` hâli). Hareket base 300 enter / fast 200 exit, scrim %32; azaltılmış 200 ms. Doğrulanınca Ana sayfa. Eski `Login` ekranına artık Hesap'tan gidilmez ("Zaten hesabım var" → Login AYNEN).
**4 — Akış:** `AccountScreen.afterAuth`: yeni/dönen her hesap → `Tabs/Tracker` (yeni kabukta Ana sayfa). OnbNotify / OnbIntent rotaları kayıtlı kalır (vitrin, özellik kaybı yok), hiçbir düğme gitmez. Bildirim izni: `HomeCelebrations` ilk öğün kutlaması kapanınca `@kcal_celebrate_notify_offered` ile bir kez (değiştirilmedi; jest `TrackerScreen.flagOn` "ilk öğün … ardından bildirim izni sheet'i" testi geçiyor).
**5 — Profil kartı:** `HomeOnboardingSlot` (Ana sayfaya tek satır): kart yalnız hedefi olmayan hesapta (`hasNutritionGoal`, hata → gösterme) ve kart `open` iken. "Profilini oluştur" → `TakibeBasla` (Goal…Result, How sheet). Sonuç "Devam et" → profil kaydı (mevcut `saveTakibeProfile`) → kart `done` → Ana sayfa'da `CelebrateProfile` (gerçek hedef kcal; yoksa sayı satırları gizli) → "Devam et"/X → oryantasyon başlar. X (kart) → `dismissed` + oryantasyon başlar.
**6 — Oryantasyon:** adım seçimi `nextOrientStep` (1 her zaman önce; sonra ekrandaki görülmemiş en küçük adım). Hedefler: 1 `scan` (TabBarR3 Tara, yalnız Ana sayfa sekmesindeyken), 2 `log` (Tara sonucu "…'e logla"), 3 `ring` (Gün halkası, ilk kayıttan sonra), 4 `kesfet` (Sana Özel/Takip). Örtü delikli SVG (evenodd), balon 236 pt / 18 köşe / 12 pt aralık, ok hedefin işaret noktasında (geometri birim testli, panolardaki koordinatlarla). Atla → kalan hepsi kapanır; Sonraki → o adım görüldü; 4/4 "Tamam". Tam ekran tanıtım YOK; FinIntro/FinIntroOrder yalnız mevcut müşteriye (IntroOverlay, değişmedi).
**7 — Boş hâl:** `HomeEmptyRing`, `HomeFirstMealCard`, `HomeEmptyToday` (+ `HomeEmptyR1` bileşik) — `src/modules/onboarding/first/HomeEmptyR1.tsx`. Demo kart dokunulamaz, hiçbir kayıt fonksiyonu yok (birim + jest testi).
**8 — Kalıcı bayraklar:** `@kcal_onb_first_v1` = `{ profileCard, orient: { started, skipped, seen{1..4} } }` + `profiles.onboarding_state` (jsonb). Birleştirme "ileri durum kazanır". Kolon yokken okuma/yazma hatası sessizce yutulur (cihaz kaydı yeterli). `@kcal_onb_open_seen` yalnız cihaz.
**9 — Kontrol:** aşağıda.

## Temas (diğer oturumların dosyaları — S5 bağlar)
| Dosya | Sahip | Satır |
|---|---|---|
| `src/screens/TrackerScreen.tsx` | S2 | import + `{yeniKabuk ? <HomeOnboardingSlot /> : null}` (TrackerDayHeader'ın hemen altı). **S2:** FinHomeR3 yeni kahraman bloğunda yuvayı hero ile makro satırı ARASINA taşı (FinHomeProfileCard/EmptyR1 sırası: hero → İlk öğününü ekle → Profil kartı → makrolar). |
| `src/screens/tracker/FinTopBlock.tsx` | S2 | `useOrientTarget('ring', { ready: !empty })` + büyük StatusRing'e `targetProps`. **S2:** yeni FinHomeR3 halkasına aynı kancayı tak. |
| `src/modules/shell/TabBarR3.tsx` | S4 | `useOrientTarget('scan', { ready: <aktif sekme Tracker> })` + Tara dairesine spread |
| `src/modules/ai/scan/ui/FinPhotoResult.tsx` | S4 | `useOrientTarget('log')` + iki logla hapına spread |
| `src/modules/kesfet/ui/KesfetScreen.tsx` | S4 | sekme satırına `{...useOrientTarget('kesfet')}` |
| `src/modules/celebrate/CelebrateOverlay.tsx`, `NotifyPermissionSheet.tsx` | (kutlama) | `useOverlayGate(visible)` — açıkken ipucu beklesin |
| `src/navigation/AppNavigator.tsx` | S4 | kökte `<OrientHost />` (Stack.Navigator kardeşi, fragment) |
| `src/dev/*`, `src/dev/__tests__/*` | ortak | katalog/vitrin kayıtları, `PENDING_TUR26` listesinden 12 pano(+Dark) silindi, `noLegacyWhenFlagsOn` yeni klasör |
Bayrak kapalıyken: `useOrientTarget` `{}` döner (hiç prop yok), `OrientHost`/`HomeOnboardingSlot` null.

## CANLIYA UYGULANACAK
- `supabase/migrations/20261108000100_g18_onboarding_state.sql` — `profiles.onboarding_state jsonb not null default '{}'` + `feature_flags` satırları `onb_welcome_variant_b/_c` (kapalı, min 1.1.0). Rollback `supabase/rollbacks/20261108000100_g18_onboarding_state_rollback.sql` (kolon silmez). Uygulanmadan önce istemci yalnız cihazda tutar; hiçbir hata göstermez. Mevcut `profiles_update_own` politikası yeterli (kendi satırı); `profiles_guard_protected_cols` yeni kolonu korumaz/engellemez.

## Karşılaştırma tablosu (vitrin `G14_MODE=storage`, "G18-1 iPhone" 1206×2622 ↔ `design/final/png`)
| Pano | Uyum % | Fark | Düzeltildi mi |
|---|---|---|---|
| FinOpen (2150 ms karesi) | 96 | Katman opaklığı aynı kare; nokta göstergesi katmanın altında soluk (panoda da) | — |
| FinOpen-Dark | 95 | — | — |
| FinMoOpen (~1–6: 150/600/1150/1650/1950/2300) | 95 | 6 kare storyboard ile aynı sıra (tabak · kase · halka+nokta ucunda · küçülme+"kcal" · logo · Karşılama); eğriler kanonik token (İstisna 2) | — |
| FinOnbWelcome / -Dark | 97 | — | — |
| FinOnbWelcomeB / C / EN | 97 | — | — |
| FinOnbAccount / -Dark | 96 | Başlık/alt metin Tur 26'ya güncellendi | ✓ |
| FinOnbAccountEmail / -Dark | 94 | İlk çekimde bulanıklık arkadaki kartı lekeliyordu + alt boşluk +30 pt | ✓ `b0ab891` |
| FinOnbAccountKeyboard / -Dark | 90 | Simülatörde donanım klavyesi bağlı → yazılım klavyesi çizilmiyor; odak halkası + sheet yerleşimi doğru (KeyboardAvoidingView cihazda klavyenin üstüne taşır) | — (SORULAR 3) |
| FinHomeProfileCard / -Dark | 88 | Kart birebir (ölçü/renk/metin/X); dikey yeri bugünkü Ana sayfa yerleşimine göre makro satırının ALTINDA (panoda üstünde) — FinHomeR3 kahramanı S2'de | yerleşim S2 (temas notu) |
| FinCelebrateProfile / -Dark | 96 | [N]/[Tarih] gerçek veriyle (2.180 kcal, "8 Kas") | — |
| FinOrient1 / -Dark | 94 | Delik + balon + ok birebir; arka plan bugünkü Ana sayfa (S2 yeniler) | — |
| FinOrient2 / -Dark | 95 | — | — |
| FinOrient3 / -Dark | 90 | Delik bugünkü küçük Enerji halkasında (FinHomeR3'teki büyük halka S2'de; kanca taşınınca otomatik) | yerleşim S2 |
| FinOrient4 / -Dark | 97 | — | — |
| FinHomeEmptyR1 (içerik bileşenleri) | 92 | Bileşenler panodaki ölçülerle; Ana sayfa montajı S2 (çekimde bugünkü boş hâl + profil kartı) | montaj S2 |
| FinTbHow | 95 | Satırlar başlıktan 20 pt içerideydi (çift boşluk) | ✓ `b785c1b` |
| FinTbFirst / FinTbGoal / FinTbResult | 96 | — (FinTbFirst kartlı akışın dışında, SORULAR 1) | — |

## Yeni hesap simülasyonu — video kareleri (md.9)
Kayıt: `xcrun simctl io recordVideo` (47 sn, `~/kcal-reports/g18-s1/flow/flow.mov`), vitrin zinciri `FinMoOpen~7` (canlı oynatma) → `FinHomeEmptyR1` → `FinTbGoal` → `FinTbResult` → `FinCelebrateProfile` → `FinOrient1`. Gerçek hesap AÇILMADI (canlı DB yazma yasağı, ORTAK #8); oturum vitrin sahte oturumu.
| sn | Kare | Ekran |
|---|---|---|
| 7.0–7.3 | siyah + beyaz "kcal." | native splash (dev client "Downloading" şeridi yalnız geliştirmede) |
| 7.4–7.6 | gri → açık zemin, splash logosu tabağa çözülüyor | FinOpen 0–300 (flaş yok) |
| 7.7–8.2 | cam kase, halka izi | FinOpen 300–900 |
| 8.3–8.9 | lime halka dolar, nokta ucunda döner | FinOpen 900–1400 |
| 9.0–9.3 | kase+halka küçülür, "kcal" + nokta | FinOpen 1400–1900 |
| 9.4–9.9 | "kcal." → Karşılama'ya erir | FinOpen 2000–2300 → FinOnbWelcome |
| ~15–17 | Ana sayfa + "Profilini oluşturalım" | FinHomeEmptyR1 + FinHomeProfileCard |
| ~22–25 | "Hedefin ne?" | FinTbGoal |
| ~30–33 | Günlük hedefin 1684 kcal | FinTbResult |
| ~38–41 | koyu kart + halka çizilir, "Profil hazır" | FinCelebrateProfile |
| ~44–47 | örtü + "Tabağını tara 1/4" Tara üstünde | FinOrient1 |
Kare dosyaları: `flow/flow-contact-1fps.png`, `flow/open-10fps.png`, `FinMoOpen-storyboard.png`.

## EN (cihaz dili EN — `EN-<Pano>` vitrin takma adı)
`en/EN-FinOpen, EN-FinOnbAccount, EN-FinOnbAccountEmail, EN-FinHomeProfileCard, EN-FinCelebrateProfile, EN-FinOrient1…4, EN-FinHomeEmptyR1` + `FinOnbWelcomeEN` — hepsi EN metinle ("Continue with email", "Let's build your profile", "Profile ready", "Scan your plate 1/4", "Welcome to Explore 4/4"…), sabit TR metin yok. i18n testi: tr ve en aynı anahtarlara sahip ✓.

## Kontrol
- `npx tsc --noEmit` → 0.
- `npm run test:unit` → 653 test, 652 geçti, 0 kaldı, 1 atlandı (önceden). Yeni: `first/__tests__/first.test.ts` 12/12 (birleştirme, kart, adım seçimi, varyant, zaman çizelgesi, ipucu yerleşimi, örtü yolu, bayrak kapalı, demo yazmaz); `flagOffRoutes` güncellendi (TakibeBasla'ya giden yeni dosya bayraklı).
- `npm run test:components` → 31 suite / 165 test, snapshot 2/2. Yeni: `first/__component_tests__/first.test.tsx` 9/9.
- `noLegacyWhenFlagsOn` 11/11 (yeni `modules/onboarding/first` klasörü tarandı).
- `expo export --platform ios` ✓ 9.98 MB · `--platform android` ✓ 10 MB. Native değişiklik/yeni paket YOK (OTA ile gidebilir; migration ayrı).
- Bayrak kapalı parite: `Off-Tracker`/`Off-Home` çekimi = 1.0.7 kabuğu (kart/ipucu yok); `TrackerScreen.flagOff` snapshot aynı; hedef kancası kapalıyken prop eklemiyor (jest). AppNavigator'daki fragment + null OrientHost çizim ağacını değiştirmez.

**Eski tasarım: 0** — bayrak açık yolda yeni ekranlar yalnız Fin dili (onbTheme/homeTokens, FinMoTokens); eski COLORS/BottomSheet/logo import yok (test).
**Yeniden giydirilen (Final'de yok):** yok (FinTbFirst ve OnbNotify/OnbIntent kayıtlı kalır, bileşen değişmedi).

## SORULAR
1. **FinTbFirst akıştaki yeri:** FinTur26 #5 listesi kartlı akışı "FinTbGoal … FinTbResult → FinCelebrateProfile" diye veriyor (TbFirst yok), "Profil hazır" metni de "dört kısa ipucu"na geçiyor. Bu yüzden Sonuç → Profil hazır → oryantasyon uygulandı; TbFirst ("İlk öğününü logla") rotası kayıtlı ve panoyla aynı, ama karttan gelen akış ona uğramıyor (görevi Ana sayfa "İlk öğününü ekle" + Orient1 üstleniyor). Sonuç'tan sonra TbFirst istenirse tek satır.
2. **Canlı şema okuması reddedildi** (`supabase-prod execute_sql`, otomatik mod sınıflandırıcısı). `profiles` kolonları `docs/night/S1-SCHEMA_DUMP.md`'den doğrulandı (onboarding alanı yok) → migration dosyası. Uygulanınca cihazlar arası senkron kendiliğinden başlar.
3. **FinOnbAccountKeyboard:** simülatörde yazılım klavyesi açılmadığı için klavyeli kare cihazda çekilmeli (S5 uçtan uca testinde). Kod tarafı: alan odakta 2 pt halka, sheet `KeyboardAvoidingView` (iOS padding) ile klavyenin üstüne oturur; Android'de Modal penceresi yeniden boyutlanır (keyboard.ts notu).
