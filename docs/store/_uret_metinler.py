# G20-S2 md.2 — mağaza metinleri üreticisi: karakter sınırlarını denetler, markdown yazar.
import sys, os

OUT = sys.argv[1]

PRIV_TR = 'https://eatkcal.com/gizlilik-politikasi'
PRIV_EN = 'https://eatkcal.com/en/legal/privacy'
SUP_TR = 'https://eatkcal.com/destek'
SUP_EN = 'https://eatkcal.com/en/support'
TERMS_TR = 'https://eatkcal.com/kullanim-kosullari'
TERMS_EN = 'https://eatkcal.com/en/legal/terms'
DEL_TR = 'https://eatkcal.com/account-deletion'
DEL_EN = 'https://eatkcal.com/en/account-deletion'
MKT = 'https://kcalculate.ai'

DESC_TR = f"""Tabağının fotoğrafını çek; Kcalculate AI kalorisini ve makrolarını tahmin etsin, günlüğüne kendiliğinden işlesin. Sonra ister tarifini üret, ister topluluğunla paylaş.

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

Kullanım Koşulları: {TERMS_TR}
Gizlilik Politikası: {PRIV_TR}"""

DESC_EN = f"""Snap a photo of your plate; Kcalculate AI estimates its calories and macros and adds them to your log. Then turn it into a recipe or share it with your community.

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

Terms of Use: {TERMS_EN}
Privacy Policy: {PRIV_EN}"""

WHATS_NEW_TR = """Kcalculate AI 1.1.0 — baştan yeni bir uygulama:
• Yeni tasarım ve yeni alt menü: Ana sayfa, Tara, Keşfet, eatkcal ve Profil tek dokunuş uzağında.
• Fotoğrafla tara: tabağını çek, kalori ve makro tahmini al, gramı düzelt, logla. Bağlantı yoksa fotoğraf sıraya alınır.
• Ana sayfada kalori, makro, su ve etkinlik halkaları; seri kutlamaları.
• Keşfet: tarifler, öğünler, yorumlar, takip; gördüğün öğünü kendi gününe ekle.
• Paylaşım kartları ve paylaşım bağlantıları uygulamada açılır.
• eatkcal (İzmir): yenilenen sipariş akışı, adres doğrulama, sipariş takibi.
• Veri ve reklam izinleri: ölçüm tercihlerini Profil › Gizlilik'ten yönet.
• Hata düzeltmeleri ve performans iyileştirmeleri."""

WHATS_NEW_EN = """Kcalculate AI 1.1.0 — a brand-new app:
• New design and tab bar: Home, Scan, Explore, eatkcal and Profile one tap away.
• Scan with a photo: snap your plate, get a calorie and macro estimate, adjust grams, log it. Offline photos are queued.
• Calorie, macro, water and activity rings on Home, plus streak celebrations.
• Explore: recipes, meals, comments and follows; add a meal you see to your own day.
• Share cards, and shared links now open in the app.
• eatkcal (İzmir): refreshed ordering, address check and order tracking.
• Data and ad permissions: manage measurement choices in Profile › Privacy.
• Bug fixes and performance improvements."""

PLAY_NOTES_TR = """1.1.0: Yeni tasarım. Fotoğrafla tara: kalori ve makro tahmini, gramı düzelt, logla. Ana sayfada kalori, makro, su ve etkinlik halkaları, seri. Keşfet: tarif, yorum, takip, öğünü gününe ekle. Paylaşım kartları ve bağlantıları. eatkcal (İzmir) yeni sipariş akışı. Veri ve reklam izinleri Profil › Gizlilik'te. Hata düzeltmeleri."""

PLAY_NOTES_EN = """1.1.0: New design. Scan with a photo: calorie and macro estimate, adjust grams, log it. Calorie, macro, water and activity rings on Home, streaks. Explore: recipes, comments, follows, add a meal to your day. Share cards and links. Refreshed eatkcal ordering (İzmir). Data and ad permissions in Profile › Privacy. Bug fixes."""

AS = {
    'tr': dict(
        name='Kcalculate AI: Kalori Takibi',
        subtitle='Tabağını çek, kalorini gör',
        promo="Yeni: tabağını çek, yapay zekâ kalori ve makroları tahmin etsin. Günün tek bakışta, tariflerin Keşfet'te. İzmir'de sağlıklı öğün siparişi eatkcal ile.",
        keywords='diyet,makro,protein,öğün,besin,yemek,tarif,kilo,sağlıklı,beslenme,günlük,fotoğraf,sayacı',
        desc=DESC_TR, new=WHATS_NEW_TR,
        support=SUP_TR, privacy=PRIV_TR, marketing=MKT,
    ),
    'en': dict(
        name='Kcalculate AI: Calorie Tracker',
        subtitle='Snap your plate, see calories',
        promo='New: snap your plate and let AI estimate calories and macros. Your day at a glance, your recipes in Explore. Healthy meal delivery in İzmir with eatkcal.',
        keywords='diet,macro,protein,meal,food,nutrition,recipe,weight,loss,healthy,water,diary,counter,scanner,goal',
        desc=DESC_EN, new=WHATS_NEW_EN,
        support=SUP_EN, privacy=PRIV_EN, marketing=MKT,
    ),
}
GP = {
    'tr': dict(
        title='Kcalculate AI: Kalori Takibi',
        short='Tabağını çek, AI kalori ve makroyu tahmin etsin. Takip et, üret, paylaş.',
        full=DESC_TR, notes=PLAY_NOTES_TR,
    ),
    'en': dict(
        title='Kcalculate AI: Calorie Tracker',
        short='Snap your plate, let AI estimate calories & macros. Track, create, share.',
        full=DESC_EN, notes=PLAY_NOTES_EN,
    ),
}
LIM_AS = dict(name=30, subtitle=30, promo=170, keywords=100, desc=4000, new=4000)
LIM_GP = dict(title=30, short=80, full=4000, notes=500)

errors = []
def chk(store, lang, field, text, lim):
    n = len(text)
    if n > lim:
        errors.append(f'{store}/{lang}/{field}: {n} > {lim}')
    return n

# Anahtar kelime kuralları: ad/alt başlıktaki kelimeyi tekrarlama, virgülden sonra boşluk yok.
for lang, d in AS.items():
    kws = d['keywords'].split(',')
    if any(k != k.strip() or not k for k in kws):
        errors.append(f'AS/{lang}/keywords: boşluk/boş öğe')
    title_words = set((d['name'] + ' ' + d['subtitle']).lower().replace(':', ' ').replace(',', ' ').split())
    dup = [k for k in kws if k.lower() in title_words]
    if dup:
        errors.append(f'AS/{lang}/keywords tekrar: {dup}')
    if len(set(kws)) != len(kws):
        errors.append(f'AS/{lang}/keywords çift')
    if len(d['keywords'].encode('utf-8')) > 100:
        errors.append(f'AS/{lang}/keywords bayt > 100 (güvenli sınır: karakter VE bayt)')
    # "₺" yasak, "eatkcal yalnız İzmir" ifadesi açıklamada olmalı
for lang, d in list(AS.items()):
    if '₺' in d['desc'] + d['promo'] + d['new']:
        errors.append(f'{lang}: ₺')
    if 'İzmir' not in d['desc']:
        errors.append(f'{lang}: İzmir kısıtı yok')

def block(t):
    return '```text\n' + t + '\n```'

def as_md(lang):
    d = AS[lang]
    L = []
    hdr = 'Türkçe (tr-TR) — birincil' if lang == 'tr' else 'English (en-US / en-GB)'
    L.append(f'## {hdr}\n')
    L.append('| Alan | Sınır | Kullanılan |\n|---|---|---|')
    for f, lab in [('name', 'Ad (App Name)'), ('subtitle', 'Alt başlık (Subtitle)'), ('promo', 'Promosyon metni (Promotional Text)'), ('keywords', 'Anahtar kelimeler (Keywords)'), ('desc', 'Açıklama (Description)'), ('new', 'Bu sürümde yenilikler (What’s New)')]:
        L.append(f'| {lab} | {LIM_AS[f]} | {chk("AS", lang, f, d[f], LIM_AS[f])} |')
    L.append('')
    L.append(f'**Ad:** `{d["name"]}`  \n**Alt başlık:** `{d["subtitle"]}`\n')
    L.append('**Promosyon metni** (sürüm gerektirmeden değiştirilebilir):\n' + block(d['promo']) + '\n')
    L.append('**Anahtar kelimeler** (virgül, boşluksuz; ad/alt başlıktaki kelimeler tekrarlanmaz; güvenli sınır: ≤ 100 karakter VE ≤ 100 bayt UTF-8):\n' + block(d['keywords']) + '\n')
    L.append('**Açıklama:**\n' + block(d['desc']) + '\n')
    L.append('**Bu sürümde yenilikler (1.1.0):**\n' + block(d['new']) + '\n')
    L.append('| URL | Değer |\n|---|---|')
    L.append(f'| Destek URL’si (zorunlu) | {d["support"]} |')
    L.append(f'| Pazarlama URL’si (isteğe bağlı) | {d["marketing"]} |')
    L.append(f'| Gizlilik Politikası URL’si (App Information, yerelleştirilebilir) | {d["privacy"]} |')
    L.append('')
    return '\n'.join(L)

def gp_md(lang):
    d = GP[lang]
    L = []
    hdr = 'Türkçe (tr-TR) — varsayılan dil' if lang == 'tr' else 'English (en-US)'
    L.append(f'## {hdr}\n')
    L.append('| Alan | Sınır | Kullanılan |\n|---|---|---|')
    for f, lab in [('title', 'Uygulama adı'), ('short', 'Kısa açıklama'), ('full', 'Tam açıklama'), ('notes', 'Sürüm notları (Bu sürümdeki yenilikler)')]:
        L.append(f'| {lab} | {LIM_GP[f]} | {chk("GP", lang, f, d[f], LIM_GP[f])} |')
    L.append('')
    L.append(f'**Uygulama adı:** `{d["title"]}`\n')
    L.append('**Kısa açıklama:**\n' + block(d['short']) + '\n')
    L.append('**Tam açıklama:**\n' + block(d['full']) + '\n')
    L.append('**Sürüm notları (1.1.0):**\n' + block(d['notes']) + '\n')
    return '\n'.join(L)

as_doc = f"""# App Store Connect — mağaza metinleri TR / EN (G20-S2 md.2)

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

{as_md('tr')}
{as_md('en')}
## İnceleme notu ve demo hesap
Bkz. `docs/store/INCELEME_NOTU.md` (App Review Information + Play "Uygulama erişimi").

## Alternatifler (A/B veya İlter tercihi)
| Alan | TR | EN |
|---|---|---|
| Alt başlık B | `Takip et, üret, paylaş` (22) | `Track, create, share` (20) |
| Alt başlık C | `Fotoğrafla kalori ve makro` (26) | `Calorie & macro photo log` (25) |
Alt başlık B marka cümlesidir ama arama değeri düşük; A önerilir. Promosyon metni sürüm göndermeden değiştirilebilir (kampanya dönemleri için).
"""

gp_doc = f"""# Google Play Console — mağaza metinleri TR / EN (G20-S2 md.2)

Paket: `com.kcalmobile.app` · Sürüm adı **1.1.0** (versionCode EAS remote).
Konumlandırma: **Takip et · Üret · Paylaş**; eatkcal ikincil, yalnız İzmir. Karakter sayıları betikle denetlendi.

## Ortak alanlar
| Alan | Öneri | Not |
|---|---|---|
| Uygulama kategorisi | Sağlık ve Fitness | |
| Etiketler | Kalori sayacı, Diyet ve beslenme, Tarifler | Play etiket listesinden en fazla 5 |
| İletişim e-postası | `[support@kcalculate.ai]` (L-S1 KURUMSAL_KIMLIK öneri) | zorunlu, herkese açık |
| Web sitesi | {MKT} | |
| Gizlilik politikası | {PRIV_TR} (EN sayfa: {PRIV_EN}) | Play tek URL alır → TR sayfası; EN bağlantısı sayfada olmalı |
| Hesap silme URL’si (Veri güvenliği) | {DEL_TR} | web'den silme talebi; EN: {DEL_EN} |
| İçerik derecelendirmesi (IARC) | Kullanıcı etkileşimi VAR (kullanıcılar içerik paylaşır, etkileşim kurar), konum paylaşımı YOK (yalnız adres), dijital satın alma YOK | |
| Hedef kitle | 18 ve üzeri (Aile programı DEĞİL) | Kullanım Koşulları 18+ |
| Reklam içeriyor mu | Hayır (uygulamada reklam gösterilmez; Meta yalnız ölçüm) | |
| Sağlık uygulaması beyanı | Evet: beslenme/kilo takibi; tıbbi cihaz DEĞİL | Play "Health apps" beyanı (2025+) |

{gp_md('tr')}
{gp_md('en')}
## Grafik öğeler
| Öğe | Ölçü | Kaynak |
|---|---|---|
| Uygulama simgesi | 512×512 PNG (32-bit, alfa) | `assets/icon.png` büyütülmeden kaynaktan dışa aktar |
| Öne çıkan grafik | 1024×500 | Öneri: siyah zemin + lime (#B9EF14) "Takip et. Üret. Paylaş." + Ana sayfa ekranı (EKRAN_GORUNTUSU_PLANI.md) |
| Telefon ekran görüntüleri | 2–8 adet, 9:16, ≥1080 px kısa kenar | EKRAN_GORUNTUSU_PLANI.md |
"""

if errors:
    print('HATA:\n' + '\n'.join(errors))
    sys.exit(1)
open(os.path.join(OUT, 'APP_STORE_METINLERI.md'), 'w', encoding='utf-8').write(as_doc)
open(os.path.join(OUT, 'GOOGLE_PLAY_METINLERI.md'), 'w', encoding='utf-8').write(gp_doc)
for store, D, LIM in [('AS', AS, LIM_AS), ('GP', GP, LIM_GP)]:
    for lang, d in D.items():
        print(store, lang, {f: len(d[f]) for f in LIM})
