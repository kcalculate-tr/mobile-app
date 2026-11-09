# G19-S2 — Günlük takip + Gün halkası + etkinlik + su + seri: açılışa hazırlık (9 Kas, gece 19)

Dal `night19/track` (taban `night18/release` `94f3bf8`) · worktree `.claude/worktrees/g19-s2`. Canlıya dokunulmadı.

## ÖZET (10 satır)
(1) **Gün sınırı Europe/Istanbul**, cihaz saat diliminden bağımsız: yazılı kural `src/modules/gun/track/dayClock.ts`; testler İstanbul/Berlin/New York/Tokyo/UTC'de 22/22 ✓. Yuva + satır saati de İstanbul. Yurt dışında bugünün kovasını kaçıran 30 günlük kova düzeltildi (yalnız yeni kabuk).
(2) **Gece yarısı geçişi**: açık Ana sayfa yeni günü yükler (zamanlayıcı + ön plan kontrolü; bileşen testi). Sekme odağı / ön plana dönüş → bugün + su + etkinlik tazelenir (çoklu cihaz).
(3) **Toplam = kayıtlar**, yuvarlama tek yerde (`track/totals.ts`): halka, makro, "Bugün" başlığı ve yuva toplamları aynı sayı (testli). **Hedef yoksa** uydurma 2.000 yok → "hedef belirlenmedi".
(4) **Kayıt işlemleri**: Kaldır → "Kayıt kaldırıldı · Geri al" (aynı id ile geri ekleme) · kaydı başka öğüne taşı (FinMoPopover, yeni) · porsiyon artık bütün kayıtlarda (popover) · elle giriş istemci id'li.
(5) **Çevrimdışı kayıt kuyruğu** (AsyncStorage, kullanıcıya özel, FIFO, sıkıştırma, 23505 = idempotent, kalıcı hatada geri alma); ağ dönünce / ön planda boşalır.
(6) **Su**: hata anında toplamın 0'a düşebildiği hata düzeltildi; sunucu sınırları istemcide (≤ 20 L, adım ≤ 2 L), tavanda geri al yalnız eklenen kadar. **Etkinlik**: 1–600 dk / ≤ 300 km, taslak başına idempotency anahtarı (yeniden deneme çift kayıt üretmiyordu → artık üretmez), "Etkinlik eklendi · Geri al".
(7) **Seri** sunucu kuralıyla aynı (bugün yoksa dünden; 0 kcal sayılır; su/etkinlik saymaz). Kutlama 3/7 **kullanıcı başına bir kez**, ekrana geldiği an işaretlenir, 7 gösterilince 3 tekrar çıkmaz. GunViewer yerel yayı → token + azaltılmış hareket.
(8) **Öğün hatırlatmaları** (yerel, `fin_reminder`): 10:30/14:30/21:00 İstanbul, yuva loglandıysa yok, sessiz saat + `reminder_enabled` + "Bugün sessize al", yalnız son 7 günde kaydı olana; yeni kapalı bayrak `ogun_hatirlatma`. **Ölçüm**: log_add{source}, log_edit, log_delete, water_add, activity_add, streak_day, ring_complete (PII beyaz liste testli).
(9) Kontrol: **tsc 0 · unit 741 (740 ✓, 1 atlandı, 0 ✗) · jest 35 suite / 194 ✓, snapshot 2/2 (bayrak kapalı parite) · expo export iOS ✓ 10,2 MB · Android ✓ 10,2 MB** · Profiler bütçesi: mount 5 · kaldır 4 · logFlight 5 commit.
(10) Açılış listesi `docs/night/TAKIP_ACILIS.md`. Migration dosyası (UYGULANMADI) + rollback. SORULAR 7 madde. Son commit GERÇEK dosya `docs/night/G19-S2-DONE`.

Eski tasarım: 0 (yeni öğeler yalnız Final bileşenleri: MealMenuPopover/FinMoPopover, HomeInkToast; `₺` eklenmedi; yeni metinlerde " · " ayracı yok — g17Keys testi ✓).
Yeniden giydirilen (Final'de yok): yok (bu oturum yeni ekran eklemedi).

## Commit tablosu (dal `night19/track`)
| Commit | Madde | Özet |
|---|---|---|
| `f0569fb` | 1·2·3·4·5·7 | Saf takip çekirdeği `src/modules/gun/track/`: dayClock, totals, streak, limits, logQueue(+Native), mealReminderPlan(+native), events, useDayRollover; homeData İstanbul saati + tek yuvarlama; 22 test |
| `c77439a` | 1·2·3·4·5·7 | TrackerScreen (yalnız `yeniKabuk` dalı), HomeMealSlots (öğün taşı + hedef yok), HomeCelebrations (seri/kutlama/olay/hatırlatma), useCelebrations (kullanıcıya özel, markSeen), water.ts, TrackerActivityEntry + HomeActivitySection (sınır, idempotency, geri al), bayrak `ogun_hatirlatma`, TR+EN metinler, 5 yeni bileşen testi |
| `9ac6abe` | 6·4 | React Profiler commit bütçesi testi; GunViewer token yayı + azaltılmış hareket |
| `ba046da` | 3·5·7 | Migration dosyası + rollback + sözleşme testi |
| `329a5ae` | 8 | `docs/night/TAKIP_ACILIS.md` |
| (bu LOG) | 9 | LOG |
| (son) | — | `docs/night/G19-S2-DONE` |

## Madde madde
### 1 — Doğruluk
- Kural (dosya başında yazılı): gün = İstanbul gece yarısı, Türkiye sabit UTC+3 (2016'dan beri yaz saati yok), Intl `timeZone`'a güvenilmez (Hermes/ICU). Sunucu (get_user_day_progress, log_water, get_nutrition_summary) aynı sınırı kullanıyor.
- Önceden: yuva ve satır saati cihaz saatinden (`getHours`) → yurt dışında gün İstanbul'a, yuva cihaza göre ayrışıyordu. Şimdi `istanbulHour` / `istanbulHHMM`. Selamlama bilerek cihaz saatinde.
- 30 günlük kova cihaz gece yarısından üretiliyordu → UTC+3'ten ilerideki saat dilimlerinde (Tokyo) bugünün kovası yoktu, seri 0 görünürdü. Yeni kabukta `lastDayKeys(30)`; bayrak kapalı yol AYNEN.
- Gece yarısı: `useDayRollover` (sonraki gece yarısı + 1 sn; AppState `active`'de gün karşılaştırması — arka planda JS zamanlayıcısı çalışmayabilir). Yeni gün → fetchData + hedef özeti + su + etkinlik.
- Toplam: `dayTotals` — kcal satır başına tam sayı, makro ham toplam bir kez yuvarlanır. Testler: yuva toplamları = gün toplamı; 0,4 × 3 = 1 g; bozuk satır toplamı bozmaz; bileşende 100,4 + 100,4 + 199,6 → "400 / 2.000 kcal".
- Hedef yok: `goalState(sunucu özeti, profil)`; yoksa halka "Hedef belirlenmedi", başlık "600 kcal, hedef belirlenmedi" (bileşen testi).

### 2 — Kayıt işlemleri
| İşlem | Durum |
|---|---|
| Tara | G19-S1 alanı (dokunulmadı); Ana sayfa `logFlight` ile vurgular, `log_add{source:scan}` köprüden |
| Elle gir | yeni kabukta istemci uuid + kuyruk; çevrimdışıysa "Çevrimdışı kaydedildi…" |
| Keşfet'ten ekle | mevcut akış; `log_add{source:kesfet}` köprüden (logFlight) |
| Teslim edilen sipariş | mevcut otomatik log; `log_add{source:order}` |
| Düzenle / porsiyon | satır menüsü "Öğün ⌄" → FinMoPopover porsiyon çipleri (önceden yalnız eatkcal kaydında); kuyruk `update` (ardışık seçimler birleşir) |
| Öğün değiştir | YENİ: popover'dan öğün → `meal_type` (sunucu kodu) güncellenir, "Akşam öğününe taşındı" |
| Sil + geri al | kuyruk `delete` + "Kayıt kaldırıldı · Geri al" → aynı id/değerlerle `insert` (bekleyen silme varsa ikisi de düşer) |
| Çoklu cihaz | sekme odağı + ön plana dönüş (15 sn alt sınır) → bugünün listesi, su, etkinlik; bekleyen işlemler okunan listeye uygulanır |
| Çevrimdışı kuyruk | `logQueue.ts` (saf, testli) + `logQueueNative.ts`; NetInfo dönüşü / AppState active / üstel bekleme 2→60 sn; gönderim sırasında gelen işlemler uçuştaki işlemlerle sıkıştırılmaz (ertelenir) |

### 3 — Su ve etkinlik
- Su: `useWaterToday` geri alma değeri ref'te (önceden setState güncelleyicisinde yakalanıyordu → hata anında 0'a düşebiliyordu); sıra numarası (geç gelen eski yanıt yeni toplamı ezmez); `refresh()`; 20 L'de "su sınırı" toast'ı. Halka etkisi: toplam anında, sunucu yanıtıyla düzeltilir.
- Etkinlik: istemci sınırı + sunucu CHECK dosyası; idempotency anahtarı taslak başına (taslak değişince yenilenir); geri al = `activity_logs` satırını sil (RLS `activity_logs_own` for all) → bölüm yeniden okunur, gün toplamı düşer.

### 4 — Seri ve Gün halkası
- `track/streak.ts`: displayStreak (sunucu kuralı), celebrationStreak (bugün şart), markShown (7 → 3), kullanıcıya özel anahtar (eski ortak anahtar okunup birleştirilir → yükseltmede tekrar kutlama yok).
- Gün sonu özeti: FinGunEnd/Done GunViewer'ın son slaytı; Done = sunucu `progress ≥ 1` (İstanbul günü). `dayEndKind` saf kuralı yazıldı/testli (20:00 sonrası End, tamamlanınca Done, günde bir kez) — otomatik açılan yeni bir yüzey Final'de olmadığı için EKLENMEDİ (KARAR).
- Azaltılmış hareket: CelebrateOverlay, FinTopBlock, HomeInkToast, RollingNumber zaten uyuyor; GunViewer geri yaylanması düzeltildi.

### 5 — Hatırlatmalar
- Plan `mealReminderPlan.ts` (saf, testli), kurulum `mealReminder.ts`: sabit bildirim kimliği `fin-reminder-<gün>-<öğün>`, `categoryIdentifier: fin_reminder` + `data.fin='reminder'` → mevcut "30 dk ertele" / "Bugün sessize al" işleyicileri (finPushNative) çalışır; Android kanal `fin`.
- Eşitleme: Ana sayfa verisi hazır olunca ve her yuva değişiminde (HomeCelebrations); bayrak kapalıysa kurulu olanlar iptal.
- Sunucu tarafı (uygulama açılmayan kullanıcıya push) bu sürümde gerekmedi → DOSYA yazılmadı; TAKIP_ACILIS §6'da not.

### 6 — Performans
- React Profiler (react-test-renderer, bayrak açık Ana sayfa): ilk yükleme **5** commit, Kaldır **4**, logFlight (nokta → satır → halka) **5** → bütçe testi (8/6/8).
- Liste sanallaştırma: Ana sayfa öğün listesi günde tipik 3–15 satır, dört yuvada gruplu → FlatList'e çevirmek getirisiz + ScrollView içinde iç içe sanallaştırma uyarısı; KARAR: değiştirilmedi. 30 günlük geçmiş grafik veri, liste değil.
- Animasyonlar: yeni kabuk yolu Reanimated (UI iş parçacığı); yeni eklenen popover/toast mevcut Reanimated bileşenleri. Eski `Animated` + `useNativeDriver:false` (bgFlash) yalnız bayrak kapalı yolda.
- Başarılı senkron sonrası gereksiz yeniden okuma kaldırıldı (iyimser durum zaten doğru).

### 7 — Ölçüm olayları
`track/events.ts`: tipli 7 olay + PII beyaz listesi (ad/not gönderilmez; testli). Gönderim `lib/analytics.track` (kuyruklu). Keşfet/Tara/eatkcal logları `logEventsBridge` ile tek yerden (zaten yayınlanan `kcal:logFlight`/`logUndo`); streak_day ve ring_complete günde bir kez (kullanıcı+gün anahtarı).
D-S1 sözlüğü eşlemesi (`alias_of`): log_add → log_meal, water_add → log_water, activity_add → log_activity.

### 8 — Açılış listesi
`docs/night/TAKIP_ACILIS.md`: ön koşul migration sırası, bayrak tablosu (yeni_kabuk, gun_halkasi, su_takibi, etkinlik, ogun_hatirlatma; %10 → %50 → %100, 48 saat yeşil kuralı), alarmlar, kontrol SQL'i, elle doğrulama, geri dönüş.

### 9 — Kontrol
| Kontrol | Sonuç |
|---|---|
| `npx tsc --noEmit` | 0 hata |
| `npm run test:unit` | 741 test · 740 ✓ · 1 atlandı · 0 ✗ |
| `npx jest` | 35 suite · 194 ✓ · snapshot 2/2 (TrackerScreen bayrak kapalı = aynı) |
| Saat dilimi | g19track 23 test (saf 22'si × 5 TZ) ✓ |
| noLegacy / yerel hareket token testleri | ✓ (suite içinde) |
| `expo export --platform ios` | ✓ (hbc 10,20 MB) |
| `expo export --platform android` | ✓ (hbc 10,23 MB) |
| Simülatör kare karşılaştırması | YAPILMADI → SORULAR 1 |

## KARAR
- Gün/yuva/saat İstanbul; selamlama cihaz saati (kullanıcının "günaydın"ı yerel sabah).
- Öğün değiştir/porsiyon için yeni görsel üretilmedi: Final FinMoPopover satır menüsünden açılır; tetik "Öğün ⌄" metin düğmesi mevcut menü düğmesi stiliyle (Kaldır ile aynı).
- Çevrimdışı idempotentlik için `source_ref` değil istemci `id` (birincil anahtar) kullanıldı → `meal_consumptions` üzerindeki başka bir benzersiz index varsayımı yok, `source_ref` anlamı değişmedi.
- Canlı `pg_indexes` okuması izin sınıflandırıcısınca reddedildi → yalnız şema dosyası + mevcut kod (pantry upsert) ile ilerlendi.
- Öğün hatırlatmaları ayrı kapalı bayrak (`ogun_hatirlatma`) arkasında: yeni kabuk açılınca herkese bildirim gitmesin.
- Ara öğün hatırlatılmaz (günde ≤ 3; seri hatırlatması 19:30 ayrı).
- Olay adları görev md.7'deki adlar (D-S1'in log_meal/log_water/log_activity adları alias olarak bağlandı).
- Gün sonu özetini otomatik açan yeni yüzey eklenmedi (Final'de yok); kural saf fonksiyon olarak hazır.
- Başarılı kuyruk senkronundan sonra liste yeniden okunmaz (titreme/istek yok); başka cihazın değişikliği odak/ön planda gelir.

## CANLIYA UYGULANACAK (Claude/İlter — bu oturum UYGULAMADI)
| Dosya | İçerik | Rollback |
|---|---|---|
| `supabase/migrations/20261109200100_g19_s2_track.sql` | `feature_flags.ogun_hatirlatma` (kapalı, 1.1.0) · `activity_logs` minutes ≤ 600 / distance ≤ 300 (NOT VALID) · D-S1 sözlüğü varsa 7 takip olayı | `supabase/rollbacks/20261109200100_g19_s2_track_rollback.sql` |
Sıra: D-S1 `20261109100300_d_s1_kpi.sql` önce uygulanırsa olay satırları da girer; sonra uygulanırsa blok atlanır (yeniden çalıştırmak güvenli, `on conflict do nothing`). CLAUDE.md: backend commit'i main'e cherry-pick — İlter onayıyla.

## DEPLOY GEREKİR
- Edge function değişikliği YOK.
- Mobil: JS/OTA yeterli (yeni paket/native yok; expo-notifications, NetInfo, expo-crypto zaten pakette). `eas update` onaysız YASAK.

## TEMAS (başka oturum dosyaları)
- `src/modules/kesfet/ui/TrackerActivityEntry.tsx` (Keşfet modülü; yalnız Ana sayfa etkinlik girişinde kullanılan bileşen): sınır, idempotency, `onLogged(r)` imzası (geriye uyumlu).
- `src/modules/celebrate/useCelebrations.ts`: `useCelebrations(userId?)` + `markSeen` (geriye uyumlu).
- G19-S3 (`night19/metrics`) birleşince: `track/events.ts` `setTrackSink` ile yeni `track()`'e bağlanmalı; çağrı noktalarına ayrıca log_add EKLENMEMELİ (köprü zaten sayıyor → çift sayım).

## SORULAR
1. **Simülatör kareleri / Final yan yana karşılaştırması yapılmadı.** Bu oturumun görsel etkisi iki küçük öğe ("Öğün ⌄" düğmesi satır menüsünde, hedef yokken başlık metni) + mevcut toast'ın yeni metinleri; davranış bileşen testleriyle kanıtlandı. G19 entegrasyon oturumu vitrinde FinHomeR3 / FinMoPopover / FinAddToast karelerini almalı.
2. Silinip geri alınan **Tara kaydının fotoğrafı** (`photo_path`) geri gelmez — istemci listesi bu kolonu seçmiyor. Seçime eklensin mi (S1 Tara alanıyla birlikte)?
3. Hatırlatma saatleri (10:30 / 14:30 / 21:00) ve "son 7 günde kayıt" koşulu ürün kararı — İlter onaylasın.
4. `finPush.muteUntilEndOfDay` cihazın yerel gün sonunu kullanıyor (G18-S4 dosyası); Türkiye'de aynı, yurt dışında İstanbul gün sonu ile ayrışır. Değiştirilsin mi (mevcut testi yerel saate bağlı)?
5. Etkinlik CHECK'i NOT VALID — canlıda 600 dk üstü eski satır var mı? (TAKIP_ACILIS §0 SQL'i)
6. Eski 1.0.7 yolu (bayrak kapalı) Elle girişte hâlâ çevrimiçi yazım + sessiz hata; bilerek değiştirilmedi (parite).
7. D-S1 sözlüğündeki `log_meal` vs görevin `log_add` adları: tek ad mı kalsın? (Şimdilik alias.)
