# G7-S1 — Sürüm dalı: arayüzleri birleştir + hataları kapat · LOG

## Özet (10 satır)
1. Dal `night7/release` (taban `night6/integration`), worktree `.claude/worktrees/g7-s1`.
2. Üç arayüz dalı sırayla birleştirildi: `night6/kesfet-ui` → `night6/gun-profil-ui` → `night6/eat-scan-ui`; her çakışmada iki taraf korundu, her merge sonrası tsc 0.
3. Bağlama: Keşfet'te gerçek `GunRingStrip` + `GunViewer` (gün görünümü + "Günüme ekle"); toast → `shareMealToDay`; `KcalAiSignUp.onDone` → Keşfet; `/u/:handle` → `PublicProfile`, `/p/:postId` → tek PostCard (`SharedPost` artık gerçek ekran, `get_post`); Tara "Paylaş" → Tabak Röntgeni (zaten bağlıydı).
4. İstemci hataları: tek `meal_type` eşlemesi (`src/core/meal/mealType.ts`, TR↔EN kod, test); tüm sunucu çağrılarında kullanıldı. AI tarama kaydı artık `source='ai_scan'`, `source_ref=<benzersiz tarama anahtarı>` (çakışma çözüldü). `I18nProvider` App.tsx köküne bağlandı.
5. Sunucu: `supabase/migrations/20261104001100_g7_fixes.sql` + rollback — `get_day_cards` (carbs_g/fat_g), `add_day_card_to_day`, `get_post`, `admin_set_creator/create_post/list_creators`, source CHECK `('manual','pantry','post','ai_scan','day_card')`, `creators.role`+`uretici`, `profiles_guard` (handle/is_private) + `claim_handle`/`set_profile_privacy` işlem-yerel `app.profile_rpc` bayrağı.
6. `profiles_social_columns.sql`'deki iki CHECK idempotent yapıldı (`do $$ if not exists`). `G6-APPLY.md`'ye #11 sırası + `user_nutrition_profiles` önkoşulu + `distinct source` uyarısı eklendi.
7. Bayrak kapalı güvenliği KODLA doğrulandı (aşağıda kontrol listesi): bayraklar `false` iken uygulama `main`/1.0.7 ile aynı. Tek dokunulan canlı ekran TrackerScreen (AI butonu yalnız `ai_tarama` açıkken); Home sarmalayıcı kapalıyken `<HomeScreen/>`; TabBar/Checkout/Cart/Login dokunulmadı.
8. Bayrak okuma doğrulandı: istemci `get_my_features` RPC'sinden okuyor; giriş yoksa/hata/çevrimdışı → tümü varsayılan `false` (fail-closed, `mergeFlags`).
9. `npx expo prebuild -p ios --no-install` worktree'de başarılı (associatedDomains `applinks:l.eatkcal.com` entitlements'a işlendi; ios/ gitignore'da, commit edilmedi).
10. Kontrol: **tsc 0**, **`npm run test:unit` 381/381** (+8 yeni mealType testi), **`npx expo export --platform ios` başarılı** (iOS bundle 8.19 MB). SORULAR aşağıda — hiçbiri teslimi bloklamıyor.

## Yapılanlar (madde madde)

### 1 — Merge (commit `58e1c54`, `6deb940`, `7b8b0d6`)
- `kesfet-ui`: temiz. `gun-profil-ui`: çakışmalar `profil/{client,mock,types,useHandleClaim}.ts` (CheckHandleResult vs HandleAvailability → tek tip + alias), `navigation/{AppNavigator,types}.ts` (iki taraf da korundu). `eat-scan-ui`: `flags/registry.ts` (paylasim_karti tek satır) + merge artefaktı çift `useFeature` import'u temizlendi.

### 2 — Bağlama (commit `ab0e34d`)
- **GunRingStrip/GunViewer**: `KesfetScreen` artık `modules/gun/ui`'den gerçek `GunRingStrip` kullanıyor; halkaya dokununca `GunViewer` açılıyor; "Günüme ekle" → `getGunClient().addDayCardToDay` (sunucu `add_day_card_to_day`).
- **Toast** → `shareMealToDay(consumptionId)` dışa açılan sarmalayıcı.
- **KcalAiSignUp.onDone** → `navigation.replace('Kesfet')` (ekran zaten yalnız `kesfet` açıkken açılır).
- **Derin bağlantı**: `linking.ts` `u/:handle`→`PublicProfile`, `p/:postId`→`SharedPost`. `SharedPostScreen` yeniden yazıldı: `get_post` ile çekip tek `PostCard` gösterir; erişilemezse hafif karşılama (uydurma veri yok). `get_post` istemci (client+mock) + `kesfet.share.*` i18n (TR/EN).
- **Tara "Paylaş"**: `ScanScreen` → `PlateXRayShareModal` (eat-scan-ui'de zaten bağlıydı, doğrulandı).

### 3 — İstemci hataları (commit `ab0e34d`)
- **meal_type**: `src/core/meal/mealType.ts` — `toServerMealType`/`toClientMealType` (breakfast↔kahvalti …), tanınmayan değere güvenli varsayılan, 8 test. Kullanım: `kesfet/client.addPostMealToDay`, `gun/client.addDayCardToDay` (gönderim) + `gun/client.getDayCards` (okuma), `ai/scan/saveEstimate` (gönderim).
- **AI tarama kaydı**: `saveEstimate` artık `source='ai_scan'`, `source_ref=<sourceRef>` (tarama idempotency anahtarı = benzersiz); `(user_id, source, source_ref)` UNIQUE çakışması çözüldü. `ScanScreen` anahtarı state'te tutup geçiriyor. Test güncellendi.
- **I18nProvider**: App.tsx'te `PortalProvider` altına eklendi. Cihaz dili algılanır + tercih AsyncStorage'dan yüklenir. Mevcut canlı ekranların hiçbiri `useT` kullanmıyor (doğrulandı) → metinleri değişmez; yalnız yeni (flag'li) ekranlar etkilenir.

### 4 — Sunucu migration (commit `cfa4512`)
- `20261104001100_g7_fixes.sql` (+ `supabase/rollbacks/...rollback.sql`). İçerik özet #5. `get_day_cards`/`claim_handle`/`set_profile_privacy`/`profiles_guard_protected_cols` gövdeleri canlıdaki (repo) son sürümden birebir alınıp YALNIZ eklendi.
- `profiles_social_columns.sql`: iki `add constraint` `do $$ ... if not exists ...` bloğuna alındı (dosya idempotent).
- `G6-APPLY.md`: #11 satırı + notlar (en son uygulanır; `user_nutrition_profiles` önkoşulu; `distinct source` uyarısı).

### 5 — Bayrak kapalı güvenliği (kontrol listesi, kodla doğrulandı)
| Alan | Durum (bayrak kapalı) | Kanıt |
|------|------------------------|-------|
| Tab bar | Dokunulmadı | `CustomTabBar.tsx` diff 0 (`night6/integration...HEAD`) |
| Home | `HomeTabScreen` → `restoran_yakinda` false ise `<HomeScreen/>` AYNEN | `AppNavigator.tsx:132-134`; HomeScreen `useNavigation` hook kullanır, prop beklemez |
| Tracker | "AI ile tara" yalnız `ai_tarama` açıkken render | `TrackerScreen.tsx:2017` `{aiTarama ? … : null}` |
| Kesfet | Stack yalnız `kesfet \|\| __DEV__` ile kayıtlı | `AppNavigator.tsx:286` |
| PublicProfile/KcalAiSignUp | Koşulsuz kayıtlı ama bayrak kapalıyken hiçbir yerden navigate edilmez (deep link yeni build gerektirir) | hiçbir aktif çağrı yok |
| Checkout/Cart/Login | Dokunulmadı | diff 0 |
| i18n | Additive; mevcut ekran `useT` kullanmaz | grep: yalnız yeni/flag'li ekranlar |

### 6 — Bayrak okuma (fail-closed)
`FlagsProvider` giriş sonrası `get_my_features(p_app_version, p_platform)` çağırır; hata/çevrimdışı/giriş yok → `mergeFlags(null)` = tüm varsayılanlar `false`. Sunucu yalnız tanınan anahtarları boolean ise uygular; bilinmeyen anahtar yok sayılır. `src/core/flags/{FlagsProvider,resolve,registry}.ts` + `flags.test.ts`.

### 7 — prebuild
`npx expo prebuild -p ios --no-install` → `Finished prebuild`. `ios/Kcalculate/Kcalculate.entitlements` içinde `applinks:l.eatkcal.com`. `ios/` gitignore'da; commit edilmedi.

## Kontrol sonuçları
- `npx tsc --noEmit` → 0 hata.
- `npm run test:unit` → tests 381, pass 381, fail 0 (+8 mealType testi; saveEstimate testi yeni imzaya güncellendi).
- `npx expo export --platform ios` → başarılı; iOS bundle (`index-*.hbc`, 8.19 MB) + metadata. Çıktı iş klasörüne yazıldı, repoya girmedi.
- `npx expo prebuild -p ios --no-install` → başarılı.

## SORULAR / Kararlar
1. **`meal_consumptions` mevcut `source` değerleri (KRİTİK, uygulama öncesi)**: G7 migration CHECK'i `('manual','pantry','post','ai_scan','day_card')` olarak yeniden kuruyor (görev metni). Repodaki tüm yazıcılar yalnız bu değerleri üretiyor; ancak S1-TRACKING_SCHEMA notu "manual/ai/order/barcode" diyor. **Uygulamadan ÖNCE** `select distinct source from public.meal_consumptions;` koş — küme dışı değer varsa #11'deki IN listesine ekle (yoksa ADD CONSTRAINT patlar). Prod okuma auto-mode'da reddedildiği için doğrulanamadı.
2. **`get_post` RPC'si**: Görev "tek PostCard gösteren ekran" istiyor ama G6-CONTRACT "G7 ekleri" listesinde bir okuma RPC'si yoktu. Ekranı beslemek için additive, salt-okur `get_post(p_post)` eklendi (get_feed ile aynı item şekli + aynı görünürlük süzgeci). Onaylanırsa feed_rls_test'e senaryo eklenebilir.
3. **`admin_create_post` + `p_meal_card={product_id}`**: p_meal_card jsonb olduğu gibi `posts.meal_card`'a yazılır; `product_id` verildiğinde sunucu `products`'tan ad/makro ÇÖZMÜYOR (panel `{name,kcal,…}` formunu kullanmalı ya da ayrı bir çözümleme RPC'si eklenmeli).
4. **`creators.role` + `uretici`**: admin_set_creator 'uretici' bekliyordu, `creators_role_check`'te yoktu → migration CHECK'i genişletti (geriye uyumlu superset).
5. Önceki gecelerin açık SORULARI (expo-clipboard, composer/expo-image-picker, branches.active kolonu) bu oturumda kapsam dışı; yeni paket/şema kararı İlter'e.

## İlter'in yapacakları

### A) Canlı DB uygulama sırası (elle, `supabase db push` DEĞİL — bkz. G6-APPLY.md)
1. `G6-APPLY.md` #0–#10'u sırayla uygula (zaten planlıydı).
2. **#11 EN SON**: önce `select distinct source from public.meal_consumptions;` (SORU 1) — küme dışı değer varsa `20261104001100_g7_fixes.sql`'deki source CHECK IN listesine ekle, sonra dosyayı uygula.
3. Önkoşul: `user_nutrition_profiles` tablosu canlıda mevcut olmalı (var).
4. Geri alma gerekirse: `supabase/rollbacks/20261104001100_g7_fixes_rollback.sql` (ezilen fonksiyonlar için ilgili önceki migration'lar yeniden koşulur — dosyada not var).

### B) Edge function (ayrı deploy, bu oturumda yapılmadı)
`supabase functions deploy analyze-ai-scan`. Secret'lar: `ANTHROPIC_API_KEY` (zorunlu), `AI_SCAN_MODEL` (geçerli canlı model kimliğine set et — dosyadaki `claude-haiku-5-5` yer tutucu). Bkz. G6-APPLY.md.

### C) Mağaza derlemesi / gönderim (ONAY GEREKTİRİR — bu oturumda yapılmadı)
- Universal Links'in çalışması için `l.eatkcal.com/.well-known/apple-app-site-association` (+ Android `assetlinks.json`) yayında olmalı; associatedDomains/intentFilters app.config.js'de hazır ama YENİ BUILD gerektirir (mevcut 1.0.7 cihazlarda deep link açılmaz).
- `eas build` → iç test → `eas submit` (App Store / Play). Bayraklar varsayılan KAPALI; mağaza sürümünde davranış 1.0.7 ile aynı. Dalga açılışı (`kesfet, gun_halkasi, ai_tarama, restoran_yakinda, paylasim_karti`) sunucudan (`feature_flags`) senin kararınla.

İlgili: [G6-S1-LOG.md](./G6-S1-LOG.md), [G6-APPLY.md](./G6-APPLY.md), [G6-S2/S3/S4-LOG.md].
