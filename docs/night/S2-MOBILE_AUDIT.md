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

### 2a — AppNavigator lazy loading
`src/navigation/AppNavigator.tsx`: stack'e PUSH edilen 24 ikincil ekran `React.lazy` +
`Suspense` ile code-split edildi. Fallback, stack içerik zemini (#f6f6f6) ile aynı renkte
bloklamayan bir `View`; sarmalayıcı (`withSuspense`) modül seviyesinde bir kez üretiliyor
(remount olmasın). **EAGER bırakılanlar** (görünüm/akış değişmesin diye):
- `Home`, `Cart`, `Checkout` — görevde hariç tutulanlar.
- Diğer sekme hedefleri `Tracker`, `Subscription`, `Profile` — sekme geçişinde slide
  animasyonu olmadığı için fallback "boş kare" gibi parlardı.
- `WelcomeGate` — oturumsuz soğuk açılışın ilk ekranı (initialRouteName).

Lazy ekranlarda görünür fallback riski yok: push geçişindeki slide animasyonu chunk
yüklenirken ekranı örtüyor.

### 2b — Soğuk açılışta tekrarlanan Supabase istekleri → tek yükleyici/önbellek
Yeni yardımcılar: `src/lib/requestCoalesce.ts` (anahtar + kısa TTL ile istek
tekilleştirme; hata önbelleğe alınmaz; AbortSignal'li çağrılar hariç),
`src/lib/appSettings.ts` (`fetchSettingsRow` — settings id=1 tek çekici).
- **addresses:** `hydrateSelectedAddress` (AuthContext soğuk açılışta 2× çağırıyor)
  artık `fetchUserAddresses`'i `hydrate-addresses:<userId>` anahtarıyla coalesce ediyor →
  2 eşzamanlı istek → 1. `AddressesScreen`'in doğrudan `fetchUserAddresses` çağrısı
  (ekle/düzenle sonrası taze liste) KORUNDU (farklı yol).
- **settings:** `forceUpdate.checkForceUpdate` + `businessHours.fetchBusinessHours` aynı
  satırı ayrı ayrı çekiyordu → ikisi de `fetchSettingsRow` üzerinden (5 sn coalesce) → 2 → 1.
  Hata/eksik satır → null → her iki çağıranın mevcut fail-open/DEFAULT davranışı birebir korundu.
- **products:** `fetchProducts` (sinyalsiz yol) 2 sn'lik coalesce ile korundu; yinelenen
  patlama istekleri birleşir, 2 sn insan pull-to-refresh gecikmesinin altında kaldığından
  manuel yenileme taze veri alır. `fetchFeaturedProducts` AYRI sorgu olarak bırakıldı
  (is_available semantiği farklı — SORULAR'a bakın).

### 2c — CheckoutScreen seri await → Promise.all
`src/screens/CheckoutScreen.tsx` `loadSettings` (useEffect `[rulesRefreshKey]`): bağımsız
`fetchBusinessHours()` ve `fetchGlobalDeliverySettings()` çağrıları `Promise.all` ile
paralelleştirildi; `if (!mounted) return` guard'ı eklendi (davranış korunur, iki dispatch aynı).
useEffect zincirleri incelendi: toplam 23 effect, çoğu bağımsız veri/alan-bazlı hata temizliği;
**sadeleştirilecek gerçek zincir bulunamadı** (bir effect'in TEK tetikleyicisi başka bir effect değil).

### 2d — HomeScreen hero carousel: memoization + useNativeDriver
`src/screens/HomeScreen.tsx`:
- `displayProducts` → `useMemo` ([searchText, products, featuredProducts]).
- `heroKeyExtractor`, `handleHeroScrollEnd` → `useCallback` (FlatList'e inline fonksiyon yerine).
- aktif nokta stili → `useMemo` (`activeDotStyle`).
- **useNativeDriver:** Carousel'deki tek Animated çağrısı aktif-nokta genişlik (`width`)
  animasyonu; layout prop olduğu için `useNativeDriver: false` ZORUNLU — DOĞRU, değiştirilmedi.
  Başka Animated çağrısı yok.

**tsc:** 88 (baseline) · yeni hata yok.

**Değişen ekranlar (sabah simülatörde kontrol):** Anasayfa (Home carousel memo),
Sepet Özeti/Ödeme (Checkout settings yüklemesi), + lazy'ye alınan tüm ikincil ekranların
AÇILIŞI: Kategoriler, Kategori Ürünleri, Marka Sayfası, Ürün Detay, Adresler, Sipariş Başarılı,
Fırsatlar, Giriş (UnifiedLogin), Beslenme Profili, Ölçüm Geçmişi, Ödeme (PaymentScreen),
Kişisel Bilgiler, Geri Bildirim, Sözleşmeler, Kuponlar, Sipariş Detay, Siparişlerim,
Kayıtlı Kartlar, Kart Ekle, Güvenlik, Bildirim Tercihleri, Destek, Yorumlarım, DevDiagnostics.
(Her biri açılışta normal görünmeli; "boş kare" flash OLMAMALI.)

## 3. PayTR kalıntı temizliği

**Önemli bulgu:** PayTR'ye ait gerçek KOD `src/` içinde zaten silinmişti (23.09.2026).
Geriye yalnızca tarihsel YORUM kalıntıları kalmıştı; onlar temizlendi. `src/` içinde artık
`paytr` (büyük/küçük) hiç geçmiyor (doğrulandı).

Temizlenen yorumlar (operatif Paynkolay/Tosla bilgisi KORUNARAK sadeleştirildi):
- `src/config/payment.ts` — PayTR kaldırma tarihçesi çıkarıldı; "tek sağlayıcı Paynkolay,
  env yok sayılıyor, Tosla yedek" bilgisi korundu.
- `src/lib/payment.ts` — eski ikinci-sağlayıcı (paytr_iframe) arkeolojisi tek satıra indirildi.
- `src/screens/PaymentScreen.tsx` — "PaytrPaymentFlow'dan türetildi / PayTR uri GET'ti"
  karşılaştırmaları çıkarıldı; Paynkolay akış açıklaması korundu.
- `src/lib/orders.ts` — deprecated JSDoc'taki "PayTR akışını kullan" → "ödeme akışını kullan".

**DOKUNULMAYANLAR (bilinçli):**
- CheckoutScreen'deki inline kart formu + 3DS WebView + `TOSLA_PROCESS_URL`: bunlar **Tosla**
  yedek yolu. RULES "Tosla yedek olarak duruyor, ikisine de dokunma" dediği için ELLENMEDİ.
- Panel/edge-function tarafındaki `paytr_oid` kolonu okumaları (branch-panel, supabase/
  functions): hem KAPSAM DIŞI hem de eski siparişler için geriye-uyumlu DB okuması
  (payment_status NULL iken "ödendi" tespiti) — korunmalı. (Panel etiket eşlemelerine dokunma kuralı.)

**tsc:** 88 (baseline) · yeni hata yok. **Değişen ekran davranışı:** yok (yalnızca yorum).

## 4. Klasör yapısı (ayrı commit)

Yalnızca **taşıma + import güncellemesi** yapıldı; davranış/görünüm değişmedi.
`tsc` adım sonunda **88 (baseline), yeni hata yok** → adım korundu (geri alınmadı).

### `src/core/` — ortak altyapı (iki servis de paylaşır)
| Yeni konum | Eski konum |
|---|---|
| `src/core/supabase.ts` | `src/lib/supabase.ts` |
| `src/core/AuthContext.tsx` (auth) | `src/context/AuthContext.tsx` |
| `src/core/notifications.ts` (push) | `src/lib/notifications.ts` |
| `src/core/ui/*` (10 bileşen) | `src/components/ui/*` |

Import güncellemesi: `lib/supabase`→`core/supabase`, `context/AuthContext`→`core/AuthContext`,
`lib/notifications`→`core/notifications`, `components/ui/`→`core/ui/` (prefix `../` korundu,
hepsi src'ye göre çözülüyor). `src/lib` içindeki `./supabase` → `../core/supabase`.
Taşınan dosyaların kendi iç importları düzeltildi (notifications `./navigation`→`../lib/navigation`,
ui `../icons`→`../../components/icons`, components'teki `./ui/`,`../ui/` → core/ui). `git mv`
rename olarak izlendi (geçmiş korunur).

### `src/modules/ai/` — Kcalculate AI (boş iskelet + README)
`README.md` + `index.ts` (`export {}`). Henüz kod taşınmadı; yalnızca servis sınırı.

### `src/modules/eatkcal/` — öğün siparişi
Sipariş akışının çekirdek ekranları taşındı: `screens/{CartScreen, CheckoutScreen,
OrderSuccessScreen, PaymentScreen}.tsx`. Depth +2 olduğu için her göreli-yukarı yol
(`'../`) + modül importları VE asset `require`'ları) tek tip +2 seviye kaydırıldı
(`'../`→`'../../../`); `./` kardeş importlar değişmedi. AppNavigator importerları yeni
konuma yönlendirildi.

**Bilinçli kapsam (SORULAR):** Katalog/adres/kampanya ekranları ve sipariş-domain lib'leri
merkezde bırakıldı (AI ile kısmen paylaşılıyor + geniş import yüzeyi). Sonraki fazda
`tsc`-doğrulanabilir şekilde taşınacak. Bu, tek gecede davranış-riskini sıfır tutma kararı.

**Değişen ekranlar (sabah simülatörde kontrol):** Sepet, Sipariş Özeti/Ödeme (Checkout),
Sipariş Başarılı, Ödeme (PaymentScreen) — taşındı ama davranış/görünüm aynı olmalı.
Ayrıca tüm uygulama: `core/` taşımaları supabase/auth/push/ui'ı kullanan HER ekranı
dolaylı etkiler (import yolu değişti, çalışma zamanı modülü aynı).
