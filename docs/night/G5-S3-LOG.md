# G5-S3 — Mobil veri katmanı (Keşfet, profil/kayıt, Gün halkası, AI tarama, i18n)

## Özet (10 satır)
1. G5-S3.md'deki 8 maddenin tamamı `night5/feed-client` dalında işlendi (worktree `.claude/worktrees/g5-s3`, taban `night5/base`).
2. Kurulan: `src/modules/kesfet` (akış+store), `src/modules/gun`, `src/modules/profil` (handle+2 kayıt şablonu), `src/modules/ai/scan` (kota), `src/core/i18n` (TR/EN).
3. Bayraklar eklendi (registry): `kesfet, kesfet_takip, gun_halkasi, ai_tarama, restoran_yakinda, paylasim_karti` — hepsi **false**, hiçbir canlı ekrana bağlı değil.
4. İzin verilen İKİ paket kuruldu (madde 6, İlter onaylı): `expo-localization`, `i18n-js`. Başka paket YOK.
5. Hiçbir canlı/üretim ekranı davranışı değişmedi: UnifiedLoginScreen, Checkout, Cart, eatkcal ekranlarına **dokunulmadı**. Yeni mantık ayrı dosyalarda / bayrak arkasında.
6. Değişen mevcut dosyalar yalnız: `flags/registry.ts` (uyuyan anahtarlar), `AppNavigator`+`navigation/types` (sadece `__DEV__` koşullu ekran), `DesignShowcaseScreen` (yalnız `__DEV__` vitrin satırı), `modules/ai/index.ts` (export).
7. `__DEV__` deneme ekranı `FeedDataLabScreen` + vitrine "Keşfet ve profil (veri) →" satırı: mock/gerçek RPC toggle, TR/EN, dört modülün canlı denemesi.
8. Kontroller: **tsc 0**, **hygiene OK**, **334/334 birim test geçti**, **`expo export --platform ios` başarılı**.
9. Dal push edilmedi (RULES: PR yok). İlter sabah: `night5/feed-client` incele; nihai UI (Tasarım Turu 19) hazır olunca bu veri katmanına bağlanır; bayraklar o zaman açılır.
10. SORULAR aşağıda: sözleşmede olmayan 3 RPC adı (set_profile_privacy, check_delivery_city, analyze_ai_scan edge) ve claim_handle'ın canlı-kontrol semantiği S1/S2 onayı bekliyor.

## Yapılanlar (madde madde)

### Madde 5 — Bayraklar  · commit `38dd6e2`
`src/core/flags/registry.ts`'ye sözleşmedeki 6 anahtar `false` ile eklendi. `resolve`/`rollout` değişmedi; mevcut `discover` anahtarı korundu. Hiçbir `useFeature()` bağı yok → davranış değişmez.

### Madde 6 — i18n  · commit `5665ade` (paket) + `206e74d` (kod)
- `src/core/i18n/`: `core.ts` (saf `translate`+`formatNumber`, i18n-js; **native bağımlılık yok**, tsx test eder), `dictionaries.ts` (yalnız G5 modülleri TR/EN), `detect.ts` (expo-localization), `storage.ts` (AsyncStorage tercih), `I18nProvider`+`useT`.
- Varsayılan dil `tr`; EN eksikse TR'ye fallback; çoğul `{one,other}`; yerel sayı biçimi (TR `1.234,5` / EN `1,234.5`).
- Mevcut ekran metinlerine dokunulmadı.
- 9 birim test (`i18n.test.ts`).

### Madde 2 — Keşfet  · commit `341d25e`
- `types.ts` (FeedPost/MealCard/KesfetClient — sözleşme birebir), `client.ts` (get_feed/react_post/add_post_meal_to_day/report_content/block_user; **supabase tembel require** → modül import'u Node'da `window` aramasın), `store.ts` (zustand: sekme, imleç sayfalama, yenileme, iyimser beğen/kaydet + geri alma, idempotent "Günüme ekle"), `mock.ts`.
- "Günüme ekle": porsiyon + idempotency anahtarı → `add_post_meal_to_day`; eşzamanlı aynı anahtar tek RPC'ye indirgenir (çift dokunma koruması).
- 7 birim test (`store.test.ts`): sayfalama, sekme, iyimser geri alma, idempotency.

### Madde 3 — Gün halkası  · commit `8d34a68`
`get_day_rings` (ilk öğe "ben"), `get_day_cards` (erişim sunucuda 24 saat), `share_meal_to_day`. types+client (tembel supabase)+mock. 2 birim test.

### Madde 1 — Profil + iki kayıt şablonu  · commit `8f192e2`
- `handle.ts` (**saf** biçim doğrulama: küçük harf/rakam/_/., 3–20, başta/sonda nokta yok, ardışık nokta yok, rezerve adlar), `client.ts` (claim_handle, update_public_profile, get_public_profile, follow, respond_follow_request, set_privacy, check_delivery_city — tembel supabase), `mock.ts`.
- `useHandleClaim` (anlık biçim + debounce canlı benzersizlik), `useRegistration`:
  - (a) **Kcalculate AI**: ad + @handle; kalori/hedef **isteğe bağlı** ("Takibe başla" → çağıran NutritionProfile'a yönlendirir). `useFeature('kesfet')` arkasında.
  - (b) **eatkcal**: ilk siparişte şehir kapısı (`check_delivery_city`, yalnız İzmir); mevcut adres/telefon akışı KORUNUR. `useFeature('restoran_yakinda')` arkasında.
- **UnifiedLoginScreen ve checkout'a dokunulmadı.**
- 7 birim test (`profil.test.ts`): handle doğrulama + mock claim/follow(gizli→istek)/şehir kapısı.

### Madde 4 — AI tarama  · commit `0085440`
`runScan.ts` (saf orkestrasyon: `reserve_ai_scan` → analiz → başarısızsa `release_ai_scan`). Sonuç **her zaman "tahmin"** (`isEstimate`) ve porsiyon/malzeme kaydetmeden önce düzeltilebilir. Kota bitince `quota_exhausted` → barkod/elle giriş akışı etkilenmez. 4 birim test.

### Madde 7 — `__DEV__` deneme ekranı  · commit `1b9e678`
`FeedDataLabScreen` (mock/gerçek RPC toggle, TR/EN, Keşfet/profil/Gün/AI canlı denemesi). AppNavigator'da kayıt `__DEV__` koşullu; vitrine satır eklendi.

### Madde 8 — Testler
Toplam yeni test: i18n 9, kesfet 7, gun 2, ai 4, profil 7. Konular: store, iyimser geri alma, idempotency, kota iade, handle doğrulama, i18n geri dönüşü. **334/334 geçiyor.**

## Test sonuçları
- `npm run typecheck` (hygiene + tsc) → **0 hata** (640 dosya hygiene OK).
- `npm run test:unit` → **tests 334 / pass 334 / fail 0**.
- `npx expo export --platform ios` → **başarılı** (iOS bundle üretildi, hata yok).

## Mimari not — supabase tembel yükleme
Tüm modül istemcileri `core/supabase`'i **üst düzeyde import etmez**; her RPC metodu içinde tembel `require` ile çağırır. Neden: `core/supabase` modülü yüklenince Supabase istemcisi kurulur ve Node (`tsx --test`) ortamında oturum yenileme `window` arar → testler patlardı. İstemci enjeksiyonu (`setXClient`) ile testler ve `__DEV__` ekranı mock kullanır; üretimde varsayılan gerçek RPC.

## SORULAR (S1/S2 onayı bekliyor — bekletilmedi, sıradaki maddeye geçildi)
1. **Gizli/açık hesap RPC'si**: Sözleşmede `update_public_profile` yalnız (display_name, bio, avatar_url) alıyor; `is_private` için ayrı RPC gerekiyor. `set_profile_privacy(p_is_private bool)` **varsayıldı** (`profil/client.ts`). Kesin ad?
2. **eatkcal şehir kapısı RPC'si**: `check_delivery_city(p_city text) → {ok, reason}` **varsayıldı**. Sözleşmede imza yok; S2 kesin imzayı versin.
3. **AI analiz adımı**: `reserve/release_ai_scan` var ama görsel→besin analiz adımının edge fonksiyonu adı yok. `analyze_ai_scan` (functions.invoke) **varsayıldı** (`ai/scan/client.ts`).
4. **claim_handle semantiği**: Canlı benzersizlik için salt-okunur bir `check_handle(p_handle)` ideal; `claim_handle` adayı REZERVE ediyorsa debounce'lu canlı kontrol gereksiz rezervasyon yapar. S2: `claim_handle` idempotent/salt-kontrol mı, yoksa ayrı check RPC mi gerekiyor?
5. **Kayıt bayrakları eşlemesi**: (a) AI profili `kesfet`, (b) eatkcal kapısı `restoran_yakinda` bayrağına bağlandı (sözleşme kayıt için ayrı bayrak tanımlamıyor). Farklı istenirse `useRegistration.ts`'de tek satır değişir.

## İlter sabah yapması gerekenler
- `night5/feed-client` dalını incele (8 commit, 40 dosya, +2522). Push/PR YOK (RULES).
- Yukarıdaki 5 SORU'ya S1/S2 ile karar ver; gerekirse RPC adlarını `*/client.ts`'de güncelle.
- Nihai UI (Tasarım Turu 19) hazır olunca ekranları bu veri katmanına bağla; bayrakları (feature_flags tablosu) kademeli aç. **Hiçbir bayrak şu an açık değil.**
- Simülatörde denemek için: `__DEV__` build → Tanı/Profil üzerinden Tasarım vitrini → "Keşfet ve profil (veri) →".

## Dal
`night5/feed-client` — taban `night5/base`. Worktree: `.claude/worktrees/g5-s3`. Commit'ler: `5665ade 38dd6e2 206e74d 341d25e 8d34a68 0085440 8f192e2 1b9e678`.
