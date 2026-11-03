# G5-S2 — Profil, Gün halkası, AI kotası (sunucu notu)

**Dal:** `night5/day-rings` (night5/base'den) · **Durum:** yalnız migration DOSYASI, canlı/staging'e UYGULANMADI, test edilmedi.
Model: basit, Instagram. Tüm RPC'ler `security definer`, `set search_path=public`, yalnız `authenticated`, `auth.uid()` ile.

## Tablolar (migration dosyaları, timestamp sırası)
- `20261103020000_profiles_social_columns` — `profiles`'a `handle` (benzersiz/küçük harf/3-30/[a-z0-9_]), `bio` (≤160), `is_private` (false). `avatar_url` zaten vardı. `display_name` = mevcut `full_name`. `verified` = türetilir (`role <> 'customer'`).
- `20261103020100_day_shares` — `day_shares(id, user_id, consumption_id, created_at, expires_at=created_at+24h)` + `unique(user_id, consumption_id)`. Ayrıca `meal_consumptions`'a `photo_path` (user-media yolu) eklendi (foto kolonu yoktu).
- `20261103020200_ai_scan_quota` — `app_settings(key,value jsonb,...)` küçük key-value (mağaza `settings` singleton'ından ayrı) + seed `ai_scan_user_daily_limit=3`, `ai_scan_daily_cap=1000`; `ai_scan_usage(user_id, day, used)`; `ai_scan_reservations(idempotency_key PK, user_id, day, status)`.
- `20261103020300_user_media_bucket` — `user-media` ÖZEL kovası + sahip bazlı storage.objects politikaları (yol `<user_id>/...`).
- `20261103020400_g5_rpcs` — aşağıdaki RPC'ler.

Hesap silinince: `day_shares`, `ai_scan_usage`, `ai_scan_reservations` satırları `auth.users` FK'si ile `on delete cascade` gider.

## Görünürlük kuralı
Gizlilik her yerde aynı: açık hesap → herkes; gizli hesap → yalnız onaylı takipçiler.
- `profiles`'ın mevcut RLS'i korunur (kullanıcı kendi satırını okur/günceller; admin/şube istisnaları). Açık profil okuma `get_public_profile` (definer) ile.
- `day_shares`: istemci yalnız KENDİ satırlarını okur/siler (RLS). Başkasının kartları yalnız `get_day_cards` (definer) ile, 24 saat + gizlilik denetiminden geçerek.
- `get_day_cards` başkası için: AÇIK hesapta kartlar görünür; GİZLİ hesapta boş döner (takip/engel `follows`/`blocks` tabloları gelene kadar güvenli tarafta kapalı).

## Kota davranışı (AI tarama)
- Kullanıcı başına günde `ai_scan_user_daily_limit` (3). Gün = Europe/Istanbul takvim günü; `reset_at` = sonraki İstanbul gece yarısı.
- `reserve_ai_scan(idempotency_key)` atomik: `ai_scan_usage` satırı `for update` ile kilitlenir; aynı anahtar iki kez saymaz; kullanıcı limiti ve genel günlük tavan (`ai_scan_daily_cap`, tüm kullanıcıların toplamı) sunucuda. Dönüş `{ok, remaining, reset_at}`.
- `release_ai_scan(idempotency_key)`: başarısız analizde `status=released` + sayacı 1 azaltır (idempotent; yalnız 'reserved' ve çağırana ait).

## İki kayıt şablonu — veri akışı
- **Kcalculate AI (herkes):** e-posta/Apple/Google ile hesap → `claim_handle` ile `@handle` → `update_public_profile(display_name→full_name, bio, avatar_url)`. Kalori/hedef ZORUNLU DEĞİL; "Takibe başla" derse mevcut `user_nutrition_profiles` doldurulur. Foto: `user-media` kovasına `<user_id>/...` yüklenir (EXIF temizliği istemcide), imzalı URL ile okunur.
- **eatkcal (sipariş):** ilk siparişte `check_delivery_city(p_city)` → `{ok, message}` (yalnız İzmir true; Türkçe harf normalize). Sonra mevcut adres/checkout akışı (`addresses`, `orders`) aynen; yalnız şehir kapısı eklenir. Ödeme akışına DOKUNULMADI.

## RPC imzaları (G5-CONTRACT.md ile birebir)
`claim_handle(p_handle)→{ok,reason}` · `update_public_profile(p_display_name,p_bio,p_avatar_url)→void` · `get_public_profile(p_handle)→{id,display_name,handle,avatar_url,bio,role,verified,is_private,followers,following,posts,me_following}` · `share_meal_to_day(p_consumption)→void` · `get_day_rings()→[{user:{id,display_name,avatar_url},progress,streak,has_new}]` (ilk öğe ben) · `get_day_cards(p_user)→[{id,consumption_id,name,meal_type,consumed_at,photo_url,kcal,protein_g}]` · `reserve_ai_scan(p_idempotency_key)→{ok,remaining,reset_at}` · `release_ai_scan(p_idempotency_key)→void` · `check_delivery_city(p_city)→{ok,message}`.

`photo_url` = `user-media` kovasındaki YOL (public değil); istemci kısa ömürlü imzalı URL üretir.
