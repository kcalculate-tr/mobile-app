# G15-S1 — Onboarding + Takibe başla + Tanıtım (Final eşleşmesi)

## ÖZET (10 satır)
(1) Dal `night15/onb` (taban `night14/visual`), worktree `.claude/worktrees/g15-s1`; simülatör "G15-1 iPhone" (kendi kopyam), Metro 8091.
(2) ONB sabitleri temaya bağlandı: `onboarding/components/onbTheme.ts` (Final `T` nesnesi Light + Dark birebir) → Onboarding ve Takibe başla artık açık/koyu.
(3) Ortak iskelet `OnbScaffold`: Final koordinatlarında cam nesneler (kase/ayak/damla/alev/kupa), iki lime ışık, geri oku, sayfa noktaları (Takibe başla'da başlık + 6 nokta), "Atla", yarı saydam kart + alt düğmeler.
(4) Onboarding: Intent'te seçili lime satır + tik + "3 kısa soru" notu + "Devam et" (önceden "Takip etmek" seçili); Account'ta Apple siyah / Google·E-posta çerçeveli; Notify'da iki düğme yan yana (ikisi de çip); Underage kart + açıklama + kalın satır + tema birincil rengi.
(5) Akış Final sırasına çekildi: Karşılama → Niyet → Hesap → Bildirim → Takibe başla (yeni kullanıcı); dönen kullanıcı Hesap'tan Tabs'a. Auth çağrıları aynı.
(6) Takibe başla: seçili lime kart + tik, siyah/beyaz "Devam et", kg/hafta kaydırıcısı (PanResponder, 4 adım, erişilebilir), tekerlek seçiciler (doğum yılı/boy/kilo), makro kartları, altı çizili "Nasıl hesaplanır?" + Final sheet metni, ikonlu yeşil daire satırlar + açıklamalar.
(7) FinIntro/IntroOrder: "Siparişin aynı yerde." kenarlıklı kart + çanta ikonu, "Sonra" çerçevesiz mürekkep metin. FinSignupAI: kcal. işareti eklendi.
(8) Kontrol: tsc 0 · test:unit 527 geçti / 1 atlandı (0 fail) · test:components 90/90 (snapshot 1/1, Tracker flagOff aynı) · `expo export --platform ios` ✓.
(9) Bayrak kapalı: değişen dosyalar yalnız `yeni_onboarding`/yeni kabuk yolunda (Onboarding, TakibeBasla, IntroOverlay, `yeni_kabuk` içindeki SignupAIScreen) + dictionaries'te onboarding/tb anahtarları; package.json/app.config/KİMSE dosyaları DEĞİŞMEDİ.
(10) Son commit GERÇEK dosya `docs/night/G15-S1-DONE`. Açık kalanlar SORULAR'da (Login eski tasarım, SignupAI/Eat 2.–3. adımlar, hedef tarihi).

## Pano tablosu (önce G14 → sonra G15) — görseller `.claude/night/out/g15/app/`
Doğrulama: ✓ = çekimi Final ile yan yana okudum; ◦ = aynı bileşen/iskelet, ölçü ve renk token'ları Final'den, tek tek göz karşılaştırması yapılmadı (Light/Dark çiftinin diğeri ✓).

| Pano | G14 | G15 | Not |
|---|---|---|---|
| FinOnbWelcome | büyük | aynı ✓ | |
| FinOnbWelcome-Dark | küçük | aynı ◦ | |
| FinOnbIntent | büyük | küçük fark ✓ | başlık ölçüsü (30→32 ayarlandı), satır iç boşluğu |
| FinOnbIntent-Dark | büyük | küçük fark ◦ | |
| FinOnbAccount / -Dark | büyük | küçük fark ◦ | Apple siyah (Dark'ta beyaz), geri oku, damla ölçüsü Final'de |
| FinOnbNotify | büyük | aynı ✓ | |
| FinOnbNotify-Dark | büyük | küçük fark ◦ | |
| FinOnbUnderage / -Dark | büyük | küçük fark ◦ | |
| FinTbGoal / -Dark | büyük | küçük fark ◦ | kupa, noktalar, lime + tik, Devam et |
| FinTbPace | büyük | küçük fark ✓ | hedef tarih satırı değeri "—" (SORULAR 3) |
| FinTbPace-Dark | büyük | küçük fark ✓ | |
| FinTbAbout | büyük | küçük fark ✓ | tekerlek ölçüleri |
| FinTbAbout-Dark | büyük | küçük fark ◦ | |
| FinTbActivity | büyük | küçük fark ◦ | |
| FinTbResult / -Dark | küçük/büyük | aynı ✓ (Dark) / ◦ | makro kartları, altı çizili link |
| FinTbHow | büyük | küçük fark ✓ | sheet başlığı 20 (Sheet ortak bileşeni, Final 24) |
| FinTbHow-Dark | büyük | küçük fark ◦ | |
| FinTbFirst / -Dark | büyük | aynı ✓ (Dark) / ◦ | |
| FinIntro / -Dark | küçük | küçük fark ✓ | sheet başlığı 20 (Final 24) |
| FinIntroOrder / -Dark | büyük | küçük fark ✓ | mock'ta geçmiş sipariş yoksa "Göz at/Sonra" (veri) |
| FinSignupAI / -Dark | büyük | büyük fark | yalnız 1. adım + logo; 2./3. adım ayrı ekranda (SORULAR 2) |
| FinSignupEat / -Dark | büyük / yok | büyük fark (değişmedi) | adres/telefon adımları KİMSE mantığı (SORULAR 2) |

## Eski tasarım envanteri (bayraklar açık, kayıt → onboarding → takibe başla → ilk ana sayfa)
Eski tasarım: 1
- `Login` rotası (`screens/auth/UnifiedLoginScreen`): Karşılama'daki "Zaten hesabım var" ve Hesap'taki "E-posta ile devam et" buraya gider. Auth dosyası olduğundan (kural: auth'a dokunma) yeniden giydirilmedi. → SORULAR 1.
- Kontrol edilenler temiz: Onboarding 5 ekran, Takibe başla 7 ekran (+ sheet), IntroOverlay yeni bileşenler; ilk ana sayfa G14'te yeni kabukta.
Yeniden giydirilen (Final'de yok): kg/hafta kaydırıcısında 4 adımlı tempo seçimi korundu (veri aynı); Hesap'taki E-posta yolu korundu.

## Değişen dosyalar
`onboarding/components/{onbTheme.ts,OnbScaffold.tsx,pieces.tsx,UnderageView.tsx}`, `onboarding/OnboardingNavigator.tsx`, `onboarding/takibe/{TakibeNavigator.tsx,TbParts.tsx}`, `onboarding/intro/IntroOverlay.tsx`, `profil/ui/screens/SignupAIScreen.tsx` (yalnız logo), `core/i18n/dictionaries.ts` (onboarding/tb: `intent.note`, `underage.body`, `pace.min/max`, `how.*_desc`; `pace.projection` metni "Bu tempoyla hedefine").
Dev-only: `TbResult` rotası `vitrinHow` parametresi (yalnız `__DEV__`) — FinTbHow vitrini sheet açık başlar.

## SORULAR
1. **Login eski tasarım**: UnifiedLoginScreen Final'e giydirilsin mi (auth dosyası, kural gereği dokunulmadı)? Ya da "Zaten hesabım var / E-posta" Final SignupAI e-posta adımına mı yönlensin (şu an Keşfet'e bağlı `KcalAiSignUp` rotası)?
2. **FinSignupAI 2./3. adım ve FinSignupEat**: gerçek akış `KcalAiSignUpScreen` (profil modülü) içinde; vitrin yalnız 1. adımı gösteriyor. Eat adres/telefon adımları KİMSE (adres mantığı). Bu panolar "aynı/küçük fark" hedefinin dışında kaldı.
3. **FinTbPace hedef tarihi**: akışta hedef kilo sorulmuyor, tarih hesaplanamaz; satır "—" gösteriyor. Hedef kilo adımı eklensin mi (Final'de yok) yoksa satır kalksın mı?
4. **Notify metni** (G14 SORULAR 1 ile aynı): "19:30'da hatırlat" vaadinin arkasında zamanlanmış bildirim yok; metin Final'deki gibi bırakıldı.
5. Tekerlek seçicide varsayılanlar 1995 / 170 cm / 70 kg (kullanıcı değiştirmeden geçebilir); açık rıza + cinsiyet yine zorunlu. Boş başlatma istenirse söyle.
6. `npm run test:unit`'te 1 test "atlandı" (G14'te 528/528 raporlanmıştı); bu oturumda eklenen/silinen test yok, atlanan test dev-paket (dist) gerektiriyor olabilir — doğrulanmadı.
