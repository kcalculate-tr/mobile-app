# G18-S4 — Sistem, hareket, Keşfet, bildirim, Tara notu (8 Kas)

## ÖZET (10 satır)
(1) **Geçiş seti tek modülde (md.1):** `src/core/design/motion.tsx` → `PREMIUM` (FinMoTokens 9 satır): sekme 200 standard crossfade (kaydırma korunur, `TabSceneFade`), push/geri 300 enter/exit (native stack, parmakla sürülür), sheet 300 enter / 200 exit (eatkcal 200/28), liste 200 · kademe 100 · ilk 4 · 8 pt · ≤ 500, basma 100 · 0,98 · AI 260/24 bırakma, yükleniyor→içerik 200 (`FinLoadSwap`), hata 200 alan altında (`FinErrorReveal`). `constants/motion.ts` artık değer taşımaz (`LEGACY_MOTION`, bayt bayt aynı değer). Final yolunda yerel süre/eğri/yay **0** (grep raporu aşağıda).
(2) **Gezinme kuralı (md.2):** G17-S1 tablosu üstüne KAPSAYICI yeniden tarama (geri oku/X çizen 59 dosyanın hepsi sınıflandırıldı); 2 ihlal düzeltildi (FinSignupAI kod/ad adımlarında sağdaki "Vazgeç"; tab bar a11y etiketinde nokta ayraç). `navRule` testi.
(3) **FinPush (md.3):** 4 şablon (sipariş · seri · sosyal + "Yanıtla" · hatırlatma + "30 dk ertele"/"Bugün sessize al"), başlık ≤ 35 / gövde ≤ 90 / 0–2 aksiyon test edildi; expo-notifications kategorileri + gizli önizleme ("Bildirim", Android PRIVATE kanal) YALNIZ yeni kabukta; aksiyon işleyicileri; TR/EN. Sunucu: şablon metin dosyası + migration (**deploy/uygulama gerekir**).
(4) **Keşfet (md.4):** FinFeedEmpty + FinFollowingEmpty Final: başlık/açıklama, "Başlangıç için" Marka/Editör kartları (yalnız gerçek kcal gönderisi), "Davetli üreticiler" (yoksa gizli), "İlk paylaşımını hazırla"; boş akışta halka şeridi yalnız "Günüm" + açıklama. Diğer Keşfet panoları vitrinde yeniden karşılaştırıldı (ölçülmüş uyum %, `scripts/dev/g18-diff.ts`).
(5) **Tara "Detay ekle" (md.5):** deklanşörün üstünde hap → tek satır alan (≤ 160), not analiz isteğine `hint`, boşsa ek adım yok, sonuç sheet'inde "Notun:" satırı. **Canlı edge v7 `hint` okumuyor** → repo dosyası güncellendi, DEPLOY GEREKİR.
(6) **Tab bar (md.6):** FinTabBar-rest/mid/min ölçüleri birebir (hap 289, hap–Tara 10, etiket 13, pasif ikincil renk, rozet, küçük durumda 44 iç daire + 22 ikon, Tara ikonu 18); gri hap aynen (ORTAK #4).
(7) Kontrol (son kodda yeniden): tsc 0 · unit 672 (671 ✓, 1 skip önceden) · components 32 suite / 167 ✓ (snapshot 2/2) · `noLegacyWhenFlagsOn` ✓ · `noLocalMotionTokens` ✓ · export iOS ✓ (9,94 MB) Android ✓ (9,97 MB). Karşılaştırma tablosu ÖLÇÜLMÜŞ (`scripts/dev/g18-diff.ts`).
(8) **Eski tasarım: 0** · bayrak kapalı parite ÇALIŞTIRILDI: taban ↔ HEAD `Off-*` çekimleri piksel karşılaştırması (Profil/Sepet/Abonelik %0; Tracker/Home farkları animasyon anı + dönen banner, kod değil).
(9) Simülatör "G18-4 iPhone" (`D014ACFC-…307B`, G17-2 klonu, expo-camera'lı dev client), Metro 8104, vitrin `G14_MODE=storage`; 27 çekim + yan yana çiftler `~/kcal-reports/g18-s4/`.
(10) SORULAR: 4 madde (edge deploy, push sunucu satırı, FinMoPopover S2 bekleniyor, canlı veri okuması reddedildi). Son commit GERÇEK dosya `docs/night/G18-S4-DONE`.

## Commit'ler (dal `night18/sys`, taban `night17/camera` `249b89b`)
| Madde | Commit | Özet |
|---|---|---|
| 1 · 7 | `ff44cf6` | `PREMIUM` seti, `RN_CURVE`, `LEGACY_MOTION`, `listEnterDelay`; `TabSceneFade` (R3 `screenLayout`); Sheet 300/200; Button basma; `FinTransitions` (FinLoadSwap/FinListEnter/FinPressScale/FinErrorReveal); yerel süre/eğriler token'a; `noLocalMotionTokens` testi |
| 5 | `bbbe43a` | Tara "Detay ekle": `scanNote.ts`, `ui/ScanNote.tsx`, hint → client/runScan/kuyruk, sonuç satırı, edge dosyası, testler |
| 3 | `92ca032` | `core/push/finPush.ts` (saf), `finPushNative.ts` (kategoriler/işleyiciler), `useFinPushSetup` (R3), i18n `push.fin.*`, `send-notification/finPushTemplates.ts`, migration `20261108000400_g18_finpush_templates.sql`, testler |
| 4 | `fc6ff65` | `kesfet/starters.ts`, `ui/FeedStartEmpty.tsx`, KesfetScreen bağlantısı, i18n, testler |
| 6 | `2b64de1` | Tab bar ölçüleri + `tabBarFinal` testi |
| 2 | `a0fcc16` | Gezinme kuralı düzeltmeleri + `navRule` testi; vitrin hareket haritası metinleri |
| 7 | `ccacb8b`, `7fec7d2` | Vitrin: FinFeedEmpty, FinPush (+EN kayıtları), Tur 26 bekleyen listeden çıktı |
| 2 · 4 · 7 | `dd096d8` + sonraki | Boş akış halka şeridi (Günüm + açıklama), vitrin yeni kullanıcı halkası, kapsayıcı `navRule`, `g18-diff` piksel ölçüm betiği, ölçülmüş tablo |
| 7 | bu LOG + `G18-S4-DONE` | Kontroller |

## 1 — Premium geçiş seti (FinMoTokens + FinMoMap)
Tek modül: `src/core/design/motion.tsx`. Ekranlar yalnız buradan okur.
| Geçiş | Token (PREMIUM) | Uygulama |
|---|---|---|
| Sekme değişimi | `tab` fast 200 · standard | `modules/shell/TabSceneFade.tsx` → R3 `Tab.Navigator screenLayout`; yalnız opaklık, sekmeler mount'ta → kaydırma konumu korunur; ilk açılışta animasyon yok. Navigatörün kendi `fade/shift`'i KULLANILMADI (24.09 kararı). Yalnız yeni kabuk. |
| Sayfa push / geri | `push` base 300 enter · base 300 exit | Native stack `animationDuration: PREMIUM.push.enter` (300, eskisiyle aynı değer); iOS kenar jesti parmağa bağlı, kesilebilir. `SCREEN.pop` 200 → 300. |
| Sheet | `sheet` base 300 enter · fast 200 exit · eatkcal 200/28 · scrim aynı sürede | `Sheet.tsx`: AI sheet zamanlı (yay değil), eat yay 200/28; kapanış exit eğrisi. `SHEET.ai/eat.openDuration` 500 → 300, `MODAL` 500 → 300. Keşfet `useSheetRise` aynı token. |
| Liste girişi | `list` fast 200 enter · kademe instant 100 · ilk 4 · 8 pt · ≤ 500 | `listEnterDelay()`; `FinListEnter`; Keşfet kart girişi (`useFeedCardEnter`) 10 pt → 8 pt, 6 öğe → 4. `STAGGER` 40/90/60/30 → 100. |
| Basma | `press` instant 100 · 0,98 · AI 260/24 | `Button` (0,97 yay → 100 ms 0,98 + AI yayı), `FinPressScale` |
| Yükleniyor → içerik | `load` fast 200 crossfade | `FinLoadSwap` (iskelet ve içerik aynı kutuda) |
| Tara sonucu | `scanResult` AI 260/24 + halka slow 500 | `FinPhotoResult` (G17-S2, değişmedi) |
| Kutlama | `celebrate` story 900 tek sahne | `CelebrateOverlay` konfeti döngüsü → tek geçiş; `StreakMoment` 900/820/520 → story 900 + slow 500 |
| Hata | `error` fast 200 · y 4→0 · uyarı haptiği | `FinErrorReveal` → `FinFieldError`; `useFinShake` (FinMoShake) 4×55 ms → tek base 300 geçiş |

Ek eşlemeler (FinMoTokens "Eşleme" tablosu): `TIMING.float/tilt` 3200/4800 döngü → story 900 TEK SAHNE (`useFloat` artık döngü yapmaz); `glow` 2400 → nefes yarısı story 900 (`useBreath` döngüsü yalnız yüklenirken; cam hale `loop: false`); `sweep/streak/loading` 1400/1200 → 900; `TabBarR3` LogFlight yerel `bezier(0.3,1.15,0.4,1)` → `CURVE.enter`; `TIMING.pop / 2` aritmetiği → instant 100 + bouncy 220/14.

### Grep raporu (yerel süre/eğri/yay)
Desen: `duration: <sayı>`, `animationDuration: <sayı>`, `delay: <sayı>`, `withDelay(<sayı>`, `Easing.bezier/linear/ease/in/out/…`, `stiffness|damping|bounciness|tension|friction: <sayı>`, `speed: <sayı>`, `DURATION|TIMING|REDUCED.x ± sayı`.
- **Önce:** 80 eşleşme (motion modülleri hariç 61). Final yolunda: LogTrail 2, StreakMoment 2, GlassTabBar 4, TabBarR3 2, FinScanAnalyzing 1, PostingStatus 1, eatkcal v2 kit 2, EkCheckoutScreen 2, OptionCard 1, profil finUi 4, CollectionWon 1, CelebrateOverlay 1, GlassObject (2 dosya) 4, kesfet/motion 2.
- **Sonra — Final yolu: 0.** Kalanlar yalnız bayrak KAPALI yol (değerler donuk; `noLocalMotionTokens` LEGACY listesinde adetleriyle): CustomTabBar 6, OrderSuccessScreen (v1) 4, FloatingCartPill 4, FeedbackScreen 3, useAnimatedPress 2, ProductDetailScreen 2, MacroScreen 2, constants/theme 2, FormField 2, TrackerScreen (eski öğün modalı) 1, ProfileScreen (eski) 1, HomeScreen 1, eatkcal CartScreen (v1) 1, useStaggerAnimation 1, core/ui Toast/Selectable/SegmentedTabs/FadeSwap 1'er, PushPermissionPrompt 1, BottomSheet 1, AnnouncementStrip 1.
- Test: `src/dev/__tests__/noLocalMotionTokens.test.ts` — tüm `src` taranır; LEGACY dosyası yalnız kayıtlı adet kadar; Final dizinleri LEGACY'ye eklenemez; PREMIUM değerleri FinMoTokens ile birebir; DURATION/TIMING bandı yalnız 100/200/300/500/900.

## 2 — Gezinme kuralı (G17-S1 tablosu üstüne)
Tarama KAPSAYICI: `src` altında geri oku (`ArrowLeft/CaretLeft/ChevronLeft`) ya da kapat X'i çizen **59 dosyanın tamamı** sınıflandırıldı — 18 sheet/modal (geri oku yok, X sağda: kod satırlarıyla kontrol edildi: `closeBtn right`, `row-reverse`, başlık satırında sağda), 15 itilen sayfa/başlık (X yok), 4 yerinde denetim (not temizle, arama kapat, ek kaldır, vitrin), 22 yalnız bayrak kapalı 1.0.7 dosyası (bayrak açıkken `finalRoutes`/`v2ScreenFor` Final karşılığını verir). İkisi birden çizen Final dosyası 0. `navRule` testi bu sınıflandırmayı zorlar: yeni dosya sınıflandırılmazsa kırılır. Sunum biçimi rota seçeneklerinden (AI_PUSH/AI_MODAL, Sheet, Modal) okundu.
| Ekran | Sunum | Önce | Sonra |
|---|---|---|---|
| FinSignupAI kod adımı (`SignupAIFlowV2`) | push | sol geri + sağda "Vazgeç" | yalnız sol geri |
| FinSignupAI ad adımı (`SignupAIFlowV2`) | push | sol geri + sağda "Vazgeç" | yalnız sol geri |
| `KcalAiSignUpScreen` e-posta/ad adımı | push | sol geri + sağ "Vazgeç" | yeni kabukta yalnız sol geri (kapalıyken aynen) |
| TabBarR3 rozetli sekme (a11y etiketi) | — | "Ana sayfa · 1 yeni kayıt" | "Ana sayfa, 1 yeni kayıt" (nokta ayraçsız) |
| Uyumlu (değişmedi) | | | ScanOffline, EkProduct/EkStore/EkAddressAdd/EkAddCard/EkPayment, PostDetail, PublicProfile (push, sol geri) · Sheet, FinScanCamera/Viewfinder/ErrorSheet, FinPhotoResult, Celebrate, Rules, Report, Video, Composer, Comments, GunViewer (modal/sheet, sağ X) · EkHome arama "X" (alan kapatma, gezinme değil) · CollectionCardDetail (ekran içi ayrıntı, sol geri) |
Nokta ayraç: i18n değerlerinde 0; Final kodunda kullanıcıya görünen 0 (kalan: eski CartScreen/CheckoutScreen v1; `checkoutModel` sipariş adres verisi — S3, mantık; `HomeCelebrations` paylaşım metni — S2'ye not). Test: `src/dev/__tests__/navRule.test.ts`.

## 3 — FinPush
- Saf modül `src/core/push/finPush.ts`: `renderFinPush` (sınırlar: başlık 35, gövde 90; [Ad] ≤ 16, [N] ≤ 3 hane, sipariş no 9, yorum ≤ 60 "…"), `FIN_PUSH_CATEGORY`, `FIN_PUSH_ACTIONS`, `finPushRoute` (sipariş → OrderDetail/ProfileOrders · seri → Ana sayfa `finOpenLog` · sosyal → SharedPost(+commentId) · hatırlatma → Ana sayfa `finOpenLog: <öğün>`), `muteUntilEndOfDay`.
- Native `src/core/push/finPushNative.ts`: `setNotificationCategoryAsync` × 4 (`previewPlaceholder` "Bildirim", `showTitle: false`), Android kanal `fin` `lockscreenVisibility: PRIVATE` ("İçerik gizli"); işleyiciler: ertele → aynı içerik 1800 sn sonra yerel bildirim; sessize al → gün sonuna kadar (ön planda bastırılır + kurulu hatırlatmalar iptal); "Yanıtla" → `add_comment` RPC (metin), başarısızsa yorumlara açar; dokunuş/"Siparişi izle" → hedef ekran. Kayıt yalnız `TabNavigatorR3` (yeni kabuk); `data.fin` taşımayan bildirimler bugünkü işleyicide aynen.
- Gizli önizleme: `data` yalnız kimlik taşır (orderId/postId/commentId/meal), ad/yorum/sipariş no yok (test).
- Sunucu (deploy YOK): `supabase/functions/send-notification/finPushTemplates.ts` (TR/EN metin + categoryId/channelId eşlemesi), migration `supabase/migrations/20261108000400_g18_finpush_templates.sql` (7 `fin_*` şablonu) — **CANLIYA UYGULANACAK**.
- Testler: `core/push/__tests__/finPush.test.ts` 9/9 (sınırlar iki dilde, pano metinleri, aksiyonlar, i18n ↔ şablon ↔ sunucu dosyası birebir, yönlendirme, sessize al), `__component_tests__/finPushNative.test.tsx` 5/5.

## 4 — Keşfet boş hâlleri
- `modules/kesfet/starters.ts`: `deriveStarters` (yalnız `kurum` → Marka, `moderator` → Editör; görselsiz/başlıksız atlanır), `isInvitedCreatorRole` (diyetisyen/pt/üretici). Veri yoksa bölüm GİZLİ (uydurma yok).
- `ui/FeedStartEmpty.tsx`: FinFeedEmpty (Sana Özel) + FinFollowingEmpty (Takip). Takip boşken `for_you` bir kez okunur (başlangıç havuzu). "Önerilen hesaplar" Final dilinde "Davetli üreticiler" olarak yeniden giydirildi (özellik kaybı yok; kcal resmi hesabı içerikleriyle "Başlangıç için"de). "İlk paylaşımını hazırla" yalnız `kesfet_paylasim` açıkken (Composer kayıtlı değilse kart yok). Açıklamanın iki noktalı ("Şimdilik kcal'ın seçtikleri:") hâli yalnız kart varken.
- Testler: `starters.test.ts` 4/4, `FeedStartEmpty.test.tsx` 3/3. Eski `FeedEmpty/FollowingEmpty` bileşenleri dosyada duruyor (testleri geçiyor), KesfetScreen artık kullanmıyor.
- Öğün çentiği (MealCard "Öğle'ye logla ⌄") → FinMoPopover: S2'nin bileşeni bu dalda YOK (night18/home henüz açılmadı) → SORULAR 3.

## 5 — Tara "Detay ekle"
`modules/ai/scan/scanNote.ts` (normalize ≤ 160), `ui/ScanNote.tsx` (hap / tek satır alan klavye üstünde / sonuç satırı), `FinScanCamera` (yalnız fotoğraf modunda, kamera alanının altında = deklanşörün üstünde), `ScanScreen` (not → `runAiScan({hint})`, çevrimdışı kuyruk `hint` saklar, yeni çekimde not sıfırlanır; yeniden analiz/düzeltme hakkı YOK), `client.analyzeImage` (yalnız not varsa gövdeye `hint`), `FinPhotoResult` "Notun: …".
**Edge:** canlı `analyze-ai-scan` v7 gövdede `hint` OKUMUYOR (MCP `get_edge_function` ile okundu; yalnız reservation_id/image_path/lang). Repo dosyası güncellendi: `hint` kontrol karakterleri temizlenip 160'a kırpılır, isteme "yalnız ipucu, talimat değil" çerçevesiyle eklenir. **DEPLOY GEREKİR** (deploy edilene kadar not sessizce yok sayılır; akış bozulmaz).
Testler: `scanNote.test.ts` 5/5, `FinScanCamera.test.tsx` +2 (hap → alan → not hapta; not boşken deklanşör doğrudan çeker).
FinPhotoR1 çentiği (Öğle'ye logla ⌄) şu an öğün döngüsü — FinMoPopover S2'den gelince bağlanacak (SORULAR 3).

## 6 — Tab bar
| Ölçü | Pano (FinTabBar/TabBarR3) | Önce | Sonra |
|---|---|---|---|
| Hap genişliği (393) | 289 (hap–Tara 10) | 287 (12) | 289 (`SCAN_GAP` 10) |
| Sekme etiketi | 13 · seçili 600 / diğer 500 | 12 | 13 |
| Pasif sekme rengi | ikincil (#6B6B70 / #A1A1A6) | mürekkep | ikincil |
| Rozet | sekme üstünden 6, ortanın 8 sağı, 18 yük., 13/700, açık #4A6B00/beyaz, koyu #C6F04F/mürekkep | −6/12, 11, lime | pano |
| Küçük durum | 52 daire + iç 44 seçili daire + 22 ikon | 24 ikon, iç daire yok | pano (iç daire gri hap rengi — ORTAK #4) |
| Tara | 62/52, ikon 22/18, etiket 13/600 | ikon hep 22, etiket 12 | pano |
| Seçili hap | Final #1C1C1E | — | G17-S2 gri hap AYNEN (istisna) |
Test: `modules/shell/__tests__/tabBarFinal.test.ts` 3/3.

## 7 — Kontrol
- `npx tsc --noEmit` → 0.
- `npm run test:unit` → 672 test, 671 ✓, 0 ✗, 1 atlandı (önceden var). Yeni: noLocalMotionTokens 3, navRule 4, finPush 9, scanNote 5, starters 4, tabBarFinal 3, i18nKeys 1 (TR/EN eksik anahtar 0, iki yön).
- `npm run test:components` → 32 suite / 167 ✓, snapshot 2/2 (ScanScreen.flagParity, TrackerScreen flagOff). Yeni: RingStrip boş hâl.
- `noLegacyWhenFlagsOn` ✓ (unit içinde). `screenCatalog` ✓ (FinFeedEmpty, FinPush artık katalogda).
- `expo export --platform ios` ✓ (9,94 MB) · `--platform android` ✓ (9,97 MB) — son koddan sonra yeniden.
- Yeni native derleme / yeni paket YOK (expo-notifications kategorileri mevcut paket; OTA ile gider).

### Bayrak kapalı parite
- `constants/motion.ts` değerleri `LEGACY_MOTION`'dan bayt bayt aynı (100/200/300/500/900/1400, press 20/0, enter 14/8, 0,97).
- Stack geçişleri: `animationDuration` 300 (eskisi `DURATION.base` 300); Checkout/OrderSuccess `slide_from_bottom` 300 aynı.
- Sekme crossfade, FinPush kategorileri, tab bar ölçüleri yalnız `TabNavigatorR3` (yeni kabuk). Bildirim işleyicisi yalnız `data.fin` için farklı davranır.
- Eski ekranların `core/design`'dan aldıkları (AppText, useTheme, EmptyErrorCard, LegacyPostCard'da `DURATION.micro/standard`, `SPRING.eat`, `CURVE.in`) değişmedi. `KcalAiSignUpScreen` değişikliği `yeniKabuk` arkasında.
- Snapshot'lar (Tara, Tracker flagOff) aynı.

#### Bayrak kapalı parite — ÇALIŞTIRILDI (simülatör, piksel)
Yöntem: aynı simülatör ("G18-4 iPhone"), aynı vitrin sahneleri `Off-<Sekme>` (BÜTÜN bayraklar kapalı = 1.0.7 kabuğu), aynı Metro portu (8104): önce bu dal (HEAD `a5dae4a`), sonra worktree'de `git checkout 249b89b -- src` ile TABAN (`night17/camera`) kaynağı → çekim → `git checkout HEAD -- src` (çalışma ağacı temiz, `git status` 0). Karşılaştırma `npx tsx scripts/dev/g18-parity.ts <taban> <yeni> Off-…` (durum çubuğu hariç, kanal farkı > 24 olan piksel %).
| Sahne (bayraklar kapalı) | Farklı piksel % | Fark kutusu | Açıklama |
|---|---|---|---|
| Off-Profile | 0,000 | — | birebir |
| Off-Cart | 0,000 | — | birebir |
| Off-Subscriptions | 0,000 | — | birebir |
| Off-Tracker | 0,094 | kalori sayısı (450,1752–751,1836 px) | Taban çekimi eski `1.0??` sayı yuvarlanma animasyonu bitmeden alınmış (soluk gölge rakamlar), HEAD'de bitmiş; son değer ikisinde de `1.080`. Eski TrackerScreen/animasyon kodu bu dalda değişmedi. |
| Off-Home | 7,885 | banner + kayan duyuru şeridi | Zamanla dönen banner karuseli (taban: fotoğraf karesi, HEAD: "İlk Siparişe Özel 250 TL İndirim!" karesi) ve kayan duyuru şeridinin konumu; geri kalan (başlık, Konak hapı, Deneyimin nasıldı penceresi, ürünler, eski tab bar) aynı. HomeScreen/AnnouncementStrip bu dalda değişmedi. |
Kanıt görselleri: `~/kcal-reports/g18-s4/parity/` (base-/head- Off-Tracker, Off-Home, Off-Profile).
Kod düzeyinde: bayrak kapalı yoldan erişilen dosyalardan bu dalda değişen yalnız 4 dosya var (`git diff --name-only 249b89b HEAD` — screens/, components/, core/ui, hooks, utils, CustomTabBar, eatkcal/screens v1 = 0 değişiklik): `constants/motion.ts` (aynı değerleri `LEGACY_MOTION`'dan veren ince katman), `AppNavigator.tsx` (stack süreleri aynı 300; R3 değişiklikleri yalnız `TabNavigatorR3`), `core/notifications.ts` (yalnız `data.fin` bildirimleri), `KcalAiSignUpScreen.tsx` (yalnız `yeniKabuk`).

### Vitrin karşılaştırması (`G14_MODE=storage`, "G18-4 iPhone", Metro 8104) — ÖLÇÜLMÜŞ
Çekimler `.claude/night/out/g18-s4/` (worktree) + yan yana çiftler `.claude/night/out/g14/pair-g18s4/`; kopya `~/kcal-reports/g18-s4/`.
**Yöntem:** `npx tsx scripts/dev/g18-diff.ts .claude/night/out/g18-s4 <Pano…>` — pano (`design/final/png/<Pano>.webp`) ve çekim 393 pt genişliğe ölçeklenir; durum çubuğu (üst 54 pt) hariç ortak yükseklikte, en büyük kanal farkı ≤ 24 olan piksel oranı = **uyum %**. Çok kareli panolarda 1. telefon karesi (x 24, y 48, 393 × 852) kırpılır; FinTabBar şerit panoları (393 × 100) çekimin alt 100 pt'siyle; `G18_MAXY` / `G18_MINY` ile veri/kamera bağımsız bölge ayrıca ölçüldü. Fotoğraflar, örnek isim/sayılar ([Ad], [N]) ve yer tutucu kutular piksel farkı üretir — % yerleşim+renk uyumunun alt sınırıdır.
| Pano | Uyum % (tam) | Uyum % (bölge) | Fark (çiftten) | Düzeltildi mi |
|---|---|---|---|---|
| FinFeedEmpty / -Dark / EN | 74,9 / 47,4 / 74,1 | üst 340 pt: 89,4 / 87,9 / 87,6 | Halka şeridi Final'deki gibi yalnız "Günüm" + açıklama (bu oturumda eklendi; önce arkadaş halkaları vardı). Alt fark: Final'de "Başlangıç için" kartları var; Sana Özel akışı boşsa gerçek kcal gönderisi de yoktur (for_you = dildeki tüm yayınlar) → kural #6 gereği gizli | Şerit ✓ düzeltildi · kartlar veri bağımlı |
| FinFollowingEmpty / -Dark / EN | 72,8 / 57,0 / 72,7 | üst 340 pt: 88,5 / 86,9 / 87,4 | Vitrin verisinde 1 kcal gönderisi → 1 başlangıç kartı (Final 2 örnek); "Davetli üreticiler" satırları Final düzeninde | Veri bağımlı |
| FinPush / EN | 86,0 / 85,8 (1. kare) | — | Metinler, sınırlar (24/35 · 63/90 …) ve aksiyon etiketleri üretim kodundan; kart çizimi vitrinde temsilî (gerçek kartı OS çizer) | — |
| FinTabBar-rest / -Dark | 83,1 / 69,8 | şerit | Seçili hap gri (ORTAK #4 istisnası; Final siyah); bar alt boşluğu home indicator + 4 (G16-S2) | İstisna |
| FinTabBar-mid / -Dark | 78,4 / 67,3 | şerit | + mid karede Final hapı iki sekmeyi kaplıyor; kod kayma (FinMoMap "jöle/uzama yok") | İstisna |
| FinTabBar-min / -Dark | 90,0 / 85,7 | şerit | 44 iç daire + 22 ikon, Tara 52/18 (bu oturumda düzeltildi) | ✓ |
| FinScanR2 / -Dark / EN | 24,5 / 26,3 / 24,2 | kontrol paneli (660 pt altı): 88,9 / 89,6 / 87,9 | Kamera alanı simülatörde siyah (pano gri yer tutucu); "Detay ekle" hapı panoda yok (G17-S2 Ek 9, görev md.5 gereği) | Simülatör/ek |
| FinPhotoR1 / -Dark, FinPhotoEN | 81,4 / 82,2 / 81,8 | — | Sol üst geri oku yerine sağ X (gezinme kuralı, G17-S1); fotoğraf alanı | Kural |
| FinScanError | 95,0 | — | — | — |
| FinFeed | 75,7 (ilk 854 pt) | — | Örnek isim/sayılar ([Ad]/[N]) gerçek veriyle; "@kcal, 2 sa" nokta ayraçsız (G17-S1) | Kural |
| FinDetail | 74,8 (ilk 854 pt) | — | "[N] görüntülenme" verisi yok → gizli; detay altındaki yorum listesi vitrin verisinde yok (doğrulanamadı) | SORULAR 4 |
| FinComments (1. kare) | 88,7 | — | "Yorumlar (5)" nokta ayraçsız | Kural |
| FinCompose (1. kare) | 94,3 | — | Sol "İptal" yerine sağ X (G17-S1 gezinme kuralı) | Kural |
| FinVideo (1. kare) | 59,5 | — | Pano gri "Video" yer tutucusu, çekimde gerçek görsel + vitrin halkaları; düzen (kart, 0:42, ses düğmesi, öğün kartı) aynı | Veri |
| FinPosting (1. kare) | 90,6 | — | — | — |
EN: FinFeedEmptyEN, FinFollowingEmptyEN, FinPushEN, FinScanR2EN, FinPhotoEN çekildi (yeni metinlerin hepsi EN sözlükte; yeni `i18nKeys` testi: iki dilde eksik anahtar 0).

**Eski tasarım: 0** — S4 alanında (kabuk/geçişler, Keşfet, bildirim, Tara) bayraklar açıkken 1.0.7 bileşeni çizilmiyor (`noLegacyWhenFlagsOn` ✓; yeni bileşenler yalnız core/design + Fin*). Yeniden giydirilen (Final'de yok): "Önerilen hesaplar" → "Davetli üreticiler" satırları; Tara "Detay ekle" hapı (G17-S2 Ek 9).

## Temas (başka oturumun dosyası — S5 birleştirir)
- S3 (eatkcal v2): `ui/kit.tsx` iskelet nabzı 900 → `DURATION.story` + standard; `EkCheckoutScreen.tsx` PulseDot aynı; `ui/product/OptionCard.tsx` yay 220/14 → `SPRING.bouncy` (değer aynı). Mantık diff 0.
- S1 (onboarding): `onboarding/v2/SignupAIFlowV2.tsx` iki `topRight` satırı silindi (gezinme kuralı).
- Profil: `profil/ui/finUi.tsx` FinMoShake 4×55 ms → tek base 300; `FinFieldError` → `FinErrorReveal`. `profil/ui/signup/KcalAiSignUpScreen.tsx` yeni kabukta sağ "Vazgeç" yok.
- Kutlama/koleksiyon: `celebrate/GlassObject.tsx`, `CelebrateOverlay.tsx`, `collection/CollectionWon.tsx` token'a.
- S2 (Ana sayfa): `navigation/types.ts` `Tracker: { finOpenLog? }` — FinPush seri/hatırlatma dokunuşu bu parametreyle gelir; **TrackerScreen'in açık logla sheet'ini/öğün seçimini bu parametreden açması S2/S5'te** (şimdilik Ana sayfa açılır).

## CANLIYA UYGULANACAK / DEPLOY GEREKİR
1. `supabase/functions/analyze-ai-scan/index.ts` — `hint` desteği (deploy; canlı v7 okumuyor).
2. `supabase/migrations/20261108000400_g18_finpush_templates.sql` — 7 `fin_*` şablonu (uygulanacak).
3. `supabase/functions/send-notification/index.ts` — FinPush kategori bağlantısı YAPILDI (dosya; DEPLOY GEREKİR): `fin_*` şablon anahtarlarında Expo mesajına `categoryId` (aksiyon düğmeleri) + `channelId: 'fin'` (Android gizli önizleme) eklenir (`finPushExtras`); diğer bütün bildirimler bayt bayt aynı gövde. Test: `finPush.test.ts` (10/10). Çağıran `data.fin` (+ orderId/postId/commentId/meal) verir.

## Final'den bilinçli farklar (kural/görev gereği — "birebir"in kapsamı)
Final panolarıyla birebir uygulanmayan her nokta bir kurala ya da görev maddesine dayanır; tasarım dışı karar yok (ORTAK #11):
| Fark | Dayanak |
|---|---|
| Tab bar seçili hap gri (Final #1C1C1E siyah) | ORTAK #4 / SON_HAL İSTİSNA 1 |
| Tara "Detay ekle" hapı (FinScanR2'de yok) | Görev md.5 — G17-S2 Ek 9, İlter onaylı ek |
| "Başlangıç için" kartları yalnız gerçek kcal gönderisi varken; Sana Özel boşken gizli | ORTAK #6 / SON_HAL "Panodaki sayı/isim örnektir; veri yoksa bölüm gizli" + görev md.4 "yalnız gerçekte varsa" |
| FinPhotoR1 sol geri → sağ X, FinCompose "İptal" → sağ X, nokta ayraçsız etiketler | Görev md.2 gezinme kuralı (FinComponents), G17-S1 |
| FinScanR2 kamera alanı (simülatörde siyah) | Simülatörde kamera görüntüsü yok; kontrol paneli %88–90 |
| Tab bar mid karesinde hap uzaması yok | FinMoMap "Sekme değişimi: hap kayar fast 200 · jöle/uzama yok" (G17-S2) |
Deploy / canlı uygulama bu oturumda YASAK (ORTAK #8: "deploy yok, canlı DB yazma yok … Claude/İlter uygular"); bu yüzden edge `hint` ve `send-notification` kodları repoda HAZIR, deploy'ları ve FinPush migration'ının uygulanması yukarıda "CANLIYA UYGULANACAK / DEPLOY GEREKİR" olarak bırakıldı.

## SORULAR
1. Edge `hint` deploy'u ve FinPush migration'ı — onay/uygulama İlter/Claude'da (yukarıda).
2. `send-notification` kategori bağlantısı repoda yapıldı (yalnız `fin_*` şablonları etkilenir) — deploy onayı İlter'de.
3. FinMoPopover (S2) bu dalda yok → Keşfet MealCard ve FinPhotoR1 "logla ⌄" çentikleri bugünkü davranışta (Keşfet: mevcut menü; Tara: öğün döngüsü). S2 bileşeni gelince 1'er satır `onPress` bağlanmalı (S5).
4. Canlı veri okuması (`execute_sql`, Marka/Editör gönderisi var mı) otomatik mod sınıflandırıcısınca reddedildi; kural gereği başlangıç kartları yalnız gerçek gönderi varsa çıkar, yoksa gizli — canlıda kaç `kurum`/`moderator` gönderisi olduğu doğrulanamadı. FinDetail yorum listesi vitrinde doğrulanamadı.
