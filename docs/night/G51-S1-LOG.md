# G51-S1 LOG — "Neler yapabilirsin" cam ikonlar + Koç kartı (14 Kas)

Dal `release/1.1.0` · worktree `.claude/worktrees/g23-s1` · başlangıç `e2e73d4` (`docs/night/G50-S1-DONE` vardı). Yalnız JS/TS (OTA uyumlu). Yeni paket yok. Deploy / OTA / canlı DB yok. Migration yok.

## ÖZET
1. **md.1 Cam ikonlar:** `HomeQuickActions` kartlarında lime kare zemin üstündeki çizgi ikonlar (Scan, ImageSquare, Sneaker, ChatCircleDots) kaldırıldı. Yerlerine `assets/glass` nesneleri geldi: Tabağını tara → `camera.png`, Öğününü paylaş → `bowl.png`, Etkinlik ekle → `foot.png`. Nesneler 52 × 52 pt `Image` (`contain`), zeminsiz ve doğrudan kartın üstünde; açık ve koyu temada aynı PNG kullanılıyor. VoiceOver'da gizli (kart etiketi aynı kaldı).
2. **md.2 Koç:** `coach` hızlı eylemi `QUICK_ACTIONS`'tan, `QuickAction` tipinden, `runQuickAction`'dan ve i18n'den (`act_coach*`, TR + EN) kaldırıldı.
3. Profilsiz Ana sayfada ızgaranın hemen altına profilli sayfadaki **mevcut `CoachHomeCard`** geldi. Props `null`, bu yüzden kart mevcut boş hâlinde çiziliyor: "Nereden başlasan? Kahvaltı için 3 öneri ister misin?" + "Koçuna sor". G50 Koç çipleri kartın hemen altında; ikinci bir Koç girişi yok.
4. **Kapı:** `CoachHomeCard`'a isteğe bağlı `gate(prefill)` prop'u eklendi. Profilsizde `coachGate` veriliyor: G47 profil kapısı → `Kayit` → dönüş `CoachIntro {from:'home', prefill: kartın sorusu}`. Çipler de aynı `coachGate`'ten geçiyor. Profilli kartta prop yok, davranış aynı. Deneme hakkı ve paywall Koç'ta aynen geçerli. `koc` kapalıysa (`useCoachEnabled` false) kart çizilmiyor.
5. **Izgara:** Sıra Tara · Paylaş (+ `etkinlik` açıksa Etkinlik). 2 kart tek satırda; 3 kartta üçüncü kart kendi satırında tam genişlik (boş dolgu hücresi kaldırıldı, `quickRows`).
6. **Profilli takip bölümü değişmedi:** G49 anlık görüntüsü `--ci` kipinde birebir geçiyor.
7. **Kontroller** (son kod commit'i `fbad963` üstünde): hygiene ✓ · tsc ✓ · unit 1361/1361 ✓ · jest 119 paket / 813 test / 3 anlık görüntü ✓ (`--ci`). `expo export` iOS ✓ Android ✓. Üretim iOS paketinde `G50-*` / `noProfileG50` 0 eşleşme.
8. Ekran görüntüleri `docs/night/g51/`: profilsiz Ana sayfa açık + koyu (üst, 500 pt ve 1000 pt kaydırma).

## Commit
| commit | içerik |
|---|---|
| `72e8e9d` | md.1 + md.2: cam ikonlar, `coach` ızgaradan çıktı, profilsiz Koç kartı + `gate`, 2/3 kart düzeni, testler |
| `044244a` | ek RN gölgesi kaldırıldı (düz Image, diğer cam kullanımlarıyla aynı) |
| `fbad963` | gölge yorumu düzeltmesi |
| (sonraki) | docs(g51): ekran görüntüleri + bu LOG |
| (son) | `docs/night/G51-S1-DONE` |

## Değişen dosyalar
| dosya | ne |
|---|---|
| `src/modules/kayit/ui/HomeQuickActions.tsx` | `QUICK_GLASS`, `QUICK_GLASS_SIZE` (52), `quickRows`; Image; sıra `scan, share, activity`; satır testID'leri |
| `src/modules/kayit/quickActions.ts` | `QuickAction` = `scan \| activity \| share`; `openCoach` / `targets.coach` kalktı |
| `src/modules/coach/ui/entries.tsx` | `CoachHomeCard` `gate?: (prefill) => boolean` |
| `src/screens/TrackerScreen.tsx` | `quickActions` (Koç yok), `coachGate`, profilsiz `<CoachHomeCard … null … gate>` ızgaranın altında |
| `src/modules/kayit/i18n.ts` | `act_coach`, `act_coach_sub` silindi (TR + EN) |
| testler | `g49Home` (3 kart, cam Image + kaynak, 52 pt, zemin yok, 2/2+1 satır), `g49QuickActions` (Koç yok, `coachGate` kaynağı), `g49HomeProfile` (ızgarada coach yok; Koç kartı profilsizde ızgaranın hemen altında, tek; `koc` kapalı → kart yok; kart → kapı → CoachIntro), `g50HomeOrder` (sıra `coach-home-card` ile) |

## Ekran görüntüleri (`docs/night/g51/`, "G40 iPhone" 402 pt)
- `G51-Home.jpg`, `G51-Home-Dark.jpg`: üst (plan kartı)
- `G51-Home-S500(-Dark).jpg`: görevler → Neler yapabilirsin (kamera + rozet · kase / tam genişlik ayak izi) → Koç kartı
- `G51-Home-S1000(-Dark).jpg`: Koç kartının altında çipler → Bugünün tarifleri

Yöntem: Metro bu worktree'den çalıştı (8146, CI kipi, `--clear`). Çekimler `scripts/dev/g14-shots.sh` storage kipiyle alındı, dev client `--initialUrl` ile bağlandı. Mevcut G50 vitrin sahnesi `G50-Home` kullanıldı (profilsiz, `koc` açık; yeni vitrin sahnesi eklenmedi). Native derleme yapılmadı. Çekimden sonra Metro durduruldu, simülatör kapatıldı. İlter'in "iPhone 17" simülatörüne dokunulmadı.

## HIG (kod denetimi)
- Dokunma alanı: kart minHeight 104 pt (≥ 44). Tam genişlik 3. kartın alanı da aynı Pressable.
- Dynamic Type: başlık / alt metin `maxFontSizeMultiplier 1.3`, `numberOfLines` yok (değişmedi). Rozet hâlâ cam nesnenin yanında esneyebiliyor (`flexShrink`).
- VoiceOver: cam nesneler gizli (`accessibilityElementsHidden`, `importantForAccessibility="no"`). Kart etiketi "Başlık. Alt metin(. rozet)" aynı. Koç kartının etiketleri mevcut kartla aynı.
- Renk tersine çevirme: `accessibilityIgnoresInvertColors` (fotoğraf benzeri nesne).
- Hareket: giriş ve basış hareketi aynen (azaltılmış harekette yalnız opaklık). Yeni hareket yok.
- Kontrast: Koç kartı her temada lime üstünde siyah (mevcut, ≥ 7:1).

## KARAR
1. **Izgara sırası Tara · Paylaş · Etkinlik** (eskiden Tara · Etkinlik · Paylaş · Koç). Brif "Tara + Paylaş (+ bayrak açıksa Etkinlik)" diyor. Bu sırada bayrak açık da olsa kapalı da olsa ilk satır sabit kalıyor; isteğe bağlı kart, tam genişlik 3. satır oluyor.
2. **Ek gölge yok:** Brif "hafif gölge (başka yerdeki kullanımla aynı)" diyor. Uygulamadaki öteki cam nesne kullanımlarının hiçbirinde RN gölgesi yok (Paywall, kişisel plan, öğün yuvaları, Koç); hepsi düz `Image`. PNG'lerin kendi yumuşak kenar ışığı var (açık temada ölçülen kenar ≈ #F7F7F7). İlk denemede iOS `shadow*` eklendi, görünür bir katkısı olmadı; "aynı kullanım" kuralına uymak için kaldırıldı.
3. **Koç kartı profilsizde props `null`:** `homeLine` boş hâli seçiyor. Dokununca giden soru "Kahvaltı için 3 öneri verir misin?" oluyor, bu da kapı dönüşünde `CoachIntro` prefill'i.
4. **`gate` isteğe bağlı prop:** Kartın kendi `openCoach` yolu korunuyor; kapı yalnız profilsiz Ana sayfada bağlı. Profilli kart çıktısı değişmedi (anlık görüntü).
5. Kullanılmayan `kayit.gate.act_coach*` anahtarları iki dilden birlikte silindi (eksik anahtar testi geçiyor).

## CANLIYA UYGULANACAK
- Yok (migration yok).

## DEPLOY GEREKİR
- Yalnız JS. Bir sonraki 1.1.0 OTA / build ile gider; bu oturumda deploy yapılmadı.

## SORULAR
- Cam nesnelere yine de ayrı bir gölge istenirse, PNG alfasını izleyen gölge için iOS'ta sarmalayıcı `View` + `shadow*` kullanılabilir; Android'de elevation kare düşer. Şu an diğer ekranlarla tutarlı olsun diye gölge yok.
