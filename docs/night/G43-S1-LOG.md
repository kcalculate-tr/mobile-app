# G43-S1 — Yeni kayıt akışını sadeleştirme (14 Kas)

Worktree `~/dev/kcal-mobile/.claude/worktrees/g42-s1`, dal `feat/kayit-v2` (G42'nin üstüne). Yalnız JS/TS + asset (OTA uyumlu). Yeni paket yok. Deploy, OTA ve canlı DB yazımı yapılmadı. Akış, mantık, bayraklar, ölçüm olayları ve testlerin davranışı aynı; değişen yalnız görünüm ve hareket.

## ÖZET
1. **Renk**: kayıt paleti (`kayit/ui/theme.ts`) artık uygulamanın standart token'larından türüyor (`themes.light/dark.color` + `finExtras` tonları). Şeftali/zeytin degradeleri, 3 katman ışık lekesi, cam yüzeyler, `#0D2617` yeşil zemin ve lime dolu kartlar kaldırıldı. Lime yalnız ana düğme dolgusunda, seçili hâlin işaretinde ve ilerleme çubuğunda kullanılıyor. Seçili kenar, ana paywall'daki gibi `accentLine` (açıkta `#4A6B00`, koyuda lime).
2. **Tipografi ve bileşenler**: başlık Bricolage 700, 28 pt, tek renk. Alt metin Plus Jakarta 15–16 pt, muted. Vurgu hapı, konuşma balonu ve harf harf yazma yok. Seçim kartları (2×2 ızgara, hareket galerisi, tempo sütunları) **dikey liste satırlarına** çevrildi: beyaz yüzey, 1 px kenar, yarıçap 16, sol çizgi ikon. Seçili satırda 2 pt kenar + sağda lime işaret var, zemin beyaz kalıyor. Üst çubukta solda geri, ortada 4 pt ilerleme çubuğu var. Ana düğme 54 pt, yarıçap 27, gölgesiz. Segment, Profil'deki `FinSegmented` dilinde.
3. **Hareket**: panorama, paralaks, ışık kayması, maskot süzülme/zıplama, kart yay/ölçek, kademeli giriş, odometre, harf harf yazma ve paylaşılan öğe taklidi kaldırıldı (liste aşağıda). Kalanlar: native push / 220 ms fade, seçimde hafif seçim titreşimi, ilerleme çubuğunun dolması ve L1 (toplam ≤ 1,8 sn). Azaltılmış harekette hepsi anlık.
4. **Maskot** yalnız onboarding 1 (küçük, sabit), L1 (sabit, 4–6 sn'de göz kırpar) ve T1 başlığında (104 pt; paywall üst görseliyle aynı boy). Soru ekranlarında, I1/I2'de, K1/E1/E2'de, L2'de, R1'de ve T1 başarı ekranında maskot yok.
5. **Onboarding 1–5**: karşılama ekranındaki düzen kullanıldı: üstte nötr görsel alanı, altta beyaz kart (başlık, metin, 5 nokta, Devam). Geçiş standart yatay pager ile (kaydırma ya da Devam). Görseller gerçek öğeler: 1 maskot · 2 gerçek öğün fotoğrafı + tarama çerçevesi + Çek/Anlat/Sor çipleri · 3 mevcut eatkcal `ProductCard` (canlı katalogdan fotoğraflı ve ≥ 250 kcal ilk ürün; gelmezse yerel ürün fotoğrafı, fiyatsız) · 4 mevcut Keşfet `PostCard` (statik örnek) · 5 üç başlangıç satırı + Şimdi/Sonra segmenti. 4. ekran metni ve "Keşfet ve topluluk" kartı göreve göre değişti; "Padel/etkinlik" içeriği hiçbir yerde kalmadı.
6. **L1** = maskot + "Planın hazırlanıyor" + sırayla işaretlenen 3 satır. **L2** = beyaz kartlar: statik büyük kalori + 3 makro ince çubuk, tek çizgili kilo tahmini (muted aralık bandı), öğün dağılımı listesi, yatay tarif kartları, koşullu eatkcal kartı. Rıza satırı ve "Planımı kaydet" yerinde.
7. **K1/E1/E2**: Apple düğmesi native `AppleAuthenticationButton` (yalnız iOS; açık temada siyah, koyuda beyaz, "Continue"). Google düğmesi resmî beyaz stilde, e-posta ikincil (kenarlı). Koşullar · Gizlilik için ayrı 44 pt bağlantı satırı eklendi. OTP kutuları ve alanlar uygulamanın standart giriş alanı stilinde. **T1**: ana paywall'ın zemini (`PaywallGlow`), kartı, rozetleri, fiyat tipografisi ve yasal metni birebir. Seçili plan lime dolu değil: 2 pt kenar + lime radyo.
8. **Kontroller**: hygiene ✓ · tsc ✓ · unit **1311 geçti / 0 kaldı / 1 atlandı (1312)** ✓ · jest **682/682 (111 paket; 9 yeni G43 testi)** ✓ · `expo export` iOS ✓ · Android ✓. G43 ekran görüntüleri ve G42 ile önce/sonra yan yana panolar `docs/night/g43/` altında.

## Commit
| commit | içerik |
|---|---|
| 96c62e5 | sadeleştirme: palet, parçalar, seçiciler, 9 ekran, navigator geçişleri, onboarding varlıkları (`assets/kayit/`), `ProductCard.hidePrice`, `PaywallGlow` dışa açıldı |
| bc3d5dc | testler: G43 bileşen testleri (Apple iOS/Android, azaltılmış hareket, seçim satırı, 44 pt yasal satır); G42 metin beklentileri güncellendi |
| a9276a1 | HIG denetimi düzeltmeleri (aşağıda) + L1 `useRoute` koşulsuz (eslint rules-of-hooks hatası, G42'den kalma) |
| (son-1) | ekran görüntüleri `docs/night/g43/` + yan yana panolar + bu LOG |
| (son) | `docs/night/G43-S1-DONE` |

## Kaldırılan animasyonlar
| G42'de | yer | şimdi |
|---|---|---|
| Panorama kayması 450 ms + panel zemin rengi geçişi | Onboarding | standart yatay pager (`pagingEnabled`); Devam → `scrollTo` (azaltılmışta animasyonsuz) |
| Maskot katmanı M tablosuyla süzülerek yer değiştirme | Onboarding | yok (maskot yalnız 1. ekranda, sabit) |
| Maskot sürekli süzülme (±7 pt, 3,2 sn) | tüm ekranlar | yok |
| Maskot her cevaba zıplama (yay) | P1–P14, L1, T1, R1 | yok |
| Maskot göz kırpma | tüm ekranlar | yalnız L1 |
| 3 katman bulanık ışık lekesi + paralaks kayma | tüm ekranlar (`KBackdrop`) | düz `color.bg` |
| Soru balonu harf harf yazma (30 ms/karakter) | P1–P14, K1, E1, E2 | yok (tek renk başlık) |
| İçerik sağdan/soldan 330 ms kayma ("paylaşılan öğe hissi") | soru adımları | 220 ms fade (azaltılmışta anında) |
| Kart sıralı yükselme (stagger 110 ms) | P1, P2, P10, L2, R1 | yok |
| Seçilen kart yay ile %102 büyüme / diğerleri %97 küçülme | P1, P2, P10, T1 | yok (kenar + işaret) |
| Onay rozeti yay ile büyüme | seçim kartları | yok |
| Gün hapı %86 → yay | P9 | yok |
| Tabak yay ile büyüme | P12 | yok |
| Hareket galerisi (yana kaydırma, %92 ölçek, %62 opaklık) | P8 | liste satırları |
| Tarih aralığı kartı çapraz geçişi | P7 | statik |
| L1 büyük halka dolması + kalori sayarak artma + satır halkaları | L1 | onay listesi (spinner → işaret), ≤ 1,8 sn |
| L2 kalori sayarak artma (990 ms) | L2 | statik rakam |
| L2 kilo çizgisi çizilerek gelme (`DrawPath`) | L2 | statik çizgi |
| Ana düğme yükleniyorda daireye daralma | tüm düğmeler | aynı boyutta halka |
| Düğme basışta %98 ölçek | tüm düğmeler | opaklık 0,85 |
| T1 plan kartı basışta %96 + yay | T1 | yok |
| T1 bandı üstten inme (330 ms) | T1 | 220 ms fade |
| T1 başarı tik rozeti yay | T1 başarı | statik |
| R1 kartı aşağıdan gelme (550 ms) | R1 | yok |
| Yığın geçişi 550 ms sahne fade / alttan kayma | navigator | native push ya da 220 ms fade; azaltılmışta `none` |

## Token eşlemesi (`kayit/ui/theme.ts`)
| rol | açık | koyu | kaynak |
|---|---|---|---|
| `bg` zemin | `#F3F4F6` | `#000000` | `themes.*.color.bg` |
| `surface` kart/satır | `#FFFFFF` | `#1C1C1E` | `color.surface` |
| `ink` metin | `#0A0A0A` | `#F5F5F5` | `color.ink` |
| `sec` ikincil metin | `#6B6B70` | `#A1A1A6` | `color.secondary` |
| `line` 1 px kenar/ayraç, segment izi | `#E9EBEE` | `#2C2C2E` | `color.line` |
| `line2` boş radyo/kutu kenarı, e-posta düğmesi kenarı, boş nokta | `#8A8F96` | `#757575` | HIG 3:1 için `finExtras.line2`'den (`#C3C7CC`/`#48484A`, 1,7:1) koyulaştırıldı — KARAR 13 |
| `track` ilerleme izi, makro çubuk izi | `#DCDEE2` | `#2C2C2E` | `finExtras.track` |
| `accent` ana düğme, seçili işaret, ilerleme dolgusu | `#B9EF14` | `#B9EF14` | `palette.lime` |
| `onAccent` lime üstü | `#0A0A0A` | `#0A0A0A` | `palette.limeInk` |
| `accentLine` seçili 2 pt kenar | `#4A6B00` | `#B9EF14` | `color.accentLine` (ana paywall seçili kartı aynı) |
| `disabled` / `disabledText` | `#DCDEE2` / `#6B6B70` | `#2C2C2E` / `#8E8E93` | `finExtras.track` / `color.secondary` |
| `danger` / `dangerBg` | `#E5484D` / %8 | `#E5484D` / %16 | `color.danger` |

Kaldırılan G42 rolleri: `bgTop/bgMid/bgBottom` (şeftali / zeytin degrade), `blobA/blobB` (ışık), `card/cardEdge/bubble/bubbleEdge/circle` (cam), `ringFill #2E5B12`, `accentSoft` (lime %35 dolgu), `infoBg`, `field`, `tick/tickMajor`.
Yazı: başlık `BricolageGrotesque_700Bold` (G42: 800). Gövde Plus Jakarta 400/500/600/700.

## KARAR
1. **T1 zemini**: genel ilke "ışık lekesi yok" diyor, ama T1 maddesi "ana paywall'daki bileşenler BİREBİR (zemin, …)" diyor. Ana paywall'ın zemini statik iki radyal lime ışık (`PaywallGlow`). T1'e özgü madde öncelikli sayıldı; aynı bileşen dışa açılıp kullanıldı. Diğer hiçbir kayıt ekranında ışık yok. Düz zemin istenirse tek satır değişiklik: `OfferScreen.tsx` içindeki `<PaywallGlow/>` kaldırılır.
2. **T1 Yıllık/Aylık anahtarı**: ana paywall'da segment yok; dönem seçimi iki radyo kartıyla yapılıyor ve kademe "Balance'a yükselt" kartıyla değişiyor. T1'in akışı (dönem segmenti + Balance/Fresh kartları) "mantık aynı" kuralı gereği korundu. Segment uygulamanın standart segment görünümüne (`FinSegmented`) alındı; kartlar ana paywall `PlanRow` stiliyle birebir.
3. **Seçili kenar rengi**: "2 pt lime kenar" saf lime ile beyaz zeminde ~1,3:1 kontrast veriyor (HIG 3:1 altında). Ana paywall'daki gibi `accentLine` kullanıldı (açıkta koyu lime `#4A6B00`, koyuda lime); işaret dairesi saf lime.
4. **Onboarding 3 ürün kartı**: "gerçek ürün" için canlı eatkcal kataloğundan (mevcut `loadEatkcalProducts`, salt okuma; L2 de aynı çağrıyı yapıyor) fotoğraflı ve ≥ 250 kcal ilk ürün gösteriliyor (çekimde "Basmati Üzeri Izgara Köfte ve Brokoli Sebze, 495 TL"). Katalog gelmezse yerel ürün fotoğrafı + genel ad gösteriliyor. Uydurma fiyat olmasın diye fiyat satırı gizleniyor: `ProductCard`'a isteğe bağlı `hidePrice` eklendi, varsayılan davranış aynı.
5. **Onboarding fotoğrafları**: mevcut `assets/onboarding-hero.jpg` (eatkcal ürün fotoğrafı) kırpılarak `assets/kayit/ogun.webp` (2. ekran), `urun.webp` (3. ekran yedeği) ve `paylasim.webp` (4. ekran gönderisi) üretildi (41–59 KB). Yeni görsel üretilmedi.
6. **Onboarding geri hareketi**: yatay pager kenar kaydırmasını kendisi yapıyor, PanResponder kaldırıldı. Android geri tuşu (`useEdgeBack` → BackHandler) ve VoiceOver "Z" hareketi önceki sayfaya dönüyor. Kaldığı ekrandan devam etme aynı.
7. **Nokta göstergesi** 5 nokta, 5. ekranda da görünüyor (G42'de 4 nokta, 5. ekranda gizliydi). Etkin nokta ink, diğerleri `line2` (karşılama ekranı dili; lime değil).
8. **Hareket galerisi → liste**: P8'de seçim yokken "Hafif"in seçili açılması (G42 davranışı) korundu.
9. **L1 süresi** 3,2 sn → 1,8 sn (geri dönüşte cevap değiştiyse 1,5 → 1,2 sn). Görevdeki "≤ 2 sn" kuralı. Hesap ve olaylar aynı.
10. **L2/K1 üst çubuğu**: G42'de tam dolu, numarasız halka vardı. Artık ilerleme çubuğu yalnız soru ekranlarında var; L2 ve K1'de çubuk alanı boş. "Soru 1 / 1" gibi yanlış bir VoiceOver etiketi de böylece kalmadı.
11. **Apple düğmesi**: `buttonType = CONTINUE`, `cornerRadius = 27` (54 pt yüksekliğin yarısı, Google/e-posta düğmeleriyle aynı). Yüklenirken native düğme yerine aynı ölçüde siyah/beyaz bir halka gösteriliyor (native düğme halka gösteremiyor). G42'deki `__DEV__`'de Android'de de gösterme kaldırıldı: Android'de hiç çizilmiyor.
12. **Silinmeyen dosyalar** (görev gereği): `assets/onboarding/sahne-1.webp`, `sahne-2.webp`, `sahne-3-tr/en.webp`, `sahne-4-tr/en.webp`, `sahne-5.webp` ve `scripts/build-onboarding-scenes.sh` yerinde. Koddan referansları kaldırıldı, bu yüzden pakete girmiyorlar.
13. **Boş radyo/kutu kenarı**: `finExtras.line2` (`#C3C7CC`) beyazda 1,7:1 kalıyordu; seçilebilirliğin tek işareti olduğu için HIG 3:1'e göre `#8A8F96` (açık) / `#757575` (koyu) kullanıldı. Yeni ham renk; token dosyasına eklenmedi (yalnız kayıt paleti). T1 radyosu ana paywall ile birebir kaldı (`#C3C7CC`).
14. **İlerleme dolgusu lime kaldı** (görev: "lime dolu"). Açık temada lime/iz kontrastı ~1,0:1 (HIG denetimi Yüksek bulgu). Çubuk süs değil ama tek bilgi taşıyıcısı da değil: soru sayısı VoiceOver'da `progressbar` değeriyle okunuyor. → SORULAR 5.

## Apple HIG denetimi
Denetimi bir alt ajan yaptı (apple-design-skill, kod denetimi kipi; 9 dosya + 7 ekran görüntüsü; `pull-hig.mjs` çalıştırılmadı). Genel sonuç "İyi"; Yüksek 3, Orta 5, Düşük 9 bulgu.

**Düzeltildi**
- (Yüksek) Boş radyo/onay kutusu kenarı 1,7:1 → `line2` `#8A8F96` / `#757575` (3,3:1 / 3,7:1).
- (Yüksek) Onboarding başlığı/metni sabit kartta büyük yazıda noktalarla çakışabiliyor ya da kırpılıyordu: `numberOfLines` kaldırıldı, kart 316 → 330 pt, yazı tavanı başlıkta 1,15×, metinde 1,2×.
- (Orta) B yolunda 18+ kutusu düğmelerin altındaydı ve yöntemler sebepsiz devre dışı görünüyordu: kutu yöntemlerin üstüne taşındı.
- (Orta) T1 "e-posta gönderildi" bandı kapat düğmesini örtüyordu: bant `insets.top + 52`'ye indi.
- (Düşük) Apple yükleniyor etiketi "Giriş Yap" diyordu, native düğme "Devam Et": "Apple ile devam et" / "Continue with Apple".
- (Düşük) Seçim satırlarına `accessibilityState.selected` eklendi (iOS "Seçili" okur). Onboarding noktaları `progressbar` + değer. Maskot dekoratif sayıldı (VoiceOver'da gizli). I1/I2'de tüm ekranın düğme olması kaldırıldı; yalnız Devam ilerletiyor.

**Açık bırakıldı (gerekçeli)**
- (Yüksek) Açık temada lime ilerleme dolgusu izle ~1,0:1. Görev açıkça "lime dolu" diyor → KARAR 14, SORULAR 5. Öneri: açık temada `accentLine` dolgu.
- (Orta) L2'de "Planımı kaydet" ilk açılışta devre dışı; onu açan rıza satırı ekranın altında kalıyor. Görev "rıza satırı ve Planımı kaydet mevcut yerinde" diyor → SORULAR 6.
- (Orta) "Giriş yap" yalnız 5. onboarding ekranında var (G42 davranışı; akış aynı kalsın kuralı) → SORULAR 7.
- (Orta) Hata metni `#E5484D` 13–15 pt'de ~3,6–3,9:1 (AA 4,5:1 altında). Bu, uygulama geneli `color.danger` token'ı; yalnız kayıtta değiştirmek token dışı ham renk olurdu → SORULAR 8.
- (Düşük) K1'de Koşullar/Gizlilik hem metin içinde hem 44 pt satırda (VoiceOver dört bağlantı okuyor). Görev "metin içi bağlantılar kalabilir" diyor.
- (Düşük) T1 fiyatında `adjustsFontSizeToFit` ve radyo kenarı `#C3C7CC`: ana paywall ile birebir kalması istendi.
- (Düşük) K1'de native geri kaydırma + özel PanResponder ikisi birden etkin (G42'den kalma). Simülatörde çift geri görülmedi; cihazda denenmeli.
- (Düşük) Yenileme metnine "nasıl iptal edilir" satırı (inceleme için iyi olur, zorunlu değil).

**Sorunsuz bulunanlar**: dokunma alanları (≥ 44 pt; satırlar 68 pt); Apple ile Giriş (native, yalnız iOS, ilk sırada, Google ile aynı boy, yarıçap 27 izinli); seçili hâl yalnız renkle değil, kenar + işaretle de belli (6,2:1 / 12,5:1); ikincil metin kontrastı (4,8–6,6:1); VoiceOver rolleri (progressbar, adjustable, OTP değeri, canlı bölgeler, `onAccessibilityEscape`); Azaltılmış hareket (her şey anlık, yığın `none`); güvenli alanlar; 3.1.2 teklif (fiyat en belirgin öğe, deneme koşulları düğmenin yanında, otomatik yenileme ve 24 saat metni, Geri yükle, 44 pt EULA/Gizlilik); Meta/pazarlama kutuları işaretsiz, ATT yalnız Meta kutusu işaretlenince.

## Ekran görüntüleri (`docs/night/g43/`)
Simülatör: "G40 iPhone" (`D2B68EDD-…`, 1.1.0 dev build, iOS 26). Native derleme yapılmadı. Metro bu worktree'den 8142 portunda çalıştı. Çekim `scripts/dev/g14-shots.sh` (storage kipi) + vitrin `G42-*` sahneleriyle yapıldı (vitrin adları G42'den kaldı; çizilen kod G43). Dosyalar `G43-*` adıyla kaydedildi.
- Onboarding: `G43-Onb1…5` (TR), `EN-G43-Onb1…5` (EN; 4. ekran dahil)
- A yolu: `G43-P1`, `P3`, `P4` (+`EN-G43-P4`), `P7`, `P8`, `P11`, `P13`, `I1`, `L1`, `L2`, `K1`, `K1b`, `E2`, `T1` (yıllık), `T1m` (aylık), `R1`
- B yolu kısa profil: `G43-BShort`, `G43-BShort8` ("Takibe başla")
- Koyu: `G43-P1-Dark`, `P4-Dark`, `L1-Dark`, `L2-Dark`, `K1-Dark`, `E2-Dark`, `T1-Dark`, `BShort8-Dark`
- Önce/sonra: `karsilastirma/<sahne>-yanyana.jpg`. **Sol = önce (G42), sağ = sonra (G43).** G42'deki her görüntü için bir pano var (37 pano).

## CANLIYA UYGULANACAK
Yok (migration yok).

## DEPLOY GEREKİR
Yok. OTA: bu dal yalnız JS + asset içeriyor. G42 notu geçerli: `release/1.1.0`'a merge İlter onayıyla.

## SORULAR
1. **T1 zemini** (KARAR 1): ana paywall'daki statik lime ışık T1'de kalsın mı, yoksa T1 de düz zemin mi olsun?
2. **T1 dönem seçimi** (KARAR 2): T1, ana paywall gibi "Yıllık / Aylık radyo kartları + Balance'a yükselt kartı" düzenine geçsin mi? Bu bir akış değişikliği olur; ayrı tur gerekir.
3. **Onboarding 3** (KARAR 4): canlı katalogdan otomatik seçim mi kalsın, yoksa belirli bir ürün (ürün kimliği) mi sabitlensin?
4. **Onboarding 4 örnek gönderi**: yazar "Elif / @elifmutfakta" kurgusal bir örnek. Resmî "kcal" hesabı ya da gerçek bir topluluk gönderisi mi kullanılsın?
5. **İlerleme dolgusu** (KARAR 14): açık temada lime yerine koyu lime (`accentLine`) dolguya geçilsin mi? (HIG kontrastı için önerilir.)
6. **L2 rıza satırı**: "Planımı kaydet"in hemen üstüne sabitlensin mi (alt alanda)? Şu an kaydırmalı içeriğin sonunda.
7. **Onboarding "Giriş yap"**: dönen kullanıcı için her sayfada gösterilsin mi?
8. **Hata rengi**: `color.danger` açık temada metin için koyulaştırılsın mı (ör. `#C62F35`, 4,9:1)? Uygulama geneli token değişikliği.
9. G42 SORULAR 2–8 (plan e-postası deploy, rıza yerleşimi, 18+ kutusu, +250 kcal, R1 şifreleme, paylaşılan geçiş, kayıtlı e-posta hâli) hâlâ açık. G42 SORU 1 (Padel) ve SORU 9 (Apple düğmesi / 44 pt yasal satır) bu turda kapandı.
10. "G40 iPhone" simülatörü açık bırakıldı. Kapatmak için: `xcrun simctl shutdown D2B68EDD-D6A9-4059-98B8-232F5CF8A804`.
