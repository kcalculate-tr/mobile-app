# S2 — Mobil Temizlik · Denetim Raporu

> Dal: `night/s2-mobile` (feat/social-login'den) · 2026-11-02
> Kapsam: yalnızca `src/`, `App.tsx`, `docs/night/`. Görünüm ve davranış değişmedi.
> tsc baseline: **88 önceden var olan hata** (çoğu `src/components/icons.ts` phosphor TS7016).
> Yeni tsc hatası eklenmedi.

Sabah simülatörde kontrol edilecek **değişen ekranlar** her maddenin sonunda listelidir.

---

## 1. Ölü kod envanteri

**Sonuç: `src/` altında silinecek kesin ölü dosya YOK.** Altı paralel tarama ajanı
ekran/bileşen/hook/util/lib/store/context/constants/types katmanlarını referans
sayımıyla doğruladı.

| Katman | Dosya | Durum |
|--------|-------|-------|
| Ekran | 34 | Hepsi erişilebilir |
| Bileşen | 49 | Hepsi referanslı |
| Hook | 10 | Hepsi referanslı |
| Util | 5 | Hepsi referanslı |
| Lib | ~55 | Hepsi referanslı |
| Store | 6 | Hepsi referanslı |

Dikkat çeken "görünüşte ölü ama değil" vakalar:
- `src/screens/MacroScreen.tsx` → `SubscriptionScreen.tsx` üzerinden re-export.
- `src/screens/OffersAndCouponsScreen.tsx` → `OffersScreen.tsx` ve `CouponsScreen.tsx` üzerinden re-export.
- `useBranchStockWatch`, `useNearestLocationBootstrap`, `lib/forceUpdate`, `lib/reliability`,
  `ForceUpdateModal`, `KeyboardToolbar`, `PushPermissionPrompt` — src/ içinde 0 referans,
  ama `App.tsx` entry point'inde kullanılıyor.

### Şüpheliler / kapsam dışı öneriler (silinmedi)
- **Kök dizin çöpü:** `fix_all.py`, `fix_popups.py`, `app.config.js.bak`, ~12 `AUDIT_*.md`/
  `*_REPORT.md`/`QUICK_SUMMARY.txt`. Kapsam dışı (kök dizin) → dokunulmadı, silinmesi önerilir.
- **Kullanılmayan paketler:** `@react-native-masked-view/masked-view`, `expo-dev-client`,
  `expo-updates` JS'te import edilmiyor. `package.json` kapsam dışı + native/config seviyesinde
  gerekebilir (OTA, dev build). Simülatör build'i test edilemediği için SİLİNMEDİ.

**Değişen ekran:** yok (yalnızca rapor).

---

## 2. Performans
_(işlem sürüyor)_

## 3. PayTR kalıntı temizliği
_(işlem sürüyor)_

## 4. Klasör yapısı
_(işlem sürüyor)_
</content>
