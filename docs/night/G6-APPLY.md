# G6-APPLY — Canlıya uygulanacak dosyalar (sıralı)

## ⚠️ `supabase db push` KULLANMA — dosyalar TEK TEK uygulanır

Canlı `supabase_migrations.schema_migrations` **27 Ekim 2026**'da bitiyor; Kasım
migration'ları (repodaki `20261102*`/`20261103*`) **elle** uygulanmış, kayıt
tutulmamış. Bu yüzden `supabase db push` geçmiş migration'ların yarısını
"uygulanmamış" sanıp yeniden çalıştırır ve **çakışır**. Her dosyayı sırayla, elle
(Dashboard SQL editor veya `psql`) uygula; uyguladığını kendi takip et.

Rollback dosyaları artık `supabase/rollbacks/` altında — onları ASLA bu listeden
uygulama (yalnız geri alma gerekirse, ilgili dosyayı elle çalıştır).

## Canlı durum doğrulaması — YAPILMADI (prod okuma reddedildi)

Bu oturumda salt-okur `supabase-prod` MCP ile "bu tablo/kolon/fonksiyon canlıda
var mı?" kontrolü **harness güvenlik sınıflandırıcısı tarafından bloklandı**
(kullanıcı prod okuma onayı vermediği için). Dolayısıyla aşağıdaki "Durum"
sütunu dosya kaynağına göre çıkarımdır, canlı doğrulama DEĞİL. Uygulamadan önce
her nesne için şu sorguyu koş (salt okur):

```sql
-- Örnek doğrulamalar
select to_regclass('public.creators');                       -- tablo var mı?
select exists(select 1 from information_schema.columns
  where table_name='profiles' and column_name='handle');     -- kolon var mı?
select exists(select 1 from pg_proc where proname='get_feed'); -- fonksiyon var mı?
select id from storage.buckets where id='user-media';         -- kova var mı?
```

**Güvence:** Tüm migration'lar idempotent yazıldı (`create table if not exists`,
`add column if not exists`, `create or replace function`, `on conflict do
nothing`, `create ... if not exists`). Bir nesne zaten varsa dosyayı yeniden
uygulamak güvenlidir (G6 düzeltmeleri `create or replace` ile eski gövdeyi ezer).
İstisna: `20261104001000_g6_fixes.sql` `content_reports.status` CHECK kısıtını
`drop constraint if exists` + yeniden ekler — bu da tekrar-güvenli.

## Sıra (bağımlılık + uygulama sırası)

G6-S1 sosyal/Keşfet katmanının tamamı night5/night6'da yazıldı; dosya başlıkları
"canlıya/staging'e UYGULANMADI" diyor → hepsi **UYGULANACAK (yeni)**. Önce
bağımlılık (feature_flags tablosu) uygulanmalı.

| # | Dosya | Oluşturduğu başlıca nesneler | Durum |
|---|-------|------------------------------|-------|
| 0 | `supabase/migrations/20261103000500_feature_flags.sql` | tablo `feature_flags`, `user_feature_unlocks` | Bağımlılık — #9 bunu gerektirir. Canlıda elle uygulanmış OLABİLİR (Kasım migration'ları); yoksa önce bu. |
| 1 | `20261104000100_profiles_social_columns.sql` | `profiles.handle/bio/is_private`, `profiles_handle_unique_idx`, format/bio CHECK | UYGULANACAK |
| 2 | `20261104000200_feed_tables.sql` | tablolar `creators, posts, post_media, post_reactions, follows, follow_requests, user_blocks, content_reports, post_meal_adds` + fn `feed_is_blocked/feed_can_post/feed_is_moderator/feed_can_view_author` + RLS | UYGULANACAK |
| 3 | `20261104000300_feed_rpcs.sql` | fn `get_feed, react_post, add_post_meal_to_day, report_content, block_user, follow, respond_follow_request` | UYGULANACAK |
| 4 | `20261104000400_post_media_storage.sql` | kova `post-media` + storage politikaları | UYGULANACAK |
| 5 | `20261104000500_day_shares.sql` | tablo `day_shares`, `meal_consumptions.photo_path` + RLS | UYGULANACAK |
| 6 | `20261104000600_ai_scan_quota.sql` | tablolar `app_settings, ai_scan_usage, ai_scan_reservations` + ayar tohumu | UYGULANACAK |
| 7 | `20261104000700_user_media_bucket.sql` | özel kova `user-media` + sahip bazlı politikalar | UYGULANACAK |
| 8 | `20261104000800_g5_rpcs.sql` | fn `claim_handle, update_public_profile, get_public_profile, share_meal_to_day, get_day_rings, get_day_cards, reserve_ai_scan, release_ai_scan, check_delivery_city` | UYGULANACAK |
| 9 | `20261104000900_paylasim_karti_flag.sql` | `feature_flags`'a `paylasim_karti` satırı (enabled=false) | UYGULANACAK (#0 gerekli) |
| 10 | `20261104001000_g6_fixes.sql` | fn `check_handle, set_profile_privacy` (yeni); `get_public_profile, get_day_rings, check_delivery_city, report_content` (create or replace); `content_reports.status→open/resolved + risk` + `content_report_risk`; tablo `moderation_actions` + RLS; fn `mod_list_reports, mod_resolve_report`; `ai_scan_reservations.status += consumed` | UYGULANACAK (#1–#8 gerekli) |

| 11 | `20261104001100_g7_fixes.sql` | `meal_consumptions_source_check` = ('manual','pantry','post','ai_scan','day_card'); `creators.role` CHECK'ine 'uretici'; `get_day_cards` (carbs_g/fat_g); fn `add_day_card_to_day, get_post, admin_set_creator, admin_create_post, admin_list_creators`; `profiles_guard_protected_cols` (handle/is_private korunur); `claim_handle`/`set_profile_privacy` (işlem-yerel `app.profile_rpc` bayrağı) | UYGULANACAK (#1–#10 gerekli; EN SON) |

Not: #10 G6 düzeltmeleri #3 ve #8'in RPC gövdelerini **ezer** (örn. `report_content`
status='open', `check_delivery_city` {ok,reason}, `get_public_profile` gerçek
sayaçlar). #3/#8'i uyguladıktan sonra #10 son uygulanmalı.

Not (#11, G7): EN SON uygulanır; #3/#8/#10'un gövdelerini (`get_day_cards`,
`claim_handle`, `set_profile_privacy`, `profiles_guard_protected_cols`) **ezer**.
**Önkoşullar:** (a) `user_nutrition_profiles` tablosu canlıda MEVCUT olmalı
(`language sql` fonksiyonlar — `get_user_day_progress` vb. — buna bağlı; canlıda
var). (b) Uygulamadan ÖNCE `select distinct source from public.meal_consumptions;`
koş — küme ('manual','pantry','post','ai_scan','day_card') dışında bir değer
(ör. 'order','barcode','ai') varsa `meal_consumptions_source_check` ADD'i patlar;
o durumda #11'deki IN listesine eksik değer(ler)i ekle. (c) `creators`'ta
'uretici' dışı rol varsa sorun yok; rollback'te tersi geçerli.

## Edge function (db push DEĞİL — ayrı deploy)

`supabase/functions/analyze-ai-scan/index.ts` — AI tabak tarama. `supabase
functions deploy analyze-ai-scan` ile deploy edilir (bu oturumda DEPLOY EDİLMEDİ).
Gerekli secret'lar (koda yazılmaz, `supabase secrets set`):
`ANTHROPIC_API_KEY` (zorunlu), `AI_SCAN_MODEL` (geçerli bir modele set EDİLMELİ —
varsayılan `claude-haiku-5-5` dosyada yer tutucu; canlı model kimliğiyle
değiştir). `SUPABASE_URL/ANON_KEY/SERVICE_ROLE_KEY` platformca sağlanır.

Bağımlılık: #6 (`ai_scan_reservations`), #7 (`user-media` kovası), #10
(`consumed` durumu) uygulanmış olmalı.

## Uygulama sonrası

- `supabase/tests/feed_rls_test.sql`'i staging'de koş (A/B/C/D/M, 15 senaryo).
  Tohum FK'leri için kurum/moderatör auth kullanıcıları Auth Admin API ile açılmalı.
- Bayrakları (`kesfet, gun_halkasi, ai_tarama, paylasim_karti` …) açmak İlter'in
  dalga planı kararı; hepsi varsayılan KAPALI, davranış değişmez.

İlgili: [G6-S1-LOG.md](./G6-S1-LOG.md).
