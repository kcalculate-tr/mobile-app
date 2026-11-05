# G13-S2 — eatkcal yeni arayüzü `yeni_siparis` bayrağı arkasında

## ÖZET (10 satır)
eatkcal v2 (Fin panoları) `src/modules/eatkcal/v2/` altında yazıldı: ana sayfa+iskelet, mağaza, yorumlar, ürün,
sepet+kupon, tek sayfa sipariş özeti + ödeme bekliyor/başarısız/belirsiz, adres ekle/Adreslerim, bilgi sheet'i,
Siparişlerim+detay, hata kartları, il kapısı (SignupEatScreen mount). Rotalar `routes.tsx` → `AppNavigator`'a
YALNIZ `yeni_siparis` açıkken kaydolur (kapalıyken `ekV2Routes(false)=[]`, Home sekmesi bugünkü kuralla aynı).
Eski sipariş dosyaları (KİMSE) `git diff night12/release` → BOŞ; v2 dışında yalnız `AppNavigator.tsx` (+15/−1) ve
`dictionaries.ts` (yalnız `eatkcal.v2` eklemesi, 0 silme). Yeni sipariş/ödeme mantığı yok: özet MEVCUT
`createOrderDraftForPayment` + `PaymentScreen` (Paynkolay, 3D aynen) çağırır; aynı argüman jest kabul testiyle kanıtlı.
Kontrol: **tsc 0 · hygiene OK · test:unit 506/506 · test:components 80/80 · expo export ios ✓ (9.1 MB)**.
İLTER'E: eski ekranlardaki inline mantığın v2 kopyaları tek kaynağa indirilmeli (KİMSE dosyası olduğu için yapılmadı).
Son commit GERÇEK dosya `docs/night/G13-S2-DONE`. Dal `night13/eatkcal` (taban `night12/release`).

## Commit'ler (sırayla)
| Hash | Ne |
|---|---|
| `7f8dcf9` | iskelet: rota tablosu, nav tipleri, ortak kit, hata kartları (md.7, md.8) |
| `4ee8efb` | ürün detayı (md.3) |
| `cab4716` | sipariş özeti modeli + denetleyici (md.4, md.9) |
| `d6835aa` | Siparişlerim + detay (md.6) |
| `a5b24b1` | ana sayfa + iskelet, mağaza, yorumlar, il kapısı (md.1, md.2, md.11 SignupEat) |
| `e0db12d` | sepet + kupon sheet'i (md.4) |
| `e43cf41` | adres ekle / Adreslerim + bilgi sheet'i (md.5) |
| `cb5419e` | sipariş özeti tek sayfa + PayWait/Fail/Unknown (md.4) |
| `344e1dc` | AppNavigator `yeni_siparis` rota kaydı + Home sekmesi (md.11) |
| `7bb5bab` | i18n `eatkcal.v2` (TR+EN, 376 anahtar, eksik 0) |
| `28bfdc5` | kabul testleri (md.9) |
| `2621621` | özet: 0 TL sonrası boş-sepet geri dönüşü koruması |

## Madde madde
1. **Ana sayfa (FinEkHome/Skeleton)** — `screens/EkHomeScreen.tsx`, `ui/home/*`. Veri HomeScreen.tsx:161-167 ile aynı set
   (`fetchCategories`, `fetchProducts`, `fetchBannerRows`, `fetchFeaturedProducts`, `fetchBusinessHours`); canlı sipariş
   `fetchActiveOrder`/`subscribeToOrder`/`isDeliveredExpired` (HomeScreen.tsx:189-266 deseni), aşamalar `ORDER_STEPS`,
   "Ara" `tel:02323322100`, "Detay" → `EkOrderDetail`; Macro şeridi `fetchMacroProfile`/`fetchMacroSettings`/`macroProgress`;
   teslimat şeridi `addressStore.selectedAddress` + `fetchAllDeliveryZones`/`formatEstimatedDelivery`/`isShopOpenNow`;
   mağazalar `fetchBrand` (ürün `brand` alanından); popüler; yorumlar `vitrinYorumlariniGetir`; arama (yerel ürün filtresi);
   bilgi ikonu → `EkInfoSheet`. Gizli (veri yok): siparişe özel "Tahmini varış N dk", teslimde "Akşam'a loglandı · Gör".
   İl kapısı: ilk sipariş eylemi `readCityGatePassed()` false → `EkCityGate` (SignupEatScreen import + mount; onAllowed →
   `writeCityGatePassed()`); FinCityR1/WaitlistR1/EatBerlin mevcut `restoran_yakinda` + yerel "Haber ver" anahtarıyla
   (`eatkcal-nearby-interest-notified`, EatHomeScreen ile aynı); uydurma restoran listesi YOK.
2. **Mağaza + Yorumlar (FinEkStore/Reviews)** — `screens/EkStoreScreen.tsx` (`fetchBrand` + `fetchProductsByBrand`,
   BrandLandingScreen.tsx:66-69), hızlı "+" BrandLanding `handleAddToCart` zinciri (`needsOptionSelection` →
   `fetchProductOptionGroups` → `cartStore.addItem`). `ui/ReviewsSheet.tsx`: ortalama/dağılım/alt puan (Lezzet/Teslimat/
   Kalori uyumu)/KCAL yanıtı verisi YOK → gizli (sheet bu girdileri alır, veri gelince görünür).
3. **Ürün detayı (FinEkProduct/ProductScroll)** — `screens/EkProductScreen.tsx`, `ui/product/*`, `model/productModel.ts`.
   Gruplar alt alta, grup içi yatay kutular, görsel `fetchProductImagesByName` ya da çıkartma çerçevesi + ad; canlı makro
   halkaları + kaydırınca şerit (200 ms opaklık, azaltılmış harekette anında); zorunlu / en fazla N; alt sabit bar.
   Fiyat/makro/sepet satırı: `getEffectivePrice`/`hasDiscount`/`calculateOptionsPriceModifier`, `computeProductUnitMacros`/
   `computeBundleUnitMacros`, `normalizeSelectedOptions`/`buildCartLineKey` → `cartStore.addItem` (ProductDetailScreen ile
   aynı argüman; bundle + bağlı opsiyon dahil). Test: aynı seçim → aynı lineKey + unitPrice (`productModel.test.ts` 6/6).
4. **Sepet + kupon + özet** — `screens/EkCartScreen.tsx` (boş/iskelet: `cartStore.persist.hasHydrated`), `ui/CouponSheet.tsx`
   (CouponPickerSheet ile aynı: `fetchAvailableCampaigns`/`validateCoupon`/`getCouponErrorMessage`), kupon yeniden doğrulama
   CartScreen.tsx:207-247 ile aynı; "Siparişe devam" CartScreen.tsx:264-269 sırası (`refreshPrices` → değiştiyse "Fiyat
   değişti" kartı, `refreshMacros`). Özet `screens/EkCheckoutScreen.tsx` + `checkout/useEkCheckout.ts` +
   `model/checkoutModel.ts`: tek sayfa açılır bölümler (Yöntem·Zaman, Adres/Şube, İletişim, Not, Ödeme, Sepet), toplamlar,
   Macro kazancı, sözleşme satırı (checkbox 44×44, iki bağlantı `ProfileContracts`), CTA.
   **Ödeme durum eşlemesi** (`payStateFromOrder`, PaymentScreen dönüşünde MEVCUT `fetchPendingPaymentOrderById`):
   taslak/okuma sürüyor → PayWait "Ödemen onaylanıyor"; `payment_failed`|`failed` → PayFail "Ödeme alınamadı · Tekrar dene ·
   Başka kart"; `pending_payment` (PaymentScreen "doğrulanıyor/kontrol ediliyor" ya da vazgeçme) veya okunamadı → PayUnknown
   "Siparişlerim’e git" (+ eski ekran gibi tekrar deneme, ödenmiş siparişte KAPALI). Başarı PaymentScreen'in kendisi →
   OrderSuccess (değişmedi). Paynkolay dışı sağlayıcı → bugünkü `Checkout` ekranına `replace` (yeni ödeme yolu yok).
5. **Adres** — `screens/EkAddressAddScreen.tsx` (NoPerm: pini sürükle + `Linking.openSettings`; NoMap: `onMapReady` 10 sn
   gelmezse metinle giriş), `screens/EkAddressesScreen.tsx` (boş, silme onayı, `selectMode` → `EkCheckout{selectedAddressId}`),
   `ui/InfoSheet.tsx` (FinEkInfo; SSS verisi YOK → SSS sekmesi gizli). Kayıt/silme/varsayılan/ilçe-mahalle eşleşmesi
   AddressesScreen.tsx + AddressVerificationSheet.tsx mantığının birebir kopyası (`model/addressModel.ts`, `addressSave.ts`,
   `addressGeocode.ts`; kaynak satırlar yorumlarda), `matchToOption`, `normalizeAddress`, `useAddressStore`. Kayıt hatası →
   "Adres kaydedilemedi · Tekrar dene" kartı.
6. **Siparişlerim + detay** — `screens/EkOrdersScreen.tsx`, `EkOrderDetailScreen.tsx`, `model/orders*.ts`. Sorgular
   OrdersScreen.tsx:116-131 / OrderDetailScreen.tsx:190-197 ile aynı select; "Tümü" bugünkü gibi `cancelled` içermez;
   "Tekrar sipariş ver" `reorderToCart` → `EkCart`; değerlendir `fetchPendingFeedbackOrder` + `submitOrderReview`
   (HomeScreen.tsx:271 ile aynı alanlar; alt puan şemada yok → gizli); değişiklik talebi bugünkü `OrderDetail` ekranına
   gider; destek Ara / Talep oluştur (`ProfileSupport`). Teslim anı (FinMoDeliver): son nokta `usePop` + başarı haptiği.
7. **Hata kartları (FinEkErrors)** — `ui/ErrorCard.tsx` + `model/errors.ts`: kupon → `CouponValidationReason`
   (validate_coupon_v2, mesaj `getCouponErrorMessage`), stok → `findClosedCartItemNames` (+ sunucu
   `trg_orders_stock_guard_insert`), fiyat → `cartStore.refreshPrices()`, adres → Supabase insert/update hatası. Tek kart:
   başlık · tek satır · tek aksiyon.
8. **routes.tsx** — `src/modules/eatkcal/v2/routes.tsx` (bileşenler, tembel yükleme) + `routeTable.ts` (saf: 9 rota adı,
   `ekV2RouteNames`, `resolveHomeTab`), tipler `nav.ts` (`EkV2ParamList`; `navigation/types.ts`'e dokunulmadı).
9. **Kabul** — aşağıda.
10. **Testler + kontrol** — aşağıda.
11. **AppNavigator** — `HomeTabScreen`: `resolveHomeTab({ yeniSiparis, restoranYakinda })` (kapalıyken eskisiyle aynı
    karar); stack: `{ekV2Routes(yeniSiparis).map(...)}`; `yeniSiparis` = `useColdStartFeature('yeni_siparis')` (oturum
    ortasında gezgin değişmez, yeni_kabuk/yeni_onboarding ile aynı desen). Başka satır değişmedi.

## 9) Kabul
**Aynı sepet → aynı toplam (birim + jest):**
- `__tests__/checkoutModel.test.ts` (10/10): `computeCheckoutTotals` = CheckoutScreen.tsx:705-722 formülü (6 senaryo:
  eve/gel-al, hemen/randevulu, kupon, 0 TL, ücretsiz eşik); min sepet :806-810; engel mesajları :812-870 metinleri AYNEN;
  bölge kuralı :1298-1395; Sepet toplamı CartScreen.tsx:253.
- `__component_tests__/acceptance.test.tsx` (4/4): GERÇEK `cartStore` (addItem; indirimli ürün + ekstra fiyatlı seçenek +
  kupon) → eski Sepet ve eski Özet formülü = v2 (4 yöntem×zaman kombinasyonu).

**Aynı ödeme fonksiyonu çağrısı (jest):** `useEkCheckout().placeOrder()` → MEVCUT `createOrderDraftForPayment` bugünkü
handleCreateOrder'ın (CheckoutScreen.tsx:1746-1770) geçtiği alan alan AYNI argümanla çağrılır; dönüş `PaymentScreen`
parametreleri :1835-1840 ile aynı (`{orderId, amount, orderCode, ...buildPaymentNavParams}`); sözleşme onayı yokken hiç
çağrılmaz; PaymentScreen dönüşü `fetchPendingPaymentOrderById` → `payment_failed` = "Ödeme alınamadı".

**Mükerrer sipariş — mevcut mekanizma engelliyor mu? EVET (aynı oturumda), kanıt testte:**
1. Taslak varken aynı sepet + bağlam → `computeCartSignature` aynı → AYNI taslak yeniden kullanılır, yeni sipariş
   açılmaz (`updateOrderPaymentStatus(pending)`); sepet değişince eski taslak `cancelStaleOrderDraft` ile iptal, yeni taslak
   (CheckoutScreen.tsx:1700-1717 ile aynı) — jest'te 1. basış 1 taslak, 2. basış 0 yeni taslak, sepet değişince iptal + 1.
2. PaymentScreen açıkken (`payState='wait'`) ikinci ödeme başlatılamaz (jest: `blocked`, taslak sayısı değişmez).
3. `placing` sırasında düğme pasif; PaymentScreen `handledRef` tek sonuç işler (değişmedi).
4. Ödenmiş siparişte (`paymentStatus='paid'`) tekrar ödeme kapalı (`payStateAllowsRetry`).
Sınır (bugünkü davranışla aynı): taslak kimliği bellekte; uygulama yeniden açılırsa aynı sepet yeni bir `pending_payment`
taslağı açabilir — ödeme her taslak için ayrı kullanıcı eylemi, çift çekim olmaz; bekleyen taslaklar mevcut cron ile 10 dk
sonra `expired` (PaymentScreen.tsx yorumu). → İLTER'E 5.

**Güncelleme kabul listesi — hangi depo, kayıp 0** (v2 YENİ depo açmaz; hepsi bugünkü kaynaktan okur):
| Veri | Kaynak (v1 ve v2 aynı) | Kayıp |
|---|---|---|
| Oturum | Supabase auth, AsyncStorage `persistSession` (`src/core/supabase.ts:9-11`) → `useAuth()` | 0 |
| Sepet + kupon | zustand persist `kcal-cart` v5 (`src/store/cartStore.ts:360`) — v2 aynı store'u okur/yazar | 0 |
| Seçili adres | zustand persist `kcal-selected-address` (`src/store/addressStore.ts`) + `addresses` tablosu | 0 |
| Teslimat bağlamı | `kcal-delivery-context` (`src/store/deliveryContextStore.ts:73`) — v2 yazmaz | 0 |
| Aktif sipariş | sunucu `orders` (`fetchActiveOrder`/`subscribeToOrder`) | 0 |
| Kayıtlı kart | sunucu (Paynkolay kart aynası, `getCardsFeatureStatus`/`syncSavedCards`) | 0 |
| Macro | sunucu (`fetchMacroProfile`/`fetchMacroSettings`) | 0 |
| İl kapısı | AsyncStorage `eatkcal-city-gate-passed` / `eatkcal-city-notify` (`cityGateStorage.ts:7-8`) | 0 |
| "Haber ver" (yakında) | AsyncStorage `eatkcal-nearby-interest-notified` (EatHomeScreen ile aynı) | 0 |
Bayrak açılıp kapansa da (soğuk açılışta) aynı depolar → v1↔v2 geçişinde sepet/adres/oturum korunur.

**Bayrak kapalı = bugünkü akış:**
- `__tests__/routeTable.test.ts` (5/5): `FLAG_DEFAULTS.yeni_siparis=false`; `ekV2RouteNames(false)=[]`;
  `resolveHomeTab({yeniSiparis:false,…})` → `legacy`/`eatHome` (bugünkü kural); rota adları kök rotalarla çakışmaz;
  AppNavigator v2'yi yalnız bu iki fonksiyonla kaydeder, v2 ekranını doğrudan import etmez.
- `git diff --quiet night12/release -- <KİMSE>` → **BOŞ** (HomeScreen, `src/modules/eatkcal/screens/*` (Cart/Checkout/
  Payment/OrderSuccess), `src/lib/{paynkolayReturn,payment,paymentDrop,paymentHtml,checkoutPayment,cart,cartSignature,
  cartSuggestions,orders,activeOrder,reorder}.ts`, `src/store/cartStore.ts`, `src/components/checkout/**`,
  `src/screens/profile/{Orders,OrderDetail,SavedCards,AddCard,Coupons}Screen.tsx`, `src/screens/auth/**`, `package.json`,
  `package-lock.json`, `app.config.js`).
- `git diff --name-only night12/release` v2 dışında yalnız: `src/navigation/AppNavigator.tsx`, `src/core/i18n/dictionaries.ts`
  (iki hunk, ikisi de `eatkcal:` bloğunun içine ekleme; silme 0).

## 10) Kontrol
- `npx tsc --noEmit` → **0** · `npm run hygiene` → OK (968 dosya).
- `npm run test:unit` → **506/506** (v2: checkoutModel 10, productModel 6, homeData 9, orders 11, addressModel 13,
  addressInfo 3, routeTable 5).
- `npm run test:components` → **80/80** (18 süit; +4 `eatkcal/v2/__component_tests__/acceptance.test.tsx`).
- `npx expo export --platform ios` → ✓, bundle **9.1 MB** (G12: 8.73 MB → +0.37 MB; tamamı tembel yüklenen v2 modülü + i18n).
- i18n: v2'de kullanılan 376 literal anahtarın hepsi TR ve EN'de var (eksik 0).

## İLTER'E
1. **Tek kaynağa indirme (en önemli).** Bugünkü ekranların içinde duran ve lib'de karşılığı olmayan mantık v2'ye BİREBİR
   kopyalandı (her fonksiyonda kaynak satır yorumu var). KİMSE dosyaları olduğu için ortak lib'e taşınmadı; ayrışma riski var:
   - CheckoutScreen.tsx: bölge satırı seçimi + allow/teslim günü ayrıştırma (:154-158, :1298-1395), settings.min_cart_amount
     okuması, handleCreateOrder orkestrasyonu (:1524-1898), checkoutBlockMessage metinleri, TIME_SLOTS → `v2/model/checkoutModel.ts`,
     `v2/checkout/useEkCheckout.ts`, `v2/checkout/data.ts`.
   - ProductDetailScreen.tsx:311-811 seçim/gramaj/bağlı opsiyon/bundle yapıştırıcısı → `v2/model/productModel.ts`.
   - AddressesScreen.tsx (bölge dizini, eşleşme, kayıt döngüsü, varsayılan/silme) + AddressVerificationSheet ters geocode →
     `v2/model/address*.ts`.
   - OrdersScreen/OrderDetailScreen select'leri + `reorder.ts toItems` → `v2/model/ordersData.ts`.
   - Ana sayfa teslimat çipinin bölge eşleşmesi (yalnız gösterim) → `v2/model/homeData.ts pickZoneRowForAddress`.
   Öneri: `src/lib/checkoutFlow.ts`, `src/lib/productSelection.ts`, `src/lib/addressForm.ts` — eski ekranlar da oradan çağırsın.
2. **Onay gereken davranış farkları (yalnız v2, bayrak arkasında):** (a) Adres "tarifi" `full_address` SONUNA " — tarif"
   olarak ekleniyor (eski ekranda Açık Adres otomatik adresin yerine geçiyordu); (b) silinen adres seçiliyse v2 seçimi
   boşaltıyor, düzenlenen seçiliyse tazeliyor; (c) bölge dışı adreste kaydet açık (bugünkü gibi; pano kapalı gösteriyordu);
   (d) özette eski ekrandaki "Konumu haritada doğrula" daveti, uzak-konum uyarı satırı ve en-yakın-adres otomatik seçimi YOK
   (sipariş akışını etkilemeyen bilgi öğeleri; v2'de adres doğrulaması adres ekleme ekranında); (e) PayUnknown kartında
   panoda olmayan ikincil "Ödemeyi tamamla" düğmesi var (eski ekranda bekleyen taslak her zaman yeniden ödenebiliyordu).
3. **Veri yok → gizlendi:** mağaza puanı/değerlendirme sayısı ve yorum alt puanları/ürün/KCAL yanıtı (marka bazlı yorum
   RPC'si gerekir); siparişe özel tahmini varış; sipariş satırında ürün görseli ve kart son 4 hanesi; SSS içeriği.
4. Yeni analytics olay adı: `reorder_from_order_detail` (`ui: 'ek_v2'`); `cart_view` v2'de `ui: 'ek_v2'` alanıyla.
5. Mükerrer taslak: aynı oturumda engelli (yukarıda); uygulama yeniden açılınca yeni taslak açılabilir — bugünkü davranışla
   aynı, çift çekim yok. İstenirse `fetchLatestPendingPaymentOrder` (lib/orders.ts:751) ile açılışta bekleyen taslağı
   sürdürme eklenebilir (ödeme mantığı değişikliği → onayın).
6. Cihaz doğrulaması gerekenler: harita "yüklenemedi" eşiği (10 sn), ürün kaydırma şeridi, alt sabit bar camı, Dynamic Type.

## ENTEGRASYONA
1. Banner hedefleri `resolveNavigation` ile (ProductDetail/BrandLanding/CategoryProducts dışı) bugünkü ekranları açar —
   v2 karşılığı olmayan katalog ekranları (Categories/Offers) bilinçli olarak eski ekranda.
2. Profil › Siparişlerim bugün `ProfileOrders`'a gider; `yeni_siparis` açıkken `EkOrders`'a yönlendirmek profil sahibinin
   (S4 alanı) işi: `navigation.navigate(yeniSiparis ? 'EkOrders' : 'ProfileOrders')`.
3. Macro şeridi dokunulmaz (FinPrMacro rotası v2 dışı); Profil sahibi bağlayabilir.
4. Yeni kabuk tab bar "+N"/uçuş: eatkcal v2 sepete eklemede `kcal:logFlight` yayınlamaz (sipariş ≠ loglama); teslimde
   otomatik loglama mevcut sunucu akışında.

## SORULAR
- Yok (engel kuralına takılan bir yazma olmadı).

## Simülatörde deneme (İlter)
1. CLAUDE.md 1. komut (native build) gerekmez — native değişiklik yok; 2. komut: `npx expo start --dev-client`.
2. Bayraklar kapalı → bugünkü eatkcal (HomeScreen/Cart/Checkout) aynen.
3. Tasarım vitrini → Bayraklar → `yeni_siparis` aç → uygulamayı soğuk yeniden başlat (bayrak soğuk açılışta okunur) →
   Home sekmesi eatkcal v2. Gerçek ödeme denemesi yapma; PaymentScreen'e kadar gidip geri dönmek PayUnknown'ı gösterir.
