# G3-S3-LOG — Hareket motoru (Reanimated + blur + gradient)

## 10 satır özet
1. Hareket motoru RN `Animated` → **Reanimated 4 + worklets**'e taşındı; hook
   imzaları (`useEnter/usePop/useFloat/useBreath/useSpringTo`) AYNI kaldı.
2. Her animasyon artık **UI thread'de (worklet)**; FOUNDATION'daki 4 "Reanimated
   gerektiren" madde (ProgressRing dolumu, logla izi kavisi, seri anı çizimi,
   günlük halka ayrışması) dördü de çözüldü.
3. Yeni UI-thread bileşenler: **LogTrail, DailyRing, StreakMoment, NumberRoll,
   GlassTabBar** (expo-blur, yalnız vitrin) + GlassObject ışık süpürmesi & iç parıltı.
4. Vitrin her hareketi tek tek tetikleyen düğmelerle + "Azaltılmış" anahtarıyla güncel.
5. Paketler (İlter onaylı): reanimated 4.1.1, worklets 0.5.1, expo-blur 15.0.8
   (expo-linear-gradient zaten vardı). babel: `babel-preset-expo` worklets plugin'i
   otomatik ekliyor, elle babel.config GEREKMEDİ.
6. Kontrol: **tsc 0**, **expo export başarılı**, unit 249/252 (3 kırık ödeme/webview
   testi tasarımla İLGİSİZ, önceden kırık — kod import etmiyorlar).
7. **Canlı ekranlar değişmedi**: diff yalnız `src/core/design/*`, `__DEV__` vitrin ve
   `__DEV__`-korumalı 1 Profil menü satırı + paketler.
8. Kesilebilirlik (yay velocity carry + cancelAnimation), azaltılmış hareket ve
   haptik sözlüğü korundu.
9. ⚠️ **Native rebuild şart**: reanimated/worklets/blur native modül — İlter bir kez
   yeni Debug build almalı (Fast Refresh tek başına yetmez).
10. Dal: `night3/design-motion`. Ayrıntı + SORULAR: `docs/night/G3-S3-MOTION.md`.

---

## Yapılanlar (sırayla)

0. **Step 0** — g2-s3'teki commit edilmemiş "🎨 Tasarım vitrini (DEV)" Profil menü
   satırı (yalnız `__DEV__`) bu dala taşındı. → `4732b35`
1. **Paket kurulumu** — `npx expo install expo-blur react-native-reanimated
   react-native-worklets` (expo-linear-gradient zaten vardı). Kurulumdan hemen sonra
   `expo export` exit 0 ile babel worklets plugin'inin uygulamayı bozmadığı kanıtlandı.
   → `92843a7`
2. **Motor geçişi** — `src/core/design/motion.tsx` içi Reanimated'a taşındı
   (`useSharedValue/useAnimatedStyle/withTiming/withSpring/withRepeat/withSequence/
   cancelAnimation/interpolate/runOnJS`). `MotionStyle` tipi eklendi. Token'lar
   (DURATION/TIMING/CURVE/SPRING/STAGGER/HAPTIC/TRANSITION/REDUCED), `haptic()`,
   `useReducedMotion`, `ReducedMotionProvider`, `useDelayedPending` korundu. CURVE
   artık reanimated `Easing` (aynı bezier değerleri). ProgressRing `useAnimatedProps`,
   GlowDot/GlassObject reanimated `Animated.View`. GlassObject'e ışık süpürmesi
   (expo-linear-gradient) + iç parıltı sheen'i. Toast kendi RN Animated'inde kaldı
   (yalnız token import eder). → `4be667b`
3. **Yeni UI-thread bileşenler** + vitrin genişletildi (LogTrail, DailyRing,
   StreakMoment, NumberRoll, GlassTabBar; barrel + showcase düğmeleri). → `49f9733`

## Test sonucu
- `npx tsc --noEmit` → **0 hata**.
- `npx expo export --platform ios --output-dir /tmp/g3s3-export` → **başarılı**
  (job tmp'ye alındı; hbc 6.57 MB).
- `npx tsx --test src/**/*.test.ts` → 252 test, **249 geçti, 3 başarısız**.
  Başarısızlar: `cardVerification`, `webviewResilience`, `checkoutScreenSafety` —
  hiçbiri tasarım/motion import etmez; ör. `cardVerification` bu dalda olmayan
  `src/screens/PaymentScreen.tsx`'i açmaya çalışıyor (ENOENT). Dala/ortama özgü,
  önceden var olan kırıklar.
- Not: proje `test:unit` scriptinin glob'u (`src/**/__tests__/**/*.test.ts`) tsx'in
  kendi globbing'inde eşleşmiyor (`__tests__/**/` sıfır segment); testler zsh
  genişletmesiyle (`src/**/*.test.ts`) koşuldu. Script düzeltmesi İlter'in kararı
  (bu oturumun kapsamı dışı, dokunulmadı).

## SORULAR
Tümü `docs/night/G3-S3-MOTION.md` §"SORULAR / kalan kararlar" altında (Fabric teyidi,
reanimated sürümü, tab bar üretim yolu, ışık maskesi hassasiyeti, StreakMoment çok
haneli, PNG varlıkları, haptik sayacı kalıcılığı).

## İlter sabah için
1. Native modüller için **yeni Debug build** al (CLAUDE.md komutu), sonra Metro+launch.
2. Profil → "🎨 Tasarım vitrini (DEV)" → düğmelerle her hareketi dene; açık/koyu +
   "Azaltılmış"; GlassTabBar'da sekme geçişindeki kurdeleyi gör.
3. SORULAR'dan Fabric teyidi + tab bar üretim yolu öncelikli.
