# G13-S3 — Entegrasyon: night13 → dondurma adayı

## ÖZET (10 satır)
Dal `night13/release` (taban `night12/release` `de3cb80`), worktree `.claude/worktrees/g13-s3-tmp`.
(1) Merge sırası: `night13/home` (`7cc000a`), `night13/eatkcal` (`b27cb3e`) — ÇAKIŞMA YOK (AppNavigator/dictionaries otomatik birleşti); her merge sonrası tsc 0.
(2) Bayrak kapalı = 1.0.7 kanıtı: KİMSE dosyaları (HomeScreen, Cart/Checkout/Payment/OrderSuccess, profile/*, cartStore, components/checkout, auth/**, lib/{paynkolay,payment,orders,activeOrder,reorder}, package.json, app.config.js) `git diff night10/release` → BOŞ.
(3) Tracker bayrak-kapalı snapshot (`TrackerScreen.flagOff`) DEĞİŞMEDEN geçti (snapshot 1/1).
(4) `ekV2RouteNames(false)=[]` ve `resolveHomeTab` kapalı=legacy: `src/modules/eatkcal/v2/__tests__/routeTable.test.ts` (unit içinde geçti).
(5) Kontrol: **tsc 0 · test:unit 520/520 · test:components 90/90 (21 süit, snapshot 1/1) · expo prebuild ios ✓ (ios/ gitignored, commit'lenmedi) · expo export ios ✓**.
(6) Paket boyutu: Hermes bundle **9.16 MB** (G13-S1 raporu 8.79 MB, G13-S2 9.1 MB; birleşik +yaklaşık 0.06–0.4 MB).
(7) graphify: kullanılmadı (çakışma çıkmadı, kod yapısı sorusu doğmadı; fayda ölçülemedi).
(8) Yeni paket / migration / eas / canlı DB işlemi YOK.
(9) SORULAR: yok.
(10) Son commit GERÇEK dosya `docs/night/G13-S3-DONE`.

## İlter'in yapacakları
> ONAY GEREKİR (CLAUDE.md "ONAYSIZ YASAK"): production build / mağaza gönderimi senin elinle.

### 1.1.0 derleme/gönderim (bu daldan)
```
cd ~/dev/kcal-mobile/.claude/worktrees/g13-s3-tmp   # ya da night13/release'i checkout et
npm ci
eas build --platform ios --profile production
eas build --platform android --profile production
eas submit --platform ios --latest
eas submit --platform android --latest
```
Sürüm `1.1.0` / versionCode 10 (`app.config.js` dokunulmadı).

### Bayraklar (hepsi kapalı gelir; `min_app_version='1.1.0'`)
Sıra: `20261105000400_g12_flags.sql` (G6-APPLY sırasıyla, tek tek) → `admin_set_flag` ile kademeli:
`yeni_kabuk` → kabulden sonra `yeni_onboarding` → `yeni_siparis` (eatkcal v2, Paynkolay ödeme yolu aynı).

### Simülatör ön ayarları (CLAUDE.md)
```
export DEVELOPER_DIR=/Applications/Xcode-26.app/Contents/Developer
# native build+kurulum ve Metro komutları CLAUDE.md "Yerel iOS geliştirme" bölümünde
```
Bayrakları yerelde açmak için `feature_flags` override (dev) ile `yeni_kabuk`, `yeni_siparis` aç; telefon test listesi: `INTEGRATION.md`, `G13-S1-LOG`, `G13-S2-LOG`.

### Not (G13-S2'den)
Eski ekranlardaki inline sipariş mantığının v2 kopyaları tek kaynağa indirilmeli (KİMSE dosyası olduğu için yapılmadı).
