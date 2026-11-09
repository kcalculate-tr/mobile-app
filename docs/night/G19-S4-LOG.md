# G19-S4 — G19 birleştirme + son kontrol + derlemeye hazır dal · LOG (9 Kas)
Dal `night19/release` (taban `night18/release` @ 94f3bf8) · worktree `.claude/worktrees/g19-s4` · simülatör "G19-4 iPhone" (E3F41EB1…, G19-1 klonu, derleme YOK) · Metro `--port 8114`.

## ÖZET (10 satır)
1. Üç dal sırayla birleşti: night19/scan → night19/track (temiz) → night19/metrics (6 dosyada çakışma, iki tarafın işlevi korundu) + night19/data yalnız `supabase/` ve `docs/` (`scripts/sql/d_s1_dogrulama.sql` alınmadı).
2. Çift olay temizliği: G19-S2 `track/events.ts` köprüsü App.tsx'te `setTrackSink(track)` ile G19-S3 `track()`'ine bağlı; Tara olayları tek modülde (kanonik adlar scan_open/capture/success/fail/limit/offline/log); `water.ts` ve `TrackerActivityEntry` içindeki ikinci olaylar kaldırıldı.
3. Testle kilitlendi: "her kullanıcı eylemi tam 1 olay" — birim (`g19s4SingleEvent`, 6), bileşen (`g19s4LogBridge` 4, Ana sayfa 3, Tara akışı güncel), sözlük denetimi `trackScan`/`trackEvent` sarmalayıcılarını da tarıyor.
4. Uçtan uca gerçek akışta (G18-S5 `vitrinE2E`, canlıya yazmadan) 1 olay hatası bulundu ve düzeltildi: Keşfet logu `log_add{source:manual,kcal:0}` gidiyordu, çerçevesiz yolda hiç sayılmıyordu → `log_add{kesfet, 540}`.
5. Tara acil kapatma metni tek cümle: "Tara şu an kullanılamıyor, kısa süre içinde geri gelecek." / "Scan isn’t available right now, it’ll be back shortly." (disabled + global_cap, bileşen testi ×2). Meta rıza varsayılanı ve elle P/K/Y DOKUNULMADI.
6. Olay denetimi (E2E, koşu 3): 16 olay, hepsi sözlükte, her eylemde 1 kez, kişisel veri yok (tablo aşağıda). Su adımı E2E'de görünmüyor (RPC null) → bileşen testiyle kanıtlandı.
7. E2E güvenliği: dev kökünde Meta reklam rızası `denied` (simülatörde ATT granted → ürün/sepet olayları Meta'ya gidebilirdi), birinci taraf ölçüm fetch kesildikten sonra açılır.
8. Kontrol: tsc 0 · unit 820 (819 ✓, 1 atlandı, 0 ✗) · bileşen 41 takım / 235 ✓, snapshot 2/2 (bayrak kapalı parite) · noLegacy (Eski tasarım: 0) ✓ · i18n eksik anahtar 0 ✓ · "₺" arayüzde 0 ✓ · hygiene ✓.
9. prebuild iOS ✓ Android ✓ (`--no-install`, klasörler .gitignore'da) · expo export iOS ✓ 10,3 MB · Android ✓ 10,3 MB · E2E kökü üretim paketinde yok (`E2ERoot`/`yeni-hesap` grep 0).
10. iOS dev derlemesi YAPILMADI: boş disk 10–13 GB (< 20 GB kuralı). Yeni migration/deploy YOK. Son commit GERÇEK dosya `docs/night/G19-S4-DONE`.

## Birleştirme tablosu
| Sıra | Dal (DONE) | Commit | Çakışma | Çözüm |
|---|---|---|---|---|
| 1 | night19/scan (G19-S1 DONE `99f7c3e`) | `df0f0bf` | yok | — |
| 2 | night19/track (G19-S2 DONE `0a9f45b`) | `bd5670b` | yok | — |
| 3 | night19/metrics (G19-S3 DONE `4a8744e`) | `36a9ca4` | `ScanScreen.tsx` (3 blok), `drainPending.ts` (2), `water.ts`, `TrackerActivityEntry.tsx` (2), `TrackerScreen.tsx`, `HomeCelebrations.tsx` | S1 akışı (kilitler, orphan, kapatma, kuyruk) + S3 olayları tek kopya; S2 importları + S3 `share` olayı birlikte; teslim otomatik log'da S2 olayı + S3 kuralı (yalnız yeni satır, 23505 sayılmaz) |
| 4 | night19/data (D-S1 DONE `896832f`) — yalnız `supabase/`, `docs/` | `22c7f32` | yok | `scripts/sql/d_s1_dogrulama.sql` birleşmeden çıkarıldı (görev kuralı) |

Birleştirmede ayrıca (aynı commit, md.2): `scanEvents.ts` tek Tara modülü (G19-S3 kanonik adlar; D-S1 eski adları scan_start/scan_failed/log_meal yalnız sözlükte alias), `scanTrack.ts` → `trackScan`/`trackEvent` üzerinden; `scanMetrics` `unavailable` → `scan_fail{code:disabled|global_cap, stage:reserve}`; sözlük prop'ları G19-S2 alanlarıyla birleşti (slot, offline, undo, total_ml, factor, undone, kcal/target, camera, retry, cached, meal_type); `logSourceOf` tek eşleme `lib/metrics/logSource.ts` (kaynak kümesi scan · manual · order · pantry · kesfet · day_card · quick); `streak_day{days}`.

## Commit tablosu (bu oturum)
| Commit | Madde | İçerik |
|---|---|---|
| `df0f0bf` | 1 | merge night19/scan |
| `bd5670b` | 1 | merge night19/track |
| `36a9ca4` | 1 · 2 | merge night19/metrics + çakışma çözümü + çift olay temizliği + `setTrackSink` bağlantısı |
| `22c7f32` | 1 | merge night19/data (yalnız supabase/ + docs/) |
| `eb8d603` | 3 | Tara acil kapatma metni (TR/EN) + bileşen testi (disabled, global_cap) |
| `bfeb75b` | 2 | "tam 1 olay" birim + köprü bileşen testleri, sözlük denetimi genişledi |
| `1dd268f` | 4 | E2E'de bulunan Keşfet olay hatası + köprü geri al kuralı + E2E Meta/ölçüm güvenliği + Ana sayfa "tam 1 olay" testi + `docs/night/g19-s4/akis.jpg` |
| (bu) | 6 | LOG |
| (son) | — | `docs/night/G19-S4-DONE` |

## md.2 — Çift olay: önce / sonra
| Eylem | Önce (birleşik dalda) | Sonra |
|---|---|---|
| Tara logla (yeni kabuk) | S1 `log_meal` + S3 `scan_log` + S3 `log_add` + köprü `log_add{manual,0}` (logFlight kaynaksız) = **4** | `scan_log` 1 + `log_add{scan}` 1 (köprü `scan` saymaz) |
| Tara sonucu | S1 `scan_success`/`scan_failed`/`scan_limit` + S3 `trackScanOutcome` = **2** | tek `trackScanOutcome` → 1 |
| Tara çekim | S1 `scan_start` + S3 `scan_capture` | `scan_capture` 1 |
| Tara açılış | S1 `scan_open` (yeni kabuk) + S3 `scan_open` (her açılış) | `scan_open{camera: live|fallback|legacy}` 1 |
| Kuyruktan analiz | S1 2 olay + S3 3 olay / foto | `scan_success` + `scan_log` + `log_add` (her biri 1) |
| Su ekle | `water.ts` `water_add` + TrackerScreen `water_add` = **2** | TrackerScreen 1 |
| Etkinlik ekle | S3 `activity_add` + S2 `activity_add` = **2** | S2 1 |
| Teslim otomatik log | S2 (23505'te de) + S3 | S2 tipli, yalnız yeni satırda — 1 |
| Keşfet logla | köprü `log_add{manual,0}`; çerçevesiz yolda 0 | KesfetScreen `log_add{kesfet,kcal}` 1 (md.4'te bulundu) |
| Kabuk toast'ı "Geri al" | köprü `log_delete{manual}` (kayıt SİLİNMİYOR) | olay yok (köprü yalnız kendi saydığı kaydı geri alır) |

## md.4 — Uçtan uca gerçek akış ve olay denetim tablosu
**Yöntem:** G18-S5 `src/dev/vitrinE2E.tsx` (yalnız `__DEV__`): "G19-4 iPhone" (G19-1 klonu, mevcut dev client, derleme yok) + Metro 8114 + `kcal://dev/screen/E2E`. Bütün geçişler simülatörde gerçek dokunuşla (CGEvent tıklama/sürükleme, System Events yazma/yapıştırma). Oturum bellekte, Supabase yazmaları bellek tablosuna, herkese açık menü/ürün okumaları gerçek ağdan, Tara/Keşfet/Gün istemcileri mock, sipariş/ödeme YOK. Olaylar `[analytics] track(...)` Metro satırlarından (sözlük süzgecinden SONRAKİ prop'lar). Kareler: `docs/night/g19-s4/akis.jpg` (16 kare, koşu 3).

| # | Adım (ekran) | Gönderilen olay(lar) — süzgeç sonrası prop'lar | Sözlükte | Tek mi | Kişisel veri |
|---|---|---|---|---|---|
| 1 | Karşılama → Hesap (FinOnbWelcome/Account) | `onb_step{flow:first,step:OnbWelcome,index:0}` · `onb_step{…OnbAccount,index:2}` | ✓ | ✓ her ekran 1 | yok |
| 2 | E-posta + kod → Ana sayfa (FinHomeEmptyR1) | — (E2E bellek oturumu; `signup/login` AuthContext'te, E2E'de devre dışı — bkz. not) | — | — | — |
| 3 | Tara aç (FinScanR2, canlı expo-camera vizörü) | `scan_open{camera:live}` | ✓ | ✓ | yok |
| 4 | Detay ekle "Yarım porsiyon bulgur" | — (not metni gönderilmez) | — | — | ✓ not yok |
| 5 | Deklanşör → analiz → sonuç (FinPhotoR1, 640 kcal, not görünür) | `scan_capture{via:camera,has_hint:true,retry:false,offline:false}` · `scan_success{n_items:2,kcal:640,via:camera}` | ✓ ✓ | ✓ ✓ | yok (ad/foto yok) |
| 6 | Gram düzelt (Pirinç ½ → 75 g, 190 kcal) | — | — | — | — |
| 7 | "Öğle'ye logla" | `scan_log{n_items:2,kcal:450,edited:true,meal_type:lunch}` · `log_add{source:scan,slot:lunch,kcal:450,offline:false}` · `streak_day{days:1}` | ✓ ✓ ✓ | ✓ ✓ ✓ (köprü atladı) | yok |
| 8 | İlk öğün kutlaması (kase) → bildirim sheet'i "Şimdi değil" | — | — | — | — |
| 9 | Ana sayfa toplamları | — · ekranda 450 kcal, P 33 / K 30 / Y 19, "Bugün 450 kcal, hedef belirlenmedi" = log | — | — | — |
| 10 | Su | E2E'de satır yok (`su_takibi` açık ama sunucu su hedefi RPC'si E2E'de null → satır gizli). Bileşen testi: `water_add{ml:250,total_ml:250,undo:false}` tam 1 | ✓ | ✓ (test) | yok |
| 11 | Etkinlik ekle (Koşu 30 dk, ~343 kcal) | `activity_add{type:kosu,minutes:30,undo:false}` | ✓ | ✓ | yok |
| 12 | Seri | `streak_day{days:1}` (adım 7'de, günde bir kez anahtarlı) | ✓ | ✓ | yok |
| 13 | Keşfet paylaş (sistem paylaşım sayfası → Kopyala) | `share{target:post,surface:kesfet}` | ✓ | ✓ | yok (gönderi/kullanıcı kimliği yok) |
| 14 | Keşfet'ten logla | düzeltmeden önce `log_add{source:manual,kcal:0}` ✗ → sonra `log_add{source:kesfet,slot:lunch,kcal:540,offline:false}` | ✓ | ✓ | yok |
| 15 | eatkcal il kapısı (İzmir) → adres → geri → eatkcal ana sayfa | — | — | — | — |
| 16 | Mağaza → ürün (FinEkProduct, 405 TL) | `product_view{product_id:6,product_name:…,price:405,category:Yüksek Protein,brand:kcalculate}` | ✓ | ✓ | yok (katalog adı) |
| 17 | Sepete ekle → "Sepete git" | `add_to_cart{product_id:6,price:405,quantity:1,brand,category}` · `cart_view{item_count:1,ui:ek_v2}` | ✓ ✓ | ✓ ✓ | yok |
| 18 | Özet (FinEkCheckout) — "Öde 405 TL" PASİF | — (`begin_checkout` Öde basılınca; sipariş verilmedi) | — | — | — |
| 19 | Özetten sepete geri | `cart_view` (her görüntüleme 1) | ✓ | ✓ | yok |
| 20 | eatkcal ana sayfa | lime "Sepet (1) · 405 TL · Sepete git" çubuğu | — | — | — |

Notlar: (a) E2E'de `signup/login` yok — `identifyUser` gerçek AuthContext SIGNED_IN'de; E2E `AuthContextForDev` kullanır (G19-S3 bileşen testleri kapsar). (b) Olay satırları Metro'da async sırayla görünür (`created_at` çağrı anında alınır, DB sırası doğru). (c) `scan_open`/`scan_capture` adları Metro'da prop'ları sözlük süzgecinden geçmiş hâliyle; beyaz liste dışı anahtar görülmedi. (d) Keşfet toast'ının kendi "Geri al"ı simülatör dokunuşuyla tetiklenemedi (kabuk toast'ı aynı yerde, üstte) → `log_delete{kesfet}` statik testle kanıtlı; bkz. SORULAR 4.

## KARAR
1. **Kanonik adlar G19-S3 sözlüğü**: istemci scan_capture/scan_fail/scan_log/log_add/water_add/activity_add yazar; D-S1 adları (scan_start, scan_failed, log_meal, log_water, log_activity) yalnız sözlükte `aliasOf`. Canlı sunucu sözlüğü (G19-S3 migration, canlıda) bütün adları içeriyor (metricsDictionary testi).
2. **log_add kaynağı tek yer**: Tara (`scanTrack.trackScanLog`, eski + yeni kabuk + kuyruk) ve Keşfet (`KesfetScreen.logMeal`) kendisi gönderir; logFlight köprüsü `scan`/`kesfet` kaynaklı uçuşları saymaz (uçuş yalnız çerçeve varken / yalnız yeni kabukta yayınlandığı için köprü eksik sayıyordu). Köprü gelecekteki kaynaklar (eatkcal) için kalır.
3. **Yeni kabuk / eski kabuk**: aynı eylemde yeni kabuk dalında G19-S2 `trackEvent` (zengin prop'lar), eski kabuk dalında G19-S3 `track` — ikisi aynı dalda hiç yok (statik test).
4. **Acil kapatma metni**: verilen cümle başlıkta tek cümle; gövde yalnız alternatif ("Bu arada elle girebilirsin." / "You can enter it manually meanwhile."). Eski kabukta Alert aynı iki anahtar.
5. **Meta rıza varsayılanı DOKUNULMADI** (İlter kararı bekliyor). Değişiklik tek satır: `src/lib/metrics/consent.ts` › `metaAllowed` başına `if (s.adConsent === 'unset') return false;` (etkisi: rıza ekranı gelene kadar Android'de ve iOS ATT granted'da Meta ölçümü durur).
6. **Elle eklenen besinde P/K/Y alanları DOKUNULMADI** (Design onayı / Tur 26f). Hesap (G19-S1 `manualRow`) hazır.
7. **E2E harness**: dev kökünde Meta reklam rızası `denied`, birinci taraf ölçüm fetch kesildikten sonra açık. Simülatör deposuna (yalnız bu test cihazı) `@kcal_consent_first_party=0`, `@kcal_consent_ads=denied` yazıldı → bu simülatörde normal soğuk açılış canlıya olay göndermez.
8. **iOS dev derlemesi yapılmadı**: boş disk 10–13 GB (kural ≥ 20 GB). Simülatörde mevcut dev client (expo-camera var, expo-image-manipulator YOK → korumalı yol, foto aynen) kullanıldı.

## CANLIYA UYGULANACAK
Bu oturum yeni migration YAZMADI. Görev başlığına göre D-S1, G19-S1, G19-S2, G19-S3 migration'ları canlıda. Sözlük prop değişiklikleri yalnız istemcide (sunucu sözlüğü ad bazlı, yeni ad yok). Dosya sırası (referans): `20261109100100/100200/100300` (D-S1) → `20261109110000` (G19-S3) → `20261109190100` (G19-S1) → `20261109200100` (G19-S2). Backend dosyaları (`supabase/`) main'e cherry-pick İlter onayıyla (CLAUDE.md).

## DEPLOY GEREKİR
- Edge function: bu oturumda değişiklik yok (analyze-ai-scan / adisyo-* / order-alert canlıda).
- Uygulama: aşağıdaki OTA / derleme ayrımı. `eas update --channel production` ve production build onaysız YASAK — yapılmadı.

## OTA ile gidenler / YENİ DERLEME GEREKENLER
**OTA (JS) ile gidebilir:** G19-S1 Tara istemci düzeltmeleri (kilitler, Tekrar dene, orphan sonuç, kayıt hatası toast'ı, sayaç, gece yarısı, 5 MB ön kontrol, kuyruk, galeri izinsiz, acil kapatma durumu + bu oturumun metni) · G19-S2 takip (İstanbul gün sınırı, toplamlar, geri al, öğün taşı, çevrimdışı kuyruk, su/etkinlik sınırları, seri/kutlama, yerel hatırlatma — `ogun_hatirlatma` bayrağı kapalı) · G19-S3 ölçüm istemcisi (track, kuyruk, kaynak takibi, rıza) · bu oturumun çift olay temizliği ve Keşfet olay düzeltmesi. Hepsi bayrak arkasında / mevcut native modüllerle (netinfo, expo-linking, tracking-transparency, fbsdk, expo-notifications, expo-crypto zaten derlemede).
**YENİ DERLEME GEREKENLER (native):**
1. **iOS kamera / foto izin metni** (`NSCameraUsageDescription`, `NSPhotoLibraryUsageDescription` — Tara'yı anıyor; prebuild Info.plist'te doğrulandı). App Store 5.1.1.
2. **`expo-image-manipulator ~14.0.8`** (G19-S1, İlter onayı): uzun kenar ≤ 1600. Eski derlemede/OTA'da korumalı yol (foto aynen, 5 MB ön kontrol). Derlemeden önce `npm ci` (package-lock güncel).
3. `l.eatkcal.com` `/k/`, `/s/` bağlantılarının uygulamayı açması (associatedDomains / intentFilters) — G19-S3 notu.
4. `min_app_version` (ai_tarama) = bu derleme: eski istemci `reason:'disabled'` yanıtını "hakkını kullandın" diye gösterir (G19-S1).

## Kontroller (md.5)
| Kontrol | Sonuç |
|---|---|
| `tsc --noEmit` | 0 hata |
| `npm run test:unit` | 820 · 819 ✓ · 0 ✗ · 1 atlandı (tabandaki) — `noLegacyWhenFlagsOn` (Eski tasarım: 0), `i18nKeys` (TR/EN eksik 0), ORTAK #12 "₺" = 0, metricsDictionary, g19s4SingleEvent dahil |
| `jest` (bileşen) | 41 takım · 235 ✓ · snapshot 2/2 (`ScanScreen.flagParity`, `TrackerScreen.flagOff` — bayrak kapalı parite) |
| `npm run hygiene` | OK |
| "₺" grep (src + App.tsx, testler hariç) | 4 eşleşme, hepsi yorum; arayüz 0 |
| prebuild iOS / Android (`--no-install --clean`) | ✓ / ✓ (`ios/`, `android/` .gitignore'da) |
| `expo export` iOS / Android | ✓ 10,3 MB / ✓ 10,3 MB (çıktı iş geçici dizininde) |
| Üretim paketinde E2E kökü | yok (`E2ERoot` 0, `yeni-hesap` 0) |
| iOS dev derlemesi + kareler | YAPILMADI — disk 10–13 GB < 20 GB; kareler mevcut dev client ile (akis.jpg) |

Eski tasarım: 0

## SORULAR
1. **Simülatörden canlıya olası 6 anonim olay (kontrol edilmeli):** E2E koşu 1 ve 2'de uygulama E2E köküne geçmeden önce normal soğuk açılışla açıldı ve `welcome_view`, `first_touch{source:direct}`, `app_open{cold,first}` olaylarını kuyruğa aldı (iki kez → en çok 6 satır, `user_id` NULL, platform ios, 9 Kas ~11:35–11:47 UTC). Kuyruk sonra boş bulundu ama canlıya mı yoksa E2E bellek tablosuna mı gittiği bilinmiyor (canlı okuma bu oturumda reddedildi). Koşu 3'te bu yol kapatıldı (KARAR 7). Kontrol: `select event_name, count(*) from analytics_events where user_id is null and platform='ios' and created_at between '2026-11-09 11:30+00' and '2026-11-09 11:50+00' group by 1;` — varsa test satırı olarak silinebilir (İlter onayıyla).
2. **Meta rıza varsayılanı** (KVKK): `consent.ts` tek satır (KARAR 5) — İlter kararı.
3. **Elle eklenen besinde P/K/Y alanları**: Design onayı (Tur 26f) bekliyor; hesap hazır.
4. **Keşfet'te iki toast üst üste**: logla sonrası kabuk toast'ı ("Öğle loglandı · Geri al · Gör") ile Keşfet toast'ı aynı yerde. Kabuk toast'ının "Geri al"ı yalnız rozeti azaltıyor, kaydı SİLMİYOR (öncesinden var; artık yanlış `log_delete` de göndermiyor). Kabuk toast'ı Keşfet/Tara kayıtlarında gerçekten geri alsın mı (uçuşa `id` + kaynak silme), yoksa Keşfet'te kabuk toast'ı gizlensin mi? Tasarım kararı → dokunulmadı.
5. **"Tara şu an kullanılamıyor" panosu**: Final'de yok (G19-S1 SORULAR 2) — Tur 26f'ye eklensin mi? Bu oturum yalnız metni değiştirdi.
6. **Simülatör klonu**: `simctl clone` ile oluşturulan "G19-4 iPhone" uygulama verisini G19-1 aygıt dizininde (`185C6603…`) tutuyor (CoreSimulator davranışı). G19-1 oturumu bitmişti; yalnız uygulama yerel deposu değişti (KARAR 7 rıza anahtarları). İstenirse iki simülatör silinebilir.
7. **iOS dev derlemesi**: disk yetersiz (10 GB boş). İlter EAS ile derler; derlemede kontrol: izin metni, image-manipulator (uzun kenar 1600), Tara canlı kamera.
8. G19-S2 SORULAR 2–7 ve G19-S3 SORULAR 2–5 açık (bu oturum kapsamı dışında, birleştirmede değişmedi).
