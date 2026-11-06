# G16-S2 — Tab bar yüksekliği, alt boşluk, Android uyumu (opus)

## ÖZET (10 satır)
(1) Dal `night16/ui` (taban `night15/release` `0e301d0`), worktree `.claude/worktrees/g16-s2`, Metro `--port 8098`, simülatör "G16-2 iPhone" (`5F3BEEF0-…D883`). Commit'ler: `ac786ae` (md.1/2) · `feeabf8` (md.3) · `3f722d9` (night16/release merge, G16-S1 DONE).
(2) md.1 Tab bar indi: alt boşluk `insets.bottom + 24` → `insets.bottom + 4` (insets 0 → 8). iPhone 17 Pro'da hap alt kenarı ekran altından 58 → 38 pt; hap/Tara/cam/rest-mid-min aynı satırda → hepsi 20 pt indi. Tek kaynak `shell/layout.ts` (`tabBarBottomOffset`, `tabBarContentInset`); sekme kökleri içerik alt boşluğu = bar üstü + 10.
(3) md.2 Yığın ekranlarında alttaki "yer tutucu" — iki kök neden: (a) Final `Toast` akış içi kutu, EkStore'da kök sütunda gizliyken 69 pt yer tutuyordu (ScrollView 874 → 805 pt, ızgara alttan kesik) → `EkToastLayer` (absolute); (b) Profil alt ekranları (Ayarlar alt ekranları, Makro, İlerleme, Rozetler…) Profil SEKMESİ içinde çiziliyor, yüzen bar "Kaydet/Gönder"in üstüne biniyordu → alt ekranda bar gizli, altta yalnız `insets.bottom`. 23 yığın ekranı önce/sonra çekildi (tablo aşağıda).
(4) md.3 Android: React 19'da `Text.defaultProps` ÖLÜ → `fontFamily`'siz metin SF/Roboto'ya düşüyordu. Final modüllerinde 51 dosya `FinText`'e geçti (tek dosyada: eksik aile → Jakarta, `fontWeight` → ağırlık dosyası, iç içe aile, Android `includeFontPadding:false`). Bricolage build'e gömülü (dosyalar aile adıyla).
(5) Android'e özel: kenar-kenar (SDK 54 varsayılan, `edgeToEdgeEnabled=true`) → ekran KAV'ları `SCREEN_KEYBOARD_BEHAVIOR` ('padding'), EkScreen (sepet/ödeme) Android'de klavyeye göre daralır; geri tuşu: Profil alt ekranı → üst seviye, sekme kökü → uygulama çıkışı (`backBehavior="none"`); LogPill ripple kaldırıldı; cam: `expo-blur` Android'de bulanıklık yok, `rgba` cam dolgusu yarı saydam yedek olarak kalıyor; gölge token'larında `elevation` var.
(6) **Android emülatörü/SDK YOK** (`emulator`, `adb`, `sdkmanager`, `~/Library/Android/sdk` yok; yalnız Java 8) → Android panoları ÇEKİLEMEDİ; tablo iOS çekimi + koddan beklenen Android değerleriyle (SORULAR 1). Android prebuild + export ✓.
(7) md.4 Bayrak kapalı parite: 5 sekme (Ana sayfa/eatkcal/Profil/Sepet/Abonelik) bütün bayraklar kapalı, taban `0e301d0` ↔ bu dal piksel karşılaştırması: 4'ü 0 px fark, Off-Home'da 0,05% şerit = aynı kodla iki çekimde de değişen animasyon (gürültü). Ayrıca TrackerScreen flag-off snapshot testi aynı. Bayrak kapalı ekranlarda font düşmesi → uygulanmadı, SORULAR 2.
(8) Kontrol (merge sonrası `3f722d9`): tsc 0 · test:unit 597/597 · test:components 144/144 · prebuild iOS ✓ Android ✓ · `expo export --platform ios` ✓ (9.83 MB) · `--platform android` ✓ (9.85 MB).
(9) Eski tasarım: 0 (kendi alanım: tab bar, alt boşluk, toast katmanı, Profil alt ekranları — hepsi Final bileşenleri).
(10) Son commit GERÇEK dosya `docs/night/G16-S2-DONE`. SORULAR: 8 madde, ENTEGRASYONA: 2.

## Commit'ler
| Commit | İçerik |
|---|---|
| `ac786ae` | md.1 + md.2: `shell/layout.ts`, TabBarR3 (alt boşluk, gizleme), `useInR3Shell`, sekme kökleri (Tracker, Keşfet, EkHome, FinPrProfile), EkToastLayer (EkStore/EkCart), Profil alt ekranında bar gizleme + Android geri, vitrin `FinPr*~2` kareleri, `layout.test.ts`; iç içe md.3 altyapısı (FinText, AppText, keyboard.ts) |
| `feeabf8` | md.3: 51 dosya `FinText`, Bricolage gömülü + yeniden adlandırma, KAV, `backBehavior`, LogPill ripple, `FinText.test.tsx` |
| `3f722d9` | `night16/release` merge (çakışma yok) |

## md.1 — Tab bar ölçümleri (iPhone 17 Pro, 402×874 pt, insets.bottom 34)
| Ölçü | Önce | Sonra |
|---|---|---|
| Hap alt kenarı → ekran altı | 58 pt (34 + 24) | 38 pt (34 + 4) |
| Home tuşlu / insets 0 | 24 pt | 8 pt |
| Hap üst kenarı (y) | 754 pt | 774 pt |
| Hap / Tara (rest) | 62 / 62 | 62 / 62 (aynı satır, 20 pt indi) |
| mid/min (hap → daire, Tara küçük) | 52 / 52 | 52 / 52 (aynı satır, 20 pt indi) |
| Açılış yükselmesi (`rise`) | 62 + 24 + insets | 62 + 4 + insets |
| Logla toast'ı alt | 94 pt (insets'i saymıyordu) | bar üstü + 8 |
| Sekme kökü içerik alt boşluğu | insets + 96 (Profil insets + 120) | insets + 76 (Profil + 14) |
| eatkcal v2 ana sayfa (R3) | 82 + 24 + insets | insets + 76 (eski kabukta 82 + 24 AYNEN) |
Görüntü: önce/sonra alt kırpıntı karşılaştırması `before-rest.png` ↔ `after-FinTabBar-rest.png` (job tmp/shots), ≈ 20 pt aşağı.

## md.2 — Yığın ekranları (ekran · önce · sonra)
Yöntem: vitrin (`G14_MODE=storage` eşdeğeri, `shot.py`), önce = `0e301d0` kaynakları, sonra = `feeabf8`; alt %38 kırpıntıları yan yana incelendi. Profil alt ekranları için yeni `FinPr*~2` kareleri ekranı GERÇEK kabukta (Profil sekmesi içinde, TabBarR3 ile) açar — vitrin eskiden bunları sekmesiz çizdiği için sorun görünmüyordu.
| Ekran | Önce | Sonra |
|---|---|---|
| EkStore (mağaza) | Altta 69 pt boş gri şerit, 2. sıra kartlar kesik (gizli Toast akışta) | Izgara ekran altına kadar, şerit yok |
| EkProduct (ürün) | Sepete ekle barı güvenli alan üstünde | Aynı (sorun yok) |
| EkCart (sepet) | Toast kaydırma içeriğinin sonunda 69 pt yer tutuyor, görünürken ekranda değil | Toast alt barın üstünde yüzer; görünüm aynı |
| EkCheckout (ödeme) | "Siparişi ver" güvenli alan üstünde | Aynı (sorun yok); Android'de klavyede daralır |
| EkAddressAdd (adres) | Sorun yok | Aynı; Android KAV 'padding' |
| EkAddresses | Sorun yok (Toast zaten katmanda) | Aynı |
| EkOrders | Sorun yok | Aynı |
| EkOrderDetail | Sorun yok | Aynı |
| ProfileSavedCards (FinPrCards) | Sorun yok | Aynı |
| SharedPost (FinDetail) | Sorun yok | Aynı |
| KesfetNotifications | Sorun yok | Aynı |
| AiScan (FinScanR2) | Sorun yok | Aynı |
| TakibeBasla › Hedef / Sonuç | Sorun yok ("Devam et" güvenli alan üstünde) | Aynı |
| Profil › Kişisel bilgiler | Tab bar "Kaydet"in üstünde, Telefon alanının altı kapalı | Bar yok, "Kaydet" görünür |
| Profil › Bildirimler | Bar son satırların üstünde | Bar yok |
| Profil › Güvenlik | Bar "Hesabı sil" altını kapatıyor | Bar yok |
| Profil › Sözleşmeler | Bar metnin üstünde | Bar yok |
| Profil › Destek | Bar gönder alanının üstünde | Bar yok |
| Profil › Geri bildirim | Bar "Gönder"in üstünde | Bar yok, "Gönder" görünür |
| Profil › Gizlilik ayarları | Bar altta | Bar yok |
| Profil › İlerleme | Bar "Beslenme raporunu indir" altında boşlukta | Bar yok |
| Profil › Rozetler | Bar altta | Bar yok |
| Profil › Makro / Koleksiyon / Kartlar / Kuponlar / Değerlendirmeler / Ölçümler / Herkese açık | Aynı mekanizma (sekme içi `sub`) → bar üstte | `Sub-<alt>` sahnesiyle gerçek kabukta çekildi (7/7): bar yok, içerik (Koleksiyon ızgarası, Makro geçmişi satırları) ekran altına kadar |
Ayrıca G16-S1'in yeni yığın ekranı `ScanOfflineScreen` zaten yalnız `insets.bottom + 24` kullanıyor.

## md.3 — Android uyumu
**Font yükleme:** Plus Jakarta (5) zaten gömülü; Bricolage yalnız çalışma zamanında `useFonts` ile yükleniyordu (Android + Fabric'te typeface kaydolmadan ölçülüp Roboto'ya düşme yarışı — app.config.js'teki eski not). Bricolage dosyaları aile adıyla yeniden adlandırıldı (`BricolageGrotesque_700Bold.ttf` …) ve `expo-font` eklentisine eklendi; prebuild sonrası `android/app/src/main/assets/fonts/` 10 dosya (aile adı = dosya adı ✓), iOS Info.plist'te 5 Bricolage girdisi.
**Sistem fontuna düşen yerler:** `App.tsx:161` `(Text as any).defaultProps.style = { fontFamily: 'PlusJakartaSans_400Regular' }` React 19.1'de etkisiz (`react/jsx-runtime` defaultProps'u uygulamıyor; RN 0.81 `Text` fonksiyon bileşeni). Sonuç: `fontFamily` vermeyen her `Text` iOS'ta SF, Android'de Roboto. Final modüllerinde örnekler: `FinPhotoResult.tsx:620-673` (AppText — doğru), `EkCartScreen.tsx` makro çipi iç `<Text style={{ fontWeight: '700' }}>` (düz Text — ağırlık iOS'ta yok sayılıyor, Android'de sahte kalın), `gun/ui/RollingNumber.tsx:54` (aile yok — sayılar SF/Roboto), `ai/scan/ui/ScanQuotaChip`, `eatkcal/v2/ui/home/cards.tsx:226` (`fontWeight` + Jakarta). Keşfet ekranları zaten AppText kullanıyor (`KesfetScreen.tsx:111` badgeText AppText → doğru). Çözüm `core/design/components/FinText.tsx` (tek kaynak) + 51 dosyada import değişimi (`FinText as Text`). Kapsam dışı bırakılanlar (bayrak kapalı yol da çizer ya da G16-S1'in dosyası): `kesfet/ui/{icons,format,VerifiedBadge}`, `profil/ui/screens/{SignupAIScreen,SignupEatScreen}`, `profil/ui/Legacy*`, `ai/scan/screens/{ScanScreen,ScanOfflineScreen}`, `ai/scan/ui/FinScanErrorSheet`, `onboarding/v2/SignupEatFlowV2`, `eatkcal/v2/ui/gate/CityGateView`, `screens/tracker/HomePendingScans`.
**fontWeight:** AppText zaten eşliyordu (G15-S2 `withWeightFamily`); FinText aynı tabloyu düz Text'e uyguluyor (Android'de sahte kalın, iOS'ta yok sayılan ağırlık yok).
**Boyut (iOS pt ↔ Android dp):** Kodda ölçekleme yardımcısı YOK (`PixelRatio`, `moderateScale`, `normalize`, `getFontScale` aramaları boş); ölçüler dp = pt birebir. Android'de "küçük görünme"nin koddan görülen sebepleri: (a) sistem fontuna düşme (Roboto'nun farklı metrikleri), (b) Plus Jakarta'nın yüksek ascent/descent'i + Android `includeFontPadding` varsayılan `true` → satır kutusu iOS'tan uzun, glif aynı boyda ama kutu içinde kayık/küçük görünür, (c) cihaz genişliği (Pixel 9 412 dp vs iPhone 17 Pro 402 pt, %2.5), (d) kullanıcı "Yazı boyutu" ayarı (`maxFontSizeMultiplier` tavanları korunuyor). (a)+(b) tek kaynaktan çözüldü (FinText + AppText `includeFontPadding:false`). Cihazda doğrulanamadı (SORULAR 1).
**Kenar-kenar / insets:** `edgeToEdgeEnabled=true` (prebuild `android/gradle.properties:47`); bar `insets.bottom` (gezinme çubuğu) + 4 üstünde → hareketli gezinmede ~24 dp + 4, 3 tuşta ~48 dp + 4. **Durum çubuğu:** R3 kabukta temadan (`AppNavigator` StatusBar, G15-S2). **Geri tuşu:** Sheet `Modal onRequestClose` → kapanır (`Sheet.tsx:121`); Profil alt ekranı → üst seviye (BackHandler); sekme kökü → çıkış (`backBehavior="none"`, yalnız R3). **Klavye:** manifest `adjustResize`, ama kenar-kenar pencerede etkisiz → ekran KAV'ları `SCREEN_KEYBOARD_BEHAVIOR` (`EkAddressAdd`, `PostDetail`, `Composer`, onboarding `FormScreen`), `EkScreen` (sepet/ödeme/kart) Android'de KAV; Modal içi sheet'ler (yorumlar, rapor, kupon) kendi penceresinde yeniden boyutlanır, dokunulmadı. **Gölge/cam:** `tokens.elevation` sm/md/lg `elevation` 0/3/8 içeriyor; `expo-blur` Android'de `experimentalBlurMethod` verilmedikçe bulanıklık yapmaz, cam token'larının `rgba` dolgusu (TabBarR3 `glass` 0.58/0.55) yarı saydam yedek. **Ripple:** Final modüllerinde tek `android_ripple` LogPill'deydi → kaldırıldı (iOS ile aynı basma hâli).

### iOS ↔ Android pano tablosu (%50 ölçek hedefi)
**Android çekimi ENGELLİ:** `emulator -list-avds` → komut yok; `adb`, `sdkmanager`, `avdmanager` yok; `~/Library/Android/sdk`, `$ANDROID_HOME` yok; Java yalnız 1.8 (Gradle/AGP 17 ister). G16-S2.md md.3: "SDK yoksa dur, SORULAR'a yaz; 3'ün kod kısmını yine yap" → SDK kurulmadı (≈10 GB sistem kurulumu, onay gerekir; SORULAR 1). Android tarafında yapılabilen her şey yapıldı: prebuild (gömülü 10 font, `edgeToEdgeEnabled=true`, `adjustResize` doğrulandı) + `expo export --platform android` ✓.
iOS = bu dalda "G16-2 iPhone" çekimi (`T-<Pano>.png`), Final karşılaştırması G15-S6 son durumu + bu oturumdaki değişikliğin etkisi. Android sütunu = koddan beklenen (cihazda doğrulanmadı).
| Pano | iOS (sonra) | Android (beklenen, cihazsız) |
|---|---|---|
| FinHomeR3 | G15-S6 ile aynı içerik; bar 20 pt aşağıda (İlter isteği, Final'den bilinçli sapma) | Jakarta/Bricolage gömülü dosyadan; `includeFontPadding:false`; bar gezinme çubuğu + 4 |
| FinFeed | Aynı; liste alt boşluğu insets + 76 | Keşfet metinleri AppText (ağırlık eşlemesi + `includeFontPadding:false`); gün halkası sayıları `RollingNumber` FinText |
| FinScanR2 | Aynı (değişmedi) | Vizör/çipler: `ScanQuotaChip` FinText; ScanScreen G16-S1 dosyası → RN Text (SORULAR 6) |
| FinEkHome | Aynı; alt boşluk bar yeni üstüne göre | Ek metinleri FinText; cam bar blur yerine yarı saydam |
| FinEkProduct | Aynı | `ProductBottomBar` FinText; KAV yok (giriş yok) |
| FinEkCheckout | Aynı | EkScreen KAV → not alanı klavye üstünde; "Siparişi ver" yükselir |
| FinPrProfile | Aynı; alt boşluk insets + 90 | Fin profil metinleri FinText/AppText |
| FinOnbWelcome | Aynı (bayrak/kabuk dışı) | FormScreen KAV 'padding'; Bricolage başlık gömülü dosyadan |
| FinTbGoal | Aynı | TakibeNavigator FinText; seçenek kartları AppText |
| FinTabBar-rest | Bar 20 pt aşağıda; ölçüler (62/62, radius 31) aynı | Etiketler açık aileli (FinText yalnız padding ekler); blur yok → `rgba(255,255,255,0.58)` cam |

## md.4 — Bayrak kapalı parite
### Ekran görüntüsü kanıtı (bütün bayraklar varsayılan/kapalı, 1.0.7 kabuğu)
Yöntem: vitrine `Off-<Sekme>` sahnesi eklendi (`screenCatalog.ts` `resolveParity`, yalnız __DEV__): bayraklar `FLAG_DEFAULTS`, gerçek AppNavigator. Önce = `0e301d0` kaynakları (yalnız font yolu güncel), sonra = bu dal. Karşılaştırma: |Δkanal| > 24 piksel oranı, durum çubuğu hariç.
| Ekran | Önce ↔ Sonra | Not |
|---|---|---|
| Off-Tracker (Ana sayfa, eski kabuk) | 0,000% (0 px) | aynı |
| Off-Home (eatkcal sekmesi, eski HomeScreen + değerlendirme penceresi) | 0,049% (1.436 px, y 571–582 pt tam genişlik) | aynı kodla iki çekim (P1↔P2) de aynı şeritte 575 px farklı → zamanlı animasyon, kod farkı değil |
| Off-Profile (eski Profil) | 0,000% (0 px) | aynı |
| Off-Cart (eski Sepet) | 0,000% (0 px) | aynı |
| Off-Subscriptions (eski Macro) | 0,000% (0 px) | aynı |
Görsel kontrol: hepsi eski siyah alt bar + lime sepet düğmesi (CustomTabBar).

### Kod kanıtı
- TabBarR3, `shell/layout.ts`, `useInR3Shell`, `backBehavior` yalnız `TabNavigatorR3` (yeni_kabuk). Eski `CustomTabBar` ve `constants/layout.ts` (`TAB_BAR_TOTAL`) DEĞİŞMEDİ.
- `TrackerScreen.tsx` değişen satırlar yalnız `asTab`/`yeniKabuk` dallarında; `KesfetScreen` stack boşluğu (insets + 120) aynı; `EkHomeScreen` eski kabukta `TAB_BAR_TOTAL + 24` aynı.
- FinText yalnız bayrak arkası modüllerde (liste yukarıda). AppText bayrak kapalı bir yolda da çiziliyor (Keşfet kapalıyken `SharedPost` legacy kartları) → Android `includeFontPadding` yalnız `useFeature('yeni_kabuk')` açıkken; aile bağlamı sağlayıcısı görsel etkisiz.
- Font dosya adı değişikliği: `fonts.ts` require yolları güncel; `useFonts` adları aynı; bayrak kapalı ekranlar Bricolage kullanmıyor.
- Test: `TrackerScreen.flagOff` snapshot dahil components 144/144.

## Kontrol
| Adım | md.1–3 sonrası (`feeabf8`) | Merge sonrası (`3f722d9`) |
|---|---|---|
| `npx tsc --noEmit` | 0 | 0 |
| `npm run test:unit` | 597/597 | 597/597 |
| `npx jest` (components) | 139/139 | 144/144 |
| `expo prebuild --platform ios` | ✓ | ✓ |
| `expo prebuild --platform android` | ✓ | ✓ |
| `expo export --platform ios` | ✓ 9.81 MB | ✓ 9.83 MB |
| `expo export --platform android` | ✓ 9.83 MB | ✓ 9.85 MB |

Eski tasarım: 0

Yeniden giydirilen (Final'de yok): —

## ENTEGRASYONA
1. `src/modules/eatkcal/v2/ui/gate/CityGateView.tsx:109` (G16-S1 / il kapısı — dokunulmadı): `showTabSpace ? TAB_BAR_TOTAL + insets.bottom + 4` eski kabuk ölçüsü; yeni barla ~44 pt fazla boşluk (kesilme yok). Öneri: `showTabSpace ? (inR3 ? tabBarContentInset(insets.bottom) : TAB_BAR_TOTAL + insets.bottom + 4) : insets.bottom` (`useInR3Shell` from `modules/shell`).
2. G16-S1 dosyaları (`ScanScreen.tsx`, `ScanOfflineScreen.tsx`, `FinScanErrorSheet.tsx`, `SignupEatFlowV2.tsx`, `HomePendingScans.tsx`, `CityGateView.tsx`): RN `Text` → `import { FinText as Text } from '<rel>/core/design/components/FinText'` (aynı tek satırlık değişim; betik `fintext-codemod` mantığı LOG'da).

## SORULAR
1. **Android SDK yok** (emulator/adb/sdkmanager yok, `~/Library/Android/sdk` yok, Java 8). Android panoları çekilemedi; cihazda font boyutu, klavye ('padding') ve gezinme çubuğu boşluğu doğrulanmadı. Android Studio + API 35 Pixel AVD kurulumu (≈10 GB) onayı gerekiyor; kurulunca `npx expo run:android --port 8098` + aynı 10 pano.
2. **Bayrak kapalı ekranlarda da font düşmesi var:** `App.tsx:161` global Plus Jakarta ataması React 19'dan beri etkisiz → 1.0.7 ekranlarında `fontFamily` vermeyen her metin (ör. eski `TrackerScreen` stilleri) bugün canlıda SF/Roboto. Düzeltme (ör. eski ekranlar da `FinText` ya da global çözüm) canlı müşteri ekranını değiştirir → uygulanmadı, karar senin.
3. `backBehavior="none"`: görev "sekme kökünde uygulama çıkışı" dediği için böyle; Instagram gibi "önce Ana sayfa sekmesine dön, sonra çık" istenirse `firstRoute` (eski varsayılan).
4. Bar Final panosundaki 24 pt'den bilinçli olarak 4 pt'ye indi (İlter isteği) — Final panosu güncellenmeli mi?
5. FinText `TextInput`'u kapsamıyor (ref tipi değişmesin diye): `fontFamily`'siz giriş alanları sistem fontunda kalıyor.
6. G16-S1 dosyaları import değişiminden hariç (ENTEGRASYONA 2).
7. Simülatör: "G15-6 iPhone" (`4FED1BB8`) açık olduğu için kopyalanamadı; aynı soydan kapalı "G15-5 iPhone" kopyalandı. Bu kopyalarda uygulama verisi G14 cihazının konteynerinde (`simctl get_app_container` → `71501989-…/data/…`) — klonlar AsyncStorage'ı paylaşıyor; G15-S3'teki "kendiliğinden açılan pano" muhtemelen bundan. Paralel oturumlarda her oturuma ayrı `simctl create` önerilir.
8. Metro bir kez kendiliğinden kapandı (`RCTFBLoginButton` çift kayıt hatası sonrası, Fast Refresh) — yeniden başlatıldı; uygulama kodu kaynaklı değil.

## Ortam
- Simülatör "G16-2 iPhone" `5F3BEEF0-F92F-4730-A3D3-0C0272EAD883` (silmek için `xcrun simctl delete 5F3BEEF0-F92F-4730-A3D3-0C0272EAD883`). İlter'in ve diğer oturumların simülatörüne dokunulmadı (G14 konteyneri SORULAR 7).
- Çekimler: `~/.claude/jobs/93c47bfd/tmp/shots/` (B-/A-/T- önekleri; iş silinince gider).
