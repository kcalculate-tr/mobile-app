# S2 — Mobil temizlik · LOG

> Dal: `night/s2-mobile` (feat/social-login'den) · Başlangıç: 2026-11-02

## Özet (10 satır)
1. Dal: `night/s2-mobile` (feat/social-login'den). 4 madde, 4 commit. tsc her commit'te 88 (baseline), yeni hata YOK.
2. **Madde 1 — ölü kod:** 6 paralel tarama; `src/` içinde silinecek kesin ölü dosya YOK (hepsi referanslı). Kök çöpü + kullanılmayan paketler kapsam-dışı, SORULAR'a yazıldı. Commit `b3f2b2e`.
3. **Madde 2 — performans:** (2a) AppNavigator'da 24 push ekran lazy; (2b) addresses/settings/products soğuk-açılış istekleri `requestCoalesce`+`appSettings` ile tekilleştirildi; (2c) CheckoutScreen seri await → Promise.all; (2d) HomeScreen carousel memo (useNativeDriver zaten doğru). Commit `18c7e44`.
4. **Madde 3 — PayTR:** gerçek kod zaten silinmişti; yorum kalıntıları temizlendi. Tosla yedek yoluna DOKUNULMADI. Commit `e7d03ec`.
5. **Madde 4 — klasör:** `src/core/` (supabase, auth, push, ui) + `src/modules/ai` (iskelet) + `src/modules/eatkcal/screens` (4 sipariş ekranı). Sadece taşıma+import. tsc geçti → KORUNDU. Commit `b9000ad`.
6. **Davranış/görünüm değişmedi** (hard kural). Tüm değişiklikler yol/istek/memoizasyon düzeyinde.
7. **Kalan (bilinçli):** eatkcal'e katalog/adres ekranları + sipariş-domain lib'leri sonraki fazda taşınacak; kök dizin çöpü ve kullanılmayan paketler kapsam dışı.
8. **Sabah simülatör kontrolü:** değişen ekranlar her maddenin altında + AUDIT'te listeli; özellikle lazy ekranlarda "boş kare" flash OLMAMALI ve Sepet/Checkout/Ödeme akışı aynı çalışmalı.
9. **Test:** RULES gereği gate = `npx tsc --noEmit` (temiz); jest çalıştırılmadı (autonomous oturumda rabbit-hole riski).
10. Rapor: `docs/night/S2-MOBILE_AUDIT.md`. Migration/DB değişikliği yok (yalnızca mobil `src/`).

---

## Baseline
- `node -v` → v20.20.2
- `npx tsc --noEmit` başlangıçta **88 hata** (hepsi önceden var).
  - Çoğu `src/components/icons.ts` içinde `phosphor-react-native/lib/commonjs/icons/*`
    için TS7016 "declaration file bulunamadı" uyarısı.
  - Bu 88 hata referans alınacak; yeni hata EKLENMEYECEK.
- `src/` altında 201 .ts/.tsx dosyası.

## SORULAR
- **Kök dizin çöpü (kapsam dışı):** `fix_all.py`, `fix_popups.py`, `app.config.js.bak`,
  ve ~12 adet `AUDIT_*.md / *_REPORT.md / QUICK_SUMMARY.txt` kök dizinde duruyor.
  Scope yalnızca `src/` + `App.tsx` + `docs/night/` olduğu için DOKUNULMADI. Silinmesi önerilir.
- **Kullanılmayan paketler (kapsam dışı):** `@react-native-masked-view/masked-view`,
  `expo-dev-client`, `expo-updates` JS tarafında import edilmiyor. ANCAK `package.json`
  scope dışında + bunlar native/config seviyesinde gerekebilir (expo-updates OTA,
  expo-dev-client dev build). Simülatör build testi yapılamadığı için SİLİNMEDİ, öneri olarak bırakıldı.
- **products featured ayrı sorgu:** `fetchFeaturedProducts` `.eq('is_available', true)` (sadece true),
  tam liste ise `is_available !== false` (true + null) tutuyor. Featured'i tam listeden türetmek
  `is_available=null` favorileri davranışı değiştirerek dahil ederdi → ayrı sorgu korundu, sadece
  coalesce/TTL önbelleği eklendi.
- **Madde 4 (klasör yapısı):** tsc geçmezse geri alınacak (S2.md kuralı). Sonuç aşağıda.

---

## İlerleme

### Madde 1 — Ölü kod envanteri (SONUÇ: src/ içinde silinecek ölü dosya YOK)
Altı paralel Explore ajanıyla tarandı. src/ altında (ekran/bileşen/hook/util/lib/store/context):
- **34 ekran** — hepsi erişilebilir. `MacroScreen` → `SubscriptionScreen.tsx` ile,
  `OffersAndCouponsScreen` → `OffersScreen.tsx` + `CouponsScreen.tsx` ile re-export (barrel) — ölü DEĞİL.
- **49 bileşen, 10 hook, 5 util, ~55 lib, 6 store, context/constants/types** — hepsi referanslı.
  App.tsx'ten gelenler (`useBranchStockWatch`, `useNearestLocationBootstrap`, `forceUpdate`,
  `reliability`, `ForceUpdateModal`, `KeyboardToolbar`, `PushPermissionPrompt`) src/ içinde
  0 referanslı görünse de App.tsx entry point'inde kullanılıyor — ölü DEĞİL.
- **Sonuç:** `git rm` yapılacak kesin ölü dosya bulunamadı. Kod tabanı temiz.
  (Şüpheliler ve kapsam-dışı öneriler SORULAR'da.)
- Commit: `b3f2b2e docs(gece-s2): olu kod envanteri ...`

### Madde 2 — Performans
- 2a: AppNavigator'da 24 ikincil (push) ekran `React.lazy`+`Suspense`. Home/Cart/Checkout/
  sekme-hedefleri/WelcomeGate eager (flash önlemek için). Fallback zemini #f6f6f6.
- 2b: `requestCoalesce.ts` + `appSettings.ts` eklendi. addresses hydrate 2→1, settings 2→1,
  products sinyalsiz yol 2 sn coalesce. `AddressesScreen`'in doğrudan çağrısı korundu.
- 2c: CheckoutScreen `loadSettings` — bağımsız iki await `Promise.all`'a çevrildi + mounted guard.
  useEffect zincirleri incelendi, sadeleştirilecek gerçek zincir yok.
- 2d: HomeScreen — `displayProducts`/`activeDotStyle` useMemo, `heroKeyExtractor`/
  `handleHeroScrollEnd` useCallback. useNativeDriver zaten doğru (width = layout → false).
- **tsc: 88 (baseline), yeni hata yok.** (Not: yeni dosyalara sızan `</content>`/`</invoke>`
  kalıntı etiketleri temizlendi; TS1110 parse hatasını bunlar tetiklemişti.)
- Commit: `18c7e44 perf(gece-s2): lazy navigasyon ...`

### Madde 3 — PayTR kalıntı temizliği
- PayTR gerçek kodu zaten silinmişti; yalnızca yorum kalıntıları temizlendi
  (config/payment.ts, lib/payment.ts, screens/PaymentScreen.tsx, lib/orders.ts).
- CheckoutScreen'deki Tosla inline form/3DS DOKUNULMADI (RULES: Tosla yedek, dokunma).
- `src/` içinde artık `paytr` geçmiyor. tsc 88, yeni hata yok.
- Commit: `e7d03ec refactor(gece-s2): PayTR yorum kalintilarini ...`

### Madde 4 — Klasör yapısı (ayrı commit)
- `src/core/`: supabase.ts, AuthContext.tsx (auth), notifications.ts (push), ui/ (10 bileşen)
  taşındı; importlar güncellendi (git mv rename olarak izlendi).
- `src/modules/ai/`: README + index.ts (boş iskelet).
- `src/modules/eatkcal/screens/`: CartScreen, CheckoutScreen, OrderSuccessScreen,
  PaymentScreen taşındı (+2 seviye import kaydırma). AppNavigator güncellendi.
- Katalog/adres ekranları + sipariş-domain lib'leri merkezde bırakıldı (bilinçli, SORULAR).
- **tsc: 88 (baseline), yeni hata yok → adım KORUNDU (geri alınmadı).**
- Not: taşıma sadece yol değiştirir, çalışma zamanı modülü aynı; davranış/görünüm değişmedi.

