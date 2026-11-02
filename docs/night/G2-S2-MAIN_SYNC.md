# G2-S2 — main ↔ feat/social-login birleştirme raporu

> Dal: `night2/main-sync` (feat/social-login'den) · Tarih: 2026-11-02
> Worktree: `.claude/worktrees/g2-s2` · Hiçbir şey main'e uygulanmadı.

## Sonuç (kısa)
`main`'de olup `feat/social-login`'de olmayan **25 commit** tek tek incelendi.
**Cherry-pick edilecek güvenli + gerçekten eksik commit YOK (0).** Nedeni: 25
commit'in tamamı ya (a) feat'te zaten patch-eşdeğeri var, ya (b) feat'in canlı
sosyal-giriş özelliğini geri alan revert'ler, ya da (c) feat'in daha ileri
sürümüne sahip olduğu eski kart/ödeme commit'leri. Bu yüzden `night2/main-sync`
içeriği = `feat/social-login` + yalnızca 2 adet **test altyapısı** düzeltmesi
(davranış/üretim kodu değişmedi; aşağıda).

- `main` HEAD: `48b49b6`
- `feat/social-login` HEAD: `06483b7` (canlı kod, main'den 206 commit ileri)
- Ayrım noktası (merge-base): `612685a` (2026-09-17)

## 25 commit'in sınıflandırması

Yöntem: `git cherry -v feat/social-login main` (patch-id eşdeğerliği) + her `+`
(feat'te eşdeğeri YOK görünen) commit için dosya-içeriği karşılaştırması
(`git diff main feat/social-login -- <yol>`).

### Grup A — Sosyal giriş revert'leri (3) → **ALINMADI** (feat'i bozardı)
main bir noktada sosyal-giriş serisini geri almış; feat ise bu özelliği canlı
taşıyor. Bu revert'ler alınırsa feat'in çekirdek özelliği (Apple/Google giriş)
silinir.

| commit | konu | geri aldığı (feat'te VAR) |
|---|---|---|
| `750d13f` | Revert: Login/kayıt Apple/Google butonları | `dceb62e` |
| `468568a` | Revert: GlassButton disabled görsel geri bildirim | `547bb39` |
| `b084851` | Revert: Apple + Google native sign-in altyapısı | `8c03e54` |

Üçünün de geri aldığı orijinal commit feat/social-login'de mevcut (doğrulandı).

### Grup B — Eski kart/ödeme commit'leri (11) → **ALINMADI** (feat daha ileri)
Bu commit'lerin dokunduğu tüm edge-function ve migration dosyaları feat'te
**aynı isimle zaten var**. İçerik karşılaştırması feat'in bu commit'lerin daha
gelişmiş halini taşıdığını gösteriyor; main'in sürümünü almak **gerileme** olur.

| commit | konu | durum (feat) |
|---|---|---|
| `6f3da42` | FAZ L — harita pin adres doğrulama (migration) | migration feat'te var; fark yalnız boş satır |
| `ee6752d` | CardStorageCardList procReturnCode teşhisi | `_shared/paynkolay-cards.ts` feat'te özdeş |
| `5633634` | ödeme yöntemi seçimi + saklı kartla 3D | feat'te özdeş/ileri |
| `c0e38e1` | kayıtlı kartla 3D ham JSON düzeltmesi | `_shared/paynkolay-3d.ts` feat'te özdeş |
| `d38c9da` | ortak iade servisi (aşama 2/6) | `_shared/paynkolay-refund.ts` özdeş |
| `cb28f04` | Kart Ekle edge fn verify_start/status (3/6) | `_shared/paynkolay-card-verification.ts` özdeş |
| `0571319` | Kart Ekle sweep + cron (4/6) | sweep fn özdeş; migration fark yalnız boş satır |
| `eb4ef3e` | Kart Ekle mobil/verify_cancel (5/6) | feat'te var |
| `d653b04` | kendi iptal günlük limite sayılmasın | özdeş |
| `52bb69b` | kart silme: listeye göre doğrula | `_shared/paynkolay-card-storage.ts` özdeş |
| `48b49b6` | Boss panel iade yeniden deneme (6/6) | `card-verification-refund-retry` özdeş |

**Kanıt (en net):** `supabase/functions/paynkolay-cards/index.ts` — main'de eski
`validate_coupon` (p_phone/p_items YOK), feat'te yeni `validate_coupon_v2`
(23.09 iyileştirmesi, p_phone + p_items) + `card_alias` kolonu. Main'i almak bu
iyileştirmeyi geri alırdı.

### Grup C — Zaten feat'te olan commit'ler (11) → **yapılacak bir şey yok**
`git cherry` bunları `-` ile işaretledi: feat'te patch-eşdeğeri mevcut (hesap
silme, kupon abuse, fingerprint, validate_coupon, paynkolay p_phone, FK fix,
adres fallback vb.). `84f106b 4be3d2a cbf5f4d fa0636a bd4dc53 bd3f6fb 82340e2
977dc0a 201478f f60cd10 e8e2830`.

### "main-only" görünen dosyalar — neden?
`comm` ile main'de olup feat'te olmayan ~60 yol çıkıyor (AuthContext, CartScreen,
LoginScreen, paytr-* edge fn vb.). Hepsi feat'in **yeniden yapılanmasının** sonucu
(S2-LOG madde 4/5): `src/context/AuthContext.tsx → src/core/`,
`src/screens/CartScreen,CheckoutScreen,PaymentScreen.tsx → src/modules/eatkcal/screens/`,
`LoginScreen.tsx → UnifiedLoginScreen.tsx`, `src/lib/supabase.ts → src/core/supabase.ts`;
`paytr-*` (Tosla yolu) feat'te bilinçli kaldırılmış. Bunlar 25 commit'in
getirdiği "kurtarılacak" dosya DEĞİL — feat'in güncel yapısı.

## night2/main-sync'te yapılan tek değişiklik: test altyapısı (2 commit)
Üretim davranışı değişmedi. feat'in yeniden yapılanması test altyapısını kırmış
(feat'te de kırık — sabah feat'e geri alınmalı, aşağıya bak):

- `0d6bed5` — restructure sonrası eski kaynak yolları:
  - 3 kaynak-tarayan test (`cardVerification`, `webviewResilience`,
    `checkoutScreenSafety`) `src/screens/PaymentScreen.tsx` /
    `../CheckoutScreen.tsx` okuyordu → `src/modules/eatkcal/screens/...`
  - `matchesPaynkolayReturn` import regex'i derinlikten bağımsız yapıldı
  - `jest.setup.js` supabase mock yolu `src/lib/supabase` → `src/core/supabase`
- `b2bed1b` — jest + test runner:
  - jest `moduleNameMapper`: jest-expo, tsconfig'deki **yalnız-tip** phosphor
    `paths` eşlemesini çalışma zamanına da uyguluyordu (commonjs → sadece `.d.ts`
    olan typescript dizini) → 4 bileşen testi yüklenemiyordu. commonjs'e
    kesin-eşleşen override eklendi.
  - `test:unit` script'i: node 20.20 `--test` glob genişletmiyor, tırnaklı desen
    hiçbir kabukta açılmıyordu → `find … | xargs tsx --test`.

## Kontrol sonuçları (worktree, node v20.20.2)
- `npx tsc --noEmit` → **0 hata**
- `npm run test:unit` → **294/294 geçti** (exit 0)
- `npm run test:components` → **4 suite / 30 test geçti** (exit 0)
- `npx expo export --platform ios --output-dir /tmp/g2s2-export` → **exit 0**
  - iOS bundle: `_expo/static/js/ios/index-….hbc` (6.52 MB), toplam 9.0 MB
  - Çıktı klasörü duruyor: **`/tmp/g2s2-export`** (silinmedi)

## Sabah: main'i bu dala eşitleme adımları (öneri)
`main` ve `feat` gerçekten ayrışmış (main'de istenmeyen 25 commit var), bu yüzden
fast-forward değil. feat canlı kod olduğundan hedef: main içeriği = `night2/main-sync`.

**Önerilen (tahrip etmeyen, geçmişi koruyan):**
```
git fetch                     # night2/main-sync push'landıysa
git switch main
git merge -X theirs night2/main-sync \
  -m "merge: main'i canlı feat/social-login + test düzeltmeleriyle eşitle"
# Ağacın gerçekten dala eşitlendiğini DOĞRULA (boş çıkmalı):
git diff night2/main-sync    # fark varsa -X theirs dışında kalan bir şey var; incele
npx tsc --noEmit && npm run test:unit && npm run test:components
git submodule update --init admin-panel   # pointer 016cffe'ye gelsin
git push origin main
```
`-X theirs`: çakışan her yerde feat/social-login tarafı kazanır (revert'lerin
sildiği sosyal-giriş dosyaları geri gelir; eski kart kodu feat'in yenisiyle
değişir). 25 commit geçmişte ata olarak kalır ama içerik dalla aynı olur.

**Alternatif (temiz lineer geçmiş istenirse — DİKKAT):** `git switch main &&
git reset --hard night2/main-sync && git push --force-with-lease`. main'in 25
commit'ini geçmişten siler ve force-push gerektirir. Yalnız main'in paylaşılan
bir dal olmadığından eminsen.

## Riskler
1. **(EN ÖNEMLİ) main'e sosyal giriş geri gelir.** main bu özelliği revert
   etmişti; eşitleme Apple/Google ile girişi main'de yeniden aktif eder. feat
   zaten canlı ve bu özelliği taşıyor, yani bu "gerçeğe yetişme"dir — ama App
   Store/entitlement tarafında bilinçli bir karar olmalı. **Onay gerekli.**
2. **Eski kart/ödeme kodu düşer.** Grup B commit'leri çöpe gider; feat'in
   `validate_coupon_v2` + `card_alias` + ileri iade/sweep sürümü kalır. Ödeme
   yalnız Paynkolay; Tosla yedeğe dokunulmadı. Gene de ödeme akışı canlıda
   feat'ten geldiği için risk düşük, ama sabah simülatörde Sepet→Checkout→Ödeme
   bir kez denenmeli.
3. **Backend cherry-pick kuralı.** CLAUDE.md "backend commit'leri main'e de
   cherry-pick edilir" diyor; burada tersine, main'in backend'i zaten feat'te
   (daha yeni) olduğu için ek cherry-pick gerekmedi. Migrationّlar
   staging'de test edilmedi (gece kuralı; yalnız dosya düzeyinde doğrulandı).
4. **Test düzeltmeleri feat'te YOK.** Bu 2 commit (`0d6bed5`, `b2bed1b`) feat'in
   de kırık testlerini düzeltiyor. `-X theirs` merge'inde feat tarafı kazandığı
   için test dosyaları feat'in (kırık) haliyle gelebilir → merge sonrası testleri
   çalıştır; kırıksa bu 2 commit'i feat'e de cherry-pick et:
   `git switch feat/social-login && git cherry-pick 0d6bed5 b2bed1b` (ayrı PR).

## admin-panel alt modül işaretçisi
| dal | admin-panel commit | tarih |
|---|---|---|
| main | `c43fad7` | 2026-09-16 |
| feat/social-login (= night2/main-sync) | `016cffe` | 2026-10-27 |

`c43fad7`, `016cffe`'nin **atası** → feat'in işaretçisi daha yeni ve ileri sarım
(ayrışma yok). night2/main-sync feat'in `016cffe` işaretçisini koruyor.
Eşitleme sonrası `git submodule update --init admin-panel` ile pointer `016cffe`'ye
gelir. **NOT:** Bu yalnız mobil reponun hangi admin-panel commit'ine baktığını
günceller (pointer ileri sarımı), admin-panel'in kendi dal merge'i DEĞİL —
CLAUDE.md'deki "admin-panel main merge yasak" kuralı ihlal edilmez. Yine de
`016cffe`'nin canlıdaki admin-panel olduğunu teyit et.

## SORULAR
- Risk 1 onayı: main'e sosyal giriş geri gelsin mi? (feat canlı olduğu için
  beklenen cevap evet, ama bilinçli onay lazım.)
- Eşitleme yöntemi: tahrip-etmeyen merge mi (öneri), yoksa reset --hard + force
  mu? main paylaşılan/korumalı bir dal mı?
- Test düzeltmeleri (`0d6bed5`, `b2bed1b`) feat/social-login'e de ayrı PR ile
  alınsın mı?
