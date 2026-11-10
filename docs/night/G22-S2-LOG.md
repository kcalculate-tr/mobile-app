# G22-S2 — Akışkanlık ve cila · LOG (10 Kas)
Dal `night22/ux` (taban `night21/fix` @ 32e9e06) · worktree `.claude/worktrees/g22-s2`. Boş disk 18 GB.
Çalışma: ana oturum md.1/2/6/7/8/9; md.3, md.4, md.5 üç paralel alt ajanda (aynı worktree, commit'ler ana oturumdan,
yol sınırlı; ortak `dictionaries.ts` satır bazında seçilerek stage edildi). Canlıya dokunulmadı; migration yalnız DOSYA. Yeni paket yok
(`npm ci` yalnız mevcut lockfile'dan — worktree'de tam node_modules yoktu).

## ÖZET (10 satır)
1. md.1 Hareket +%10: süre bantları ×1,1 (100/200/300/500/900 → 110/220/330/550/990), push 300→330, yaylar stiffness ×0,9 + damping ×√0,9 (sönüm oranı ζ aynı → taşma artmaz: AI 234/22,77 · eatkcal 180/26,56 · bouncy 198/13,28), eğriler aynen; FinOpen çizelgesi ×1,1 (2300→2530); `WAIT` bekleme token'ları; ekranlardaki sabit ms'ler token'a bağlandı.
2. md.2 Sekme çubuğu: Ana sayfa/Keşfet/eatkcal/Profil yazıları kalktı (yalnız ikon), Tara yazısı kaldı; hücre `minWidth/minHeight 44` (≈70×62), VoiceOver etiketi TR/EN (`role=tab`, seçili durumu).
3. md.3 eatkcal konum Avrupa + Amerika: aranabilir ülke listesi (Türkiye ilk, il akışı AYNEN) + şehir araması (`search_cities` RPC, 20 sonuç, ada göre başlayan önce sonra nüfus); İzmir dışı seçim → "Çok yakında [şehir]'deki restoranlar burada listelenecek." + Restoranını ekle / Restoran öner (mevcut sheet'ler); GeoNames seed 109 ülke · 15.363 şehir; Sözleşmeler'de "Şehir verisi: GeoNames (CC BY 4.0)".
4. md.4 Keşfet arama = kişi + içerik (FinSearch): son aramalar (8, tek tek sil/Temizle), Kişiler · Gönderiler · Tarifler sekmeleri, boş / sonuç yok / hata + Tekrar dene; `search_profiles` + `search_posts(q, kind)` migration DOSYASI (definer, `search_path=''`, `feed_can_view_author` kuralı, iki yönlü engel hariç, yalnız authenticated).
5. md.5 G21 tasarım boşlukları: T2 FinShareDay (Keşfet'teki "Günüme paylaş" → paylaşım kartı sheet'i → mevcut `share_meal_to_day` ile Günüm halkasına → başarı toast'ı), T3 FinOnbAccountError (Apple/Google iptal sessiz; ağ/hesap hatası satır içi + Tekrar dene, aynı sağlayıcı), T4 FinNotificationsError (yüklenemedi + Tekrar dene, iskelet) + FinFollowError (iyimser takip, hata → geri alınır + "Takip edilemedi · Tekrar dene" toast'ı).
6. md.6 Dil seçici: Profil › Ayarlar › Dil → "Telefon dili" (varsayılan, en üstte) + bayraklı Türkçe / English (kendi adı + alt satırda İngilizce/Türkçe karşılığı, onay işareti); anında geçiş (I18nProvider yeniden çizer), kalıcı tercih ('system' dahil); `core/i18n/languages.ts` kayıt tablosu (yeni dil = sözlük + satır, OTA). Bayraklar yerel SVG (görsel/ağ yok), VoiceOver'dan gizli.
7. md.7 Açılış yüklemesi: Ana sayfanın ilk açılıştaki dönen göstergesi → FinMoLoad iskeleti; Final yolundaki tam ekran `ActivityIndicator`'lar (17 yer) → `FinListSkeleton` / `FinCardSkeleton` / `FinSkeletonBlock` (nabız story, azaltılmışta sabit, `role=progressbar`). Native splash hazır olana kadar (bayrak ≤ 2,5 sn) korunuyor — testle sabitlendi.
8. md.8 `get_anon_features` migration'ına dokunulmadı → CANLIYA UYGULANACAK listesinde.
9. Kontroller: tsc 0 · hygiene ✓ · unit 987 (986 ✓, 1 atlandı — tabandaki, 0 ✗) · bileşen 63 takım / 358 ✓, snapshot 2/2 · expo export iOS ✓ / Android ✓ (14 MB) · "₺" yeni satırda 0 · eski tasarım 0 (noLegacyWhenFlagsOn ✓) · sabit ms 0 (noLocalMotionTokens ✓) · TR+EN (i18nKeys/usedKeysExist ✓).
10. Apple HIG kod denetimi: Kritik yok; tek sapma ikon-yalnız sekmeler (İlter kararı, VoiceOver etiketiyle hafifletildi). Simülatör kareleri ALINMADI (boş disk 18 GB < 20 GB kuralı).

## Commit tablosu
| Commit | Madde | İçerik |
|---|---|---|
| `8c07490` | 1 | `motion.tsx` (bantlar, `MOTION_SOFTEN` + `softSpring`, `WAIT`, STAGGER token'a bağlı), `OPEN_T` ×1,1, TabBarR3 seçili hap `PREMIUM.tab.duration`, setTimeout'lar `WAIT.*`, `useSectionTransition` token; `motionScale` (6) + band testleri |
| `8466f95` | 2 | TabBarR3 sekme yazıları kalktı, `TAB_BAR_R3.MIN_TOUCH`; TabBarR3 bileşen testi (etiket yok + VoiceOver + ≥ 44) |
| `f659a89` | 6 | `languages.ts`, `storage.ts` ('system'), `I18nProvider` (`pref/setPref`, AppState ile cihaz dili), `LangFlag.tsx`, `SettingsLanguageScreen.tsx`, ProfileSub `language`; `languages` (7) + `g22LanguagePicker` (4) |
| `759dd5f` | 7 | `FinSkeleton.tsx`, TrackerScreen (yeni kabuk), Profil 9 sayfa, eatkcal v2 4 sayfa, GunEmpty, PostDetail, SharedPost; `noFullScreenSpinner` (3) + `g22Skeleton` (3) |
| `f532e09` | 3 | geo migration + rollback + 2 seed, `model/geo.ts`, `geoCountries.ts`, `useCitySearch.ts`, CityGateView, WaitlistFormSheet, Sözleşmeler atfı; `geo` (13) + `g22Geo` (3) |
| `65a025d` | 4 | search migration + rollback, `kesfet/search/*`, `SearchScreen.tsx`, rota `KesfetSearch`, Keşfet başlığı ara ikonu; `search` (15) + `SearchScreen` (7) |
| `37c4472` | 7 | EkAddCardScreen `authLoading` göstergesi geri (legacySwap bayt eşliği) |
| `3b0fef4` | 5 | `g26j.ts` sözlük, `shareDay.ts` + `ShareDaySheet`, `socialAuthError.ts` + `AuthAlert`, `NotificationsError`, `followOptimistic.ts`, AuthContext `errorCode`, OnboardingNavigator, NotificationsScreen, PublicProfile/PublicPreview, KesfetScreen, AddToast, `WAIT.actionToastHold`; unit 34 + bileşen 13 |
| (bu) | — | LOG |
| (son) | — | `docs/night/G22-S2-DONE` |

## KARAR
1. **Hareket ölçeği**: yalnız FinMoTokens bantları ve onlardan türeyenler ×1,1. Ölçeklenmeyenler: azaltılmış hareket 200 ms opaklık (Reduce Motion erişilebilirlik kuralı, "hareket" değil), toast/okuma tutma süreleri (4 sn, 2,2 sn — okuma süresi), `LEGACY_MOTION` (bayrak kapalı = 1.0.7 bayt bayt), ağ zaman aşımları/debounce'lar.
2. **Yay yumuşatma**: stiffness ×0,9 ve damping ×√0,9 — sönüm oranı korunur, böylece taşma artmaz, yalnız oturma ~%5 uzar (ω ∝ √k). Değerler `softSpring()` ile özgün FinMoTokens sayılarından hesaplanıyor (tek kaynak, test ζ farkı < 0,002).
3. **FinOpen**: kendi çizelgesi (`OPEN_T`) olduğu için ×1,1 uygulandı (toplam 2530 ms); azaltılmış/atla opaklığı 200 aynen.
4. **`WAIT` token'ları** (motion.tsx): logla izi örtüsü 1320, başarı mesajı sonrası kapanış 1320, hareket sonrası odak = base, ilk kare nefesi = story. Bayrak kapalı eski ekranlardaki (CheckoutScreen, NutritionProfileScreen) beklemeler DONUK.
5. **Sekme yazısı**: Large Content Viewer (iOS uzun basış) RN'de yok → VoiceOver etiketi tek erişilebilir ad. HIG `tab-bars.md` etiket öneriyor; İlter kararı uygulandı (bkz. SORULAR 1).
6. **Dil seçici**: yalnız etkin (`enabled`) + sözlüğü olan diller listede; hazırlıktaki dil görünmez. "Telefon dili" seçiliyken uygulama öne gelince cihaz dili yeniden okunur. İngilizce bayrağı 🇬🇧 (yerel SVG; ad her zaman metin).
7. **Tam ekran gösterge istisnaları** (testte sayıyla kayıtlı): ödeme/3DS İŞLEM adımları (EkPayment 2, EkAddCard 1 — "Ödeme hazırlanıyor/Doğrulanıyor" metinli süreç durumu; iskelet yanıltıcı) + EkAddCard `authLoading` (mantık bloğu eski AddCardScreen ile bayt bayt aynı olmak zorunda — legacySwap). Sheet içi küçük liste göstergeleri (InfoSheet ilçe listesi) ve düğme içi göstergeler kaldı.
8. **Bayrak kapalı (1.0.7) yol**: `src/screens/*`, `modules/eatkcal/screens/*` tam ekran göstergeleri DOKUNULMADI (bayrak kapalı = bugünkü uygulama). Liste aşağıda.
9. **md.3 (alt ajan)**: ülke listesi istemcide paketli (çevrimdışı); RPC yoksa/çevrimdışıyken yazılan adla devam edilebilir (migration uygulanmadan önce çıkmaz sokak olmasın); semt/tarihî yerleşimler (PPLX/PPLH/PPLQ/PPLW) seed dışı; Türkiye geo_countries'te ama şehirsiz (il akışı); Kıbrıs GeoNames'te AS → dışarıda; atıf "Hakkında" ekranı olmadığından Profil › Sözleşmeler altında. Türkçe ek yazıma göre ("Montréal'daki").
10. **md.4 (alt ajan)**: canlı şemada `recipes` tablosu yok → tarif = öğün kartlı gönderi (`post_type='ogun'` + `meal_card`); `search_posts(q, p_kind 'post'|'recipe')`. Profiller RLS'i yalnız kendi satırını okuttuğu için definer. Sorgu 2–64 karakter, baştaki `@` atılır, `\ % _` kaçışlanır, en çok 24 sonuç. Kişi → `PublicProfile`, gönderi/tarif → `SharedPost`.
11. **md.5 (alt ajan) paylaşım yolu**: "Paylaş" bugünün öğünleri için mevcut `share_meal_to_day` RPC'sini çağırır (`create_post` değil) — tasarım metni özetin Keşfet'in üstündeki "Günüm" halkasında göründüğünü söylüyor, halka bu paylaşımlardan okunuyor; RPC tekrar denemeye güvenli. Görünürlük / makro / not seçenekleri sunucuda saklanacak yer olmadığından `SHARE_DAY_SERVER_OPTIONS = false` arkasında gizli (yanıltıcı gizlilik seçimi göstermemek için); UI ve testleri hazır. Başarı toast'ında "Geri al" yok (geri alma RPC'si yok). Giriş yalnız Keşfet (tasarım sheet'i Keşfet üstünde gösteriyor). Takip düğmesi uygulamanın mevcut "Takiptesin" etiketini korur. Hata toast'ı 6 sn (`WAIT.actionToastHold`, okuma süresi — ekranda token aritmetiği kaldırıldı).

### md.7 — tam ekran `ActivityIndicator` listesi
Çevrildi (Final yolu → FinMoLoad iskeleti): `screens/TrackerScreen.tsx` (yeni kabuk ilk açılış + geçmiş yükleniyor) · Profil: `ProgressScreen`, `SettingsNotifyScreen`, `SettingsPersonalScreen`, `SettingsPrivacyScreen`, `FinPrCardsScreen`, `FinPrCouponsScreen`, `FinPrMacroScreen`, `FinPrMeasurementsScreen`, `FinPrReviewsScreen` · eatkcal v2: `EkAddressesScreen`, `EkSavedCardsScreen`, `EkAddressAddScreen` (harita yeri) · `gun/ui/GunEmpty` (sheet listesi) · `kesfet/ui/PostDetailScreen` · `screens/share/SharedPostScreen`.
Kaldı (istisna): `EkPaymentScreen` ×2 ve `EkAddCardScreen` ×2 (süreç / bayt eşliği) · düğme içi ve satır içi küçük göstergeler.
Bayrak kapalı yol (dokunulmadı): `screens/MacroScreen`, `OffersAndCouponsScreen`, `PersonalInfoScreen`, `CategoriesScreen`, `FeedbackScreen`, `DevDiagnosticsScreen`, `AddressesScreen`, `profile/OrderDetailScreen`, `profile/AddCardScreen`, `profile/OrdersScreen`, `profile/SavedCardsScreen`, `profile/SecurityScreen`, `profile/NotificationPreferencesScreen`, `tracker/NutritionProfileScreen`, `modules/eatkcal/screens/{Checkout,OrderSuccess,Payment}Screen`, `TrackerScreen` (eski kabuk dalı). `PublicProfileScreen` yüklenirken küçük gösterge kaldı (md.5 ajanının dosyası; bkz. SORULAR).

## CANLIYA UYGULANACAK (UYGULANMADI — İlter onayıyla, sırayla; hepsi rollback'li)
1. `20261109220100_g20_s3_anon_features.sql` — `get_anon_features` (G20-S3 dosyası, md.8: dokunulmadı). OTA'dan önce uygulanırsa yeni kurulumlar ilk açılışta doğru yola gider.
2. `20261110100100_g22_s2_geo.sql` → ardından seed SIRAYLA: `psql "$DB_URL" -v ON_ERROR_STOP=1 -f supabase/seed/geo_countries.sql` sonra `… -f supabase/seed/geo_cities.sql` (ikisi de idempotent, ON CONFLICT DO NOTHING; cities → countries FK). Doğrulama: `select count(*) from public.geo_countries` = 109, `geo_cities` = 15363, `select * from public.search_cities('sao pa')` → São Paulo. Geri alma: `supabase/rollbacks/20261110100100_g22_s2_geo_rollback.sql`. Yeniden üretim betiği: `build-geo.mjs` (oturum geçici dizini; mantık LOG'da: kıta EU/NA/SA, PPL/PPLA*/PPLC/PPLG/PPLS/PPLL/PPLF/PPLR).
3. `20261110100200_g22_s2_search.sql` — `search_profiles`, `search_posts`, `search_like_pattern`. Geri alma: `supabase/rollbacks/20261110100200_g22_s2_search_rollback.sql`.
(SQL yerelde çalıştırılmadı — yerel Postgres/Docker yok; dosya incelemesi + dosya testleri.)

## DEPLOY / OTA / YENİ DERLEME
- **OTA (JS) ile gidebilir**: bütün istemci değişiklikleri (hareket, sekme çubuğu, dil seçici, iskeletler, arama, konum, hata hâlleri). Yeni native modül/izin yok → yeni derleme GEREKMEZ. `eas update --channel production` onaysız YASAK — yapılmadı.
- Sıra önerisi: migration 2 ve 3 OTA'dan önce. Uygulanmadan OTA giderse: şehir araması "yüklenemedi + yazdığınla devam et" gösterir, Keşfet araması hata + Tekrar dene gösterir (çökme yok).
- Edge function değişikliği yok.

## Kontroller (md.9)
| Kontrol | Sonuç |
|---|---|
| tsc | 0 hata |
| hygiene | ✓ (1490 dosya) |
| unit (tsx) | 987 · 986 ✓ · 1 atlandı (taban) · 0 ✗ |
| bileşen (jest) | 63 takım · 358 ✓ · snapshot 2/2 |
| expo export | iOS ✓ · Android ✓ (14 MB) |
| TR + EN | yeni metinlerin hepsi iki dilde (i18nKeys, usedKeysExist, languages testi) |
| "₺" | yeni satırlarda 0 (yalnız yokluğunu doğrulayan test) |
| eski tasarım | 0 (noLegacyWhenFlagsOn; yeni rota `KesfetSearch` Final olarak kayıtlı) |
| token taraması | sabit ms 0 (noLocalMotionTokens + motionScale); bekleme süreleri `WAIT.*` |
| tam ekran gösterge | Final yolunda 0 (noFullScreenSpinner; istisnalar sayıyla kayıtlı) |
| Apple HIG | 44 pt ✓ · Dynamic Type ✓ · VoiceOver ✓ · Reduce Motion ✓ (aşağıda) |
| simülatör kareleri | ALINMADI — boş disk 18 GB < 20 GB |

Yeni testler: unit `motionScale` (6), `languages` (7), `noFullScreenSpinner` (3), `geo` (13), `search` (15), `shareDay` (12), `socialAuthError` (12), `followOptimistic` (10) · bileşen `g22LanguagePicker` (4), `g22Skeleton` (3), `g22Geo` (3), `SearchScreen` (7), `g22Gaps` (8), `g22FollowError` (2), `g22AuthAlert` (3), TabBarR3 (+2).

### Apple HIG kod denetimi (apple-design-skill, kod denetimi kipi)
Kapsam: TabBarR3 · SettingsLanguageScreen + LangFlag · FinSkeleton · Keşfet SearchScreen · eatkcal CityGateView. Sonuç: **İyi** (Kritik yok).

| Önem | Bulgu | Dayanak | Durum |
|---|---|---|---|
| Orta | Sekmeler yalnız ikon. HIG etiket öneriyor | `tab-bars.md › Best practices`: "Include tab labels to help with navigation." | İlter kararı (md.2). Hafifletme: her sekmede TR/EN `accessibilityLabel` + `role=tab` + `selected`; aktif sekme dolu ikon. RN'de Large Content Viewer (uzun basınca büyük etiket) yok → SORULAR |
| Geçti | Dokunma alanları ≥ 44 pt | `accessibility.md`: iOS varsayılan 44×44 pt | Sekme hücresi ≈ 70×62 (`minWidth/minHeight: 44`, testli). Dil satırı 60. Arama: temizle ve Takip et düğmeleri 44'lük dokunma kabında. Şehir hapı 36 + hitSlop 8 = 44 |
| Geçti | Yükleniyor hâli | `loading.md`: "Show something as soon as possible… consider showing placeholder…" | FinMoLoad iskeleti hemen çiziliyor. `role=progressbar` + "Yükleniyor/Loading". Azaltılmış harekette nabız yok |
| Geçti | Dil seçici VoiceOver | `accessibility.md` / `voiceover.md` | Bayrak süs olarak VoiceOver'dan gizli; dil adı her zaman metin; satırda `selected` durumu okunuyor; metin sarıyor (Dynamic Type'ta kırpılmıyor) |
| Düşük (yargı) | Dil için ülke bayrağı (English = 🇬🇧) | — (HIG sayfası yok, yargı) | İlter kararı; ad her zaman yazılı olduğundan anlam bayrağa bağlı değil |
| Geçti | Hareket | `motion.md` | Bütün geçişler token'dan; azaltılmışta 200 ms opaklık (REDUCED) |

## SORULAR
1. **Sekme yazıları**: HIG (`tab-bars.md › Best practices`) etiket öneriyor; yazılar İlter kararıyla kalktı. RN'de iOS Large Content Viewer yok — erişilebilirlik için yeterli mi, yoksa native modül (yeni derleme) ister misin?
2. **md.3 Rusya/Belarus**: GeoNames tüm Rusya'yı EU sayıyor → 980 Rus şehri (Sibirya dahil) listede. Kalsın mı, RU/BY çıkarılsın mı?
3. **md.3 Türkçe şehir adları**: "Münih" yazınca Munich bulunmuyor (GeoNames İngilizce/yerel ad). Türkçe alternatif adlar eklensin mi (seed büyür)?
4. **md.3 aynı adlı şehirler** (ABD'de çok sayıda Springfield) eyalet bilgisi olmadan ayırt edilemiyor — admin1 eklensin mi?
5. **md.3 Türkiye il listesindeki "Çok yakında"** bugünkü gibi kaldı ("Türkiye akışı AYNEN"). O da kalksın mı?
6. **md.4 sekme çubuğu**: tasarımda arama sonuçlarında sekme çubuğu görünüyor; arama kök yığına itilen rota olduğu için görünmüyor. Keşfet sekmesine gömülsün mü (navigatör değişikliği)?
7. **md.4 tarif hazırlık süresi** ("N dk" çipi) için veri yok (`meal_card`'da alan yok) → yalnız kcal + P çipleri.
8. **md.4 gizli hesaplar**: takip edilmeyen gizli hesaplar aramada çıkmıyor → aramadan takip isteği gönderilemiyor. Kabul mü?
9. **md.4 performans**: `ilike '%q%'` için trigram indeksi eklenmedi; veri büyürse `pg_trgm` GIN gerekir. Arama dile göre süzmüyor (akıştan farklı).
10. **Simülatör kareleri** (`docs/shots/g22/`) alınmadı: boş disk 18 GB < 20 GB kuralı.
11. **md.5 sunucu desteği**: gizli görünürlük / makro / not seçenekleri için `day_shares` kolonları + `share_day(p_consumptions, p_audience, p_show_macros, p_note)` RPC (ve `get_day_cards` bunlara uysun) eklensin mi? Paylaşımı geri alma RPC'si başarı toast'ına "Geri al" getirir.
12. **md.5 Ana sayfa girişi**: "Günüme paylaş" Ana sayfada da olsun mu (tasarımı yok)?
13. **md.5 takip etiketi**: uygulama genelinde "Takiptesin" → tasarımdaki "Takip ediliyor" olsun mu?
14. **md.7 PublicProfileScreen** yüklenirken küçük ortalanmış gösterge kaldı (md.5 aynı dosyada çalışıyordu; tarama "tam ekran" kalıbına girmiyor). Bir sonraki turda iskelete çevrilebilir.
