# Ekran görüntüsü planı · 1.1.0 (M-S1 md.4 · M-S2 md.4: Koç karesi)

Mesaj sırası rakip raporu §5'ten (`~/dev/kcal-research/rakip/RAKIP_ANALIZI_v1.md`). **M-S2 (İlter 11 Kas 16:00): kcalAI Koç 1.1.0'da açık** →
Koç karesi **3. kare** olarak girdi, sonrakiler birer kaydı (7 kare). EN setinde 5. kare "Track your progress" (mutfak yalnız TR'de).
Fiyat karesi (07) ,99'lu fiyatlarla ve Koç'lu paywall'la (`FinSubPaywallCoach`, Balance kartında "kcalAI Koç dahil") yeniden çizildi.

> **Kaynak görsel = Final tasarım panosu, gerçek ekran görüntüsü DEĞİL.** Panolar (`.claude/night/design/final/*.dc.html`,
> `tur26k/dalga2/FinCoachChat*.dc.html`, `tur26k/dalga2/FinSubPaywallCoach*.dc.html`) Playwright ile 3× çizildi; panolardaki `[N]`, `[Ad]` yer tutucuları ve gri fotoğraf
> kutuları **tutarlı örnek verilerle** dolduruldu (aşağıda). TestFlight derlemesinden alınan gerçek karelerle değiştirilebilir:
> aynı kompozisyon betiği `_kaynak/compose.js` herhangi bir 1179×2556 kareyi kabul eder (bkz. "Gerçek kareyle değiştirme").

## Kareler
| # | TR başlık · alt satır | EN başlık · alt satır | Kaynak pano (TR / EN) | Zemin |
|---|---|---|---|---|
| 01 | **Fotoğraf çek, kaloriyi öğren** · Yapay zekâ tabaktaki her yiyeceği ayırır, gramı sen düzeltirsin. | **Snap a photo, get calories** · AI spots each food on your plate. You fine-tune the grams. | `FinPhotoR1` / `FinPhotoEN` (+ `t19/ph-mercimek.jpg`) | lime |
| 02 | **Yaz, söyle ya da barkod okut** · Fotoğraf istemeyen öğünler de saniyeler içinde günlüğünde. | **Type, talk or scan a barcode** · No photo? Log a meal in seconds anyway. | `ScanR2` `mode=voice` (EN: uygulamanın EN metinleri — `voice/i18n.ts`) | mürekkep |
| **03** | **Koçuna sor: kalan kalorine göre ne yesem?** · kcalAI Koç gününe bakıp öğün önerir. Balance'ta günde 30 mesaj. | **Ask your coach what to eat** · kcalAI Coach looks at your day and suggests meals. 30 messages a day on Balance. | `FinCoachChat` / `FinCoachChatEN` (kaynak PNG `design/tur26k/png/FinCoachChat*.webp`; tek telefon ekranına kırpıldı, aşağıda) | lime |
| 04 | **Günün tek bakışta** · Kalori, makro ve su halkaları ana sayfanda. | **Your day at a glance** · Calorie, macro and water rings on your home screen. | `FinHomeR3` / `FinHomeEN` (üst 852 pt) | mürekkep |
| 05 | **İzmir'de makrosu hesaplı öğün kapında** · eatkcal mutfağından. Teslim edilen öğün günlüğüne kendiliğinden işlenir. | **Track your progress** · Eaten, burned and what's left, every day. | `FinEkProduct` / `FinTrackerEN` | lime |
| 06 | **Topluluktan tarif ve öğün keşfet** · Beğendiğin tabağı tek dokunuşla gününe ekle. | **Discover meals from the community** · Like a plate? Add it to your day in one tap. | `FinFeed` / `FinFeedEN` | mürekkep |
| 07 | **Fiyat baştan belli / 7 gün ücretsiz** · Yıllık planlarda 7 gün deneme. Ücretsiz planda günde 2 AI tarama. | **Clear prices / 7 days free** · 7-day free trial on yearly plans. Free plan: 2 AI scans a day. | `FinSubPaywallCoach` / `FinSubPaywallCoachEN` (Balance yıllık **2999,99 TL** · haftalık 57,69 TL / **$59.99** · $1.15; "kcalAI Koç dahil") | lime |
| Play öne çıkan | **Hesabı biz yapıyoruz, sen de görüyorsun.** · AI kalori hesaplama · Fit yemek | **The calorie tracker with a real kitchen behind it.** · AI calorie counter · Photo food tracker | `FinHomeR3` / `FinHomeEN` (telefon karesi 04) | lime |

Görsel dil: başlık üstte, büyük (Bricolage Grotesque 700), marka renkleri **lime `#C8F05A`** ve **mürekkep `#0A0A0A`** sırayla; üstte küçük
`kcal.` işareti; cihaz çerçevesi yok — yalnız ince koyu kenarlı yuvarlak köşeli ekran, alt kenardan taşar. Yasak dil yok (kilo vaadi,
önce/sonra, tıbbi iddia, "sınırsız AI", "yakında", egzersiz). Koç karesinde alt satırda "Koç tıbbi tavsiye vermez." görünür (panonun kendisi).
Zemin sırayla lime / mürekkep (tek = lime); 7 kare olduğu için ilk ve son kare lime.

## Örnek veriler (pano yer tutucularının yerine)
- Kullanıcı adı "İlter" → **Elif** (03, EN 04).
- 01: panodaki değerler (460 kcal; Ezogelin çorbası 180, pilav 210, ayran 70); fotoğraf `t19/ph-mercimek.jpg`.
- 04 TR: Tavuk Kinoa Bowl, **285 TL**, 540 kcal · P 42 g · K 48 g · Y 18 g (Keşfet panosundaki "Tavuk kinoa bowl" değerleri); eski fiyat ve indirim rozeti gizlendi.
  ⚠ Fiyat örnek — gerçek menü fiyatıyla teyit (SORULAR).
- 04 EN: 1,480 kcal kaldı · yenen 700 · etkinlik ~420 (koşu ~300, yoga ~120) · yoğurt kasesi 160 · tavuk kinoa 540.
- 05: hikâye rozetleri 420/380/510/290; isimler Ece, Selin, Mert, Ayşe; tabak tablosu kinoa 120 g 180 kcal 6/34/3 · tavuk 140 g 250 kcal 33/0/9 ·
  sebze 160 g 110 kcal 3/14/6 → toplam 420 g, 540 kcal, 42/48/18.
- **03 Koç** (M-S2): pano 2340 pt boyunda tek sohbet; `shots.js` › `coachJs` onu bir telefon ekranına (852 pt) indirir: başlık "kcalAI Koç ·
  Bugün %62, 760 kcal kaldı", hak hapı **"Bugün 28/30 · Balance"** (`[N]` → 28 = kalan), ilk soru-cevap ("Bugün nasıl gidiyorum?" → 760 kcal kaldı)
  başlığın altından kayar, ikinci soru **"Akşam ne yesem?"** (panoda "Proteinimi nasıl tamamlarım?"; başlıkla eşleşsin diye panonun kendi
  "Akşam ne yesem?" metni kullanıldı) → "Protein hedefine 38 g kaldı. Akşam için 3 öneri" + öneri kartları (Izgara tavuk, bulgur pilavı ve cacık
  540 kcal · P 42 · K 52 · Y 14). Altta hazır sorular + "Koç'a sor…" + "Koç tıbbi tavsiye vermez." Tarif/eatkcal/haftalık grafik mesajları
  kareye sığmadığı için gizli. EN: aynı kurgu; başlık uygulamanın EN adıyla **"kcalAI Coach"** (`coach/i18n.ts` `name`; panoda "kcalAI Koç").
- **07 fiyat**: paywall panosunun karalama kopyası `prep.sh` ile **,99'lu fiyatlara** çekildi (tasarım kaynağı değişmedi): Fresh 199,99 / 999,99 TL,
  Balance 499,99 / 2999,99 TL; haftalık = aylık×12/52 ya da yıllık/52 (46,15 · 19,23 · 115,38 · 57,69 TL); indirim Fresh %58, Balance %50
  (USD: Fresh $5.99 · $1.38/hafta, yıllık −58%; Balance −62%). Koç'lu varyant (`coach=true`): karusel 5 sayfa, Balance kartında "kcalAI Koç dahil".
  Karede görünen: Balance yıllık 2999,99 TL / $59.99 ve "7 gün ücretsiz, sonra 2999,99 TL/yıl".

## Ölçüler ve dosyalar
| Mağaza | Ölçü | Dosya |
|---|---|---|
| App Store iPhone 6,9" | 1320×2868 | `docs/store/shots/ios/{tr,en}/01–07.png` |
| App Store iPhone 6,5" | 1284×2778 | `docs/store/shots/ios/{tr,en}/65/01–07.png` |
| Google Play telefon | 1080×1920 | `docs/store/shots/play/{tr,en}/01–07.png` (Play en çok 8) |
| Google Play öne çıkan görsel | 1024×500 | `docs/store/shots/play/{tr,en}/feature.png` |

ASC'de 6,9" yüklenince küçük iPhone boyutları ondan ölçeklenir; 6,5" ayrıca verildi (eski cihaz önizlemesi net olsun). iPad desteklenmiyorsa
(`supportsTablet` kapalı) iPad karesi gerekmez — YAYIN_KONTROL A'da teyit. Play'de 7"/10" tablet kareleri isteğe bağlı (verilmedi).

## Yeniden üretme
Betikler `docs/store/shots/_kaynak/` (repoya paket eklenmedi; `~/dev/kcal-research` içindeki Playwright kullanılır):
```
# 1) Panoların karalama kopyası (kaynağa yazılmaz): final + tur26k (Koç, Koç'lu paywall), ses kipli Tara, ,99'lu paywall fiyatları
sh docs/store/shots/_kaynak/prep.sh "$SCRATCH/boards"          # SCRATCH = boş bir karalama dizini
(cd "$SCRATCH/boards" && python3 -m http.server 8765 --bind 127.0.0.1) &
# 2) Telefon kareleri (1179×2556) → 3) mağaza kompozisyonu
node docs/store/shots/_kaynak/phone.js render "$SCRATCH/phones"          # tek kare: … render "$SCRATCH/phones" tr-03
node docs/store/shots/_kaynak/compose.js "$SCRATCH/phones" docs/store/shots
```
- Başlıklar `compose.js` › `COPY` (7 kare); örnek veriler ve Koç kırpma kancası (`js`) `shots.js`; fiyat yaması `prep.sh`.

## Gerçek kareyle değiştirme (TestFlight sonrası)
1. Simülatörde iPhone 17 Pro Max (ya da cihaz) ile kareyi al, 1179×2556'ya kırp/ölçekle (`sips -z 2556 1179`).
2. `$SCRATCH/phones/{tr,en}-NN.png` olarak kaydet, yalnız 3. adımı (`compose.js`) çalıştır.
3. LOG'a "NN gerçek kare" diye not düş.
