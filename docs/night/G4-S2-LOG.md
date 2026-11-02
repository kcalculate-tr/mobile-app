# G4-S2 — LOG

## Özet (10 satır)
1. **Ne yapıldı:** Dalga dalga yayın + kullanıcı bazlı kilit için özellik bayrağı altyapısı kuruldu (yalnız ALTYAPI; hiçbir canlı ekran bir bayrağa bağlanmadı).
2. **Sunucu (dosya, UYGULANMADI):** `feature_flags`, `user_feature_unlocks` tabloları + RLS (authenticated salt-okur, kendi kilitleri) + `get_my_features(app_version, platform)` RPC (security definer).
3. **İstemci:** `src/core/flags/` — registry (hepsi `false`), FNV-1a rollout (sunucuyla parite), saf `resolve`, AsyncStorage önbellek, `__DEV__` override, `FlagsProvider` + `useFeature`.
4. **Kök:** `FlagsProvider` App köküne (AuthProvider içine) eklendi; hiçbir ekran `useFeature` çağırmıyor → davranış değişmedi.
5. **Tanı:** DevDiagnostics ekranına yalnız `__DEV__` "Bayraklar" listesi + yerel override eklendi.
6. **Parite kanıtı:** `kesfet:3f8e…0001` → kova **41** hem canlı Postgres (read-only) hem TS; birim testte sabit vektör.
7. **Kontroller:** `tsc --noEmit` = **0**; flags birim testleri **11/11 geçti**; `expo export --platform ios` = **OK** (6.54 MB bundle).
8. **Ne kaldı:** Migration staging/canlıda **uygulanmadı** (gece kuralı). Dalga planı KARAR değil SORU olarak bırakıldı (bkz. G4-S2-FLAGS.md).
9. **Dal:** `night4/feature-flags` (worktree `.claude/worktrees/g4-s2`), `feat/social-login`'den. Commit edildi, PR açılmadı.
10. **İlter sabah:** (a) dalga planı sorularını yanıtla, (b) migration'ı staging'de test edip uygula, (c) ilk bayrağı hangi ekrana bağlayacağına karar ver.

---

## Yapılanlar (ayrıntı)

### 1. Mevcut durum taraması
- Repoda bayrak/remote-config sistemi **yok** (`grep` temiz, `src/core/flags` yoktu).
- Canlı DB'de (`supabase-prod`, read-only) ayar benzeri tablolar: `settings` (id=1
  singleton — `min_supported_version`, `macro_*`, çalışma saatleri...) ve
  `delivery_settings`. **`settings` sabit-kolonlu mağaza ayarı**, anahtar-bazlı bir
  bayrak kaydı değil → genişletmek yerine ayrı `feature_flags` kuruldu (ikinci genel
  ayar sistemi değil, bayrağa özel). Gerekçe G4-S2-FLAGS.md'de.

### 2. Migration (DOSYA — UYGULANMADI, staging'de test EDİLMEDİ)
- `supabase/migrations/20261103000500_feature_flags.sql` + `_rollback.sql`.
- `feature_flags(key PK, enabled, rollout_percent 0–100, min_app_version, platforms[], description, updated_at)`.
- `user_feature_unlocks(user_id→auth.users, flag_key→feature_flags, unlocked_at, source[manual|referral|streak|promo], PK(user_id,flag_key))`.
- RLS: authenticated yalnız `feature_flags` SELECT + yalnız kendi `user_feature_unlocks` SELECT. Yazma politikası yok (service_role). anon yok.
- `get_my_features(p_app_version, p_platform)` → `{ key: bool }`, security definer,
  `set search_path = public`, yalnız authenticated grant. Yardımcılar:
  `_ff_fnv1a_bucket` (FNV-1a) ve `_ff_version_gte` (semver).
- Not: `get_my_features` görev dosyasında argümansız yazılıydı; sürüm/platform uyumunu
  değerlendirebilmek için istemciden bu ikisini **opsiyonel parametre** olarak alıyor
  (varsayılan null; kısıt varken bilgi yoksa güvenli tarafta kapalı).

### 3. İstemci `src/core/flags/`
- `registry.ts` — `FLAG_DEFAULTS` (8 anahtar, hepsi `false`), `FLAG_KEYS`, `defaultFlags()`.
- `rollout.ts` — `fnv1aBucket`/`rolloutBucket`/`inRollout`; sunucudaki `_ff_fnv1a_bucket` ile birebir.
- `resolve.ts` — saf `mergeFlags(remote, overrides)` / `flagValue(...)` (RN importu yok → test edilebilir).
- `storage.ts` — AsyncStorage önbellek (`read/write/clearCachedFlags`), hata asla sızmaz.
- `devOverrides.ts` — yalnız `__DEV__` override saklama.
- `FlagsProvider.tsx` — açılışı bekletmez (önce varsayılan/önbellekle render), giriş
  sonrası RPC, hata→önbellek/varsayılan, asla çökmez; `useFeature` + `useFlagsContext`.
- `App.tsx` — `FlagsProvider` AuthProvider içine, NavigationContainer'ı sarıyor.
- `DevDiagnosticsScreen.tsx` — `__DEV__` "Bayraklar" listesi + override döngüsü.

### 4. Testler (`src/core/flags/__tests__/flags.test.ts`)
- Varsayılan false; önbellek/sunucu birleşimi; bilinmeyen/boolean-olmayan yok sayma;
  override önceliği; RPC hatası→önbellek/varsayılan; rollout determinizmi; sunucu
  paritesi (sabit vektör 41); 0→kimse/100→herkes; eşik tutarlılığı; dağılım ~%50.
- Sonuç: **11/11 geçti**.

### 5. Kontroller
- `npx tsc --noEmit` → **0 hata**.
- `npx tsx --test` (flags) → **11/11**. Tüm suite: 260 geçti, 3 **önceden var olan**
  başarısızlık (`cardVerification`, `webviewResilience`, `checkoutScreenSafety`) —
  `feat/social-login` tabanında da aynen başarısız (0/3), bu oturumla ilgisiz
  (RN-bağımlı dosya yüklemesi tsx altında düşüyor).
- `npx expo export --platform ios` → **başarılı** (`EXPORT_OK`, 6.54 MB iOS bundle).

---

## SORULAR (karar İlter'de)

1. **Dalga planı** (G4-S2-FLAGS.md sonundaki taslak): 3 dalga ve içerikleri onaylanıyor mu?
   `eatkcal_ordering` bayrağa alınsın mı, yoksa canlı sipariş akışı dokunulmadan mı kalsın?
2. **Rollout birimi** yalnız kullanıcı-id hash'i; şube/bölge bazlı bir boyut gerekir mi?
3. **Migration uygulaması:** staging'de test + canlıya uygulama sırası ne zaman? (Bu gece uygulanmadı.)
4. **test:unit script'i** `tsx --test "src/**/__tests__/**/*.test.ts"` tırnaklı glob'u bu
   makinedeki tsx 4.23 ile genişlemiyor ("Could not find"); zsh genişletince çalışıyor.
   Script'i `node --test` uyumlu bir glob'a çevirmek ister misin? (Dokunmadım — mevcut davranış.)
