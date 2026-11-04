# G12-S6 — Entegrasyon, kabul ve dondurma adayı

## ÖZET (10 satır)
S1–S4 dalları `night12/release`'e (taban `night11/release`) sırayla, ÇAKIŞMASIZ merge edildi
(S1 kabuk/hareket/ortak bileşen/onboarding, S2 Keşfet, S3 Ana sayfa/Gün/kutlama/koleksiyon/cam,
S4 Tara/Profil/ayarlar/kayıt). **S5 (eatkcal) merge EDİLMEDİ** — `docs/night/G12-S5-DONE` yok, dal
`night11/release` ile aynı commit'te (0 ilerleme) → eatkcal yeni arayüzü "S5, 1.1.0 sonrası";
`yeni_siparis` zaten kapalı, bugünkü HomeScreen/Cart/Checkout aynen. Entegrasyon wiring: Profil
Hedefim→`TakibeBasla{editGoal}`, Koleksiyon→gerçek `collection` ekranı (foto akışı Dalga 2),
VerifiedBadge tek kaynağa (kesfet) indirildi, glass görselleri `assets/glass`'e tekilleştirildi.
Bayrak migration'ı `20261105000400_g12_flags.sql` (yeni_onboarding + yeni_siparis, kapalı, 1.1.0)
+ rollback + G6-APPLY #17. Bayrak kapalı=1.0.7 KANITI aşağıda (KİMSE dosyaları `git diff night10/release`
BOŞ + flags testi 11/11 false). Kontrol: **tsc 0 · test:unit 449/449 · test:components 76/76 ·
prebuild ios ✓ · expo export ios ✓ (8.73 MB)**. Son commit GERÇEK dosya `docs/night/G12-S6-DONE`.

## 1) Merge (sıra + çakışma + her adımda tsc 0)
| Sıra | Dal | Commit | tsc | Çakışma |
|---|---|---|---|---|
| 1 | `night12/shell-motion` (S1) | `c736bdc` | 0 | Yok |
| 2 | `night12/kesfet` (S2) | `205c3fc` | 0 | Yok |
| 3 | `night12/home` (S3) | `65fbab1` | 0 | Yok |
| 4 | `night12/scan-profil` (S4) | `4d8f702` | 0 | Yok |
| — | `night12/eatkcal` (S5) | — | — | **ATLANDI** (G12-S5-DONE yok; `night12/eatkcal`=`night11/release`=`332dd8a`, 0 commit ileri) |

Dosya sahipliği temiz ayrıldığından (S1=core/design+shell+onboarding, S2=kesfet, S3=gun/celebrate/
collection, S4=ai/profil) ve `dictionaries.ts` her oturum yalnız kendi ad alanına eklediğinden
hiçbir merge çakışması çıkmadı.

## 2) Entegrasyon wiring (uygulanan)
- **Profil › Hedefim** → `navigation.navigate('TakibeBasla', { editGoal: true })`
  (`FinPrProfileScreen.tsx:243`; önceden `NutritionProfile`'a gidiyordu — S1 ENTEGRASYONA notu).
- **Profil › Koleksiyon** → yeni `CollectionScreen.tsx` sub-ekranı (S3 `collection` modülü:
  `CollectionGrid`+`CollectionWon`+yerel `store`); önceden geçici olarak Rozetler'e gidiyordu
  (S4 ENTEGRASYONA). Fotoğraflı `meal_consumptions` akışı + özel kovadan imzalı URL = **Dalga 2**
  (modülün kendi `store.ts` notu + S3 LOG). Grid kazanılmış kart yokken tasarımdaki kilitli
  silüetleri gösterir (geçerli yeni-kullanıcı durumu).
- **VerifiedBadge tekilleştirme**: S4'ün geçici yerel kopyası silindi; `BadgesScreen` artık
  S2'nin gerçek `src/modules/kesfet/ui/VerifiedBadge.tsx`'ini import eder (tek kaynak, FinBadges/
  FinComponents tasarımı).
- **Glass görsel tekilleştirme**: `OnboardingNavigator` 3 `require('./assets/*.png')` →
  `require('../../../assets/glass/*.png')` (celebrate `GlassObject`'in zaten kullandığı tek kaynak);
  `src/modules/onboarding/assets/` (5 kopya PNG) silindi.
- **S5 rota kaydı**: `src/modules/eatkcal/v2/routes.tsx` YOK (S5 yapılmadı) → `yeni_siparis`
  koşullu stack kaydı yazılacak bir şey yok. Bayrak kapalı, bugünkü akış aynen.

Ertelenenler (ENTEGRASYONA başlığında, hepsi `yeni_kabuk`/`yeni_onboarding` KAPALI arkasında —
1.0.7 davranışını etkilemez; cihaz doğrulaması gerektirir).

## 3) Bayrak migration (yalnız dosya)
- `supabase/migrations/20261105000400_g12_flags.sql`: `yeni_onboarding` + `yeni_siparis` satırları,
  her ikisi `enabled=false, rollout_percent=0, min_app_version='1.1.0'`, `on conflict (key) do nothing`.
  Yeni tablo/kolon/fonksiyon yok. İstemci karşılığı `src/core/flags/registry.ts` FLAG_DEFAULTS'ta
  mevcut (S1 ekledi).
- Rollback: `supabase/rollbacks/20261105000400_g12_flags_rollback.sql` (yalnız bu iki satırı siler).
- G6-APPLY: **#17** eklendi (GERÇEK EN SON, #16'dan sonra; yalnız #0 feature_flags tablosu gerekir).
- UYGULANMADI (gece kuralı). Commit `a22d052`.

## 4) SON_HAL denetimi (`design/final/Fin*` — var / eksik / fark)
Not: `Fin*.dc.html` panolarının çoğu render edilemeyen `dc-import` kabuğu (S2/S4 LOG'ları; harici
render servisi gerekli). Denetim, alt-oturum pano↔bileşen tablolarının (G12-S1..S4 LOG) toplamı +
S6 entegrasyon durumu üzerinden; her grup için durum:

**S1 — kabuk/hareket/onboarding (bayrak `yeni_kabuk`/`yeni_onboarding`):** VAR.
FinComponents, FinMoTokens/FinMoMap, FinMo* hareket panoları, FinTabBar-rest/mid/min (TabBarR3),
FinOnbWelcome/Intent/Notify/Account/Underage, FinTbFirst/Goal/Pace/Activity/Result/How/About (Takibe
başla), FinIntro/FinIntroOrder → `src/modules/onboarding/**`, `src/modules/shell/**`,
`src/core/design/**` (G12-S1 LOG pano tablosu).

**S2 — Keşfet (bayrak `kesfet`*):** VAR. FinFeed/FeedScrollR3/FeedTip/FollowingEmpty, FinDetail,
FinSerbest, FinActivityCard, FinVideo, FinCompose/Posting, FinRules, FinComments, FinNotifications,
FinReport/ReportDone/ReportNotice, FinPostMenu/Block → `src/modules/kesfet/**` (G12-S2 LOG pano
tablosu, 24 satır). FARK: FinReportNotice anlamı stub'dan çıkarıldı (SORULAR-S2).

**S3 — Ana sayfa/Gün/kutlama/koleksiyon/cam (bayrak `yeni_kabuk`):**
- VAR: FinGunView/Empty/End/Done, FinTracker/TrackerEmpty (imza halkası `TrackerDayHeader` yeni
  kabukta mount — `TrackerScreen.tsx:2036`), FinMoGlass/Liquid/Ring (GlassObject, LiquidDots),
  FinCollectGrid/Entry/Cut/Won (bileşenler + artık Profil'den erişilebilir), FinSheetNotify,
  veri katmanı (homeData `buildSlots`/`energyRing`/`macroRing`, delivery, logFlight köprüsü).
- **FARK / EKSİK (Dalga 1 sonrası, cihaz doğrulaması):**
  (a) **FinHomeR3 öğün yuvaları** — `homeData.buildSlots` TrackerScreen yeni-kabuk gövdesine
      BAĞLANMADI; şu an imza halkası + mevcut "Dolabındakiler" şeridi render edilir. Yuva sunumu
      (4 öğün kartı) mount edilmedi (S3 oturumu `src/screens/`'e kasıtlı dokunmadı; TrackerScreen
      `night11/release`'e göre değişmedi).
  (b) **FinCelebrate/CelebStreak3/CelebStreak7** — `CelebrateOverlay` + `useCelebrations`
      yazıldı ama HİÇBİR YERDE mount edilmiyor (orphan); gerçek seri/ilk-öğün sinyaline bağlanması
      cihazda doğrulanmalı.
  (c) **Çapraz-sekme Logla vurgusu** — `gun/logFlight.onLogFlight` dinleyicisi var ama Ana sayfa
      bunu tüketmiyor (TabBarR3 tek dinleyici). Ev vurgusu (b) ile aynı mount işine bağlı.

**S4 — Tara/Profil/ayarlar/kayıt (bayrak `yeni_kabuk`/`ai_tarama`):** VAR.
FinScanR2/PhotoR1/PhotoEN/ScanError/ScanOffline, FinErrFailed/Limit/Offline,
FinPrProfile/Progress/Macro/MacroWhat/MacroHistoryEmpty/Personal/Notify/Security/Agreements/
Support/Feedback, FinProfilePublic/Badges/Privacy/PrivacySettings, FinSignupAI/SignupEat →
`src/modules/ai/**`, `src/modules/profil/**` (G12-S4 LOG). FARK: `SignupEatScreen` mount noktası
S5'e bağlı (aşağıda, İLTER'E).

**S5 — eatkcal (bayrak `yeni_siparis`):** **EKSİK — tümü.**
FinEkHome/HomeSkeleton/Store/Reviews/Product/ProductScroll/Cart/CartEmpty/CartSkeleton/Checkout/
CheckoutPayWait/PayFail/PayUnknown/Address/AddressNoPerm/AddressNoMap/Addresses/AddressesEmpty/
Orders/OrdersEmpty/OrdersFilterEmpty/OrderDetail/Info/Errors (24) + FinCityR1/WaitlistR1/EatBerlin
+ FinMoCart/MoPay/MoDeliver → S5 oturumu çalışmadı, `src/modules/eatkcal/v2/` yok. `yeni_siparis`
kapalı; bugünkü eatkcal (HomeScreen/Cart/Checkout, KİMSE listesi) AYNEN. **Dalga 1 sonrası.**

**Stress panoları (FinStressLong/XL/EN/Dark):** Dynamic Type + tema kabulüyle karşılanıyor
(§6 kabul + AppText tavanlı ölçekleme).

**Kapatılan eksikler (S6 bu oturum):** Koleksiyon rotası (badges → gerçek collection ekranı),
VerifiedBadge tek kaynak, glass tekilleştirme. **Kapatılamayan (Dalga 1 sonrası):** S5 eatkcal,
FinHomeR3 yuva mount, CelebrateOverlay mount — gerekçe yukarıda.

## 5) Bayrak kapalı = 1.0.7 kanıtı (G11-S6 yöntemi)
- **Registry:** `yeni_onboarding`/`yeni_siparis`/`yeni_kabuk` + tüm anahtarlar `FLAG_DEFAULTS`'ta
  `false` (`src/core/flags/registry.ts`).
- **Flags testi:** `npx tsx --test src/core/flags/__tests__/flags.test.ts` → **11/11**;
  "registry: her bayrağın yerel varsayılanı false" + "resolve: remote/override yokken her şey false".
- **KİMSE dosyaları `git diff night10/release` → BOŞ** (bayt bayt 1.0.7): `src/screens/HomeScreen.tsx`,
  `Cart/Checkout/Payment/OrderSuccess`, `src/screens/profile/{Orders,OrderDetail,SavedCards,AddCard,
  Coupons}Screen.tsx`, `src/lib/{paynkolay,payment*,checkout*,cart*,orders,activeOrder,reorder}`,
  `src/store/cartStore.ts`, `src/components/checkout/**`, `src/screens/auth/**`, `package.json`,
  `app.config.js` → `git diff --quiet night10/release -- <KİMSE>` = **BOŞ ✓**.
- **Giriş yolları flag-gated:** `AppNavigator` initialRoute `yeni_onboarding` kapalı → `WelcomeGate`
  (bugünkü); `ProfileScreen`/`ScanScreen` `yeni_kabuk` kapalı → eski JSX (early-return, git diff ile
  alt-oturumlar doğruladı); `TrackerScreen` `night11/release`'e göre DEĞİŞMEDİ (imza halkası zaten
  G11'den flag-gated). `IntroOverlay` yalnız yeni kabuk ağacında mount.
- Sonuç: üç G12 bayrağı da kapalı → render yolu 1.0.7 ile aynı.

## 6) Kabul
- **G12-S5 madde 9 (eski=yeni aynı sepet/toplam, aynı ödeme fonksiyonu, 0 kayıp):** v2 YOK →
  mevcut akış değişmedi (KİMSE diff BOŞ). Sepet toplam/imza kararlılığı `src/lib/__tests__/
  cartSignature.test.ts` ile testli; depo kaynakları (oturum/sepet/adres/aktif sipariş/kart/Macro)
  dokunulmadı → 0 kayıp trivially (kod birebir 1.0.7).
- **Ödeme bekliyor/başarısız/belirsiz:** `src/lib/payment.ts verifyPayment` — callback `status`
  parse (`success`/`unknown`), `!paid` → hata; `mapPaymentErrorToMessage` ağ/zaman aşımı. Bu
  durumlar 1.0.7 ile aynı (FinEkCheckoutPayWait/Fail/Unknown panoları v2 ile Dalga 1 sonrası
  eşlenecek).
- **Mükerrer sipariş kanıtı:** `src/lib/orders.ts` **cartSignature** mekanizması (sepet satırları +
  bağlam → imza; `computeCartSignature`), `cartSignature.test.ts` ile testli → aynı sepet aynı imza,
  sipariş tekrarını mevcut mekanizma yakalar. (v2 yazılmadığı için ek "İLTER'E" gerekmedi.)
- **Dynamic Type en büyük boyda aksiyon kaybı yok (bileşen testi):** YENİ test
  `src/core/design/components/__component_tests__/SheetAccessibility.test.tsx` — AppText her kademe
  `allowFontScaling=true` + sayısal `maxFontSizeMultiplier` tavanı (sınırsız taşma yok); footer
  aksiyonu büyük ölçekte ağaçta kalır; aksiyon metni `numberOfLines=1` taşımaz. (Gerçek görsel
  kırpma cihazda doğrulanır — simülatör erişimi yok, İLTER'E.)
- **Sheet erişilebilirliği:** ortak `src/core/design/components/Sheet.tsx` — `accessibilityViewIsModal`
  (arka plan okunmaz), başlık `accessibilityLabel`, kapat düğmesi "Kapat" etiketli, açılışta
  `setAccessibilityFocus`. Yukarıdaki testte doğrulandı (5/5 geçti).

## 7) Kontrol
- `npx tsc --noEmit` → **0** (her merge sonrası ve son durumda).
- `npm run test:unit` → **449/449**.
- `npm run test:components` (jest) → **76/76** (17 süit; +5 yeni SheetAccessibility).
- `npx expo prebuild -p ios --no-install` → ✓ (commit'lenmedi, `ios/` gitignored).
- `npx expo export --platform ios` → ✓, iOS bundle **8.73 MB**.
- **Paket boyutu farkı:** `night11/release` (G11-S6) 8.42 MB → G12 8.73 MB = **+0.31 MB**; artış
  additive + bayrak-geçitli (onboarding/collection/celebrate modülleri, Fin ekranları, glass 5 PNG
  tek kopya, i18n anahtarları). Sipariş/ödeme yoluna (KİMSE) 0 ekleme.

## ENTEGRASYONA (Dalga 1 sonrası — hepsi kapalı bayrak arkasında)
1. **FinHomeR3 öğün yuvaları** — `TrackerScreen` yeni-kabuk gövdesine (`:2036` civarı, imza
   halkasının altına) `homeData.buildSlots(consumptions)` ile 4 öğün kartı mount; `onLogFlight`
   vurgusu. Cihazda düzen/kaydırma doğrulaması gerekir (S3 `src/screens/`'e dokunmadı).
2. **CelebrateOverlay mount** — `useCelebrations()` TrackerScreen'de çağrılıp `CelebrateOverlay`
   gerçek ilk-öğün/3gün/7gün seri sinyaliyle gösterilmeli; AsyncStorage `@kcal_celebrate_shown`
   ömür-boyu-bir-kez korunur.
3. **Çapraz-sekme Logla vurgusu** — Ana sayfa `gun/logFlight.onLogFlight`'ı dinleyip halka vurgusu
   tetiklemeli (şu an yalnız TabBarR3 dinliyor).
4. **Koleksiyon foto akışı (Dalga 2)** — `CollectionScreen` şu an yerel store'dan; `meal_consumptions`
   fotoğraflı kayıtları + `user-media` özel kovadan imzalı URL türetme Dalga 2'de bağlanacak
   (modül `store.ts` + S3 LOG). "kazanıldı" sunucuya da Dalga 2.
5. **exportNutritionReport tekilleştirme** — `src/modules/profil/exportNutritionReport.ts` (kilo/BMI
   HARİÇ) ile `TrackerScreen.tsx:~1500 handleExportPDF` (kilo/BMI DAHİL) ayrı kopyalar; ikisi de
   doğru çalışıyor. Tek paylaşılan üreticiye (varyant bayraklı) indirme — kozmetik, düşük öncelik.
6. **logFlight olay dosyaları** — `shell/logEvents.ts`, `kesfet/events.ts`, `gun/logFlight.ts`,
   `ai/scan/logFlight.ts` aynı `kcal:logFlight`/`kcal:logUndo` kanalına yayınlıyor (işlevsel olarak
   uyumlu, TabBarR3 çalışıyor). Tek kaynağa indirme kozmetik.
7. **S5 eatkcal yeni arayüzü** — `src/modules/eatkcal/v2/` + `routes.tsx` + `yeni_siparis` koşullu
   stack kaydı + `SignupEatScreen` mount (ilk "Sipariş ver"de şehir kapısı). **S5 oturumu, 1.1.0
   sonrası.**
8. **S2–S5 yerel stilleri → ortak bileşenler / eski hareket adları → yeni token**: alt-oturumlar
   yerel stilleri FinComponents ölçülerine uydurdu, S1 eski hareket adlarını yeni token'lara takma
   ad yaptı (geriye uyumlu). Toplu refactor cihaz doğrulaması gerektirir; dondurma adayında kör
   yapılmadı (işlev doğru, görsel regresyon riski).

## İLTER'E (dondurma + derleme + canlı sıra)
### (a) Simülatörde deneme (pano pano)
1. Native derleme + kurulum: CLAUDE.md "Yerel iOS geliştirme" 1. komut (kendi UDID'in).
2. `export PATH="/opt/homebrew/opt/node@20/bin:$PATH"; cd <worktree>; npx expo start --dev-client`.
3. **Tüm bayraklar kapalı** → uygulama bugünkü 1.0.7 ile bire bir olmalı (Keşfet/Tara/Profil/eatkcal
   mevcut hâliyle).
4. **Tasarım vitrini → Bayraklar ekranı → Dev "Yeni uygulamayı aç" preset'i** (`yeni_kabuk +
   yeni_onboarding` açar; S1'in DesignShowcase'i). Sonra pano pano:
   - Onboarding akışı (Karşılama→Niyet→Bildirim→Hesap), Takibe başla (hedef→tempo→beden→sonuç).
   - Yeni kabuk: tab bar jöle/uçuş, Profil (Hedefim→Takibe, Koleksiyon ızgarası, ayar ekranları),
     Tara (FinScan/Photo), Keşfet (akış/kurallar/şikayet), Gün halkası/imza halkası.
   - **Beklenen eksik (Dalga 1 sonrası):** Ana sayfada 4 öğün-yuvası sunumu, kutlama kaplaması,
     eatkcal yeni arayüzü — bkz. ENTEGRASYONA 1/2/7. Mevcut Ana sayfa/eatkcal normal çalışır.
### (b) Bayrak ön ayarları (dalga planı — açmak senin kararın, admin/service_role)
- Migration dosyası satırları KAPALI yazdı. Açmadan önce `20261105000400_g12_flags.sql` uygula
  (#0 feature_flags gerekir), sonra `admin_set_flag` ile kademeli: önce `yeni_kabuk`, kabulden sonra
  `yeni_onboarding`; `yeni_siparis` S5 bitince. Hepsi `min_app_version='1.1.0'` → 1.0.x cihaz almaz.
### (c) 5 Kasım derleme/gönderim — BU DALDAN (`night12/release`)
> ONAY GEREKİR (CLAUDE.md "ONAYSIZ YASAK"): production build / mağaza gönderimi senin elinle.
```
cd ~/dev/kcal-mobile/.claude/worktrees/g12-s6   # ya da night12/release'i checkout et
eas build --platform ios --profile production
eas build --platform android --profile production
eas submit --platform ios --latest
eas submit --platform android --latest
```
Sürüm `1.1.0` / versionCode 10 hazır; `app.config.js` değiştirme (zaten doğru, KİMSE — dokunulmadı).
### (d) Canlı uygulama sırası
- Migration'lar: `docs/night/G6-APPLY.md` #0→#17 sırasıyla, TEK TEK (db push DEĞİL). G12 satırı #17
  GERÇEK EN SON.
- Canlı sosyal/sunucu sırası ve ön koşullar: `docs/night/G11-CANLI-SIRA.md` + bu LOG #17.

## SORULAR
Yok — kararlar (S5 atlama, Koleksiyon Dalga-1 kapsamı, home-yuva/kutlama mount ertelemesi,
exportReport/logFlight kozmetik tekilleştirme ertelemesi) yukarıda gerekçeli; bekleme gerektirmiyor.
