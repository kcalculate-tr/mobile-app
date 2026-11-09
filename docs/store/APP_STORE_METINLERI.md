# App Store Connect — mağaza metinleri TR / EN (G20-S2 md.2)

Uygulama: Kcalculate AI (`com.kcalmobile.app`, ascAppId 6763964912) · Sürüm **1.1.0**.
Konumlandırma: **Takip et · Üret · Paylaş** (uygulamadaki karşılama başlığı ile aynı); eatkcal ikincil, yalnız İzmir.
Karakter sayıları bu dosyayı üreten betikle denetlendi (`docs/night/G20-S2-LOG.md`). "₺" yok; fiyat yazılmadı.
Cihazdaki ad `Kcalculate` kalır (`app.config.js` `name`); mağaza adı daha uzun olabilir (Apple 2.3.7 uyumlu, anahtar kelime doldurma yok).

## Ortak (dil bağımsız) alanlar
| Alan | Öneri | Not |
|---|---|---|
| Birincil kategori | Sağlık ve Fitness (Health & Fitness) | AI tarama + takip çekirdek |
| İkincil kategori | Yemek ve İçecek (Food & Drink) | eatkcal + tarifler |
| Yaş derecelendirmesi | Anket: kullanıcı içeriği VAR (moderasyon + şikâyet + engelleme var), sağlık/tıbbi bilgi "seyrek/hafif", reklam yok, sınırsız web erişimi yok → çıkan derece; uygulama ayrıca **18+** kapısı uygular (Kullanım Koşulları) | Apple yeni yaş sistemi (13+/16+/18+): kullanıcı içeriği nedeniyle en az 13+ beklenir; 18+ seçmek kapıyla tutarlı |
| Telif (Copyright) | `2026 SEKÜLART Sağlıklı Gıda Ürünleri San. ve Tic. Ltd. Şti.` | `[TAM UNVAN]` L-S1 KURUMSAL_KIMLIK ile teyit |
| Satıcı / AB tüccar bilgisi (DSA) | Tam unvan, adres, telefon, e-posta | L-S1 ENTEGRASYON S3; `[ADRES]` yer tutucu |
| Fiyat | Ücretsiz | Uygulama içi satın alma YOK (eatkcal fiziksel ürün → Apple IAP gerekmez, 3.1.3(e)) |
| Hesap silme | Uygulama içinde: Profil › Güvenlik › Hesabımı sil | 5.1.1(v) |
| Apple ile Giriş | Var (Google ile girişle birlikte) | 4.8 |

## Türkçe (tr-TR) — birincil

| Alan | Sınır | Kullanılan |
|---|---|---|
| Ad (App Name) | 30 | 28 |
| Alt başlık (Subtitle) | 30 | 26 |
| Promosyon metni (Promotional Text) | 170 | 150 |
| Anahtar kelimeler (Keywords) | 100 | 88 |
| Açıklama (Description) | 4000 | 2348 |
| Bu sürümde yenilikler (What’s New) | 4000 | 686 |

**Ad:** `Kcalculate AI: Kalori Takibi`  
**Alt başlık:** `Tabağını çek, kalorini gör`

**Promosyon metni** (sürüm gerektirmeden değiştirilebilir):
```text
Yeni: tabağını çek, yapay zekâ kalori ve makroları tahmin etsin. Günün tek bakışta, tariflerin Keşfet'te. İzmir'de sağlıklı öğün siparişi eatkcal ile.
```

**Anahtar kelimeler** (virgül, boşluksuz; ad/alt başlıktaki kelimeler tekrarlanmaz; güvenli sınır: ≤ 100 karakter VE ≤ 100 bayt UTF-8):
```text
diyet,makro,protein,öğün,besin,yemek,tarif,kilo,sağlıklı,beslenme,günlük,fotoğraf,sayacı
```

**Açıklama:**
```text
Tabağının fotoğrafını çek; Kcalculate AI kalorisini ve makrolarını tahmin etsin, günlüğüne kendiliğinden işlesin. Sonra ister tarifini üret, ister topluluğunla paylaş.

Takip et. Üret. Paylaş.

TAKİP ET
• Fotoğrafla tara: tabağını çek ya da galeriden seç. Yapay zekâ tabaktaki yiyecekleri ayırır, her biri için kalori, protein, karbonhidrat ve yağ tahmini verir.
• Sen düzelt: gramı ve porsiyonu değiştir, eksik yiyeceği ekle, yanlışı çıkar, "yarım porsiyon bulgur" gibi bir not yaz. Kayıt senin onayınla günlüğe girer.
• Elle ya da hızlı ekle: fotoğraf istemediğin öğünleri saniyeler içinde gir.
• Günün tek bakışta: kalori, makro, su ve etkinlik halkaları ana sayfada.
• Su ve etkinlik: bardak bardak su, yürüyüş, koşu ve diğer etkinlikleri kaydet.
• Seri ve rozetler: her gün en az bir öğün kaydet, serini büyüt.
• Hatırlatmalar: istersen öğün ve seri hatırlatmaları al; istediğin zaman kapat.
• Çevrimdışı da çalışır: bağlantı yokken kaydet, internet gelince eşitlenir.

ÜRET
• Öğününü paylaşıma dönüştür: kalori ve makrolarıyla öğün kartını ekle, tarifini anlat.
• Tabak Röntgeni kartı: öğününün kalori ve makrolarını gösteren paylaşım kartını tek dokunuşla oluştur.
• Fotoğraf ve video: tarifini görsellerle anlat.

PAYLAŞ
• Keşfet: topluluğun tariflerini ve öğünlerini keşfet, beğen, yorum yap, kaydet.
• Takip et: sevdiğin hesapları takip et, profilini herkese açık ya da gizli tut.
• Gününe ekle: Keşfet'te gördüğün bir öğünü tek dokunuşla kendi günlüğüne logla.
• Gün halkası: günün öğünlerini takipçilerinle kısa süreliğine paylaş.

İZMİR'DE MİSİN? (eatkcal)
Kcalculate AI'nin içindeki eatkcal ile kalori ve makroları belli sağlıklı öğünleri sipariş edebilirsin. Sipariş şu an yalnız İzmir'deki teslimat bölgelerinde geçerli. Teslim edilen öğün günlüğüne kendiliğinden işlenir.

GİZLİLİK SENDE
• Reklam ölçümü (Meta) ve uygulama içi kullanım ölçümünü Profil › Gizlilik › Veri ve reklam izinleri'nden istediğin zaman kapatabilirsin.
• Hesabını uygulama içinden silebilirsin.

ÖNEMLİ
Kcalculate AI'nin kalori ve besin değerleri tahmindir; tıbbi tavsiye, teşhis ya da tedavi yerine geçmez. Özel bir sağlık durumun, hamileliğin ya da beslenme bozukluğun varsa bir sağlık uzmanına danış. Uygulama 18 yaş ve üzeri içindir.

Kullanım Koşulları: https://eatkcal.com/kullanim-kosullari
Gizlilik Politikası: https://eatkcal.com/gizlilik-politikasi
```

**Bu sürümde yenilikler (1.1.0):**
```text
Kcalculate AI 1.1.0 — baştan yeni bir uygulama:
• Yeni tasarım ve yeni alt menü: Ana sayfa, Tara, Keşfet, eatkcal ve Profil tek dokunuş uzağında.
• Fotoğrafla tara: tabağını çek, kalori ve makro tahmini al, gramı düzelt, logla. Bağlantı yoksa fotoğraf sıraya alınır.
• Ana sayfada kalori, makro, su ve etkinlik halkaları; seri kutlamaları.
• Keşfet: tarifler, öğünler, yorumlar, takip; gördüğün öğünü kendi gününe ekle.
• Paylaşım kartları ve paylaşım bağlantıları uygulamada açılır.
• eatkcal (İzmir): yenilenen sipariş akışı, adres doğrulama, sipariş takibi.
• Veri ve reklam izinleri: ölçüm tercihlerini Profil › Gizlilik'ten yönet.
• Hata düzeltmeleri ve performans iyileştirmeleri.
```

| URL | Değer |
|---|---|
| Destek URL’si (zorunlu) | https://eatkcal.com/destek |
| Pazarlama URL’si (isteğe bağlı) | https://kcalculate.ai |
| Gizlilik Politikası URL’si (App Information, yerelleştirilebilir) | https://eatkcal.com/gizlilik-politikasi |

## English (en-US / en-GB)

| Alan | Sınır | Kullanılan |
|---|---|---|
| Ad (App Name) | 30 | 30 |
| Alt başlık (Subtitle) | 30 | 29 |
| Promosyon metni (Promotional Text) | 170 | 153 |
| Anahtar kelimeler (Keywords) | 100 | 98 |
| Açıklama (Description) | 4000 | 2359 |
| Bu sürümde yenilikler (What’s New) | 4000 | 647 |

**Ad:** `Kcalculate AI: Calorie Tracker`  
**Alt başlık:** `Snap your plate, see calories`

**Promosyon metni** (sürüm gerektirmeden değiştirilebilir):
```text
New: snap your plate and let AI estimate calories and macros. Your day at a glance, your recipes in Explore. Healthy meal delivery in İzmir with eatkcal.
```

**Anahtar kelimeler** (virgül, boşluksuz; ad/alt başlıktaki kelimeler tekrarlanmaz; güvenli sınır: ≤ 100 karakter VE ≤ 100 bayt UTF-8):
```text
diet,macro,protein,meal,food,nutrition,recipe,weight,loss,healthy,water,diary,counter,scanner,goal
```

**Açıklama:**
```text
Snap a photo of your plate; Kcalculate AI estimates its calories and macros and adds them to your log. Then turn it into a recipe or share it with your community.

Track. Create. Share.

TRACK
• Scan with a photo: take a picture of your plate or pick one from your gallery. AI separates the foods on the plate and estimates calories, protein, carbs and fat for each.
• You stay in control: adjust grams and portions, add a missing food, remove a wrong one, or add a note like "half portion of bulgur". Nothing is logged until you confirm.
• Manual and quick add: log meals without a photo in seconds.
• Your day at a glance: calorie, macro, water and activity rings on the home screen.
• Water and activity: log water glass by glass, plus walks, runs and other activities.
• Streaks and badges: log at least one meal a day and grow your streak.
• Reminders: optional meal and streak reminders; turn them off anytime.
• Works offline: log without a connection; it syncs when you're back online.

CREATE
• Turn a meal into a post: attach its meal card with calories and macros, tell your recipe.
• Plate X-Ray card: create a share card showing your meal's calories and macros in one tap.
• Photos and video: tell your recipe's story with images.

SHARE
• Explore: discover recipes and meals from the community; like, comment and save.
• Follow: follow the accounts you love; keep your profile public or private.
• Add to your day: log a meal you saw in Explore to your own diary in one tap.
• Day ring: share today's meals with your followers for a short time.

IN İZMİR? (eatkcal)
With eatkcal inside Kcalculate AI you can order healthy meals with known calories and macros. Ordering is currently available only in delivery areas in İzmir, Türkiye. Delivered meals are added to your log automatically.

YOUR PRIVACY, YOUR CHOICE
• Turn ad measurement (Meta) and in-app usage measurement off anytime in Profile › Privacy › Data and ad permissions.
• Delete your account from inside the app.

IMPORTANT
Calorie and nutrition values in Kcalculate AI are estimates; they are not medical advice, diagnosis or treatment. If you have a medical condition, are pregnant or have an eating disorder, talk to a healthcare professional. The app is for users 18 and over.

Terms of Use: https://eatkcal.com/en/legal/terms
Privacy Policy: https://eatkcal.com/en/legal/privacy
```

**Bu sürümde yenilikler (1.1.0):**
```text
Kcalculate AI 1.1.0 — a brand-new app:
• New design and tab bar: Home, Scan, Explore, eatkcal and Profile one tap away.
• Scan with a photo: snap your plate, get a calorie and macro estimate, adjust grams, log it. Offline photos are queued.
• Calorie, macro, water and activity rings on Home, plus streak celebrations.
• Explore: recipes, meals, comments and follows; add a meal you see to your own day.
• Share cards, and shared links now open in the app.
• eatkcal (İzmir): refreshed ordering, address check and order tracking.
• Data and ad permissions: manage measurement choices in Profile › Privacy.
• Bug fixes and performance improvements.
```

| URL | Değer |
|---|---|
| Destek URL’si (zorunlu) | https://eatkcal.com/en/support |
| Pazarlama URL’si (isteğe bağlı) | https://kcalculate.ai |
| Gizlilik Politikası URL’si (App Information, yerelleştirilebilir) | https://eatkcal.com/en/legal/privacy |

## İnceleme notu ve demo hesap
Bkz. `docs/store/INCELEME_NOTU.md` (App Review Information + Play "Uygulama erişimi").

## Alternatifler (A/B veya İlter tercihi)
| Alan | TR | EN |
|---|---|---|
| Alt başlık B | `Takip et, üret, paylaş` (22) | `Track, create, share` (20) |
| Alt başlık C | `Fotoğrafla kalori ve makro` (26) | `Calorie & macro photo log` (25) |
Alt başlık B marka cümlesidir ama arama değeri düşük; A önerilir. Promosyon metni sürüm göndermeden değiştirilebilir (kampanya dönemleri için).
