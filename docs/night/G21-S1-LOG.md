# G21-S1 — Kalan uygulama boşlukları + uçtan uca akış denetimi · LOG (10 Kas)
Dal `night21/fix` (taban `night20/fix` @ 0d3aad2) · worktree `.claude/worktrees/g21-s1`. Boş disk 28 GB.
Çalışma: ana oturum md.1/3/4/5/6 + devredilen bağlantı hataları + kontroller; md.2, md.9, md.10, md.8 dört paralel
alt oturumda (aynı worktree, yol sınırlı commit). Canlıya dokunulmadı; migration yalnız DOSYA.

## ÖZET (10 satır)
1. md.1 Tur 26f cam nesneleri: FinOpen tabak → kase → halka merkezinde ALEV (1150–1400 ms); FinOnbAccount kase, FinOnbNotify kupa, FinTbAbout alev, FinHomeXL boş gün kase. Halka merkezi alev (FinHomeR3/FinMoFocus) ve kutlama kupa/kase zaten doğruydu — testle sabitlendi.
2. md.2 Barkod → Open Food Facts: `fetch` (UA `Kcalculate/1.1.0 (support@eatkcal.com)`, 6 sn, 30 gün önbellek); mevcut sonuç düzeninin barkod kipi (ad/marka/100 g/porsiyon düzenlenir) → "Günüme ekle" `source=barcode`, AI hakkı yok, "Veri: Open Food Facts" (TR+EN); bulunamadı / kcal yok / zaman aşımı / çevrimdışı hâlleri; "Barkod yakında" kalktı; `barcode_*` olayları + source CHECK migration.
3. md.3 Tema telefonu izler: `userInterfaceStyle: 'automatic'` (kök/iOS/Android); `AppSchemeGate` yeni kabukta sistem teması + durum çubuğu `auto`; eski kabuk `forceScheme: 'light'` + `Appearance.setColorScheme('light')` (klavye/sistem sheet'leri dahil açık — parite). Yığın zemini koyu temada temadan.
4. md.4 Tek toast = kabuk toast'ı: Keşfet kendi log toast'ını göstermez, uçuş her yolda `id` + kaydı GERÇEKTEN silen `undo`; Tara uçuşları (foto, kuyruk, barkod) `id` + `undo` (`scanUndo.ts`); kabuk "Geri al" rozeti iki kez düşürüyordu → tek; konumsuz uçuş artık sol üstten uçmuyor.
5. md.5 Ana sayfa listesi `photo_path` seçer; silinip geri alınan kayıt fotoğraf yoluyla yeniden yazılır.
6. md.6 Öğün hatırlatma (10:30/14:30/21:00 + son 7 günde kayıt) "İlter onayı 10 Kas" → TAKIP_ACILIS + YAYIN_KONTROL; kod zaten bu kuralda.
7. md.9 Profil'in 18 alt sayfası sekme içi `setSub` yerine kök yığında `ProfileSub` (sağdan kayar 300 ms, kenar jesti, azaltılmışta 200 ms opaklık); bölüm sekmeleri (Keşfet Senin için/Takip, FinSegmented, açık profil, Macro, Destek) içerik + gösterge kayar.
8. md.10 Klavye kök nedeni: Modal içindeki ortak Sheet klavyeyi dinlemiyordu + absolute katmanlar KAV dolgusunu yok sayıyordu + Android'de davranış yoktu → ortak `useSheetKeyboard`/`KeyboardLiftView`; kupon, yorum, elle giriş, e-posta kodu, destek, Tara eksik ekle, Keşfet sheet'leri; Profil › Kuponlar kaydırılabilir.
9. md.8 Akış denetimi `docs/night/G21-AKIS.md`: 161 satır · 136 ✓ · 10 ✗ düzeltildi (testli) · 0 devredildi · 2 tasarım gerekir · 13 ⚠; 400+ gezinme hedefi kayıtlı, 1844 çeviri anahtarı TR+EN; geçiş + klavye sütunları; 34 simülatör karesi `docs/shots/g21/` (açık + koyu, TR + EN).
10. Kontroller: tsc 0 · hygiene ✓ · unit 909 (908 ✓, 1 atlandı — tabandaki, 0 ✗) · bileşen 56 takım / 327 ✓, snapshot 2/2 · expo export iOS ✓ / Android ✓ (14 MB) · "₺" yeni satırda 0 · Eski tasarım: 0 (noLegacyWhenFlagsOn ✓) · yeni metinler TR + EN.

## Commit tablosu
| Commit | Madde | İçerik |
|---|---|---|
| `a5030dd` | 1 | OpenSignature alev adımı (`OPEN_T.flameIn`), Onb/Takibe GLASS eşlemesi, HomeMealSlots kase; `g21Glass` |
| `215fa93` | 3 | app.config `automatic` ×3, `SchemeGate.tsx` + `schemePolicy.ts`, App.tsx; `schemePolicy` + `g21SchemeGate` |
| `fe6d6c7` | 4 · 5 | `scanUndo.ts`, pendingProcessor `rowId`, KesfetScreen tek toast, TabBarR3 (rozet tek düşüş, konumsuz uçuş), TrackerScreen `CONSUMED_SELECT` + photo_path; `scanUndo`, TabBarR3 testleri. (md.8'in TrackerScreen ve md.9'un KesfetScreen parçaları da diskteki hâliyle bu commit'e girdi — bağımlı dosyaları kendi commit'lerinde.) |
| `5b20aa1` | 6 | TAKIP_ACILIS + YAYIN_KONTROL karar notu |
| `b055b8f` | 8 | Ana sayfa zili → bildirimler, Keşfet şeridi → gönderi, PostCard/FinDetail yazar → açık profil, açık profil geri düğmesi, ScanLimitSheet koyu ikon, `usedKeysExist` |
| `838a979` | 9 | `transitions.ts`, `sectionSlide.tsx`, `ProfileSubRoute`, AppNavigator (ProfileSub, tema zemini), FinPrProfile/Macro/PublicPreview/Support; testler |
| `fafa889` | 10 | `useSheetKeyboard`, `KeyboardLiftView`, Sheet `scroll`, FinScreen klavye, 9 katman; `g21SheetKeyboard` (16) |
| `06c61c8` | 2 (+4) | `barcode/off.ts`, `FinBarcodeResult`, ScanScreen (md.4 satırları dahil), FinScanCamera/ErrorSheet, olaylar, sözlük, migration + rollback; `g21Barcode` (unit 11 + bileşen 6) |
| `8d7c90e` | 4 | consentFlagParity — tek toast artık kabuk toast'ı |
| `6d6bb66` | 8 | `G21-AKIS.md` ilk hâl |
| `c13727e` | 8 | Devredilenler #D1–#D5 (Keşfet yazar, Tara Elle gir, Takibe Atla, çıkış/silme sıfırlama, paylaşılan rota zemini); `g21Handoff` |
| `a174619` | 8 | G21-AKIS geçiş/klavye tabloları + 34 kare |
| (bu) | — | LOG |
| (son) | — | `docs/night/G21-S1-DONE` |

## KARAR
1. **Tek toast kabuk toast'ı** (görev metni): Keşfet kendi log toast'ını tamamen bıraktı; "Gör" artık kabuktan Ana sayfaya (önce Keşfet'in "Gör"ü yeni kabukta eatkcal sekmesine gidiyordu). Tara sonuç ekranındaki FinPhotoR1 toast'ı (Final panosu) kaldı — Tara açıkken kabuk toast'ı arkada; ekrandan "Geri al" kabuğa `logUndo` yayar, kabuktan "Geri al" ekran açıksa "kaydedildi"yi geri çevirir. Çift basış tek silme.
2. **Tema kapısı soğuk açılış bayrağıyla** (AppNavigator ile aynı kural): bayrak çözülmeden açık tema, native'e dokunulmaz; eski kabukta `Appearance.setColorScheme('light')`. Android `userInterfaceStyle` için `expo-system-ui` gerekir (yeni paket yasak) → Android'de tema JS kapısıyla çalışır (setColorScheme Android 10+'da AppCompat gece modunu ayarlar).
3. **Cam nesne yerleşimi**: yeni Final panosu render edilmediği için nesneler eski nesnenin yuvasına, yeni görselin en/boy oranıyla ortalandı (Account kase 140×104, Notify kupa 151×130, TbAbout alev 76×93, FinOpen alev 96×118 halka merkezinde). Yeni görsel yok (`assets/glass/*.png`).
4. **FinOpen sırası**: 900–1150 kase söner (standard), 1150–1400 alev belirir (enter) — halka dolumuyla aynı pencere; toplam süre değişmedi (2300 ms).
5. **Profil alt sayfaları tek `ProfileSub {sub}` rotası** (md.9): eski `ProfileCoupons/PersonalInfo/...` rotaları derin bağlantı için kayıtlı kalır; Profil satırları yalnız ProfileSub'a gider. Rota bayraktan bağımsız kayıtlı, bayrak kapalıyken hiçbir şey ona gitmez. Bölüm içeriği %30 genişlikten kayar (Final push "eski sayfa −%30").
6. **Klavye** (md.10): FinScreen iOS'ta ScrollView `automaticallyAdjustKeyboardInsets`, Android'de dolgu (çift boşluk yok); HomeManualMealSheet yükseklik sınırsız (içerik kaymıyor, kaydet düğmesi kesilmesin); eski kabuk sheet'leri değişmedi (parite).
7. **Barkod** (md.2): yalnız bulunan ürün önbelleğe girer (bulunamayan sonra OFF'a eklenebilir); zaman aşımı/ağ/5xx ayrı "Ürün bilgisi alınamadı" + Tekrar dene / Elle ekle; aynı kod 3 sn içinde ve hata sheet'i kapanınca hemen yok sayılır (döngü yok); barkod kaydı `log_add{source:barcode}` gönderir, `scan_log` göndermez.
8. **Çıkış / hesap silme sonrası** yığın oturumsuz soğuk açılış ekranına (`Onboarding` / `WelcomeGate`) sıfırlanır — yalnız yeni kabuk ekranlarında.
9. **Tara "Elle gir"** yeni kabukta Ana sayfa elle giriş sheet'ini açar; eski kabukta `goBack` (parite).
10. **Simülatör**: native derleme YAPILMADI (disk yeterliydi ama gerekmedi): vitrin temayı kendisi zorladığı için mevcut dev client ("G19-4 iPhone") + bu worktree'nin Metro'su ile açık/koyu kareler alındı.

## CANLIYA UYGULANACAK (UYGULANMADI — İlter onayıyla, sırayla)
1. `supabase/migrations/20261110000100_g21_s1_barcode.sql` — `meal_consumptions.source` CHECK'ine `barcode` (g7 listesi + canlıdaki mevcut değerler korunur) + `analytics_event_names`'e `barcode_scan`, `barcode_found`, `barcode_not_found`. Rollback `supabase/rollbacks/20261110000100_g21_s1_barcode_rollback.sql` (barkod satırı varsa `barcode`u kaldırmaz; veri silmez). **OTA'dan ÖNCE** uygulanmalı: yoksa barkod kaydı CHECK'e takılır ("Kaydedilemedi" toast'ı).
2. Backend dosyası (supabase/) main'e cherry-pick İlter onayıyla (CLAUDE.md).

## DEPLOY / OTA / YENİ DERLEME
- **YENİ DERLEME GEREKİR (md.3)**: `userInterfaceStyle: 'automatic'` Info.plist (`UIUserInterfaceStyle`) değişikliği — eski derlemede iOS uygulamayı açık temaya kilitler; OTA ile yeni kabuk koyu temaya geçmez (JS kapısı güvenli: eski derlemede her şey açık kalır, kırılma yok). EAS derlemesi İlter'de; production build onaysız YASAK — yapılmadı.
- **OTA (JS) ile gidebilir**: md.1, md.2 (migration'dan sonra), md.4, md.5, md.8 düzeltmeleri, md.9, md.10. `eas update --channel production` onaysız YASAK — yapılmadı.
- Edge function değişikliği yok. Yeni paket yok, yeni izin yok (kamera izni barkod için zaten vardı).

## Kontroller (md.7)
| Kontrol | Sonuç |
|---|---|
| `tsc --noEmit` | 0 hata |
| `npm run hygiene` | OK |
| `npm run test:unit` | 909 · 908 ✓ · 0 ✗ · 1 atlandı (tabandaki) — i18nKeys, usedKeysExist, noLegacyWhenFlagsOn (Eski tasarım: 0), noLocalMotionTokens dahil |
| `jest` (bileşen) | 56 takım · 327 ✓ · snapshot 2/2 |
| `expo export` iOS / Android | ✓ / ✓ (`EXPO_NO_DOTENV=1`, çıktı iş geçici dizininde, 14 MB) |
| "₺" (bu oturumda eklenen satırlar) | 0 |
| Yeni metinler | TR + EN (barkod, kaynak satırı, bulunamadı/alınamadı, geri) |

Yeni testler: `g21Glass` (6), `schemePolicy` (5), `g21SchemeGate` (3), `scanUndo` (7), TabBarR3 (+2), `g21Barcode` unit (11) + bileşen (6), `g21SheetKeyboard` (16), md.9 transitions/sectionSlide/ProfileSub (8 unit + 7 bileşen), md.8 `g21FlowLinks`/`g21AuthorLink`/`g21PublicProfileBack`/`usedKeysExist`, `g21Handoff` (5).

## SORULAR
1. **Klavye açık simülatör karesi alınamadı**: simülatörde donanım klavyesi bağlı, yazılım klavyesi çıkmıyor (Simulator ayarını değiştirmek kullanıcı tercihi → yapılmadı); sepet kupon sheet'inin vitrin girdisi de yok. Klavye davranışı 16 bileşen testiyle kanıtlı; gerçek Android cihazda (edge-to-edge) klavye konumu bir kez elle denenmeli.
2. **Barkod ve AI fotoğraf izni**: Tara açılınca AI fotoğraf izni sheet'i yine çıkıyor; Vazgeç diyen kullanıcı Elle gir'e gidiyor ve barkodu da kullanamıyor (barkod fotoğraf göndermez). İzin sheet'i yalnız fotoğraf çekiminde sorulsun mu?
3. **ODbL atıf metni** ("Veri: Open Food Facts") hukuki son okuma.
4. **Kuponlar bölüm sekmesi** içeriği kayan geçişe sarılmadı (yalnız gösterge kayar) — tek satırlık `SectionSlide` sarması istenirse.
5. **GunViewer** (Gün halkası görüntüleyici) hikâye kipi olduğundan modal-fade bırakıldı, sağdan kayan sayfaya çevrilmedi.
6. **Tasarım gerekir** (G21-AKIS #T1–#T4): Keşfet arama düğmesi hedefsiz; Keşfet "Günüme paylaş" eylemi boş; Apple/Google giriş hatası hâli yok; bildirim/takip hata hâli yok.
7. **Tara `photo_path` yazmıyor**: istemci ve edge function `photo_path` yazmıyor (yalnız RPC'ler okuyor) → md.5 düzeltmesi yolu olan kayıtlar için geçerli; Tara fotoğrafı kayda bağlansın mı (Storage + RLS) — ayrı iş.
8. **Paralel commit notu**: dört alt oturum aynı worktree'de yol sınırlı commit yaptı; bazı commit'ler başka oturumun diskteki parçalarını içerdi (commit tablosunda belirtildi). Ara commit'lerin bir kısmı tek başına derlenmeyebilir; dalın ucu (bu LOG) tam kontrollü.
9. **Android tema**: `expo-system-ui` olmadan Android `userInterfaceStyle` prebuild'de yok sayılır; tema JS kapısıyla çalışıyor. Yeni derlemede Android'de koyu tema bir kez kontrol edilmeli.
10. Simülatör "G19-4 iPhone" kullanıldı (dev client, Metro 8114) ve kapatıldı; uygulama yerel deposuna yalnız vitrin bekleyen pano anahtarı yazıldı. Canlıya olay gitmez (G19-S4 KARAR 7 rıza anahtarları bu cihazda kapalı).
