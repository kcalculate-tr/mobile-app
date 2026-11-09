# Kullanım Koşulları

> **TASLAK — hukuki inceleme için (İlter Öziseven). Yayımlanmadı.**
> Sürüm: `v0.1-taslak` · Taslak tarihi: 2026-11-09 · Yürürlük: `[YÜRÜRLÜK TARİHİ]`
> Kapsam: Kcalculate AI mobil uygulaması (eatkcal sipariş modülü dâhil), kcalculate.ai, eatkcal.com, l.eatkcal.com — hep birlikte **"Hizmet"**.

## 1. Taraflar ve kabul

1.1. Bu Koşullar, Hizmet'i kullanan sen ("**Kullanıcı**") ile **SEKULART Ltd.** arasındadır:
`[TAM UNVAN]` (SEKÜLART Sağlıklı Gıda Ürünleri San. ve Tic. Ltd. Şti.) · MERSİS: `[MERSİS]` · VKN: `[VKN]` · Adres: `[ADRES]` (Basın Sitesi Mah. 177/3 Sk. No:3A, 35150 Karabağlar / İzmir) · KEP: `[KEP]` · Telefon: `[TELEFON]` · E-posta: `[legal@…]` (bugün: info@eatkcal.com) — "**SEKULART**", "**biz**".

1.2. Hesap oluştururken bu Koşulları ve Gizlilik Politikası'nı okuduğunu, **onay kutusunu işaretleyerek** kabul edersin. Kabul ettiğin sürüm ve kabul zamanı hesabınla birlikte kaydedilir. Hesap açmadan yalnızca web sitelerini gezmen, bu Koşullar'ın genel kullanım kurallarına (§9, §10) tabidir; ancak sitede gezinmen hiçbir sözleşmeyi ya da rızayı kabul ettiğin anlamına gelmez.

1.3. **eatkcal üzerinden verdiğin siparişler** ayrıca **Ön Bilgilendirme Formu** ve **Mesafeli Satış Sözleşmesi**'ne tabidir; o belgeler satışla ilgili konularda bu Koşullar'dan önce gelir.

1.4. Kişisel verilerinin nasıl işlendiği **Gizlilik Politikası** ve **KVKK Aydınlatma Metni**'nde anlatılır. Bu Koşullar'ı kabul etmen, açık rıza gerektiren işlemlere (ör. sağlık verisi, reklam ölçümü, pazarlama iletisi) rıza verdiğin anlamına **gelmez**; bunlar ayrı ayrı sorulur.

> **[İnceleme notu]** Bugünkü metinler "kullanmaya devam etmekle kabul etmiş sayılırsınız" (göz atarak kabul) dili içeriyor (`web:apps/eatkcal/content/legal/gizlilik.ts:11`). Bu taslak "tıklayarak kabul" modeline geçer; kabul kaydının tutulması için gereken iş `ENTEGRASYON.md`'de.

## 2. Tanımlar

- **Uygulama:** Kcalculate AI iOS/Android uygulaması.
- **Kcalculate AI:** kalori/makro takibi, AI fotoğraf tahmini ve Keşfet sosyal akışını içeren dijital hizmet.
- **eatkcal:** İzmir'de SEKULART mutfaklarından (kcal., tera, Breaking Fast markaları) yemek siparişi hizmeti.
- **Keşfet:** kullanıcıların gönderi, yorum, fotoğraf ve video paylaştığı sosyal akış.
- **Kullanıcı İçeriği:** Hizmet'e yüklediğin veya paylaştığın her türlü metin, fotoğraf, video, yorum, değerlendirme ve öğün/etkinlik kartı.
- **Macro Coin / Makro paketi:** eatkcal'da kullanılan ön ödemeli bakiye/paket.
- **AI Tahmini:** fotoğraf veya metinden yapay zekâ ile üretilen besin/kalori/makro tahmini.

## 3. Kimler kullanabilir? (18+)

3.1. Hizmet **yalnızca 18 yaşını doldurmuş** kişiler içindir. Kayıt sırasında 18 yaşından büyük olduğunu beyan edersin.

3.2. 18 yaşından küçük olduğunu öğrendiğimiz veya makul olarak tespit ettiğimiz hesapları **kapatırız** ve ilgili verileri Gizlilik Politikası'na göre sileriz.

3.3. Hesabını yalnızca kendi adına açabilirsin; başkası adına veya sahte kimlikle hesap açamazsın. Bir kişi birden fazla hesabı, istismar amacıyla (ör. ilk sipariş kuponunu tekrar kullanmak) kullanamaz.

> **[İnceleme notu]** Kodda yaş kontrolü zayıf: 18+ onayı yalnız cihazda saklanıyor (`src/screens/auth/UnifiedLoginScreen.tsx:139-143`), yeni onboarding'de onay kutusu yok, "Takibe başla" akışındaki doğum yılı kontrolü hesap açıldıktan sonra çalışıyor ve yıl değiştirilerek aşılabiliyor (`src/modules/onboarding/takibe/TakibeNavigator.tsx:207-209,525-535`). "Hesapları kapatırız" taahhüdü bu açık kapatılmadan yayımlanırsa, taahhüdün uygulanmadığı iddiasına açık kalır. Bkz. `BOSLUKLAR.md`.

## 4. Hesap ve güvenlik

4.1. E-posta kodu, Apple ile Giriş veya Google ile Giriş yöntemlerinden biriyle hesap açarsın. Verdiğin bilgilerin doğru ve güncel olmasından sen sorumlusun.

4.2. Hesabının ve cihazının güvenliğini sağlamak senin sorumluluğundadır. Yetkisiz kullanım fark edersen bize hemen bildir.

4.3. Hesabını bir başkasına devredemez, satamaz veya kiralayamazsın.

## 5. Hizmetler

5.1. **Kcalculate AI:** öğün, kalori, makro, su ve etkinlik takibi; boy, kilo ve hedefine göre kişisel hedef hesabı; fotoğraftan AI Tahmini; ilerleme ve ölçüm geçmişi.

5.2. **Keşfet:** gönderi, yorum, beğeni, takip ve 24 saatlik gün kartı paylaşımı.

5.3. **eatkcal:** İzmir'de belirlenen teslimat bölgelerinde, SEKULART mutfaklarından yemek siparişi ve Macro Coin/Makro paketleri. Teslimat bölgeleri, saatleri ve fiyatlar uygulamada sipariş öncesi gösterilir.

5.4. **Ücretli özellikler:** `[ABONELİK — varsa plan adı, fiyat, yenileme, iptal; uygulama mağazası üzerinden satılıyorsa Apple/Google kuralları]`.

5.5. Hizmet'in bazı bölümleri ülke, dil veya cihaza göre farklı olabilir. eatkcal yalnızca Türkiye'de (İzmir) sunulur.

## 6. AI Tahmini ve sağlık uyarısı — önemli

6.1. **AI Tahminleri yaklaşıktır.** Fotoğraftaki yemeğin türü, porsiyonu, pişirme yöntemi ve gizli malzemeler (yağ, şeker, sos) tam olarak tespit edilemeyebilir. Tahmini kaydetmeden önce kontrol edebilir ve düzeltebilirsin.

6.2. **Hizmet tıbbi tavsiye değildir.** Kcalculate AI bir **tıbbi cihaz değildir**; hastalık teşhisi, tedavisi, izlenmesi veya önlenmesi amacıyla tasarlanmamıştır. Kalori ve makro hedefleri genel formüllerle hesaplanır ve kişisel sağlık durumunu dikkate almaz.

6.3. **Şu durumlarda Hizmet'e güvenme, bir hekime veya diyetisyene danış:** diyabet ve insülin/ilaç dozu hesabı; yeme bozukluğu öyküsü veya şüphesi; gebelik ve emzirme; böbrek, kalp, metabolizma hastalıkları; gıda alerjisi; 18 yaş altı; hızlı kilo kaybı hedefleri.

6.4. Yeme bozukluğuyla ilgili endişen varsa bir sağlık profesyoneline başvur. Acil durumlarda **112**'yi ara (Türkiye dışında: yerel acil numara).

6.5. eatkcal ürünlerinin besin değerleri ve alerjen bilgileri ürün sayfasında gösterilir; AI Tahmini bu bilgilerin yerine geçmez.

> **[İnceleme notu]** AB'de satışa çıkılırsa: kalori takip uygulamaları genellikle MDR (AB 2017/745) kapsamı dışındadır, ancak "teşhis/tedavi" iddiası pazarlamada kullanılmamalı. AI Tahmini AB Yapay Zekâ Tüzüğü'nde (2024/1689) yüksek riskli değildir; md.50 şeffaflık yükümlülükleri bu kullanıma doğrudan uymaz, yine de "AI tarafından üretildi" etiketi tutulmalı.

## 7. Kullanıcı İçeriği

7.1. **Sahiplik:** Kullanıcı İçeriği'nin sahibi sensin.

7.2. **Bize verdiğin lisans:** Kullanıcı İçeriği'ni Hizmet'te paylaştığında, SEKULART'a bu içeriği **Hizmet'in işletilmesi, gösterilmesi, denetlenmesi (moderasyon), geliştirilmesi ve Hizmet içinde tanıtılması** amacıyla barındırma, çoğaltma, uyarlama (ör. boyutlandırma, kırpma, kare çıkarma), görüntüleme ve kamuya iletme için **münhasır olmayan, dünya çapında, bedelsiz** ve hizmet sağlayıcılarımıza (barındırma, moderasyon) **alt lisans verilebilir** bir lisans verirsin. Hizmet dışındaki reklamlarda içeriğini kullanmak için ayrıca izin isteriz.

7.3. **Lisansın sona ermesi:** İçeriği veya hesabını sildiğinde lisans sona erer; ancak (a) başkalarının senin izninle paylaştığı veya yanıtladığı kopyalar, (b) en çok **30 gün** içinde döngüyle silinen yedekler, (c) yasal yükümlülük, uyuşmazlık veya resmi talep nedeniyle saklanması gereken içerik için sınırlı süreyle devam edebilir.

7.4. **Senin güvencelerin:** Paylaştığın içerik üzerinde gerekli haklara sahip olduğunu; içerikte görünen kişilerin iznini aldığını; içeriğin hukuka, bu Koşullar'a ve Topluluk Kuralları'na uygun olduğunu kabul edersin.

7.5. **Herkese açıklık:** Herkese açık profilde paylaştığın gönderiler, profil adın ve fotoğrafın diğer kullanıcılar ve bağlantıyı alan kişiler tarafından görülebilir. Öğün/etkinlik kartı paylaşırsan, bu kart **sağlıkla ilgili bilgi** içerebilir; paylaşmadan önce düşün.

7.6. **Topluluk Kuralları:** Keşfet'te paylaşım yaparken **Topluluk Kuralları**'na (`tr/07-topluluk-kurallari.md`) uymayı kabul edersin.

> **[İnceleme notu]** Bugün `post-media` kovası herkese açık (`supabase/migrations/20261104000400_post_media_storage.sql:17-20`); gizli profil gönderilerinin görselleri de URL'yi bilen herkesçe açılabilir. §7.5 metni bu teknik gerçeğe göre yazıldı; kova gizliye çevrilirse sadeleştirilebilir.

## 8. Moderasyon, bildirim ve itiraz

8.1. **Ön kontrol:** Keşfet gönderileri ve yorumları yayından önce **otomatik sistemlerle (yapay zekâ dâhil)** kontrol edilir; gerekirse **insan moderatör** inceler. Otomatik kontrolde metin ve görseller hizmet sağlayıcımıza (Anthropic) kimlik bilgin olmadan gönderilir.

8.2. **Bildirim:** Hukuka aykırı olduğunu veya Topluluk Kuralları'na uymadığını düşündüğün içeriği uygulamadaki **"Bildir"** seçeneğiyle veya `[legal@…]` adresine yazarak bildirebilirsin. Bildirimde içeriğin yeri, neden hukuka aykırı olduğu ve iletişim bilgin yer almalıdır. Bildirimleri özenle, tarafsız ve makul sürede inceleriz.

8.3. **Önlemler:** Kurallara aykırı içeriği yayımlamayabilir, kaldırabilir, görünürlüğünü sınırlayabilir; hesabı uyarabilir, geçici olarak askıya alabilir veya kapatabiliriz. Önlemin ağırlığı ihlalin ağırlığına ve tekrarına göre belirlenir.

8.4. **Gerekçe:** İçeriğin kaldırıldığında veya hesabın kısıtlandığında, kararın gerekçesini, otomatik araç kullanılıp kullanılmadığını ve itiraz yolunu sana bildiririz.

8.5. **İtiraz:** Karardan itibaren **6 ay** içinde uygulama içinden itiraz edebilirsin. İtirazlar **insan** tarafından incelenir; karar yanlışsa içerik geri yüklenir.

8.6. **Resmi talepler:** 5651 sayılı Kanun ve diğer mevzuat kapsamında yetkili makamların kararlarına ve hak sahiplerinin başvurularına mevzuattaki sürelerde uyarız.

> **[İnceleme notu]** §8.2–8.5, AB Dijital Hizmetler Yasası (DSA) md.16 (bildirim ve işlem), md.17 (gerekçe bildirimi), md.20 (iç şikâyet sistemi — en az 6 ay) ile uyumlu yazıldı. AB'de hizmet sunuluyorsa DSA md.11–13 (iletişim noktası ve AB'de yasal temsilci) ayrıca gerekir; bkz. `BOSLUKLAR.md`. Mikro/küçük işletme muafiyeti (md.19) md.20'yi kapsar, md.16–17'yi kapsamaz.

## 9. Yasaklı kullanımlar

Şunları yapamazsın:
- Hizmet'i hukuka aykırı amaçlarla veya başkalarının haklarını ihlal edecek şekilde kullanmak;
- otomatik araçlarla veri kazımak (scraping), toplu hesap açmak, botlarla etkileşim üretmek;
- uygulamayı tersine mühendislik, kaynak koda dönüştürme veya güvenlik önlemlerini aşma girişimine konu etmek (zorunlu mevzuatın izin verdiği hâller hariç);
- sahte hesap açmak, başkasını taklit etmek;
- kupon, Macro Coin, AI kota veya kampanya sistemlerini istismar etmek;
- Hizmet'e zararlı yazılım yüklemek veya altyapıya aşırı yük bindirmek;
- başkalarının kişisel verilerini izinsiz toplamak veya paylaşmak.

## 10. Fikri mülkiyet

Hizmet'in yazılımı, tasarımı, Kcalculate AI, eatkcal, kcal., tera ve Breaking Fast markaları, logolar ve içerik (Kullanıcı İçeriği hariç) SEKULART'a veya lisans verenlerine aittir. Sana yalnızca Hizmet'i bu Koşullar'a uygun ve kişisel amaçla kullanman için **sınırlı, devredilemez, münhasır olmayan, geri alınabilir** bir kullanım izni verilir.

## 11. Üçüncü taraf hizmetler

Hizmet; Apple ile Giriş, Google ile Giriş, ödeme kuruluşu **PaynKolay** (N Kolay Ödeme ve Elektronik Para Kuruluşu A.Ş.), harita ve konum servisleri (Google Maps) gibi üçüncü taraf hizmetlerle çalışır. Bu hizmetler kendi koşul ve politikalarına tabidir. Kart bilgilerin uygulamaya değil, doğrudan ödeme kuruluşunun sayfasına girilir.

## 12. Ücretler, Macro Coin ve kuponlar

12.1. Sipariş fiyatları, teslimat ücreti, Macro Coin/Makro paketleri ve kampanya koşulları satın alma öncesi uygulamada gösterilir ve **Ön Bilgilendirme Formu** ile **Mesafeli Satış Sözleşmesi**'ne tabidir.

12.2. Kuponlar ve promosyon bakiyeleri nakde çevrilemez, devredilemez ve üzerinde yazan süre içinde kullanılabilir.

12.3. Satın aldığın Macro Coin/Makro paketlerinin süresi, kullanım ve iade koşulları satın alma öncesi açıkça gösterilir.

> **[İnceleme notu]** Mevcut metinler "kullanılmamış Makro paketi iade edilmez" diyor (mobil `src/data/contractsData.ts` distance-sales md.8.2/11.3; web `mesafeli.ts:158-166`). Tüketicinin bedel ödediği bakiyenin süre sonunda tamamen yanması TKHK md.5 (haksız şart) riski taşır; ayrıca mobil metinde md.11.2 "Macro Paketleri" tablosu boş. Önerim: ödenmiş bakiye için iade/orantılı iade kuralı, yalnız promosyon bakiyesi için yanma.

## 13. Uygulama mağazası koşulları

13.1. **Apple:** Uygulamayı Apple App Store'dan indirdiysen: (a) bu Koşullar Apple ile değil, SEKULART ile senin aranda yapılmıştır; Uygulama ve içeriğinden Apple değil SEKULART sorumludur. (b) Kullanım iznin, App Store Kullanım Şartları'ndaki "Kullanım Kuralları"na uygun olarak sahibi olduğun veya kontrol ettiğin Apple cihazlarıyla sınırlıdır. (c) Apple'ın Uygulama için bakım ve destek yükümlülüğü yoktur. (d) Uygulama herhangi bir garantiye uymazsa Apple'a bildirebilirsin; Apple, varsa satın alma bedelini iade eder; bunun dışında, yasaların izin verdiği ölçüde Apple'ın başka garanti yükümlülüğü yoktur. (e) Uygulamaya ilişkin ürün sorumluluğu, mevzuata uygunluk ve tüketici koruma taleplerini Apple değil SEKULART karşılar. (f) Uygulamanın üçüncü kişinin fikri mülkiyet hakkını ihlal ettiği iddialarını Apple değil SEKULART inceler ve savunur. (g) ABD ambargosuna tabi bir ülkede bulunmadığını ve ABD'nin yasaklı taraf listelerinde yer almadığını beyan edersin. (h) Apple ve bağlı şirketleri bu Koşullar'ın üçüncü taraf lehtarıdır ve kabulünle birlikte bu Koşullar'ı sana karşı uygulama hakkına sahiptir. Sorular ve şikâyetler için §20'deki iletişim bilgilerini kullan.

13.2. **Google:** Uygulamayı Google Play'den indirdiysen, Google Play Hizmet Şartları da geçerlidir; Uygulama'dan Google değil SEKULART sorumludur.

## 14. Hizmetin sürekliliği ve değişiklikler

Hizmet'i iyileştirmek için özellik ekleyebilir, değiştirebilir veya kaldırabiliriz. Ücretli bir özelliği kaldırırsak, önceden bildirir ve kullanılmamış ödemeli kısmı iade ederiz. Bakım, güvenlik veya mücbir sebeplerle Hizmet geçici olarak kesintiye uğrayabilir.

## 15. Hesap silme

15.1. Hesabını istediğin an silebilirsin: **Uygulama › Profil › Güvenlik › Hesabımı Sil** veya web'de **eatkcal.com/account-deletion** sayfasındaki adımlarla. Aktif (teslim edilmemiş) siparişin varsa önce sipariş tamamlanmalıdır.

15.2. Silmeyle birlikte profilin, beslenme ve ölçüm kayıtların, Keşfet içeriğin, kayıtlı kartların ve bildirim jetonların silinir. **Sipariş ve ödeme kayıtları**, vergi ve ticaret mevzuatı gereği (TTK md.82, VUK md.253) **10 yıla kadar, kimliğinden arındırılmış** olarak saklanır. Ayrıntı: Gizlilik Politikası ve Saklama ve İmha Politikası.

15.3. Kullanılmamış Macro Coin/Makro paketi bakiyen için §12.3 ve satış belgeleri geçerlidir.

## 16. Hesabın tarafımızca kapatılması

Bu Koşullar'ı veya Topluluk Kuralları'nı ağır ya da tekrarlı ihlal etmen, hukuka aykırı kullanım, dolandırıcılık veya 18 yaş altında olman hâlinde hesabını askıya alabilir veya kapatabiliriz. Acil hâller dışında önceden bildirir ve gerekçe veririz; karara §8.5'e göre itiraz edebilirsin.

## 17. Sorumluluğun sınırlandırılması

17.1. Hizmet "olduğu gibi" sunulur. AI Tahminleri'nin, kalori hedeflerinin ve kullanıcı içeriğinin doğruluğunu garanti etmeyiz.

17.2. Mevzuatın izin verdiği ölçüde, dolaylı zararlardan, kâr kaybından ve Kullanıcı İçeriği'nden doğan zararlardan sorumlu değiliz.

17.3. **Bu sınırlamalar şunları kapsamaz:** (a) **kast veya ağır kusur** (TBK md.115); (b) **ölüm veya bedensel zarar**; (c) ayıplı mal/hizmet ve **tüketicinin vazgeçilemez hakları** (TKHK) ve yaşadığın ülkenin zorunlu tüketici hukuku; (d) ürün sorumluluğu mevzuatı.

## 18. Tazminat

Hizmet'i **ticari veya mesleki amaçla** (ör. creator iş birliği, işletme hesabı) kullanıyorsan, bu Koşullar'ı ihlal etmenden kaynaklanan üçüncü kişi taleplerinden doğan makul zararları SEKULART'a ödemeyi kabul edersin. Tüketiciler için bu madde, yalnızca kendi kusurlu ihlalleriyle sınırlı olarak ve mevzuatın izin verdiği ölçüde uygulanır.

## 19. Koşullarda değişiklik

19.1. Bu Koşullar'ı güncelleyebiliriz. Esaslı değişiklikleri yürürlükten en az **30 gün** (diğer değişiklikleri **15 gün**) önce uygulama içi bildirim ve/veya e-postayla duyururuz.

19.2. Esaslı değişikliklerde Hizmet'i kullanmaya devam etmek için yeni sürümü **yeniden onaylamanı** isteriz. Onaylamazsan hesabını silebilirsin.

19.3. Yasal zorunluluk veya güvenlik nedeniyle yapılan değişiklikler daha kısa sürede yürürlüğe girebilir.

## 20. Uygulanacak hukuk ve uyuşmazlıklar

20.1. Bu Koşullar **Türkiye Cumhuriyeti hukukuna** tabidir.

20.2. **Türkiye'deki tüketiciler:** Parasal sınırlar dâhilinde **Tüketici Hakem Heyetleri** (TKHK md.68; `[YIL]` için sınır: `[TUTAR] TL`, her yıl Ticaret Bakanlığı'nca ilan edilir), bu sınırın üstünde arabuluculuk (TKHK md.73/A) ve **Tüketici Mahkemeleri** yetkilidir. Başvuru ve dava, **senin yerleşim yerinde** veya tüketici işleminin yapıldığı yerde yapılabilir (TKHK md.73).

20.3. **Tüketici olmayan kullanıcılar:** İzmir (Merkez) Mahkemeleri ve İcra Daireleri yetkilidir.

20.4. **AB / AEA / Birleşik Krallık tüketicileri:** Bu hukuk seçimi, **mutad meskeninin bulunduğu ülkenin, sözleşmeyle bertaraf edilemeyen tüketici koruma hükümlerinden** seni yoksun bırakmaz (Roma I Tüzüğü md.6(2)). Kendi yerleşim yerindeki mahkemelerde dava açabilirsin (Brüksel I bis Tüzüğü md.18); Birleşik Krallık'ta ilgili yerel kurallar uygulanır.

20.5. **Diğer ülkeler:** Yaşadığın ülkenin zorunlu tüketici hukuku saklıdır.

> **[İnceleme notu]** (1) AB ODR platformu, (AB) 2024/3228 sayılı Tüzük ile 20.07.2025'te kapatıldı; ODR bağlantısı gerekmez — teyit edin. (2) ABD kullanıcıları için tahkim/toplu dava feragati bilinçli olarak konmadı; ABD pazarına yönelik büyüme planlanıyorsa karar verilmeli. (3) Mevcut metinlerdeki sorunlar: cayma istisnası TKHK md.15'e dayandırılmış (doğrusu Mesafeli Sözleşmeler Yönetmeliği md.15/1); ayıp bildirimi için 2 saat ve yalnız uygulama kanalı şartı TKHK md.10–11 ile çatışabilir; yetki yalnız "İzmir Merkez Tüketici Mahkemeleri" (TKHK md.73'e aykırı); mobil metinde Makro paket tablosu boş. Bu taslak bunları satış belgelerine bırakır; ayrıntı `MESAFELI_KARSILASTIRMA.md`.

## 21. Diğer hükümler

Bu Koşullar'ın bir hükmü geçersiz sayılırsa diğer hükümler geçerliliğini korur. Bir hakkımızı kullanmamamız, o haktan vazgeçtiğimiz anlamına gelmez. Bu Koşullar'ın Türkçe ve İngilizce metinleri arasında çelişki olursa Türkçe metin esas alınır; ancak AB/AEA/BK tüketicileri için anlaşılırlık açısından kendi dilindeki metin de yorumda dikkate alınır.

## 22. İletişim

SEKULART Ltd. · `[ADRES]` · `[legal@…]` · Destek: `[support@…]` (bugün: info@eatkcal.com) · Telefon: `[TELEFON]` · KEP: `[KEP]`
