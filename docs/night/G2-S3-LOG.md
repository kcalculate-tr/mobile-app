# G2-S3 — LOG

## Özet (10 satır)
1. Yeni tasarımın kodda temeli kuruldu: `src/core/design/` altında token, tema, yazı, hareket ve 6 bileşen — **hepsi yeni dosya**.
2. **Mevcut hiçbir ekranın görünümü/davranışı değişmedi**; tek dokunulan üretim dosyası DevDiagnostics'e eklenen **yalnız __DEV__** bir vitrin bağlantısı.
3. Token: açık/koyu palet, lime yalnız dolgu + siyah yazı, açık zeminde lime çizgi `#4A6B00`, 4pt boşluk, 44pt dokunma.
4. Tema: sistem açık/koyu izleyen `useTheme` (Appearance API); `constants/theme.ts`'e dokunulmadı.
5. Yazı: Bricolage Grotesque (OFL, `assets/fonts/`) başlık + Plus Jakarta Sans gövde; display/title/heading/body/caption + Dynamic Type tavanları.
6. Hareket: tek motor `motion.tsx` (RN Animated, native driver) — token + hook (useEnter/usePop/useFloat/useBreath/useSpringTo) + useReducedMotion + haptik sözlüğü; ekranlar Animated'i doğrudan çağırmaz (Reanimated'a geçişe hazır).
7. Bileşenler: LogPill, Toast, ProgressRing (svg), GlowDot, GlassObject, AppText — vitrinde açık/koyu + azaltılmış hareketle denenebilir.
8. Vitrin: DevDiagnostics → "🎨 Tasarım vitrini"; ekran kaydı `__DEV__` ile koşullu (canlıda erişilemez), Bricolage açılışta değil orada yüklenir.
9. Doğrulama: `npx tsc --noEmit` = **0 hata**. Unit testler mevcut `tsx --test` glob'u bu kabukta açılmıyor (ÖNCEDEN gelen durum); tek dosya elle çalıştı (money.test.ts 5/5). Yeni test dosyası eklenmedi.
10. Dal: `night2/design-foundation` (2 commit: e42d874 temel, 8f3911d vitrin). Kaldı: expo-blur/linear-gradient/Reanimated/PNG kararları — bkz. SORULAR. İlter: vitrini dene, SORULAR'ı karara bağla.

---

## Yapılanlar (sırayla)

- Worktree `.claude/worktrees/g2-s3`, dal `night2/design-foundation` (`feat/social-login`'den). `npm ci` çalıştı.
- Bricolage Grotesque 5 ağırlık + OFL.txt `ateliertriay/bricolage` resmî deposundan `assets/fonts/`'a indirildi (TTF başlıkları doğrulandı, OFL lisanslı).
- `src/core/design/`: tokens.ts, theme.ts, ThemeProvider.tsx, typography.ts, fonts.ts, motion.tsx, index.ts + `components/`: AppText, LogPill, Toast, ProgressRing, GlowDot, GlassObject.
- Commit **e42d874** — `feat(tasarim): tasarim temeli …`. Öncesinde `tsc` = 0.
- `src/screens/DesignShowcaseScreen.tsx` (yalnız __DEV__) + motion'a `ReducedMotionProvider` + AppNavigator'da `__DEV__` koşullu route + types.ts route tipi + DevDiagnostics'e dev-only bağlantı.
- Commit **8f3911d** — `feat(tasarim): yalniz __DEV__ tasarim vitrini …`. Öncesinde `tsc` = 0.
- Ayrıntılı rapor: `docs/night/G2-S3-FOUNDATION.md` (dosya listesi, Reanimated listesi, performans, eksikler).

## Testler
- `npx tsc --noEmit`: **0 hata** (hem temel hem vitrin commit'inden önce).
- `npm run test:unit`: script'teki `tsx --test "src/**/__tests__/**/*.test.ts"` glob'u bu kabukta genişlemiyor ("Could not find …"). Bu **önceden gelen** bir script davranışı; bu oturumda `__tests__` dosyası eklenmedi, `lib/` dokunulmadı → regresyon değil. Toolchain sağlam: `npx tsx --test src/lib/__tests__/money.test.ts` → 5/5 geçti.

## SORULAR
(Hepsi `docs/night/G2-S3-FOUNDATION.md` → "Eksik kalanlar / SORULAR" altında ayrıntılı.)
1. **expo-blur** onayı? (Liquid Glass tab bar + sheet arka planı gerçek bulanıklık için — bu gece yeni paket yasağı yüzünden yapılmadı.)
2. **expo-linear-gradient** onayı? ("Işık süpürmesi" girişi için gradient maske gerekir; token hazır, efekt uygulanmadı.)
3. **Reanimated** kararı? strokeDashoffset/path (ProgressRing dolumu, seri anı çizimi, logla izi kavisi) JS-thread'de; Reanimated önerilir. Verilirse yalnız `motion.tsx` değişir.
4. **GlassObject PNG varlıkları** hangileri? Şu an yer tutucu.
5. Bricolage **96pt optik boy** çok büyük display için gerekli mi? (Gerekirse ek TTF.)
6. Haptik "günde 3 success" sayacı bellekte; kalıcı olsun mu (AsyncStorage)?
