<!-- L-S5 -->
# Kişisel plan ve öğün planı: rıza ve aydınlatma metinleri (TR + EN), TASLAK

> **Durum:** TASLAK, hukuki inceleme için (İlter Öziseven). Yayımlanmadı. 12 Kasım 2026 · dal `legal/global` · oturum L-S5
> **Kapsam:** G33 öğün planı (alerjen filtresi, rıza kaynağı `meal_plan`), G34 kişisel plan (rıza kaynağı `personal_plan`), G36 Koç'un kişisel planı okuması, Tur 26q takip kapısı ve abonelik teklifi ekranları.
> **Kod tabanı:** `release/1.1.0` @ dbde88f (bu dala `8d69e79` ile birleştirildi). Kanıtlar `dosya:satır` biçiminde.
> **İlişkili dosyalar:** `L-S5-POLITIKA-EKLERI.md` (Gizlilik + KVKK yamaları), `L-S5-KOD-ESLEME.md` (koddaki TASLAK metinler → bu metinler, ön koşullar), `MAGAZA_GIZLILIK_ESLEME.md` §5.
> **Yazım kuralı:** Ekran metinleri uygulamanın sesiyle "sen" diye yazıldı; uzun metinler de aynı sesle (uygulama içinde açılıyor). Web'deki Açık Rıza sayfası "siz" dilini kullanıyor; web'e taşınırken ses uyarlanmalı.

---

## 0. Önce okunacaklar

### 0.1 Bu metinler hangi kod durumunu anlatıyor?

Metinler **ön koşullar tamamlandıktan sonraki** durumu anlatır. Bugünkü kod dört noktada metinden farklıdır. Ön koşullar bitmeden metin yayımlanırsa metin yanlış olur. Ayrıntı ve kanıt: `L-S5-KOD-ESLEME.md` §2.

| # | Ön koşul | Bugünkü kod | Etkilediği metin |
|---|---|---|---|
| **K-1** | Balance "Koç'la oluştur" yalnız Koç AI izni açıkken çalışsın | Alerjenler, diyet ve kalori/protein hedefi Koç izni sorulmadan Anthropic'e (ABD) gidiyor: `src/modules/plan/screens/PlanGenerateScreen.tsx:166-169`, `supabase/functions/meal-plan-generate/rank.ts:76-80`. İzin kontrolü yok | 1b, 1c |
| **K-2** | Uygulama içinde sağlık verisi ve alerji rızasını geri alma yolu + geri alınınca silme | Ayarlarda yok (`SettingsDataConsentScreen.tsx` yalnız ölçüm ve AI izinleri). `recordHealthConsent(false)` / `recordAllergenConsent(false)` hiçbir yerden çağrılmıyor | 1a, 1b |
| **K-3** | 18 yaş altında o ana kadarki cevaplar silinsin | `MinorStep` yalnız `navigation.goBack()` yapıyor (`PersonalPlanFlowScreen.tsx:246-247`). Önceki adımda yazılan ara kayıt (`personal_plan_progress` + cihaz) silinmiyor | 1a |
| **K-4** | Koç izni metni kişisel planı ve Koç'la oluşturmayı kapsasın (sürüm 2, yeniden sorma) | Onaylı metin (B-30) yalnız "Koça yazdıkların ve günlük takip özetin" diyor; `COACH_CONSENT_VERSION = 1` (`src/modules/coach/access.ts:72`) | 1c |

### 0.2 Bu metinlerin dayandığı veri akışı (koddan doğrulandı)

| Veri | Nerede tutulur | ABD'ye gider mi? | Kanıt |
|---|---|---|---|
| Kişisel plan cevapları (doğum yılı, cinsiyet, boy, kilo, hedef, tempo, hareket, adım, egzersiz, ölçüler, vücut yağı, diyet, sevmediklerin, öğün düzeni, aralıklı oruç, hatırlatmalar) | Cihaz + Supabase `user_nutrition_profiles.personal_plan` (jsonb) + tipli kolonlar | **Hayır** (hesap telefonda yapılır, AI kullanılmaz) | `src/modules/personalPlan/types.ts:53-77`; `calc.ts` (saf istemci hesabı); migration `20261112110100_g34_personal_plan.sql` |
| Yarım kalan akışın cevapları ("Kaldığın yerden") | Cihaz + Supabase `personal_plan_progress` | Hayır | `api.ts:280-300`; migration `…g34_personal_plan.sql:85-93`; plan kaydedilince silinir `PersonalPlanFlowScreen.tsx:184` |
| Alerjen seçimi (kişisel plan) | `personal_plan.answers.allergens` | Yalnız Koç'la oluşturmada (K-1) | `questions.tsx:520-530` |
| Alerjen seçimi (öğün planı formu, kişisel plan kapalıyken) | Yalnız ekran durumu, sunucuya yazılmaz | Yalnız Koç'la oluşturmada (K-1) | `PlanGenerateScreen.tsx:80-81,133` |
| Koç'a giden plan özeti | — | **Evet, yalnız Koç izni açıksa**: hedef türü, başlangıç ve hedef kilo, tempo, günlük kalori ve makrolar, hedef tarihi, başlangıç tarihi | `supabase/functions/coach-chat/plan.ts:11-25,43-68`; izin `index.ts:92-108` |
| Koç'la oluştur (Balance) | — | **Evet**: kalori ve protein hedefi, diyet, alerjen adları, aday plan özetleri. Kullanıcı kimliği gönderilmez | `meal-plan-generate/index.ts:72-81`; `rank.ts:17-19,76-80` |
| Hatırlatmalar | Telefonda planlanır (yerel bildirim) | Hayır | `reminders.ts:50` |
| Kullanım ölçümü | Birinci taraf | Hayır (Meta'ya da gitmez) | `src/lib/metrics/events.ts:208-216`; `pp_saved.goal` ve `pp_checkin.kind` sağlıkla ilişkili sınıflar taşır, bkz. K-5 (`L-S5-KOD-ESLEME.md`) |
| Sağlık notu / hastalık / ilaç / gebelik | **Toplanmıyor**. Akışta böyle bir alan yok; yalnız uyarı metni var (`pp.safety_note`) | — | `types.ts:53-77` |

**Rıza kayıtları:** her onay `user_consents` tablosuna ayrı satır olarak yazılır: kind `health_data`, kaynak `personal_plan` / `meal_plan` / `takibe`, platform, uygulama sürümü, zaman (`src/lib/consent/store.ts:302-352`). **Metnin kimliği ve sürümü bugün satıra yazılmıyor** (`doc_slug: null, doc_version: null`). Yalnız cihazda `v` (sürüm) tutuluyor. Öneri K-6: sürüm satıra yazılsın (ispat için).

### 0.3 Ekran kuralları (dört rıza için ortak)

1. Her rıza **ayrı kutu**. Kutular **boş** başlar. "Hepsini kabul et" yok.
2. Aydınlatma, rızadan **ayrı** sunulur: kutunun altında "Aydınlatma metni" bağlantısı, uzun metni açar. Uzun metin önce aydınlatma bölümünü, sonra rıza beyanını içerir. (Aydınlatma Tebliği md.5; Kurum'un Açık Rıza Rehberi: aydınlatma ile açık rıza ayrı yapılmalı.)
3. Bağlantı **bu belgenin ilgili uzun metnini** açmalı. Bugün `pp.consent_notice` genel Gizlilik Politikası'nı açıyor (`entry.tsx:74`). Bkz. `L-S5-KOD-ESLEME.md`.
4. Kısa ekran metni en çok 2 cümle. Kutunun yanındaki cümle rıza beyanıdır. İkinci cümle (varsa) geri alma veya kapsam bilgisidir.
5. Metin değişirse sürüm artar ve yeniden onay istenir (`HEALTH_CONSENT_VERSION`, `ALLERGEN_CONSENT_VERSION`, `COACH_CONSENT_VERSION`).
6. "TASLAK" rozeti bu metinler onaylanınca kaldırılır (`pp.consent_draft`).

---

## 1a. Kişisel plan: sağlık verisi açık rızası

**Nerede:** Kişisel plan › Giriş kartı (`src/modules/personalPlan/screens/flow/entry.tsx:65-78`). Aynı rıza Takibe başla › Seni tanıyalım'da da kullanılıyor (aynı cihaz anahtarı `@kcal_health_consent`, `store.ts:282`). Öneri: iki ekranda **aynı metin**, sürüm 2 (bkz. §1a-not).

### Ekran metni, TR

> ☐ **Boy, kilo, vücut ölçüleri, hedef, hareket ve beslenme bilgilerimin kişisel planımı hesaplamak için işlenmesine açık rıza veriyorum.**
> Rızanı istediğin zaman Profil › Gizlilik › Veri ve reklam izinleri'nden geri alabilirsin.
>
> [Aydınlatma metni]

- Kutu onaylıyken (önceden verilmiş geçerli rıza): "Onaylandı" (mevcut `pp.consent_health_done`, değişmez).
- Kutu boşken ipucu: "Başlamak için açık rıza kutusunu işaretle." (mevcut `pp.consent_hint`, değişmez).

### Screen text, EN

> ☐ **I give explicit consent to the processing of my height, weight, body measurements, goal, activity and diet details to calculate my personal plan.**
> You can withdraw this at any time in Profile › Privacy › Data and ad permissions.
>
> [Privacy notice]

### Uzun metin, TR: "Kişisel plan: sağlık verisi aydınlatma metni ve açık rıza"

**1. Veri sorumlusu.** SEKULART LTD (MERSİS 0759-1148-7410-0001), Basın Sitesi Mah. 177/3 Sk. No:3A, 35150 Karabağlar / İzmir · info@eatkcal.com · +90 232 332 21 00.

**2. Hangi verileri işliyoruz?**
- Doğum yılın (yalnız yaşını hesaplamak için) ve cinsiyetin;
- boyun, kilon, hedefin (kilo vermek, korumak, almak ya da dengeli beslenmek), hedef kilon ve seçtiğin tempo;
- hareket düzeyin, günlük adım sayın (kendi girdiğin tahmin), egzersiz türün, haftada kaç gün ve kaç dakika egzersiz yaptığın;
- isteğe bağlı olarak bel, kalça, göğüs ve kol ölçülerin ile vücut yağı oranın;
- beslenme tercihin (ör. vejetaryen), sevmediğin yiyecekler, öğün sayın ve saatlerin, aralıklı oruç tercihin;
- planı kullanırken girdiğin haftalık tartı kayıtları ve hatırlatma tercihlerin.

Hastalık, ilaç, gebelik ya da başka bir sağlık durumu **sormayız**. Bu bilgileri bir alana yazmanı da istemeyiz. Alerji ve hassasiyet bilgilerin bu rızanın kapsamında değildir; onlar için ayrı rıza istenir.

**3. Ne için işliyoruz?**
- Günlük kalori ve makro hedefini, hedef tarihini ve ilerleme eğrini hesaplamak;
- öğün planını tercihlerine göre önermek;
- planını Profil'de göstermek, düzenlemene ve haftalık tartıyla güncellemene izin vermek;
- yarıda bıraktığın akışa kaldığın yerden dönebilmeni sağlamak;
- açtığın hatırlatmaları planındaki saatlere göre kurmak. Hatırlatmalar telefonunda kurulur.

Bu verileri **reklam için kullanmayız**, Meta'ya ya da başka bir reklam ortağına göndermeyiz ve satmayız.

**4. Hukuki sebep.** Bu verilerin bir kısmı sağlık verisidir, yani özel nitelikli kişisel veridir. Hepsini aynı amaç için birlikte işlediğimizden tamamı için **açık rızana** dayanırız: KVKK md.6/3-a; GDPR Art.9(2)(a).

**5. Nerede saklanır, kimlere aktarılır?**
- Plan **telefonunda hesaplanır**. Hesap için yapay zekâ kullanılmaz ve hiçbir yapay zekâ hizmetine veri gönderilmez.
- Cevapların ve planın, hesabınla birlikte veri barındırma sağlayıcımız Supabase'in **Avrupa Birliği'ndeki** sunucularında ve telefonunda saklanır. AB'deki sunucuda saklama da KVKK açısından yurt dışına aktarımdır. Bu aktarım için KVKK md.9 uyarınca Kurul'un ilan ettiği standart sözleşmeyi imzalar ve Kurum'a bildiririz.
- Bu rıza kapsamındaki veriler **ABD'ye aktarılmaz**.
- **Tek istisna kcalAI Koç'tur. Koç'u yalnız sen ayrıca izin verirsen kullanabilirsin.** Koç iznini açarsan planının kısa bir özeti (hedef türü, başlangıç ve hedef kilon, tempon, günlük kalori ve makro hedeflerin, hedef tarihin) Koç'un yanıtları için yapay zekâ sağlayıcımıza (Anthropic PBC, ABD) gönderilir. Bu gönderim bu rızaya değil, **Koç iznine** dayanır. Ölçülerin, vücut yağı oranın, doğum yılın, adım ve egzersiz bilgilerin Koç'a gönderilmez.
- Verilerine yalnız hizmeti sağlamak için gereken çalışanlarımız ve veri işleyenimiz Supabase erişir.

**6. Ne kadar saklarız?**
- Hesabın açık olduğu ve rızan sürdüğü sürece saklarız.
- Akışı yarıda bırakırsan, kaldığın yerden devam edebilmen için cevapların saklanır. Planı kaydettiğinde ya da "Baştan başla"yı seçtiğinde bu ara kayıt silinir.
- Doğum yılın 18 yaşından küçük olduğunu gösterirse akış durur, plan oluşturulmaz ve o ana kadar verdiğin cevaplar silinir.
- Rızanı geri aldığında ya da hesabını sildiğinde planın ve cevapların **30 gün içinde** imha edilir.

**7. Rıza vermezsen ne olur?** Kişisel plan ve kişisel kalori hedefi hesaplanamaz. eatkcal siparişi, Keşfet ve tarifler gibi sağlık verisi gerektirmeyen özellikleri kullanmaya devam edebilirsin.

**8. Rızanı nasıl geri alırsın?** Profil › Gizlilik › Veri ve reklam izinleri › Sağlık verisi'nden ya da info@eatkcal.com adresine yazarak. Geri almak ücretsizdir. Geri alma ileriye etkilidir: geri almadan önce yapılan işleme hukuka uygun kalır.

**9. Hakların.** KVKK md.11 ve GDPR kapsamındaki haklarını (bilgi isteme, düzeltme, silme, itiraz, taşınabilirlik vb.) ve başvuru yolunu KVKK Aydınlatma Metni ile Gizlilik Politikası anlatır.

**10. Kayıt.** Rızanı verdiğin ya da geri aldığın zaman, metnin sürümü, kanal (kişisel plan / Takibe başla / ayarlar), cihaz platformu ve uygulama sürümü kaydedilir. Bu kayıt, rıza geri alındıktan sonra ispat için 3 yıl saklanır.

**Açık rıza beyanı.** ☐ Yukarıdaki metni okudum. Boy, kilo, vücut ölçüleri, hedef, hareket ve beslenme bilgilerimin kişisel planımı hesaplamak için işlenmesine açık rıza veriyorum.

### Long text, EN: "Personal plan: health data privacy notice and explicit consent"

**1. Controller.** SEKULART LTD (MERSIS 0759-1148-7410-0001), Basın Sitesi Mah. 177/3 Sk. No:3A, 35150 Karabağlar / İzmir, Türkiye · info@eatkcal.com · +90 232 332 21 00.

**2. What we process**
- Your birth year (only to work out your age) and gender;
- your height, weight, goal (lose, maintain, gain or eat more balanced), target weight and chosen pace;
- your activity level, daily steps (your own estimate), exercise type, and how many days a week and minutes you exercise;
- optionally, your waist, hip, chest and arm measurements and body fat percentage;
- your diet preference (e.g. vegetarian), foods you dislike, number and times of meals, and intermittent fasting preference;
- weekly weigh-ins and reminder settings you enter while using the plan.

We **do not ask** about illnesses, medication, pregnancy or any other health condition, and we don't ask you to type them anywhere. Allergy and sensitivity details are not covered by this consent; they have a separate consent.

**3. Why**
- To calculate your daily calorie and macro targets, target date and progress curve;
- to suggest a meal plan that fits your preferences;
- to show your plan in Profile and let you edit it and update it with weekly weigh-ins;
- to let you resume the flow where you left off;
- to schedule the reminders you turn on at your plan's times. Reminders are scheduled on your phone.

We **do not use this data for advertising**, do not send it to Meta or any other ad partner, and do not sell it.

**4. Legal basis.** Some of this data is health data, a special category of personal data. Because we process all of it together for one purpose, we rely on your **explicit consent** for all of it: KVKK Art.6(3)(a); GDPR Art.9(2)(a).

**5. Where it is stored and who receives it**
- Your plan is **calculated on your phone**. No AI is used for the calculation and no data is sent to any AI service.
- Your answers and plan are stored on your phone and with your account on servers of our hosting provider Supabase **in the European Union**. Under KVKK, storage on an EU server is also a transfer abroad; for it we sign the standard contract published by the Turkish Data Protection Board and notify the Authority (KVKK Art.9).
- Data covered by this consent is **not transferred to the USA**.
- **The only exception is kcalAI Coach, which you can only use if you give a separate permission.** If you turn on the Coach permission, a short summary of your plan (goal type, starting and target weight, pace, daily calorie and macro targets, target date) is sent to our AI provider (Anthropic PBC, USA) so the Coach can reply. That transfer is based on the **Coach permission**, not on this consent. Your measurements, body fat, birth year, steps and exercise details are not sent to the Coach.
- Only staff who need it to provide the service, and our processor Supabase, can access your data.

**6. How long**
- For as long as your account is open and your consent stands.
- If you leave the flow halfway, your answers are kept so you can resume. This draft is deleted when you save your plan or choose "Start over".
- If your birth year shows you are under 18, the flow stops, no plan is created, and the answers you gave up to that point are deleted.
- If you withdraw consent or delete your account, your plan and answers are destroyed **within 30 days**.

**7. If you don't consent.** We can't calculate a personal plan or a personal calorie target. You can keep using features that don't need health data, such as eatkcal ordering, Discover and recipes.

**8. How to withdraw.** In Profile › Privacy › Data and ad permissions › Health data, or by writing to info@eatkcal.com. Withdrawing is free. It works from that point on; processing before you withdrew stays lawful.

**9. Your rights.** Your rights under KVKK Art.11 and the GDPR (access, rectification, erasure, objection, portability and more), and how to use them, are explained in the KVKK Privacy Notice and the Privacy Policy.

**10. Record.** We record when you gave or withdrew consent, the text version, the channel (personal plan / Start tracking / settings), your device platform and app version. We keep this record for 3 years after withdrawal, as proof.

**Explicit consent.** ☐ I have read the text above. I give explicit consent to the processing of my height, weight, body measurements, goal, activity and diet details to calculate my personal plan.

### §1a-not: Takibe başla ile ortak rıza (inceleme için)

- Takibe başla metni bugün yalnız "Sağlık verilerimin hedefimi hesaplamak için…" diyor (`src/core/i18n/dictionaries.ts:257`, EN `:2161`). Topladığı veri cinsiyet, doğum yılı, boy, kilo ve hareket. Kişisel plan aynı cihaz anahtarını okuyor ve geçerli rıza varsa "Onaylandı" gösterip **yeniden sormuyor** (`src/modules/personalPlan/api.ts:308-320`, G36-S1 md.8 İlter kararı).
- Sorun: Kişisel plan Takibe başla'dan **daha fazla** veri işliyor: ölçüler, vücut yağı, egzersiz, diyet, öğün düzeni, aralıklı oruç. Takibe başla'da verilen rıza bu verileri belirli olarak kapsamıyor. Açık rıza "belirli bir konuya ilişkin" olmalı (KVKK md.3/1-a).
- **Öneri:** İki ekranda da yukarıdaki kutu metni kullanılsın. `HEALTH_CONSENT_VERSION` 1'den 2'ye çıkarılsın. Böylece eski metinle onay verenlere kişisel plan girişinde yeni metin bir kez sorulur. Takibe başla'da da aynı metin kullanılır (gelecekte toplanacak veriyi önceden kapsar). Alternatif: kişisel plan için ayrı anahtar. İlter karar verecek (LOG soru 1).

---

## 1b. Alerji ve hassasiyet açık rızası (ayrı)

**Nerede:** (i) Kişisel plan › Beslenme adımı › "Alerji ve hassasiyet" (`questions.tsx:518-537`). (ii) Öğün planı › Planı oluştur formu › "Alerjenler" kartı (`PlanGenerateScreen.tsx:281-303`). İki yerde **aynı metin, aynı rıza** (cihaz anahtarı `@kcal_allergen_consent`, `store.ts:329`).

### Ekran metni, TR

**Kişisel plan (kutu):**
> ☐ **Alerji ve hassasiyet bilgilerimin planımdan çıkarılacak yiyecekleri belirlemek için işlenmesine açık rıza veriyorum.**
> Rızanı geri alırsan seçtiğin alerjenler silinir.
>
> [Aydınlatma metni]

**Öğün planı formu (kart):**
> **Alerjen bilgisi sağlık verisidir**
> Seçtiğin alerjenleri yalnız planından çıkarılacak yiyecekleri belirlemek için kullanırız. Rıza vermesen de planını oluşturabilirsin; rızanı geri alırsan seçimlerin silinir.
> [Açık rıza veriyorum] · [Alerjen seçmeden devam et] · [Aydınlatma metni]

- Kişisel planda kutu metni zaten bu (mevcut `pp.consent_allergy`). Değişen: ikinci cümle ve bağlantı.
- Öğün planı formunda mevcut `plan.consent_body` "hesabınla saklarız" diyor. Kişisel plan kapalıyken form alerjenleri **sunucuya yazmıyor** (§0.2). Bu yüzden saklama ifadesi kaldırıldı.

### Screen text, EN

**Personal plan (checkbox):**
> ☐ **I give explicit consent to the processing of my allergy and sensitivity details to decide which foods to leave out of my plan.**
> If you withdraw, your selected allergens are deleted.
>
> [Privacy notice]

**Meal plan form (card):**
> **Allergen details are health data**
> We use the allergens you pick only to decide which foods to leave out of your plan. You can create your plan without consenting; if you withdraw, your selections are deleted.
> [I give explicit consent] · [Continue without allergens] · [Privacy notice]

### Uzun metin, TR: "Alerji ve hassasiyet: aydınlatma metni ve açık rıza"

**1. Veri sorumlusu.** SEKULART LTD, iletişim bilgileri §1a/1 ile aynı.

**2. Hangi veriler?** Listeden seçtiğin alerjen ve hassasiyetler: fıstık, süt, yumurta, gluten, deniz ürünü, kuruyemiş, susam, soya. Serbest metin istemeyiz; teşhis, belirti ya da tahlil sonucu sormayız.

**3. Ne için?** Seçtiğin alerjenleri içeren tarif ve ürünleri öğün planından ve önerilerden **çıkarmak** için. Başka bir amaçla, reklam için ya da profil çıkarmak için kullanmayız.

**Önemli:** Bu filtre bir **kolaylıktır, tıbbi güvence değildir.** Tarif ve ürün bilgileri hatalı ya da eksik olabilir. Ağır alerjin varsa her ürünün içeriğini ve etiketini kendin kontrol et; eatkcal siparişlerinde alerjen bilgisini ürün sayfasından doğrula.

**4. Hukuki sebep.** Alerji bilgisi sağlık verisidir. Yalnız **açık rızana** dayanırız: KVKK md.6/3-a; GDPR Art.9(2)(a). Bu rıza, kişisel plan için verdiğin sağlık verisi rızasından **ayrıdır**. Biri ötekini kapsamaz.

**5. Nerede saklanır, kimlere aktarılır?**
- Kişisel planında seçtiğin alerjenler planınla birlikte telefonunda ve Supabase'in **AB'deki** sunucularında saklanır (KVKK md.9 standart sözleşme, §1a/5).
- Öğün planı formunda (kişisel plan olmadan) seçtiğin alerjenler yalnız plan oluşturulurken kullanılır ve **saklanmaz**.
- Plan telefonunda oluşturulur. **ABD'ye aktarılmaz.**
- **İstisna:** Balance aboneliğinde "Koç'la oluştur"u seçersen, Koç planını sıralayıp açıklayabilsin diye seçtiğin alerjenlerin **adları**, diyet tercihin ve kalori/protein hedefin yapay zekâ sağlayıcımıza (Anthropic PBC, ABD) gönderilir. Adın, e-postan ve kullanıcı kimliğin gönderilmez. Bu gönderim yalnız **kcalAI Koç iznin** açıksa yapılır. Koç iznin yoksa "Koç'la oluştur" yerine standart plan oluşturulur.

**6. Ne kadar saklarız?** Rızan sürdüğü ve hesabın açık olduğu sürece. Rızanı geri aldığında seçtiğin alerjenler **hemen** telefonundan ve hesabından silinir; yedeklerden en geç **30 gün** içinde silinir. Hesabını sildiğinde de silinir.

**7. Rıza vermezsen ne olur?** Planını yine oluşturabilirsin; yalnız alerjen filtresi uygulanmaz. Kişisel planın ve diğer özellikler etkilenmez.

**8. Rızanı nasıl geri alırsın?** Kişisel planda kutunun işaretini kaldırarak; Profil › Gizlilik › Veri ve reklam izinleri › Alerji bilgisi'nden ya da info@eatkcal.com adresine yazarak. Geri almak ücretsizdir ve ileriye etkilidir.

**9–10. Hakların ve kayıt.** §1a/9–10 ile aynı. Kanal: kişisel plan ya da öğün planı.

**Açık rıza beyanı.** ☐ Yukarıdaki metni okudum. Alerji ve hassasiyet bilgilerimin planımdan çıkarılacak yiyecekleri belirlemek için işlenmesine açık rıza veriyorum.

### Long text, EN: "Allergies and sensitivities: privacy notice and explicit consent"

**1. Controller.** SEKULART LTD; contact details as in §1a/1.

**2. What.** The allergens and sensitivities you pick from the list: peanut, milk, egg, gluten, seafood, tree nuts, sesame, soy. We don't ask for free text, diagnoses, symptoms or test results.

**3. Why.** To **leave out** recipes and products that contain the allergens you picked from your meal plan and suggestions. Not for any other purpose, not for advertising and not for profiling.

**Important:** This filter is a **convenience, not a medical guarantee.** Recipe and product information can be wrong or incomplete. If you have a severe allergy, check every product's ingredients and label yourself; for eatkcal orders, confirm allergen information on the product page.

**4. Legal basis.** Allergy details are health data. We rely only on your **explicit consent**: KVKK Art.6(3)(a); GDPR Art.9(2)(a). This consent is **separate** from your health data consent for the personal plan. Neither covers the other.

**5. Where it is stored and who receives it**
- Allergens picked in your personal plan are stored with your plan on your phone and on Supabase servers **in the EU** (KVKK Art.9 standard contract, §1a/5).
- Allergens picked in the meal plan form (without a personal plan) are used only while the plan is created and are **not stored**.
- Your plan is created on your phone. **Nothing is transferred to the USA.**
- **Exception:** On a Balance subscription, if you choose "Build with Coach", the **names** of the allergens you picked, your diet preference and your calorie/protein target are sent to our AI provider (Anthropic PBC, USA) so the Coach can rank and explain your plan. Your name, email and user ID are not sent. This happens only if your **kcalAI Coach permission** is on; without it, a standard plan is created instead of "Build with Coach".

**6. How long.** While your consent stands and your account is open. If you withdraw, your selected allergens are deleted from your phone and account **immediately**, and from backups within **30 days**. They are also deleted when you delete your account.

**7. If you don't consent.** You can still create your plan; the allergen filter just isn't applied. Your personal plan and other features are unaffected.

**8. How to withdraw.** By unticking the box in your personal plan; in Profile › Privacy › Data and ad permissions › Allergy details; or by writing to info@eatkcal.com. Withdrawing is free and works from that point on.

**9–10. Rights and record.** As in §1a/9–10. Channel: personal plan or meal plan.

**Explicit consent.** ☐ I have read the text above. I give explicit consent to the processing of my allergy and sensitivity details to decide which foods to leave out of my plan.

---

## 1c. Kişisel planın Koç'la paylaşımı

### Değerlendirme: ayrı rıza gerekir mi?

**Durum.** Koç sunucusu, kişisel planın özetini sistem istemine yalnız kullanıcının en son Koç AI izni satırı "verildi" ise ekliyor. Geri alma her zaman kazanıyor (`coach-chat/plan.ts:1-9,36-40`; `index.ts:92-108`). Gönderilenler: hedef türü, başlangıç ve hedef kilo, tempo (kg/hafta), günlük kalori ve makrolar, hedef tarihi, başlangıç tarihi. Ölçüler, vücut yağı, doğum yılı, adım, egzersiz ve alerjenler **gitmiyor**. Balance "Koç'la oluştur" ise alerjen adlarını, diyeti ve hedefleri **Koç izni sorulmadan** gönderiyor (K-1).

**Onaylı Koç metni (B-30):** "Koça yazdıkların ve günlük takip özetin, yanıt üretmek için yapay zekâ hizmet sağlayıcımıza (ABD) gönderilir." Gizlilik §5B "günlük takip özeti"ni cinsiyet, hedefler, bugünkü toplamlar, son 7 gün ve son 8 öğün olarak tanımlıyor. **Başlangıç ve hedef kilo, tempo ve hedef tarihi bu tanımda yok.**

**Seçenekler:**

| | Seçenek | Hukuki değerlendirme | Kullanıcı deneyimi |
|---|---|---|---|
| A | **Koç izni metnini genişlet (sürüm 2) + yeniden sor**. Koç izni tek, kapsamı plan özeti ve Koç'la oluşturmayı içerir | Rıza belirli ve bilgilendirilmiş olur (md.3/1-a). Verinin alıcısı, ülkesi ve amacı aynı (Anthropic, ABD, Koç yanıtı); ayrı rıza istemek için zorunlu bir neden yok. Aktarım düzenli → md.9 standart sözleşme; sağlık verisi işleme dayanağı md.6/3-a | Mevcut Koç kullanıcılarına bir kez yeni metin sorulur |
| B | Koç izni aynı kalır + ayrı "Koç planımı görsün" anahtarı (varsayılan kapalı) | En dar rıza, en net seçim. Ama rıza sayısı artıyor ve Koç'un planı bilmediği durumda öneri kalitesi düşüyor. Ayrıştırma zorunlu değil | Ek bir anahtar daha |
| C | Yalnız bilgilendirme (metni değiştirme, Gizlilik'e bir paragraf ekle) | **Önerilmez.** Kilo hedefi ve tempo, onaylı Koç metninin anlattığı "günlük takip özeti"nin dışında kalan sağlık verisidir. Rıza kapsamı dışındaki veri için rıza yoktur. Gizlilik'e paragraf eklemek rızayı genişletmez | Değişiklik yok |

**Öneri: A.** Koç izni zaten ayrı, isteğe bağlı ve geri alınabilir. Plan özeti aynı amaca (yanıt üretme) aynı alıcıya gidiyor. Metne eklenmesi yeterli; ayrı bir kutu gerekmiyor. Ön koşullar: K-1 (Koç'la oluştur da bu izne bağlansın) ve K-4 (sürüm 2). İlter onayı gerekiyor; B-30 metni onaylıydı (LOG soru 2).

### Önerilen Koç izni metni, sürüm 2 (A seçeneği)

**TR, başlık (değişmez):** kcalAI Koç ve yapay zekâ
**TR, ana metin (`consent.sheet.ai_coach_lead`):**
> Koça yazdıkların, günlük takip özetin ve kişisel planının özeti (hedefin, kilo hedefin ve tempon), yanıt üretmek için yapay zekâ hizmet sağlayıcımıza (ABD) gönderilir. Koç'la öğün planı oluşturursan diyet tercihin ve seçtiğin alerjenler de gönderilir.

**TR, ipucu (değişmez):** Vazgeçersen koça mesaj gönderilmez. İzni Profil › Gizlilik › Veri ve reklam izinleri'nden geri alabilirsin.

**EN, lead:**
> What you write to the coach, a summary of your daily tracking and a summary of your personal plan (your goal, target weight and pace) are sent to our AI service provider (USA) to generate replies. If you build a meal plan with the Coach, your diet preference and selected allergens are sent too.

**Not, alerjenler:** Alerjen adları Koç'la oluşturmada ABD'ye gider. Bu iki rızaya birden dayanır: alerji rızası (işleme) **ve** Koç izni (Koç'a gönderim ve ABD aktarımı). İkisi de açık olmadan alerjen gönderilmemeli. Kod: alerji rızası yoksa `avoid: []` gidiyor (`PlanGenerateScreen.tsx:169`). Koç izni kontrolü yok (K-1).

### Uzun metin eki (Koç izni "Aydınlatma metni"ne eklenecek paragraf)

**TR:**
> **Kişisel planın.** Kişisel plan oluşturduysan Koç, önerilerini planına uydurabilsin diye planının özetini görür: hedef türün, başlangıç ve hedef kilon, haftalık tempon, günlük kalori ve makro hedeflerin, hedef ve başlangıç tarihin. Ölçülerin, vücut yağı oranın, doğum yılın, adım ve egzersiz bilgilerin gönderilmez. Koç iznini geri aldığında Koç planını görmez.
> **Koç'la öğün planı (Balance).** "Koç'la oluştur"u seçersen aday planların özeti, kalori ve protein hedefin, diyet tercihin ve (alerji rızan varsa) seçtiğin alerjenlerin adları gönderilir. Koç yalnız planları sıralar ve kısa bir açıklama yazar; kalori ve makroları değiştirmez. Her kullanım günlük Koç mesajı hakkından 1 düşer.

**EN:**
> **Your personal plan.** If you've created a personal plan, the Coach sees a summary of it so its suggestions fit your plan: your goal type, starting and target weight, weekly pace, daily calorie and macro targets, and target and start dates. Your measurements, body fat, birth year, steps and exercise details are not sent. If you withdraw the Coach permission, the Coach no longer sees your plan.
> **Meal plans with the Coach (Balance).** If you choose "Build with Coach", a summary of the candidate plans, your calorie and protein target, your diet preference and (if you've given allergy consent) the names of your selected allergens are sent. The Coach only ranks the plans and writes a short explanation; it does not change calories or macros. Each use counts as 1 of your daily Coach messages.

---

## 1d. Takip kapısı ve abonelik teklifi ekranları: tüketici mevzuatı notları

**Ekranlar:** Takip kapısı (Tur 26q: takip için profil zorunlu), kişisel plan sonu paywall (`src/modules/personalPlan/screens/PlanPaywallScreen.tsx`), genel paywall (`src/modules/subscription/`), abonelik özeti.

> Madde numaraları bilinen metinlerden verildi; yürürlükteki son değişiklikler için **İlter teyit etmeli** (özellikle Mesafeli Sözleşmeler Yönetmeliği ve Ticari Reklam Yönetmeliği'ndeki 2022 sonrası değişiklikler). Satıcı sıfatı ve cayma hakkı: B-26 (açık).

### 1d.1 Zorunlu ifadeler listesi

| # | Zorunlu ifade / öğe | Dayanak | Ekran | Bugün kodda | Önerilen TR | Önerilen EN |
|---|---|---|---|---|---|---|
| Z-1 | Abonelik adı, süresi ve **tahsil edilecek tam fiyat** (dönem fiyatı en belirgin fiyat; aylık karşılık daha küçük) | Apple Kılavuz 3.1.2(a); Play Ödemeler politikası (abonelik teklif şartları); TKHK md.48 + Mesafeli Söz. Yön. md.5 (ön bilgilendirme: toplam fiyat); Fiyat Etiketi Yön. | Paywall kartı | Var: `pp.per_year`, `pp.per_month_label`; aylık karşılık ikincil `pp.pw_per_month` (`PlanPaywallScreen.tsx:82,122-126`) | "Fresh Yıllık · 999 TL/yıl" (biçim mevcut) | "Fresh Annual · TRY 999/year" |
| Z-2 | **Otomatik yenileme** ve yenileme koşulu (24 saat kuralı) | Apple 3.1.2; Play abonelik politikası; Mesafeli Söz. Yön. md.5 (sözleşme süresi, yenilenme) | CTA altı | Var: `pp.pw_legal` | Mevcut metin uygun (bkz. Z-3 düzeltmesi) | Mevcut |
| Z-3 | **Deneme**: süresi, ücretin **ne zaman** başlayacağı, deneme sonrası fiyat. Deneme olmayan teklifte deneme cümlesi **olmamalı** | Apple 3.1.2(a) (ücretsiz deneme şartları açık olmalı); Play (denemenin süresi ve ücretin başlayacağı zaman); Ticari Reklam ve Haksız Ticari Uygulamalar Yön. ("ücretsiz" ifadesi koşullarıyla) | CTA ve CTA altı | Kısmen: `pp.pw_cta_after` doğru. **`pp.pw_legal` deneme olmayan teklifte de "Ücret deneme bitince alınır." diyor** | Denemeli: "7 gün ücretsiz, sonra 999 TL/yıl. Ücret deneme bittiğinde, 19 Kasım'da alınır." · Denemesiz: "999 TL/yıl, bugün alınır." | "7 days free, then TRY 999/year. You'll be charged when the trial ends, on 19 November." · "TRY 999/year, charged today." |
| Z-4 | **Nasıl iptal edilir** (mağaza hesap ayarları) + uygulamayı silmenin aboneliği iptal etmediği | Apple 3.1.2; Play (kolay iptal, iptal yolu); TKHK md.48 | CTA altı + Profil › Abonelik | Var (yol): `pp.pw_legal`. "Uygulamayı silmek iptal etmez" **yok** | "Uygulamayı silmek aboneliği iptal etmez." | "Deleting the app does not cancel your subscription." |
| Z-5 | Ödemenin **Apple Kimliği / Google Play hesabından** alınacağı | Apple 3.1.2 (Schedule 2 bilgileri); Play | CTA altı | Var: `pp.pw_legal` | Mevcut | Mevcut |
| Z-6 | **Satın alımları geri yükle** | Apple 3.1.1 / 3.1.2 (geri yükleme mekanizması) | Paywall | Var: `pp.pw_restore` | Mevcut | Mevcut |
| Z-7 | **Kullanım Koşulları (EULA)** ve **Gizlilik Politikası** bağlantıları uygulama içinde | Apple 3.1.2 (abonelik uygulamalarında işlevsel bağlantılar); Play | Paywall altı | Var: `SubLegalLinks` (`PlanPaywallScreen.tsx:203`) | Mevcut | Mevcut |
| Z-8 | **Ücretsiz devam** seçeneği görünür ve eşit erişilebilir (kapatma/geçme gizlenmez) | Apple 3.1.2 / 5.6 (yanıltıcı arayüz); Play (yanıltıcı abonelik teklifi yasak); Ticari Reklam Yön. (aldatıcı uygulama); TKHK md.62 | Paywall | Var: `pp.pw_free` + `pp.pw_free_foot` | Mevcut. Düğme 44 pt ve okunur kontrastta kalmalı | Mevcut |
| Z-9 | **Fiyat değişikliği** ve **iade** yolu: mağaza kurallarına göre, iade isteği Apple/Google'a | Mesafeli Söz. Yön. md.5; Koşullar §12A | Paywall altı bağlantı (Koşullar) | Koşullar'da var | Ek ekran metni gerekmez; Koşullar bağlantısı yeterli | — |
| Z-10 | **Cayma hakkı** bilgisi: anında ifa edilen dijital hizmet istisnası (Mesafeli Söz. Yön. md.15/1-ğ). İstisna uygulanacaksa tüketici satın almadan önce bilgilendirilmeli | Mesafeli Söz. Yön. md.5/1 ve md.15; AB 2011/83 md.16(m) | CTA altı veya Koşullar | **Yok** (B-26 açık) | "Abonelik satın alınca hemen başladığından cayma hakkı bulunmaz; mağazanın iade kuralları geçerlidir." **B-26 kararından sonra** | "Because your subscription starts immediately, there's no right of withdrawal; the store's refund rules apply." **(after B-26)** |
| Z-11 | Fiyat **TL** ve tek biçim ("285 TL"; "₺" yok, nokta ayracı yok) | Fiyat Etiketi Yön.; GECE19-ORTAK fiyat kuralı | Tümü | Mağaza fiyat metni (`priceText`) mağazanın biçimini kullanıyor | Mağaza metni gösterilecekse biçim mağazanındır; tasarruf % yalnız aynı para biriminde (G37 düzeltmesi) | — |
| Z-12 | "% tasarruf" yalnız **gerçek** karşılaştırmayla (aynı para biriminde aylık ikizin 12 katına göre) | Ticari Reklam Yön. (indirim/karşılaştırma iddiaları); Apple 3.1.2 (yanıltıcı fiyat yok) | Paywall kartı | Var (G37-S1 md.3 düzeltti) | Mevcut | Mevcut |

### 1d.2 Önerilen yeni `pp.pw_legal` metni (Z-2, Z-3, Z-4, Z-5)

Deneme olup olmamasına göre **iki ayrı anahtar** olmalı:

**TR, denemeli (`pp.pw_legal_trial`):**
> Ücret 7 günlük deneme bitince alınır. Deneme bitmeden en az 24 saat önce iptal etmezsen abonelik aynı süre ve fiyatla otomatik yenilenir. Ödeme Apple Kimliği ya da Google Play hesabından alınır. Aboneliği App Store ya da Google Play hesap ayarlarından yönetebilir ve iptal edebilirsin; uygulamayı silmek aboneliği iptal etmez.

**TR, denemesiz (`pp.pw_legal`):**
> Abonelik, dönem bitmeden en az 24 saat önce iptal edilmezse aynı süre ve fiyatla otomatik yenilenir. Ödeme Apple Kimliği ya da Google Play hesabından alınır. Aboneliği App Store ya da Google Play hesap ayarlarından yönetebilir ve iptal edebilirsin; uygulamayı silmek aboneliği iptal etmez.

**EN, with trial (`pp.pw_legal_trial`):**
> You'll be charged when your 7-day trial ends. Unless you cancel at least 24 hours before the trial ends, your subscription renews automatically for the same period and price. Payment is charged to your Apple ID or Google Play account. You can manage or cancel your subscription in your App Store or Google Play account settings; deleting the app does not cancel it.

**EN, no trial (`pp.pw_legal`):**
> Your subscription renews automatically for the same period and price unless you cancel at least 24 hours before the period ends. Payment is charged to your Apple ID or Google Play account. You can manage or cancel your subscription in your App Store or Google Play account settings; deleting the app does not cancel it.

> "Deneme" süresi (7 gün) sabit yazılmamalı; mağazadan gelen deneme süresiyle doldurulmalı (`%{days}`). Mağazada deneme 3 gün olursa metin yanlış olur.

### 1d.3 Takip kapısı (profil zorunlu): rıza özgürlüğü notu

- Tur 26q: kalori takibi için profil (cinsiyet, doğum yılı, boy, kilo, hareket) zorunlu. Profil sağlık verisi → açık rıza gerekiyor. Rıza vermeyen kullanıcı takip özelliğini kullanamıyor.
- **Değerlendirme:** Açık rıza "özgür iradeyle" verilmeli ve hizmet, o hizmet için **gerekli olmayan** bir veri işlemenin şartına bağlanamaz (KVKK Açık Rıza Rehberi; GDPR Art.7(4)). Burada veri, kişisel kalori hedefi için **gerçekten gerekli**. Rızaya bağlanan şey bu verinin işlenmesinden ibaret olan özellik; uygulamanın tamamı değil. Bu bağlama savunulabilir görünüyor.
- **Koşullar:** (i) Rıza vermeyen kullanıcı için takip dışındaki özellikler (eatkcal siparişi, Keşfet, tarifler) açık kalmalı. (ii) Kapı ekranında rıza kutusu **ödeme teklifiyle aynı ekranda olmamalı**; teklif funnel sonunda (26q) kalmalı. (iii) Kapı ekranı rızayı "kabul et ve devam et" tek düğmesine gömmemeli; kutu ayrı kalmalı.
- **Takip kapısı ekran metni önerisi (TR):** "Kalori hedefini hesaplamamız için birkaç bilgiye ihtiyacımız var. Bu bilgiler sağlık verisi sayıldığından açık rızanı istiyoruz." · **EN:** "We need a few details to calculate your calorie target. Because they count as health data, we ask for your explicit consent."
- **Funnel sonu teklif:** Plan sonucu gösterildikten **sonra** paywall açılmalı ve sonuç (kalori ve makro hedefi) paywall'un arkasına kilitlenmemeli. Bugün böyle (`pp.pw_sub`: "Kalori ve makro hedefin zaten ücretsiz"). Ücretsiz verileni ödeme sonrasına saklamak aldatıcı uygulama riskidir (Ticari Reklam Yön.).

### 1d.4 Apple / Google ek kontrol listesi (mağaza gönderimi öncesi)

- [ ] App Store açıklamasında EULA (Apple Standard EULA, B-21) ve Gizlilik bağlantısı.
- [ ] Paywall'da fiyat, dönem, deneme ve yenileme bilgisi CTA düğmesine **yakın** ve okunur boyutta (Dynamic Type'ta kırpılmadan).
- [ ] Deneme bitiş tarihi gösteriliyorsa mağazanın verdiği bilgiyle hesaplanmalı.
- [ ] Play: abonelik yönetimi bağlantısı (`https://play.google.com/store/account/subscriptions?sku=…&package=…`) Profil › Abonelik'te.
- [ ] Mağaza dışı ödeme yönlendirmesi yok (Apple 3.1.1). eatkcal yemek siparişi fiziksel mal olduğu için istisna.
- [ ] 18 yaş altı: kişisel plan kapalı. Uygulama 18+ beyanlı; yaş derecelendirmesi formu buna uygun.
