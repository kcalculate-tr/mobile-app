# M-S1 md.1 + M-S2 md.1 — 1.1.0 mağaza metinleri üreticisi (Koç açık, ,99'lu fiyatlar, legal.eatkcal.com).
# Karakter sınırlarını, anahtar kelime tekrarını ve yasak dili denetler; iki markdown yazar.
# Çalıştır: python3 -I docs/store/_uret_metinler.py docs/store
import sys, os

OUT = sys.argv[1]

# Yasal bağlantılar (İlter 11 Kas 16:00): legal.eatkcal.com. EN hesap silme yolu verilmedi → TR sayfası — LOG SORULAR.
LEGAL = 'https://legal.eatkcal.com'
PRIV_TR = LEGAL + '/gizlilik-politikasi'
PRIV_EN = LEGAL + '/en/legal/privacy'
TERMS_TR = LEGAL + '/kullanim-kosullari'
TERMS_EN = LEGAL + '/en/legal/terms'
SUP_TR = LEGAL + '/destek'
SUP_EN = LEGAL + '/en/support'
DEL_TR = LEGAL + '/account-deletion'
DEL_EN = DEL_TR
MKT = 'https://eatkcal.com'
EULA = 'https://www.apple.com/legal/internet-services/itunes/dev/stdeula/'

# ---------- ortak gövde parçaları ----------
INTRO_TR = """KCAL ile tabağının fotoğrafını çek, ne yediğini yaz ya da söyle; kalori ve makrolar saniyeler içinde günlüğünde.

Hesabı biz yapıyoruz, sen de görüyorsun. Her yiyeceğin gramını, kalorisini, proteinini, karbonhidratını ve yağını tek tek gösteriyoruz; yanlış bulduğunu sen düzeltiyorsun."""

INTRO_EN = """Snap a photo of your plate, type or say what you ate, and KCAL puts the calories and macros in your log in seconds.

The calorie tracker with a real kitchen behind it. We show the grams, calories, protein, carbs and fat for every food on your plate, and you can fix anything that looks off."""

FEATURES_TR = """KAYDETMENİN DÖRT YOLU
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
KCAL'in mutfağı eatkcal'da hazırlanan, kalorisi ve makrosu hesaplı öğünleri uygulamadan sipariş et. Teslim edilen öğün günlüğüne kendiliğinden işlenir. Sipariş şu an yalnız İzmir'deki teslimat bölgelerinde geçerli."""

FEATURES_EN = """FOUR WAYS TO LOG
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
Order meals made in eatkcal, KCAL's own kitchen, with calories and macros already worked out. Delivered meals are added to your log automatically. Ordering is available only in İzmir, Türkiye."""

PLANS_TR = """ÜCRETSİZ VE KCALAI PLANLARI
• Ücretsiz: günde 2 AI tarama (fotoğraf ya da ses), günde 5 barkod, elle giriş sınırsız, 3 Koç deneme mesajı.
• kcalAI Fresh: günde 10 AI tarama, 3 Koç deneme mesajı; barkod ve elle giriş sınırsız. Aylık 199,99 TL ya da yıllık 999,99 TL.
• kcalAI Balance: günde 50 AI tarama + kcalAI Koç (günde 30 mesaj); barkod ve elle giriş sınırsız. Aylık 499,99 TL ya da yıllık 2999,99 TL.
• Yıllık planlarda 7 gün ücretsiz deneme; ücret deneme bitince alınır.
Fiyatlar Türkiye içindir; başka ülkelerde mağaza kendi yerel fiyatını gösterir. AI tarama hakları her gece 00.00'da yenilenir."""

PLANS_EN = """FREE AND KCALAI PLANS
• Free: 2 AI scans a day (photo or voice), 5 barcode scans a day, unlimited manual entries, 3 Coach trial messages.
• kcalAI Fresh: 10 AI scans a day, 3 Coach trial messages; unlimited barcode and manual entries. $5.99 a month or $29.99 a year.
• kcalAI Balance: 50 AI scans a day + kcalAI Coach (30 messages a day); unlimited barcode and manual entries. $12.99 a month or $59.99 a year.
• 7-day free trial on yearly plans; you're charged when the trial ends.
Prices in US dollars; the App Store shows your local price. AI scans reset every night at midnight."""

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
• Koç mesajların ve günlük takip özetin yanıt için yapay zekâ sağlayıcımıza (ABD) gider; yalnız ayrıca izin verdiğinde.
• Konumun yalnız eatkcal teslimat adresi için, sen istediğinde kullanılır.
• Ölçüm tercihlerini Profil › Gizlilik'ten yönet; hesabını uygulama içinden sil."""

PRIVACY_AS_EN = """PRIVACY
• No ads in the app, and we don't track you across other apps or websites.
• Your plate photo and note are sent to our AI provider only to make the estimate; we ask for your permission before your first scan.
• Coach messages and your daily tracking summary go to our AI provider (US) for the reply, only after you give separate permission.
• Location is used only for an eatkcal delivery address, when you ask.
• Manage measurement choices in Profile › Privacy, and delete your account from inside the app."""

PRIVACY_GP_TR = """GİZLİLİK
• Uygulamada reklam yok.
• Tabak fotoğrafın ve notun yalnız tahmin için yapay zekâ sağlayıcımıza gönderilir; ilk taramadan önce iznini isteriz.
• Koç mesajların ve günlük takip özetin yanıt için yapay zekâ sağlayıcımıza (ABD) gider; yalnız ayrıca izin verdiğinde.
• Konumun yalnız eatkcal teslimat adresi için, sen istediğinde kullanılır.
• Kullanım ve reklam ölçümünü Profil › Gizlilik'ten istediğin zaman kapat; hesabını uygulama içinden sil."""

PRIVACY_GP_EN = """PRIVACY
• No ads in the app.
• Your plate photo and note are sent to our AI provider only to make the estimate; we ask for your permission before your first scan.
• Coach messages and your daily tracking summary go to our AI provider (US) for the reply, only after you give separate permission.
• Location is used only for an eatkcal delivery address, when you ask.
• Turn usage and ad measurement off anytime in Profile › Privacy, and delete your account from inside the app."""

IMPORTANT_TR = """ÖNEMLİ
KCAL'deki kalori ve besin değerleri ile Koç'un önerileri tahmin ve genel bilgidir; tıbbi tavsiye, teşhis ya da tedavi yerine geçmez. Özel bir sağlık durumun, hamileliğin ya da beslenme bozukluğun varsa bir sağlık uzmanına danış. Uygulama 18 yaş ve üzeri içindir."""

IMPORTANT_EN = """IMPORTANT
Calorie and nutrition values and Coach suggestions in KCAL are estimates and general information; they are not medical advice, diagnosis or treatment. If you have a medical condition, are pregnant or have an eating disorder, talk to a healthcare professional. KCAL is for users 18 and over."""

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
• kcalAI Koç: beslenme ve günlük takip danışmanın. "Akşam ne yesem?" diye sor, kalan kalorine göre öğün önersin; haftanı grafiklerle özetlesin. Balance'ta günde 30 mesaj, Ücretsiz ve Fresh'te 3 deneme mesajı.
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
• kcalAI Coach: your nutrition and daily tracking coach. Ask "What should I have for dinner?" and get meal ideas that fit the calories you have left, plus a weekly summary with charts. 30 messages a day on Balance, 3 trial messages on Free and Fresh.
• kcalAI Fresh and Balance: more AI scans a day; 7-day free trial on yearly plans.
• Calorie, macro and water rings on Home, plus activity, progress and streaks.
• Explore: recipes, meals and comments; add a plate you like to your day.
• eatkcal (İzmir): refreshed ordering.
• Fewer prompts: we ask for each permission only when you use that feature.
• Bug fixes and improvements."""

PLAY_NOTES_TR = """1.1.0: Yeni ad ve tasarım. kcalAI Koç: kalan kalorine göre öğün önerisi ve haftalık özet (Balance'ta günde 30 mesaj, Ücretsiz ve Fresh'te 3 deneme). Sesle ekle (ses kaydı tutulmaz) ve barkod okut. Fotoğrafla tarama yenilendi: gramı ve porsiyonu düzelt. kcalAI Fresh ve Balance planları; yıllıkta 7 gün ücretsiz deneme. Ana sayfada kalori, makro, su halkaları, etkinlik, ilerleme ve seri. Keşfet'te tarif ve öğünler. eatkcal (İzmir) yeni sipariş akışı. İzinler yalnız gerektiğinde. Hata düzeltmeleri."""

PLAY_NOTES_EN = """1.1.0: New name and design. kcalAI Coach: meal ideas for the calories you have left and a weekly summary (30 messages a day on Balance, 3 trials on Free/Fresh). Add by voice (no audio recorded) and scan barcodes. Refreshed photo scan: fix grams and portions. kcalAI Fresh and Balance plans; 7-day free trial on yearly. Calorie, macro and water rings, activity, progress and streaks on Home. Recipes and meals in Explore. Refreshed eatkcal ordering (İzmir). Permissions only when needed. Bug fixes."""

AS = {
    'tr': dict(
        name='KCAL: AI Kalori Hesaplama',
        subtitle='Kalori Sayacı & Fit Yemek',
        promo="Yeni: kcalAI Koç. Kalan kalorine göre ne yiyeceğini sor, öğün önerisi al. Tabağını çek, yaz ya da söyle; kalori ve makrolar saniyeler içinde günlüğünde.",
        keywords='takip,diyet,makro,protein,kilo,yapay,zeka,fotoğraf,barkod,sesli,öğün,besin,tarif,koç,izmir',
        desc=DESC_AS_TR, new=WHATS_NEW_TR,
        support=SUP_TR, privacy=PRIV_TR, marketing=MKT,
    ),
    'en': dict(
        name='KCAL: AI Calorie Counter',
        subtitle='Photo Food Tracker & Macros',
        promo='New: kcalAI Coach. Ask what to eat for the calories you have left and get meal ideas. Snap, type or say what you ate; see calories and macros in seconds.',
        keywords='diet,protein,weight,meal,scanner,barcode,voice,log,nutrition,recipe,coach,healthy,carb,water,fitness',
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
          'cures', 'yakında', 'coming soon', 'uygulama içi satın alma yok', 'no in-app purchase',
          # M-S2: Koç açık; egzersiz rehberi hiç anılmaz; eski yasal alan adı (eatkcal.com/…) kullanılmaz.
          'egzersiz', 'antrenman', 'exercise', 'workout', '//eatkcal.com/gizlilik', '//eatkcal.com/kullanim', '//eatkcal.com/destek',
          '//eatkcal.com/en/', '//eatkcal.com/account']
# Yuvarlak eski fiyat (199 TL, 2999 TL …) yasak: TL fiyatları ,99'lu.
OLD_PRICE = __import__('re').compile(r'(?<![\d,])(199|999|499|2999) TL')

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
        raw = ' '.join(v for v in d.values() if isinstance(v, str))
        if OLD_PRICE.search(raw):
            errors.append(f'{store}/{lang}: ,99 olmayan TL fiyatı: {OLD_PRICE.search(raw).group(0)}')
        coach = 'Koç' if lang == 'tr' else 'Coach'
        for f in ('desc', 'full', 'promo', 'new', 'notes'):
            if f in d and coach not in d[f]:
                errors.append(f'{store}/{lang}/{f}: Koç anılmıyor')
        if lang == 'tr':
            for need in ('Balance', 'günde 50 AI tarama + kcalAI Koç', 'tıbbi tavsiye ya da teşhis vermez', '3 deneme mesajı', 'günde 30 mesaj'):
                if need not in (d.get('desc') or d.get('full')):
                    errors.append(f'{store}/tr: açıklamada yok: {need}')
        else:
            for need in ('50 AI scans a day + kcalAI Coach', "doesn't give medical advice", '3 trial messages', '30 messages a day'):
                if need not in (d.get('desc') or d.get('full')):
                    errors.append(f'{store}/en: description missing: {need}')
for store, D, key in [('AS', AS, 'desc'), ('GP', GP, 'full')]:
    for lang in ('tr', 'en'):
        for need in (TERMS_TR if lang == 'tr' else TERMS_EN, PRIV_TR if lang == 'tr' else PRIV_EN):
            if not need.startswith('https://legal.eatkcal.com/') or need not in D[lang][key]:
                errors.append(f'{store}/{lang}: legal.eatkcal.com bağlantısı yok: {need}')
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

COMMON_NOTE = """> Kaynak: İlter kararları 11 Kas (`.claude/night/M-S1.md`, `.claude/night/M-S2.md`), rakip raporu §5 ASO / §6 paywall (`~/dev/kcal-research/rakip/RAKIP_ANALIZI_v1.md`).
> Bu dosya `docs/store/_uret_metinler.py` ile üretilir (karakter sınırı, anahtar kelime tekrarı, yasak dil, zorunlu bağlantılar denetlenir).
> Elle düzeltme yapma; betikte değiştir ve yeniden üret: `python3 -I docs/store/_uret_metinler.py docs/store`.
> **Yasak dil:** somut kilo vaadi, önce/sonra, tıbbi iddia, "sınırsız AI", "yakında", egzersiz rehberi. ,99'suz TL fiyatı ve eski `eatkcal.com/...` yasal yolları betikte hata verir.
> **M-S2 (İlter 11 Kas 16:00): kcalAI Koç 1.1.0'da AÇIK** (bayrak `koc` + `abonelik`, `coach-chat` yayında) → Balance "günde 50 AI tarama + kcalAI Koç"; açıklamada Koç paragrafı, promosyon ve Yenilikler'de Koç.
> Fiyatlar: Fresh 199,99 TL/ay · 999,99 TL/yıl ($5.99 / $29.99); Balance 499,99 TL/ay · 2999,99 TL/yıl ($12.99 / $59.99). Yasal bağlantılar `https://legal.eatkcal.com/...`."""

as_doc = f"""# App Store Connect — mağaza metinleri TR / EN · 1.1.0 (M-S1 md.1 · M-S2 md.1: Koç açık)

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
| `kcalai_fresh_monthly` | kcalAI Fresh aylık / kcalAI Fresh Monthly | 1 ay | 199,99 TL | $5.99 | — | günde 10 AI tarama, barkod + elle sınırsız, 3 Koç deneme mesajı |
| `kcalai_fresh_yearly` | kcalAI Fresh yıllık / kcalAI Fresh Yearly | 1 yıl | 999,99 TL | $29.99 | 7 gün ücretsiz | aynı |
| `kcalai_balance_monthly` | kcalAI Balance aylık / kcalAI Balance Monthly | 1 ay | 499,99 TL | $12.99 | — | günde 50 AI tarama + kcalAI Koç (günde 30 mesaj), barkod + elle sınırsız |
| `kcalai_balance_yearly` | kcalAI Balance yıllık / kcalAI Balance Yearly | 1 yıl | 2999,99 TL | $59.99 | 7 gün ücretsiz | aynı |

Abonelik açıklaması (ASC'de her ürünün "Description" alanı, ≤ 55 karakter):
| Ürün | TR | EN |
|---|---|---|
| Fresh | `Günde 10 AI tarama, barkod ve elle giriş sınırsız` | `10 AI scans a day, unlimited barcode and manual` |
| Balance | `Günde 50 AI tarama ve kcalAI Koç` | `50 AI scans a day plus kcalAI Coach` |

{as_md('tr')}
{as_md('en')}
## İnceleme notu
`docs/store/INCELEME_NOTU.md`.

## Alternatifler (A/B — rapor §5)
| Alan | TR | EN |
|---|---|---|
| Alt başlık B | `Fotoğrafla Kalori, Makro Takip` (30) | `Calorie Tracker & Real Meals` (28) |
"""

gp_doc = f"""# Google Play Console — mağaza metinleri TR / EN · 1.1.0 (M-S1 md.1 · M-S2 md.1: Koç açık)

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
| `kcalai_fresh` | `monthly` (otomatik yenilenen, 1 ay) | 199,99 TL | $5.99 | — |
| `kcalai_fresh` | `yearly` (otomatik yenilenen, 1 yıl) | 999,99 TL | $29.99 | `default`: 7 gün ücretsiz deneme, yeni aboneler |
| `kcalai_balance` | `monthly` | 499,99 TL | $12.99 | — |
| `kcalai_balance` | `yearly` | 2999,99 TL | $59.99 | `default`: 7 gün ücretsiz deneme |

Abonelik avantajları (Play "Avantajlar", her biri ≤ 40 karakter): Fresh `Günde 10 AI tarama` · `Barkod ve elle giriş sınırsız`; Balance `Günde 50 AI tarama` · `kcalAI Koç: günde 30 mesaj` · `Barkod ve elle giriş sınırsız`. EN: Fresh `10 AI scans a day` · `Unlimited barcode and manual entry`; Balance `50 AI scans a day` · `kcalAI Coach: 30 messages a day` · `Unlimited barcode and manual entry`.

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
