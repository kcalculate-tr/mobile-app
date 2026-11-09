# G18-S3 — eatkcal (Final Tur 26 / 26d / 26e birebir) · 9 Kas

## ÖZET (10 satır)
(1) Dal `night18/eatkcal` (taban `night17/camera` `249b89b`), worktree `.claude/worktrees/g18-s3`, simülatör "G18-3 iPhone" (`21398489-…B1DF`, G17-2 klonu), Metro 8103. 8 maddenin hepsi commit edildi (tablo aşağıda).
(2) **Ürün sayfası:** önce `git revert 5880260` (dikey satır geri alındı) → yatay kartlar Tur 26d ölçüsünde (136×166, görsel 54/12, iç 8,5). Makro satırı + "Sepete ekle ([N] TL)" **tek yüzen alt katman** (%96 opak, kontrast ≥ 5,3:1); eklenince aynı düğme lime **"Sepete git"** (200/28); ürün sayfasında yüzen sepet çubuğu YOK. İçerik özeti + "Tüm içerik".
(3) **Yüzen lime sepet çubuğu** yalnız FinEkHome + FinEkStore: 56 / yan 16 / sekme çubuğunun 12 üstü, "Sepet (N)" · toplam · "Sepete git", Tara ile çakışmaz; görünme ve her eklemede eatkcal 200/28.
(4) **İl kapısı:** ülke → 81 il (Türkçe arama); İzmir "Açık" → mevcut `checkCity`; diğer il / diğer ülke → "Çok yakında" (sipariş akışı başlamaz) + "Restoranını ekle" / "Restoran öner" form sheet'leri. Gönderim cihaz kuyruğu → `eatkcal_waitlist_requests` (**migration DOSYASI, CANLIYA UYGULANACAK**; tablo yokken hata yok).
(5) **Özet:** "Öde [N] TL" + altında yardım ("Yöntem ve zaman seç" / "Sözleşmeleri onayla"), "Yöntem ve zaman" açık ve "Seçilmedi" başlar, "Ödeme altyapısı" + resmî Paynkolay logosu. **Kutlama:** yalnız doğrulanmış siparişte 900 ms cam kase + nokta yağmuru → kalıcı sipariş no + "Siparişi takip et"; tahmini süre yalnız gerçek veriyle.
(6) **TL biçimi:** ortak `formatPrice` (`285 TL`, `285,50 TL`, ₺ yok, nokta ayracı yok) — bütün v2 eatkcal ekranları `money` üzerinden; mantık katmanının hazır metinleri (Minimum sepet, kupon) yalnız görünümde yeniden biçimlenir. `src/modules/eatkcal` + `src/lib/money.ts` içinde ₺ = 0 (yorum hariç).
(7) Kontrol: tsc 0 · test:unit 652 geçti / 0 kaldı / 1 atlandı (önceden var) · jest 31 suite / 161 test, snapshot 2/2 · `expo export` iOS ✓ (9,5 MB) Android ✓ (9,5 MB) · eslint 0 hata.
(8) **Sipariş mantığı diff 0** (KİMSE + v2 `checkout/`, `checkoutModel`, `cartModel`, `productModel`, `EkPaymentScreen`, `cityGateStorage`, `useRegistration`). **Bayrak kapalı aynı** (bütün değişiklikler `yeni_siparis` v2 yolunda; TabBarR3 teması yalnız EkCart kayıtlıyken).
(9) **Eski tasarım: 0.** Ölçülü karşılaştırma tablosu (bölge SSIM, yerleşim ölçeği) + dayanaklı farklar aşağıda.
(10) SORULAR: 6 madde (migration uygulanması, içerik/alerjen verisi, ödeme seçimi, ışık süpürmesi, simülatör klonu, canlı DB okuması). Son commit GERÇEK dosya `docs/night/G18-S3-DONE`.

## Commit'ler
| Madde | Commit | Özet |
|---|---|---|
| 4 (ön koşul) | `fbae71d` | `git revert 5880260` — G17-S1 md.12 dikey seçenek satırı geri alındı, yatay kartlar döndü |
| 4 | `3144eee` | Tek yüzen alt katman, "Sepete git", kart 136×166 / görsel 54, başlıkta fiyat, İçerik + Tüm içerik, ortak `formatPrice` |
| 2, 3 | `35aba31` | Yüzen lime sepet çubuğu (Home + Store), banner yalnız görsel + metin altta, FinEkHomeSkeleton blokları; temas: TabBarR3 hapı |
| 5, 6 | `d732b9e` | Özet "Öde [N] TL" + yardım satırı + "Ödeme altyapısı" logo; FinEkOrderSuccess kutlaması |
| 1 | `6e2c33d` | İl kapısı ülke → il, "Çok yakında", iki form sheet, kuyruk, migration dosyası, vitrin kataloğu |
| 7, 8 | `f163e00` | Bileşen testi (5), mantık metinlerinde TL biçimi (görünüm), vitrin sepetli Home/Store, `scripts/dev/g18-ssim.ts` |
| 7 | `e01e667` | Geri düğmeleri Final "‹" (ürün, mağaza, kapı) |
| 7 | `1a473f0` | FinEkStore sağ üst sepet düğmesi kalktı |
| 5 | `203b944`, `6d227cf` | "Yöntem ve zaman" açık + "Seçilmedi" başlar; taslak varken mantığın seçimi gösterilir |
| 7 | `ecb7093` | Sipariş satırı "tarih␣␣tutar" (Final; virgül yok) |
| 6 | `1a23cef` | Kase parıltısı radyal geçişe yakın |
| — | bu LOG, DONE | Kontroller + karşılaştırma |

## 1 — İl kapısı (FinCityR1 · FinWaitlistR1 · FinWaitlistAdd · FinWaitlistSuggest)
- `ui/gate/CityGateView.tsx` yeniden: başlık 30 + lime işaret, alt metin, **Ülke** (52, kart, açılır seçim: Türkiye / Diğer ülke), **İl** (48 arama, `model/provinces.ts` 81 il, İzmir başta "Açık" çipi, diğerleri "Çok yakında", 24 radyo), alt "İl seç" + "Devam et" (sekme çubuğunun 12 üstü). İzmir → **mevcut** `useEatkcalRegistration().checkCity` (checkDeliveryCity RPC) → çağıranın `onAllowed` (writeCityGatePassed + adres) — mantık aynı. Diğer il / Diğer ülke → FinWaitlistR1; **sipariş akışı başlamaz** (`gateTarget`, 3 birim testi).
- FinWaitlistR1: 340 fotoğraf alanı (il fotoğrafı varlığı yok → yer tutucu yüzey), cam geri, "Çok yakında" 34 lime, gövde metni ille, lime "Restoranını ekle" kartı + çerçeveli "Restoran öner" kartı, "Bu arada takibe devam et".
- `ui/gate/WaitlistFormSheet.tsx`: Final ölçüleri (üst 64/120, köşe 28, sağ 44 X, alanlar 52/16, sabit alt yardım + düğme, gönderince "Başvurunu aldık" / "Önerin için teşekkürler"). Zorunlular Final ile aynı (ekle: ad, il, yetkili, telefon, e-posta; öner: ad + il).
- Veri: uygun tablo yok (canlı şema dosyası `CANLI_SEMA_2026-11-09.md`) → **`supabase/migrations/20261108000300_g18_eatkcal_waitlist.sql` — CANLIYA UYGULANACAK.** RLS: `insert` yalnız `user_id = auth.uid()` ve `status='new'`, `select` yalnız kendi satırı; güncelleme/silme yok; çift gönderime karşı `(user_id, client_ref)` tekil indeksi.
- İstemci: `ui/gate/waitlistSend.ts` + saf `model/waitlist.ts` — önce AsyncStorage kuyruğuna yazar, sonra göndermeyi dener; tablo yok / oturum yok / ağ yok → **satır kuyrukta kalır, kullanıcıya hata gösterilmez**; kapı her açılışta kuyruğu boşaltır; 23505 = gönderildi sayılır; kuyruk en fazla 20 satır (4 birim testi).
- FinEatBerlin adımı korundu; "Restoranını ekle" artık e-posta bağlantısı yerine aynı form sheet'i açar.

## 2 — FinEkHome banner / iskelet
`CampaignCard`: 300×104 görsel (karartma / "İncele" yok), tamamı dokunulur bağlantı; altında "Kampanya" (13/600 ikincil) + başlık (15/700, varsa). `HomeSkeleton`: Final blokları (88 sipariş kartı, 44 Macro, 52 teslimat, 104 banner + 180×14 başlık çizgisi).

## 3 — Yüzen lime sepet çubuğu (FinMoCart)
`ui/home/CartBar.tsx`: 56 yükseklik, yan 16, köşe 28, düz lime, metin mürekkep; sol "Sepet (N)" (15/700), orta toplam (Bricolage 17, `formatPrice`), sağ "Sepete git ›"; tamamı tek bağlantı → EkCart. Konum `tabBarBottomOffset + 62 + 12` (sekme çubuğunun 12 üstü, Tara dairesinin de üstünde → çakışmaz); sekme çubuğu olmayan mağazada güvenli alan + 12. Görünme eatkcal yayı 200/28 (y 16 → 0 + opaklık), her eklemede ölçek 1 → 1,03 → 1 (300 ms) + sayı/toplam yuvarlanır, boşalınca 200 ms çıkış; azaltılmışta yalnız 200 ms opaklık. Yalnız EkHome + EkStore'da render edilir; ürün sayfasında YOK.
**Temas (S5 birleştirir):** `src/modules/shell/TabBarR3.tsx` tek koşul — siyah "Sepet (N)" hapı `EkCart` rotası kayıtlıyken (yeni_siparis açık) çizilmez; kapalıyken aynen. Mağazada "Sepete eklendi" toast'ı ve sağ üst sepet düğmesi kalktı (Final'de yok; aynı işi çubuk görüyor).

## 4 — Ürün sayfası
- Revert + `OptionCard` 136×166, iç 8,5, görsel 54 köşe 12, çıkartma 54; onay rozeti #0A0A0A + lime tik. Rozet "İsteğe bağlı, en fazla 2" (küçük harf, Final).
- `ProductBottomBar` (yeniden): tek yüzen katman — kenar 12, alt 20, köşe 28, iç 10, yüzey %96 opak + bulanık. Üst satır (44 + 8, alt çizgi): miktar (gramaj) + ad | `[N] kcal` + P/K/Y çipleri (22, iç içe yüzey); eksik seçimde "Zorunlu seçimleri tamamla". Kapalı 72 → açık 124, 300 ms standard; açılır: kaydırma > 500 ya da seçim; kapanır: üste (< 40) dönünce. Alt satır: adet (44) + "Sepete ekle ([N] TL)" (52, 15 kalın; pasifte #DCDEE2/#45454A). Eklenince aynı düğme lime "Sepete git ›" + tik (ölçek 1 → 1,04 → 1 500 ms, tik 0,4 → 1 300 ms); seçim/adet değişince "Sepete ekle" 200 ms opaklıkla geri gelir. Otomatik geri dönüş KALKTI (Tur 26e). Ayrı canlı makro şeridi (`LiveMacroStrip`) ürün sayfasından çıktı (bileşen duruyor).
- **Kontrast (≥ 4,5:1):** açık miktar/kcal 19,6 · ad 5,3 · çip 16,6 · düğme 19,8 · pasif 7,1 · Sepete git 15,1; koyu 15,6 · 6,6 · 12,8 · 15,6 · 5,4.
- Başlık: marka · ad · açıklama · **fiyat satırı** (17/700 + üstü çizili eski + indirim rozeti). Makro halkaları Final renkleri (kcal lime çizgi, P mürekkep, K ikincil, Y açık gri).
- **İçerik:** "İçerik" kartı — seçili bileşenlerden kısa özet ("A, B ve C"); "Tüm içerik" → satırlar (bileşen + gramaj/kcal), 200 ms. Alerjen satırı veri olmadığından gizli (SORULAR 2).
- Sepete ekleme çağrıları aynı (`buildCartAddCalls` → `addItem`).

## 5 — Özet (FinEkCheckout + PayWait/Fail/Unknown)
Düğme her zaman "Öde  [N] TL" (16/600, 10 boşluk); eksik adım düğmenin ALTINDA ("Yöntem ve zaman seç" / "Sözleşmeleri onayla"). "Yöntem ve zaman" bölümü açık ve "Seçilmedi" başlar (G17-S1 md.6 seçim kuralı aynen); ödeme bekleyen taslak varsa özet mantığın seçimini gösterir. "Ödeme altyapısı" satırı + **resmî Paynkolay logosu** (`assets/payment/paynkolay-logo.png`, 1.0.7 varlığı, İSTİSNA 3). Mantıktan gelen hazır metinler (Minimum sepet, kupon) yalnız görünümde `reformatLegacyTl` ile `300 TL` biçimine.

## 6 — FinEkOrderSuccess
`model/orderSuccess.ts` (3 birim testi): `isVerifiedOrder` = `status === 'confirmed' || payment_status === 'paid'` (EkPaymentScreen'in yoklama kuralı). Doğrulanırsa: 900 ms cam kase (y 24 → 0, ölçek 0,7 → 1,05 → 1, eatkcal eğrisi) + 14 lime nokta yağmuru (Final konumları) + 400 ms'de parıltı ve metin/kart (500 ms), haptik success; döngü yok. Doğrulanamazsa (taslak, 4 sn zaman aşımı, hata) kutlama YOK, kalıcı durum doğrudan. Kalıcı: "Siparişin alındı" (lime "alındı"), "Ödemen onaylandı, siparişin mutfağa iletildi.", kart: Sipariş numarası (Bricolage 22) + Tahmini süre **yalnız gerçek veriyle** (randevulu: gün + dilim; hemen: adres bölge tahmini; Gel-Al/veri yok → satır yok) + kazanılan Macro (varsa), lime "Siparişi takip et", sağ üst X. Sorgu yalnız okuma.

## 7 — FinEk taraması (Final'den sapma)
Çekimle bulunan ve düzeltilen: geri ikonu (← → ‹), mağaza sağ üst sepet düğmesi, özet bölümü kapalı/"Yöntem ve zaman seç" başlıyordu, sipariş satırı virgülü, kutlama parıltı kenarları, il başlığı boşluğu, vitrin adres örneğinde "·". Bütün eatkcal panoları + EN karşılıkları vitrin kataloğunda (`EK_EN`).

## 8 — Vitrin yolu (sipariş VERİLMEDİ)
Sepete ekle (FinEkProductSelected → Added, "Sepete git") → yüzen çubuk (FinEkHome/FinEkStore "Sepet (2) · 850,50 TL · Sepete git") → sepet (FinEkCart "Siparişe devam (850,50 TL)") → özet (FinEkCheckout "Öde 850,50 TL" PASİF + "Yöntem ve zaman seç"); ödeme adımı vitrin mock'u (FinEkCheckoutPayWait/Fail/Unknown), kutlama `vitrinVerified` (sorgu yok).

## Final ile ölçülmüş karşılaştırma (md.7, md.8)
Yöntem: vitrin (`G14_MODE=storage` eşdeğeri; bu oturumun klonunda bekleyen pano AsyncStorage'a yazılıp uygulama yeniden başlatılır), "G18-3 iPhone" (iOS 26.3, 1206×2622), Metro 8103, gerçek menü verisi; sipariş VERİLMEDİ. Ölçüm `scripts/dev/g18-ssim.ts`: iki görüntü genişliğe ölçeklenir (393), uzun Final panoları SIKIŞTIRILMAZ, üstten bir ekran boyu (852) kırpılır; durum çubuğu (0–54) hariç; bölgeler üst 54–300 · orta 300–600 · alt 600–852. **Yerleşim SSIM** = 1/4 ölçek (bloklar, boşluklar, renk alanları; 4×4 pencere), **Piksel SSIM** = tam ölçek (metin/fotoğraf dahil, 8×8 pencere). Panolar örnek veri ([N], [Ürün]) ve stok fotoğraf kullandığından %100 beklenmez; düşük değerin kaynağı aşağıdaki "dayanaklı fark" sütununda. Çekimler: worktree `.claude/night/out/g18-s3/app/` (82 görüntü: 32 açık + 10 koyu + 8 EN + düzeltme sonrası yeniden çekimler).
**Genel okuma:** veri/fotoğraf içermeyen panolar (il kapısı, bekleme, formlar, boş/iskelet hâller, kutlama) %71–85; fotoğrafı yoğun panolar (ana sayfa, mağaza, ürün) %17–45 — canlı menüdeki ürün görselleri beyaz zeminli paket fotoğrafları, Final'de koyu tonlu yemek fotoğrafları (koyu temada beyaz kare olarak ayrıca düşürür). Bu panolar yan yana gözle de karşılaştırıldı; düzen/ölçü/metin farkı kalmadı (düzeltilenler son sütunda).
| Pano | Uyum % (yerleşim SSIM, bütün) | Bölge üst / orta / alt | Piksel SSIM | Dayanaklı fark (veri/varlık) | Düzeltildi mi |
|---|---|---|---|---|---|
| FinCityR1 | 73.2 | 89.2 / 67.5 / 66.1 | 72.0 | 81 il (pano 20 örnek); ülke seçimi satır içi liste (pano native select) | başlık boşluğu ✓ |
| FinWaitlistR1 | 71.8 | 97.6 / 63.1 / 58.4 | 74.7 | il fotoğrafı varlığı yok → yer tutucu yüzey (pano da yer tutucu) | geri ‹ ✓ |
| FinWaitlistAdd | 77.5 | 92.9 / 78.6 / 63.8 | 78.6 | — | — |
| FinWaitlistSuggest | 77.1 | 88.9 / 68.2 / 77.4 | 78.9 | — | — |
| FinEatBerlin | 73.5 | 67.2 / 72.4 / 82.5 | 78.2 | restoran satırları veri yok → gizli | "Restoranını ekle" → form ✓ |
| FinEkHome | 38.8 | 46.5 / 39.0 / 29.6 | 42.3 | canlı sipariş kartı "Tahmini varış" yerine durum (ETA verisi yok); kampanya başlığı veri yoksa gizli; gerçek fotoğraflar | sepet çubuğu ✓ banner ✓ |
| FinEkHomeSkeleton | 67.3 | 71.5 / 70.6 / 61.7 | 79.9 | kategori çipleri iskelette de gri blok (pano gerçek çip) | bloklar ✓ |
| FinEkStore | 17.2 | 24.4 / 13.9 / 8.6 | 28.0 | kapak ve ürün fotoğrafları gerçek (koyu kapak) → SSIM düşük; puan satırı veri yoksa gizli | sağ üst sepet düğmesi kalktı ✓, geri ‹ ✓ |
| FinEkReviews | 42.4 | 14.0 / 41.8 / 67.3 | 51.6 | sheet içerik yüksekliğinde (pano sabit uzun); "KCAL yanıtı" veri yoksa gizli | — |
| FinEkProduct | 29.9 | 11.0 / 37.1 / 34.3 | 36.9 | kapak fotoğrafı ve açıklama uzunluğu gerçek; seçenek gramaj satırı veri yok → gizli | geri ‹ ✓, kart 166/54 ✓ |
| FinEkProductScroll | 44.2 | 38.8 / 54.1 / 36.7 | 53.2 | vitrin kaydırma konumu farklı (açıklama uzun) | tek katman ✓ |
| FinEkProductSelected | 38.2 | 37.2 / 35.0 / 43.9 | 49.5 | aynı | tek katman açık ✓ |
| FinEkProductAdded | 39.2 | 37.2 / 35.0 / 47.2 | 50.1 | aynı | "Sepete git" ✓ |
| FinEkCart | 44.7 | 55.0 / 43.0 / 36.5 | 55.8 | seçim özeti satırı vitrin ürünlerinde seçim yok → gizli; makro çip metni | TL ✓ |
| FinEkCartEmpty | 83.7 | 89.6 / 59.4 / 99.8 | 89.5 | — | — |
| FinEkCartSkeleton | 82.6 | 73.1 / 76.3 / 98.8 | 86.3 | — | — |
| FinEkCheckout | 49.8 | 45.3 / 48.7 / 55.1 | 63.0 | Ödeme "Yeni kart" (mantık varsayılanı; SORULAR 3); mantık uyarı satırı | bölüm açık + "Seçilmedi" ✓, Öde + yardım ✓, logo ✓ |
| FinEkCheckoutPayWait | 54.8 | 42.9 / 53.2 / 68.9 | 64.2 | ödeme satırı "Yeni kart" | taslakta yöntem özeti ✓ |
| FinEkCheckoutPayFail | 46.2 | 42.8 / 55.2 / 40.8 | 59.8 | aynı | — |
| FinEkCheckoutPayUnknown | 47.1 | 42.8 / 57.5 / 39.5 | 58.9 | aynı | — |
| FinEkAddress | 52.3 | 33.8 / 58.3 / 63.5 | 55.1 | harita gerçek MapView (pano çizim) | — |
| FinEkAddressNoPerm | 51.3 | 25.5 / 64.2 / 63.5 | 54.5 | aynı | — |
| FinEkAddressNoMap | 66.6 | 69.6 / 69.8 / 57.2 | 72.1 | — | — |
| FinEkAddresses | 77.4 | 58.9 / 72.0 / 99.8 | 83.1 | küçük harita görseli çizim, pin ortada (pano sol üst) | — |
| FinEkAddressesEmpty | 83.2 | 86.7 / 61.6 / 99.8 | 89.5 | — | — |
| FinEkOrders | 66.1 | 41.4 / 58.3 / 99.8 | 76.5 | ürün görselleri gerçek | meta virgülsüz ✓ |
| FinEkOrdersEmpty | 82.1 | 85.2 / 59.2 / 99.8 | 88.5 | — | — |
| FinEkOrdersFilterEmpty | 73.3 | 74.2 / 55.0 / 99.8 | 80.4 | — | — |
| FinEkOrderDetail | 52.5 | 58.1 / 54.8 / 38.2 | 63.4 | "Değerlendir" yalnız teslim edilmiş siparişte (mantık); kart son 4 verisi yoksa "Ödenen tutar"; "Sipariş değişikliği" kartı (Final'de yok, korunan özellik) | meta ✓ |
| FinEkOrderSuccess | 84.0 | 96.4 / 75.1 / 77.8 | 84.5 | kase ışık süpürmesi yok (maske paketi; SORULAR 4); tahmini süre vitrinde veri yok → gizli | parıltı ✓ |
| FinEkInfo | 61.1 | 40.5 / 61.4 / 81.5 | 71.9 | harita İzmir ilçe çizimi (pano yer tutucu sokak haritası); "(30–55 dk)" bölge verisi yoksa gizli | — |
| FinEkErrors | 63.9 | 59.9 / 62.0 / 72.7 | 66.4 | kart metinleri gerçek hata kodlarından | — |
| FinCityR1-Dark | 65.0 | 77.0 / 64.9 / 53.4 | 62.7 | ana panoyla aynı; 81 il (pano 20 örnek); ülke seçimi satır içi liste (pano native select) | Koyu/EN metinler sözlükten ✓ |
| FinCityR1EN | 72.0 | 88.3 / 65.8 / 64.1 | 71.9 | ana panoyla aynı; 81 il (pano 20 örnek); ülke seçimi satır içi liste (pano native select) | Koyu/EN metinler sözlükten ✓ |
| FinEkCart-Dark | 27.3 | 43.1 / 18.5 / 21.3 | 35.4 | ana panoyla aynı; seçim özeti satırı vitrin ürünlerinde seçim yok → gizli; makro çip metni | Koyu/EN metinler sözlükten ✓ |
| FinEkCheckout-Dark | 39.8 | 43.0 / 29.1 / 50.4 | 51.0 | ana panoyla aynı; Ödeme "Yeni kart" (mantık varsayılanı; SORULAR 3); mantık uyarı satırı | Koyu/EN metinler sözlükten ✓ |
| FinEkCheckoutEN | 48.2 | 44.6 / 46.8 / 52.3 | 63.2 | ana panoyla aynı; Ödeme "Yeni kart" (mantık varsayılanı; SORULAR 3); mantık uyarı satırı | Koyu/EN metinler sözlükten ✓ |
| FinEkHome-Dark | 22.7 | 26.6 / 28.1 / 10.0 | 28.7 | ana panoyla aynı; canlı sipariş kartı "Tahmini varış" yerine durum (ETA verisi yok); kampanya başlığı veri yoksa gizli; gerçek fotoğraflar | Koyu/EN metinler sözlükten ✓ |
| FinEkHomeEN | 30.2 | 44.2 / 26.6 / 24.8 | 40.7 | ana panoyla aynı; canlı sipariş kartı "Tahmini varış" yerine durum (ETA verisi yok); kampanya başlığı veri yoksa gizli; gerçek fotoğraflar | Koyu/EN metinler sözlükten ✓ |
| FinEkOrderSuccess-Dark | 70.6 | 94.7 / 57.2 / 64.2 | 72.7 | ana panoyla aynı; kase ışık süpürmesi yok (maske paketi; SORULAR 4); tahmini süre vitrinde veri yok → gizli | Koyu/EN metinler sözlükten ✓ |
| FinEkOrderSuccessEN | 82.2 | 96.4 / 71.2 / 78.6 | 83.0 | ana panoyla aynı; kase ışık süpürmesi yok (maske paketi; SORULAR 4); tahmini süre vitrinde veri yok → gizli | Koyu/EN metinler sözlükten ✓ |
| FinEkProduct-Dark | 19.6 | 11.0 / 24.8 / 16.5 | 24.5 | ana panoyla aynı; kapak fotoğrafı ve açıklama uzunluğu gerçek; seçenek gramaj satırı veri yok → gizli | Koyu/EN metinler sözlükten ✓ |
| FinEkProductAdded-Dark | 18.2 | 19.6 / 8.0 / 28.8 | 22.9 | ana panoyla aynı; aynı | Koyu/EN metinler sözlükten ✓ |
| FinEkProductAddedEN | 39.2 | 35.7 / 36.7 / 46.7 | 50.5 | ana panoyla aynı; aynı | Koyu/EN metinler sözlükten ✓ |
| FinEkStore-Dark | 14.4 | 21.0 / 13.4 / 8.7 | 21.6 | ana panoyla aynı; kapak ve ürün fotoğrafları gerçek (koyu kapak) → SSIM düşük; puan satırı veri yoksa gizli | Koyu/EN metinler sözlükten ✓ |
| FinWaitlistAdd-Dark | 74.2 | 92.2 / 72.6 / 62.8 | 75.3 | ana panoyla aynı; — | Koyu/EN metinler sözlükten ✓ |
| FinWaitlistAddEN | 77.3 | 89.7 / 79.6 / 65.3 | 78.3 | ana panoyla aynı; — | Koyu/EN metinler sözlükten ✓ |
| FinWaitlistR1-Dark | 64.0 | 97.7 / 52.6 / 43.8 | 68.8 | ana panoyla aynı; il fotoğrafı varlığı yok → yer tutucu yüzey (pano da yer tutucu) | Koyu/EN metinler sözlükten ✓ |
| FinWaitlistR1EN | 70.8 | 97.6 / 62.6 / 55.7 | 73.8 | ana panoyla aynı; il fotoğrafı varlığı yok → yer tutucu yüzey (pano da yer tutucu) | Koyu/EN metinler sözlükten ✓ |
| FinWaitlistSuggestEN | 73.8 | 86.0 / 63.7 / 74.2 | 75.7 | ana panoyla aynı; — | Koyu/EN metinler sözlükten ✓ |

## Kontrol (ORTAK #9)
- `npx tsc --noEmit` → 0.
- `npm run test:unit` → 653 test, 652 geçti, 0 kaldı, 1 atlandı (önceden var). Yeni: `money` (formatPrice, formatPriceDelta, reformatLegacyTl), `provinces` 3, `waitlist` 4, `orderSuccess` 3; `screenCatalog` (eatkcal Tur 26d/e + EN panoları kataloğa eklendi; eatkcal dışı yeni panolar `PENDING_TUR26`'da — sahibi ekledikçe siler), `noLegacyWhenFlagsOn` ✓, `legacySwap` ✓, i18n anahtar testleri ✓ (TR + EN eksik 0).
- `npx jest` → 31 suite / 161 test, snapshot 2/2 (bayrak kapalı TrackerScreen + Tara). Yeni `g18Layers.test.tsx` 5/5 (tek alt katman + "Sepete git", `285,50 TL`, sepet çubuğu, form doğrulaması + hatasız gönderim).
- `npx expo export --platform ios` ✓ · `--platform android` ✓ (çıktı iş klasöründe, repoya girmedi).
- `eslint` (değişen dosyalar) 0 hata.
- **Sipariş mantığı diff 0:** `git diff night17/camera -- src/screens/HomeScreen.tsx src/modules/eatkcal/screens src/lib/paynkolay* src/lib/payment* src/lib/checkout* src/lib/cart* src/lib/orders.ts src/lib/activeOrder.ts src/lib/reorder.ts src/store/cartStore.ts src/components/checkout src/screens/profile src/screens/auth package.json package-lock.json app.config.js src/modules/eatkcal/v2/checkout src/modules/eatkcal/v2/model/{checkoutModel,cartModel,productModel,addressSave}.ts src/modules/eatkcal/v2/screens/EkPaymentScreen.tsx src/modules/eatkcal/cityGateStorage.ts src/modules/profil/useRegistration.ts` → BOŞ.
- **Bayrak kapalı aynı:** değişen ekranların hepsi `yeni_siparis` açıkken kayıtlı v2 rotaları; `money.ts`'te yalnız YENİ dışa aktarımlar (`tl`/`tlGruplu`/`tlFark` aynen, eski ekranlar onları kullanır); TabBarR3 koşulu yalnız EkCart kayıtlıyken (bayrak açık) etkili; snapshot 2/2 + `gates.flagOff` ✓.
- **TL biçimi:** v2 eatkcal'de bütün tutarlar `money` = `formatPrice` (`285 TL`, `285,50 TL`); `grep ₺ src/modules/eatkcal src/lib/money.ts` → yalnız yorum satırları. Kapsam dışı (S5 grep için): `src/screens/tracker/HomeStrips.tsx:131` (`₺` — Ana sayfa, S2 alanı), `src/dev/vitrinStress.tsx` (dev stres panosu).

**Eski tasarım: 0** — bayrak açık eatkcal yolu (il kapısı, ana sayfa, mağaza, ürün, sepet, özet, ödeme ara durumları, kutlama, siparişler, adresler, bilgi, hatalar) yalnız v2/Final bileşenleri. Bu oturumda kaldırılan eski parçalar: TabBarR3'ün siyah "Sepet (N)" hapı (v2'de), mağaza "Sepete eklendi" toast'ı, ürün sayfası ayrı canlı makro şeridi.
**Yeniden giydirilen (Final'de yok):** kutlamada "Kazanılan Macro" satırı (→ Macro'larım) ve uyarı notu; FinEatBerlin "Restoranını ekle" → form sheet; eski yerel "Haber ver" tercihi → "Restoran öner" formundaki "E-postan, açılınca haber verelim".
**Özellik eşlemesi:** ürün sayfasındaki otomatik geri dönüş → "Sepete git"; mağaza sağ üst sepet düğmesi + toast → yüzen çubuk; kutlamadaki "Bugün / Ana sayfa" bağlantıları → sağ üst X (Ana sayfa) + sekme çubuğu.

## Temas (S5 birleştirir)
`src/modules/shell/TabBarR3.tsx` (CartPill koşulu, 1 satır) · `src/dev/screenCatalog.ts` + `src/dev/__tests__/screenCatalog.test.ts` (eatkcal kayıtları + PENDING listesi) · `src/dev/vitrinFixtures.ts` (adres örneği) · `src/lib/money.ts` (yeni dışa aktarımlar) · `src/core/i18n/dictionaries.ts` (yalnız `eatkcal.v2.*` blokları) · `scripts/dev/g18-ssim.ts` (yeni).

## CANLIYA UYGULANACAK
- `supabase/migrations/20261108000300_g18_eatkcal_waitlist.sql` — `public.eatkcal_waitlist_requests` + RLS (yalnız kendi satırını ekler/okur). Uygulanana kadar formlar cihaz kuyruğunda bekler, hata göstermez. **OTA:** istemci değişiklikleri yalnız JS (yeni paket / native değişiklik yok).

## SORULAR
1. **Migration** `20261108000300_g18_eatkcal_waitlist.sql` canlıya uygulanmalı; başvuru/önerileri görmek için admin panel ekranı yok (şimdilik Supabase tablo görünümü). Uygulanınca bekleyen cihaz kuyrukları bir sonraki açılışta kendiliğinden gönderilir.
2. **Ürün "İçerik"/alerjen:** `products` tablosunda içerik/alerjen kolonu yok (`CANLI_SEMA_2026-11-09.md`). İçerik özeti seçili bileşenlerden üretiliyor, alerjen satırı gizli. Gerçek içerik + alerjen metni için kolon (ör. `ingredients jsonb`, `allergens text`) kararı gerekir.
3. **Özet › Ödeme:** Final "Seçilmedi / Seç" ile başlıyor; mantıkta (useEkCheckout) varsayılan kart / "Yeni kart" seçili geliyor. Ödeme seçimini zorunlu kılmak sipariş mantığına dokunur → yapılmadı (md.5 yalnız yöntem+zaman diyor). İstenirse yalnız görünüm katmanında "Öde" pasif + "Ödeme yöntemi seç" eklenebilir.
4. **Kutlama ışık süpürmesi** (Final `osSweep`, kase maskesi): RN'de görüntü maskesi için paket gerekir (yeni paket yasak) → kase/parıltı/nokta yağmuru birebir, süpürme yok.
5. **Simülatör klonu:** `simctl clone` sonrası klondaki uygulama veri kabı kaynak cihazınkine (G17-2 `EE3E3A0A…`) çözülüyordu; G18-2 oturumunun vitrin "bekleyen pano" yazımları bu kaba gidiyor ve bizim klonu etkiliyordu. Bu oturum uygulamayı klonda yeniden kurdu (kendi kabı `539CF88E…`), takip izni TCC'de "izin verme", konum `simctl privacy`. G18-2'nin çekimleri G17-2 kabını kullanıyor olabilir — S5 kontrol etsin.
6. Canlı DB okuması (`supabase-prod execute_sql`, ürün açıklaması uzunlukları) otomatik mod sınıflandırıcısınca reddedildi; karar şema dosyasıyla verildi.
