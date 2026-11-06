# G15-S3 — Keşfet + Sosyal: Final ile birebir

## ÖZET (10 satır)
(1) Keşfet'in 19 panosu (FinAddSheet S2'de) Light + Dark, çok kareli panoların her karesi dahil, vitrinde Final ile yan yana karşılaştırıldı: hepsi **aynı** ya da **küçük fark** (tablo aşağıda; G14'te 15'i büyük fark / ekran yoktu).
(2) Akış kartı Final'e giydirildi: tabak fotoğrafı + besin etiketleri + "Besinleri göster/gizle" + besin tablosu (`meal_card.items`, isteğe bağlı), "Kalori hedefine uyar" (gerçek kalan kcal), ikon+sayı eylemler, Gün halkası şeridi (seri hapı, "Günüm +" = paylaş), başlıkta + yok / zilde nokta, siyah ipucu balonu, doğru yönelme eki ("Kahvaltı’ya logla").
(3) Yeni ekranlar/durumlar: Bildirimler TAM SAYFA, gönderi detayı (FinDetail), şikayet akışı tam sayfa + teşekkürler + sonuç kartı, Ben de yaptım süre sayfası + toast, video tam ekran oynatıcı, paylaşım durumları (Paylaşılıyor… / İnceleniyor / Yayında / sakin ret kartı), Composer 3 sahne, yorum menüleri + boş durum.
(4) Vitrin: çok kareli pano desteği (`kcal://dev/screen/FinComments~2`), Keşfet için Final örnek içerik + Final'in örnek fotoğrafları + 42 sn örnek video (`src/dev/vitrinKesfet.ts`, `src/dev/assets/`) — YALNIZ __DEV__, üretim paketinde 0 (kontrol edildi).
(5) Bayrak kapalı = bugünkü uygulama: Keşfet yalnız `kesfet` arkasında; tek sızıntı (kesfet kapalıyken derin bağlantı gönderi ekranının kartı) night14/visual kartının dondurulmuş kopyasıyla kapatıldı + parite testi; Tracker flagOff snapshot aynı.
(6) Eski tasarım: 0 (envanter aşağıda) — GunEmpty öğün seçicisindeki 1.0.7 BottomSheet, Bildirimler sheet'i, kırmızı Sil/Engelle, eski composer ve eski sosyal izin sayfası Final diline geçti.
(7) Kontrol: tsc 0 · test:unit 531/532 (1 atlanan, 0 hata) · test:components 93/93 (snapshot 1/1) · `expo export --platform ios` ✓ (9.39 MB) · vitrin tree-shake 3/3.
(8) Paralel çalışma: 3 yardımcı (Composer+Kurallar · Bildirimler+Şikayet+Yorumlar · Detay+Etkinlik) aynı dalda, kendi dosyalarında; ana oturum akış kartı, şerit, ipucu, video, serbest, paylaşım durumları, toast, kaydırma.
(9) KİMSE dosyalarına (sipariş/ödeme/adres mantığı, auth, package.json, app.config.js) dokunulmadı; yeni paket/migration/eas/canlı yazma YOK. Dal `night15/kesfet` (taban `night14/visual`), worktree `.claude/worktrees/g15-s3`, simülatör "G15-3 iPhone" (klon).
(10) SORULAR: 8 madde (FeedR3 kart düzeni, sunucu alanları, sessize al/daha az göster RPC, simülatör karışması…). Son commit GERÇEK dosya `docs/night/G15-S3-DONE`.

## Pano tablosu (önce G14 → sonra G15)
Görüntüler: `.claude/night/out/g15-s3/{app,pairs}` (Final solda, uygulama karesi/kareleri sağda). Çok kareli panolar `Pano~N` ile tek tek çekildi.

| Pano | G14 (önce) | G15 (sonra) | Kalan fark |
|---|---|---|---|
| FinFeed | küçük fark | aynı | — (tabak etiketleri, Kalori hedefine uyar, besin tablosu, şerit, başlık birebir) |
| FinFeed-Dark | küçük fark | aynı | — |
| FinFeedScrollR3 | büyük fark | küçük fark | kaydırınca başlık+sekmeler katlanır, küçük çubuk (Keşfet + Tara) birebir; kart gövdesi FinFeed kartı (FeedR3'ün foto-önce kartı değil — SORU 1) |
| FinFeedScrollR3-Dark | büyük fark | küçük fark | aynı |
| FinFeedTip | büyük fark | küçük fark | siyah balon (başlık · açıklama · Tamam) logla düğmesine çapalı birebir; arka plan FinFeed kartı (SORU 1), çubuk küçük |
| FinFeedTip-Dark | büyük fark | küçük fark | koyu temada açık balon birebir; aynı not |
| FinFollowingEmpty | büyük fark | aynı | — |
| FinFollowingEmpty-Dark | büyük fark | aynı | — |
| FinDetail | büyük fark | küçük fark | görüntülenme sayısı gizli (veri yok); yorum satırında yalnız yanıt sayacı (Comment'te diğer sayaçlar yok — SORU 3) |
| FinDetail-Dark | büyük fark | küçük fark | aynı |
| FinSerbest | büyük fark | aynı | Final'deki "Fotoğraf · …" yer tutucu yazısı mock'a özgü (gri kutu + görsel ikonu var) |
| FinSerbest-Dark | büyük fark | aynı | — |
| FinActivityCard (1·2·3) | büyük fark | aynı | sheet köşesi 24/28 (ölçü) |
| FinActivityCard-Dark | büyük fark | aynı | — |
| FinVideo (1·2) | büyük fark | küçük fark | kare 1'de video gerçekten oynuyor (Final'de gri yer tutucu); süre hapı, ses, ilerleme, tam ekran oynatıcı birebir |
| FinVideo-Dark | büyük fark | küçük fark | aynı |
| FinCompose (1·2·3) | büyük fark | küçük fark | kare 2 önizlemede "0 kişi logladı" (Final [N]); "Tara sonucundan" ortalı kırılıyor |
| FinCompose-Dark | büyük fark | küçük fark | aynı |
| FinPosting (1·2·3·4) | büyük fark | aynı | — (Paylaşılıyor / İnceleniyor soluk gönderi + çizgi / Yayında / sakin ret kartı) |
| FinPosting-Dark | büyük fark | aynı | — |
| FinRules | küçük fark | küçük fark | kabul akışında "Anladım, paylaş" düğmesinin üstü kaydırma sonunda görünür (Final'de düğme yok) |
| FinRules-Dark | küçük fark | küçük fark | aynı |
| FinComments (1·2·3) | büyük fark | küçük fark | kendi yorumunda ⋯ yok (Final'de var); ±2 pt |
| FinComments-Dark | büyük fark | küçük fark | aynı |
| FinNotifications | büyük fark | küçük fark | avatar baş harfi (Final'de boş gri daire) |
| FinNotifications-Dark | büyük fark | küçük fark | aynı |
| FinAddToast | küçük fark | aynı | — (Öğle’ye loglandı · Geri al · Gör) |
| FinAddToast-Dark | büyük fark | aynı | — |
| FinPostMenu | küçük fark | aynı | — |
| FinPostMenu-Dark | küçük fark | aynı | — |
| FinPostMenuBlock | büyük fark | aynı | — |
| FinPostMenuBlock-Dark | büyük fark | aynı | — |
| FinReport | büyük fark | aynı | — |
| FinReport-Dark | ekran yok | aynı | — |
| FinReportDone | büyük fark | aynı | — |
| FinReportDone-Dark | ekran yok | aynı | — |
| FinReportNotice | büyük fark | küçük fark | sistem satırları "Bu hafta" altında (Final: hepsi Bugün, "Dün" etiketi); zaman satır sonunda |
| FinReportNotice-Dark | ekran yok | küçük fark | aynı |

FinAddSheet bu oturumun değil (G15-S2 listesinde). Toplam: 38 satır → 21 aynı, 17 küçük fark, 0 büyük fark.

## Eski tasarım: 0
Bayraklar açık, Keşfet sekmesi ve açtığı her ekran/sheet tarandı (`grep` eski `COLORS`/`constants/colors`/`components/BottomSheet` + görsel kontrol):
- Bildirimler sheet'i (sade liste) → tam sayfa `KesfetNotifications` (düzeltildi).
- Gönderi menüsünde kırmızı "Sil", yorum menüsünde kırmızı "Engelle" → mürekkep (düzeltildi).
- Yorum şikayeti sheet içi kısa liste → tam sayfa şikayet akışı (düzeltildi).
- Eski composer (X başlık, çerçeveli metin kutusu, çip etkinlik seçici, hep açık öğün formu) → Final Composer (düzeltildi).
- Akış kartı: rol çipi, "Beğen · N" etiketleri, kare yorum ikonu, + başlık düğmesi, sayılı zil rozeti, bilgi bandı ipucu → Final (düzeltildi).
- Günüm boş → "paylaş" öğün seçicisi `GunEmpty` 1.0.7 `components/BottomSheet` → core `Sheet` (düzeltildi).
- Sosyal bildirim izni ön sayfası (ortalı lime ikon) → FinSheetNotify dili (düzeltildi).
- Koyu tema: Keşfet durum çubuğu yazısı görünmüyordu; sekme çubuğunda Keşfet pusulası kayboluyordu (oyuk rengi bubble idi); küçük çubukta ikon dairenin üstündeydi → düzeltildi.
- Bayrak açıkken Keşfet'ten açılan diğer ekranlar başka oturumlarda: Gün görüntüleyici (S2), herkese açık profil/gizlilik (S4), öğün sheet'i FinAddSheet (S2).

## Yeniden giydirilen (Final'de yok)
Gönderi düzenle sayfası + menüde Düzenle; kendi gönderini sil onayı; yorumda "yanıt veriyorsun" çubuğu; bildirimlerde "Daha önce" bölümü; şikayet gönderilemezse sakin not + Tekrar dene; şikayet sonucu "korundu" kartı; Composer'da Elle gir alanları, ürün arama paneli, video küçük resmi; Kurallar'da "Anladım, paylaş"; detayda ⋯ menü ve etkinlik kartı; akış altı "Hepsi bu kadar"/yükleniyor; paylaşım hatası satırı + Tekrar dene; sosyal bildirim izni ön sayfası.

## Yapılanlar (öne çıkanlar)
- **Akış kartı** (`PostCard`, `PlateMedia`, `MealCard`, `MediaGrid`): `meal_card.items` varsa tabak etiketleri + Besinleri göster/gizle + tablo (Besin · Miktar · Kalori · P·K·Y · Toplam); "Kalori hedefine uyar" yalnız gerçek kalan kcal (`get_nutrition_summary`) yetiyorsa; eylemler ikon+sayı (beğen · yorum · kaydet · paylaş), dolu ikon mürekkep; rol düz metin; tek görsel en-boy oranlı yükseklik; metne dokun = detay.
- **Başlık / şerit / ipucu** (`KesfetScreen`, `RingStrip`, `FeedTip`): + başlıktan kalktı → "Günüm +" rozeti paylaş girişi (özellik kaybı yok); zilde lime nokta; şerit 64 halka + seri hapı; ipucu siyah balon, ilk öğün kartının logla düğmesine çapalı.
- **Yönelme eki**: "Kahvaltı’ya / Öğle’ye / Akşam’a / Ara öğüne logla" + toast "Öğle’ye loglandı" (önce "Kahvaltı’ye").
- **Video** (`FeedVideo` Final modu + `VideoPlayer`): süre hapı, ses düğmesi, ilerleme çizgisi; dokun = tam ekran (✕, sağ eylem sütunu, yazar + metin, ilerleme, duraklat + "0:15 / 0:42", ses). G8 davranışı `onOpen` verilmezse aynen.
- **Paylaşım durumları** (`postingStore`, `PostingStatus`, Composer): Paylaş'ta composer kapanır; yükle → create_post → moderate-content sırası aynı, arka planda; akışta Paylaşılıyor… → İnceleniyor (gönderi soluk) → Yayında (sunucu durumu 8 sn'de bir, en çok 15 kez) / sakin ret kartı (Kurallar · Düzenle); hata → Tekrar dene (aynı taslak).
- **Kaydırma**: aşağı kaydırınca başlık + sekmeler sekme çubuğuyla birlikte katlanır.
- **Yardımcı oturumlar**: Composer + Kurallar (`8996ab8`); Bildirimler tam sayfa + şikayet akışı + yorumlar (`381295f`, `302ea67`, `30a7941`); Detay + Ben de yaptım (`fd176d9`).

## Kontrol
| Kontrol | Sonuç |
|---|---|
| `npx tsc --noEmit` | 0 hata |
| `npm run test:unit` | 532 test: 531 geçti, 1 atlandı, 0 hata (yeni: posting, sharedPostParity) |
| `npm run test:components` | 22 süit, 93/93; snapshot 1/1 (Tracker flagOff) |
| `npx expo export --platform ios` | geçti, Hermes 9.39 MB |
| Vitrin üretimde yok | tree-shake 3/3 (dist ile); paket içinde vitrin metni/mp4/jpg 0, gerçek i18n ("Kalori hedefine uyar") 1 |
| Bayrak kapalı | Keşfet ekranları yalnız `kesfet`; `KesfetNotifications` rotası yalnız `sosyal_bildirim` (ya da __DEV__); `SharedPost` kesfet kapalıyken night14/visual kartının dondurulmuş kopyasını çizer (5 dosya, import dışı satır farkı 0) + parite testi; TabBarR3/FeedVideo/GunEmpty değişiklikleri yalnız bayrak açık yolda |
| KİMSE dosyaları | dokunulmadı (sipariş/ödeme/adres mantığı, auth, package.json, app.config.js) |

## SORULAR
1. **FinFeedScrollR3 / FinFeedTip** Final'de `FeedR3` (t22 kökenli, foto-önce, kcal şeridi alt kenarda) kartını kullanıyor; FinFeed ve diğer 15 Keşfet panosu girintili kartı. İki ayrı kart düzeni mi isteniyor (ör. öğün gönderisi foto-önce)? Şimdilik tek kart (FinFeed) — bu iki panoda yalnız kart gövdesi farklı.
2. Sunucu alanları istemcide İSTEĞE BAĞLI eklendi, gelmezse bölüm gizli: `meal_card.items` (tabak bileşenleri), bildirimde `excerpt`, `post_thumb_url`, türler `comment_like`/`report_result`/`system`. `get_feed` / `list_social_notifications` bunları ne zaman dönecek?
3. FinDetail yorum satırında 5 sayaç (yanıt · ben de logla · beğen · kaydet · paylaş) var; `Comment` yalnız `reply_count` taşıyor. Görüntülenme sayısı da yok.
4. "Sessize al" / "Benzerlerini daha az göster" için RPC yok: şimdilik yalnız bu oturumun akışından düşürüyor.
5. Şikayet nedenleri `report_content`'e kod olarak gidiyor; `body_shaming`, `fake_account` sunucu risk eşlemesinde 0 puan alıyor — kural eklensin mi?
6. Etkinlik toast'ındaki "Günüme paylaş" bir şey yapmıyor (önceden de yoktu); etkinliği güne paylaşma çağrısı yok.
7. Paylaşım artık arka planda: uygulama yükleme sırasında kapatılırsa gönderi yarım kalır (önce de composer açıkken aynıydı). Kalıcı kuyruk gerekir mi?
8. **Simülatör karışması**: "G15-3 iPhone"da çekim sırasında S2/S5 panoları (FinCelebStreak7, FinEkCheckout, FinEkAddress, Kayıtlı kartlarım) kendiliğinden açıldı; Metro'ma yalnız benim uygulamam bağlıydı, kendi openurl'lerim doğru UDID'yeydi. Kaynağı bulunamadı; etkilenen 6 çekim yeniden alındı ve her biri gözle doğrulandı.

## Commit'ler
- `b17b149` test(g15-s3): SharedPost bayrak kapalı parite testi
- `f486bd9` fix(g15-s3): bayrak kapalı parite — kesfet kapalıyken derin bağlantı gönderi ekranı night14/visual kartının dondurulmuş kopyasını çizer (Final kartı yalnız bayrak açık)
- `3705f15` fix(g15-s3): eski tasarım envanteri — Günüm boş öğün seçicisi eski BottomSheet yerine Final Sheet; sosyal bildirim izni sayfası FinSheetNotify dilinde
- `d9b96e4` feat(g15-s3): FinFeedScrollR3 — aşağı kaydırınca başlık + sekmeler de katlanır, küçük çubukta Keşfet ikonu ortada; koyu temada öğün kartı #1C1C1E (makro çipleri seçilir)
- `d8f2266` feat(g15-s3): FinPosting — paylaşım akışta: Paylaşılıyor… / İnceleniyor (soluk gönderi + ilerleme çizgisi) / Yayında / sakin ret kartı (Kurallar · Düzenle); Composer Paylaş'ta kapanır, gönderim sırası aynı, hata → Tekrar dene (taslak korunur)
- `e182d5c` feat(g15-s3): FinVideo — akışta süre hapı + ses düğmesi + ilerleme çizgisi + Final yer tutucu, dokun = tam ekran oynatıcı (✕, sağ eylem sütunu, yazar/metin, ilerleme, duraklat + süre, ses); vitrin örnek video (yalnız __DEV__)
- `30a7941` fix(g15-s3): Bildirimler + şikayet sayfası temalı durum çubuğu (koyu temada saat görünür), şikayet sonucu kartında zaman büyük harfle
- `efb866c` fix(g15-s3): FinSerbest — tek görsel en-boy oranlı yükseklik, gri yer tutucu + görsel ikonu, beğeni/kaydet dolu ikon mürekkep, yuvarlak yorum balonu; Keşfet sekme ikonu oyuğu Final cut rengi (koyu temada pusula görünür); Keşfet durum çubuğu temaya göre
- `302ea67` feat(g15-s3): FinComments — ortalı 'Yorumlar · N', 36/28 avatar + 52 girinti yanıt, Yanıtla/Sil, Yorum yaz hapı + siyah gönder; ⋯ yorum menüsü (Şikayet et tam sayfa / Engelle onayı / Vazgeç); boş durum
- `fd176d9` feat(g15-s3): FinDetail gönderi detayı (Gönderi çubuğu, büyük foto, Ben de logla kırpılmaz, istatistikler, yorumlar, Yanıtını yaz) + FinActivityCard kartı ve Ben de yaptım süre sayfası; vitrin son panoyu yeniden yüklemede korur
- `126a40e` feat(g15-s3): FinAddToast — Final toast (koyu temada açık zemin, yazı ailesi), vitrin loglama toast'ı; hedef çipi yalnız besinler açıkken
- `f97ef4a` feat(g15-s3): FinFollowingEmpty — ikon dairesi, başlık/açıklama, önerilen hesaplar (bio herkese açık profilden), Takip sekmesiyle açılış; avatar yer tutucusu Final rengi
- `381295f` feat(g15-s3): Bildirimler tam sayfa (Takip istekleri/Bugün/Bu hafta, gruplama, Onayla/Sil, şikayet sonucu kartı) + şikayet akışı tam sayfa (7 neden, not, Teşekkürler: engelle/sessize al/daha az göster) + menü ayırıcıları, siyah engelle onayı
- `8996ab8` feat(g15-s3): FinCompose — Final paylaş ekranı (İptal/Paylaş, bölmeli seçici, medya kareleri, öğün kartı kaynakları + önizleme, etkinlik ızgarası, Süre/Mesafe, kural notu, Fotoğraf/Video çubuğu); FinRules kalın başlıklar + kabul düğmesi içerikle kayar
- `1d38817` feat(g15-s3): Keşfet akış kartı Final — tabak fotoğrafı + besin etiketleri/tablosu, Kalori hedefine uyar, Gün halkası şeridi (seri hapı, Günüm + = paylaş), başlıkta + yok/zilde nokta, siyah ipucu balonu, aksiyonlar ikon+sayı, doğru yönelme eki
- `c508540` feat(g15-s3): vitrin çok kareli pano (~N) + Keşfet katalog kareleri, KesfetScreen vitrin parametresi (yalnız __DEV__)
- `73211ab` feat(g15-s3): Keşfet vitrin verisi — Final örnek içerik + fotoğraflar (yalnız __DEV__); MealCard.items, bildirim excerpt/thumb isteğe bağlı alanları
- (bu LOG commit'i ve `docs/night/G15-S3-DONE`)
