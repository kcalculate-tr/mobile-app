# Entegrasyon 2 — `night4/integration` (Gece 4)

Amaç: İlter yarın **tek bir Debug build** ile mağaza düzeltmeleri + hareket motoru +
güvenlik dosyalarını simülatörde test edebilsin. Taban: `feat/social-login` (06483b7).
`feat/social-login`'e merge YOK — her şey yalnız `night4/integration` dalında.
Push: `origin/night4/integration`.

## Alınan dallar (sırayla, `git merge --no-ff`)

| Sıra | Dal | Dal başı | Merge commit |
|------|-----|----------|--------------|
| 1 | `night2/security` | `3dabdcc` | `92764cd` |
| 2 | `night3/store-fixes` | `8eeb3b6` | `e96c375` |
| 3 | `night3/design-motion` (design-foundation dahil) | `1d463e5` | `850c507` |
| 4 | `night3/key-rotation` | `5e73872` | `a93d4e0` |

**Çakışma çıkmadı** — dört merge de `ort` stratejisiyle temiz birleşti. Ödeme / sepet /
sipariş / auth dosyalarına dokunulmadı; çözülecek çakışma olmadığı için Madde 2'deki
"abort + atla" kuralı devreye girmedi.

### İçerikler (öne çıkanlar)
- **night2/security** (`9299efe`, `3dabdcc`): RLS politikaları + fonksiyon yetkileri
  migration'ları (DOSYA; uygulanmadı). `0200_function_grants.sql` canlıda uygulanan
  sürümle eşitlendi (validate_coupon v1 + en_iyi_yorumlar revoke'ları ertelendi).
- **night3/store-fixes** (`4f2e7c0`, `b394c4a`, `b196d1d`, `43dee15`): iOS privacy
  manifest + Meta SDK ATT uyumu; yorumlara "Bildir" (UGC şikayet) akışı; yeni kayıtta
  18+ yaş onayı; bayat test yollarının düzeltilmesi (üretim/ödeme koduna dokunulmadı).
- **night3/design-motion** (`e42d874`, `8f3911d`, `4732b35`, `4be667b`, `49f9733`,
  `92843a7`): tasarım temeli (token/tema/yazı) + Reanimated 4'e taşınan hareket motoru +
  `__DEV__` Tasarım vitrini (DesignShowcaseScreen). Reanimated 4 / worklets / expo-blur
  lockfile'da (önceden onaylı), `npm ci` ile geldi.
- **night3/key-rotation** (`d278d3d`, `5e73872`): anahtar rotasyon envanteri + runbook +
  rotasyon migration'ı (DOSYA; anahtar değişmedi).

## Atlananlar ve nedeni
- **`night2/main-sync` merge EDİLMEDİ** (görev talimatı). İçindeki tek test düzeltmesi
  `b2bed1b` değerlendirildi:
  - Phosphor `jest.moduleNameMapper` düzeltmesi `night3/store-fixes`'teki `43dee15` ile
    **örtüşüyor** → talimat gereği cherry-pick edilmedi, atlandı.
  - Ancak `b2bed1b`'nin **ikinci, bağımsız** parçası (`test:unit` script'i) store-fixes'te
    yok ve gerekli: node 20.20'de `tsx --test "src/**/__tests__/**/*.test.ts"` tırnaklı
    glob'u **literal yol** sayıp 0 test çalıştırıyor ("Could not find ..."). Madde 4
    `test:unit` TAMAMI geçsin dediği için bu script hunk'ı ayrı commit olarak elle
    uygulandı (`e37eb64`): `find src -path '*__tests__*' -name '*.test.ts' | sort | xargs
    tsx --test`. Phosphor mapper'a dokunulmadı (zaten store-fixes'ten geliyor).
- `night4/feature-flags`, `night4/pro-iap` bu görevin kapsamı dışında (ayrı oturumlar).

## Küçük düzeltmeler (Madde 3, ayrı commit'ler)
- `f04e99a` — `branch-panel/.../KitchenScreen.tsx:145`: JSX metnindeki ters eğik çizgi
  ekranda görünüyordu → `⚠ {"Trendyol'a iletilemedi"}`. Satır 142'deki JS string'e
  (title attribute) dokunulmadı.
- `81a8ed6` — `CLAUDE.md`: simülatör UDID'si `31E99C6C…` → `C903CA49-48CB-4699-8C70-7ABDCD684CF6`
  (iPhone 17). 3 komut satırında değişti; `DEVELOPER_DIR=/Applications/Xcode-26.app/...`
  ön eki zaten mevcuttu (yol `ls /Applications` ile doğrulandı).
- `1a7f0fb` — `DesignShowcaseScreen.tsx:186`: vitrindeki "Logla" chip'i (LogTrail tetiği,
  yayı hedefe çizer) hedefini söylesin → **"Öğle'ye logla"**. Bu chip'in ayrı ⌄ segmenti
  yok (korunacak bir şey yok). LogPill bileşeninin kendi label'ı ("Izgara tavuk · 320 kcal",
  ayrı ⌄ segmentli) kasıtlı bırakıldı — yemek adını gösteriyor, ⌄ segmenti korundu.

## Kontrol sonuçları (hepsi `night4/integration` üzerinde)
| Kontrol | Sonuç |
|---------|-------|
| `npx tsc --noEmit` | **0 hata** (önce reanimated/expo-blur eksikti; lockfile'daki deps `npm ci` ile kuruldu) |
| `npm run test:unit` | **294/294 geçti** · 0 fail · 0 skip (3 kırık test — cardVerification, webviewResilience, checkoutScreenSafety — store-fixes `43dee15` yol düzeltmesiyle geçti) |
| `npx expo export --platform ios` | ✓ `dist-ios` (hbc 7.68 MB) |
| `npx expo export --platform android` | ✓ `dist-android` (hbc 7.70 MB) |
| `branch-panel`: `npm ci && npm run build` | ✓ `tsc -b && vite build` — 1802 modül, hata yok |

> Not: `dist-ios/` ve `dist-android/` yalnız doğrulama çıktısı — commit'lenmedi (untracked).
> Migration'lar yalnız DOSYA; staging'de test edilmedi, hiçbir yere uygulanmadı.

## İlter için simülatör test listesi

**Önemli:** Bu dal yeni native bağımlılıklar ekliyor (Reanimated 4, worklets, expo-blur).
`/ios` gitignore'da (CNG) ve bu worktree'de `ios/` yok → **önce prebuild** şart, yoksa
hareket bileşenleri çöker.

**0) Yeni Debug build (bu worktree'den, yeni UDID ile):**
```bash
export DEVELOPER_DIR=/Applications/Xcode-26.app/Contents/Developer
export PATH="/opt/homebrew/opt/node@20/bin:$PATH"
cd ~/dev/kcal-mobile/.claude/worktrees/g4-s1

# node deps zaten kuruldu; emin olmak için: npm ci
npx expo prebuild --platform ios        # ios/ + Pods (reanimated/worklets/expo-blur) üretir

cd ios && xcodebuild -workspace Kcalculate.xcworkspace -scheme Kcalculate \
  -configuration Debug -destination "id=C903CA49-48CB-4699-8C70-7ABDCD684CF6" \
  -allowProvisioningUpdates DEVELOPMENT_TEAM=A63MT69ASR CODE_SIGN_STYLE=Automatic build \
  && xcrun simctl install C903CA49-48CB-4699-8C70-7ABDCD684CF6 \
  ~/Library/Developer/Xcode/DerivedData/Kcalculate-*/Build/Products/Debug-iphonesimulator/Kcalculate.app

# Metro + aç (JS değişiklikleri Fast Refresh):
cd ~/dev/kcal-mobile/.claude/worktrees/g4-s1 && npx expo start --dev-client & \
  xcrun simctl launch C903CA49-48CB-4699-8C70-7ABDCD684CF6 com.kcalmobile.app
```

**Test adımları (sırayla):**
1. **Profil › Tasarım vitrini** (yalnız `__DEV__` menüde görünür): her hareket bileşenini
   tetikle — LogPill, "Öğle'ye logla" izi (yay), DailyRing, StreakMoment, NumberRoll,
   ProgressRing, Toast, GlassTabBar. Açık/Koyu tema geç. "Azaltılmış" (Reduced Motion)
   seç — animasyonlar kısalmalı/sönmeli, kırpışma/çökme olmamalı.
2. **Fabric / Yeni Mimari teyidi:** Metro log'unda Fabric'in açık olduğunu gör
   (Reanimated 4 yalnız Yeni Mimari'de çalışır; vitrin düzgün animasyon yapıyorsa Fabric
   aktiftir). İsteğe bağlı: Profil › (DEV) Diagnostics ekranı mimari bilgisini gösterir.
3. **Yorum "Bildir" akışı:** bir ürün/yorum detayında yorumu "Bildir" → sebep seç →
   gönder; teşekkür/kapanış görünmeli (UGC şikayet, Apple 1.2).
4. **Yeni kayıtta 18+ onayı:** YENİ hesapla kayıt ol → 18+ yaş onayı ekranı çıkmalı.
   Çıkış yapıp DÖNEN (mevcut) kullanıcıyla gir → 18+ onayı ÇIKMAMALI.
5. **Sepet:** ürün ekle, sepeti aç, adet değiştir — çalışmalı (üretim akışı, değişmedi).
6. **Ödeme ekranına kadar:** sepetten ödemeye geç; **gerçek ödeme YAPMA** — yalnız ödeme
   (Paynkolay) sayfasının açıldığını doğrula.
7. **Çıkış / Giriş:** oturumu kapat, tekrar gir (UnifiedLoginScreen) — sorunsuz olmalı.

## SORULAR
Yok — tüm maddeler tamamlandı, çözüm gerektiren açık karar kalmadı.
(Not: `b2bed1b` test:unit script'inin elle yeniden uygulanması yukarıda "Atlananlar"da
gerekçelendirildi; bu bir karar değil, Madde 4'ün zorunlu kıldığı düzeltme.)
