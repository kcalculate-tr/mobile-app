-- G60-S1 md.1 — Keşfet sıralaması v2 (dil + yerellik + etkileşim): `get_feed_ranked`.
-- version: 20261117230300  name: g60_get_feed_ranked
--
-- DURUM: YALNIZ DOSYA. Canlıya uygulanmadı. Geri alma:
--   supabase/rollbacks/20261117230300_g60_get_feed_ranked_rollback.sql
-- Önkoşul: 20261117230100_g60_post_stats.sql + 20261117230200 doldurma; G8 get_feed katmanı
-- (posts, post_media, creators, feed_can_view_author, feed_flag_enabled); G22-S2 geo_fold.
--
-- TASARIM (risk önleme):
--   1) Eski yol DOKUNULMAZ: get_feed aynen kalır. Bu AYRI fonksiyon; istemci yalnız `kesfet_siralama`
--      bayrağı açıkken ve yalnız "Keşfet" (for_you) sekmesinde çağırır. Sunucu da bayrağı denetler
--      (kapalı → 'kapali' hatası → istemci get_feed'e düşer). Geri alma = bayrağı kapatmak.
--   2) FİLTRE DEĞİL ÖNCELİK: dil ve şehir içerik gizlemez, puan verir. Gizlilik süzgeci get_feed ile
--      AYNI: status='published' (+ kendi 'pending'), feed_can_view_author (engel + gizli hesap).
--   3) SAYFALAMA: imleç = base64('r1|as_of_us|konum|son_puan|son_id'). Puan as_of'a göre hesaplanır:
--      yaş as_of'tan; as_of'tan SONRAKİ beğeni/kaydet/ekleme/yorum sayaçtan düşülür; takip ve
--      "son 30 gün etkileşim" as_of'a kadar; as_of'tan sonra yayınlanan gönderi aday değil.
--      Sıra deterministik yeniden üretilir; son_id bulunursa ondan sonrası, bulunamazsa (silindi /
--      engellendi) konumdan devam. İstemci ayrıca id ile tekilleştirir. Tekrar/kayıp yok (test).
--   4) PERFORMANS: aday = sabitlenmişler + son 30 gün (en çok 500); sayaçlar post_stats'tan.
--      Sıra yalnız istenen sayfanın sonuna (+1 sayfa pay) kadar kurulur.
--   5) Zengin daha zengin olmasın: ilk 24 sa yenilik bonusu; her 10 gönderide 1 keşif yuvası
--      (başka dil ya da başka şehir, ağırlıklı etkileşim ≥ 3).
--   6) Çeşitlilik: aynı yazardan arka arkaya en çok 2; resmi hesap ('kurum') sabitlenmiş dışında
--      20'lik sayfa başına en çok 3. Uygun aday yoksa (ör. tek yazar kaldı) sıradaki alınır — akış
--      boş kalmaz.
--   7) Moderasyon: çözülmemiş şikayet başına −0,2 (en çok 5). Eşik üstü zaten gizli (status).
--
-- PUAN (ağırlıklar TEK yerde: aşağıdaki kesfet_rank_score + kesfet_rank_config; TS kopyası
-- src/modules/kesfet/ranking.ts RANK_CONFIG — test iki tarafın sabitlerini karşılaştırır):
--   puan = yenilik × (1 + etkileşim) × ilişki × yerellik × dil − ceza
--   yenilik   = exp(−yaş_sa / 48) + (yaş_sa < 24 ? 0,5 : 0)
--   etkileşim = ln(1 + 4·ekleme + 3·kaydetme + 2·yorum + 1·beğeni)
--   ilişki    = (takip ? 1,5 : 1) × (son 30 günde yazarla etkileşim ? 1,2 : 1)
--   yerellik  = izleyenin adres şehri = yazarın adres şehri ? 1,3 : 1 (şehir yoksa 1)
--   dil       = gönderi dili = istek dili ? 1,0 : 0,35
--   ceza      = 0,2 × min(çözülmemiş şikayet, 5)
--   Sabitlenmiş (pinned_until > as_of) her zaman üstte, kendi aralarında yeniye göre.
-- İdempotent: tekrar çalıştırmak güvenli.
begin;

-- ── 1) Bayrak — KAPALI ───────────────────────────────────────────────────────
insert into public.feature_flags (key, enabled, rollout_percent, min_app_version, description)
values (
  'kesfet_siralama', false, 0, '1.1.0',
  'G60-S1: Keşfet sekmesi sıralaması v2 (get_feed_ranked: dil + yerellik + etkileşim). Kapalıyken get_feed (kronolojik) aynen. Native yok → OTA.'
)
on conflict (key) do nothing;

-- ── 2) İndeksler (as_of sonrası sayaç düzeltmesi + etkileşim/aday penceresi) ────
create index if not exists post_reactions_created_idx on public.post_reactions (created_at);
create index if not exists post_meal_adds_created_idx on public.post_meal_adds (created_at);
create index if not exists post_meal_adds_user_idx    on public.post_meal_adds (user_id, created_at desc);
create index if not exists post_comments_created_idx  on public.post_comments (created_at);
create index if not exists posts_rank_window_idx      on public.posts (published_at desc) where status in ('published', 'pending');

-- ── 3) Yapılandırma (okunur belge; puan fonksiyonu aynı sabitleri kullanır) ──────
create or replace function public.kesfet_rank_config()
returns jsonb
language sql
immutable
parallel safe
set search_path = ''
as $$
  select jsonb_build_object(
    'version', 1,
    'fresh_tau_h', 48,
    'new_bonus_h', 24,
    'new_bonus', 0.5,
    'w_add', 4, 'w_save', 3, 'w_comment', 2, 'w_like', 1,
    'follow', 1.5, 'interacted', 1.2, 'interact_window_days', 30,
    'same_city', 1.3,
    'lang_match', 1.0, 'lang_other', 0.35,
    'report_penalty', 0.2, 'report_cap', 5,
    'window_days', 30, 'max_candidates', 500,
    'explore_every', 10, 'explore_min_weighted', 3,
    'max_author_run', 2, 'official_per_page', 3, 'page_size', 20, 'lookahead', 50
  );
$$;

-- ── 4) Puan (SAF; TS kopyası ranking.ts rankScore ile aynı sonucu verir) ──────────
create or replace function public.kesfet_rank_score(
  p_age_h      double precision,
  p_adds       integer,
  p_saves      integer,
  p_comments   integer,
  p_likes      integer,
  p_follows    boolean,
  p_interacted boolean,
  p_same_city  boolean,
  p_lang_match boolean,
  p_reports    integer
)
returns double precision
language sql
immutable
parallel safe
set search_path = ''
as $$
  select
    (
      pg_catalog.exp(- greatest(coalesce(p_age_h, 0), 0)::double precision / 48.0::double precision)
      + case when greatest(coalesce(p_age_h, 0), 0) < 24 then 0.5::double precision else 0::double precision end
    )
    * (1::double precision + pg_catalog.ln((
        1
        + 4 * greatest(coalesce(p_adds, 0), 0)
        + 3 * greatest(coalesce(p_saves, 0), 0)
        + 2 * greatest(coalesce(p_comments, 0), 0)
        + 1 * greatest(coalesce(p_likes, 0), 0)
      )::double precision))
    * (case when coalesce(p_follows, false) then 1.5::double precision else 1::double precision end)
    * (case when coalesce(p_interacted, false) then 1.2::double precision else 1::double precision end)
    * (case when coalesce(p_same_city, false) then 1.3::double precision else 1::double precision end)
    * (case when coalesce(p_lang_match, false) then 1.0::double precision else 0.35::double precision end)
    - 0.2::double precision * least(greatest(coalesce(p_reports, 0), 0), 5)::double precision;
$$;

-- ── 5) get_feed_ranked ───────────────────────────────────────────────────────
create or replace function public.get_feed_ranked(
  p_lang   text,
  p_cursor text default null,
  p_limit  int  default 20
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid     uuid := auth.uid();
  v_lim     int  := least(greatest(coalesce(p_limit, 20), 1), 50);
  v_lang    text := lower(coalesce(nullif(btrim(p_lang), ''), 'tr'));
  v_asof    timestamptz := now();
  v_pos     int  := 0;
  v_last    uuid;
  v_parts   text[];
  v_city    text;
  -- aday dizileri (sıra: sabitlenmiş → puan azalan → id azalan)
  a_id       uuid[];
  a_author   uuid[];
  a_official boolean[];
  a_pinned   boolean[];
  a_score    double precision[];
  e_idx      int[];   -- keşif adayları (a_* dizinleri; ağırlıklı etkileşim azalan)
  n          int;
  v_target   int;
  seq        int[] := '{}';
  used       boolean[];
  v_len      int;
  v_slot     int;
  v_np_slot  int := 0;
  v_block    int := -1;
  v_off_cnt  int := 0;
  v_ptr      int;
  v_eptr     int := 1;
  v_pick     int;
  v_cnt      int;
  i          int;
  j          int;
  v_ok       boolean;
  v_start    int;
  v_end      int;
  v_page     uuid[];
  v_next     text;
  v_result   jsonb;
begin
  if v_uid is null then raise exception 'yetkisiz' using errcode = '42501'; end if;
  if not public.feed_flag_enabled('kesfet_siralama') then
    raise exception 'kapali' using errcode = '42501';
  end if;

  if p_cursor is not null then
    begin
      v_parts := string_to_array(convert_from(decode(p_cursor, 'base64'), 'utf8'), '|');
      if v_parts[1] <> 'r1' or array_length(v_parts, 1) <> 5 then raise exception 'bicim'; end if;
      v_asof := to_timestamp((v_parts[2])::bigint / 1e6);
      v_pos  := greatest((v_parts[3])::int, 0);
      v_last := (v_parts[5])::uuid;
    exception when others then
      raise exception 'gecersiz_imlec' using errcode = '22023';
    end;
    if v_asof > now() then v_asof := now(); end if;
  end if;

  -- İzleyenin şehri: varsayılan adres, yoksa en yeni (konum/IP KULLANILMAZ).
  select public.geo_fold(btrim(a.city)) into v_city
    from public.addresses a
   where a.user_id = v_uid and nullif(btrim(a.city), '') is not null
   order by a.is_default desc nulls last, a.created_at desc
   limit 1;

  with base as (
    select p.id, p.author_id, p.published_at, p.lang,
           (p.pinned_until is not null and p.pinned_until > v_asof) as pinned
      from public.posts p
     where (p.status = 'published' or (p.author_id = v_uid and p.status = 'pending'))
       and p.published_at <= v_asof
       and (p.published_at > v_asof - interval '30 days'
            or (p.pinned_until is not null and p.pinned_until > v_asof))
       and public.feed_can_view_author(v_uid, p.author_id)
     order by pinned desc, p.published_at desc, p.id desc
     limit 500
  ),
  d_react as (   -- as_of'tan sonraki tepkiler sayaçtan düşülür (puan sabit kalsın)
    select r.post_id,
           count(*) filter (where r.kind = 'like')::int as likes,
           count(*) filter (where r.kind = 'save')::int as saves
      from public.post_reactions r
     where r.created_at > v_asof and r.post_id in (select id from base)
     group by r.post_id
  ),
  d_adds as (
    select a.post_id, count(*)::int as adds
      from public.post_meal_adds a
     where a.created_at > v_asof and a.post_id in (select id from base)
     group by a.post_id
  ),
  d_comments as (
    select c.post_id, count(*)::int as comments
      from public.post_comments c
     where c.created_at > v_asof and c.status = 'published' and c.post_id in (select id from base)
     group by c.post_id
  ),
  fol as (
    select f.following_id as author_id
      from public.follows f
     where f.follower_id = v_uid and f.created_at <= v_asof
  ),
  inter as (    -- son 30 günde izleyenin etkileşimde bulunduğu yazarlar (as_of'a kadar)
    select p2.author_id
      from public.post_reactions r join public.posts p2 on p2.id = r.post_id
     where r.user_id = v_uid and r.created_at > v_asof - interval '30 days' and r.created_at <= v_asof
    union
    select p2.author_id
      from public.post_meal_adds a join public.posts p2 on p2.id = a.post_id
     where a.user_id = v_uid and a.created_at > v_asof - interval '30 days' and a.created_at <= v_asof
    union
    select p2.author_id
      from public.post_comments c join public.posts p2 on p2.id = c.post_id
     where c.author_id = v_uid and c.created_at > v_asof - interval '30 days' and c.created_at <= v_asof
  ),
  acity as (    -- yazarın şehri (yalnız eşleşme için; dışarı VERİLMEZ)
    select distinct on (a.user_id) a.user_id, public.geo_fold(btrim(a.city)) as city
      from public.addresses a
     where a.user_id in (select distinct author_id from base)
       and nullif(btrim(a.city), '') is not null
     order by a.user_id, a.is_default desc nulls last, a.created_at desc
  ),
  scored as (
    select b.id, b.author_id, b.pinned, b.published_at,
           coalesce(cr.role = 'kurum', false) as official,
           x.likes, x.saves, x.adds, x.comments,
           (4 * x.adds + 3 * x.saves + 2 * x.comments + x.likes) as weighted,
           public.kesfet_rank_score(
             extract(epoch from (v_asof - b.published_at)) / 3600.0,
             x.adds, x.saves, x.comments, x.likes,
             exists (select 1 from fol where fol.author_id = b.author_id),
             exists (select 1 from inter where inter.author_id = b.author_id),
             (v_city is not null and ac.city is not null and ac.city = v_city),
             (lower(b.lang) = v_lang),
             coalesce(s.reports, 0)
           ) as score,
           (lower(b.lang) <> v_lang
            or (v_city is not null and ac.city is not null and ac.city <> v_city)) as other_place
      from base b
      left join public.post_stats s on s.post_id = b.id
      left join d_react dr on dr.post_id = b.id
      left join d_adds da on da.post_id = b.id
      left join d_comments dc on dc.post_id = b.id
      left join acity ac on ac.user_id = b.author_id
      left join public.creators cr on cr.user_id = b.author_id
      cross join lateral (
        select greatest(coalesce(s.likes, 0) - coalesce(dr.likes, 0), 0)       as likes,
               greatest(coalesce(s.saves, 0) - coalesce(dr.saves, 0), 0)       as saves,
               greatest(coalesce(s.adds, 0) - coalesce(da.adds, 0), 0)         as adds,
               greatest(coalesce(s.comments, 0) - coalesce(dc.comments, 0), 0) as comments
      ) x
  ),
  ordered as (
    select sc.*,
           row_number() over (
             order by sc.pinned desc,
                      (case when sc.pinned then extract(epoch from sc.published_at) else sc.score end) desc,
                      sc.id desc
           ) as rn
      from scored sc
  )
  select array_agg(o.id order by o.rn),
         array_agg(o.author_id order by o.rn),
         array_agg(o.official order by o.rn),
         array_agg(o.pinned order by o.rn),
         array_agg(o.score order by o.rn),
         (select array_agg(o2.rn::int order by o2.weighted desc, o2.score desc, o2.id desc)
            from ordered o2
           where not o2.pinned and o2.other_place and o2.weighted >= 3)
    into a_id, a_author, a_official, a_pinned, a_score, e_idx
    from ordered o;

  n := coalesce(array_length(a_id, 1), 0);
  if n = 0 then
    return jsonb_build_object('items', '[]'::jsonb, 'next_cursor', null, 'as_of', v_asof);
  end if;

  -- Sırayı istenen sayfanın sonu + 1 sayfa paya kadar kur (son_id kaymış olabilir).
  v_target := least(n, v_pos + 2 * v_lim);
  used := array_fill(false, array[n]);

  -- (a) Sabitlenmişler en üstte (çeşitlilik sınırı uygulanmaz).
  i := 1;
  while i <= n and a_pinned[i] loop
    seq := seq || i;
    used[i] := true;
    i := i + 1;
  end loop;
  v_ptr := i;

  -- (b) Diğerleri: açgözlü seçim (keşif yuvası + çeşitlilik), uygun yoksa sıradaki.
  loop
    v_len := coalesce(array_length(seq, 1), 0);
    exit when v_len >= v_target;
    v_slot := v_len + 1;
    v_np_slot := v_np_slot + 1;
    if (v_slot - 1) / 20 <> v_block then
      v_block := (v_slot - 1) / 20;
      v_off_cnt := 0;
    end if;
    v_pick := null;

    if v_np_slot % 10 = 0 and e_idx is not null then
      while v_eptr <= array_length(e_idx, 1) and used[e_idx[v_eptr]] loop v_eptr := v_eptr + 1; end loop;
      j := v_eptr;
      while j <= array_length(e_idx, 1) loop
        i := e_idx[j];
        if not used[i] then
          v_ok := not (v_len >= 2 and a_author[seq[v_len]] = a_author[i] and a_author[seq[v_len - 1]] = a_author[i])
                  and not (a_official[i] and v_off_cnt >= 3);
          if v_ok then v_pick := i; exit; end if;
        end if;
        j := j + 1;
      end loop;
    end if;

    if v_pick is null then
      v_cnt := 0;
      i := v_ptr;
      while i <= n loop
        if not used[i] then
          v_cnt := v_cnt + 1;
          v_ok := not (v_len >= 2 and a_author[seq[v_len]] = a_author[i] and a_author[seq[v_len - 1]] = a_author[i])
                  and not (a_official[i] and v_off_cnt >= 3);
          if v_ok then v_pick := i; exit; end if;
          exit when v_cnt >= 50;
        end if;
        i := i + 1;
      end loop;
    end if;

    if v_pick is null then
      i := v_ptr;
      while i <= n loop
        if not used[i] then v_pick := i; exit; end if;
        i := i + 1;
      end loop;
    end if;

    exit when v_pick is null;
    used[v_pick] := true;
    seq := seq || v_pick;
    if a_official[v_pick] then v_off_cnt := v_off_cnt + 1; end if;
    while v_ptr <= n and used[v_ptr] loop v_ptr := v_ptr + 1; end loop;
  end loop;

  -- (c) Sayfa başlangıcı: son_id bulunursa ondan sonra; yoksa konumdan.
  v_len := coalesce(array_length(seq, 1), 0);
  v_start := v_pos + 1;
  if v_last is not null then
    for j in 1 .. v_len loop
      if a_id[seq[j]] = v_last then v_start := j + 1; exit; end if;
    end loop;
  end if;
  v_end := least(v_start + v_lim - 1, v_len);

  if v_start > v_len then
    return jsonb_build_object('items', '[]'::jsonb, 'next_cursor', null, 'as_of', v_asof);
  end if;

  select array_agg(a_id[seq[k]] order by k) into v_page
    from generate_series(v_start, v_end) as k;

  if v_end - v_start + 1 = v_lim and v_end < n then
    v_next := replace(replace(encode(convert_to(
                'r1|' || (extract(epoch from v_asof) * 1e6)::bigint::text || '|' ||
                v_end::text || '|' ||
                round(a_score[seq[v_end]]::numeric, 6)::text || '|' ||
                a_id[seq[v_end]]::text, 'utf8'), 'base64'), E'\n', ''), E'\r', '');
  end if;

  -- (d) Öğe gövdesi get_feed ile AYNI şekil (sayaçlar post_stats'tan, güncel).
  select jsonb_agg(item order by ord)
    into v_result
    from (
      select pg.ord,
        jsonb_build_object(
          'id', p.id,
          'author', jsonb_build_object(
            'id', p.author_id,
            'display_name', coalesce(
              pr.full_name,
              nullif(trim(coalesce(pr.first_name, '') || ' ' || coalesce(pr.last_name, '')), ''),
              pr.handle, 'Kcalculate'),
            'handle', pr.handle,
            'avatar_url', pr.avatar_url,
            'role', cr.role,
            'verified', (cr.verified_at is not null)
          ),
          'published_at', p.published_at,
          'lang', p.lang,
          'body', p.body,
          'post_type', p.post_type,
          'status', p.status,
          'activity_card', p.activity_card,
          'media', coalesce((
            select jsonb_agg(jsonb_build_object(
                     'url', m.url, 'width', m.width, 'height', m.height,
                     'kind', m.kind, 'duration_s', m.duration_s, 'thumb_path', m.thumb_path)
                   order by m.sort, m.id)
            from public.post_media m where m.post_id = p.id
          ), '[]'::jsonb),
          'meal_card', p.meal_card,
          'quote', (
            select jsonb_build_object(
              'id', q.id,
              'author', jsonb_build_object(
                'id', q.author_id,
                'display_name', coalesce(qpr.full_name, qpr.handle, 'Kcalculate'),
                'handle', qpr.handle),
              'body', q.body)
            from public.posts q
            left join public.profiles qpr on qpr.id = q.author_id
            where q.id = p.quote_of and q.status = 'published'
          ),
          'thread', case when p.thread_root is not null then jsonb_build_object(
              'root_id', p.thread_root,
              'index', p.thread_index,
              'total', (select count(*) from public.posts t where t.thread_root = p.thread_root)
            ) else null end,
          'stats', jsonb_build_object(
            'likes', coalesce(s.likes, 0),
            'saves', coalesce(s.saves, 0),
            'adds', coalesce(s.adds, 0),
            'comments', coalesce(s.comments, 0),
            'did_it', (select count(*) from public.activity_logs al
                        where al.source = 'post' and al.source_ref = p.id::text)
          ),
          'me', jsonb_build_object(
            'liked', exists (select 1 from public.post_reactions r
                              where r.post_id = p.id and r.user_id = v_uid and r.kind = 'like'),
            'saved', exists (select 1 from public.post_reactions r
                              where r.post_id = p.id and r.user_id = v_uid and r.kind = 'save')
          )
        ) as item
      from unnest(v_page) with ordinality as pg(id, ord)
      join public.posts p on p.id = pg.id
      left join public.profiles pr on pr.id = p.author_id
      left join public.creators cr on cr.user_id = p.author_id
      left join public.post_stats s on s.post_id = p.id
    ) rows_;

  return jsonb_build_object(
    'items', coalesce(v_result, '[]'::jsonb),
    'next_cursor', v_next,
    'as_of', v_asof
  );
end;
$$;

comment on function public.get_feed_ranked(text, text, int) is
  'G60-S1: Keşfet (for_you) sıralı akış. Bayrak kesfet_siralama. Gizlilik süzgeci get_feed ile aynı; imleç as_of+konum+puan+id.';

revoke all on function public.kesfet_rank_config() from public, anon;
revoke all on function public.kesfet_rank_score(double precision, integer, integer, integer, integer, boolean, boolean, boolean, boolean, integer) from public, anon;
revoke all on function public.get_feed_ranked(text, text, int) from public, anon;
grant execute on function public.kesfet_rank_config() to authenticated;
grant execute on function public.kesfet_rank_score(double precision, integer, integer, integer, integer, boolean, boolean, boolean, boolean, integer) to authenticated;
grant execute on function public.get_feed_ranked(text, text, int) to authenticated;

commit;
