# G44-S1 LOG — Kayıt akışı: seçim hâlleri, dolgu, hareket ve geçiş inceltmesi (14 Kas)

Dal `feat/kayit-v2` · worktree `.claude/worktrees/g42-s1` · başlangıç G42 son hâli (`069e521`; G43 dalda geri alınmış: `cbab489`…`f7be6f4` revert commit'leri mevcut, `git diff 069e521 f7be6f4` boştu). Yalnız JS/TS (OTA uyumlu), yeni paket yok, deploy / OTA / canlı DB yok.

## ÖZET
1. **Soluklaştırma yok (md.1):** seçim sonrası diğer kartlar soluklaşmıyor, küçülmüyor, saydamlaşmıyor (P1, P2, P10 kartları; P8 galeri yan kartları; P13/P14 liste kartları; T1 plan kartları — satın alınırken de 0,6 opaklık yok). P9'da "Spor yapmıyorum" seçiliyken gün hapları / spor çipleri artık devre dışı + soluk değil; dokunmak o seçimi kaldırır. P12 boş tabaklar 0,6 ölçek yerine tam boy cam yüzey.
2. **Seçili hâl (md.2):** seçili = mevcut lime ile TAM dolgu, üstünde `limeInk` (#0A0A0A) ikon ve metin, sağ üstte dolu onay rozeti (limeInk daire + lime ✓). Seçilmemiş = cam yüzey (`P.card`) + ince kenar (`P.cardEdge`). Haplar, çipler, gün hapları, segment, tempo seçici, tabaklar ve T1 radyosu aynı mantıkta. Hâl değişimi 160 ms renk/kenar geçişi (yay yok, zıplama yok, rozet yaysız fade).
3. **Basış (md.3):** kartlar, haplar, çipler, ana düğme, yuvarlak düğmeler, K1 sosyal düğmeleri, onay kutusu satırları: basılıyken 0,98 ölçek, bırakınca 120 ms'de geri döner. Seçimde hafif seçim titreşimi (ana düğme de `selection`).
4. **Animasyonlar (md.4):** girişler tek seferlik 10 pt + fade, 240 ms, kademe 35 ms (5 kartta toplam 140 ms, üst sınır 150 ms). Soru balonunda harf harf yazma kaldırıldı, metin 200 ms fade. L1/L2 sayaç 600 ms ease-out (önce 990). Maskot (kayıt ekranları): süzülme ±3,5 pt (yarı genlik), her cevapta zıplama yerine tek baş sallama (−6° → +4° → 0, 290 ms; cetvel çentiklerinde art arda tekrar etmez); göz kırpma aynı. Işık katmanı paralaksı yarı genlik + 700 ms. Azaltılmış harekette hepsi anlık.
5. **Geçişler (md.5):** soru → soru = KQuestions içinde native iOS yığın geçişi hissi (`StackSwap`: yeni içerik sağdan tam genişlikte, eskisi %30 sola çekilir; 330 ms standart eğri; kenardan geri kaydırma / Android geri ters yönde). O5 → P1, P14 → L1, L1 → L2 = 250 ms çapraz geçiş. K1 → E1 native push, E1 → E2 ekran içi push (`PushIn`). T1 alttan tam ekran modal. Paylaşılan öğe taklidi kaldırıldı. Azaltılmışta geçiş yok.
6. **Kapsam koruması:** onboarding 1–5 BAYT BAYT aynı — `git diff 069e521 -- src/modules/kayit/screens/OnboardingScreen.tsx assets/onboarding src/modules/kayit/i18n.ts assets/coach` boş. Paylaşılan `Mascot` onboarding'de (`<Mascot fill />`) G42 davranışını koruyor (±7 pt, zıplama); onboarding'in kullandığı `K_MOTION.pan/floatAmp/floatHalf/blink*` değişmedi. Testle korunuyor (blob hash + onboarding metin hash).
7. **Görsel dil aynı:** degrade zemin, ışık katmanları, cam yüzeyler, palet (yalnız `limeInk`/`limeInkSec` eklendi — md.2'nin istediği seçili metin rengi), maskot, yerleşim, tipografi, bileşen tipleri, metinler değişmedi.
8. **Kontroller:** hygiene ✓ · tsc ✓ · unit 1311 geçti / 0 kaldı / 1 atlandı ✓ · jest 111 paket / 683 test ✓ (yeni `g44Kayit.test.tsx` 10 test dahil) · `expo export` iOS ✓ · Android ✓ · eslint `src/modules/kayit` 0 hata.
9. **Ekran görüntüleri:** `docs/night/g44/` — P1 (seçimli), P4, P8, P10, P11, L1, L2, K1, T1, açık + koyu (18); P1 seçim geçişi 3 kare + dizi; `karsilastirma/` 14 yan yana (sol G42, sağ G44).
10. **Simülatör:** "G40 iPhone" (`D2B68EDD-…`) açık; Metro bu worktree'den 8142'de (önceden çalışıyordu, dokunulmadı). Native derleme yapılmadı.

## Commit
| commit | içerik |
|---|---|
| `3c169ff` | feat(g44): seçim hâlleri + basış + giriş/balon/sayaç/maskot/paralaks + geçişler; `ui/motion.tsx`; `g44Kayit` testleri |
| (sonraki) | chore/docs(g44): yalnız `__DEV__` vitrin `G42-P1pick` (P1 seçimsiz açılır, 6 sn sonra seçer — seçim dizisi çekimi); ekran görüntüleri `docs/night/g44`; bu LOG |
| (son) | `docs/night/G44-S1-DONE` |

## Değişen dosyalar (069e521 → bu dal)
| dosya | ne değişti |
|---|---|
| `src/modules/kayit/ui/motion.tsx` (yeni) | `useSelectTween` (160 ms seçim geçişi, rAF), `mixColor`/`parseColor`, `usePressScale` + `PressScale` (0,98 / 120 ms), `useKCount` (600 ms), `StackSwap` (soru → soru yığın geçişi), `PushIn` (E1 → E2) |
| `src/modules/kayit/ui/theme.ts` | `K_MOTION` G44 tablosu (select/press/enter/stagger/bubbleFade/count/nod/parallax/push/cross…); kaldırılan: `typeChar`, `pickScale`, `dimScale`, `dimOpacity`, `shared`, `scene`; `limeInk`, `limeInkSec` |
| `src/modules/kayit/ui/parts.tsx` | paralaks yarı genlik + yavaş; `Mascot` `motion` kipi (onboarding G42 / kayıt G44); balon fade (harf harf yok, `typewriter` → `fade`); `KButton`, `CircleButton`, `Segment`, `CheckBoxRow` basış + seçim geçişi; `Rise` 10 pt / 240 ms / kademe ≤ 150, azaltılmışta anlık |
| `src/modules/kayit/ui/pickers.tsx` | `ChoiceTile`/`OptionCard` (`dimmed` kaldırıldı), dolu `CheckBadge`, `PaceSelector`, galeri `ActCard` (soluk/küçük yan kart yok + rozet), `DayPills`, `ChipToggle`, etiket bulutu, tabak adımlayıcı, `Plate` |
| `src/modules/kayit/screens/QuestionsScreen.tsx` | `StepSlide` → `StackSwap`; `dimmed` yok; P9 devre dışı bırakma yok; P13/P14 giriş kademesi; I1/I2 giriş; `__DEV__` `vitrinPick` |
| `src/modules/kayit/screens/PlanScreens.tsx` | L1/L2 `useKCount` (600 ms); L1 `useRoute` koşulsuz (eslint rules-of-hooks hatası) |
| `src/modules/kayit/screens/OfferScreen.tsx` | T1 plan kartı: tam lime + limeInk + dolu radyo, satın alırken soluklaşma yok, basış 0,98/120 (yay yok); başarı rozeti yaysız |
| `src/modules/kayit/screens/SignupScreens.tsx` | K1 sosyal / e-posta düğmeleri basış ölçeği; E1 ↔ E2 `PushIn`; balon `fade={false}` |
| `src/modules/kayit/screens/ReturnScreen.tsx` | R1 kart girişi G44 bandında (önce 550 ms / 80 pt) |
| `src/modules/kayit/KayitNavigator.tsx` | çapraz geçiş 250 ms (KQuestions/KCalc/KResult), push (KSignup/KEmail), T1 `fullScreenModal` + `slide_from_bottom`, azaltılmışta `none` |
| `src/dev/screenCatalog.ts` | yalnız `__DEV__` vitrin `G42-P1pick` |
| `src/modules/kayit/__component_tests__/g44Kayit.test.tsx` (yeni) | onboarding bayt kontrolü, hareket bantları, renk karışımı, P1/P10 soluklaştırma yok + seçili hâl, harf harf yok, P9, geçiş seçenekleri |

## Ekran görüntüleri (`docs/night/g44/`)
- `G44-P1` (seçimli: Kilo vermek), `G44-P4`, `G44-P8`, `G44-P10`, `G44-P11`, `G44-L1`, `G44-L2`, `G44-K1`, `G44-T1` + her birinin `-Dark` sürümü (vitrin `G42-*` panoları, `scripts/dev/g14-shots.sh` storage kipi).
- Seçim geçişi (P1, 60 fps simülatör kaydından): `G44-P1-secim-1-once.jpg` (seçim öncesi), `-2-gecis.jpg` (~%50, geçişin 50. ms'si civarı: yarı karışık lime + soluk rozet), `-3-sonra.jpg` (tam lime + limeInk + dolu rozet); üçü yan yana `G44-P1-secim-dizi.jpg`. Ölçülen geçiş: kart bölgesi parlaklığı 11,667 → 11,783 sn (~8 kare ≈ 130–160 ms).
- `karsilastirma/<Pano>-G42-G44.jpg` (sol G42, sağ G44): P1, P1-Dark, P4, P4-Dark, P8, P11, L1, L1-Dark, L2, L2-Dark, K1, K1-Dark, T1, T1-Dark. Görünen farklar: P1/P10 seçili kartta dolu siyah rozet; P8 yan kartlar tam opak/tam boy + seçili kartta rozet; T1 radyo dolu limeInk; geri kalan her şey aynı (zemin, cam, maskot, yerleşim, metin).

## KARAR
1. **Soru → soru native push:** P1–P14 tek rota (`KQuestions`) içinde adım durumuyla çalışıyor; her soruyu ayrı native-stack ekranına bölmek adım deposunu, B yolu kısa profili, vitrinleri ve G42 testlerini kırardı. Bunun yerine ekran içi `StackSwap`: iOS push'un hareketini taklit eder (yeni sağdan tam, eski %30 sola; ışık zemini, üst çubuk ve düğme sabit = iOS gezinme çubuğu gibi). Ekranlar saydam olduğu için (zemin ortak) giden katman ilk ~150 ms'de kaybolur — üst üste iki içerik görünmesin diye. Geri kaydırma G42'deki gibi kenardan bırakınca tetikleniyor (etkileşimli sürükleme yok).
2. **P14 → L1** için md.5 bir şey söylemiyor; L1 bir "sahne" olduğu için O5 → P1 ve L1 → L2 ile aynı 250 ms çapraz geçiş seçildi. **O5 → K1b (B yolu)** K1 olduğundan native push.
3. **T1 modal:** `fullScreenModal` (kart tipi `modal` değil) — aşağı kaydırıp kapatınca E2'ye (doğrulanmış kod ekranı) dönmek yanlış olurdu; X → Ana sayfa korunuyor, `gestureEnabled: false`.
4. **Seçim geçişi JS saatinde (rAF):** arka plan, kenar, ikon ve metin rengi aynı saatle karışsın diye (AppText animasyonlu bileşen değil; Animated.Text'e geçmek tipografiyi değiştirebilirdi). Yalnız değişen öğe ~10 kare yeniden çiziliyor.
5. **Ana düğme titreşimi** `light` → `selection` ("Ana düğmede aynı" = basış + seçim titreşimi okundu).
6. **Onboarding maskotu:** `Mascot` paylaşılan bileşen; `fill` (yalnız onboarding katmanı) → `motion="onboarding"` = G42 davranışı (±7 pt + zıplama). Kayıt ekranları varsayılan `kayit` kipini alıyor. Onboarding dosyalarında diff yok.
7. **`limeInk`/`limeInkSec`** kayıt paletine eklendi (md.2 açıkça istiyor). Ana düğme yazısı (`onAccent` #10301D) DEĞİŞMEDİ — görsel dil.
8. **P12 tabaklar:** boş tabak G42'de 0,6 ölçek + saydamdı (= küçültme); md.1 gereği tam boy cam yüzey + ince kenar. Dolu = lime.
9. **Yeni rozet:** P8 galeri seçili kartına da dolu onay rozeti eklendi (md.2 "seçili kart … sağ üstte dolu onay rozeti"). Tempo seçici ve segmentte rozet yok (segment mantığı: tam dolgu yeterli).
10. **Vitrin `G42-P1pick`** yalnız `__DEV__`; gerçek akışı etkilemez.

## HIG (kod denetimi, değişen parçalar)
- Kontrast: seçili metin `limeInk` #0A0A0A / lime #B9EF14 ≈ 15:1; seçili alt satır `rgba(10,10,10,.72)` ≈ 8:1; rozet lime ✓ / siyah daire ≈ 15:1. Seçilmeyen kart artık tam opak (G42'deki saydam zemin + 0,97 ölçek kalktı) → AA korunuyor.
- Dokunma alanları değişmedi (≥ 44 pt); basış ölçeği yalnız görsel.
- VoiceOver: balon `accessibilityRole="header"` (artık dokunulabilir değil — "dokununca tamamla" kalktı); yığın geçişinde giden katman ekran okuyucudan gizli + dokunulmaz; seçim kartlarında `accessibilityState.selected` eklendi.
- Azaltılmış hareket: giriş, balon, seçim geçişi, basış ölçeği, maskot, paralaks, yığın geçişi ve native geçişler anlık (`animation: 'none'`). Haptik aynı kalıyor (erişilebilirlik).
- P9: "Spor yapmıyorum" seçiliyken günlerin soluk/devre dışı görünmesi kalktı; dokunmak seçimi değiştirir (devre dışı görünen ama anlamı belirsiz denetim yok).
- Bilinen (G42'den beri, G44 kaynaklı değil): P8 "Hafif" başlığında Bricolage "fi" bitişik harfi kalın görünüyor (G42 ekranında da aynı).

## SORULAR
1. Soru → soru geçişi ekran içi taklit (KARAR 1). Gerçek native-stack (etkileşimli kenar sürüklemesiyle) istenirse soruları ayrı rotalara bölmek gerekir — ayrı iş.
2. P10, P8-Dark, P10-Dark, P11-Dark için G42 ekran görüntüsü yoktu → `karsilastirma/` bu dördü olmadan 14 pano. G44 ekran görüntüleri mevcut.
3. T1 satın alma sırasında kartlar soluklaşmıyor (md.1 "T1 dahil"); kilit yalnız dokunmayı engelliyor, düğmede yükleme halkası var. Görsel "kilitli" işareti istenirse söyleyin.
4. Ana düğme titreşimi `selection` oldu (KARAR 5); önceki `light` darbesi tercih edilirse tek satır.
