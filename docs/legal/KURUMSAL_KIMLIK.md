# Kurumsal Kimlik ve Yasal Ad Kullanım Standardı — TASLAK

> **Durum:** TASLAK · hukuki inceleme için (İlter Öziseven) · yayın yok · 2026-11-09 · dal `legal/global`
> Mevzuat atıfları teyit edilmelidir. Yer tutucular köşeli parantez içindedir.
> **Karar (İlter, 9 Kas 2026):** şirket adı her yerde, TR ve EN metinlerde aynı biçimde yalnız **SEKULART LTD** yazılır. MERSİS, VKN ve adres mevcut yayındaki metinden (`web:apps/eatkcal/content/legal/mesafeli.ts`) alındı. Vergi dairesi ve KEP mevcut metinlerde olmadığı için eklenmedi (`BOSLUKLAR.md` B-20).

## 1. Tüzel kişi kimlik kartı (tek kaynak)

Bu blok tüm metinlerde **tek kaynaktan** üretilmelidir (bkz. `ENTEGRASYON.md` §3 `company_identity`). Bugün kimlik bilgisi en az beş yerde elle tekrar ediyor ve birbirini tutmuyor (`src/data/contractsData.ts`, `web:apps/eatkcal/lib/site.ts:5-14`, `web:apps/kcalculate/lib/site.ts:7-8`, `web:apps/eatkcal/content/legal/*.ts`, `landing-page/*.html`).

| Alan | Değer | Mevcut kaynakta görülen | Not |
|---|---|---|---|
| Şirket adı (tüm metinler, TR + EN) | **SEKULART LTD** | Eski metinlerde uzun unvan biçimleri (`web:apps/eatkcal/content/legal/gizlilik.ts:14-20`) | Karar 9 Kas 2026: kısa ad = metinlerde kullanılan ad; başka biçim ("Ltd.", "Ltd. Şti.", uzun unvan) yazılmaz |
| MERSİS no | 0759-1148-7410-0001 | web + mobil metinler (`mesafeli.ts`) | |
| VKN | 7591148741 | web, landing (`mesafeli.ts`) | Vergi dairesi mevcut metinlerde yok — eklenmedi |
| Ticaret sicil müdürlüğü / no | `[SİCİL MÜDÜRLÜĞÜ]` / `[TİCARET SİCİL NO]` | **yok** | ETK künyesi ve TTK belge kuralı için gerekli |
| Merkez adresi | Basın Sitesi Mah. 177/3 Sk. No:3A, 35150 Karabağlar / İzmir | `mesafeli.ts` | Posta kodu bazı yerlerde eksik — bu biçim tek biçimdir; EN metinlerde sonuna ", Türkiye" |
| Telefon | `[TELEFON]` | "0232 332 21 00" / "+90 (232) 33 22 100" / "0232 33 22 100" | Tek biçim: **+90 232 332 21 00** |
| DUNS | `[DUNS]` | 751169177 (yalnız `landing-page/`) | Mağaza hesapları için; tüketici metinlerinde gerekmez |
| Web | eatkcal.com · kcalculate.ai | | |
| E-posta | §4 | yalnız info@eatkcal.com | |

> **[İnceleme notu]** KEP adresi taslaklara eklenmedi (mevcut metinlerde yok). Ltd. şirketler için KEP zorunluluğu (TTK md.18/3, Tebliğ) ayrıca teyit edilmeli; adres alınırsa kimlik bloklarına geri eklenir (`BOSLUKLAR.md` B-20). İngilizce metinlerde istenirse ada açıklama eklenebilir: "(a limited liability company incorporated in Türkiye)".

## 2. Yasal ad kullanım kuralı

### 2.1 Tam unvan + künye ZORUNLU olan yerler

| Yer | Asgari içerik | Dayanak (teyit) |
|---|---|---|
| Fatura / e-arşiv fatura | Tam unvan, adres, vergi dairesi, VKN; (MERSİS, web sitesi) | VUK md.230; TTK md.39/2 |
| Ticari yazışma, sözleşme, teklif, sipariş onayı, işlem e-postaları | Tam unvan, ticaret sicil no, MERSİS no, merkez adresi, web sitesi | TTK md.39/2 (tacirin işletmesiyle ilgili tüm kâğıt ve belgeleri) |
| Web sitesi e-ticaret künyesi (eatkcal.com; satış yapılan her site) | Tam unvan, MERSİS, merkez adresi, telefon, e-posta, KEP; (meslek odası) | 6563 s. ETK md.3; *Elektronik Ticarette Hizmet Sağlayıcı ve Aracı Hizmet Sağlayıcılar Hakkında Yönetmelik* |
| Ön Bilgilendirme Formu ve Mesafeli Satış Sözleşmesi | Satıcının unvanı, MERSİS, açık adresi, telefonu, e-postası (KEP) | *Mesafeli Sözleşmeler Yönetmeliği* md.5 ve md.18 |
| KVKK Aydınlatma Metni, Gizlilik Politikası, açık rıza metinleri | Veri sorumlusunun kimliği (tam unvan, adres, iletişim, KEP); VERBİS kaydı varsa bilgisi | KVKK md.10; Aydınlatma Tebliği md.4 |
| Kullanım Koşulları (taraf tanımı) | Tam unvan, MERSİS, adres | Sözleşme tarafının belirliliği |
| GDPR metinleri (kcalculate.ai) | Veri sorumlusu kimliği, iletişim, AB temsilcisi | GDPR Art.13(1)(a), Art.27 |
| Mağaza satıcı bilgisi (App Store "Seller", Google Play geliştirici profili) | Tescilli unvan (DUNS ile eşleşen), AB'de tüccar (trader) bilgisi: adres, telefon, e-posta | Apple/Google politikaları; DSA md.30 tüccar izlenebilirliği |
| Ambalaj / gıda etiketi | Gıda işletmecisinin adı/unvanı ve adresi, işletme kayıt/onay no | Türk Gıda Kodeksi Etiketleme ve Tüketiciyi Bilgilendirme Yönetmeliği |
| Resmî başvurular (KVK Kurulu, Ticaret Bakanlığı, mahkeme) | Tam unvan, MERSİS, VKN, adres, KEP | İlgili usul mevzuatı |

### 2.2 "SEKULART LTD" yazım kuralı

- §2.1'deki tüm yerlerde (fatura, sözleşme, künye, aydınlatma, mağaza satıcı bilgisi) ve iç belgelerde şirket adı **SEKULART LTD** olarak yazılır; TR ve EN aynıdır.
- Metinde ad **bir kez** kimlik bloğuyla tanımlandıktan sonra akış içinde kısa atıf kullanılabilir. Örnek: *"SEKULART LTD ("SEKULART" veya "biz")"* — sonra "SEKULART".
- Uygulama içi kısa telif satırı (§3.1), basın bülteni / sosyal medya biyografisi ("Kcalculate AI, SEKULART LTD tarafından geliştirilir").

### 2.3 Marka adları (kimlik yerine geçmez)

- "KCAL", "Kcalculate AI", "eatkcal", "kcal.", "tera", "Breaking Fast" **veri sorumlusu, satıcı veya sözleşme tarafı olarak yazılmaz**.
- Bugünkü metinlerdeki "Ticari Marka: KCAL" satırı ve "("KCAL")" tanımı kaldırılmalı.
- Doğru kalıp: "eatkcal, SEKULART'ın işlettiği sipariş platformudur."

## 3. Alt bilgi (footer) standardı

### 3.1 Mobil uygulama (Kcalculate AI; eatkcal modülü dahil)

- **Profil › Hakkında / Sözleşmeler ekranı altı (TR):**
  > Kcalculate AI ve eatkcal, SEKULART LTD tarafından işletilir. MERSİS 0759-1148-7410-0001 · Basın Sitesi Mah. 177/3 Sk. No:3A, 35150 Karabağlar / İzmir · `[privacy@kcalculate.ai]` · Sürüm {{APP_VERSION}}
- **EN:**
  > Kcalculate AI and eatkcal are operated by SEKULART LTD, Türkiye. Basın Sitesi Mah. 177/3 Sk. No:3A, 35150 Karabağlar / İzmir, Türkiye · `[privacy@kcalculate.ai]` · Version {{APP_VERSION}}
- **Ödeme / sipariş özeti ekranı:** satıcı satırı:
  > "Satıcı: SEKULART LTD · Ön Bilgilendirme Formu · Mesafeli Satış Sözleşmesi"
- **Paylaşım kartları / ekran görselleri** (`src/components/share/*`): yalnız marka ve alan adı (`l.eatkcal.com`). Unvan gerekmez.

### 3.2 Web — eatkcal.com (satış sitesi: tam künye)

```
© {{YIL}} SEKULART LTD
Basın Sitesi Mah. 177/3 Sk. No:3A, 35150 Karabağlar / İzmir · MERSİS 0759-1148-7410-0001 · VKN 7591148741 · [TİCARET SİCİL MÜDÜRLÜĞÜ] Sicil No [NO]
Tel +90 232 332 21 00 · [support@eatkcal.com]
Gizlilik Politikası · KVKK Aydınlatma · Çerez Politikası · Çerez ayarları · Kullanım Koşulları
Mesafeli Satış Sözleşmesi · Ön Bilgilendirme Formu · Hesap Silme · Veri Sahibi Başvurusu
kcal., tera ve Breaking Fast, SEKULART mutfak markalarıdır.
```

**Bugünkü footer'da eksik olanlar:** Çerez Politikası, Hesap Silme, Ön Bilgilendirme, Başvuru bağlantıları; MERSİS, sicil (`web:apps/eatkcal/components/site.tsx:31-75`). KEP mevcut metinlerde yok (eklenmedi).

### 3.3 Web — kcalculate.ai (global, EN birincil)

```
© {{YEAR}} SEKULART LTD, a company incorporated in Türkiye.
Basın Sitesi Mah. 177/3 Sk. No:3A, 35150 Karabağlar / İzmir, Türkiye · [privacy@kcalculate.ai] · EU representative: [AB TEMSİLCİSİ] · UK representative: [UK TEMSİLCİSİ]
Privacy · Terms · Community Guidelines · Cookies · Cookie settings · Delete account · Your privacy choices (US)
```

"Your privacy choices" / "Do Not Sell or Share" bağlantısı yalnız ABD kullanıcılarına Meta ölçümü açılırsa gerekir (`BOSLUKLAR.md` B-17).

### 3.4 E-posta

| Tür | Gönderen | Alt bilgi |
|---|---|---|
| İşlem (sipariş, hesap, OTP, destek yanıtı) | `noreply@eatkcal.com` / `noreply@kcalculate.ai` — **yanıt adresi** `support@…` | Tam unvan, adres, MERSİS, web; "Bu e-posta hesabın/siparişinle ilgili bilgilendirmedir." Pazarlama içeriği **eklenmez** |
| Pazarlama / bülten | `hello@…` `[ÖNERİ]` | İşlem alt bilgisi + **tek tıkla ret bağlantısı** + "İYS üzerinden de ret hakkını kullanabilirsin" + onayın alındığı kanal/tarih (ETK md.6; Yönetmelik) |
| Şube iç bildirimi (order-alert) | `noreply@…` | "İç kullanım — kişisel veri içerir, iletme." Alıcı kurumsal adres olmalı (bugün kişisel Gmail yedeği var: `supabase/functions/order-alert/index.ts:13`) |
| Veri sahibi başvuru yanıtları | `privacy@…` | SEKULART LTD, adres, başvuru no |

**Kural:** `noreply@` hiçbir metinde başvuru veya iletişim adresi olarak gösterilmez. Bugün gösteriliyor: `landing-page/privacy.html:95`.

### 3.5 Fatura (e-arşiv / e-fatura)

- **Zorunlu:** SEKULART LTD, merkez adresi, vergi dairesi, VKN (vergi dairesi adı mevcut metinlerde yok — fatura sisteminden alınır).
- **Önerilen:** MERSİS, web sitesi, ticaret sicil no.
- **Satıcı satırı:** marka ("eatkcal", "kcal.") ancak unvanın **yanında** gösterilebilir. Örnek:
  > SEKULART LTD (eatkcal)
- Fatura PDF alt bilgisinde KVKK aydınlatma bağlantısı (kısa URL) önerilir.

## 4. İletişim adresleri önerisi

| Adres | Amaç | Hangi metinlerde | Yönlendirme / sorumlu |
|---|---|---|---|
| `privacy@kcalculate.ai` | KVKK md.11 / GDPR / ABD gizlilik talepleri, rıza geri alma, veri ihlali iletişimi | Gizlilik Politikası, KVKK Aydınlatma, rıza metinleri, başvuru formu, uygulama footer | Gizlilik sorumlusu `[AD/UNVAN]`; talep kayıt sistemi |
| `privacy@eatkcal.com` | Aynı (TR müşteri alışkanlığı için takma ad) | eatkcal metinleri | → privacy@kcalculate.ai |
| `legal@kcalculate.ai` | Hukuki tebligat dışı yazışma, fikri mülkiyet bildirimi, resmî makam yazıları, DSA md.11 iletişim noktası | Kullanım Koşulları, Topluluk Kuralları, künye | Hukuk |
| `support@eatkcal.com` | Sipariş, teslimat, ayıp, iade | Mesafeli Satış, Ön Bilgilendirme, uygulama destek | Müşteri hizmetleri |
| `support@kcalculate.ai` | Uygulama desteği | kcalculate.ai, mağaza listeleri (destek URL'si) | Müşteri hizmetleri |
| `report@kcalculate.ai` `[ÖNERİ]` | Hukuka aykırı içerik bildirimi (DSA md.16, 5651), kayıtlı olmayanlar için | Topluluk Kuralları, web bildirim formu | Moderasyon |
| `security@kcalculate.ai` | Güvenlik açığı bildirimi (`/.well-known/security.txt`) | web | Teknik lider |
| `info@eatkcal.com` | Genel (mevcut; 27 yerde geçiyor) | Geçiş döneminde korunur | → ilgili kutu |
| `[AB TEMSİLCİSİ]` / `[UK REPRESENTATIVE]` | GDPR Art.27 / DSA md.13 | kcalculate.ai Gizlilik | Temsilci firma |

> **[İnceleme notu]** KVKK başvuru yöntemi olarak e-posta, Başvuru Tebliği md.5'e göre "ilgili kişi tarafından veri sorumlusuna daha önce bildirilen ve veri sorumlusunun sisteminde kayıtlı bulunan elektronik posta adresi" üzerinden kabul edilir. Kayıtlı olmayan adresten gelen başvuru için kimlik doğrulama adımı gerekir (`tr/08`).

## 5. Marka mimarisi

| Ad | Tür | Pazar / dil | Alan adı / kanal | Ne için kullanılır | Yasal metinlerde rolü | Tescil durumu |
|---|---|---|---|---|---|---|
| **SEKULART LTD** ("SEKULART") | Tüzel kişi (şemsiye) | TR (merkez), global sözleşme tarafı | — | Sözleşme tarafı, veri sorumlusu, satıcı, fatura | **Tek taraf** | Ticaret sicili `[NO]` |
| **Kcalculate AI** | Ürün markası — mobil uygulama (kalori/makro takibi, AI tabak tarama, Keşfet) | Global, EN + TR | kcalculate.ai · App Store / Google Play | Uygulama adı, mağaza listesi, kcalculate.ai | "Uygulama"; işleten SEKULART | `[TÜRKPATENT / WIPO Madrid / EUIPO — başvuru no]` |
| **eatkcal** | Hizmet markası — sipariş platformu / restoran (İzmir) | TR (İzmir), TR + EN arayüz | eatkcal.com · l.eatkcal.com · uygulama içi eatkcal modülü · Trendyol Go vb. pazaryerleri | Sipariş, teslimat, web satış | "Platform"; satıcı SEKULART | `[NO]` |
| **kcal.** | Yemek (mutfak) markası | TR | eatkcal üzerinde | Ürün/menü markası, ambalaj | Üründe marka; üretici/satıcı SEKULART | `[NO]` — "kcal" tanımlayıcı terim; ayırt edicilik riski |
| **tera** | Yemek markası | TR | eatkcal üzerinde | Ürün/menü markası | Aynı | `[NO]` |
| **Breaking Fast** | Yemek markası | TR | eatkcal üzerinde | Ürün/menü markası | Aynı | `[NO]` |
| **KCAL** (eski) | Eski ticari marka adı | TR | eski metinler, `kcal://` şeması | Geçiş döneminde | **Kullanımdan kaldırılacak** (metinlerde "Ticari Marka: KCAL") | `[NO]` |
| Macro Coin / Makro paketleri | Uygulama içi ön ödemeli birim (marka değil) | TR | uygulama | Ödül/ön ödeme | Mesafeli Satış + Kullanım Koşulları'nda tanımlı terim | — |

**Yazım kuralları:**
- "Kcalculate AI" (iki kelime, AI büyük).
- "eatkcal" (her zaman küçük harf, cümle başında da).
- "kcal." (noktalı, küçük).
- "tera" (küçük).
- "Breaking Fast" (iki kelime, baş harfler büyük).

**Mimari tercih:** Kcalculate AI ve eatkcal **kardeş markalar** (ürün markası + hizmet markası). Mutfak markaları eatkcal altında **ürün markaları**. Web'deki "Sipariş yalnız Kcalculate mutfaklarından" (`web:apps/eatkcal/lib/dict.ts:9`) ifadesi iki markayı karıştırıyor. Öneri: "Sipariş yalnız SEKULART mutfaklarından (kcal., tera, Breaking Fast)".

> **[İnceleme notu]** S1 ayrışma planı (`docs/night/S1-TRACKING_SCHEMA.md`) Kcalculate AI'nin ileride ayrı bir şirkete taşınabileceğini öngörüyor. O durumda §1 kimlik kartı marka başına ayrılır. Gizlilik politikası, VERBİS, standart sözleşmeler ve mağaza satıcı hesabı (App Store hesap devri) yeniden yapılır. Bu yüzden metinlerde veri sorumlusu bloğu **değişken** olarak tutulmalı (`ENTEGRASYON.md` §3).
