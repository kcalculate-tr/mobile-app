# G18-S2 — Ana sayfa (9 Kas, Tur 26 / 26c / 26d)

## ÖZET (10 satır)
(1) **Odak (a) Gün çekirdeği (md.1):** FinHomeR3 hero birebir — 152'lik halka (r70/12), merkezde cam **ALEV** (ORTAK #14; Final'de damla), sağda Enerji (Bricolage 700/28) + Protein/Su 4 pt çubuklu satırlar, altında makro çipleri. FinMoFocus: alev girişte −8°→0° + 0,96→1, 900 ms enter, opaklık ilk %30'da; kayıtta halka 500 ms standard dolar; boşta döngü yok; odak kaybında son kareye atlar; azaltılmışta 200 ms opaklık. Hedef yoksa kesikli iz + "Hedef belirlenmedi".
(2) **Öğün çentiği (md.2, FinMoPopover):** "…'e logla ⌄" artık sheet açmaz — yerinde menü 240×293 (4 öğün ✓ + porsiyon ½·1·1½·2), 200 ms opaklık + 0,98→1, karartma yok, dışarı dokunuş/öğün seçimi 200 ms'de kapatır, porsiyon açık tutar, altta yer yoksa yukarı/sağa taşarsa sola. Ana sayfadaki bütün öğün hapları bu menüyü kullanır; FinAddSheet dokunulmadı.
(3) **Öne çıkanlar (md.3 + 6b, FinMoBanner):** halka+makroların altında yatay kart şeridi (361×256, görsel 180 + metin 76, köşe 20, karartma/"İncele" yok, tek dokunuş), gösterge 8×4 / etkin 20×4, giriş bir kez 300 ms enter. Veri: Keşfet akışı (tarif = görselli öğün gönderisi, öne çıkan, etkinlik) + kampanya (app_banners → BossVitrin banner_cells); kampanya yalnız İzmir; yeni kullanıcıya (boş gün) yalnız tarif + Keşfet; veri/görsel yoksa kart/bölüm yok.
(4) **Bölge (md.4):** kayıtlı adres → seçilen il (il kapısı) → izinli konum (istem açmaz). İzmir = tek eatkcal öneri kartı (gerçek menü; "Protein eksik, <öğün> için" yalnız doğruysa; fiyat `formatPrice` → "285 TL"); İzmir dışı = "Restoranını eatkcal'a ekle" + "Bize çevrendeki restoranları öner" → **temas**: şimdilik il kapısı (FinWaitlistR1), S3 sheet'leri gelince S5 bağlar.
(5) **Montaj (md.5):** S1 `HomeOnboardingSlot` (profil kartı) hero ile makrolar arasında; boş hâlde S1 `HomeFirstMealCard` + `HomeEmptyToday` ("Bugün" altında); `night18/onb` dala birleştirildi.
(6) **Yerleşim (md.6):** sıra Final'deki gibi: selam → hero → (ilk öğün/profil kartı) → makrolar → banner → Bugün → gün halkaları → **Bugünkü etkinlikler** (yeni bölüm: başlık + toplam + satırlar + "+ Etkinlik ekle") → Keşfet (3 sütun, aralık 8, köşe 14) → eatkcal bölgesi. Ölçülen sayfa yüksekliği farkları veri kaynaklı (aşağıda).
(7) **Ölçülmüş karşılaştırma:** 20 bölge σ1,5-SSIM **0,83–0,97** (dy ≤ 12 pt) · yanlış ekran negatif kontrolleri **0,44–0,71**. Kare dizileri: popover açılış/kapanış ≈ 170–200 ms, odak girişi tek sefer (aşağıda).
(8) Kontrol: **tsc 0** · unit **668 (667 ✓, 1 skip önceden)** · jest **32 suite / 172 ✓, snapshot 2/2** (TrackerScreen **bayrak kapalı** snapshot dahil) · `noLegacyWhenFlagsOn` 12/12 · i18n tr=en anahtar ✓ · `expo export` **iOS ✓ 9,6 MB · Android ✓ 9,6 MB**.
(9) **Eski tasarım: 0** (Ana sayfa yeni yolda; liste aşağıda). Bayrak kapalı = 1.0.7 (snapshot birebir; yeni kancalar `yeni_kabuk` kapalıyken hiçbir istek atmaz).
(10) SORULAR: 5 madde (bilinmeyen bölge varsayılanı, porsiyonun elle girişe etkisi, odak girişinin kalıcılığı, bekleme listesi sheet bağlantısı, vitrin simülatör çakışması). Son commit GERÇEK dosya `docs/night/G18-S2-DONE`.

## Commit'ler
| Madde | Commit | Özet |
|---|---|---|
| — | merge `night18/onb` (ff) | S1 bileşenleri (HomeOnboardingSlot, HomeEmptyR1, homeTokens) |
| 2·3·4·6b | `d598c04` | `modules/gun/home/`: `region.ts` + `useHomeRegion.ts`, `banner.ts` + `HomeBanner.tsx`, `suggest.ts` + `HomeRegion.tsx`, `popoverGeometry.ts` + `MealMenuPopover.tsx`; `utils/formatPrice.ts`; unit 14 + jest 7 |
| 1–6 | `90f54ad` | `FinTopBlock` (hero a + FinMoFocus), `HomeMealSlots` (yerinde menü, boş hâl yuvası), `TrackerScreen` montaj, `HomeStrips` Keşfet ızgarası + ₺→TL, i18n `home.*` TR+EN |
| 7 | `7e117b4` | vitrin kataloğu + örnek içerik; Tur 26d/26e bekleyen listesi |
| 1·2·3 | `7bcca78` | ölçümden düzeltmeler: Enerji sayacı Bricolage, popover ekran içi, banner XL metni; vitrin kaydırma/banner/menü döngüsü |
| 6 | `e3815d7` | "Bugünkü etkinlikler" bölümü + TrackerActivityEntry `variant="home"` (temas) |
| 9 | `4a6183d` | `noLegacyWhenFlagsOn` Ana sayfa dosyalarını tarar |
| 7 | bu LOG + `G18-S2-DONE` | |

## 1 — Odak (a) Gün çekirdeği (FinHomeR3 + FinMoFocus)
- `screens/tracker/FinTopBlock.tsx` yeniden yazıldı (yalnız yeni kabuk yolu çizer). Halka: `react-native-svg` + Reanimated `animatedProps` (`strokeDashoffset`); ilk değer animasyonsuz, sonraki her değişim (kayıt) `withTiming(DURATION.slow=500, CURVE.standard)`; azaltılmışta doğrudan atlar.
- Alev: `assets/glass/flame.png` 64×86 (hedef yoksa 44×59), köken %50 %62. Giriş: `rotate −8→0` + `scale 0.96→1` `DURATION.story=900` `CURVE.enter`; opaklık 270 ms (=%30). Uygulama oturumu başına bir kez (sekme dönüşünde tekrar etmez); `useFocusEffect` temizliği ekran odaktan çıkınca animasyonu iptal edip son kareye koyar. Azaltılmış: `REDUCED.duration` 200 ms yalnız opaklık. Boşta döngü yok (float/tilt/glow kullanılmadı).
- Eğri: FinMoFocus panosu `cubic-bezier(0.25,0.9,0.3,1)` diyor → ORTAK #5 / SON_HAL İSTİSNA 2 gereği kanonik `CURVE.enter (0.05,0.7,0.1,1)`.
- Enerji sayısı: `RollingNumber` (mevcut odometre) `fontFamily` + `slotRatio` isteğe bağlı prop'ları aldı (varsayılan değişmedi → profil/Tara kullanımları aynı); hero Bricolage 700/28, yuva 0,56.
- Boş gün: hedef var → "2.180 · kcal bugünkü hedefin", hedef yok → "0 · kcal bugün" + "Hedef belirlenmedi" + çipler "—". `hasTarget` = `nutritionSummary.targetKcal || nutrition_profile.target_calories` (2000 yedeği artık "hedef var" sayılmaz).

## 2 — Öğün çentiği (FinMoPopover)
- `HomeMealSlots.SlotLogPill`: ana yarı `onLog(öğün, porsiyon)`, ⌄ `measureInWindow` → `MealMenuPopover` (şeffaf `Modal`, karartma yok, yakalayıcı dokunuşu yutar). Uzun basış = elle giriş (eski ⌄ davranışı; özellik kaybı yok — Tara'nın "Elle" modu da duruyor).
- Yüzey #FFFFFF/#1C1C1E + 1 pt çizgi + gölge 0 8 (yarıçap 12 ≈ 24 blur) opaklık .12/.5; satır 44, seçili öğün 700 + ✓; porsiyon çipi 44, seçili mürekkep dolgu. Erişilebilirlik: menu / radiogroup / radio + checked, ⌄ `expanded`.
- Porsiyon: Tara yolunda sonuç sheet'i kendi porsiyonunu kullanır; elle girişte kcal × porsiyon (SORULAR 2). FinAddSheet dokunulmadı.

## 3 + 6b — Öne çıkanlar banner'ı (FinMoBanner)
- Kaynak (yalnız okuma, mevcut): `getKesfetClient().getFeed('for_you', 20)`; kampanya `fetchActiveAppBanner` (app_banners, RLS tarih penceresi) yoksa `fetchBannerRows` (BossVitrin hero/promo) görselli + başlıklı ilk hücre. Başlık uydurulmaz; görselsiz kart yok.
- Sıra 1 tarif → `SharedPost` (FinDetail; SON_HAL İSTİSNA 4) · 2 Keşfet'te öne çıkan → `SharedPost` · 3 etkinlik → `SharedPost` · 4 kampanya → eatkcal sekmesi. Yeni kullanıcı (gün boş) = 1 + 2.
- Kaydırma: `snapToInterval` = kart + 12, `decelerationRate fast`; otomatik ilerleme yok. Gösterge 200 ms standard genişlik.

## 4 — Bölge
- `region.ts` (saf): `normalizeCity` (İ/I/ı güvenli), `isIzmirCoords` (kaba il kutusu; yalnız içerik seçer, teslimat kuralı sunucuda AYNEN), `resolveHomeRegion` sırası adres → il → konum → 'unknown'.
- `useHomeRegion`: `addressStore.selectedAddress.city` → `readCityGatePassed` (=İzmir) / `readNotifyCities` (=dışı) → `Location.getForegroundPermissionsAsync` verilmişse `getLastKnownPositionAsync` (istem açmaz).
- İzmir kartı: `pickEatkcalSuggestion` (aktif, satışta, görselli, paket değil; kalan protein ≥ %30 → en proteinli + "Protein eksik, akşam için", değilse menü sırası + "Akşam için"; kalan kcal'a sığan tercih). Teslim süresi yalnız `useDeliveryChip` gerçek tahmini varsa.

## 5 — Montaj (S1)
`FinTopBlock`: hero → (gün boşsa) `HomeFirstMealCard` (Tara / Elle gir) → `HomeOnboardingSlot` → makrolar. `HomeMealSlots emptyContent={<HomeEmptyToday />}` (eski "Bugün henüz boş" + damla kutusu yeni yolda artık çizilmez — damla su anlamına geldiği için ORTAK #14'e de aykırıydı).

## 6 — Yerleşim / yükseklik
| Pano | Final | Uygulama (içerik + 62 durum) | Fark | Dayanak |
|---|---|---|---|---|
| FinHomeR3 | 2440 | 2350 | −90 | Final'de 2 etkinlik satırı (Koşu, Yoga ≈ 120 pt); vitrin örneğinde etkinlik kaydı yok |
| FinHomeEmptyR1 | 2200 | 2248 | +48 | vitrin örneğinde arkadaş Gün halkası şeridi var (Final boş panoda yok) |
| FinHomeOutside/Izmir | 852 kesit @1580 | aynı kaydırmada kesit | — | bölüm sırası birebir (etkinlik → Keşfet → eatkcal) |
EN (FinHomeEN, FinHomeEmptyR1EN, FinMoBannerEN, FinHomeXLEN), XL, Dark çekildi; XL'de banner metni kırpılıyordu → metin alanı en az 76 (varsayılanda aynı) `7bcca78`.

## 7 — Ölçülmüş karşılaştırma (Final ↔ "G18-2 iPhone" vitrin, `G14_MODE=storage`)
Yöntem: pano `design/final/png/<P>.webp` native (Fin* 393 genişlik; Mo panoları 1404×968, açık telefon x24) ↔ çekim 1206×2622 → 393×854 pt; bölge kırpımı, uygulama tarafında dikey ±60 pt arama, ffmpeg `ssim`; **σ1,5** = iki yana gaussian (yazı kenar yumuşatma gürültüsü), **ham** = bulanıksız. Betik `~/kcal-reports/g18-s2/roi.sh`, `run-roi.sh`, tablo `ssim-roi.tsv`.

| Pano · bölge | σ1,5 | ham | dy | Fark | Düzeltildi mi |
|---|---|---|---|---|---|
| FinHomeR3 · hero | 0,848 | 0,798 | −2 | merkezde alev (Final damla) | dayanaklı (ORTAK #14) |
| FinHomeR3 · makro çipleri | 0,855 | 0,720 | −4 | yazı kenarı | — |
| FinHomeR3 · banner kartı | 0,924 | 0,862 | −2 | — | — |
| FinHomeR3 · Bugün başlığı | 0,897 | 0,872 | −10 | banner gösterge boşluğu +2 | — |
| FinHomeR3-Dark · hero | 0,833 | 0,788 | −2 | alev | dayanaklı |
| FinHomeR3-Dark · banner | 0,919 | 0,856 | −2 | — | — |
| FinHomeEN · hero | 0,847 | 0,796 | −2 | alev | dayanaklı |
| FinHomeEN · banner | 0,922 | 0,860 | −2 | — | — |
| FinHomeIzmir · Keşfet ızgarası | 0,945 | 0,848 | 2 | — | ✓ `90f54ad` (aralık 2→8, köşe 14) |
| FinHomeIzmir · eatkcal kartı | 0,920 | 0,867 | −2 | gerekçe "kahvaltı için" (vitrin saati 09) | dayanaklı (gerçek saat) |
| FinHomeIzmir-Dark · eatkcal kartı | 0,917 | 0,867 | −2 | — | — |
| FinHomeOutside · Keşfet ızgarası | 0,973 | 0,920 | 0 | — | — |
| FinHomeOutside · iki satır | 0,884 | 0,787 | −2 | yazı kenarı | — |
| FinHomeOutside-Dark · iki satır | 0,873 | 0,765 | −2 | — | — |
| FinHomeEmptyR1 · hero | 0,836 | 0,799 | −8 | vitrin örneğinde hedef var ("2.180 bugünkü hedefin"), pano hedefsiz | dayanaklı (veri; hedefsiz yol jest testinde) |
| FinHomeEmptyR1 · İlk öğününü ekle | 0,919 | 0,824 | −6 | — | — |
| FinHomeEmptyR1EN · hero | 0,854 | 0,813 | −6 | aynı | dayanaklı |
| FinMoPopover · menü 240×293 | 0,918 | 0,873 | −6 | — | ✓ `7bcca78` (ekran dışı çapada kırpılıyordu) |
| FinMoBanner · kart (2 / 4) | 0,930 | 0,865 | −2 | gösterge 3 çubuk (vitrinde etkinlik kartı verisi yok) | dayanaklı (uydurma yok) |
| FinMoBannerEN · kart | 0,923 | 0,858 | −2 | aynı | dayanaklı |
| **NEG** hero ↔ Outside çekimi | 0,711 | 0,694 | — | yanlış ekran | — |
| **NEG** İzmir kartı ↔ Outside satırları | 0,534 | 0,464 | — | yanlış ekran | — |
| **NEG** popover ↔ R3 hero | 0,660 | 0,637 | — | yanlış ekran | — |
| **NEG** banner ↔ İzmir Keşfet | 0,435 | 0,359 | — | yanlış ekran | — |

Dayanaklı farklar listesi: (a) alev ↔ damla (ORTAK #14); (b) Enerji sayısının binlik noktası odometre yuvasında ~1 pt geniş (RollingNumber sabit yuva; hane dönmesi için gerekli); (c) vitrin verisi farkları (etkinlik satırları, hedefsiz boş hâl, saat) — kod yolları birim/jest testli; (d) iOS 402×874 ↔ pano 393×852 ölçeği alt sabitli öğelerde ±6–10 pt.
Önce/sonra düzeltmeleri: Keşfet ızgarası (gap 2 → 8, kenar 0 → 16, köşe 0 → 14, başlık 500 → 600/18), Enerji sayısı sistem yazısı → Bricolage, popover kırpılması, XL banner metni, "Bugünkü etkinlikler" bölümü (yalnız düğme vardı).

### Kare dizileri (ORTAK #9) — `~/kcal-reports/g18-s2/frames/`
- **Popover açılış** (`popover-open.png`, `FinMoPopoverCycle.mov`): "1" çipi parlaklığı (kare kare YAVG) 10,872 s'de 203 → 10,903 s 91 → 10,953 s 61 → 11,020 s 48 (dinlenme) ⇒ ≈ 150–200 ms, standard eğri (ilk 50 ms'de %75). Karartma yok, alttaki satırlar sabit, ölçek 0,98→1.
- **Popover kapanış** (`popover-close.png`): 2,0 s açık kaldıktan sonra 12,873 s 75 → 12,925 s 164 → 13,038 s 203 ⇒ ≈ 170–200 ms; menü kalkınca yerleşim kaymaz.
- **Odak girişi** (`focus-entry.png`, `focus-flame.png`): 3,98 s'de alev soluk + −8° eğik + küçük → 4,02 → 4,08 → 4,20 s dik ve tam; halka sabit (giriş yalnız çekirdekte), sonraki karelerde hareket yok (boşta döngü yok).

## EN çekimleri (ORTAK #10)
`FinHomeEN`, `FinHomeEmptyR1EN`, `FinHomeXLEN`, `FinMoBannerEN` (uygulama/`~/kcal-reports/g18-s2/app/`). Yeni metinler `home.*` TR + EN (40 anahtar), `i18n: tr ve en aynı anahtarlara sahip` ✓.

## Eski tasarım envanteri (bayraklar açık, Ana sayfa)
**Eski tasarım: 0**
- Kaldırılan eski yol parçaları (yeni kabukta artık çizilmez): `HomeEatkcalStrip` (248×160 yatay şerit + "₺fiyat") → Final İzmir/dışı bölge bölümü; "Bugün henüz boş" + cam damla kutusu → S1 `HomeEmptyToday`; ⌄ → elle giriş sheet'i → yerinde menü; 3 sütun halka üst bloğu (G15) → FinHomeR3 hero; etkinlik yalnız düğme → bölüm.
- `noLegacyWhenFlagsOn` "ana sayfa Tur 26" grubu ✓ (eski COLORS/BottomSheet/logo importu yok).
Yeniden giydirilen (Final'de yok): seri çipi (yalnız seri > 0), su satırına dokun → +250 ml (G15 hızlı ekleme), ⌄ uzun basış → elle giriş.

## Temas (başka oturum dosyası — tek satır/küçük ek; birleştirmeyi S5 yapar)
| Dosya | Sahip | Değişiklik |
|---|---|---|
| `src/modules/kesfet/ui/TrackerActivityEntry.tsx` | Keşfet/G8 | isteğe bağlı `variant="home"` (+ ikon, pano düğmesi, toplam başlıkta) + `onLogged`; prop yokken AYNEN |
| `src/modules/gun/ui/RollingNumber.tsx` | Gün ortak | isteğe bağlı `fontFamily`, `slotRatio` (varsayılan aynı) |
| `src/utils/formatPrice.ts` | ortak (ORTAK #12) | YENİ tek `formatPrice` ("285 TL", "285,50 TL", "+150 TL") — S3 de eklerse aynı adlı dosyada birleştirilmeli |
| `TrackerScreen.openWaitlist` | S3 | `EkCityGate` → S3 `FinWaitlistAdd/Suggest` sheet'leri gelince tek satır |
| `src/dev/*` | vitrin ortak | katalog + örnek içerik + `PENDING_TUR26` (Tur 26d/26e diğer oturum panoları; B/C yalnız referans) |

## CANLIYA UYGULANACAK
Yok (DB değişikliği yok; yalnız mevcut tablolar okunur).

## SORULAR
1. **Bölge bilinmiyorsa** (adres yok, il kapısı görülmedi, konum izni yok): Ana sayfa İzmir dışı görünümünü çiziyor ("Şimdilik yalnız İzmir'de" + bekleme listesi), İzmir kampanya kartı gösterilmiyor. Metin herkes için doğru ama İzmir'deki yeni kullanıcı da bekleme listesi satırlarını görür. İzmir varsayılanı mı istenir?
2. **Yerinde menüdeki porsiyon** Tara yolunda sonuç sheet'inin kendi porsiyonuna geçmiyor (AiScan rota parametresi yok; Tara dosyaları başka oturumda). Elle girişte girilen kcal × porsiyon kaydediliyor. Doğru anlam bu mu?
3. **Odak ilk dönüşü:** FinMoFocus "her açılışta bir kez" diyor; SON_HAL "odak ilk dönüşü" kalıcı bayrak listesinde. Şimdilik uygulama oturumu başına bir kez (kalıcı değil). Ömür boyu tek sefer mi isteniyor?
4. **İzmir dışı satırlar** S3'ün FinWaitlistAdd/Suggest sheet'lerine bağlanacak; S3 dalı bu oturum sırasında henüz commit içermiyordu → şimdilik il kapısı (FinWaitlistR1, aynı iki seçenek). S5 tek satırı değiştirir.
5. **Vitrin ortamı:** iki simülatör aynı anda açıkken diğer oturumların `simctl openurl booted …` çağrıları "G18-2 iPhone"a da düştü (dev launcher 8103/8104'e geçti, eski kodu çizdi). Çekimlerden önce yalnız kendi simülatörümün launcher kaydını 8102'ye sabitledim (`~/.claude/jobs/…/pin8102.py`); `g14-shots.sh`'a UDID'li openurl önerilir.

Kanıt: `~/kcal-reports/g18-s2/` (app/*.png, ssim-roi.tsv, frames/*.mov + *.png). Dal `night18/home`, simülatör "G18-2 iPhone" `B1489119-9ECB-4C0F-AF68-C15AA6824210`, Metro 8102.
