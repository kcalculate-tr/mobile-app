# G49-S1 LOG — Konum kapısı alan hatası + profilsiz Ana sayfa yenileme + eatkcal bölümü sadeleştirme + kayıt cam ikonları (14 Kas)

Dal `release/1.1.0` · worktree `.claude/worktrees/g23-s1` · başlangıç `8ab1e8b` (G48-S1-DONE vardı). Yalnız JS/TS (OTA uyumlu; 1.1.0 build 32 / Android 25). Yeni paket yok. Deploy / OTA / canlı DB yazma yok. Migration yalnız DOSYA (+ rollback).

## ÖZET
1. **md.1 Konum kapısı:** Kök neden doğrulandı. Metin alanı `styles.fieldText` alıyordu; içindeki `flex: 1` dikey sütunda TextInput yüksekliğini 0'a çekiyordu (yalnız kenar çizgisi kalıyor, metin etiketin üstüne biniyordu). Alanlar artık flex içermeyen `inputText` stilini kullanıyor. Kutu seçicilerle birebir aynı: 44 pt, aynı zemin, kenar, yarıçap ve 13 pt iç boşluk.
2. **md.1 Posta kodu:** Şehir değişince (`withCity`) ilçe ile birlikte posta kodu da temizleniyor. Konum düğmesi şehirle tutarsız posta kodu bırakmıyor: şehir yoksa posta kodu yazılmıyor, Türkiye'de ilk iki hane il plakasıyla (81 il) eşleşmeli. "35040" yer tutucusu bir İzmir kodu olduğu için yalnız İzmir'de (ya da il seçilmemişken) gösteriliyor.
3. **md.2 Profilsiz kart (`HomePlanGateCard`, G47 kartının yerine):** Bulanık cam + yeşil → beyaz degrade (koyu: koyu yeşilden yarı saydam cama), yarıçap 28, ince iç kenar ışığı, yeni renk yok. Cam kupa sağ üst köşeden ~%25 taşıyor; 4 sn döngü, 6 pt çapraz süzülme ve ±3° eğilme yapıyor; azaltılmış harekette sabit. Kartta ÖRNEK analiz önizlemesi var: halka (1.450 / 2.100 kcal), 3 makro çubuğu ve 7 günlük sütunlar. 600 ms ease-out ile çizilerek geliyor (sütunlar 40 ms kademeli). Köşede "Örnek" / "Sample" etiketi var; VoiceOver'da "gerçek verin değil" deniyor. "Planımı oluştur" düğmesi G47 kayıt akışını açıyor.
4. **md.3 "Neler yapabilirsin":** Kartın hemen altında 2×2 ızgara: Tara · Etkinlik · Paylaş · Koç. Tara, Etkinlik ve Koç profil kapısından geçiyor; dönüş hedefi dokunulan eylem (Etkinlik dönüşte sheet'i bir kez açıyor: `finAddActivity`). Paylaş Keşfet kuralıyla çalışıyor: oturum yoksa `Login` (AuthSheet), `kesfet_paylasim` açıksa Composer, kapalıysa Keşfet sekmesi. Girişte 8 pt + fade 220 ms, toplam kademe 150 ms; basışta 0,98.
5. **md.4 eatkcal bölümü (tüm kullanıcılar):** "Adresini gir · Adres ekle" kartı ve logo yanındaki "İzmir'de 30–45 dk" kaldırıldı. `home.ek_eta*` ve `home.ek_addr_*` anahtarları silindi. Yalnız logo kaldı. Kampanyalar ve Mağazalar aynı (mağaza kartı alt yazısındaki teslimat bilgisi dahil).
6. **md.5 Cam ikonlar:** 22 PNG + 22 `_sel` (192 px) `assets/kayit/icons/` altında, en büyüğü 24 KB (sıkıştırma: 256 renk paleti; ≤ 30 KB olanlar kayıpsız). P1, P2 (önceden ikonsuzdu), P8 galerisi, P10, P13 ve P14'te vektör ikonların yerini aldılar. Seçilmemiş kartta normal, seçili lime kartta `_sel`; 150 ms çapraz geçiş, arkada zemin yok, açık/koyu temada aynı PNG.
7. **Ölçüm:** `home_plan_card_view` (bir kez) ve `home_plan_card_tap {action: plan|scan|activity|share|coach}`. Önceki kartta ölçüm yoktu. Sözlük, migration DOSYASI ve rollback yazıldı, parite testi güncellendi.
8. **Profilli Ana sayfa değişmedi:** Anlık görüntü G48 kodunda (`git archive 8ab1e8b`, repo dışı geçici kopya) üretildi ve yeni kodla `--ci` kipinde birebir eşleşti. Tek fark geçici kopyanın görsel yoluydu (`testUri`), o düzeltildi. md.4 bölümü brif gereği karşılaştırma dışında tutuldu (HomeRegion taklit).
9. **HIG denetimi** (apple-design-skill, kod denetimi kipi) bir Critical bulgu verdi: koyu temada açıklama ≈2,0:1 kontrastta kalıyordu. Düzeltildi (aşağıda).
10. **Kontroller:** hygiene ✓ · tsc ✓ · unit 1354/1354 ✓ · jest 117 paket / 790 test / 3 anlık görüntü ✓. `expo export` iOS ✓ Android ✓ (son kod commit'i `ea5e3c7` üstünde). Üretim iOS paketinde `G49-*`, `noProfileF`, `vitrinAnswers` geçmiyor (0 eşleşme).

## Commit
| commit | içerik |
|---|---|
| `97140e5` | md.1 alan stili (`inputText`), `withCity`, posta kodu–plaka tutarlılığı, testler |
| `a89ac6b` | md.4 eatkcal bölümü: adres kartı + süre yazısı kaldırıldı; g39HomeEatkcal |
| `830c9fd` | md.5 cam ikonlar (44 PNG), `GlassIcon`, pickers/QuestionsScreen, g45 testi |
| `f73239e` | md.2–3 plan kartı + hızlı eylemler, `HOME_GATE_MOTION`, olaylar + migration dosyası, TrackerScreen, testler + G48 anlık görüntüsü |
| `ea5e3c7` | HIG kontrast düzeltmesi, İzmir yer tutucusu, vitrin `G49-*` (yalnız __DEV__) |
| (sonraki) | docs(g49): ekran görüntüleri + bu LOG |
| (son) | `docs/night/G49-S1-DONE` |

## Değişen / yeni dosyalar
| dosya | ne |
|---|---|
| `src/modules/eatkcal/gate/EkLocationGate.tsx` | `inputText` (flex yok), `textAlignVertical`, `withCity`, İzmir yer tutucusu |
| `src/modules/eatkcal/gate/gateRule.ts` | `withCity`, `trPlateCode` (81 il + takma adlar), `consistentPostal`, `selectionFromGeocode` posta kodu kuralı |
| `src/modules/gun/home/HomeRegion.tsx`, `homeEatkcalNav.ts` | `AddressPrompt` + süre yazısı + `onAddAddress` kalktı |
| `src/core/i18n/dictionaries.ts` | `home.ek_eta`, `ek_eta_default`, `ek_addr_title`, `ek_addr_cta` (TR+EN) silindi |
| `src/modules/kayit/ui/HomePlanGateCard.tsx` (yeni) | profilsiz kart: yüzey, süzülen kupa, örnek önizleme, düğme, ölçüm |
| `src/modules/kayit/ui/HomeQuickActions.tsx` (yeni) | 2×2 eylemler |
| `src/modules/kayit/quickActions.ts` (yeni, saf) | eylem yönlendirme kuralı (`runQuickAction`) |
| `src/modules/kayit/ui/homeGateDev.ts` (yeni) | yalnız __DEV__: açılış dizisini belirli ms'de dondurma (vitrin) |
| `src/modules/kayit/ui/HomeProfileGateCard.tsx` | **silindi** |
| `src/modules/kayit/ui/glassIcons.tsx` (yeni) | `KAYIT_GLASS`, eşleme tabloları, `GlassIcon`, `GLASS_SIZE` |
| `src/modules/kayit/ui/pickers.tsx` | `ChoiceTile`/`OptionCard`/`ActivityCarousel` `glass` desteği |
| `src/modules/kayit/ui/theme.ts` | `K_MOTION.iconCross = 150` |
| `src/modules/kayit/screens/QuestionsScreen.tsx` | cam eşlemeler; eski vektör haritaları kalktı; `vitrinAnswers` (yalnız __DEV__) |
| `src/modules/kayit/i18n.ts` | `kayit.gate.*` yeni kart + eylem metinleri (TR+EN) |
| `src/screens/TrackerScreen.tsx` | yeni kart + eylemler, `runQuickAction`, `finAddActivity` dönüşü |
| `src/modules/gun/home/HomeActivitySection.tsx`, `src/modules/kesfet/ui/TrackerActivityEntry.tsx` | `openSignal` (sheet'i dışarıdan aç) |
| `src/core/design/motion.tsx` | `HOME_GATE_MOTION` |
| `src/lib/metrics/events.ts` | 2 olay |
| `src/dev/screenCatalog.ts`, `vitrinSetup.ts` | `G49-*` sahneleri; `noProfileF<ms>`; eski `eta` sabiti kalktı |
| `assets/kayit/icons/*.png` | 44 dosya (girdi `_anlam-tablosu.png` / `_kaynak-sprite.png` commit edilmedi) |
| testler (yeni) | `eatkcal/gate/__tests__/g49Gate`, `eatkcal/gate/__component_tests__/g49Gate`, `kayit/__tests__/g49QuickActions`, `kayit/__component_tests__/g49Home`, `screens/__component_tests__/g49HomeProfile` (+ `.snap`) |
| testler (güncel) | `g39HomeEatkcal`, `g45Kayit` (cam katmanları), `g47Kayit` (yeni kart), `metricsDictionary` |

## Migration dosyaları (UYGULANMADI)
- `supabase/migrations/20261114220100_g49_home_plan_card_events.sql`: 2 olay satırı, `analytics_event_names` (idempotent; tablo yoksa atlar).
- `supabase/rollbacks/20261114220100_g49_home_plan_card_events_rollback.sql`

## Testlerin kapsadığı
- md.1: İstanbul (açık + koyu), Berlin ve İzmir'de ilçe ve posta kodu alanları 44 pt; flex yok; zemin, kenar, yarıçap ve iç boşluk seçiciyle aynı. İzmir → İstanbul ve Ankara → Bursa geçişinde posta kodu boşalıyor. Konum: İstanbul + 35160 → posta kodu yok; İzmir + 35040 → yazılıyor. Saf testler: `withCity`, plaka, `consistentPostal`, geocode.
- md.2: TR/EN metinler, "Örnek" etiketi, önizleme VoiceOver metni, 7 sütun, yarıçap 28 + iç kenar. Görüntülenme olayı bir kez, dokunma olayı. Kupa: döngü var; azaltılmış harekette `withRepeat` yok ve dönüşüm yok. Saydamlık azaltıldığında düz yüzey. 1,3× tavan, kırpma yok. Hareket token değerleri.
- md.3: 4 kart (başlık + alt metin + VoiceOver), ölçüm, EN, kapalı özellik filtresi, ≥ 44 pt. TrackerScreen tam render: profilsiz → kart + hemen altında 4 eylem, takip bölümü yok. Tara, Etkinlik ve Koç → `Kayit {entry: 'gate', returnTo: <dokunulan eylem>}`; Paylaş → Keşfet (kapıya takılmaz). Saf kural: oturumsuz → `Login`.
- md.4: adres kartı, "Adres ekle" ve süre yazısı her durumda yok (TR + EN); sıra logo → kampanyalar → mağazalar.
- md.5: 44 dosya ≤ 30 KB, `_` dosyası yok; eşleme tablosu; normal ↔ `_sel` 150 ms (ara karede 0 < opaklık < 1); azaltılmış harekette anlık; açık/koyu aynı PNG.
- Profilli Ana sayfa: G48 anlık görüntüsü birebir.

## Ekran görüntüleri (`docs/night/g49/`, "G40 iPhone" 402 pt)
- md.1: `G49-Gate(-Dark)` İstanbul › Kadıköy › 34710 · `G49-GateIst(-Dark)` İstanbul, boş ilçe/posta kodu (eski hatanın yeri) · `G49-GateIzmir(-Dark)` İzmir › Bornova › 35040 · `G49-GateBerlin(-Dark)` Berlin › Mitte › 10115. (Kapı arka planı sabit koyu tasarım; koyu ve açık görüntü aynı.)
- md.2–3: `G49-Home(-Dark)`, `G49-Home-XL`, `G49-Home-Dark-XL` (1,3×) · açılış dizisi `G49-HomeF1/F2/F3` (80 / 260 / 1000 ms) + yan yana `G49-HomeOpen-seq` · eylemler `G49-HomeActions(-Dark)`.
- md.4: `G49-Eatkcal(-Dark)` (adres yok) · `G49-EatkcalAddr` (adres var).
- md.5: `G49-P1`, `-P2`, `-P8`, `-P10`, `-P13`, `-P14` (her birinde bir seçenek seçili: Kilo vermek, Kadın, Orta, Vegan, Ara sıra pişiririm, Tatlı isteği), her biri açık + koyu.

Yöntem: Metro bu worktree'den (8146, CI kipi), `scripts/dev/g14-shots.sh` storage kipi, dev client `--initialUrl` ile bağlandı. Native derleme yok. Koyu kart çekimleri kontrast düzeltmesinden sonra yeniden alındı. Çekimden sonra Metro durduruldu, simülatör kapatıldı. İlter'in "iPhone 17" simülatörüne dokunulmadı. Açılış dizisi gerçek zamanlı çekilmedi; çizim vitrinde belirli ms'de donduruldu (yalnız __DEV__).

## HIG (apple-design-skill, kod denetimi)
- **Critical (düzeltildi):** Koyu temada kart açıklaması `#A1A1A6`, lime ışımanın üstünde ≈ 2,0:1 kalıyordu. Kural: `accessibility.md` › 17 pt'ye kadar metin 4,5:1. Işıma azaltıldı (doğrusal 0,34 → 0,22, radyal 0,30 → 0,20) ve metin `darkInk` %82'ye çekildi: hesaplanan ≈ 5,6:1, başlık ≈ 7,3:1. Açık temada ikincil metin `#45454A`, en yoğun lime bölgede ≈ 7,5:1.
- Dokunma alanları: kart düğmesi 52 pt, eylem kartları ≥ 104 pt, kapı alanları 44 pt (`accessibility.md` › 44x44 pt).
- VoiceOver: kart başlık + açıklama tek öğe, önizleme "Örnek … gerçek verin değil" tek öğe, eylemler "Başlık. Alt metin" düğmesi. Cam ikonlar ve kupa gizli (süs); kartların seçili durumu `accessibilityState` ile duyuruluyor.
- Hareket: kupa döngüsü otomatik ve tekrarlı → azaltılmış harekette tamamen sabit (`accessibility.md` › Reduce Motion: "reducing automatic and repetitive animations"). Çizim ve girişler yalnız opaklıkla geliyor. Saydamlığı azalt açıkken bulanıklık yerine düz yüzey kullanılıyor; bulanıklık içerik katmanında standart malzeme (`materials.md` › standard materials in the content layer).
- Dynamic Type: başlık ve metinler 1,3× tavan, kırpma yok (`G49-Home-XL`). Önizleme sayıları 1,1–1,2× tavanlı. Düşük öncelik: HIG %200 hedefinin altında (uygulama geneli tercih, G46–G48 ile aynı).
- Düşük öncelik (zevk): kupa süzülmesi sürekli bir döngü. Brif istediği için kaldı; azaltılmış harekette yok.

## KARAR
1. **Posta kodu tutarlılığı il plakasıyla:** TR posta kodunun ilk iki hanesi plakadır. 81 il + yaygın takma adlar (Afyon, İçel, Maraş, Urfa, Antep, İzmit, Adapazarı) eşleniyor. Plaka bilinmiyorsa yalnız 5 hane biçimine bakılıyor. Yabancı ülkede biçim denetimi yok.
2. **"35040" yer tutucusu yalnız İzmir'de / il seçilmemişken:** Bu bir İzmir kodu; başka ilde yanıltıcıydı (brifin "İstanbul'da İzmir posta kodu kalmasın" ilkesi).
3. **Eylem kartı ikonları:** Phosphor (Scan, Sneaker, ImageSquare, ChatCircleDots), 36 pt lime dolgulu karede limeInk (lime yalnız dolgu kuralı). Cam nesne kuralı (kase/ayak izi) dört eylemi tek dilde karşılamadığı için kullanılmadı.
4. **Özelliği kapalı eylem gizlenir:** `etkinlik` kapalıysa Etkinlik, Koç uygun değilse (`useCoachEnabled`) Koç gösterilmez; dönüş rotası kayıtlı olmayabilir. Tara her zaman var (`ai_tarama` kapalıysa elle giriş). Paylaş her zaman var (`kesfet_paylasim` kapalıysa Keşfet sekmesi).
5. **Koç dönüş hedefi `CoachIntro`:** Yeni hesabın tanıtımı ve uyarıyı (Disclaimer) görmesi için. Ön dolu soru "Akşam ne yesem?". Tanıtımı görmüş bir hesap profil kapısından dönüşte tanıtımı bir kez daha görebilir.
6. **Tek ölçüm olayı (`home_plan_card_tap {action}`):** Brif yalnız iki ad verdi; hızlı eylemler aynı olayda `action` ile ayrılıyor (plan / scan / activity / share / coach).
7. **Cam ikon boyutları:** 2×2 ve geniş kart 44 pt, liste kartı (P13/P14) 36 pt, hareket galerisi (P8, büyük kart) 52 pt. Brif "2×2'de ~44, haplarda ~24" diyordu; seçeneklere bağlı ikonlu çip/hap olmadığı için `ChipToggle`'a dokunulmadı (P2 "Belirtmek istemiyorum" ve spor çipleri eşleme tablosunda yok).
8. **P2 kartlarına ikon eklendi:** Önceden ikonsuzdu; eşleme tablosunda `venus` / `mars` var.
9. **PNG sıkıştırma:** Pillow 256 renk paleti (geçici venv, repo dışı). Yan yana karşılaştırmada fark hilal ikonunda hafif bant dışında görülmedi. Kaynağı zaten ≤ 30 KB olanlar kayıpsız optimize edildi.
10. **Açılış dizisi çekimi:** Simülatörde 80 / 260 / 1000 ms'yi tutturmak zamanlamaya bağlı olduğu için vitrin, çizimi o anda donduruyor (`noProfileF<ms>`, yalnız __DEV__, üretim paketinde yok).
11. **Profilli anlık görüntü yöntemi:** Önce G48 kodunda üretildi, sonra yeni kodda yeniden yazmadan (`--ci`) karşılaştırıldı. Yalnız yeni kodda üretilen bir anlık görüntü "değişmedi"yi kanıtlamazdı.

## CANLIYA UYGULANACAK
- `20261114220100_g49_home_plan_card_events.sql` (yalnız sözlük satırları). Rollback dosyası hazır.
- (G48'den bekleyen) `20261114200100_g48_eatkcal_gate_events.sql`.

## DEPLOY GEREKİR
- Yalnız OTA (JS + 44 PNG asset, OTA ile taşınır). `release/1.1.0` → 1.1.0 kanalı, İlter'in onayıyla. Bu oturumda deploy/OTA yapılmadı.

## SORULAR
1. **Hızlı eylem İngilizce metinleri** brifte yoktu; şunlar yazıldı: "Scan your plate · Snap it, see the calories", "Add activity · Walks, workouts, calories burned", "Share your meal · Post today's plate on Explore", "Ask the Coach · What should I eat tonight?". Onay?
2. **Mağaza kartı alt yazısı** ("Hemen, 30–45 dk") Mağazalar "aynen kalır" kuralı gereği duruyor. Yalnız logo yanındaki süre kaldırıldı. Kartlardaki süre de kalksın mı?
3. **Kupa döngüsü sürekli** (4 sn). Pil ve dikkat açısından ilk birkaç döngüden sonra durması istenir mi?
4. **Posta kodu adrese yazılması** (G48 SORULAR 2) hâlâ açık.
