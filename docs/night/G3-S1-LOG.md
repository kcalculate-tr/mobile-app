# G3-S1 — Mağaza zorunlu düzeltmeleri · LOG

## ÖZET (10 satır)
1. **Dal:** `night3/store-fixes` (feat/social-login'den) · worktree `.claude/worktrees/g3-s1`.
2. **6 maddenin tamamı yapıldı** (Privacy manifest, Meta ATT, kullanılmayan izinler, yorum "Bildir", 18+ onayı, mağaza belgeleri).
3. **Kontrol HEPSİ GEÇİYOR:** tsc=0 · unit 294/294 · component 4 suite/30 test · `expo export --platform ios` başarılı.
4. **1 numaralı kritik bulgu:** `ios/` **.gitignore'da** (`.gitignore:39`), yani Info.plist/PrivacyInfo.xcprivacy git'te DEĞİL. Kalıcı kaynak `app.config.js` (prebuild üretir). Raporun "commit'li native dosya" öncülü yanlıştı.
5. Native düzeltmeler `app.config.js`'e yazıldı + `docs/night/G3-S1-native/` altında referans dosyalar bırakıldı (İlter uygulayacak).
6. Yorum "Bildir": `review_reports` migration (**uygulanmadı, dosya**) + RLS + istemci akışı (anasayfa yorum şeridi). Mevcut görünüm bozulmadı.
7. 18+ onayı: yalnızca **ilk kayıt** eden kullanıcıda (UnifiedLoginScreen), onay vermeyen kod gönderemez/sosyal giriş yapamaz; dönen kullanıcıda hiç görünmez.
8. **Yan bulgu (pre-existing, G3-S1 ile alakasız):** test altyapısında 4 bayat yol vardı (ekranlar `src/modules/eatkcal/screens/`'e taşınmış, testler güncellenmemiş) + jest-expo'nun tsconfig phosphor path'ini .d.ts'e eşlemesi. Hepsi düzeltildi (yalnızca test/konfig, üretim/ödeme koduna DOKUNULMADI). Ayrıntı aşağıda.
9. **İlter'in sabah yapması gerekenler:** (a) `expo prebuild --clean -p ios` YA DA `docs/night/G3-S1-native/` dosyalarını `ios/`'a elle uygula; (b) `review_reports` migration'ı staging'de test edip `supabase db push`; (c) `G3-S1-PRIVACY_POLICY.md`'yi eatkcal.com'da yayınla, URL'yi iki konsola gir; (d) iki mağaza gizlilik formunu `G3-S1-STORE_FORMS.md`'ye göre doldur; (e) ATT öncesi IDFA okunmadığını gerçek cihazda doğrula.
10. **Mağaza konsol işleri** (yaş derecelendirmesi, Account Deletion beyanı, Data Safety/App Privacy) repoda yapılamaz — belgelerde hazır, konsola İlter girecek.

---

## Yapılanlar (madde madde, kod referanslı)

### 1. PrivacyInfo.xcprivacy (Rapor 🔴 #1, #3, 🟡 #9 / Madde 4a-4b)
- `app.config.js`'e `ios.privacyManifests` eklendi:
  - `NSPrivacyTracking: true` + `NSPrivacyTrackingDomains: ['ep1.facebook.com']`
    (FBSDK pod'unun kendi manifestiyle aynı domain — doğrulandı: facebook-ios-sdk
    `FBSDKCoreKit/PrivacyInfo.xcprivacy`). App seviyesinde `true` + BOŞ domain =
    Apple reddi; o yüzden domain dolu.
  - `NSPrivacyCollectedDataTypes`: 14 tip, her biri kod referanslı (tablo
    `G3-S1-STORE_FORMS.md §1`). "Used to Track You": PurchaseHistory,
    ProductInteraction, DeviceID (Meta). Kalanlar yalnızca uygulama işlevi.
  - Mevcut 4 required-reason API (FileTimestamp/UserDefaults/BootTime/DiskSpace)
    BİREBİR taşındı (kaybolmasın).
- Referans dosya: `docs/night/G3-S1-native/PrivacyInfo.xcprivacy` (app.config.js ile aynı).

### 2. Meta SDK — ATT öncesi IDFA toplama (Rapor 🔴 #2 / Madde 4c)
- `app.config.js` `react-native-fbsdk-next`: `isAutoInitEnabled: true → false`,
  `advertiserIDCollectionEnabled: true → false`. SDK artık açılışta otomatik
  başlamıyor ve IDFA'yı varsayılan okumuyor.
- `src/lib/analytics.ts:10-28` `initFBSDK()`: ATT izni alındıktan SONRA,
  `initializeSDK()`'dan ÖNCE `Settings.setAdvertiserIDCollectionEnabled(granted)`
  eklendi (mevcut sıra korundu). Davranış: izin verilmezse IDFA hiç okunmaz
  (Apple 5.1.2); izin verilirse reklam ölçümü eskisi gibi çalışır.
- `initFBSDK` yalnızca `App.tsx:80`'de çağrılıyor (başka çağıran yok) — doğrulandı.

### 3. Kullanılmayan izinler (Rapor 🔴 #4, 🟡 #7, #9 / Madde 6)
- **Android** (`app.config.js`): `READ_EXTERNAL_STORAGE` + `WRITE_EXTERNAL_STORAGE`
  kaldırıldı. Kanıt: `MediaLibrary`/dosya yazımı YOK, expo-image-picker Foto
  Seçici kullanıyor (grep ile doğrulandı). Kalan: CAMERA, ACCESS_FINE/COARSE_LOCATION.
- **iOS** (native Info.plist — gitignore'lu, `docs/night/G3-S1-native/Info.plist-degisiklikleri.md`):
  - `NSMicrophoneUsageDescription` SİL — kodda mikrofon/ses YOK (grep doğrulandı).
  - `NSLocationAlwaysUsageDescription` + `NSLocationAlwaysAndWhenInUseUsageDescription`
    SİL — yalnızca when-in-use (`requestForegroundPermissionsAsync`;
    `src/lib/nearestLocation.ts`, `AddressVerificationSheet.tsx`). Arka plan/Always YOK.
  - `CFBundleShortVersionString` 1.0.6 → 1.0.7 (app.config.js `version` ile tutarlı).
  - `app.config.js infoPlist` zaten temiz; prebuild bu üçünü otomatik düzeltir.

### 4. Yorumlara "Bildir" akışı (Rapor 🟡 #6 / Madde 5, Apple 1.2 UGC)
- **Nerede:** Tek herkese-açık UGC yüzeyi anasayfa "Müşteri Yorumları" şeridi
  (`src/components/TopReviewsStrip.tsx`). ProductDetailScreen yalnızca beğeni
  oranı gösteriyor (bireysel yorum yok), MyReviews kendi yorumun — oralara eklenmedi.
- **Migration (DOSYA, uygulanmadı):** `supabase/migrations/20261103010000_review_reports.sql`
  + `..._rollback.sql`. Tablo `review_reports` (reporter_user_id, content_kaynak
  'siparis'|'uygulama', content_id, reason, note, status, unique(reporter,kaynak,id)).
  RLS: yalnızca `auth.uid() = reporter_user_id` INSERT; select/update yok (moderasyon
  service-role ile Boss panelinden). **Staging'de test EDİLMEDİ.**
- **İstemci:** `src/lib/reviewReports.ts` (insert + oturum kontrolü + 23505 çift
  kayıt mesajı), `src/components/ReviewReportSheet.tsx` (BottomSheet sebep seçimi
  + Alert geri bildirim — FeedbackScreen deseni), `TopReviewsStrip.tsx` kartına
  silik "Bildir" (Flag ikonu). `src/components/icons.ts`'e `Flag` eklendi.
  Mevcut kart görünümü/ölçüleri değişmedi (yalnızca alt satıra küçük eylem).

### 5. 18+ yaş onayı (Rapor 🟡 #8 / Madde 5)
- `src/screens/auth/UnifiedLoginScreen.tsx`: `@kcal_onboarding_done` ve
  `@kcal_age_18_confirmed` AsyncStorage'da yoksa (= ilk kez / yeni kayıt) onay
  kutusu gösterilir. Onaysız: `handleSendCode` kod göndermez; `SocialAuthButtons`
  `disabled` (Apple/Google giriş başlamaz). Onaylanınca `finishLogin` bayrağı
  kalıcılaştırır → cihazda bir daha sorulmaz, **dönen kullanıcı akışı uzamaz**.
- `src/components/onboarding/SocialAuthButtons.tsx`: opsiyonel `disabled` prop
  (yeni kayıtta onay verilene kadar sosyal giriş engellenir).
- KVKK sözleşmesi zaten 18+ şartını içeriyor (`contractsData.ts` Madde 4.1) — tutarlı.

### 6. Belgeler
- `docs/night/G3-S1-STORE_FORMS.md` — App Store "App Privacy" + Play "Data Safety"
  madde madde, kod referanslı (14 veri tipi, tracking işaretleri, Account Deletion).
- `docs/night/G3-S1-PRIVACY_POLICY.md` — eatkcal.com'da yayınlanacak herkese açık
  gizlilik politikası, **TR + EN**, `contractsData.ts` ile tutarlı (aynı veri
  sorumlusu/kategoriler/haklar/iletişim).
- `docs/night/G3-S1-native/` — düzeltilmiş `PrivacyInfo.xcprivacy` + Info.plist
  değişiklik notu.

---

## Test sonuçları
- `npx tsc --noEmit` → **0 hata**.
- Unit: `find src -path "*__tests__*" -name "*.test.ts" -print0 | xargs -0 npx tsx --test`
  → **294/294 pass**. (Not: `npm run test:unit` script'inin glob'u `src/**/__tests__/**/*.test.ts`
  Node 20'nin test-runner'ında genişlemiyor — "Could not find"; glob desteği Node 21+.
  Pre-existing ortam sorunu, G3-S1 ile alakasız. Testler açık yolla çağrılınca geçiyor.)
- Component: `npm run test:components` → **4 suite / 30 test pass**.
- `npx expo export --platform ios --output-dir /tmp/g3s1-export` → **başarılı** (ios bundle 6.54 MB).

---

## SORULAR / İlter kararı gereken
1. **Native build akışı:** `ios/` gitignore'lu ve `app.config.js`'ten üretilmesi
   gerekiyor ama CLAUDE.md doğrudan `xcodebuild ios/` build'i tarif ediyor. Yeni
   privacyManifests + izin düzeltmeleri mağazaya gitmesi için ya `expo prebuild
   --clean -p ios` çalıştırılmalı (build akışını değiştirir) YA DA
   `docs/night/G3-S1-native/` dosyaları elle `ios/`'a uygulanmalı. **Karar İlter'in.**
2. **`NSPrivacyTrackingDomains`:** `ep1.facebook.com` seçildi (FBSDK'nın kendi
   manifest domaini). Meta ileride domain eklerse güncellenmeli; mağaza
   gönderiminden önce FBSDK sürümünün manifestiyle kıyaslanması önerilir.
3. **review_reports:** staging'de test edilmedi; `supabase db push` öncesi İlter
   doğrulamalı. Moderasyon UI'si (Boss paneli) bu oturumun kapsamı dışında.

---

## Pre-existing düzeltmeler (G3-S1 feature'ı DEĞİL — kontroller yeşil olsun diye)
> Bu düzeltmeler HEAD'de de kırık olan, ekran taşımasından (src/modules/eatkcal/screens/)
> kalma bayat test yollarıydı. Üretim/ödeme koduna DOKUNULMADI; yalnızca test
> dosyaları + jest konfigürasyonu. İlter istemezse geri alınabilir.
- `src/lib/__tests__/cardVerification.test.ts:186` ve `:191` — `src/screens/PaymentScreen.tsx`
  → `src/modules/eatkcal/screens/PaymentScreen.tsx`; import-derinliği regex'i
  derinlikten bağımsız yapıldı.
- `src/lib/__tests__/webviewResilience.test.ts:128` — aynı yol düzeltmesi.
- `src/screens/__tests__/checkoutScreenSafety.test.ts:14` — `../CheckoutScreen.tsx`
  → `../../modules/eatkcal/screens/CheckoutScreen.tsx`.
- `jest.setup.js:34` — `./src/lib/supabase` → `./src/core/supabase` (client taşınmış;
  bu bayat yol HEAD'de TÜM component testlerini çökertiyordu). Ayrıca fbsdk mock'una
  `setAdvertiserIDCollectionEnabled` eklendi (madde 2 değişikliğiyle uyumlu).
- `package.json` jest `moduleNameMapper` — jest-expo, tsconfig phosphor path'ini
  `lib/typescript/icons` (.d.ts) ile eşliyordu; jest için `lib/commonjs/icons`
  (gerçek JS) üzerine override eklendi. tsconfig/tsc DEĞİŞMEDİ (tipler için o path
  gerekli).
