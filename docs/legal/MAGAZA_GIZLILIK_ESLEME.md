<!-- L-S3 -->
# Mağaza Gizlilik Eşleme Tablosu — Apple App Privacy · Google Play Data safety — TASLAK

> **Durum:** TASLAK · hukuki inceleme için (İlter Öziseven) · yayın yok · 2026-11-11 · dal `legal/global` · oturum L-S3
> **Kapsam:** Kcalculate AI 1.1.0 (iOS + Android), kcalAI eklemeleri dâhil: AI tarama (fotoğraf + not + sesli giriş), barkod, kcalAI Koç, Fresh/Balance abonelikleri.
> **Kaynak metinler:** `tr/01-gizlilik-politikasi.md` / `en/01-privacy-policy.md` — §3, §5, **§5A**, **§5B**, §7, §8, **§11A**, §12, **§12A**, **§13A**, §14. Bu tablodaki her satır o metinlerle tutarlı olmalı; biri değişirse diğeri de değişir.
> **Kod kaynağı:** `release/1.1.0` (@ 0401d64). Satır kanıtları "Kanıt" sütununda.
> **İlişki:** `BOSLUKLAR.md` B-07'deki 9 Kasım tabloları bu dosyayla **güncellenir**. B-07'deki ★ düzeltmeleri (Sentry bağlı, Audio Data, Other User Content, Customer Support) burada da aynen geçerli; yeni satırlar ◆ ile işaretli.

## 0. Okuma kuralları

| Kavram | Apple (App Privacy) | Google Play (Data safety) |
|---|---|---|
| Toplanan | Cihazdan çıkıp sizin veya ortaklarınızın, isteği gerçek zamanlı karşılamak için gerekenden uzun süre erişebildiği veri | Cihazdan çıkıp size veya üçüncü tarafa ulaşan veri. Yalnız bellekte, isteği karşılamak için anlık işlenen veri ("ephemeral") toplanmış sayılmayabilir |
| Bağlı (Linked) | Kimliğe (hesap, kullanıcı kimliği, cihaz) bağlanabilen veri | (Ayrı alan yok) |
| İzleme (Tracking) | Veriyi üçüncü taraf verisiyle birleştirip hedefli reklam/ölçüm için kullanmak veya veri komisyoncusuyla paylaşmak | (Ayrı alan yok — "Paylaşılan" + "Advertising" amacı) |
| Paylaşılan | — | Üçüncü tarafa aktarım. **Sizin adınıza işleyen hizmet sağlayıcıya (Supabase, Anthropic, RevenueCat, Sentry, Expo) aktarım paylaşım sayılmaz.** Kullanıcının başlattığı aktarım (ör. barkodu Open Food Facts'e sorma) istisna kapsamında değerlendirilebilir |
| Kullanıcı tercihi | — | "İsteğe bağlı" = kullanıcı vermeden uygulamayı kullanabilir |

**İzleme kararı (yeni kcalAI verileri):** AI tarama, sesli giriş, Koç ve abonelik verilerinin **hiçbiri izleme için kullanılmaz** ve Meta'ya gitmez. Kanıt: `src/lib/metrics/events.ts:178-205` — `paywall_view`, `sub_purchase`, `sub_restore`, `barcode_limit`, `coach_*` olaylarında `meta:` alanı yok; `src/lib/analytics.ts:197-200` yalnız `meta` alanı olan olayları ve yalnız rıza/ATT izniyle Meta'ya iletir.
**İstisna (mevcut, değişmedi):** eatkcal ticaret olayları (ürün görüntüleme, sepete ekleme, ödeme başlatma, sipariş satın alma, kayıt) + IDFA/GAID, rıza ve iOS'ta ATT izniyle Meta'ya gider → Apple'da bu satırlar **"İzleme: Evet"** kalır (`app.config.js:81-87` `NSPrivacyTracking: true`). "Uygulamada izleme yok" denebilmesi için Meta SDK'nın kaldırılması gerekir — karar BOSLUKLAR B-29.

---

## 1. Apple App Store Connect — App Privacy

| Apple veri türü | Toplanıyor | Bağlı | İzleme | Amaç | Hangi veri | Metin | Kanıt |
|---|---|---|---|---|---|---|---|
| Contact Info › Name | Evet | Evet | Hayır | App Functionality | Ad, soyad (hesap, teslimat) | §3 | B-07 |
| Contact Info › Email Address | Evet | Evet | Hayır | App Functionality | Giriş, hesap e-postası | §3 | B-07 |
| Contact Info › Phone Number | Evet | Evet | Hayır | App Functionality | Teslimat ve hesap | §3 | B-07 |
| Contact Info › Physical Address | Evet | Evet | Hayır | App Functionality | Teslimat adresi | §3, §10 | B-07 |
| Health & Fitness › Health | Evet | Evet | Hayır | App Functionality | Boy, kilo, hedef, ölçüler; AI tarama fotoğrafı ve sonucu; ◆ **Koç'a giden günlük takip özeti** (cinsiyet, hedefler, son 7 gün) | §3, §4, §5B | `coach-chat/index.ts:88-135` |
| Health & Fitness › Fitness | Evet | Evet | Hayır | App Functionality | Öğün, kalori, makro, su, etkinlik; ◆ sesli girişten ve barkoddan kaydedilen öğünler | §3, §5A | B-07 |
| Location › Precise Location | Evet | Evet | Hayır | App Functionality | Yalnız uygulama açıkken, adres/bölge | §10 | B-07 |
| User Content › Photos or Videos | Evet | Evet | Hayır | App Functionality | AI tarama fotoğrafı, Keşfet foto/video, avatar, destek eki | §5, §6 | B-07 |
| User Content › Audio Data | Evet | Evet | Hayır | App Functionality | **Yalnız video gönderilerinin ses izi.** ◆ Sesli giriş **ses verisi toplamaz** (ses dosyası yok, sunucuya ses gitmez) — bkz. not 1 | §5A | `speech.ts:46-58` (`recordingOptions` yok) |
| User Content › Customer Support | Evet | Evet | Hayır | App Functionality | Destek talepleri | §3 | B-07 |
| User Content › Other User Content | Evet | Evet | Hayır | App Functionality | Gönderi metni, yorum, değerlendirme; ◆ **AI tarama notu**, ◆ **sesli girişin yazıya dökülmüş metni**, ◆ **Koç mesajları** (30 gün) | §5A, §5B | `analyze-ai-scan/index.ts:32-35`; `g24_coach.sql:31,127` |
| Identifiers › User ID | Evet | Evet | Hayır | App Functionality, Analytics | Kullanıcı kimliği; ◆ RevenueCat app_user_id = kullanıcı kimliği | §8, §11A | `useSubscriptionBootstrap.ts:2` |
| Identifiers › Device ID | Evet | Evet | **Evet** | Third-Party Advertising, Analytics | IDFA (yalnız ATT izniyle), birinci taraf `anon_id`; ◆ RevenueCat IDFV toplayabilir — not 3 | §7, §8, §11A | B-07 |
| Purchases › Purchase History | Evet | Evet | **Evet** (yalnız eatkcal siparişleri) | App Functionality, Analytics, Third-Party Advertising | eatkcal sipariş geçmişi (Meta'ya rızayla); ◆ **kcalAI abonelik geçmişi** (ürün, dönem, deneme, bitiş) — App Functionality + Analytics, **izleme için değil** | §7, §11A | `g22_s1_subscriptions.sql:36-55`; `events.ts:182-188` |
| Usage Data › Product Interaction | Evet | Evet | **Evet** (yalnız Meta'ya giden ticaret olayları) | Analytics, App Functionality, Third-Party Advertising | Birinci taraf olaylar; ◆ `paywall_view`, `sub_purchase`, `coach_*` yalnız birinci taraf (Analytics) | §8 | `events.ts:178-205` |
| Diagnostics › Crash Data | Evet | **Evet** | Hayır | App Functionality | Sentry (kullanıcı kimliği bağlı) | §3 | `src/lib/sentry.ts:66-68` |
| Diagnostics › Performance Data | Evet | **Evet** | Hayır | App Functionality | Sentry | §3 | `src/lib/sentry.ts:48` |
| Financial Info › Payment Info | **Hayır** | — | — | — | Kart eatkcal'da PaynKolay sayfasında; ◆ abonelik ücretini Apple/Google tahsil eder, bize ödeme bilgisi gelmez. Kayıtlı kart son 4 hane/marka için "Other Financial Info" değerlendirilsin (B-07) | §11, §11A | `app.config.js` manifestte `PaymentInfo` var — not 4 |
| Sensitive Info, Contacts, Browsing/Search History, Emails or Text Messages | Hayır | — | — | — | — | §3 "İşlemediklerimiz" | — |

**Apple — not 1 (ses, SEÇENEK A/B):** Apple'ın tanımında "toplama" geliştiricinin veya ortaklarının erişimidir. SEÇENEK A'da ses cihazdan çıkmaz → toplanmaz. SEÇENEK B'de ses Apple'ın kendi konuşma tanıma hizmetine gider; bu, uygulamanın Apple işletim sistemi hizmetini kullanmasıdır, geliştiriciye veya ortağına ses ulaşmaz → **Audio Data için sesli giriş satırı eklenmez** (öneri; Apple'a "ses başka bir tarafa gider mi" sorusu için Speech framework açıklaması Info.plist `NSSpeechRecognitionUsageDescription` metninde yapılmalı). Her iki seçenekte de **yazıya dökülmüş metin** toplanır → Other User Content.
**Apple — not 2 (AI sağlayıcısı):** Anthropic'e giden fotoğraf/metin/Koç özeti "üçüncü taraf ortak"a aktarımdır; Apple etiketi verinin **türünü ve amacını** sorar, alıcıyı değil. Amaç App Functionality; Anthropic veriyi model eğitimi için kullanmıyorsa (ticari koşullar) ek amaç yok.
**Apple — not 3 (RevenueCat):** RevenueCat SDK'sı varsayılan olarak IDFV gibi tanımlayıcılar toplayabilir; `collectDeviceIdentifiers` kodda çağrılmıyor. RevenueCat'in privacy manifest'i kendi SDK paketinde gelir; ASC etiketi uygulamanın toplamını yansıtmalı → Device ID satırına "App Functionality" amacı eklensin (teyit).
**Apple — not 4 (manifest farkı):** `app.config.js` manifestinde `PaymentInfo` beyan edilmiş, etiket önerisi "Hayır". İkisi aynı yönde düzeltilmeli (B-07).
**Ek ASC alanları:** Gizlilik Politikası URL'si (yayın sonrası metin), **Lisans Sözleşmesi** = Apple Standard EULA (veya özel EULA — B-21), uygulama açıklamasına "Kullanım Koşulları (EULA)" ve "Gizlilik Politikası" bağlantıları (Kılavuz 3.1.2 — otomatik yenilenen abonelik).

---

## 2. Google Play Console — Data safety

| Play kategorisi › tür | Toplanıyor | Paylaşılıyor | Anlık işleme | Zorunlu / İsteğe bağlı | Amaç | Hangi veri | Metin |
|---|---|---|---|---|---|---|---|
| Location › Approximate, Precise | Evet | Hayır | Hayır | İsteğe bağlı | App functionality | Yalnız ön plan | §10 |
| Personal info › Name, Email address, Phone number, Address | Evet | Hayır | Hayır | Zorunlu (sipariş/hesap) | App functionality, Account management | — | §3 |
| Personal info › User IDs | Evet | Hayır | Hayır | Zorunlu | App functionality, Analytics, Account management | ◆ RevenueCat app_user_id dâhil (hizmet sağlayıcı → paylaşım değil) | §8, §11A |
| Financial info › Purchase history | Evet | **Evet (Meta — yalnız eatkcal siparişleri, rızayla)** | Hayır | Zorunlu (sipariş) | App functionality, Analytics, Advertising or marketing | eatkcal siparişleri; ◆ **kcalAI abonelik geçmişi** — App functionality + Analytics, Meta'ya **gitmez** | §7, §11A |
| Financial info › Payment info | **Hayır** | — | — | — | — | ◆ Abonelik ödemesini Google Play tahsil eder | §11A |
| Health and fitness › Health info | Evet | Hayır | Hayır | İsteğe bağlı | App functionality | Boy, kilo, hedef, ölçüler; AI tarama fotoğrafı sonucu; ◆ Koç'a giden günlük takip özeti (Anthropic = hizmet sağlayıcı) | §4, §5B |
| Health and fitness › Fitness info | Evet | Hayır | Hayır | İsteğe bağlı | App functionality | Öğün, su, etkinlik; ◆ sesli giriş ve barkoddan kaydedilen öğünler | §5A |
| Messages › Other in-app messages | ◆ **Evet** | Hayır | Hayır | İsteğe bağlı | App functionality | ◆ **Koç sohbet mesajları** (kullanıcı ↔ AI, 30 gün) — not 2 | §5B |
| Photos and videos › Photos, Videos | Evet | Hayır | Hayır | İsteğe bağlı | App functionality | AI tarama, Keşfet, avatar, destek | §5, §6 |
| Audio › Voice or sound recordings | ◆ **Hayır** (SEÇENEK A) / **Hayır** öneri (SEÇENEK B — not 1) | — | — | — | — | Sesli giriş ses kaydı tutmaz | §5A |
| Audio › Other audio files | Evet | Hayır | Hayır | İsteğe bağlı | App functionality | Video gönderilerin ses izi | §6 |
| App activity › App interactions | Evet | **Evet (Meta — rızayla)** | Hayır | İsteğe bağlı (rıza) | Analytics, Advertising or marketing | Birinci taraf + Meta ticaret olayları; ◆ abonelik ve Koç olayları yalnız birinci taraf | §7, §8 |
| App activity › Other user-generated content | Evet | Hayır | Hayır | İsteğe bağlı | App functionality | Gönderi, yorum, değerlendirme, destek; ◆ AI tarama notu, ◆ sesli girişin yazıya dökülmüş metni | §5A, §6 |
| App activity › Other actions | ◆ Evet | Hayır | Hayır | Zorunlu | App functionality, Fraud prevention, security, and compliance | ◆ Günlük AI/barkod/Koç hak sayaçları | §3, §11A |
| App info and performance › Crash logs, Diagnostics | Evet | Hayır | Hayır | Zorunlu | Analytics | Sentry | §3 |
| Device or other IDs | Evet | **Evet (Meta — rızayla)** | Hayır | İsteğe bağlı | Advertising or marketing, Analytics | GAID + `anon_id`; ◆ RevenueCat tanımlayıcıları (hizmet sağlayıcı) | §7, §8, §11A |

**Play — not 1 (ses, SEÇENEK B):** Android'de cihaz üzerinde tanıma yoksa ses Google'ın konuşma tanıma hizmetine gider. Bu, uygulamanın değil işletim sisteminin hizmetidir ve veri bize ulaşmaz; Google Play'in "toplama" tanımı uygulamanın topladığı veriyi sorar → "Hayır" önerilir. Teyit için Play Console yardım metni ve hukuki görüş (B-22).
**Play — not 2 (Koç):** Koç mesajları kullanıcıdan AI'ya yazışmadır; "Messages › Other in-app messages" en yakın tür. Alternatif "App activity › Other user-generated content". Biri seçilmeli; ikisine birden yazmak da kabul edilir. Koç bayrağı (`koc`) kapalıyken yayımlanan sürümde bu satır **eklenmemeli** mi? Öneri: özellik kodda var ve uzaktan açılabiliyorsa **ekle** (Play beyanı derlemenin yeteneğini kapsar).
**Play — not 3 (Open Food Facts):** Barkod numarası cihazdan doğrudan Open Food Facts'e gider. Barkod numarası kişisel veri sayılmaz; IP adresi her internet isteğinde olur ve Play'de ayrı tür değildir → satır eklenmez. Kullanıcının başlattığı aktarım istisnası da uygulanır.

**Güvenlik bölümü:**
- Aktarımda şifreleme: **Evet** (TLS).
- Veri silme talebi: **Evet** — uygulama içi (Profil › Güvenlik › Hesabımı Sil) + web `https://eatkcal.com/account-deletion`. ◆ Koç geçmişi ayrıca Koç › Geçmiş'ten silinebilir.
- ◆ Hesap silme ekranı aktif abonelik uyarısı ve "Aboneliği yönet" bağlantısı içerir (G25-S1 md.6).
- Bağımsız güvenlik incelemesi: Hayır.
- Aile politikası / çocuklara yönelik: Hayır (18+).

---

## 3. Metin ↔ etiket tutarlılık kontrolü

| Gizlilik metni cümlesi | Apple | Play | Tutarlı |
|---|---|---|---|
| "Ses kaydı tutulmaz" (§5A) | Audio Data yalnız video ses izi | Voice recordings: Hayır | ✔ |
| "Yazıya dökülmüş metin sağlayıcıya gider" (§5A) | Other User Content: Evet | Other UGC: Evet | ✔ |
| "Koç sohbet geçmişi 30 gün" (§5B) | Other User Content: Evet, bağlı | Other in-app messages: Evet | ✔ (cron yoksa ✗ — B-24) |
| "Günlük takip özeti sağlayıcıya gider" (§5B) | Health: Evet, App Functionality | Health info: Evet, paylaşım değil | ✔ |
| "Ödeme bilgisi bize gelmez" (§11A) | Payment Info: Hayır | Payment info: Hayır | ✔ (manifest `PaymentInfo` ✗ — not 4) |
| "Abonelik kayıtları reklam için kullanılmaz" (§11A) | Purchase History abonelik kısmı izleme değil | Purchase history: abonelik Meta'ya gitmez | ✔ (Apple tek satırda iki amaç — not 5) |
| "RevenueCat'e ad/e-posta gönderilmez" (§11A) | User ID: Evet | User IDs: Evet | ✔ |
| "Barkod numarası doğrudan Open Food Facts'e" (§12A) | Ek satır yok | Ek satır yok | ✔ |
| "AI izinleri isteğe bağlı" (§13A) | — | Health/Photos/UGC "İsteğe bağlı" | ✔ |

**Not 5:** Apple'da bir veri türü için tek "İzleme" cevabı verilir. Purchase History'nin bir kısmı (eatkcal siparişleri) Meta'ya gittiği için türün tamamı "İzleme: Evet" olur; abonelik geçmişi de aynı türün içinde göründüğü için etiket bu ayrımı gösteremez. Gizlilik metni ayrımı yapıyor (§7, §11A).

## 4. Yapılacaklar (konsol / kod — bu oturumda YAPILMADI)

1. ASC App Privacy ve Play Data safety formlarını §1–§2'ye göre güncelle (◆ satırlar + B-07 ★ satırları) — **İlter, konsol**.
2. `app.config.js` privacy manifest: `PaymentInfo` beyanını etiketle hizala; Other User Content amacına Koç/sesli giriş açıklaması gerekmez (tür zaten var) — **kod**.
3. ASC: Lisans Sözleşmesi alanı (Standard EULA) + açıklamaya EULA/Gizlilik bağlantıları — **İlter, konsol** (B-21).
4. G25-S1 LOG'u gelince ses satırlarını (SEÇENEK A/B) kesinleştir (B-22).
5. Koç açılmadan önce 30 gün silme cron'u (B-24).
