# G11-CANLI-SIRA — Yarın canlıya uygulama kontrol listesi (tek doküman)

Bu doküman `docs/night/G6-APPLY.md` #0–#16 sırasını canlıya uygulamak için tek
operatör kontrol listesidir. **`supabase db push` KULLANMA** — her dosya tek tek,
elle (Dashboard SQL editor veya `psql`), uyguladığını kendin takip et. Canlı
Supabase: `xtjakvinklthlvsfcncu`.

> **Not (bu gece):** Canlı okuma harness güvenlik sınıflandırıcısı tarafından
> bloklandı → aşağıdaki "zaten var mı?" sütunu DOSYA kaynağına göre çıkarımdır,
> canlı doğrulama DEĞİL. Her adımdan ÖNCE verilen salt-okur sorguyu koş; **var**
> çıkarsa o dosyayı atla (hepsi idempotent yazıldığından yeniden uygulamak da
> güvenli, ama gereksiz).

---

## (a) Canlı durum karşılaştırması — her nesne için salt-okur kanıt sorgusu

Önce toplu bir fotoğraf çek (hangi migration'lar zaten var):

```sql
-- #0–#16 ana nesnelerin varlığı (tek sorgu, kanıt tablosu)
select 'feature_flags'        as nesne, to_regclass('public.feature_flags')        is not null as var union all
select 'user_feature_unlocks',       to_regclass('public.user_feature_unlocks')   is not null union all
select 'profiles.handle (kolon)',    exists(select 1 from information_schema.columns where table_name='profiles' and column_name='handle') union all
select 'posts',                      to_regclass('public.posts')                  is not null union all
select 'post_media',                 to_regclass('public.post_media')             is not null union all
select 'post_comments',              to_regclass('public.post_comments')          is not null union all
select 'moderation_queue',           to_regclass('public.moderation_queue')       is not null union all
select 'content_reports',            to_regclass('public.content_reports')        is not null union all
select 'day_shares',                 to_regclass('public.day_shares')             is not null union all
select 'ai_scan_reservations',       to_regclass('public.ai_scan_reservations')   is not null union all
-- G11 (#16) nesneleri — uygulamadan ÖNCE hepsi YOK olmalı:
select 'fn handle_is_reserved',       exists(select 1 from pg_proc where proname='handle_is_reserved') union all
select 'fn update_my_post',           exists(select 1 from pg_proc where proname='update_my_post') union all
select 'fn search_products',          exists(select 1 from pg_proc where proname='search_products') union all
select 'fn admin_set_flag',           exists(select 1 from pg_proc where proname='admin_set_flag') union all
select 'feature_flag_audit',          to_regclass('public.feature_flag_audit')    is not null union all
select 'flag yeni_kabuk',             exists(select 1 from public.feature_flags where key='yeni_kabuk');
```

**#16 (G11) için özel ön kontroller** — uygulamadan önce bunlar canlıda OLMALI:

```sql
-- products kolon eşlemesi (search_products bunlara güvenir — CANLI DOĞRULA):
select column_name, data_type from information_schema.columns
 where table_schema='public' and table_name='products'
   and column_name in ('id','name','img','calories','protein','carbs','fats','is_available')
 order by column_name;
--   BEKLENEN: 8 satır. 'img'/'fats' adları repodan çıkarıldı (src/lib/categories.ts).
--   Canlıda farklıysa (örn. image_url / fat) search_products gövdesindeki kolon
--   adlarını DÜZELT, sonra uygula.

-- post-media storage politikaları (çift mi? #16 bunları teke indirir):
select policyname from pg_policies
 where schemaname='storage' and tablename='objects' and policyname like 'post_media_%'
 order by policyname;
--   BEKLENEN (uygulamadan önce, tam zincir sonrası): creator_insert/update/delete
--   + writer_insert/update/delete + read = 7. #16 sonrası: writer_* (3) + read = 4.

-- posts guard trigger'ı mevcut mu (#16 fonksiyonu create or replace ile ezer):
select tgname from pg_trigger where tgrelid='public.posts'::regclass and not tgisinternal;
--   BEKLENEN: posts_guard_protected_cols (G9'dan).

-- admin_allowlist deseni (admin RPC'leri buna bağlı):
select to_regclass('public.admin_allowlist') is not null as admin_allowlist_var;
```

---

## (b) Uygulama sırası + her adımdan sonra 1 doğrulama sorgusu

**Önce #0–#15'i `G6-APPLY.md` sırasıyla uygula** (bu doküman onları tekrarlamaz;
her birinin doğrulaması G6-APPLY'da). Aşağıdaki YALNIZ **#16 (bu gece eklenen)**
içindir ve **EN SON** uygulanır.

| Adım | Dosya | Uygula | Doğrulama sorgusu (sonra) |
|---|---|---|---|
| #16 | `supabase/migrations/20261105000300_g11_fixes.sql` | tek `begin…commit`, elle | aşağıdaki 7 doğrulama |

```sql
-- 1) Ayrılmış ad: rezerve reddi + noktalı türev serbest (biçim).
select public.handle_is_reserved('kcalculate') as reserved_true,   -- t
       public.handle_is_reserved('kcalofficial') as prefix_true,   -- t
       public.handle_is_reserved('kcal.official') as dotted_false; -- f

-- 2) Yetki sıkılaştırma: authenticated'ta truncate/trigger/references KALMADI.
select grantee, privilege_type, table_name
 from information_schema.role_table_grants
 where table_schema='public' and grantee in ('anon','authenticated')
   and privilege_type in ('TRUNCATE','TRIGGER','REFERENCES')
   and table_name in ('posts','post_media','post_comments','follows','day_shares',
                      'content_reports','moderation_queue','feature_flags');
--   BEKLENEN: 0 satır.

-- 3) post-media tek writer_* seti (creator_* kalkmış).
select policyname from pg_policies
 where schemaname='storage' and tablename='objects' and policyname like 'post_media_%'
 order by policyname;   -- BEKLENEN: read + writer_insert/update/delete (4), creator_* YOK.

-- 4) update_my_post + posts guard gövde dalı mevcut.
select exists(select 1 from pg_proc where proname='update_my_post') as fn_var;  -- t

-- 5) search_products dönüş şekli (boş girdi → { items: [] }).
select public.search_products('a') as bos,                      -- {"items":[]}
       jsonb_typeof((public.search_products('a'))->'items') as items_tipi; -- array

-- 6) Bayrak yönetimi + audit tablosu.
select exists(select 1 from pg_proc where proname='admin_set_flag') as set_flag_var,  -- t
       to_regclass('public.feature_flag_audit') is not null as audit_var;             -- t

-- 7) yeni_kabuk satırı doğru varsayılanlarla.
select key, enabled, rollout_percent, min_app_version
 from public.feature_flags where key='yeni_kabuk';
--   BEKLENEN: yeni_kabuk | f | 0 | 1.1.0
```

---

## (c) Edge function'lar (db push DEĞİL — ayrı deploy; İLTER çalıştırır)

Gizli DEĞERLER buraya YAZILMAZ — yalnız secret ADLARI. Deploy komutlarını İlter
çalıştırır (CLI ile; gece oturumu deploy ETMEDİ).

**`analyze-ai-scan`** (AI tabak tarama):
```
supabase functions deploy analyze-ai-scan
supabase secrets set ANTHROPIC_API_KEY=... AI_SCAN_MODEL=<geçerli-canlı-model-kimliği>
```
- Secret ADLARI: `ANTHROPIC_API_KEY` (zorunlu), `AI_SCAN_MODEL` (dosyadaki
  `claude-haiku-5-5` YER TUTUCU — geçerli canlı modele set EDİLMELİ).
  `SUPABASE_URL`/`ANON_KEY`/`SERVICE_ROLE_KEY` platformca sağlanır.
- Bağımlılık: #6 (`ai_scan_reservations`), #7 (`user-media` kovası), #10 (`consumed`).

**`moderate-content`** (Keşfet AI içerik denetimi):
```
supabase functions deploy moderate-content
supabase secrets set ANTHROPIC_API_KEY=... AI_MODERATION_MODEL=<geçerli-canlı-model-kimliği>
```
- Secret ADLARI: `ANTHROPIC_API_KEY` (zorunlu), `AI_MODERATION_MODEL` (dosyadaki
  `claude-haiku-5-5` YER TUTUCU — geçerli canlı modele set et).
- Bağımlılık: #12 (`moderation_queue`, `post-media` video politikası).

> G11 edge function EKLEMEDİ/DEĞİŞTİRMEDİ; bu blok G6-APPLY'dan taşınan hatırlatma.

---

## (d) `20261104002100_g8_moderation_cron` (#13) — ön koşullar ve EN SON mantığı

Cron, `moderate-content` edge fn'ini `service_role` ile çağırır → yalnız fonksiyon
deploy edildikten VE Vault'ta anahtar bulunduktan SONRA anlamlıdır.

Ön koşullar (uygulamadan önce doğrula):
```sql
select extname from pg_extension where extname in ('pg_cron','pg_net');          -- ikisi de olmalı
select exists(select 1 from vault.secrets where name='service_role_key') as var;  -- t olmalı
```
- `pg_cron` + `pg_net` kurulu olmalı; Vault'ta `service_role_key` bulunmalı
  (mevcut push altyapısı için zaten var).
- #13 **#12'den sonra** uygulanır. Bütün bayraklar KAPALI olduğundan #12/#13
  uygulansa da davranış değişmez. Cron yalnız `moderate-content` deploy edilince
  iş görür.

---

## (e) Geri alma sırası (gerekirse — TERS sıra, elle)

Her rollback dosyası `supabase/rollbacks/` altında, EN SON uygulananı İLK geri al:

```
#16 → supabase/rollbacks/20261105000300_g11_fixes_rollback.sql   (G11 — İLK geri al)
#15 → 20261105000200_g10_fixes_rollback.sql
#14 → 20261105000100_g9_fixes_rollback.sql
#13 → 20261104002100_g8_moderation_cron_rollback.sql
#12 → 20261104002000_g8_social_rollback.sql
#11 → 20261104001100_g7_fixes_rollback.sql
#10 → 20261104001000_g6_fixes_rollback.sql
#9  → 20261104000900_paylasim_karti_flag_rollback.sql
#8…#1 → ilgili *_rollback.sql (ters sıra)
#0  → 20261103000500_feature_flags_rollback.sql   (EN SON geri al)
```
- `#16` rollback'i `claim_handle`/`check_handle`/`posts_guard_protected_cols`'u
  G9 gövdesine döndürür; `handle_is_reserved`/`update_my_post`/`search_products`/
  `feature_flag_audit`+admin RPC'leri ve `yeni_kabuk` satırını kaldırır.
- `#16` rollback'i hardening revoke'larını (madde 2) YENİDEN VERMEZ (istemci hiç
  kullanmıyordu); gerçekten gerekirse elle `grant`.
- İstemci (`src/modules/profil/handle.ts`) değişikliğini ayrıca git ile geri al.

---

## (f) Uygulama sonrası duman testi (5 sorgu — canlıda, YALIN)

```sql
-- 1) yeni_kabuk kapalı ve 1.1.0 min: 1.0.7 cihaz almaz (davranış = 1.0.7).
select enabled, rollout_percent, min_app_version from public.feature_flags where key='yeni_kabuk';

-- 2) Ayrılmış ad gerçekten kapandı (kcalculate/kcal/admin alınamaz).
select public.handle_is_reserved('kcalculate'), public.handle_is_reserved('admin'),
       public.handle_is_reserved('kcal.official');   -- t, t, f

-- 3) search_products aktif ürün döndürüyor (gerçek bir ürün parçasıyla; <=20, şekil doğru).
select jsonb_array_length((public.search_products('<gerçek-ürün-adından-2+-harf>'))->'items') as adet,
       (public.search_products('<gerçek-ürün-adından-2+-harf>'))->'items'->0 as ilk;
--   ilk: { id, name, image_url, kcal, protein_g, carbs_g, fat_g } şeklinde olmalı.

-- 4) post-media tek writer_* seti (anon/yabancı LİSTELEME hâlâ kapalı — G10 #15).
select count(*) filter (where policyname like 'post_media_writer_%') as writer,
       count(*) filter (where policyname like 'post_media_creator_%') as creator
 from pg_policies where schemaname='storage' and tablename='objects';
--   writer=3, creator=0.

-- 5) feature_flag_audit RLS: normal kullanıcı OKUYAMAZ, admin OKUR (panelde test et).
select to_regclass('public.feature_flag_audit') is not null as tablo,
       (select count(*) from pg_policies where tablename='feature_flag_audit') as politika_sayisi; -- 1
```

> Staging doğrulaması (uygulamadan ÖNCE): `supabase/tests/feed_rls_test.sql`
> (33 senaryo, `BEGIN…ROLLBACK`) `psql -f` ile koş. T28–T33 G11 maddeleri;
> T31/T33 products/admin_allowlist seed'leri canlı kolonlara göre SKIP edebilir
> (notice verir), suite yine de yeşil kalır. İlgili: [G6-APPLY.md](./G6-APPLY.md),
> [G11-S1-LOG.md](./G11-S1-LOG.md).
