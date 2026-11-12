<!-- L-S5 -->
# Koddaki TASLAK rıza metinleri → onaya sunulan metin eşlemesi, TASLAK

> **Durum:** TASLAK, hukuki inceleme için (İlter Öziseven). 12 Kasım 2026 · dal `legal/global` · oturum L-S5. **Bu oturumda kod değiştirilmedi.** Bu dosya, metinler onaylandıktan sonra kodu güncelleyecek oturumun iş listesidir.
> **Kod tabanı:** `release/1.1.0` @ dbde88f. Satır numaraları bu sürüme göredir.
> **Metin kaynağı:** `L-S5-RIZA-METINLERI.md` (§1a–§1d). Politika yamaları: `L-S5-POLITIKA-EKLERI.md`.
> **Tarama:** `grep -rn "TASLAK\|DRAFT\|L-S5" src` + rıza çağrı noktaları (`recordHealthConsent`, `recordAllergenConsent`, `consent_*`, `ai_coach_*`). `src/modules/mealPlan/**` yok; öğün planı modülü `src/modules/plan/**`. Rıza dışı "TASLAK" geçen yerler (`plan/data/seed.ts` tarif tohumu, `plan/client.ts:19`, `kesfet/ui/TrackerActivityEntry.tsx:39`) hukuk metni değil, kapsam dışı.

---

## 1. Eşleme tablosu (dosya:anahtar → yeni metin)

**Durum sütunu:** **D** = değiştir · **K** = kaldır · **Y** = yeni anahtar · **=** = aynı kalır (incelendi, uygun).

### 1.1 Kişisel plan: `src/modules/personalPlan/i18n.ts` (`pp.*`)

| # | Dosya:satır (TR / EN) | Anahtar | Bugün (TR) | Yeni TR | Yeni EN | Durum | Kaynak |
|---|---|---|---|---|---|---|---|
| 1 | `i18n.ts:2` | dosya başlığı yorumu | "Rıza metinleri TASLAK (L-S5'te hukuk metni gelecek)." | "Rıza metinleri L-S5 (İlter onayı: GG.AA.YYYY)." | — | D | — |
| 2 | `:36` / `:525` | `consent_health` | "Boy, kilo, ölçü ve beslenme bilgilerimin planımı hesaplamak için işlenmesine açık rıza veriyorum." | "Boy, kilo, vücut ölçüleri, hedef, hareket ve beslenme bilgilerimin kişisel planımı hesaplamak için işlenmesine açık rıza veriyorum." | "I give explicit consent to the processing of my height, weight, body measurements, goal, activity and diet details to calculate my personal plan." | D | §1a |
| 3 | — | `consent_health_sub` | — | "Rızanı istediğin zaman Profil › Gizlilik › Veri ve reklam izinleri'nden geri alabilirsin." | "You can withdraw this at any time in Profile › Privacy › Data and ad permissions." | Y (⚑ K-2) | §1a |
| 4 | `:37` / `:526` | `consent_health_done` | "Onaylandı" | = | = | = | §1a |
| 5 | `:38` / `:527` | `consent_draft` | "TASLAK" / "DRAFT" | — | — | **K** (anahtar ve `draftLabel` kullanımları kaldırılır, §3) | §0.3/6 |
| 6 | `:39` / `:528` | `consent_notice` | "Aydınlatma Metni" / "Privacy Notice" | "Aydınlatma metni" | "Privacy notice" | D (büyük harf; **hedef değişir**, §3) | §0.3/3 |
| 7 | `:40` / `:529` | `consent_hint` | "Başlamak için açık rıza kutusunu işaretle." | = | = | = | §1a |
| 8 | `:42` / `:531` | `consent_a11y` | "Sağlık verisi açık rızası" | = | = | = | — |
| 9 | — | `consent_health_title`, `consent_health_body` | — | Uzun metin başlığı: "Kişisel plan: sağlık verisi aydınlatma metni ve açık rıza"; gövde: §1a "Uzun metin, TR" 1–10 + beyan | "Personal plan: health data privacy notice and explicit consent"; gövde: §1a "Long text, EN" | Y | §1a |
| 10 | `:111` / `:595` | `steps_hint` | "Bilmiyorsan böyle bırak; sağlık bağlantısı açıksa kendimiz okuruz." | "Bilmiyorsan boş bırak; hareket düzeyinden tahmin ederiz." | "If you don't know, leave it blank; we'll estimate it from your activity level." | D | GP-3 (HealthKit yok) |
| 11 | `:163` / `:644` | `allergy_sub` | "İsteğe bağlı. Sağlık verisi sayıldığı için ayrı onaylanır." | = | = | = | §1b |
| 12 | `:164` / `:645` | `consent_allergy` | "Alerji ve hassasiyet bilgilerimin planımdan çıkarılacak yiyecekleri belirlemek için işlenmesine açık rıza veriyorum." | = | = | = (metin onaya sunuldu, değişmedi) | §1b |
| 13 | — | `consent_allergy_sub` | — | "Rızanı geri alırsan seçtiğin alerjenler silinir." | "If you withdraw, your selected allergens are deleted." | Y | §1b |
| 14 | — | `consent_allergy_title`, `consent_allergy_body` | — | "Alerji ve hassasiyet: aydınlatma metni ve açık rıza"; gövde §1b "Uzun metin, TR" | "Allergies and sensitivities: privacy notice and explicit consent"; gövde §1b "Long text, EN" | Y | §1b |
| 15 | `:173` / `:654` | `allergy_locked` | "Alerjenleri seçmek için önce açık rızayı işaretle." | = | = | = | — |
| 16 | `:25` / `:515` | `safety_note` | "Hamilelik, emzirme ya da süregelen bir sağlık durumun varsa hedefini doktorunla belirle." | = | = | = (sağlık verisi toplamaz, uyarıdır) | §1a/2 |
| 17 | `:322` / `:796` | `pw_cta` | "7 gün ücretsiz başla" | "%{days} gün ücretsiz başla" | "Start %{days} days free" | D (süre mağazadan) | Z-3 |
| 18 | `:319` / `:793` | `pw_trial` | "7 gün ücretsiz" | "%{days} gün ücretsiz" | "%{days} days free" | D | Z-3 |
| 19 | `:323` / `:797` | `pw_cta_after` | "7 gün ücretsiz, sonra %{price}.\nÜcret deneme bitince alınır." | "%{days} gün ücretsiz, sonra %{price}.\nÜcret deneme bittiğinde, %{date} tarihinde alınır." | "%{days} days free, then %{price}.\nYou'll be charged when the trial ends, on %{date}." | D | Z-3 |
| 20 | — | `pw_cta_after_now` | — (denemesizde yalnız fiyat gösteriliyor) | "%{price}, bugün alınır." | "%{price}, charged today." | Y | Z-3 |
| 21 | `:326` / `:800` | `pw_legal` | "Abonelik, deneme ya da dönem bitmeden … Ücret deneme bitince alınır. … iptal edebilirsin." | §1d.2 "TR, denemesiz" | §1d.2 "EN, no trial" | D (**deneme cümlesi çıkar**, "uygulamayı silmek iptal etmez" eklenir) | Z-2…Z-5 |
| 22 | — | `pw_legal_trial` | — | §1d.2 "TR, denemeli" (`7` yerine `%{days}`) | §1d.2 "EN, with trial" | Y | Z-3 |
| 23 | — | `pw_withdrawal` | — | "Abonelik satın alınca hemen başladığından cayma hakkı bulunmaz; mağazanın iade kuralları geçerlidir." | "Because your subscription starts immediately, there's no right of withdrawal; the store's refund rules apply." | Y, **B-26 kararından sonra** | Z-10 |
| 24 | `:377-378` / `:848-849` | `minor_title`, `minor_body` | "Kişisel plan 18 yaş ve üzeri için" / "Büyüme döneminde kalori hedefi kişiye özel belirlenmeli. Öğünlerini kaydetmeye ve takip etmeye devam edebilirsin." | = başlık; gövdeye ek cümle: "Verdiğin cevapları sildik." | "We've deleted the answers you gave." | D (⚑ K-3) | §1a/6 |
| 25 | `:371` / `:843` | `resume_restart_sub` | "Baştan başlarsan kayıtlı cevapların silinir." | = | = | = | §1a/6 |
| 26 | `:373` / `:845` | `exit_body` | "Şimdi çıkarsan hiçbir şey kaybolmaz…" | = | = | = (ara kayıt §1a/6'da anlatıldı) | — |

### 1.2 Öğün planı: `src/modules/plan/i18n.ts` (`plan.*`)

| # | Dosya:satır (TR / EN) | Anahtar | Bugün (TR) | Yeni TR | Yeni EN | Durum | Kaynak |
|---|---|---|---|---|---|---|---|
| 27 | `:79` / `:241` | `consent_title` | "Alerjen bilgisi sağlık verisidir" | = | "Allergen details are health data" | D (yalnız EN) | §1b |
| 28 | `:80` / `:242` | `consent_body` | "Seçtiğin alerjenleri yalnız planını hazırlamak için kullanırız ve hesabınla saklarız. KVKK kapsamında açık rızanı istiyoruz; rıza vermesen de plan oluşturabilirsin." | "Seçtiğin alerjenleri yalnız planından çıkarılacak yiyecekleri belirlemek için kullanırız. Rıza vermesen de planını oluşturabilirsin; rızanı geri alırsan seçimlerin silinir." | "We use the allergens you pick only to decide which foods to leave out of your plan. You can create your plan without consenting; if you withdraw, your selections are deleted." | D ("hesabınla saklarız" yanlış: form alerjeni saklamıyor) | §1b |
| 29 | `:81` / `:243` | `consent_accept` | "Açık rıza veriyorum" | = | = | = | §1b |
| 30 | `:82` / `:244` | `consent_skip` | "Alerjen seçmeden devam et" | = | = | = | §1b |
| 31 | — | `consent_notice` | — (kartta aydınlatma bağlantısı yok) | "Aydınlatma metni" | "Privacy notice" | Y (bağlantı §1b uzun metnini açar) | §0.3/2 |
| 32 | `:78` / `:240` | `allergens_locked` | "Alerjen seçimi için açık rızan gerekiyor." | = | = | = | — |
| 33 | `:77` / `:239` | `allergens_foot` | "Seçtiklerini içeren tarif ve ürünler plana girmez." | "Seçtiklerini içeren tarif ve ürünler plana girmez. Ürün içeriklerini yine de kontrol et." | "Recipes and products with what you pick stay out of the plan. Still check product ingredients." | D (tıbbi güvence değildir uyarısı) | §1b/3 |
| 34 | — | `coach_consent_needed` | — | "Koç'la oluşturmak için kcalAI Koç iznini açman gerekiyor. İzin vermezsen standart planın oluşturulur." | "To build with the Coach, turn on the kcalAI Coach permission. Without it, we'll create your standard plan." | Y (⚑ K-1) | §1b/5, §1c |

### 1.3 Rıza altyapısı: `src/lib/consent/i18n.ts` (`consent.*`)

| # | Dosya:satır (TR / EN) | Anahtar | Bugün | Yeni TR | Yeni EN | Durum | Kaynak |
|---|---|---|---|---|---|---|---|
| 35 | `:49-50` / `:117-118` | `sheet.ai_coach_lead` | B-30 onaylı metin | §1c "Önerilen Koç izni metni, sürüm 2" TR | §1c EN | D, **İlter onayı + `COACH_CONSENT_VERSION` 2** (⚑ K-4) | §1c |
| 36 | `:51` / `:119` | `sheet.ai_coach_hint` | "Vazgeçersen koça mesaj gönderilmez. İzni …" | = | = | = | §1c |
| 37 | `:59` / `:127` | `settings.row_sub` | "Kullanım ölçümü ve reklam ölçümü" | "Sağlık verisi, yapay zekâ, kullanım ve reklam ölçümü" | "Health data, AI, usage analytics and ad measurement" | D (⚑ K-2) | GP-4 |
| 38 | — | `settings.health_section` | — | "Sağlık verisi" | "Health data" | Y (⚑ K-2) | GP-4 |
| 39 | — | `settings.health_label` / `health_desc` | — | "Sağlık verisi" / "Boy, kilo, ölçüler ve kişisel planın; kalori hedefini ve planını hesaplamak için. Kapatırsan bu veriler 30 gün içinde silinir." | "Health data" / "Your height, weight, measurements and personal plan, to calculate your calorie target and plan. If you turn this off, this data is deleted within 30 days." | Y (⚑ K-2) | §1a/8 |
| 40 | — | `settings.allergy_label` / `allergy_desc` | — | "Alerji bilgisi" / "Planından çıkarılacak alerjenler. Kapatırsan seçimlerin silinir." | "Allergy details" / "Allergens left out of your plan. If you turn this off, your selections are deleted." | Y (⚑ K-2) | §1b/8 |
| 41 | — | `settings.health_off_confirm` | — | "Sağlık verisi rızanı geri alırsan kişisel planın ve kalori takibin durur; verilerin 30 gün içinde silinir." | "If you withdraw health data consent, your personal plan and calorie tracking stop; your data is deleted within 30 days." | Y (⚑ K-2). Uygulama içi onay sayfası (Alert değil) | §1a/8 |

### 1.4 Takibe başla: `src/core/i18n/dictionaries.ts` (`tb.about.*`)

| # | Dosya:satır (TR / EN) | Anahtar | Bugün | Yeni TR | Yeni EN | Durum | Kaynak |
|---|---|---|---|---|---|---|---|
| 42 | `:257` / `:2161` | `tb.about.consent` | "Sağlık verilerimin hedefimi hesaplamak için işlenmesine açık rıza veriyorum." | #2 ile **birebir aynı** metin (tek metin, tek sürüm) | #2 EN ile birebir aynı | D, **`HEALTH_CONSENT_VERSION` 2** (§1a-not, İlter kararı). Takibe başla'da "kişisel planımı" yerine "kalori hedefimi ve kişisel planımı" denmek istenirse #2 de aynı biçimde değişir; iki ekran ayrışmamalı | §1a-not |

---

## 2. Ön koşullar (metin yayımlanmadan önce yapılacak kod işleri)

| # | İş | Dosya:satır | Ayrıntı | Test |
|---|---|---|---|---|
| **K-1** | "Koç'la oluştur"u Koç AI iznine bağla | `src/modules/plan/screens/PlanGenerateScreen.tsx:166-169`; `src/modules/plan/coach.ts:20-30`; sunucu `supabase/functions/meal-plan-generate/index.ts:47-60` | İstemci: Koç izni (`src/modules/coach/access.ts` okuma) yoksa `askCoachToRank` çağrılmaz, `plan.coach_consent_needed` gösterilir ve standart plan oluşturulur (ya da Koç izin penceresi açılır). Sunucu: `coach-chat/plan.ts` `coachConsentGranted` ile aynı kural (son `user_consents` kind `ai_coach` satırı). İzin yoksa 403 `{error:'consent'}`, kota ayrılmaz | İzin yokken `functions.invoke` çağrılmıyor; sunucu 403; alerji rızası yoksa `avoid: []` (mevcut) |
| **K-2** | Sağlık verisi ve alerji rızasını uygulama içinden geri alma + geri alınca silme | `src/modules/profil/ui/screens/SettingsDataConsentScreen.tsx` (yeni bölüm); `src/lib/consent/store.ts:302-352` | Ayarlara "Sağlık verisi" bölümü: iki anahtar (#38–#41). Kapatınca `recordHealthConsent(false,'settings')` / `recordAllergenConsent(false)`. Alerji: `personal_plan.answers.allergens` ve cihaz kopyası **hemen** boşaltılır. Sağlık: `personal_plan` + `personal_plan_progress` + profil ölçüleri 30 gün içinde silinir (sunucu işi ya da anında silme). `user_consents` CHECK'te `settings` kaynağı var mı, doğrula. Kişisel planda alerji kutusunun işareti kaldırılınca da `recordAllergyConsent(false)` yazılmalı (bugün yalnız `true` yazılıyor: `PersonalPlanFlowScreen.tsx:113`) | Kapat → satır `granted:false`; alerjenler boş; tekrar açınca yeniden onay |
| **K-3** | 18 yaş altında cevapları sil | `src/modules/personalPlan/screens/PersonalPlanFlowScreen.tsx:246-247`; `store.ts:78-83` | `MinorStep` gösterilirken `reset()` (ya da `clearProgress(uid)` + cevapları boşalt) çağrılmalı. Bugün `basics` adımında yazılan ara kayıt (doğum yılı, boy, kilo) `personal_plan_progress` ve cihazda kalıyor. Takibe başla'dan gelen profil verisi bu kuralın dışında (ayrı konu, LOG soru 7) | Doğum yılı 18 altı → `personal_plan_progress` satırı yok, `AsyncStorage` anahtarı yok |
| **K-4** | Koç izni metni sürüm 2 | `src/lib/consent/i18n.ts:49-50,117-118`; `src/modules/coach/access.ts:72` | `COACH_CONSENT_VERSION = 2`; v1 onaylı kullanıcıya Koç'a ilk girişte yeni metin bir kez sorulur. Sunucu tarafı (`coach-chat/plan.ts:36-40`) sürüme bakmıyor; `user_consents` satırına `doc_version` yazılırsa (K-6) sunucu v2 isteyebilir | v1 cihaz kaydı → izin penceresi yeniden açılır |
| **K-5** | Kullanım ölçümünden sağlıkla ilişkili sınıfları çıkar | `src/lib/metrics/events.ts:213` (`pp_saved.goal`), `:215` (`pp_checkin.kind`); çağrı `PersonalPlanFlowScreen.tsx:185` | `goal` ve `kind` alanları kaldırılır (ya da yalnız `custom`, `action` kalır). Alternatif: alanlar kalır, Gizlilik §8 ve mağaza etiketinde Analytics amacı açıkça yazılır, dayanak açık rıza olur (öneri değil) | Olay sözlüğü testi: `pp_*` olaylarında sağlık alanı yok |
| **K-6** | Rıza satırına metin kimliği ve sürümü | `src/lib/consent/store.ts:317,350` | `doc_slug: 'consent_health' / 'consent_allergen'`, `doc_version: HEALTH_CONSENT_VERSION / ALLERGEN_CONSENT_VERSION`. İspat için gerekli (Açık Rıza "Ortak ilkeler: metnin kimliği ve sürümü kaydedilir" diyor). DB CHECK kısıtını doğrula (migration gerekebilir) | Satırda `doc_version` dolu |

## 3. Metin dışı kod değişiklikleri (onaydan sonra)

| # | Dosya:satır | Değişiklik |
|---|---|---|
| C-1 | `src/modules/personalPlan/screens/flow/entry.tsx:72`, `questions.tsx:527` | `draftLabel={i18n.t('pp.consent_draft')}` kaldırılır. `CheckRow` `draftLabel` prop'u (`ui/parts.tsx:385,421-423`) kullanılmıyorsa kaldırılır |
| C-2 | `src/modules/personalPlan/__component_tests__/g34PersonalPlan.test.tsx:127` | `expect(r.getAllByText('TASLAK')…)` → "TASLAK rozeti yok" (`queryByText('TASLAK')` null) |
| C-3 | `src/modules/personalPlan/screens/flow/entry.tsx:74` | "Aydınlatma metni" bağlantısı genel Gizlilik'i (`legalWebUrl('privacy')`) açıyor → §1a uzun metnini açan uygulama içi sayfa (önerilen: mevcut `ProfileContracts` benzeri bir sayfa; metin `pp.consent_health_body`). Web karşılığı: Açık Rıza §1 bağlantısı |
| C-4 | `questions.tsx:518-537` | Alerji kutusunun altına `pp.consent_allergy_sub` + "Aydınlatma metni" bağlantısı (§1b uzun metni) |
| C-5 | `src/modules/plan/screens/PlanGenerateScreen.tsx:282-303` | Rıza kartına "Aydınlatma metni" bağlantısı (`plan.consent_notice`) |
| C-6 | `src/modules/personalPlan/screens/PlanPaywallScreen.tsx:192,200` | `pw_cta_after` / `pw_cta_after_now` ve `pw_legal_trial` / `pw_legal` seçimini `selected.trialDays`'e bağla; `%{days}` ve `%{date}` (deneme bitişi = bugün + `trialDays`, TR tarih biçimi) doldur |
| C-7 | `src/lib/consent/__component_tests__/`, `src/modules/plan/__component_tests__/g33PlanScreens.test.tsx` | Eksik anahtar testi: tüm yeni anahtarlar TR + EN'de var (GECE19-ORTAK çift dil kuralı) |
| C-8 | Rıza sürümü artışları | `HEALTH_CONSENT_VERSION` 2 (§1a-not kararına bağlı), `ALLERGEN_CONSENT_VERSION` aynı kalır (kutu metni değişmedi; yalnız alt cümle ve bağlantı eklendi; İlter "esaslı değişiklik" sayarsa 2), `COACH_CONSENT_VERSION` 2 (K-4) |

## 4. Kontrol: metin ↔ kod tutarlılığı (ön koşullar sonrası beklenen)

| Metin cümlesi | Kod koşulu | Bugün |
|---|---|---|
| "Plan telefonunda hesaplanır; AI kullanılmaz" (§1a/5) | `calc.ts` saf istemci hesabı; plan için edge function yok | ✔ |
| "Cevapların ABD'ye aktarılmaz" (§1a/5) | Plan verisi yalnız Supabase + cihaz | ✔ |
| "Koç izni yoksa Koç planını görmez" (§1c) | `coach-chat/index.ts:92-108` | ✔ |
| "Koç izni yoksa Koç'la oluştur çalışmaz" (§1b/5) | K-1 | ✗ |
| "Rızanı Profil › Gizlilik'ten geri alabilirsin" (§1a/8, §1b/8) | K-2 | ✗ |
| "18 yaş altında cevaplar silinir" (§1a/6) | K-3 | ✗ |
| "Plan cevapların kullanım ölçümüne eklenmez" (GP-7) | K-5 | ✗ |
| "Metnin sürümü kaydedilir" (§1a/10) | K-6 | ✗ (yalnız cihazda) |
| "Öğün planı formunda alerjenler saklanmaz" (§1b/5) | `PlanGenerateScreen.tsx:80-81` ekran durumu | ✔ |
| "Ara kayıt plan kaydedilince silinir" (§1a/6) | `PersonalPlanFlowScreen.tsx:184` | ✔ |
| "Hatırlatmalar telefonda kurulur" (GP-8) | `reminders.ts:50` yerel bildirim | ✔ |
| "Adım cihazdan okunmaz" (GP-3) | HealthKit/Health Connect yok | ✔ (`steps_hint` metni ✗, #10) |
