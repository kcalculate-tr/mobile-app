# S2 — Mobil temizlik · LOG

> Dal: `night/s2-mobile` (feat/social-login'den) · Başlangıç: 2026-11-02

## Özet (bitince güncellenecek)
_(işlem sürüyor)_

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

</content>
</invoke>
