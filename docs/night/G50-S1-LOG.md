# G50-S1 LOG — Ana sayfa ek bölümleri + G49 soruları (14 Kas)

Dal `release/1.1.0` · worktree `.claude/worktrees/g23-s1` · başlangıç `053ee8a` (`docs/night/G49-S1-DONE` vardı). Yalnız JS/TS (OTA uyumlu; 1.1.0 build 32 / Android 25). Yeni paket yok. Deploy / OTA / canlı DB yazma yok. Migration yalnız DOSYA (+ rollback).

## ÖZET
1. **6a İlk gün görevleri** (`HomeFirstDayTasks`): hesap ilk 7 günündeyken görünür, profilli ya da profilsiz fark etmez. Başlık "İlk gün görevlerin", 0/3 → 3/3 sayaç, ince ilerleme çubuğu ve 3 satır var: Planını oluştur · İlk tabağını tara · Su ekle. Durum sunucudaki gerçek kayıtlardan okunuyor: profil kapısı durumu, ilk `meal_consumptions.source = 'ai_scan'` satırı ve ilk `water_daily.ml > 0` satırı. Bugünkü yerel kayıt yalnız işareti hızlandırıyor. Tamamlanan satırda işaret doluyor; satır soluklaşmıyor, üstü çizilmiyor. Satırlar mevcut kapılı eylemleri açıyor (`profileGate.require` / `logToSlot` / `handleWaterAdd`). 3/3 olunca bir kez halka doluyor ve "Harika başlangıç!" çıkıyor (konfeti yok, 1,6 sn); sonra kart kayboluyor. Cihazda tutulan tek şey "kapatıldı" işareti.
2. **6b Tarama rozeti:** Profilsiz sayfada "Tabağını tara" kartında, profilli sayfada mevcut Tara girişinde ("İlk öğününü ekle" kartı, gün boşken) görünüyor. Kaynak abonelik deposundaki AI kotası (`my_entitlement` / `reserve_ai_scan`). Ücretsiz kademede "Bugün N ücretsiz tarama", Fresh/Balance'ta "Bugün N tarama" yazıyor. Kota okunamazsa, gün sınırı geçtiyse ya da `ai_tarama` kapalıysa rozet çıkmıyor.
3. **6c Bugünün tarifleri:** Keşfet akışından (`getFeed for_you`) kalorisi ve görseli olan öğün kartları, en çok 8 tane. Kartta görsel, ad ve "540 kcal, 32 g protein" var; dokununca tarif detayı (`SharedPost`) açılıyor. "+" ile Keşfet'teki mevcut "Güne ekle" yolu (`AddToDaySheet` → `addToDay`, `log_add`, Logla izi) kapıdan geçerek çalışıyor; kayıt akışından dönünce sheet o tarif için açılıyor. "Tümü ›" Keşfet'e gidiyor.
4. **6d Koç'a sor:** 3 çip var: "Akşam ne yesem?" · "Proteinimi nasıl tamamlarım?" · "Haftamı özetle" (EN karşılıklarıyla). Mevcut `openCoach({ from: 'home', prefill })` kullanılıyor, yani soru yazma alanına dolu geliyor. Profilsizde kapı → `CoachIntro`. Deneme hakkı ve paywall Koç'ta aynen geçerli; `useCoachEnabled` false ise bölüm yok.
5. **6e Seri ve haftalık özet** (yalnız profilli): Seri `track/streak` kuralıyla hesaplanıyor (sunucuyla birebir), "N gündür kayıttasın" ya da 0 ise "Bugün bir öğün ekle, serin başlasın" yazıyor. Yanında bu haftanın (Pzt–Paz) 7 mini sütunu var: 30 günlük kovadan gerçek kalori, hedefe göre. Dokununca İlerleme açılıyor (`ProfileSub {sub: 'progress'}`).
6. **6f eatkcal köprüsü:** Logonun altında, ikincil renkte tek satır: "Siparişin günlüğüne kendiliğinden işlenir." / "Your order is logged to your day automatically."
7. **Sıra:** Profilsiz: Plan kartı → Görevler → Neler yapabilirsin (rozet) → Koç → Tarifler → (Öne çıkanlar · Keşfet, mevcut) → eatkcal. Profilli: mevcut takip bölümü AYNEN üstte → Görevler → Seri → Koç → Tarifler → (Keşfet) → eatkcal. Bölümlerin hepsi G49 md.3 girişiyle geliyor (8 pt + fade, `HOME_GATE_MOTION`; azaltılmış harekette yalnız opaklık).
8. **md.2 (İlter'in kararı):** Kupa süzülmesi ilk 3 tam döngüden (6 yarım, 3 × 4 sn) sonra ortada duruyor; ekran yeniden odaklanınca (`cycleKey` = odak sayacı) yine 3 döngü dönüyor. Azaltılmış harekette sabit. Hızlı eylem EN metinleri ve mağaza "Hemen, 30–45 dk" alt yazısı olduğu gibi kaldı (dokunulmadı).
9. **Profilli takip bölümü değişmedi:** G49 anlık görüntüsü (`g49HomeProfile.test.tsx.snap`) yeniden yazılmadan `--ci` kipinde geçiyor. Yeni bölümler mock'lanmadan çalıştırıldığında fark yalnız ekleme çıktı (Snapshot −0 / Received +1116 satır).
10. **Kontroller** (son kod commit'i `30dac7e` üstünde): hygiene ✓ · tsc ✓ · unit 1361/1361 ✓ · jest 119 paket / 809 test / 3 anlık görüntü ✓ (`--ci`, yeni anlık görüntü yazılmadı). `expo export` iOS ✓ Android ✓. Üretim iOS paketinde `G50-*`, `g50T3`, `noProfileG50` geçmiyor (0 eşleşme).

## Commit
| commit | içerik |
|---|---|
| `55c265c` | md.2 kupa: 3 döngü sonra durur, odakta yeniden; `HOME_GATE_MOTION.cupCycles/cupSettle/celebrateHold`; g47 kaynak testi |
| `b098b22` | md.1 bölümler (`HomeExtras.tsx`, `homeSectionRules.ts`), TrackerScreen sırası/bağları, rozet (HomeQuickActions + FinTopBlock/HomeFirstMealCard), köprü satırı, i18n TR+EN, 8 olay + migration DOSYASI + rollback, testler |
| `fd975da` | HIG: gün harfleri 11 pt, bugünün sütunu açık temada koyu lime, diğer günler ikincil, boş görev halkası ikincil |
| `b8bb111` | vitrin `G50-*` (yalnız __DEV__) |
| `30dac7e` | HIG Dynamic Type: tarif kartı genişliği yazı ölçeğiyle (≤ 1,3×) |
| (sonraki) | docs(g50): ekran görüntüleri + bu LOG |
| (son) | `docs/night/G50-S1-DONE` |

## Değişen / yeni dosyalar
| dosya | ne |
|---|---|
| `src/modules/gun/home/HomeExtras.tsx` (yeni) | `HomeFirstDayTasks`, `HomeStreakWeek`, `HomeCoachPrompts`, `HomeTodayRecipes`, `HomeEnter`, `setHomeExtrasProvider` |
| `src/modules/gun/home/homeSectionRules.ts` (yeni, saf) | `withinFirstDays`, `taskRows`, `tasksView`, `scanBadge`, `recipesFromFeed`, `weekColumns`, `homeStreak` |
| `src/screens/TrackerScreen.tsx` | yeni bölümler + sıra, odak sayacı, rozet metni, görev/Koç/tarif işleyicileri, `finAddRecipe` dönüşü |
| `src/modules/kayit/ui/HomePlanGateCard.tsx` | `cycleKey`, sonlu süzülme (`withSequence` + `withRepeat(…, 6, true)`) |
| `src/modules/kayit/ui/HomeQuickActions.tsx` | `scanBadge` (Tara kartı) |
| `src/screens/tracker/TrackerDayHeader.tsx`, `FinTopBlock.tsx`, `src/modules/onboarding/first/HomeEmptyR1.tsx` | `scanBadge` → "İlk öğününü ekle" kartında tek satır (yalnız kota okunabildiyse) |
| `src/modules/gun/home/HomeRegion.tsx` | köprü satırı |
| `src/core/design/motion.tsx` | `cupCycles`, `cupSettle`, `celebrateHold` |
| `src/core/i18n/dictionaries.ts` | `home.x_*` (TR + EN) |
| `src/lib/metrics/events.ts` | 8 olay |
| `src/dev/VitrinGate.tsx`, `vitrinSetup.ts`, `screenCatalog.ts` | `G50-*` sahneleri (yalnız __DEV__) |
| testler (yeni) | `gun/home/__tests__/g50HomeRules`, `gun/home/__component_tests__/g50HomeSections`, `screens/__component_tests__/g50HomeOrder` |
| testler (güncel) | `g49HomeProfile` (yeni bölümler karşılaştırma dışında), `g47Kayit` + `g49QuickActions` (kaynak regex'i yeni prop'lara), `metricsDictionary` |

## Migration dosyaları (UYGULANMADI)
- `supabase/migrations/20261115000100_g50_home_sections_events.sql`: 8 olay satırı (`home_tasks_view/_tap`, `home_recipes_view/_tap`, `home_coach_prompts_view/_tap`, `home_streak_view/_tap`), `analytics_event_names`. İdempotent; tablo yoksa atlanır.
- `supabase/rollbacks/20261115000100_g50_home_sections_events_rollback.sql`

## Testlerin kapsadığı
- **Veri yokken gizli:** görevler (hesap tarihi yok · 7 gün geçti · sunucu okunamadı · kullanıcı yok · profil durumu bilinmiyor; 7 gün dışındaki hesap için sunucuya hiç gidilmiyor) · seri (yükleniyor / kova boş) · tarifler (akış boş / kalori ya da görsel yok) · rozet (kota yok / gün sınırı geçti / `ai_tarama` kapalı).
- **Görev durumu gerçek kayıtlardan (mock):** 0/3, 2/3 (profil + sunucuda ilk tarama), yerel sinyal birleşmesi, su takibi kapalıyken 0/2. Tamamlanan satır soluk/üstü çizili değil; VoiceOver "…, tamamlandı / yapılmadı".
- **3/3 sonrası kart kayboluyor:** kutlama (halka + "Harika başlangıç!") → 3 sn sonra kart yok, "kapatıldı" işareti yazılmış, yeniden açılışta gizli.
- **Profilsizde seri kartı yok;** profilsiz ve profilli sıra TrackerScreen tam render'ında doğrulanıyor.
- **Profilli takip bölümü:** G49 anlık görüntüsü `--ci` birebir.
- **Kupa:** `withRepeat(…, 6, true)` (sonsuz değil) + ortaya dönüş; aynı `cycleKey` → yeniden başlamıyor, yeni `cycleKey` → yeniden 3 döngü; azaltılmış harekette yok.
- Saf kurallar (node:test): 7 gün sınırı, görev satırları, kart hâli, rozet (kırpma, kademe), tarif süzgeci (≤ 8, tekrar yok, video kapağı), hafta sütunları (Pzt başlangıç, hedef/en yüksek gün), seri.
- Koç çipleri → `onPrompt(key, metin)`; tarif "+" → kapı yönlendirdiyse sheet yok, geçerse `addToDay(post, 'lunch', 1, …)`; köprü satırı TR/EN; EN metinleri.

## Ekran görüntüleri (`docs/night/g50/`, "G40 iPhone" 402 pt)
- Tam kaydırma (parçalar örtüşme eşlemesiyle birleştirildi): `G50-Home-full(-Dark).jpg` profilsiz · `G50-Prof-full(-Dark).jpg` profilli · `G50-Home-full-XL.jpg` profilsiz 1,3×.
- İlk gün görevleri: `G50-Tasks-0of3.jpg` (profilsiz) · `G50-Tasks-2of3.jpg` (profilli: plan + su) · `G50-Tasks-3of3.jpg` (kutlama, 1000. ms'de dondurulmuş) + yan yana `G50-Tasks-seq.jpg`; `G50-Tasks-3of3-Dark.jpg`.
- 1,3× ek: `G50-Prof-S1500-XL.jpg`, `G50-Prof-S2100-XL.jpg` (profilli yeni bölümler büyük yazıda).

Yöntem: Metro bu worktree'den (8146, CI kipi, `--clear`), `scripts/dev/g14-shots.sh` storage kipi, dev client `--initialUrl`. Native derleme yok. Vitrin sahneleri sahte oturumla çalışıyor: G50 panolarında hesap "dün" açılmış. Görev durumu, örnek tarifler (vitrin görselleri) ve kota (Ücretsiz, 2) yalnız `__DEV__` sağlayıcısından geliyor; üretimde gerçek kaynaklar kullanılıyor. Vitrin günü boş olduğu için seri kartı "Bugün bir öğün ekle…" durumunda. Birleştirme betiği ve Pillow repo dışındaki geçici dizinde. Not: ilk çekim turunda Metro eski bir paket sunuyordu (yeni kod yüklenmiyordu); Metro `--clear` ile yeniden başlatıldı ve bütün görüntüler son kodla yeniden alındı. İlter'in "iPhone 17" simülatörüne dokunulmadı. Çekimden sonra Metro durduruldu, simülatör kapatıldı.

## HIG (apple-design-skill, kod denetimi)
- **Düzeltildi (Critical, Dynamic Type):** 1,3× yazıda tarif alt satırı yatay listede tek satıra kırpılıyordu ("540 kcal, 32 g prot…"). Kart genişliği artık yazı ölçeğiyle büyüyor (168 → en çok 218 pt). Kural: `accessibility.md` › Support larger text sizes.
- **Düzeltildi (Critical, tip boyutu):** Hafta sütunu gün harfleri 10 pt'ten 11 pt'ye çıktı (`accessibility.md` / typography: mobilde en küçük 11 pt).
- **Düzeltildi (High, kontrast):** Açık temada bugünün lime sütunu `#B9EF14`, iz rengi `#E3E5E9` üstünde ≈ 1,04:1 kalıyordu. Artık koyu lime `#4A6B00` (≈ 4,9:1); diğer günler `#6B6B70` (≈ 4,2:1). Koyu temada lime / `#A1A1A6`, `#2C2C2E` üstünde.
- **Düzeltildi (Low):** Boş görev halkası `#C3C7CC`'den (≈ 1,7:1) ikincil `#6B6B70`'e geçti.
- Dokunma alanları: görev satırı 48 pt, Koç çipi 44 pt, tarif "+" 44 pt alan (32 pt görsel), "Tümü" 44 pt, seri kartı ≥ 76 pt (`accessibility.md` › 44x44 pt).
- Kontrast: ikincil metin `#6B6B70` beyaz üstünde ≈ 5,3:1; koyu temada `#A1A1A6` kart üstünde AA.
- VoiceOver: görev başlığı "İlk gün görevleri, 2/3 tamamlandı" (header), satırlarda `accessibilityState.checked` ve "…, tamamlandı/yapılmadı", kutlamada `accessibilityLiveRegion="polite"`. Seri kartı tek düğme: başlık + haftalık kayıt günü sayısı + "İlerlemeyi aç". Kupa ve sütunlar gizli (süs). Rozet, Tara kartının etiketine ekleniyor.
- Hareket: girişler azaltılmış harekette yalnız opaklıkla geliyor, ilerleme çubuğu anında doluyor, kutlama halkası sabit (yalnız opaklık). Kupa döngüsü artık sonlu (3 döngü) — G49'daki "sürekli döngü" düşük öncelikli bulgusu da kapandı (`accessibility.md` › "reducing automatic and repetitive animations").
- Saydamlık: yeni bölümlerde bulanıklık yok.

## KARAR
1. **Tarif alt satırında "·" yerine ","** — "540 kcal, 32 g protein". Ortak kural ("Nokta ayracı yok") ve `g17Keys` testi " · " ayracını yasaklıyor; brifteki örnek yazımı ortak kuralın önüne geçirilmedi. Eatkcal şeridindeki "kcal, fiyat" yazımıyla da aynı.
2. **Görev ① "profil var mı"** = profil kapısı durumu (`has`/`none`); durum bilinmiyorsa (kapı bayrağı kapalı) hedef var mı (`goalState`).
3. **Su görevi yalnız `su_takibi` açıkken:** Kapalıyken sunucuda su kaydı olamaz, görev listede yok (sayaç 0/2). Yarım ya da tahmini durum gösterilmiyor; bilinmeyen alan varsa kart gizli.
4. **Kart kapatma (×) yok:** Brif yalnız 3/3 sonrası kaybolmayı istiyor. Kart 7 gün sonunda ya da 3/3'te kendiliğinden kalkıyor; "kapatıldı" işareti kutlamadan sonra yazılıyor.
5. **Tarama rozetinin profilli yeri:** Profilli Ana sayfadaki tek Tara girişi takip bölümündeki "İlk öğününü ekle" kartı (gün boşken). Rozet oraya ekleyici olarak, yalnız kota okunabildiyse tek satır olarak kondu. Anlık görüntü günü dolu olduğundan ve kota yokken hiçbir şey çizilmediğinden takip bölümünün görüntüsü değişmedi.
6. **6b/6f için ayrı ölçüm yok:** Rozetin dokunuşu mevcut `home_plan_card_tap {scan}`; köprü satırı dokunulmayan bir metin. Olaylar: görevler, tarifler, Koç soruları, seri.
7. **Tarifler = Keşfet öğün kartları:** Kalorisi (> 0) ve görseli (kart fotoğrafı, ilk görsel ya da video kapağı) olanlar; `product_id` (tarif verisi) şartı aranmadı, yoksa liste çoğu zaman boş kalırdı. Yayında olmayanlar (`status ≠ published`) alınmıyor.
8. **"Bu hafta" = Pazartesi–Pazar:** Gelecek günler boş. Yükseklik hedefe göre; hedef yoksa haftanın en yüksek gününe göre.
9. **Ana sayfa "Öne çıkanlar" ve "Keşfet" şeritleri yerinde kaldı:** Profilsizde tariflerden sonra, eatkcal'dan önce. Brifteki sıra yeni bölümleri tanımlıyor; mevcut şeritler kaldırılmadı.
10. **G49 anlık görüntü testi:** Yeni bölümler bu testte mock'lanıyor (brif: "mevcut takip bölümü anlık görüntüsü birebir"). Mock'suz çalıştırmada fark yalnız ekleme çıktı; sıra ve koşullar `g50HomeOrder` testinde.
11. **Kupa durma konumu:** Döngü sonunda kupa ortaya (nötr açıya) yumuşakça dönüp duruyor; uçta eğik kalmıyor.

## CANLIYA UYGULANACAK
- `20261115000100_g50_home_sections_events.sql` (yalnız sözlük satırları). Rollback dosyası hazır.
- (G49'dan bekleyen) `20261114220100_g49_home_plan_card_events.sql`, (G48) `20261114200100_g48_eatkcal_gate_events.sql`.

## DEPLOY GEREKİR
- Yalnız OTA (JS). `release/1.1.0` → 1.1.0 kanalı, İlter'in onayıyla. Bu oturumda deploy/OTA yapılmadı.

## SORULAR
1. **Tarif alt satırı ayracı:** Brif "540 kcal · 32 g protein" diyordu; ortak kural nedeniyle "540 kcal, 32 g protein" yazıldı. "·" istenirse `g17Keys` kuralına istisna gerekir.
2. **İlk gün görevleri kartına "×" (elle kapatma)** eklensin mi? Şu an yalnız 3/3'te ya da 7 gün dolunca kalkıyor.
3. **Profilli Tara rozeti** yalnız gün boşken görünen "İlk öğününü ekle" kartında (takip bölümüne dokunmama kuralı). Gün doluyken de görünen bir yer (ör. öğün yuvası "Tara") istenir mi?
4. **Keşfet video başlıkları** (önceden var olan `HomeExploreStrip`) 1,3× yazıda tek satıra kırpılıyor ("Menemenin r…"). Kapsam dışı olduğu için dokunulmadı; tarif kartındaki çözüm (genişliğin ölçekle büyümesi) uygulanabilir.
5. **EN tarama rozeti:** "2 free scans today" / "1 free scan today". Onay?
