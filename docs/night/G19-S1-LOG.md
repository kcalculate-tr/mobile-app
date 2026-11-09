# G19-S1 — Tara (AI tarama) herkese açılışa hazır · LOG (9 Kas)
Dal `night19/scan` (taban `night18/release` = G18-S5 DONE) · worktree `.claude/worktrees/g19-s1` ·
simülatör "G19-1 iPhone" (185C6603…, G18-5'teki dev client .app'ı kuruldu, derleme YOK) · Metro `--port 8111`.

## ÖZET (10 satır)
1. Uçtan uca denetimde **14 hata** bulundu, hepsi düzeltildi + testli (tablo aşağıda). En ağırları: sonuç satırları "0 kcal" (öğe kcal'ı istemcide atılıyordu → gram/öğe sil toplamı DEĞİŞTİRMİYORDU), "Tekrar dene" fotoğrafı yeniden analiz etmiyordu, logla hatası sessizdi.
2. Sunucu: tüketilmiş anahtarla yeniden istek hakkı **ikinci kez** düşürüp modeli yeniden çağırıyordu; gece yarısını geçen anahtar sonsuza dek `expired` döngüsündeydi → migration + edge DOSYASI (PGlite 20/20, eski RPC negatif kontrol dahil).
3. Edge: kullanıcı başına dakika sınırı (4) + anahtar başına deneme sınırı (4) → 429 `rate_limit`; indirmeden önce boyut (≤ 5 MB) + boş dosya; model zaman aşımı ayarlı (vars. 20 sn); sonuç önbelleği.
4. Sonuç kalitesi: tek düzeltme hesabı `adjust.ts` (makro makro ölçek), öğe silinince addan da çıkar, "Eksik besin ekle" → **elle ekleme** (ad + kcal + gram), EN cihazda `lang` → EN adlar, not (`hint`) sonuçta görünür (korundu).
5. Çevrimdışı/zayıf ağ: kuyruğa giren foto belge dizinine kopyalanır (önbellek silinse de kalır), bozuk foto kuyruğu kilitlemez (kalıcı hata düşer, model hatası 3 denemede), ağ hatası deneme sayılmaz, girdinin dili saklanır; istemci zaman aşımı 45 sn; 5 MB üstü dosya belleğe okunmadan reddedilir (hak harcanmaz).
6. İzinler: galeri izinsiz açılır (PHPicker/Photo Picker), red → toast (Alert yok); eski derleme sistem kamerası yedeği uçtan uca testli; **iOS izin metni Tara'yı hiç anmıyordu** → TR/EN güncellendi (yeni derlemede).
7. Ölçüm: scan_open · scan_start · scan_success{n_items,kcal} · scan_failed{reason,stage} · log_meal{source:'scan',edited} · scan_limit — D-S1 sözlük adlarıyla; eksik iki ad (scan_open, scan_limit) migration'da sözlüğe eklenir.
8. `docs/night/TARA_ACILIS.md`: ön koşullar, %10→%50→%100 planı + geçme ölçütleri, 4 kapatma anahtarı, metrikler/alarmlar, Sentry kod tablosu.
9. Kontroller: tsc 0 · unit 737/0 (+20 yeni) · bileşen 205/0 (+17 yeni) · noLegacyWhenFlagsOn ✓ · bayrak kapalı parite snapshot ✓ · expo export iOS + Android ✓ · TR/EN kare dizisi (16'şar) · Tara pano SSIM = G18-S5 ile aynı (gerileme yok).
10. Eski tasarım: 0. Deploy/canlı yazma YOK; canlı okuma (Supabase MCP + CANLI_SEMA) bu oturumda izin sınıflandırıcısınca reddedildi → yalnız repo migration'larıyla çalışıldı.

## Uçtan uca denetim tablosu
Akış: Tara → canlı kamera → (Detay ekle) → deklanşör → analiz → sonuç → gram/porsiyon → logla → Ana sayfa.

| # | Adım | Senaryo | Bulgu (önce) | Düzeltme | Test |
|---|---|---|---|---|---|
| 1 | Deklanşör | çift dokunma / NetInfo beklenirken 2. çekim | 2. çekim **ikinci rezervasyon** açıyordu (hak −2) | `busyRef` kilidi (kamera + galeri + yedek yol) | g19ScanFlow "çift dokunma" |
| 2 | Analiz | hata → "Tekrar dene" | metin "baştan çekmen gerekmez" diyor ama yalnız sayfa kapanıyordu | aynı foto + aynı anahtarla yeniden analiz (idempotent) | g19ScanFlow "Tekrar dene" |
| 3 | Analiz | X / geri / arka plan sürerken | setState(unmount), **hak düşmüş sonuç kayboluyordu** | `orphanResult` (10 dk, tek kullanım, kullanıcıya bağlı) → Tara açılınca sonuç | g19ScanFlow "kapatılırsa", g19scan |
| 4 | Analiz | Android geri tuşu / iOS kaydırma | ekran kapanıyordu | analiz sürerken geri tüketilir, `gestureEnabled:false`; X çalışır (#3) | kod (BackHandler) |
| 5 | Analiz | iade (release) ağ hatası | sayaç yine +1 ("hakkın iade edildi" yanlış) | yalnız iade başarılıysa +1; önbellekli rezervasyonda iade yok | g19scan runAiScan ×2 |
| 6 | Analiz | NetInfo `isConnected=null` (Android açılış) | çevrimdışı sayılıp kuyruğa alınıyordu | yalnız `=== false` çevrimdışı | g19ScanFlow "null" |
| 7 | Sonuç | çok öğeli | **öğe kcal/makro atılıyordu** → satırlar "0 kcal", gram/sil toplamı değiştirmiyor (vitrin fikstürü kcal'ı elle verdiği için görünmüyordu) | `mapAnalyzeResponse` öğe kcal+P/K/Y; `adjust.ts` | g19scan ×7, g19ScanFlow "öğe silinip" |
| 8 | Sonuç | EN cihaz | `lang` hiç gönderilmiyordu → TR adlar | `buildAnalyzeBody` lang her zaman; kuyruk girdisi dil saklar | g19scan, g19PendingDrop |
| 9 | Sonuç | "Eksik besin ekle" | yalnız ürün araması; bulunmazsa eklenemiyordu; eski arama yanıtı yeniyi eziyordu | "“…” elle ekle" (ad+kcal+gram, 1–3000 kcal) + arama sıra no | g19scan manualRow |
| 10 | Logla | DB/ağ hatası | `errorKind='failed'` ama sonuç ekranında sayfa yok → **sessiz** | toast "Loglanamadı…", yeniden dene | g19ScanFlow "kayıt hatası" |
| 11 | Logla | çift dokunma / yanıtı kaybolan yeniden deneme | ikinci insert UNIQUE hatası → "başarısız" | `savingRef` + 23505'te mevcut satır döner | g19scan saveEstimate |
| 12 | Hak | İstanbul 00:00 geçerken ekran açık | dünkü "0/3" kalıyordu | `useScanRemaining` reset_at'ta gizler (zamanlayıcı) | g19scan effectiveRemaining |
| 13 | Sunucu | yanıtı kaybolan tamamlanmış analiz yeniden istenir | hak **ikinci kez** düşer + model yeniden çağrılır | `result` önbelleği, `cached:true` | PGlite + negatif kontrol |
| 14 | Sunucu | 23:59 rezervasyon, 00:00 analiz (kuyruk) | `expired` → iade → aynı anahtar gün güncellenmeden yeniden → sonsuz döngü | yeniden rezervasyon bugüne taşınır, dünkü sayaç iade | PGlite + negatif kontrol |
| — | Galeri | izin reddi | `Alert.alert` (yeni kabukta yasak) / izin gereksiz isteniyordu | izinsiz aç, red → toast | g19ScanPlatform ×3 |
| — | Kuyruk | foto önbellekten silindi / bozuk | ilk girdi her seferinde başarısız → **bütün kuyruk kilitli** | kalıcı hata düşer, sayılan hata 3 denemede düşer | g19PendingDrop ×3 |
| — | Yükleme | 5 MB üstü / dosya yok | hak ayrılıp base64'e okunuyor (bellek) sonra reddediliyordu | rezervasyondan ÖNCE `getInfoAsync`; FinErrFailed "çok büyük"/"bulunamadı" + "Yeniden çek" | g19scan judgeLocalImage |
| — | İzin metni | iOS kamera/foto açıklaması | Tara'dan söz etmiyordu | TR/EN güncellendi (app.config + locales) | cameraConfig ✓ |

Senaryolar sınandı, hata çıkmadı: kota bitti (FinErrLimit, analiz yok) · çevrimdışı (rezervasyon yok, FinErrOffline → FinScanOffline) · kamera izni reddi (canlı + eski derleme) · flaş (G17-S2 testleri) · uygulama arka plan → ön plan (izin yeniden denetlenir, G17-S2).

## Commit tablosu
| Commit | İçerik |
|---|---|
| 41684d0 | md.2 sunucu: migration `20261109190100_g19_ai_scan_hardening` + rollback + `analyze-ai-scan` (YALNIZ DOSYA) |
| d5b91e0 | md.3 sonuç kalitesi: öğe makroları, lang, `adjust.ts`, elle ekleme, TR+EN metinler |
| 884ca29 | md.1/2/4/5/6 akış: yarış kilitleri, Tekrar dene, orphanResult, kayıt hatası, sayaç, gece yarısı, 5 MB, kuyruk, galeri, olaylar + testler |
| 0d49c6b | PGlite kontrolü `supabase/tests/g19_s1.check.mjs` (20/20) |
| 4879c29 | md.5 izin/platform bileşen testleri |
| 0b65cd2 | md.7 `docs/night/TARA_ACILIS.md` |
| 38bf95a | md.5 iOS izin metinleri (TR+EN) |
| 2f021d8 | md.8 TR/EN kare dizisi + pano kabul tablosu (`docs/night/g19-s1/`) |

## Kontroller (md.8)
| Kontrol | Sonuç |
|---|---|
| `tsc --noEmit` | 0 hata |
| `npm run test:unit` | 738 · 737 ✓ · 0 ✗ · 1 atlandı (önceden var) — `g19scan` 20 yeni; `noLegacyWhenFlagsOn` (Eski tasarım: 0), `i18nKeys` (TR/EN eksik 0), `screenCatalog` dahil |
| `npx jest` (bileşen) | 38 takım · 205 ✓ · 0 ✗ — yeni: g19ScanFlow 8, g19PendingDrop 4, g19ScanPlatform 5 |
| Bayrak kapalı parite | `ScanScreen.flagParity` snapshot (night17/fix tabanı, `-u` YOK) ✓ — yeni olaylar/kilitler yalnız yeni kabuk dalında |
| `expo export` | iOS ✓ (3053 modül) · Android ✓ (3060 modül) — son kod commit'i (2f021d8) sonrası yeniden çalıştırıldı, ikisi de çıkış 0 |
| PGlite (migration) | 2 kez + rollback + yeniden, davranış 18 + negatif kontrol 2 = 20/20 |
| Edge | `deno check` ✓ · `deno lint`: 1 önceden var (hint kontrol karakteri regex'i, kasıtlı) |
| TR/EN kare dizisi | `docs/night/g19-s1/FinMoScan_TR_kareler.png`, `…_EN_kareler.png` — gerçek ScanScreen (vitrin istemcisi 2,5 sn): vizör → "Analiz ediliyor" → sonuç; satır kcal dolu ("Tavuk/Chicken 260 kcal"), EN'de "Log to lunch" |
| Tara pano kabul (σ1,5 SSIM) | `docs/night/g19-s1/tara_pano_kabul.tsv` — 11 pano G18-S5 değerleriyle **aynı** (±0,002): FinErrFailed 0,890 ✅ · FinErrOffline 0,917 ✅ · FinScanError 0,932 ✅ · FinPhotoR1 0,815 (dy −11) · FinErrLimit 0,848 (dy 12) · FinScanOffline 0,856 (dy 11) · FinScanR2/FinMoScan kamera alanı siyah (simülatör) — farkların dayanağı G18-S5 LOG'daki gibi; bu oturum görsel değiştirmedi |

Eski tasarım: 0

## KARAR
1. **Olay adları**: görevdeki adlar D-S1 sözlüğüyle hizalandı (sözlük kazanır): scan_capture → `scan_start`, scan_fail → `scan_failed`, scan_log → `log_meal{source:'scan'}` (KPI olayı); `scan_open`, `scan_limit` sözlüğe eklendi (migration, sözlük yoksa atlar). Olaylar G19-S3'ün `track`'ine tembel require ile gider; props beyaz listeli (ad/not/foto/kimlik yok). Yalnız yeni kabukta (bayrak kapalı parite).
2. **Analiz sürerken X**: engellenmedi (kullanıcı çıkabilmeli); hak düşmüşse sonuç 10 dk saklanıp Tara açılınca gösterilir. Final'de yeni görsel yok (FinPhotoR1 aynen).
3. **Sınır değerleri**: dakika 4 farklı tarama, anahtar başına 4 model çağrısı, istemci zaman aşımı 45 sn, kuyrukta sayılan hata 3 deneme. `app_settings` ile değiştirilebilir.
4. **Galeri boyutu**: `expo-image-manipulator` yok (yeni paket yasak) → galeri fotoğrafı yeniden boyutlandırılamaz; kalite 0,5 + 5 MB ön kontrol + açık hata metni. Kamera çekimi zaten ≤ 1600 px (`pictureSize`).
5. **Hata metinleri** (yeni, TR+EN, Final'de yok — hata hâli istisnası): "Fotoğraf çok büyük…", "Fotoğraf artık cihazda bulunamadı…", "Yeniden çek", "Loglanamadı…", "Fotoğraflara erişim kapalı…", elle ekleme alanları. Elle ekleme yeni pano değil; mevcut "Eksik besin ekle" sayfasının arama-sonuçsuz hâli (mevcut alan/satır stilleri).
6. Edge sütunları için `select('*')` + hata yedekleri: migration'sız deploy edilse bile G18 davranışı (kırılma yok).
7. Simülatör: G18-5 (açık, başka oturumun olabilir) DOKUNULMADI; yeni "G19-1 iPhone" oluşturulup .app kopyası kuruldu; kamera/foto izni simctl ile verildi (çekimde sistem izin penceresi kapatıyordu).

## CANLIYA UYGULANACAK
1. `supabase/migrations/20261109190100_g19_ai_scan_hardening.sql` (rollback: `supabase/rollbacks/20261109190100_g19_ai_scan_hardening_rollback.sql`). Önkoşul: 20261104000600, 20261104001000 (status 'consumed'), 20261105000200. D-S1 SONRA uygulanırsa bu dosya yeniden çalıştırılır (sözlük satırları; idempotent).
2. Bayrak dalgaları: `docs/night/TARA_ACILIS.md` §1 (İlter kararı; bu oturum bayrağa dokunmadı).

## DEPLOY GEREKİR
1. `analyze-ai-scan` (migration'dan SONRA). İsteğe bağlı secret `AI_SCAN_TIMEOUT_MS`.
2. Uygulama JS (OTA): bütün istemci düzeltmeleri. **Native derleme**: yalnız iOS izin metinleri (app.config / locales) için — sonraki mağaza derlemesine binebilir.

## SORULAR
1. **Canlı okuma reddedildi** (Supabase MCP `execute_sql` ve `CANLI_SEMA_2026-11-09.md` okuması izin sınıflandırıcısınca engellendi). `ai_tarama` canlı durumu (enabled/rollout/min_app_version) ve İlter kilidi doğrulanamadı; açılış listesi repo migration'larına göre yazıldı. Kontrol: `select key, enabled, rollout_percent, min_app_version from feature_flags where key in ('ai_tarama','yeni_kabuk');`
2. Kapatma anahtarı `ai_scan_daily_cap=0` kullanıcıya "Bugünkü 3 taramanı kullandın" gösterir. Ayrı "Tara geçici olarak kapalı" metni/panosu istenir mi?
3. Galeri fotoğrafı için `expo-image-manipulator` (uzun kenar ≤ 1600) sonraki native derlemeye eklensin mi? Şimdilik 5 MB üstü reddediliyor.
4. Pano kabulünde FinPhotoR1/FinErrLimit/FinScanOffline dikey konum farkı (11–12 pt) G18-S5'ten devralındı (cihaz 402×874 ↔ pano 393×852); bu oturum düzeltmedi.
5. Elle eklenen besinin makroları bilinmiyor (yalnız kcal) → P/K/Y toplamına 0 katkı. Elle P/K/Y alanı istenir mi?
6. `scan_failed` olayı `stage:'local'` (dosya büyük/yok, hak harcanmadı) ile ayrı; başarı oranı hesabında hariç tutulmalı (TARA_ACILIS §3'te öyle).
