# Yayın kontrol listesi — KCAL 1.1.0 gönderimi (M-S1 md.5 · M-S2 md.5: Koç açık)

> **M-S2 (İlter 11 Kas 16:00):** 1.1.0 Fresh **ve** Balance ile çıkıyor; **kcalAI Koç açık** — bayrak `koc` + `abonelik` açıldı, `coach-chat` yayında.
> Fiyatlar: Fresh 199,99 TL/ay · 999,99 TL/yıl ($5.99 / $29.99); Balance 499,99 TL/ay · 2999,99 TL/yıl ($12.99 / $59.99); yıllıkta 7 gün deneme.
> Yasal bağlantılar `https://legal.eatkcal.com/...`. App Store'a **4 abonelik**, Play'e **2 abonelik × 2 temel plan**.

Sıra önemli; her bölüm bir öncekinin işaretlenmesini bekler. **Onaysız YASAK** (CLAUDE.md): production build, mağaza gönderimi,
`eas update --channel production`, `supabase db reset`, Dashboard auth ayarı, sır yazdırma → aşağıdaki bu adımlar **İlter onayıyla**.
Bu oturumlar (M-S1, M-S2) yalnız dosya hazırladı; mağaza paneline girmedi, deploy yapmadı, canlıya yazmadı.

Dosyalar: metinler `APP_STORE_METINLERI.md` / `GOOGLE_PLAY_METINLERI.md` · inceleme `INCELEME_NOTU.md` · gizlilik `GIZLILIK_BEYANLARI.md` ·
görseller `EKRAN_GORUNTUSU_PLANI.md` + `shots/` · izin metinleri `IZIN_METINLERI.md` · önceki ayrıntılı liste (cihaz testleri, rollback) bu dosyanın
G20-S2 hâlinde (git geçmişi, `night20/store`).

## A. Canlı (mağaza gönderiminden ÖNCE)
- [ ] **A1 Migration'lar** — önce `supabase migration list` ile canlıyla karşılaştır (geçmiş damga kayması var — G20-S2 A4 notu), sonra
      `supabase db push` (onay). 1.1.0'ın sunucu tarafı:
      | Dosya | Ne | 1.1.0 için | Rollback |
      |---|---|---|---|
      | `20261109210100_g20_s1_user_consents` | rıza kayıtları (`user_consents`) | şart (AI izni, sağlık rızası buraya yazar) | `supabase/rollbacks/…_rollback.sql` |
      | `20261109220100…220400_g20_s3_*` | anonim bayraklar, destek eki gizli, pazarlama izni, hesap silme | şart | var |
      | `20261110000100_g21_s1_barcode` | barkod günlük hakkı | şart (Ücretsiz günde 5) | var |
      | `20261110100100_g22_s1_subscriptions` · `…100200_g22_s1_restaurant_rating` · `…_g22_s2_geo` · `…_g22_s2_search` · `20261110190100_g23_geo_admin1` | abonelik/hak, puan, coğrafya, arama | şart | var |
      | **`20261111100100_g24_coach`** (G24) | Koç tabloları/RPC (`coach_messages`, `reserve/release_coach_message`, `my_coach_status`, `delete_coach_history`) + `app_settings` `coach_daily_balance=30`, `coach_trial_free=3`, `coach_retention_days=30`, `coach_enabled=true` | **şart** (Koç açık) — İlter 11 Kas: uygulandı; `supabase migration list` ile teyit | var |
      | **`20261111200100_g25_flags`** (G25) | `yakinda_satirlari`, `paylasim_baglanti` satırları (ikisi kapalı) | uygula | var |
      | **`20261111230100_g27_health_consent`** (G27) | sağlık açık rızası sunucu kaydı | uygula (istemci satırı cihazda bekletir) | var |
- [ ] **A2 Edge** — `revenuecat-webhook` canlıda ve RevenueCat'te webhook URL + yetkilendirme başlığı ayarlı (abonelik hakkı sunucuda bundan
      doğar). `analyze-ai-scan` son sürüm (ses metni analizi `analyzeText`). **`coach-chat` YAYINDA** (İlter 11 Kas) — teyit: JWT doğrulaması
      AÇIK, `ANTHROPIC_API_KEY` ve `COACH_MODEL` sırları tanımlı (değer yazdırma), güvenlik ön filtresi (`safety.ts`) son sürüm; inceleme
      hesabıyla TestFlight'ta 1 mesaj → yanıt + hak düşer, "Kan şekerim düşük…" → "Bir uzmana danış" (hak düşmez).
- [ ] **A3 Bayraklar** (`feature_flags`, `admin_set_flag` RPC ya da Boss paneli; Dashboard'dan elle değil):
      | Durum | Bayraklar |
      |---|---|
      | **Açık (İlter 11 Kas 16:00)** | **`koc`**, **`abonelik`** — `min_app_version='1.1.0'`; teyit: `select key, enabled, rollout_percent, min_app_version from feature_flags where key in ('koc','abonelik')` (okuma) |
      | 1.1.0 ile açılacak (dalga sırası G20-S2 E tablosu; hepsinde `min_app_version='1.1.0'`) | `yeni_kabuk`, `ai_tarama`, `barcode_scan`, `su_takibi`, `etkinlik`, `yeni_onboarding`, `gun_halkasi`, `paylasim_karti`, `kesfet`, `kesfet_takip`, `kesfet_yorum`, `kesfet_paylasim`, `kesfet_video`, `sosyal_bildirim`, `yeni_siparis`, `ogun_hatirlatma` |
      | **Kapalı kalır** | `yakinda_satirlari` · `paylasim_baglanti` (l.eatkcal.com DNS + AASA/assetlinks yayında olunca) · eski anahtarlar (`ai_coach`, `dietitian`, `inbox`, `restoran_yakinda`, …) |
      ⚠ **Koç tanıtım ekranı** "Egzersiz planı yok · **Yakında**" rozeti gösteriyor (`src/modules/coach/screens/CoachIntroScreen.tsx:75`, `coach.intro_soon`;
      `yakinda_satirlari` bayrağına bağlı DEĞİL). İlter kuralı: Koç'ta egzersiz rehberi "yakında" denmez; Apple 2.3.1 riski → derlemeden önce
      rozet (ya da satır) kaldırılmalı — kod işi, M-S2 dosya oturumu dokunmadı (M-S2-LOG SORULAR 1).
      ⚠ Mağaza açıklaması ve ekran görüntüleri şu özellikleri anlatıyor: foto/ses/barkod/elle kayıt, halkalar, etkinlik, ilerleme, seri,
      Keşfet (+ gününe ekle), eatkcal, abonelik, **kcalAI Koç** (açıklama paragrafı, promosyon, Yenilikler, ekran görüntüsü 03). **Yayın günü bu bayraklar %100 değilse** (dalgalı açılış), açıklama yeni kullanıcıya görünmeyen
      özellik anlatıyor olur (Apple 2.3.1). Öneri: `abonelik` + `ai_tarama` + `barcode_scan` + `yeni_kabuk` yayında %100; diğerleri dalgalıysa
      açıklama yine de doğru sayılır mı → SORULAR. `koc` + `abonelik` %100 olmalı (Koç hem metinde hem 3. karede).
- [ ] **A4 İnceleme hesabı** (`INCELEME_NOTU.md` §0): `apple@inceleme.eatkcal.com` Supabase Auth'ta **şifreyle** (G28 `reviewLogin`; şifre yalnız
      formda), bayrak kilitleri (**`koc` DAHİL**), Ücretsiz kademe (2 AI tarama, 3 Koç deneme mesajı sıfır), `ai_coach` izni verilmemiş.
- [x] **A5 Web — yasal bağlantılar `legal.eatkcal.com`** (M-S2 kararı). 11 Kas 16:xx ölçümü (`curl -L`), hepsi **200**:
      | URL | Durum | Kullanıldığı yer |
      |---|---|---|
      | https://eatkcal.com | 200 (M-S1) | Pazarlama URL'si, Play web sitesi |
      | https://legal.eatkcal.com/kullanim-kosullari | 200 | açıklama (TR) |
      | https://legal.eatkcal.com/gizlilik-politikasi | 200 | açıklama (TR), ASC TR + Play gizlilik URL'si |
      | https://legal.eatkcal.com/destek | 200 | ASC Destek URL'si (TR) |
      | https://legal.eatkcal.com/account-deletion | 200 | Play hesap silme (TR + EN aynı sayfa — G29 md.2), ASC User Privacy Choices |
      | https://legal.eatkcal.com/en/legal/terms | 200 | açıklama (EN) |
      | https://legal.eatkcal.com/en/legal/privacy | 200 | açıklama (EN), ASC EN gizlilik URL'si |
      | https://legal.eatkcal.com/en/support | 200 | ASC Destek URL'si (EN) |
- [ ] **A6 Hukuk — ENGEL** — canlı gizlilik politikası (TR ve EN) "Son güncelleme: Nisan 2026"; **yapay zekâ sağlayıcısı, ABD aktarımı, AI tarama,
      sesli giriş ve kcalAI Koç hiç geçmiyor** (11 Kas metin taraması: "Koç/coach/Anthropic/yapay zekâ" 0 eşleşme). Koç mesajları + günlük özet
      ABD'deki AI sağlayıcısına gidiyor ve uygulama ayrı onay istiyor → politika bunu anlatmadan gönderim 5.1.1 / 5.1.2(i) riski. L-S3 TASLAK'ları
      (gizlilik §5A ses, §5B AI, §11A abonelik; Kullanım Koşulları abonelik maddesi) + **Koç bölümü** (amaç, aktarılan veri, ABD, 30 gün saklama,
      geçmişi silme, ayrı onay ve geri alma) legal.eatkcal.com'da yayında olmalı. EULA = Apple Standart.

## B. Derleme (İlter onayı)
- [ ] **B1** Yeni **native** derleme şart (OTA yetmez): G26 (ATT kaldırıldı, Info.plist, gizlilik manifesti, Android `blockedPermissions`) +
      G27 (`FacebookAutoLogAppEventsEnabled=false`). Kontroller `g23-s1` worktree'sinde (İlter oradan derliyor):
      `npx tsc --noEmit && npm run hygiene && npm run test:unit && npx jest` ·
      `npx expo config --type introspect --json` → `NSUserTrackingUsageDescription` YOK, `NSPrivacyTracking false`.
- [ ] **B2** `eas build --profile production --platform all` (sürüm 1.1.0, build no. EAS remote) → TestFlight + Play dahili test.
- [ ] **B3** Xcode Organizer › arşiv › "Generate Privacy Report" ↔ `GIZLILIK_BEYANLARI.md` §1 (18 tür, izleme yok).
- [ ] **B4** TestFlight'ta `INCELEME_NOTU.md` §3 kontrol tablosu (giriş, foto, ses, sınır → paywall, sandbox satın alma + geri yükle,
      eatkcal adres, **Koç görünüyor + AI izni + 3 deneme + Balance'ta 30/gün + güvenlik yanıtı**, hesap silme ekranı). İsteğe bağlı: gerçek
      karelerle ekran görüntülerini yenile (EKRAN_GORUNTUSU_PLANI).

## C. App Store Connect (gönderim — İlter onayı)
- [ ] **C1 Abonelikler — 4 abonelik**, tek grup `kcalAI` (yükseltme sırası üstten: Balance yıllık, Balance aylık, Fresh yıllık, Fresh aylık):
      | Ürün kimliği | Süre | TR | ABD | Tanıtım teklifi | Açıklama (TR / EN, ≤ 55) |
      |---|---|---|---|---|---|
      | `kcalai_fresh_monthly` | 1 ay | 199,99 TL | $5.99 | — | `Günde 10 AI tarama, barkod ve elle giriş sınırsız` / `10 AI scans a day, unlimited barcode and manual` |
      | `kcalai_fresh_yearly` | 1 yıl | 999,99 TL | $29.99 | 7 gün ücretsiz (yeni aboneler) | aynı |
      | `kcalai_balance_monthly` | 1 ay | 499,99 TL | $12.99 | — | `Günde 50 AI tarama ve kcalAI Koç` / `50 AI scans a day plus kcalAI Coach` |
      | `kcalai_balance_yearly` | 1 yıl | 2999,99 TL | $59.99 | 7 gün ücretsiz (yeni aboneler) | aynı |
      TR fiyatı ASC'de **fiyat noktası** olarak seçilir (199,99 / 999,99 / 499,99 / 2999,99 TL noktaları; ABD tabanı elle değil, TR "temel ülke"
      seçilip diğer ülkeler ondan türetilmezse ABD ayrıca girilir). Her ürüne TR + EN görünen ad (`APP_STORE_METINLERI.md`); inceleme ekran
      görüntüsü (paywall: `shots/ios/tr/07.png` — Koç'lu, 2999,99 TL) ve inceleme notu. RevenueCat: `fresh` ← Fresh ürünleri, `balance` ←
      Balance ürünleri, `default` teklif 4 paket. Durum **Ready to Submit**.
- [ ] **C2 Abonelikleri sürüme ekle** — 1.1.0 sürüm sayfası › "In-App Purchases and Subscriptions" › **4 ürünün dördünü** seç (ilk abonelik sürümle birlikte
      incelenir; eklenmezse ürünler incelenmez ve satın alma sandbox'ta "ürün yok" verir).
- [ ] **C3 Uygulama bilgileri** — Ad `KCAL: AI Kalori Hesaplama` / `KCAL: AI Calorie Counter`, alt başlık `Kalori Sayacı & Fit Yemek` /
      `Photo Food Tracker & Macros` (ad değişikliği yalnız yeni sürümle olur → 1.1.0 gönderiminde). **Kategori: birincil Sağlık ve Fitness,
      ikincil Yemek ve İçecek** (bugün birincil Yiyecek ve İçecek). İçerik hakları: üçüncü taraf içerik (Keşfet kullanıcı içeriği) = Evet.
      Yaş derecelendirmesi anketi: kullanıcı içeriği var, tıbbi/sağlık bilgisi seyrek, reklam yok.
- [ ] **C4 URL'ler** — Destek TR `https://legal.eatkcal.com/destek`, EN `https://legal.eatkcal.com/en/support` · **Pazarlama `https://eatkcal.com`** ·
      Gizlilik (App Information, dil başına) TR `https://legal.eatkcal.com/gizlilik-politikasi`, EN `https://legal.eatkcal.com/en/legal/privacy`
      (A5: hepsi 200; içerik A6'ya bağlı).
- [ ] **C5 Lisans sözleşmesi** — App Information › License Agreement = **Apple Standart EULA**; açıklamada EULA + Kullanım Koşulları +
      Gizlilik bağlantıları var (3.1.2) — `_uret_metinler.py` bunu denetliyor.
- [ ] **C6 App Privacy** — `GIZLILIK_BEYANLARI.md` §1 + §1b (Koç mesajları = User Content › Other User Content, App Functionality, bağlı, izleme yok;
      Customer Support değil): 18 tür, hepsi bağlı, **"Data Used to Track You" boş** (G20'de Purchase History /
      Product Interaction / Device ID izleme işaretliydi → kaldır). Yayınla (App Privacy sürümden bağımsız yayınlanır — derleme onayıyla aynı gün).
- [ ] **C7 Sürüm metinleri** — TR + EN açıklama (Koç paragrafı), anahtar kelime (TR `koç`, EN `coach`), promosyon metni (Koç), "Bu sürümde yenilikler"
      (Koç); ekran görüntüleri **7 kare** (03 = Koç) 6,9" (`shots/ios/{tr,en}/01–07`) ve 6,5" (`shots/ios/{tr,en}/65/01–07`). iPad yok (`supportsTablet: false`).
- [ ] **C8 İnceleme bilgileri** — `INCELEME_NOTU.md` §1 (kullanıcı adı, inceleme hesabının uygulama şifresi `[İLTER]`, Notes — KCALAI COACH bölümü dahil).
- [ ] **C9 Yayın** — "onaydan sonra elle yayınla" + **aşamalı yayın (7 gün)**; sorun → duraklat.

## D. Google Play Console (gönderim — İlter onayı)
- [ ] **D1 Abonelikler — 2 abonelik × 2 temel plan**:
      | Abonelik | Temel plan | TR | ABD | Teklif | Avantajlar (≤ 40) |
      |---|---|---|---|---|---|
      | `kcalai_fresh` | `monthly` (otomatik yenilenen, 1 ay) | 199,99 TL | $5.99 | — | `Günde 10 AI tarama` · `Barkod ve elle giriş sınırsız` |
      | `kcalai_fresh` | `yearly` (otomatik yenilenen, 1 yıl) | 999,99 TL | $29.99 | `default`: 7 gün ücretsiz, yeni aboneler | aynı |
      | `kcalai_balance` | `monthly` | 499,99 TL | $12.99 | — | `Günde 50 AI tarama` · `kcalAI Koç: günde 30 mesaj` · `Barkod ve elle giriş sınırsız` |
      | `kcalai_balance` | `yearly` | 2999,99 TL | $59.99 | `default`: 7 gün ücretsiz | aynı |
      RevenueCat ürün kimliği `kcalai_fresh:monthly` biçimi; `fresh` / `balance` yetkileri; Play hizmet hesabı bağlı. 4 temel plan **Etkin**.
- [ ] **D2 Mağaza girişi** — ad, kısa açıklama (≤ 80), tam açıklama, simge 512, öne çıkan görsel `shots/play/{tr,en}/feature.png`, telefon
      görüntüleri `shots/play/{tr,en}/01–07.png` (03 = Koç); kategori Sağlık ve Fitness; iletişim e-postası, web sitesi `https://eatkcal.com`.
- [ ] **D3 Veri güvenliği** — `GIZLILIK_BEYANLARI.md` §2 soru soru (Meta paylaşımı: satın alma geçmişi, uygulama etkileşimleri, cihaz kimlikleri;
      Koç sohbeti = Mesajlar › Diğer uygulama içi mesajlar, paylaşım değil; Koç geçmişini silme = "hesabı silmeden veri silme" Evet).
- [ ] **D4 Hesap silme URL'si** — `https://legal.eatkcal.com/account-deletion` (uygulama içi silme de var).
- [ ] **D5 Reklam beyanı** — Uygulama reklam içeriyor mu: **Hayır**. Reklam kimliği: **Evet** (Meta SDK, Analiz + Reklam/pazarlama ölçümü).
- [ ] **D6 İçerik derecelendirmesi (IARC)** — kullanıcı etkileşimi/kullanıcı içeriği VAR (moderasyon, şikâyet, engelleme), dijital satın alma VAR
      (abonelik), konum paylaşımı YOK (yalnız teslimat adresi), şiddet/kumar vb. yok.
- [ ] **D7 Hedef kitle ve içerik** — **18 ve üzeri**; çocuklara yönelik değil; Aile programı yok.
- [ ] **D8 Sağlık uygulamaları beyanı** — beslenme ve kalori takibi + AI beslenme koçu (tıbbi tavsiye vermez); tıbbi cihaz değil; sağlık verisi işler
      (Health Connect YOK).
- [ ] **D9 Uygulama erişimi** — `INCELEME_NOTU.md` §2.
- [ ] **D10 Yayın** — üretim kanalında **kademeli dağıtım** %10 → %50 → %100; sorun → durdur.

## E. Yayından sonra
- [ ] **E1 Bayrak dalgaları** — G20-S2 E tablosu sırasıyla (48 saat alarm yoksa bir üst adım). `abonelik` açıkken satın alma → `revenuecat-webhook`
      → `my_entitlement` zinciri Sentry/RevenueCat panelinde izlenir.
- [x] **E2 Koç açılışı** — M-S2 ile 1.1.0'a alındı (İlter 11 Kas 16:00): `coach-chat` yayında, `koc` + `abonelik` açık; mağaza metni, inceleme
      notu, gizlilik beyanı ve ekran görüntüleri Koç'la güncellendi. Kalan: A2 teyit, A3 "Yakında" rozeti, A6 gizlilik politikası, AI izni metni
      onayı (`src/lib/consent/i18n.ts` "İLTER ONAYI BEKLİYOR"). Yayın sonrası izle: `coach_*` olayları, `coach-chat` hata/zaman aşımı oranı, maliyet.
- [ ] **E3** `paylasim_baglanti` — l.eatkcal.com DNS + AASA/assetlinks + `/p` `/u` önizleme sayfaları yayında olunca.
- [ ] **E4** `settings.min_supported_version='1.1.0'` — mağazada %100 + 2 hafta sonra (aşamalı yayın sürerken açma).
- [ ] **E5** Puan isteme (rapor §5: tek puan en büyük ASO açığı) — olumlu anda (ör. 3 günlük seri sonrası) `StoreReview` (1.1.x işi).

## F. Geri dönüş (kısa)
| Sorun | İlk hamle |
|---|---|
| Yeni özellik hatası | ilgili bayrak `enabled=false` (anında) |
| Koç sorunu (yanlış/uygunsuz yanıt, maliyet, sağlayıcı kesintisi) | `app_settings.coach_enabled=false` (acil kapatma) ya da `koc` bayrağı kapalı; mağaza metni Koç'u anlattığı için uzun sürecekse promosyon metnini güncelle |
| Abonelik hakkı gelmiyor | `revenuecat-webhook` logları; istemci RevenueCat'ten anında hak verir, sunucu `my_entitlement` sonra doğrular |
| Native çökme | App Store aşamalı yayını duraklat · Play kademeli dağıtımı durdur → 1.1.1 |
| JS hatası | `eas update:rollback --channel production` (onay) |
| Migration sorunu | `supabase/rollbacks/<dosya>_rollback.sql` (onay) |
