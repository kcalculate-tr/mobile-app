# G37-S1 — Paywall düzeltmeleri (12 Kas, TestFlight geri bildirimi)

Dal `release/1.1.0` · worktree `.claude/worktrees/g23-s1` · yalnız JS/TS (native yok → OTA) · yeni paket yok · deploy/OTA yok.

## ÖZET
1. **md.1 zemin**: `PaywallGlow` artık STATİK. Dikdörtgen/dikişin sebebi: iki SVG katmanı `useDrift` ile ±24 pt kayıyordu, kayan katmanın kenarı ekranın sol/sağında dikey çizgi / açık yeşil dikdörtgen gibi görünüyordu. Kayma kaldırıldı (`useDrift` silindi). SVG kökün GERÇEK ölçüsünü (onLayout) alıyor, her kenardan 2 pt taşıyor (`GLOW_BLEED`). Onboarding karşılama ekranındaki gibi iki yumuşak radyal ışık var (daire, dışa doğru 0 opaklık). Zemin ScrollView'ın dışında ve safe area dahil tüm kökü kaplıyor. Light 0,30/0,24 · Dark 0,38/0,30.
2. **md.2 ikon**: Önceden her karusel sayfasının kendi `FloatingGlass` + `useLoopFloat` örneği vardı. Aktif sayfa değişince başka fazdaki döngüye geçiliyordu (hareket "baştan başlıyor"), kademe değişince şerit yeniden mount oluyordu. Şimdi karuselin ve kademe anahtarlı görünümlerin DIŞINDA tek bir `FeatureIcon` var. Süzülme döngüsü bir kez kuruluyor. 5 görsel üst üste monte. Aktif görseli `Animated.ScrollView` + `useAnimatedScrollHandler` worklet'i (UI thread) seçiyor, opaklık `withTiming` fast 220 ile çapraz geçiyor. JS tarafı (otomatik geçiş, kaydırma sonu, kademe değişimi) yalnız aynı değeri doğruluyor. Azaltılmış harekette süzülme yok.
3. **md.3 fiyat**: Kod denetimi temiz. Para birimi her zaman RevenueCat `currencyCode` (mağaza ülkesi). USD'ye sabitleme ya da sabit `en-US` biçimi yok. TRY "999,99 TL" olarak gösteriliyor (₺ yok, ortak `formatMoney`). Diğer para birimleri cihaz yerel ayarında Intl ile ("$29.99"). Tasarruf % ve "ayda N" aynı ürün çiftinden hesaplanıyor. Ek koruma: aylık ikiz farklı para birimindeyse tasarruf % gösterilmiyor. TestFlight'taki "$" sandbox hesabının ülkesinden geliyor, kod kaynaklı değil.
4. **md.4 kontroller**: hygiene + tsc ✓ · unit 1262/1262 ✓ · jest 101 suite / 594 test ✓ (+ yeni g37Paywall 6, g37PaywallPrices 6) · `expo export` iOS ✓ + Android ✓ · eslint (değişen dosyalar) 0 hata.
5. `PlanPaywallScreen` aynı bileşenleri KULLANMIYOR. Zemin `PpBackdrop` zaten statik ve %-birimli; ikon süzülmesi yok. Değişiklik gerekmedi.
6. HIG (kod denetimi): kapat/duraklat 44 pt değişmedi · ikon dekoratif, VoiceOver'dan gizli (sayfa etiketi metni okuyor) · Reduce Motion açıkken süzülme ve otomatik geçiş kapalı, görsel değişimi yalnız 220 ms opaklık · zemin düşük opaklık, metin kontrastı değişmedi.

## Commit tablosu
| Commit | Konu |
|---|---|
| 51641d5 | md.1 zemin statik tam ekran + md.2 tek sürekli süzülme, karuselden bağımsız ikon; bileşen testi g37Paywall |
| f014dfb | md.3 fiyat: mağaza para birimi doğrulandı, tasarruf % yalnız aynı para birimi; birim testi g37PaywallPrices |
| (bu) | docs: G37-S1 LOG |
| (son) | docs/night/G37-S1-DONE |

## Testler (md.4)
- `g37Paywall.test.tsx`:
  - Karuselde 3 kaydırma + otomatik geçiş (9,5 sn) + Fresh→Balance geçişinde ikon AYNI bileşen örneği kalıyor. `withRepeat` toplam 1 kez çağrılıyor, `cancelAnimation` hiç çağrılmıyor (paylaşılan değer sürekli). Görünen görsel sırasıyla voice → ai → barcode → manual.
  - İkon şerit içinde değil. `iconFade` = 220.
  - Azaltılmış harekette `withRepeat` yok.
  - Zemin light + dark: mutlak tam dolgu, `pointerEvents=none`, onLayout 390×844 → SVG 394×848 ve −2/−2 konumunda. Zemin ağacında transform yok, ışıklar daire.
  - Fiyat: TRY "999,99 TL/yıl" · "ayda 83 TL" · "%58 tasarruf", ekranda "$" yok. USD "$29.99/yıl" · "$5.99/ay" · "ayda $2.50", ekranda "TL" yok.
- `g37PaywallPrices.test.ts`:
  - TRY örneği; USD örneği (en-US ve tr-TR yerel ayarında yine USD).
  - Karışık para biriminde tasarruf % null.
  - Kaynakta `en-US` / `currency: 'USD'` / `priceString` doğrudan kullanımı yok.
  - Zemin hareketsiz, ikon karusel dışında tek.
- Test taklidi notu: resmi reanimated taklidi `useSharedValue`'yu her render'da yeniden üretiyor. Testte bu, gerçek kitaplıktaki gibi `useRef` ile kararlı yapıldı. Aksi hâlde döngü sürekliliği ölçülemezdi.

## KARAR
- md.3 "priceString olduğu gibi" maddesi ile ortak kural "₺ yok, '285 TL'" çelişiyor. Çözüm: mağazanın `currencyCode`'u olduğu gibi kullanılıyor (TL/USD mağaza ülkesine göre). TRY metni ortak biçimlendiriciden geçiyor (₺ yerine "TL"). Diğer para birimleri Intl ile cihaz yerel biçiminde. G23-S1 kararı korundu, ham `priceString` gösterilmiyor.
- Kayma yeniden açılmasın diye `useDrift` ve `PAYWALL_MOTION.driftPeriod/driftShift` silindi. Başka kullanan yoktu.
- İkon sayfa içinden karuselin üstüne alındı (sayfalarda yalnız başlık + açıklama kaydı). Düzen ölçüleri aynı: ikon kutusu 140×112, üst boşluk 8.

## CANLIYA UYGULANACAK
- Yok (migration yok).

## DEPLOY GEREKİR
- Yalnız OTA (native değişiklik yok, yeni paket yok). İlter yayınlar; production OTA onaysız yasak:
  `eas update --branch production --environment production --message "G37-S1 paywall: statik zemin, surekli ikon suzulmesi, magaza para birimi"`
  (TestFlight derlemesi `production` kanalında; runtimeVersion `appVersion` → aynı 1.1.0 derlemesine iner.)

## SORULAR
1. Görsel doğrulama cihazda yapılmadı (bu oturumda simülatör/TestFlight ekran görüntüsü yok). Yalnız bileşen testi ve export ile doğrulandı. OTA sonrası TestFlight'ta kenar çizgisi ve kaydırmada ikon akıcılığı göz ile kontrol edilmeli.
2. TestFlight'ta TL görmek için App Store Connect'te Türkiye bölgeli sandbox test hesabı gerekir (Ayarlar › App Store › Sandbox Hesabı). Kod tarafında yapılacak bir şey yok.
