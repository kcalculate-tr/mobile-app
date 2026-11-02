# G3-S3 — Hareket motoru: Reanimated + cam (blur) + ışık (gradient)

Gece 3 · 3 Kasım · Dal: `night3/design-motion` (`night2/design-foundation`'dan açıldı) ·
Worktree: `.claude/worktrees/g3-s3`

Hareket motoru React Native `Animated`'ten **Reanimated 4 + worklets**'e taşındı.
Dışa açılan hook imzaları (`useEnter`, `usePop`, `useFloat`, `useBreath`,
`useSpringTo`) **değişmedi** — tüketici ekranlar yalnızca `Animated.View`'ı artık
`react-native-reanimated`'tan alır. Her animasyon **UI thread'de (worklet)** çalışır.

Doğrulama: `tsc --noEmit` = **0 hata** · `expo export --platform ios` = **başarılı**
(6.57 MB hbc bundle) · unit testler 252'den **249 geçti** (3 başarısız; aşağıda, hepsi
ödeme/webview — tasarımla ilgisiz, önceden kırık). Canlı ekranların davranışı
değişmedi (diff yalnız `src/core/design/*`, `__DEV__` vitrin ve `__DEV__`-korumalı bir
Profil menü satırı + paketler).

---

## Kurulan paketler (İlter onaylı, RULES §Güvenlik istisnası)

| Paket | Sürüm | Not |
|---|---|---|
| react-native-reanimated | ~4.1.1 | SDK 54 bundled; **Yeni Mimari (Fabric)** gerektirir — SDK 54'te varsayılan açık. |
| react-native-worklets | 0.5.1 | Reanimated 4'ün worklet çalışma zamanı (ayrı paket). |
| expo-blur | ~15.0.8 | GlassTabBar'ın cam zemini. |
| expo-linear-gradient | ~15.0.8 | **Zaten kuruluydu**; ışık süpürmesi + iç parıltı için kullanıldı. |

**Babel:** Projede `babel.config.js` yok; `babel-preset-expo` metro üzerinden
uygulanıyor. `babel-preset-expo@54` `react-native-worklets` kurulu olduğunda
`react-native-worklets/plugin`'i **otomatik** ekliyor (kaynak:
`node_modules/babel-preset-expo/build/index.js:287`). Elle babel yapılandırması
GEREKMEDİ; eklentinin eklenmesinin uygulamanın geri kalanını bozmadığı kurulumdan
hemen sonra `expo export` ile kanıtlandı (exit 0).

---

## UI thread'de çalışanlar (hepsi worklet)

Önceki temelde yalnız `opacity`/`transform` native driver'daydı; `strokeDashoffset`
ve SVG path çizimi **JS thread'deydi** (FOUNDATION §"Reanimated gerektirenler").
Artık hepsi worklet:

| İş | Nasıl | Önceki durum |
|---|---|---|
| `useEnter/usePop/useFloat/useBreath` | `useAnimatedStyle` (opacity/scale/rotate/translate) | native driver (zaten UI) → worklet |
| `useSpringTo` | `withSpring` + `useAnimatedStyle` | native driver → worklet, **velocity carry** |
| ProgressRing dolumu | `useAnimatedProps` → `strokeDashoffset` | **JS thread** (`useNativeDriver:false`) → **UI thread** |
| LogTrail (logla izi, kavisli yol) | `useAnimatedStyle` + worklet quadratic (sin ile yay) | yoktu (FOUNDATION'da yalnız düz yaklaşım) |
| DailyRing (tek çizgi üçe ayrılır) | `useAnimatedProps` (dasharray) + `useAnimatedStyle` (rotate/opacity) × 3 yay | yoktu |
| StreakMoment ("7" çizimi + halka) | `useAnimatedProps` → `strokeDashoffset` (path + circle) | yoktu (JS-thread gerektirirdi) |
| NumberRoll (sayı değişimi) | `useAnimatedStyle` (translateY + opacity, çift katman) | yoktu |
| GlassTabBar göstergesi | `useAnimatedStyle` (translateX + scaleX kurdele) | yoktu |

FOUNDATION'daki 4 "Reanimated gerektiren" madde (ProgressRing dolumu, logla izi
kavisi, seri anı çizimi, günlük halka ayrışması) — **dördü de** artık UI thread'de.

## Kesilebilirlik (interrupt)

- **Yay** (`useSpringTo`, GlassTabBar konumu): `withSpring` kesilince mevcut hızı
  taşır (velocity carry) — sıçrama yok.
- **Diğerleri**: yeniden tetiklenince `cancelAnimation(sv)` + yeni hedef; animasyon
  mevcut kareden devam eder (ani zıplama yok).

## Azaltılmış hareket + haptik

Her giriş/döngünün karşılığı opaklık + ≤8 px kayma, ≤200 ms (worklet içinde
`reduced` dalıyla). Döngüler (`useFloat/useBreath`) azaltılmışta `cancelAnimation`
ile durur ve statik son kareye oturur. Haptik sözlüğü (`selection/light/medium/
success`, success günde ≤3) aynen korundu; UI-thread callback'lerden `runOnJS(haptic)`
ile çağrılır. StreakMoment'te hero `success` haptiği azaltılmışta da çalar (kural).

---

## Performans — ölçülen / beklenen

- **Ölçüm simülatörde YAPILMADI**: yeni native modüller (reanimated/worklets/blur)
  yüklü bir **Debug build** gerektirir; bu gece native build/simülatör çalıştırılmadı
  (RULES: eas/native build yok, yalnız dosya + export). Aşağıdaki "İlter sabah" adımı.
- **Beklenen**: tüm animasyonlar UI thread'de sürüldüğü için JS thread (React render,
  liste, ağ) bloklansa bile 60/120 fps korunur. En büyük kazanç **ProgressRing** ve
  **SVG çizimleri** (StreakMoment/DailyRing): eskiden JS thread'de olan
  `strokeDashoffset` artık worklet'te — birden çok halka aynı anda dolduğunda eski
  temelde JS thread tıkanırdı, artık tıkanmaz.
- **Bundle**: hbc 6.57 MB (export çıktısı). Reanimated/worklets runtime'ı eklendi.

## ⚠️ Native rebuild gerekli

reanimated, worklets ve expo-blur **native modüllerdir**. Mevcut simülatör
build'inde bu modüller YOK → JS-only Fast Refresh **yetmez**, uygulama worklet
runtime'ı bulamayıp açılışta çöker. İlter'in bir kez **yeni Debug build** alması
gerekir (CLAUDE.md'deki `xcodebuild … build && simctl install` komutu). Ondan sonra
JS değişiklikleri yine Fast Refresh ile gelir.

---

## SORULAR / kalan kararlar

1. **Yeni Mimari (Fabric) teyidi.** Reanimated 4 yalnız Yeni Mimari'de çalışır.
   SDK 54 varsayılanı açık ve `app.config.js`'te `newArchEnabled:false` yok →
   açık varsayıyoruz. İlter yeni Debug build'de teyit etmeli (eski mimariye düşmüş
   bir kurulum varsa reanimated 3'e düşmek gerekirdi — gerekmiyor görünüyor).
2. **Reanimated sürümü (4 vs 3).** `expo install` SDK 54 ile **4.1.1** getirdi
   (worklets ayrı paket). Karar İlter'de değil, SDK pinlemesi getirdi; sorun olursa
   not düşülsün.
3. **GlassTabBar yalnız vitrinde.** Gerçek tab bar'a (`src/navigation`) hiç
   dokunulmadı. Üretime geçerse: güvenli alan (safe-area) + gerçek rota bağlama +
   `Tara` butonunun kamera akışına bağlanması gerekir.
4. **GlassObject ışık süpürmesi** nesnenin **sınır kutusunu** süpürür (gerçek alfa
   maskesi değil). Saydam PNG'lerde bu yeterli görünür; piksel-hassas maske
   istenirse `@react-native-masked-view` veya SVG mask gerekir (yeni paket → onay).
5. **StreakMoment "7"** örnek bir rakam; gerçek seri sayısı (ör. 14, 30) çok
   haneliyse tek-çizgi yazımı her rakam için ayrı path ister. Şimdilik hero demo.
6. **GlassObject PNG varlıkları** hâlâ yer tutucu (FOUNDATION §SORU 3) — tasarımdan
   cam nesne görselleri beklenir.
7. **Haptik "günde 3 success" sayacı** hâlâ bellekte (FOUNDATION §SORU 6) — kalıcı
   istenirse AsyncStorage'a taşınır.

## Başarısız 3 unit test (tasarımla İLGİSİZ)

`cardVerification`, `webviewResilience`, `checkoutScreenSafety` — hiçbiri
`core/design`/reanimated/motion import etmez. Örnek sebep: `cardVerification.test.ts:186`
`src/screens/PaymentScreen.tsx` kaynak dosyasını açmaya çalışıyor, bu dalda o dosya
yok (`ENOENT`). Yani dala/ortama özgü, **önceden var olan** kırıklar; bu oturumun
değişiklikleri sebep olamaz (değiştirilen dosyalar yalnız `src/core/design/*`,
`__DEV__` vitrin ve `__DEV__`-korumalı Profil satırı).

---

## İlter sabah için
1. **Yeni Debug build al** (native modüller için): CLAUDE.md'deki `xcodebuild …
   build && xcrun simctl install …` komutu. Sonra Metro + launch.
2. Profil → "🎨 Tasarım vitrini (DEV)" → her hareketi düğmelerle tek tek tetikle;
   açık/koyu + "Azaltılmış" anahtarıyla dene. GlassTabBar'da sekme değiştirip
   kurdele geçişini gör.
3. Yukarıdaki SORULAR'dan 1 (Fabric teyidi) ve 3 (tab bar üretim yolu) öncelikli.
