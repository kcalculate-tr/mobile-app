# Kişisel Veri İhlali Müdahale Planı

> **TASLAK — hukuki inceleme için (İlter Öziseven). Yayımlanmadı.**
> Sürüm: `v0.1-taslak` · Tarih: 2026-11-09 · Dayanak envanter: `docs/legal/VERI_ENVANTERI.md`

**Veri sorumlusu:** SEKULART LTD · MERSİS 0759-1148-7410-0001 · VKN 7591148741 · Adres Basın Sitesi Mah. 177/3 Sk. No:3A, 35150 Karabağlar / İzmir · İletişim `[privacy@…]`

---

## 1. Amaç ve dayanak

Bu Plan, kişisel verilerin hukuka aykırı olarak başkaları tarafından elde edilmesi, erişilmesi, değiştirilmesi, kaybı veya yok edilmesi ("ihlal") hâlinde nasıl davranılacağını belirler.

Dayanaklar:
- **KVKK md.12/5:** İşlenen verilerin kanuni olmayan yollarla başkaları tarafından elde edilmesi hâlinde veri sorumlusu bu durumu en kısa sürede ilgilisine ve Kurul'a bildirir.
- **Kurul kararı 2019/10** (Kişisel Veri İhlali Bildirim Usul ve Esasları): Kurul'a ihlalin öğrenilmesinden itibaren gecikmeksizin ve **en geç 72 saat** içinde bildirim yapılır. İlgili kişilere ihlalden etkilenen kişiler tespit edildikten sonra **makul olan en kısa sürede** bildirim yapılır. İhlal kayıt altına alınır.
- **GDPR md.33–34** (AB/AEA'daki kişilerin verisi etkilendiğinde).
- **ABD eyalet ihlal bildirim yasaları** (ABD'deki kişilerin verisi etkilendiğinde).

## 2. Kapsam

Plan; Şirket sistemlerini, işleyenlerin (Supabase, Anthropic, Sentry, Expo, Vercel, Resend, Adisyo vb.) sistemlerindeki Şirket verisini, personel cihazlarını ve basılı ortamları kapsar. Gizlilik ihlali, bütünlük ihlali (verinin değiştirilmesi) ve erişilebilirlik ihlali (kayıp/şifreleme/yok olma) ayrı ayrı değerlendirilir.

## 3. İhlal Müdahale Ekibi (İME)

| Rol | Görev | Kişi | Yedek | İletişim |
|---|---|---|---|---|
| Karar verici (Yönetim) | Bildirim kararları, kaynak tahsisi, dış iletişim onayı | `[AD SOYAD / UNVAN]` | `[YEDEK]` | `[TEL]` |
| Teknik lider | Tespit, kapsam analizi, kontrol altına alma, kanıt koruma, kök neden | `[AD SOYAD / UNVAN]` | `[YEDEK]` | `[TEL]` |
| Hukuk / Veri koruma sorumlusu | Hukuki değerlendirme, Kurul/otorite bildirimleri, işleyen yazışmaları, kayıt | `[AD SOYAD / UNVAN]` (öneri: İlter Öziseven) | `[YEDEK]` | `[TEL]` |
| İletişim | Kullanıcı bildirimleri, basın, mağaza yazışmaları | `[AD SOYAD / UNVAN]` | `[YEDEK]` | `[TEL]` |
| Operasyon (gerektiğinde) | Şube, kurye, ödeme ve POS süreçleri | `[AD SOYAD / UNVAN]` | — | `[TEL]` |

İhlal bildirimi için tek iç kanal: `[güvenlik@… / acil telefon]`. Her personel şüpheli bir durumu **derhâl** bu kanala bildirmekle yükümlüdür.

## 4. Tespit kaynakları

- Supabase günlükleri (Auth, API, Storage, Edge Function), güvenlik ve performans önerileri (advisors), olağandışı sorgu hacmi;
- Sentry hata ve performans uyarıları (ör. ani yetki hatası artışı);
- Kullanıcı ve personel bildirimleri (destek talebi, `info@`, sosyal medya);
- İşleyenlerden gelen bildirimler (Supabase, Anthropic, Sentry, Expo, Vercel, Resend, Adisyo, PaynKolay, Meta);
- Apple / Google bildirimleri (App Store Connect, Play Console), güvenlik araştırmacısı bildirimleri;
- Ödeme kuruluşundan dolandırıcılık veya kart verisi uyarısı;
- Kod deposunda sızan anahtar uyarısı (GitHub secret scanning), dış tarama.

## 5. Ciddiyet değerlendirmesi

### 5.1 Veri türü puanı

| Puan | Veri türü |
|---|---|
| 4 — Kritik | Özel nitelikli/sağlık sayılabilecek veri (beslenme profili, vücut ölçüleri, öğün geçmişi, AI tarama fotoğrafları); ödeme jetonları (`user_card_secrets`); kimlik doğrulama sırları (servis rolü anahtarı, Apple yenileme jetonları, oturum jetonları) |
| 3 — Yüksek | Adres + telefon + ad birlikte; sipariş geçmişi; destek talebi ekleri; özel profil içerikleri |
| 2 — Orta | E-posta, ad, kullanıcı adı; push jetonları; analitik olaylar (`user_id` ile) |
| 1 — Düşük | Anonim veya toplulaştırılmış veri; zaten herkese açık içerik |

### 5.2 Ölçek ve olasılık

| Etken | 1 | 2 | 3 |
|---|---|---|---|
| Etkilenen kişi | < 100 | 100–10.000 | > 10.000 |
| Zarar olasılığı | Veri şifreli/erişilmemiş kanıtı var | Erişim olası, kötüye kullanım belirsiz | Kötüye kullanım veya yayılma kanıtı var |

**Toplam = veri türü × ölçek × olasılık.**

| Toplam | Seviye | Varsayılan aksiyon |
|---|---|---|
| ≥ 18 veya veri türü 4 ve olasılık ≥ 2 | **S1 Kritik** | Kurul'a 72 saat içinde bildirim; ilgili kişilere bildirim; GDPR/ABD değerlendirmesi |
| 8–17 | **S2 Yüksek** | Kurul'a bildirim (varsayılan: bildir); ilgili kişilere bildirim değerlendirmesi |
| 3–7 | **S3 Orta** | Hukuki değerlendirme; çoğunlukla bildirim; kayıt zorunlu |
| ≤ 2 | **S4 Düşük** | Kayıt; bildirim gerekmeyebilir (gerekçe yazılır) |

> **[İnceleme notu]** KVKK'da GDPR md.33(1)'deki "risk doğurması muhtemel değilse bildirim gerekmez" istisnası açıkça yer almaz; Kurul uygulaması bildirime eğilimlidir. Bu nedenle S3 ve üzeri için varsayılan karar "Kurul'a bildir"dir. S4'te bildirmeme kararı gerekçesiyle kayda geçirilir.

## 6. Müdahale aşamaları ve zaman çizelgesi

T0 = Şirket'in ihlali **öğrendiği** an (işleyenin Şirket'e bildirdiği an dahil).

### 6.1 T0 → 1 saat: İlk değerlendirme ve kontrol altına alma
1. Bildiren kişi İME'ye haber verir; teknik lider olay kaydını açar (§10).
2. İhlalin gerçek olup olmadığı hızlıca doğrulanır; ilk ciddiyet tahmini yapılır.
3. **Kontrol altına alma** (gerektiği ölçüde; sırlar bu belgeye yazılmaz):
   - Supabase **servis rolü anahtarını** ve gerekirse **JWT gizli anahtarını** döndür (Dashboard › Settings › API). Bu tüm oturumları düşürür; etkisi değerlendirilir.
   - Etkilenen **edge function**'ları devre dışı bırak veya yeniden deploy etmeden önce erişimi kapat.
   - Açığa çıkan **Storage kovasını** herkese açıktan özele çevir; CDN önbelleğini temizle.
   - Etkilenen üçüncü taraf **API anahtarlarını** iptal et ve yenile: Anthropic, Resend, PaynKolay, Adisyo, Trendyol Go, Google Maps, Sentry, Expo erişim jetonu.
   - Şüpheli yönetici hesaplarını `admin_allowlist`'ten çıkar; oturumları sonlandır.
   - Önceki anahtar döndürme yöntemleri için iç belge: `docs/night/G3-S2-KEY_ROTATION.md`.
4. **Kanıtları koru** (§8) — kontrol altına alma adımları kanıtı yok etmemelidir.

### 6.2 1 → 24 saat: Kapsam ve risk analizi
- Etkilenen sistemler, veri kategorileri, kayıt ve kişi sayısı, ülke dağılımı (TR / AB / ABD / diğer) belirlenir.
- İhlalin başlangıç zamanı, süresi, saldırı vektörü ve verinin dışarı çıkıp çıkmadığı araştırılır.
- Ciddiyet puanı (§5) kesinleştirilir; hukuk bildirim yükümlülüklerini belirler.
- İşleyen kaynaklı ise işleyenden yazılı ayrıntı istenir.

### 6.3 ≤ 72 saat: Kurul bildirimi (KVKK)
- Kurum'un **"Kişisel Veri İhlal Bildirim Formu"** ile Kurul'a bildirim yapılır (kvkk.gov.tr üzerinden çevrimiçi; gerekirse KEP).
- Bilgilerin tamamı 72 saatte toplanamazsa bilinenler bildirilir, eksikler **gecikmeksizin ve aşamalı** tamamlanır.
- 72 saat aşılırsa bildirimle birlikte **gecikmenin gerekçesi** açıklanır.

### 6.4 Makul en kısa süre: İlgili kişilere bildirim (KVKK)
- Etkilenen kişiler tespit edilir edilmez, **doğrudan** (e-posta, uygulama içi bildirim, push) bildirim yapılır.
- Doğrudan iletişim mümkün değilse veya orantısız çaba gerektiriyorsa Şirket web sitesinde (eatkcal.com / kcalculate.ai) duyuru yayımlanır.
- İçerik: §9.2 şablonu.

### 6.5 GDPR (AB/AEA'daki kişiler etkilendiyse)
- **md.33:** Denetim otoritesine, öğrenmeden itibaren **72 saat** içinde bildirim.
- Şirket'in AB'de yerleşik kuruluşu yoktur; **tek durak mekanizması (one-stop-shop) uygulanmaz**. Etkilenen kişilerin bulunduğu her üye devletin yetkili otoritesine ayrı bildirim gerekebilir. Bildirimler **GDPR md.27 temsilcisi** `[AB TEMSİLCİSİ — atanmadı]` aracılığıyla koordine edilir.
- **md.34:** Kişilerin hak ve özgürlükleri için **yüksek risk** varsa kişilere gecikmeksizin bildirim (verinin şifreli/erişilmez olduğu hâller gibi istisnalar değerlendirilir).
- **md.33(5):** Bildirilsin veya bildirilmesin her ihlal kayda geçirilir.

### 6.6 ABD
- Etkilenen kişilerin ikamet ettiği eyaletin ihlal bildirim yasası uygulanır (süreler ve eşikler eyaletten eyalete farklıdır; bazı eyaletlerde başsavcılığa bildirim gerekir). `[EYALET LİSTESİ — ABD kullanıcı dağılımına göre doldurulacak]`
- Sağlık sayılabilecek veriler için **Washington My Health My Data Act** ve benzeri eyalet tüketici sağlık verisi yasaları ile FTC Health Breach Notification Rule'un uygulanabilirliği ayrıca değerlendirilir.

> **[İnceleme notu]** FTC Health Breach Notification Rule (16 CFR Part 318), HIPAA kapsamı dışındaki "kişisel sağlık kaydı" sağlayan uygulamalara uygulanabilir ve yetkisiz paylaşımı (ör. reklam SDK'sına sağlık verisi gönderimi) da ihlal sayabilir. Kcalculate AI'nın ABD'de sunulması hâlinde bu kural ayrıca incelenmelidir.

### 6.7 Diğer bildirimler
- **İşleyenler:** İşleyen sözleşmelerinde (DPA) işleyenin ihlali Şirket'e **gecikmeksizin** (öneri: en geç 24 saat) bildirme yükümlülüğü bulunur; bildirim gelmesi T0'ı başlatır.
- **Ödeme kuruluşu (PaynKolay):** Kart jetonu veya ödeme akışı etkilendiyse derhâl bildirim; kart verisi şüphesinde PCI DSS süreçleri ödeme kuruluşuyla birlikte yürütülür.
- **Apple / Google:** Hesap güvenliği veya Apple ile Giriş/Google ile Giriş jetonları etkilendiyse ilgili geliştirici destek kanalları; mağaza politikalarının gerektirdiği bildirimler.
- **Pazaryeri ve POS (Trendyol Go, Adisyo):** Kendi müşteri verileri etkilendiyse sözleşmeye göre bildirim.
- **Kolluk:** Suç şüphesinde Emniyet Genel Müdürlüğü Siber Suçlarla Mücadele birimine veya Cumhuriyet Başsavcılığına başvuru (isteğe bağlı; karar verici ve hukuk birlikte karar verir).
- **Sigorta:** Siber sigorta poliçesi varsa poliçedeki süre içinde ihbar `[POLİÇE BİLGİSİ]`.

### 6.8 Kapanış ve olay sonrası inceleme (en geç 30 gün)
- Kök neden analizi, kalıcı düzeltmeler, ilgili politika ve kod değişiklikleri.
- Dersler kaydı; Saklama ve İmha Politikası, envanter ve bu Planın güncellenmesi.
- Olay kaydı kapatılır, İhlal Kayıt Defteri'ne işlenir.

## 7. Özet zaman çizelgesi

| Zaman | Adım | Sorumlu |
|---|---|---|
| T0 | Öğrenme, iç bildirim, olay kaydı | Bildiren → Teknik lider |
| T0+1 sa | İlk değerlendirme, kontrol altına alma, kanıt koruma | Teknik lider |
| T0+24 sa | Kapsam, kişi sayısı, ülke dağılımı, ciddiyet | Teknik lider + Hukuk |
| T0+48 sa | Bildirim metinleri, karar | Hukuk + Karar verici |
| ≤ T0+72 sa | Kurul bildirimi; GDPR otorite bildirimleri | Hukuk |
| Makul en kısa süre | İlgili kişilere bildirim | İletişim + Hukuk |
| ≤ T0+30 gün | Olay sonrası inceleme ve kapanış | İME |

## 8. Kanıtların korunması
- Etkilenen sistemlerin günlükleri (Supabase, Vercel, Sentry) dışa aktarılır ve değiştirilemez bir konumda saklanır; günlük saklama süresi dolmadan alınır.
- Ekran görüntüleri, zaman damgaları, ilgili commit ve deploy kimlikleri kaydedilir.
- Kanıt üzerinde işlem yapan kişiler ve zamanlar not edilir (zincir kaydı).
- Kanıtlar en az ihlal kaydı süresi kadar (5 yıl, öneri) saklanır.

## 9. İletişim şablonları

### 9.1 Kurul bildirimi — form başlıkları (taslak doldurma rehberi)
- Veri sorumlusu bilgileri (unvan, VERBİS no `[varsa]`, adres, irtibat kişisi)
- Bildirimi yapan kişi
- İhlalin başlangıç ve bitiş tarihi/saati, öğrenme tarihi/saati
- İhlalin kaynağı ve nasıl gerçekleştiği (siber saldırı, yetkisiz erişim, kayıp, personel hatası vb.)
- Etkilenen veri kategorileri (özel nitelikli veri var mı?)
- Etkilenen kişi ve kayıt sayısı; kişi grupları (kullanıcı, müşteri, çalışan)
- İhlalin olası sonuçları
- Alınan ve alınacak tedbirler
- İlgili kişilere bildirim yapıldı mı, nasıl, ne zaman
- Yurt dışındaki kişiler etkilendi mi
- Gecikme varsa gerekçesi
- İşleyen kaynaklı ise işleyenin kimliği

### 9.2 İlgili kişilere bildirim — TR şablonu

> **Konu: Hesabınıza ilişkin önemli güvenlik bildirimi**
>
> Merhaba [Ad],
>
> [TARİH] tarihinde [kısa ve anlaşılır açıklama: ne oldu] tespit ettik. Bu olay sonucunda şu bilgileriniz etkilenmiş olabilir: [veri kategorileri]. [Kart numaranız ve şifreniz bu olaydan etkilenmemiştir — yalnız doğruysa.]
>
> Olayı öğrenir öğrenmez şu önlemleri aldık: [önlemler]. Konuyu Kişisel Verileri Koruma Kurulu'na bildirdik.
>
> Sizin için önerimiz: [ör. bağlı e-posta hesabınızın şifresini değiştirmeniz, şüpheli e-posta ve aramalara karşı dikkatli olmanız].
>
> Sorularınız ve KVKK md.11 kapsamındaki haklarınız için: [privacy@…] · [TEL].
>
> Özür dileriz.
> SEKULART LTD ([marka]) — Basın Sitesi Mah. 177/3 Sk. No:3A, 35150 Karabağlar / İzmir

### 9.3 Kullanıcı bildirimi — EN şablonu
Bkz. `en/10-data-breach-response-plan.md` §9.3.

### 9.4 İç olay kaydı şablonu
| Alan | Değer |
|---|---|
| Olay no | `IHL-YYYY-NNN` |
| Öğrenme zamanı (T0) / kaynak | |
| Bildiren | |
| Etkilenen sistem(ler) | |
| Veri kategorileri / özel nitelikli mi | |
| Kişi / kayıt sayısı, ülke dağılımı | |
| Ciddiyet puanı (tür × ölçek × olasılık) | |
| Kontrol altına alma adımları (zamanlı) | |
| Kurul bildirimi (tarih/saat, başvuru no) | |
| Kişi bildirimi (kanal, tarih) | |
| GDPR / ABD / diğer bildirimler | |
| Kök neden | |
| Kalıcı düzeltmeler | |
| Kapanış tarihi, onaylayan | |

## 10. İhlal Kayıt Defteri
Her ihlal (bildirilsin veya bildirilmesin) şu alanlarla kayda geçirilir: olay no; tarih/saatler (başlangıç, öğrenme, kontrol, kapanış); olgular; veri ve kişi kategorileri; kişi sayısı; sonuçlar; alınan tedbirler; bildirim kararları ve gerekçeleri; bildirim tarihleri; sorumlular. Kayıtlar **5 yıl** (öneri) saklanır ve Kurul/otorite talebinde sunulur.

## 11. Senaryolar

### (a) Herkese açık Storage kovasında kişisel veri ifşası
- **Bugünkü risk:** `support-attachments` kovası herkese açık; destek ekleri (fatura, sipariş fotoğrafı, kimlik içerebilir) URL'yi bilen herkesçe okunabilir (`supabase/migrations/20261021132735_storage_public_assets_and_support_attachments.sql:26-44`). `post-media` herkese açık; özel profillerin gönderi medyası da URL ile erişilebilir. `avatars` dosya adı kullanıcı UUID'si.
- **Müdahale:** Kovayı özele çevir; imzalı URL'ye geç; CDN önbelleğini temizle; erişim günlüklerinden dış erişim olup olmadığını tespit et; etkilenen ekleri belirle; ek kimlik/sağlık verisi içeriyorsa S1.

### (b) Supabase servis rolü anahtarının sızması
- **Etkisi:** RLS'yi aşan tam veritabanı ve Storage erişimi → tüm kategoriler, özel nitelikli veri dahil → **S1**.
- **Müdahale:** Anahtarı ve gerekirse JWT gizli anahtarını hemen döndür; edge function ortam değişkenlerini ve web (Vercel) ortam değişkenlerini güncelle; sızıntı kaynağını (repo, CI günlüğü, cihaz) tespit et; Supabase günlüklerinden anahtarla yapılan sorguları incele; Kurul bildirimi 72 saat.

### (c) Adisyo kayıtlarında kişisel veri ifşası
- **Bugünkü risk:** `adisyo_api_log` ve `adisyo_webhook_events` ham istek/yanıtlarda ad, telefon ve adres süresiz tutuluyor (`supabase/migrations/20260508000000_adisyo_phase1.sql:14`; `supabase/functions/adisyo-save-order/index.ts:405`). Bu tablolar diğer kanallardan (Yemeksepeti, Getir vb.) gelen müşterilerin verisini de içerir.
- **Müdahale:** Tabloya erişimi kapat; etkilenen kayıtları ve kanalları belirle; pazaryeri müşterileri etkilendiyse ilgili pazaryerine sözleşmeye göre bildirim; 30 günlük saklama işini devreye al.

### (d) İşleyen kaynaklı ihlal (ör. Anthropic, Sentry, Expo, Resend)
- **Akış:** İşleyen bildirimi T0'ı başlatır. İşleyenden etkilenen veri, zaman aralığı ve tedbirler yazılı istenir.
- **Anthropic özelinde:** Gönderilen veri tabak fotoğrafı, istem ve ipucu ile Keşfet gönderi metni ve görselleridir; kullanıcı kimliği gönderilmez (`supabase/functions/analyze-ai-scan/index.ts:217-227`; `supabase/functions/moderate-content/index.ts:153-175`). Fotoğraf yine de kişiyi belirlenebilir kılabilir (yüz, ev ortamı) ve sağlık bağlamı taşır → ciddiyet en az S2.
- Yurt dışı aktarım standart sözleşmesindeki bildirim hükümleri işletilir.

### (e) Yönetici paneli oturumu açık personel cihazının kaybı
- **Etkisi:** Tüm adreslere (Müşteri 360), profillere, destek taleplerine ve boss paneli müşteri hareketlerine erişim (`supabase/migrations/20260524000000_addresses_admin_select.sql:1-40`; `supabase/migrations/20260926103402_boss_musteri_hareketleri.sql:1-12`).
- **Müdahale:** Kullanıcının oturumlarını Supabase'den sonlandır; e-postasını `admin_allowlist`'ten geçici olarak çıkar; şifre ve 2FA sıfırla; cihaz uzaktan silme (MDM varsa); erişim günlüklerinden kayıp sonrası işlemleri incele; erişim olmadığı kanıtlanamazsa S2.

## 12. Tatbikat ve gözden geçirme
- **Yılda bir** masa başı tatbikat (yukarıdaki senaryolardan biri); sonuçları kayda geçirilir.
- Plan, her gerçek ihlal sonrası ve yılda en az bir kez gözden geçirilir; İME iletişim bilgileri her çeyrek doğrulanır.

| Sürüm | Tarih | Değişiklik | Onaylayan |
|---|---|---|---|
| v0.1-taslak | 2026-11-09 | İlk taslak | — |
