# G30-S1 — Logla izi düzeltme · çıkartma beyaz kontur · sayfa yanıp sönmesi · 11 Kas 2026

Dal `release/1.1.0` (worktree `.claude/worktrees/g23-s1`, G29-S1-DONE üstüne). YENİ PAKET YOK, native değişiklik YOK → hepsi OTA ile gider. Deploy yok, canlı DB yazma yok.
Tasarım: `FinMoLogA/B.webp` + `.dc.html` (keyframe'ler buradan okundu), `FinMoRing`, `FinMoSticker`. `.claude/night/g30/` altında İlter kaydı YOKTU → kare doğrulaması pano keyframe'leriyle yapıldı.

## ÖZET
1. **Logla izi** FinMoLogA'nın 4400 ms döngüsüyle (keyframe `lal-fly1/bdg2/toast7/home4`) kare kare karşılaştırıldı; 7 fark bulundu, hepsi düzeltildi (aşağıda tablo).
2. En görünür fark: Tara, Logla'ya basılır basılmaz kapanıyor, uçan kopya 1–3 kare sonra (görsel çözülünce) beliriyordu → görsel bir an **kaybolup başka yerde yeniden çıkıyordu**. Artık kopya ekranda görününce (`onStart`) Tara kapanır.
3. Başlangıç konumu artık kaynağın GÖRÜNEN kutusu: tam ekran fotoğrafta tabak bölgesi alttaki fotoğraftan birebir kırpılır; çıkartmada kalkış dönüşümü (−8 / ×1,04) ölçüme eklenir.
4. Konum + ölçek tek AI yayı ilerlemesi (pano tek transform), opaklık 1 → varışta anında 0, ölçek 0,08, hedef sekme ikonunun ÖLÇÜLEN merkezi.
5. Rozet pano gibi (ölçek 0→1 bouncy, opaklık anında), Ana sayfa açılınca silinir; Ana sayfa zaten ekrandayken rozet yok (satır vurgusu + halka dolumu, success tek). Toast alttan girer, animasyonlu çıkar.
6. **Çıkartma beyaz konturu**: ortak `StickerImage` (beyaz tint kopyalar 8/12 yön + %14 gölge), Tara kalkış (3 pt), öğün satırı (2 pt), logla izi. Normal fotoğrafa uygulanmaz. Saf JS.
7. **Yanıp sönme kök nedeni**: `TabSceneFade` `useIsFocused()` ile tetikleniyordu → yığına itilen HER ekrandan dönüşte sekme içeriği 0'a çekilip 200 ms'de geri geliyordu. Tetik artık yalnız sekme seçimi. Ölçüm: eski pop başına 1 solma → yeni 0.
8. Ek nedenler: Tracker ve FlagsProvider token yenilemesinde (yeni `user` nesnesi) yeniden çekim + iskelet / yeniden render; oturumlu soğuk açılışta eski→yeni kabuk remount. Üçü de düzeltildi.
9. Kontroller: tsc 0 · hygiene OK · unit 1144/0 (1 atlanan) · jest 89 dosya / 506 test → G30 sonrası tümü yeşil · expo export iOS (3249 modül) + Android (3256) OK · HIG hareket denetimi.
10. OTA: `eas update --branch production --message "G30"` (worktree'den, İlter).

## Commit tablosu
| Madde | Commit | Özet |
|---|---|---|
| 2 | `bd42e6a` | `src/lib/sticker/StickerImage.tsx` (kontur + gölge), öğün satırı 2 pt kontur, test (fotoğrafta kontur yok) |
| 1 | `b174bdb` | logTrace (onStart sözü, liftedRect, ölçülen hedef, isHomeVisible), LogTraceHost (FlightView yeniden), StickerLift (konturlu + dönüşümsüz ölçüm kutusu), ScanScreen (görünen kutu + Tara kapanış zamanı), FinPhotoResult `photoRef`, TabBarR3 rozet, Toast `from="bottom"`, testler |
| 3 | `4114df5` | TabSceneFade (sekme seçimi tetiği), Tracker SWR + kimlik bağımlılığı, FlagsProvider kimlik + `sameFlags`, `navigation/coldStartFeature.ts` (önbellekle dondurma + 1,5 sn splash sınırı), testler |
| 4 | (bu commit) | LOG; ardından `G30-S1-DONE` |

## md.1 — Logla izi: pano ↔ kod farkları
Pano (FinMoLogA.dc.html, 4400 ms): uçuş 500→1000 ms (`translate(-143px,476px) scale(.08)`, tek eğri `cubic-bezier(.3,1.15,.4,1)` = AI yayı), opaklık 1 sabit, 1000 ms'de anında 0; rozet 1000 ms'de opaklık 1 + ölçek 0→1 bouncy 300; toast 1000→1300 alttan 16→0 enter, 3200'de çıkış fast 200 exit (+8 aşağı); 3600'de Ana sayfa → rozet fast 200 exit ile silinir, satır vurgusu.

| # | Fark (önce) | Düzeltme |
|---|---|---|
| 1 | Tara hemen kapanıyor; kopya görsel çözülene kadar boş/yok → görsel kaybolup yeniden beliriyor | Kopya görsel yüklenene kadar opaklık 0 (en geç 200 ms); ilk kare çizilince `onStart` → `logTrace` sözü çözülür → Tara kapanır (en geç 400 ms emniyet) |
| 2 | Tam ekran (kompakt) sonuçta kopya, TÜM fotoğrafı tabak kutusuna sığdırıyordu (ilk karede farklı görüntü) | `imageRect`: kopya alttaki fotoğrafın aynı piksellerini kırpar → ilk kare birebir |
| 3 | Çıkartmanın ölçüsü kalkış dönüşümünü (UI thread) içermiyordu → 8 pt/%4 sıçrama | Ölçülen kutu dönüşümsüz sarmalayıcı; `liftedRect(LIFT_SHIFT, LIFT_SCALE)` eklenir (Reduce Motion'da kalkış yok → eklenmez) |
| 4 | Konum yay, ölçek ayrı enter eğrisi | Konum + ölçek aynı `SPRING.ai` ilerlemesi (`flightTransform`) |
| 5 | Opaklık %85'ten sonra solup ikona varmadan kayboluyordu | Opaklık 1; varışta (slow 500 = `TIMING.logTrail` 550) UI thread'de anında 0, rozet aynı karede |
| 6 | Hedef aritmetik (bar küçülmüş/yükselirken yanlış) | Ana sayfa ikon görünümü `measureInWindow` ile ölçülür; yoksa hesaplanan nokta |
| 7 | Rozet opaklık+ölçek 0,4→1 birlikte; Ana sayfaya gidince silinmiyordu (yalnız "Gör"); Ana sayfadayken de rozet + çift success | Pano gibi; kök Tabs + Tracker görünür olunca silinir (fast 200 exit); Ana sayfa görünürken rozet yok, success `useHomeHighlight` satır anında (tek) |
| 8 | Toast üstten iniyor, kapanınca animasyonsuz kesiliyordu | `from="bottom"` (16 → 0, base 300 enter / fast 200 exit), kapanınca önce çıkış animasyonu sonra kaldırma |

Uçuş tamamen Reanimated UI thread'de (başladıktan sonra JS'ye bağlı değil; JS yalnız varışta rozet/toast için `runOnJS`). Ana sayfadayken halka dolumu (FinMoRing) mevcut `useHomeHighlight → onRing → TrackerDayHeader` yolu; Tracker tazelemesi artık iskelete dönmediği için halka görünür kalıp dolar.

## md.3 — Kök neden açıklaması
- **Asıl neden (her gir-çıkta)**: R3 sekme navigatörünün `screenLayout`u `TabSceneFade`, odak kazanımında içeriği opaklık 0 → 1 (fast 200) yapıyordu ve odağı `useIsFocused()` ile okuyordu. React Navigation'da bir ekran yalnız ÜST navigatörü de odaktaysa "focused" sayılır (`useNavigationCache`). Kök yığına bir ekran itilince etkin sekme odak kaybediyor, geri dönünce "kazanıyor" → içerik 0'a çekiliyordu. Geri düğmesinde pop sırasında alttaki sayfa boş görünüp sonra beliriyor; kenardan kaydırarak dönüşte içerik jest boyunca görünürken jest bitince bir anda kaybolup geri geliyordu = "sayfa kendiliğinden belirip kayboluyor". Düzeltme: tetik sekme navigatörünün etkin sekme anahtarı (`useNavigationState` + `useRoute`); üst yığın odağı yok sayılır.
- **Ölçüm** (geçici sayaç `console.log('[G30-SAYAC] solma')`, eski dosyanın kopyasıyla gerçek native-stack + bottom-tabs navigatörü, jest): eski → Detay'a git + geri = 1 solma (220 ms); yeni → 0. Sayaç ve kopya silindi; aynı senaryo kalıcı test oldu (`g30TabSceneFade.test.tsx`).
- **(c) odakta iskelet**: Tracker `fetchData` `[user]` bağımlıydı; Supabase her token yenilemesinde yeni `user` nesnesi veriyor (`AuthContext` `setUser(nextSession.user)`) → yeniden çekim, `dataLoading=true`, liste `FinListSkeleton`'a dönüp geri geliyordu. Ölçüm: eski kodda test kırmızı (iskelet geri geliyor), yeni kodda yeşil. Düzeltme: kimlik bağımlılığı + iskelet yalnız ilk yüklemede (stale-while-revalidate); hesap değişince yeniden iskelet.
- **(a) FlagsProvider**: `load` `[user]` → her token yenilemesinde RPC + yeni `flags` nesnesi → `useFeature` kullanan her ağaç (AppNavigator dahil) yeniden render. Kimlik bağımlı + değişmeyen harita aynı nesne (`sameFlags`). Oturumlu soğuk açılışta `useColdStartFeature` `ready`'e kadar eski kabuğu çiziyor, RPC dönünce bütün sekme ağacı yeni kabukla yeniden kuruluyordu → artık önbellekteki son bilinen bayraklarla dondurulur; önbellek yoksa splash en çok 1,5 sn (`SESSION_FLAGS_WAIT_MS`). Test: bayrak yenilemesi / token yenilemesi / canlı değer değişimi kabuğu remount ETMİYOR.
- **(b) kök sarmalayıcılar**: `KeyboardDismissRoot`, `ThemeProvider`, `LogTraceGate` incelendi — sabit, memo'lu, NavigationContainer'ı sarmıyor; `key=` değişimi / `navigationRef.reset` yok (yalnız çıkışta). Neden değil.
- **(d) geçiş çakışması**: native-stack `slide_from_right` (azaltılmışta `fade`), özel interpolator yok; `ScanScreen`'in `animation:'none'`u yalnız kapanan rotada. Kendi başına neden değil; (asıl neden) ile birleşince görünür oluyordu.

## KARAR
1. **Tara yine kapanıyor** (G28 kararı) ama artık uçan kopya ekrana geldikten SONRA. Pano A'da kaynak ekran açık kalıyor, ancak Tara tam ekran modal → sekme çubuğu ve hedef ikon görünmez; kapatmadan "sekmeye uçuş" çizilemez.
2. **Toast tutma süresi 4 sn kaldı** (pano 2,2 sn). `motion.tsx` WAIT: okuma/tutma süreleri hareket değildir; Geri al eylemli toast'ta 2,2 sn erişilebilirlik açısından kısa. Giriş/çıkış eğrileri ve yönü pano.
3. **Ana sayfa görünürken rozet yok**, success'i Tracker satır vurgusu çalar (FinMoLogB "Haptik: success · satıra oturur"). Tracker tazelemesi başarısızsa o durumda haptik çalmaz (vurgu da yok — uydurma yok).
4. **Uçuş saati** `CURVE.standard` ile 550 ms (görsel değil, yalnız varış anı). Yay 260/24 (G22 ×0,9 yumuşatılmış hâli) 550 ms içinde < %0,2 kalıntıyla oturuyor → varışta sıçrama yok.
5. **Kontur yöntemi** beyaz `tintColor` kopyaları (Skia projede yok, eklenmedi). 3 pt'de 12 yön (kenar dalgası ≈ 0,1 pt), ince konturda 8. Gölge siyah tint + `blurRadius` kopya (iOS/Android aynı; Android `elevation` arka plansız çalışmıyor).
6. **Oturumlu açılış splash'ı** önbellek yoksa en çok 1,5 sn uzayabilir (ilk girişten sonraki ilk açılış). Çevrimdışında takılma yok (süre dolunca güvenli varsayılan = bugünkü davranış).
7. Ölçülemeyen ikon (ör. bar gizli) → hesaplanan nokta (G28 davranışı).

## Sonraki native derleme için öneri (kodlanmadı)
Konturu çıkartma üretimine gömmek (`modules/subject-lift`): maske kenarını ~%1,2 (512 px'te ≈ 6 px) genişlet (iOS: `CIMorphologyMaximum` maske üstünde; Android: maske bitmap'ine dilate / `BlurMaskFilter`+eşik), genişletilmiş maskeyi beyazla doldurup orijinal ön planın altına koy, kutuyu kontur kadar büyüt, aynı WebP'ye yaz. Kazanç: 9–13 `Image` kopyası yerine tek görsel (liste performansı), kenarı keskin tek parça kontur. Geçiş: `Sticker` sonucuna `outlined: true` alanı ekle; `StickerImage` `outlined` ise JS konturunu atlar (eski çıkartmalar JS konturuyla kalır).

## HIG (apple-design-skill, kod denetimi — hareket)
- `motion.md › Make motion optional`: Reduce Motion'da uçuş yok, rozet + toast 220 ms opaklık; bilgi toast metni + VoiceOver duyurusuyla da taşınıyor. ✓
- `motion.md › Let people cancel motion`: uçuş katmanı dokunmayı engellemez; uçuş sırasında Geri al uçuşu keser (200 ms solma). ✓
- `motion.md › Aim for brevity and precision`: tek uçuş 550 ms, yalnız loglama anında; kopya kaynağın tam üstünden başlıyor (sıçrama yok). ✓
- `motion.md › In apps, generally avoid adding motion to UI interactions that occur frequently`: sekme solması artık her geri dönüşte DEĞİL, yalnız sekme değişiminde → sık etkileşimdeki gereksiz hareket kalktı. ✓ (düzeltme)
- `playing-haptics.md › Use haptics consistently`: Ana sayfadayken çift success kaldırıldı (tek, satır oturunca). ✓ (düzeltme)
- `voiceover.md › Exclude purely decorative images`: `StickerImage` `accessible={false}` + `no-hide-descendants`; satır etiketi ad/kaynak/saat/kcal okur. ✓
- Low: koyu modda beyaz kontur çıkartmayı belirginleştiriyor (G29 HIG Low notu — koyu çıkartmanın kenar kaybı — bununla kapanıyor); açık modda beyaz kontur açık zeminde hafif gölgeyle seçiliyor — cihazda bakılacak.

## Cihaz test listesi (TestFlight / OTA sonrası)
1. Tara → tek tabak → Logla: kopya fotoğrafın tam üstünden başlar (kayma yok), Tara kapanır, kopya küçülüp Ana sayfa ikonuna oturur, aynı anda +1 (başka sekmeden geldiysen) + toast alttan.
2. Çıkartmalı sonuç: çıkartma beyaz konturlu kalkar; Logla'da konturlu çıkartma uçar; satırda konturlu.
3. Ana sayfadan Tara açıp logla: rozet yok, satır vurgusu + halka dolar, tek titreşim.
4. Profil › herhangi bir alt sayfa → geri (düğme ve kenardan kaydırma): sayfa yanıp sönmez. Aynısı Keşfet gönderisi, Koç, Tara iptal.
5. Uygulamayı arka plana alıp 1 saat sonra aç (token yenilemesi): Ana sayfa iskelete dönmez.
6. Soğuk açılış (giriş yapılmış): eski kabuk hiç görünmez; logo → yeni kabuk.
7. Ayarlar › Erişilebilirlik › Hareketi Azalt: uçuş yok; rozet + toast solarak; Tara hemen kapanır.

## CANLIYA UYGULANACAK
- Yok (migration/edge function yok).

## DEPLOY GEREKİR
- Yalnız OTA (JS): worktree'den `eas update --branch production --message "G30"` (İlter yayınlar; bu oturum çalıştırmadı). Native derleme gerekmez.

## SORULAR
1. Toast pano gibi 2,2 sn'de mi kapansın? Şu an 4 sn (KARAR 2, erişilebilirlik).
2. Ana sayfadan loglarken (Tara Ana sayfaya dönerken) fotoğraf yine sekme ikonuna uçuyor; bunun yerine FinMoLogB gibi doğrudan öğün satırına mı insin? (Pano B Ana sayfadaki Logla düğmesi için lime nokta tanımlıyor; Tara kaynaklı uçuş için tanım yok.)
3. Kontur çıkartma üretimine gömülsün mü (sonraki native derleme; öneri yukarıda)?
