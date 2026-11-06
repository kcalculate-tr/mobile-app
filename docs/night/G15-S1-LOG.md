# G15-S1 — Onboarding + Takibe başla + Tanıtım (Final eşleşmesi)

## ÖZET (10 satır)
(1) Dal `night15/onb` (taban `night14/visual`), worktree `.claude/worktrees/g15-s1`; simülatör "G15-1 iPhone" (kendi kopyam), Metro 8091.
(2) ONB sabitleri temaya bağlandı: `onboarding/components/onbTheme.ts` (Final `T` nesnesi Light + Dark birebir) → Onboarding ve Takibe başla artık açık/koyu.
(3) Ortak iskelet `OnbScaffold`: Final koordinatlarında cam nesneler (kase/ayak/damla/alev/kupa), iki lime ışık, geri oku, sayfa noktaları (Takibe başla'da başlık + 6 nokta), "Atla", yarı saydam kart + alt düğmeler.
(4) Onboarding: Intent'te seçili lime satır + tik + "3 kısa soru" notu + "Devam et" (önceden "Takip etmek" seçili); Account'ta Apple siyah / Google·E-posta çerçeveli; Notify'da iki düğme yan yana (ikisi de çip); Underage kart + açıklama + kalın satır + tema birincil rengi.
(5) Akış Final sırasına çekildi: Karşılama → Niyet → Hesap → Bildirim → Takibe başla (yeni kullanıcı); dönen kullanıcı Hesap'tan Tabs'a. Auth çağrıları aynı.
(6) Takibe başla: seçili lime kart + tik, siyah/beyaz "Devam et", kg/hafta kaydırıcısı (PanResponder, 4 adım, erişilebilir), tekerlek seçiciler (doğum yılı/boy/kilo), makro kartları, altı çizili "Nasıl hesaplanır?" + Final sheet metni, ikonlu yeşil daire satırlar + açıklamalar.
(7) FinIntro/IntroOrder: "Siparişin aynı yerde." kenarlıklı kart + çanta ikonu, "Sonra" çerçevesiz mürekkep metin. FinSignupAI: kcal. işareti eklendi.
(8) Ek karar (İlter): Giriş + Kcal AI kayıt 2.–3. adım + eatkcal ilk sipariş kaydı (şehir/harita doğrulamalı adres/telefon) `onboarding/v2/` altında YENİ bileşenler; eski auth/adres dosyalarında diff = 0 (kanıt envanter bölümünde); kapılar bayrak kapalıyken eski ekranı aynen açar. `Eski tasarım: 0`.
(9) Kontrol: tsc 0 · test:unit 553 geçti / 0 fail / 1 atlandı (v2 mantık +26) · test:components 124/124 (snapshot 1/1, Tracker flagOff aynı; v2 +34) · `expo export --platform ios` ✓. KİMSE/auth/adres mantık dosyalarında diff boş; package.json/app.config değişmedi.
(10) Son commit GERÇEK dosya `docs/night/G15-S1-DONE`. Açık kalanlar SORULAR'da (SMS metni, harita sıkılığı, gate bayrağı, hedef tarihi).

## Pano tablosu (önce G14 → sonra G15) — görseller `.claude/night/out/g15/app/`
Doğrulama: ✓ = çekimi Final ile yan yana okudum (referans|uygulama çiftleri `.claude/night/out/g14/pair-g15/`, 2. tur çekim `out/g14/g15/`). Kalan küçük farklar yalnız ölçü/kopya: başlık Bricolage ağırlığı, kart içi dikey boşluk (~8–12 px), Final'deki mock "[N]" değerleri yerine gerçek hesaplanan değerler, sheet başlığı 20 (Final 24).

| Pano | G14 | G15 | Not |
|---|---|---|---|
| FinOnbWelcome | büyük | aynı ✓ | |
| FinOnbWelcome-Dark | küçük | aynı ✓ | |
| FinOnbIntent | büyük | küçük fark ✓ | başlık ölçüsü (30→32 ayarlandı), satır iç boşluğu |
| FinOnbIntent-Dark | büyük | küçük fark ✓ | |
| FinOnbAccount / -Dark | büyük | küçük fark ✓ ✓ | Apple siyah (Dark'ta beyaz), geri oku, damla ölçüsü Final'de |
| FinOnbNotify | büyük | aynı ✓ | |
| FinOnbNotify-Dark | büyük | küçük fark ✓ | |
| FinOnbUnderage / -Dark | büyük | küçük fark ✓ | |
| FinTbGoal / -Dark | büyük | küçük fark ✓ | kupa, noktalar, lime + tik, Devam et |
| FinTbPace | büyük | küçük fark ✓ | hedef tarih satırı yerinde, yalnız değer "—" (Final'de de mock "[Tarih]"; hedef kilo verisi akışta yok, uydurma tarih yazılmadı — SORULAR 3) |
| FinTbPace-Dark | büyük | küçük fark ✓ | |
| FinTbAbout | büyük | küçük fark ✓ | tekerlek ölçüleri |
| FinTbAbout-Dark | büyük | küçük fark ✓ | |
| FinTbActivity | büyük | küçük fark ✓ | |
| FinTbResult / -Dark | küçük/büyük | aynı ✓ | makro kartları, altı çizili link |
| FinTbHow | büyük | küçük fark ✓ | sheet başlığı 20 (Sheet ortak bileşeni, Final 24) |
| FinTbHow-Dark | büyük | küçük fark ✓ | |
| FinTbFirst / -Dark | büyük | aynı ✓ | |
| FinIntro / -Dark | küçük | küçük fark ✓ | sheet başlığı 20 (Final 24) |
| FinIntroOrder / -Dark | büyük | küçük fark ✓ | mock'ta geçmiş sipariş yoksa "Göz at/Sonra" (veri) |
| FinSignupAI / -Dark | büyük | küçük fark ✓ | v2 akış: karşılama (logo) → kod → "Seni nasıl tanısınlar?" → "Profilini tamamla"; handle adımında mevcut "Vazgeç" korundu, vitrin örnek verisi (İlter/@ilter) yok |
| FinSignupAIHandle / Profile (ek çekim) | — | küçük fark ✓ | Final panosunun 2./3. paneli |
| FinSignupEat / -Dark | büyük / yok | küçük fark ✓ | şehir sheet'i; arka plan (mutfak listesi) ve İzmir tiki yok |
| FinSignupEatAddress / Phone (ek çekim) | — | küçük fark ✓ | adres: mantık gereği İlçe/Mahalle alanları + harita doğrulaması; telefon: SMS vaadi yok (SORULAR 2) |
| FinLoginEmail / Code (ek çekim, Final'de ayrı pano yok → SignupAI 1. adım dili) | — | küçük fark ✓ | Giriş v2 (OTP) |

## Bayrak kapalı parite kanıtı
- `v2/__component_tests__/gates.flagOff.test.tsx` (4/4): `yeni_onboarding` KAPALI → `LoginGate` = UnifiedLoginScreen, `SignupAIGate` = KcalAiSignUpRoute, `SignupEatGate` = SignupEatScreen (v2 render edilmez); AÇIK → üçü de v2.
- Onboarding (5 ekran) ve Takibe başla (7 ekran) rotaları bayrak kapalıyken kaydolmaz/erişilmez (AppNavigator `yeniOnboarding` initialRoute; TakibeBasla yalnız onboarding Hesap + Profil › Hedefim'den); Tracker flagOff snapshot testi (components, snapshot 1/1) aynı; `EkCityGateScreen` bayrak kapalıyken `writeCityGatePassed → EkAddressAdd` yolunu aynen izler.
- Eski dosyalar için diff = 0 kanıtı aşağıda.

## Eski tasarım envanteri (bayraklar açık, kayıt → onboarding → takibe başla → ilk ana sayfa)
Eski tasarım: 0
- Ek karar (İlter yetkisiyle, görünüm katmanı istisnası): `Login` rotası artık `LoginGate` → `yeni_onboarding` açıkken YENİ `onboarding/v2/LoginV2` (aynı OTP/Apple/Google/18+/redirect mantığı), `KcalAiSignUp` rotası `SignupAIGate` → `SignupAIFlowV2` (karşılama → kod → ad+kullanıcı adı → fotoğraf+bio; aynı `useAuth` + `useKcalculateAiRegistration`), il kapısı `EkCityGate` → `SignupEatGate` → `SignupEatFlowV2` (şehir → harita doğrulamalı adres → telefon; aynı `useEatkcalRegistration` + eatkcal v2 `addressModel/addressGeocode/addressSave`). Bayrak kapalıyken kapılar eski ekranı AYNEN render eder.
- Eski dosyalar diff = 0 kanıtı: `git diff night14/visual -- src/screens/auth/UnifiedLoginScreen.tsx src/modules/profil/ui/signup/KcalAiSignUpScreen.tsx src/modules/profil/ui/signup/KcalAiSignUpRoute.tsx src/modules/profil/useRegistration.ts src/modules/profil/ui/screens/SignupEatScreen.tsx src/screens/AddressesScreen.tsx src/components/checkout/AddressVerificationSheet.tsx src/lib/{delivery,addresses,geo,deliveryRules,nearestLocation}.ts src/modules/eatkcal/v2/model src/modules/eatkcal/v2/ui src/modules/eatkcal/v2/screens/EkAddressAddScreen.tsx src/components/onboarding` → BOŞ (çıktı yok).
- Kontrol edilenler temiz: Onboarding 5 ekran, Takibe başla 7 ekran (+ sheet), IntroOverlay yeni bileşenler; ilk ana sayfa G14'te yeni kabukta.
Yeniden giydirilen (Final'de yok): kg/hafta kaydırıcısında 4 adımlı tempo seçimi korundu (veri aynı); Hesap'taki E-posta yolu korundu.

## Değişen dosyalar
`onboarding/components/{onbTheme.ts,OnbScaffold.tsx,pieces.tsx,UnderageView.tsx}`, `onboarding/OnboardingNavigator.tsx`, `onboarding/takibe/{TakibeNavigator.tsx,TbParts.tsx}`, `onboarding/intro/IntroOverlay.tsx`, `profil/ui/screens/SignupAIScreen.tsx` (yalnız logo), `core/i18n/dictionaries.ts` (onboarding/tb: `intent.note`, `underage.body`, `pace.min/max`, `how.*_desc`; `pace.projection` metni "Bu tempoyla hedefine").
Ek karar dosyaları (YENİ): `onboarding/v2/{FormScreen,LoginV2,LoginGate,loginLogic,SignupAIFlowV2,SignupAIGate,signupAILogic,SignupEatFlowV2,SignupEatGate,signupEatLogic}.ts(x)`, `v2/i18n/{login,signupAI,signupEat}.ts` (dictionaries'e `onboarding.v2.*` olarak bağlı), testler `v2/__tests__/*` (unit: login 9, signupAI 7, signupEat 10) + `v2/__component_tests__/*` (jest: Login 7, SignupAI 12, SignupEat 15; giriş başarılı/hatalı kod/sosyal iptal, kayıt adımları, adres adımı mock'larla, bayrak kapalı = eski ekran).
Değişen mevcut dosyalar (ENTEGRASYONA — S5/diğer oturumlar için not): `navigation/AppNavigator.tsx` (2 lazy import hedefi → kapılar), `eatkcal/v2/screens/EkCityGateScreen.tsx` (SignupEatScreen → SignupEatGate; bayrak kapalı yol aynı), `dev/screenCatalog.ts` + `dev/vitrinScreens.tsx` + `dev/__tests__/screenCatalog.test.ts` (adım çekimleri, yalnız dev).
Dev-only: `TbResult` rotası `vitrinHow` parametresi (yalnız `__DEV__`) — FinTbHow vitrini sheet açık başlar.

## SORULAR
1. **SignupEat telefon metni**: Final "Doğrulama kodu SMS ile gelir" diyor; mevcut akışta SMS doğrulaması yok (telefon adresle kaydediliyor). Uydurma vaat olmasın diye metin "Adresinle birlikte kaydedilir; kurye teslimat için kullanır." yapıldı. SMS doğrulaması kurulacak mı?
2. **SignupEat harita doğrulaması sıkılaştı**: v2'de pin kullanıcı bırakmadan/konum alınmadan "Devam" ilerlemez (eski adres ekranı varsayılan merkezi koordinat olarak kaydediyordu). Harita hiç açılamazsa elle ilçe/mahalle ile devam edilir. Bu sıkılık istenen mi?
2b. **Gate bayrağı**: kapılar `useFeature('yeni_onboarding')` kullanıyor (AppNavigator'daki `useColdStartFeature` dışa açık değil); oturum ortasında bayrak değişirse ekran değişebilir. Soğuk-açılış kilidi istenirse bayrak değeri prop olarak geçilir.
2c. **Giriş adımında Final'de olmayan "Vazgeç"** (handle/kod adımı) eski davranış olduğu için korundu.
3. **FinTbPace hedef tarihi**: akışta hedef kilo sorulmuyor, tarih hesaplanamaz; satır "—" gösteriyor. Hedef kilo adımı eklensin mi (Final'de yok) yoksa satır kalksın mı?
4. **Notify metni** (G14 SORULAR 1 ile aynı): "19:30'da hatırlat" vaadinin arkasında zamanlanmış bildirim yok; metin Final'deki gibi bırakıldı.
5. Tekerlek seçicide varsayılanlar 1995 / 170 cm / 70 kg (kullanıcı değiştirmeden geçebilir); açık rıza + cinsiyet yine zorunlu. Boş başlatma istenirse söyle.
6. `npm run test:unit`'te 1 test "atlandı" (G14'te 528/528 raporlanmıştı); bu oturumda eklenen/silinen test yok, atlanan test dev-paket (dist) gerektiriyor olabilir — doğrulanmadı.
