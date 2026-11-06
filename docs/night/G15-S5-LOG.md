# G15-S5 — eatkcal görünüm katmanı + kayıtlı kartlar

## ÖZET (10 satır)
(1) Alanımdaki 56 görüntü (28 pano × Light/Dark) vitrinde yeniden çekildi ve Final ile yan yana karşılaştırıldı: **aynı 22 · küçük fark 34 · büyük fark 0 · ekran yok 0** (G14: aynı 2 · küçük 11 · büyük 34 · ekran yok 9).
(2) md.1 FinPrCards: `EkSavedCardsScreen` (aynı `lib/cards` servisi); `yeni_siparis` açıkken `ProfileSavedCards` rotası (Profil ve ödeme) bunu açar; "Yeni kart" → v2 `EkAddCardScreen`.
(3) md.2 FinCityR1/WaitlistR1/EatBerlin: fotoğraflı il kapısı (`ui/gate/CityGateView`) eatkcal sekmesinde (Final'deki gibi sekme çubuğuyla); doğrulama aynı `checkCity`, "Haber ver" yerel.
(4) md.3: FinEkInfo SSS sekmesi (mevcut SSS metni) + bölge haritası; mağaza/yorum vitrin eşlemesi (gerçek menü markası, yorum özeti/alt puan karoları); Siparişlerim filtre çipleri + mock siparişler + satır fotoğrafı; ürün canlı makro şeridi.
(5) md.4: dev-only başlangıç durumları `vitrinPay` (bekliyor/başarısız/bilinmiyor), `vitrinPerm`/`vitrinMap`/`vitrinForm` (adres), `vitrinScroll`, `vitrinFilter`, `vitrinReviews`, `vitrinSkeleton`, `vitrinGate`, `vitrinCards` — üretim paketinde 0 iz (aşağıda kanıt).
(6) md.5 **Eski tasarım: 0** — sipariş akışında 1.0.7'ye giden 12 yol v2 görünüme bağlandı (OrderSuccess, Payment, AddCard, değişiklik talebi, kupon, destek, sözleşmeler, sepet hapı…); ödeme/kart doğrulama mantığı kaynaktan satır satır kopya, test bayt bayt eşitliği doğruluyor.
(7) Bayrak kapalı = bugünkü uygulama: tüm değişimler `v2ScreenFor(…, yeniSiparis, <bugünkü>)` / v2 rotası kayıtlıysa; KİMSE dosyaları `git diff night13/release` → BOŞ; `legacySwap.test.ts` + mevcut `routeTable.test.ts` geçti.
(8) Kontrol: tsc 0 · test:unit 541/541 · test:components 90/90 (snapshot 1/1) · `expo export --platform ios` ✓ (Hermes 9.3 MB).
(9) Dal `night15/eatkcal` (taban `night14/visual`), worktree `.claude/worktrees/g15-s5`, simülatör "G15-5 iPhone" (`E104E43B-…`), Metro 8095. Yeni paket / migration / eas / canlı yazma YOK.
(10) SORULAR: 5 madde (şehir fotoğrafları, Berlin restoran verisi, mağaza puanı/ETA verisi, ödeme/kart kopyalarının tek kaynağa indirilmesi, il kapısının sekmeye taşınması); ENTEGRASYONA: ProfileCoupons rotası (S4 görünümü).

## Yapılanlar (commit)
| # | Madde | Ne | Dosya(lar) | Commit |
|---|---|---|---|---|
| 1 | md.1 FinPrCards | v2 kayıtlı kartlar: grup kartı, maskeli "Kart •••• 1234", Varsayılan alt satırı, çöp kutusu (onaylı silme), çerçeveli "Yeni kart", PaynKolay notu; varsayılan yapma = satıra dokun + onay (özellik korunur); boş durum; mount'ta en fazla 1 sync + `consumeCardsStale` | `v2/screens/EkSavedCardsScreen.tsx`, `v2/model/cardsModel.ts` (+test) | `e824a15` |
| 2 | md.2 | `CityGateView` 3 adım: Nereye getirelim? (İzmir büyük kart + radyo, İstanbul/Ankara "Çok yakında" cam çipli, Diğer şehir) · "İstanbul'a geliyoruz" (lime Haber ver → Listedesin, "Bu arada takibe devam et") · mutfak olmayan şehir (şehir hapı, uyarı satırı, "Restoranını ekle" → info@eatkcal.com, dipnot). Kapı geçilmemişse eatkcal sekmesi önce kapıyı gösterir (`EkHomeScreen`), `EkCityGate` rotası da aynı görünümü kullanır | `v2/ui/gate/CityGateView.tsx`, `EkHomeScreen.tsx`, `EkCityGateScreen.tsx` | `caf324b` |
| 3 | md.3 FinEkInfo | SSS sekmesi (5 açılır satır, `HowItWorksModal` "Sipariş ve Teslimat" metni TR+EN), sheet sabit yükseklik, `initialTab`, harita tam genişlik, koyu temada karartma | `v2/ui/InfoSheet.tsx` | `caf324b`, `66a6f2a` |
| 4 | md.3 Store/Reviews | alt puan karoları (Lezzet · Teslimat · Kalori uyumu); vitrin: gerçek menünün ilk marka anahtarı, `vitrin_yorumlari` örnekleri | `v2/ui/ReviewsSheet.tsx`, `EkStoreScreen.tsx`, `src/dev/*` | `c70d1dd` |
| 5 | md.3 Orders | satır fotoğrafı (ilk ürünün menü görseli; `items` select'e eklendi), detayda ürün fotoğrafı, huni ikonu | `EkOrdersScreen.tsx`, `EkOrderDetailScreen.tsx`, `model/orders*.ts`, `ui/orders/useProductImages.ts` | `c70d1dd`, `82d9aa4` |
| 6 | md.3 ProductScroll | canlı makro şeridi (mevcut) vitrinde görünür; ürün foto düğmeleri iki temada açık cam | `EkProductScreen.tsx` | `ad09830`, `c10e285`, `e3f8487` |
| 7 | md.4 ödeme | `vitrinPay` yalnız görünümde; bekliyor = "Teslimat ücretsiz" + gri hap + nabız noktası; başarısız = kart ikonu; bilinmiyor = saat ikonu; toplam dökümü Sepet özeti içinde; "Değiştir"; sözleşmeler altı çizili | `EkCheckoutScreen.tsx` | `c70d1dd`, `ad09830` |
| 8 | md.4 adres | `vitrinPerm/Map/Form`; koyu temada koyu harita; "Harita yüklenemedi" kartı harita ikonu + mürekkep düğme; Adreslerim boş kart konumu | `EkAddressAddScreen.tsx`, `ui/address/AddressMap.tsx`, `EkAddressesScreen.tsx` | `c70d1dd`, `179890a` |
| 9 | FinEkHome | başlık ara · siparişler · bilgi (sepet sekme hapında); vitrin: seçili adres + canlı sipariş kartı | `EkHomeScreen.tsx`, `src/dev/*` | `145dd38` |
| 10 | FinEkCartSkeleton | Final iskeleti (3 ürün kartı + özet), `vitrinSkeleton`; vitrin sepeti makrolu ürünler + adres (satır makro çipleri, özet halkaları, ücretsiz teslimat çubuğu görünür) | `EkCartScreen.tsx`, `src/dev/vitrinSetup.ts` | `257023e`, `66a6f2a` |
| 11 | FinEkErrors | Final ikonları (bilet · paket · etiket · iğne), vitrin sayfa başlığı | `v2/ui/ErrorCard.tsx`, `src/dev/vitrinScreens.tsx` | `66a6f2a` |
| 12 | md.5 | eski tasarım envanteri — aşağıdaki tablo | `v2/routes.tsx`, `AppNavigator.tsx`, `shell/TabBarR3.tsx`, yeni v2 ekranları | `ad09830`, `640a4dd`, `3951a37`, `9549025` |

## Eski tasarım envanteri (bayraklar açık sipariş akışı)
`Eski tasarım: 0`

Yol: eatkcal sekmesi (il kapısı) → ana sayfa → mağaza → ürün → sepet (+kupon) → sipariş özeti → güvenli ödeme (3D) → siparişin alındı → sipariş takibi/detay (+değişiklik talebi, destek) → siparişlerim → adresler / adres ekle → kayıtlı kartlar / yeni kart. Her adımın açtığı ekran/sheet tarandı (`navigate(`/`replace(` hedefleri + v2 içe aktarmaları, `grep`):

| # | Bayrak açık yolda 1.0.7 kalan | Nereden açılıyordu | Çözüm | Commit |
|---|---|---|---|---|
| 1 | `CartScreen` (gizli `Cart` sekmesi) | yeni kabuk sekme çubuğu sepet hapı (`TabBarR3.onCartPress`) | v2 rotaları kökte kayıtlıysa (`yeni_siparis`) `EkCart`; değilse bugünkü `Cart` | `ad09830` |
| 2 | `OrdersScreen` (`ProfileOrders`) | Profil › Siparişlerim, eski OrderSuccess | `v2ScreenFor('ProfileOrders')` → `EkOrdersScreen` | `ad09830` |
| 3 | `AddressesScreen` (`Addresses`) | Profil › Adreslerim | `v2ScreenFor('Addresses')` → `EkAddressesScreen` (aynı `selectMode`) | `ad09830` |
| 4 | `OrderSuccessScreen` | ödeme dönüşü / ücretsiz sipariş | `EkOrderSuccessScreen` (FinMoPay son karesi; Macro kazanımı aynı sorgu) | `ad09830` |
| 5 | `PaymentScreen` (siyah başlık, yeşil yükleyici) | sipariş özeti › Öde | `EkPaymentScreen`: mantık satır satır kopya, yalnız görünüm v2 (test: `legacySwap.test.ts`) | `ad09830` |
| 6 | `SavedCardsScreen` | Profil › Kayıtlı kartlarım | `EkSavedCardsScreen` (FinPrCards) | `e824a15` |
| 7 | `AddCardScreen` | kayıtlı kartlar › Yeni kart | `EkAddCardScreen`: mantık satır satır kopya, görünüm v2 | `ad09830` |
| 8 | `OrderDetailScreen` (eski BottomSheet; değişiklik talepleri) | v2 detay › "Siparişte değişiklik iste" | `ChangeRequestCard` v2 detayda (kurallar `model/changeRequest.ts` birebir + test) | `640a4dd` |
| 9 | `OffersAndCouponsScreen` (`ProfileCoupons`) | sepet › kupon hatası › "Kuponlarımı gör" | kupon sheet'indeki "Kuponlarım" listesinde kalır | `3951a37` |
| 10 | `SupportScreen` (`ProfileSupport`) | sipariş detayı › Talep oluştur / değişiklik › Destek | `v2ScreenFor('ProfileSupport')` → Profil'in Final görünümü (SettingsSupport; yalnız import) | `3951a37` |
| 11 | `ContractsScreen` (`ProfileContracts`) | sipariş özeti › Kullanım Koşulları / Mesafeli Satış | `v2ScreenFor('ProfileContracts')` → SettingsAgreements (`initialSlug`) | `3951a37` |
| 12 | `SignupEatScreen` şehir listesi | ilk sipariş eylemi (il kapısı) | fotoğraflı kapı `CityGateView` (FinCityR1/WaitlistR1/EatBerlin) | `caf324b` |

Kapsam dışı / erişilemez (sayılmadı, gerekçe):
- `CheckoutScreen` (Tosla/eski özet): `EkCheckout` yalnız sağlayıcı PaynKolay değilse oraya döner; `src/config/payment.ts:resolveProvider()` sabit `paynkolay` → bayrak açık yolda erişilemez (RULES: "Tosla yedek; dokunma").
- `Login` (UnifiedLoginScreen) ve oturumsuz `WelcomeGate`: auth = KİMSE + G15-S1 alanı.
- Gizli `Cart` sekmesi yeni kabukta `lazy:false` ile bağlı ama görünmez; hiçbir düğme bayrak açıkken oraya gitmez (#1).

Yeniden giydirilen (Final'de yok): sipariş değişikliği talepleri (iptal/tarih/adres, durum bandı), Siparişin alındı ekranındaki sipariş no / Macro kazanımı / uyarı notu / Macro'larım·Bugün·Ana sayfa geçişleri, kart doğrulama ara durumları (başlıyor/doğrulanıyor/sonuç/zaman aşımı/limit/yüklenemedi), güvenli ödeme ara durumları (inceleniyor/hazırlanıyor/takıldı/onaylanıyor), kayıtlı kartta "varsayılan yap" (satıra dokun + onay), kart boş durumu, sipariş özeti toplam dökümü (Sepet özeti içinde).

## Pano tablosu (önce G14 → sonra G15)
Yöntem: `scripts/dev/g14-shots.sh` mantığıyla kendi simülatörümde (`G15-5 iPhone`) çekim → `g14-pair.ts` ile Final|uygulama çifti → 2×2 kontrol sayfaları (Read). Görüntüler: `.claude/night/out/g15/{base,r1…r9}` ve çiftler `.claude/night/out/g14/pair-{base,r1…r9}` (git'e girmez). Çekimlerde iOS "…ile açılsın mı?" onayı başka oturumların simülatör pencerelerine düşüp birkaç görüntü yanlış ekrana çıktı (karşılama/başka pano); o panolar tek tek yeniden çekildi (r8/r9) ve tabloya son geçerli görüntü yazıldı.
"Küçük fark" = yalnız veri (Final'deki [N]/[Ürün] yer tutucuları yerine gerçek/vitrin verisi; verisi olmayan bölüm SON_HAL gereği gizli) ya da ölçü/kopya inceliği.

Dağılım (56): önce aynı 2 · küçük fark 11 · büyük fark 34 · ekran yok 9 → sonra aynı 22 · küçük fark 34.

| Pano | Önce (G14) | Sonra (G15) | Notlar (sonra; kalan) |
|---|---|---|---|
| FinPrCards | büyük fark | küçük fark | v2 görünüm (grup kart, maskeli son 4, Yeni kart, PaynKolay notu); kalan: son kullanma tarihi verisi yok ([AA/YY] gösterilmez) |
| FinPrCards-Dark | büyük fark | küçük fark | aynı; kalan: [AA/YY] verisi yok |
| FinCityR1 | büyük fark | küçük fark | fotoğraflı kapı birebir; kalan: şehir fotoğrafı varlığı yok → aynı ölçüde yüzey (SORULAR #1) |
| FinCityR1-Dark | ekran yok | küçük fark | aynı (koyu); fotoğraf yüzeyi |
| FinWaitlistR1 | büyük fark | küçük fark | "İstanbul'a geliyoruz" + lime Haber ver + takibe devam; kalan: "[N] kişi listede" (veri yok) gizli |
| FinWaitlistR1-Dark | ekran yok | küçük fark | aynı (koyu); [N] kişi gizli |
| FinEatBerlin | büyük fark | küçük fark | başlık + şehir hapı + uyarı + bölüm + Restoranını ekle + dipnot; kalan: restoran satırları (veri yok) gizli (SORULAR #2) |
| FinEatBerlin-Dark | ekran yok | küçük fark | aynı (koyu); restoran satırları gizli |
| FinEkHome | küçük fark | küçük fark | başlık ikonları Final sırası, canlı sipariş kartı, Macro şeridi, teslimat satırı; kalan: "Tahmini varış [N] dk" yerine durum (ETA verisi yok), mağaza kartında puan yerine "Hemen · süre" |
| FinEkHome-Dark | büyük fark | küçük fark | aynı (koyu); ETA / puan verisi |
| FinEkHomeSkeleton | küçük fark | küçük fark | iskelet blok sayısı/ölçüsü (çipler iskelet, sipariş kartı bloğu yok) |
| FinEkHomeSkeleton-Dark | küçük fark | küçük fark | aynı |
| FinEkStore | büyük fark | küçük fark | ürünler, çipler, Yorumları gör; kalan: puan satırı (veri yok) gizli, marka sloganı görünür, menü görselleri dekupe (beyaz kart) |
| FinEkStore-Dark | büyük fark | küçük fark | aynı (koyu) |
| FinEkReviews | büyük fark | küçük fark | özet + dağılım + 3 alt puan karosu + yorumlar; kalan: ürün adı ve "KCAL yanıtı" (veri yok) gizli |
| FinEkReviews-Dark | ekran yok | küçük fark | aynı (koyu) |
| FinEkProduct | küçük fark | aynı | makro halkaları dolu, seçim kartları, alt bar (değerler gerçek ürün) |
| FinEkProduct-Dark | büyük fark | aynı | foto düğmeleri açık cam (Final) |
| FinEkProductScroll | büyük fark | küçük fark | canlı makro şeridi alt barın üstünde; kalan: örnek ürün kısa olduğundan halkalar üstte görünür |
| FinEkProductScroll-Dark | büyük fark | küçük fark | aynı (koyu) |
| FinEkCart | büyük fark | küçük fark | satır makro çipleri, öneriler, kupon, özet halkaları, ücretsiz teslimat çubuğu; kalan: özet/çubuk kaydırınca (Final panosu uzun), seçimsiz ürünlerde seçim özeti yok |
| FinEkCart-Dark | büyük fark | küçük fark | aynı (koyu) |
| FinEkCartEmpty | küçük fark | aynı | — |
| FinEkCartEmpty-Dark | küçük fark | aynı | — |
| FinEkCartSkeleton | ekran yok | aynı | 3 ürün kartı + özet bloğu |
| FinEkCartSkeleton-Dark | ekran yok | aynı | — |
| FinEkCheckout | küçük fark | aynı | "Değiştir", toplam dökümü Sepet özeti içinde, sözleşmeler altı çizili |
| FinEkCheckout-Dark | küçük fark | aynı | — |
| FinEkCheckoutPayWait | büyük fark | aynı | "Teslimat ücretsiz" + gri hap + nabız noktası |
| FinEkCheckoutPayWait-Dark | büyük fark | aynı | — |
| FinEkCheckoutPayFail | büyük fark | küçük fark | kart ikonu, Tekrar dene; kalan: "Başka kart" yalnız kayıtlı kart özelliği açıkken (vitrin oturumunda kapalı) |
| FinEkCheckoutPayFail-Dark | büyük fark | küçük fark | aynı (koyu) |
| FinEkCheckoutPayUnknown | büyük fark | küçük fark | saat ikonu + Siparişlerim'e git; kalan: bekleyen taslak varsa tekrar ödeme bağlantısı (mevcut kural) görünür |
| FinEkCheckoutPayUnknown-Dark | büyük fark | küçük fark | aynı (koyu) |
| FinEkAddress | küçük fark | küçük fark | lime teslimat bandı, sokak başlığı + "haritadan dolduruldu", tür çipleri, alanlar; kalan: profilde ad/telefon yoksa Ad/Soyad alanı (mevcut kural) |
| FinEkAddress-Dark | büyük fark | küçük fark | koyu harita; Ad/Soyad alanı |
| FinEkAddressNoPerm | büyük fark | küçük fark | "Konum izni kapalı … Ayarlar" kartı + Sürükle; kalan: kart ikonu (bilgi vs yön) |
| FinEkAddressNoPerm-Dark | büyük fark | küçük fark | aynı (koyu harita) |
| FinEkAddressNoMap | büyük fark | küçük fark | "Harita yüklenemedi" (harita ikonu, mürekkep düğme) + "Adresini yaz"; kalan: İlçe seçici görünür (mevcut kural), Konumumu kullan sağda |
| FinEkAddressNoMap-Dark | büyük fark | küçük fark | aynı (koyu) |
| FinEkAddresses | ekran yok | aynı | 3 adres (Ev varsayılan · İş · Yazlık), Yeni adres ekle |
| FinEkAddresses-Dark | büyük fark | aynı | — |
| FinEkAddressesEmpty | küçük fark | aynı | kart konumu düzeldi |
| FinEkAddressesEmpty-Dark | küçük fark | aynı | — |
| FinEkOrders | ekran yok | aynı | filtre çipleri + satır fotoğrafı + durum rozetleri |
| FinEkOrders-Dark | büyük fark | aynı | — |
| FinEkOrdersEmpty | aynı | aynı | — |
| FinEkOrdersEmpty-Dark | aynı | aynı | — |
| FinEkOrdersFilterEmpty | büyük fark | aynı | İptal seçili + huni ikonu |
| FinEkOrdersFilterEmpty-Dark | büyük fark | aynı | — |
| FinEkOrderDetail | ekran yok | küçük fark | zaman çizelgesi, ürün fotoğrafları, adres, tekrar sipariş, destek; kalan: "Değerlendir" yalnız teslim + 30 dk sonra (mevcut kural), "Sipariş değişikliği" kartı ek (yeniden giydirilen) |
| FinEkOrderDetail-Dark | büyük fark | küçük fark | aynı (koyu) |
| FinEkInfo | büyük fark | küçük fark | Teslimat · SSS · Bölgeler, ilçe çipleri, minimum; kalan: Final'in stilize haritası yerine gerçek İzmir ilçe haritası; arkada eatkcal başlığı yok (vitrin sahnesi) |
| FinEkInfo-Dark | büyük fark | küçük fark | harita koyu temada karartılmış |
| FinEkErrors | büyük fark | aynı | 4 kart Final ikonlarıyla + sayfa başlığı/açıklama |
| FinEkErrors-Dark | büyük fark | aynı | — |

## Kontrol
| Kontrol | Sonuç |
|---|---|
| `npx tsc --noEmit` | 0 hata |
| `npm run test:unit` | 541/541 geçti (yeni: `cardsModel` 3, `changeRequest` 5, `legacySwap` 4, `orders` +1; vitrin tree-shake testi `dist/` ile koştu) |
| `npm run test:components` | 90/90, 21 süit, snapshot 1/1 |
| `npx expo export --platform ios` | geçti; Hermes paketi 9.33 MB (G14: 9.23 MB) |
| Vitrin üretimde yok | üretim paketinde `vitrinCards/Gate/Pay/Perm/Map/Form/Filter/Scroll/Reviews/Aggregate/SubScores/Skeleton/City/OtherCity`, `Vitrin: sahne yok`, `g14-vitrin-pending`, `Hata kartları` = 0 (her dev parametresi ayrı `__DEV__ ?` dalında) |
| Bayrak kapalı parite | `legacySwap.test.ts` (4 test): her rota değişimi `v2ScreenFor('<ad>', yeniSiparis, <bugünkü>)`, tablo yalnız 8 ad, sekme hapı yalnız `EkCart` kayıtlıysa (= `yeni_siparis` açık; `ekV2RouteNames(false)` → []), ödeme/kart kopyalarının mantık bloğu kaynakla bayt bayt aynı; `routeTable.test.ts` 5/5; `TrackerScreen.flagOff` snapshot değişmeden geçti |
| KİMSE diff | `git diff night13/release -- src/screens/HomeScreen.tsx src/modules/eatkcal/screens src/screens/profile src/store/cartStore.ts src/store/addressStore.ts src/components/checkout src/lib/{paymentHtml,paynkolayReturn,orders,activeOrder,reorder,cards,cardVerification}.ts src/screens/{AddressesScreen,OffersAndCouponsScreen}.tsx src/config/payment.ts package.json app.config.js` → **BOŞ** |

## ENTEGRASYONA (G15-S6)
- `src/navigation/AppNavigator.tsx`: 8 satır `v2ScreenFor(...)` (ProfileSavedCards/Orders/Addresses/OrderSuccess/AddCard/Support/Contracts/PaymentScreen). S4 de AppNavigator'a dokunursa çakışma yalnız bu satırlarda.
- `src/modules/shell/TabBarR3.tsx` `onCartPress`: 6 satır (v2 kayıtlıysa `EkCart`).
- `src/dev/{screenCatalog,vitrinSetup,vitrinFixtures,vitrinScreens}.ts(x)`: eatkcal panolarının hedefleri/vitrin verisi; adres tohumu yalnız `entry.area === 'eatkcal'`.
- `dictionaries.ts`: `eatkcal.v2` bloğuna yeni ad alanları `cards`, `gate`, `faq`, `success`, `payment`, `addcard`, `change` (TR+EN); `checkout.edit` "Düzenle" → "Değiştir" (EN "Change").
- `ProfileCoupons` rotası hâlâ 1.0.7 `OffersAndCouponsScreen` (Profil › Kuponlarım ve eski ana sayfa açar; sipariş akışım artık açmıyor). S4 `FinPrCouponsScreen`'i (onBack'li alt görünüm) yazdı ama rotayı kapsam dışı bıraktı → öneri: `ProfileCoupons: () => <FinPrCouponsScreen onBack={goBack} />` `v2ScreenFor` tablosuna (bkz. `EkProfileLinks.tsx` deseni).

## SORULAR
1. **Şehir fotoğrafları** (FinCityR1/WaitlistR1): Final'de "Fotoğraf · İzmir/İstanbul/Ankara" yer tutucuları var; uygulamada şehir görseli yok → aynı ölçüde düz yüzey. `CityGateView.tsx` `CITY_PHOTOS` haritasına görsel eklenince kendiliğinden görünür. Görseller kimden gelecek?
2. **FinEatBerlin restoran listesi**: "[Restoran adı] · Menü · İletişim" satırları için veri kaynağı yok (G6-S4 kararı: sahte liste yok) → bölüm başlığı + "Restoranını ekle" + dipnot var, satırlar gizli. "Restoranını ekle" şu an info@eatkcal.com'a e-posta; doğru kanal mı?
3. **Mağaza puanı / değerlendirme sayısı / tahmini varış dk**: Final mağaza kartı ve canlı sipariş kartında var; veri yok → gizli (vitrinde yorum özeti yalnız dev parametresiyle). Sunucuda marka bazlı puan ve ETA eklenecek mi?
4. **Ödeme ve kart doğrulama v2 kopyaları**: `EkPaymentScreen`/`EkAddCardScreen` mantığı `PaymentScreen.tsx`/`AddCardScreen.tsx`'ten satır satır kopya (KİMSE dosyalarında diff = 0 kuralı). İki yerde bakım riski var; `legacySwap.test.ts` ayrışırsa kırmızı olur. Bayrak %100 olunca (G-TEMİZLİK) eskiler silinmeli ya da mantık bir hook'a çıkarılmalı.
5. **İl kapısının yeri**: Final'e uyarak kapı artık eatkcal sekmesinin ilk hâli (önceden ilk "Sipariş ver"de stack ekranı). Kapı geçilmemiş mevcut kullanıcı sekmeyi açınca bir kez İzmir'e dokunacak. Uygun mu?

## İlter'e
- Simülatör: "G15-5 iPhone" (`E104E43B-FFB5-46DB-AE04-E8071847C873`, G14 kopyası). Silmek için `xcrun simctl delete E104E43B-FFB5-46DB-AE04-E8071847C873`. İlter'in ve diğer oturumların simülatörüne dokunulmadı.
- Tek pano: `G14_UDID=E104E43B-FFB5-46DB-AE04-E8071847C873 G14_OUT=$PWD/.claude/night/out/g15/x scripts/dev/g14-shots.sh FinEkCart-Dark` (Metro: `npx expo start --dev-client --port 8095`).
