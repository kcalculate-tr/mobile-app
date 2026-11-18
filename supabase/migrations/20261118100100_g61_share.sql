-- G61-S1 — Paylaşım paketi: herkese açık anlık görüntüler + web önizleme okuma uçları (18 Kas).
-- DURUM: YALNIZ DOSYA (canlıya UYGULANMADI). İdempotent: tekrar çalıştırmak güvenli.
-- Rollback: supabase/rollbacks/20261118100100_g61_share_rollback.sql
--
-- İçerik:
--  1) share_snapshots (id kısa, kind meal|day|xray, owner, payload jsonb, created_at, revoked_at)
--     payload YALNIZ FinShareNotes "Gösterdiği veri" alanları — share_payload_clean() sunucuda
--     da süzer (istemci src/lib/share/cardModel.ts ile aynı beyaz liste). Kilo, hedef, gün
--     toplamı, sağlık, konum, abonelik ASLA yok.
--  2) create_share_snapshot(p_kind, p_payload) → kısa kimlik (yalnız oturumlu; günde ≤ 100).
--     get_share_snapshot(p_id) → anon da okur (iptal edilmişse boş).
--     revoke_share_snapshot(p_id) → yalnız sahibi.
--  3) get_share_preview(p_kind, p_id) → l.eatkcal.com önizlemesi (anon). Gönderi / profil / tarif /
--     hikâye / davet / öğün / gün / röntgen için YALNIZ herkese açık alanlar; gizli hesap, silinmiş,
--     kaldırılmış, süresi dolmuş içerik → {gone:true} (hikâye: {expired:true} + profil).
--  4) analytics_event_names: share_open, share_target.
--  Bayraklar mevcut: paylasim_karti (20261104000900), paylasim_baglanti (20261111200100) — KAPALI kalır.
begin;

-- ─── 1) share_snapshots ───────────────────────────────────────────────────────
create table if not exists public.share_snapshots (
  id          text        primary key check (id ~ '^[A-Za-z0-9]{10}$'),
  kind        text        not null check (kind in ('meal', 'day', 'xray')),
  owner       uuid        not null references auth.users(id) on delete cascade,
  payload     jsonb       not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  revoked_at  timestamptz
);
create index if not exists share_snapshots_owner_idx on public.share_snapshots (owner, created_at desc);
comment on table public.share_snapshots is
  'G61: paylaşılan öğün/gün/röntgen kartının herkese açık anlık görüntüsü (l.eatkcal.com/m|d|x/<id>). payload yalnız izinli alanlar; revoked_at dolu → "Bu içerik artık yok".';

alter table public.share_snapshots enable row level security;
drop policy if exists share_snapshots_owner_read on public.share_snapshots;
create policy share_snapshots_owner_read on public.share_snapshots
  for select to authenticated using (owner = auth.uid());
-- Yazma yalnız RPC (security definer) ile: doğrudan insert/update/delete politikası YOK.
revoke all on public.share_snapshots from anon, authenticated;
grant select on public.share_snapshots to authenticated;

-- Beyaz liste (cardModel.ts ALLOWED_FIELDS ile aynı; foto yolu anlık görüntüye girmez).
create or replace function public.share_payload_clean(p_kind text, p_payload jsonb)
returns jsonb
language plpgsql
immutable
set search_path = public
as $$
declare
  v_keys text[];
  v_out  jsonb := '{}'::jsonb;
  k      text;
  v      jsonb;
begin
  v_keys := case p_kind
    when 'meal' then array['mealLabel', 'name', 'kcal', 'protein', 'carbs', 'fat']
    when 'day'  then array['pct', 'meals', 'protein', 'waterL', 'steps', 'dateLabel']
    when 'xray' then array['name', 'totalKcal', 'protein', 'carbs', 'fat', 'items']
    else array[]::text[]
  end;
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then return v_out; end if;
  foreach k in array v_keys loop
    v := p_payload -> k;
    if v is null or jsonb_typeof(v) = 'null' then continue; end if;
    if k in ('mealLabel', 'name', 'dateLabel') then
      if jsonb_typeof(v) = 'string' then v_out := v_out || jsonb_build_object(k, left(v #>> '{}', 80)); end if;
    elsif k = 'items' then
      if jsonb_typeof(v) = 'array' then
        v_out := v_out || jsonb_build_object('items', coalesce((
          select jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
                   'name', left(e ->> 'name', 40),
                   'kcal', case when jsonb_typeof(e -> 'kcal') = 'number' then (e -> 'kcal') end)))
            from (select e from jsonb_array_elements(v) e
                   where jsonb_typeof(e) = 'object' and jsonb_typeof(e -> 'name') = 'string' limit 3) s
        ), '[]'::jsonb));
      end if;
    elsif jsonb_typeof(v) = 'number' and (v #>> '{}')::numeric >= 0 and (v #>> '{}')::numeric < 1000000 then
      v_out := v_out || jsonb_build_object(k, v);
    end if;
  end loop;
  return v_out;
end;
$$;

create or replace function public.share_new_id()
returns text
language plpgsql
volatile
set search_path = public, extensions
as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  b bytea;
  s text := '';
  i int;
begin
  b := extensions.gen_random_bytes(10);
  for i in 0..9 loop
    s := s || substr(alphabet, (get_byte(b, i) % length(alphabet)) + 1, 1);
  end loop;
  return s;
end;
$$;

create or replace function public.create_share_snapshot(p_kind text, p_payload jsonb)
returns text
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_id  text;
  v_try int := 0;
begin
  if v_uid is null then raise exception 'yetkisiz' using errcode = '42501'; end if;
  if p_kind not in ('meal', 'day', 'xray') then raise exception 'geçersiz tür' using errcode = '22023'; end if;
  if (select count(*) from public.share_snapshots s where s.owner = v_uid and s.created_at > now() - interval '1 day') >= 100 then
    raise exception 'günlük paylaşım sınırı' using errcode = '54000';
  end if;
  loop
    v_id := public.share_new_id();
    begin
      insert into public.share_snapshots (id, kind, owner, payload)
      values (v_id, p_kind, v_uid, public.share_payload_clean(p_kind, p_payload));
      return v_id;
    exception when unique_violation then
      v_try := v_try + 1;
      if v_try > 5 then raise; end if;
    end;
  end loop;
end;
$$;

create or replace function public.get_share_snapshot(p_id text)
returns table (kind text, payload jsonb, created_at timestamptz, owner_name text, owner_handle text)
language sql
stable
security definer
set search_path = public
as $$
  select s.kind, s.payload, s.created_at,
         case when coalesce(pr.is_private, false) then null
              else coalesce(nullif(pr.full_name, ''), nullif(trim(coalesce(pr.first_name, '') || ' ' || coalesce(pr.last_name, '')), '')) end,
         case when coalesce(pr.is_private, false) then null else pr.handle end
    from public.share_snapshots s
    left join public.profiles pr on pr.id = s.owner
   where s.id = p_id and s.revoked_at is null;
$$;

create or replace function public.revoke_share_snapshot(p_id text)
returns boolean
language plpgsql
volatile
security definer
set search_path = public
as $$
declare v_n int;
begin
  if auth.uid() is null then raise exception 'yetkisiz' using errcode = '42501'; end if;
  update public.share_snapshots set revoked_at = now()
   where id = p_id and owner = auth.uid() and revoked_at is null;
  get diagnostics v_n = row_count;
  return v_n > 0;
end;
$$;

revoke all on function public.share_payload_clean(text, jsonb) from public;
revoke all on function public.share_new_id() from public;
revoke all on function public.create_share_snapshot(text, jsonb) from public, anon;
revoke all on function public.get_share_snapshot(text) from public;
revoke all on function public.revoke_share_snapshot(text) from public, anon;
grant execute on function public.create_share_snapshot(text, jsonb) to authenticated;
grant execute on function public.get_share_snapshot(text) to anon, authenticated;
grant execute on function public.revoke_share_snapshot(text) to authenticated;

-- ─── 3) Web önizleme (anon) ───────────────────────────────────────────────────
-- Dönüş: {kind, gone?, expired?, ...yalnız herkese açık alanlar}. Beğeni/yorum/görüntüleme sayısı,
-- takipçi listesi, görenler, tepkiler YOK (FinShareNotes "Asla göstermediği veri").
create or replace function public.get_share_preview(p_kind text, p_id text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v jsonb;
  v_uuid uuid;
begin
  if p_kind in ('post', 'story') then
    begin
      v_uuid := p_id::uuid;
    exception when others then
      return jsonb_build_object('kind', p_kind, 'gone', true);
    end;
  end if;

  if p_kind = 'post' then
    select jsonb_build_object(
             'kind', 'post',
             'author_name', coalesce(nullif(pr.full_name, ''), nullif(trim(coalesce(pr.first_name, '') || ' ' || coalesce(pr.last_name, '')), ''), pr.handle, 'Kcalculate'),
             'handle', pr.handle,
             'text', left(p.body, 300),
             'image', (select m.url from public.post_media m where m.post_id = p.id order by m.sort, m.id limit 1))
      into v
      from public.posts p
      left join public.profiles pr on pr.id = p.author_id
     where p.id = v_uuid and p.status = 'published' and not coalesce(pr.is_private, false);
  elsif p_kind = 'profile' then
    select jsonb_build_object(
             'kind', 'profile',
             'name', coalesce(nullif(pr.full_name, ''), nullif(trim(coalesce(pr.first_name, '') || ' ' || coalesce(pr.last_name, '')), ''), pr.handle),
             'handle', pr.handle,
             'bio', left(pr.bio, 160),
             'avatar', pr.avatar_url)
      into v
      from public.profiles pr
     where lower(pr.handle) = lower(p_id) and not coalesce(pr.is_private, false);
  elsif p_kind = 'recipe' then
    select jsonb_build_object(
             'kind', 'recipe',
             'name_tr', r.name_tr, 'name_en', r.name_en,
             'kcal', r.kcal, 'protein', r.protein,
             'image', r.photo_url,
             'ings_tr', coalesce((select jsonb_agg(x.name_tr) from (
                 select i.name_tr from public.recipe_ingredients ri join public.ingredient_nutrition i on i.key = ri.ingredient_key
                  where ri.recipe_key = r.key order by ri.grams desc, ri.position limit 3) x), '[]'::jsonb),
             'ings_en', coalesce((select jsonb_agg(x.name_en) from (
                 select i.name_en from public.recipe_ingredients ri join public.ingredient_nutrition i on i.key = ri.ingredient_key
                  where ri.recipe_key = r.key order by ri.grams desc, ri.position limit 3) x), '[]'::jsonb))
      into v
      from public.recipes r
     where r.key = p_id and r.status = 'published';
  elsif p_kind = 'story' then
    if to_regclass('public.stories') is null then
      return jsonb_build_object('kind', 'story', 'gone', true);
    end if;
    execute $q$
      select jsonb_build_object(
               'kind', 'story',
               'expired', (s.expires_at <= now()),
               'author_name', coalesce(nullif(pr.full_name, ''), pr.handle),
               'handle', pr.handle,
               'avatar', pr.avatar_url)
        from public.stories s
        join public.profiles pr on pr.id = s.author_id
       where s.id = $1 and s.deleted_at is null and s.status = 'published' and not coalesce(pr.is_private, false)
    $q$ into v using v_uuid;
  elsif p_kind = 'invite' then
    if to_regclass('public.referral_codes') is not null then
      execute $q$ select jsonb_build_object('kind', 'invite', 'code', rc.code) from public.referral_codes rc where rc.code = upper($1) $q$
        into v using p_id;
    end if;
  elsif p_kind in ('meal', 'day', 'xray') then
    select jsonb_build_object('kind', s.kind) || s.payload
      into v
      from public.share_snapshots s
     where s.id = p_id and s.kind = p_kind and s.revoked_at is null;
  end if;

  return coalesce(v, jsonb_build_object('kind', p_kind, 'gone', true));
end;
$$;
revoke all on function public.get_share_preview(text, text) from public;
grant execute on function public.get_share_preview(text, text) to anon, authenticated;

-- ─── 4) Olay adları ───────────────────────────────────────────────────────────
do $$
begin
  if to_regclass('public.analytics_event_names') is null then
    raise notice 'g61_share: analytics_event_names yok — olay satırları atlandı';
    return;
  end if;
  insert into public.analytics_event_names
    (name, category, source, description_tr, description_en, props_hint, alias_of, is_kpi)
  values
    ('share_open', 'social', 'client', 'Paylaş sayfası açıldı', 'Share sheet opened', 'kind: meal|day|post|profile|recipe|invite|xray|story, surface: text', null, false),
    ('share_target', 'social', 'client', 'Paylaşım hedefi seçildi', 'Share target chosen', 'kind, target: ig_story|ig_post|whatsapp|x|copy|save|other, size: story|post, bg: light|dark|photo, ok: boolean', null, false)
  on conflict (name) do nothing;
end $$;

commit;
