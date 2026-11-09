# Açık Rıza Metinleri

> **TASLAK — hukuki inceleme için (İlter Öziseven). Yayımlanmadı.**
> Sürüm: `v0.1-taslak` · Taslak tarihi: 2026-11-09 · Yürürlük: `[YÜRÜRLÜK TARİHİ]`
> Veri sorumlusu: SEKULART LTD · Basın Sitesi Mah. 177/3 Sk. No:3A, 35150 Karabağlar / İzmir · `[privacy@…]`

## Ortak ilkeler

- **Dört rıza birbirinden ayrıdır.** Her biri tek başına verilir, tek başına reddedilir ve tek başına geri alınır. Toplu "hepsini kabul et" kutusu kullanılmaz.
- Onay kutuları **varsayılan olarak boştur**.
- Rızalar aydınlatma metninden (`02-kvkk-aydinlatma-metni.md`) ve sözleşme kabulünden ayrı sunulur.
- Rızayı vermemek, aşağıda açıkça yazılanlar dışında hiçbir hizmeti engellemez.
- Rızayı geri almak ücretsizdir ve vermek kadar kolaydır. Geri alma, o tarihe kadar yapılan işlemenin hukuka uygunluğunu etkilemez.
- **Kayıt:** Her rıza için metnin kimliği ve sürümü, verildiği/geri alındığı zaman (UTC), kanal (uygulama/web), cihaz platformu (iOS/Android/web) ve uygulama sürümü kaydedilir. Bu kayıt, rıza geri alındıktan sonra ispat amacıyla **3 yıl** saklanır.

> **[İnceleme notu]** Kurul, açık rızanın ürün veya hizmet şartına bağlanmamasını ister. Bu metinlerde yalnız sağlık verisi rızası bir işlevin ön koşuludur. Gerekçe: kalori takibi bu veri olmadan teknik olarak çalışmaz ve md.6/3'te başka bir uygun dayanak yoktur. eatkcal siparişi ve diğer özellikler rıza olmadan çalışır. Bu ayrımın Kurul uygulamasıyla uyumu değerlendirilmeli.

---

## 1. Sağlık Verisinin İşlenmesine İlişkin Açık Rıza

**Ne için?** Kcalculate AI'da kişisel kalori ve makro hedefinizi hesaplamak, öğünlerinizi ve ilerlemenizi takip etmek ve fotoğraftan besin tahmini yapmak için.

**Hangi veriler?**
- cinsiyet, yaş, boy, kilo, hedef kilo/hedef, aktivite düzeyi;
- bel, kalça ve göğüs ölçüleri ile ölçüm geçmişi;
- öğün, kalori ve makro kayıtları, su ve etkinlik kayıtları;
- AI tabak tarama fotoğrafları, isteğe bağlı notunuz ve tahmin sonuçları.

**Kimlere aktarılır?**
- **Supabase Inc.:** veri barındırma, AB'de barındırma.
- **Anthropic PBC (ABD):** yalnız AI tabak taramada. Fotoğraf ve notunuz gönderilir; adınız, e-postanız ve kullanıcı kimliğiniz gönderilmez.
- Bu aktarımlar için KVKK md.9 uyarınca standart sözleşme güvencesi uygulanır.
- Sağlık verileriniz **reklam amacıyla kullanılmaz ve Meta'ya gönderilmez**.

**Paylaşım:** Öğün veya etkinlik kartını gönderi ya da 24 saatlik gün kartı olarak paylaşmayı seçerseniz, o içerik seçtiğiniz kitleye (takipçileriniz veya herkes) görünür. Bu paylaşım her seferinde sizin ayrı tercihinizle yapılır.

**Ne kadar süre?**
- Hesabınız açık olduğu ve rızanız sürdüğü müddetçe saklanır.
- Rızanızı geri aldığınızda veya hesabınızı sildiğinizde **30 gün** içinde imha edilir.
- AI tarama fotoğrafları analizden sonra en geç 30 gün içinde silinir.

**Rıza vermezseniz:** Kalori/makro takibi ve AI tabak tarama çalışmaz. eatkcal'dan sipariş verebilir, Keşfet'i ve diğer özellikleri kullanabilirsiniz.

**Nasıl geri alınır?** `[Ayarlar › Gizlilik › Sağlık verisi]` bölümünden veya `[privacy@…]` adresine yazarak.

**Hukuki dayanak:** KVKK md.6/3-a · GDPR Art.9(2)(a) · (ABD, Washington/Nevada) tüketici sağlık verisi toplama onayı.

**Onay kutusu metni:**
> ☐ Boy, kilo, ölçü, öğün kayıtlarım ve tabak fotoğraflarım gibi sağlık verilerimin, kalori takibi ve AI besin tahmini amacıyla yukarıda açıklandığı şekilde işlenmesine ve bu amaçla yurt dışındaki hizmet sağlayıcılara aktarılmasına açık rıza veriyorum.

> **[İnceleme notu]** (1) Uygulamadaki bugünkü kutu ("…işlenmesine açık rıza veriyorum", `src/core/i18n/dictionaries.ts:227`) **kaydedilmiyor**; ispat yükü karşılanamaz (BOSLUKLAR). (2) Washington MHMDA için "paylaşım onayı" ayrı alınmalı. ABD'ye açılışta bu kutunun altına "Tüketici sağlık verimin yukarıdaki işleyenler dışındaki üçüncü kişilerle paylaşılmasına onay veriyorum" ayrı kutusu eklenir.

---

## 2. Kişisel Verilerin Yurt Dışına Aktarılmasına İlişkin Açık Rıza (arızi aktarımlar)

> **[İnceleme notu — neden genel aktarım rızası önerilmiyor]** 7499 sayılı Kanun'la değişik md.9'da yurt dışına aktarımın düzenli ve asıl yolu şunlardır:
> - yeterlilik kararı (md.9/1);
> - yeterlilik kararı yoksa uygun güvenceler (md.9/4): standart sözleşme, bağlayıcı şirket kuralları, taahhütname ve Kurul izni.
>
> Açık rıza (md.9/6-a) yalnız **arızi** aktarımlar için ve riskler hakkında bilgilendirme yapılarak kullanılabilir. Barındırma, AI, teşhis, bildirim gibi süreklilik arz eden aktarımlar bu nedenle **standart sözleşme + 5 iş günü içinde Kurum'a bildirim** ile yürütülmelidir. Bu rıza onların yerine geçmez.
>
> Bu metin yalnız şu durumlar için önerilir:
> - standart sözleşmenin kapsamadığı tekil, düzenli olmayan aktarım (ör. kullanıcının talebiyle yurt dışındaki bir hizmete tek seferlik veri gönderimi, ya da yeni bir sağlayıcının sözleşmesi tamamlanana kadar zorunlu tekil bir işlem);
> - sözleşme süreçleri tamamlanana kadar geçici bir önlem.
>
> Geçici önlem olarak kullanılması da tartışmalıdır. Uygulamaya hiç koymamak da makul bir seçenektir.

**Ne için?** Standart sözleşme güvencesinin uygulanamadığı, düzenli olmayan, tekil bir aktarım gerektiğinde.

**Hangi veriler, kime?** Aktarımın gerektiği anda size gösterilecektir: aktarılacak veri kategorisi, alıcının adı ve ülkesi, amaç. Bu rıza, gösterilen o tekil aktarım içindir.

**Riskler (md.9/6-a uyarınca bilgilendirme):**
- Alıcı ülke hakkında Kurul'un verdiği bir **yeterlilik kararı yoktur**. O ülkede kişisel verilerin korunma düzeyi Türkiye'deki düzeye eşit olmayabilir.
- Aktarım için **uygun güvence (standart sözleşme vb.) sağlanamamıştır**.
- Alıcı ülkenin kamu makamları, o ülke hukukuna göre verilere erişebilir.
- KVKK md.11'deki haklarınızı alıcıya karşı kullanmanız ve hukuki yollara başvurmanız daha zor olabilir.

**Ne kadar süre?** Yalnız ilgili tekil aktarım için geçerlidir.

**Rıza vermezseniz:** Talep ettiğiniz o tekil işlem yapılamaz. Diğer hizmetler etkilenmez.

**Nasıl geri alınır?** `[privacy@…]`. Geri alma, henüz yapılmamış aktarımı durdurur.

**Hukuki dayanak:** KVKK md.9/6-a; Kişisel Verilerin Yurt Dışına Aktarılmasına İlişkin Usul ve Esaslar Hakkında Yönetmelik. GDPR için Art.49(1)(a) (yalnız arızi durumda).

**Onay kutusu metni:**
> ☐ Yukarıda belirtilen kişisel verilerimin, belirtilen alıcıya ve ülkeye, belirtilen amaçla bir defaya mahsus aktarılmasına; yeterlilik kararı ve uygun güvence bulunmadığına ilişkin riskler hakkında bilgilendirilmiş olarak açık rıza veriyorum.

---

## 3. Pazarlama İletişimi Onayı ve Açık Rıza

**Ne için?** Kampanya, indirim, yeni ürün ve menü duyuruları ile size uygun önerileri göndermek için. Uygun öneri; sipariş geçmişi, tercihler ve uygulama kullanımına göre yapılan segmentasyondur.

**Kanallar (ayrı ayrı seçilir):**
- ☐ E-posta
- ☐ SMS
- ☐ Telefonla arama
- ☐ Uygulama bildirimi (push)

**Hangi veriler?**
- ad, e-posta, telefon, push jetonu;
- sipariş geçmişi ve tercihler;
- kullanım ölçümü özetleri (segmentasyon için).
- **Sağlık verileriniz pazarlama segmentasyonunda kullanılmaz.**

**Kimlere aktarılır?**
- e-posta altyapısı (Resend, ABD) ve bildirim altyapısı (Expo, ABD; Apple, Google);
- İleti Yönetim Sistemi (İYS) kaydı için İYS A.Ş.;
- SMS/arama sağlayıcısı `[SAĞLAYICI — henüz yok]`.
- Yurt dışı aktarımlar standart sözleşme güvencesiyle yapılır.

**Ne kadar süre?**
- Onayınızı geri alana kadar gönderim yapılır.
- Onay ve ret kayıtları, onayın geçerliliğinin sona erdiği tarihten itibaren **3 yıl** saklanır (Ticari İletişim ve Ticari Elektronik İletiler Hakkında Yönetmelik).

**Rıza vermezseniz:** Pazarlama iletisi almazsınız. Sipariş, hesap ve güvenlik gibi işlem bildirimleri bundan etkilenmez.

**Nasıl geri alınır?**
- Her iletideki ret bağlantısı veya talimatı;
- `[Ayarlar › Bildirimler › Pazarlama]`;
- İYS üzerinden (iys.org.tr);
- `[privacy@…]`.
- Talebiniz en geç **3 iş günü** içinde uygulanır.

**Hukuki dayanak:**
- 6563 sayılı Elektronik Ticaretin Düzenlenmesi Hakkında Kanun md.6 ve Ticari İletişim ve Ticari Elektronik İletiler Hakkında Yönetmelik (önceden onay);
- KVKK md.5/1 (segmentasyon/profilleme için açık rıza);
- GDPR Art.6(1)(a) ve ePrivacy Direktifi md.13.

**Onay kutusu metni:**
> ☐ SEKULART LTD tarafından kampanya, indirim ve duyurular hakkında seçtiğim kanallardan ticari elektronik ileti gönderilmesine ve bu amaçla sipariş geçmişim ile tercihlerimin kişiselleştirme için işlenmesine onay veriyorum.

> **[İnceleme notu]**
> 1. SMS, arama ve e-posta onayları İYS'ye kaydedilmeli. İYS'ye yüklenmeyen onaylar geçersiz sayılır; bildirim kaydı İYS'de olmayan alıcıya ileti gönderilemez.
> 2. Push bildiriminin "ticari elektronik ileti" sayılıp sayılmadığı tartışmalı; ihtiyatla onay alınması önerilir. Push İYS kapsamında değildir.
> 3. Bugün `marketing_enabled` varsayılan olarak açık ve tercih satırı olmayan kullanıcıya da kampanya gidiyor (`supabase/functions/send-notification/index.ts:183-186`). Bu metin yürürlüğe girmeden düzeltilmeli.
> 4. Web bülten formunda onay kaydı (metin + sürüm + zaman) tasarlanmış (`web_leads`) ama tablo canlıya uygulanmamış.

---

## 4. Reklam Ölçümü (Meta) Açık Rızası

**Ne için?** Meta (Facebook/Instagram) reklamlarımızın kaç kişiyi uygulamaya getirdiğini ve siparişe dönüştüğünü ölçmek ve reklam gösterimini bu ölçüme göre iyileştirmek için.

**Hangi veriler?** Uygulamadaki şu olaylar Meta'nın yazılım geliştirme kitiyle (SDK) Meta'ya iletilir:
- ürün görüntüleme (ürün kimliği, adı, fiyatı);
- sepete ekleme;
- ödeme başlatma;
- satın alma (tutar, sipariş numarası);
- kayıt olma (yöntem).

Bunlara ek olarak cihaz ve uygulama bilgileri ile reklam kimliği iletilir: iOS'ta IDFA, Android'de reklam kimliği (GAID).

Sağlık verileriniz, öğün kayıtlarınız, adresiniz ve konumunuz **iletilmez**.

**Kimlere aktarılır?** Meta Platforms Ireland Ltd. ve Meta Platforms Inc. (ABD). Meta bu verileri kendi koşullarına göre bağımsız veri sorumlusu olarak da işler. Yurt dışı aktarım, KVKK md.9 uyarınca standart sözleşme güvencesine tabidir.

**iOS İzleme İzni (ATT):** iPhone'da Apple ayrıca bir sistem penceresiyle izleme izni sorar. Bu izin ve bu rıza **ayrıdır**: ikisinden biri yoksa olaylar ve reklam kimliği Meta'ya iletilmez.

**Ne kadar süre?** Rızanızı geri alana kadar olay gönderilir. Meta'daki saklama Meta'nın politikasına tabidir.

**Rıza vermezseniz:** Uygulamanın tüm özellikleri aynen çalışır; yalnız reklam ölçümü yapılmaz.

**Nasıl geri alınır?** `[Ayarlar › Gizlilik › Reklam ölçümü]`; iOS'ta ayrıca cihaz Ayarları › Gizlilik ve Güvenlik › İzleme; `[privacy@…]`.

**Hukuki dayanak:** KVKK md.5/1 (açık rıza) ve md.9 (aktarım güvencesi) · GDPR Art.6(1)(a) ve ePrivacy Direktifi md.5(3) (cihaza erişim için rıza) · ABD: "paylaşım"dan vazgeçme hakkı (Gizlilik Politikası §17).

**Onay kutusu metni:**
> ☐ Reklamların etkisinin ölçülmesi amacıyla uygulama içi ürün görüntüleme, sepete ekleme, ödeme ve satın alma olaylarımın ve reklam kimliğimin Meta Platforms'a aktarılmasına açık rıza veriyorum.

> **[İnceleme notu]** Rıza ekranı metinleri kodda hazır (`src/lib/metrics/i18n.ts:20-29`) ama bir ekrana bağlı değil. Ayrıca rıza "unset" iken Android'de olay gidiyor ve iOS'ta otomatik olay kaydı açık (`app.config.js:402`). Varsayılan "rıza yok" olmalı (BOSLUKLAR B-06). Uygulamadaki mevcut açıklama ("anonim kullanım olayları") birinci taraf ölçüm için de doğru değil: olaylar kullanıcı kimliğine bağlanıyor, yani takma adlı veri.
