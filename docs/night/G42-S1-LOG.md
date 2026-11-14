# G42-S1 — Yeni onboarding + kayıt ve kişisel plan akışı (13–14 Kas)

Worktree `~/dev/kcal-mobile/.claude/worktrees/g42-s1`, dal `feat/kayit-v2` (`release/1.1.0` / `89f92c9` üstünden). Yalnız JS/TS + asset (OTA uyumlu). Yeni paket yok. Deploy, OTA ve canlı DB yazımı yapılmadı.

## ÖZET
1. **md.1** `yeni_kayit` bayrağı eklendi (yerel varsayılan KAPALI). Migration yalnız DOSYA olarak yazıldı: `20261113120100_g42_yeni_kayit.sql` + rollback. A yolu ayrıca `kisisel_plan` ister; o kapalıysa 5. ekrandaki segment gizlenir ve herkes B yoluna gider. Bayrak kapalıyken `Kayit`/`KayitShort` rotaları kayıtlı değil, açılış rotası zinciri aynı. Bu, `flagOffRoutes` testi ve bileşen testiyle doğrulandı.
2. **md.2** 5 ekranlık onboarding OBS'ye birebir yapıldı: panorama (450 ms), maskot ayrı katmanda (M tablosu), süzülme ve göz kırpma, Azaltılmış hareket desteği, Çek/Anlat/Sor çipleri, başlangıç kartları ve Şimdi/Sonra segmenti. Atla yok; geri hareketi önceki ekrana döner; uygulama kapanıp açılınca kaldığı ekrandan devam eder. Referansla ölçülen genel SSIM: 8 panoda 0,800–0,877. 4. ekranda 0,78; nedeni, Devam düğmesinin HIG gereği ev göstergesi alanının üstüne taşınması.
3. **md.3** A yolu P1–P14 tamamlandı. Koşullar: P3b, P6/P6k, P7/P7g, I1/I2 ara ekranları, görünen soru sayısına göre değişen ilerleme halkası, cm/kg ↔ ft-in/lb birim anahtarı (EN'de cihaz bölgesine göre).
4. **md.4** L1 ve L2, MEVCUT G34 `computePlan` ile hesaplanıyor. Kas kazanmak = TDEE + `app_settings` 250 kcal. L2'de kilo tahmini bir aralık bandı olarak gösteriliyor; ayrıca öğün dağılımı, G33 kataloğundan 3 tarif ve koşullu eatkcal kartı var.
5. **md.5/6** K1/E1/E2 mevcut `useAuth` üzerine kuruldu; iki isteğe bağlı kutu işaretsiz geliyor. Plan e-postası için mevcut Resend altyapısıyla `plan-email` edge function DOSYASI yazıldı (**deploy gerekir**). Deploy olmadan e-posta bandı gösterilmez.
6. **md.7** R1: taslak cihazda 7 gün tutuluyor, süre dolunca sessizce siliniyor. **md.8** T1 mevcut RevenueCat kartları ve satın alma akışıyla yapıldı. **md.9** B yolu (kısa profil = mevcut takip kapısı) tamamlandı; "Planını geliştir" kartının yeri ayrıldı.
7. **md.10** Hareket token'ları kullanıldı. Dokunma alanı ≥ 44 pt, VoiceOver etiketleri, Dynamic Type tavanları ve Azaltılmış hareket desteği var. **md.11** 8 huni olayı eklendi; olaylara sağlık değeri gönderilmiyor.
8. **md.12** Kontroller: hygiene ✓ · tsc ✓ · unit **1311 geçti / 0 kaldı / 1 atlandı** (1312) ✓ · jest **673/673** ✓ · `expo export` iOS ✓ · Android ✓. 38 ekran görüntüsü + 10 yan yana karşılaştırma `docs/night/g42/` altında.

## Commit
| commit | içerik |
|---|---|
| cbf79e2 | md.1 bayrak + migration/rollback, md.11 olay sözlüğü, saf model (koşullar, halka, birim, plan, 7 gün), sahne WebP betiği + `assets/onboarding` |
| 8473cc9 | md.2 onboarding 5 ekran + md.10 kayıt temel parçaları (zemin, maskot, halka, balon, düğme, segment) |
| 93fe570 | md.3 P1–P14 + bileşenler (kart, tekerlek, cetvel, tempo, galeri, gün, çip, etiket bulutu, tabak) |
| 8738622 | md.4 L1 + L2 |
| a04811d | md.5 K1/E1/E2 + md.6 `plan-email` (dosya) |
| 9c3cb22 | md.7 R1 |
| eb08546 | md.8 T1 |
| bdad06d | md.9 B yolu + kısa profil kapısı + "Planını geliştir" yeri; kök navigasyon bağlantısı |
| 0cf044f | vitrin `G42-*` (yalnız `__DEV__`) + birim testleri |
| 98f62dd | md.12 bileşen testleri |
| b00012e | simülatör düzeltmeleri + ekran görüntüleri + karşılaştırmalar |
| 6dc8922 | md.10 kaydırma kapları ortak klavye özellikleri (`SCROLL_KEYBOARD`) |
| (son-1) | HIG denetimi düzeltmeleri + güncel ekran görüntüleri + LOG |
| (son) | `docs/night/G42-S1-DONE` |

## Migration'lar (YALNIZ DOSYA — uygulanmadı)
- `supabase/migrations/20261113120100_g42_yeni_kayit.sql`
  - `feature_flags`: `yeni_kayit` (enabled=false, rollout 0, min_app_version 1.1.0)
  - `app_settings`: `kayit_muscle_surplus_kcal = 250`, `kayit_plan_email_enabled = true`
  - `analytics_event_names`: `onb_step_view`, `onb_path_choice`, `reg_q_answer`, `plan_ready`, `reg_signup_method`, `meta_consent`, `paywall_view_reg`, `trial_start_reg`
- Rollback: `supabase/rollbacks/20261113120100_g42_yeni_kayit_rollback.sql`
- Yeni tablo veya kolon yok. Plan G34 kolonlarına yazılıyor (`user_nutrition_profiles.personal_plan` + `target_*`). Kayıt akışına özgü cevaplar jsonb'de `kayit` anahtarında.
- Ön koşul: G34 (`20261112110100`) ve G36 migration'ları canlıda olmalı. G34 kolonları yoksa `savePlan` mevcut kolonlara düşer (yalnız hedefler kaydedilir).

## CANLIYA UYGULANACAK
1. `supabase db push` → `20261113120100_g42_yeni_kayit.sql` (G34 migration'ı uygulandıktan sonra).

## DEPLOY GEREKİR
1. `supabase functions deploy plan-email` (`RESEND_API_KEY` mevcut sırrı kullanılır). Deploy edilmezse çağrı 404 döner ve uygulama bandı göstermez; kayıt akışı etkilenmez.
2. OTA: bu dal yalnız JS + asset içeriyor. `release/1.1.0`'a merge, İlter onayıyla ve G41 build'inden sonra yapılacak.

## Bayrak açma adımları
1. Migration'ı uygula (yukarıda). Bayrak satırı KAPALI olarak oluşur.
2. `plan-email` fonksiyonunu deploy et (isteğe bağlı; deploy yoksa bant çıkmaz).
3. Diyetisyen onayı gelene kadar `kisisel_plan` kapalı kalsın: `yeni_kayit` açılınca herkes B yoluna gider (kayıt → ana sayfa → ilk kalori kaydında kısa profil).
4. Test: `update feature_flags set enabled = true, rollout_percent = 100 where key = 'yeni_kayit';` (önce iç test için `rollout_percent` düşük). Bayrak soğuk açılışta bir kez okunur, yani uygulama yeniden açılınca etkinleşir.
5. A yolu için ayrıca `kisisel_plan` açılır. T1 için `abonelik` + RevenueCat anahtarları gerekir; koç metni `koc` açıksa görünür.
6. Geri alma: bayrağı kapat (soğuk açılışta eski akış) ya da rollback dosyasını uygula.

## KARAR
1. **Sahne 2/3 boyutu**: görev "1290×2796, ortadan kırp" diyordu. OBS ise bu iki sahneyi genişliğe oturtup alta yaslıyor (`height: 393·3840/2307; bottom: 0` + 40 pt geçiş maskesi). Ortadan kırpınca küreler/çipler ~100 pt kayıyor ve OB-TR-02/03 referansından sapıyordu. Bu yüzden 1290×2147 olarak genişliğe oturtuldu; hiçbir şey kesilmiyor. Boyutlar 41–133 KB (≤ 400 KB). Betik: `scripts/build-onboarding-scenes.sh` (`sips` + `cwebp`).
2. **5. ekran kart ikonları** sahne-5 görseline gömülü (OBS kartı `padding-left: 92`). Uygulama yalnız kart çerçevesini ve metni çiziyor. Seçili kart lime kenar alıyor (tasarımda seçili hâl yok; erişilebilir radio için eklendi). Hiçbiri seçilmezse "Takip" varsayılır.
3. **Maskot**: OBS SVG yerine `assets/coach/koc-acik/kapali.png` kullanıldı (G39 varlıkları; referans görsellerdeki 3B maskotla aynı). Göz kırpma için açık/kapalı görseller değiştiriliyor.
4. **Sağlık verisi açık rızası**: tasarımda ayrı bir rıza adımı yok, ama boy/kilo/yaş/hedef KVKK'da sağlık verisi sayılıyor. Mevcut G27/G36 altyapısı kullanıldı: L2'de "Planımı kaydet" düğmesinin üstünde işaretsiz bir rıza satırı var, işaretlenmeden kayıt yapılamaz. B yolunda aynı satır kısa profilin son adımında. Daha önce rıza verilmişse satır gizlenir. Kayıt öncesi cevaplar yalnız cihazda tutuluyor.
5. **B yolunda 18+**: doğum yılı kayıttan önce sorulmadığı için mevcut LoginV2 kuralı (18+ beyan kutusu) K1b'ye zorunlu ve işaretsiz bir kutu olarak kondu. A yolunda yaş P3'ten biliniyor.
6. **Sistem geri hareketi**: `react-native-gesture-handler` projede yüklü değil (yeni paket yasak). Onboarding ve sorular tek rota içinde adım değiştiriyor; sol kenar kaydırma PanResponder ile, Android geri tuşu BackHandler ile yapıldı. K1→E1→E2 yığın geçişi native.
7. **"Paylaşılan öğe" geçişi** (seçilen kart → sonraki başlık) birebir yapılmadı. Yerine içerik 330 ms sağdan kayıyor, arkadaki 3 ışık katmanı farklı hızlarda kayıyor (paralaks), O5→P1 550 ms sahne geçişi var. Gerçek paylaşılan öğe için reanimated `sharedTransitionTag` native-stack sürümünde deneysel.
8. **T1 X → HA** her zaman Ana sayfa (görev md.8). Başlangıç kartına göre ilk sekme seçimi B yolunda uygulanıyor (Takip → Ana sayfa, Tarif ve sipariş / Etkinlik ve topluluk → Keşfet; `kesfet` kapalıysa Ana sayfa).
9. **"Bu e-posta zaten kayıtlı" (D-E1-kayitli)**: istemci, hesabın var olup olmadığını sunucuya sormadan bilemiyor (e-posta numaralandırma riski). Supabase OTP yeni ve eski hesapta aynı çalışıyor; ayrı bir hâl yapılmadı.
10. **R1 depolama**: AsyncStorage (uygulama kum havuzu, iOS veri koruması). Şifreli depo için `expo-secure-store` paketi yüklü değil ve yeni paket yasak. 7 gün ilk çıkıştan sayılıyor; her cevap süreyi uzatmıyor.
11. **L2 tarif görselleri**: G33 tarif kataloğunda fotoğraf yok, cam kase (`assets/glass/bowl.png`) yer tutucu olarak kullanıldı. Katalog boşsa (üretimde yayımlanmış tarif yok) bölüm gizleniyor.
12. **Kas kazanmak**: G34 motorunda 'gain' tempolu fazla demek (0,25 → 275 / 0,5 → 300, en çok 300). Görev "+250 sabit, tempo yok" diyor. Bu yüzden motorun koru (maintain) TDEE'si + `app_settings` fazlası kullanıldı, makrolar aynı `computeMacros` ile hesaplandı. Yeni formül yok. "Kilo almak" motorun 'gain' + 0,25/0,5 temposu.
13. **G34 HomePlanCard**: `yeni_kayit` açıkken bu kart "Planını geliştir" yerine (`PlanImproveSlot`) devrediyor, iki kart aynı anda görünmüyor. `yeni_kayit` kapalıyken G34 davranışı aynı.
14. **Pazarlama onayı** mevcut `notification_preferences.marketing_enabled` alanına yazılıyor (`setMarketingOptIn`). Kutu işaretsizse hiçbir şey yazılmıyor (varsayılan kapalı).

## Ekran görüntüleri (`docs/night/g42/`)
Simülatör: mevcut "G40 iPhone" (`D2B68EDD-…`, 1.1.0 dev build). Native derleme yapılmadı (boş disk 18 GB < 20 GB). Metro bu worktree'den 8142 portunda çalıştı. Çekim `scripts/dev/g14-shots.sh` (storage kipi) + vitrin `G42-*` ile yapıldı.
- Onboarding: `G42-Onb1…5` (TR), `EN-G42-Onb1…5` (EN)
- A yolu: `G42-P1`, `P3`, `P4` (+`EN-G42-P4`), `P7`, `P8`, `P11`, `P13`, `I1`, `L1`, `L2`, `K1`, `K1b`, `E2`, `T1` (yıllık), `T1m` (aylık), `R1`
- B yolu kısa profil: `G42-BShort` (B-P1), `G42-BShort8` (B-P8 + rıza + "Takibe başla")
- Dark: `G42-P1-Dark`, `P4-Dark`, `L1-Dark`, `L2-Dark`, `K1-Dark`, `E2-Dark`, `T1-Dark`, `BShort8-Dark`
- Yan yana (referans | simülatör): `karsilastirma/OB-TR-01…05-yanyana.jpg`, `OB-EN-01…05-yanyana.jpg`

### Ölçüm (referans OB-*.jpg ↔ simülatör, gri ton SSIM, 8×8 pencere, 300 px)
| pano | genel | üst (0–30%) | orta | alt (75–100%) |
|---|---|---|---|---|
| OB-TR-01 | 0,815 | 0,875 | 0,835 | 0,739 |
| OB-TR-02 | 0,859 | 0,700 | 0,937 | 0,934 |
| OB-TR-03 | 0,872 | 0,748 | 0,902 | 0,959 |
| OB-TR-04 | 0,781 | 0,755 | 0,869 | 0,670 |
| OB-TR-05 | 0,800 | 0,895 | 0,764 | 0,783 |
| OB-EN-01 | 0,855 | 0,871 | 0,903 | 0,754 |
| OB-EN-02 | 0,872 | 0,749 | 0,932 | 0,936 |
| OB-EN-03 | 0,877 | 0,761 | 0,904 | 0,960 |
| OB-EN-04 | 0,780 | 0,744 | 0,869 | 0,670 |
| OB-EN-05 | 0,800 | 0,860 | 0,778 | 0,784 |

Bölgelerdeki farkların nedenleri:
- **Üst (2–4)**: referansta durum çubuğu ve Dynamic Island yok, simülatörde var. Ayrıca vurgulu hapın köşesi: RN'de iç içe metin `border-radius` desteklemiyor, bu yüzden hap köşeli. Alt metin satır kırılımı da farklı: OBS'deki `text-wrap: balance`, RN'de yok.
- **Alt (1)**: başlık satır kırılımı farklı ("Hayatına / yön vermeye" yerine "Hayatına yön / vermeye"). Sebep `text-wrap: balance` yokluğu.
- **Orta (5)**: kartlar sabit konumda; seçili kart lime kenar alıyor (KARAR 2).
- **Alt (4, 5) — HIG gereği bilinçli sapma**: OBS'de 4. ekranın Devam düğmesi alttan 20 pt, 5. ekranın "Giriş yap" satırı ~28 pt yukarıda. İkisi de iPhone'un 34 pt'lik ev göstergesi alanında kalıyordu. HIG denetiminden sonra alt öğeler `safeAreaInsets.bottom` üstüne alındı (Devam ~14 pt yukarı). Bu yüzden 4. ekranın alt bölgesi 0,67'ye, geneli 0,78'e düştü. Küçük ekranda (iPhone SE) segment ile Devam düğmesinin çakışması da bu sırada giderildi (segment konumu Devam'a göre sınırlanıyor).
- Konumlar OBS'nin 393×852 çerçevesinden ekrana ölçekleniyor (cihaz 402×874).

## Apple HIG denetimi (apple-design-skill, kod denetimi kipi)
Denetimi bir alt ajan yaptı (apple-design-skill, kod denetimi kipi; kod + 7 ekran görüntüsü). Bulgular ve yapılanlar:

**Düzeltildi**
- (Yüksek) Onboarding'de güvenli alan yoktu: 4. ekranın Devam düğmesi ve 5. ekranın "Giriş yap" satırı ev göstergesi alanındaydı. Artık `insets.bottom` üstündeler.
- (Yüksek) iPhone SE'de (667 pt) 5. ekran segmenti Devam ile ~4,6 pt çakışıyordu. Segment konumu artık Devam'a göre sınırlanıyor.
- (Yüksek) Seçilmeyen kartlar %62/%70 opaklıkla soluklaştırılıyordu; 14 pt ikincil metin ~2,5:1 kontrasta düşüyordu (AA 4,5:1 altında). Artık metin soluklaşmıyor: seçilmeyen kart 0,97 ölçek + saydam zeminle geri çekiliyor. Tasarımdaki "%62 opaklık" bu nedenle uygulanmadı. Hareket galerisinin yan kartları tasarımdaki gibi %62 kaldı (yarısı ekran dışında olan önizleme kartları).
- (Yüksek) VoiceOver ile onboarding'de geri dönülemiyordu (görünür geri düğmesi yok, kenar kaydırma VoiceOver'da çalışmaz). Onboarding ve soru ekranlarına `onAccessibilityEscape` (iki parmak "Z" hareketi) eklendi.
- (Orta) T1'de "%… tasarruf" rozeti "ayda N TL" satırının üstüne biniyordu. Önerilen karta alt boşluk eklendi.
- (Orta) Segment seçenekleri 40/36 pt'ydi. Artık 44 pt (kayıt segmenti 52 pt kap; onboarding segmentine `hitSlop`).
- (Orta) OTP kutu grubunun rolü ve değeri yoktu. `accessibilityRole="button"` + "n/6" değeri eklendi.
- (Düşük) "Yeni kod gönder" rolü link'ten button'a çevrildi. L1'de etkin satıra canlı bölge (polite) eklendi. T1 başarı ekranındaki 2 sn otomatik geçiş, ekran okuyucu açıkken yapılmıyor.

**Açık bırakıldı (gerekçeli)**
- (Orta) Apple logosu elle çizilmiş SVG yolu. Bu, uygulamanın mevcut giriş ekranlarındaki G18-S5 kararıyla aynı bileşen (`pieces.tsx` AppleLogo). Tasarımda Apple/Google düğmeleri "resmî stil + logo yeri" olarak çizilmiş. Önerilen çözüm `expo-apple-authentication`'ın `AppleAuthenticationButton`'ı (native, paket mevcut) → SORULAR 9.
- (Orta) K1'deki "Kullanım Koşulları / Gizlilik Politikası" bağlantıları metin içi; dokunma yüksekliği ~20 pt. Tasarım metni böyle. T1'de 44 pt'lik ayrı bağlantılar var → SORULAR 9.
- (Orta) 5. ekran kart ikonları sahne görseline gömülü. Çok büyük yazıda kart metni büyüyüp ikondan kayabilir (yazı tavanı 1,3×) → KARAR 2.
- (Düşük) Düğme fiilleri tasarım metniyle aynı bırakıldı ("Apple ile Giriş Yap" / "Google ile devam et"). Google kenar rengi #DADCE0 (mevcut bileşenle aynı).

**Sorunsuz bulunanlar**: 3.1.2 teklif ekranı (fiyat, deneme süresi ve sonrası ücret, 24 saat otomatik yenileme metni, Geri yükle, EULA/Gizlilik 44 pt); Azaltılmış hareket yolları; tekerlek/cetvel/adımlayıcıda `adjustable` + artır/azalt; 52/56 pt ana düğmeler; koyu tema metin kontrastı.

## SORULAR
1. **4. ekran (Padel/etkinlik)**: uygulamada etkinlik veya buluşma özelliği yok (`etkinlik` bayrağı = egzersiz kaydı, kapalı). Metin geçici olarak "Keşfet'te paylaş, takip et, ilham al." / "Share, follow and get inspired on Explore." yapıldı. Başlık ("Etkinliklere katıl, sosyalleş.") ve sahne-4 görseli (Padel Turnuvası kartı) OBS'deki gibi kaldı. Başlık ve görsel de değişsin mi? 5. ekrandaki "Etkinlik ve topluluk" kartı şimdilik Keşfet'e gidiyor.
2. **Plan e-postası**: `plan-email` deploy edilsin mi? Gönderen `KCAL <hello@eatkcal.com>`, içerik yalnız plan özeti (hizmet e-postası). Apple gizli adresi için Apple Developer'da e-posta röle alanı `eatkcal.com` kayıtlı olmalı.
3. **Sağlık rızası yerleşimi** (KARAR 4): L2'deki zorunlu rıza satırı tasarımda yok. Ayrı bir ara ekran mı olsun, yoksa bu yerleşim uygun mu?
4. **B yolunda 18+ kutusu** (KARAR 5): tasarımda K1b'de yok, ama mevcut kural gerektiriyor. Kalsın mı?
5. **Kas kazanmak +250** (KARAR 12) ve **tahmini aralık bandı** (hafta × 0,9–1,25): diyetisyen onayı gerekli.
6. **R1 şifreleme**: `expo-secure-store` (native, yeni build ister) eklensin mi?
7. **Paylaşılan öğe geçişi** (KARAR 7): reanimated paylaşılan geçişi denensin mi (deneysel)?
8. **Kayıtlı e-posta hâli** (D-E1-kayitli, KARAR 9): sunucu tarafında bir kontrol istenir mi?
9. **Apple düğmesi / metin içi yasal bağlantılar** (HIG denetimi): `AppleAuthenticationButton`'a geçilsin mi? K1'e ayrı 44 pt Koşullar · Gizlilik satırı eklensin mi?
10. "G40 iPhone" simülatörü açık bırakıldı. Kapatmak için: `xcrun simctl shutdown D2B68EDD-D6A9-4059-98B8-232F5CF8A804`.
