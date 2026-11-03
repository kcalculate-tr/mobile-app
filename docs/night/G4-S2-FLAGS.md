# G4-S2 — Özellik Bayrakları (Feature Flags) Altyapısı

Dalga dalga yayın + kullanıcı bazlı kilit açma için kurulmuş altyapı. **Bu
oturumda yalnız ALTYAPI kuruldu; hiçbir canlı ekran bir bayrağa bağlanmadı.**
Her bayrağın yerel varsayılanı `false` → davranış değişmez.

## Mimari (özet)

```
Sunucu (Postgres)                         İstemci (RN)
─────────────────                         ────────────
feature_flags (key, enabled,              src/core/flags/
  rollout_percent, min_app_version,         registry.ts   → FLAG_DEFAULTS (hepsi false)
  platforms, ...)                           rollout.ts    → FNV-1a kova (sunucuyla parite)
user_feature_unlocks (user_id,            resolve.ts    → mergeFlags / flagValue
  flag_key, source)                         storage.ts    → AsyncStorage önbellek
                                            devOverrides.ts → __DEV__ override
get_my_features(app_version, platform)      FlagsProvider → RPC + önbellek + render
  → { key: bool }  (security definer)       useFeature(key) → bool
```

- **Tek doğruluk kaynağı sunucudur.** `get_my_features()` her bayrağı çağıran
  kullanıcı için çözer (enabled + rollout + sürüm/platform + kullanıcı kilidi) ve
  `{ key: bool }` döner. İstemci bunu yalnız birleştirir ve önbellekler.
- **İstemci asla açılışı bekletmez, asla çökmez.** İlk render yerel
  varsayılanlarla (false) olur; giriş sonrası RPC gelince güncellenir;
  çevrimdışı/hata → önbellek, o da yoksa varsayılan.
- **İstemci yazamaz.** `feature_flags`/`user_feature_unlocks` yalnız okunur
  (RLS). Bayrak açmak = service_role / admin işi (SQL veya panel).

## Çözümleme kuralı (sunucu, `get_my_features`)

Bir bayrak bir kullanıcıya **açık** sayılır eğer:

```
( enabled
  AND  fnv1a32(key || ':' || user_id) % 100  <  rollout_percent
  AND  (min_app_version yok  VEYA  istemci_sürümü >= min_app_version)
  AND  (platforms yok        VEYA  istemci_platformu ∈ platforms) )
OR
exists(user_feature_unlocks: bu user + bu flag)   -- kullanıcı kilidi her şeyi ezer
```

- `rollout_percent = 0` → kimse; `= 100` → herkes. Kova deterministik: aynı
  kullanıcı aynı bayrakta hep aynı tarafta kalır (dalga büyüdükçe kimse düşmez).
- Sürüm/platform bilgisi istemciden gelir (`Constants.expoConfig.version`,
  `Platform.OS`). Gelmezse ve kısıt varsa **kapalı** kalır (eski istemcide yeni
  özelliği yanlışlıkla açmayız).
- **Parite:** `rollout.ts`'teki FNV-1a ile migration'daki `_ff_fnv1a_bucket`
  aynı algoritma; canlı DB'de doğrulandı (`kesfet:3f8e...0001` → kova **41**,
  hem SQL hem TS). Birim testte sabit vektör olarak kilitli.

## Yeni bayrak nasıl eklenir?

1. **İstemci:** `src/core/flags/registry.ts` → `FLAG_DEFAULTS`'a `false` ile ekle:
   ```ts
   export const FLAG_DEFAULTS = {
     ...,
     yeni_ozellik: false, // kısa açıklama
   } as const;
   ```
2. **Sunucu:** aynı `key` ile `feature_flags`'a satır ekle (aşağıdaki SQL).
3. Ekranı bağlarken: `const acik = useFeature('yeni_ozellik');` — `FlagsProvider`
   zaten App kökünde. (Bu oturumda hiçbir ekran bağlanmadı.)

> İstemci registry'sinde olmayan bir anahtar `useFeature` tarafından tanınmaz ve
> daima `false` döner (ileri-uyumlu: sunucu istemciden önde olabilir).

## Admin panelden / SQL ile bir bayrağı açmak

Admin UI henüz yok — şimdilik **SQL** (service_role bağlamı, Supabase Dashboard
SQL editor veya migration). Örnekler:

```sql
-- Bayrağı kaydet (ilk kez)
insert into public.feature_flags (key, description)
values ('discover', 'Keşfet akışı')
on conflict (key) do nothing;

-- Dalga 1: %10 iOS kullanıcısına aç
update public.feature_flags
set enabled = true, rollout_percent = 10, platforms = array['ios'],
    min_app_version = '1.1.0', updated_at = now()
where key = 'discover';

-- Dalgayı büyüt: %50
update public.feature_flags set rollout_percent = 50, updated_at = now()
where key = 'discover';

-- Tam açılış: herkese
update public.feature_flags
set rollout_percent = 100, platforms = null, updated_at = now()
where key = 'discover';

-- Tek kullanıcıya kilidi aç (rollout'tan bağımsız)
insert into public.user_feature_unlocks (user_id, flag_key, source)
values ('<user-uuid>', 'discover', 'promo')
on conflict (user_id, flag_key) do nothing;
```

> İstemci değeri AsyncStorage'da önbelleklenir; kullanıcı bir sonraki girişte /
> uygulama yeniden açılışında RPC'yi tekrar çağırıp günceller. Anında geri alma
> için `enabled=false` yeterli (önbellek sonraki çağrıda ezilir).

## __DEV__ geçersiz kılma (override)

Yalnız geliştirmede: **Tanı (DevDiagnostics)** ekranının altındaki
**"Bayraklar (__DEV__)"** listesinden her bayrağa dokunup
`override yok → açık → kapalı → yok` döngüsüyle yerel değeri zorlayabilirsin.
AsyncStorage'da bu cihaza özel saklanır; prod build'de bu kod yolu hiç çalışmaz.

## Dosyalar

| Dosya | Görev |
|---|---|
| `supabase/migrations/20261103000500_feature_flags.sql` | Tablolar, RLS, RPC, yardımcılar (UYGULANMADI) |
| `supabase/migrations/20261103000500_feature_flags_rollback.sql` | Geri alma (referans) |
| `src/core/flags/registry.ts` | Bayrak anahtarları + varsayılanlar (hepsi false) |
| `src/core/flags/rollout.ts` | FNV-1a kova (sunucu paritesi) |
| `src/core/flags/resolve.ts` | Saf birleştirme (`mergeFlags`/`flagValue`) |
| `src/core/flags/storage.ts` | AsyncStorage önbellek |
| `src/core/flags/devOverrides.ts` | __DEV__ override saklama |
| `src/core/flags/FlagsProvider.tsx` | Provider + `useFeature` + `useFlagsContext` |
| `src/core/flags/__tests__/flags.test.ts` | Birim testler |

---

## SORU — önerilen dalga planı (KARAR DEĞİL)

Aşağısı bir **taslak öneri**; İlter'in onayı/düzenlemesi gerekir. Mevcut planda
adı geçen özellikler için bir sıralama fikri:

**Dalga 1 — "Kcalculate AI çekirdeği"** (takip tarafı, siparişi hiç etkilemez):
`kcalculate_ai_tracking`, `log_meal`, `barcode_scan`
→ Önce iç ekip + %5–10, sorun yoksa büyüt.

**Dalga 2 — "Keşfet & koçluk"**:
`discover`, `ai_coach`, `inbox`
→ Dalga 1 oturduktan sonra; içerik/moderasyon hazırsa.

**Dalga 3 — "İnsan hizmetleri & sipariş köprüsü"**:
`dietitian`, `eatkcal_ordering`
→ `eatkcal_ordering` zaten canlı akışa dokunduğu için en temkinli dalga; ayrı
değerlendirilmeli (belki hiç bayrağa alınmaz, mevcut haliyle kalır).

**Cevap bekleyen sorular:**
1. Bu 3 dalga ve içerikleri doğru mu? `eatkcal_ordering` gerçekten bayrağa mı
   alınmalı yoksa dokunulmadan mı bırakılmalı (canlı sipariş)?
2. Rollout birimi kullanıcı mı olsun, yoksa şube/bölge bazlı bir boyut da
   gerekiyor mu? (Şu an yalnız kullanıcı-id hash'i.)
3. Kullanıcı kilidi kaynakları (`manual/referral/streak/promo`) yeterli mi,
   başka kaynak var mı?
