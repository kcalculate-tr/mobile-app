# eatkcal — Ön Bilgilendirme Formu ve Mesafeli Satış Sözleşmesi

> **TASLAK — hukuki inceleme için (İlter Öziseven). Yayımlanmadı.**
> Sürüm: `v0.1-taslak` · Hazırlanma: 2026-11-09 · Yürürlük: `[YÜRÜRLÜK TARİHİ]`
> Kapsam: eatkcal üzerinden (Kcalculate AI uygulamasındaki eatkcal modülü ve eatkcal.com) Türkiye'de tüketicilere verilen yemek siparişleri ile Macro paketi satışları.
> Bu dosyada **iki ayrı belge** vardır: **Bölüm A — Ön Bilgilendirme Formu** (Mesafeli Sözleşmeler Yönetmeliği md.5–6) ve **Bölüm B — Mesafeli Satış Sözleşmesi** (6502 s. TKHK md.48; Yönetmelik md.7, 18). `{{…}}` alanları ödeme adımında siparişe göre otomatik doldurulur.

> **[İnceleme notu — genel]** Mevcut metin (web `mesafeli.ts`, mobil `contractsData.ts` `distance-sales`) Ön Bilgilendirme Formunu ayrı bir belge olarak sunmuyor; web yalnızca "sözleşme ön bilgilendirme niteliği de taşır" diyor, mobilde hiç yok. Yönetmelik md.6 ön bilgilendirmenin sözleşme kurulmadan **önce** yapılmasını ve tüketicinin bunu **ayrıca teyit** etmesini, ispat yükünü de satıcıya yüklüyor. Bu yüzden iki belge ayrı ayrı gösterilip iki ayrı onay kutusuyla kaydedilmeli (bkz. `ENTEGRASYON.md`). Karşılaştırma: `MESAFELI_KARSILASTIRMA.md`.

---

## BÖLÜM A — ÖN BİLGİLENDİRME FORMU

Bu form, siparişiniz kesinleşmeden önce 6502 sayılı Tüketicinin Korunması Hakkında Kanun ve Mesafeli Sözleşmeler Yönetmeliği uyarınca sizi bilgilendirmek için hazırlanmıştır. Siparişi onaylamanız, bu formu okuduğunuzu ve teyit ettiğinizi gösterir.

### A.1 Satıcı

| | |
|---|---|
| Ticaret unvanı | `[TAM UNVAN]` (kısa ad: SEKULART Ltd.) |
| Marka | eatkcal — mutfak markaları: kcal., tera, Breaking Fast |
| MERSİS no | `[MERSİS]` *(mevcut metindeki değer teyit edilmeli)* |
| Vergi dairesi / no | `[VERGİ DAİRESİ]` / `[VKN]` |
| Adres | `[ADRES]` |
| Telefon | `[TELEFON]` |
| E-posta | `[support@…]` |
| KEP adresi | `[KEP]` |
| Şikâyet ve talepler | Uygulama › Destek, `[support@…]`, `[TELEFON]` |

### A.2 Sipariş edilen mal ve hizmetin temel nitelikleri

- **Sipariş no:** {{SIPARIS_NO}}
- **Ürünler:** {{URUNLER}} *(her satırda ürün adı, mutfak markası, porsiyon/gramaj, adet, birim fiyat, bilinen alerjenler, enerji ve makro değerleri)*
- Ürünler, sipariş üzerine hazırlanan, taze ve **çabuk bozulabilen** gıdalardır. Ürün sayfalarındaki kalori ve makro değerleri tariflere dayalı **tahmini** değerlerdir; ±%`[TOLERANS]` sapma olabilir.
- **Alerjen uyarısı:** Mutfaklarımızda gluten, süt, yumurta, kabuklu yemiş, yer fıstığı, susam, soya, balık ve kabuklu deniz ürünleri işlenmektedir; çapraz bulaşma tamamen dışlanamaz.

### A.3 Fiyat ve ödeme

| | |
|---|---|
| Ürünler toplamı (KDV dahil) | {{ARA_TOPLAM_TL}} |
| İndirim / kupon / Macro Coin kullanımı | {{INDIRIM_TL}} |
| Teslimat ücreti | {{TESLIMAT_UCRETI_TL}} |
| **Ödenecek toplam (tüm vergiler dahil)** | **{{TOPLAM_TL}}** |
| Ödeme yöntemi | {{ODEME_YONTEMI}} |

- Ödeme, lisanslı ödeme kuruluşu **N Kolay Ödeme ve Elektronik Para Kuruluşu A.Ş. ("PaynKolay")** altyapısında, PaynKolay'in güvenli ödeme sayfasında alınır. Kart numarası, son kullanma tarihi ve güvenlik kodu Satıcı'nın sistemlerine **girmez ve Satıcı tarafından saklanmaz**. "Kartımı kaydet" seçerseniz kartınız PaynKolay nezdinde jetonlanır; Satıcı yalnızca kartın son dört hanesini, markasını ve bankasını tutar.
- Tutar sipariş onayıyla birlikte tahsil edilir. Ödeme onaylanmadan sipariş hazırlanmaz.
- Siparişiniz için e-arşiv fatura düzenlenir ve kayıtlı e-posta adresinize gönderilir.

### A.4 Teslimat ve ifa

| | |
|---|---|
| Teslimat türü | {{TESLIMAT_TURU}} *(Hemen / Randevulu / Gel-Al)* |
| Tahmini teslim zamanı veya seçilen aralık | {{TESLIMAT_ZAMANI}} |
| Teslimat adresi | {{TESLIMAT_ADRESI}} |
| Hazırlayan mutfak / şube | {{SUBE}} |

- Teslimat yalnızca İzmir'deki hizmet bölgelerine yapılır. Güncel bölgeler ve saatler uygulamada gösterilir. Teslimat saatleri: `[TESLİMAT SAATLERİ]`.
- Teslimat, Satıcı'nın anlaşmalı kurye ortakları aracılığıyla yapılır. **Gel-Al** seçeneğinde sipariş, bildirilen şubeden `[GEL-AL TESLİM SÜRESİ]` içinde teslim alınır.
- Ürünler soğuk zincir koşullarında gönderilir. Teslimden sonra +4 °C / +8 °C arasında buzdolabında saklanmalı ve paket üzerindeki tarihe kadar tüketilmelidir.
- Yasal azami ifa süresi 30 gündür; ancak yemek siparişlerinde teslim, yukarıdaki tahmini zaman veya seçilen aralıkta yapılır.

> **[İnceleme notu]** Teslimat saatleri tutarsız: mevcut sözleşmeler "her gün 09:00–21:00" diyor; web sitesi "Pazartesi–Cumartesi 09:00–21:30, Pazar kapalı" (`web:apps/eatkcal/lib/site.ts:16-17`). Ertesi gün teslim yapılan bölgeler var (`web:apps/eatkcal/lib/delivery.ts:5-10`), Bayraklı şubesi var (`web:apps/eatkcal/lib/site.ts:52`). Saat, bölge ve şube bilgisi sözleşmeye sabit yazılmamalı; uygulamadaki güncel ekrana atıf yapılmalı ve sipariş anındaki değer {{TESLIMAT_ZAMANI}} ile forma basılmalı.

### A.5 Cayma hakkı

- **Yemek siparişleri:** Ürünler çabuk bozulabilen gıdalar olduğundan Mesafeli Sözleşmeler Yönetmeliği **md.15/1-(c)** uyarınca **cayma hakkı yoktur**.
- **Siparişi iptal:** Siparişinizi, mutfak hazırlığa başlamadan önce `[İPTAL PENCERESİ — örn. "Hazırlanıyor" durumuna geçene kadar]` uygulamadan iptal edebilirsiniz; bu durumda ödediğiniz tutar iade edilir. Hazırlık başladıktan sonra iptal edilemez.
- **Macro paketleri:** Bölüm B madde 8.3'e bakın.
- Bu istisnalar, ayıplı ürünlerde Kanun'dan doğan haklarınızı **ortadan kaldırmaz** (A.6).

> **[İnceleme notu]** İptal penceresi işletme kararıdır; tanınmazsa bu madde çıkarılır. Tanınırsa uygulamadaki sipariş durumlarıyla (`orders.status`) eşlenmeli.

### A.6 Ayıplı ürün ve şikâyet

- Teslim edilen ürün ayıplıysa (eksik, yanlış, bozulmuş, hasarlı, sözleşmeye uygun değil) TKHK md.11 uyarınca **bedel iadesi, bedelden indirim, ücretsiz onarım veya ayıpsız misliyle değişim** haklarınızdan birini kullanabilirsiniz.
- Gıda güvenliği ve hızlı çözüm için ayıbı **mümkün olan en kısa sürede** bildirmenizi, mümkünse fotoğraf eklemenizi rica ederiz. Bildirim kanalları: uygulama › Destek, `[support@…]`, `[TELEFON]`.
- Şikâyet ve itirazlarınızı, değeri her yıl Ticaret Bakanlığı'nca ilan edilen parasal sınırlar (`[GÜNCEL YIL SINIRI]`) içinde yerleşim yerinizdeki veya işlemi yaptığınız yerdeki **Tüketici Hakem Heyeti**'ne, bu sınırın üzerinde **Tüketici Mahkemesi**'ne iletebilirsiniz. Başvurular e-Devlet üzerinden **Tüketici Bilgi Sistemi (TÜBİS)** ile de yapılabilir.

### A.7 Teknik adımlar ve kayıt

- Siparişi oluşturmak için: ürünleri sepete ekleyin → adres ve teslimat türünü seçin → bu formu ve Mesafeli Satış Sözleşmesi'ni okuyup onaylayın → PaynKolay ödeme sayfasında ödemeyi tamamlayın.
- Onaydan önce sepetteki ürünleri, adresi ve tutarı düzeltebilirsiniz.
- Bu form ve sözleşme, onay anındaki sürümüyle birlikte kaydedilir; bir kopyası e-posta adresinize ve uygulamadaki sipariş detayına kalıcı olarak gönderilir.
- Sözleşme dili Türkçedir.

### A.8 Kişisel veriler

Siparişinizdeki kişisel veriler KVKK Aydınlatma Metni'ne uygun olarak işlenir: `[LİNK: /legal/kvkk]`.

**Teyit:** ☐ *Ön Bilgilendirme Formu'nu okudum; satıcı, ürün, toplam fiyat, ödeme, teslimat ve cayma hakkı istisnası hakkında bilgilendirildim.* (ayrı onay kutusu; zaman damgası ve belge sürümüyle kaydedilir)

---

## BÖLÜM B — MESAFELİ SATIŞ SÖZLEŞMESİ

### Madde 1 — Taraflar

**1.1 Satıcı:** `[TAM UNVAN]` ("SEKULART Ltd." veya "Satıcı"), MERSİS `[MERSİS]`, VKN `[VKN]`, adres `[ADRES]`, telefon `[TELEFON]`, e-posta `[support@…]`, KEP `[KEP]`.

**1.2 Alıcı:** {{ALICI_AD_SOYAD}}, e-posta {{ALICI_EPOSTA}}, telefon {{ALICI_TELEFON}}, teslimat adresi {{TESLIMAT_ADRESI}} ("Alıcı").

### Madde 2 — Konu

Bu sözleşme, Alıcı'nın eatkcal üzerinden elektronik ortamda sipariş verdiği {{SIPARIS_NO}} numaralı siparişteki ürünlerin satışı ve teslimi (ve varsa Macro paketi alımı) ile ilgili tarafların hak ve yükümlülüklerini, 6502 sayılı Tüketicinin Korunması Hakkında Kanun ve Mesafeli Sözleşmeler Yönetmeliği'ne göre düzenler.

### Madde 3 — Ürünler, fiyat ve ödeme

3.1. Ürünler, adet, birim fiyat ve vergiler dahil toplam tutar: {{URUNLER}} · teslimat ücreti {{TESLIMAT_UCRETI_TL}} · indirim {{INDIRIM_TL}} · **toplam {{TOPLAM_TL}}**.

3.2. Ödeme, PaynKolay ödeme sayfasında {{ODEME_YONTEMI}} ile alınır. Satıcı kart bilgilerini görmez ve saklamaz. Kart kaydetme isteğe bağlıdır ve Alıcı tarafından istendiğinde uygulamadan silinebilir.

3.3. Sipariş anında gösterilen fiyat geçerlidir. Satıcı, kesinleşmiş siparişin fiyatını değiştiremez.

3.4. Kupon ve Macro Coin kullanımı, kampanya koşullarına ve Kullanım Koşulları'na tabidir; kullanılan tutar {{INDIRIM_TL}} satırında gösterilir.

3.5. Alıcı'nın kartının yetkisiz kullanımı halinde 5464 sayılı Banka Kartları ve Kredi Kartları Kanunu hükümleri saklıdır.

3.6. Satıcı her sipariş için e-arşiv fatura düzenler ve Alıcı'nın e-posta adresine gönderir.

### Madde 4 — Teslimat

4.1. Ürünler, Alıcı'nın seçtiği teslimat türüne (Hemen / Randevulu / Gel-Al) göre {{TESLIMAT_ZAMANI}} içinde, {{TESLIMAT_ADRESI}} adresine veya Gel-Al'da {{SUBE}} şubesinde teslim edilir. Teslimat bölgeleri ve saatleri (`[TESLİMAT SAATLERİ]`) uygulamada gösterilir.

4.2. Teslimat, Satıcı'nın anlaşmalı kurye ortakları ile yapılır. Teslimat ücreti varsa Alıcı'ya aittir ve ön bilgilendirmede gösterilmiştir.

4.3. Alıcı'ya ulaşılamaması veya adresin hatalı olması halinde kurye Alıcı'yı telefonla arar. Teslim edilemeyen ürün `[TESLİM EDİLEMEYEN SİPARİŞ USULÜ — örn. aynı gün 21:00'e kadar şubeden teslim alınabilir]`. Teslim edilemeyen gıdanın bozulabilir niteliği nedeniyle Satıcı'nın kusurundan kaynaklanmayan durumlarda bedel iadesi yapılmaz.

4.4. Satıcı, mücbir sebepler veya hizmet bölgesi dışında kalma gibi nedenlerle siparişi ifa edemeyecekse, durumu öğrendiği tarihten itibaren 3 gün içinde Alıcı'ya bildirir ve tahsil edilen tüm tutarı **14 gün içinde** iade eder (Yönetmelik md.16 — teyit).

4.5. Teslimden sonra ürünler +4 °C / +8 °C arasında saklanmalıdır. Saklama koşullarına uyulmamasından doğan bozulmalardan Satıcı sorumlu değildir; bu, teslim anında var olan ayıplara ilişkin hakları etkilemez.

> **[İnceleme notu]** Mobil metinde 4.3'e karşılık gelen "Gel-Al / teslim edilemeyen sipariş" maddesi (mobil M7) var; teslim edilemeyen siparişte "bedel iadesi yok" hükmü, satıcı kusuru dışındaki hallerle sınırlandırıldı.

### Madde 5 — Satıcının yükümlülükleri

5.1. Satıcı, ürünleri ön bilgilendirmede belirtilen niteliklere uygun, sağlam, gıda mevzuatına uygun hazırlamak ve teslim etmekle yükümlüdür.

5.2. Satıcı, ifanın imkânsızlaştığı hallerde 4.4'e göre hareket eder.

5.3. Satıcı, ön bilgilendirme teyidi, sözleşme onayı ve sipariş kayıtlarını **en az 3 yıl** saklar (Yönetmelik md.18/… — teyit).

### Madde 6 — Alıcının yükümlülükleri

6.1. Alıcı, adres, telefon ve teslimat bilgilerini doğru vermekle yükümlüdür.

6.2. Alıcı, alerji ve beslenme kısıtlarına ilişkin ürün bilgilerini sipariş öncesinde kontrol etmelidir.

### Madde 7 — Cayma hakkı ve istisnaları

7.1. **Yemek siparişleri:** Sipariş konusu ürünler çabuk bozulabilen ve kısa sürede son kullanma tarihi geçebilecek gıdalar olduğundan, Mesafeli Sözleşmeler Yönetmeliği **md.15/1-(c)** uyarınca bu siparişlerde **cayma hakkı kullanılamaz**. Alıcı, ürünün Alıcı'nın talebiyle kişiye özel hazırlandığı hallerde (örn. özel makro dağılımlı menü) **md.15/1-(b)** istisnasının da uygulanacağını kabul eder.

7.2. **Hazırlıktan önce iptal:** Alıcı, sipariş `[İPTAL PENCERESİ]` aşamasına geçmeden uygulama üzerinden iptal edebilir; bu durumda tahsil edilen tutar 14 gün içinde ödeme aracına iade edilir.

7.3. Bu madde, Madde 9'daki ayıplı ürün haklarını sınırlamaz.

> **[İnceleme notu]** Mevcut metin istisnayı "6502 sayılı TKHK madde 15/1-(b) ve (c)" diye gösteriyor ve harfleri karıştırıyor ((b)'yi "finansal piyasa dalgalanması", (c)'yi "kişisel ihtiyaçlar" diye veriyor; çabuk bozulan mallar "Ek olarak" geçiyor) (`web:apps/eatkcal/content/legal/mesafeli.ts:134-146`). İstisnalar Kanun'da değil, Kanun md.48'e dayanan **Yönetmelik md.15/1**'dedir. Bilinen sıralama: (a) finansal piyasa dalgalanması, (b) kişisel ihtiyaçlara göre hazırlanan mallar, (c) çabuk bozulabilen / son kullanma tarihi geçebilecek mallar, (ç) hijyen nedeniyle iadesi uygun olmayan ambalajı açılmış mallar … (f) belirli tarih/dönemde yapılması gereken yiyecek-içecek tedariki … (ğ) cayma süresi bitmeden tüketicinin onayıyla ifasına başlanan hizmetler. **Harf sırası 2022 değişikliği sonrası güncel konsolide metinden teyit edilmeli.** "Ürünlerin tamamı kişiye özel" ifadesi, standart menü ürünleri için gerçeğe aykırı olabilir; asıl dayanak (c) olmalı.

### Madde 8 — Macro paketleri ve Macro Coin

8.1. Macro paketi, önceden ödenen ve belirli süre içinde siparişlerde kullanılabilen bir bakiye/hizmet paketidir. Paket içeriği, süresi ve fiyatı satın alma ekranında gösterilir.

8.2. Süresi biten bakiyeler `[SÜRE SONU KURALI]` uyarınca sona erer; Alıcı'ya süre bitiminden en az `[N]` gün önce bildirim yapılır.

8.3. **Cayma:** Alıcı, Macro paketini satın aldığı tarihten itibaren **14 gün içinde**, paketten **hiç yararlanmamışsa** gerekçe göstermeden cayabilir; tahsil edilen tutar 14 gün içinde iade edilir. Alıcı, paketi satın alırken paketin hemen kullanıma açılmasını açıkça talep eder ve cayma süresi içinde paketten yararlanmaya başlarsa, yararlandığı kısım için cayma hakkı Yönetmelik **md.15/1-(ğ)** uyarınca sona erer; kullanılmayan kısmın iadesi `[KISMİ İADE KURALI]` uyarınca yapılır.

> **[İnceleme notu]** Mevcut metin "kullanılmasa dahi iade yapılmaz" diyor (`web:apps/eatkcal/content/legal/mesafeli.ts:158-166`; mobil M8.2/11.3). Macro paketi mal değil, ön ödemeli bakiye/hizmet niteliğinde; diyetisyen görüşmesi gibi kişisel hizmetler içeriyorsa (ğ) ancak tüketicinin **onayıyla ifaya başlanmışsa** uygulanır. Hiç kullanılmamış paket için iade reddi TKHK md.5 kapsamında **haksız şart** sayılabilir ve md.15 istisnasıyla savunulması zor. İşletmenin kısmi iade isteyip istemediği karara bağlanmalı. Yönetmelik md.15/1-(ğ) için ayrıca "tüketicinin onayı" ayrı bir onay kutusuyla kaydedilmeli.

### Madde 9 — Ayıplı ürün

9.1. Teslim edilen ürün ayıplıysa Alıcı, TKHK md.11 uyarınca seçimlik haklarından birini kullanabilir: (a) sözleşmeden dönme (bedel iadesi), (b) bedelden indirim, (c) ücretsiz onarım, (ç) ayıpsız misliyle değiştirme. Gıdanın niteliği gereği onarım çoğu durumda mümkün değildir.

9.2. Gıda güvenliği ve hızlı çözüm için Alıcı'nın ayıbı **fark ettiği anda** bildirmesi ve mümkünse ürünün fotoğrafını eklemesi rica olunur. Bildirim, uygulama › Destek, `[support@…]` veya `[TELEFON]` üzerinden yapılabilir. Bu rica, Kanun'daki sürelere ilişkin hakları sınırlamaz.

9.3. Satıcı, talebi en geç `[DEĞERLENDİRME SÜRESİ — örn. 2 iş günü]` içinde yanıtlar. İade, kararın Alıcı'ya bildirildiği tarihten itibaren **14 gün içinde** ödeme aracına yapılır; bankaya yansıma süresi bankanın usulüne bağlıdır.

9.4. Kısmi ayıpta, Alıcı ayıplı kısım için bedel iadesi veya indirimi isteyebilir.

> **[İnceleme notu]** Mevcut metin ayıp bildirimi için "teslimden itibaren en geç 2 saat, kesin ve uzatılamaz", "yalnız uygulama içinden, telefon/e-posta geçersiz", "görselsiz talep işleme alınmaz" koşullarını hak düşürücü olarak koyuyor (`web:apps/eatkcal/content/legal/mesafeli.ts:180-189`; mobil terms M10.3). TKHK md.8–12 (ayıplı mal ve seçimlik haklar) ve md.5 (haksız şartlar) bakımından, tüketici aleyhine kısaltılamayan süreler ve ispat kuralları bakımından bu koşulların geçersiz/haksız şart sayılma riski yüksek. Taslak bunları **rica** olarak yeniden yazdı. Mobil metindeki 9.2 ve 9.4 listeleri boş kalmış (tablo kaybı).

### Madde 10 — Kişisel veriler

Sipariş için verilen kişisel veriler, Satıcı'nın KVKK Aydınlatma Metni'ne (`[LİNK]`) uygun olarak işlenir. Teslimat için ad, adres ve telefon kurye ortağıyla, siparişin hazırlanması için sipariş içeriği mutfak/şube ve sipariş yönetim sistemi (Adisyo) ile paylaşılır.

### Madde 11 — Uyuşmazlıklar

11.1. Bu sözleşmeye Türk hukuku uygulanır.

11.2. Alıcı, şikâyet ve itirazlarını Ticaret Bakanlığı'nca her yıl belirlenen parasal sınırlar (`[GÜNCEL YIL SINIRI]`) dahilinde **Alıcı'nın yerleşim yerindeki veya işlemin yapıldığı yerdeki** Tüketici Hakem Heyeti'ne, bu sınırları aşan uyuşmazlıklarda **Alıcı'nın yerleşim yerindeki veya işlemin yapıldığı yerdeki** Tüketici Mahkemesi'ne (TKHK md.73) başvurabilir. Başvurular TÜBİS (e-Devlet) üzerinden de yapılabilir.

> **[İnceleme notu]** Mevcut metin yetkiyi yalnız "İzmir Merkez Tüketici Mahkemeleri"ne veriyor (`web:apps/eatkcal/content/legal/mesafeli.ts:284`). TKHK md.73/5 tüketicinin kendi yerleşim yerinde dava açma hakkını tanıyor; tek yer yetkisi tüketici aleyhine uygulanamaz.

### Madde 12 — Delil ve yürürlük

12.1. Taraflar, uyuşmazlıklarda Satıcı'nın elektronik kayıtlarının HMK md.193 çerçevesinde delil olabileceğini kabul eder; bu hüküm Alıcı'nın karşı delil sunma hakkını sınırlamaz.

12.2. Alıcı, Ön Bilgilendirme Formu'nu ve bu sözleşmeyi elektronik ortamda onayladığında sözleşme kurulur. Onay; belge sürümü, tarih-saat, sipariş no ve hesap kimliğiyle kaydedilir. Sözleşmenin bir kopyası Alıcı'nın e-posta adresine ve uygulamadaki sipariş detayına kalıcı veri saklayıcısı olarak iletilir (Yönetmelik md.7).

**Onay:** ☐ *Mesafeli Satış Sözleşmesi'ni okudum ve kabul ediyorum.* (Ön Bilgilendirme teyidinden ayrı kutu; Macro paketinde ayrıca ☐ *Paketin hemen kullanıma açılmasını talep ediyorum; yararlandığım kısım için cayma hakkımın sona ereceğini biliyorum.*)

**Satıcı:** `[TAM UNVAN]` · **Alıcı:** {{ALICI_AD_SOYAD}} · **Tarih:** {{ONAY_TARIHI}} · **Belge sürümü:** {{BELGE_SURUMU}}
