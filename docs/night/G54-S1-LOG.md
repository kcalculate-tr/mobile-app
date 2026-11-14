# G54-S1 LOG: kayıt sonu paywall, tek kayıt/plan sistemi, 1.1.0 oryantasyonu, neon, rozet, logo, kayıt soruları, düzenleme özeti (14 Kas)

Dal `release/1.1.0`, worktree `.claude/worktrees/g23-s1`, başlangıç `b363e87` (G53-S1-DONE). Yalnız JS/TS (OTA uyumlu; native değişiklik yok), yeni paket yok, deploy / OTA / canlı DB yazma yok. Sıra görevdeki gibi: 1 → 2 → 3 → 7 → 8 → 6 → 4 → 5, her madde ayrı commit.

## ÖZET
1. **md.1 Kayıt sonu T1:** `isFreshAccount` şartı kalktı. Kayıt bitince (A yolu L2 / K1, B kısa profil son adımı) aktif aboneliği olmayan herkese T1 açılıyor. "Bir kez" işareti hesap bazında: `user_metadata.kayit_offer_shown_at` + cihaz yedeği (anahtar kullanıcı kimliğiyle). T1 artık kökte `KayitOffer` modalı ve dönüş hedefini taşıyor. "Yine de çık" ya da tebrikteki "Başlayalım" kullanıcıyı dokunduğu eyleme götürüyor (ör. Tara). Tebrik ekranı (`SubWelcome`) kayıt görsel dilinde; ana paywall'ın başarı hâli de aynı ekranı kullanıyor.
2. **md.2 Tek kayıt/plan:** Kök neden biçim farkı değil. Yeni kaydın yazdığı `personal_plan` (G34 PpSaved v1 + `kayit` anahtarı) `parseSaved`'den geçiyor. Asıl sorun, bellekteki `useMyPlanStore`'un kayıttan önce (Ana sayfada) `loaded:true, saved:null` olarak yüklenip bir daha yenilenmemesiydi. Ayrıca kısa profil ve eski profil satırlarında `personal_plan` yoktu. Çözüm: tek okuyucu `planReader.planFromRow` (personal_plan ya da satır hedefleri), kayıt sonrası depo doldurma (`prime`), MyPlan'ın açılışta tazelenmesi, boş hâlin yeni kayıt akışına gitmesi ve eski funnel'ın (`PersonalPlan`) bayrak açıkken kayıtlı olmaması.
3. **md.3 1.1.0 oryantasyonu:** `yeni_kayit` açıkken ve `yeni_onboarding`'den bağımsız çalışıyor; oturumu açık herkes bir kez görüyor. İşaret: `profiles.onboarding_state.orient_v110_seen_at` + `@kcal_orient_v110:<uid>`. Hesap değişince yeniden değerlendiriliyor. İçerik: eski müşteriye 4 sayfalık "Yeni Kcalculate" tanıtımı, herkese 4 ipucu (Tara → Ana sayfa halka ya da "Planını oluştur" kartı → Keşfet → eatkcal). Başlama koşulu: Ana sayfa odakta ve başka katman açık değil. Profil › Ayarlar'da "Uygulama turunu tekrar izle" satırı var. Ölçüm olayları `orient_v110_view/complete/skip` (migration dosyası + rollback).
4. **md.7 Neon:** Kök neden aşağıda. Işık artık tek açık yuvarlak dikdörtgen yolu üstünde ve kartın kendi kutusunda. Temel kenar 1,5 pt (lime %35). Işık 3 katman (≈10 / 5 / 1,75 pt) ve çevrenin %30'u kadar degrade kuyruk. Seçiliyken hafif iç ışıma var. Tur 7 sn, seçim geçişi 250 ms.
5. **md.8:** "Bugün N ücretsiz tarama" rozeti, kuralı ve metinleri silindi. Ölçüm olayı zaten yoktu.
6. **md.6:** Konum kapısı logosu beyaz ve 12,5 → 17,5 pt (≈1,4×). Yalnız bu ekran değişti.
7. **md.4:** "Yemediğin bir şey var mı?" artık 9 grup ve ~150 besinlik TR/EN aramayla çalışıyor (aksan ve ünsüz yumuşaması duyarsız). Listede olmayan için "‘…’ ekle" satırı çıkıyor; özel öğe × ile çıkarılıyor. Sınır 30 öğe; "Hepsini yerim" ile karşılıklı temizleme var. Yeni soru "Hangi mutfakları seversin?" P10'dan hemen sonra geliyor: 18 büyük kart, çoklu seçim, "N seçildi" sayacı ve "Fark etmez". Görsel yoksa kart degradeyle çiziliyor.
8. **md.5:** "Planımı düzenle" tek sayfa (`KayitEdit`): 4 grup, 15 satır. Satıra dokununca kayıttaki bileşen alttan sayfada açılıyor. Kayıtta yeniden hesap yapılıyor ve "Günlük hedefin X → Y kcal" onayı çıkıyor. T1 yok, sağlık rızası tekrar sorulmuyor, kaydedilmemiş çıkışta onay isteniyor.
9. **Kontroller** (son kod): hygiene ✓ · tsc ✓ · unit 1411/1411 ✓ · jest 127 paket / 885 test / 3 anlık görüntü ✓ (`--ci`) · `expo export` iOS ✓ (3459 modül), Android ✓ (3466 modül).
10. Ekran görüntüleri `docs/night/g54/` altında (24 kare + `orient/` 20 + `neon/` 48), açık + koyu.

## Commit
| commit | içerik |
|---|---|
| `cd4b92f` | md.1 kayıt sonu T1 kuralı + KayitOffer + SubWelcome |
| `bb3bd42` | md.2 tek okuyucu planReader, depo doldurma, eski funnel kapalı |
| `b29f68c` | md.3 1.1.0 oryantasyonu + migration dosyası |
| `6813308` | md.7 neon kenar |
| `04e040b` | md.3 düzeltme: tanıtım kaydırıcısı klavye özellikleri |
| `a40c3ed` | md.8 tarama rozeti kaldırıldı |
| `b32dd94` | md.6 konum kapısı logosu |
| `579599d` | md.4 yemediklerin + mutfaklar |
| `345c4f0` | md.4 düzeltme: mutfak kaydırıcısı klavye özellikleri |
| `d624404` | md.5 düzenleme özeti |
| (sonraki) | docs(g54): vitrin sahneleri `G54-*` + ipucu hedefinin yeniden ölçümü + ekran görüntüleri + bu LOG |
| (son) | `docs/night/G54-S1-DONE` |

Not: `04e040b` ve `345c4f0`'daki iki düzeltme, yalnız git'teki dosyaları tarayan klavye testinden geldi. Bu testler yeni dosya git'e eklenmeden onu görmüyor; bu yüzden ilgili madde commit'inden sonra yakalandı ve hemen düzeltildi.

## md.1 ayrıntı
- Karar: `offerOnce.offerAllowed(userId, meta)` = aktif abonelik yok (RevenueCat ya da sunucu hakkının yüksek olanı, deneme dahil) **ve** hesapta işaret yok **ve** bu hesabın cihaz yedeğinde işaret yok. `openOfferIfAllowed` kök `KayitOffer {returnTo}`'yu açıyor.
- Çağrı noktaları: `PlanScreens` L2 kaydı (returnTo = kapıdan gelen eylem), `SignupScreens` A yolu (planSaved), `QuestionsScreen.finishShort` (B kısa profil). Düzenleme özeti bu yolu hiç çağırmıyor.
- Onay sayfası metni değişmedi (G46). Süre baskısı içeren ifade yok (testle doğrulandı).
- Tebrik ekranı: degrade zemin + cam kart, kupa yukarı süzülüp bir kez parlıyor (konfeti yok). Başlık "Hoş geldin, Kcalculate AI Balance!". Hak satırları gerçek veriden: günlük AI sayısı app_settings'ten, Koç yalnız Balance'ta ve Koç açıksa, barkod ve elle kayıt sınırsız. Deneme notu: "Deneme [tarih] tarihine kadar ücretsiz; istediğin an mağazadan iptal edebilirsin." Otomatik geçiş yok. Azaltılmış harekette kutlama yok.

## md.2 kaldırılan eski rotalar ve çağrı noktaları
- `PersonalPlan` (PersonalPlanFlowScreen) `yeni_kayit` açıkken **kayıtlı değil**. gateRouter: oturum yok → Login; profil yok → Kayit; var → PersonalPlanMine. (G47'de TakibeBasla, WelcomeGate ve Onboarding zaten kaldırılmıştı.)
- `PersonalPlanEdit` (eski "Tek ekranda düzenle") → `KayitEdit` (md.5).
- Çağrı noktaları: MyPlan boş hâli (doğrudan `Kayit {entry:'gate', returnTo: PersonalPlanMine}`); `entries.tsx` Profil satırı, Ana sayfa kartı, Koç çipi ve satın alma satırı; `PlanGenerateScreen` PersonalPlanNeeded / Düzenle. `FinPrProfileScreen` Hedefim satırı, `TrackerScreen`, `ProfileScreen`, `TakibeBaslaCTA`, `UnifiedLogin`, `LoginV2`, `HomeOnboardingSlot` ve `OnboardingNavigator` → NutritionProfile / TakibeBasla rotalarını açıyor; bunlar gateRouter'dan geçiyor (G47).

## md.3 ayrıntı
- Modül: `src/modules/onboarding/orient110/` (`logic.ts` saf mantık, `store.ts`, `useOrient110Target.ts`, `Orient110Host.tsx`). AppNavigator: `{yeniKayit ? <Orient110Host /> : <OrientHost />}`.
- "Eski müşteri" tanımı: bu cihazda onboarding 1–5 izi (`@kcal_kayit_onb`) yok.
- İşaret tur görünür olduğu anda yazılıyor. Böylece yarıda kapanan uygulama turu bir daha zorlamıyor ve "Geç" kalıcı oluyor. G18 senkron yapısı (`state.ts`) yeni alanı koruyor; cihaz kaydından hesaba taşımıyor.
- T1, tebrik ve AuthSheet açıkken kök yığında Ana sayfa odakta değil, bu yüzden hedef kaydı da yok. İzin sayfası ve kutlama overlayGate sayacıyla kaydoluyor.
- VoiceOver: balon metni duyuruluyor, odak hedefe gidiyor. Azaltılmış harekette geçişler anlık.
- Çekimde bulunan hata: sekme çubuğunun açılış yükselmesi sırasında ölçülen delik aşağı kayıyordu. Düzeltme: hedef ilk ölçümden 800 ms sonra bir kez daha ölçülüyor.

## md.7 neon kök neden
Işık katmanları `rx`'li `<Rect>` üzerinde reanimated `animatedProps` ile çiziliyordu. SVG kutusu da katmanın kendi onLayout ölçüsünden geliyordu (kartın dolgu kutusuna göre negatif ofsetli mutlak görünüm). Animasyonlu katmanın köşe ve kutu geometrisi temel kenarla aynı kalmadı. Bu yüzden ışık köşede dışarı taştı ve kart dışına taşan 10 pt parlama kenardan ayrı ikinci bir şerit gibi okundu (G53-Paywall-Dark-2 simülatör karesinde de görülüyor).
Düzeltme: geometri tek açık yol (`roundRectPath`, köşe yayları yolun içinde). Kutu kartın kenarlık kutusu; rozetler mutlak konumlu olduğu için ölçüye girmiyor. Temel kenar ve ışık aynı yolu kullanıyor, çizgi yarısı içe alınıyor. SVG açık ölçülü (w+20 × h+20) ve −10'a konumlu. Rozetler neon katmanından sonra çizildiği için ışığın üstünde kalıyor; ışık yolu rozetin altından kesintisiz geçiyor.

## md.4 kullanım noktaları
- Yemediklerin (standart anahtar + `custom:<metin>`): `kayit/plan.ts recipeAvoids/pickRecipes` (L2 tarif önerileri; özel metin malzeme anahtarında aranıyor), `toPpSaved` → `personal_plan.kayit.dislikes` (G34 `answers.dislikes`'a yalnız bilinen anahtarlar), `supabase/functions/coach-chat/plan.ts prefs` → Koç istemi `avoid` ("Hepsini yerim" seçiliyse boş).
- Mutfaklar: `personal_plan.kayit.cuisines`, Koç istemi `cuisines` (tercih olarak). `reg_q_answer` `q:'cuisines'`.
- Mutfak görselleri: `docs/tur28/mutfaklar/` henüz yok, 18/18 kart degradeyle çiziliyor. Görseller gelince repo kökünde `node scripts/sync-cuisine-images.mjs` çalıştırmak yeterli: dosyaları `assets/kayit/cuisines/`'e kopyalıyor ve `cuisineImages.ts` tablosunu yalnız var olan dosyalarla yazıyor. Eksik dosya Metro'da hata vermiyor.

## Ekran görüntüleri (`docs/night/g54/`, "G40 iPhone" 402 pt; neon için 375 pt iPhone SE 3 ve 430 pt iPhone 16 Plus)
- `G54-T1(-Dark)` kayıt sonu T1 · `G54-T1c(-Dark)` X → onay · `G54-Welcome(-Dark)` tebrik
- `G54-MyPlan(-Dark)` dolu Kişisel planım · `G54-Edit(-Dark)` düzenleme özeti · `G54-EditRow(-Dark)` satır düzenleme sayfası (Mutfaklar)
- `G54-Dislikes(-Dark)` seçili + özel öğe · `G54-DislikesSearch(-Dark)` arama "mant" · `G54-DislikesAdd(-Dark)` "‘Ejder meyvesi’ ekle"
- `G54-Cuisines(-Dark)` mutfak kartları (3 seçili, görsel yok → degrade) · `G54-Gate(-Dark)` konum kapısı logosu
- `orient/`: `G54-OrientIntro1–4(-Dark)`, `EN-G54-OrientIntro1(-Dark)`, ipuçları `G54-OrientScan / OrientHome` (profilsiz kart) `/ OrientRing` (profilli halka) `/ OrientKesfet / OrientEatkcal (-Dark)`
- `neon/`: `G54-Paywall` (Fresh), `G54-PaywallBalance`, `G54-T1` × açık/koyu × 375/430, her biri 4 kare (1,75 sn arayla = ¼ tur). Konum saate göre değişiyor; kareler ışığın üst kenar, köşe ve alt kenar konumlarını gösteriyor.

Yöntem: Metro bu worktree'den çalıştı (8146, CI kipi), storage kipiyle çekildi (G14 betiği, repo dışında). Native derleme yok; 375/430 pt simülatörlerine G40'taki derlenmiş uygulama kuruldu. Çekimden sonra Metro durduruldu, iki geçici simülatör silindi, G40 sıfırlanıp kapatıldı. İlter'in "iPhone 17" simülatörüne dokunulmadı. Vitrin kullanıcısında oryantasyon varsayılan olarak "görüldü"; yalnız kendi sahnelerinde zorlanıyor (diğer panolar etkilenmiyor).

## Apple HIG (kod denetimi, kendi kontrolüm)
- Dokunma alanları ≥ 44 pt: tanıtım "Geç", ipucu "İleri/Geç", mutfak kartları (260×320), "Fark etmez", arama satırları (48), özet satırları (54), sayfa "Vazgeç".
- VoiceOver: tanıtım sayfası etiketi ("Sayfa n / 4"), ipucu `alert` + "İpucu n / 4. Başlık. Metin", mutfak kartı `checkbox` + ad + örnek, özet satırı "Etiket: değer. Düzenlemek için dokun." Kupa ve cam nesnelerin etiketi var.
- Reduce Motion: kutlama yok, tanıtım kaydırması anlık, ipucu geçişleri anlık, neon sabit.
- Dynamic Type: yeni metinlerde kırpma yok (`maxFontSizeMultiplier` 1,25–1,5). Mutfak kartında yalnız örnek satırı tek satır.

## KARAR
1. **T1 "bir kez" cihaz yedeği:** Görev "hesap bazında" dediği için cihaz anahtarı artık kullanıcı kimliğiyle tutuluyor. Eski genel cihaz anahtarı (`@kcal_kayit_offer_shown`) karar için okunmuyor; aynı cihazdaki başka bir hesap T1 görebilir.
2. **Aktif abonelik bilinmiyorsa** (RevenueCat ve sunucu yanıtı yok) ücretsiz sayılıyor ve T1 açılıyor. Kayıt sonunda depo normalde dolmuş oluyor.
3. **B yolu kısa profil:** T1 kısa profilin son adımında açılıyor. K1b (B kaydı) profil oluşturmadığı için orada açılmıyor.
4. **Oryantasyonda "Geç":** Tanıtımdaki "Geç" tanıtımı ve ipuçlarını birlikte kapatıyor. Gerekçe: kullanıcı turdan çıkmak istiyor; ipuçları Ayarlar'dan yeniden izlenebiliyor.
5. **Keşfet ipucu** Keşfet sekmesini gösteriyor; profil kısayolu Keşfet ekranının içinde olduğu için metinde anlatılıyor.
6. **Kısa profil / eski profil plan görünümü:** Satırdaki hedef (kalori ve makrolar) gösterilen hedef oluyor. Cevaplar eksikse hesap adımları gizli ("Nasıl hesapladık?" sıfır göstermesin diye `algoVersion: 0`).
7. **Önce→sonra metni** "2320 → 2180 kcal" biçiminde: nokta ayracı yok (G17/GECE19 kuralı; görevdeki "2.320" örneği bu kurala uyduruldu).
8. **Profil › Kişisel bilgiler** ekranı ad, kullanıcı adı, e-posta ve telefon içeriyor, plan cevabı yok. Düzenleme özetine Profil › Hedefim → Kişisel planım → Düzenle yoluyla ulaşılıyor. Kişisel bilgiler'e ayrı satır eklenmedi.
9. **Açık temada neon temel kenarı** `limeLineOnLight` %35 ile çiziliyor, çünkü lime %35 beyaz kartta görünmüyor (G53 KARAR 2 ile aynı gerekçe).
10. **Mutfak kartı degradeleri** yalnız kayıt paletindeki renklerden (6 çift, sırayla).

## CANLIYA UYGULANACAK
- `supabase/migrations/20261115100100_g54_orient_v110_events.sql` (rollback: `supabase/rollbacks/20261115100100_g54_orient_v110_events_rollback.sql`): `analytics_event_names` içine `orient_v110_view` / `orient_v110_complete` / `orient_v110_skip`. İdempotent. Uygulanmazsa istemci olayları sözlükte olmadığı için reddedilebilir; uygulamanın işleyişi etkilenmez.
- Şema değişikliği yok: oryantasyon işareti mevcut `profiles.onboarding_state` jsonb'sinde (G18 kolonu), T1 işareti `user_metadata`'da.

## DEPLOY GEREKİR
- Uygulama: yalnız JS, 1.1.0 (build 32 / Android 25) için OTA'ya uygun. Canlıya gönderim İlter'in onayıyla (`eas update --channel production` onaysız yasak).
- **Edge function `coach-chat`** (`plan.ts` prefs + `prompt.ts` iki kural): Koç'un yemediklerini ve mutfakları dikkate alması için function deploy gerekiyor. Deploy edilmezse Koç eskisi gibi çalışır. Kural gereği backend commit'inin main'e cherry-pick'i de İlter'de (bu oturum main'e dokunmadı).

## SORULAR
1. `release/1.1.0` push edilemedi: oturumun izin sınıflandırıcısı `git push`u reddetti. Commit'ler yerelde duruyor: `git push origin release/1.1.0`.
2. Mutfak tercihleri öğün planı ve tarif önerisinde (G33 `ogun_plani` / `plan-generate`) henüz kullanılmıyor, çünkü tarif kataloğunda mutfak etiketi yok. Etiket eklensin mi?
3. Eski kişisel plan ekranları (`PersonalPlanFlowScreen`, `MyPlanEditScreen`) bayrak kapalıyken hâlâ kullanılıyor. `yeni_kayit` kalıcı olunca kaldırılsın mı?
4. Kişisel bilgiler (ad/e-posta) ekranına da "Planımı düzenle" satırı istenir mi (KARAR 8)?
5. Kanıt notu: canlı DB'yi okuma izni reddedildi. md.2 kök nedeni kod ve test ile doğrulandı (kayıt satırı `parseSaved`'den geçiyor; boş görünüm bellekteki depodan). İlter'in hesabındaki satırın biçimi doğrudan görülmedi.
