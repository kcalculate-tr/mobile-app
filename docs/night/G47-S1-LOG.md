# G47-S1 LOG — Tek giriş katmanı, profil kapısı, eski kayıt/karşılama akışlarının kaldırılması (14 Kas)

Dal `release/1.1.0` · worktree `.claude/worktrees/g23-s1` · başlangıç `ba93624` (G46-S1-DONE). Yalnız JS/TS (OTA uyumlu; 1.1.0 build 32 / Android 25), yeni paket yok, deploy / OTA / canlı DB yazma yok, migration yok (gerekmedi). Her şey `yeni_kayit` açıkken geçerli; kapalıyken davranış bugünkü gibi. `OnboardingScreen.tsx` diff boş (G42 ile bayt bayt aynı testi geçiyor).

## ÖZET
1. **md.1 AuthSheet:** `yeni_kayit` açıkken kök `Login` rotası alttan açılan saydam bir modal katman. Uygulamadaki tüm `navigate('Login')` çağrıları (onboarding 5, Profil oturumsuz, sekme kapıları, eatkcal sepet/ödeme/adres, takip rotaları oturumsuzken) aynı katmanı açar. İçerik: "Hesabına giriş yap", iOS'ta native `AppleAuthenticationButton`, Google (resmî G logosu), "E-posta ile devam et", Koşullar · Gizlilik. Kayıt ekranlarının cam zemini (KBackdrop), 56 pt düğmeler. Arkası bulanık ve karartılmış. Aşağı kaydırma, karartmaya dokunma, X ya da Android geri ile kapanır. Açılış 300 ms (PREMIUM.sheet), azaltılmış harekette 200 ms opaklık. LoginV2 / UnifiedLogin bayrak açıkken kayıtlı değil.
2. **md.1 E-posta + giriş sonrası:** E-posta → `AuthEmail` (mevcut E1/E2, giriş kipi). İnceleme adresleri için şifre alanı aynen çalışıyor (testli). Başarılı girişte: sipariş akışından (`redirectTo`) gelindiyse o ekran açılır. Bir uygulama ekranının üstünden açıldıysa katman kapanır ve kullanıcı kaldığı yerden devam eder. Onboarding, kayıt ya da sekme kökünden gelindiyse profil varsa Ana sayfa açılır; yoksa kök [Ana sayfa, kayıt akışı] olur ve akış P1'den başlar (K1 atlanır).
3. **md.2 Çıkış:** Oturum true → false olduğunda (çıkış, hesap silme, süre dolması) AppNavigator kök yığını `Kayit · signedOut`a sıfırlar. Onboarding'in kaldığı yer kaydı (ONB_KEY) önce silinir, böylece 1. ekran açılır. Profil ve Güvenlik ekranlarındaki mevcut `resetToSignedOut` çağrısıyla çift sıfırlama yapılmıyor. `WelcomeGate` ve eski `Onboarding` bayrak açıkken kayıtlı değil. Bayrak değeri oturum kapanınca da son bilinen değerden okunuyor: FlagsProvider anon çözümü gelene kadar önceki haritayı tutuyor, kök rotalar da soğuk açılışta dondurulmuş değeri kullanıyor.
4. **md.3 Profil kapısı:** "Profil var" = `target_calories` ya da `custom_calories` > 0 ya da `personal_plan` dolu. Kök yığına `UNSTABLE_router` (gateRouter) eklendi. Tara, Koç (intro/sohbet/geçmiş), ilerleme ve haftalık tartı rotalarına giden her navigate/push/replace, profil yoksa doğrudan kayıt akışına çevrilir. Kayıt akışı `kisisel_plan` açıksa A yolu P1–L2, kapalıysa yeni kısa profil. Oturum yoksa AuthSheet açılır. Tab çubuğundaki Tara dahil her çağrı noktası kapsanıyor.
5. **md.3 Ana sayfa:** Profil yoksa takip bölümünün (halka, makrolar, öğünler/Bugün, gün şeridi, etkinlik, Koç kartı) yerine tek kart çıkıyor: "Planını oluştur — Günlük kalori hedefin ve takibin için 1 dakika" + lime "Başla" (cam kupa). Banner, Keşfet ve eatkcal bölümleri olduğu gibi kalıyor. Elle gir, su ve öğün kaydı kapıdan geçiyor. Akış bitince dokunulan eyleme dönülüyor: Tara açılır, elle giriş açılır (`finOpenManual`) ya da su bir kez eklenir (`finAddWater`).
6. **md.4 Eski "Takibe başla":** `TakibeBasla` bayrak açıkken kayıtlı değil. TakibeBasla, NutritionProfile, PersonalPlanMine ve PersonalPlan çağrıları profil yoksa yeni kayıt akışına gidiyor. Profil varsa Kişisel planım açılıyor (`kisisel_plan` kapalıysa yeni kısa profil). Bu yönlendirmeye giren çağrı noktaları: Ana sayfa makro, Profil "Hedefim", Hedef Düzenle, PublicProfile CTA, HomeOnboardingSlot.
7. **md.5:** Profil durumu bilinmiyorsa (sorgu hatası/çevrimdışı) kapı açık kalıyor, profilli eski kullanıcılar hiçbir değişiklik görmüyor. Profilsiz eski kullanıcılar ilk takip eyleminde kapıya düşüyor.
8. **md.1 L2 (oturum açık):** Girişten gelindiyse isteğe bağlı Meta + pazarlama kutuları (işaretsiz) düğmenin üstünde. Meta kutusunda G41 ATT kuralı aynen geçerli (`requestMetaOptIn`). Plan doğrudan hesaba yazılıyor. T1 yalnız ilk kayıtta (hesap son 15 dk içinde oluşmuşsa) ve G46 "bir kez" kuralıyla açılıyor.
9. **md.6 Rıza metni:** Düğme önce, metin ALTINDA (L2 ve kısa profil son adımı). 11 pt / 14 pt satır, ikincil renk, ortalı, düğmeyle arası 8 pt, altında güvenli alan. "Aydınlatma metni" bağlantısı aynı boyutta, alt çizgili ve bölünmez boşluklu. 402 pt'de 2 satır, 1,3× yazıda 3 satır (kırpılma yok).
10. **Kontroller:** hygiene ✓ · tsc ✓ · unit 1328/1328 ✓ (yeni `g47.test.ts` 11) · jest 114 paket / 743 test ✓ (yeni `g47Kayit` 20) · `expo export` iOS ✓ Android ✓ (son commit üstünde yeniden). ESLint: değişen dosyalarda yeni hata yok. TrackerScreen'deki 3 `no-unescaped-entities` hatası eski satırlarda (794, 3132), dokunulmadı.

## Commit
| commit | içerik |
|---|---|
| `97a8858` | feat(g47): AuthSheet, giriş kipi E1/E2, giriş sonrası yönlendirme, çıkış → onboarding 1, profil kapısı (gateRouter + Ana sayfa kartı + ekran içi kapılar), eski rotaların kaldırılması, L2 oturum açık kipi, rıza metni yeri, testler |
| `1b1e16c` | fix(g47): rıza bağlantısı 11 pt; vitrin `G47-*` (yalnız __DEV__); ekran görüntüleri `docs/night/g47` |
| (sonraki) | docs(g47): bu LOG |
| (son) | `docs/night/G47-S1-DONE` |

## Kaldırılan / devre dışı rotalar (`yeni_kayit` açıkken)
| rota | durum |
|---|---|
| `WelcomeGate` (eski karşılama "Takip et. Üret. Paylaş.") | kayıtlı değil |
| `Onboarding` (eski onboarding yığını) | kayıtlı değil |
| `TakibeBasla` (kupa görselli 6 adım + Atla) | kayıtlı değil; çağrılar gateRouter ile yeni akışa / Kişisel planım'a |
| `Login` → LoginGate (LoginV2 / UnifiedLoginScreen) | bileşen AuthSheet (saydam modal); eski tam ekran giriş açılmaz |
| `NutritionProfile` | kayıtlı (rota denetimi); bayrak açık + oturumluyken her eylem gateRouter ile Kişisel planım / kısa profil / kayıt akışına çevrilir |
| yeni: `AuthEmail` | E1/E2 giriş kipi |

## Değişen / yeni dosyalar
| dosya | ne |
|---|---|
| `src/modules/kayit/gateLogic.ts` (yeni) | SAF: profil tanımı, karar, kayıt rotası, yönlendirici eylem çevirisi, giriş sonrası hedef, akış sonu rotaları, ilk kayıt |
| `src/modules/kayit/profileGate.ts` (yeni) | durum deposu (zustand), sorgu, `markProfileCreated` (eski sorgu 'none'u ezmez), akış kökeni deposu `useKayitFlow`, __DEV__ durum sabitleme |
| `src/modules/kayit/gateFlow.ts` (yeni) | `useProfileGateHost` (AppNavigator), `useProfileGate` (ekran içi) |
| `src/modules/kayit/gateComplete.ts` (yeni) | `completeGateFlow` (dokunulan eyleme dönüş) |
| `src/navigation/gateRouter.ts` (yeni) | `UNSTABLE_router` geçersiz kılma (modül düzeyi sabit) |
| `src/modules/kayit/auth/AuthSheet.tsx`, `auth/postAuth.ts` (yeni) | giriş katmanı + giriş sonrası yönlendirme |
| `src/modules/kayit/ui/HomeProfileGateCard.tsx` (yeni) | Ana sayfa "Planını oluştur" kartı |
| `src/navigation/AppNavigator.tsx` | yönlendirici, kapı bağlamı, oturum dinleyicisi, Login/AuthEmail, eski rotalar koşullu |
| `src/navigation/signOutReset.ts` | `Kayit · signedOut` hedefi (kökte Kayit kayıtlıysa), çift sıfırlama koruması |
| `src/modules/kayit/KayitNavigator.tsx` | `entry` (gate / auth / signedOut) |
| `src/modules/kayit/screens/PlanScreens.tsx` | L2 oturum açık kipi, kutular, kayıt hatası kartı, rıza altta |
| `src/modules/kayit/screens/QuestionsScreen.tsx` | kısa profil: köken + dönüş hedefi, girişte kutular, rıza altta |
| `src/modules/kayit/screens/SignupScreens.tsx` | E1/E2 giriş kipi; `SocialButton` dışa açık; kayıt sonrası `markProfileCreated` |
| `src/modules/kayit/signup.ts` | `consents` kipi (full / marketing / none), `writeAuthConsents` |
| `src/modules/kayit/ui/consent.tsx` | 11 pt, alt konum, bölünmez bağlantı |
| `src/screens/TrackerScreen.tsx` | kart, ekran içi kapılar, `finAddWater` |
| `src/modules/kayit/i18n.ts` | `auth.*`, `gate.*`, `plan.save_error` (TR + EN) |
| `src/dev/screenCatalog.ts`, `src/dev/vitrinSetup.ts` | `G47-*` vitrin (yalnız __DEV__) |
| testler | `kayit/__tests__/g47.test.ts`, `kayit/__component_tests__/g47Kayit.test.tsx`, `g45Kayit` (md.6 ölçüleri), `navRule` + `noLegacyWhenFlagsOn` listeleri |

## Testlerin kapsadığı (brif md.7 a–g)
- (a) Onboarding 5 "Giriş yap" → `Login`; bayrak açıkken `Login` = AuthSheet (transparentModal). Eski tam ekran giriş yalnız kapalı dalda. İçerik, ölçüler (56 pt / 44 pt kapat), modal erişilebilirlik, EN başlık. X / karartma → geri, e-posta → AuthEmail. Google girişinde profil yoksa kök [Ana sayfa, Kayit auth], varsa Ana sayfa, `redirectTo` varsa o ekran.
- (b) `resetToSignedOut` → `Kayit · signedOut`, iki kez sıfırlamaz. AppNavigator oturum dinleyicisi ve ONB_KEY silme kaynakta doğrulanıyor.
- (c) Profilsiz hesapta su / Elle gir → `Kayit {entry:'gate', returnTo}`. Akış sonu → Ana sayfa + AiScan. Yönlendirici Tara / Koç / ilerleme / check-in → kayıt akışına (PUSH/REPLACE dahil). Ana sayfa kartı ve Tracker kapıları kaynakta.
- (d) Profilli ya da bilinmeyen durum → geçer. Serbest rotalar (Tabs, Checkout, EkCart, Keşfet, ProfileSub…) değişmez.
- (e) TakibeBasla / WelcomeGate / Onboarding yalnız `!yeniKayit` dalında. Eski hedef rotaları profil yoksa kayda, varsa Kişisel planım'a / kısa profile gider.
- (f) E1 giriş kipinde inceleme adresi (büyük harf + boşlukla) şifre alanını açar, `signIn(normalize, şifre)` çağrılır. Normal adreste kod gönderme görünür.
- (g) Bayrak kapalıyken hiçbir eylem değişmez, kapı kapanmaz, çıkış hedefleri Onboarding / WelcomeGate.
- L2: düğme metinden önce (11 pt, 8 pt, ortalı, NBSP). Kapı kökeninde kutu yok, politika yeniden yazılmaz, plan kaydedilir, AiScan'a dönülür. Giriş kökeninde kutular işaretsiz ve düğmenin üstünde; işaretlenince Meta (adOn) + pazarlama yazılır, ilk kayıtta T1 açılır.

## Ekran görüntüleri (`docs/night/g47/`, iPhone 17 "G40 iPhone" 402 pt)
`G47-Auth` / `-Dark` / `-XL` (AuthSheet, arkada onboarding 5) · `G47-E1` (giriş kipi) · `G47-Home` (profilsiz Ana sayfa kartı) · `G47-P1` (Tara'ya dokununca açılan P1; gateRouter'ın ürettiği `Kayit {entry:'gate', returnTo: AiScan}` rotası) · `G47-Out` (çıkış sonrası kök `Kayit · signedOut` → onboarding 1) · `G47-L2` / `-Dark` (oturum açık: kutular + düğme + altında küçük rıza metni) · `G47-L2n` / `-Dark` / `-XL` (normal akış L2 alt kısmı).
Yöntem: Metro bu worktree'den (8146, CI kipi), `scripts/dev/g14-shots.sh` storage kipi, dev client `--initialUrl` ile bağlandı. Native derleme yok. Çekimden sonra simülatör kapatıldı. İlter'in "iPhone 17" simülatörüne dokunulmadı. Görüntüler vitrin rota yığınlarıdır; dokunma dizileri bileşen testlerinde doğrulandı.

## HIG (apple-design-skill ölçütleri, kod denetimi)
- Dokunma: AuthSheet düğmeleri 56 pt, kapat 44×44, Koşullar/Gizlilik bağlantıları en az 44 pt yükseklik; Ana sayfa "Başla" 52 pt ✓.
- Sheet: belirgin kapatma (X + karartma + aşağı kaydırma + Android geri) ✓ (`sheets.md › Support swiping to dismiss`; G46 SORU 2 bu katmanda karşılandı). `accessibilityViewIsModal` ✓.
- Apple ile Giriş: native düğme, onaylı metin, Google'dan küçük değil, en üstte ✓.
- Hareket: açılış PREMIUM.sheet (base 300 · enter), kapanış fast 200 · exit; azaltılmış harekette REDUCED opaklık ✓ (yerel süre/eğri yok, `noLocalMotionTokens` testi).
- Dynamic Type: AuthSheet başlığı/düğmeleri 1,3× tavan (kayıt ekranlarıyla aynı); rıza notu 1,3× tavanda 3 satır, kırpılma yok ✓. HIG %200 hedefinin altında (Düşük; uygulama genelindeki tercih, G46 ile aynı).
- Kontrast: AuthSheet başlığı #10301D zemin üstünde / koyu temada #FFF; ikincil metin `P.sec` (G46 ölçümü 5,2:1 açık, 9,8:1 koyu) ✓.

## KARAR
1. **Tek giriş katmanı = `Login` rotasının bileşeni:** Çağrı noktaları değişmedi. Bayrak açıkken aynı rota adı saydam modal AuthSheet'i açıyor (eatkcal, Profil, sekme kapıları, derin bağlantı kapısı tek yerden). Böylece eski tam ekran giriş hiçbir yoldan açılamıyor.
2. **Kapı yönlendirici katmanında:** React Navigation 7 `UNSTABLE_router` ile kök yığında. Takip rotasına giden her eylem (tab çubuğu Tara, Koç kartı, bildirim, Profil satırı) tek yerde çevriliyor. Ekran içi eylemlerde (Elle gir, su, öğün yuvası) aynı karar `useProfileGate` ile veriliyor. API "UNSTABLE" adlı ama 7.x'te belgeli; sürüm sabit (7.15.1). Değişirse tek dosya etkilenir (`gateRouter.ts`).
3. **Kapı listesi:** AiScan (barkod + ses Tara içinde), AiScanOffline, CoachIntro/Chat/History, MeasurementHistory (ilerleme), PersonalPlanCheckin. Ana sayfa dışındaki takip ekranı bunlar. Öğün planı (MealPlan) brifte yok, serbest bırakıldı.
4. **Bilinmeyen durumda kapı açık** (md.5): Sorgu hatası ya da çevrimdışı olmak kullanıcıyı kayda zorlamaz. Daha önce 'has' bilindiyse hata bunu düşürmez.
5. **Giriş sonrası "uygulama içi ekran" kuralı:** Katman bir eatkcal / Keşfet / gönderi ekranının üstünden açıldıysa giriş sonrası katman kapanır ve kullanıcı o ekranda kalır. Sipariş akışını bölmemek için seçildi (eatkcal serbest). Profil kuralı onboarding, kayıt ve sekme kökünden açılışta uygulanıyor.
6. **T1 "yalnız ilk kayıt sonrası":** Giriş kökeninde hesap son 15 dk içinde oluştuysa (sosyal girişte `new_user` ya da `created_at`) ve G46 cihaz/hesap işareti yoksa T1 açılır. Kapı kökeninde (zaten kayıtlı hesap, eyleme dokundu) T1 yok; kullanıcı eyleme döner.
7. **Rıza yazımı:** Kapı kökeninde politika/Meta yeniden yazılmıyor (önceki Meta "evet"inin üstüne "hayır" düşmesin). Giriş kökeninde yeni hesapsa ya da Meta işaretliyse politika kaydı yazılıyor; pazarlama yalnız işaretliyse.
8. **Profil varken hedef düzenleme:** `kisisel_plan` açıkken Kişisel planım (düzenleme orada). Kapalıyken yeni tasarımlı kısa profil (cevaplar yeniden alınır, hedef üstüne yazılır). Eski NutritionProfile ekranı "noLegacyWhenFlagsOn" denetimi nedeniyle bayrak açıkken açılmıyor.
9. **Çıkış sonrası onboarding 1:** `OnboardingScreen` G42 ile bayt bayt aynı kalmalı (g44 testi). Bu yüzden ekran değiştirilmedi; kaldığı yer kaydı navigatörde silinip ekran 1. adımdan açılıyor. Çıkışta R1 (7 günlük taslak) kartı da atlanıyor.
10. **Rıza metni içeriği değişmedi** (G45'te İlter'in verdiği metin). 402 pt'de 2 satıra sığıyor. 375 pt'de ölçülmedi, 3 satıra düşebilir (SORULAR 1).

## CANLIYA UYGULANACAK
- Yok (migration gerekmedi).

## DEPLOY GEREKİR
- Yalnız OTA (JS). `release/1.1.0` → 1.1.0 kanalı, İlter'in onayıyla. Bu oturumda deploy/OTA yapılmadı.

## SORULAR
1. **Rıza metni 2 satır sınırı:** Metin G45'teki gibi bırakıldı. iPhone 17 (402 pt) 11 pt'de tam 2 satır; 1,3× yazıda 3 satır (kırpılma yok). Dar ekranda (375 pt, SE) 3 satıra düşebilir. Her ekranda kesin 2 satır isteniyorsa metnin kısaltılması gerekir (ör. "Onaylayarak sağlık verilerinin (boy, kilo, yaş, hedef) planın için işlenmesine açık rıza verirsin."). Hukuki metin olduğu için onaysız değiştirilmedi.
2. **Giriş sonrası "kaldığı yerde devam":** Katman bir eatkcal ekranının üstünden açıldıysa profilsiz hesap kayıt akışına alınmıyor, ilk takip eyleminde kapıya düşüyor. Girişten hemen sonra her durumda kayıt akışı isteniyorsa `postAuthTarget`'ta tek satırlık değişiklik yeter.
3. **`kisisel_plan` kapalı + profil var + "Hedefim":** Yeni kısa profil yeniden açılıyor (ön dolu değil). Ön dolu bir düzenleme ekranı istenirse ayrı iş.
4. **Koç bayrağı kapalıyken** profilsiz kullanıcı Koç girişine dokunursa (giriş zaten gizli olmalı) kayıt akışı biter ama Koç rotası kayıtlı olmadığından Ana sayfada kalınır. Pratikte görünmüyor; not olarak bırakıldı.
