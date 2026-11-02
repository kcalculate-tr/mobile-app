# G3-S1 — Mağaza Gizlilik Formları (App Store "App Privacy" + Play "Data Safety")

**Tarih:** 2026-11-03 · **Dal:** night3/store-fixes
**Amaç:** İki mağaza konsolundaki gizlilik formlarının madde madde, **kodda
gerçekten toplanan** veriye dayalı cevapları. Her satırda kod/tablo referansı var.
Bu form **konsolda** doldurulur (repoda değil) — aşağısı birebir kopyalanabilir.

Toplanan verinin tek kaynağı: `app.config.js > ios.privacyManifests` (bu oturumda
eklendi) ile **tutarlı**. Manifest veri tipi ↔ mağaza kategorisi eşlemesi bu
belgede. KVKK metni (`src/data/contractsData.ts`) kategorileri de örtüşüyor.

---

## 1. Veri envanteri (kod referanslı)

| # | Veri | Nerede toplanıyor (kod) | Kimliğe bağlı? | İzleme (Meta)? | Amaç |
|---|------|--------------------------|----------------|----------------|------|
| 1 | E-posta | `src/core/AuthContext.tsx` (OTP/Apple/Google giriş), Supabase auth | Evet | Hayır | Uygulama işlevi, hesap |
| 2 | Ad/soyad | `AuthContext.tsx` (Apple FULL_NAME), `src/lib/postSocialAuth.ts`, `profiles` | Evet | Hayır | Uygulama işlevi |
| 3 | Telefon | `profiles.phone`, `addresses`, `orders` (teslimat) | Evet | Hayır | Uygulama işlevi, teslimat |
| 4 | Adres (fiziksel) | `addresses`, `src/modules/eatkcal/screens/CheckoutScreen.tsx` | Evet | Hayır | Teslimat |
| 5 | Konum (hassas) | `expo-location` — `src/lib/nearestLocation.ts`, `AddressVerificationSheet.tsx` (yalnızca **when-in-use**, `requestForegroundPermissionsAsync`) | Evet | Hayır | En yakın şube / adres doğrulama |
| 6 | Sağlık (boy/kilo/yaş) | `user_nutrition_profiles` — `NutritionProfileScreen.tsx` (BMR/TDEE) | Evet | Hayır | Uygulama işlevi |
| 7 | Fitness (kalori/makro) | `meal_logs` / Tracker | Evet | Hayır | Uygulama işlevi |
| 8 | Fotoğraf | `expo-image-picker` — profil/görsel seçimi (`ProfileScreen.tsx`, `SupportScreen.tsx`) | Evet | Hayır | Uygulama işlevi |
| 9 | Satın alma geçmişi | `orders`, `PaymentScreen.tsx`; Meta `logPurchase` (`src/lib/analytics.ts:66`) | Evet | **Evet** | İşlev, analitik, reklam |
| 10 | Ürün etkileşimi | Meta app events `src/lib/analytics.ts:39-83` (ViewedContent/AddToCart/…) + `analytics_events` (`track()`) | Evet | **Evet** | İşlev, analitik, reklam |
| 11 | Cihaz kimliği (IDFA) | `react-native-fbsdk-next` (`app.config.js`), yalnızca **ATT sonrası** (`analytics.ts:19-22`) | Evet | **Evet** | Üçüncü taraf reklam |
| 12 | Kullanıcı kimliği | Supabase user id — `analytics_events.user_id` | Evet | Hayır | İşlev, analitik |
| 13 | Çökme verisi | Sentry `src/lib/sentry.ts` | Hayır | Hayır | Uygulama işlevi (teşhis) |
| 14 | Performans verisi | Sentry `src/lib/sentry.ts` | Hayır | Hayır | Uygulama işlevi (teşhis) |

> **Sağlık API'si YOK:** HealthKit/Health Connect kullanılmıyor (G2-S4 taraması).
> Boy/kilo/yaş kullanıcı tarafından **elle** giriliyor — yine de "Sağlık/Fitness"
> kategorisinde beyan edilir (kaynak API değil, veri türü önemli).

---

## 2. App Store Connect — "App Privacy" formu

Her veri tipi için: **Data Linked to You** (kimliğe bağlı) ve gerekiyorsa
**Used to Track You** işaretlenir.

### Contact Info
- **Email Address** → Data Linked to You. Purposes: App Functionality. Tracking: Hayır. (envanter #1)
- **Name** → Data Linked to You. App Functionality. Tracking: Hayır. (#2)
- **Phone Number** → Data Linked to You. App Functionality. Tracking: Hayır. (#3)
- **Physical Address** → Data Linked to You. App Functionality. Tracking: Hayır. (#4)

### Health & Fitness
- **Health** → Data Linked to You. App Functionality. Tracking: Hayır. (#6)
- **Fitness** → Data Linked to You. App Functionality. Tracking: Hayır. (#7)

### Location
- **Precise Location** → Data Linked to You. App Functionality. Tracking: Hayır. (#5)

### User Content
- **Photos or Videos** → Data Linked to You. App Functionality. Tracking: Hayır. (#8)

### Purchases
- **Purchase History** → Data Linked to You. Purposes: App Functionality, Analytics, **Third-Party Advertising**. **Used to Track You: EVET** (Meta). (#9)

### Identifiers
- **User ID** → Data Linked to You. App Functionality, Analytics. Tracking: Hayır. (#12)
- **Device ID** → Data Linked to You. Third-Party Advertising. **Used to Track You: EVET** (IDFA, ATT sonrası). (#11)

### Usage Data
- **Product Interaction** → Data Linked to You. App Functionality, Analytics, **Third-Party Advertising**. **Used to Track You: EVET** (Meta). (#10)

### Diagnostics
- **Crash Data** → Data **Not** Linked to You. App Functionality. Tracking: Hayır. (#13)
- **Performance Data** → Data **Not** Linked to You. App Functionality. Tracking: Hayır. (#14)

> **"Used to Track You" = EVET** olan 3 tip (Purchase History, Product Interaction,
> Device ID) → `PrivacyInfo.xcprivacy`'de `NSPrivacyTracking=true` ile tutarlı
> (bu oturumda düzeltildi). ATT istemi var (`analytics.ts:17`), IDFA yalnızca izin
> sonrası (`:19-22`). Bu üçü işaretlenmezse Apple privacy-manifest ↔ label
> tutarsızlığı nedeniyle reddeder.

### "Account Deletion" sorusu
- **EVET, uygulama içinden hesap silme var:** `SecurityScreen.tsx:290-301` →
  `supabase/functions/delete-account/index.ts` (G2-S4 Madde 1).

---

## 3. Google Play — "Data Safety" formu

Her veri için: **Collected** (Evet), **Shared** (üçüncü tarafla paylaşım),
**Processed ephemerally?**, **Required/Optional**.

| Play kategorisi | Veri | Collected | Shared (3. taraf) | Amaç | Envanter |
|-----------------|------|-----------|-------------------|------|----------|
| Personal info | Name | Evet | Hayır | App functionality | #2 |
| Personal info | Email | Evet | Hayır | Account management | #1 |
| Personal info | Phone number | Evet | Hayır | App functionality | #3 |
| Personal info | Address | Evet | Hayır (kurye operasyonel, "service provider") | App functionality | #4 |
| Location | Approximate/precise location | Evet | Hayır | App functionality | #5 |
| Health & fitness | Health info | Evet | Hayır | App functionality | #6, #7 |
| Photos and videos | Photos | Evet | Hayır | App functionality | #8 |
| Financial info | Purchase history | Evet | **Evet** (Meta — advertising) | Analytics, Advertising | #9 |
| App activity | App interactions | Evet | **Evet** (Meta) | Analytics, Advertising | #10 |
| App info & performance | Crash logs | Evet | Hayır | Diagnostics | #13 |
| App info & performance | Diagnostics | Evet | Hayır | Diagnostics | #14 |
| Device or other IDs | Device/advertising ID | Evet | **Evet** (Meta) | Advertising | #11 |

**Güvenlik uygulamaları (Play):**
- Veri aktarımda şifreleniyor (TLS; Supabase + Paynkolay HTTPS, `NSAllowsArbitraryLoads=false`).
- Kullanıcı silme talep edebilir → uygulama içi hesap silme var (yukarıda).

> **Ödeme kartı verisi** uygulamada TOPLANMIYOR/SAKLANMIYOR: Paynkolay hosted
> akışı (G2-S4 Madde 3). Bu yüzden "Payment info" (kart no) beyan edilmez; yalnızca
> satın alma **geçmişi** (#9) beyan edilir.

---

## 4. Değişiklik notu — bu formlar neden şimdi tutarlı
- `app.config.js`'e `ios.privacyManifests` eklendi: `NSPrivacyTracking=true`,
  `NSPrivacyTrackingDomains=[ep1.facebook.com]`, 14 `NSPrivacyCollectedDataTypes`.
- Meta SDK artık ATT öncesi IDFA okumuyor (`isAutoInitEnabled=false`,
  `advertiserIDCollectionEnabled=false`; `analytics.ts` izin sonrası açıyor).
- Yukarıdaki iki form bu manifestle birebir eşleşir; böylece Apple'ın
  manifest↔label çapraz kontrolü ve Play Data Safety tutarlılığı sağlanır.
