# Yayın kontrol listesi — KCAL 1.1.0 gönderimi (M-S1 md.5)

Sıra önemli; her bölüm bir öncekinin işaretlenmesini bekler. **Onaysız YASAK** (CLAUDE.md): production build, mağaza gönderimi,
`eas update --channel production`, `supabase db reset`, Dashboard auth ayarı, sır yazdırma → aşağıdaki bu adımlar **İlter onayıyla**.
Bu oturum (M-S1) yalnız dosya hazırladı; mağaza paneline girmedi, deploy yapmadı.

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
      | **`20261111100100_g24_coach`** (G24) | Koç tabloları/RPC + `koc` bayrağı **kapalı** | uygula (bayrak kapalı kalır) | var |
      | **`20261111200100_g25_flags`** (G25) | `yakinda_satirlari`, `paylasim_baglanti` satırları (ikisi kapalı) | uygula | var |
      | **`20261111230100_g27_health_consent`** (G27) | sağlık açık rızası sunucu kaydı | uygula (istemci satırı cihazda bekletir) | var |
- [ ] **A2 Edge** — `revenuecat-webhook` canlıda ve RevenueCat'te webhook URL + yetkilendirme başlığı ayarlı (abonelik hakkı sunucuda bundan
      doğar). `analyze-ai-scan` son sürüm (ses metni analizi `analyzeText`). **`coach-chat` deploy SONRAYA** — Koç açılırken (D).
- [ ] **A3 Bayraklar** (`feature_flags`, `admin_set_flag` RPC ya da Boss paneli; Dashboard'dan elle değil):
      | Durum | Bayraklar |
      |---|---|
      | 1.1.0 ile açılacak (dalga sırası G20-S2 E tablosu; hepsinde `min_app_version='1.1.0'`) | `yeni_kabuk`, `ai_tarama`, `barcode_scan`, `abonelik`, `su_takibi`, `etkinlik`, `yeni_onboarding`, `gun_halkasi`, `paylasim_karti`, `kesfet`, `kesfet_takip`, `kesfet_yorum`, `kesfet_paylasim`, `kesfet_video`, `sosyal_bildirim`, `yeni_siparis`, `ogun_hatirlatma` |
      | **Kapalı kalır** | `koc` · `yakinda_satirlari` · `paylasim_baglanti` (l.eatkcal.com DNS + AASA/assetlinks yayında olunca) · eski anahtarlar (`ai_coach`, `dietitian`, `inbox`, `restoran_yakinda`, …) |
      ⚠ Mağaza açıklaması ve ekran görüntüleri şu özellikleri anlatıyor: foto/ses/barkod/elle kayıt, halkalar, etkinlik, ilerleme, seri,
      Keşfet (+ gününe ekle), eatkcal, abonelik. **Yayın günü bu bayraklar %100 değilse** (dalgalı açılış), açıklama yeni kullanıcıya görünmeyen
      özellik anlatıyor olur (Apple 2.3.1). Öneri: `abonelik` + `ai_tarama` + `barcode_scan` + `yeni_kabuk` yayında %100; diğerleri dalgalıysa
      açıklama yine de doğru sayılır mı → SORULAR.
- [ ] **A4 İnceleme hesabı** (`INCELEME_NOTU.md` §0): `apple@inceleme.eatkcal.com`, bayrak kilitleri (Koç HARİÇ), posta kutusu web erişimi.
- [ ] **A5 Web** (kcal-web deploy = İlter). 11 Kas ölçümü (`curl -L`):
      | URL | Durum | Kullanıldığı yer |
      |---|---|---|
      | https://eatkcal.com | 200 | Pazarlama URL'si, Play web sitesi |
      | https://eatkcal.com/kullanim-kosullari | 200 | açıklama (TR) |
      | https://eatkcal.com/gizlilik-politikasi | 200 | açıklama (TR), ASC/Play gizlilik URL'si |
      | https://eatkcal.com/account-deletion | 200 | Play hesap silme |
      | https://eatkcal.com/destek | **404** | ASC Destek URL'si (TR) — route kcal-web'de var, yayında değil |
      | https://eatkcal.com/en/support | **404** | ASC Destek URL'si (EN) |
      | https://eatkcal.com/en/legal/terms | **404** | açıklama (EN) |
      | https://eatkcal.com/en/legal/privacy | **404** | açıklama (EN), ASC EN gizlilik URL'si |
      | https://eatkcal.com/en/account-deletion | **404** | Play (EN) |
      → **kcal-web eatkcal deploy'u gönderimden önce şart** (Destek URL'si çalışmayan sürüm reddedilir, 1.5). Gizlilik politikası metni
      L-S3 (AI tarama, sesli giriş, abonelik/RevenueCat bölümleri §5A/§5B/§11A) ile aynı gün yayında olmalı.
- [ ] **A6 Hukuk** — L-S3 TASLAK'ları (gizlilik §5A ses, §11A abonelik; Kullanım Koşulları abonelik maddesi) yayında; EULA = Apple Standart.

## B. Derleme (İlter onayı)
- [ ] **B1** Yeni **native** derleme şart (OTA yetmez): G26 (ATT kaldırıldı, Info.plist, gizlilik manifesti, Android `blockedPermissions`) +
      G27 (`FacebookAutoLogAppEventsEnabled=false`). Kontroller `g23-s1` worktree'sinde (İlter oradan derliyor):
      `npx tsc --noEmit && npm run hygiene && npm run test:unit && npx jest` ·
      `npx expo config --type introspect --json` → `NSUserTrackingUsageDescription` YOK, `NSPrivacyTracking false`.
- [ ] **B2** `eas build --profile production --platform all` (sürüm 1.1.0, build no. EAS remote) → TestFlight + Play dahili test.
- [ ] **B3** Xcode Organizer › arşiv › "Generate Privacy Report" ↔ `GIZLILIK_BEYANLARI.md` §1 (18 tür, izleme yok).
- [ ] **B4** TestFlight'ta `INCELEME_NOTU.md` §3 kontrol tablosu (giriş, foto, ses, sınır → paywall, sandbox satın alma + geri yükle,
      eatkcal adres, Koç görünmüyor, hesap silme ekranı). İsteğe bağlı: gerçek karelerle ekran görüntülerini yenile (EKRAN_GORUNTUSU_PLANI).

## C. App Store Connect (gönderim — İlter onayı)
- [ ] **C1 Abonelikler** — grup `kcalAI`, 4 ürün (`kcalai_fresh_monthly`, `kcalai_fresh_yearly`, `kcalai_balance_monthly`, `kcalai_balance_yearly`);
      fiyatlar TR 199 / 999 / 499 / 2999 TL, ABD $5.99 / $29.99 / $12.99 / $59.99; yıllıklarda tanıtım teklifi **7 gün ücretsiz** (yeni aboneler);
      her ürüne TR + EN görünen ad ve açıklama (`APP_STORE_METINLERI.md` tablo); inceleme ekran görüntüsü (paywall: `shots/ios/tr/06.png`
      kullanılabilir) ve inceleme notu. Durum **Ready to Submit**.
- [ ] **C2 Abonelikleri sürüme ekle** — 1.1.0 sürüm sayfası › "In-App Purchases and Subscriptions" › 4 ürünü seç (ilk abonelik sürümle birlikte
      incelenir; eklenmezse ürünler incelenmez ve satın alma sandbox'ta "ürün yok" verir).
- [ ] **C3 Uygulama bilgileri** — Ad `KCAL: AI Kalori Hesaplama` / `KCAL: AI Calorie Counter`, alt başlık `Kalori Sayacı & Fit Yemek` /
      `Photo Food Tracker & Macros` (ad değişikliği yalnız yeni sürümle olur → 1.1.0 gönderiminde). **Kategori: birincil Sağlık ve Fitness,
      ikincil Yemek ve İçecek** (bugün birincil Yiyecek ve İçecek). İçerik hakları: üçüncü taraf içerik (Keşfet kullanıcı içeriği) = Evet.
      Yaş derecelendirmesi anketi: kullanıcı içeriği var, tıbbi/sağlık bilgisi seyrek, reklam yok.
- [ ] **C4 URL'ler** — Destek `https://eatkcal.com/destek` (EN `…/en/support`) · **Pazarlama `https://eatkcal.com`** · Gizlilik (App Information,
      dil başına) TR `…/gizlilik-politikasi`, EN `…/en/legal/privacy`. A5 200 olmadan girme.
- [ ] **C5 Lisans sözleşmesi** — App Information › License Agreement = **Apple Standart EULA**; açıklamada EULA + Kullanım Koşulları +
      Gizlilik bağlantıları var (3.1.2) — `_uret_metinler.py` bunu denetliyor.
- [ ] **C6 App Privacy** — `GIZLILIK_BEYANLARI.md` §1: 18 tür, hepsi bağlı, **"Data Used to Track You" boş** (G20'de Purchase History /
      Product Interaction / Device ID izleme işaretliydi → kaldır). Yayınla (App Privacy sürümden bağımsız yayınlanır — derleme onayıyla aynı gün).
- [ ] **C7 Sürüm metinleri** — TR + EN açıklama, anahtar kelime, promosyon metni, "Bu sürümde yenilikler"; ekran görüntüleri 6,9" (`shots/ios/{tr,en}/`)
      ve 6,5" (`shots/ios/{tr,en}/65/`). iPad yok (`supportsTablet: false`).
- [ ] **C8 İnceleme bilgileri** — `INCELEME_NOTU.md` §1 (kullanıcı adı, posta kutusu şifresi `[İLTER]`, Notes).
- [ ] **C9 Yayın** — "onaydan sonra elle yayınla" + **aşamalı yayın (7 gün)**; sorun → duraklat.

## D. Google Play Console (gönderim — İlter onayı)
- [ ] **D1 Abonelikler** — `kcalai_fresh`, `kcalai_balance`; temel planlar `monthly` / `yearly` (otomatik yenilenen); yıllıkta teklif `default`
      = 7 gün ücretsiz deneme (yeni aboneler); fiyatlar TR + ABD (GOOGLE_PLAY_METINLERI tablo); avantaj satırları. RevenueCat'te Play hizmet
      hesabı bağlı. Etkin (Active).
- [ ] **D2 Mağaza girişi** — ad, kısa açıklama (≤ 80), tam açıklama, simge 512, öne çıkan görsel `shots/play/{tr,en}/feature.png`, telefon
      görüntüleri `shots/play/{tr,en}/01–06.png`; kategori Sağlık ve Fitness; iletişim e-postası, web sitesi `https://eatkcal.com`.
- [ ] **D3 Veri güvenliği** — `GIZLILIK_BEYANLARI.md` §2 soru soru (Meta paylaşımı: satın alma geçmişi, uygulama etkileşimleri, cihaz kimlikleri).
- [ ] **D4 Hesap silme URL'si** — `https://eatkcal.com/account-deletion` (uygulama içi silme de var).
- [ ] **D5 Reklam beyanı** — Uygulama reklam içeriyor mu: **Hayır**. Reklam kimliği: **Evet** (Meta SDK, Analiz + Reklam/pazarlama ölçümü).
- [ ] **D6 İçerik derecelendirmesi (IARC)** — kullanıcı etkileşimi/kullanıcı içeriği VAR (moderasyon, şikâyet, engelleme), dijital satın alma VAR
      (abonelik), konum paylaşımı YOK (yalnız teslimat adresi), şiddet/kumar vb. yok.
- [ ] **D7 Hedef kitle ve içerik** — **18 ve üzeri**; çocuklara yönelik değil; Aile programı yok.
- [ ] **D8 Sağlık uygulamaları beyanı** — beslenme ve kalori takibi; tıbbi cihaz değil; sağlık verisi işler (Health Connect YOK).
- [ ] **D9 Uygulama erişimi** — `INCELEME_NOTU.md` §2.
- [ ] **D10 Yayın** — üretim kanalında **kademeli dağıtım** %10 → %50 → %100; sorun → durdur.

## E. Yayından sonra
- [ ] **E1 Bayrak dalgaları** — G20-S2 E tablosu sırasıyla (48 saat alarm yoksa bir üst adım). `abonelik` açıkken satın alma → `revenuecat-webhook`
      → `my_entitlement` zinciri Sentry/RevenueCat panelinde izlenir.
- [ ] **E2 Koç açılışı (sonra, ayrı karar)** — sıra: `supabase functions deploy coach-chat` (JWT doğrulaması AÇIK) → AI izni metni onayı →
      `koc` önce iç kullanıcı → yüzdeli. **Aynı gün mağaza metni güncellenir**: açıklamaya Balance satırı "günde 50 AI tarama + kcalAI Koç",
      paywall Koç varyantı; promosyon metni sürümsüz değişir, açıklama bir sonraki sürümde (ya da OTA ile açılıyorsa 1.1.x metin güncellemesi).
      Gizlilik beyanı değişmez (Koç verisi şimdiden beyanda).
- [ ] **E3** `paylasim_baglanti` — l.eatkcal.com DNS + AASA/assetlinks + `/p` `/u` önizleme sayfaları yayında olunca.
- [ ] **E4** `settings.min_supported_version='1.1.0'` — mağazada %100 + 2 hafta sonra (aşamalı yayın sürerken açma).
- [ ] **E5** Puan isteme (rapor §5: tek puan en büyük ASO açığı) — olumlu anda (ör. 3 günlük seri sonrası) `StoreReview` (1.1.x işi).

## F. Geri dönüş (kısa)
| Sorun | İlk hamle |
|---|---|
| Yeni özellik hatası | ilgili bayrak `enabled=false` (anında) |
| Abonelik hakkı gelmiyor | `revenuecat-webhook` logları; istemci RevenueCat'ten anında hak verir, sunucu `my_entitlement` sonra doğrular |
| Native çökme | App Store aşamalı yayını duraklat · Play kademeli dağıtımı durdur → 1.1.1 |
| JS hatası | `eas update:rollback --channel production` (onay) |
| Migration sorunu | `supabase/rollbacks/<dosya>_rollback.sql` (onay) |
