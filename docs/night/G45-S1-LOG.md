# G45-S1 LOG — Kayıt akışı: İlter'in simülatör düzeltmeleri (14 Kas)

Dal `feat/kayit-v2` · worktree `.claude/worktrees/g42-s1` · başlangıç G44 son hâli (`684d061`, `G44-S1-DONE` mevcut). Yalnız JS/TS, yeni paket yok, deploy / OTA / canlı DB yok. Onboarding 1–5'e dokunulmadı.

## ÖZET
1. **md.1 kesilen yazılar:** Kök neden `AppText` varsayılanının `lineHeight: 24` olması. Satır yüksekliği verilmemiş büyük yazılar (P3 tekerlekte 34 pt yıl, P8 galeride 28 pt "Hafif", T1, L2 h2/h3…) üstten kırpılıyordu. "Hafıf" görüntüsü de bu kırpmadan geliyordu: f'lerin üstü ve i'nin noktası kesiliyordu. Artık her kayıt yazı stilinde açık `lineHeight` var. Bricolage için bu en az 1,2 em (yazı tipinin doğal satırı 930/270). Tekerlek satırı 52 → 60 pt, seçili yıl 34/44. Büyük rakamlar düzeltildi: cetvel 88/106, tabak 88/106, L2 48/58; L1 52/64 zaten yeterliydi. Tüm bunlar testle korunuyor.
2. **md.1 bitişik harf:** Paketteki Bricolage 800'de `liga` yok, ama Plus Jakarta'da fi/fl/ff var. RN 0.81 Fabric iOS `fontVariant: no-common-ligatures` değerini yok sayıyor. Bu yüzden `KText` f ile i/l/f arasına U+200C ekliyor ve tüm kayıt ekranları (onboarding hariç) bunu kullanıyor. Erişilebilirlik etiketleri ham metinle kalıyor.
3. **md.2–3:** İkon altı soluk daireler kaldırıldı (P1, P2, P8 galerisi, P10, P13/P14). İkon doğrudan kartta duruyor: seçilmemişte `P.ink`, seçilide `limeInk`. Kart, hap ve çiplerde onay rozeti/tik yok; seçili hâl yalnız tam lime dolguyla anlaşılıyor. `accessibilityState.selected` kart, çip ve gün haplarında var. T1 radyosu ve K1 onay kutuları (bunlar onay kutusu) değişmedi.
4. **md.4:** Sayılı halka kaldırıldı. Geri düğmesinin sağında ekran genişliğine yayılan 3 pt, yuvarlak uçlu ince çubuk var: açıkta #3A5A1E, koyuda lime; iz yarı saydam beyaz. Oran mevcut `progressOf` mantığıyla hesaplanıyor. Dolma 250 ms, `CURVE.enter` ile (ease-out). L1, L2, K1, E1 ve E2'de çubuk yok.
5. **md.5:** L2 eatkcal kartı kaldırıldı; yerine eatkcal kampanya bannerı geldi. Veri ana sayfa şeridiyle aynı (`fetchBannerRows → campaignCellsFrom`, ilk görselli hücre); görüntü kaynağı da aynı (`CachedImage` + `bannerMedium`). Banner tam genişlikte, 300×104 oranında, yarıçap 20, başlık satırı yok. Dokununca: `bannerTargetToEk` kuralı uygulanıyor (ürün/mağaza il kapısından geçer); bilinmeyen hedef `resolveNavigation`'a, hedefsiz banner Kampanyalar'a gidiyor. Yalnız İzmir'de (`useHomeRegion`) ve banner varsa görünüyor.
6. **md.6:** L2 rıza kartı kaldırıldı. Düğmenin üstünde 13 pt, ortalı bir not var ve "Aydınlatma metni" bağlantısı uygulama içi KVKK metnine gidiyor. Düğme "Onayla ve planımı kaydet" / "Agree and save my plan" ve her zaman etkin. Basınca rıza `recordHealthConsent(true,'personal_plan')` ile kaydediliyor. Rıza önceden verilmişse not görünmüyor ve düğme "Planımı kaydet" oluyor. B yolu son adımı aynı düzende: "Onayla ve takibe başla", kaynak `'takibe'`.
7. **md.7:** K1/E1/E2 balonu 20 pt oldu (önce 24 → ~%15 küçük). Düğme metinleri 17 pt, "Devam ederek…" 13 pt, kutu metni 14 pt (alt not 12 pt), "İsteğe bağlı" 13 pt. Kutular işaretsiz başlıyor ve isteğe bağlı kalıyor.
8. **md.8:** Soru balonu 24 → 22 pt, P1 başlığı 34 → 31 pt. Kart başlıkları ~%10 küçüldü: 19→17, 18→16, galeri 28→25. Dar ekranda (< 360 pt) balon 21 pt, maskot 64 pt ve boşluklar daha sıkı. Font metriğiyle ölçüldü: 320 pt'de TR+EN tüm balonlar ≤ 2 satır. Ek güvence olarak varsayılan yazı boyutunda `numberOfLines=2` + `adjustsFontSizeToFit` (en çok %15) var; büyük yazıda satır sınırı yok (Dynamic Type).
9. **md.9:** T1 rozetlerinde kenar çizgisi ve 2° eğiklik kalktı. Rozet zemini lime; kart lime dolguluyken aynı saatle beyaza dönüyor, yazı siyah. "%… tasarruf" kartın içinde, fiyatın altında duruyor (alt kenara taşmıyor). Plan radyosu değişmedi.
10. **Kontroller:** hygiene ✓ · tsc ✓ · unit 1311 geçti / 0 kaldı / 1 atlandı ✓ · jest 112 paket / 706 test ✓ (yeni `g45Kayit` 23 test) · `expo export` iOS ✓ Android ✓ · eslint 0 hata. Onboarding: `git diff 069e521 -- OnboardingScreen.tsx assets/onboarding assets/coach` boş, `tr.onb`/`en.onb` hash testi geçti.

## Commit
| commit | içerik |
|---|---|
| `855eff4` | feat(g45): md.1–9 + vitrin (`-XL`, `L2c`, `BShort8c`) + `g45Kayit` testleri + G44 testinin rozet/metin beklentisi güncellendi |
| (sonraki) | docs(g45): ekran görüntüleri `docs/night/g45` + bu LOG |
| (son) | `docs/night/G45-S1-DONE` |

## Değişen dosyalar
| dosya | ne değişti |
|---|---|
| `ui/parts.tsx` | `noLig`/`KText`; `ProgressRing` → `ProgressBar`; `TopBar` (halka/glow yok); `QuestionHead` 22 pt, `compact` 20 pt, dar ekran 21 pt + 64 pt maskot, 2 satır; `CheckBoxRow` 14/12; açık satır yükseklikleri. `Mascot` ve `FONT` (onboarding'in kullandıkları) DEĞİŞMEDİ |
| `ui/pickers.tsx` | ikon dairesi ve `CheckBadge` yok; tekerlek 60 pt + `wheelOn/Near/Far`; kart başlıkları ~%10 küçük; çip/gün `selected` |
| `ui/theme.ts` | `barFill`, `barTrack`; `K_MOTION.ring` → `bar: 250` |
| `ui/consent.tsx` (yeni) | `HealthConsentNote` (13 pt not + Aydınlatma metni bağlantısı) |
| `banner.ts` (yeni) | `pickCampaign`, `openCampaign` (saf; testli) |
| `screens/PlanScreens.tsx` | L2 `CampaignBanner`, rıza notu + düğme metni, çubuk yok, satır yükseklikleri; yalnız `__DEV__` vitrin parametreleri `vitrinIzmir`, `vitrinConsent`, `vitrinEnd` |
| `screens/QuestionsScreen.tsx` | çubuk; B yolu rıza notu + "Onayla ve takibe başla"; büyük rakam 88/106; `__DEV__` `vitrinConsent` |
| `screens/SignupScreens.tsx` | K1/E1/E2 ölçek; K1 çubuk yok |
| `screens/OfferScreen.tsx` | T1 rozetleri; satır yükseklikleri |
| `screens/ReturnScreen.tsx` | `KText` + satır yükseklikleri |
| `i18n.ts` | `q.short_start_consent`, `q.consent_note`, `q.consent_link`, `plan.save_consent`, `plan.banner_label` (TR+EN); kaldırılan: `q.health_consent`, `plan.eatkcal_title/sub/fallback`. `onb` aynı |
| `src/dev/screenCatalog.ts` | `G42-*-XL` (extra-extra-extra-large ≈ 1,35×), `G42-L2` İzmir, `G42-L2c`, `G42-BShort8c` (yalnız dev) |
| `__component_tests__/g45Kayit.test.tsx` (yeni), `g44Kayit.test.tsx` | G45 sözleşmeleri; G44'ün "dolu rozet" beklentisi "rozet yok" oldu (brif: G45 geçerli) |

## Ekran görüntüleri (`docs/night/g45/`, iPhone 17 simülatörü 402 pt, açık + koyu)
`G45-P1-secili`, `G45-P3-tekerlek`, `G45-P8-Hafif`, `G45-P10`, `G45-L2` (rıza önceden verilmiş: düğme "Planımı kaydet"), `G45-L2-banner-riza` (banner + rıza notu, sona kaydırılmış), `G45-K1`, `G45-E2`, `G45-B-kisa-profil-son`, `G45-B-kisa-profil-son-riza`, `G45-T1` — her birinin `-Dark` sürümü var. Büyük yazı (≈ 1,35×): `G45-P3-tekerlek-XL`, `G45-K1-XL`.

## fi / fl taraması (kayıt metinleri, onboarding hariç)
TR: Hafif, Hedefin, fiyatla, profilinle, tarifler, tarifleri. EN: Cauliflower, confirm, different, finalised, find, first, fish, fit, flow, off, profile. Bunların hepsi `KText` ile U+200C alıyor. Bricolage başlıklarında `liga` olmadığı için zaten bitişmiyorlardı; Plus Jakarta gövde metinlerinde (ör. "tarifleri", "profilinle") bitişik harf vardı, artık kapalı.

## KARAR
1. **Bitişik harf: U+200C** (brifin yedek yolu). `fontVariant: ['no-common-ligatures']` RN 0.81 Fabric iOS'ta desteklenmiyor (`conversions.h` yalnız sayı/stilistik değerleri tanıyor). "Hafıf"in asıl nedeni kırpmaydı; U+200C ek güvence ve Plus Jakarta için gerçek bir düzeltme.
2. **Çubuk eğrisi:** proje kuralı yerel eğriyi yasaklıyor (`noLocalMotionTokens`). Ease-out karşılığı olarak token `CURVE.enter` (0.05, 0.7, 0.1, 1) kullanıldı.
3. **Koyu temada çubuk dolgusu lime:** #3A5A1E koyu yeşil zeminde görünmez; brif "ya da mevcut koyu vurgu" diyor.
4. **İzmir koşulu = `useHomeRegion`** (kayıtlı adres → il kapısı seçimi → izinli konum; izin istemi açmaz). G42 kartı aslında koşulsuz çiziliyordu ("İzmir'deysen" metniyle); brif "yalnız İzmir" dediği için artık koşullu. Yeni kullanıcıda bölge çoğu zaman bilinmiyor olacak, bu durumda banner gizli kalıyor.
5. **Aydınlatma metni bağlantısı:** KVKK'nın web yolu yok (`urls.ts`); uygulama içi `ProfileContracts` + `slug: 'kvkk'` kullanıldı (eatkcal il kapısıyla aynı).
6. **Rıza:** düğme her zaman etkin; rıza basınca yazılıyor (`recordHealthConsent` yerel + yan kuyruk, oturum açılınca gönderiliyor — G27). Rıza önceden verilmişse yeniden yazılmıyor. Store'daki `healthOk` da `true` oluyor.
7. **K1 balonu 20 pt:** brif "28 → 24" diyordu ama mevcut değer zaten 24'tü; "~%15 küçük" oranı esas alındı. md.8'deki genel %10 küçültmeyle birlikte genel balon 22 pt, K1/E1/E2 20 pt.
8. **İkon boyutu:** daire kalkınca ikonlar biraz büyütüldü (26→28, 22→24, 34→40), kart dolgusu ve yerleşim aynı kaldı.
9. **Banner kırpması:** eatkcal `CampaignCard` ile aynı (300×104, cover, `bannerMedium`).
10. **Büyük yazı 1,3×:** simülatörde tam 1,3 kademesi yok; en yakını extra-extra-extra-large (≈ 1,35×) kullanıldı.

## HIG (kod denetimi, değişen parçalar)
- Kırpılma: tüm kayıt yazı stillerinde açık satır yüksekliği var (testli). Dynamic Type ≈ 1,35×'te P3 ve K1 kırpılmıyor (ekran görüntüleri).
- Kontrast: çubuk dolgusu #3A5A1E açık zeminde, lime koyu zeminde iyi görünüyor. T1 rozeti siyah yazı / lime ya da beyaz zemin ≥ 15:1. Rıza notu `P.sec` 13 pt (açıkta ≈ 6:1).
- VoiceOver: çubuk `progressbar` rolünde, etiketi "Soru x / y". Seçim kartları ve çiplerde `selected` var. Rıza notu tek metin, bağlantı `link` rolünde. Banner `button` rolünde, etiketi hücre başlığı (yoksa "eatkcal kampanyası").
- Dokunma: çubuk alanı 44 pt. "Aydınlatma metni" bir cümle içi bağlantı (HIG istisnası; K1'deki Koşullar/Gizlilik bağlantılarıyla aynı).
- Azaltılmış hareket: çubuk dolumu anlık.

## SORULAR
1. **Banner görseli:** mevcut kampanya görseli ("kcal. Ailesine Hoşgeldin") 300×104'e göre tasarlanmamış; alt yazısı kesiliyor (`G45-L2-banner-riza.jpg`). eatkcal ana sayfa şeridinde de aynı kırpma var. Panelde banner görseli 300×104 güvenli alana göre mi yüklensin?
2. **İzmir koşulu:** yeni kullanıcının bölgesi genelde bilinmediği için banner çoğu kullanıcıda gizli kalacak. Bölge bilinmiyorsa da gösterilmesi istenirse tek satırlık değişiklik.
3. **Gerçek 320 pt kontrolü:** simülatörde 320 pt cihaz yok (SE 375). 2 satır, font metriğiyle (Bricolage 800 genişlikleri, 180 pt metin alanı) ölçüldü ve dar ekran düzeni birim testinde. Gerçek cihazda bakılması önerilir.
4. **Rıza metni:** "devam ederek" ile verilen açık rızanın hukuki yeterliliği için hukuk görüşü önerilir. Düğme metni "Onayla ve…" ile açık eylem içeriyor.
