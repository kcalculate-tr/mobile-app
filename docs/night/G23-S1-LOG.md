# G23-S1 — 1.1.0 yayın dalı: G22 birleştirme + İlter kararları + derlemeye hazırlık (10 Kas)

Dal `release/1.1.0` (taban `night22/sub` @ 71763ae), worktree `.claude/worktrees/g23-s1`.
Deploy YOK, canlı DB yazma YOK, migration UYGULANMADI (yalnız dosya), mağaza/EAS YOK.
Yeni paket: yalnız `expo-system-ui ~6.0.9` (bu oturuma özel izin).

## ÖZET
1. **Birleştirme**: `night22/ux` → `release/1.1.0` (55c8e9c). Tek metin çatışması `dictionaries.ts` (iki tarafın içe aktarımları/anahtarları birlikte tutuldu); Tara, Profil, token dosyaları otomatik birleşti; birleşik dalda bütün testler yeşil.
2. **Canlıyla eşitleme**: abonelik migration dosyası canlı hâle getirildi (Fresh 10 · Balance 50, `unlimited` hep false, `fair_use` yok, `_daily_limit` 2/10/50, bayrak `min_app_version 1.1.0`). Geo tohumları RU/BY'siz (`g22sql/*_f.sql` ile aynı: 107 ülke, 14.327 şehir).
3. **10/50 metinleri**: "Sınırsız AI" metni kalmadı. Hak hapı her kademede "Bugün N/cap" (Balance "Bugün N/50"); hak sheet karoları 2 · 10 · 50; Profil › Abonelik ve sonuç ekranı "Günde 50"; adil kullanım dalı (istemci + sunucu) kalktı.
4. **Paywall şeridi**: İlter'in ikonları `assets/glass/` (camera, mic, barcode, infinity). AI tarama=kamera, Ses=mikrofon, Barkod=barkod, "Barkod ve elle giriş sınırsız"=sonsuz.
5. **Google ürün kimliği**: önek eşlemesi `kcalai_fresh*`→fresh, `kcalai_balance*`→balance. İstemcide satın alma paketi ve plan eşlemesi (`kcalai_fresh:monthly`), RC yetkisi tanınmazsa ürün kimliğinden kademe; webhook zaten önekle eşliyordu (test eklendi).
6. **Fiyat**: ortak `formatMoney(sayı, para birimi)` — TRY "2999 TL" (₺ ve binlik ayraç yok), diğerleri cihazın yerel biçimi ("$59.99", "59,99 €"); RevenueCat `priceString` artık gösterilmiyor.
7. **AI izni v2**: İlter'in TR/EN metni (foto ya da sesli girişin yazıya dökülmüş metni, "Ses kaydedilmez"); eski sürümde verilmiş izin bir kez yeniden sorulur.
8. **Varsayılan kararlar**: eski kabuk limit sheet'i tavanı sunucudan alıyor (yedek 2); şehir satırlarında admin1 (migration + tohum + istemci); TR il listesinde "Çok yakında" yok; Keşfet araması sekmenin içinde katman (sekme çubuğu görünür); "Takip ediliyor"; PublicProfile yükleniyor iskeleti; `expo-system-ui` ile Android koyu tema.
9. **Kontroller**: tsc 0 · hygiene ✓ · unit 1026 (1025 ✓, 1 atlandı) · jest 67 takım / 382 ✓ · deno check 2 fonksiyon ✓ · expo export iOS ✓ / Android ✓ (16 MB) · introspect izin metinleri TR/EN ✓, Always konum yok · UI'da "₺" 0 · native modül yokken Ses/abonelik gizli (test).
10. **Duman testi (md.7) YAPILAMADI**: boş disk 18 GB (< 20 GB kuralı), worktree'de `ios/` yok, UI otomasyon aracı yok. Ayrıntı SORULAR 1.

## Commit tablosu
| Commit | Madde | İçerik |
| --- | --- | --- |
| 55c8e9c | 1 | merge `night22/ux` → `release/1.1.0` (dictionaries.ts çatışması iki taraf korunarak) |
| 7b2a471 | canlı | abonelik migration dosyası canlıyla eşitlendi |
| 2d31358 | 3, 4 | RU/BY'siz tohum + istemci ülke listesi; admin1 migration/rollback/tohum/üretici; şehir satırında admin1; TR il listesinde "Çok yakında" yok; testler |
| 917c81e | 2, 3 | 10/50 metinleri + hak hapı + karolar; paywall ikonları; Google önek eşlemesi; `formatMoney`; `expo-system-ui`; testler |
| e2e5699 | 3 | AI izni metni v2 + sürüm (yeniden sor); testler |
| 2020cc0 | 4 | eski kabuk `ScanLimitSheet` + FinErrLimit tavanı sunucudan (yedek 2); "Pro ile sınırsız" kalktı |
| ead630b | 4 | "Takip ediliyor"; PublicProfile iskeleti; test |
| dd11097 | 4 | Keşfet araması sekmenin içinde; Android geri kapatır; testler |
| 9e1cc9f | 5 | native modül yokken Ses + abonelik gizli, çökme yok (test) |
| ee7f21b | 6 | HIG: arama katmanı VoiceOver için modal |
| (bu) | — | LOG |
| (son) | — | `docs/night/G23-S1-DONE` |

## KARAR
- **Birleştirme**: `dictionaries.ts`'de iki taraf da yalnız ekleme yapmıştı → hepsi tutuldu. Otomatik birleşen ScanScreen/Profil/tokens dosyaları anlamca denetlendi: ux'in ×1,1 hareket bandı sub'ın yeni ekranlarına da uygulandı (`noLocalMotionTokens` geçiyor), sekme çubuğu ve abonelik satırları birlikte duruyor.
- **Migration dosyası**: canlı tanımlar okunamadı (Supabase MCP okuması otomatik izin sınıflandırıcısı tarafından reddedildi) → dosya, görev dosyasındaki canlı tarifine göre düzenlendi. `app_settings` eklemesi `on conflict do nothing` kaldı (canlıda değerler zaten 10/50).
- **Paywall şeridi metinleri**: İlter "Barkod ve elle giriş sınırsız" = ∞ dedi; şeritte ayrıca Barkod (barkod ikonu) satırı var. İki kez "barkod sınırsız" yazmamak için barkod satırı "Barkodla ekle / paketli ürünü tara, besin değerleri anında gelsin" oldu; sınırsızlık ∞ satırında. Ses satırı her iki planda "Sesle ekle — fotoğrafla aynı günlük hakkı kullanır".
- **Balance'ta hak bitince**: üst plan olmadığından plan önerisi gösterilmez, "yarın yenilenir + barkod/elle" gövdesi.
- **Eski sunucu `unlimited:true`**: limit sayısı varsa hap yine "Bugün N/limit" (AI için "Sınırsız" hâli yok); "Sınırsız" yalnız ücretli barkodda (limit null).
- **Fiyat yerel biçimi**: `Intl.NumberFormat(cihaz yerel ayarı, currency)`. Hermes Intl'i destekliyor; desteklemezse "59.99 USD".
- **AI izni sürümü**: canlı `user_consents` CHECK'i (`user_consents_policy_doc_chk`) ai_photo satırında `doc_version`'a izin vermiyor → yeni migration gerektirmemek için metin sürümü (`AI_PHOTO_TEXT_VERSION = 2`) **cihaz kaydında** tutuluyor; sunucu satırı aynı biçimde yazılıyor. Eski (v1) cihaz izni → bir kez sorulur, kabulde v2 yazılır. Yalnız sunucuda izni olan (yeni cihaz) kullanıcıya da bir kez sorulur (sunucu sürüm bildirmiyor; güvenli taraf). `my_consent_status` ileride `ai_photo_version` döndürürse istemci kullanır (SORULAR 3).
- **İzin başlığı**: metin artık sesi de kapsadığı için "Fotoğraf analizi" → "Fotoğraf ve ses analizi" / "Photo and voice analysis" (sheet + Ayarlar satırı).
- **admin1**: mevcut seed formatını bozmamak için ayrı UPDATE tohumu `supabase/seed/geo_cities_admin1.sql` (14.312 / 14.327 şehir; GeoNames admin1CodesASCII, CC BY 4.0, indirme 10 Kas). `search_cities` dönüş tipi değiştiği için düşürülüp aynı imzayla yeniden kuruluyor; eski istemci ek kolonu yok sayar. İstemcide şehir adının altında ikincil satır, VoiceOver "Springfield, Illinois"; admin1 şehirle aynıysa (Berlin, Berlin) gösterilmez. Üretici: `scripts/geo/build-admin1-seed.mjs`.
- **Keşfet araması**: sekmeden açılınca Keşfet ekranının içinde tam ekran katman (FadeIn `DURATION.fast`, azaltılmış harekette 200 ms); sekme çubuğu kabukta olduğu için görünür kalır. Kişi/gönderi dokunuşu yığına iter, geri dönünce arama açık kalır. Yığından (derin bağlantı/bildirim) açılan Keşfet'te eski `KesfetSearch` rotası aynen.
- **PublicProfile iskeleti**: yalnız yeni kabukta; bayrak kapalı eski kabuk göstergesi AYNEN (1.0.7 eşliği).
- **ScanLimitSheet**: yedek tavan `SCAN_QUOTA_CAP` 3 → 2 (canlı `ai_daily_free`); yalnız sunucu `limit` vermezse kullanılır. Sayısız yedek başlık "Bugünkü AI tarama hakların bitti". Eski kabuktaki "Pro ile sınırsız (çok yakında)" → "kcalAI planları (çok yakında)" (sınırsız AI vaadi kalmasın).
- **Sürüm**: `version 1.1.0`, `runtimeVersion { policy: appVersion }` değişmedi. Eski 1.1.0 TestFlight derlemesine OTA gelirse: `ExpoSpeechRecognition` yok → Ses girişi gizli; `RNPurchases` yok → `initPurchases` false, abonelik bayrağı açık olsa bile girişler gizli (g23NoNative testi).
- Diğer G22 varsayılanları (ses sonucu sağda X, puan metninde virgül, marka bazlı puan, barkod hakkı yalnız bulunan üründe, paylaşım geri alma/gizli görünürlük YOK) değişiklik gerektirmedi — kod zaten böyle.

## CANLIYA UYGULANACAK (yalnız kalan)
1. `supabase/migrations/20261110190100_g23_geo_admin1.sql` → ardından `psql "$DB_URL" -v ON_ERROR_STOP=1 -f supabase/seed/geo_cities_admin1.sql` (önce `geo_cities_f.sql` yüklenmiş olmalı). Doğrulama: `select name, admin1 from public.search_cities('springfield');` → eyalet adlarıyla. Geri alma: `supabase/rollbacks/20261110190100_g23_geo_admin1_rollback.sql`.
2. Edge deploy: `analyze-ai-scan` (metin kipi) ve `revenuecat-webhook` (`--no-verify-jwt`). Webhook kodu bu oturumda yalnız yorum değişti (eşleme zaten önekli).
3. CLAUDE.md kuralı: backend commit'leri (7b2a471, 2d31358'in supabase/ kısmı, 917c81e'nin `supabase/functions/` kısmı) main'e cherry-pick — gece kuralı main'e commit'i yasakladığı için yapılmadı, İlter onayıyla.

## DERLEME KOMUTLARI
Yeni native derleme gerekir (expo-speech-recognition, react-native-purchases, expo-system-ui, yeni izinler). Sürüm 1.1.0 kalır; build numarasını EAS `autoIncrement` verir.
```
# yerel iOS simülatör dev derlemesi (boş disk ≥ 20 GB iken)
cd ~/dev/kcal-mobile/.claude/worktrees/g23-s1
export PATH="/opt/homebrew/opt/node@20/bin:$PATH" DEVELOPER_DIR=/Applications/Xcode-26.app/Contents/Developer
npx expo prebuild --platform ios          # worktree'de ios/ yok
cd ios && xcodebuild -workspace Kcalculate.xcworkspace -scheme Kcalculate -configuration Debug \
  -destination "id=31E99C6C-55F8-48A3-84A8-E382E0481AA5" -allowProvisioningUpdates \
  DEVELOPMENT_TEAM=A63MT69ASR CODE_SIGN_STYLE=Automatic build
# mağaza derlemeleri (İlter onayıyla; onaysız YASAK)
eas build --platform ios --profile production
eas build --platform android --profile production
```
Önkoşullar (İlter): EAS env `EXPO_PUBLIC_REVENUECAT_IOS_KEY` / `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY`; RevenueCat ürünleri — iOS `kcalai_fresh_monthly/yearly`, `kcalai_balance_monthly/yearly`; Play abonelik `kcalai_fresh` / `kcalai_balance` + temel plan `monthly` / `yearly`; yetkiler `fresh`, `balance`; teklif `default`.

## HIG (apple-design-skill, kod denetimi kipi)
Kapsam: CityGateView, PublicProfileScreen, KesfetScreen + SearchScreen, PaywallScreen. Sonuç: **İyi** (Kritik yok).

| Önem | Bulgu | Dayanak | Durum |
| --- | --- | --- | --- |
| Geçti | Şehir satırı `minHeight 52`, iki satır (ad + admin1) metin sarar | `accessibility.md` (44 pt varsayılan) | — |
| Geçti | Şehir VoiceOver etiketi "Ad, Eyalet"; TR il satırı yalnız ad (İzmir "Açık") — artık yanlış "Çok yakında" okunmuyor | `accessibility.md` | — |
| Geçti | PublicProfile yükleniyor: anında iskelet, `progressbar` + "Yükleniyor", nabız azaltılmış harekette sabit | `loading.md › Show something as soon as possible` | — |
| Geçti | Arama Vazgeç `minHeight 44`; geçiş token'la, azaltılmışta 200 ms opaklık; Android geri kapatır | `motion.md › Make motion optional`, `searching.md` ("give it a primary position") | — |
| Orta → düzeltildi | Arama katmanı açıkken VoiceOver alttaki akışa ulaşabiliyordu | `accessibility.md` / VoiceOver odak sırası | `accessibilityViewIsModal` (ee7f21b); sekme çubuğu kardeş olmadığından erişilebilir |
| Geçti | Paywall şerit başlığı ("Barkod ve elle giriş sınırsız") `numberOfLines` yok, sabit yükseklik yok → büyük yazıda sarar | `typography.md` (Dynamic Type) | — |
| Düşük | Paywall şerit sayfası `accessible` tek öğe; başlık + açıklama birlikte okunur (bilinçli) | yargı | — |

## SORULAR
1. **Uçtan uca duman testi (md.7) ve `docs/shots/g23/` kareleri alınmadı.** Nedenler: (a) boş disk oturum başında 21 GB'tı, export ve paket kurulumundan sonra **18 GB** — görevdeki "≥ 20 GB ise" koşulu sağlanmıyor; (b) worktree'de `ios/` yok → `expo prebuild` + `pod install` + tam xcodebuild gerekir (birkaç GB DerivedData); (c) simülatörde dokunuşları sürecek araç (maestro/idb) kurulu değil (yeni paket yasak); (d) giriş için test kullanıcısı Auth Admin API (service key) ister, `.env` okumak yasak. Disk boşaltılınca DERLEME KOMUTLARI ile derleyip akışı elle (veya izinle maestro kurarak) yürütmek gerekir.
2. **Canlı fonksiyon tanımları okunamadı** (MCP salt okuma izni reddedildi). Migration dosyası görev dosyasındaki tarife göre yazıldı; canlıyla birebir karşılaştırma için: `select pg_get_functiondef('public.reserve_ai_scan(text)'::regprocedure);` (+ `_daily_limit`, `my_entitlement`).
3. **AI izni sürümü sunucuda tutulsun mu?** Bugün cihaz kaydında. Sunucuda tutmak için küçük bir migration: CHECK'e `kind = 'ai_photo'` için `doc_version` izni + `my_consent_status` → `ai_photo_version`. Bu olmadan yeni cihazda (sunucuda v2 izni olsa da) bir kez daha sorulur. İstemci alanı zaten okuyor.
4. **İzin metninden not cümlesi düştü**: eski metin "Eklediğin not da fotoğrafla birlikte gönderilir" diyordu; İlter'in yeni metni birebir kullanıldı ve bu cümleyi içermiyor. Not hâlâ fotoğrafla gönderiliyor — hukuken eklenmeli mi?
5. **Gizlilik Politikası** metnine sesli giriş cümlesi (G22-S1'den kalan) — hukuk metni İlter'de.
6. **main'e cherry-pick** (CLAUDE.md backend kuralı) gece kuralı gereği yapılmadı — CANLIYA UYGULANACAK 3.
