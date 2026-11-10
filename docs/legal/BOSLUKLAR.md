# Uyum Boşlukları Raporu (öncelikli) — TASLAK

> **Durum:** TASLAK · hukuki inceleme için (İlter Öziseven) · yayın yok · 2026-11-09 · dal `legal/global`
> Kanıtlar `VERI_ENVANTERI.md` ile aynı gösterimi kullanır (`dosya:satır`, `web:` = kcal-web, `CANLI_SEMA:n`).
> Bu rapor hukuki görüş değildir; mevzuat atıfları avukat tarafından teyit edilmelidir. "Teyit" işaretli eşik/tarih/madde harfleri özellikle kontrol edilmelidir.

## Öncelik ölçeği

| Seviye | Anlamı |
|---|---|
| **P0** | Yayın / mağaza güncellemesi / AI özelliklerinin canlıya alınmasından **önce** çözülmeli. İdari para cezası, mağaza reddi veya doğrudan kullanıcı zararı riski yüksek |
| **P1** | 30 gün içinde. Uyum açığı belirgin, risk orta |
| **P2** | 90 gün içinde. İyi uygulama / ileride gerekli |

## Özet tablo

| # | Öncelik | Konu | Tür |
|---|---|---|---|
| B-01 | P0 | Yurt dışı aktarım: metinler "aktarım yok" diyor; standart sözleşme + 5 iş günü bildirim yok | Hukuk + sözleşme |
| B-02 | P0 | Hiçbir kabul/rıza sunucuda kaydedilmiyor (koşullar, mesafeli satış, sağlık rızası, 18+, topluluk) | Kod + migration |
| B-03 | P0 | Sağlık verisi: açık rıza alınıyor ama kaydedilmiyor; eski profil ekranında hiç yok | Kod + hukuk |
| B-04 | P0 | VERBİS kaydı gerekliliği | Hukuk + idari |
| B-05 | P0 | Mesafeli satış: ayrı Ön Bilgilendirme Formu yok; cayma istisnası yanlış atıf; mobil metinde boş tablolar | Hukuk + kod |
| B-06 | P0 | Meta/ATT: Android'de rızasız olay gönderimi; iOS'ta ATT reddinde otomatik olay kaydı açık; rıza arayüzü yok | Kod |
| B-07 | P0 | App Store gizlilik etiketi ve Play Veri Güvenliği formu güncel değil | Konsol |
| B-08 | P0 | `support-attachments` kovası herkese açık (destek ekleri URL'yi bilen herkese açık) | Kod + migration |
| B-09 | P1 | Hesap silme eksik: Storage dosyaları, Adisyo kayıtları, cihaz verisi kalıyor; olası FK engeli; kcalculate.ai'de silme sayfası yok | Kod + web |
| B-10 | P1 | Çocuk verisi: 18+ kontrolü atlatılabilir, sunucuya yazılmıyor, yeni girişte yok | Kod |
| B-11 | P1 | Pazarlama bildirimi varsayılan açık (opt-out); ETK onayı / İYS yok | Kod + İYS |
| B-12 | P1 | GDPR Art.27 AB temsilcisi (ve UK temsilcisi, DSA md.13 yasal temsilci) | Hukuk + sözleşme |
| B-13 | P1 | İşleyen sözleşmeleri (DPA) listesi ve durumları | Sözleşme |
| B-14 | P1 | Mevcut metinlerdeki hukuki hatalar ve tutarsızlıklar | Hukuk |
| B-15 | P1 | Saklama süreleri tanımlı ama uygulanmıyor (imha işi yok) | Kod + cron |
| B-16 | P1 | Kişisel veri içeren ham entegrasyon günlükleri (Adisyo, Tosla) süresiz | Kod |
| B-17 | P2 | ABD eyalet mevzuatı (CCPA/CPRA, Washington MHMDA) | Hukuk |
| B-18 | P2 | Herkese açık kova tasarımı (avatar adı = kullanıcı UUID'si; gizli profilin medyası herkese açık URL'de) | Kod |
| B-19 | P2 | DSA / 5651: bildirim-kaldırma, gerekçe bildirimi, itiraz kaydı | Kod + süreç |
| B-20 | P2 | Diğer: Sentry kırıntıları, Resend kişisel Gmail yedeği, ölü Tosla kart formu, ölçüm metnindeki "anonim" ifadesi, e-ticaret künyesi | Kod + web |
| <!-- L-S3 --> B-21 | P0 | Apple EULA yolu: Standard EULA mı, Koşullar özel EULA olarak mı? ASC açıklaması + paywall bağlantısı | Hukuk + konsol |
| <!-- L-S3 --> B-22 | P0 | Ses tanıma: SEÇENEK A (yalnız cihazda) / B (desteklenmezse Apple/Google hizmeti) — gizlilik metni ve mağaza etiketi buna bağlı | Kod + hukuk |
| <!-- L-S3 --> B-23 | P0 | AI ve abonelik aktarımları: Anthropic + RevenueCat standart sözleşmesi ve 5 iş günü bildirimi; uygulama içi AI izninin hukuki niteliği | Hukuk + sözleşme |
| <!-- L-S3 --> B-24 | P0 (Koç açılmadan) | Koç sohbeti "30 gün" yalnız kullanıcı yeniden yazınca siliniyor; zamanlanmış silme yok | Kod + cron |
| <!-- L-S3 --> B-25 | P1 | Hesap silmede RevenueCat müşteri kaydı silinmiyor; aktif abonelik uyarısı (G25-S1 md.6) | Kod |
| <!-- L-S3 --> B-26 | P1 | Aboneliklerde cayma hakkı ve satıcı sıfatı (Apple/Google aracı mı, satıcı mı); ön bilgilendirme | Hukuk |
| <!-- L-S3 --> B-27 | P2 | Open Food Facts ODbL atfı uygulamada eksik; barkod sorgusu cihazdan doğrudan Fransa'ya | Kod + hukuk |
| <!-- L-S3 --> B-28 | P1 | AB Yapay Zekâ Tüzüğü md.50: Koç bir sohbet botu → "yapay zekâ ile konuşuyorsun" bildirimi | Kod + hukuk |
| <!-- L-S3 --> B-29 | P1 | Mağaza etiketinde "izleme": kcalAI verileri izlenmiyor, ama Meta ticaret olayları yüzünden Apple etiketi "İzleme: Evet" kalıyor | Karar + konsol |
| <!-- L-S3 --> B-30 | P0 | Uygulama içi izin metinleri: `ai_coach_*` "İlter onayı bekliyor"; `ai_photo` izin penceresinde Gizlilik bağlantısı yok (A-S1 A3) | Hukuk + kod |
| <!-- L-S3 --> B-31 | P2 | Abonelik işletme kuralları: dönem içinde hak düşürmeme, Aile Paylaşımı, fiyatın metinde yazılıp yazılmayacağı | Karar |
| <!-- L-S3 --> B-32 | P2 | Koç'un SEKULART ürünlerini önermesi: ticari uygulama / reklam şeffaflığı | Hukuk |

---

## P0

### B-01 · Yurt dışına aktarım (KVKK md.9, 2024 rejimi; GDPR Bölüm V)

**Bulgu.** Web metinleri "Kişisel verileriniz yurt dışına aktarılmayacaktır… Türkiye'deki sunucular" diyor (`web:apps/eatkcal/content/legal/gizlilik.ts:135-137`; `web:apps/eatkcal/content/legal/kvkk.ts:146-156`). Kod ise şu yurt dışı alıcıları gösteriyor: Supabase (tüm DB/Storage, `src/core/supabase.ts:4-13`), Anthropic (AI tarama + moderasyon, `supabase/functions/analyze-ai-scan/index.ts:233`, `supabase/functions/moderate-content/index.ts:246`), Sentry (`src/lib/sentry.ts:33-68`), Meta (`src/lib/analytics.ts:107-199`), Expo push (`supabase/functions/send-notification/index.ts:250`), Google Maps/Sign-In (`src/lib/nearestLocation.ts:38`, `src/core/AuthContext.tsx:378`), Resend (`supabase/functions/order-alert/index.ts:19`), Vercel (web barındırma).

**Risk.** Gerçeğe aykırı aydınlatma (KVKK md.10 → md.18/1-a idari para cezası); uygun güvence olmadan aktarım (md.9 → md.18); standart sözleşme bildirim yükümlülüğünün ihlali (md.9/5 → md.18'deki ayrı ceza bendi, teyit).

**Öneri.**
1. Her yurt dışı alıcı için rolü belirle (işleyen / veri sorumlusu) ve Kurul'un ilan ettiği **standart sözleşmenin** uygun modülünü **değiştirmeden** imzala (VS→Vİ: Supabase, Anthropic, Sentry, Expo, Vercel, Resend, Google Maps; VS→VS: Meta, Apple/Google giriş değerlendirmesi).
2. İmza tarihinden itibaren **5 iş günü** içinde Kurum'a bildir (Yönetmelik: *Kişisel Verilerin Yurt Dışına Aktarılmasına İlişkin Usul ve Esaslar Hakkında Yönetmelik*, RG 10.07.2024 — teyit).
3. Açık rızayı düzenli aktarımın dayanağı yapma: 2024 rejiminde açık rıza yalnız **arızi** aktarımlarda (md.9/6-a) kullanılabilir. Taslak `tr/03-acik-riza-metinleri.md` §2 bu sınırla yazıldı.
4. GDPR tarafında: sağlayıcıların DPA'larındaki AB SCC'leri (2021/914) ve varsa EU-US Data Privacy Framework sertifikası; AB'deki kullanıcı verisi Türkiye'deki SEKULART'a aktarılıyor sayılır (Türkiye için yeterlilik kararı yok) → AB kullanıcıları için de SCC/Art.49 değerlendirmesi.
5. Supabase barındırma bölgesini Dashboard'dan teyit et (koddan doğrulanamadı; görev tanımına göre AB).

### B-02 · Kabul ve rıza kayıtları yok (ispat yükü veri sorumlusunda / satıcıda)

**Bulgu.**
- Ödeme öncesi "Kullanım Koşulları ve Mesafeli Satış Sözleşmesi'ni okudum, onaylıyorum" kutusu zorunlu ama sipariş yüküne yazılmıyor, sürüm/zaman yok (`src/components/checkout/CheckoutFooter.tsx:153-176`; `src/modules/eatkcal/v2/checkout/useEkCheckout.ts:562-564`).
- 18+ ve koşullar kutusu yalnız cihazda (`src/screens/auth/UnifiedLoginScreen.tsx:139-143`).
- Sağlık açık rızası kutusu kaydedilmiyor (B-03).
- Topluluk kuralları kabulü yalnız cihazda (`src/modules/kesfet/ui/RulesSheet.tsx:21-30`).
- Yeni onboarding hesap adımında "Devam ederek Koşullar ve Gizlilik'i kabul edersin" pasif metni var, bağlantılar tıklanamıyor (`src/modules/onboarding/OnboardingNavigator.tsx:224-230`; `src/core/i18n/dictionaries.ts:117-121`).
- `legal_documents` tablosunda sürüm sütunu yok ve istemci kullanmıyor (`CANLI_SEMA:43`); metinler pakete gömülü (`src/data/contractsData.ts:7-28`).

**Risk.** KVKK'da açık rızanın ispatı veri sorumlusundadır. Mesafeli Sözleşmeler Yönetmeliği'nde ön bilgilendirme ve teyit ispatı satıcıdadır. Kayıt yoksa ispat edilemez.

**Öneri.** `legal_documents` sürümlü hâle getirilsin + `legal_acceptances` (kullanıcı, belge, sürüm, içerik özeti, zaman, kanal, platform, uygulama sürümü, bağlam: sipariş no) ve `consents` (amaç bazlı, ver/geri al geçmişi) tabloları. Ayrıntı `ENTEGRASYON.md` §4–5.

### B-03 · Sağlık verisi (özel nitelikli kabulü ve açık rıza)

**Bulgu.** Boy, kilo, cinsiyet, yaş, hedef, vücut ölçüleri, öğün/kalori geçmişi, su, etkinlik ve AI tarama fotoğrafları işleniyor (`VERI_ENVANTERI.md` §1.5). "Takibe başla" akışında açık rıza kutusu var ve devam düğmesini kilitliyor (`src/modules/onboarding/takibe/TakibeNavigator.tsx:199-202`) ama kayıt yazılmıyor (`src/modules/onboarding/takibe/save.ts`). Eski `NutritionProfileScreen` aynı verileri rıza adımı olmadan yazıyor (`src/screens/tracker/NutritionProfileScreen.tsx:291-322`). Gün kartı paylaşımında öğün fotoğrafları takipçilere ve moderatörlere açılıyor (`supabase/migrations/20261105000100_g9_fixes.sql:83-100`).

**Değerlendirme (avukat kararı).** Kilo/boy/beslenme verisinin sağlık verisi sayılıp sayılmadığı bağlama göre tartışmalı. Ama kilo hedefi, vücut ölçüleri ve öğün geçmişi birlikte sağlık durumu hakkında çıkarıma elverişli. GDPR Art.4(15) ve Avrupa Birliği Adalet Divanı içtihadı (C-184/20 *OT*, dolaylı çıkarım) da geniş yorumluyor. **Önerilen ihtiyatlı yaklaşım:** özel nitelikli kabul et; KVKK md.6/3-a ve GDPR Art.9(2)(a) açık rızası al; rızayı kaydet; geri alınınca veriyi 30 gün içinde imha et; KVKK md.6/4 kapsamında Kurul'un özel nitelikli veri için belirlediği **yeterli önlemleri** uygula (2018/10 sayılı Kurul kararı: erişim yetkilendirmesi, şifreleme, kayıt tutma, ayrı ortam vb. — teyit).

**Hizmet şartına bağlama.** Kalori takibi sağlık verisi olmadan çalışamaz. Bu yüzden rıza vermeyen kullanıcıya takip sunulmayabilir, ama sipariş (eatkcal) ve diğer özellikler kapatılmamalı. Taslak rıza metni bu ayrımla yazıldı (`tr/03-acik-riza-metinleri.md` §1).

### B-04 · VERBİS kaydı

**Kural.** Kurul'un istisna kararlarına göre (2018/87, 2019/265 — teyit) yıllık çalışan sayısı 50'den az **ve** yıllık mali bilanço toplamı 100 milyon TL'den az olan veri sorumluları VERBİS kaydından muaftır, **ancak ana faaliyet konusu özel nitelikli kişisel veri işleme olanlar muaf değildir**. Eşiklerin güncel tutarı teyit edilmeli.

**Değerlendirme.** SEKULART'ın faaliyeti iki parçalı:
- (a) gıda üretim/satışı (eatkcal) — özel nitelikli veri ana faaliyet değil;
- (b) Kcalculate AI — kalori/kilo/beslenme takibi; ürünün **çekirdeği** sağlık sayılabilecek veri.

Kcalculate AI aynı tüzel kişi altında sunulduğu sürece "ana faaliyet konusu özel nitelikli veri işleme" yorumuna açık. **Öneri:** ihtiyaten **VERBİS'e kayıt ol**. Kayıt olunca *Kişisel Verilerin Silinmesi, Yok Edilmesi veya Anonim Hale Getirilmesi Hakkında Yönetmelik* md.5 gereği **Saklama ve İmha Politikası** zorunlu hâle gelir (taslağı: `tr/09-saklama-ve-imha-politikasi.md`). Alternatif: Kcalculate AI ayrı bir tüzel kişiye taşınırsa (S1 `tracking` şeması ayrışma planı, `docs/night/S1-TRACKING_SCHEMA.md`) değerlendirme o şirket için yapılır.

### B-05 · Mesafeli satış ve ön bilgilendirme

**Bulgu.**
- Mobilde ayrı bir Ön Bilgilendirme Formu yok ("Ön Bilgilendirme" metinde 0 kez geçiyor — `src/data/contractsData.ts`). Web metni "sözleşme ön bilgilendirme niteliği de taşır" diyor (`web:apps/eatkcal/content/legal/mesafeli.ts:9-19`).
- Cayma istisnası TKHK md.15'e atfediliyor ve bentler karışık. Doğru dayanak *Mesafeli Sözleşmeler Yönetmeliği* md.15/1; çabuk bozulan mallar için ilgili bent (c) — teyit (`web:apps/eatkcal/content/legal/mesafeli.ts:134-157`; mobil `src/data/contractsData.ts:11` M10.1).
- Mobil metinde 6.3 teslimat türleri, 9.2 ve 9.4 listeleri ile 11.2 Makro paketleri **boş** (tablolar kaybolmuş).
- Ayıp bildirimi "2 saat içinde, yalnız uygulamadan, fotoğrafla" şartına bağlanmış (TKHK md.10-11 ile çelişme riski).
- Yetki yalnız "İzmir Merkez Tüketici Mahkemeleri" (TKHK md.73 tüketicinin yerleşim yeri hakkını kısıtlıyor görünüyor).
- Ödeme sağlayıcısı üç yerde farklı: mobil PaynKolay, web Tosla, açılış sayfası PayTR.

**Öneri.** Ayrı Ön Bilgilendirme Formu sipariş özetinden dinamik doldurulsun, ayrı onaylansın, kayıt tutulsun. Karşılaştırma ve taslak: `MESAFELI_KARSILASTIRMA.md`, `tr/06-mesafeli-satis-ve-on-bilgilendirme.md`.

### B-06 · Reklam ölçümü (Meta) ve ATT akışı

**Bulgu.**
- `react-native-fbsdk-next`: `autoLogAppEventsEnabled: true`, `isAutoInitEnabled: false`, `advertiserIDCollectionEnabled: false` (`app.config.js:401-403`).
- ATT istemi uygulama açılışında, açıklama ekranı olmadan çıkıyor (`src/lib/analytics.ts:112-116`). İzin sonucu IDFA toplama ve takip bayraklarına yansıyor (`:118,125`).
- **iOS, ATT reddi:** özel olaylar gönderilmiyor (`src/lib/analytics.ts:161`), ama SDK başlatılıyor ve otomatik olay kaydı açık kalıyor.
- **Android:** uygulama içi reklam rızası varsayılanı `'unset'` iken `metaAllowed=true` → olaylar rıza alınmadan Meta'ya gidiyor (`src/lib/metrics/consent.ts:5-7,26-29`). Otomatik kayıt yalnız `adConsent==='denied'` iken kapanıyor (`src/lib/analytics.ts:67-70`).
- Rıza arayüzü yok: `setAdConsent` yalnız test vitrininden çağrılıyor (`src/dev/vitrinE2E.tsx:153,163`). Metinler hazır ama bağlı değil (`src/lib/metrics/i18n.ts:6-30`).
- ATT ve konum izin dizelerinin İngilizce karşılığı yok (`locales/en.json:2-7`).

**Risk.** KVKK md.5/1 açık rıza olmadan pazarlama/reklam amaçlı işleme ve yurt dışı aktarım; GDPR Art.6 + ePrivacy md.5(3) (cihazdan okuma/yazma için önceden rıza); Kurul *Çerez Uygulamaları Hakkında Rehber* (2022) SDK'lar için de rıza bekliyor.

**Önerilen akış.**
1. Onboarding değer anından sonra uygulama içi **"Ölçüm ve reklam"** ekranı: reklam ölçümü anahtarı varsayılan **kapalı**, açık rıza metni bağlantılı (`tr/03` §4).
2. Kullanıcı "Evet" derse ve platform iOS ise ATT sistem istemi gösterilir. "Hayır" derse ATT istemi hiç gösterilmez (Apple, ATT'den önce açıklama ekranına izin verir; istemi taklit etmemeli ve teşvik içermemeli).
3. Meta SDK `autoLogAppEventsEnabled:false` ile derlenir; yalnız `metaAllowed` doğruysa `setAutoLogAppEventsEnabled(true)` ve `initializeSDK()` çağrılır.
4. `metaAllowed`: `adConsent==='granted'` **ve** (iOS ise `att==='granted'`). `'unset'` = kapalı.
5. Rıza, ver/geri al geçmişiyle sunucuya yazılır (B-02).
6. ABD kullanıcıları için Meta "Limited Data Use" bayrağı (CCPA/eyalet yasaları) değerlendirilir.

### B-07 · App Store gizlilik etiketi ve Google Play Veri Güvenliği formu

<!-- L-S3 --> **Güncel tablo:** kcalAI eklemeleriyle (sesli giriş, Koç, abonelik) birlikte `MAGAZA_GIZLILIK_ESLEME.md` (11 Kas). Aşağıdaki 9 Kasım tabloları tarihçe olarak kalır.

`docs/night/G3-S1-STORE_FORMS.md` (3 Kasım) bugünkü kodla karşılaştırıldı. **Yeni veya düzeltilecek** satırlar ★ ile işaretli.

**Kod yanında konfig farkı:** `app.config.js` privacy manifest'inde `OtherUserContent`, `AudioData`, `CustomerSupport` yok (`app.config.js:77-209`). Etiketle birlikte güncellenmeli.

#### App Store Connect — App Privacy (güncel cevap tablosu)

| Apple veri türü | Toplanıyor mu | Kimliğe bağlı | İzleme (tracking) | Amaçlar | Kanıt / not |
|---|---|---|---|---|---|
| Contact Info › Name | Evet | Evet | Hayır | App Functionality | `src/screens/PersonalInfoScreen.tsx:199-204` |
| Contact Info › Email Address | Evet | Evet | Hayır | App Functionality | `src/core/AuthContext.tsx:286-289` |
| Contact Info › Phone Number | Evet | Evet | Hayır | App Functionality | `src/lib/postSocialAuth.ts:27-32` |
| Contact Info › Physical Address | Evet | Evet | Hayır | App Functionality | `src/screens/AddressesScreen.tsx:696-824` |
| Health & Fitness › Health | Evet | Evet | Hayır | App Functionality | ★ AI tarama fotoğrafları da bu bağlamda; `src/modules/onboarding/takibe/save.ts:32-58` |
| Health & Fitness › Fitness | Evet | Evet | Hayır | App Functionality | öğün, su, etkinlik; `supabase/migrations/20261104002000_g8_social.sql:105-117` |
| Location › Precise Location | Evet | Evet | Hayır | App Functionality | `src/components/checkout/AddressVerificationSheet.tsx:143-174` |
| User Content › Photos or Videos | Evet | Evet | Hayır | App Functionality | ★ kapsam genişledi: AI tarama, Keşfet foto/video, avatar, destek eki (`src/modules/ai/scan/client.ts:63-67`; `src/modules/kesfet/media.ts:42-57`; `src/modules/media/video/uploadVideoPost.ts:16-31`) |
| User Content › Audio Data | ★ Evet | Evet | Hayır | App Functionality | video gönderilerin ses izi (`app.config.js:60-61`) |
| User Content › Customer Support | ★ Evet | Evet | Hayır | App Functionality | `src/screens/profile/SupportScreen.tsx:186-195` |
| User Content › Other User Content | ★ Evet | Evet | Hayır | App Functionality | gönderi metni, yorum, değerlendirme (`src/modules/kesfet/client.ts:165,193`; `src/lib/orderFeedback.ts:105-114`) |
| Identifiers › User ID | Evet | Evet | Hayır | App Functionality, Analytics | `src/lib/analytics.ts:272-281` |
| Identifiers › Device ID | Evet | Evet | **Evet** | Third-Party Advertising | IDFA yalnız ATT sonrası; ★ `anon_id` de cihaz kimliği sayılabilir → Analytics amacı eklensin |
| Purchases › Purchase History | Evet | Evet | **Evet** | App Functionality, Analytics, Third-Party Advertising | `src/lib/analytics.ts:188-195` |
| Usage Data › Product Interaction | Evet | Evet | **Evet** | Analytics, Third-Party Advertising, App Functionality | `src/lib/analytics.ts:163-187` |
| Diagnostics › Crash Data | Evet | ★ **Evet** (Sentry'ye kullanıcı UUID'si veriliyor) | Hayır | App Functionality | `src/lib/sentry.ts:66-68` — 3 Kasım formunda "Not Linked" idi; ya etiketi düzelt ya `setUser`'ı kaldır |
| Diagnostics › Performance Data | Evet | ★ **Evet** | Hayır | App Functionality | `src/lib/sentry.ts:48` |
| Financial Info › Payment Info | Hayır | — | — | — | kart verisi PaynKolay sayfasında girilir (`supabase/functions/paynkolay-payment-init/index.ts:5`); son 4 hane/marka "Other Financial Info" değerlendirilsin ★ |
| Sensitive Info, Contacts, Browsing/Search History | Hayır | — | — | — | kodda bulunamadı |

- **Hesap silme:** Evet, uygulama içinde (`src/modules/profil/ui/screens/SettingsSecurityScreen.tsx:161-183`).
- **Apple ile Giriş jeton iptali:** var (`supabase/functions/_shared/apple-auth.ts:90`).

#### Google Play — Data Safety (güncel cevap tablosu)

Play tanımında, sizin adınıza işleyen hizmet sağlayıcıya (Supabase, Anthropic, Sentry, Expo) aktarım "paylaşım" sayılmaz. Meta'ya reklam amaçlı aktarım "paylaşım"dır.

| Play kategorisi › tür | Toplanıyor | Paylaşılıyor | Zorunlu/İsteğe bağlı | Amaçlar | Not |
|---|---|---|---|---|---|
| Location › Approximate / Precise | Evet | Hayır | İsteğe bağlı | App functionality | yalnız ön plan |
| Personal info › Name, Email, Phone, Address | Evet | Hayır | Zorunlu (sipariş) | App functionality, Account management | |
| Personal info › User IDs | Evet | Hayır | Zorunlu | App functionality, Analytics | |
| Financial info › Purchase history | Evet | **Evet (Meta)** | Zorunlu (sipariş) | App functionality, Analytics, Advertising | ★ rıza akışı (B-06) düzelince "yalnız rızayla paylaşılır" |
| Health and fitness › Health info, Fitness info | Evet | Hayır | İsteğe bağlı | App functionality | ★ AI analiz için Anthropic'e gider = hizmet sağlayıcı, paylaşım değil |
| Photos and videos › Photos, Videos | Evet | Hayır | İsteğe bağlı | App functionality | ★ |
| Audio › Other audio files | ★ Evet | Hayır | İsteğe bağlı | App functionality | video ses izi |
| App activity › App interactions | Evet | **Evet (Meta)** | İsteğe bağlı (rıza sonrası) | Analytics, Advertising | |
| App activity › Other user-generated content | ★ Evet | Hayır | İsteğe bağlı | App functionality | gönderi, yorum, değerlendirme, destek |
| App info & performance › Crash logs, Diagnostics | Evet | Hayır | Zorunlu | Analytics (diagnostics) | |
| Device or other IDs | Evet | **Evet (Meta)** | İsteğe bağlı | Advertising, Analytics | GAID + `anon_id` |

- **Güvenlik bölümü:** aktarımda şifreleme Evet; silme talebi Evet. **Silme URL'si:** `https://eatkcal.com/account-deletion` (`web:apps/eatkcal/content/legal/hesapSilme.ts`).
- Kcalculate AI'nin ayrı mağaza kaydı olursa kcalculate.ai'de de silme sayfası gerekir (B-09).

### B-08 · Herkese açık destek ekleri kovası (KVKK md.12 veri güvenliği)

**Bulgu.** `support-attachments` kovası `public` ve okuma politikası herkese açık. Ekler `tickets/<uid>/` altında, genel URL'leri talep mesajına gömülüyor (`supabase/migrations/20261021132735_storage_public_assets_and_support_attachments.sql:26-44`; `src/screens/profile/SupportScreen.tsx:163-182`). Destek ekleri sipariş fişi, ayıplı ürün fotoğrafı, ekran görüntüsü (adres/telefon) içerebilir.

**Öneri.** Kovayı özel yap, imzalı URL (kısa ömürlü) kullan, mevcut nesneleri taşı. Bu bir ihlal değerlendirmesi gerektirir mi? URL'ler tahmin edilebilir mi, dizinleme var mı? İnceleme: `tr/10-veri-ihlali-mudahale-plani.md` senaryo (a).

---

## P1

### B-09 · Hesap silme (uygulama + web)

| Eksik | Kanıt | Öneri |
|---|---|---|
| Storage dosyaları silinmiyor (avatar, user-media AI tarama, post-media, support-attachments) | `supabase/functions/delete-account/index.ts` (Storage çağrısı yok) | Silme fonksiyonuna `<uid>/` önekli nesne silme |
| Siparişte il/ilçe/mahalle, ürünler, `external_payload`, `order_modifications.new_address_text` kalıyor | `supabase/functions/delete-account/index.ts:210-222` | Anonimleştirme kapsamını genişlet (mali kayıt için gereken alanlar hariç) |
| Adisyo ham günlükleri (ad/telefon/adres) silinmiyor | `supabase/migrations/20260508000000_adisyo_phase1.sql:14` | Kullanıcı bazlı maskeleme + B-16 |
| `support_tickets.user_id` FK `ON DELETE` yok → `deleteUser` başarısız olabilir | `supabase/migrations/20260309000000_support_tickets.sql:3` | `ON DELETE SET NULL` migration'ı (canlıda doğrula) |
| `feedback.user_email`, `campaign_targets.user_email` kalıyor | `CANLI_SEMA:26,40` | Null'la |
| Cihazda kişisel veri kalıyor (adres, kuyruklar, anon_id, atıf) | `src/core/AuthContext.tsx:194,201`; `VERI_ENVANTERI.md` §1.10 | Silme/çıkışta AsyncStorage temizliği |
| Push jetonu yalnız pasifleşiyor | `src/core/notifications.ts:177-181` | Silmede satırı sil |
| Silme sayfası footer'da yok; kcalculate.ai'de yok; süre tutarsız (7 iş günü / 30 gün); `noreply@` başvuru adresi | `web:apps/eatkcal/components/site.tsx:31-39`; `landing-page/privacy.html:68,95`; `landing-page/account-deletion.html:54-67` | Tek metin, tek süre (≤30 gün), footer bağlantısı, kcalculate.ai/account-deletion |
| Meta'daki veriler | — | Meta veri silme talebi süreci (`tr/08` §playbook) |

### B-10 · Çocuk verisi (18+)

**Bulgu.**
- 18+ kutusu yalnız cihazda saklanıyor ve cihazda daha önce işaretlendiyse gösterilmiyor (`src/screens/auth/UnifiedLoginScreen.tsx:111-121,139-149`).
- Yeni onboarding hesap adımında yaş kutusu yok (`src/modules/onboarding/OnboardingNavigator.tsx:210-232`).
- Doğum yılı kontrolü hesap oluştuktan **sonra** yapılıyor. "Doğum yılını düzelt" ile atlatılabiliyor, uygulama kullanılabilir kalıyor, ama ekran "hesap oluşturamıyoruz… hiçbir bilgin kaydedilmedi" diyor (`src/modules/onboarding/takibe/TakibeNavigator.tsx:207-209,525-535`; `src/core/i18n/dictionaries.ts:98-100`). Bu ifade gerçeğe aykırı.
- Eski profil ekranında yaş kontrolü yok (`src/screens/tracker/NutritionProfileScreen.tsx:273`).
- DB'de yaş kısıtı yok (`CANLI_SEMA:91`).

**Risk.** Sağlık verisiyle birlikte reşit olmayan verisi; GDPR Art.8; App Store yaş derecelendirmesi tutarlılığı; ABD COPPA (13 yaş altı, "fiili bilgi").

**Öneri.**
1. Yaş beyanı hesap oluşturmadan **önce**, sunucuya yazılsın (yalnız "18+ beyan edildi" + zaman; doğum tarihi saklanmasın).
2. 18 yaş altı beyan edilirse hesap açılmasın; zaten açıldıysa veriler silinsin.
3. Ekran metni gerçeğe uygun hâle getirilsin.

### B-11 · Pazarlama bildirimleri ve ETK

**Bulgu.**
- `marketing_enabled` varsayılanı `true` (`src/screens/profile/NotificationPreferencesScreen.tsx:34-37`).
- Tercih satırı yoksa tüm kategoriler açık sayılıyor (`supabase/functions/send-notification/index.ts:183-186`). Kampanyalar `marketing` kategorisiyle gidiyor (`:439`).
- Sessiz saat uygulanmıyor.
- Web bülteninde onay kaydı tasarlanmış ama migration uygulanmamış (`supabase/migrations/20261107000100_web_leads.sql:2`).

**Değerlendirme.** 6563 sayılı ETK md.6: ticari elektronik ileti için önceden **onay** gerekir; ret her an mümkün olmalı. Push bildirimlerin "ticari elektronik ileti" kapsamına girip girmediği tartışmalı (Yönetmelik araç listesi: telefon, SMS, e-posta…; teyit). İhtiyatlı yol: pazarlama push'u da onayla gönder. E-posta/SMS pazarlaması yapılacaksa **İYS** kaydı ve onayların İYS'ye yüklenmesi zorunlu.

**Öneri.** `marketing_enabled` varsayılanı `false`. Onay ekranı `tr/03` §3. Tercih satırı yoksa pazarlama **kapalı** sayılsın. Onay kaydı 3 yıl.

### B-12 · AB temsilcisi (GDPR Art.27), UK temsilcisi, DSA yasal temsilcisi

**Değerlendirme.**
- kcalculate.ai İngilizce ve global pazarlanıyor; AB'deki kişilere hizmet sunulması hedefleniyor → GDPR Art.3(2)(a) uygulanır.
- AB'de yerleşik olmayan veri sorumlusu Art.27 uyarınca **AB temsilcisi** atamalıdır. Art.27(2)(a) istisnası, "arızi olan ve Art.9 özel nitelikli verilerin geniş çaplı işlenmesini içermeyen" işlemeyle sınırlı. Sağlık verisi işleyen bir takip uygulaması için istisnaya güvenmek riskli → **temsilci ata**.
- Aynı mantık UK GDPR Art.27 için (UK kullanıcıları hedefleniyorsa).
- **DSA (AB 2022/2065) md.13:** AB'de kuruluşu olmayan ve AB'de aracılık hizmeti (Keşfet = barındırma/çevrim içi platform) sunan sağlayıcı yazılı olarak **yasal temsilci** atamalıdır. Ayrıca md.11-12 iletişim noktası gerekir. Mikro/küçük işletmeler md.19 ile bazı platform yükümlülüklerinden muaf; md.11-18 muaf değil.
- **Pratik:** AB temsilci hizmeti veren firmalar GDPR Art.27 + DSA md.13'ü birlikte sunabiliyor.

**Karar noktası.** eatkcal yalnız TR ise AB temsilcisi yalnız Kcalculate AI için gerekir. AB'de yayın ertelenecekse mağazada ülke kısıtlaması da bir seçenek.

### B-13 · İşleyen sözleşmeleri (DPA) listesi

| Taraf | Rol | Belge | Durum | Not |
|---|---|---|---|---|
| Supabase | İşleyen | Supabase DPA (Dashboard'dan imzalanabilir) + KVKK standart sözleşme Modül 2 | `[DURUM]` | Bölge teyidi; alt işleyenler (AWS) |
| Anthropic | İşleyen | Commercial Terms + DPA (SCC dahil) + KVKK Modül 2 | `[DURUM]` | **AI tarama/moderasyon canlıya alınmadan önce zorunlu**; saklama süresi ve eğitimde kullanmama teyidi |
| Sentry | İşleyen | Sentry DPA + KVKK Modül 2 | `[DURUM]` | EU bölgesi seçeneği |
| Meta | VS/ortak VS | Meta Business Tools Terms, Data Processing Terms, (AB) Controller Addendum + KVKK Modül 1 | `[DURUM]` | Rıza akışı (B-06) |
| Expo (650 Industries) | İşleyen | Expo DPA + KVKK Modül 2 | `[DURUM]` | Push + EAS Update |
| Google (Maps Platform, Sign-In) | İşleyen/VS | Google Maps Platform Terms + Data Processing Terms + KVKK | `[DURUM]` | Adres metni ve koordinat gönderiliyor |
| Apple | Bağımsız VS | Apple Developer Program License Agreement | — | |
| Vercel | İşleyen | Vercel DPA + KVKK Modül 2 | `[DURUM]` | web form verisi geçiyor |
| Resend | İşleyen | Resend DPA + KVKK Modül 2 | `[DURUM]` | Şube e-postalarında müşteri adı/telefonu |
| PaynKolay | Bağımsız VS (ödeme kuruluşu) | Üye işyeri sözleşmesi; KVKK veri paylaşım hükmü | `[DURUM]` | PCI DSS sorumluluk dağılımı |
| Adisyo | İşleyen | Hizmet sözleşmesi + KVKK md.12/2 işleyen hükümleri | `[DURUM]` | Yurt içi; günlük saklama |
| Trendyol Go | Bağımsız VS | Pazaryeri sözleşmesi | `[DURUM]` | Gelen müşteri verisinin kullanım sınırı |
| Kurye ortakları | İşleyen/VS | Hizmet sözleşmesi + gizlilik | `[DURUM]` | |
| Mali müşavir / e-fatura | İşleyen/VS | Sözleşme + gizlilik | `[DURUM]` | |

### B-14 · Mevcut metinlerdeki hukuki hatalar / tutarsızlıklar

| # | Hata | Kanıt | Düzeltme |
|---|---|---|---|
| 1 | Pazarlama için "Açık rıza (Md. 5/2-a)" — 5/2-a "kanunlarda açıkça öngörülme"; açık rıza md.5/1 | `web:apps/eatkcal/content/legal/kvkk.ts:125` | md.5/1 |
| 2 | Sağlık için "Md. 6/2" — 7499 sonrası açık rıza md.6/3-a | `web:apps/eatkcal/content/legal/kvkk.ts:122,143` | md.6/3-a |
| 3 | "10 yıl (VUK 253)" — VUK md.253 5 yıl; 10 yıl TTK md.82 | `web:apps/eatkcal/content/legal/gizlilik.ts:142-153` | Doğru atıf |
| 4 | Ödeme sağlayıcı üç farklı: Tosla / PaynKolay / PayTR | `web:…/gizlilik.ts:59,125`; `src/data/contractsData.ts:16`; `landing-page/privacy.html:74` | PaynKolay (canlı akış `src/config/payment.ts:8,19-25`) |
| 5 | "Yurt dışına aktarılmaz" | B-01 | Doğru beyan |
| 6 | "Erişimle çerezlere onay verilmiş sayılır" — opt-in banner ile ve Kurul rehberiyle çelişiyor | `web:apps/eatkcal/content/legal/kullanim.ts:262`; mobil terms M14.4 | Kaldır |
| 7 | "Platform'u kullanmaya devam etmekle kabul etmiş sayılırsınız" (gizlilik politikası sözleşme gibi kabul ettiriliyor) | `web:…/gizlilik.ts:11` | Aydınlatma kabul gerektirmez; ifadeyi kaldır |
| 8 | Açılış sayfası "Google Analytics… 26 ay" diyor, kodda GA yok | `landing-page/privacy.html:89` | Kaldır |
| 9 | Silme talebi için `noreply@` adresi | `landing-page/privacy.html:95` | privacy@ / info@ |
| 10 | Mobil KVKK metninde kimlik bloğu ve 3-9. bölümler boş/kesik | `src/data/contractsData.ts:26` | Yeni taslak |
| 11 | KVK Kurumu adresi doğrulanmalı | `web:…/gizlilik.ts:246` | kvkk.gov.tr'den teyit |
| 12 | Uygulama içi ölçüm metni "anonim kullanım olayları" diyor; olaylar `user_id` ile bağlı (takma adlı) | `src/lib/metrics/i18n.ts:22`; `src/lib/analytics.ts:272-281` | "takma adlı" / "hesabınla ilişkilendirilebilen" |
| 13 | eatkcal /en sayfaları Türkçe metin gösteriyor | `web:apps/eatkcal/components/pages/Legal.tsx:64,150-152` | EN taslaklar |
| 14 | kcalculate.ai Koşullar/Topluluk/Çerez sayfaları yer tutucu, ama creator formu topluluk kurallarının kabulünü zorunlu tutuyor | `web:apps/kcalculate/components/Legal.tsx:41-53`; `web:apps/kcalculate/components/Interactive.tsx:128-129` | `tr/07` / `en/07` |

### B-15 · Saklama sürelerinin uygulanması

**Bulgu.** `analytics_events`, `adisyo_api_log`, `adisyo_webhook_events`, `notification_sends`, `failed_payments` ve Storage için silme/imha işi yok. Gün kartı yalnız erişimi kapatıyor, dosya kalıyor (`supabase/migrations/20261104000500_day_shares.sql:26`). `deleted_account_fingerprints` süresiz.

**Öneri.** `tr/09` tablosundaki sürelere göre pg_cron imha işleri + imha kayıt tablosu (Yönetmelik: periyodik imha en fazla 6 ayda bir; imha kayıtları 3 yıl — teyit). Liste `ENTEGRASYON.md` §7.

### B-16 · Ham entegrasyon günlükleri

- `adisyo_api_log.request_body` tam SaveOrder isteğini (ad, telefon, adres) tutuyor (`supabase/functions/adisyo-save-order/index.ts:405`).
- `adisyo_webhook_events.raw_payload` tüm kanalların (Yemeksepeti, Getir vb.) siparişlerini tutuyor.
- `tosla-callback` tüm parametreleri `console.log`'luyor ve `failed_payments`'e yazıyor (`supabase/functions/tosla-callback/index.ts:25,82-88`).

**Öneri.** Yazarken maskele (telefonun son 4 hanesi, adres yerine ilçe); 30 gün saklama; Tosla uçlarını kapat (aktif değil).

---

## P2

### B-17 · ABD eyalet mevzuatı

- **CCPA/CPRA eşikleri** bugün muhtemelen karşılanmıyor: yıllık brüt gelir ~25 milyon USD (enflasyon ayarlı), 100.000+ Kaliforniyalı tüketici veya gelirin %50'si veri satışından (teyit). Yine de taslak politika bir ABD bölümü içeriyor.
- Meta reklam ölçümü CPRA anlamında "sharing" (bağlamlar arası davranışsal reklam) sayılır → "Do Not Sell or Share" bağlantısı ve Global Privacy Control sinyalinin tanınması önerilir.
- **Washington My Health My Data Act** (RCW 19.373) gelir eşiği olmadan uygulanır. "Tüketici sağlık verisi" geniş tanımlı: kilo, beslenme ve vücut ölçüsü bağlamı dahil olabilir.
  - Toplama için onay, paylaşım için **ayrı** onay ve satış için yazılı yetki gerekir.
  - Ana sayfada ayrı bir "Consumer Health Data Privacy Policy" bağlantısı gerekir.
  - Özel dava hakkı vardır.
- Nevada SB 370 benzer.
- **Öneri:** ABD'de yayın kararı verilmeden önce MHMDA uyumu (taslak `en/01` §US). Alternatif: ABD'yi başlangıçta mağaza bölgelerinden çıkar.

### B-18 · Herkese açık kovalar

- Avatar dosya adı `{userId}.{ext}`, yani tahmin edilebilir (`src/modules/profil/avatarUpload.ts:24-35`).
- `post-media` herkese açık. Gizli profildeki (`is_private`) kullanıcıların gönderi medyası da genel URL ile erişilebilir (`supabase/migrations/20261104000400_post_media_storage.sql:17-20`).
- **Öneri:** rastgele dosya adı; gizli profil medyası için özel kova + imzalı URL.

### B-19 · DSA / 5651 içerik süreçleri

- Bildirim-kaldırma (DSA md.16) için kayıtlı olmayan kullanıcıların da bildirimde bulunabileceği bir web formu gerekir.
- Gerekçe bildirimi (md.17) ve iç şikâyet sistemi (md.20, en az 6 ay) gerekir.
- Mevcut: uygulama içi şikâyet (`src/modules/kesfet/client.ts:147`), AI ön kontrol, ret mesajı (`src/core/i18n/dictionaries.ts:296,458`).
- **Eksikler:** itiraz kaydının sunucu tarafında izlenmesi ve web bildirim formu.
- 5651: yer sağlayıcı olarak hukuka aykırı içerik bildirimine uyma ve trafik bilgisi saklama yükümlülükleri (süre teyit). Sosyal ağ sağlayıcı yükümlülükleri (md. ek 4: günlük 1 milyon erişim eşiği) bugün uygulanmaz.

### B-20 · Diğer

| Konu | Kanıt | Öneri |
|---|---|---|
| Sentry varsayılan kırıntıları (console dahil) açık; ödeme akışında üretimde `console.log` var | `src/lib/sentry.ts:36-51` | `beforeBreadcrumb` ile console kırıntılarını kapat veya maskele |
| Resend yedek alıcısı kişisel bir Gmail adresi (şube sipariş e-postaları müşteri adı/telefonu içerir) | `supabase/functions/order-alert/index.ts:13` | Kurumsal adres; işleyen/yetki kaydı |
| Ölü Tosla satır içi kart formu (kart no, SKT, CVV doğrudan Tosla'ya) | `src/modules/eatkcal/screens/CheckoutScreen.tsx:120,1955-1982` | Kodu kaldır (PCI kapsamı) |
| E-ticaret künyesi: KEP, ticaret sicil no eksik (ETK md.3 + *Elektronik Ticarette Hizmet Sağlayıcı ve Aracı Hizmet Sağlayıcılar Hakkında Yönetmelik*) | `web:apps/eatkcal/lib/site.ts:5-14` | `KURUMSAL_KIMLIK.md` §3 |
| **Vergi dairesi / KEP eklenmedi** (L-S2, 9 Kas 2026): mevcut yayındaki metinlerde ikisi de yok; taslaklardaki vergi dairesi ve KEP satırları kaldırıldı, yer tutucu bırakılmadı. KEP başvuru kanalı (KVKK aydınlatma, başvuru formu) da çıkarıldı | `web:apps/eatkcal/content/legal/mesafeli.ts` | Vergi dairesi adını fatura sisteminden al; KEP zorunluluğunu teyit et, adres alınırsa kimlik bloklarına ve başvuru kanallarına geri ekle |
| `push_tokens.device_name` eski iOS'ta kişinin adını içerebilir | `src/core/notifications.ts:128,138` | Yalnız model adını yaz |
| AI tarama/moderasyon "yalnız dosya" — canlıya alınırken aydınlatma, DPA (Anthropic), mağaza etiketi birlikte güncellenmeli | `supabase/functions/analyze-ai-scan/index.ts:2` | Yayın kontrol listesi (`ENTEGRASYON.md` §8) |
| AB Yapay Zekâ Tüzüğü (2024/1689): besin tahmini düşük risk; md.50 şeffaflık yükümlülükleri sohbet botu/üretken içerik için (2 Ağustos 2026'dan itibaren — teyit) | — | Kullanım koşullarında "AI tahmini" açıklaması yeterli görünüyor; ileride AI sohbet eklenirse md.50 |

---

<!-- L-S3 -->
## kcalAI — abonelik, AI tarama, sesli giriş, Koç (L-S3, 11 Kas 2026)

Kaynak: A-S1 boşluk raporu A2 (EULA + abonelik maddesi) ve A3 (AI/ses/RevenueCat gizlilik). Metinler: `tr/05-kullanim-kosullari.md` §12A, `tr/01-gizlilik-politikasi.md` §5A, §5B, §11A, §12A, §13A; mağaza: `MAGAZA_GIZLILIK_ESLEME.md`. Kod kanıtları `release/1.1.0` dalına göredir.

<!-- L-S3 -->
### B-21 · Apple EULA yolu (P0 — 1.1.0 incelemesi, Kılavuz 3.1.2)

- **Durum:** Otomatik yenilenen abonelik için ASC'de Lisans Sözleşmesi + uygulama açıklamasında Kullanım Koşulları (EULA) ve Gizlilik Politikası bağlantısı gerekir. Kodda bağlantı G25-S1 md.2 ile ekleniyor (iOS → Apple Standard EULA, Android → Koşullar).
- **Seçenekler:** (a) **Standard EULA** + Koşullar'ı ek metin olarak yayımla (taslak §12A.12 bu yola göre yazıldı); (b) Koşullar'ı ASC'ye **özel EULA** olarak yükle — bu durumda §13.1 zaten Apple'ın asgari şartlarını içeriyor, §12A.12 "Standard EULA" cümlesi çıkarılır.
- **Öneri:** (a) — inceleme riski en düşük, metin değişikliği ASC güncellemesi gerektirmez.
- **İlter karar verecek:** (a) mı (b) mi; ASC açıklamasına eklenecek iki bağlantının metni.

<!-- L-S3 -->
### B-22 · Konuşma tanıma: cihazda mı, platform hizmeti mi? (P0)

- **Kod (release/1.1.0):** `src/modules/ai/scan/voice/speech.ts:46-58` → `requiresOnDeviceRecognition: supportsOnDeviceRecognition()`. Cihaz destekliyorsa cihazda; desteklemiyorsa işletim sisteminin sunucu tanımasına (Apple/Google) düşüyor. `recordingOptions` yok → ses dosyası oluşmuyor.
- **G25-S1 md.11** bunu denetliyor; LOG bu taslak yazılırken yoktu. Gizlilik metni §5A'da **SEÇENEK A** (yalnız cihazda; desteklenmezse sesli giriş kapalı) ve **SEÇENEK B** (desteklenmezse Apple/Google) köşeli parantezle bırakıldı.
- **Öneri:** Gizlilik açısından A daha temiz (ses hiç cihazdan çıkmaz, mağaza etiketi sade). B'de Apple/Google bağımsız veri sorumlusu olarak metne ve §12 tablosuna girer (taslakta hazır).
- **İlter karar verecek:** A mı B mi (G25-S1 LOG'u ile birlikte). Seçilmeyen paragraf ve §12 tablosundaki "[yalnız SEÇENEK B'de]" satırı silinir.

<!-- L-S3 -->
### B-23 · AI ve abonelik için yurt dışı aktarım (P0 — B-01'in kcalAI parçası)

- Yeni alıcılar: **Anthropic PBC** (sesli giriş metni, Koç mesajları + günlük takip özeti) ve **RevenueCat, Inc.** (abonelik kayıtları, kullanıcı kimliği). İkisi de ABD.
- Taslak §13A aktarımı **standart sözleşmeye**, sağlık verisinin işlenmesini **açık rızaya** (md.6/3-a) dayandırıyor; uygulama içi AI izni md.9 rızası olarak sunulmuyor (2024 rejiminde düzenli aktarım rızaya dayanamaz).
- **Yapılacak:** iki sağlayıcıyla Kurul standart sözleşmesi (sağlayıcı imzalamıyorsa alternatif: bağlayıcı şirket kuralları yok → aktarım yapılamaz riski), imzadan sonra 5 iş günü içinde Kurum'a bildirim; Anthropic DPA'sında saklama süresi ve "eğitimde kullanılmaz" taahhüdünün teyidi; RevenueCat DPA + alt işleyen listesi.
- **İlter karar verecek:** (1) AI izni metninin "açık rıza" mı "bilgilendirme + onay" mı olarak konumlandırılacağı; (2) standart sözleşme imzalanana kadar AI özelliklerinin (bayrak `ai_tarama`, `koc`) TR kullanıcılara açılıp açılmayacağı.

<!-- L-S3 -->
### B-24 · Koç sohbeti 30 gün silme (P0 — `koc` bayrağı açılmadan önce)

- `supabase/functions/coach-chat/index.ts:289-296`: 30 günden eski mesajlar **yalnız aynı kullanıcı yeni mesaj gönderdiğinde** siliniyor. Koç'u bırakan kullanıcının geçmişi süresiz kalır → §5B "30 gün saklanır" cümlesi gerçeğe aykırı olur.
- **Öneri:** günlük `pg_cron` işi: `delete from coach_messages where created_at < now() - (coach_retention_days || ' days')::interval` (migration dosyası + rollback). Saklama ve İmha Politikası'na (09) satır.
- **İlter karar verecek:** 30 gün süresi uygun mu (Koç "geçmiş" ekranı kullanıcıya değer sağlıyor; daha uzun süre açık rıza metninde belirtilmeli).

<!-- L-S3 -->
### B-25 · Hesap silme ve abonelik (P1)

- RevenueCat müşteri kaydı hesap silmede silinmiyor (silme akışında RevenueCat REST `DELETE /subscribers/{app_user_id}` çağrısı yok). Kendi tablomuz (`user_entitlements`) `on delete cascade` ile siliniyor.
- Aktif abonelik silmeyle iptal olmaz: silme onayına uyarı + "Aboneliği yönet" (G25-S1 md.6). Koşullar §15.4 bu davranışa göre yazıldı.
- **Öneri:** `delete-account` fonksiyonuna RevenueCat silme çağrısı (mağaza kayıtları Apple/Google'da kalır, bu bizim kontrolümüzde değil — metin bunu söylüyor).

<!-- L-S3 -->
### B-26 · Aboneliklerde cayma hakkı ve satıcı sıfatı (P1)

- **Türkiye:** Mesafeli Sözleşmeler Yönetmeliği md.15/1-ğ — elektronik ortamda anında ifa edilen hizmetler cayma hakkının istisnası. App Store/Play satışında satıcı kim? (Apple ve Google çoğu ülkede "satıcı/komisyoncu" sıfatıyla tüketiciyle sözleşme yapar; Türkiye için durum teyit edilmeli.)
- **AB:** 2011/83/AB md.16(m) — dijital içerikte istisna için açık onay + hakkın kaybedildiğinin kabulü; Apple/Google bunu kendi akışında yönetiyor mu?
- Taslak §12A.7 yalnız "zorunlu haklar saklıdır" diyor; §12A.13 aboneliklere eatkcal satış belgelerinin uygulanmadığını söylüyor.
- **İlter karar verecek:** aboneliklere ayrı bir ön bilgilendirme gerekip gerekmediği; TKHK md.48 vd. abonelik sözleşmesi hükümlerinin (Abonelik Sözleşmeleri Yönetmeliği) uygulama içi satışta bizim yükümlülüğümüz olup olmadığı.

<!-- L-S3 -->
### B-27 · Open Food Facts ve GeoNames atıfları (P2)

- Barkod sonucunda "Veri: Open Food Facts" var (`src/core/i18n/dictionaries.ts:1244`), lisans adı ve bağlantı yok. ODbL md.4.3 atıf ister.
- GeoNames atfı Profil › Sözleşmeler'de var (`SettingsAgreementsScreen.tsx:97`).
- Barkod sorgusu cihazdan doğrudan `world.openfoodfacts.org`'a (Fransa) gidiyor (`src/modules/ai/scan/barcode/off.ts:12`): yalnız barkod + IP. Taslak §12 tablosunda Open Food Facts bağımsız veri sorumlusu olarak yazıldı.
- **Öneri:** Profil › Sözleşmeler'e "Barkod verisi: Open Food Facts (ODbL)" + bağlantı.

<!-- L-S3 -->
### B-28 · AB Yapay Zekâ Tüzüğü md.50 — Koç (P1, AB'de yayın varsa)

- B-20'deki "ileride AI sohbet eklenirse md.50" koşulu gerçekleşti: Koç bir sohbet botu. md.50(1): kişiye bir yapay zekâ sistemiyle etkileşimde olduğu bildirilmeli (bağlamdan açık değilse). Koç adı + Intro ekranı muhtemelen yeterli; açık cümle önerilir ("Koç bir yapay zekâdır, insan değildir").
- Koşullar §12A.11 bunu söylüyor; uygulama içi Koç Intro metninde de olmalı.

<!-- L-S3 -->
### B-29 · Mağaza etiketinde "izleme" (P1)

- Görev tanımı "izleme yok" diyor. kcalAI verileri (AI, Koç, abonelik) **izlenmiyor** — `src/lib/metrics/events.ts:178-205` abonelik/Koç olaylarında `meta:` yok.
- Ama Meta SDK + ATT ile eatkcal ticaret olayları ve IDFA/GAID rızayla Meta'ya gidiyor (`app.config.js:81-87` `NSPrivacyTracking: true`) → Apple etiketinde Purchase History, Product Interaction, Device ID "İzleme: Evet" kalır.
- **İlter karar verecek:** etiket bugünkü gibi "İzleme: Evet" (Meta satırları) mı kalsın, yoksa Meta reklam ölçümü kaldırılıp uygulama tamamen "izleme yok" mu olsun? Kaldırılırsa ATT penceresi, Meta rıza metni (03 §4) ve Gizlilik §7 de çıkar.

<!-- L-S3 -->
### B-30 · Uygulama içi izin metinleri (P0)

- `src/lib/consent/i18n.ts` `ai_coach_*`: kodda "METİN İLTER ONAYI BEKLİYOR". Önerilen metin Gizlilik §5B ile tutarlı: "Koça yazdıkların ve günlük takip özetin (hedeflerin, son 7 günün, son öğünlerin) yanıt üretmek için yapay zekâ hizmet sağlayıcımıza (ABD) gönderilir. Sohbet geçmişin 30 gün saklanır; istediğin zaman silebilirsin."
- `ai_photo` izin penceresinde Gizlilik Politikası bağlantısı yok (A-S1 A3; anahtar `privacy_link` mevcut).
- İzin metni sürümü (`AI_PHOTO_TEXT_VERSION` = 2): gizlilik metni yayımlanınca sürüm artırılmalı mı? (İçerik değişmiyorsa hayır.)

<!-- L-S3 -->
### B-31 · Abonelik işletme kuralları (P2)

- Koşullar §12A.2 "ödeme yaptığın dönem içinde haklarını aleyhine değiştirmeyiz" diyor → `app_settings` (`ai_daily_fresh`, `ai_daily_balance`, `coach_daily_balance`) dönem içinde düşürülmemeli; düşürülecekse 30 gün önce bildirim (§19).
- Aile Paylaşımı ASC'de açık mı? Açıksa §12A.10 değişir.
- Fiyat metinde yazılmadı (mağaza gösteriyor).

<!-- L-S3 -->
### B-32 · Koç'un SEKULART ürünlerini önermesi (P2)

- Koç kartları eatkcal ürünlerini "Sepete ekle" ile önerebiliyor (`coach-chat` kart beyaz listesi). Ticari Reklam ve Haksız Ticari Uygulamalar Yönetmeliği (örtülü reklam yasağı) ve AB 2005/29/AT açısından öneri "SEKULART ürünü" olarak ayırt edilebilir olmalı. Koşullar §12A.11 son madde bunu açıklıyor; arayüzde ürün kartında marka/“eatkcal” etiketi önerilir.

---

## Karar bekleyen sorular (avukat)

1. Beslenme/kilo verisi özel nitelikli mi? (Taslaklar "evet" varsayımıyla yazıldı — B-03)
2. VERBİS kaydı yapılsın mı? (Öneri: evet — B-04)
3. AB/UK/ABD'de yayın zamanlaması; temsilci atanana kadar mağaza bölge kısıtı? (B-12, B-17)
4. Push pazarlama bildirimleri ETK onayına tabi tutulacak mı? (Öneri: evet — B-11)
5. Makro paketlerinde "kullanılmasa da iade yok" kuralı korunacak mı? (TKHK md.5 haksız şart riski — `MESAFELI_KARSILASTIRMA.md`)
6. Uyuşmazlıklarda ABD kullanıcıları için tahkim/sınıf davası feragati istenecek mi? (Taslakta yok)
7. <!-- L-S3 --> iOS lisansı: Apple Standard EULA mı, Koşullar özel EULA olarak mı? (Öneri: Standard EULA — B-21)
8. <!-- L-S3 --> Konuşma tanıma: SEÇENEK A (yalnız cihazda) mı, B (desteklenmezse Apple/Google) mı? (B-22; G25-S1 LOG'u ile)
9. <!-- L-S3 --> Anthropic ve RevenueCat standart sözleşmeleri imzalanana kadar AI özellikleri ve abonelik TR'de açılsın mı? Uygulama içi AI izni hukuken "açık rıza" olarak mı konumlanacak? (B-23)
10. <!-- L-S3 --> Koç sohbet saklama süresi 30 gün uygun mu; zamanlanmış silme işi Koç açılmadan şart koşulsun mu? (Öneri: evet — B-24)
11. <!-- L-S3 --> Aboneliklerde cayma hakkı: ayrı ön bilgilendirme gerekiyor mu; satıcı Apple/Google mı biz miyiz? (B-26)
12. <!-- L-S3 --> Mağaza etiketi "İzleme: Evet" (Meta) kalsın mı, Meta reklam ölçümü kaldırılıp "izleme yok" mu olunsun? (B-29)
13. <!-- L-S3 --> `ai_coach` izin metni (B-30'daki öneri) onaylanıyor mu?
14. <!-- L-S3 --> Koşullar §12A.2'deki "dönem içinde hak düşürmeme" taahhüdü ve günlük hak tablosunun metinde sayıyla yer alması uygun mu? (B-31)
