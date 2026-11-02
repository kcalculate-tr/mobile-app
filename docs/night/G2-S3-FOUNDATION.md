# G2-S3 — Tasarım Temeli (FOUNDATION)

Gece 2 · 2–3 Kasım · Dal: `night2/design-foundation` · Worktree: `.claude/worktrees/g2-s3`

Yeni tasarım dilinin **kodda temeli**. Mevcut hiçbir ekranın görünümü/davranışı
değişmedi; her şey `src/core/design/` altında yeni dosya + yalnızca `__DEV__`'de
görünen bir vitrin. Hareket dili hâlâ TEST aşamasında, bu yüzden her değer tek
bir yerden (token) ayarlanabilir.

Doğrulama: `npx tsc --noEmit` = **0 hata**. Mevcut unit testlerin biri elle
çalıştırıldı (money.test.ts, 5/5 geçti) — ayrıntı için LOG'daki "Testler" notu.

---

## Oluşturulan dosyalar

### Token ve tema
- `src/core/design/tokens.ts` — ham palet (açık/koyu), boşluk (4pt), yarıçap,
  44pt dokunma hedefi, çizgi kalınlığı, yükseklik. Hiçbir ekran bu değerleri
  kopyalamaz; her şey buradan okunur.
  - Açık: bg `#F3F4F6`, surface `#FFFFFF`, ink `#0A0A0A`, secondary `#6B6B70`,
    line `#E9EBEE`.
  - Koyu: bg `#000000`, surface `#1C1C1E`, text `#F5F5F5`, secondary `#A1A1A6`,
    line `#2C2C2E`.
  - Lime `#C6F04F` **yalnız dolgu**, üstünde siyah yazı (`limeInk`). Açık zeminde
    lime *çizgi* gerekince okunur koyu lime `#4A6B00` (`limeLineOnLight`).
- `src/core/design/theme.ts` — açık/koyu anlamsal eşleme (`color.bg/surface/ink/…`),
  `buildTheme`, `useSystemTheme` (Appearance API → `useColorScheme`). Koyu temada
  gölge yerine yüzey tonuyla derinlik (`surfaceRaised`). Mevcut `constants/theme.ts`'e
  **dokunulmadı** — bu ayrı bir temel.
- `src/core/design/ThemeProvider.tsx` — `ThemeProvider` + `useTheme()`. Varsayılan:
  sistemi izle. `forceScheme` prop'u **yalnız vitrin** içindir (açık/koyu yan yana).
  Provider sarılmasa da `useTheme()` sisteme düşer; bileşenler tek başına çalışır.

### Yazı
- `src/core/design/typography.ts` — ölçek: `display / title / heading / body /
  caption`. Başlıklar **Bricolage Grotesque**, gövde **Plus Jakarta Sans**. Her
  kademe `TextStyle` + `scaleCap` (Dynamic Type tavanı: başlık az büyür ve satır
  kırılır, gövde serbest sarar). `DYNAMIC_TYPE_RULES` en büyük boydaki kırılma
  kurallarını not eder.
- `src/core/design/fonts.ts` — Bricolage font haritası. **Açılışta (App.tsx)
  yüklenmez**; yalnız kullanıldığı yerde (şimdilik yalnız vitrin) `useFonts` ile
  yüklenir → üretim açılış süresi etkilenmez.
- `assets/fonts/BricolageGrotesque-{Regular,Medium,SemiBold,Bold,ExtraBold}.ttf`
  + `assets/fonts/OFL.txt` — Atelier Triay resmî GitHub deposundan indirildi
  (`ateliertriay/bricolage`, varsayılan optik boy statik örnekler), OFL lisanslı.

### Hareket
- `src/core/design/motion.tsx` — **tek motor** (RN Animated, native driver).
  Ekranlar `Animated`'i doğrudan çağırmaz; motor bu dosyada kapalı kalır →
  ileride Reanimated'a geçiş yalnız burayı değiştirir (karar İlter'de, bu gece
  paket kurulmadı).
  - **Token'lar:** `DURATION` (micro 120 / standard 280 / emphasis 420 / heroMin
    900 / heroMax 1400), `TIMING` (enter 500, pop 360, float 3200, tilt 4800,
    glow 2400, sweep 700, logTrail 600, streak 1400, dailyRing 900, loading 1200),
    `CURVE` (enter = `bezier(0.34,1.56,0.64,1)`, move, out, in), `SPRING`
    (ai 260/24, eat 200/28, sheet 300/30 mass 0.8), `STAGGER` (list 40 ≤6 öğe,
    label 90, ringSplit 60, scanCorners 30), `HAPTIC` sözlüğü, `TRANSITION`
    (screen / sheet / toast / tab / listItem), `REDUCED` (200 ms, ≤8 px).
  - **Hook'lar:** `useEnter` (scale 0.85→1, rotate −6°→0, opacity 0→1, 500 ms),
    `usePop` (1→1.08→1, 360 ms + success haptik), `useFloat` (süzülme ±4 px 3.2 s
    + opsiyonel eğim ±2° 4.8 s), `useBreath` (parıltı 0.5→0.9, 2.4 s), `useSpringTo`
    (yay ile konuma git + varışta light haptik). Ayrıca `useReducedMotion`,
    `useDelayedPending` (göstergeyi yalnız >400 ms beklemede göster).
  - **Haptik:** `haptic('selection'|'light'|'medium'|'success')`. success = yalnız
    hero, **günde en fazla 3** (takvim günü ile sıfırlanır). Hata/uyarı haptiği yok.
  - **Azaltılmış hareket:** her giriş/döngünün karşılığı opaklık + ≤8 px kayma,
    ≤200 ms; haptik aynı kalır. `ReducedMotionProvider` ile bir alt ağaçta OS
    ayarına dokunmadan zorlanabilir (yalnız vitrin).

### Bileşenler (yalnız yeni, hiçbir ekrana bağlı değil)
- `components/AppText.tsx` — ölçek + tema rengi + Dynamic Type tavanı tek yerde.
- `components/LogPill.tsx` — tüm pill tek dokunuşla loglar (light haptik); sağda
  ayrı **44pt ⌄** bölmesi (seçenekler, selection haptik); **uzun basış = öğün
  seçimi**. Lime dolgu + siyah yazı. Dynamic Type'ta `minHeight` ile büyür.
- `components/Toast.tsx` — "Öğle'ye loglandı · Geri al · Gör". Üstten iner, bekler,
  çıkar (TRANSITION.toast). Geri al/Gör eylemleri selection haptik; **geri alma
  etkisi animasyonsuz** (kural). Mevcut `src/core/ui/Toast.tsx`'e dokunulmadı.
- `components/ProgressRing.tsx` — animasyonlu halka (react-native-svg). Dolum
  `strokeDashoffset`, TIMING.dailyRing (900 ms). Azaltılmışta anında oturur.
- `components/GlowDot.tsx` — nefes alan lime nokta = yükleniyor (useBreath).
- `components/GlassObject.tsx` — süzülen "cam" PNG; giriş + süzülme + eğim +
  parıltı halesi. Görsel yoksa kesik çizgili yer tutucu.
- `src/core/design/index.ts` — tek giriş noktası (barrel).

### Vitrin
- `src/screens/DesignShowcaseScreen.tsx` — **yalnız __DEV__**. Açık/koyu ve
  azaltılmış hareket anahtarlarıyla tüm bileşenleri + hareket demolarını gösterir.
  Bricolage fontları burada yüklenir.
- `src/navigation/AppNavigator.tsx` — `DesignShowcase` ekran kaydı **`__DEV__` ile
  koşullu** (üretim derlemesinde route hiç yok → canlıda erişilemez).
- `src/navigation/types.ts` — `DesignShowcase: undefined` route tipi.
- `src/screens/DevDiagnosticsScreen.tsx` — yalnız `__DEV__`'de görünen "🎨 Tasarım
  vitrini →" bağlantısı. Başka hiçbir davranış değişmedi.

---

## ⚠️ Reanimated gerektirenler (JS-thread animasyonları)

RN Animated yalnız `opacity` ve `transform`'u native driver'da sürebilir. Aşağıdaki
işler SVG prop'u / path çizimi olduğundan **JS thread'de** çalışır; yoğun kullanımda
takılma riski taşır ve Reanimated'a (veya react-native-svg'nin reanimated köprüsüne)
taşınması önerilir:

1. **ProgressRing `strokeDashoffset` dolumu** — şu an `useNativeDriver: false`.
   Tek halka için sorun değil; birden çok halka aynı anda dolarsa JS thread yük alır.
2. **"Logla izi" kavisli yol** — spec: öğe küçülüp hedefe **yay çizerek** gider.
   `useSpringTo` yalnız DÜZ çizgide yaklaşımı verir (native). Gerçek kavis (path
   boyunca hareket) JS-thread hesap ister → Reanimated.
3. **"Seri anı" çizimi** — spec: 900 ms çizim (`strokeDashoffset` ile path çizme)
   + 400 ms saçılma. Çizim kısmı SVG path animasyonu → Reanimated. (Bu bileşen
   henüz yazılmadı; token `TIMING.streak` hazır.)
4. **Günlük halkanın üç dala ayrılması / tarama köşeleri** — birden çok eşzamanlı
   stroke animasyonu; native transform ile yaklaşılabilir ama path bazlı olursa
   Reanimated.

Token'lar hazır olduğundan bu bileşenler yazıldığında yalnız motor katmanı
değişecek; ekran kodu etkilenmeyecek.

---

## Performans notları
- Tüm hook animasyonları (useEnter/usePop/useFloat/useBreath) **native driver**
  kullanır → JS thread'i bloklamaz.
- `useFloat`/`useBreath` sonsuz döngüler; azaltılmış hareket veya ekran kapanınca
  `loop.stop()` ile durdurulur (sızıntı yok).
- Bricolage açılışta yüklenmediği için **üretim cold-start süresi değişmedi**;
  5 TTF (~580 KB) yalnız vitrin açılınca yüklenir.
- Yükleniyor göstergesi için `useDelayedPending` (>400 ms) — kısa beklemelerde
  titreme yok.

---

## Eksik kalanlar / SORULAR

1. **Liquid Glass tab bar / bulanık yüzeyler** — gerçek "cam" bulanıklık `expo-blur`
   ister; bu gece **yeni paket yasak** olduğu için yapılmadı. GlassObject şu an
   bulanıklık değil, lime hale + süzülme ile "cam nesne" hissi veriyor.
   → SORU: expo-blur eklenmesine onay? (tab bar + sheet arka planı için.)
2. **"Işık süpürmesi" (700 ms, girişte)** — bir gradient maske katmanı ister
   (`expo-linear-gradient`). Paket yok → GlassObject'te uygulanmadı, token
   (`TIMING.sweep`) hazır. → SORU: expo-linear-gradient onayı?
3. **GlassObject PNG varlıkları** — şu an yer tutucu. Hangi cam nesne görselleri
   (tabak, yaprak, şişe…) kullanılacak? Tasarımdan PNG beklenir.
4. **Reanimated kararı** — yukarıdaki 4 madde için. Karar İlter'de; verilirse
   `motion.tsx` içine köprü yazılır, ekranlar dokunulmaz.
5. **Bricolage optik boy** — varsayılan (orta) optik boy statik örnekler alındı.
   Çok büyük display başlıklar için `96pt` optik boy daha uygun olabilir;
   gerekirse ek TTF indirilir.
6. **Haptik "günde 3 success" sayacı** bellekte (uygulama yeniden açılınca sıfırlanır).
   Kalıcı olması istenirse AsyncStorage'a taşınmalı. → küçük karar.

---

## İlter sabah için
- Vitrini görmek için: `__DEV__` derlemede DevDiagnostics ekranına git → "🎨 Tasarım
  vitrini". Açık/koyu + tam/azaltılmış hareketi oradan dene.
- Yukarıdaki SORULAR (özellikle expo-blur / expo-linear-gradient / Reanimated /
  PNG varlıkları) karara bağlı; cevaplanınca ikinci tur bileşenler (gerçek cam
  tab bar, seri anı, logla izi kavisi) yazılabilir.
