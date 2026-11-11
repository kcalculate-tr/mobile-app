# App Store Connect — mağaza metinleri TR / EN · 1.1.0 (M-S1 md.1 · M-S2 md.1: Koç açık)

Uygulama: `com.kcalmobile.app` (ascAppId 6763964912) · Sürüm **1.1.0** · Cihazdaki ad `Kcalculate` (`app.config.js` `name`) kalır.
Ana mesaj: TR **"Hesabı biz yapıyoruz, sen de görüyorsun."** · EN **"The calorie tracker with a real kitchen behind it."**

> Kaynak: İlter kararları 11 Kas (`.claude/night/M-S1.md`, `.claude/night/M-S2.md`), rakip raporu §5 ASO / §6 paywall (`~/dev/kcal-research/rakip/RAKIP_ANALIZI_v1.md`).
> Bu dosya `docs/store/_uret_metinler.py` ile üretilir (karakter sınırı, anahtar kelime tekrarı, yasak dil, zorunlu bağlantılar denetlenir).
> Elle düzeltme yapma; betikte değiştir ve yeniden üret: `python3 -I docs/store/_uret_metinler.py docs/store`.
> **Yasak dil:** somut kilo vaadi, önce/sonra, tıbbi iddia, "sınırsız AI", "yakında", egzersiz rehberi. ,99'suz TL fiyatı ve eski `eatkcal.com/...` yasal yolları betikte hata verir.
> **M-S2 (İlter 11 Kas 16:00): kcalAI Koç 1.1.0'da AÇIK** (bayrak `koc` + `abonelik`, `coach-chat` yayında) → Balance "günde 50 AI tarama + kcalAI Koç"; açıklamada Koç paragrafı, promosyon ve Yenilikler'de Koç.
> Fiyatlar: Fresh 199,99 TL/ay · 999,99 TL/yıl ($5.99 / $29.99); Balance 499,99 TL/ay · 2999,99 TL/yıl ($12.99 / $59.99). Yasal bağlantılar `https://legal.eatkcal.com/...`.

## Ortak (dil bağımsız) alanlar
| Alan | Değer | Not |
|---|---|---|
| Birincil kategori | **Sağlık ve Fitness** (Health & Fitness) | rapor §1.10: bugün Yiyecek ve İçecek → düzelt |
| İkincil kategori | Yemek ve İçecek (Food & Drink) | eatkcal + tarifler |
| Fiyat | Ücretsiz (indirmesi) | |
| Uygulama içi satın alma | **VAR** — 4 otomatik yenilenen abonelik (aşağıda). eatkcal siparişi fiziksel ürün → IAP değil (3.1.3(e)) | 1.0.x'teki "uygulama içi satın alma YOK" satırı kaldırıldı |
| Abonelik grubu | `kcalAI` — sıra (üstten): Balance yıllık, Balance aylık, Fresh yıllık, Fresh aylık | aynı grupta yükseltme/düşürme |
| Lisans sözleşmesi (EULA) | Apple Standart EULA (https://www.apple.com/legal/internet-services/itunes/dev/stdeula/) | açıklamada bağlantı var (3.1.2) |
| Yaş derecelendirmesi | Kullanıcı içeriği VAR (moderasyon + şikâyet + engelleme), sağlık/tıbbi bilgi "seyrek/hafif", reklam yok → uygulama ayrıca **18+** kapısı uygular | |
| Telif (Copyright) | `2026 SEKULART LTD` | L-S1 KURUMSAL_KIMLIK (9 Kas kararı: her yerde "SEKULART LTD") |
| Hesap silme | Uygulama içinde: Profil › Güvenlik › Hesabımı sil | 5.1.1(v) |
| Apple ile Giriş | Var (Google ve e-posta koduyla birlikte) | 4.8 |

### Abonelik ürünleri (ASC › Abonelikler; RevenueCat yetkileri `fresh` / `balance`)
| Ürün kimliği | Görünen ad TR / EN | Süre | TR fiyatı | ABD fiyatı | Tanıtım teklifi | Hak |
|---|---|---|---|---|---|---|
| `kcalai_fresh_monthly` | kcalAI Fresh aylık / kcalAI Fresh Monthly | 1 ay | 199,99 TL | $5.99 | — | günde 10 AI tarama, barkod + elle sınırsız, 3 Koç deneme mesajı |
| `kcalai_fresh_yearly` | kcalAI Fresh yıllık / kcalAI Fresh Yearly | 1 yıl | 999,99 TL | $29.99 | 7 gün ücretsiz | aynı |
| `kcalai_balance_monthly` | kcalAI Balance aylık / kcalAI Balance Monthly | 1 ay | 499,99 TL | $12.99 | — | günde 50 AI tarama + kcalAI Koç (günde 30 mesaj), barkod + elle sınırsız |
| `kcalai_balance_yearly` | kcalAI Balance yıllık / kcalAI Balance Yearly | 1 yıl | 2999,99 TL | $59.99 | 7 gün ücretsiz | aynı |

Abonelik açıklaması (ASC'de her ürünün "Description" alanı, ≤ 55 karakter):
| Ürün | TR | EN |
|---|---|---|
| Fresh | `Günde 10 AI tarama, barkod ve elle giriş sınırsız` | `10 AI scans a day, unlimited barcode and manual` |
| Balance | `Günde 50 AI tarama ve kcalAI Koç` | `50 AI scans a day plus kcalAI Coach` |

## Türkçe (tr-TR) — birincil

| Alan | Sınır | Kullanılan |
|---|---|---|
| Ad (App Name) | 30 | 25 |
| Alt başlık (Subtitle) | 30 | 25 |
| Promosyon metni (Promotional Text) | 170 | 152 |
| Anahtar kelimeler (Keywords) | 100 | 90 |
| Açıklama (Description) | 4000 | 3945 |
| Bu sürümde yenilikler (What’s New) | 4000 | 872 |

**Ad:** `KCAL: AI Kalori Hesaplama`  
**Alt başlık:** `Kalori Sayacı & Fit Yemek`

**Promosyon metni** (sürüm göndermeden değiştirilebilir):
```text
Yeni: kcalAI Koç. Kalan kalorine göre ne yiyeceğini sor, öğün önerisi al. Tabağını çek, yaz ya da söyle; kalori ve makrolar saniyeler içinde günlüğünde.
```

**Anahtar kelimeler** (90 karakter / 95 bayt; virgül, boşluksuz; ad/alt başlıktaki kelimeler tekrarlanmaz):
```text
takip,diyet,makro,protein,kilo,yapay,zeka,fotoğraf,barkod,sesli,öğün,besin,tarif,koç,izmir
```

**Açıklama:**
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
Fiyatlar Türkiye içindir; başka ülkelerde mağaza kendi yerel fiyatını gösterir. AI tarama hakları her gece 00.00'da yenilenir.

GİZLİLİK
• Uygulamada reklam yok; seni başka uygulama ve sitelerde izlemiyoruz.
• Tabak fotoğrafın ve notun yalnız tahmin için yapay zekâ sağlayıcımıza gönderilir; ilk taramadan önce iznini isteriz.
• Koç mesajların ve günlük takip özetin yanıt için yapay zekâ sağlayıcımıza (ABD) gider; yalnız ayrıca izin verdiğinde.
• Konumun yalnız eatkcal teslimat adresi için, sen istediğinde kullanılır.
• Ölçüm tercihlerini Profil › Gizlilik'ten yönet; hesabını uygulama içinden sil.

ÖNEMLİ
KCAL'deki kalori ve besin değerleri ile Koç'un önerileri tahmin ve genel bilgidir; tıbbi tavsiye, teşhis ya da tedavi yerine geçmez. Özel bir sağlık durumun, hamileliğin ya da beslenme bozukluğun varsa bir sağlık uzmanına danış. Uygulama 18 yaş ve üzeri içindir.

Abonelik bilgisi: Ödeme, satın almayı onayladığında Apple Kimliği hesabından alınır. Abonelik, dönem bitmeden en az 24 saat önce iptal edilmezse aynı süre ve fiyatla otomatik yenilenir; yenileme ücreti dönemin son 24 saati içinde alınır. Aboneliğini App Store hesap ayarlarından yönetebilir ve iptal edebilirsin. Ücretsiz denemenin kullanılmayan kısmı, abonelik satın alındığında geçersiz olur.

Kullanım Koşulları: https://legal.eatkcal.com/kullanim-kosullari
Apple Standart Lisans Sözleşmesi (EULA): https://www.apple.com/legal/internet-services/itunes/dev/stdeula/
Gizlilik Politikası: https://legal.eatkcal.com/gizlilik-politikasi
```

**Bu sürümde yenilikler (1.1.0):**
```text
KCAL 1.1.0 ile yeni:
• Yeni ad ve yeni tasarım: KCAL: AI Kalori Hesaplama.
• Sesle ekle: ne yediğini söyle, öğelere ayrılsın. Ses kaydı tutulmaz.
• Barkod okut: paketli ürünleri saniyeler içinde ekle.
• Fotoğrafla tarama yenilendi: her yiyeceğin gramını ve porsiyonunu düzelt.
• kcalAI Koç: beslenme ve günlük takip danışmanın. "Akşam ne yesem?" diye sor, kalan kalorine göre öğün önersin; haftanı grafiklerle özetlesin. Balance'ta günde 30 mesaj, Ücretsiz ve Fresh'te 3 deneme mesajı.
• kcalAI Fresh ve Balance: günde daha çok AI tarama; yıllık planlarda 7 gün ücretsiz deneme.
• Ana sayfada kalori, makro ve su halkaları; etkinlik, ilerleme ve seri.
• Keşfet: tarifler, öğünler, yorumlar; beğendiğin tabağı gününe ekle.
• eatkcal (İzmir): yenilenen sipariş akışı.
• Daha az izin: her izni yalnız o özelliği kullandığında soruyoruz.
• Hata düzeltmeleri ve iyileştirmeler.
```

| URL | Değer |
|---|---|
| Destek URL’si (zorunlu) | https://legal.eatkcal.com/destek |
| Pazarlama URL’si | https://eatkcal.com |
| Gizlilik Politikası URL’si (App Information, yerelleştirilebilir) | https://legal.eatkcal.com/gizlilik-politikasi |

## English (en-US; en-GB aynı metin)

| Alan | Sınır | Kullanılan |
|---|---|---|
| Ad (App Name) | 30 | 24 |
| Alt başlık (Subtitle) | 30 | 27 |
| Promosyon metni (Promotional Text) | 170 | 153 |
| Anahtar kelimeler (Keywords) | 100 | 100 |
| Açıklama (Description) | 4000 | 3993 |
| Bu sürümde yenilikler (What’s New) | 4000 | 901 |

**Ad:** `KCAL: AI Calorie Counter`  
**Alt başlık:** `Photo Food Tracker & Macros`

**Promosyon metni** (sürüm göndermeden değiştirilebilir):
```text
New: kcalAI Coach. Ask what to eat for the calories you have left and get meal ideas. Snap, type or say what you ate; see calories and macros in seconds.
```

**Anahtar kelimeler** (100 karakter / 100 bayt; virgül, boşluksuz; ad/alt başlıktaki kelimeler tekrarlanmaz):
```text
diet,protein,weight,meal,scanner,barcode,voice,log,nutrition,recipe,coach,healthy,carb,water,fitness
```

**Açıklama:**
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
Prices in US dollars; the App Store shows your local price. AI scans reset every night at midnight.

PRIVACY
• No ads in the app, and we don't track you across other apps or websites.
• Your plate photo and note are sent to our AI provider only to make the estimate; we ask for your permission before your first scan.
• Coach messages and your daily tracking summary go to our AI provider (US) for the reply, only after you give separate permission.
• Location is used only for an eatkcal delivery address, when you ask.
• Manage measurement choices in Profile › Privacy, and delete your account from inside the app.

IMPORTANT
Calorie and nutrition values and Coach suggestions in KCAL are estimates and general information; they are not medical advice, diagnosis or treatment. If you have a medical condition, are pregnant or have an eating disorder, talk to a healthcare professional. KCAL is for users 18 and over.

Subscription terms: Payment is charged to your Apple ID account when you confirm the purchase. Your subscription renews automatically for the same period and price unless cancelled at least 24 hours before the end of the current period; renewal is charged within the last 24 hours of the period. You can manage and cancel your subscription in your App Store account settings. Any unused part of a free trial ends when you buy a subscription.

Terms of Use: https://legal.eatkcal.com/en/legal/terms
Apple Standard License Agreement (EULA): https://www.apple.com/legal/internet-services/itunes/dev/stdeula/
Privacy Policy: https://legal.eatkcal.com/en/legal/privacy
```

**Bu sürümde yenilikler (1.1.0):**
```text
New in KCAL 1.1.0:
• New name and new design: KCAL: AI Calorie Counter.
• Add by voice: say what you ate and it's split into items. No audio is recorded.
• Barcode scanning: add packaged foods in seconds.
• Refreshed photo scan: fix the grams and portion of every food.
• kcalAI Coach: your nutrition and daily tracking coach. Ask "What should I have for dinner?" and get meal ideas that fit the calories you have left, plus a weekly summary with charts. 30 messages a day on Balance, 3 trial messages on Free and Fresh.
• kcalAI Fresh and Balance: more AI scans a day; 7-day free trial on yearly plans.
• Calorie, macro and water rings on Home, plus activity, progress and streaks.
• Explore: recipes, meals and comments; add a plate you like to your day.
• eatkcal (İzmir): refreshed ordering.
• Fewer prompts: we ask for each permission only when you use that feature.
• Bug fixes and improvements.
```

| URL | Değer |
|---|---|
| Destek URL’si (zorunlu) | https://legal.eatkcal.com/en/support |
| Pazarlama URL’si | https://eatkcal.com |
| Gizlilik Politikası URL’si (App Information, yerelleştirilebilir) | https://legal.eatkcal.com/en/legal/privacy |

## İnceleme notu
`docs/store/INCELEME_NOTU.md`.

## Alternatifler (A/B — rapor §5)
| Alan | TR | EN |
|---|---|---|
| Alt başlık B | `Fotoğrafla Kalori, Makro Takip` (30) | `Calorie Tracker & Real Meals` (28) |
