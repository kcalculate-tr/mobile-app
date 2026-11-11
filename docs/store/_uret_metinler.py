# M-S1 md.1 — 1.1.0 mağaza metinleri üreticisi (G20-S2 betiğinin yerine).
# Karakter sınırlarını, anahtar kelime tekrarını ve yasak dili denetler; iki markdown yazar.
# Çalıştır: python3 -I docs/store/_uret_metinler.py docs/store
import sys, os

OUT = sys.argv[1]

PRIV_TR = 'https://eatkcal.com/gizlilik-politikasi'
PRIV_EN = 'https://eatkcal.com/en/legal/privacy'
TERMS_TR = 'https://eatkcal.com/kullanim-kosullari'
TERMS_EN = 'https://eatkcal.com/en/legal/terms'
SUP_TR = 'https://eatkcal.com/destek'
SUP_EN = 'https://eatkcal.com/en/support'
DEL_TR = 'https://eatkcal.com/account-deletion'
DEL_EN = 'https://eatkcal.com/en/account-deletion'
MKT = 'https://eatkcal.com'
EULA = 'https://www.apple.com/legal/internet-services/itunes/dev/stdeula/'

# ---------- ortak gövde parçaları ----------
INTRO_TR = """KCAL ile tabağının fotoğrafını çek, ne yediğini yaz ya da söyle; kalori ve makrolar saniyeler içinde günlüğünde.

Hesabı biz yapıyoruz, sen de görüyorsun. Her yiyeceğin gramını, kalorisini, proteinini, karbonhidratını ve yağını tek tek gösteriyoruz; yanlış bulduğunu sen düzeltiyorsun."""

INTRO_EN = """Snap a photo of your plate, type or say what you ate, and KCAL puts the calories and macros in your log in seconds.

The calorie tracker with a real kitchen behind it. We show the grams, calories, protein, carbs and fat for every food on your plate, and you can fix anything that looks off."""

FEATURES_TR = """KAYDETMENİN DÖRT YOLU
• Fotoğrafla: tabağını çek ya da galeriden seç. Yapay zekâ tabaktaki yiyecekleri ayırır ve her biri için tahmin verir.
• Sesle: "bir kase mercimek çorbası ve bir ayran" de; söylediğin yazıya dökülür ve öğelere ayrılır. Ses kaydı tutulmaz.
• Barkodla: paketli ürünün barkodunu okut, besin değerleri gelsin.
• Elle: fotoğraf istemediğin öğünleri saniyeler içinde gir.
Gramı ve porsiyonu değiştir, eksik yiyeceği ekle, yanlışı çıkar. Sen onaylamadan hiçbir şey günlüğe girmez.

GÜNÜN TEK BAKIŞTA
• Kalori, makro ve su halkaları ana sayfada.
• Etkinliklerini ekle, harcadığını ve kalanı gör.
• İlerleme: 7, 14 ve 30 günlük kalori ve makro özetin.
• Seri: her gün en az bir öğün kaydet, serini büyüt.
• Hatırlatmalar isteğe bağlı; istediğin zaman kapat.
• Bağlantı yokken de kaydet; internet gelince eşitlenir.

KEŞFET
• Topluluğun tariflerini ve öğünlerini keşfet, beğen, yorum yap, kaydet.
• Beğendiğin tabağı tek dokunuşla kendi gününe ekle.
• Sevdiğin hesapları takip et; profilini herkese açık ya da gizli tut.
• Her gönderide şikâyet ve engelleme seçeneği var.

EATKCAL: İZMİR'DE FİT YEMEK
KCAL'in mutfağı eatkcal'da hazırlanan, kalorisi ve makrosu hesaplı öğünleri uygulamadan sipariş et. Teslim edilen öğün günlüğüne kendiliğinden işlenir. Sipariş şu an yalnız İzmir'deki teslimat bölgelerinde geçerli."""

FEATURES_EN = """FOUR WAYS TO LOG
• Photo: take a picture of your plate or pick one from your gallery. AI separates the foods and gives an estimate for each.
• Voice: say "a bowl of lentil soup and a glass of ayran"; your words are turned into text and split into items. No audio is recorded.
• Barcode: scan a packaged product to get its nutrition facts.
• Manual: log meals without a photo in seconds.
Adjust grams and portions, add a missing food, remove a wrong one. Nothing is logged until you confirm.

YOUR DAY AT A GLANCE
• Calorie, macro and water rings on your home screen.
• Add your activities and see what you burned and what's left.
• Progress: your calorie and macro summary for 7, 14 and 30 days.
• Streaks: log at least one meal a day and keep your streak going.
• Optional reminders; turn them off anytime.
• Log offline; everything syncs when you're back online.

EXPLORE
• Discover recipes and meals from the community; like, comment and save.
• Add a plate you like to your own day in one tap.
• Follow accounts you love; keep your profile public or private.
• Every post can be reported, and any account can be blocked.

EATKCAL: HEALTHY MEALS IN İZMİR
Order meals made in eatkcal, KCAL's own kitchen, with calories and macros already worked out. Delivered meals are added to your log automatically. Ordering is currently available only in delivery areas in İzmir, Türkiye."""

PLANS_TR = """ÜCRETSİZ VE KCALAI PLANLARI
• Ücretsiz: günde 2 AI tarama (fotoğraf ya da ses), günde 5 barkod, elle giriş sınırsız.
• kcalAI Fresh: günde 10 AI tarama; barkod ve elle giriş sınırsız. Aylık 199 TL ya da yıllık 999 TL.
• kcalAI Balance: günde 50 AI tarama; barkod ve elle giriş sınırsız. Aylık 499 TL ya da yıllık 2999 TL.
• Yıllık planlarda 7 gün ücretsiz deneme; ücret deneme bitince alınır.
Fiyatlar Türkiye içindir; başka ülkelerde mağaza kendi yerel fiyatını gösterir. AI tarama hakları her gece 00.00'da yenilenir."""

PLANS_EN = """FREE AND KCALAI PLANS
• Free: 2 AI scans a day (photo or voice), 5 barcode scans a day, unlimited manual entries.
• kcalAI Fresh: 10 AI scans a day; unlimited barcode and manual entries. $5.99 a month or $29.99 a year.
• kcalAI Balance: 50 AI scans a day; unlimited barcode and manual entries. $12.99 a month or $59.99 a year.
• 7-day free trial on yearly plans; you're charged when the trial ends.
Prices shown are in US dollars; the App Store shows your local price. AI scans reset every night at midnight."""

# Otomatik yenilenen abonelik zorunlu bilgisi (Apple 3.1.2 / Play abonelik politikası)
SUBTERMS_AS_TR = f"""Abonelik bilgisi: Ödeme, satın almayı onayladığında Apple Kimliği hesabından alınır. Abonelik, dönem bitmeden en az 24 saat önce iptal edilmezse aynı süre ve fiyatla otomatik yenilenir; yenileme ücreti dönemin son 24 saati içinde alınır. Aboneliğini App Store hesap ayarlarından yönetebilir ve iptal edebilirsin. Ücretsiz denemenin kullanılmayan kısmı, abonelik satın alındığında geçersiz olur.

Kullanım Koşulları: {TERMS_TR}
Apple Standart Lisans Sözleşmesi (EULA): {EULA}
Gizlilik Politikası: {PRIV_TR}"""

SUBTERMS_AS_EN = f"""Subscription terms: Payment is charged to your Apple ID account when you confirm the purchase. Your subscription renews automatically for the same period and price unless cancelled at least 24 hours before the end of the current period; renewal is charged within the last 24 hours of the period. You can manage and cancel your subscription in your App Store account settings. Any unused part of a free trial ends when you buy a subscription.

Terms of Use: {TERMS_EN}
Apple Standard License Agreement (EULA): {EULA}
Privacy Policy: {PRIV_EN}"""

SUBTERMS_GP_TR = f"""Abonelik bilgisi: Ödeme, satın almayı onayladığında Google Play hesabından alınır. Abonelik, dönem bitmeden iptal edilmezse aynı süre ve fiyatla otomatik yenilenir. Aboneliğini Google Play › Ödemeler ve abonelikler bölümünden yönetebilir ve iptal edebilirsin. Ücretsiz deneme bitmeden iptal edersen ücret alınmaz.

Kullanım Koşulları: {TERMS_TR}
Gizlilik Politikası: {PRIV_TR}"""

SUBTERMS_GP_EN = f"""Subscription terms: Payment is charged to your Google Play account when you confirm the purchase. Your subscription renews automatically for the same period and price unless cancelled before the end of the current period. You can manage and cancel it in Google Play › Payments & subscriptions. Cancel before a free trial ends and you won't be charged.

Terms of Use: {TERMS_EN}
Privacy Policy: {PRIV_EN}"""

PRIVACY_AS_TR = """GİZLİLİK
• Uygulamada reklam yok; seni başka uygulama ve sitelerde izlemiyoruz.
• Tabak fotoğrafın ve notun yalnız tahmin için yapay zekâ sağlayıcımıza gönderilir; ilk taramadan önce iznini isteriz.
• Konumunu yalnız eatkcal adresini doğrularken, sen istediğinde kullanırız.
• Ölçüm tercihlerini Profil › Gizlilik'ten yönet; hesabını uygulama içinden sil."""

PRIVACY_AS_EN = """PRIVACY
• No ads in the app, and we don't track you across other apps or websites.
• Your plate photo and note are sent to our AI provider only to make the estimate; we ask for your permission before your first scan.
• We use your location only to check an eatkcal delivery address, and only when you ask.
• Manage measurement choices in Profile › Privacy, and delete your account from inside the app."""

PRIVACY_GP_TR = """GİZLİLİK
• Uygulamada reklam yok.
• Tabak fotoğrafın ve notun yalnız tahmin için yapay zekâ sağlayıcımıza gönderilir; ilk taramadan önce iznini isteriz.
• Konumunu yalnız eatkcal adresini doğrularken, sen istediğinde kullanırız.
• Kullanım ve reklam ölçümünü Profil › Gizlilik'ten istediğin zaman kapat; hesabını uygulama içinden sil."""

PRIVACY_GP_EN = """PRIVACY
• No ads in the app.
• Your plate photo and note are sent to our AI provider only to make the estimate; we ask for your permission before your first scan.
• We use your location only to check an eatkcal delivery address, and only when you ask.
• Turn usage and ad measurement off anytime in Profile › Privacy, and delete your account from inside the app."""

IMPORTANT_TR = """ÖNEMLİ
KCAL'deki kalori ve besin değerleri tahmindir; tıbbi tavsiye, teşhis ya da tedavi yerine geçmez. Özel bir sağlık durumun, hamileliğin ya da beslenme bozukluğun varsa bir sağlık uzmanına danış. Uygulama 18 yaş ve üzeri içindir."""

IMPORTANT_EN = """IMPORTANT
Calorie and nutrition values in KCAL are estimates; they are not medical advice, diagnosis or treatment. If you have a medical condition, are pregnant or have an eating disorder, talk to a healthcare professional. KCAL is for users 18 and over."""

def desc(intro, feats, plans, privacy, important, subterms):
    return '\n\n'.join([intro, feats, plans, privacy, important, subterms])

DESC_AS_TR = desc(INTRO_TR, FEATURES_TR, PLANS_TR, PRIVACY_AS_TR, IMPORTANT_TR, SUBTERMS_AS_TR)
DESC_AS_EN = desc(INTRO_EN, FEATURES_EN, PLANS_EN, PRIVACY_AS_EN, IMPORTANT_EN, SUBTERMS_AS_EN)
DESC_GP_TR = desc(INTRO_TR, FEATURES_TR, PLANS_TR.replace('mağaza kendi yerel', 'Google Play kendi yerel'), PRIVACY_GP_TR, IMPORTANT_TR, SUBTERMS_GP_TR)
DESC_GP_EN = desc(INTRO_EN, FEATURES_EN, PLANS_EN.replace('the App Store shows', 'Google Play shows'), PRIVACY_GP_EN, IMPORTANT_EN, SUBTERMS_GP_EN)

WHATS_NEW_TR = """KCAL 1.1.0 ile yeni:
• Yeni ad ve yeni tasarım: KCAL: AI Kalori Hesaplama.
• Sesle ekle: ne yediğini söyle, öğelere ayrılsın. Ses kaydı tutulmaz.
• Barkod okut: paketli ürünleri saniyeler içinde ekle.
• Fotoğrafla tarama yenilendi: her yiyeceğin gramını ve porsiyonunu düzelt.
• kcalAI Fresh ve Balance: günde daha çok AI tarama; yıllık planlarda 7 gün ücretsiz deneme.
• Ana sayfada kalori, makro ve su halkaları; etkinlik, ilerleme ve seri.
• Keşfet: tarifler, öğünler, yorumlar; beğendiğin tabağı gününe ekle.
• eatkcal (İzmir): yenilenen sipariş akışı.
• Daha az izin: her izni yalnız o özelliği kullandığında soruyoruz.
• Hata düzeltmeleri ve iyileştirmeler."""

WHATS_NEW_EN = """New in KCAL 1.1.0:
• New name and new design: KCAL: AI Calorie Counter.
• Add by voice: say what you ate and it's split into items. No audio is recorded.
• Barcode scanning: add packaged foods in seconds.
• Refreshed photo scan: fix the grams and portion of every food.
• kcalAI Fresh and Balance: more AI scans a day; 7-day free trial on yearly plans.
• Calorie, macro and water rings on Home, plus activity, progress and streaks.
• Explore: recipes, meals and comments; add a plate you like to your day.
• eatkcal (İzmir): refreshed ordering.
• Fewer prompts: we ask for each permission only when you use that feature.
• Bug fixes and improvements."""

PLAY_NOTES_TR = """1.1.0: Yeni ad ve tasarım. Sesle ekle (ses kaydı tutulmaz) ve barkod okut. Fotoğrafla tarama yenilendi: gramı ve porsiyonu düzelt. kcalAI Fresh ve Balance planları; yıllıkta 7 gün ücretsiz deneme. Ana sayfada kalori, makro, su halkaları, etkinlik, ilerleme ve seri. Keşfet'te tarif ve öğünler. eatkcal (İzmir) yeni sipariş akışı. İzinler yalnız gerektiğinde. Hata düzeltmeleri."""

PLAY_NOTES_EN = """1.1.0: New name and design. Add by voice (no audio recorded) and scan barcodes. Refreshed photo scan: fix grams and portions. kcalAI Fresh and Balance plans; 7-day free trial on yearly. Calorie, macro and water rings, activity, progress and streaks on Home. Recipes and meals in Explore. Refreshed eatkcal ordering (İzmir). Permissions only when needed. Bug fixes."""

AS = {
    'tr': dict(
        name='KCAL: AI Kalori Hesaplama',
        subtitle='Kalori Sayacı & Fit Yemek',
        promo="Hesabı biz yapıyoruz, sen de görüyorsun. Tabağını çek, yaz ya da söyle; kalori ve makrolar saniyeler içinde günlüğünde. İzmir'de fit yemek eatkcal ile.",
        keywords='takip,diyet,makro,protein,kilo,yapay,zeka,fotoğraf,barkod,sesli,öğün,besin,tarif,izmir,teslimat',
        desc=DESC_AS_TR, new=WHATS_NEW_TR,
        support=SUP_TR, privacy=PRIV_TR, marketing=MKT,
    ),
    'en': dict(
        name='KCAL: AI Calorie Counter',
        subtitle='Photo Food Tracker & Macros',
        promo='The calorie tracker with a real kitchen behind it. Snap, type or say what you ate and see calories and macros in seconds. Healthy meals in İzmir with eatkcal.',
        keywords='diet,protein,weight,meal,scanner,barcode,voice,log,nutrition,recipe,diary,healthy,carb,water,fitness',
        desc=DESC_AS_EN, new=WHATS_NEW_EN,
        support=SUP_EN, privacy=PRIV_EN, marketing=MKT,
    ),
}
GP = {
    'tr': dict(
        title='KCAL: AI Kalori Hesaplama',
        short="Fotoğraf çek, yaz ya da söyle; kalori ve makrolar gelsin. İzmir'de fit yemek.",
        full=DESC_GP_TR, notes=PLAY_NOTES_TR,
    ),
    'en': dict(
        title='KCAL: AI Calorie Counter',
        short='Snap, type or say what you ate; see calories & macros. Healthy meals in İzmir.',
        full=DESC_GP_EN, notes=PLAY_NOTES_EN,
    ),
}
LIM_AS = dict(name=30, subtitle=30, promo=170, keywords=100, desc=4000, new=4000)
LIM_GP = dict(title=30, short=80, full=4000, notes=500)

# Yasak dil (İlter 11 Kas): somut kilo vaadi, önce/sonra, tıbbi iddia, "sınırsız AI"; Koç 1.1.0'da kapalı → hiç anılmaz.
BANNED = ['₺', 'sınırsız ai', 'unlimited ai', 'sınırsız tarama', 'unlimited scan', 'önce/sonra', 'öncesi/sonrası',
          'before/after', 'before and after', 'kilo ver', 'lose weight', 'zayıfla', 'garanti', 'guarantee', 'tedavi eder',
          'cures', 'koç', 'coach', 'yakında', 'coming soon', 'uygulama içi satın alma yok', 'no in-app purchase']

errors = []
def chk(store, lang, field, text, lim):
    n = len(text)
    if n > lim:
        errors.append(f'{store}/{lang}/{field}: {n} > {lim}')
    return n

for lang, d in AS.items():
    kws = d['keywords'].split(',')
    if any(k != k.strip() or not k for k in kws):
        errors.append(f'AS/{lang}/keywords: boşluk/boş öğe')
    title_words = set((d['name'] + ' ' + d['subtitle']).lower().replace(':', ' ').replace('&', ' ').split())
    dup = [k for k in kws if k.lower() in title_words]
    if dup:
        errors.append(f'AS/{lang}/keywords tekrar: {dup}')
    if len(set(kws)) != len(kws):
        errors.append(f'AS/{lang}/keywords çift')
    if len(d['keywords'].encode('utf-8')) > 100:
        errors.append(f'AS/{lang}/keywords bayt > 100 (güvenli sınır: karakter VE bayt)')

def lower(s):
    return s.replace('İ', 'i').replace('I', 'ı').lower()

for store, D in [('AS', AS), ('GP', GP)]:
    for lang, d in D.items():
        blob = lower(' '.join(v for v in d.values() if isinstance(v, str)))
        for b in BANNED:
            if b in blob and not (b == 'tedavi eder' and False):
                # "tedavi" yalnız "tedavi yerine geçmez" bağlamında serbest; "eder" biçimi yasak
                errors.append(f'{store}/{lang}: yasak ifade "{b}"')
        if 'İzmir' not in (d.get('desc') or d.get('full')):
            errors.append(f'{store}/{lang}: İzmir kısıtı yok')
for lang in ('tr', 'en'):
    for need in (EULA, TERMS_TR if lang == 'tr' else TERMS_EN, PRIV_TR if lang == 'tr' else PRIV_EN):
        if need not in AS[lang]['desc']:
            errors.append(f'AS/{lang}: açıklamada bağlantı yok: {need}')

def block(t):
    return '```text\n' + t + '\n```'

def as_md(lang):
    d = AS[lang]
    L = []
    hdr = 'Türkçe (tr-TR) — birincil' if lang == 'tr' else 'English (en-US; en-GB aynı metin)'
    L.append(f'## {hdr}\n')
    L.append('| Alan | Sınır | Kullanılan |\n|---|---|---|')
    for f, lab in [('name', 'Ad (App Name)'), ('subtitle', 'Alt başlık (Subtitle)'), ('promo', 'Promosyon metni (Promotional Text)'), ('keywords', 'Anahtar kelimeler (Keywords)'), ('desc', 'Açıklama (Description)'), ('new', 'Bu sürümde yenilikler (What’s New)')]:
        L.append(f'| {lab} | {LIM_AS[f]} | {chk("AS", lang, f, d[f], LIM_AS[f])} |')
    L.append('')
    L.append(f'**Ad:** `{d["name"]}`  \n**Alt başlık:** `{d["subtitle"]}`\n')
    L.append('**Promosyon metni** (sürüm göndermeden değiştirilebilir):\n' + block(d['promo']) + '\n')
    L.append(f'**Anahtar kelimeler** ({len(d["keywords"])} karakter / {len(d["keywords"].encode("utf-8"))} bayt; virgül, boşluksuz; ad/alt başlıktaki kelimeler tekrarlanmaz):\n' + block(d['keywords']) + '\n')
    L.append('**Açıklama:**\n' + block(d['desc']) + '\n')
    L.append('**Bu sürümde yenilikler (1.1.0):**\n' + block(d['new']) + '\n')
    L.append('| URL | Değer |\n|---|---|')
    L.append(f'| Destek URL’si (zorunlu) | {d["support"]} |')
    L.append(f'| Pazarlama URL’si | {d["marketing"]} |')
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

COMMON_NOTE = """> Kaynak: İlter kararları 11 Kas (`.claude/night/M-S1.md`), rakip raporu §5 ASO / §6 paywall (`~/dev/kcal-research/rakip/RAKIP_ANALIZI_v1.md`).
> Bu dosya `docs/store/_uret_metinler.py` ile üretilir (karakter sınırı, anahtar kelime tekrarı, yasak dil, zorunlu bağlantılar denetlenir).
> Elle düzeltme yapma; betikte değiştir ve yeniden üret: `python3 -I docs/store/_uret_metinler.py docs/store`.
> **Yasak dil:** somut kilo vaadi, önce/sonra, tıbbi iddia, "sınırsız AI". **kcalAI Koç 1.1.0'da kapalı** (bayrak `koc`) → metinde hiç anılmaz; Koç OTA ile açılınca açıklama + paywall satırı güncellenir (YAYIN_KONTROL › D)."""

as_doc = f"""# App Store Connect — mağaza metinleri TR / EN · 1.1.0 (M-S1 md.1)

Uygulama: `com.kcalmobile.app` (ascAppId 6763964912) · Sürüm **1.1.0** · Cihazdaki ad `Kcalculate` (`app.config.js` `name`) kalır.
Ana mesaj: TR **"Hesabı biz yapıyoruz, sen de görüyorsun."** · EN **"The calorie tracker with a real kitchen behind it."**

{COMMON_NOTE}

## Ortak (dil bağımsız) alanlar
| Alan | Değer | Not |
|---|---|---|
| Birincil kategori | **Sağlık ve Fitness** (Health & Fitness) | rapor §1.10: bugün Yiyecek ve İçecek → düzelt |
| İkincil kategori | Yemek ve İçecek (Food & Drink) | eatkcal + tarifler |
| Fiyat | Ücretsiz (indirmesi) | |
| Uygulama içi satın alma | **VAR** — 4 otomatik yenilenen abonelik (aşağıda). eatkcal siparişi fiziksel ürün → IAP değil (3.1.3(e)) | 1.0.x'teki "uygulama içi satın alma YOK" satırı kaldırıldı |
| Abonelik grubu | `kcalAI` — sıra (üstten): Balance yıllık, Balance aylık, Fresh yıllık, Fresh aylık | aynı grupta yükseltme/düşürme |
| Lisans sözleşmesi (EULA) | Apple Standart EULA ({EULA}) | açıklamada bağlantı var (3.1.2) |
| Yaş derecelendirmesi | Kullanıcı içeriği VAR (moderasyon + şikâyet + engelleme), sağlık/tıbbi bilgi "seyrek/hafif", reklam yok → uygulama ayrıca **18+** kapısı uygular | |
| Telif (Copyright) | `2026 SEKULART LTD` | L-S1 KURUMSAL_KIMLIK (9 Kas kararı: her yerde "SEKULART LTD") |
| Hesap silme | Uygulama içinde: Profil › Güvenlik › Hesabımı sil | 5.1.1(v) |
| Apple ile Giriş | Var (Google ve e-posta koduyla birlikte) | 4.8 |

### Abonelik ürünleri (ASC › Abonelikler; RevenueCat yetkileri `fresh` / `balance`)
| Ürün kimliği | Görünen ad TR / EN | Süre | TR fiyatı | ABD fiyatı | Tanıtım teklifi | Hak |
|---|---|---|---|---|---|---|
| `kcalai_fresh_monthly` | kcalAI Fresh aylık / kcalAI Fresh Monthly | 1 ay | 199 TL | $5.99 | — | günde 10 AI tarama, barkod + elle sınırsız |
| `kcalai_fresh_yearly` | kcalAI Fresh yıllık / kcalAI Fresh Yearly | 1 yıl | 999 TL | $29.99 | 7 gün ücretsiz | aynı |
| `kcalai_balance_monthly` | kcalAI Balance aylık / kcalAI Balance Monthly | 1 ay | 499 TL | $12.99 | — | günde 50 AI tarama, barkod + elle sınırsız |
| `kcalai_balance_yearly` | kcalAI Balance yıllık / kcalAI Balance Yearly | 1 yıl | 2999 TL | $59.99 | 7 gün ücretsiz | aynı |

Abonelik açıklaması (ASC'de her ürünün "Description" alanı, ≤ 55 karakter):
| Ürün | TR | EN |
|---|---|---|
| Fresh | `Günde 10 AI tarama, barkod ve elle giriş sınırsız` | `10 AI scans a day, unlimited barcode and manual` |
| Balance | `Günde 50 AI tarama, barkod ve elle giriş sınırsız` | `50 AI scans a day, unlimited barcode and manual` |

{as_md('tr')}
{as_md('en')}
## İnceleme notu
`docs/store/INCELEME_NOTU.md`.

## Alternatifler (A/B — rapor §5)
| Alan | TR | EN |
|---|---|---|
| Alt başlık B | `Fotoğrafla Kalori, Makro Takip` (30) | `Calorie Tracker & Real Meals` (28) |
"""

gp_doc = f"""# Google Play Console — mağaza metinleri TR / EN · 1.1.0 (M-S1 md.1)

Paket: `com.kcalmobile.app` · Sürüm adı **1.1.0** (versionCode EAS remote).
Ana mesaj: TR **"Hesabı biz yapıyoruz, sen de görüyorsun."** · EN **"The calorie tracker with a real kitchen behind it."**

{COMMON_NOTE}

## Ortak alanlar
| Alan | Değer | Not |
|---|---|---|
| Uygulama / oyun | Uygulama | |
| Kategori | **Sağlık ve Fitness** | Play tek kategori alır |
| Etiketler | Kalori sayacı, Diyet ve beslenme, Yemek tarifleri | en fazla 5 |
| Ücretsiz / ücretli | Ücretsiz; **uygulama içi ürün VAR** (abonelik) | 1.0.x'teki "dijital satın alma YOK" satırı kaldırıldı |
| İletişim e-postası | `info@eatkcal.com` | L-S1 KURUMSAL_KIMLIK: bugün tek yayındaki adres; ayrı destek adresi açılırsa değiştir |
| Web sitesi | {MKT} | |
| Gizlilik politikası | {PRIV_TR} | Play tek URL alır → TR sayfası; EN sürüm sayfada bağlantılı olmalı ({PRIV_EN}) |
| Hesap silme URL’si | {DEL_TR} | EN: {DEL_EN} |
| Reklam içeriyor | **Hayır** | Meta yalnız ölçüm (rızaya bağlı) |
| Hedef kitle | 18 ve üzeri | |

### Abonelikler (Play Console › Para kazanma › Abonelikler; RevenueCat kimliği `kcalai_fresh:monthly` biçimi)
| Abonelik kimliği | Temel plan | Fiyat TR | Fiyat ABD | Teklif |
|---|---|---|---|---|
| `kcalai_fresh` | `monthly` (otomatik yenilenen, 1 ay) | 199 TL | $5.99 | — |
| `kcalai_fresh` | `yearly` (otomatik yenilenen, 1 yıl) | 999 TL | $29.99 | `default`: 7 gün ücretsiz deneme, yeni aboneler |
| `kcalai_balance` | `monthly` | 499 TL | $12.99 | — |
| `kcalai_balance` | `yearly` | 2999 TL | $59.99 | `default`: 7 gün ücretsiz deneme |

Abonelik avantajları (Play "Avantajlar", her biri ≤ 40 karakter): Fresh `Günde 10 AI tarama` · `Barkod ve elle giriş sınırsız`; Balance `Günde 50 AI tarama` · `Barkod ve elle giriş sınırsız`.

{gp_md('tr')}
{gp_md('en')}
## Grafik öğeler
| Öğe | Ölçü | Dosya |
|---|---|---|
| Uygulama simgesi | 512×512 PNG | `assets/icon.png` kaynağından dışa aktar |
| Öne çıkan görsel | 1024×500 | `docs/store/shots/play/tr/feature.png`, `…/en/feature.png` |
| Telefon ekran görüntüleri | 6 adet, 1080×1920 | `docs/store/shots/play/{{tr,en}}/01–06.png` (EKRAN_GORUNTUSU_PLANI.md) |
"""

if errors:
    print('HATA:\n' + '\n'.join(errors))
    sys.exit(1)
open(os.path.join(OUT, 'APP_STORE_METINLERI.md'), 'w', encoding='utf-8').write(as_doc)
open(os.path.join(OUT, 'GOOGLE_PLAY_METINLERI.md'), 'w', encoding='utf-8').write(gp_doc)
for store, D, LIM in [('AS', AS, LIM_AS), ('GP', GP, LIM_GP)]:
    for lang, d in D.items():
        print(store, lang, {f: len(d[f]) for f in LIM})
