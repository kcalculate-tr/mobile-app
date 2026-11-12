# Yayın kontrol listesi — Kcalculate AI 1.1.0 (G20-S2 md.5)

Sıra önemli; her bölüm bir öncekinin işaretlenmesini bekler. **Onaysız YASAK** (CLAUDE.md): `eas update --channel production`,
production build, mağaza gönderimi, `supabase db reset`, Dashboard auth ayarı, sır yazdırma. Aşağıdaki bu adımlar
**İlter onayıyla** yapılır; bu oturum hiçbirini yapmadı.

Kaynaklar: `docs/night/TAKIP_ACILIS.md` (takip bayrakları ayrıntısı), `docs/night/G19-S4-LOG.md` (OTA/derleme ayrımı),
`docs/night/G20-S1-LOG.md` (rıza), `.claude/night/CANLI_SEMA_2026-11-09.md`, canlı migration + edge listesi (Supabase MCP
salt-okuma, 9 Kas — SQL okuma reddedildi, bayrak satırlarının değerleri bu yüzden doğrulanamadı).

## A. Derleme öncesi
- [ ] **A1 (P0, karar)** Üçüncü taraf AI izni — Apple 5.1.2(i): tabak fotoğrafı Anthropic'e gidiyor, uygulamada ilk taramadan
      önce bildirim + izin yok (`GIZLILIK_BEYANLARI.md` Ç5). Önerilen: tek seferlik sheet + `user_consents` kaydı (JS/OTA ile
      gidebilir ama inceleme bu sürümü görecek → derlemeden ÖNCE). Karar verilmeden gönderim riskli.
- [ ] **A2** Dal birleştirme: `night19/release` ← `night20/consent` (G20-S1) ← `night20/store` (bu dal; G20-S1 tabanlı → çakışma yok).
      Paralel G20 dalları varsa önce onlar; `legal/global` yalnız docs (uygulamaya girmez).
- [ ] **A3** Kontroller (birleşik dalda):
      ```sh
      export PATH="/opt/homebrew/opt/node@20/bin:$PATH"
      npm ci && npx tsc --noEmit && npm run test:unit && npm run test:components && npm run hygiene
      EXPO_NO_DOTENV=1 npx expo config --type introspect --json | grep -c NSLocationAlways   # 0 olmalı
      npx expo export -p ios && npx expo export -p android
      ```
- [ ] **A4 Migration'lar (canlı DB)** — `supabase db push` İlter onayıyla, dosya sırasıyla:
      | Dosya | Canlıda mı (9 Kas) | Not |
      |---|---|---|
      | `20261108000100_g18_onboarding_state` · `…000300_g18_eatkcal_waitlist` · `…000400_g18_finpush_templates` | ✓ (geçmişte farklı sürüm damgasıyla) | |
      | `20261109100100/100200/100300` D-S1 · `20261109110000` G19-S3 · `20261109190100` G19-S1 · `20261109200100` G19-S2 | ✓ | |
      | **`20261109210100_g20_s1_user_consents`** (+ rollback) | ✗ (CANLI_SEMA'da `user_consents` yok, `legal_documents.version` yok) | **1.1.0 öncesi uygula**; istemci yokken fail-open çalışır ama kabul kaydı sunucuya yazılmaz (ispat yükü, L-S1 B-02) |
      ⚠ **Geçmiş kayması:** `20261102…`–`20261106…` dosyalarının (feature_flags, feed, g8_social, g11/g12 bayrakları, g15_water…)
      tabloları canlıda VAR (CANLI_SEMA) ama `supabase_migrations` geçmişinde bu sürüm damgaları YOK; canlı geçmişteki
      G18/G19 kayıtları da farklı damgalı (ör. `20261108190904_g18_onboarding_state`). `supabase db push` bu dosyaları yeniden
      çalıştırmayı deneyebilir. Önce `supabase migration list` ile karşılaştır; gerekiyorsa `supabase migration repair --status applied <sürüm>`
      (İlter onayı). Dosyalar çoğunlukla `if not exists`/`on conflict do nothing` ama hepsi doğrulanmadı.
- [ ] **A5 Bayrak satırları** (canlıda okuma reddedildi → İlter SQL editöründe salt-okuma):
      `select key, enabled, rollout_percent, min_app_version, platforms from feature_flags order by key;`
      Beklenen: aşağıdaki E tablosundaki her anahtar var, `enabled=false`, `rollout_percent=0`, yeni özelliklerde `min_app_version='1.1.0'`.
      Eksik satır (ör. `ai_tarama`, `kesfet`, `gun_halkasi` — migration dosyalarında INSERT'leri yok) **migration dosyasıyla** eklenir, Dashboard'dan değil.
- [ ] **A6 Demo hesap** (`INCELEME_NOTU.md`): Auth Admin API ile oluştur, `user_feature_unlocks` satırları, posta kutusu. Şifre/kod çıktıya yazılmaz.
- [ ] **A7 Web** (deploy = İlter): `docs/store/well-known/*` → `landing-page/.well-known/`; assetlinks parmak izleri; `/k/:code`, `/s/:code`,
      `/kesfet` dönüş sayfaları; doğrulama komutları `docs/store/well-known/README.md`. Gizlilik/destek/silme URL'leri 200:
      `https://eatkcal.com/gizlilik-politikasi`, `/en/legal/privacy`, `/destek`, `/en/support`, `/account-deletion`.
- [ ] **A8 Hukuk** (L-S1): Meta varsayılanı AÇIK kararı (L-S1 kapalı öneriyor), gizlilik politikasında Anthropic/yurt dışı aktarım
      ve AI işleme metni yayında — mağaza etiketleriyle aynı gün.

## B. Derleme ve test dağıtımı (İlter onayı)
- [ ] **B1** `eas build --profile production --platform all` — sürüm 1.1.0, build numarası EAS remote (`autoIncrement`). Native değişiklikler:
      expo-image-manipulator, expo-camera, izin metinleri (Always konum silindi, foto-ekleme metni, EN konum), ATT metni (G20-S1),
      gizlilik manifesti (18 tür), associatedDomains/intentFilters yolları.
- [ ] **B2** iOS → TestFlight (iç test), Android → Play "Dahili test" kanalı. Preview APK (`eas build --profile preview`) da olur.
- [ ] **B3** OTA kanalı: production derleme `channel: production`, `runtimeVersion: appVersion` → yalnız **1.1.0** derlemeleri 1.1.0
      güncellemelerini alır; 1.0.7 cihazlar etkilenmez. İlk OTA yalnız mağaza onayından SONRA ve gerekiyorsa
      (`eas update --channel production` = onay). `fallbackToCacheTimeout: 0` → güncelleme bir sonraki açılışta uygulanır.
- [ ] **B4** Xcode Organizer › arşiv › "Generate Privacy Report" → `GIZLILIK_BEYANLARI.md` §4 ile karşılaştır (Meta SDK kendi manifestini ekler).

## C. Cihaz testleri (gerçek iPhone + Android, test kullanıcısı; gerçek sipariş/ödeme YOK)
Her izin için: **ilk istek → reddet → Ayarlar'dan aç → tekrar dene** döngüsü; TR ve EN cihaz dili.

**Kamera / fotoğraf (Tara)**
- [ ] Temiz kurulum → Tara → sistem kamera sorusu metni TR ("Tabağını tarayıp…"), EN cihazda EN.
- [ ] Reddet → "kamera kapalı" hâli + Ayarlar'a yönlendirme; galeri ile tarama yine çalışır.
- [ ] Ayarlar'dan izin → canlı vizör; çekim → sonuç (uzun kenar ≤ 1600: Supabase `user-media`'daki dosya boyutu küçük, 5 MB altı).
- [ ] Fotoğraf erişimi: iOS "Sınırlı erişim" seçimiyle galeri; Android 13+ Foto Seçici (izin sorusu YOK), Android ≤12 depolama izni.
- [ ] Paylaşım kartı → paylaşım sayfası → "Görüntüyü Kaydet" → foto-ekleme izni metni (yeni metin) → kayıt.
- [ ] Uçak modu → Tara → fotoğraf sıraya alınır → ağ gelince işlenir.

**Konum**
- [ ] eatkcal adres doğrulama → "kullanılırken" sorusu metni; iOS Ayarlar › Konum'da yalnız "Hiçbir zaman / Sonraki sefer / Kullanılırken" (Her zaman YOK).
- [ ] Reddet → elle adres girişi çalışır (FinEkAddressNoPerm hâli).

**Bildirim**
- [ ] Onboarding "Serini korumak için…" → İzin ver → iOS sistem sorusu / Android 13+ `POST_NOTIFICATIONS` sorusu.
- [ ] "Şimdi değil" → sistem sorusu GELMEZ; ilk öğün kutlamasında tekrar teklif.
- [ ] Profil › Bildirimler: kapat/aç; reddedilmiş izinde Ayarlar'a yönlendirme. `ogun_hatirlatma` açık test hesabında 14:30 hatırlatması.

**Rıza + ATT (G20-S1, bayrak açık hesapta)**
- [ ] Yeni hesap (e-posta): onay kutusu işaretsizken "Kod gönder" pasif; Meta anahtarı AÇIK gelir.
- [ ] Kabul → giriş → **sonra** ATT sorusu (metin "Reklam kampanyalarımızın etkisini ölçmek için…"). Sıra: politika → ATT.
- [ ] ATT "İzin Verme" → Profil › Gizlilik › Veri ve reklam izinleri'nde Meta KAPALI görünür; Meta olayı gitmez.
- [ ] Meta anahtarını kapatarak kayıt → ATT sorusu HİÇ gelmez.
- [ ] Ayarlar'dan Meta aç → ATT sorulur (daha önce reddedildiyse "iPhone Ayarları'nı aç").
- [ ] Mevcut kullanıcı (1.0.7'den güncelleme) → bir kez bilgilendirme sheet'i, sonra bir daha yok.
- [ ] `user_consents` satırı yazıldı (A4 uygulandıysa): test kullanıcısı için salt-okuma SQL.
- [ ] Android: ATT yok; Meta anahtarı kapalıyken olay gitmez (Meta Events Manager test olayları).

**Derin bağlantı (A7 yayında olmalı)**
- [ ] Notlar/Mesajlar'dan `https://l.eatkcal.com/p/<id>` → uygulama gönderiyi açar; `/u/<handle>` profil; `/kesfet` Keşfet (bayrak açıksa).
- [ ] `/k/TEST1` ve `/s/TEST1` → uygulama açılır, `first_touch`/kaynak olayında `box_card`/`saha` (analytics_events test satırı).
- [ ] `https://l.eatkcal.com/privacy` → **tarayıcıda** açılır (uygulama değil).
- [ ] Android: `adb shell pm get-app-links com.kcalmobile.app` → `l.eatkcal.com: verified`.
- [ ] Uygulama kurulu değilken `/k/TEST1` → web dönüş sayfası (404 değil).

**Diğer**
- [ ] Hesap silme: Profil › Güvenlik › Hesabımı sil → oturum kapanır, yeniden girişte yeni hesap.
- [ ] Bayraklar kapalı (yayın günü durumu) → uygulama 1.0.7 ile aynı akış (parite).
- [ ] Zorunlu güncelleme modali: test ortamında `settings.min_supported_version` > cihaz sürümü iken modal (yalnız test projesinde/salt-okuma ile doğrula).

## D. Mağaza gönderimi ve yayın (İlter onayı)
- [ ] Metinler `APP_STORE_METINLERI.md` / `GOOGLE_PLAY_METINLERI.md`; görseller `EKRAN_GORUNTUSU_PLANI.md`; gizlilik `GIZLILIK_BEYANLARI.md`; inceleme `INCELEME_NOTU.md`.
- [ ] App Store: **Aşamalı yayın (phased release, 7 gün)** açık; "onaydan sonra elle yayınla". Sorun → aşamalı yayını **duraklat** (30 güne kadar).
- [ ] Google Play: üretim kanalında **kademeli dağıtım** %10 → %50 → %100 (ikili dosya yüzdesi; bayraklardan bağımsız). Sorun → dağıtımı **durdur**.
- [ ] Yayın günü bütün yeni bayraklar **kapalı** (E Dalga 0). Mağaza sürümü %100'e ulaşmadan bayrak açmak serbest (yalnız 1.1.0 alır).

## E. Bayrak açılış sırası (`feature_flags`; değişiklik = satır güncellemesi, OTA gerekmez)
Kural: bir bayrak bir üst adıma **48 saat alarm yok** ise çıkar (metrikler `TAKIP_ACILIS.md` §2 + Sentry çökme oranı + `scan_fail` oranı).
Yüzde kovası kullanıcı başına sabit (`fnv1a32(key:user_id) % 100`) → %10'daki kullanıcı %50'de de içeride. Bayraklar yalnız
**girişli** kullanıcıda çözülür (aşağıda R1). Hepsinde `min_app_version='1.1.0'`.

| Dalga | Bayrak(lar) | Ne açar | Bağımlı | %10 | %50 | %100 | Geri dönüş etkisi |
|---|---|---|---|---|---|---|---|
| 0 | — | Mağaza 1.1.0, bütün bayraklar kapalı | — | — | — | — | — |
| 1 | `yeni_kabuk` | Yeni kabuk: FinHomeR3, TabBarR3, rıza kapısı (G20-S1), kayıt kuyruğu | — | G+1 | G+3 | G+7 | 1.0.7 kabuğu aynen |
| 1 | `ai_tarama` | Tara dairesi + AI tarama (günlük kota) | yeni_kabuk | yeni_kabuk ile **aynı** yüzde | ← | ← | Tara dairesi gizlenir; acil kapatma `scan_fail{disabled}` metniyle |
| 1 | `su_takibi`, `etkinlik` | Su halkası (sunucu), etkinlik kaydı | yeni_kabuk | %10 | %50 | %100 | cihaz içi sayaç / bölüm gizlenir |
| 2 | `yeni_onboarding` | Final onboarding + Takibe başla + rıza bloğu | yeni_kabuk %50 | %10 | %50 | %100 | eski onboarding/giriş (eski onay metinleri aynen) |
| 2 | `gun_halkasi`, `paylasim_karti` | Gün halkası, Tabak Röntgeni paylaşım kartı | yeni_kabuk %50 | %10 | %50 | %100 | şerit/kart gizlenir |
| 3 | `kesfet` (+ `kesfet_takip`, `kesfet_yorum`) | Keşfet sekmesi, takip, yorum | yeni_kabuk %100 · moderasyon (`moderate-content` canlı) | %10 | %50 | %100 | Keşfet sekmesi YOK (`tabs.ts`) |
| 3 | `kesfet_paylasim`, `kesfet_video` | Herkes paylaşır, video | kesfet %50 | %10 | %50 | %100 | yalnız creator paylaşır / video yok |
| 3 | `sosyal_bildirim` | Sosyal bildirimler + push | kesfet %50 | %10 | %50 | %100 | zil/liste gizlenir |
| 4 | `yeni_siparis` | eatkcal yeni arayüz (ana sayfa → ödeme) | yeni_kabuk %50 | %10 | %50 | %100 | eski sipariş akışı; **ödeme hatası alarmı** (failed_payments, Paynkolay) en sıkı |
| 5 | `ogun_hatirlatma` | Öğün saati yerel hatırlatma — 10:30 · 14:30 · 21:00 (İstanbul) + yalnız son 7 günde kaydı olana (**İlter onayı 10 Kas**) | yeni_kabuk **%100'den sonra** | %10 | %50 | %100 | kurulu hatırlatmalar sonraki açılışta iptal |
| Deney | `onb_welcome_variant_b`, `_c` | Karşılama başlığı B/C (A varsayılan) | yeni_onboarding %100 | B %33, C %50 (B kazanır → ≈ A/B/C üçte bir) | — | — | A'ya döner |
| Kapalı kalır | `restoran_yakinda`, `kcalculate_ai_tracking`, `log_meal`, `barcode_scan`, `discover`, `ai_coach`, `dietitian`, `inbox`, `eatkcal_ordering` | eski/kullanılmayan anahtarlar | — | — | — | — | — |

Açma SQL'i (örnek, İlter): `select admin_set_flag('yeni_kabuk', true, 10, '1.1.0', null);` (G11 RPC: anahtar, enabled, yüzde,
min_app_version, platformlar; admin oturumu ister, audit satırı yazar — Boss paneli bayrak ekranı aynı RPC'yi çağırır).
Yalnız iOS'ta başlatmak için platformlar `array['ios']`.

**R1 — girişsiz yeni kurulum:** `get_my_features` yalnız oturumlu kullanıcıda çağrılır (`src/core/flags/FlagsProvider.tsx:66-70`);
yeni kurulumda önbellek de yoktur → giriş öncesi ekranlar (karşılama/onboarding) bayrak kapalı yolunda açılır. `yeni_onboarding`
yüzdesi bu yüzden ilk kurulum akışına tam yansımayabilir. Dalga 2'den önce kontrol: yeni kurulumda hangi onboarding geliyor? (SORULAR)

## F. min_app_version ve zorunlu güncelleme
- Bayrak bazında: `feature_flags.min_app_version='1.1.0'` → 1.0.7 istemciler yeni özellikleri hiç almaz (sunucu `_ff_version_gte`).
- `ai_tarama` için 1.1.0 şart: eski istemci `reason:'disabled'` yanıtını "hakkını kullandın" diye gösterir (G19-S1).
- Uygulama geneli: `settings.min_supported_version` (+ `force_update_message`) → `src/lib/forceUpdate.ts` modalı (fail-open).
  1.1.0 mağazada %100 ve 2 hafta sonra, 1.0.7 kullanımı düşükse `min_supported_version='1.1.0'` (İlter; mesaj TR/EN).
  Erken açma: App Store aşamalı yayını sürerken açılırsa güncelleme alamayan kullanıcı kilitlenir — açma.

## G. Geri dönüş (rollback) planı
| Sorun | İlk hamle | Sonra |
|---|---|---|
| Yeni özellik hatası | İlgili bayrak `enabled=false` (anında, sonraki bayrak okumasında) | düzeltme OTA'sı (onay) |
| JS hatası tüm 1.1.0'da | `eas update:rollback --channel production` ya da önceki güncelleme grubunu `eas update:republish --group <id>` (onay) | ilk OTA'dan önce sorun → gömülü paket zaten son iyi sürüm |
| Native çökme (1.1.0 ikili) | App Store aşamalı yayını duraklat · Play kademeli dağıtımı durdur | 1.1.1 derlemesi; 1.0.7 cihazlar etkilenmez (ayrı runtime) |
| Rıza akışı kilitliyor | `yeni_kabuk` + `yeni_onboarding` kapat → kapı devre dışı (bayrak kapalı parite) | `user_consents` sorunu → rollback dosyası `supabase/rollbacks/20261109210100_g20_s1_user_consents_rollback.sql` (istemci fail-open) |
| AI tarama maliyeti/hatası | `ai_tarama` kapat ya da sunucu kota/acil kapatma (G19-S1) | Anthropic durum sayfası |
| Derin bağlantı yanlış sayfa açıyor | AASA/assetlinks'ten yolu kaldır (web deploy) | iOS CDN 24–48 saat; Android yeniden doğrulama |
| Migration sorunu | ilgili `supabase/rollbacks/*_rollback.sql` (onay) | — |

## H. Canlı DB / edge durumu (9 Kas, salt-okuma)
- **Edge (canlı, ACTIVE):** analyze-ai-scan v9 · moderate-content v4 · send-notification v53 · delete-account v24 · social-upload ·
  reels-upload-url · adisyo-* (reconcile v1 dahil) · paynkolay-* · order-alert · apple-link-token · trendyolgo-* · tosla-* · payment-* ·
  macro-expiry · free-order-complete · env-check. Repoda olup canlıda olmayan: **`notify-order-status`** (kullanımda mı? SORULAR).
  Bu sürüm için yeni edge deploy GEREKMİYOR.
- **DB:** son canlı migration `20261109111533_g19_s3_event_names`; G20-S1 `user_consents` canlıda yok (A4). `feature_flags`,
  `user_feature_unlocks`, `water_daily`, `activity_logs`, `analytics_events`, `ai_scan_*`, `posts`/`follows`/`post_comments` tabloları canlıda.
- `settings.min_supported_version` sütunu kodda okunuyor (`src/lib/appSettings.ts:14`); CANLI_SEMA'da `settings` satırı kesik — sütun varlığı A5 sorgusuyla teyit.
