# G14-S1 — Görsel eşleşme: uygulama ekranı ↔ Final panosu

## ÖZET (10 satır)
(1) `kcal://dev/screen/<Pano>` vitrini (YALNIZ `__DEV__`): `src/dev/screenCatalog.ts` 125 pano → 249 görsel (Light + Dark) birebir; sahte oturum, sabit bayraklar, tema/dil/Dynamic Type, boş/hata/yükleniyor/çevrimdışı, mock istemciler + ağ taklidi (yazmalar canlıya GİTMEZ).
(2) Üretimde YOK: prod Hermes paketinde vitrin işaretleri 0, dev paketinde 1 (`src/dev/__tests__/vitrinTreeShake.test.ts` 3/3, dist ile).
(3) `scripts/dev/g14-shots.sh` (openurl → bekle → screenshot) + `g14-pair.ts` (referans|uygulama yan yana); 249/249 görüntü alındı (`.claude/night/out/g14/{app,after,pair,pair-after}`).
(4) Karşılaştırma tablosu aşağıda (249 satır, önce → sonra). Hareket panoları (FinMo*) spec panosu; token'lar kodda birebir doğrulandı.
(5) 20 düzeltme / 5 commit: Bricolage başlık fontu hiç yüklenmiyordu (sistematik), FinHomeR3 üst blok, FinPrProfile, FinRules tam sayfa, onboarding iskeleti, boş/hata kartları, eatkcal başlığı, sheet'lerin koyu teması, menü/tanıtım renkleri, yeni kabukta ana sayfa koyu zemini.
(6) Kontrol: tsc 0 · test:unit 528/528 · test:components 90/90 (snapshot 1/1) · bayrak kapalı parite (Tracker flagOff snapshot aynı, `ekV2` boş, KİMSE diff BOŞ) · `expo export --platform ios` ✓ (9.23 MB).
(7) KİMSE dosyalarına (sipariş/ödeme/adres mantığı) dokunulmadı; FinPrCards (SavedCards) KİMSE olduğu için yalnız karşılaştırıldı.
(8) Kalan büyük farkların çoğu: (a) Final'de olup uygulamada henüz olmayan ekran/durumlar, (b) vitrinin açamadığı ara durumlar (ödeme, sheet adımları, kaydırma) — "Kalan farklar".
(9) Dal `night14/visual` (taban `night13/release` `a73f622`), worktree `.claude/worktrees/g14-s1`; ayrı simülatör "G14 iPhone" (iOS 26.5). Yeni paket / migration / eas / canlı DB yazma YOK. SORULAR: 3 madde.
(10) Son commit GERÇEK dosya `docs/night/G14-S1-DONE`.

## Vitrin — kullanım
```
# 1) Ayrı simülatör (bir kez)
xcrun simctl create "G14 iPhone" "iPhone 17 Pro" com.apple.CoreSimulator.SimRuntime.iOS-26-5
# 2) Dev client: worktree'de `npx expo prebuild --platform ios` + xcodebuild (ayrı -derivedDataPath,
#    CODE_SIGNING_ALLOWED=NO) + `xcrun simctl install`; Metro: `npx expo start --dev-client --port 8090`
# 3) Tek pano / hepsi
xcrun simctl openurl <udid> kcal://dev/screen/FinEkCart-Dark
scripts/dev/g14-shots.sh                      # bütün katalog → .claude/night/out/g14/app
scripts/dev/g14-shots.sh FinHomeR3 FinFeed    # seçili panolar
G14_SET=after npx tsx scripts/dev/g14-pair.ts # referans|uygulama çiftleri
```
Notlar:
- iOS 26'da `simctl openurl` her seferinde "… ile Açılsın mı?" soruyor → betik Simulator'ı öne alıp Return'e basıyor (Erişilebilirlik izni; `G14_NO_PROMPT=1` ile kapatılır).
- Panolar arası geçişte JS baştan yüklenir (`DevSettings.reload`, bekleyen pano AsyncStorage'da): Tabs → Onboarding geçişinde StackRouter `stale` hatası ve kırmızı kutu sonraki görüntüleri bozuyordu.
- Pano başına hata sınırı: bir sahne çökerse görüntüde "Vitrin: <Pano> çöktü" yazar, sonrakiler etkilenmez.
- Ağ taklidi: Supabase'e GET dışı her istek (yazma/rpc/auth) sahte yanıtla kesilir; eşleşmeyen GET'ler (herkese açık menü) gerçek okuma. Sahte kullanıcı UUID `…a14e` (RLS ile kullanıcıya özel okumalar boş döner).
- `.gitignore`: `src/dev/` (yerel "Demo Scroll" aracı) → `src/dev/*` + vitrin dosyaları için `!` istisnaları.

## Düzeltmeler (20) — commit
| # | Pano(lar) | Düzeltme | Dosya | Commit |
|---|---|---|---|---|
| 1 | tüm yeni ekranlar | Bricolage Grotesque hiç yüklenmiyordu (başlıklar sistem fontuna düşüyordu) → `App.tsx` useFonts'a eklendi; bayrak kapalı ekranlar bu aileyi kullanmıyor | `App.tsx`, `core/design/fonts.ts` | `008f50f` |
| 2 | FinRules | 3 maddelik sheet → Final tam sayfa (paylaşabileceklerin / yayınlamadıklarımız / otomatik kontrol notu); kabul/vazgeç mantığı aynı | `kesfet/ui/RulesSheet.tsx`, dictionaries | `008f50f` |
| 3 | FinPrProfile | başlık durum çubuğunun altına giriyordu → üst güvenli alan | `FinPrProfileScreen.tsx` | `008f50f` |
| 4 | FinPrProfile | 76 baş harf avatarı, açık/gizli hesap çipi, beyaz sayaç kartı; "Macro aboneliğim"/"Hesap gizliliği" satırları kaldırıldı (Final'de yok) | `ProfileSocialHeader.tsx` | `008f50f` |
| 5 | FinPrProfile | Hedefim halka kartı + "Hedefi düzenle"; Ayarlar'a Dil; Destek'e "Nerelere teslimat yapıyoruz?" (EkInfoSheet); Çıkış ikincil düğme | `FinPrProfileScreen.tsx`, icons, dictionaries | `008f50f` |
| 6 | FinHomeR3/EN/Empty/Delivered/Log*/Tracker | yeni kabukta eski logo/Geçmiş/Özet-Grafik/tarih hapları yerine "Günaydın, <ad>" + zil (saate göre selamlama) | `TrackerScreen.tsx`, `tracker/TrackerDayHeader.tsx` | `1390e86` |
| 7 | aynı | tek büyük halka yerine Enerji halkası (yüzde + kalan kcal) + Protein halkası + P·K·Y mini çipleri (Su verisi yok → Su halkası gösterilmez) | `tracker/TrackerDayHeader.tsx` | `1390e86` |
| 8 | aynı | gün halkası şeridi Final sırasında öğünlerin altında | `TrackerScreen.tsx`, `TrackerDayHeader.tsx` | `1390e86` |
| 9 | FinEkCartEmpty, FinEkAddressesEmpty | boş kart: ikon dairesi 48, tam genişlik siyah 52 düğme, radius 20, kenarlıksız | `core/design/components/EmptyErrorCard.tsx`, Ek ekranları | `1390e86` |
| 10 | FinEkCart/Checkout/Addresses/Orders | alt sayfa başlığı: `<` + ORTALI başlık | `eatkcal/v2/ui/kit.tsx` | `1390e86` |
| 11 | FinEkErrors | hata kartı: ortalı ikon + Bricolage 20 + siyah kurtarma düğmesi (kırmızı ünlem + yeşil link yerine) | `eatkcal/v2/ui/ErrorCard.tsx` | `1390e86` |
| 12 | FinSheetNotify | birincil siyah "İzin ver" + çerçeveli "Şimdi değil" | `celebrate/NotifyPermissionSheet.tsx` | `1390e86` |
| 13 | FinPostMenu | Engelle satırı mürekkep (kırmızı değil), Şikayet bayrağı çizgi ikon | `kesfet/ui/PostMenu.tsx`, `kesfet/ui/icons.tsx` | `1390e86` |
| 14 | FinOnb* | sert iç içe daireler ("dev yeşil daire") → yumuşak radyal lime ışık; cam nesne W×0.66 (önce ekrandan taşıyordu) | `onboarding/components/OnbScaffold.tsx` | `2b57c9e` |
| 15 | FinOnbWelcome/Intent/Notify/Account | üstte 4 adımlı sayfa noktaları | `OnbScaffold.tsx`, `OnboardingNavigator.tsx` | `2b57c9e` |
| 16 | FinOnb* | metin+düğmeler yarı saydam kartta (28 köşe); marka kartın üstünde; ikincil düğme dolu koyu hap | `OnboardingNavigator.tsx`, `components/pieces.tsx` | `2b57c9e` |
| 17 | FinIntro, FinIntroOrder | lime nokta yerine özellik ikonları; birincil siyah, ikincil çerçeveli | `onboarding/intro/IntroOverlay.tsx` | `0fafa84` |
| 18 | FinErrLimit-Dark | sabit beyaz renkler → tema (koyu temada beyaz sheet) | `ai/scan/ui/ScanLimitSheet.tsx` | `0fafa84` |
| 19 | FinPrivacy-Dark | eski BottomSheet beyaz kalıyordu, başlıklar okunmuyordu → yüzey/tutamak/radyo temadan | `profil/ui/PrivacySheet.tsx` | `0fafa84` |
| 20 | FinHomeR3-Dark ve Tracker tabanlı tüm -Dark panolar | yeni kabukta Tracker zemini sabit açık griydi (temalı metinler koyu temada okunmuyordu) → zemin temadan; bayrak kapalıyken stil nesnesi aynı | `screens/TrackerScreen.tsx` | `2e0d045` |

Vitrin altyapısı commit'leri: `4bace0b` (vitrin + katalog + betikler), `7c13ecb` (geçişte JS yeniden yükleme, LogBox, kimlik mock).

## Hareket — token kontrolü (FinMo*: yalnız son kare + zamanlama kodda)
| Final (FinMoTokens/FinMoMap) | Kod | Sonuç |
|---|---|---|
| instant 100 · fast 200 · base 300 · slow 500 · story 900 | `src/constants/motion.ts` DURATION `instant 100, fast 200, base 300, slow 500, pulse 900` (story takma adı) | aynı |
| Yay AI 260/24 · eatkcal 200/28 · bouncy 220/14 | `src/core/design/motion.tsx` SPRING `ai 260/24, eat 200/28, bouncy 220/14, sheet 260/24` | aynı |
| Eğriler · base 300 (çıkış fast 200) | EASING `standard/enter/exit/move` bezier; çıkış `fast` | aynı |
| süzülme döngüsü 3200 ms | TIMING `float 3200`; `dailyRing 900` (story), `logTrail 500` (slow), `glow 2400` | aynı |
FinMo* panoları çok kareli spec panosu; uygulamada tek ekran karşılığı yok → tabloda "ekran yok (spec)". Son karelerin ekran karşılıkları ilgili satırlarda (FinMoRing → FinHomeR3, FinMoSheet → FinAddSheet, FinMoCart → FinEkProduct, FinMoPay → FinEkCheckoutPayWait, FinMoGlass → FinCelebrate…).

## Kontrol (son durum, `2e0d045` üzerinde)
| Kontrol | Sonuç |
|---|---|
| `npx tsc --noEmit` | 0 hata |
| `npm run test:unit` | 528/528 geçti (vitrin katalog + tree-shake testleri dahil; `dist/` ile paket testi de koştu) |
| `npm run test:components` | 90/90, 21 süit, snapshot 1/1 |
| Bayrak kapalı parite | `TrackerScreen.flagOff` snapshot DEĞİŞMEDEN geçti; `ekV2` rota tablosu testi 5/5 (`yeni_siparis` kapalı → boş); KİMSE dosyaları `git diff night13/release` ve `git diff night10/release` → BOŞ |
| `npx expo export --platform ios` | geçti; Hermes paketi 9.23 MB (G13-S3: 9.16 MB) |
| Vitrin üretimde yok | prod paketinde `Vitrin: sahne yok` / `vitrin hata` / `Vitrin: bilinmeyen pano` / `g14-vitrin-pending` = 0; `--dev` paketinde her biri 1 |
| Bayrak kapalıyken değişen yüzey | yalnız açılışta Bricolage font yüklemesi (görünüm aynı: bayrak kapalı ekranlar bu aileyi kullanmıyor); `linking.ts` filtresine `dev/screen/` (eşleşen URL yok sayılır) |

## Karşılaştırma tablosu
Yöntem: her pano için Final görseli (sol) ile uygulama görüntüsü (sağ) yan yana (`pair/`, `pair-after/`) incelendi (4+3 paralel görsel inceleme; Read ile). "Önce" = 3. tam tur (vitrin kararlı hâli, düzeltmelerden önce); "Sonra" = düzeltmeler sonrası `after/` turu + düzeltilen panoların yeniden incelemesi ("(değişmedi)" = düzeltmeden etkilenmeyen pano, ilk değerlendirme geçerli).
Dağılım (249): önce aynı 1 · küçük fark 44 · büyük fark 168 · ekran yok 36 → sonra aynı 2 · küçük fark 46 · büyük fark 159 · ekran yok 42 (sonrada 6 pano "ekran yok"a yeniden sınıflandı: mock verisi olmayan liste ekranları ve spec panoları). Not: "büyük fark"ın önemli bir kısmı Final'de olup uygulamada henüz olmayan bölümler ya da vitrinin açamadığı ara durumlar (bkz. Kalan farklar #8).

| Pano | Önce | Sonra | Farklar (sonra; kalan) |
|---|---|---|---|
| FinTabBar-rest | ekran yok | ekran yok (değişmedi) | spec panosu (sekme çubuğu durumları) |
| FinTabBar-rest-Dark | büyük fark | ekran yok | spec panosu; sekme çubuğu koyu temada benzer |
| FinTabBar-mid | ekran yok | ekran yok (değişmedi) | spec panosu |
| FinTabBar-mid-Dark | büyük fark | ekran yok | spec panosu |
| FinTabBar-min | ekran yok | ekran yok (değişmedi) | spec panosu |
| FinTabBar-min-Dark | büyük fark | ekran yok | spec panosu |
| FinOnbWelcome | büyük fark | büyük fark | (renk) onboarding yalnız koyu, Final açık; kart küçük/aşağıda |
| FinOnbWelcome-Dark | büyük fark | küçük fark | kart biraz küçük/dar, başlık hafif küçük |
| FinOnbIntent | büyük fark | büyük fark | (renk) yalnız koyu; geri oku, ayak görseli, kart, seçili lime seçenek+tik, "Devam et" yok |
| FinOnbIntent-Dark | büyük fark | büyük fark | geri oku, ayak görseli, kart, seçili lime seçenek+tik, "3 kısa soru" notu, "Devam et" yok |
| FinOnbAccount | büyük fark | büyük fark | (renk) yalnız koyu; damla büyük; Apple düğmesi beyaz (siyah olmalı); geri oku yok |
| FinOnbAccount-Dark | büyük fark | büyük fark | damla büyük; Google düğmesi beyaz (koyu olmalı); geri oku yok |
| FinOnbNotify | büyük fark | büyük fark | (renk) yalnız koyu; alev büyük; düğmeler dikey (yan yana olmalı) |
| FinOnbNotify-Dark | büyük fark | büyük fark | alev büyük; düğmeler dikey, "İzin ver" lime (koyu gri olmalı); geri oku yok |
| FinOnbUnderage | büyük fark | büyük fark | (renk) yalnız koyu; kart, açıklama paragrafı, geri oku yok; birincil lime (siyah olmalı) |
| FinOnbUnderage-Dark | büyük fark | büyük fark | açıklama paragrafı, kart, geri oku yok; birincil lime (beyaz olmalı) |
| FinTbGoal | büyük fark | büyük fark (değişmedi) | kupa görseli, noktalar, geri oku, siyah Devam et yok; seçili kart lime vurgusu/tik yok |
| FinTbGoal-Dark | büyük fark | büyük fark (değişmedi) | (hiyerarşi) kupa maskotu, kart, seçili yeşil seçenek, onay işareti, "Devam et" yok; (renk) gradyan yok |
| FinTbPace | büyük fark | büyük fark (değişmedi) | slider + kg/hafta kartı yerine hap seçenekler; hedef tarih kartı ve alev yok |
| FinTbPace-Dark | büyük fark | büyük fark (değişmedi) | (hiyerarşi) kaydırıcı, kg/hafta kartı, hedef tarih satırı, alev yok; çip seçici var; (renk) buton yeşil |
| FinTbAbout | büyük fark | büyük fark (değişmedi) | tekerlek seçici yerine düz input; damla görseli ve noktalar yok |
| FinTbAbout-Dark | büyük fark | büyük fark (değişmedi) | (hiyerarşi) damla, tekerlek seçiciler yok; düz input'lar; kart yok |
| FinTbActivity | büyük fark | büyük fark (değişmedi) | ayak görseli, geri oku, noktalar, seçili vurgu/tik, siyah Devam et yok |
| FinTbActivity-Dark | büyük fark | büyük fark (değişmedi) | (hiyerarşi) ayak maskotu, seçili yeşil satır+onay, "Devam et" yok; kart/gradyan yok |
| FinTbResult | küçük fark | küçük fark (değişmedi) | makrolar kart yerine düz satır (P/K/Y); "Nasıl hesaplanır?" yeşil, altı çizili değil |
| FinTbResult-Dark | büyük fark | büyük fark (değişmedi) | (hiyerarşi) makrolar kartlarda değil düz satırda; kart yok; (renk) halka ortası koyu sayı okunmuyor; link yeşil |
| FinTbHow | büyük fark | büyük fark (değişmedi) | "Nasıl hesaplanır?" sheet açık değil (vitrin durumu açamıyor) |
| FinTbHow-Dark | büyük fark | büyük fark (değişmedi) | (hiyerarşi) "Nasıl hesaplanır?" sheet açık değil (vitrin durumu açamıyor) |
| FinTbFirst | büyük fark | büyük fark (değişmedi) | kase görseli, ikonlu yeşil daireler, chevron, noktalar yok |
| FinTbFirst-Dark | büyük fark | büyük fark (değişmedi) | (hiyerarşi) kase maskotu, yeşil daire ikonlar, chevron'lar, kart yok; (metin) satır açıklamaları eksik |
| FinHomeR3 | büyük fark | büyük fark | üst blok artık Final düzeninde (selamlama, Enerji/Protein, P·K·Y); kalan: Su halkası (veri yok), porsiyon seçici, eatkcal/Keşfet şeritleri; halkalar büyük |
| FinHomeR3-Dark | büyük fark | küçük fark | (G14 #20 sonrası) koyu zemin + Final üst blok; kalan: Su halkası (veri yok), eatkcal/Keşfet şeritleri, porsiyon seçici; halkalar biraz büyük |
| FinHomeEmptyR1 | büyük fark | büyük fark | Su halkası yok; "İlk öğününü logla" üst düğmesi yok; eatkcal/Keşfet bölümleri yok |
| FinHomeEmptyR1-Dark | büyük fark | büyük fark | (G14 #20 sonrası koyu zemin düzeldi) "İlk öğününü logla", "Bugün henüz boş", eatkcal/Keşfet yok |
| FinHomeDelivered | büyük fark | büyük fark | Su halkası; "Akşam'a loglandı" toast/kase anı, porsiyon seçici yok |
| FinHomeDelivered-Dark | büyük fark | büyük fark | (koyu zemin düzeldi) teslim toast'ı/kase anı, porsiyon seçici, Su halkası yok |
| FinHomeEN | büyük fark | büyük fark | düzen Final'e yakın; Su halkası, porsiyon seçici, alt bölümler yok; (metin) yüzde biçimi TR (%50) |
| FinHomeEN-Dark | büyük fark | küçük fark | (G14 #20 sonrası) koyu zemin + EN üst blok; kalan: Su halkası, alt bölümler |
| FinHomeXL | büyük fark | büyük fark | en büyük yazıda metin/tab etiketleri kırpılıyor; alt bölümler yok |
| FinHomeXL-Dark | büyük fark | küçük fark | en büyük yazıda metin/tab etiketleri kırpılıyor; Su halkası yok |
| FinHomeLogBefore | büyük fark | büyük fark | "Loglama anı" spec etiketi, Su halkası, porsiyon seçici, Akşam damla işareti yok |
| FinHomeLogBefore-Dark | büyük fark | büyük fark | (koyu zemin düzeldi) Su halkası, porsiyon/Kaldır satırı, damla işareti yok; makro çipleri kart biçiminde |
| FinHomeLogFlow | büyük fark | büyük fark (değişmedi) | (hiyerarşi) halka/makro bölümü yok |
| FinHomeLogFlow-Dark | büyük fark | büyük fark | (koyu zemin düzeldi) Su halkası, porsiyon satırı, akış çizgisi anı yok |
| FinHomeLogMerged | büyük fark | büyük fark (değişmedi) | (hiyerarşi) birleşmiş halka düzeni yok |
| FinHomeLogMerged-Dark | büyük fark | büyük fark | (koyu zemin düzeldi) Su halkası, porsiyon satırı yok; makro çipleri kart biçiminde |
| FinFeed | küçük fark | küçük fark (değişmedi) | gönderi içeriği mock (foto/makro tablosu yok); başlıkta fazladan +, rozetli zil |
| FinFeed-Dark | küçük fark | küçük fark (değişmedi) | (hiyerarşi) gönderide foto/besin tablosu/etiket yok (mock görsel); fazladan + ikonu; (ikon) Keşfet ikonu |
| FinFeedScrollR3 | büyük fark | büyük fark (değişmedi) | kaydırılmış tam ekran gönderi durumu yok (vitrin kaydıramıyor) |
| FinFeedScrollR3-Dark | büyük fark | büyük fark (değişmedi) | (hiyerarşi) kaydırılmış video gönderi + kompakt çubuk yok; akış başında (vitrin kaydıramıyor) |
| FinFeedTip | büyük fark | büyük fark (değişmedi) | siyah ipucu balonu yerine üst bilgi şeridi |
| FinFeedTip-Dark | büyük fark | büyük fark (değişmedi) | (hiyerarşi) balon ipucu yerine üstte bilgi bandı; (ikon) Keşfet ikonu |
| FinFollowingEmpty | büyük fark | büyük fark (değişmedi) | Takip sekmesi boş durumu ve önerilen hesaplar yok; Sana Özel seçili |
| FinFollowingEmpty-Dark | büyük fark | büyük fark (değişmedi) | (hiyerarşi) Takip sekmesi aktif değil; önerilen hesaplar yok |
| FinDetail | büyük fark | büyük fark (değişmedi) | "Gönderi" üst çubuğu, büyük foto, yorum listesi, "Yanıtını yaz" yok; (metin) "'ye logla" kesik |
| FinDetail-Dark | büyük fark | büyük fark (değişmedi) | (hiyerarşi) Gönderi başlığı, istatistikler, yorum listesi, yanıt alanı yok; (metin) buton kesik "'ye logla" |
| FinSerbest | büyük fark | büyük fark (değişmedi) | serbest gönderi akışı yerine öğün kartlı gönderi (mock veri) |
| FinSerbest-Dark | büyük fark | büyük fark (değişmedi) | (hiyerarşi) serbest gönderi yerine öğün kartlı gönderi, görsel ızgara yok (mock veri) |
| FinActivityCard | büyük fark | büyük fark (değişmedi) | Ben de yaptım sheet'i ve toast yok; tek küçük etkinlik kartı |
| FinActivityCard-Dark | büyük fark | büyük fark (değişmedi) | (hiyerarşi) Ben de yaptım/süre sayfası/toast yok; yalnız küçük etkinlik kartı; (renk) ikon kutusu yeşil |
| FinVideo | büyük fark | büyük fark (değişmedi) | video gönderisi/tam ekran oynatıcı yok (mock'ta video yok) |
| FinVideo-Dark | büyük fark | büyük fark (değişmedi) | (hiyerarşi) video gönderi/tam ekran oynatıcı yok (mock'ta video yok) |
| FinCompose | büyük fark | büyük fark (değişmedi) | 3 sekmeli Paylaş ekranı farklı; etkinlik ızgarası yok |
| FinCompose-Dark | büyük fark | büyük fark (değişmedi) | (hiyerarşi) Serbest/Öğün/Etkinlik sahneleri uyumsuz; etkinlik ızgarası, Fotoğraf/Video çubuğu, kural notu yok |
| FinPosting | büyük fark | büyük fark (değişmedi) | paylaşılıyor/inceleniyor/yayında/reddedildi durumları yok |
| FinPosting-Dark | büyük fark | büyük fark (değişmedi) | (hiyerarşi) paylaşılıyor/inceleniyor/yayında/reddedildi durumları yok (vitrin durumu açamıyor) |
| FinRules | küçük fark | küçük fark | ölçü/aralık biraz büyük; yasak satır başlıkları yeterince kalın değil; not kartı sabit düğmenin arkasında |
| FinRules-Dark | küçük fark | küçük fark | başlık satırları kalın değil; not kartı düğme arkasında; "Anladım, paylaş" eklenmiş (kabul mantığı) |
| FinComments | büyük fark | büyük fark (değişmedi) | tek yorum; Şikayet/Engelle ve boş durum kareleri yok; gönder düğmesi siyah daire değil |
| FinComments-Dark | büyük fark | büyük fark (değişmedi) | (hiyerarşi) tek yorum; yanıt/silme akışı, Şikayet/Engelle menüsü yok; gönder butonu farklı |
| FinNotifications | büyük fark | büyük fark (değişmedi) | tam sayfa (Takip istekleri/Bugün/Bu hafta) yerine sheet, sade liste |
| FinNotifications-Dark | büyük fark | büyük fark (değişmedi) | (hiyerarşi) bölümler (Takip istekleri/Bugün/Bu hafta), okunmamış noktası, Onayla/Sil yok |
| FinAddSheet | büyük fark | büyük fark (değişmedi) | öğün loglama sheet'i görünmüyor (mock gönderide meal yok) |
| FinAddSheet-Dark | büyük fark | büyük fark (değişmedi) | (hiyerarşi) öğün/porsiyon sheet'i görünmüyor (mock gönderide meal yok) |
| FinAddToast | küçük fark | küçük fark (değişmedi) | toast'ta Geri al/Gör düğmeleri yok |
| FinAddToast-Dark | büyük fark | büyük fark (değişmedi) | (hiyerarşi) toast'ta Geri al/Gör yok; arkada akış/tab bar yok |
| FinPostMenu | küçük fark | küçük fark | menü satırları arasında ayırıcı yok |
| FinPostMenu-Dark | küçük fark | küçük fark | menü satırları arasında ayırıcı yok |
| FinPostMenuBlock | büyük fark | büyük fark (değişmedi) | engelleme onay sheet'i açılamıyor (vitrin adımı) |
| FinPostMenuBlock-Dark | büyük fark | büyük fark (değişmedi) | (hiyerarşi) engelleme onay sheet'i açık değil (vitrin adımı açamıyor) |
| FinReport | büyük fark | büyük fark (değişmedi) | şikayet formu adımı açılamıyor |
| FinReport-Dark | ekran yok | ekran yok (değişmedi) | Şikayet formu adımı açılamıyor; menü görünüyor |
| FinReportDone | büyük fark | büyük fark (değişmedi) | teşekkürler adımı açılamıyor |
| FinReportDone-Dark | ekran yok | ekran yok (değişmedi) | "Teşekkürler" adımı açılamıyor; menü görünüyor |
| FinReportNotice | büyük fark | büyük fark (değişmedi) | inceleme sonucu kartı açılamıyor |
| FinReportNotice-Dark | ekran yok | ekran yok (değişmedi) | Şikayet sonucu bildirimi açılamıyor; menü görünüyor |
| FinGunView | büyük fark | büyük fark (değişmedi) | tam ekran foto yok (mock), "Öğle 2/3" yerine kendi hikâyesi |
| FinGunView-Dark | büyük fark | büyük fark (değişmedi) | (hiyerarşi) foto, başlık, Öğle 2/3, "Öğle'ye logla" kartı yok; (renk) gri zemin (mock foto yok) |
| FinGunEnd | büyük fark | büyük fark (değişmedi) | Günün özeti slaytı açılamıyor |
| FinGunEnd-Dark | büyük fark | büyük fark (değişmedi) | (hiyerarşi) Günün özeti slaytı açılamıyor; öğün kartı |
| FinGunDone | büyük fark | büyük fark (değişmedi) | Gün tamamlandı slaytı açılamıyor |
| FinGunDone-Dark | büyük fark | büyük fark (değişmedi) | (hiyerarşi) "Gün tamamlandı" slaytı açılamıyor |
| FinGunEmpty | küçük fark | küçük fark (değişmedi) | (ikon) kase yerine kişi; düğmeler ortada; "Günüm" başlığı yok |
| FinGunEmpty-Dark | küçük fark | küçük fark (değişmedi) | (ikon) kase yerine kişi ikonu; (hiyerarşi) "Günüm" başlığı ve X yok; (ölçü) butonlar ortada |
| FinTracker | büyük fark | büyük fark | Final: kalori halkası + "Bugünkü etkinlikler" listesi (Koşu/Yoga); mock'ta etkinlik kaydı yok |
| FinTracker-Dark | büyük fark | büyük fark | (G14 #20 sonrası koyu zemin) etkinlik listesi yok (mock) |
| FinTrackerEmpty | büyük fark | büyük fark | ayak görselli boş etkinlik alanı yok |
| FinTrackerEmpty-Dark | büyük fark | büyük fark | Yenen/Etkinlik/Hedef özeti, boş etkinlik alanı + ayak görseli yok |
| FinStreak | büyük fark | büyük fark (değişmedi) | seri rozetleri ve Gün tamamlandı ekranı yok |
| FinStreak-Dark | büyük fark | büyük fark (değişmedi) | (hiyerarşi) seri rozetleri ve Gün tamamlandı ekranı yok |
| FinScanR2 | büyük fark | büyük fark (değişmedi) | (renk) koyu kamera; alt mod çubuğu, yeşil deklanşör, flaş, hak etiketi yok |
| FinScanR2-Dark | büyük fark | büyük fark (değişmedi) | (hiyerarşi) tarama hakkı hapı, flaş, alt mod çubuğu, yeşil deklanşör yok; mod sekmeleri üstte |
| FinPhotoR1 | büyük fark | büyük fark (değişmedi) | foto üstte + makro sheet yerine düz kart listesi |
| FinPhotoR1-Dark | büyük fark | büyük fark (değişmedi) | (hiyerarşi) fotoğraf önizleme, makrolar, Planıma ekle yok; öğe kartları farklı |
| FinPhotoEN | büyük fark | büyük fark (değişmedi) | aynı yapısal fark; besin adları TR (mock) |
| FinPhotoEN-Dark | büyük fark | büyük fark (değişmedi) | (hiyerarşi) önizleme, makro halkalar yok; (metin) kısmi İngilizce |
| FinScanError | büyük fark | büyük fark (değişmedi) | "Kameraya erişim kapalı" yerine limit içeriği (eşleme) |
| FinScanError-Dark | büyük fark | büyük fark (değişmedi) | (hiyerarşi) "Kameraya erişim kapalı" yerine başka hata; Ayarlar'ı aç/Galeriden seç yok |
| FinErrFailed | küçük fark | küçük fark (değişmedi) | (ikon) yenile; "Fotoğrafın saklandı" hapı sheet içinde; hak notu tiksiz |
| FinErrFailed-Dark | küçük fark | küçük fark (değişmedi) | (ikon) ünlem yerine yenile ikonu; kamera önizlemesi yok; hak bilgisi çip değil metin |
| FinErrOffline | küçük fark | küçük fark (değişmedi) | "Çevrimdışı" hapı sheet içinde; bilgi notu tiksiz |
| FinErrOffline-Dark | küçük fark | küçük fark (değişmedi) | (hiyerarşi) önizleme, X, Çevrimdışı hap konumu; "Bağlanınca loglanacak" çip değil metin |
| FinErrLimit | küçük fark | küçük fark | üstte X ve "Bugün 0/3" hapı yok; saat ikonu farklı; Pro düğmesi kilitli |
| FinErrLimit-Dark | büyük fark | küçük fark | koyu tema düzeldi; üstte X ve hak hapı yok; ikon farklı |
| FinScanOffline | büyük fark | ekran yok | çevrimdışı tarama ekranı (uyarı + bekleyen foto + Elle gir) yok; ana sayfa açılıyor |
| FinPrProfile | küçük fark | küçük fark | sayaç kartı yok (vitrin: get_public_profile mock'u yok); Koleksiyon "6/120" ve Macro sayacı veri yok; ölçek büyük |
| FinPrProfile-Dark | küçük fark | küçük fark | sayaç kartı yok (veri); Kayıtlı kartlarım satırı (özellik kapalı); ölçek büyük |
| FinProfilePublic | büyük fark | büyük fark (değişmedi) | kapak, Takip et, halka, Tabaklar/Gönderiler ızgarası yok |
| FinProfilePublic-Dark | büyük fark | büyük fark (değişmedi) | (hiyerarşi) kapak, bio, Takip et, halka, Tabaklar/Gönderiler sekmeleri, ızgara yok |
| FinBadges | büyük fark | büyük fark (değişmedi) | doğrulama rozetleri listesi yok; boş durum |
| FinBadges-Dark | büyük fark | büyük fark (değişmedi) | (hiyerarşi) doğrulama rozetleri listesi yok; boş durum kartı |
| FinPrivacy | büyük fark | büyük fark | başlık ortalı/küçük (sola dayalı büyük olmalı); globe/kilit ikonları yok; radyo yerine dolu tik; ayırıcılar farklı |
| FinPrivacy-Dark | büyük fark | büyük fark | renkler artık koyu temada okunur; başlık ortalı; ikonlar yok; radyo yerine tik; sheet koyu gri (tasarım siyah) |
| FinPrivacySettings | büyük fark | büyük fark (değişmedi) | başlık ortalı; yeşil onay; (metin) "Profilini kim görebilir"; Hesabı sil kırmızı |
| FinPrivacySettings-Dark | küçük fark | küçük fark (değişmedi) | (hiyerarşi) Engellenenler satırında ikon/açıklama yok; (renk) seçili işaret yeşil; (metin) başlık farklı |
| FinPrProgress | büyük fark | büyük fark (değişmedi) | grafik/hedef uyumu/makro kartları yok (veri yok → boş durum) |
| FinPrProgress-Dark | büyük fark | büyük fark (değişmedi) | (hiyerarşi) kalori bar grafiği, hedef uyumu/makro kartları yok, boş durum kartı (veri yok) |
| FinPrMacro | küçük fark | küçük fark (değişmedi) | bakiye kartı ortalı, nokta göstergesi yok; ödül/geçmiş yerine boş durum |
| FinPrMacro-Dark | büyük fark | büyük fark (değişmedi) | (hiyerarşi) bakiye kartı noktaları/ikon yok; ödül kartları ve geçmiş yerine boş durum (veri yok) |
| FinPrMacroWhat | büyük fark | büyük fark (değişmedi) | "Macro nedir?" sheet açılamıyor |
| FinPrMacroWhat-Dark | büyük fark | büyük fark (değişmedi) | (hiyerarşi) "Macro nedir?" sheet açık değil (vitrin durumu açamıyor) |
| FinPrMacroHistoryEmpty | büyük fark | büyük fark (değişmedi) | ayrı "Macro geçmişi" ekranı yok |
| FinPrMacroHistoryEmpty-Dark | büyük fark | büyük fark (değişmedi) | (hiyerarşi) ayrı "Macro geçmişi" ekranı yok; (ikon) jeton yerine hediye |
| FinPrPersonal | büyük fark | büyük fark (değişmedi) | avatar ortada + kamera rozeti; alanlar beyaz; (metin) "Değişiklikleri kaydet" |
| FinPrPersonal-Dark | büyük fark | büyük fark (değişmedi) | (hiyerarşi) avatar ortalı+kamera rozeti (tasarımda solda); alanlar kart içinde; (metin) "Değişiklikleri kaydet" |
| FinPrCards | büyük fark | büyük fark (değişmedi) | KİMSE ekranı (SavedCards) — eski tasarım; dokunulmadı |
| FinPrCards-Dark | büyük fark | büyük fark (değişmedi) | (renk) açık tema (KİMSE ekranı); (hiyerarşi) kart listesi/Yeni kart/PaynKolay notu yok |
| FinPrNotify | büyük fark | büyük fark (değişmedi) | satır ikonları yok; lime toggle; satır adları farklı |
| FinPrNotify-Dark | büyük fark | büyük fark (değişmedi) | (hiyerarşi) ikonlu 4 satır (Seri, Sipariş durumu, Sosyal, Kampanyalar) yerine farklı kategoriler |
| FinPrSecurity | büyük fark | büyük fark (değişmedi) | fazladan başlık kartı; lime "Şifre değiştir"; (metin) "En az 6 karakter" |
| FinPrSecurity-Dark | büyük fark | büyük fark (değişmedi) | (hiyerarşi) fazladan başlık kartı, lime Şifre değiştir, Hesabı sil kartı; (metin) "En az 6 karakter" |
| FinPrAgreements | büyük fark | büyük fark (değişmedi) | sekme çipleri yok |
| FinPrAgreements-Dark | büyük fark | büyük fark (değişmedi) | (hiyerarşi) sekme çipleri yok, tek uzun metin kartı; başlık/son güncelleme yok |
| FinPrSupport | küçük fark | küçük fark (değişmedi) | "Bizi ara" beyaz; konu çipleri farklı; Görsel ekle yok |
| FinPrSupport-Dark | küçük fark | küçük fark (değişmedi) | (hiyerarşi) konu çipleri/alanlar kartsız; Görsel ekle yok; (metin) farklı konu çipleri |
| FinPrFeedback | küçük fark | küçük fark (değişmedi) | alt yapışık buton yok; çipler farklı; yıldızlar outline |
| FinPrFeedback-Dark | büyük fark | büyük fark (değişmedi) | (hiyerarşi) konu çipleri kartsız, yıldızlar kutu içinde; Gönder alt çubukta değil |
| FinCityR1 | büyük fark | büyük fark (değişmedi) | fotoğraflı "Nereye getirelim?" yerine şehir listesi |
| FinCityR1-Dark | ekran yok | ekran yok (değişmedi) | Şehrini seç listesi; "Nereye getirelim?" fotoğraf kartlı ekran yok |
| FinWaitlistR1 | büyük fark | büyük fark (değişmedi) | "İstanbul'a geliyoruz" ekranı yok |
| FinWaitlistR1-Dark | ekran yok | ekran yok (değişmedi) | Şehrini seç; "İstanbul'a geliyoruz" bekleme listesi ekranı yok |
| FinEatBerlin | büyük fark | büyük fark (değişmedi) | Berlin restoran listesi ekranı yok |
| FinEatBerlin-Dark | ekran yok | ekran yok (değişmedi) | Şehir seçimi; Berlin restoran listesi ekranı yok |
| FinEkHome | küçük fark | küçük fark (değişmedi) | aktif sipariş kartı yok (veri); başlık ikon sırası farklı; Macro şeridi üstte |
| FinEkHome-Dark | büyük fark | büyük fark (değişmedi) | (hiyerarşi) aktif sipariş kartı yok (veri), Teslimat adresi ekle satırı; kampanya bandı farklı; (ikon) üst ikon sırası |
| FinEkHomeSkeleton | küçük fark | küçük fark (değişmedi) | skeleton blok sayısı/yerleşimi farklı |
| FinEkHomeSkeleton-Dark | küçük fark | küçük fark (değişmedi) | (hiyerarşi) skeleton blokları az ve farklı boyut |
| FinEkStore | büyük fark | büyük fark (değişmedi) | "Bu mağazada ürün yok" (vitrin brandKey) |
| FinEkStore-Dark | büyük fark | büyük fark (değişmedi) | (hiyerarşi) "Bu mağazada ürün yok" boş durumu (vitrin brandKey eşleşmedi) |
| FinEkReviews | büyük fark | büyük fark (değişmedi) | yorumlar sheet'i açılamıyor |
| FinEkReviews-Dark | ekran yok | ekran yok (değişmedi) | Yorumlar sheet'i açılamıyor; boş mağaza |
| FinEkProduct | küçük fark | küçük fark (değişmedi) | makro halkaları 0 (ürün verisi); seçenek grubu adı veri |
| FinEkProduct-Dark | büyük fark | büyük fark (değişmedi) | (hiyerarşi) seçim kartları görünmüyor, makro halkaları 0 (ürün verisi); kapat butonu koyu |
| FinEkProductScroll | büyük fark | büyük fark (değişmedi) | kaydırılmış durum yok (vitrin kaydıramıyor) |
| FinEkProductScroll-Dark | büyük fark | büyük fark (değişmedi) | (hiyerarşi) kaydırılmış durum yok (vitrin kaydıramıyor) |
| FinEkCart | küçük fark | büyük fark | ürün satırında makro rozetleri/seçim özeti yok; özet halkaları ve ücretsiz teslimat çubuğu yok; ölçek büyük |
| FinEkCart-Dark | küçük fark | büyük fark | makro rozetleri, özet halkaları, ücretsiz teslimat çubuğu yok |
| FinEkCartEmpty | küçük fark | küçük fark | kart konumu/ölçü hafif; başlık ağırlığı biraz ince |
| FinEkCartEmpty-Dark | küçük fark | küçük fark | kart/düğme boyu hafif; başlık ağırlığı biraz ince |
| FinEkCartSkeleton | ekran yok | ekran yok (değişmedi) | skeleton yerine dolu sepet |
| FinEkCartSkeleton-Dark | ekran yok | ekran yok (değişmedi) | skeleton yerine dolu sepet (yükleniyor durumu yerel sepeti etkilemiyor) |
| FinEkCheckout | küçük fark | küçük fark | (metin) "Düzenle"→"Değiştir"; "Teslimat ücretsiz" satırı yok; fazladan özet kartı |
| FinEkCheckout-Dark | küçük fark | küçük fark | (metin) "Değiştir"; "Teslimat ücretsiz" satırı yok; fazladan özet kartı |
| FinEkCheckoutPayWait | büyük fark | büyük fark (değişmedi) | "Ödemen onaylanıyor" açılamıyor (gerçek ödeme gerekir) |
| FinEkCheckoutPayWait-Dark | büyük fark | büyük fark (değişmedi) | (hiyerarşi) "Ödemen onaylanıyor" durumu açılamıyor (gerçek ödeme gerekir) |
| FinEkCheckoutPayFail | büyük fark | büyük fark (değişmedi) | "Ödeme alınamadı" açılamıyor |
| FinEkCheckoutPayFail-Dark | büyük fark | büyük fark (değişmedi) | (hiyerarşi) "Ödeme alınamadı" sheet'i açılamıyor |
| FinEkCheckoutPayUnknown | büyük fark | büyük fark (değişmedi) | "Sonucu kontrol ediyoruz" açılamıyor |
| FinEkCheckoutPayUnknown-Dark | büyük fark | büyük fark (değişmedi) | (hiyerarşi) "Sonucu kontrol ediyoruz" sheet'i açılamıyor |
| FinEkAddress | küçük fark | küçük fark (değişmedi) | teslimat lime bandı yok; (metin) sheet başlığı; buton görünmüyor |
| FinEkAddress-Dark | büyük fark | büyük fark (değişmedi) | (renk) harita açık tema; (hiyerarşi) teslimat bandı yok, form alanları farklı |
| FinEkAddressNoPerm | büyük fark | büyük fark (değişmedi) | konum izni kapalı kartı yok |
| FinEkAddressNoPerm-Dark | büyük fark | büyük fark (değişmedi) | (hiyerarşi) konum izni kapalı bandı yok (simülatörde izin durumu) |
| FinEkAddressNoMap | büyük fark | büyük fark (değişmedi) | "Harita yüklenemedi" kartı yok |
| FinEkAddressNoMap-Dark | büyük fark | büyük fark (değişmedi) | (hiyerarşi) "Harita yüklenemedi" kartı yok (harita yüklendi) |
| FinEkAddresses | büyük fark | ekran yok | mock adres yok → boş durum |
| FinEkAddresses-Dark | büyük fark | büyük fark (değişmedi) | (hiyerarşi) adres listesi yerine boş durum (mock adres yok) |
| FinEkAddressesEmpty | küçük fark | küçük fark | kart dikey ortalı değil; başlık ağırlığı ince |
| FinEkAddressesEmpty-Dark | küçük fark | küçük fark | kart dikey ortalı değil; başlık ağırlığı ince |
| FinEkOrders | büyük fark | ekran yok | mock sipariş yok → boş durum |
| FinEkOrders-Dark | büyük fark | büyük fark (değişmedi) | (hiyerarşi) filtre çipleri ve liste yok; boş durum (mock sipariş yok) |
| FinEkOrdersEmpty | aynı | aynı | — |
| FinEkOrdersEmpty-Dark | küçük fark | aynı | — |
| FinEkOrdersFilterEmpty | büyük fark | büyük fark (değişmedi) | filtre çipleri ve "Bu filtrede sipariş yok" yok |
| FinEkOrdersFilterEmpty-Dark | büyük fark | büyük fark (değişmedi) | (hiyerarşi) filtre çipleri ve "Bu filtrede sipariş yok" yok |
| FinEkOrderDetail | ekran yok | ekran yok (değişmedi) | "yüklenemedi" hata durumu (mock sipariş yok) |
| FinEkOrderDetail-Dark | büyük fark | büyük fark (değişmedi) | (hiyerarşi) detay yerine "yüklenemedi" hata kartı (mock sipariş yok) |
| FinEkInfo | büyük fark | büyük fark (değişmedi) | SSS sekmesi, harita, ilçe çipleri yok; Teslimat listesi |
| FinEkInfo-Dark | büyük fark | büyük fark (değişmedi) | (hiyerarşi) Bölgeler sekmesi/harita/ilçe çipleri yok, Teslimat sekmesi açık; arkadaki eatkcal yok |
| FinEkErrors | büyük fark | büyük fark | kart yapısı artık Final (ortalı ikon + siyah düğme); sayfa başlığı/açıklama yok (vitrin sahnesi); kartlar ölçek büyük; ikonlar farklı (bilet/kutu) |
| FinEkErrors-Dark | küçük fark | büyük fark | kart yapısı Final; sayfa başlığı yok (vitrin); ölçek büyük; ikonlar farklı |
| FinSignupAI | büyük fark | büyük fark (değişmedi) | yalnız 1. adım; logo yok; 2./3. adım yok |
| FinSignupAI-Dark | büyük fark | büyük fark (değişmedi) | (hiyerarşi) yalnız 1. adım; logo yok; 2. ve 3. adımlar yok |
| FinSignupEat | büyük fark | büyük fark (değişmedi) | yalnız şehir seçimi; adres/telefon adımları yok |
| FinSignupEat-Dark | ekran yok | ekran yok (değişmedi) | Şehrini seç; Teslimat adresi/Telefon adımları yok |
| FinIntro | büyük fark | küçük fark | başlık küçük + X; gün halkası ikonu noktalı; "Siparişin aynı yerde" kartsız; Sonra çerçeveli |
| FinIntro-Dark | büyük fark | küçük fark | sheet başlığı küçük + X; "Siparişin aynı yerde" kartsız; Sonra çerçeveli |
| FinIntroOrder | büyük fark | büyük fark | (metin) "Siparişe devam/Yenilere göz at" yerine "Göz at/Sonra" (mock'ta geçmiş sipariş yok); başlık küçük + X |
| FinIntroOrder-Dark | büyük fark | büyük fark | (metin) "Siparişe devam/Yenilere göz at" yerine "Göz at/Sonra" (mock'ta geçmiş sipariş yok) |
| FinCelebrate | küçük fark | küçük fark (değişmedi) | alev büyük + hale; Paylaş ikonu farklı; Devam et silik |
| FinCelebrate-Dark | küçük fark | küçük fark (değişmedi) | (ölçü) kart alt başlığı farklı; alev konumu; (ikon) Paylaş ikonu |
| FinCelebStreak3 | küçük fark | küçük fark (değişmedi) | "Nedenin" satırı yok; Paylaş ikonu |
| FinCelebStreak3-Dark | küçük fark | küçük fark (değişmedi) | (hiyerarşi) Neden satırı yok; (ikon) Paylaş ikonu |
| FinCelebStreak7 | küçük fark | küçük fark (değişmedi) | (ikon) alev yerine kupa; "Nedenin" satırı yok |
| FinCelebStreak7-Dark | küçük fark | küçük fark (değişmedi) | (hiyerarşi) Neden satırı yok; "Bir hafta tamam" alt metni yok |
| FinSheetNotify | küçük fark | büyük fark | (metin) başlık farklı (SORULAR #1); ikon lime daire (tasarımda gri); başlık ortalı; arkada ana sayfa yok (vitrin) |
| FinSheetNotify-Dark | büyük fark | büyük fark | (metin) başlık farklı; ikon lime; arkada ana sayfa yok (vitrin) |
| FinCollectCut | büyük fark | büyük fark (değişmedi) | foto sonucu tam ekranı yok |
| FinCollectCut-Dark | büyük fark | büyük fark (değişmedi) | (hiyerarşi) foto sonucu tam ekranı yok; porsiyon listesi |
| FinCollectWon | büyük fark | büyük fark (değişmedi) | bulanık foto zemin yok; kart görseli boş (mock) |
| FinCollectWon-Dark | büyük fark | büyük fark (değişmedi) | (renk) kart beyaz, tasarımda koyu; görsel yok; butonlar küçük yan yana |
| FinCollectGrid | büyük fark | büyük fark (değişmedi) | tabak detayı ekranı yok; ızgara gösteriliyor (eşleme) |
| FinCollectGrid-Dark | ekran yok | ekran yok (değişmedi) | kart detayı yok; koleksiyon ızgarası gösteriliyor (eşleme) |
| FinCollectEntry | büyük fark | büyük fark (değişmedi) | Profil'de Tabak koleksiyonu kartı ve toast yok |
| FinCollectEntry-Dark | büyük fark | büyük fark (değişmedi) | (hiyerarşi) Profil'de Tabak koleksiyonu şeridi ve toast yok |
| FinStressLong | büyük fark | büyük fark (değişmedi) | stres panosu; yalnız sipariş özeti |
| FinStressXL | büyük fark | büyük fark (değişmedi) | (hiyerarşi) spec panosu (özet + porsiyon sheet + toast + tab bar); uygulamada yalnız sipariş özeti, dev metin |
| FinStressEN | büyük fark | büyük fark (değişmedi) | EN stres panosu; yalnız EN sipariş özeti |
| FinStressDark | ekran yok | ekran yok (değişmedi) | durum matrisi panosu; yalnız hata kartları |
| FinComponents | ekran yok | ekran yok (değişmedi) | bileşen kataloğu panosu; uygulamada DesignShowcase girişi |
| FinMoTokens | ekran yok | ekran yok (değişmedi) | spec panosu — token'lar kodda doğrulandı (bkz. Hareket token kontrolü) |
| FinMoMap | ekran yok | ekran yok (değişmedi) | spec panosu — token'lar kodda doğrulandı |
| FinMoLogA | ekran yok | ekran yok (değişmedi) | spec panosu |
| FinMoLogB | ekran yok | ekran yok (değişmedi) | spec panosu |
| FinMoRing | ekran yok | ekran yok (değişmedi) | spec panosu |
| FinMoStreak | ekran yok | ekran yok (değişmedi) | spec panosu |
| FinMoScan | ekran yok | ekran yok (değişmedi) | spec panosu |
| FinMoLike | ekran yok | ekran yok (değişmedi) | spec panosu |
| FinMoLoad | ekran yok | ekran yok (değişmedi) | spec panosu |
| FinMoSheet | ekran yok | ekran yok (değişmedi) | spec panosu |
| FinMoCart | ekran yok | ekran yok (değişmedi) | spec panosu |
| FinMoPay | ekran yok | ekran yok (değişmedi) | spec panosu |
| FinMoDeliver | ekran yok | ekran yok (değişmedi) | spec panosu |
| FinMoShake | ekran yok | ekran yok (değişmedi) | spec panosu |
| FinMoSticker | ekran yok | ekran yok (değişmedi) | spec panosu |
| FinMoCard | ekran yok | ekran yok (değişmedi) | spec panosu |
| FinMoCollection | ekran yok | ekran yok (değişmedi) | spec panosu |
| FinMoLiquid | ekran yok | ekran yok (değişmedi) | spec panosu |
| FinMoGlass | ekran yok | ekran yok (değişmedi) | spec panosu |

## Kalan farklar (öncelik sırasıyla)
1. **Ana sayfa koyu tema**: zemin #20 ile temaya bağlandı (yeni üst blok + öğün yuvaları koyu temada doğru). Kalan: durum çubuğu ikonları koyu temada da koyu (global `StatusBar style="dark"`), öğün ekleme modalı gibi eski `COLORS` bölümleri açık.
2. **Ana sayfa alt bölümleri**: eatkcal yatay şeridi ve Keşfet video şeridi (FinHomeR3/XL) uygulamada yok; Su halkası için veri yok; "Akşam'a logla" ayrık düğme + porsiyon seçici satır içi düzen farklı.
3. **Onboarding / Takibe başla Light varyantları**: ekranlar yalnız koyu (ONB sabitleri); Final'de açık versiyonlar var. Takibe başla: kupa/ayak/damla görselleri, seçili kart lime vurgusu + tik, slider (FinTbPace), tekerlek seçici (FinTbAbout), siyah "Devam et".
4. **Keşfet**: FinNotifications tam sayfa (Takip istekleri/Bugün/Bu hafta) yerine sheet; FinDetail yorum listesi/yanıt alanı; FinFollowingEmpty önerilen hesaplar; FinFeedTip balon ipucu; FinComments menüleri; FinCompose 3 sekme düzeni.
5. **Profil alt ekranları**: FinPrPersonal (avatar solda, gri alanlar), FinPrNotify (ikonlu 4 satır), FinPrSecurity (fazladan başlık kartı, siyah "Şifreyi güncelle"), FinPrAgreements (sekme çipleri), FinProfilePublic (kapak, Tabaklar/Gönderiler ızgarası), FinBadges (doğrulama rozetleri listesi), FinPrMacroHistoryEmpty (ayrı ekran yok).
6. **eatkcal**: FinCityR1/WaitlistR1/EatBerlin fotoğraflı il kapısı ekranları yok (şehir listesi var); FinEkInfo SSS sekmesi + bölge haritası; FinEkStore/Reviews vitrin brandKey'i eşleşmedi (veri); FinEkOrders filtre çipleri (mock sipariş yok).
7. **Tara**: FinScanR2 açık kamera düzeni (alt mod çubuğu, yeşil deklanşör, hak hapı); FinPhotoR1 foto + makro sheet düzeni; FinScanError "Kameraya erişim kapalı" ayrı durum.
8. **Vitrinin açamadığı ara durumlar** (ekran var, durum açılamadı → tabloda büyük fark/ekran yok): ödeme bekliyor/başarısız/bilinmiyor (gerçek ödeme gerekir — KİMSE mantığı), PostMenu alt adımları (engelle/şikayet/teşekkür), GunViewer özet slaytları, Macro nedir sheet'i, Nasıl hesaplanır sheet'i, kaydırılmış durumlar (FinFeedScrollR3, FinEkProductScroll), konum izni kapalı / harita yok. Bunlar için bileşenlere `vitrin*` başlangıç prop'u eklemek (dev-only) sonraki adım.
9. **Stres panoları** (FinStressLong/XL/EN/Dark) ve FinComponents: kabul matrisi panoları; tek ekran karşılığı yok, ilgili ekranların XL/EN çekimleriyle kısmen karşılaştırıldı. FinHomeXL'de en büyük yazıda başlıklar kırılıyor.
10. FinPrCards: KİMSE (SavedCards) — eski tasarım, dokunulmadı.

## SORULAR
1. **FinSheetNotify metni**: Final "Serini korumak için akşam 19:30'da hatırlatayım mı?" diyor; uygulamada 19:30'da zamanlanmış bir seri hatırlatması YOK. Metin uydurma vaat olacağı için değiştirilmedi (yalnız düğme renkleri). Hatırlatma kurulacak mı, yoksa metin mi kalsın?
2. **FinBadges / FinProfilePublic giriş noktası**: Final FinPrProfile'da "Herkese açık profil" ve "Rozetler" düğmeleri yok; kaldırıldı. Avatar → herkese açık önizleme; Rozetler'e şu an Profil'den giriş yok. Nereye bağlansın?
3. **Su halkası** (FinHomeR3): uygulamada su takibi yok → halka gösterilmiyor. Dalga 2'ye mi?

## İlter'e
- Tüm görüntüler: `.claude/night/out/g14/` (`app/` ilk tur, `after/` düzeltme sonrası, `pair*/` yan yana). Git'e girmez (`.claude/` yok sayılıyor).
- Simülatör: "G14 iPhone" (`71501989-3C53-44A8-AEA3-E6F6D3B5E965`); kendi simülatörüne dokunulmadı. Silmek için `xcrun simctl delete 71501989-3C53-44A8-AEA3-E6F6D3B5E965`.
- Bayrak kapalı = bugünkü uygulama: değişen her ekran yeni kabuk/yeni bayrak dalında; vitrin üretim paketinde yok.
