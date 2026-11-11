# Google Play Console — mağaza metinleri TR / EN · 1.1.0 (M-S1 md.1 · M-S2 md.1: Koç açık)

Paket: `com.kcalmobile.app` · Sürüm adı **1.1.0** (versionCode EAS remote).
Ana mesaj: TR **"Hesabı biz yapıyoruz, sen de görüyorsun."** · EN **"The calorie tracker with a real kitchen behind it."**

> Kaynak: İlter kararları 11 Kas (`.claude/night/M-S1.md`, `.claude/night/M-S2.md`), rakip raporu §5 ASO / §6 paywall (`~/dev/kcal-research/rakip/RAKIP_ANALIZI_v1.md`).
> Bu dosya `docs/store/_uret_metinler.py` ile üretilir (karakter sınırı, anahtar kelime tekrarı, yasak dil, zorunlu bağlantılar denetlenir).
> Elle düzeltme yapma; betikte değiştir ve yeniden üret: `python3 -I docs/store/_uret_metinler.py docs/store`.
> **Yasak dil:** somut kilo vaadi, önce/sonra, tıbbi iddia, "sınırsız AI", "yakında", egzersiz rehberi. ,99'suz TL fiyatı ve eski `eatkcal.com/...` yasal yolları betikte hata verir.
> **M-S2 (İlter 11 Kas 16:00): kcalAI Koç 1.1.0'da AÇIK** (bayrak `koc` + `abonelik`, `coach-chat` yayında) → Balance "günde 50 AI tarama + kcalAI Koç"; açıklamada Koç paragrafı, promosyon ve Yenilikler'de Koç.
> Fiyatlar: Fresh 199,99 TL/ay · 999,99 TL/yıl ($5.99 / $29.99); Balance 499,99 TL/ay · 2999,99 TL/yıl ($12.99 / $59.99). Yasal bağlantılar `https://legal.eatkcal.com/...`.

## Ortak alanlar
| Alan | Değer | Not |
|---|---|---|
| Uygulama / oyun | Uygulama | |
| Kategori | **Sağlık ve Fitness** | Play tek kategori alır |
| Etiketler | Kalori sayacı, Diyet ve beslenme, Yemek tarifleri | en fazla 5 |
| Ücretsiz / ücretli | Ücretsiz; **uygulama içi ürün VAR** (abonelik) | 1.0.x'teki "dijital satın alma YOK" satırı kaldırıldı |
| İletişim e-postası | `info@eatkcal.com` | L-S1 KURUMSAL_KIMLIK: bugün tek yayındaki adres; ayrı destek adresi açılırsa değiştir |
| Web sitesi | https://eatkcal.com | |
| Gizlilik politikası | https://legal.eatkcal.com/gizlilik-politikasi | Play tek URL alır → TR sayfası; EN sürüm sayfada bağlantılı olmalı (https://legal.eatkcal.com/en/legal/privacy) |
| Hesap silme URL’si | https://legal.eatkcal.com/account-deletion | EN: https://legal.eatkcal.com/account-deletion |
| Reklam içeriyor | **Hayır** | Meta yalnız ölçüm (rızaya bağlı) |
| Hedef kitle | 18 ve üzeri | |

### Abonelikler (Play Console › Para kazanma › Abonelikler; RevenueCat kimliği `kcalai_fresh:monthly` biçimi)
| Abonelik kimliği | Temel plan | Fiyat TR | Fiyat ABD | Teklif |
|---|---|---|---|---|
| `kcalai_fresh` | `monthly` (otomatik yenilenen, 1 ay) | 199,99 TL | $5.99 | — |
| `kcalai_fresh` | `yearly` (otomatik yenilenen, 1 yıl) | 999,99 TL | $29.99 | `default`: 7 gün ücretsiz deneme, yeni aboneler |
| `kcalai_balance` | `monthly` | 499,99 TL | $12.99 | — |
| `kcalai_balance` | `yearly` | 2999,99 TL | $59.99 | `default`: 7 gün ücretsiz deneme |

Abonelik avantajları (Play "Avantajlar", her biri ≤ 40 karakter): Fresh `Günde 10 AI tarama` · `Barkod ve elle giriş sınırsız`; Balance `Günde 50 AI tarama` · `kcalAI Koç: günde 30 mesaj` · `Barkod ve elle giriş sınırsız`. EN: Fresh `10 AI scans a day` · `Unlimited barcode and manual entry`; Balance `50 AI scans a day` · `kcalAI Coach: 30 messages a day` · `Unlimited barcode and manual entry`.

## Türkçe (tr-TR) — varsayılan dil

| Alan | Sınır | Kullanılan |
|---|---|---|
| Uygulama adı | 30 | 25 |
| Kısa açıklama | 80 | 77 |
| Tam açıklama | 4000 | 3741 |
| Sürüm notları (Bu sürümdeki yenilikler) | 500 | 499 |

**Uygulama adı:** `KCAL: AI Kalori Hesaplama`

**Kısa açıklama:**
```text
Fotoğraf çek, yaz ya da söyle; kalori ve makrolar gelsin. İzmir'de fit yemek.
```

**Tam açıklama:**
```text
KCAL ile tabağının fotoğrafını çek, ne yediğini yaz ya da söyle; kalori ve makrolar saniyeler içinde günlüğünde.

Hesabı biz yapıyoruz, sen de görüyorsun. Her yiyeceğin gramını, kalorisini, proteinini, karbonhidratını ve yağını tek tek gösteriyoruz; yanlış bulduğunu sen düzeltiyorsun.

KAYDETMENİN DÖRT YOLU
• Fotoğrafla: tabağını çek ya da galeriden seç; yapay zekâ her yiyeceği tahmin eder.
• Sesle: ne yediğini söyle; yazıya dökülür ve öğelere ayrılır. Ses kaydı tutulmaz.
• Barkodla: paketli ürünün barkodunu okut, besin değerleri gelsin.
• Elle: fotoğraf istemediğin öğünleri saniyeler içinde gir.
Gramı ve porsiyonu değiştir, eksik yiyeceği ekle, yanlışı çıkar. Sen onaylamadan hiçbir şey günlüğe girmez.

GÜNÜN TEK BAKIŞTA
• Kalori, makro ve su halkaları ana sayfada.
• Etkinliklerini ekle, harcadığını ve kalanı gör.
• İlerleme: 7, 14 ve 30 günlük kalori ve makro özetin.
• Seri: her gün en az bir öğün kaydet, serini büyüt.
• Bağlantı yokken de kaydet; internet gelince eşitlenir.

KEŞFET
• Topluluğun tariflerini ve öğünlerini keşfet, beğen, yorum yap, kaydet; beğendiğin tabağı tek dokunuşla gününe ekle.
• Sevdiğin hesapları takip et; profilini herkese açık ya da gizli tut.
• Her gönderide şikâyet ve engelleme seçeneği var.

KCALAI KOÇ (BALANCE)
• Beslenme ve günlük takip danışmanın. "Akşam ne yesem?" diye sor; kalan kalorine ve makrolarına göre öğün önersin, önerdiğini tek dokunuşla gününe ekle.
• Keşfet'ten tarif, İzmir'deysen eatkcal'dan hazır öğün. Haftanı kalori ve protein grafikleriyle özetler.
• Balance'ta günde 30 mesaj (her gece 00.00'da yenilenir); Ücretsiz ve Fresh'te 3 deneme mesajı.
• Koç tıbbi tavsiye ya da teşhis vermez; sağlıkla ilgili sorularda bir uzmana danışmanı önerir.

EATKCAL: İZMİR'DE FİT YEMEK
KCAL'in mutfağı eatkcal'da hazırlanan, kalorisi ve makrosu hesaplı öğünleri uygulamadan sipariş et. Teslim edilen öğün günlüğüne kendiliğinden işlenir. Sipariş şu an yalnız İzmir'deki teslimat bölgelerinde geçerli.

ÜCRETSİZ VE KCALAI PLANLARI
• Ücretsiz: günde 2 AI tarama (fotoğraf ya da ses), günde 5 barkod, elle giriş sınırsız, 3 Koç deneme mesajı.
• kcalAI Fresh: günde 10 AI tarama, 3 Koç deneme mesajı; barkod ve elle giriş sınırsız. Aylık 199,99 TL ya da yıllık 999,99 TL.
• kcalAI Balance: günde 50 AI tarama + kcalAI Koç (günde 30 mesaj); barkod ve elle giriş sınırsız. Aylık 499,99 TL ya da yıllık 2999,99 TL.
• Yıllık planlarda 7 gün ücretsiz deneme; ücret deneme bitince alınır.
Fiyatlar Türkiye içindir; başka ülkelerde Google Play kendi yerel fiyatını gösterir. AI tarama hakları her gece 00.00'da yenilenir.

GİZLİLİK
• Uygulamada reklam yok.
• Tabak fotoğrafın ve notun yalnız tahmin için yapay zekâ sağlayıcımıza gönderilir; ilk taramadan önce iznini isteriz.
• Koç mesajların ve günlük takip özetin yanıt için yapay zekâ sağlayıcımıza (ABD) gider; yalnız ayrıca izin verdiğinde.
• Konumun yalnız eatkcal teslimat adresi için, sen istediğinde kullanılır.
• Kullanım ve reklam ölçümünü Profil › Gizlilik'ten istediğin zaman kapat; hesabını uygulama içinden sil.

ÖNEMLİ
KCAL'deki kalori ve besin değerleri ile Koç'un önerileri tahmin ve genel bilgidir; tıbbi tavsiye, teşhis ya da tedavi yerine geçmez. Özel bir sağlık durumun, hamileliğin ya da beslenme bozukluğun varsa bir sağlık uzmanına danış. Uygulama 18 yaş ve üzeri içindir.

Abonelik bilgisi: Ödeme, satın almayı onayladığında Google Play hesabından alınır. Abonelik, dönem bitmeden iptal edilmezse aynı süre ve fiyatla otomatik yenilenir. Aboneliğini Google Play › Ödemeler ve abonelikler bölümünden yönetebilir ve iptal edebilirsin. Ücretsiz deneme bitmeden iptal edersen ücret alınmaz.

Kullanım Koşulları: https://legal.eatkcal.com/kullanim-kosullari
Gizlilik Politikası: https://legal.eatkcal.com/gizlilik-politikasi
```

**Sürüm notları (1.1.0):**
```text
1.1.0: Yeni ad ve tasarım. kcalAI Koç: kalan kalorine göre öğün önerisi ve haftalık özet (Balance'ta günde 30 mesaj, Ücretsiz ve Fresh'te 3 deneme). Sesle ekle (ses kaydı tutulmaz) ve barkod okut. Fotoğrafla tarama yenilendi: gramı ve porsiyonu düzelt. kcalAI Fresh ve Balance planları; yıllıkta 7 gün ücretsiz deneme. Ana sayfada kalori, makro, su halkaları, etkinlik, ilerleme ve seri. Keşfet'te tarif ve öğünler. eatkcal (İzmir) yeni sipariş akışı. İzinler yalnız gerektiğinde. Hata düzeltmeleri.
```

## English (en-US)

| Alan | Sınır | Kullanılan |
|---|---|---|
| Uygulama adı | 30 | 24 |
| Kısa açıklama | 80 | 78 |
| Tam açıklama | 4000 | 3755 |
| Sürüm notları (Bu sürümdeki yenilikler) | 500 | 497 |

**Uygulama adı:** `KCAL: AI Calorie Counter`

**Kısa açıklama:**
```text
Snap, type or say what you ate; see calories & macros. Healthy meals in İzmir.
```

**Tam açıklama:**
```text
Snap a photo of your plate, type or say what you ate, and KCAL puts the calories and macros in your log in seconds.

The calorie tracker with a real kitchen behind it. We show the grams, calories, protein, carbs and fat for every food on your plate, and you can fix anything that looks off.

FOUR WAYS TO LOG
• Photo: snap your plate or pick one from your gallery; AI estimates each food.
• Voice: say what you ate; it's turned into text and split into items. No audio is recorded.
• Barcode: scan a packaged product to get its nutrition facts.
• Manual: log meals without a photo in seconds.
Adjust grams and portions, add a missing food, remove a wrong one. Nothing is logged until you confirm.

YOUR DAY AT A GLANCE
• Calorie, macro and water rings on your home screen.
• Add your activities and see what you burned and what's left.
• Progress: your calorie and macro summary for 7, 14 and 30 days.
• Streaks: log at least one meal a day and keep your streak going.

EXPLORE
• Discover recipes and meals from the community; like, comment, save, and add a plate to your day in one tap.
• Follow accounts you love; keep your profile public or private.
• Every post can be reported, and any account can be blocked.

KCALAI COACH (BALANCE)
• Your nutrition and daily tracking coach. Ask "What should I have for dinner?" and get meal ideas for the calories and macros you have left; add one to your day in one tap.
• Recipes from Explore and, in İzmir, eatkcal meals. A weekly summary with calorie and protein charts.
• 30 messages a day on Balance (reset at midnight); 3 trial messages on Free and Fresh.
• The Coach doesn't give medical advice; for health questions it suggests seeing a professional.

EATKCAL: HEALTHY MEALS IN İZMİR
Order meals made in eatkcal, KCAL's own kitchen, with calories and macros already worked out. Delivered meals are added to your log automatically. Ordering is available only in İzmir, Türkiye.

FREE AND KCALAI PLANS
• Free: 2 AI scans a day (photo or voice), 5 barcode scans a day, unlimited manual entries, 3 Coach trial messages.
• kcalAI Fresh: 10 AI scans a day, 3 Coach trial messages; unlimited barcode and manual entries. $5.99 a month or $29.99 a year.
• kcalAI Balance: 50 AI scans a day + kcalAI Coach (30 messages a day); unlimited barcode and manual entries. $12.99 a month or $59.99 a year.
• 7-day free trial on yearly plans; you're charged when the trial ends.
Prices in US dollars; Google Play shows your local price. AI scans reset every night at midnight.

PRIVACY
• No ads in the app.
• Your plate photo and note are sent to our AI provider only to make the estimate; we ask for your permission before your first scan.
• Coach messages and your daily tracking summary go to our AI provider (US) for the reply, only after you give separate permission.
• Location is used only for an eatkcal delivery address, when you ask.
• Turn usage and ad measurement off anytime in Profile › Privacy, and delete your account from inside the app.

IMPORTANT
Calorie and nutrition values and Coach suggestions in KCAL are estimates and general information; they are not medical advice, diagnosis or treatment. If you have a medical condition, are pregnant or have an eating disorder, talk to a healthcare professional. KCAL is for users 18 and over.

Subscription terms: Payment is charged to your Google Play account when you confirm the purchase. Your subscription renews automatically for the same period and price unless cancelled before the end of the current period. You can manage and cancel it in Google Play › Payments & subscriptions. Cancel before a free trial ends and you won't be charged.

Terms of Use: https://legal.eatkcal.com/en/legal/terms
Privacy Policy: https://legal.eatkcal.com/en/legal/privacy
```

**Sürüm notları (1.1.0):**
```text
1.1.0: New name and design. kcalAI Coach: meal ideas for the calories you have left and a weekly summary (30 messages a day on Balance, 3 trials on Free/Fresh). Add by voice (no audio recorded) and scan barcodes. Refreshed photo scan: fix grams and portions. kcalAI Fresh and Balance plans; 7-day free trial on yearly. Calorie, macro and water rings, activity, progress and streaks on Home. Recipes and meals in Explore. Refreshed eatkcal ordering (İzmir). Permissions only when needed. Bug fixes.
```

## Grafik öğeler
| Öğe | Ölçü | Dosya |
|---|---|---|
| Uygulama simgesi | 512×512 PNG | `assets/icon.png` kaynağından dışa aktar |
| Öne çıkan görsel | 1024×500 | `docs/store/shots/play/tr/feature.png`, `…/en/feature.png` |
| Telefon ekran görüntüleri | 7 adet, 1080×1920 (03 = kcalAI Koç) | `docs/store/shots/play/{tr,en}/01–07.png` (EKRAN_GORUNTUSU_PLANI.md) |
