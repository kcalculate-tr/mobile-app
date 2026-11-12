<!-- L-S3 · L-S5 -->
# Mağaza Gizlilik Eşleme Tablosu — Apple App Privacy · Google Play Data safety — TASLAK

> **Durum:** TASLAK · hukuki inceleme için (İlter Öziseven) · yayın yok · 2026-11-11 · dal `legal/global` · oturum L-S3
> **Kapsam:** Kcalculate AI 1.1.0 (iOS + Android), kcalAI eklemeleri dâhil: AI tarama (fotoğraf + not + sesli giriş), barkod, kcalAI Koç, Fresh/Balance abonelikleri.
> **Kaynak metinler:** `tr/01-gizlilik-politikasi.md` / `en/01-privacy-policy.md` — §3, §5, **§5A**, **§5B**, §7, §8, **§11A**, §12, **§12A**, **§13A**, §14. Bu tablodaki her satır o metinlerle tutarlı olmalı; biri değişirse diğeri de değişir.
> **Kod kaynağı:** `release/1.1.0` (@ 0401d64). Satır kanıtları "Kanıt" sütununda.
> **İlişki:** `BOSLUKLAR.md` B-07'deki 9 Kasım tabloları bu dosyayla **güncellenir**. B-07'deki ★ düzeltmeleri (Sentry bağlı, Audio Data, Other User Content, Customer Support) burada da aynen geçerli; yeni satırlar ◆ ile işaretli.
> **L-S5 güncellemesi (12 Kasım 2026):** G33 öğün planı (alerjen), G34 kişisel plan, G36 Koç'un plan okuması eklendi. L-S5 değişiklikleri **◇** ile işaretli; ayrıntı ve kanıtlar **§5**. Kaynak metinler: `L-S5-RIZA-METINLERI.md`, `L-S5-POLITIKA-EKLERI.md` (Gizlilik §4A, GP-1…GP-12). Kod: `release/1.1.0` @ dbde88f.

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
| Health & Fitness › Health | Evet | Evet | Hayır | App Functionality | Boy, kilo, hedef, ölçüler; AI tarama fotoğrafı ve sonucu; ◆ **Koç'a giden günlük takip özeti** (cinsiyet, hedefler, son 7 gün); ◇ **kişisel plan**: doğum yılı, hedef kilo ve tempo, vücut yağı oranı, kol ölçüsü, beslenme tercihi, sevilmeyen yiyecekler, öğün düzeni, aralıklı oruç, haftalık tartı; ◇ **alerjen seçimi**; ◇ Koç'a giden **plan özeti** ve Koç'la oluşturmada alerjen adları | §3, §4, **§4A**, §5B | `coach-chat/index.ts:88-135`; ◇ §5 |
| Health & Fitness › Fitness | Evet | Evet | Hayır | App Functionality | Öğün, kalori, makro, su, etkinlik; ◆ sesli girişten ve barkoddan kaydedilen öğünler; ◇ **hareket düzeyi, günlük adım tahmini, egzersiz türü/gün/süre** (kişisel plan) | §3, §5A, **§4A** | B-07; ◇ §5 |
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
| Sensitive Info, Contacts, Browsing/Search History, Emails or Text Messages | Hayır | — | — | — | — ◇ Apple "Sensitive Info" tanımı (ırk/etnik köken, cinsel yönelim, **gebelik/doğum**, engellilik, din, sendika, siyasi görüş, genetik, biyometrik) alerjen ve kişisel planı **kapsamaz**; bunlar Health'e girer. Gebelik sorulmuyor (`pp.safety_note` yalnız uyarı) | §3 "İşlemediklerimiz" | — |

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
| Health and fitness › Health info | Evet | Hayır | Hayır | İsteğe bağlı | App functionality | Boy, kilo, hedef, ölçüler; AI tarama fotoğrafı sonucu; ◆ Koç'a giden günlük takip özeti (Anthropic = hizmet sağlayıcı); ◇ kişisel plan cevapları (vücut yağı, beslenme tercihi, öğün düzeni, aralıklı oruç, haftalık tartı), ◇ **alerjen seçimi**, ◇ Koç'a giden plan özeti | §4, **§4A**, §5B |
| Health and fitness › Fitness info | Evet | Hayır | Hayır | İsteğe bağlı | App functionality | Öğün, su, etkinlik; ◆ sesli giriş ve barkoddan kaydedilen öğünler; ◇ hareket düzeyi, adım tahmini, egzersiz (kişisel plan) | §5A, **§4A** |
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
| ◇ "Kişisel plan telefonda hesaplanır, ABD'ye gitmez" (§4A) | Health: App Functionality | Health info: paylaşım değil | ✔ (Koç'la oluştur izinsiz gönderiyor → ✗ K-1) |
| ◇ "Plan cevapları kullanım ölçümüne eklenmez" (§8, GP-7) | Health amaçlarında Analytics yok | Health info amaçlarında Analytics yok | ✗ bugün `pp_saved.goal`, `pp_checkin.kind` (K-5) |
| ◇ "Adım sayısı cihazdan okunmaz" (§3, GP-3) | HealthKit beyanı yok | Health Connect beyanı yok | ✔ (`pp.steps_hint` metni ✗) |

**Not 5:** Apple'da bir veri türü için tek "İzleme" cevabı verilir. Purchase History'nin bir kısmı (eatkcal siparişleri) Meta'ya gittiği için türün tamamı "İzleme: Evet" olur; abonelik geçmişi de aynı türün içinde göründüğü için etiket bu ayrımı gösteremez. Gizlilik metni ayrımı yapıyor (§7, §11A).

## 4. Yapılacaklar (konsol / kod — bu oturumda YAPILMADI)

1. ASC App Privacy ve Play Data safety formlarını §1–§2'ye göre güncelle (◆ satırlar + B-07 ★ satırları) — **İlter, konsol**.
2. `app.config.js` privacy manifest: `PaymentInfo` beyanını etiketle hizala; Other User Content amacına Koç/sesli giriş açıklaması gerekmez (tür zaten var) — **kod**.
3. ASC: Lisans Sözleşmesi alanı (Standard EULA) + açıklamaya EULA/Gizlilik bağlantıları — **İlter, konsol** (B-21).
4. G25-S1 LOG'u gelince ses satırlarını (SEÇENEK A/B) kesinleştir (B-22).
5. Koç açılmadan önce 30 gün silme cron'u (B-24).
6. ◇ Kişisel plan, alerjen ve Koç plan özeti satırlarını konsola işle (§5) — **İlter, konsol**. K-1 ve K-5 kapanmadan Health/Health info amaçlarına "Analytics" eklemek gerekip gerekmediğine §5.4'e göre karar ver.
7. ◇ `src/modules/personalPlan/i18n.ts` `steps_hint` metnini düzelt ("sağlık bağlantısı açıksa kendimiz okuruz" → HealthKit/Health Connect yok) — **kod**, `L-S5-KOD-ESLEME.md`.

---

## 5. L-S5 — Kişisel plan, öğün planı ve alerjen (12 Kasım 2026)

### 5.1 Toplanan yeni veriler ve etiket karşılığı

| Veri (kod alanı) | Nerede | Apple App Privacy | Play Data safety | Bağlı | İzleme / Paylaşım | Zorunlu / İsteğe bağlı | Amaç | Kanıt |
|---|---|---|---|---|---|---|---|---|
| Doğum yılı (`birthYear`) | Cihaz + `user_nutrition_profiles.personal_plan` | Health & Fitness › **Health** | Health and fitness › **Health info** | Evet | Hayır / Hayır | İsteğe bağlı (yalnız plan için) | App Functionality | `src/modules/personalPlan/types.ts:58` |
| Cinsiyet, boy, kilo, hedef, hedef kilo, tempo | aynı | **Health** | **Health info** | Evet | Hayır / Hayır | İsteğe bağlı | App Functionality | `types.ts:56-64` |
| Hareket düzeyi, günlük adım **tahmini** (kullanıcı girer), egzersiz türü/gün/süre/hafta günleri | aynı | Health & Fitness › **Fitness** | Health and fitness › **Fitness info** | Evet | Hayır / Hayır | İsteğe bağlı | App Functionality | `types.ts:65-70` |
| Vücut ölçüleri (bel, kalça, göğüs, kol), vücut yağı oranı | aynı | **Health** | **Health info** | Evet | Hayır / Hayır | İsteğe bağlı (atlanabilir) | App Functionality | `types.ts:35-41,71-72` |
| Beslenme tercihi, sevilmeyen yiyecekler, öğün düzeni, aralıklı oruç | aynı | **Health** (beslenme düzeni sağlık hedefiyle işlenir; temkinli seçim) | **Health info** | Evet | Hayır / Hayır | İsteğe bağlı | App Functionality | `types.ts:24-33,73-76` |
| Alerjen seçimi (`allergens`) | Kişisel planda `personal_plan` içinde; öğün planı formunda saklanmaz | **Health** | **Health info** | Evet | Hayır / Hayır | İsteğe bağlı (ayrı rıza) | App Functionality | `types.ts:75`; `PlanGenerateScreen.tsx:80-81` |
| Haftalık tartı kayıtları | Sunucu (kilo/ölçü kaydı) | **Health** | **Health info** | Evet | Hayır / Hayır | İsteğe bağlı | App Functionality | `pp_checkin` akışı |
| Yarım kalan akış cevapları | `personal_plan_progress` + cihaz | Yukarıdaki türlerle aynı (ayrı satır gerekmez) | aynı | Evet | Hayır / Hayır | — | App Functionality | migration `20261112110100_g34_personal_plan.sql:85-93` |
| Hatırlatma tercihleri ve saatleri | Cihaz + `personal_plan` | **Toplanmış sayılmaz** önerisi: bildirim telefonda kurulur. Tercihler planla birlikte sunucuda tutulduğu için temkinli seçim: App Activity › **Other User Content** yerine ayrı satır açma; plan verisinin parçası say | aynı | Evet | Hayır | İsteğe bağlı | App Functionality | `reminders.ts:50` |
| Koç'a giden plan özeti | Anthropic (ABD), yalnız Koç izniyle | Health (mevcut satır, amaç App Functionality) | Health info (Anthropic hizmet sağlayıcı → **paylaşım değil**) | Evet | Hayır / Hayır | İsteğe bağlı | App Functionality | `coach-chat/plan.ts:43-68` |
| Koç'la oluştur: kalori/protein hedefi, diyet, alerjen adları | Anthropic (ABD) | Health (mevcut satır) | Health info (hizmet sağlayıcı) | Evet (istekte kimlik yok, ama kota için oturumlu çağrı) | Hayır / Hayır | İsteğe bağlı | App Functionality | `meal-plan-generate/index.ts:72-81` |

### 5.2 Apple "Health" kategorisi neden doğru?

- Apple tanımı: **Health** = "sağlık ve tıbbi veriler; Clinical Health Records API, HealthKit, Movement Disorder API verileri, sağlıkla ilgili insan araştırması verileri **veya kullanıcının sağladığı diğer sağlık ya da tıbbi veriler**". Kişisel plan cevapları kullanıcının sağladığı sağlık verisidir → Health.
- **Fitness** = "fitness ve egzersiz verileri; Motion and Fitness API dâhil". Egzersiz ve hareket cevapları → Fitness.
- **HealthKit kullanılmıyor.** Kodda HealthKit/Health Connect paketi ve izni yok. Bu yüzden ASC'de HealthKit entitlement açıklaması, Play'de **Health Connect izin beyanı gerekmez**. `pp.steps_hint` metni ("sağlık bağlantısı açıksa kendimiz okuruz") bunun tersini ima ediyor; inceleme ekibi HealthKit kullanımı arayabilir → metin düzeltilmeli (KOD-ESLEME).
- **Sensitive Info** seçilmez: alerji ve vücut ölçüleri Apple'ın Sensitive Info listesinde değil; gebelik sorulmuyor.
- **İzleme: Hayır.** Kişisel plan ve alerjen verisi Meta'ya gitmez (`events.ts:208-216` olaylarında `meta:` alanı yok).

### 5.3 Google Play "Health info" neden doğru?

- Play tanımı: **Health info** = "kullanıcının sağlığına ilişkin bilgiler, ör. tıbbi kayıtlar veya belirtiler". Play örnekleri dar, ama kilo, vücut yağı, alerji ve beslenme düzeni sağlık bilgisidir. Temkinli seçim: **Health info**. **Fitness info** = "egzersiz veya diğer fiziksel etkinlik" → egzersiz ve hareket.
- **Paylaşılıyor mu? Hayır.** Anthropic ve Supabase hizmet sağlayıcıdır (§0 okuma kuralları).
- **İsteğe bağlı:** Kişisel plan ve alerjen isteğe bağlıdır; kullanıcı vermeden uygulamayı kullanabilir. Takip kapısı (profil zorunlu, Tur 26q) takip özelliği için zorunlu kılsa da uygulamanın tamamı için zorunlu değil → "İsteğe bağlı" doğru. Takip kapısı uygulamanın **ana işlevini** profile bağlıyorsa Play "zorunlu" sayabilir; inceleme reddi gelirse "Zorunlu" seçilir (LOG soru 8).
- **Anlık işleme (ephemeral):** Koç'la oluştur'da gönderilen hedef/diyet/alerjen Anthropic'te istek süresince işlenir, ama bizde Koç kotası kaydı kalır. Plan verisi zaten Supabase'de saklandığı için "anlık" işaretlenmez.

### 5.4 Amaç: Analytics eklenmeli mi? (K-5)

- Bugün `pp_saved` olayı `goal` (kilo ver/koru/al/dengeli), `pp_checkin` olayı haftalık tartı sonucunun sınıfını (`on_track`/`slow`/`fast`/`fluctuation`) birinci taraf kullanım ölçümüne **kullanıcı kimliğiyle** yazıyor (`src/lib/metrics/events.ts:213,215`).
- Bu, Health verisinin **Analytics** amacıyla da kullanıldığı anlamına gelir. Apple ve Play'de Health/Health info satırına "Analytics" amacı eklenmesi gerekir. Gizlilik §8 de "beslenme kayıtlarının içeriği eklenmez" diyor; hedef ve tartı sonucu bu ifadeyle çelişir.
- **Öneri:** İki alan olaydan çıkarılsın (K-5). O zaman etiket App Functionality olarak kalır ve GP-7 metni doğru olur. Çıkarılmazsa: Health + Analytics amacı, Gizlilik §8'e açık cümle ve dayanak olarak açık rıza (meşru menfaat özel nitelikli veri için dayanak olamaz).

### 5.5 Silme ve güvenlik bölümü

- Hesap silme `auth.admin.deleteUser()` ile `user_nutrition_profiles` (plan dâhil) ve `personal_plan_progress` satırlarını CASCADE ile siler (`supabase/functions/delete-account/index.ts:43-44,265`; migration `…g34_personal_plan.sql:86`). Play "Veri silme talebi: Evet" değişmez.
- ◇ **Not:** Aynı CASCADE `user_consents` satırlarını da siliyor (`delete-account/index.ts:44`). Açık Rıza Metinleri "rıza kaydı geri alındıktan sonra ispat için 3 yıl saklanır" diyor; hesap silinince ispat kaydı kalmıyor. Mağaza etiketini etkilemez, ama metinle kod çelişiyor (LOG soru 9).
- ◇ Rızayı geri alınca plan ve alerjen silme bugün yok (K-2). Play Data safety "Kullanıcılar verilerinin silinmesini isteyebilir" beyanı hesap silmeyle karşılanıyor; K-2 bunu genişletir, beyan değişmez.
