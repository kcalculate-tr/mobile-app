# G5-S2 — LOG

## Özet (10 satır)
1. Yapılan: Kcalculate AI profili, Gün halkası ve AI tarama kotası için SUNUCU tarafı — 5 migration (+ rollback) ve 9 RPC, hepsi G5-CONTRACT.md imzalarına birebir.
2. Dal: `night5/day-rings` (night5/base'den), worktree `.claude/worktrees/g5-s2`.
3. Migration'lar YALNIZ DOSYA: canlıya/staging'e uygulanmadı, test edilmedi (gece kuralı). Her birinin `_rollback.sql`'i var.
4. `profiles`: handle/bio/is_private eklendi; avatar_url zaten vardı; display_name=full_name, verified=role türevi. Kolon silme yok, geriye uyumlu.
5. `day_shares` (24 saat, sunucuda kesilir) + `meal_consumptions.photo_path` (foto kolonu yoktu).
6. AI kota: `app_settings` (key-value) + `ai_scan_usage` + `ai_scan_reservations`; reserve/release atomik (`for update`, idempotent), günde 3 + genel tavan.
7. `user-media` ÖZEL kovası + sahip bazlı storage politikaları; paylaşım imzalı URL ile.
8. `check_delivery_city` yalnız İzmir true (Türkçe harf normalize).
9. Kalan / İlter sabah: migration'ları staging'de uygula + `supabase db push` (onayınla); S1 `follows`/`blocks`/`posts` gelince get_public_profile sayaçları ve get_day_rings takip halkaları bağlanacak (bkz. SORULAR).
10. Bayrak kayıtları (`gun_halkasi`, `ai_tarama` vb.) S3 kapsamında (sözleşme §Bayrak) — bu oturumda eklenmedi.

## Yapılanlar + commit'ler
- `20261103020000_profiles_social_columns.sql` (+rollback) — profiles handle/bio/is_private. — commit `6c57b17`
- `20261103020100_day_shares.sql` (+rollback) — day_shares + meal_consumptions.photo_path. — commit `ec640d8`
- `20261103020200_ai_scan_quota.sql` (+rollback) — app_settings + ai_scan_usage/reservations + seed. — commit `1324e3b`
- `20261103020300_user_media_bucket.sql` (+rollback) — user-media özel kova + politika. — commit `0be45e0`
- `20261103020400_g5_rpcs.sql` (+rollback) — 9 RPC (claim_handle, update/get_public_profile, share_meal_to_day, get_day_rings, get_day_cards, reserve/release_ai_scan, check_delivery_city). — commit `095b245`
- `docs/night/G5-S2-DAY.md`, `docs/night/G5-S2-LOG.md` — bu commit

## Test sonucu
- SQL canlıya/staging'e uygulanMADI (gece kuralı) → "staging'de test edilmedi".
- TS/JS dosyası değişmedi (yalnız `supabase/migrations/` ve `docs/night/`); mobil `tsc --noEmit` tabanı etkilenmez.

## SORULAR (karar/entegrasyon)
1. **follows/blocks/posts (S1 Keşfet).** Bu tablolar night5/base'de YOK ve kolon adları bilinmiyor (tahmin yok). `get_public_profile` şimdilik `followers/following/posts=0`, `me_following=false` döner; `get_day_rings` yalnız "ben"i döndürür. S1 şeması entegrasyonda gelince küçük bir migration ile sayaçlar ve takip halkaları bağlanmalı.
2. **display_name ↔ full_name.** profiles'ta ayrı `display_name` kolonu yok; `update_public_profile` display_name'i `full_name`'e yazıyor, `get_public_profile` oradan okuyor. S3 bu eşlemeyi beklesin. (first_name/last_name'e dokunulmadı.)
3. **verified kaynağı.** profiles'ta `verified` kolonu yok; `role <> 'customer'` türevi kullanıldı. Gerçek doğrulama rozeti için (kurum/diyetisyen) ayrı kaynak gerekirse Keşfet `creators` tablosuna bağlanmalı.
4. **photo_url = yol.** get_day_cards/MealCard'daki `photo_url`, user-media kovasındaki YOL'dur (public URL değil). İstemci `createSignedUrl` ile kısa ömürlü URL üretir — S3 bunu beklesin.
5. **app_settings vs settings.** Mevcut `settings` singleton'ı mağaza ayarı olduğu için AI kota ayarları yeni `app_settings` key-value tablosuna kondu (ikinci genel ayar sistemi değil, bilinçli ayrım).
6. **Şehir kapısı kapsamı.** `check_delivery_city` yalnız "İzmir mi?" kontrolü; mevcut `delivery_zones`/`branch_service_areas` ilçe/mahalle doğrulaması korunur, bu RPC onların önüne bir kapı ekler. Checkout akışına bağlama S3/entegrasyon işi.
