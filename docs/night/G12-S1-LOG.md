# G12-S1 — Kabuk, hareket, ortak bileşenler, Onboarding, Takibe başla, tanıtım

Dal `night12/shell-motion` · worktree `.claude/worktrees/g12-s1` · taban `night11/release`.
Tek tasarım kaynağı `design/final/Fin*`. Tüm yeni özellikler **bayrak arkasında**;
`yeni_onboarding` / `yeni_siparis` kapalı → uygulama bugünküyle (1.0.7) **AYNI**.

## Devam notu
Bu oturum gece kullanım limiti sonrası DEVAM. Önceki oturum madde 1 (FinMoTokens
v2 + FinMoMap + bayraklar, `dd4561a`) ve madde 2 (FinComponents ortak bileşenler,
`f4d226b`) commit etmişti; worktree temizdi (commit edilmemiş değişiklik yoktu).
Bu oturum madde 3, 5, 6, 7, 8, 9'u tamamladı.

## Yapılanlar (9 madde)
1. **Hareket (FinMoTokens v2 + FinMoMap)** — `dd4561a` (önceki oturum). DURATION/
   CURVE/SPRING/HAPTIC v2'ye hizalı, eski adlar takma ad; SHEET/MODAL/SCREEN
   config + MOTION_MAP kayıt tablosu; useHeaderCollapse.
2. **Ortak bileşenler (FinComponents)** — `f4d226b` (önceki oturum). Button 52/44,
   Chip, Card, Sheet (28 köşe/tutamaç/scrim/odak), Toast, EmptyErrorCard,
   MacroStrip, tipografi rolleri.
3. **Tab bar son hâli** — `8bf5689`. Aktif gösterge STROKE'SUZ; Ana sayfa↔eatkcal
   (+genel) geçişte JÖLE uzama (scaleX 1→1.6→1 fast 200). `logEvents.ts` olay
   sözleşmesi (kcal:logFlight / kcal:logUndo + emit yardımcıları). Logla izi A:
   başka sekmeden loglanınca uçan görsel Ana sayfa sekmesine iner (slow 500,
   aşma FinMoLogA), "+N" rozeti bouncy yayla (stroke'suz), "…loglandı · Geri al ·
   Gör" toast'ı. Azaltılmışta uçuş yok — rozet + toast (FinMoMap).
4. **Bayraklar** — `dd4561a`. `yeni_onboarding` + `yeni_siparis` registry'ye (false).
5. **Onboarding (FinOnb*)** — `afda78e`. `src/modules/onboarding/`: OnbScaffold
   (koyu zemin + bulanık lime ışık + süzülen cam nesne), pieces, OnboardingNavigator.
   Akış: Karşılama → Niyet → (Sipariş → eatkcal) / (Takip·İkisi → Bildirim ön
   ekranı → Hesap). Hesap MEVCUT auth'u çağırır (AuthContext signInWithApple/Google
   + resolvePostSocialAuth; e-posta → Login). Yeni → Takibe başla, dönen → Tabs.
   18 yaş engeli. Glass assetleri modül altına kopyalandı.
6. **Takibe başla (FinTb*)** — `95570c2`. `src/modules/onboarding/takibe/`: calc
   (saf, lib/nutrition servisi, unit-test'li), draft (zustand), save
   (user_nutrition_profiles + body_measurements upsert — NutritionProfileScreen
   kolon eşlemesiyle BİREBİR, yeni tablo yok), TakibeNavigator (hedef/tempo/beden/
   hareket/sonuç/ilk adım). Beden adımında açık rıza ZORUNLU + işaretsiz. Sonuç
   halkası (ProgressRing) + "Nasıl hesaplanır?" sheet. editGoal modunda Sonuç'tan
   kaydeder + geri döner.
7. **Mevcut müşteriye tanıtım (FinIntro/FinIntroOrder)** — `17a3dcb`.
   `src/modules/onboarding/intro/`: IntroOverlay (Sheet) + bir-kez storage. Yeni
   kabuk ilk açılışında OTURUMLU kullanıcıya bir kez; sipariş geçmişi olanda
   "Siparişe devam" → eatkcal (AI sorusu yok). Sinyal MEVCUT servisten
   (lib/reorder.fetchPastOrders, limit 1); yeni sorgu yok.
8. **Dev vitrin "Hareket haritası"** — `5138852`. DesignShowcase'te MOTION_MAP'in
   12 satırı; her satır token/haptik/azaltılmış gösterir + "Oynat" düğmesi hareketi
   preview kutusunda tetikler. Dev "Yeni uygulamayı aç" preset'i yeni bayrakları içerir.
9. **Testler + kontrol + LOG + DONE** — bu commit.

## Tasarım eşleşmesi
FinTabBar-rest/mid/min panelleri gerçek `TabBarR3`'ü render eder → bileşen = pano.
FinComponents ölçüleri Button/Chip/Card/Sheet/MacroStrip'te birebir. FinOnb* / FinTb* /
FinIntro* metinleri i18n'de (TR+EN) tam; akışlar panel sırasıyla.

## Bayrak kapalı (1.0.7) parite kanıtı
- `FLAG_DEFAULTS`: `yeni_onboarding`/`yeni_siparis` = false (flags unit testi HER
  bayrağın false olduğunu doğrular).
- AppNavigator: `yeni_onboarding` kapalı + oturumsuz → initialRoute **WelcomeGate**
  (bugünkü). Onboarding/TakibeBasla rotaları kayıtlı ama erişilmez.
- IntroOverlay yalnız `TabNavigatorR3` (yeni kabuk) içinde mount; bugünkü
  `CustomTabBar`/`TabNavigator` değişmedi (parite testi geçer).
- Tab bar: azaltılmış harekette uçuş yok; rozet yalnız logFlight olayıyla açılır.

## Kontrol
- `npm run typecheck` (hygiene + tsc) → **0**
- `npm run test:unit` → **437 pass** (yeni: takibe/calc 8)
- `npm run test:components` (jest) → **57 pass** (yeni: TabBarR3 "+N" rozeti/undo)
- `npx expo export --platform ios` → **OK** (onboarding cam assetleri bundle'da)

## ENTEGRASYONA (S4/S6)
- **Profil › Hedefim "Hedefi düzenle"** → `TakibeBasla { editGoal:true }` giriş
  noktasının bağlanması + mevcut profil değerleriyle ÖN DOLDURMA **S4'e** ait
  (ProfileScreen S4 sahipliğinde). Rota ve save hazır.
- Takibe başla "İlk adım" Tara/Keşfet derin girişleri (bugün Tara→AiScan, diğerleri
  →Tracker) **S6'da** kesinleşir (Keşfet rota kaydı bayrağa bağlı).
- `kcal:logFlight` / `kcal:logUndo` emitter'ları: **S2 (Keşfet)**, **S4 (Tara)**,
  **S5 (eatkcal)** `src/modules/shell/logEvents.ts`'ten import edip yayınlar.
- Glass assetleri S6 tekilleştirir (`design/final/glass/` → tek yer).

## İLTER'E
- Takibe başla **Tempo → hedef tarihi** projeksiyonu: panellerde hedef kilo girişi
  YOK; şu an ilk-kilo kilometre taşı (`daysToFirstKg`) gösteriliyor. Gerçek hedef
  tarihi için hedef kilo girişi + formül kararı gerekli.
- "Belirtmek istemiyorum" cinsiyeti hesapta `female` formülüyle sürüyor (servis
  yalnız male/female kabul ediyor); nötr bir formül istenirse söyle.
