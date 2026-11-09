# Hukuki Metinlerin Entegrasyon Planı — TASLAK

> **Durum:** TASLAK · hukuki inceleme için (İlter Öziseven) · yayın yok · 2026-11-09 · dal `legal/global`
> **Bu belge yalnız plandır.** Aşağıdaki kod, migration, web ve konsol işlerinin **hiçbiri bu oturumda yapılmadı** (L-S1 kapsamı: yalnız taslak + plan). Uygulama, avukat onayından sonra ayrı oturumlarda yapılmalı.
> CLAUDE.md kuralları geçerli: önce migration dosyası, sonra `supabase db push`; Dashboard'dan şema değişikliği yok; `eas update --channel production` ve mağaza gönderimi onaysız yapılmaz.

## 0. Bugünkü durum (kanıt)

| Konu | Bugün | Kanıt |
|---|---|---|
| Uygulamadaki metinler | 4 metin pakete gömülü JSON (terms, distance-sales, privacy, kvkk), "Nisan 2026", bazı tablolar boş | `src/data/contractsData.ts:7-28` |
| Gösterim | Profil › Sözleşmeler | `src/screens/profile/ContractsScreen.tsx:12-29`; `src/modules/profil/ui/screens/SettingsAgreementsScreen.tsx:12-30`; giriş `FinPrProfileScreen.tsx:249,445` |
| `legal_documents` tablosu | Var (id, slug, title, content, updated_at), sürüm yok, istemci kullanmıyor | `CANLI_SEMA:43` |
| Kabul kaydı | Yok (ödeme kutusu, 18+, sağlık rızası, topluluk kuralları kaydedilmiyor) | `BOSLUKLAR.md` B-02 |
| Web | eatkcal.com 6 hukuk sayfası (Framer'dan birebir kopya, yalnız TR); kcalculate.ai yer tutucu | `web:apps/eatkcal/content/legal/*.ts`; `web:apps/kcalculate/components/Legal.tsx:13-53` |
| Açılış sayfası | Ayrı ve eski gizlilik/koşullar/silme metinleri | `landing-page/privacy.html`, `terms.html`, `account-deletion.html` |
| Web form onayı | Sürümlü onay metni tasarlanmış (`2026-11-07`), migration uygulanmamış | `web:packages/ui/src/lead-contract.ts:3-16`; `supabase/migrations/20261107000100_web_leads.sql:2` |

---

## 1. Hangi metin nerede

**İşaretler:**
- ● gösterilir / bağlanır
- ✔ kabul veya rıza alınır (kayıtlı)
- ○ yalnız bağlantı
- — yok

| Metin (`docs/legal/…`) | Uygulama: Profil › Sözleşmeler | Uygulama: akış içi | Ayarlar › Gizlilik | eatkcal.com | kcalculate.ai | Mağaza | E-posta |
|---|---|---|---|---|---|---|---|
| 01 Gizlilik Politikası | ● | ○ kayıt ekranı, ödeme, rıza ekranları | ● | ● `/gizlilik-politikasi`, `/en/legal/privacy` | ● `/legal/privacy`, `/tr/yasal/gizlilik` | ● App Store "Privacy Policy URL", Play "Privacy policy" | ○ işlem e-postası footer |
| 02 KVKK Aydınlatma | ● | ○ kayıt, takibe başla, ödeme, bekleme listesi, destek formu (toplama anında) | ● | ● `/kvkk` | ● `/tr/yasal/kvkk` (EN: `/legal/kvkk-notice`) | — | ○ |
| 03 Açık rıza — sağlık | ● (metin) | ✔ Takibe başla (ayrı ekran) ve eski profil ekranı girişinde | ✔ aç/kapa | ● `/acik-riza/saglik` | ● | — | — |
| 03 Açık rıza — yurt dışı (arızi) | ● | ✔ yalnız arızi aktarım gerektiğinde | ● | ● | ● | — | — |
| 03 Açık rıza — pazarlama | ● | ✔ bildirim izni sonrası ayrı ekran; web formları (mevcut onay kutusu) | ✔ kanal bazlı (e-posta/SMS/arama/push) | ✔ bülten ve formlar | ✔ formlar | — | ret bağlantısı |
| 03 Açık rıza — reklam ölçümü (Meta) | ● | ✔ "Ölçüm ve reklam" ekranı (ATT'den önce) | ✔ aç/kapa | — (web'de piksel yok) | — | etiket: Tracking | — |
| 04 Çerez Politikası | — | — | ○ | ● `/cerez-politikasi` + banner | ● `/legal/cookies` + banner | — | — |
| 05 Kullanım Koşulları | ● | ✔ hesap oluşturma (clickwrap); ✔ önemli değişiklikte yeniden kabul | ● | ● `/kullanim-kosullari` | ● `/legal/terms` | App Store EULA (özel EULA girilirse) | ○ |
| 06A Ön Bilgilendirme Formu | ● (şablon) | ✔ ödeme adımı (sipariş verileriyle dinamik), ayrı onay | — | ● `/on-bilgilendirme` (şablon) | — | — | ● sipariş onay e-postası eki/bağlantısı (kalıcı veri saklayıcısı) |
| 06B Mesafeli Satış Sözleşmesi | ● | ✔ ödeme adımı | — | ● `/mesafeli-satis-sozlemesi` | — | — | ● sipariş onay e-postası |
| 07 Topluluk Kuralları | ● | ✔ ilk Keşfet paylaşımı (mevcut `RulesSheet` → sunucu kaydı) | — | — | ● `/legal/community`; creator başvurusu ✔ | — | — |
| 08 Veri Sahibi Başvuru Formu | ○ | — | ● form (giriş yapmış kullanıcı) | ● `/veri-sahibi-basvurusu` | ● `/legal/privacy-request` | — | otomatik alındı yanıtı |
| 09 Saklama ve İmha Politikası | — | — | — | — (iç belge; yayımlanması zorunlu değil) | — | — | — |
| 10 Veri İhlali Müdahale Planı | — | — | — | — (iç belge) | — | — | — |
| Hesap silme (mevcut sayfa + 01 §haklar) | — | ● Profil › Güvenlik › Hesabımı Sil | ● | ● `/account-deletion` (footer'a bağlanacak) | ● `/account-deletion` (yeni) | ● Play "Delete account URL" | — |
| Künye (`KURUMSAL_KIMLIK.md` §3) | ● ekran altı | ● ödeme özeti satıcı satırı | — | ● footer | ● footer | ● satıcı / tüccar bilgisi | ● footer |

**Kanonik adres kuralı:**
- Her metnin dil başına **tek bir kanonik URL'si** olur.
- eatkcal metinleri (05, 06, 02) eatkcal.com'da; Kcalculate AI metinleri (01, 05, 07) kcalculate.ai'de.
- Ortak metinler (01, 02) her iki sitede **aynı içerikle** yayımlanır; biri diğerine `rel=canonical` verir.
- `landing-page/*.html` hukuk sayfaları eatkcal.com'a 301 ile yönlendirilir. Böylece çelişen eski içerik kalkar (`BOSLUKLAR.md` B-14 #8-9).

---

## 2. Hedef mimari: tek kaynak

```
docs/legal/{tr,en}/*.md  ──(derleme betiği)──►  legal_documents (DB, sürümlü)  ──►  Uygulama (çevrim içi; önbellek)
                         │                                                     └─►  Yedek: pakete gömülü son sürüm
                         └──(derleme betiği)──►  kcal-web content/legal/*  (eatkcal + kcalculate)
```

- **Yazım kaynağı:** `docs/legal/` Markdown (avukat onaylı sürüm etiketiyle).
- **Yayın kaynağı:** `legal_documents` tablosu. Uygulama metni buradan çeker; çevrim dışı/ilk açılış için paketteki son sürüme düşer.
- **Web:** aynı Markdown'dan üretilir (bugünkü elle kopyalanan `content/legal/*.ts` yerine).
- **Dinamik alanlar:** `{{SIPARIS_NO}}` vb. (06A) ve kimlik bloğu (`{{COMPANY.*}}`) render anında doldurulur.

---

## 3. Kimlik bloğu tek kaynaktan

- `company_identity` (tek satırlık ayar tablosu **veya** repoda paylaşılan JSON) alanları: ad, MERSİS, VKN, sicil, adres, telefon, e-posta adresleri, AB/UK temsilcisi. Vergi dairesi ve KEP mevcut metinlerde yok; alan olarak eklenmedi (alınırsa eklenir). Örnek (karar 9 Kas 2026):

```json
{
  "legal_name": "SEKULART LTD",
  "short_name": "SEKULART LTD",
  "mersis": "0759-1148-7410-0001",
  "tax_id": "7591148741",
  "trade_registry_no": null,
  "address_tr": "Basın Sitesi Mah. 177/3 Sk. No:3A, 35150 Karabağlar / İzmir",
  "address_en": "Basın Sitesi Mah. 177/3 Sk. No:3A, 35150 Karabağlar / İzmir, Türkiye",
  "phone": null,
  "emails": { "general": "info@eatkcal.com", "privacy": null, "legal": null, "support": null },
  "eu_representative": null,
  "uk_representative": null
}
```

  `null` alanlar henüz karar verilmemiş bilgilerdir (`L-S2-NOT.md`).
- Metinlerde `{{COMPANY.LEGAL_NAME}}` gibi yer tutucularla kullanılır.
- Kcalculate AI ayrı şirkete geçerse kimlik **marka başına** seçilir (`brand: 'kcalculate' | 'eatkcal'`).

---

## 4. Sürümleme

### 4.1 Belge sürümü

| Alan | Açıklama |
|---|---|
| `doc_key` | `privacy`, `kvkk_notice`, `consent_health`, `consent_transfer`, `consent_marketing`, `consent_ads`, `cookies`, `terms`, `preinfo`, `distance_sales`, `community`, `dsar_form` |
| `locale` | `tr`, `en` |
| `version` | `1.0.0` biçimi. Büyük = önemli değişiklik (yeniden kabul/rıza gerekir). Küçük = içerik düzeltmesi (bilgilendirme yeterli). Yama = yazım |
| `content_md`, `content_sha256` | Gösterilen metnin birebir kopyası ve özeti (ispat) |
| `effective_at`, `published_at` | Yürürlük ve yayın zamanı |
| `material_change` | Önemli değişiklik bayrağı |
| `change_summary` | Kullanıcıya gösterilecek değişiklik özeti |
| `status` | `draft` / `approved` / `published` / `retired` |
| `approved_by` | Onaylayan (avukat) |

### 4.2 Kabul kaydı (koşullar, mesafeli satış, ön bilgilendirme, topluluk kuralları, 18+ beyanı)

| Alan | Not |
|---|---|
| `user_id` | Misafir sipariş varsa `order_id` ile |
| `doc_key`, `version`, `locale`, `content_sha256` | Hangi metin |
| `accepted_at` | **Sunucu saati** |
| `channel` | `ios` / `android` / `web` |
| `app_version` | |
| `context` | `{signup}`, `{checkout, order_id}`, `{reaccept}`, `{first_post}` |
| `ip_hash` | İsteğe bağlı. Veri minimizasyonu nedeniyle ham IP saklanmaz |

### 4.3 Rıza kaydı (amaç bazlı, ekleme-yalnız geçmiş)

| Alan | Not |
|---|---|
| `purpose` | `health_processing`, `transfer_incidental`, `marketing_email`, `marketing_sms`, `marketing_call`, `marketing_push`, `ad_measurement_meta`; `first_party_analytics` meşru menfaat, kayıt yalnız itiraz/kapatma için |
| `granted` | true/false (geri alma = yeni satır) |
| `text_version` | Rıza metninin sürümü |
| `created_at` | Sunucu saati |
| `source` | ekran adı |
| `platform` | |
| `att_status` | Yalnız reklam için |

- **Güncel durum** = amaç başına son satır (görünüm).
- **İYS:** e-posta/SMS/arama onayları İYS'ye aktarılır; İYS'den gelen ret geri yazılır.

### 4.4 Önemli değişiklikte ne olur

| Belge | Önemli değişiklikte |
|---|---|
| Kullanım Koşulları | Bir sonraki açılışta engelleyici "Koşullar güncellendi" ekranı + değişiklik özeti + yeniden kabul. Kabul etmeyen: hesap silme / dışa aktarma seçenekleri |
| Gizlilik Politikası / Aydınlatma | Kabul **istenmez** (aydınlatma rıza değildir). Uygulama içi bildirim + e-posta. Yeni amaç eklendiyse ilgili açık rıza ayrıca istenir |
| Açık rıza metinleri | Kapsam genişlediyse rıza yeniden istenir; eski rıza yeni kapsamı karşılamaz |
| Ön bilgilendirme / Mesafeli satış | Sipariş başına kabul. Sürüm siparişe bağlanır |

### 4.5 Mevcut kullanıcılar (geçiş)

Bugüne kadar **hiçbir kabul/rıza kaydı yok**. Bu nedenle yayın günü tüm aktif kullanıcılara bir kez şunlar gösterilir:
1. Kullanım Koşulları v1 kabulü.
2. 18+ beyanı.
3. Sağlık açık rızası (takip verisi olanlar için).
4. Reklam ölçümü ve pazarlama tercihleri (varsayılan kapalı).

Sağlık rızasını vermeyen kullanıcının mevcut takip verisi için karar gerekir (öneri: 30 gün içinde imha + önceden dışa aktarma imkânı). Bkz. `BOSLUKLAR.md` B-03.

---

## 5. Uygulama içi akışlar (hedef)

| # | Akış | Adımlar | Değişecek ekran/dosya (bugünkü) |
|---|---|---|---|
| A1 | Kayıt / giriş | (1) 18+ beyanı **hesap oluşmadan önce**; (2) "Kullanım Koşulları'nı kabul ediyorum" kutusu (boş, bağlantılar tıklanabilir); (3) Gizlilik/KVKK aydınlatma bağlantısı ("bilgilendirildim" — kabul değil); (4) giriş sonrası kabul RPC'si | `src/screens/auth/UnifiedLoginScreen.tsx:111-149,221`; `src/modules/onboarding/v2/LoginV2.tsx:129-344`; `src/modules/onboarding/OnboardingNavigator.tsx:210-232` (pasif metin + tıklanmayan bağlantı) |
| A2 | Takibe başla (sağlık) | Ayrı rıza ekranı (`tr/03` §1), kutu boş, kayıt; reddedene takip yerine "yalnız sipariş" yolu | `src/modules/onboarding/takibe/TakibeNavigator.tsx:199-202,281-303`; `src/modules/onboarding/takibe/save.ts`; eski `src/screens/tracker/NutritionProfileScreen.tsx` rıza kapısı |
| A3 | Ölçüm ve reklam | Onboarding sonunda ekran: birinci taraf ölçüm bilgisi (kapatılabilir) + reklam ölçümü anahtarı (varsayılan kapalı). "Evet" → iOS'ta ATT istemi | `src/lib/analytics.ts:107-137` (ATT açılışta → ekrandan sonra); `src/lib/metrics/consent.ts:26-30` (`unset` = kapalı); metinler hazır `src/lib/metrics/i18n.ts` |
| A4 | Bildirimler | OS izni (işlem bildirimleri) → ayrı "Kampanya ve fırsatlar" onayı (kanal bazlı, varsayılan kapalı) | `src/core/notifications.ts:97-102`; `src/screens/profile/NotificationPreferencesScreen.tsx:34-37`; `src/modules/profil/ui/screens/SettingsNotifyScreen.tsx` |
| A5 | Ödeme (eatkcal) | Sipariş özeti → "Ön Bilgilendirme Formu" (dinamik, kaydırılabilir) + ayrı onay → "Mesafeli Satış Sözleşmesi" onayı → ödeme. Onaylar `order_id` ile kaydedilir. Sipariş sonrası iki metin e-postayla (kalıcı veri saklayıcısı) gönderilir | `src/components/checkout/CheckoutFooter.tsx:153-176`; `src/modules/eatkcal/v2/screens/EkCheckoutScreen.tsx:298-336`; `src/modules/eatkcal/v2/checkout/useEkCheckout.ts:562-564`; `src/modules/eatkcal/screens/CheckoutScreen.tsx:1613,2880-2894` |
| A6 | Keşfet ilk paylaşım | Topluluk kuralları (mevcut FinRules) → "Anladım, paylaş" → sunucuya kabul kaydı | `src/modules/kesfet/ui/RulesSheet.tsx:21-30`; `src/modules/kesfet/ui/ComposerScreen.tsx:337` |
| A7 | Ayarlar › Gizlilik (yeni bölüm) | Rıza anahtarları (sağlık, reklam, pazarlama kanalları, ölçüm), "Verilerimi indir / Başvuru yap" formu, "Kabul geçmişim", hesap silme bağlantısı | yeni ekran; metinler `src/lib/metrics/i18n.ts` + `src/core/i18n/dictionaries.ts` |
| A8 | Profil › Sözleşmeler | `legal_documents`'tan liste (başlık, sürüm, yürürlük), çevrim dışı yedek | `src/modules/profil/ui/screens/SettingsAgreementsScreen.tsx`; `src/screens/profile/ContractsScreen.tsx`; `src/data/contractsData.ts` → yedek üretimi |
| A9 | Hesap silme | Değişmez giriş; silme kapsamı genişler (§6 K8), cihaz verisi temizlenir | `src/modules/profil/ui/screens/SettingsSecurityScreen.tsx:161-183`; `supabase/functions/delete-account/index.ts` |

---

## 6. Gereken işler — YAPILMADI, yalnız liste

**Boyut:**
- S ≤ ½ gün
- M 1–2 gün
- L 3+ gün

"Native" = yeni native derleme ve mağaza sürümü gerekir (EAS Update yetmez).

### 6.1 Migration'lar (`supabase/migrations/` dosya + rollback; sonra `supabase db push`)

| # | İş | Boyut | Boşluk |
|---|---|---|---|
| M1 | `legal_documents` sürümleme: `doc_key, locale, version, content_sha256, effective_at, published_at, material_change, change_summary, status, approved_by`; `unique(doc_key, locale, version)`; yayımlananlar için herkese okuma RLS. Mevcut 4 satırın taşınması | M | B-02 |
| M2 | `legal_acceptances` + `accept_legal_document(doc_key, version, context)` RPC (security definer, sunucu saati); kullanıcı yalnız kendi kayıtlarını okur; doğrudan insert kapalı | M | B-02, B-05 |
| M3 | `consent_events` (ekleme-yalnız) + `current_consents` görünümü + `set_consent(purpose, granted, text_version, source)` RPC | M | B-02, B-03, B-06, B-11 |
| M4 | 18+ beyanı: `legal_acceptances` içinde `doc_key='age_18'` (ayrı sütun gerekmez); hesap açılışında RPC zorunlu | S | B-10 |
| M5 | `notification_preferences.marketing_enabled` varsayılanı `false` + tetikleyici fonksiyon varsayılanı; mevcut kullanıcılar için karar (rızası kanıtlanamayanlar `false`) | S | B-11 |
| M6 | `support_tickets.user_id` FK → `ON DELETE SET NULL`; `support-attachments` kovası `public=false` + sahip/admin okuma politikası | S | B-08, B-09 |
| M7 | İmha işleri (pg_cron) + `retention_runs` imha kayıt tablosu. `analytics_events` 24 ay, `adisyo_api_log`/`adisyo_webhook_events` 30 gün, `notification_sends` 12 ay, pasif `push_tokens` 90 gün, `deleted_account_fingerprints` 2 yıl, `ai_scan_reservations.result` 30 gün, gün kartı dosyaları, `content_reports` 1 yıl | L | B-15, B-16 |
| M8 | Sipariş ↔ hukuki kabul bağı: `orders.preinfo_version`, `orders.distance_sales_version` (veya yalnız `legal_acceptances.context.order_id`) | S | B-05 |
| M9 | `company_identity` tek satırlık ayar (veya repoda JSON — karar) | S | KURUMSAL_KIMLIK §1 |
| M10 | `privacy_requests` (başvuru no, tür, durum, son tarih, kimlik doğrulama, yanıt) — yönetici erişimli | M | `tr/08` |
| M10b | `profiles.processing_restricted boolean` (GDPR Art.18 kısıtlama talebi; işaretliyse analitik, pazarlama ve AI işlemesi atlanır) | S | `tr/08` |
| M11 | `web_leads` migration'ının uygulanması (dosya hazır: `supabase/migrations/20261107000100_web_leads.sql`) | S | — |
| M12 | (İsteğe bağlı) `breach_register` — veya DB dışı güvenli kayıt | S | `tr/10` |

### 6.2 Edge function işleri (deploy ayrı onayla)

| # | İş | Boyut | Boşluk |
|---|---|---|---|
| F1 | `delete-account`: Storage `<uid>/` nesnelerini sil (avatars, user-media, post-media, support-attachments); anonimleştirmeyi genişlet (`external_payload` kişisel alanları, `order_modifications.new_address_text`, `feedback.user_email`, `campaign_targets.user_email`); push jetonlarını sil; Adisyo günlüklerinde kullanıcıyı maskele | M | B-09 |
| F2 | `send-notification`: tercih satırı yoksa `marketing` kapalı; sessiz saat uygulaması | S | B-11 |
| F3 | `adisyo-save-order` / webhook alıcı: günlüğe yazarken maskeleme | S | B-16 |
| F4 | `order-alert`: kişisel Gmail yedeğini kaldır | S | B-20 |
| F5 | `tosla-*`: devre dışı bırak (aktif sağlayıcı PaynKolay) | S | B-16 |
| F6 | Sipariş onay e-postasına Ön Bilgilendirme + Mesafeli Satış (kalıcı veri saklayıcısı) | M | B-05 |
| F7 | `dsar-export`: kullanıcının verisini JSON/CSV dışa aktarma (KVKK md.11 / GDPR Art.15, 20) | M | `tr/08` |
| F8 | AI fonksiyonları canlıya alınırken: `analyze-ai-scan` fotoğrafı 30 günde silen iş; `moderate-content` karar kaydı saklaması | S | B-15 |

### 6.3 Mobil kod işleri

| # | İş | Boyut | Native | Boşluk |
|---|---|---|---|---|
| K1 | `useLegalDocument(docKey)` kancası (DB + önbellek + paket yedeği); `contractsData.ts` yerine derleme betiğiyle üretilen yedek | M | Hayır | B-02 |
| K2 | Sözleşmeler ekranı: sürüm/yürürlük, "Kabul geçmişim" | S | Hayır | B-02 |
| K3 | Kayıt akışı (A1): yaş beyanı hesap öncesi, tıklanabilir bağlantılar, kabul RPC'si; reşit olmayan ekranı metninin düzeltilmesi | M | Hayır | B-10 |
| K4 | Sağlık rızası kaydı (A2) + eski profil ekranına rıza kapısı + geri almada veri imhası akışı | M | Hayır | B-03 |
| K5 | "Ölçüm ve reklam" ekranı + Ayarlar › Gizlilik (A3, A7); ATT'yi ekrandan sonra iste; `metaAllowed` `unset`=kapalı | M | Hayır | B-06 |
| K6 | `app.config.js`: `autoLogAppEventsEnabled: false`; privacy manifest'e `OtherUserContent`, `AudioData`, `CustomerSupport`; `locales/en.json`'a ATT + konum dizeleri | S | **Evet** | B-06, B-07 |
| K7 | Ödeme (A5): Ön Bilgilendirme sayfası (dinamik), iki ayrı onay, `order_id` ile kayıt | M | Hayır | B-05 |
| K8 | Çıkış/silmede AsyncStorage temizliği (adres, kuyruklar, anon_id, atıf, bekleme listesi kuyruğu) | S | Hayır | B-09 |
| K9 | `RulesSheet` kabulünü sunucuya yaz | S | Hayır | B-02 |
| K10 | Sentry: `setUser` kaldır **veya** etiketi "Linked" yap; `beforeBreadcrumb` ile console kırıntılarını kapat | S | Hayır | B-07, B-20 |
| K11 | Ölü Tosla kart formunu kaldır (`src/modules/eatkcal/screens/CheckoutScreen.tsx:120,1955-1982`) | S | Hayır | B-20 |
| K12 | Avatar dosya adını rastgele yap; gizli profil medyası için imzalı URL (sunucu işiyle birlikte) | M | Hayır | B-18 |
| K13 | Pazarlama onay ekranı (A4), kanal bazlı | S | Hayır | B-11 |
| K14 | Başvuru formu (Ayarlar › Gizlilik › Başvuru) → `privacy_requests` | S | Hayır | `tr/08` |
| K15 | Ölçüm metninde "anonim" → "takma adlı / hesabınla ilişkilendirilebilen" (`src/lib/metrics/i18n.ts:22`) | S | Hayır | B-14 #12 |
| K16 | `push_tokens.device_name` yerine yalnız model adı | S | Hayır | B-20 |

### 6.4 Web işleri (kcal-web — ayrı repo)

| # | İş | Boyut |
|---|---|---|
| W1 | eatkcal `content/legal/*` → yeni taslaklar (onay sonrası); yeni sayfalar `/on-bilgilendirme`, `/veri-sahibi-basvurusu`, `/acik-riza/*`; EN sayfalarda gerçek İngilizce metin (bugün TR gösteriliyor: `web:apps/eatkcal/components/pages/Legal.tsx:64,150-152`) | M |
| W2 | eatkcal footer: Çerez Politikası, Hesap Silme, Ön Bilgilendirme, Başvuru bağlantıları + tam künye (`KURUMSAL_KIMLIK.md` §3.2) | S |
| W3 | kcalculate.ai `components/Legal.tsx` yer tutucularını doldur; `/account-deletion`; `/legal/privacy-request`; ABD yayını varsa "Your privacy choices" + Consumer Health Data sayfası | M |
| W4 | `landing-page/` hukuk sayfalarını eatkcal.com'a 301 yönlendir (`landing-page/vercel.json` veya eşdeğeri) | S |
| W5 | `docs/legal` → web içerik derleme betiği (tek kaynak) | M |
| W6 | `/.well-known/security.txt` | S |
| W7 | DSA bildirim formu (kayıtsız kullanıcılar için hukuka aykırı içerik bildirimi) | S |

### 6.5 Mağaza / konsol işleri

| # | İş |
|---|---|
| S1 | App Store Connect › App Privacy: `BOSLUKLAR.md` B-07 tablosu; Privacy Policy URL; (varsa) özel EULA |
| S2 | Play Console › Data safety: B-07 tablosu; Delete account URL = `https://eatkcal.com/account-deletion` (Kcalculate AI ayrı listelenirse kcalculate.ai) |
| S3 | AB tüccar (DSA md.30) bilgileri: tam unvan, adres, telefon, e-posta — her iki mağaza |
| S4 | Mağaza açıklamasında "AI tahmini tıbbi tavsiye değildir" ifadesi (sağlık iddiası riskine karşı) |

### 6.6 Hukuk / idari işler (kod dışı)

- Standart sözleşmeler (KVKK md.9) + **5 iş günü** içinde Kurum'a bildirim.
- DPA imzaları (B-13).
- VERBİS kaydı (B-04).
- AB/UK temsilcisi ve DSA yasal temsilcisi (B-12).
- İYS kaydı (B-11).
- KEP adresi (taslaklara eklenmedi; alınırsa kimlik bloklarına eklenecek — `BOSLUKLAR.md` B-20).
- Marka tescil kontrolü (KURUMSAL_KIMLIK §5).

---

## 7. Yayın sırası (öneri)

| Faz | İçerik | Ön koşul |
|---|---|---|
| 0 | Avukat incelemesi → metinler `approved`; kimlik yer tutucuları doldurulur | — |
| 1 | Hukuk/idari: standart sözleşmeler + bildirim, DPA'lar, VERBİS | Faz 0 |
| 2 | Backend: M1–M6, M8–M11; F1–F5 | Faz 0 (metin sürümleri) |
| 3 | Mobil: K1–K16 → **native sürüm** (K6 nedeniyle) → mağaza etiketleri (S1–S3) aynı sürümle | Faz 2 |
| 4 | Web: W1–W7 | Faz 0; mobil ile aynı gün yayımlanmalı (metin tutarlılığı) |
| 5 | Mevcut kullanıcı geçişi (§4.5): yeniden kabul ve rıza ekranları | Faz 3 |
| 6 | İmha işleri (M7) — önce `dry_run` raporu, sonra etkin | Faz 2 |
| — | **AI tarama/moderasyon canlıya alınmadan önce:** Anthropic DPA + standart sözleşme + bildirim; sağlık rızası metni AI işlemeyi kapsıyor; mağaza etiketleri; `tr/01` §AI yayımlanmış | Faz 1–3 |

## 8. PR kontrol listesi (kalıcı)

Yeni tablo/sütun, yeni üçüncü taraf SDK/API, yeni izin veya yeni veri toplayan ekran eklendiğinde:
- [ ] `docs/legal/VERI_ENVANTERI.md`'ye satır (kanıt dahil)
- [ ] Gizlilik Politikası / Aydınlatma kapsıyor mu? Kapsamıyorsa yeni sürüm
- [ ] Yeni amaç açık rıza gerektiriyor mu? (`consent_events.purpose`)
- [ ] Yurt dışı alıcı mı? → standart sözleşme + 5 iş günü bildirim
- [ ] Saklama süresi ve imha işi tanımlı mı?
- [ ] Hesap silme bu veriyi kapsıyor mu?
- [ ] App Store etiketi / Play formu / privacy manifest güncellendi mi?
