-- Geri alma: 20261110100200_g22_s2_search.sql
-- Yalnız G22-S2'nin eklediği 3 fonksiyon kaldırılır (tablo/veri değişikliği yoktu).
-- İstemci RPC bulunamazsa (PGRST202/42883) aramada hata durumunu gösterir; Keşfet akışı etkilenmez.
begin;

drop function if exists public.search_posts(text, text);
drop function if exists public.search_profiles(text);
drop function if exists public.search_like_pattern(text);

commit;
