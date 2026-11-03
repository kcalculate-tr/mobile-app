# G5-S1 — Keşfet sunucusu (Dalga 1) · LOG

## Özet (10 satır)
1. Dal `night5/feed-backend` (night5/base'den), worktree `.claude/worktrees/g5-s1`.
2. Yapıldı: 9 tablo + RLS + yardımcı fn (7c2af12), 7 RPC sözleşmeyle birebir (6135432),
   post-media storage (bf7a600), tohum + 10 senaryoluk RLS testi (b24bf28).
3. Her migration'ın `_rollback.sql`'i var; hepsi YALNIZ DOSYA — **staging'de test edilmedi**, hiçbir yere uygulanmadı.
4. Instagram gizlilik modeli: `feed_can_view_author()` ile açık/gizli + çift yönlü engel süzme; yazma yalnız `creators.can_post`.
5. Kontroller: `tsc --noEmit` = 0 hata, `npm run test:unit` = 305/305 geçti (SQL-only değişiklik, taban korunur).
6. Kalan: migration'ların staging'de uygulanıp `feed_rls_test.sql`'in çalıştırılması; `profiles.handle` için S2'nin UNIQUE index + `claim_handle`'ı.
7. S3 bağımlılığı: imza nüansları `docs/night/G5-S1-FEED.md` sonunda (quote.author nesne, imleç opak base64, meal_type `kahvalti|ogle|aksam|atistirma`).
8. S2 ile örtüşme: `profiles.is_private/handle/bio` burada IF NOT EXISTS ile eklendi; S2 de aynısını eklerse çakışmaz (idempotent).
9. Sözleşme dışı tek ek: `post_meal_adds` (stats.adds sayımı için — bkz. SORULAR).
10. İlter sabah: bu dalı gözden geçir → staging'e migration push + RLS testini koştur; kurum hesabının auth kullanıcısı (Auth Admin API) açılmalı ki tohum FK tutsun.

## Yapılanlar (dosya referanslı)
- `supabase/migrations/20261103020000_feed_tables.sql` (+ `_rollback`): tablolar
  `creators` (role kurum/diyetisyen/pt/moderator, verified_at, can_post),
  `posts` (lang tr/en, body≤1000, quote_of, thread_root/index, meal_card jsonb, pinned_until, status, published_at),
  `post_media`, `post_reactions` (PK üçlü), `follows`, `follow_requests`, `user_blocks`,
  `content_reports` (post/user/day_card — `review_reports`'a dokunulmadı), `post_meal_adds`.
  İndeksler (for_you keyset + following + pinned + thread + fk'ler). Yardımcı fn:
  `feed_is_blocked`, `feed_can_post`, `feed_is_moderator`, `feed_can_view_author` (hepsi definer, anon revoke).
  RLS: okuma yayımlanmış + yazar görülebilir + engelsiz / kendi / moderatör; yazma yalnız can_post;
  tepki-takip-engel yalnız kendi; content_reports yalnız INSERT, moderatör okur.
  `profiles`'a `is_private/handle/bio` IF NOT EXISTS (RLS + FeedPost.author için).
- `supabase/migrations/20261103020100_feed_rpcs.sql` (+ `_rollback`): `get_feed`, `react_post`,
  `add_post_meal_to_day`, `report_content`, `block_user`, `follow`, `respond_follow_request`.
  Keyset imleç opak base64 `pin|epoch_us|id`. add_post_meal idempotency:
  `meal_consumptions(user_id, source='post', source_ref=p_idempotency_key)` mevcut benzersizliği;
  o anki besin değerleri porsiyonla ölçeklenip saklanır. Engelleme takip/istekleri çift yönde temizler.
- `supabase/migrations/20261103020200_post_media_storage.sql` (+ `_rollback`): `post-media` kovası
  (public okuma; yazma can_post üretici, `posts/{uid}/...`; jpeg/png/webp/heic; ≤5 MB).
- `supabase/seed/feed_seed.sql`: "Kcalculate" kurum hesabı + 20 TR / 10 EN gönderi; meal_card'lar
  gerçek `products` satırlarından SELECT ile (sayı uydurulmadı); beden fotoğrafı yok.
- `supabase/tests/feed_rls_test.sql`: A(gizli üretici)/B/C ile 10 senaryo (gizli görünürlük,
  tepki kurcalama engeli, görünmeyene react/add reddi, follow→request→accept, idempotency,
  çift yönlü engel, content_reports okunamaz), tamamı `begin … rollback`.

## Kontrol sonuçları
- `npx tsc --noEmit` → **0 hata** (exit 0).
- `npm run test:unit` → **305/305 pass** (SQL/doküman değişikliği; TS'e dokunulmadı).
- SQL yürütme: yapılmadı — gece kuralları (yalnız dosya) + canlı DB salt-okunur. `feed_rls_test.sql`
  staging/local'de koşulmalı (auth şeması + `authenticated` rol + request.jwt.claims gerektirir).
  Yerel doğrulama için Docker Postgres denendi fakat **Docker daemon kapalıydı**; parse edilemedi.

## SORULAR (karar İlter'de)
1. **`post_meal_adds` tablosu sözleşme listesinde yok.** `stats.adds` (gönderi başına "Günüme ekle"
   sayısı) istemci-yazılamaz biçimde ancak gerçek bir kayıttan türetilebilsin diye eklendi; çünkü
   `meal_consumptions.source_ref` idempotency anahtarıdır, post'a bağlanmaz. Alternatif: adds'i tümden
   kaldırmak ya da source_ref'i post_id yapmak (idempotency'yi bozar). Ek tablo en temizi görüldü — onay?
2. **`profiles.is_private/handle/bio` burada eklendi** (akış RLS'i ve FeedPost.author için zorunlu),
   ama sözleşmede S2'nin. S2 migration'ı aynı kolonları IF NOT EXISTS eklerse çakışma yok. `handle`
   UNIQUE index'i + `claim_handle` bilerek S1'de yazılmadı (S2'nin) — S2 sırasında eklensin.
3. **`add_post_meal_to_day` imza nüansı:** Postgres default'lı `p_portion`'dan sonra default'suz
   parametreye izin vermediğinden `p_idempotency_key text default null` verildi (çalışma zamanında
   zorunlu — null/boş reddedilir). Ad/tür/sıra sözleşmeyle aynı; sorun olur mu?
4. **`FeedPost.quote.author`** sözleşmede tekil; nesne `{id,display_name,handle}` olarak döndürüldü
   (alıntı kartında @handle gösterebilmek için). String isteniyorsa S3 öncesi söyle, tek satır değişir.
5. Gönderi yazma/düzenleme için **moderatör/üretici atama akışı** (creators INSERT) yalnız moderatöre
   açık bırakıldı; ilk `can_post` kaydı tohum/Auth tarafında elle veriliyor. Panelden yönetim G5 kapsamı dışı mı?
