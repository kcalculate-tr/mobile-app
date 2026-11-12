<!-- L-S5 -->
# Gizlilik Politikası + KVKK Aydınlatma + Açık Rıza: kişisel plan ve öğün planı yamaları (TR + EN), TASLAK

> **Durum:** TASLAK, hukuki inceleme için (İlter Öziseven). Yayımlanmadı. 12 Kasım 2026 · dal `legal/global` · oturum L-S5
> **Temel metin:** L-S4 yayın adayı (`~/dev/kcal-web` dal `legal/web-1.1.0` @ 25a097a): `apps/eatkcal/content/legal/gizlilik.ts`, `privacyEn.ts`, `kvkk.ts`, `acikRiza.ts`. Bölüm numaraları bu dosyalardaki numaralardır. Aynı numaralar `docs/legal/tr|en/01-03` (L-S3) için de geçerli.
> **Kaynak:** `L-S5-RIZA-METINLERI.md` (veri akışı tablosu §0.2, ön koşullar K-1…K-4). Kod kanıtları orada.
> **Uygulama kuralı:** Her yama "Konum · Eylem · Metin" biçiminde. **Eylem:** *Değiştir* (eski → yeni), *Ekle* (konumdan sonra), *Yeni bölüm*. Önce TR, sonra EN. Yürürlük tarihi ve "Son güncelleme" yayın günü güncellenir (öneri: ön koşullar bitince tek sürüm).
> **Ön koşul uyarısı:** ⚑ işaretli yamalar ön koşul tamamlanmadan yayımlanırsa metin koddan farklı olur. Ön koşulların listesi `L-S5-KOD-ESLEME.md` §2'de.

---

## A. Gizlilik Politikası (`gizlilik.ts` / `privacyEn.ts`)

### GP-1 · §3 tablo, "Sağlık sayılabilecek veri" satırı: *Değiştir*

**TR, Veriler sütunu.**
Eski: "Cinsiyet, yaş, boy, kilo, hedef, aktivite düzeyi, vücut ölçüleri, öğün/kalori/makro kayıtları, su, etkinlik, AI tarama fotoğrafı ve sonucu"
Yeni: "Cinsiyet, doğum yılı ve yaş, boy, kilo, hedef, hedef kilo ve tempo, aktivite düzeyi, kendi girdiğin günlük adım tahmini, egzersiz türü/sıklığı/süresi, vücut ölçüleri (bel, kalça, göğüs, kol), vücut yağı oranı, beslenme tercihi, sevmediğin yiyecekler, öğün düzeni ve aralıklı oruç tercihi, haftalık tartı kayıtları, öğün/kalori/makro kayıtları, su, etkinlik, AI tarama fotoğrafı ve sonucu"

**TR, Amaç sütunu.**
Eski: "Kişisel kalori/makro hedefi, takip, AI besin tahmini"
Yeni: "Kişisel kalori/makro hedefi, kişisel plan ve öğün planı, takip, AI besin tahmini"

**EN, Data column.**
Old: "Gender, age, height, weight, goal, activity level, body measurements, meal/calorie/macro logs, water, activity, AI scan photo and result"
New: "Gender, birth year and age, height, weight, goal, target weight and pace, activity level, your own daily step estimate, exercise type/frequency/duration, body measurements (waist, hip, chest, arm), body fat percentage, diet preference, disliked foods, meal pattern and intermittent fasting preference, weekly weigh-ins, meal/calorie/macro logs, water, activity, AI scan photo and result"

**EN, Purpose column.**
Old: "Personal calorie/macro target, tracking, AI nutrition estimate"
New: "Personal calorie/macro target, personal plan and meal plan, tracking, AI nutrition estimate"

### GP-2 · §3 tablo, yeni satır ("Sağlık sayılabilecek veri"den sonra): *Ekle*

| Kategori | Veriler | Amaç | KVKK dayanağı | GDPR dayanağı |
|---|---|---|---|---|
| **Alerji ve hassasiyet** | Listeden seçtiğin alerjenler (fıstık, süt, yumurta, gluten, deniz ürünü, kuruyemiş, susam, soya) | Öğün planından ve önerilerden bu alerjenleri içeren yiyecekleri çıkarma | **md.6/3-a (ayrı açık rıza)** | **Art.9(2)(a)** |

| Category | Data | Purpose | KVKK basis | GDPR basis |
|---|---|---|---|---|
| **Allergies and sensitivities** | Allergens you pick from the list (peanut, milk, egg, gluten, seafood, tree nuts, sesame, soy) | Leaving foods with these allergens out of your meal plan and suggestions | **Art. 6(3)(a) (separate explicit consent)** | **Art. 9(2)(a)** |

### GP-3 · §3 "İşlemediklerimiz": *Değiştir*

**TR.**
Eski: "…doğum tarihi (yalnız yaş), arka plan konumu, Apple Sağlık/Health Connect verisi, adım sayısı, özel mesajlaşma."
Yeni: "…doğum tarihi (yalnız doğum yılı ve yaş), arka plan konumu, Apple Sağlık/Health Connect verisi, cihazdan otomatik okunan adım sayısı (kişisel planda adımı yalnız kendi tahminin olarak girersin), hastalık, ilaç ve gebelik bilgisi, özel mesajlaşma."

**EN.**
Old: "…date of birth (age only), background location, Apple Health/Health Connect data, step counts, private messaging."
New: "…date of birth (birth year and age only), background location, Apple Health/Health Connect data, step counts read automatically from your device (in the personal plan you only enter your own step estimate), illness, medication and pregnancy information, private messaging."

> Gerekçe: Kişisel plan "günlük adım" soruyor (`types.ts` `steps`). Eski metin "adım sayısı işlemeyiz" diyordu → çelişki. Kodda Apple Sağlık/Health Connect bağlantısı yok (paket ve izin yok). Ama `pp.steps_hint` "sağlık bağlantısı açıksa kendimiz okuruz" diyor; bu metin de değişmeli (`L-S5-KOD-ESLEME.md`).

### GP-4 · §4 "Sağlık verisi": madde 4 *Değiştir* ⚑ K-2

**TR.**
Eski: "Rızanızı istediğiniz zaman uygulama ayarlarından veya info@eatkcal.com adresine yazarak geri alabilirsiniz. Geri aldığınızda sağlık verileriniz 30 gün içinde imha edilir."
Yeni: "Rızanızı istediğiniz zaman **Profil › Gizlilik › Veri ve reklam izinleri › Sağlık verisi** bölümünden veya info@eatkcal.com adresine yazarak geri alabilirsiniz. Geri aldığınızda sağlık verileriniz, kişisel planınız dâhil, 30 gün içinde imha edilir."

**EN.**
Old: "You can withdraw consent at any time in the app settings or by writing to info@eatkcal.com. Your health data is then destroyed within 30 days."
New: "You can withdraw consent at any time in **Profile › Privacy › Data and ad permissions › Health data** or by writing to info@eatkcal.com. Your health data, including your personal plan, is then destroyed within 30 days."

### GP-5 · Yeni bölüm **4A. Kişisel plan ve öğün planı** (§4'ten sonra) ⚑ K-1, K-2, K-3

**TR**

> **4A. Kişisel plan ve öğün planı**
>
> **Kişisel plan**, hedefine göre günlük kalori ve makro hedefini, hedef tarihini ve ilerleme eğrini hesaplayan kısa bir soru akışıdır.
> - **Sorduklarımız:** doğum yılı, cinsiyet, boy, kilo, hedef, hedef kilo ve tempo, hareket düzeyi, günlük adım tahmini, egzersiz, isteğe bağlı vücut ölçüleri ve vücut yağı oranı, beslenme tercihi, sevmediğin yiyecekler, öğün düzeni ve aralıklı oruç tercihi. Hastalık, ilaç ya da gebelik sormayız.
> - **Dayanak:** Akışın başında istenen sağlık verisi açık rızası ([Açık Rıza Metinleri](/acik-riza-metinleri) §1). Takibe başla'da aynı metinle rıza verdiysen yeniden sorulmaz.
> - **Hesap telefonunda yapılır.** Plan için yapay zekâ kullanılmaz; cevapların **ABD'ye aktarılmaz**. Cevapların ve planın hesabınla birlikte Supabase'in AB'deki sunucularında saklanır (§13).
> - **Kaldığın yerden:** Akışı yarıda bırakırsan cevapların, kaldığın yerden devam edebilmen için saklanır. Planı kaydettiğinde ya da "Baştan başla"yı seçtiğinde bu ara kayıt silinir.
> - **18 yaş altı:** Doğum yılı 18 yaşından küçük olduğunu gösterirse akış durur, plan oluşturulmaz ve o ana kadar verilen cevaplar silinir.
> - **Hatırlatmalar:** Açtığın öğün ve haftalık tartı hatırlatmaları telefonunda kurulur; içerikleri sunucumuza gönderilmez.
> - **Koç:** Planının özeti yalnız ayrıca **kcalAI Koç iznini** verdiysen Koç'a gider (§5B).
>
> **Alerji ve hassasiyet.** Kişisel planda ya da öğün planı formunda alerjen seçebilmek için **ayrı bir açık rıza** istenir ([Açık Rıza Metinleri](/acik-riza-metinleri) §8). Seçtiğin alerjenleri yalnız bu alerjenleri içeren yiyecekleri planından çıkarmak için kullanırız. Kişisel planda seçtiklerin planınla saklanır; kişisel plan olmadan öğün planı formunda seçtiklerin saklanmaz. Rızanı geri aldığında seçimlerin silinir. Alerjen filtresi bir kolaylıktır, tıbbi güvence değildir; ürün içeriklerini her zaman kendin kontrol et.
>
> **Öğün planı.** Haftalık öğün planı, tarif kataloğumuzdan telefonunda, kalori/makro hedefine, beslenme tercihine ve (rızan varsa) alerjenlerine göre oluşturulur. Fresh ve Balance aboneliklerinde açılır. Balance'ta **"Koç'la oluştur"**u seçersen ve Koç iznin açıksa, aday planların özeti, kalori ve protein hedefin, diyet tercihin ve seçtiğin alerjenlerin adları planı sıralaması ve kısa bir açıklama yazması için yapay zekâ sağlayıcımıza (Anthropic PBC, ABD) gönderilir (§5B, §13A).

**EN**

> **4A. Personal plan and meal plan**
>
> The **personal plan** is a short question flow that calculates your daily calorie and macro targets, target date and progress curve for your goal.
> - **What we ask:** birth year, gender, height, weight, goal, target weight and pace, activity level, daily step estimate, exercise, optional body measurements and body fat percentage, diet preference, disliked foods, meal pattern and intermittent fasting preference. We do not ask about illness, medication or pregnancy.
> - **Legal basis:** the health data explicit consent requested at the start of the flow ([Explicit consent forms](/en/legal/consent) §1). If you already consented with the same text in Start tracking, you aren't asked again.
> - **The calculation runs on your phone.** No AI is used for the plan, and your answers are **not transferred to the USA**. Your answers and plan are stored with your account on Supabase servers in the EU (§13).
> - **Resume:** If you leave the flow halfway, your answers are kept so you can continue later. This draft is deleted when you save your plan or choose "Start over".
> - **Under 18:** If the birth year shows you are under 18, the flow stops, no plan is created and the answers given so far are deleted.
> - **Reminders:** Meal and weekly weigh-in reminders you turn on are scheduled on your phone; their content is not sent to our servers.
> - **Coach:** A summary of your plan goes to the Coach only if you have separately given the **kcalAI Coach permission** (§5B).
>
> **Allergies and sensitivities.** To pick allergens in the personal plan or the meal plan form, we ask for a **separate explicit consent** ([Explicit consent forms](/en/legal/consent) §8). We use the allergens you pick only to leave foods containing them out of your plan. Allergens picked in the personal plan are stored with your plan; allergens picked in the meal plan form without a personal plan are not stored. If you withdraw consent, your selections are deleted. The allergen filter is a convenience, not a medical guarantee; always check product ingredients yourself.
>
> **Meal plan.** Your weekly meal plan is built on your phone from our recipe catalogue, based on your calorie/macro targets, diet preference and (with consent) allergens. It is available on Fresh and Balance. On Balance, if you choose **"Build with Coach"** and your Coach permission is on, a summary of the candidate plans, your calorie and protein target, your diet preference and the names of your selected allergens are sent to our AI provider (Anthropic PBC, USA) so it can rank the plans and write a short explanation (§5B, §13A).

### GP-6 · §5B "kcalAI Koç", gönderilenler listesi: *Ekle* (2. maddeden sonra) ⚑ K-1, K-4

**TR**
> - **kişisel planının özeti** (plan oluşturduysan): hedef türün, başlangıç ve hedef kilon, haftalık tempon, günlük kalori ve makro hedeflerin, hedef ve başlangıç tarihin. Ölçülerin, vücut yağı oranın, doğum yılın, adım ve egzersiz bilgilerin gönderilmez;
> - **"Koç'la oluştur"u kullanırsan (Balance):** aday öğün planlarının özeti, kalori ve protein hedefin, diyet tercihin ve (alerji rızan varsa) seçtiğin alerjenlerin adları. Koç yalnız planları sıralar ve kısa bir açıklama yazar; kalori ve makroları değiştirmez. Her kullanım günlük Koç mesajı hakkından 1 düşer;

**EN**
> - **a summary of your personal plan** (if you've created one): goal type, starting and target weight, weekly pace, daily calorie and macro targets, target and start dates. Your measurements, body fat, birth year, steps and exercise details are not sent;
> - **if you use "Build with Coach" (Balance):** a summary of the candidate meal plans, your calorie and protein target, diet preference and (if you've given allergy consent) the names of your selected allergens. The Coach only ranks the plans and writes a short explanation; it does not change calories or macros. Each use counts as 1 of your daily Coach messages;

**§5B "İzin" paragrafı, TR, ek cümle:** "Koç iznini geri aldığında Koç kişisel planını görmez ve \"Koç'la oluştur\" kullanılamaz."
**EN:** "If you withdraw the Coach permission, the Coach no longer sees your personal plan and \"Build with Coach\" is unavailable."

### GP-7 · §8 "Kullanım ölçümü": madde 2 *Değiştir* ⚑ K-5

**TR.**
Eski: "Olay kayıtlarına adınız, telefonunuz, e-postanız, adresiniz, konumunuz ve beslenme kayıtlarınızın içeriği eklenmez."
Yeni: "Olay kayıtlarına adınız, telefonunuz, e-postanız, adresiniz, konumunuz, beslenme kayıtlarınızın içeriği, kişisel plan cevaplarınız (kilo, ölçü, hedef) ve alerjenleriniz eklenmez."

**EN.**
Old: "Your name, phone, e-mail, address, location and the content of your nutrition logs are not included."
New: "Your name, phone, e-mail, address, location, the content of your nutrition logs, your personal plan answers (weight, measurements, goal) and your allergens are **not** included."

> K-5: Bugün `pp_saved` olayı `goal` (kilo ver/koru/al/dengeli), `pp_checkin` olayı `kind` (hedefte/yavaş/hızlı/dalgalı) taşıyor (`src/lib/metrics/events.ts:213,215`). Bunlar sağlıkla ilişkili sınıflardır. Ya bu iki alan olaydan çıkarılır (öneri) ya da yeni cümleden "hedef" sözcüğü çıkarılıp §8'e "kişisel plan hedef türü" açıkça yazılır ve dayanak yeniden değerlendirilir (meşru menfaat özel nitelikli veri için dayanak olamaz).

### GP-8 · §9 "Bildirimler": madde 2 *Değiştir*

**TR.**
Eski: "**Hatırlatıcılar** (öğün, seri) bildirim ayarlarından kapatılabilir."
Yeni: "**Hatırlatıcılar** (öğün, seri, kişisel planın öğün saatleri ve haftalık tartı) bildirim ayarlarından kapatılabilir. Kişisel plan hatırlatmaları telefonunda kurulur."

**EN.**
Old: "**Reminders** (meals, streaks) can be turned off in notification settings."
New: "**Reminders** (meals, streaks, your personal plan's meal times and weekly weigh-in) can be turned off in notification settings. Personal plan reminders are scheduled on your phone."

### GP-9 · §13A "AI özellikleri için yurt dışına aktarım": ilk paragraf *Değiştir* ⚑ K-1

**TR.**
Eski: "AI tarama (fotoğraf, not, sesli giriş metni) ve kcalAI Koç kullandığında §5A ve §5B'de sayılan veriler **ABD'deki** yapay zekâ sağlayıcımız Anthropic PBC'ye; …"
Yeni: "AI tarama (fotoğraf, not, sesli giriş metni), kcalAI Koç ve Koç'la öğün planı oluşturma kullandığında §5A, §5B ve §4A'da sayılan veriler **ABD'deki** yapay zekâ sağlayıcımız Anthropic PBC'ye; …"

**EN.**
Old: "When you use AI scan (photo, note, voice-entry text) and kcalAI Coach, the data listed in §5A and §5B is transferred to our AI provider Anthropic PBC in the **USA**; …"
New: "When you use AI scan (photo, note, voice-entry text), kcalAI Coach and building a meal plan with the Coach, the data listed in §5A, §5B and §4A is transferred to our AI provider Anthropic PBC in the **USA**; …"

**§13A ikinci madde listesi, TR, ek cümle:** "Kişisel plan cevapları ve alerjenler için ayrıca: kişisel plan **hesabı** ve alerjen filtresi yurt dışına aktarım gerektirmez (telefonda yapılır, AB'de saklanır); ABD'ye yalnız Koç izniyle ve §5B'de sayılan özet gider."
**EN:** "For personal plan answers and allergens: the personal plan **calculation** and the allergen filter do not require a transfer to the USA (they run on your phone and are stored in the EU); only the summary listed in §5B goes to the USA, and only with the Coach permission."

### GP-10 · §14 "Saklama süreleri" tablosu: *Ekle* ("Sağlık verisi" satırından sonra) ⚑ K-2, K-3

| Veri | Süre |
|---|---|
| Kişisel plan ve cevaplar | Hesap süresince veya sağlık verisi rızası geri alınana kadar; sonra 30 gün içinde imha |
| Yarım kalan kişisel plan akışı (ara kayıt) | Plan kaydedilene ya da "Baştan başla" seçilene kadar; 18 yaş altı tespit edilince hemen silinir |
| Alerji ve hassasiyet seçimi | Rıza sürdükçe; geri alınınca hemen, yedeklerden 30 gün içinde silinir. Kişisel plan olmadan öğün planı formunda seçilenler saklanmaz |

| Data | Period |
|---|---|
| Personal plan and answers | While the account exists or until health data consent is withdrawn; then destroyed within 30 days |
| Unfinished personal plan flow (draft) | Until the plan is saved or "Start over" is chosen; deleted immediately if the user is found to be under 18 |
| Allergy and sensitivity selection | While consent stands; deleted immediately on withdrawal, from backups within 30 days. Selections in the meal plan form without a personal plan are not stored |

> **Açık nokta:** Yarım kalan ara kayıt için azami süre yok (kullanıcı hiç dönmezse süresiz kalır). Öneri: 90 gün sonra silinsin (sunucu işi gerekir). İlter karar verecek (LOG soru 5).

### GP-11 · §17.7 "Tüketici sağlık verisi (Washington MHMDA, Nevada SB 370)": madde 1 *Değiştir*

**TR.**
Eski: "Tüketici sağlık verisini (kilo, ölçüler, öğün/kalori kayıtları, tarama fotoğrafları) yalnız **ayrı onayınızla** toplarız."
Yeni: "Tüketici sağlık verisini (kilo, ölçüler, vücut yağı oranı, kişisel plan cevapları, alerjenler, öğün/kalori kayıtları, tarama fotoğrafları) yalnız **ayrı onayınızla** toplarız."

**EN.**
Old: "We collect consumer health data (weight, measurements, meal/calorie logs, scan photos) only with your **separate consent**."
New: "We collect consumer health data (weight, measurements, body fat percentage, personal plan answers, allergens, meal/calorie logs, scan photos) only with your **separate consent**."

### GP-12 · §18 "Çocuklar": *Ekle* (mevcut paragraftan sonra) ⚑ K-3

**TR:** "Kişisel plan akışında doğum yılı 18 yaşından küçük olduğunu gösterirse akış durdurulur, plan oluşturulmaz ve o ana kadar verilen cevaplar silinir."
**EN:** "In the personal plan flow, if the birth year shows the user is under 18, the flow is stopped, no plan is created and the answers given so far are deleted."

---

## B. KVKK Aydınlatma Metni (`kvkk.ts`; `docs/legal/tr|en/02`)

### KA-1 · §3 (A) tablo, "Sağlık verisi" satırı: *Değiştir*

**TR, Veri kategorisi sütunu.**
Eski: "**Sağlık verisi** (özel nitelikli): cinsiyet, yaş, boy, kilo, hedef, aktivite düzeyi, vücut ölçüleri, öğün/kalori/makro kayıtları, su, etkinlik"
Yeni: "**Sağlık verisi** (özel nitelikli): cinsiyet, doğum yılı ve yaş, boy, kilo, hedef, hedef kilo ve tempo, aktivite düzeyi, günlük adım tahmini, egzersiz bilgisi, vücut ölçüleri, vücut yağı oranı, beslenme tercihi, sevilmeyen yiyecekler, öğün düzeni ve aralıklı oruç tercihi, haftalık tartı kayıtları, öğün/kalori/makro kayıtları, su, etkinlik"

**TR, Amaç sütunu.** Eski: "Kişisel kalori/makro hedefi ve takip" → Yeni: "Kişisel kalori/makro hedefi, kişisel plan ve öğün planı, takip"
**TR, Alıcı grupları sütunu.** Eski: "Barındırma sağlayıcısı" → Yeni: "Barındırma sağlayıcısı (Supabase, AB'de barındırma); kcalAI Koç izni verilmişse plan özeti için AI hizmet sağlayıcısı (Anthropic, ABD)"

**EN** (`docs/legal/en/02`, web'de EN KVKK sayfası henüz TR gösteriyor, L-S4 SORULAR 6):
Data category: "**Health data** (special category): gender, birth year and age, height, weight, goal, target weight and pace, activity level, daily step estimate, exercise details, body measurements, body fat percentage, diet preference, disliked foods, meal pattern and intermittent fasting preference, weekly weigh-ins, meal/calorie/macro logs, water, activity"
Purpose: "Personal calorie/macro target, personal plan and meal plan, tracking"
Recipients: "Hosting provider (Supabase, EU hosting); if the kcalAI Coach permission is given, the AI service provider (Anthropic, USA) for the plan summary"

### KA-2 · §3 (A) tablo, yeni satır ("Sağlık verisi"nden sonra): *Ekle* ⚑ K-1

| Veri kategorisi | Amaç | Hukuki sebep | Toplama yöntemi | Alıcı grupları |
|---|---|---|---|---|
| **Alerji ve hassasiyet** (özel nitelikli): listeden seçilen alerjenler | Öğün planından bu alerjenleri içeren yiyecekleri çıkarma | **6/3-a (ayrı açık rıza)** | Uygulama formu (kişisel plan, öğün planı) | Barındırma sağlayıcısı; Balance "Koç'la oluştur" ve Koç izni varsa alerjen adları için AI hizmet sağlayıcısı (Anthropic, ABD) |

| Data category | Purpose | Legal basis | Collection method | Recipients |
|---|---|---|---|---|
| **Allergies and sensitivities** (special category): allergens selected from the list | Leaving foods with these allergens out of the meal plan | **6(3)(a) (separate explicit consent)** | App form (personal plan, meal plan) | Hosting provider; for Balance "Build with Coach" with the Coach permission, the AI service provider (Anthropic, USA) for allergen names |

### KA-3 · §3 (A) tablo, "kcalAI Koç" satırı: Veri kategorisi *Değiştir* ⚑ K-4

**TR.**
Eski: "…Koça yazdığınız mesajlar, Koç yanıtları ve yanıt için kullanılan günlük takip özeti (cinsiyet, kalori ve makro hedefleri, günlük toplamlar, son öğünler)"
Yeni: "…Koça yazdığınız mesajlar, Koç yanıtları, yanıt için kullanılan günlük takip özeti (cinsiyet, kalori ve makro hedefleri, günlük toplamlar, son öğünler), kişisel plan özeti (hedef, başlangıç ve hedef kilo, tempo, hedef tarihi) ve Koç'la öğün planı oluşturulursa diyet tercihi ve alerjen adları"

**EN.**
New: "…messages you write to the Coach, its replies, the daily tracking summary used for replies (gender, calorie and macro targets, daily totals, recent meals), a personal plan summary (goal, starting and target weight, pace, target date) and, when a meal plan is built with the Coach, diet preference and allergen names"

### KA-4 · §3A "Yapay zekâ özellikleri ve abonelikler": *Ekle* (2. maddeden sonra) ⚑ K-1, K-4

**TR:**
> "**Kişisel plan ve alerjenler.** Kişisel plan telefonunuzda hesaplanır; plan cevaplarınız ve alerjen seçimleriniz ABD'ye aktarılmaz. Yalnız kcalAI Koç iznini verdiyseniz Koç, planınızın özetini görür. Balance'ta \"Koç'la oluştur\"u kullanırsanız diyet tercihiniz ve alerjen adlarınız da gönderilir. Alerjen bilgisi için ayrı açık rıza istenir: [Açık Rıza Metinleri](/acik-riza-metinleri) §1 ve §8."

**EN:**
> "**Personal plan and allergens.** Your personal plan is calculated on your phone; your plan answers and allergen selections are not transferred to the USA. Only if you've given the kcalAI Coach permission does the Coach see a summary of your plan. If you use \"Build with Coach\" on Balance, your diet preference and allergen names are sent too. Allergen details require a separate explicit consent: [Explicit consent forms](/en/legal/consent) §1 and §8."

### KA-5 · §8 "Yurt dışına aktarım": ilk paragraf *Değiştir*

**TR.**
Eski: "…AI hizmeti (Anthropic — ABD; AI tarama, sesli giriş metni, kcalAI Koç ve içerik ön denetimi), …"
Yeni: "…AI hizmeti (Anthropic — ABD; AI tarama, sesli giriş metni, kcalAI Koç, Koç'la öğün planı oluşturma ve içerik ön denetimi), …"

**TR, 4. madde ek cümle:** "Kişisel plan cevapları Türkiye dışında yalnız AB'deki barındırma sunucusunda saklanır (standart sözleşme); ABD'ye yalnız Koç izniyle plan özeti gider."

**EN.**
New (same position): "…AI service (Anthropic, USA; AI scan, voice entry text, kcalAI Coach, building meal plans with the Coach, and content pre-screening), …" · Added sentence: "Personal plan answers are stored outside Türkiye only on the EU hosting server (standard contract); only the plan summary goes to the USA, and only with the Coach permission."

---

## C. Açık Rıza Metinleri (`acikRiza.ts`; `docs/legal/tr|en/03`)

> Görevde yalnız Gizlilik + KVKK istendi. Açık Rıza sayfası, ekrandaki "Aydınlatma metni" bağlantılarının web karşılığı olduğundan aynı yamaya eklendi.

### AR-1 · §1 "Sağlık Verisinin İşlenmesine İlişkin Açık Rıza": "Hangi veriler?" listesi *Ekle* (1. maddeden sonra)

**TR:** "kişisel plan için: doğum yılı, hedef kilo ve tempo, günlük adım tahmini, egzersiz türü/sıklığı/süresi, vücut yağı oranı, kol ölçüsü, beslenme tercihi, sevilmeyen yiyecekler, öğün düzeni ve aralıklı oruç tercihi, haftalık tartı kayıtları;"
**EN:** "for the personal plan: birth year, target weight and pace, daily step estimate, exercise type/frequency/duration, body fat percentage, arm measurement, diet preference, disliked foods, meal pattern and intermittent fasting preference, weekly weigh-ins;"

**§1 "Ne için?" TR:** "…kişisel kalori ve makro hedefinizi hesaplamak, **kişisel planınızı ve öğün planınızı oluşturmak**, öğünlerinizi ve ilerlemenizi takip etmek…"
**EN:** "…to calculate your personal calorie and macro targets, **create your personal plan and meal plan**, track your meals and progress…"

**§1 "Kimlere aktarılır?", Anthropic maddesi, TR ek:** "Kişisel planınızın özeti yalnız kcalAI Koç iznini verdiyseniz Koç'a gider (§6)."
**EN:** "A summary of your personal plan goes to the Coach only if you've given the kcalAI Coach permission (§6)."

**§1 "Nasıl geri alınır?" TR** ⚑ K-2: "Profil › Gizlilik › Veri ve reklam izinleri › Sağlık verisi bölümünden veya info@eatkcal.com adresine yazarak."
**EN:** "In Profile › Privacy › Data and ad permissions › Health data, or by writing to info@eatkcal.com."

> Web §1 onay kutusu metni, uygulamadaki ekran metninden geniştir (AI tarama ve yurt dışı aktarımı da kapsar). Uygulamada bu rıza iki parçaya ayrılmış durumda: sağlık verisi kutusu (`L-S5-RIZA-METINLERI.md` §1a) + "Fotoğraf ve ses analizi" izni (§5). Web kutu metninin uygulamayla birebir olması gerekmiyor, ama "yurt dışındaki hizmet sağlayıcılara aktarılmasına" ifadesi kişisel plan için yanlış izlenim veriyor (plan ABD'ye gitmez). Öneri: web kutu metni "…kalori takibi, kişisel plan ve AI besin tahmini amacıyla…; AI besin tahmini için yurt dışındaki hizmet sağlayıcıya aktarılmasına…" olarak ayrıştırılsın (LOG soru 6).

### AR-2 · §6 "kcalAI Koç ve Yapay Zekâ İzni": izin metni *Değiştir* ⚑ K-4, İlter onayı

Önerilen sürüm 2 metni (TR/EN) ve uzun metin eki: `L-S5-RIZA-METINLERI.md` §1c. Onaylanırsa §6'daki B-30 metni bununla değiştirilir.

### AR-3 · Yeni bölüm **8. Alerji ve Hassasiyet Bilgisi Açık Rızası** (§7'den sonra; §7 "bilgi" bölümü olduğu için sona eklenir)

Tam metin (TR/EN): `L-S5-RIZA-METINLERI.md` §1b "Uzun metin". Web'de "siz" diline uyarlanır. Onay kutusu notu:

**TR:** "☐ Alerji ve hassasiyet bilgilerimin planımdan çıkarılacak yiyecekleri belirlemek için işlenmesine açık rıza veriyorum."
**EN:** "☐ I give explicit consent to the processing of my allergy and sensitivity details to decide which foods to leave out of my plan."

---

## D. Uygulama sırası (öneri)

1. Ön koşullar K-1…K-5 (kod; ayrı oturum, `L-S5-KOD-ESLEME.md` §2).
2. İlter kararları: §1a-not (ortak rıza sürümü), §1c (Koç izni sürüm 2), GP-10 ara kayıt süresi.
3. Bu yamalar `docs/legal/tr|en/01-03`'e ve kcal-web `legal/web-1.1.0` üzerindeki dört dosyaya aynı anda işlenir. Yürürlük tarihi tek.
4. Mağaza eşlemesi (`MAGAZA_GIZLILIK_ESLEME.md` §5) konsolda aynı gün güncellenir.
