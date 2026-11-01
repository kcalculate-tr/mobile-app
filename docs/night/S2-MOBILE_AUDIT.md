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
_(işlem sürüyor)_

## 4. Klasör yapısı
_(işlem sürüyor)_
