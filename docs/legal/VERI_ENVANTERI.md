# Kişisel Veri Envanteri (KODDAN ÇIKARILMIŞ) — TASLAK

> **Durum:** TASLAK · hukuki inceleme için (İlter Öziseven, avukat) · canlıya/kullanıcıya YAYIN YOK
> **Tarih:** 2026-11-09 · **Dal:** `legal/global` (taban `night19/release`, `da8edf4`)
> **Veri sorumlusu:** SEKULART LTD · MERSİS 0759-1148-7410-0001 · VKN 7591148741 · Basın Sitesi Mah. 177/3 Sk. No:3A, 35150 Karabağlar / İzmir
> **Kapsam:** mobil uygulama (Kcalculate AI + eatkcal modülü, `src/`), Supabase arka ucu (`supabase/`), web (`~/dev/kcal-web`: eatkcal.com + kcalculate.ai), statik açılış sayfası (`landing-page/`, l.eatkcal.com).

## 0. Yöntem ve kanıt gösterimi

- Her satırdaki kanıt `dosya:satır` biçimindedir; yollar repo köküne göredir. `web:` öneki `~/dev/kcal-web` reposunu gösterir.
- `CANLI_SEMA:n` = `.claude/night/CANLI_SEMA_2026-11-09.md` (canlı şemanın salt-okunur anlık görüntüsü) satır n. Çekirdek tabloların (profiles, orders, addresses, user_nutrition_profiles, body_measurements, meal_logs, meal_consumptions, push_tokens, notification_preferences, legal_documents, feedback, reviews, user_cards…) `CREATE TABLE`'ı repoda **yok** (migration geçmişi başlamadan önce Dashboard'dan kurulmuş — `supabase/migrations/20260617000000_paynkolay_user_cards.sql:2`); bu tablolar için sütun kanıtı canlı şema anlık görüntüsüdür.
- "(uygulanmadı)" = migration dosyası var, canlıya uygulanmamış (canlı şemada yok).
- "(yalnız dosya)" = edge function kodu var, dosya başlığına göre **deploy edilmemiş** (`supabase/functions/analyze-ai-scan/index.ts:2`, `supabase/functions/moderate-content/index.ts:2`). Envanter, özellik canlıya alındığında geçerli olacak hâli de kapsar.
- Kod örneklemi elle doğrulandı (delete-account, ATT, bildirim varsayılanları, user-media kovası, rıza kapısı, 18+ anahtarı).
- Hukuki dayanak sütunu **öneridir**; nihai karar avukat incelemesindedir. KVKK md.6 atıfları 7499 sayılı Kanun'la (yürürlük 01.06.2024) değişmiş numaralandırmaya göredir.

### Kısaltmalar (dayanak)

| Kısa | KVKK | GDPR |
|---|---|---|
| SÖZ | md.5/2-c sözleşmenin kurulması/ifası | Art.6(1)(b) |
| HUK | md.5/2-ç hukuki yükümlülük | Art.6(1)(c) |
| MM | md.5/2-f meşru menfaat | Art.6(1)(f) |
| HAK | md.5/2-e hakkın tesisi/kullanılması/korunması | Art.6(1)(f) / Art.9(2)(f) |
| AR | md.5/1 açık rıza | Art.6(1)(a) |
| AR-Ö | md.6/3-a açık rıza (özel nitelikli) | Art.9(2)(a) explicit consent |
| ALN | md.5/2-d alenileştirme (yalnız kullanıcı kendi herkese açık paylaştıysa) | Art.6(1)(b)/(f) |

### Alıcı/işleyen kısaltmaları ve yurt dışı durumu

| Kod | Taraf | Rol (öneri) | Konum | KVKK md.9 (2024) aktarım mekanizması — öneri |
|---|---|---|---|---|
| SUP | Supabase Inc. (DB, Auth, Storage, Edge Functions) | Veri işleyen | Barındırma bölgesi görev tanımına göre **AB**; şirket ABD. Bölge koddan doğrulanamadı (`config.toml`'da bölge yok) → Dashboard'dan teyit | Standart sözleşme (Modül 2: VS→Vİ) + imzadan itibaren **5 iş günü** içinde Kurum'a bildirim. ABD alt işleyen erişimi için Supabase alt işleyen listesi |
| ANT | Anthropic PBC (Claude API — AI tabak tarama, içerik moderasyonu) | Veri işleyen | ABD | Standart sözleşme (Modül 2) + 5 iş günü bildirim; GDPR için Anthropic DPA/SCC |
| SEN | Functional Software Inc. (Sentry) | Veri işleyen | ABD (veya Sentry EU bölgesi — teyit) | Standart sözleşme (Modül 2) + bildirim |
| META | Meta Platforms Ireland / Meta Platforms Inc. (FB SDK App Events) | Bağımsız/ortak veri sorumlusu (toplama aşamasında ortak — CJEU C-40/17 Fashion ID) | İrlanda / ABD | Standart sözleşme (Modül 1: VS→VS) + bildirim; açık rıza (AR) aktarım değil işleme dayanağıdır |
| EXPO | 650 Industries Inc. (Expo Push, EAS Update) | Veri işleyen | ABD | Standart sözleşme (Modül 2) + bildirim |
| APL | Apple Inc. (Apple ile Giriş, APNs, ATT) | Bağımsız veri sorumlusu | ABD/İrlanda | Kullanıcının kendi Apple hesabı ilişkisi; giriş jetonu değişimi için md.9/6-b (sözleşme ifası, arızi) değil — düzenli aktarım → standart sözleşme değerlendirmesi |
| GGL | Google LLC (Google ile Giriş, Maps Geocoding/Static Maps, Android Maps SDK, FCM via Expo) | Sign-In: bağımsız VS; Maps: işleyen/bağımsız (Maps Platform şartlarına göre) | ABD | Standart sözleşme + bildirim |
| PNK | N Kolay Ödeme ve Elektronik Para Kuruluşu A.Ş. (PaynKolay) | Bağımsız veri sorumlusu (6493 s.K. lisanslı ödeme kuruluşu) | Türkiye | Yurt içi aktarım md.8 |
| TSL | Tosla (Akbank grubu) | Eski ödeme sağlayıcı (kodda ölü yol) | Türkiye | Yurt içi; aktif değil |
| ADS | Adisyo (POS/sipariş yönetimi SaaS) | Veri işleyen | Türkiye (teyit) | Yurt içi md.8 + işleyen sözleşmesi |
| TGO | Trendyol Go (pazaryeri) | Bağımsız veri sorumlusu (kendi müşterisi); biz siparişi ifa eden ayrı VS | Türkiye | Yurt içi md.8 |
| KUR | Kurye / teslimat ortakları | İşleyen veya bağımsız VS (sözleşmeye göre) | Türkiye | Yurt içi md.8 |
| VRC | Vercel Inc. (web barındırma) | Veri işleyen | ABD (edge AB) | Standart sözleşme + bildirim |
| RSD | Resend (Plus Five Five Inc.) (işlem e-postası) | Veri işleyen | ABD | Standart sözleşme + bildirim |
| MUH | Mali müşavir / e-fatura entegratörü | İşleyen / bağımsız VS | Türkiye | Yurt içi md.8 |
| KAM | Yetkili kamu kurum ve kuruluşları | Alıcı | Türkiye | md.8/2 |

> **Önemli:** Bugünkü web ve uygulama metinleri "kişisel verileriniz yurt dışına aktarılmaz" diyor (`web:apps/eatkcal/content/legal/gizlilik.ts:135-137`, `web:apps/eatkcal/content/legal/kvkk.ts:146-156`). Kod bunun **doğru olmadığını** gösteriyor (SUP, ANT, SEN, META, EXPO, GGL, VRC, RSD). Bkz. `BOSLUKLAR.md` B-01.

---

## 1. Veri kategorileri × amaç × dayanak × saklama × alıcı × kanıt

Saklama süreleri **öneridir**; dayanağı `tr/09-saklama-ve-imha-politikasi.md`'de.

### 1.1 Kimlik

| Veri | Amaç | Dayanak (KVKK / GDPR) | Saklama önerisi | Alıcılar | Yurt dışı | Kanıt |
|---|---|---|---|---|---|---|
| Ad, soyad, tam ad (`profiles.full_name/first_name/last_name`) | Hesap, sipariş teslimi, sipariş iletişimi | SÖZ | Hesap süresince + silmeden sonra 30 gün (yedek döngüsü); siparişte anonimleştirilmiş isim | SUP, ADS, KUR, TGO (pazaryeri siparişi), RSD (şube e-postası) | Evet (SUP/RSD) | `supabase/migrations/20260515000000_profiles_first_last_name.sql:3-4`; yazım `src/screens/PersonalInfoScreen.tsx:199-204`, `src/modules/profil/ui/screens/SettingsPersonalScreen.tsx:211-219`; `CANLI_SEMA:73` |
| Apple ile Giriş adı/e-postası | Kimlik doğrulama, hesap | SÖZ | Hesap süresince | APL, SUP | Evet | `src/core/AuthContext.tsx:316-322` (FULL_NAME+EMAIL), `:340-346` (user_metadata) |
| Apple yenileme jetonu (`user_apple_tokens.refresh_token`) | Hesap silmede Apple erişimini iptal (App Store 5.1.1(v)) | HUK/MM | Hesap silinince silinir | APL, SUP | Evet | `supabase/migrations/20260917292000_user_apple_tokens.sql:6-7`; `supabase/functions/_shared/apple-auth.ts:68,90`; silme `supabase/functions/delete-account/index.ts:155-177,229` |
| Google ile Giriş kimliği (e-posta, ad) | Kimlik doğrulama | SÖZ | Hesap süresince | GGL, SUP | Evet | `src/core/AuthContext.tsx:34-37,378,387,392-397` |
| Kullanıcı kimliği (UUID), herkese açık kullanıcı adı (`handle`), biyografi, profil gizliliği | Hesap, Keşfet profili | SÖZ | Hesap süresince | SUP; handle/bio diğer kullanıcılara görünür | Evet | `supabase/migrations/20261104000100_profiles_social_columns.sql:18-20`; `src/modules/profil/client.ts:28-69` |
| Profil fotoğrafı (`avatars/{uid}.{ext}`) | Profil | SÖZ (isteğe bağlı) | Hesap süresince; silmede kaldırılmalı (**bugün kaldırılmıyor**) | SUP; görünürlük kovaya bağlı | Evet | `src/modules/profil/avatarUpload.ts:24-35`; politika `supabase/migrations/20261021132721_storage_policy_hardening.sql:38-49` |
| Silinmiş hesap parmak izi (telefon+e-posta SHA-256) | Kupon/ilk sipariş istismarını önleme | MM | **Öneri:** 2 yıl (bugün süresiz) | SUP | Evet | `supabase/migrations/20260917294000_coupon_guard_fingerprint_and_phone_normalize.sql:8-12`; `supabase/functions/delete-account/index.ts:124-149` |
| Yaş teyidi (18+) | Yaş sınırının uygulanması | HUK/MM | Hesap süresince (bugün yalnız cihazda) | — | — | `src/screens/auth/UnifiedLoginScreen.tsx:21,139-143,147-149`; `src/modules/onboarding/v2/loginLogic.ts:7` |

### 1.2 İletişim

| Veri | Amaç | Dayanak | Saklama önerisi | Alıcılar | Yurt dışı | Kanıt |
|---|---|---|---|---|---|---|
| E-posta (auth, `profiles.email`) | Giriş (e-posta kodu), hesap bildirimleri | SÖZ | Hesap süresince | SUP | Evet | `src/core/AuthContext.tsx:249,260,286-289,300`; `CANLI_SEMA:73` |
| Telefon (`profiles.phone`, `addresses.contact_phone`, `orders.phone`) | Teslimat iletişimi | SÖZ | Hesap süresince; siparişte silmede null'lanır | SUP, ADS, KUR, RSD (şube e-postası) | Evet | `src/lib/postSocialAuth.ts:27-32`; `src/lib/orders.ts:290-320`; `supabase/functions/adisyo-save-order/index.ts:336-350`; `supabase/functions/order-alert/index.ts:209-216` |
| Destek talebi (e-posta, konu, mesaj, ek fotoğraf, push jetonu) | Müşteri desteği, şikâyet yönetimi | SÖZ / HAK | 3 yıl (TKHK zamanaşımı/şikâyet ispatı) | SUP, RSD | Evet | `supabase/migrations/20260309000000_support_tickets.sql:1-12`; `src/screens/profile/SupportScreen.tsx:163-195`; `supabase/functions/order-alert/index.ts:95-151` |
| Geri bildirim (`feedback.user_email`, puan, mesaj) | Hizmet iyileştirme | MM | 2 yıl | SUP | Evet | `src/screens/FeedbackScreen.tsx:67-74`; `CANLI_SEMA:40` |
| eatkcal bekleme listesi (ad, telefon, e-posta, şehir, ilçe, restoran) (uygulanmadı) | Hizmet bölgeye açılınca bilgilendirme | AR (bilgilendirme pazarlama niteliğindeyse) / MM | Bölge açılınca veya 12 ay | SUP | Evet | `supabase/migrations/20261108000300_g18_eatkcal_waitlist.sql:8-20`; `src/modules/eatkcal/v2/ui/gate/waitlistSend.ts:16,41` |
| Web formları (`web_leads`: bülten, iş birliği, restoran ekle, destek, haber ver, creator başvurusu) (uygulanmadı) | Formun amacı; pazarlama yalnız onayla | SÖZ öncesi (md.5/2-c) / MM; pazarlama AR + ETK onayı | Amaç bitince veya 12 ay; onay kaydı onay geri alınınca + 3 yıl | SUP, VRC | Evet | `web:apps/eatkcal/app/api/lead/route.ts:20-57`; `web:packages/ui/src/lead-contract.ts:3-16`; `supabase/migrations/20261107000100_web_leads.sql:2,7-34` |

### 1.3 Konum ve adres

| Veri | Amaç | Dayanak | Saklama önerisi | Alıcılar | Yurt dışı | Kanıt |
|---|---|---|---|---|---|---|
| Teslimat adresi (adres metni, il/ilçe/mahalle/sokak/bina/kat/daire, alıcı adı/telefon/e-posta) | Teslimat | SÖZ | Kullanıcı silene veya hesap silinene kadar | SUP, ADS, KUR, RSD | Evet | `src/types/index.ts:217-244`; `src/screens/AddressesScreen.tsx:696-824`; `src/modules/eatkcal/v2/model/addressSave.ts:57-95`; `CANLI_SEMA:5` |
| Adres koordinatı (lat/lng, `verified_at`) | Teslimat noktası doğrulama | SÖZ | Adresle birlikte | SUP, GGL | Evet | `supabase/migrations/20260918130000_addresses_geo_verification.sql:6-8`; `src/modules/eatkcal/screens/CheckoutScreen.tsx:1470-1473` |
| Cihaz konumu (yalnız ön planda, "uygulama kullanılırken") | En yakın şube, bölge, adres doğrulama | SÖZ (kullanıcı talebi) + işletim sistemi izni; GDPR: ePrivacy için izin | Sunucuda ham konum tutulmaz (adres koordinatı hariç); cihazda `kcal-delivery-context` | GGL (ters coğrafi kodlama), SUP | Evet | `app.config.js:66-67`; `src/lib/nearestLocation.ts:37-38,72-80`; `src/components/checkout/AddressVerificationSheet.tsx:51,143-174`; `src/store/deliveryContextStore.ts:19-23,73` |
| Yazılan adres metni → Google ileri coğrafi kodlama; Static Maps URL'lerinde koordinat | Harita/adres doğrulama | SÖZ | Google'ın kendi saklaması | GGL | Evet | `src/screens/AddressesScreen.tsx:443,898,1043`; `src/modules/eatkcal/screens/CheckoutScreen.tsx:1436,2360` |
| Bilinen cihazlar (`user_known_devices.device_id`) | Güvenlik / istismar önleme | MM | 12 ay hareketsizlikte sil | SUP | Evet | `supabase/migrations/20260916250000_user_known_devices.sql:5-10` |

### 1.4 Sipariş ve ödeme

| Veri | Amaç | Dayanak | Saklama önerisi | Alıcılar | Yurt dışı | Kanıt |
|---|---|---|---|---|---|---|
| Sipariş kaydı (müşteri adı, e-posta, telefon, adres, il/ilçe/mahalle, not, ürünler, tutar, kupon, zamanlama) | Sözleşmenin ifası, teslimat, muhasebe | SÖZ; HUK (VUK md.253 / TTK md.82) | **10 yıl** (TTK md.82; VUK md.253 5 yıl) — hesap silmede kimliksizleştirilmiş | SUP, ADS, KUR, MUH, KAM | Evet | `src/lib/orders.ts:290-320`; `CANLI_SEMA:61`; anonimleştirme `supabase/functions/delete-account/index.ts:210-222` |
| Sipariş değişikliği (yeni adres metni, not) | Sözleşme ifası | SÖZ | Siparişle aynı | SUP | Evet | `src/lib/orders.ts:850-867`; `CANLI_SEMA:60` |
| Pazaryeri siparişleri (Trendyol Go: ad, soyad, telefon, adres, not, ham paket `external_payload`) | Pazaryeri siparişini ifa | SÖZ (pazaryeri sözleşmesi) / MM | Teslimden sonra 30 gün kişisel alanlar maskelenir; mali kayıt 10 yıl | TGO, SUP, ADS | Evet | `supabase/functions/trendyolgo-poll/index.ts:217-258`; `supabase/migrations/20261013104006_orders_external_channel.sql:3-11` |
| Kayıtlı kart (son 4 hane, marka, banka, takma ad) | Tek dokunuşla ödeme | SÖZ (kullanıcı talebi) | Kullanıcı silene / hesap silinene kadar | SUP, PNK | Evet (SUP) | `supabase/functions/_shared/paynkolay-cards.ts:139-149`; `supabase/functions/_shared/paynkolay-card-storage.ts:100-105`; `CANLI_SEMA:87` |
| Kart jetonu (`user_card_secrets.card_token`, `cs_tran_id`) — **tam kart numarası tutulmaz** | Kayıtlı kartla ödeme | SÖZ | Kart silinince | SUP (yalnız servis rolü), PNK | Evet | `supabase/migrations/20260916230000_card_infra_security.sql:6-10`; RLS `supabase/migrations/20261103000100_security_rls_policies.sql:62`; kart bilgisi uygulamaya girilmez `supabase/functions/paynkolay-payment-init/index.ts:5` |
| Ödeme kuruluşu müşteri anahtarı (`profiles.payment_customer_key`, rastgele 11 hane; eskiden telefon) | Kart saklama | SÖZ | Hesap süresince | PNK | Hayır | `supabase/functions/paynkolay-payment-init/index.ts:332-341`; `supabase/migrations/20260916230000_card_infra_security.sql:24` |
| Ödemede kart sahibinin IP'si (`cardHolderIP`) | Ödeme güvenliği (3D Secure, dolandırıcılık) | HUK / MM | PNK'nın saklaması | PNK | Hayır | `supabase/functions/paynkolay-payment-init/index.ts:382-403` |
| Başarısız ödeme/iade/kart doğrulama ham yanıtları (`failed_payments.order_data`, `refunds.provider_response`, `card_verifications.refund_response`) | Mutabakat, uyuşmazlık | HUK / HAK | 10 yıl (mali), ham yanıt 2 yıl sonra kişisel alanlardan arındırılır | SUP | Evet | `supabase/migrations/20260617000000_paynkolay_user_cards.sql:41-43`; `supabase/migrations/20260624000000_paynkolay_refund_infra.sql:30-43`; `supabase/functions/tosla-callback/index.ts:25,82-88` |
| Makro (Macro Coin) bakiyesi ve hareketleri, krediler, kupon kullanımları | Ön ödemeli paket ifası | SÖZ; HUK | 10 yıl | SUP | Evet | `CANLI_SEMA:44,88,27`; `supabase/functions/macro-expiry/index.ts:43-69` |
| Adisyo API ve webhook kayıtları (ham istek/yanıt: ad, telefon, adres) | Entegrasyon hata ayıklama | MM | **Öneri:** 30 gün (bugün süresiz) | SUP | Evet | `supabase/migrations/20260508000000_adisyo_phase1.sql:14`; `supabase/functions/adisyo-save-order/index.ts:405`; `supabase/migrations/20260508000200_adisyo_webhook_events.sql:4`; `CANLI_SEMA:97` |
| Fatura bilgisi (TCKN/VKN) | — | — | — | — | — | **Bulunamadı**: fatura/TCKN/VKN sütunu yok; yalnız destek konusu "Fatura Talebi" (`src/screens/profile/SupportScreen.tsx:31`) |

### 1.5 Sağlık sayılabilecek veri (özel nitelikli — KVKK md.6 / GDPR Art.9 riski)

> Kurul ve AB uygulamasında boy/kilo/bel ölçüsü/beslenme kaydı tek başına her zaman sağlık verisi sayılmayabilir; ancak kilo hedefi, vücut ölçüleri ve öğün/kalori geçmişi birlikte kişinin sağlık durumu hakkında çıkarım yapmaya elverişli olduğundan **en güvenli yorum: özel nitelikli kabul et, açık rıza al**. Bkz. `BOSLUKLAR.md` B-03.

| Veri | Amaç | Dayanak | Saklama önerisi | Alıcılar | Yurt dışı | Kanıt |
|---|---|---|---|---|---|---|
| Beslenme profili: cinsiyet, yaş, boy, kilo, hedef, aktivite düzeyi, bel/kalça/göğüs, hedef/özel makrolar | Kişisel kalori/makro hedefi hesaplama | AR-Ö | Hesap süresince veya rıza geri alınana kadar; sonra 30 gün içinde imha | SUP | Evet | `src/modules/onboarding/takibe/save.ts:32-50`; `src/screens/tracker/NutritionProfileScreen.tsx:291-311`; `CANLI_SEMA:91` |
| Vücut ölçüleri geçmişi (`body_measurements`: kilo, bel, kalça, göğüs, not) | İlerleme takibi | AR-Ö | Aynı | SUP | Evet | `src/modules/onboarding/takibe/save.ts:51-58`; `CANLI_SEMA:18` |
| Öğün/kalori/makro kayıtları (`meal_consumptions`, `meal_logs`: ad, öğün, kalori, P/K/Y, not, fotoğraf yolu) | Kalori takibi | AR-Ö | Aynı | SUP | Evet | `src/screens/TrackerScreen.tsx:2124-2138`; `src/modules/ai/scan/saveEstimate.ts:79-93`; `supabase/migrations/20261104000500_day_shares.sql:15-16`; `CANLI_SEMA:46-47` |
| Su (`water_daily.ml`) | Su takibi | AR-Ö (ihtiyatla) | Aynı | SUP | Evet | `supabase/migrations/20261106000100_g15_water.sql:25-31`; `src/modules/gun/water.ts:18,29` |
| Etkinlik (`activity_logs`: tür, dakika, mesafe, tahmini kcal) | Etkinlik takibi | AR-Ö (ihtiyatla) | Aynı | SUP | Evet | `supabase/migrations/20261104002000_g8_social.sql:105-117`; `src/modules/kesfet/client.ts:224,234` |
| Adım sayısı / HealthKit / Health Connect | — | — | — | — | — | **Yok**: paket ve kodda HealthKit/Google Fit/Health Connect/pedometre bulunamadı (`package.json` bağımlılıkları) |
| AI tabak tarama fotoğrafı (`user-media/<uid>/scans/…`, ≤1600 px, EXIF kapalı kamera) | Fotoğraftan besin tahmini | AR-Ö (fotoğraf + öğün bağlamı) | **Öneri:** analiz sonrası 30 gün (bugün süresiz, istemci silmiyor) | SUP, ANT | Evet (ANT: ABD) | `src/modules/ai/scan/ui/FinScanCamera.tsx:183`; `src/modules/ai/scan/imageResize.ts:47-57`; `src/modules/ai/scan/client.ts:63-80`; kova `supabase/migrations/20261104000700_user_media_bucket.sql:17-19` |
| AI'ya gönderilen veri: görsel (base64) + sabit istem + kullanıcı ipucu (≤160 kr.) — kullanıcı kimliği/e-posta **gönderilmez** | Besin tahmini | AR-Ö + yurt dışı aktarım güvencesi | ANT tarafında sözleşmedeki süre (teyit) | ANT | Evet | `supabase/functions/analyze-ai-scan/index.ts:39,129-131,211,217-227,233,247-248` (yalnız dosya) |
| AI tahmin sonucu (`ai_scan_reservations.result`), kota kullanımı | Sonucu gösterme, kota | AR-Ö / SÖZ | 30 gün (sonuç kullanıcı kaydına aktarıldıktan sonra) | SUP | Evet | `supabase/migrations/20261109190100_g19_ai_scan_hardening.sql:32-34`; `supabase/migrations/20261104000600_ai_scan_quota.sql:41,53` |
| Gün kartı paylaşımı (öğün fotoğrafının 24 saat takipçilere açılması) | Sosyal özellik | AR-Ö (sağlık verisinin alenileştirilmesi kullanıcı iradesiyle; md.6/3-ç ancak alenileştirme "herkese açık" ise) | Erişim 24 saat; dosya **silinmiyor** → 24 saat + 7 gün sonra sil | SUP, takipçiler, moderatörler | Evet | `supabase/migrations/20261104000500_day_shares.sql:20-26`; `supabase/migrations/20261105000100_g9_fixes.sql:83-100`; `src/modules/gun/client.ts:36` |
| Kiler (pantry), koleksiyon, otomatik kayıt | Uygulama işlevi | AR-Ö (ihtiyatla) | Cihazda | — | — | `src/store/pantryStore.ts:116`; `src/modules/gun/autoLogStore.ts:7` |
| Sağlık açık rıza onay kutusu | Rızanın alınması | — | **Bugün kaydedilmiyor** | — | — | `src/modules/onboarding/takibe/TakibeNavigator.tsx:199-202,281-303`; metin `src/core/i18n/dictionaries.ts:227`; kayıt yok `src/modules/onboarding/takibe/save.ts` |

### 1.6 Kullanıcı içeriği (gönderi, yorum, video, değerlendirme, şikâyet)

| Veri | Amaç | Dayanak | Saklama önerisi | Alıcılar | Yurt dışı | Kanıt |
|---|---|---|---|---|---|---|
| Gönderi (metin, dil, foto/video, öğün/etkinlik kartı), düzenleme, silme | Keşfet sosyal özelliği | SÖZ (Kullanım Koşulları); öğün/etkinlik kartı için AR-Ö | Kullanıcı silene / hesap silinene kadar; moderasyon kaydı 6 ay | SUP; herkese açık kova `post-media`; diğer kullanıcılar | Evet | `src/modules/kesfet/client.ts:165-179,293`; `src/modules/kesfet/media.ts:42-57`; `supabase/migrations/20261104000200_feed_tables.sql:21,32`; kova `supabase/migrations/20261104000400_post_media_storage.sql:9-20`, `supabase/migrations/20261104002000_g8_social.sql:1487-1495` |
| Video + 3 kare (mikrofon izni dizesi var) | Video gönderi | SÖZ | Gönderiyle | SUP | Evet | `src/modules/media/video/uploadVideoPost.ts:16-31,53-64`; `app.config.js:60-61` |
| Yorum, beğeni, takip, takip isteği, engelleme, sosyal bildirim | Sosyal özellik | SÖZ | Hesap süresince (cascade silinir) | SUP | Evet | `src/modules/kesfet/client.ts:119,156,193-218,259`; `supabase/migrations/20261104002000_g8_social.sql:131,178`; `supabase/migrations/20261104000200_feed_tables.sql:50-107` |
| İçerik şikâyeti (`content_reports`: hedef, sebep), engellemeler | Güvenlik, moderasyon, DSA md.16 | MM / HUK | 1 yıl | SUP | Evet | `src/modules/kesfet/client.ts:147`; `supabase/migrations/20261104000200_feed_tables.sql:95` |
| AI moderasyon girdisi (gönderi/yorum metni + ≤6 görsel/video karesi; yazar kimliği **gönderilmez**) ve kararları (`moderation_queue`, `content_reports source='ai'`, `moderation_actions`) | Topluluk kurallarının uygulanması | MM (platform güvenliği); HUK (5651, DSA) | Karar kaydı 6 ay (itiraz süresi + DSA md.20) | ANT, SUP | Evet | `supabase/functions/moderate-content/index.ts:28,36-38,153-175,199-221,246,306`; cron `supabase/migrations/20261104002100_g8_moderation_cron.sql:74-77`; `supabase/migrations/20261104001000_g6_fixes.sql:367` |
| Sipariş değerlendirmesi (puan, yorum), ürün bazlı geri bildirim, değerlendirme şikâyeti (uygulanmadı) | Hizmet kalitesi, yorum gösterimi | SÖZ / MM | 3 yıl | SUP; yorumlar herkese açık gösterilebilir | Evet | `src/lib/orderFeedback.ts:105-133`; `src/lib/reviewReports.ts:41-47`; `supabase/migrations/20260921180500_review_item_feedback.sql:4`; `supabase/migrations/20261103010000_review_reports.sql:12` |
| Topluluk kuralları kabulü | Kural bilgilendirmesi | SÖZ | **Bugün yalnız cihazda** (`@kcal_kesfet_rules_seen`) | — | — | `src/modules/kesfet/ui/RulesSheet.tsx:21-30`; `src/modules/kesfet/ui/ComposerScreen.tsx:337` |
| Pazarlama görselleri (`social-media`, `reels` kovaları) | Şirketin kendi sosyal medya içeriği | — (kullanıcı verisi değil; kişi görünüyorsa görsel izni gerekir) | — | SUP | Evet | `supabase/functions/social-upload/index.ts:7,35`; `supabase/functions/reels-upload-url/index.ts:6,25` |

### 1.7 Cihaz / olay ölçümü (telemetri, analitik, teşhis)

| Veri | Amaç | Dayanak | Saklama önerisi | Alıcılar | Yurt dışı | Kanıt |
|---|---|---|---|---|---|---|
| Birinci taraf olaylar (`analytics_events`: olay adı, beyaz listeli özellikler, `user_id`, `anon_id`, `session_id`, platform, sürüm, zaman) | Ürün iyileştirme, KPI | MM (KVKK md.5/2-f) + kapatma hakkı; GDPR: Art.6(1)(f) + ePrivacy md.5(3) için rıza değerlendirmesi | **24 ay** ham, sonra toplulaştır; hesap silmede `user_id` null (anon_id kalır) | SUP | Evet | `src/lib/analytics.ts:239,272-281`; `src/lib/metrics/queue.ts:20-31,49`; özellik süzgeci `src/lib/metrics/sanitize.ts:14-32,85-95`; sunucu süzgeci `supabase/migrations/20261109100300_d_s1_kpi.sql:137-141`; tablo `supabase/migrations/20260916094149_analytics_events.sql:1-11`; FK `supabase/migrations/20260917291000_delete_account_fk_fixes.sql:7-10` |
| Kaynak atfı (UTM, derin bağlantı, kutu QR, saha kodu — ilk/son temas) | Pazarlama kanalı ölçümü | MM | 90 gün (atıf penceresi) | SUP | Evet | `src/lib/metrics/attribution.ts:31-33,88-108`; `App.tsx:101-108` |
| Ölçüm tercihi (birinci taraf açık/kapalı) | Tercihi uygulama | HUK/MM | Cihazda | — | — | `src/lib/metrics/consent.ts:22-23,51-53` |
| Çökme/performans (Sentry: hata, iz örneği %10, cihaz/OS, **kullanıcı UUID'si**; `sendDefaultPii:false`) | Hata ayıklama, kararlılık | MM | 90 gün (Sentry ayarı) | SEN | Evet | `src/lib/sentry.ts:33-51,66-68`; `src/core/AuthContext.tsx:412-414`; `app.config.js:4-16` |
| Push jetonu cihaz adı/modeli (`push_tokens.device_name` — eski iOS'ta kişinin adını içerebilir) | Bildirim hedefleme | SÖZ | Jeton pasifleşince 90 gün | SUP | Evet | `src/core/notifications.ts:128,138` |
| Özellik bayrağı/kilit kayıtları, şube atama kaydı | Uygulama işlevi, operasyon | MM | 12 ay | SUP | Evet | `supabase/migrations/20261103000500_feature_flags.sql:41`; `supabase/migrations/20260916280000_multi_branch_routing.sql:86` |
| Web: yalnız `localStorage` (`kcal-consent`, `kcal-theme`); çerez **yok**; analitik/piksel **yok** | Tercih saklama | Zorunlu (rıza gerektirmez) | Tarayıcıda | — | — | `web:packages/ui/src/consent.ts:4,10,23`; `web:packages/ui/src/theme.tsx:6,9,33`; banner `web:packages/ui/src/cookie.tsx:40-108` |
| Web form istek meta verisi (`user_agent`, sayfa) | Kötüye kullanım önleme | MM | Form kaydıyla | SUP, VRC | Evet | `web:apps/eatkcal/lib/lead.ts:100-119` |
| Vercel erişim kayıtları (IP, UA) | Barındırma, güvenlik | MM / HUK (5651) | Vercel varsayılanı (teyit) | VRC | Evet | barındırma: web reposu (Vercel) — kodda ayrıca kanıt yok |

### 1.8 Reklam kimlikleri ve reklam ölçümü

| Veri | Amaç | Dayanak | Saklama önerisi | Alıcılar | Yurt dışı | Kanıt |
|---|---|---|---|---|---|---|
| Meta App Events (ViewedContent: ürün id/ad/fiyat; AddedToCart; InitiatedCheckout; Purchase: tutar, sipariş no; CompletedRegistration) | Reklam ölçümü / optimizasyon | **AR** (KVKK md.5/1; GDPR Art.6(1)(a) + ePrivacy md.5(3)) | Meta'nın saklaması; rıza geri alınınca gönderim durur | META | Evet | `src/lib/analytics.ts:107-137,161-199` |
| IDFA (iOS) — yalnız ATT izni sonrası; GAID (Android) | Reklam atfı | AR + ATT | Meta | META | Evet | `app.config.js:401-403`; `src/lib/metrics/consent.ts:26-30,60-66` |
| Meta SDK otomatik olay kaydı (`autoLogAppEventsEnabled: true`) — ATT reddinde iOS'ta açık kalıyor; Android'de rıza "unset" iken olaylar gidiyor | — | **Dayanak eksik** → bkz. BOSLUKLAR B-06 | — | META | Evet | `app.config.js:402`; `src/lib/analytics.ts:67-70`; `src/lib/metrics/consent.ts:5-7,26-29` |
| Uygulama içi reklam rızası (`@kcal_consent_ads`) | Rıza yönetimi | — | Bugün yalnız cihazda; arayüz yok (yalnız test ekranı çağırıyor) | — | — | `src/lib/metrics/consent.ts:22`; `src/lib/metrics/i18n.ts:6-30`; `src/dev/vitrinE2E.tsx:153,163` |
| Sunucuda reklam kimliği | — | — | — | — | — | **Bulunamadı**: DB'de IDFA/GAID/advertising_id yok; Meta Conversions API yok |

### 1.9 Bildirim jetonu ve bildirim tercihleri

| Veri | Amaç | Dayanak | Saklama önerisi | Alıcılar | Yurt dışı | Kanıt |
|---|---|---|---|---|---|---|
| Expo push jetonu (`push_tokens`, ayrıca `profiles.push_token`, `support_tickets.push_token`) | İşlem bildirimi (sipariş durumu), hatırlatıcı | SÖZ (işlem); AR/ETK onayı (pazarlama) | Çıkış/silmede pasif → 90 gün sonra sil (bugün yalnız pasifleşiyor) | EXPO → APL (APNs) / GGL (FCM) | Evet | `src/core/notifications.ts:97-144,177-181`; `CANLI_SEMA:75` |
| Bildirim içeriği ve gönderim kaydı (`notification_sends`: başlık, gövde, veri, durum, açılma) | Gönderim, ölçüm | SÖZ / MM | 12 ay | SUP, EXPO | Evet | `supabase/functions/send-notification/index.ts:234-252`; `src/core/notifications.ts:228-232`; `CANLI_SEMA:54` |
| Bildirim tercihleri (`notification_preferences`: işlem/pazarlama/hatırlatma/davranışsal, sessiz saat) | Tercihi uygulama | HUK (ETK md.6 onay) | Hesap süresince; onay kayıtları onay bitiminden itibaren 3 yıl | SUP | Evet | `src/screens/profile/NotificationPreferencesScreen.tsx:34-37`; `supabase/functions/send-notification/index.ts:183-186,439`; `CANLI_SEMA:53` |
| Pazarlama bildirim kampanyası hedefleri (`campaign_targets.user_email`, `campaigns.user_email`) | Kampanya | AR + ETK onayı | Kampanya bitiminden itibaren 12 ay | SUP | Evet | `CANLI_SEMA:26,28` |

### 1.10 Cihazda (AsyncStorage) tutulan kişisel veri

| Anahtar | İçerik | Kanıt |
|---|---|---|
| Supabase oturumu | erişim/yenileme jetonu | `src/core/supabase.ts:9` |
| `kcal-selected-address` | adres, ad, telefon, koordinat | `src/store/addressStore.ts:18` |
| `kcal-delivery-context` | GPS lat/lng, ilçe | `src/store/deliveryContextStore.ts:73` |
| `@kcal_log_queue:<uid>` | çevrimdışı öğün kayıtları | `src/modules/gun/track/logQueueNative.ts:23` |
| `@kcal_ai_scan_pending_queue` | tarama görsel URI'si, ipucu (≤10, 24 saat) | `src/modules/ai/scan/offlineQueue.ts:14-33` |
| `@kcal_analytics_*`, `@kcal_attr_*` | anon_id, kuyruk, atıf | `src/lib/analytics.ts:205,291,342`; `src/lib/metrics/attribution.ts:31-32` |
| `@kcal_consent_ads`, `@kcal_consent_first_party`, `@kcal_age_18_confirmed` | rıza/yaş | `src/lib/metrics/consent.ts:22-23`; `src/screens/auth/UnifiedLoginScreen.tsx:21` |
| `eatkcal.v2.waitlist.queue` | ad, telefon, e-posta | `src/modules/eatkcal/v2/ui/gate/waitlistSend.ts:16` |

Hesap silindiğinde bu anahtarlar **temizlenmiyor** (`src/core/AuthContext.tsx:194,201`) → BOSLUKLAR B-10.

---

## 2. Yetkili iç erişim (personel)

| Rol | Erişim | Kanıt |
|---|---|---|
| Yönetici (`admin_allowlist`) | Tüm adresler (Müşteri 360), profiller, destek talepleri, geri bildirim, yorumlar; boss paneli müşteri hareketleri ve kayıtlı kart özetleri | `supabase/migrations/20260926111527_yorumlar_admin_erisimi.sql:24-36`; `supabase/migrations/20260524000000_addresses_admin_select.sql:1-40`; `supabase/migrations/20260926103402_boss_musteri_hareketleri.sql:1-12` |
| Şube personeli | Yalnız kendi şubesinden sipariş vermiş müşterilerin profili; yeni sipariş e-postası (ad, telefon, ürünler) | `supabase/migrations/20260916200000_profiles_branch_scope.sql:7-17`; `supabase/functions/order-alert/index.ts:209-216` |
| Moderatör (`creators.role='moderator'`) | Moderasyon kuyruğu, aktif gün kartı fotoğrafları | `supabase/migrations/20261104000200_feed_tables.sql:172-174`; `supabase/migrations/20261105000100_g9_fixes.sql:83-100` |

## 3. Hesap silmenin bugünkü kapsamı (kanıt)

| Ne olur | Kanıt |
|---|---|
| Aktif sipariş varsa engellenir; bekleyen ödeme taslakları iptal | `supabase/functions/delete-account/index.ts:42,92-117` |
| Telefon/e-posta özetleri `deleted_account_fingerprints`'e (süresiz) | `:124-149` |
| Apple jetonu iptal, PaynKolay kartları silinir (en iyi çaba) | `:155-207` |
| Siparişler tutulur; ad "Silinen Kullanıcı", e-posta/telefon/adres/not null — **il/ilçe/mahalle, ürünler, `external_payload`, `order_modifications.new_address_text` kalır** | `:210-222` |
| `auth.admin.deleteUser` → cascade: sosyal tablolar, su, AI kota, gün kartı, cihazlar, ürün geri bildirimi | `:229-233`; `supabase/migrations/20261104000200_feed_tables.sql:22-128` |
| `analytics_events`, `failed_payments`, `card_verifications`, `branch_assignment_log` → `user_id` null, satır kalır | `supabase/migrations/20260917291000_delete_account_fk_fixes.sql:7-14` |
| **Silinmeyen:** Storage dosyaları (avatar, user-media, post-media, support-attachments), Adisyo ham kayıtları, `feedback.user_email`, `campaign_targets.user_email`; `support_tickets.user_id` FK'si `ON DELETE` içermediği için silme başarısız olabilir | `supabase/migrations/20260309000000_support_tickets.sql:3` |

## 4. Envanterde YOK olduğu doğrulananlar

HealthKit / Health Connect / adım sayar · doğum tarihi (yalnız hesaplanmış yaş) · TCKN / VKN / fatura alanı · tam kart numarası · DM / mesajlaşma · Facebook ile giriş · SMS doğrulama · arka plan konumu · Meta Conversions API (sunucu) · web'de çerez, analitik veya piksel · sunucuda reklam kimliği · istemciden doğrudan AI sağlayıcı çağrısı.

## 5. Bu envanterin kullanımı

- `tr/01-gizlilik-politikasi.md`, `tr/02-kvkk-aydinlatma-metni.md` (ve EN karşılıkları) bu tablodaki kategori/amaç/dayanak/alıcıları kullanır.
- `BOSLUKLAR.md` envanter ile mevcut metinler/akışlar arasındaki farkları önceliklendirir.
- Kod değiştikçe envanter güncellenir: yeni tablo/sütun/üçüncü taraf eklenirken bu dosyaya satır eklenmesi PR kontrol listesine konmalı (`ENTEGRASYON.md` §6).
