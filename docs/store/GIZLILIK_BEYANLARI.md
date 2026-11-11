# Gizlilik beyanları — App Store "App Privacy" + Google Play "Data safety" · 1.1.0 (M-S1 md.3)

Kaynaklar: kod `release/1.1.0` @ bd96421 (`app.config.js` `ios.privacyManifests`), **G26 izin envanteri** (`docs/night/G26-IZINLER.md`),
**L-S3 eşleme tablosu** (`legal/global` › `docs/legal/MAGAZA_GIZLILIK_ESLEME.md`), önceki beyan G20-S2 (bu dosyanın 1.0.x/G20 hâli, git geçmişinde).
İlter kararları (11 Kas): **ATT yok, izleme yok. Ses kaydedilmez; konuşma tanıma cihazda** (desteklemeyen cihazda işletim sisteminin
konuşma hizmeti — ses bize gelmez). Konum yalnız eatkcal adresi için.

> **⚠ L-S3'ten fark:** L-S3 (yazıldığı an `0401d64`) "eatkcal ticaret olayları + IDFA ATT ile Meta'ya → İzleme: Evet" diyor. G26-S1 (11 Kas) ATT'yi
> kaldırdı: `NSPrivacyTracking: false`, IDFA toplanmaz (`setAdvertiserIDCollectionEnabled(false)`), Meta yalnız ATT'siz toplu ölçüm (AEM/SKAdNetwork).
> Bu nedenle **Apple'da hiçbir türde "Used to Track You" yok**. Diğer bütün satırlar L-S3 ile aynı yönde; farklar §3'te.

## 0. Karar kuralları
- **Toplanan**: cihazdan çıkıp bize ya da işleyenimize (Supabase, Anthropic, RevenueCat, Sentry, Expo, Google Maps, Paynkolay, Meta) giden veri.
  Yalnız cihazda kalan (AsyncStorage) ya da işletim sisteminin kendi hizmetine giden (Apple/Google konuşma tanıma) veri toplanmış sayılmaz.
- **Bağlı (Linked)**: hesap (`user_id`) ya da kalıcı kurulum kimliği (`anon_id`) ile ilişkilendirilebilen.
- **İzleme (Apple)**: bizim verimizi başka şirketlerin verisiyle hedefli reklam/ölçüm için birleştirmek ya da veri komisyoncusuna vermek. ATT yok,
  IDFA yok, Meta'ya giden olaylar toplu ölçüm → **izleme yok**.
- **Paylaşım (Play)**: hizmet sağlayıcıya (işleyen) aktarım paylaşım değildir. **Meta'ya reklam ölçümü aktarımı paylaşımdır** (rızaya bağlı, kapatılabilir).
- **Koç** (`koc` bayrağı 1.1.0'da kapalı) kodda var ve uzaktan açılabilir → verileri beyanda **şimdiden** kapsanır (yeni tür gerektirmiyor:
  Health + Other User Content; Play'de "Other in-app messages"). Beyan derlemenin yeteneğini kapsar (L-S3 Play not 2).

## 1. App Store Connect › App Privacy

**Data Used to Track You:** — (boş) · **Data Not Linked to You:** — (boş; hepsi bağlı) · **Data Linked to You:** aşağıdaki tablonun tamamı.

ASC formunda her tür için üç soru: (1) amaçlar, (2) kimliğe bağlı mı, (3) izleme için mi. Tablo bu sırayla.

| # | Apple veri türü | Amaçlar | Bağlı | İzleme | Hangi veri / ne zaman | Kanıt |
|---|---|---|---|---|---|---|
| 1 | Contact Info › Name | App Functionality | Evet | Hayır | Ad soyad (hesap, teslimat); Apple ile Girişte ad | `postSocialAuth.ts`, `profiles.full_name` |
| 2 | Contact Info › Email Address | App Functionality | Evet | Hayır | Giriş (e-posta kodu), destek | `AuthContext.tsx` |
| 3 | Contact Info › Phone Number | App Functionality | Evet | Hayır | eatkcal teslimat iletişimi | `orders.phone`, `addresses.contact_phone` |
| 4 | Contact Info › Physical Address | App Functionality | Evet | Hayır | eatkcal teslimat adresi | `addresses` |
| 5 | Location › Precise Location | App Functionality | Evet | Hayır | **Yalnız eatkcal**: kullanıcı "Konumumu kullan"a dokununca adres doğrulama / en yakın şube (G26: açılışta sorulmaz) | `addressGeocode.ts` `requestLocationPermission` |
| 6 | Health & Fitness › Health | App Functionality | Evet | Hayır | Boy, kilo, yaş, cinsiyet, hedef, vücut ölçüleri; AI tarama sonucu; (Koç açılınca) Koç'a giden günlük özet | `takibe/save.ts`, `coach-chat/index.ts` |
| 7 | Health & Fitness › Fitness | App Functionality | Evet | Hayır | Öğün, kalori, makro, su, etkinlik (fotoğraf, ses, barkod, elle) | `meal_consumptions`, `water_daily`, `activity_logs` |
| 8 | User Content › Photos or Videos | App Functionality | Evet | Hayır | AI tarama fotoğrafı (Anthropic'e tahmin için, ilk analizden önce izin `ai_photo`), Keşfet foto/video, avatar, destek eki | `analyze-ai-scan`, `kesfet/media.ts` |
| 9 | User Content › Audio Data | App Functionality | Evet | Hayır | **Yalnız Keşfet video gönderisinin ses izi.** Sesli giriş ses toplamaz (`recordingOptions` yok; ses dosyası sunucuya gitmez) | `pickVideo.ts`, `speech.ts:60` |
| 10 | User Content › Customer Support | App Functionality | Evet | Hayır | Destek talepleri | `SupportScreen.tsx`, `support_tickets` |
| 11 | User Content › Other User Content | App Functionality | Evet | Hayır | Gönderi, yorum, değerlendirme; **AI tarama notu**; **sesli girişin yazıya dökülmüş metni** (Anthropic'e öğelere ayırma için); (Koç açılınca) Koç mesajları, 30 gün | `analyze-ai-scan`, `g24_coach.sql` |
| 12 | Financial Info › Payment Info | App Functionality | Evet | Hayır | eatkcal'da kayıtlı kart: son 4 hane, marka, banka, Paynkolay kart jetonu (kart numarası uygulamaya girilmez). **Abonelik ödemesini Apple alır, bize kart bilgisi gelmez** | `src/lib/cards.ts`, `user_card_secrets` — ⚠ §3 Ç2 |
| 13 | Purchases › Purchase History | App Functionality, Analytics, Third-Party Advertising | Evet | **Hayır** | eatkcal siparişleri (rızayla Meta'ya toplu ölçüm); **kcalAI abonelik geçmişi** (RevenueCat: ürün, dönem, deneme, bitiş — yalnız App Functionality + Analytics, Meta'ya gitmez) | `orders`, `g22_s1_subscriptions.sql`, `events.ts` |
| 14 | Usage Data › Product Interaction | App Functionality, Analytics, Third-Party Advertising | Evet | **Hayır** | Birinci taraf olaylar (kapatılabilir); eatkcal ticaret olayları rızayla Meta'ya (toplu); `paywall_view`, `sub_*`, `coach_*` yalnız birinci taraf | `analytics.ts`, `metrics/queue.ts`, `events.ts` |
| 15 | Identifiers › User ID | App Functionality, Analytics | Evet | Hayır | Supabase kullanıcı kimliği; RevenueCat `app_user_id` = aynı kimlik; Sentry `setUser` | `useSubscriptionBootstrap.ts`, `sentry.ts` |
| 16 | Identifiers › Device ID | Analytics, App Functionality | Evet | **Hayır** | Birinci taraf `anon_id` (kurulum kimliği); RevenueCat SDK'nın IDFV'si (abonelik eşleme). **IDFA YOK** | `analytics.ts` — ⚠ §3 Ç4 |
| 17 | Diagnostics › Crash Data | App Functionality | Evet | Hayır | Sentry (kullanıcı UUID'li) | `sentry.ts` |
| 18 | Diagnostics › Performance Data | App Functionality | Evet | Hayır | Sentry performans örneklemesi | `sentry.ts` |
| — | Contacts · Browsing History · Search History · Sensitive Info · Emails or Text Messages · Gameplay · Coarse Location · Credit Info · Other Financial Info · Advertising Data · Other Usage Data · Other Diagnostic Data · Other Data | **Toplanmıyor** | — | — | Keşfet araması sunucuya kaydedilmez; konum yalnız "precise" izinle | — |

Ek ASC alanları: **Gizlilik Politikası URL'si** TR `https://eatkcal.com/gizlilik-politikasi`, EN `https://eatkcal.com/en/legal/privacy` ·
**User Privacy Choices URL** (isteğe bağlı) `https://eatkcal.com/account-deletion` · Hesap silme uygulama içinde (Profil › Güvenlik › Hesabımı sil) ·
Apple ile Giriş jeton iptali var (`supabase/functions/_shared/apple-auth.ts`).

### 1a. Manifest ↔ etiket (iOS `PrivacyInfo.xcprivacy`, `app.config.js`)
| Konu | Manifest (bugün) | ASC etiketi (bu dosya) | Durum |
|---|---|---|---|
| `NSPrivacyTracking` | `false` | izleme yok | ✔ |
| Tür listesi | 18 tür (1–18 ile aynı) | 18 tür | ✔ |
| Purchase History / Product Interaction amaçları | AppFunctionality + Analytics + ThirdPartyAdvertising | aynı | ✔ (alternatif amaç §3 Ç3) |
| Device ID amacı | yalnız Analytics | Analytics + App Functionality | ⚠ Ç4 — RevenueCat kendi SDK manifestinde beyan eder; ASC toplamı yansıtır. İstenirse manifeste de eklenir (kod işi, bu oturumda yapılmadı) |
| Payment Info | var | var | ✔ (L-S3 "Hayır" önerisiyle fark — Ç2) |

## 2. Google Play Console › Uygulama içeriği › Veri güvenliği — soru soru

### 2.1 Veri toplama ve güvenlik
| Soru | Cevap | Not |
|---|---|---|
| Uygulamanız gerekli kullanıcı veri türlerinden herhangi birini topluyor ya da paylaşıyor mu? | **Evet** | |
| Uygulamanızın topladığı tüm kullanıcı verileri aktarım sırasında şifreleniyor mu? | **Evet** | TLS (Supabase, Sentry, RevenueCat, Meta, Anthropic) |
| Kullanıcıların verilerinin silinmesini isteyebilecekleri bir yol sağlıyor musunuz? | **Evet** | Uygulama içi Profil › Güvenlik › Hesabımı sil + web |
| Uygulamanız kullanıcıların hesap oluşturmasına izin veriyor mu? | **Evet** — e-posta kodu, Google ile, Apple ile (OAuth) | |
| Hesap silme URL'si | `https://eatkcal.com/account-deletion` | ⚠ sayfa canlı (200); EN `/en/account-deletion` henüz 404 (web deploy) |
| Hesabı silmeden bazı verilerin silinmesini istemenin yolu var mı? | **Evet** | Gönderi/yorum silme, öğün kaydı silme, (Koç açılınca) Koç geçmişini silme |
| Bağımsız güvenlik incelemesi (MASA) | Hayır | |
| Aileler politikası kapsamında mı / çocuklara yönelik mi? | Hayır (18+) | |

### 2.2 Veri türleri (her biri için: toplanıyor mu · paylaşılıyor mu · anlık mı · zorunlu mu · amaçlar)
| Play kategori › tür | Toplanıyor | Paylaşılıyor | Anlık (ephemeral) | Zorunlu / İsteğe bağlı | Amaçlar | Hangi veri |
|---|---|---|---|---|---|---|
| Konum › Yaklaşık konum | Evet | Hayır | Hayır | İsteğe bağlı | Uygulama işlevi | `ACCESS_COARSE_LOCATION` manifestte; yalnız eatkcal adresi |
| Konum › Kesin konum | Evet | Hayır | Hayır | İsteğe bağlı | Uygulama işlevi | Yalnız kullanıcı "Konumumu kullan"a dokununca |
| Kişisel bilgiler › Ad | Evet | Hayır | Hayır | İsteğe bağlı (takip) / sipariş için gerekli | Uygulama işlevi, Hesap yönetimi | |
| Kişisel bilgiler › E-posta adresi | Evet | Hayır | Hayır | Zorunlu | Uygulama işlevi, Hesap yönetimi | Giriş |
| Kişisel bilgiler › Kullanıcı kimlikleri | Evet | Hayır | Hayır | Zorunlu | Uygulama işlevi, Analiz, Hesap yönetimi | `user_id`, RevenueCat `app_user_id` (işleyen) |
| Kişisel bilgiler › Adres | Evet | Hayır | Hayır | İsteğe bağlı | Uygulama işlevi | eatkcal teslimat |
| Kişisel bilgiler › Telefon numarası | Evet | Hayır | Hayır | İsteğe bağlı | Uygulama işlevi | eatkcal teslimat |
| Finansal bilgiler › Kullanıcı ödeme bilgileri | Evet | Hayır | Hayır | İsteğe bağlı | Uygulama işlevi | eatkcal kayıtlı kart (son 4, marka, jeton). **Abonelik ödemesini Google Play alır** — ⚠ Ç2 |
| Finansal bilgiler › Satın alma geçmişi | Evet | **Evet (Meta — yalnız eatkcal siparişleri, rızayla)** | Hayır | İsteğe bağlı | Uygulama işlevi, Analiz, Reklam veya pazarlama | eatkcal siparişleri; kcalAI abonelik geçmişi (Meta'ya gitmez) |
| Sağlık ve fitness › Sağlık bilgileri | Evet | Hayır | Hayır | İsteğe bağlı | Uygulama işlevi | Boy, kilo, hedef, ölçüler; AI sonucu; (Koç) günlük özet → Anthropic = işleyen |
| Sağlık ve fitness › Fitness bilgileri | Evet | Hayır | Hayır | İsteğe bağlı | Uygulama işlevi | Öğün, su, etkinlik (foto, ses, barkod, elle) |
| Mesajlar › Diğer uygulama içi mesajlar | Evet | Hayır | Hayır | İsteğe bağlı | Uygulama işlevi | Destek talebi mesajları; (Koç açılınca) Koç sohbeti, 30 gün |
| Fotoğraflar ve videolar › Fotoğraflar | Evet | Hayır | Hayır | İsteğe bağlı | Uygulama işlevi | AI tarama (Anthropic = işleyen), Keşfet, avatar, destek eki |
| Fotoğraflar ve videolar › Videolar | Evet | Hayır | Hayır | İsteğe bağlı | Uygulama işlevi | Keşfet video |
| Ses dosyaları › Ses veya ses kayıtları | **Hayır** | — | — | — | — | Sesli giriş kayıt tutmaz; tanıma cihazda ya da işletim sisteminin hizmetinde (bize gelmez) — L-S3 Play not 1 |
| Ses dosyaları › Diğer ses dosyaları | Evet | Hayır | Hayır | İsteğe bağlı | Uygulama işlevi | Keşfet video ses izi |
| Uygulama etkinliği › Uygulama etkileşimleri | Evet | **Evet (Meta — rızayla)** | Hayır | İsteğe bağlı | Analiz, Reklam veya pazarlama | Birinci taraf ölçüm (kapatılabilir) + eatkcal ticaret olayları |
| Uygulama etkinliği › Kullanıcı tarafından oluşturulan diğer içerikler | Evet | Hayır | Hayır | İsteğe bağlı | Uygulama işlevi | Gönderi, yorum, değerlendirme, AI tarama notu, sesli girişin döküm metni |
| Uygulama etkinliği › Diğer işlemler | Evet | Hayır | Hayır | Zorunlu | Uygulama işlevi, Analiz, Sahtekârlığı önleme, güvenlik ve uyumluluk | Günlük AI/barkod hak sayaçları; kaynak takibi (kutu/saha kodu, UTM) |
| Uygulama bilgileri ve performans › Kilitlenme günlükleri | Evet | Hayır | Hayır | Zorunlu | Analiz | Sentry |
| Uygulama bilgileri ve performans › Teşhis | Evet | Hayır | Hayır | Zorunlu | Analiz | Sentry performans |
| Cihaz veya diğer kimlikler | Evet | **Evet (Meta — GAID, rızayla)** | Hayır | İsteğe bağlı (GAID) | Analiz, Reklam veya pazarlama | GAID (`AD_ID`), `anon_id`, Expo push jetonu, RevenueCat tanımlayıcıları (işleyen) |
| Web'de gezinme · Kişiler · Takvim · SMS · E-postalar · Uygulama listesi · Etnik köken vb. hassas | Hayır | — | — | — | — | |

**Reklam kimliği beyanı** (Uygulama içeriği › Reklam kimliği): **Evet** — Meta SDK, amaç Analiz + Reklam (ölçüm). Uygulamada reklam
gösterilmez ("Reklam içerir: Hayır"). Android'de ATT karşılığı yok; Meta yalnız uygulama içi "Reklam ölçümü" açıkken.

## 3. Tutarlılık ve açık noktalar
| # | Konu | Bu dosya | G26 / L-S3 / kod | Öneri |
|---|---|---|---|---|
| Ç1 | İzleme | Apple: hiçbir türde izleme yok | G26 ✔; L-S3 "Evet" (G26 öncesi) | L-S3 tablosu güncellenmeli (legal/global) — bu oturum dokunmadı |
| Ç2 | Payment Info | **Evet** (Apple + Play), yalnız eatkcal kayıtlı kartı | Manifest `PaymentInfo` var; L-S3 "Hayır, Other Financial Info değerlendirilsin" | İhtiyatlı **Evet** (manifest ile aynı, kod değişikliği yok). İlter/hukuk "Hayır" derse manifest + iki form birlikte değişir (SORULAR 3) |
| Ç3 | Purchase History / Product Interaction amacı | Third-Party Advertising (manifest ile aynı) | Apple tanımında Meta'nın **bizim** reklamımızı göstermesi "Developer's Advertising or Marketing"e daha yakın | Değiştirilirse manifest de değişir (yeni derleme gerekir) → 1.1.0'da manifestle aynı kalsın; 1.1.x'te düzelt (SORULAR 4) |
| Ç4 | Device ID amacı | Analytics + App Functionality | Manifest yalnız Analytics; L-S3 not 3 (RevenueCat IDFV) | ASC'de ikisi; manifest farkı RevenueCat SDK manifestiyle kapanır |
| Ç5 | Ses | Apple Audio Data yalnız video; Play "Ses kayıtları: Hayır" | G26/G25 `speech.ts`: iOS cihazda (destek yoksa Apple), Android cihazda (yoksa Google), `recordingOptions` yok | ✔ — İzin metni (`NSSpeechRecognitionUsageDescription`) "telefonunda yazıya çevirmek" diyor; Apple sunucusu yedeği için metin ihtiyatlı mı? (SORULAR 5) |
| Ç6 | Konum | Yalnız eatkcal, kullanıcı dokununca | G26 ✔ | ✔ |
| Ç7 | AI'ya fotoğraf (5.1.2(i)) | İlk analizden önce `ai_photo` izni | G26 §2 #3 ✔ | ✔ (G20'deki P0 risk kapandı) |
| Ç8 | Koç verileri | Şimdiden beyanda | Bayrak kapalı | Koç açılırken beyan değişmez; yalnız açıklama metni (YAYIN_KONTROL D) |
| Ç9 | Destek mesajı kategorisi (Play) | Diğer uygulama içi mesajlar | L-S3: Other UGC | İkisi de kabul; Koç mesajlarıyla aynı yere konuldu |
