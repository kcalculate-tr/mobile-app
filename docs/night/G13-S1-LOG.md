# G13-S1 — Ana sayfa son bağlantıları

## ÖZET (10 satır)
Dal `night13/home` (taban `night12/release` `de3cb80`), worktree `.claude/worktrees/g13-s1`. 5 madde tamam.
(1) `yeni_kabuk` açıkken TrackerScreen'de FinHomeR3 4 öğün yuvası (`buildSlots`): kaynak etiketi, saat, "…'e logla ⌄", kayıt menüsü (Düzenle/Porsiyon, Paylaş, Kaldır); "Dolabındakiler" şeridi YOK, bugün teslim edilen sipariş otomatik loglanır.
(2) `CelebrateOverlay` + `useCelebrations` mount — gerçek ilk-öğün (sunucuda bugünden eski kayıt yok) + 3/7 gün seri (30 günlük kova); ömür boyu bir kez (`@kcal_celebrate_shown`); ardından bildirim izni sheet'i (mevcut `requestPushPermissionOnly` → `registerForPushNotifications`).
(3) Çapraz sekme Logla vurgusu: `kcal:logFlight` → bugün tazelenir → yeni kayıt BİR KEZ vurgulanır (nokta → satır + success → halka); `kcal:logUndo` geri alır.
(4) logFlight olayları tek kaynak `src/modules/shell/logEvents.ts`; `gun/logFlight`, `kesfet/events`, `ai/scan/logFlight` yalnız yeniden dışa verir.
(5) **Bayrak kapalı Tracker AYNI**: snapshot taban kodda üretildi + ilk commit'le kilitlendi, sonraki tüm commit'lerde DEĞİŞMEDEN geçti.
Kontrol: **tsc 0 · test:unit 463/463 · test:components 86/86 (20 süit, snapshot 1/1) · hygiene OK · expo export ios ✓ (8.79 MB, +0.06)**.
KİMSE (sipariş/ödeme/navigasyon/package.json/app.config.js) `git diff night12/release` BOŞ. Son commit GERÇEK dosya `docs/night/G13-S1-DONE`.

## Commit'ler
| Hash | İçerik |
|---|---|
| `131b762` | test: bayrak kapalı Tracker snapshot'ı — `night12/release` kodu üzerinde üretildi (değişiklikten ÖNCE) |
| `d98150f` | m.4 logFlight tek kaynak + `logEvents.test.tsx` |
| `5adb82c` | saf yardımcılar: `gun/homeHighlight.ts`, `gun/delivery.ts › pickAutoLogInstances`, `gun/autoLogStore.ts`, `celebrate/signals.ts` + unit testler |
| `478bced` | `tracker/HomeMealSlots.tsx`, `tracker/useHomeHighlight.ts`, `tracker/HomeCelebrations.tsx` + i18n (`gun`, `celebrate`; TR+EN) |
| `bed7924` | TrackerScreen wiring (m.1–3) + `TrackerScreen.flagOn.test.tsx` |
| (son) | LOG + `docs/night/G13-S1-DONE` |

## 1) FinHomeR3 öğün yuvaları
- Bileşen `src/screens/tracker/HomeMealSlots.tsx`; TrackerScreen yeni-kabuk gövdesinde imza halkasının (`TrackerDayHeader`) hemen altında.
- Veri: `todayConsumed` (bugünün `meal_consumptions` satırları) → `buildSlots`. TrackerScreen `normalizeConsumedRow` kaynağı `pantry|manual`'a indiriyordu; etiket için `ConsumedRow.raw_source` eklendi (eski alanlar aynı).
- Pano öğeleri: "Bugün" + `eaten / target kcal`; yuva başlığı ikon (pano SVG yolları) · ad · toplam/"—"; kayıt: 44pt foto/yer tutucu, ad, kaynak etiketi (Tara/Keşfet/eatkcal · teslim edildi/Elle) + saat, kcal; boş yuvada lime "Kahvaltı’ya/Öğle’ye/Akşam’a logla" + ayrı 44pt ⌄. Gün tamamen boşsa FinHomeEmptyR1 (cam damla + "Bugün henüz boş" + o saatin yuvası).
- "…'e logla" ve ⌄ → mevcut "Kalori Ekle" formu, öğün türü yuvaya ayarlı (`SET_MEAL_TYPE`). Kayıt mevcut `handleSaveMealLog` ile.
- Kayıt menüsü: eatkcal (otomatik) kayıtta "Düzenle" görünür; diğerlerinde satıra uzun bas (erişilebilirlik eylemi de var). Porsiyon ½·1·1½·2 (yalnız otomatik kayıt, `meal_consumptions` UPDATE), Paylaş (`paylasim_karti` açıksa mevcut `ShareMealCardModal`), Kaldır (`meal_consumptions` DELETE `id`+`user_id`; dolap kaydıysa tüketildi işareti de kalkar). Hata → iyimser geri alma + mevcut "Kaydedilemedi" uyarısı.
- **Dolabındakiler yok + teslim otomatik log:** yeni kabukta şerit render olmaz. Bugün teslim edilen siparişlerin (`orders.status='delivered'`, `delivered_at` bugün — yalnız OKUMA) dolap kopyaları (`pantryStore`, mevcut backfill) `pickAutoLogInstances` ile seçilir ve **"Tükettim" ile aynı biçimde** yazılır: `source='pantry'`, `source_ref=instanceId`, aynı `upsert onConflict 'user_id,source,source_ref'`; `consumed_at = delivered_at` (yuva teslim saatinden). Kalıcı küme `@kcal_autolog_pantry_v1`: kullanıcı kaldırdığı kopyayı bir daha görmez. Teslim anında yeni kayıt vurgulanır (FinHomeDelivered).
- Eski "Bugün Tüketilenler" listesi yeni kabukta gizli (aynı kayıtlar yuvalarda). Makrolar + Su yerinde.

## 2) Kutlama mount
- `src/screens/tracker/HomeCelebrations.tsx` (yalnız `yeniKabuk` iken mount). Sinyal: `celebrate/signals.ts` — `computeStreak` (bugün dahil kesintisiz kayıtlı gün; TrackerScreen 30 günlük `weeklyConsumption`), `isFirstMeal` (bugün ≥1 kayıt VE `meal_consumptions … lt(consumed_at, bugün) limit(1)` boş). Sorgu hatası → "eski kayıt var" sayılır (yanlış kutlama yok).
- Seçim/ömür boyu bir kez: mevcut `useCelebrations` + `pickCelebration` (öncelik first > streak7 > streak3, `@kcal_celebrate_shown`).
- Gösterim Logla izi B halka dolumundan SONRA (`TIMING.logTrail + DURATION.base + TIMING.dailyRing`). Kart metinleri FinCelebrate panosundan (i18n `celebrate.card_*`); ilk öğün kartı = bugünün ilk kaydı adı · kcal.
- "Devam et" → `dismiss` → izin `granted` değil, `canAskAgain` ve daha önce teklif edilmediyse (`@kcal_celebrate_notify_offered`) `NotifyPermissionSheet`; izin verilirse `registerForPushNotifications` (PushPermissionPrompt ile aynı akış).

## 3) Çapraz sekme Logla vurgusu
- `src/screens/tracker/useHomeHighlight.ts` — yalnız `enabled=yeniKabuk` iken `onLogFlight`/`onLogUndo` abonesi.
- Uçuş → bugün yükleme göstergesi olmadan tazelenir (`refreshToday`) → `pickHighlightTarget` (yükte `id` varsa o; yoksa uçuştan önce listede olmayan en yeni kayıt; zaten vurgulanan tekrar seçilmez = "bir kez").
- Sıra (FinMoLogB, yalnız motion token'ları): `dot` lime nokta iner → `TIMING.logTrail` sonra `row` satır yanar + `haptic('success')` + saat "şimdi" → `+DURATION.base` `ring` (TrackerDayHeader `logToken` → halka dolumu + zaman hapı) → `+TIMING.dailyRing` söner. Halka, `ring` evresine dek yeni kaydı saymaz (`heldKcal`). Azaltılmış harekette nokta evresi atlanır.
- `kcal:logUndo {id}` → aynı kayıtsa (ya da id'siz) vurgu kalkar, bekleyen uçuş tazelemesi iptal (nesil sayacı), bugün yeniden tazelenir (halka geri çekilir).
- Ana sayfanın kendi "Kalori Ekle" kaydı da yeni kabukta aynı vurgu sırasını kullanır.

## 4) logFlight tek kaynak
- `src/modules/shell/logEvents.ts`: olay adları, birleşik `LogFlightPayload` (id/x/y/w/h/imageUri/mealLabel/source/name/kcal — eski üç tipin üst kümesi, hepsi isteğe bağlı alanlarla geriye uyumlu), `emitLogFlight/emitLogUndo/onLogFlight/onLogUndo`.
- `gun/logFlight.ts`, `kesfet/events.ts`, `ai/scan/logFlight.ts` → yalnız re-export. Tek imza farkı: `ai/scan` `emitLogUndo(id: string)` → sözleşmedeki `{ id }` (çağıranı yoktu; `grep` ile doğrulandı). `KesfetScreen`/`ScanScreen`/`TabBarR3` değişmedi.
- Test `src/modules/shell/__component_tests__/logEvents.test.tsx`: re-export kimlik eşitliği + aynı kanal.

## 5) Testler + kontrol
- **Bayrak kapalı = aynı (snapshot):** `src/screens/__component_tests__/TrackerScreen.flagOff.test.tsx` — tüm bayraklar kapalı, bugünün 2 kaydı (manuel + dolap) ile tam render ağacı. Snapshot `131b762`'de, `night12/release` kodu DEĞİŞMEDEN üretildi; `git diff 131b762 HEAD -- __snapshots__` BOŞ ve `jest --ci` (yazma yok) geçiyor → bayrak kapalıyken Tracker render çıktısı bayt bayt aynı.
- **Bayrak açık:** `TrackerScreen.flagOn.test.tsx` 7 test — yuvalar/etiketler/boş yuva pill'i/Dolabındakiler yok; logFlight → nokta → satır ("şimdi") → halka (600→1080 kcal) + logUndo geri alır; aynı kayıt ikinci uçuşta vurgulanmaz; kayıt menüsü Kaldır → DELETE `id`; teslim oto-log upsert biçimi + yeniden mount'ta tekrar yok; ilk öğün kutlaması + bildirim sheet'i + ömür boyu bir kez; sinyal yoksa kutlama yok.
- **Unit (yeni):** `gun/__tests__/homeHighlight.test.ts` (8), `celebrate/__tests__/signals.test.ts` (6).
- `npx tsc --noEmit` → 0 · `npm run test:unit` → 463/463 · `npm run test:components` → 86/86 (20 süit, 1 snapshot) · `npm run hygiene` OK · `npx expo export --platform ios` ✓ 8.79 MB (G12: 8.73 MB).
- KİMSE: `git diff --quiet night12/release -- src/screens/HomeScreen.tsx src/screens/CartScreen.tsx src/screens/CheckoutScreen.tsx src/lib src/store src/components/checkout src/screens/profile src/screens/auth src/navigation package.json app.config.js` → 0 (BOŞ).

## Kararlar (gerekçeli; bekleme gerektirmiyor)
- **Porsiyon tabanı:** `meal_consumptions`'ta porsiyon kolonu yok (yeni kolon yazılmadı). Menü açıldığındaki değer "1" sayılır; ½·1½·2 o oturumdaki tabana göre ölçekler. Uygulama yeniden açılınca taban yeni değerdir.
- **Teslim oto-log penceresi:** yalnız BUGÜN teslim edilenler (30 günlük dolabın tamamı bugüne yazılmasın). Bayrak sonradan açılırsa bugünün tüketilmemiş teslimleri teslim saatine loglanır.
- **"…'e logla"** yuvaya ayarlı elle giriş formunu açar (Tara ekranı öğün parametresi almıyor — `RootStackParamList.AiScan: undefined`); Tara zaten kabuğun sekmesinde.

## ENTEGRASYONA
1. **Emitter'lar `id` versin** — `KesfetScreen.tsx:~314` `emitLogFlight({...})` içine `id: consumptionId`; `ScanScreen.tsx:111,266` kayıt id'si varsa ekle. Şu an Ana sayfa "uçuştan önce olmayan en yeni kayıt" kuralıyla doğru kaydı buluyor; id ile eşleşme kesinleşir. (G13-S1 dosyası değil.)
2. **Cihaz doğrulaması** (simülatör erişimi yok): yuva düzeni/kaydırma, nokta konumu (`left:-10`), Dynamic Type en büyük boyda pill/menü satırları, koyu tema vurgu tonu.

## SORULAR
Yok.
