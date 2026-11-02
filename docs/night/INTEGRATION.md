# Gece 1 — Entegrasyon

## ÖZET
1. Mobil dal: `integration/night-1` (kcal-mobile, `feat/social-login` @ 973090b'den).
2. Panel dal: `integration/night-1` (admin-panel, `main` @ 40b6d13'ten).
3. Mobil: `night/s2-mobile` tamamen merge edildi; `night/s1-data`'dan yalnızca senkron commit'i, 0100 + 0300 migration'ları ve docs/night alındı.
4. Panel: `night/s3-panel`'den yalnızca 7 ölü dosya silme alındı; kupon ekranı alınmadı.
5. tsc: 88 hata (baseline ile aynı, hepsi `src/components/icons.ts` TS7016). Yeni hata yok.
6. Panel `npm run build`: GEÇTİ.
7. Hiçbir şey push edilmedi. Hiçbir migration uygulanmadı (staging yok → test edilmedi).
8. Kalan: telefonda test (aşağıdaki liste), 0100/0300'ün staging'de denenmesi, dışarıda kalanlar için karar.

---

## kcal-mobile — `integration/night-1`

| Commit | Ne |
|---|---|
| `4d1dd11` | `night/s2-mobile` merge (no-ff, çakışma yok) |
| `45114c1` | `1dcdc57` cherry-pick — canlıdaki 20 migration + 7 edge function repoya senkron |
| `3955174` | `night/s1-data`'dan 0100 + 0300 migration'ları (rollback'leriyle) + `docs/night/S1-*` |

### Alınanlar
- **night/s2-mobile (tamamı):** lazy navigasyon, soğuk açılışta istek tekilleştirme, checkout'ta `Promise.all`, anasayfa carousel memo, PayTR yorum kalıntıları temizliği (Tosla yedek yoluna dokunulmadı), klasör yapısı `src/core` + `src/modules/ai` + `src/modules/eatkcal`. Ayrıntı: `docs/night/S2-LOG.md`, `docs/night/S2-MOBILE_AUDIT.md`.
- **1dcdc57 (senkron):** canlıda zaten uygulanmış migration'lar ve edge function'lar repoya alındı. Yeni şema değişikliği değil.
- **20261102000100_products_availability_unify** (+ rollback): `products.is_available` kanonik alan, `in_stock` onun aynası olarak senkron tutulur.
- **20261102000300_fk_indexes_and_dupe_cleanup** (+ rollback): eksik FK index'leri + `product_option_groups`'taki çift UNIQUE/FK constraint'lerin kaldırılması. Not: tablo/kolon silmiyor ama 3 çift constraint düşürüyor; rollback geri ekliyor.
- **docs/night/\***: `S1-DB_AUDIT.md`, `S1-LOG.md`, `S1-SCHEMA_DUMP.md`, `S1-TRACKING_SCHEMA.md` (s1-data'daki son halleri; senkron commit'iyle gelen erken taslakların üzerine yazıldı).

### Dışarıda bırakılanlar ve neden
- **20261102000200_carts_and_cart_items** (+ rollback): sunucu taraflı sepet için yeni `carts` / `cart_items` tabloları. Mobil kodda bu tabloları kullanan hiçbir yer yok (`src/`'de `from('carts')` / `from('cart_items')` geçmiyor); sepet hâlâ AsyncStorage'da. Kullanan kod yazılmadan tabloyu açmanın faydası yok.
- **20261102000400_tracking_schema** (+ rollback): dosyanın kendi başlığında "TASLAK" diye işaretli; yeni `tracking` şeması API'ye açık değil ve mevcut tablolardan veri taşımıyor. AI/eatkcal ayrımı netleşince ayrıca ele alınmalı.
- Not: `docs/night/S1-LOG.md`, `S1-DB_AUDIT.md` ve `S1-TRACKING_SCHEMA.md` bu iki migration'dan da bahsediyor; dosyalar bu dalda yok, s1-data dalında duruyor.

### tsc
- `npx tsc --noEmit` → **88 hata, hepsi `src/components/icons.ts` içinde TS7016** (phosphor ikonları için tip dosyası bulunamadı). Başlangıçtaki baseline ile birebir aynı, yeni hata yok.
- Bu 88 hatanın kaynağı kod değil kurulum: worktree'de `node_modules` yokken tsc paketleri üst klasörden buluyor ama `tsconfig.json`'daki `paths` eşlemesi `./node_modules/phosphor-react-native/...`'e baktığı için tip dosyasını bulamıyor. Worktree'ye `node_modules` bağlanınca hem `feat/social-login` hem `integration/night-1` **0 hata** veriyor.

---

## admin-panel — `integration/night-1`

| Commit | Ne |
|---|---|
| `d2c70da` | 7 ölü dosya silindi |

### Alınanlar
Silinen dosyalar (hiçbiri `src/` içinde referans almıyor, `grep` ile doğrulandı):
- `src/components/AuthModal.jsx`
- `src/components/BottomNavLayout.jsx`
- `src/components/CustomerNotificationListener.jsx`
- `src/components/MacroProfileModal.jsx`
- `src/components/OnboardingTour.jsx`
- `src/pages/admin/AdminDashboard.jsx`
- `src/pages/admin/AdminLayout.jsx`

### Dışarıda bırakılanlar ve neden
- **`src/pages/admin/BossCoupons.jsx`**, **`App.jsx`'teki `/boss/kuponlar` route'u**, **`BossLayout.jsx`'teki "Kuponlar" menü öğesi:** kupon yönetimi zaten `BossVitrin.jsx` → "Kampanyalar" sekmesinde (`CampaignsTab`) var. S3 kendi raporunda bu çakışmayı yazmış (`docs/night/S3-PANEL_AUDIT.md` §3a, `night/s3-panel` dalında). Aynı tabloyu yöneten ikinci bir ekranı canlıya almadan önce karar gerekiyor.
- **`sql/vitrin_v3_coupon_targeting.sql`:** `campaigns`'a hedefleme kolonları ekliyor ve iki herkese-açık SELECT politikasını düşürüp yenisini kuruyor. RLS değişikliği; staging'de test edilmedi.
- **`docs/night/S3-LOG.md`, `S3-PANEL_AUDIT.md`:** kupon işini anlatıyorlar ve istenen listede yoktu; `night/s3-panel` dalında duruyorlar.

### Build
- `npm run build` → **GEÇTİ** (vite, PWA `dist/sw.js` üretildi).
- Not: paylaşılan `admin-panel/node_modules` Linux ikili dosyalarıyla kurulu (`@rollup/rollup-darwin-arm64` yok), bu yüzden orada build çalışmıyor. Worktree'de `npm ci` (yalnızca lockfile'dan, yeni paket yok, lockfile değişmedi) ile kuruldu.

---

## Telefon test listesi (İlter)

S2 navigasyonu lazy yükleme ve yeni klasör yapısına taşıdığı için her ekranın en az bir kez açılması önemli: bozuk bir import ancak ekran açılınca patlar.

- [ ] **Soğuk açılış** — uygulamayı tamamen kapat, aç. Splash → anasayfa takılmadan geliyor mu?
- [ ] **Giriş** — çıkış yap, tekrar giriş yap (e-posta + Apple/Google).
- [ ] **Ürün → sepet** — bir ürün aç, seçenek seç, sepete ekle. Sepet sayısı güncelleniyor mu?
- [ ] **Checkout** — sepetten Checkout'a geç. Ürünler, ara toplam ve teslimat bilgisi doğru yükleniyor mu?
- [ ] **Adres kontrolü** — adres seç/değiştir; teslimat bölgesi dışı adres uyarı veriyor mu?
- [ ] **Paynkolay 3D Secure** — kartla öde, 3D Secure sayfası açılıyor ve geri dönüyor mu?
- [ ] **OrderSuccess** — başarı ekranı doğru sipariş bilgisiyle geliyor mu?
- [ ] **Siparişler listesi** — yeni sipariş listede görünüyor mu?
- [ ] **Tracker** — sipariş takip ekranı açılıyor, durum doğru mu?
- [ ] **Profil → her alt ekran** — profildeki her satıra tek tek gir, geri çık.
- [ ] **Zorunlu güncelleme kontrolü** — açılışta sürüm kontrolü çalışıyor mu (eski sürüm uyarısı yanlışlıkla çıkmıyor mu)?
- [ ] **Koyu / açık tema** — sistem temasını değiştir; ekranlar doğru renkte mi?

---

## SORULAR
1. **Kupon ekranı:** `BossCoupons` ayrı ekran olarak mı kalsın, yoksa `BossVitrin → Kampanyalar` yeterli mi? Ayrı kalacaksa `vitrin_v3_coupon_targeting.sql` önce staging'de denenmeli.
2. **0100 / 0300:** staging oturumu olmadığı için hiç çalıştırılmadı. `supabase db push` öncesi staging'de denenmeli.
3. **0200 carts:** sunucu taraflı sepet istenirse, mobil sepet kodu yazılırken birlikte alınsın mı?
4. **tsc baseline:** worktree'lere `node_modules` bağlanırsa gerçek hata sayısı 0; baseline'ı 0 olarak güncellemek daha güvenilir bir kontrol olur.
5. **Submodule işaretçisi:** mobil `integration/night-1` dalındaki `admin-panel` işaretçisi güncellenmedi (hâlâ `feat/social-login`'deki commit). Panel entegrasyonu ayrı dalda.
