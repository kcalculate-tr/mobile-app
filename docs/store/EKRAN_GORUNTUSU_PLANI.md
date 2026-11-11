# Ekran görüntüsü planı · 1.1.0 (M-S1 md.4)

Mesaj sırası rakip raporu §5'ten (`~/dev/kcal-research/rakip/RAKIP_ANALIZI_v1.md`), Koç karesi çıkarıldı (1.1.0'da kapalı) ve yerine
Topluluk/Keşfet kondu. EN setinde 4. kare "Track your progress" (mutfak yalnız TR'de).

> **Kaynak görsel = Final tasarım panosu, gerçek ekran görüntüsü DEĞİL.** Panolar (`.claude/night/design/final/*.dc.html`,
> `tur26k/dalga2/FinSubPaywall*.dc.html`) Playwright ile 3× çizildi; panolardaki `[N]`, `[Ad]` yer tutucuları ve gri fotoğraf
> kutuları **tutarlı örnek verilerle** dolduruldu (aşağıda). TestFlight derlemesinden alınan gerçek karelerle değiştirilebilir:
> aynı kompozisyon betiği `_kaynak/compose.js` herhangi bir 1179×2556 kareyi kabul eder (bkz. "Gerçek kareyle değiştirme").

## Kareler
| # | TR başlık · alt satır | EN başlık · alt satır | Kaynak pano (TR / EN) | Zemin |
|---|---|---|---|---|
| 01 | **Fotoğraf çek, kaloriyi öğren** · Yapay zekâ tabaktaki her yiyeceği ayırır, gramı sen düzeltirsin. | **Snap a photo, get calories** · AI spots each food on your plate. You fine-tune the grams. | `FinPhotoR1` / `FinPhotoEN` (+ `t19/ph-mercimek.jpg`) | lime |
| 02 | **Yaz, söyle ya da barkod okut** · Fotoğraf istemeyen öğünler de saniyeler içinde günlüğünde. | **Type, talk or scan a barcode** · No photo? Log a meal in seconds anyway. | `ScanR2` `mode=voice` (EN: uygulamanın EN metinleri — `voice/i18n.ts`) | mürekkep |
| 03 | **Günün tek bakışta** · Kalori, makro ve su halkaları ana sayfanda. | **Your day at a glance** · Calorie, macro and water rings on your home screen. | `FinHomeR3` / `FinHomeEN` (üst 852 pt) | lime |
| 04 | **İzmir'de makrosu hesaplı öğün kapında** · eatkcal mutfağından. Teslim edilen öğün günlüğüne kendiliğinden işlenir. | **Track your progress** · Eaten, burned and what's left, every day. | `FinEkProduct` / `FinTrackerEN` | mürekkep |
| 05 | **Topluluktan tarif ve öğün keşfet** · Beğendiğin tabağı tek dokunuşla gününe ekle. | **Discover meals from the community** · Like a plate? Add it to your day in one tap. | `FinFeed` / `FinFeedEN` | lime |
| 06 | **Fiyat baştan belli / 7 gün ücretsiz** · Yıllık planlarda 7 gün deneme. Ücretsiz planda günde 2 AI tarama. | **Clear prices / 7 days free** · 7-day free trial on yearly plans. Free plan: 2 AI scans a day. | `FinSubPaywall` / `FinSubPaywallEN` (Balance yıllık, 2999 TL / $59.99) | mürekkep |
| Play öne çıkan | **Hesabı biz yapıyoruz, sen de görüyorsun.** · AI kalori hesaplama · Fit yemek | **The calorie tracker with a real kitchen behind it.** · AI calorie counter · Photo food tracker | `FinHomeR3` / `FinHomeEN` | lime |

Görsel dil: başlık üstte, büyük (Bricolage Grotesque 700), marka renkleri **lime `#C8F05A`** ve **mürekkep `#0A0A0A`** sırayla; üstte küçük
`kcal.` işareti; cihaz çerçevesi yok — yalnız ince koyu kenarlı yuvarlak köşeli ekran, alt kenardan taşar. Yasak dil yok (kilo vaadi,
önce/sonra, tıbbi iddia, "sınırsız AI"); Koç hiçbir karede görünmüyor.

## Örnek veriler (pano yer tutucularının yerine)
- Kullanıcı adı "İlter" → **Elif** (03, EN 04).
- 01: panodaki değerler (460 kcal; Ezogelin çorbası 180, pilav 210, ayran 70); fotoğraf `t19/ph-mercimek.jpg`.
- 04 TR: Tavuk Kinoa Bowl, **285 TL**, 540 kcal · P 42 g · K 48 g · Y 18 g (Keşfet panosundaki "Tavuk kinoa bowl" değerleri); eski fiyat ve indirim rozeti gizlendi.
  ⚠ Fiyat örnek — gerçek menü fiyatıyla teyit (SORULAR).
- 04 EN: 1,480 kcal kaldı · yenen 700 · etkinlik ~420 (koşu ~300, yoga ~120) · yoğurt kasesi 160 · tavuk kinoa 540.
- 05: hikâye rozetleri 420/380/510/290; isimler Ece, Selin, Mert, Ayşe; tabak tablosu kinoa 120 g 180 kcal 6/34/3 · tavuk 140 g 250 kcal 33/0/9 ·
  sebze 160 g 110 kcal 3/14/6 → toplam 420 g, 540 kcal, 42/48/18.
- 06: paywall panosunun kendi değerleri (G27 fiyatları); karusel ilk sayfa "Günde 50 AI tarama".

## Ölçüler ve dosyalar
| Mağaza | Ölçü | Dosya |
|---|---|---|
| App Store iPhone 6,9" | 1320×2868 | `docs/store/shots/ios/{tr,en}/01–06.png` |
| App Store iPhone 6,5" | 1284×2778 | `docs/store/shots/ios/{tr,en}/65/01–06.png` |
| Google Play telefon | 1080×1920 | `docs/store/shots/play/{tr,en}/01–06.png` |
| Google Play öne çıkan görsel | 1024×500 | `docs/store/shots/play/{tr,en}/feature.png` |

ASC'de 6,9" yüklenince küçük iPhone boyutları ondan ölçeklenir; 6,5" ayrıca verildi (eski cihaz önizlemesi net olsun). iPad desteklenmiyorsa
(`supportsTablet` kapalı) iPad karesi gerekmez — YAYIN_KONTROL A'da teyit. Play'de 7"/10" tablet kareleri isteğe bağlı (verilmedi).

## Yeniden üretme
Betikler `docs/store/shots/_kaynak/` (repoya paket eklenmedi; `~/dev/kcal-research` içindeki Playwright kullanılır):
```
# 1) Panoların karalama kopyası (kaynağa yazılmaz) + ses kipli Tara kopyası
mkdir -p /tmp/boards && cp ~/dev/kcal-mobile/.claude/night/design/final/*.html ~/dev/kcal-mobile/.claude/night/design/final/support.js /tmp/boards/
cp -R ~/dev/kcal-mobile/.claude/night/design/final/{glass,t19} /tmp/boards/
cp ~/dev/kcal-mobile/.claude/night/design/tur26k/dalga2/FinSubPaywall*.dc.html /tmp/boards/
cp -n ~/dev/kcal-mobile/.claude/night/design/tur26k/dalga2/glass/*.png /tmp/boards/glass/
sed "s/props.mode === 'voice' ? 'voice' : 'photo'/'voice'/" /tmp/boards/ScanR2.dc.html > /tmp/boards/ScanR2Voice.dc.html
(cd /tmp/boards && python3 -m http.server 8765 --bind 127.0.0.1) &
# 2) Telefon kareleri (1179×2556) → 3) mağaza kompozisyonu
node docs/store/shots/_kaynak/phone.js render /tmp/phones
node docs/store/shots/_kaynak/compose.js /tmp/phones docs/store/shots
```
- Başlıklar `compose.js` › `COPY`; örnek veriler `shots.js`.

## Gerçek kareyle değiştirme (TestFlight sonrası)
1. Simülatörde iPhone 17 Pro Max (ya da cihaz) ile kareyi al, 1179×2556'ya kırp/ölçekle (`sips -z 2556 1179`).
2. `/tmp/phones/{tr,en}-NN.png` olarak kaydet, yalnız 3. adımı (`compose.js`) çalıştır.
3. LOG'a "NN gerçek kare" diye not düş.
