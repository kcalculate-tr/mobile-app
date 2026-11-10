-- G22-S2 md.4 — Keşfet arama = profil + içerik (ürün kararı; yemek araması DEĞİL).
-- version: 20261110100200  name: g22_s2_search
--
-- DURUM: Bu dosya YALNIZCA yazıldı; canlıya UYGULANMADI (gece kuralı).
-- İdempotent: tekrar çalıştırmak güvenli (create or replace + grant).
-- Geri alma: supabase/rollbacks/20261110100200_g22_s2_search_rollback.sql
--
-- İki RPC (istemci: src/modules/kesfet/search/client.ts):
--   search_profiles(q text)                 → { items: [ {id, display_name, handle, avatar_url,
--                                                role, verified, is_private, me_following} ] }
--   search_posts(q text, p_kind text='post') → { items: [ {id, author{…}, published_at, body,
--                                                media_url, meal_card, post_type} ] }
--
-- Tarif modeli (canlı şema 9 Kas): ayrı `recipes` tablosu YOK. Tarif = öğün gönderisi
-- (`posts.post_type = 'ogun'` ve `meal_card` dolu — kcal/protein/porsiyon tarif verisi).
-- Bu yüzden ayrı RPC yerine `search_posts(q, p_kind)`: 'post' = tüm gönderiler,
-- 'recipe' = yalnız öğün kartlı gönderiler.
--
-- GÜVENLİK
--  · SECURITY DEFINER + `set search_path = ''` (tüm adlar şemayla nitelenmiş). Invoker
--    olamaz: profiles RLS yalnız kendi satırını okutur; yazar adı/handle'ı akıştaki
--    get_feed gibi definer içinden okunur. Görünürlük ve engel AÇIKÇA süzülür:
--      - yalnız `status = 'published'` gönderi,
--      - `public.feed_can_view_author(çağıran, yazar)` = engel YOK (iki yön, user_blocks)
--        VE (hesap açık VEYA çağıran zaten takip ediyor VEYA kendisi) — get_feed /
--        posts_select RLS ile birebir aynı kural; arama akışta görünmeyeni göstermez.
--      - profilde ayrıca kendisi hariç, handle'ı olmayan (açık profili açılamayan) hariç.
--  · auth.uid() yoksa 42501 (get_feed gibi; akış bugün anon'a kapalı → anon'a grant YOK).
--  · Sorgu: boşluk sadeleşir, baştaki '@' (handle araması) atılır, en az 2 en çok 64
--    karakter; ILIKE için `\`, `%`, `_` kaçışlanır (`escape '\'`) → joker enjeksiyonu yok.
--  · Sonuç sınırı: 24 (sabit; istemci sayfalamaz).
-- ─────────────────────────────────────────────────────────────────────────────
begin;

-- Ortak: sorgu normalleştirme + ILIKE deseni. NULL → arama yapılmaz.
create or replace function public.search_like_pattern(q text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when char_length(n.v) < 2 then null
    else '%' || replace(replace(replace(left(n.v, 64), '\', '\\'), '%', '\%'), '_', '\_') || '%'
  end
  from (
    select pg_catalog.ltrim(pg_catalog.btrim(pg_catalog.regexp_replace(coalesce(q, ''), '\s+', ' ', 'g')), '@') as v
  ) n;
$$;

comment on function public.search_like_pattern(text) is
  'G22-S2 arama: boşluk sadeleştir, baştaki @ at, 2..64 karakter, ILIKE kaçışı (\\ %% _). <2 → null.';

-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ search_profiles — ad / handle araması                                       ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝
create or replace function public.search_profiles(q text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_pat text := public.search_like_pattern(q);
  v_exact text := lower(pg_catalog.ltrim(pg_catalog.btrim(coalesce(q, '')), '@'));
  v_items jsonb;
begin
  if v_uid is null then raise exception 'yetkisiz' using errcode = '42501'; end if;
  if v_pat is null then return jsonb_build_object('items', '[]'::jsonb); end if;

  select coalesce(jsonb_agg(r.item order by r.rnk, r.sort_name), '[]'::jsonb)
    into v_items
  from (
    select
      jsonb_build_object(
        'id',           p.id,
        'display_name', coalesce(
                          nullif(btrim(p.full_name), ''),
                          nullif(btrim(coalesce(p.first_name, '') || ' ' || coalesce(p.last_name, '')), ''),
                          p.handle),
        'handle',       p.handle,
        'avatar_url',   p.avatar_url,
        'role',         coalesce(cr.role, 'user'),
        'verified',     (cr.verified_at is not null),
        'is_private',   coalesce(p.is_private, false),
        'me_following', case
                          when exists (select 1 from public.follows f
                                        where f.follower_id = v_uid and f.following_id = p.id) then 'following'
                          when exists (select 1 from public.follow_requests fr
                                        where fr.requester_id = v_uid and fr.target_id = p.id) then 'requested'
                          else 'none' end
      ) as item,
      -- tam handle eşleşmesi > handle öneki > doğrulanmış üretici > diğer
      case
        when lower(p.handle) = v_exact then 0
        when lower(p.handle) like lower(pg_catalog.ltrim(v_pat, '%')) escape '\' then 1
        when cr.verified_at is not null then 2
        else 3
      end as rnk,
      lower(coalesce(p.full_name, p.handle)) as sort_name
    from public.profiles p
    left join public.creators cr on cr.user_id = p.id
    where p.handle is not null
      and p.id <> v_uid
      and (
        p.handle ilike v_pat escape '\'
        or p.full_name ilike v_pat escape '\'
        or (coalesce(p.first_name, '') || ' ' || coalesce(p.last_name, '')) ilike v_pat escape '\'
      )
      and public.feed_can_view_author(v_uid, p.id)
    order by rnk, sort_name
    limit 24
  ) r;

  return jsonb_build_object('items', v_items);
end;
$$;

comment on function public.search_profiles(text) is
  'G22-S2 Keşfet arama › Kişi. Görünür (açık / takip edilen), engelsiz, handle''lı profiller; kendisi hariç. <=24.';

-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ search_posts — gövde / öğün adı araması; p_kind 'post' | 'recipe'           ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝
create or replace function public.search_posts(q text, p_kind text default 'post')
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_pat text := public.search_like_pattern(q);
  v_kind text := coalesce(p_kind, 'post');
  v_items jsonb;
begin
  if v_uid is null then raise exception 'yetkisiz' using errcode = '42501'; end if;
  if v_kind not in ('post', 'recipe') then raise exception 'gecersiz_tur'; end if;
  if v_pat is null then return jsonb_build_object('items', '[]'::jsonb); end if;

  select coalesce(jsonb_agg(r.item order by r.published_at desc, r.id desc), '[]'::jsonb)
    into v_items
  from (
    select
      po.id,
      po.published_at,
      jsonb_build_object(
        'id', po.id,
        'author', jsonb_build_object(
          'id',           po.author_id,
          'display_name', coalesce(
                            nullif(btrim(pr.full_name), ''),
                            nullif(btrim(coalesce(pr.first_name, '') || ' ' || coalesce(pr.last_name, '')), ''),
                            pr.handle, 'Kcalculate'),
          'handle',       pr.handle,
          'avatar_url',   pr.avatar_url,
          'role',         coalesce(cr.role, 'user'),
          'verified',     (cr.verified_at is not null)
        ),
        'published_at', po.published_at,
        'body',         po.body,
        'post_type',    po.post_type,
        'meal_card',    po.meal_card,
        'media_url',    (select m.url from public.post_media m
                          where m.post_id = po.id
                          order by m.sort, m.id limit 1)
      ) as item
    from public.posts po
    left join public.profiles pr on pr.id = po.author_id
    left join public.creators cr on cr.user_id = po.author_id
    where po.status = 'published'
      and (
        po.body ilike v_pat escape '\'
        or (po.meal_card ->> 'name') ilike v_pat escape '\'
      )
      and (v_kind = 'post' or (po.post_type = 'ogun' and po.meal_card is not null))
      and public.feed_can_view_author(v_uid, po.author_id)
    order by po.published_at desc, po.id desc
    limit 24
  ) r;

  return jsonb_build_object('items', v_items);
end;
$$;

comment on function public.search_posts(text, text) is
  'G22-S2 Keşfet arama › Gönderi (p_kind=post) / Tarif (p_kind=recipe: ogun + meal_card). Yayında, görünür, engelsiz. <=24.';

revoke all on function public.search_like_pattern(text)  from public, anon;
revoke all on function public.search_profiles(text)      from public, anon;
revoke all on function public.search_posts(text, text)   from public, anon;
-- search_like_pattern: yalnız definer RPC'ler içinden (sahip yetkisiyle) çağrılır → grant yok.
grant execute on function public.search_profiles(text)     to authenticated;
grant execute on function public.search_posts(text, text)  to authenticated;

commit;
