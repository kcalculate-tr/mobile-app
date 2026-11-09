# Kişisel Veri Saklama ve İmha Politikası

> **TASLAK — hukuki inceleme için (İlter Öziseven). Yayımlanmadı.**
> Sürüm: `v0.1-taslak` · Tarih: 2026-11-09 · Dayanak envanter: `docs/legal/VERI_ENVANTERI.md`

**Veri sorumlusu:** SEKULART Ltd. — `[TAM UNVAN]` · MERSİS `[MERSİS]` · VKN `[VKN]` · Adres `[ADRES]` · KEP `[KEP]` · İletişim `[privacy@…]`

---

## 1. Amaç

Bu Politika; SEKULART Ltd.'nin ("Şirket") Kcalculate AI uygulaması, eatkcal sipariş hizmeti, kcal., tera ve Breaking Fast markaları ile eatkcal.com ve kcalculate.ai web siteleri üzerinden işlediği kişisel verilerin ne kadar süre saklanacağını ve bu süre sonunda nasıl silineceğini, yok edileceğini veya anonim hâle getirileceğini belirler.

Politika şu düzenlemelere dayanır:
- 6698 sayılı Kişisel Verilerin Korunması Kanunu ("KVKK") md.4, md.7 ve md.12;
- Kişisel Verilerin Silinmesi, Yok Edilmesi veya Anonim Hale Getirilmesi Hakkında Yönetmelik (RG 28.10.2017, 30224) ("Yönetmelik");
- AB Genel Veri Koruma Tüzüğü ("GDPR") md.5(1)(e) (saklama sınırlaması) ve md.17 (silme hakkı), uygulandığı ölçüde.

> **[İnceleme notu]** Yönetmelik md.5 uyarınca VERBİS'e kayıt yükümlüsü veri sorumluları bu politikayı hazırlamak zorundadır. Özel nitelikli veri (sağlık sayılabilecek beslenme/vücut verisi) işlemek Kcalculate AI için ana faaliyet sayılabileceğinden, Şirket VERBİS kayıt muafiyetinden yararlanamayabilir (bkz. `BOSLUKLAR.md`). Kayıt yükümlülüğü olmasa bile bu Politika KVKK md.4/2-d ve md.7'ye uyumun ispatı için önerilir.

## 2. Kapsam

Politika, Şirket'in tamamen veya kısmen otomatik yollarla ya da bir veri kayıt sisteminin parçası olarak işlediği tüm kişisel verileri kapsar. Kapsamdaki veri sahipleri: kullanıcılar, müşteriler, pazaryeri müşterileri, web formu dolduranlar, iş ortağı/creator başvuru sahipleri ve destek talebi gönderenler.

Çalışan ve aday verileri ayrı bir İK ekiyle düzenlenecektir: `[EK-İK — kapsam dışı, ayrıca hazırlanacak]`.

## 3. Tanımlar

| Terim | Anlam |
|---|---|
| Silme | Kişisel verinin ilgili kullanıcılar için hiçbir şekilde erişilemez ve tekrar kullanılamaz hâle getirilmesi (Yönetmelik md.8) |
| Yok etme | Kişisel verinin hiç kimse tarafından erişilemez, geri getirilemez ve tekrar kullanılamaz hâle getirilmesi (md.9) |
| Anonim hâle getirme | Verinin başka verilerle eşleştirilse dahi kimliği belirli veya belirlenebilir bir gerçek kişiyle ilişkilendirilemez hâle getirilmesi (md.10) |
| Periyodik imha | Saklama süresi dolan verilerin bu Politikada belirtilen aralıklarla resen imhası (md.11) |
| Kayıt ortamı | Verinin bulunduğu her türlü ortam (veritabanı, dosya deposu, cihaz belleği, e-posta kutusu, üçüncü taraf sistemi) |
| İmha tutanağı | Her imha işleminin ne, ne zaman, kim tarafından ve hangi yöntemle yapıldığını gösteren kayıt |

## 4. Sorumlular (unvan bazlı RACI)

R = Yapan · A = Onaylayan/hesap veren · C = Danışılan · I = Bilgilendirilen

| Görev | Veri Koruma Sorumlusu `[UNVAN]` | Teknik Lider / CTO `[UNVAN]` | Hukuk `[UNVAN]` | Operasyon / Şube Yönetimi `[UNVAN]` | Muhasebe `[UNVAN]` |
|---|---|---|---|---|---|
| Politikanın hazırlanması ve yıllık gözden geçirilmesi | R | C | A | I | C |
| Saklama süresi tablosunun güncel tutulması | R | C | A | C | C |
| Otomatik imha işlerinin kurulması ve izlenmesi | C | R/A | I | I | I |
| Periyodik imha ve imha tutanağı | A | R | I | I | I |
| Talep üzerine silme (veri sahibi başvurusu) | A | R | C | I | C (mali kayıt istisnası) |
| Üçüncü taraf (işleyen) silme teyitleri | R | C | A | I | I |
| Mali kayıtların saklanması | I | C | C | I | R/A |

## 5. Kayıt ortamları

| Ortam | İçerik | Konum | Kanıt (envanter) |
|---|---|---|---|
| Supabase Postgres (`public`, `tracking`, `auth` şemaları) | Hesap, profil, adres, sipariş, sağlık, sosyal, analitik, bildirim verileri | Supabase — görev tanımına göre AB bölgesi (teyit edilecek) | VERI_ENVANTERI §1 |
| Supabase Storage — `user-media` (özel) | AI tarama fotoğrafları, gün kartı görselleri | Supabase AB | `supabase/migrations/20261104000700_user_media_bucket.sql:17-19` |
| Supabase Storage — `post-media` (herkese açık) | Keşfet gönderi foto/video/kareleri | Supabase AB | `supabase/migrations/20261104000400_post_media_storage.sql:9-20` |
| Supabase Storage — `avatars` | Profil fotoğrafları (`{uid}.{ext}`) | Supabase AB | `src/modules/profil/avatarUpload.ts:24-35` |
| Supabase Storage — `support-attachments` (herkese açık) | Destek talebi ekleri | Supabase AB | `supabase/migrations/20261021132735_storage_public_assets_and_support_attachments.sql:26-44` |
| Supabase yedekleri (PITR / günlük yedek) | Veritabanının tam kopyası | Supabase AB | Supabase plan ayarı — teyit |
| Kullanıcı cihazı (AsyncStorage, belge dizini) | Oturum, seçili adres, çevrimdışı kuyruklar, tercih anahtarları | Kullanıcının cihazı | VERI_ENVANTERI §1.10 |
| Sentry | Çökme/performans kayıtları, kullanıcı UUID'si | ABD / Sentry bölgesi (teyit) | `src/lib/sentry.ts:33-68` |
| Meta | Reklam ölçüm olayları | İrlanda / ABD | `src/lib/analytics.ts:107-199` |
| Expo (push, EAS Update) | Push jetonu, bildirim içeriği (geçici) | ABD | `supabase/functions/send-notification/index.ts:234-252` |
| Anthropic | AI tarama görseli, moderasyon girdisi (geçici) | ABD | `supabase/functions/analyze-ai-scan/index.ts:233`; `supabase/functions/moderate-content/index.ts:246` |
| Vercel | Web erişim kayıtları, form istekleri | ABD / edge | web reposu |
| Resend ve e-posta kutuları (`info@`, şube e-postaları) | Sipariş bildirimleri, destek yazışmaları | ABD / e-posta sağlayıcısı | `supabase/functions/order-alert/index.ts:19,95-151,209-216` |
| Adisyo | POS'a iletilen sipariş verisi (ad, telefon, adres) | Türkiye (teyit) | `supabase/functions/adisyo-save-order/index.ts:336-350` |
| Muhasebe / e-fatura sistemi | Fatura ve mali kayıtlar | Türkiye | — (mali müşavir sistemi) |
| Basılı ortam | Teslimat fişleri, şube çıktıları (varsa) | Şubeler | `[varsa tanımlanacak]` |

## 6. Teknik ve idari tedbirler (KVKK md.12)

### 6.1 Teknik tedbirler
- **Satır düzeyi güvenlik (RLS):** Kullanıcı tablolarında RLS açıktır; kullanıcı yalnız kendi satırlarına (`user_id = auth.uid()`) erişir (`supabase/migrations/20261103000100_security_rls_policies.sql`).
- **Servis rolü ayrımı:** Kart jetonu gibi hassas tablolara yalnız sunucu tarafı servis rolü erişir; istemciye kapalıdır (`user_card_secrets` — `supabase/migrations/20261103000100_security_rls_policies.sql:62`).
- **Kart verisi:** Tam kart numarası ve CVV Şirket sistemlerine hiç girmez; lisanslı ödeme kuruluşunun barındırdığı sayfada alınır (`supabase/functions/paynkolay-payment-init/index.ts:5`).
- **Aktarımda şifreleme:** Tüm istemci–sunucu ve sunucu–üçüncü taraf trafiği TLS/HTTPS iledir. Kalıcı depoda şifreleme Supabase altyapısında sağlanır (teyit).
- **Veri minimizasyonu:** Analitik olay özellikleri beyaz listeyle süzülür ve kişisel veri gibi görünen değerler atılır (`src/lib/metrics/sanitize.ts:14-32,85-95`; sunucu süzgeci `supabase/migrations/20261109100300_d_s1_kpi.sql:137-141`). AI'ya kullanıcı kimliği gönderilmez (`supabase/functions/analyze-ai-scan/index.ts:217-227`).
- **Erişim kaydı ve izleme:** Supabase günlükleri ve güvenlik önerileri (advisors), Sentry uyarıları.
- **Fotoğraf:** Tarama kamerasında EXIF kapalıdır, görsel en fazla 1600 px'e küçültülür (`src/modules/ai/scan/ui/FinScanCamera.tsx:183`; `src/modules/ai/scan/imageResize.ts:47-57`).

### 6.2 İdari tedbirler
- **Yetki matrisi:** Yönetici erişimi `admin_allowlist` ile sınırlıdır (`supabase/migrations/20260926111527_yorumlar_admin_erisimi.sql:24-36`). Şube personeli yalnız kendi şubesinden sipariş vermiş müşterilerin profilini görür (`supabase/migrations/20260916200000_profiles_branch_scope.sql:7-17`). Moderatör erişimi rolle sınırlıdır.
- **Gizlilik taahhütleri:** Kişisel veriye erişen personelle gizlilik taahhütnamesi imzalanır `[şablon eklenecek]`.
- **Eğitim:** Yıllık KVKK ve veri güvenliği eğitimi.
- **İşleyen sözleşmeleri (DPA):** Her işleyenle KVKK md.12/2 ve GDPR md.28 hükümlerini içeren sözleşme yapılır; yurt dışı aktarımda Kurul'un standart sözleşmesi imzalanır ve 5 iş günü içinde Kurum'a bildirilir (KVKK md.9/5).
- **İşten ayrılma:** Ayrılan personelin hesapları ve oturumları aynı gün kapatılır.

## 7. Saklama ve imha süreleri

Süreler, ilgili saklama nedeni ortadan kalktığı andan (çoğunlukla hesap silme, rıza geri alma, sözleşmenin sona ermesi) başlar. Mali kayıtlarda süre, kaydın ait olduğu takvim yılını izleyen yılın başından başlar.

| # | Veri kategorisi | Tablo / konum | Saklama dayanağı | Süre | İmha yöntemi | Kanıt |
|---|---|---|---|---|---|---|
| 1 | Hesap ve profil verileri (ad, e-posta, telefon, handle, biyografi, avatar) | `auth.users`, `profiles`, `avatars` kovası | KVKK md.5/2-c (sözleşme) | Hesap süresince + silmeden sonra 30 gün (yedek döngüsü) | Silme (DB DELETE + cascade); avatar dosyasını yok etme; yedeklerde döngüyle | `supabase/functions/delete-account/index.ts:229-233`; `src/modules/profil/avatarUpload.ts:24-35` |
| 2 | Teslimat adresleri ve koordinatlar | `addresses` | md.5/2-c | Kullanıcı silene veya hesap silinene kadar + 30 gün | Silme | `CANLI_SEMA:5`; `supabase/migrations/20260918130000_addresses_geo_verification.sql:6-8` |
| 3 | Sağlık sayılabilecek veriler (beslenme profili, vücut ölçüleri, öğün/kalori, su, etkinlik) | `user_nutrition_profiles`, `body_measurements`, `meal_consumptions`, `meal_logs`, `water_daily`, `activity_logs`, `tracking.*` | md.6/3-a açık rıza; GDPR md.9(2)(a) | Hesap süresince veya rıza geri alınana kadar + 30 gün | Silme | `src/modules/onboarding/takibe/save.ts:32-58`; `supabase/migrations/20261106000100_g15_water.sql:25-31` |
| 4 | AI tarama fotoğrafı | `user-media/<uid>/scans/` | md.6/3-a | Analizden sonra **30 gün** | Yok etme (Storage nesnesini silme) | `src/modules/ai/scan/client.ts:63-67` |
| 5 | AI tahmin sonucu, kota kayıtları | `ai_scan_reservations`, `ai_scan_usage` | md.6/3-a; md.5/2-c | 30 gün (sonuç kullanıcı kaydına aktarıldıktan sonra) | Silme | `supabase/migrations/20261109190100_g19_ai_scan_hardening.sql:32-34` |
| 6 | Gün kartı dosyası | `user-media` (gün kartı), `day_shares` | md.6/3-a | Erişim 24 saat; dosya ve satır 24 saat + 7 gün | Yok etme + silme | `supabase/migrations/20261104000500_day_shares.sql:20-26` |
| 7 | Sipariş ve muhasebe kayıtları | `orders`, `order_items`, `order_modifications`, `macro_transactions`, `user_credits`, `campaign_uses`, `refunds`, `failed_payments` | md.5/2-ç (hukuki yükümlülük): TTK md.82 (10 yıl); VUK md.253 (5 yıl) | **10 yıl** (hesap silinince kimliksizleştirilmiş olarak) | Hesap silmede anonimleştirme (§8.2); süre sonunda silme | `supabase/functions/delete-account/index.ts:210-222` |
| 8 | Ödeme kuruluşu ham yanıtları | `failed_payments.order_data`, `refunds.provider_response`, `card_verifications.refund_response` | md.5/2-ç; md.5/2-e | Mali kısım 10 yıl; ham yanıtın kişisel alanları 2 yıl sonra temizlenir | Kısmi anonimleştirme | `supabase/migrations/20260624000000_paynkolay_refund_infra.sql:30-43` |
| 9 | Kayıtlı kart (son 4 hane, marka, banka, takma ad) ve kart jetonu | `user_cards`, `user_card_secrets` | md.5/2-c | Kullanıcı silene veya hesap silinene kadar | Silme + ödeme kuruluşunda kart silme | `supabase/functions/delete-account/index.ts:181-207` |
| 10 | Mesafeli sözleşme ve ön bilgilendirme teyit kayıtları (metin sürümü, kabul zamanı, sipariş no) | `legal_acceptances` (önerilen; `ENTEGRASYON.md`) | md.5/2-ç, md.5/2-e; Mesafeli Sözleşmeler Yönetmeliği | **3 yıl** (sözleşme tarihinden itibaren) | Silme | Bugün kayıt yok (`src/components/checkout/CheckoutFooter.tsx:153-176`) |
| 11 | Ticari elektronik ileti onay ve ret kayıtları | `notification_preferences` + önerilen onay geçmişi tablosu; web `web_leads.marketing_consent*` | 6563 s. ETK; Ticari İletişim ve Ticari Elektronik İletiler Hakkında Yönetmelik | Onayın geçerliliğinin sona erdiği tarihten itibaren **3 yıl** | Silme | `CANLI_SEMA:53`; `web:packages/ui/src/lead-contract.ts:3-16` |
| 12 | Destek talepleri ve ekleri | `support_tickets`, `support-attachments` kovası, `info@` kutusu | md.5/2-c, md.5/2-e (TKHK kapsamındaki şikâyetlerin ispatı) | **3 yıl** | Silme + dosyayı yok etme | `supabase/migrations/20260309000000_support_tickets.sql:1-12` |
| 13 | Geri bildirim ve sipariş değerlendirmeleri | `feedback`, `reviews`, `review_item_feedback`, `review_reports` | md.5/2-f | Geri bildirim 2 yıl; değerlendirme 3 yıl | Silme veya anonimleştirme | `src/screens/FeedbackScreen.tsx:67-74`; `src/lib/orderFeedback.ts:105-133` |
| 14 | Keşfet içeriği (gönderi, yorum, tepki, takip) | `posts`, `post_media`, `post_comments`, `post_reactions`, `follows`, `post-media` kovası | md.5/2-c | Kullanıcı silene veya hesap silinene kadar | Silme (cascade) + medya dosyalarını yok etme | `supabase/migrations/20261104000200_feed_tables.sql:21-128` |
| 15 | İçerik şikâyetleri | `content_reports` | md.5/2-f; md.5/2-ç | **1 yıl** | Silme | `supabase/migrations/20261104000200_feed_tables.sql:95` |
| 16 | Moderasyon kararları (AI dahil) | `moderation_queue`, `moderation_actions`, `content_reports (source='ai')` | md.5/2-f; md.5/2-ç (itiraz yönetimi; AB DSA md.20) | **6 ay** (itiraz kapanışından sonra) | Silme | `supabase/functions/moderate-content/index.ts:103-125,306` |
| 17 | Birinci taraf analitik | `analytics_events` | md.5/2-f | Ham kayıt **24 ay**, sonra günlük/haftalık toplulaştırma | Anonimleştirme (toplulaştırma) + ham satırı silme | `supabase/migrations/20260916094149_analytics_events.sql:1-11` |
| 18 | Kaynak atfı (UTM, derin bağlantı) | `analytics_events.props`, cihaz `@kcal_attr_*` | md.5/2-f | 90 gün | Silme | `src/lib/metrics/attribution.ts:31-33` |
| 19 | Çökme ve performans kayıtları | Sentry | md.5/2-f | **90 gün** | Sentry saklama ayarıyla otomatik silme | `src/lib/sentry.ts:33-68` |
| 20 | Adisyo ham API ve webhook kayıtları | `adisyo_api_log`, `adisyo_webhook_events` | md.5/2-f (entegrasyon hata ayıklama) | **30 gün** | Silme | `supabase/migrations/20260508000000_adisyo_phase1.sql:14`; `supabase/migrations/20260508000200_adisyo_webhook_events.sql:4` |
| 21 | Pazaryeri siparişlerinin kişisel alanları | `orders` (`external_channel`), `external_payload` | md.5/2-c | Teslimden sonra **30 gün**; mali kayıt 10 yıl | Kişisel alanları anonimleştirme | `supabase/functions/trendyolgo-poll/index.ts:217-258` |
| 22 | Push jetonu | `push_tokens`, `profiles.push_token`, `support_tickets.push_token` | md.5/2-c | Pasifleştikten sonra **90 gün** | Silme | `src/core/notifications.ts:131-144,177-181` |
| 23 | Bildirim gönderim kaydı | `notification_sends`, `push_notifications`, `notifications` | md.5/2-c; md.5/2-f | **12 ay** | Silme | `CANLI_SEMA:54,56,74` |
| 24 | Kampanya hedef listeleri | `campaign_targets`, `campaigns.user_email` | md.5/1 + ETK onayı | Kampanya bitiminden sonra 12 ay | Silme | `CANLI_SEMA:26,28` |
| 25 | Silinmiş hesap parmak izi (telefon/e-posta SHA-256) | `deleted_account_fingerprints` | md.5/2-f (kupon istismarını önleme) | **2 yıl** | Silme | `supabase/migrations/20260917294000_coupon_guard_fingerprint_and_phone_normalize.sql:8-12` |
| 26 | Bilinen cihazlar | `user_known_devices` | md.5/2-f | 12 ay hareketsizlik | Silme | `supabase/migrations/20260916250000_user_known_devices.sql:5-10` |
| 27 | Web formları (bülten, iş birliği, restoran, destek, haber ver, creator) | `web_leads` | md.5/2-c (sözleşme öncesi), md.5/2-f; pazarlama md.5/1 + ETK | Amaç gerçekleşince veya en geç **12 ay**; pazarlama onay kaydı 11. satıra göre | Silme | `supabase/migrations/20261107000100_web_leads.sql:7-34` |
| 28 | eatkcal bekleme listesi | `eatkcal_waitlist_requests` | md.5/2-f / md.5/1 | Bölge açılınca bilgilendirme + 30 gün veya en geç 12 ay | Silme | `supabase/migrations/20261108000300_g18_eatkcal_waitlist.sql:8-20` |
| 29 | Trafik kayıtları (yer sağlayıcı sıfatıyla; web/uygulama erişim kayıtları) | Vercel, Supabase günlükleri | 5651 s. Kanun md.5 ve ilgili yönetmelik | **1–2 yıl** (yönetmelikteki güncel süre teyit edilecek) | Sağlayıcı ayarıyla otomatik silme | — |
| 30 | Veri sahibi başvuruları ve yanıtları | Başvuru kaydı (önerilen `dsr_requests` tablosu / `[privacy@…]` kutusu) | md.5/2-ç, md.5/2-e | **3 yıl** (yanıt tarihinden itibaren) | Silme | `tr/08-veri-sahibi-basvuru-formu-ve-sureci.md` |
| 31 | Veri ihlali kayıtları | İhlal Kayıt Defteri | md.12/5; GDPR md.33(5) | **5 yıl** (öneri) | Silme | `tr/10-veri-ihlali-mudahale-plani.md` |
| 32 | İmha tutanakları | İmha kayıt defteri | Yönetmelik md.7 | En az **3 yıl** | Silme | — |
| 33 | Cihazdaki yerel veriler | AsyncStorage, belge dizini | — | Hesap silme / çıkışta temizlenmeli; tarama kuyruğu en fazla 24 saat | Uygulama içinden silme | VERI_ENVANTERI §1.10 |

> **[İnceleme notu — mali kayıt süresi]** Mevcut web ve uygulama metinleri 10 yıllık süreyi "VUK md.253"e dayandırıyor (`web:apps/eatkcal/content/legal/gizlilik.ts:142-153`). VUK md.253 süreyi **5 yıl** olarak belirler. 10 yıllık süre TTK md.82'den gelir. Yeni metinlerde iki dayanak birlikte gösterilmiştir.

> **[İnceleme notu — mesafeli sözleşme kayıtları]** 3 yıllık süre, Mesafeli Sözleşmeler Yönetmeliği'nde satıcının bilgi ve teyit kayıtlarını saklama yükümlülüğüne dayandırılmıştır. Madde numarasının resmî metinden teyidi gerekir. Uyuşmazlıkta ispat yükü satıcıdadır; bu nedenle süre, tüketici uyuşmazlıklarında zamanaşımı dikkate alınarak uzatılabilir.

> **[İnceleme notu — 5651]** Yer sağlayıcıların trafik bilgisini saklama süresi 5651 s. Kanun md.5 ve ilgili yönetmelikte 1–2 yıl aralığında düzenlenmiştir. Şirket'in yer sağlayıcı mı yoksa yalnız içerik sağlayıcı mı sayıldığı (Keşfet kullanıcı içeriği nedeniyle yer sağlayıcılık ihtimali) ve güncel süre teyit edilmelidir.

## 8. İmha yöntemleri

### 8.1 Silme
- **Veritabanı:** İlgili satırlar `DELETE` ile silinir. `auth.users` silindiğinde `ON DELETE CASCADE` ile bağlı satırlar silinir.
- **Yedekler:** Yedeklerdeki veri, yedek döngüsü dolunca (Supabase planına göre en fazla 30 gün; teyit) kendiliğinden silinir. Yedekten geri dönüş yapılırsa, geri dönüş sonrasında silinmiş hesaplar için silme yeniden uygulanır ("tombstone" listesi).
- **Üçüncü taraflar:** İşleyenlerde (Sentry, Expo, Anthropic, Resend, Adisyo) sözleşmedeki süre sonunda silme yapılır ve gerekirse silme teyidi istenir.

### 8.2 Anonim hâle getirme

**Sipariş kayıtları** hesap silmede veya 10 yıllık süre içinde kimlikten arındırılır:

| Alan | Bugünkü durum (`delete-account/index.ts:210-222`) | Hedef |
|---|---|---|
| `user_id`, `address_id`, `customer_id` | null | null |
| `customer_name` | "Silinen Kullanıcı" | "Silinen Kullanıcı" |
| `customer_email`, `phone`, `address`, `note` | null | null |
| `city`, `district` | **korunuyor** | İl korunabilir (mali raporlama); ilçe korunabilir |
| `neighbourhood` | **korunuyor** | null (mahalle + sipariş zamanı birlikte kişiyi belirlenebilir kılabilir) |
| `items` | korunuyor | Korunur (ürün bilgisi, mali kayıt) |
| `external_payload` (pazaryeri ham paketi) | **korunuyor** | Kişisel alanları (ad, telefon, adres, not) temizlenmiş hâle dönüştürülür |
| `order_modifications.new_address_text`, `customer_note` | **korunuyor** | null |
| `order_alert` e-postaları | şube kutularında kalıyor | E-posta kutusu saklama kuralı: 12 ay |

**Analitik:** Ham olaylar 24 ay sonra `anon_id`, `session_id` ve `user_id` içermeyen günlük toplamlara dönüştürülür, ham satırlar silinir.

### 8.3 Yok etme
- **Storage nesneleri:** `user-media`, `post-media`, `avatars`, `support-attachments` kovalarındaki dosyalar Storage API ile kaldırılır. Herkese açık kovalarda CDN önbelleği ayrıca boşaltılır.
- **Fiziksel ortam:** Basılı belgeler kâğıt imha makinesiyle yok edilir; kullanımdan çıkan cihazların depolaması güvenli silme yöntemiyle temizlenir.

## 9. Periyodik imha

- **Periyodik imha süresi 6 aydır** (Yönetmelik md.11: en fazla 6 ay). Her yıl Ocak ve Temmuz aylarında periyodik imha yapılır ve tutanağa bağlanır.
- Önerilen **aylık otomatik işler** (pg_cron + edge function; bkz. `ENTEGRASYON.md`):
  - `purge_ai_scan_photos`: 30 günü geçen tarama fotoğrafları ve `ai_scan_reservations` satırları;
  - `purge_day_share_files`: süresi 7 günden fazla geçmiş gün kartı dosyaları;
  - `purge_adisyo_logs`: 30 günü geçen `adisyo_api_log` / `adisyo_webhook_events`;
  - `purge_push_tokens`: 90 günden fazla pasif jetonlar;
  - `purge_notification_sends`: 12 ayı geçen gönderim kayıtları;
  - `aggregate_analytics`: 24 ayı geçen `analytics_events`;
  - `purge_fingerprints`: 2 yılı geçen `deleted_account_fingerprints`;
  - `purge_content_reports` / `purge_moderation`: 1 yıl / 6 ay;
  - `mask_marketplace_pii`: teslimden 30 gün sonra pazaryeri kişisel alanları.
- Otomatik işler her çalıştırmada silinen satır sayısını bir imha günlüğüne yazar; bu günlük 6 aylık tutanağın ekidir.

## 10. Talep üzerine imha

- Veri sahibinin silme talebi (KVKK md.7 ve md.11; GDPR md.17) en geç **30 gün** içinde sonuçlandırılır (KVKK md.13).
- Saklama için hukuki dayanak devam eden veriler (ör. 10 yıllık mali kayıtlar) silinmez; veri sahibine gerekçesiyle bildirilir ve bu veriler kimliksizleştirilir.
- Uygulama içi hesap silme (Profil › Güvenlik › Hesabımı Sil) bu talebin otomatik yoludur (`supabase/functions/delete-account/index.ts`).

## 11. İmha tutanağı

Her imha işleminde şunlar kaydedilir: tarih, veri kategorisi, kayıt ortamı, kayıt sayısı, imha yöntemi (silme / yok etme / anonimleştirme), dayanak (periyodik / talep / süre dolumu), yapan ve onaylayan. Tutanaklar en az **3 yıl** saklanır (Yönetmelik md.7).

## 12. Uygulama boşlukları (bugünkü kod)

| # | Boşluk | Etki | Kanıt |
|---|---|---|---|
| U-1 | Hesap silmede Storage dosyaları (avatar, AI tarama, gönderi medyası, destek ekleri) silinmiyor | Silme hakkı tam karşılanmıyor | VERI_ENVANTERI §3; `supabase/functions/delete-account/index.ts` (Storage çağrısı yok) |
| U-2 | Adisyo ham kayıtları (ad, telefon, adres) süresiz tutuluyor ve hesap silmede anonimleştirilmiyor | Saklama sınırlaması ihlali riski | `supabase/migrations/20260508000000_adisyo_phase1.sql:14`; `supabase/functions/adisyo-save-order/index.ts:405` |
| U-3 | Silinmiş hesap parmak izleri süresiz | Ölçülülük | `supabase/migrations/20260917294000_coupon_guard_fingerprint_and_phone_normalize.sql:8-12` |
| U-4 | Push jetonları çıkış/silmede yalnız pasifleşiyor, silinmiyor | Saklama sınırlaması | `src/core/notifications.ts:177-181` |
| U-5 | `support_tickets.user_id` FK'sinde `ON DELETE` yok; destek talebi olan kullanıcının silinmesi başarısız olabilir | Silme talebinin yerine getirilememesi | `supabase/migrations/20260309000000_support_tickets.sql:3` |
| U-6 | Sipariş anonimleştirmesi `neighbourhood`, `external_payload`, `order_modifications.new_address_text` alanlarını kapsamıyor | Eksik anonimleştirme | `supabase/functions/delete-account/index.ts:210-222` |
| U-7 | `feedback.user_email`, `campaign_targets.user_email` hesap silmede temizlenmiyor | Eksik silme | `CANLI_SEMA:26,40` |
| U-8 | AI tarama fotoğrafları ve gün kartı dosyaları için hiçbir silme işi yok | Saklama sınırlaması | `supabase/migrations/20261104000500_day_shares.sql:26` |
| U-9 | `analytics_events`, `notification_sends`, `failed_payments` için temizleme işi yok | Saklama sınırlaması | VERI_ENVANTERI §1.7, §1.9 |
| U-10 | Hesap silme ve çıkışta cihazdaki yerel veriler (anon_id, atıf, kuyruklar) temizlenmiyor | Paylaşılan cihazda veri kalıntısı | `src/core/AuthContext.tsx:194,201` |
| U-11 | `support-attachments` kovası herkese açık | Güvenlik (md.12) | `supabase/migrations/20261021132735_storage_public_assets_and_support_attachments.sql:26-44` |

Gereken kod ve migration işleri `ENTEGRASYON.md`'de listelenmiştir; bu Politika kapsamında **uygulanmamıştır**.

## 13. Gözden geçirme ve yürürlük

- Politika **yılda en az bir kez** ve yeni bir veri kategorisi, kayıt ortamı veya işleyen eklendiğinde gözden geçirilir.
- Yürürlük: `[TARİH]` — yönetim onayıyla. Önceki sürümler en az 3 yıl arşivlenir.

| Sürüm | Tarih | Değişiklik | Onaylayan |
|---|---|---|---|
| v0.1-taslak | 2026-11-09 | İlk taslak (koddan envanter) | — |
