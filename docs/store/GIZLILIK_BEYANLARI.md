# Gizlilik beyanları — App Store "App Privacy" + Google Play "Data safety" (G20-S2 md.3)

Kaynak: **kod** (`night20/store`, taban `night20/consent` = G20-S1 rıza akışı dahil). Her satırın kanıtı `dosya:satır`.
Karşılaştırma: L-S1 veri envanteri (`legal/global` › `docs/legal/VERI_ENVANTERI.md`, `BOSLUKLAR.md` B-07) ve
G3-S1 (`docs/night/G3-S1-STORE_FORMS.md`, 3 Kas). **⚠ = L-S1/G3-S1 ile çelişki veya fark** — "Çelişkiler" bölümünde.
Bu tablolar 1.1.0 ile **aynı anda** konsola girilir; iOS gizlilik manifesti (`app.config.js` `privacyManifests`)
bu oturumda aynı cevaplara hizalandı (18 veri türü).

## ⚠ G26-S1 değişikliği (11 Kas — İlter kararı: ATT kaldırıldı)
- iOS'ta **App Tracking Transparency sorusu YOK**; `NSUserTrackingUsageDescription` Info.plist'te yok, IDFA **toplanmaz**
  (`setAdvertiserTrackingEnabled(false)` + `setAdvertiserIDCollectionEnabled(false)` sabit — `src/lib/analytics.ts` `initFBSDK`).
- Meta reklam olayları ATT'siz (AEM / SKAdNetwork, toplu ölçüm) yalnız uygulama içi "Reklam ölçümü" tercihi reddedilmediyse gider
  (`src/lib/metrics/consent.ts` `metaAllowed`).
- Gizlilik manifesti: `NSPrivacyTracking: false`, `NSPrivacyTrackingDomains` yok; hiçbir veri türünde `Tracking: true` yok.
  Device ID yalnız birinci taraf `anon_id` → amaç yalnız **Analytics**.
- **App Store Connect › App Privacy güncellenmeli** (1.1.0 gönderiminden önce): "Data Used to Track You" → **boş** (Purchase History,
  Product Interaction, Device ID için "Used for tracking" = Hayır). Purchase History / Product Interaction "Third-Party Advertising"
  amacı kalır (Meta'ya toplu ölçüm). Aşağıdaki tablolardaki "İzleme = Evet" hücreleri G20-S2 hâlidir; G26 sonrası hepsi **Hayır**.
- Play "Data safety" değişmez (Android'de ATT yok; reklam kimliği rızaya bağlı, `AD_ID` beyanı aynı).

## Tanımlar (karar kuralları)
- **Toplanıyor**: veri cihazdan çıkıp bizim ya da işleyenimizin sunucusuna gidiyor (Supabase, Anthropic, Sentry, Meta, Google Maps…).
  Yalnız cihazda kalan (AsyncStorage) veri toplanmış sayılmaz.
- **Kimliğe bağlı (Linked)**: hesap (`user_id`) ya da kalıcı cihaz kimliğiyle ilişkilendirilebiliyor.
- **İzleme (Tracking, Apple)**: bizim verimizin başka şirketlerin verisiyle reklam/ölçüm için birleştirilmesi → **Meta**'ya giden olaylar + IDFA.
  ATT izni yoksa (veya uygulama içi reklam ölçümü kapalıysa) gönderilmez (`src/lib/metrics/consent.ts:26-30`).
- **Paylaşım (Play)**: işleyen (hizmet sağlayıcı: Supabase, Anthropic, Sentry, Expo, Google Maps, Paynkolay, Resend) aktarımı paylaşım **değil**;
  Meta'ya reklam ölçümü aktarımı **paylaşım**.

## 1. App Store Connect › App Privacy

**Data Used to Track You** (izleme): Purchase History · Product Interaction · Device ID.
**Data Linked to You**: aşağıdaki tablodaki "Bağlı = Evet" satırlarının tamamı. **Data Not Linked to You**: yok (⚠ Crash/Performance artık bağlı).

| Apple veri türü | Toplanıyor | Bağlı | İzleme | Amaçlar | Kanıt (kod) | L-S1 / G3-S1 |
|---|---|---|---|---|---|---|
| Contact Info › Name | Evet | Evet | Hayır | App Functionality | `src/screens/PersonalInfoScreen.tsx` (profiles.full_name), Apple FULL_NAME `src/lib/postSocialAuth.ts` | aynı |
| Contact Info › Email Address | Evet | Evet | Hayır | App Functionality | `src/core/AuthContext.tsx:283-300` (OTP), destek `support_tickets.user_email` | aynı |
| Contact Info › Phone Number | Evet | Evet | Hayır | App Functionality | `src/lib/postSocialAuth.ts`, `orders.phone`, `addresses.contact_phone` (CANLI_SEMA) | aynı |
| Contact Info › Physical Address | Evet | Evet | Hayır | App Functionality | `src/screens/AddressesScreen.tsx`, `addresses` (CANLI_SEMA) | aynı |
| Health & Fitness › Health | Evet | Evet | Hayır | App Functionality | boy/kilo/yaş/cinsiyet/hedef `src/modules/onboarding/takibe/save.ts:32,51`; vücut ölçüleri `body_measurements` | aynı (L-S1 ★ AI fotoğrafını da bu bağlamda sayar) |
| Health & Fitness › Fitness | Evet | Evet | Hayır | App Functionality | `meal_consumptions`, `water_daily`, `activity_logs` (CANLI_SEMA) | aynı |
| Financial Info › Payment Info | **Evet** | Evet | Hayır | App Functionality | kayıtlı kart son 4/marka/banka `src/lib/cards.ts:9-10`; jeton `user_card_secrets.card_token` (CANLI_SEMA) | ⚠ L-S1 "Hayır, değerlendirilsin", G3-S1 Hayır |
| Location › Precise Location | Evet | Evet | Hayır | App Functionality | `src/components/checkout/AddressVerificationSheet.tsx:148,174`, `src/lib/nearestLocation.ts:80`; `addresses.latitude/longitude` | aynı |
| User Content › Photos or Videos | Evet | Evet | Hayır | App Functionality | AI tarama yükleme `src/modules/ai/scan/client.ts:44` → Anthropic `supabase/functions/analyze-ai-scan/index.ts:233`; Keşfet `src/modules/kesfet/media.ts`; avatar; destek eki | aynı (L-S1 ★ kapsam) |
| User Content › Audio Data | **Evet** | Evet | Hayır | App Functionality | galeriden seçilen video gönderisinin ses izi `src/modules/media/video/pickVideo.ts:14-15` | aynı (L-S1 ★) · G3-S1'de yoktu |
| User Content › Customer Support | **Evet** | Evet | Hayır | App Functionality | `src/screens/profile/SupportScreen.tsx:186` | aynı (L-S1 ★) |
| User Content › Other User Content | **Evet** | Evet | Hayır | App Functionality | gönderi `src/modules/kesfet/client.ts:165` (`create_post`), yorum `post_comments`, değerlendirme `reviews` | aynı (L-S1 ★) |
| Identifiers › User ID | Evet | Evet | Hayır | App Functionality, Analytics | `analytics_events.user_id` `src/lib/analytics.ts:300-320`; Sentry `setUser` | aynı |
| Identifiers › Device ID | Evet | Evet | **Evet** | Third-Party Advertising, **Analytics** | IDFA yalnız ATT sonrası `src/lib/analytics.ts:157-170`; `anon_id` kalıcı kurulum kimliği `src/lib/analytics.ts:244,315` | aynı (L-S1 ★ Analytics) |
| Purchases › Purchase History | Evet | Evet | **Evet** | App Functionality, Analytics, Third-Party Advertising | `orders`; Meta `logPurchase` `src/lib/analytics.ts:230` | aynı |
| Usage Data › Product Interaction | Evet | Evet | **Evet** | App Functionality, Analytics, Third-Party Advertising | Meta `logEvent` `src/lib/analytics.ts:181`; birinci taraf `analytics_events` (`src/lib/metrics/queue.ts`); kaynak takibi (kutu/saha kodu, UTM) `src/lib/metrics/attribution.ts` | aynı |
| Diagnostics › Crash Data | Evet | **Evet** | Hayır | App Functionality | `src/lib/sentry.ts:68` `Sentry.setUser({ id })` | ⚠ G3-S1 "Not Linked"; L-S1 ★ Evet ile aynı |
| Diagnostics › Performance Data | Evet | **Evet** | Hayır | App Functionality | `src/lib/sentry.ts:48` `tracesSampleRate: 0.1` | ⚠ G3-S1 "Not Linked"; L-S1 ★ ile aynı |
| Sensitive Info · Contacts · Browsing History · Search History · Emails/Text Messages · Gameplay · Other Diagnostic · Other Financial · Credit Info · Advertising Data · Other Usage Data · Coarse Location | Hayır | — | — | — | kodda bulunamadı (Keşfet araması sunucuya kaydedilmiyor; konum yalnız "precise" izinle alınır) | aynı |

Ek sorular: **Hesap silme** uygulama içinde (Profil › Güvenlik › Hesabımı sil) · **Apple ile Giriş jeton iptali** var
(`supabase/functions/_shared/apple-auth.ts`) · **Gizlilik politikası URL'si**: `APP_STORE_METINLERI.md`.

## 2. Google Play Console › Data safety

**Genel:** Veri toplanıyor/paylaşılıyor = Evet · Aktarımda şifreleme = **Evet** (Supabase/Sentry/Meta HTTPS) ·
Kullanıcı silme isteyebilir = **Evet** (uygulama içi + `https://eatkcal.com/account-deletion`) · Bağımsız güvenlik incelemesi = Hayır ·
Aileler politikası = Hayır (18+).

| Play kategori › tür | Toplanıyor | Paylaşılıyor | Geçici (ephemeral) | Zorunlu / İsteğe bağlı | Amaçlar | Not / kanıt | L-S1 |
|---|---|---|---|---|---|---|---|
| Location › Precise location | Evet | Hayır | Hayır | İsteğe bağlı | App functionality | yalnız ön plan; adres doğrulama, en yakın şube | aynı |
| Location › Approximate location | Evet | Hayır | Hayır | İsteğe bağlı | App functionality | `ACCESS_COARSE_LOCATION` manifestte → Play ayrıca sorar | aynı |
| Personal info › Name | Evet | Hayır | Hayır | Zorunlu (sipariş) / isteğe bağlı (takip) | App functionality, Account management | | aynı |
| Personal info › Email address | Evet | Hayır | Hayır | Zorunlu | App functionality, Account management | giriş | aynı |
| Personal info › User IDs | Evet | Hayır | Hayır | Zorunlu | App functionality, Analytics | `user_id` | aynı |
| Personal info › Address | Evet | Hayır | Hayır | İsteğe bağlı (yalnız sipariş) | App functionality | | aynı |
| Personal info › Phone number | Evet | Hayır | Hayır | İsteğe bağlı (yalnız sipariş) | App functionality | | aynı |
| Financial info › User payment info | **Evet** | Hayır | Hayır | İsteğe bağlı (kart kaydı) | App functionality | son 4 hane/marka/jeton; kart numarası Paynkolay sayfasında | ⚠ L-S1'de satır yok |
| Financial info › Purchase history | Evet | **Evet (Meta)** | Hayır | İsteğe bağlı (rıza) | App functionality, Analytics, Advertising or marketing | Meta yalnız reklam ölçümü açıkken (G20-S1: varsayılan AÇIK, kapatılabilir) | aynı (L-S1 "zorunlu" yazmış: ⚠ paylaşım kısmı rızaya bağlı → isteğe bağlı) |
| Health and fitness › Health info | Evet | Hayır | Hayır | İsteğe bağlı | App functionality | AI analiz için Anthropic'e gider = işleyen, paylaşım değil | aynı |
| Health and fitness › Fitness info | Evet | Hayır | Hayır | İsteğe bağlı | App functionality | öğün, su, etkinlik | aynı |
| Photos and videos › Photos | Evet | Hayır | Hayır | İsteğe bağlı | App functionality | AI tarama, avatar, gönderi, destek eki | aynı |
| Photos and videos › Videos | Evet | Hayır | Hayır | İsteğe bağlı | App functionality | Keşfet video | aynı |
| Audio › Other audio files | Evet | Hayır | Hayır | İsteğe bağlı | App functionality | video ses izi | aynı |
| Messages › Other in-app messages | **Evet** | Hayır | Hayır | İsteğe bağlı | App functionality | destek talebi mesajları (`support_tickets.message`) | ⚠ L-S1 bunu "Other UGC"ye koymuş — Play tanımında destek mesajı "in-app messages"a daha uygun; ikisinden biri seçilmeli |
| App activity › App interactions | Evet | **Evet (Meta)** | Hayır | İsteğe bağlı | Analytics, Advertising or marketing | birinci taraf ölçüm (kapatılabilir) + Meta | aynı |
| App activity › Other user-generated content | Evet | Hayır | Hayır | İsteğe bağlı | App functionality | gönderi, yorum, değerlendirme | aynı |
| App activity › Other actions | Evet | Hayır | Hayır | İsteğe bağlı | Analytics | kaynak takibi (bağlantı türü, kutu/saha kodu, UTM — kişisel yol parçası saklanmaz) | yeni satır (L-S1'de yok) |
| App info and performance › Crash logs | Evet | Hayır | Hayır | Zorunlu | Analytics | Sentry (kullanıcı UUID'li) | aynı |
| App info and performance › Diagnostics | Evet | Hayır | Hayır | Zorunlu | Analytics | Sentry performans %10 | aynı |
| Device or other IDs | Evet | **Evet (Meta)** | Hayır | İsteğe bağlı (GAID); `anon_id` zorunlu | Analytics, Advertising or marketing | GAID (`AD_ID` izni) + `anon_id` + Expo push jetonu | aynı |

**Reklam kimliği beyanı** (Uygulama içeriği): Evet — Meta SDK, amaç: Analytics + Advertising (ölçüm). Uygulamada reklam GÖSTERİLMEZ ("Reklam içerir: Hayır").

## 3. Çelişkiler ve açık noktalar (işaretli)
| # | Konu | Kod | L-S1 / G3-S1 | Öneri |
|---|---|---|---|---|
| Ç1 | **Meta varsayılanı** | G20-S1: hesap oluştururken anahtar **AÇIK** gelir (İlter kararı 9 Kas) | L-S1 B-06: varsayılan **kapalı**, açık rıza (KVKK md.5/1, ePrivacy md.5(3)) | Hukuki karar İlter'de; mağaza beyanı her iki durumda aynı ("izleme Evet", Play "isteğe bağlı"). Apple açısından ATT zaten izin istiyor → mağaza reddi riski yok; KVKK riski L-S1'de |
| Ç2 | Crash/Performance bağlı mı | `sentry.ts:68` setUser → **bağlı** | G3-S1 "Not Linked" (eski form) | Etiket "Linked" (bu oturumda manifest de düzeltildi). Alternatif: `setUser` kaldırılırsa "Not Linked" — kod işi |
| Ç3 | Payment Info | kart jetonu + son 4 hane saklanıyor | L-S1/G3-S1 "Hayır" | **Evet** beyan et (ihtiyatlı; Apple: geliştirici ödeme bilgisine erişebiliyorsa beyan) |
| Ç4 | Destek mesajı Play kategorisi | `support_tickets` | L-S1: Other UGC | Messages › Other in-app messages (öneri) |
| Ç5 | **Üçüncü taraf AI'ya fotoğraf** (Apple 5.1.2(i), Kasım 2025 güncellemesi: "third-party AI" ile paylaşımı açıkça bildir ve **açık izin al**) | Tabak fotoğrafı ve not Anthropic'e (ABD) gidiyor (`analyze-ai-scan/index.ts:233`); uygulamada ilk taramadan önce bunu söyleyen ve izin isteyen ekran YOK (sağlık rızası metni yalnız "hedefimi hesaplamak" diyor, `src/core/i18n/dictionaries.ts:230`) | L-S1 B-01/B-03 hukuken işaretlemiş (yurt dışı aktarım, sağlık rızası AI'yı kapsamalı) | **P0 mağaza riski.** İlk Tara'dan önce bir kez sheet: "Fotoğrafın ve notun kalori tahmini için yapay zekâ sağlayıcımız Anthropic'e (ABD) gönderilir; eğitim için kullanılmaz [teyit]. Kabul et / Vazgeç" + Gizlilik bağlantısı; kabul `user_consents`'e (`ai_processing`). Kod işi — bu oturum yalnız dosya/yapılandırma (SORULAR 1) |
| Ç6 | Kaynak takibi (Play "Other actions") | `attribution.ts` | L-S1'de yok | Satır eklendi; Apple'da Product Interaction kapsıyor |
| Ç7 | Konum yaklaşık | `ACCESS_COARSE_LOCATION` manifestte | L-S1 "Approximate / Precise" tek satır | Play'de iki tür ayrı işaretlenir |

## 4. Manifest ↔ etiket eşlemesi (iOS `PrivacyInfo.xcprivacy`)
`app.config.js` `ios.privacyManifests.NSPrivacyCollectedDataTypes` (bu oturumdan sonra): EmailAddress · Name · PhoneNumber ·
PhysicalAddress · PreciseLocation · Health · Fitness · PhotosorVideos · **AudioData** · **OtherUserContent** · **CustomerSupport** ·
**PaymentInfo** · PurchaseHistory (izleme) · ProductInteraction (izleme) · DeviceID (izleme, **+Analytics**) · UserID ·
CrashData (**bağlı**) · PerformanceData (**bağlı**). Kalın = G20-S2 değişikliği. `NSPrivacyTracking: true`,
`NSPrivacyTrackingDomains: ['ep1.facebook.com']` değişmedi. Doğrulama: yeni derlemede Xcode › Product › Archive ›
"Generate Privacy Report" (YAYIN_KONTROL B4).
