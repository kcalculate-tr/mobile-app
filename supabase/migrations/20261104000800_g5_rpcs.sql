-- G5-S2 — Sözleşme RPC'leri: profil, Gün halkası, AI kotası, şehir kapısı
-- version: 20261104000800  name: g5_rpcs
--
-- DURUM: Bu dosya YALNIZCA yazıldı; canlıya/staging'e UYGULANMADI (gece kuralı).
-- STAGING'DE TEST EDİLMEDİ. Geri alma: 20261104000800_g5_rpcs_rollback.sql
--
-- Tüm fonksiyonlar (G5-CONTRACT.md ilkesi): SECURITY DEFINER, set search_path=public,
-- auth.uid() ile çağıran kimliği, yalnız `authenticated`'a EXECUTE. Yetki ve kota
-- SUNUCUDA denetlenir.
--
-- SORULAR / entegrasyon notu: `follows`, `blocks`, `posts` tabloları S1 (Keşfet)
-- kapsamında ve bu dalda (night5/base) HENÜZ YOK. Bu yüzden get_public_profile'da
-- followers/following/posts=0, me_following=false döner (tahmin yok: yabancı şema
-- kolonları bilinmiyor). Entegrasyonda S1 tabloları gelince bu sayaçlar ayrı küçük
-- bir migration ile bağlanır. get_day_rings şimdilik yalnız "ben"i döndürür;
-- takip edilenlerin halkaları follows tablosu gelince eklenir.

begin;

-- ════════════════════════════════════════════════════════════════════════════
-- claim_handle(p_handle) → { ok bool, reason text|null }
--   reason: 'auth' | 'format' | 'reserved' | 'taken' | null(başarılı)
-- ════════════════════════════════════════════════════════════════════════════
create or replace function public.claim_handle(p_handle text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid    uuid := auth.uid();
  v_handle text;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'reason', 'auth');
  end if;
  v_handle := lower(btrim(coalesce(p_handle, '')));
  if v_handle !~ '^[a-z0-9_]{3,30}$' then
    return jsonb_build_object('ok', false, 'reason', 'format');
  end if;
  -- Basit rezerve ad listesi (kötüye kullanım/karışıklık engeli).
  if v_handle in ('admin','administrator','kcal','kcalculate','eatkcal','support',
                  'destek','root','null','system','moderator','help') then
    return jsonb_build_object('ok', false, 'reason', 'reserved');
  end if;
  if exists (select 1 from public.profiles
             where lower(handle) = v_handle and id <> v_uid) then
    return jsonb_build_object('ok', false, 'reason', 'taken');
  end if;
  update public.profiles set handle = v_handle where id = v_uid;
  return jsonb_build_object('ok', true, 'reason', null);
end;
$$;

-- ════════════════════════════════════════════════════════════════════════════
-- update_public_profile(p_display_name, p_bio, p_avatar_url) → void
--   display_name → profiles.full_name. NULL argüman = ilgili alanı DEĞİŞTİRME.
-- ════════════════════════════════════════════════════════════════════════════
create or replace function public.update_public_profile(
  p_display_name text default null,
  p_bio          text default null,
  p_avatar_url   text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'auth required';
  end if;
  if p_bio is not null and char_length(p_bio) > 160 then
    raise exception 'bio en fazla 160 karakter olabilir';
  end if;
  update public.profiles
     set full_name  = coalesce(p_display_name, full_name),
         bio        = coalesce(p_bio,          bio),
         avatar_url = coalesce(p_avatar_url,   avatar_url)
   where id = v_uid;
end;
$$;

-- ════════════════════════════════════════════════════════════════════════════
-- get_public_profile(p_handle) → { id, display_name, handle, avatar_url, bio,
--   role, verified, is_private, followers, following, posts, me_following }
--   verified = (role <> 'customer'). Sosyal sayaçlar: follows/posts tabloları
--   gelene kadar 0 / false (bkz. üstteki SORULAR notu). Handle yoksa NULL döner.
-- ════════════════════════════════════════════════════════════════════════════
create or replace function public.get_public_profile(p_handle text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  p public.profiles%rowtype;
begin
  select * into p from public.profiles
   where lower(handle) = lower(btrim(coalesce(p_handle, '')));
  if not found then
    return null;
  end if;
  return jsonb_build_object(
    'id',           p.id,
    'display_name', p.full_name,
    'handle',       p.handle,
    'avatar_url',   p.avatar_url,
    'bio',          p.bio,
    'role',         p.role,
    'verified',     (p.role is not null and p.role <> 'customer'),
    'is_private',   coalesce(p.is_private, false),
    'followers',    0,
    'following',    0,
    'posts',        0,
    'me_following', false
  );
end;
$$;

-- ════════════════════════════════════════════════════════════════════════════
-- share_meal_to_day(p_consumption) → void
--   Kullanıcı yalnız KENDİ öğününü paylaşır. Tekrar paylaşım 24 saati tazeler.
-- ════════════════════════════════════════════════════════════════════════════
create or replace function public.share_meal_to_day(p_consumption uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'auth required';
  end if;
  if not exists (select 1 from public.meal_consumptions
                 where id = p_consumption and user_id = v_uid) then
    raise exception 'öğün bulunamadı veya size ait değil';
  end if;
  insert into public.day_shares (user_id, consumption_id)
  values (v_uid, p_consumption)
  on conflict (user_id, consumption_id)
  do update set created_at = now(), expires_at = now() + interval '24 hours';
end;
$$;

-- ════════════════════════════════════════════════════════════════════════════
-- get_day_rings() → [{ user:{id,display_name,avatar_url}, progress, streak, has_new }]
--   İlk öğe = ben. progress 0-1 (bugün kcal / hedef). streak = ardışık öğün günü.
--   has_new = son 24 saatte aktif paylaşım var mı. (Takip edilenler: follows gelince.)
-- ════════════════════════════════════════════════════════════════════════════
create or replace function public.get_day_rings()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid    uuid := auth.uid();
  v_today  date := (now() at time zone 'Europe/Istanbul')::date;
  v_me     public.profiles%rowtype;
  v_target numeric;
  v_cal    numeric;
  v_prog   numeric := 0;
  v_streak integer := 0;
  v_day    date;
  v_hasnew boolean;
begin
  if v_uid is null then
    raise exception 'auth required';
  end if;
  select * into v_me from public.profiles where id = v_uid;

  -- Hedef kalori: özel makro açıksa custom, değilse target; yoksa progress=0.
  select coalesce(
           nullif(case when use_custom_macros then custom_calories else target_calories end, 0),
           nullif(target_calories, 0)
         )::numeric
    into v_target
    from public.user_nutrition_profiles
   where user_id = v_uid;

  select coalesce(sum(calories), 0)::numeric
    into v_cal
    from public.meal_consumptions
   where user_id = v_uid
     and (consumed_at at time zone 'Europe/Istanbul')::date = v_today;

  if v_target is not null and v_target > 0 then
    v_prog := least(1.0, round(v_cal / v_target, 4));
  end if;

  -- Streak: bugünden (bugün boşsa dünden) geriye ardışık öğün olan günler.
  v_day := v_today;
  if not exists (select 1 from public.meal_consumptions
                 where user_id = v_uid
                   and (consumed_at at time zone 'Europe/Istanbul')::date = v_day) then
    v_day := v_today - 1;
  end if;
  loop
    if exists (select 1 from public.meal_consumptions
               where user_id = v_uid
                 and (consumed_at at time zone 'Europe/Istanbul')::date = v_day) then
      v_streak := v_streak + 1;
      v_day := v_day - 1;
    else
      exit;
    end if;
  end loop;

  v_hasnew := exists (select 1 from public.day_shares
                      where user_id = v_uid and expires_at > now());

  return jsonb_build_array(
    jsonb_build_object(
      'user', jsonb_build_object(
        'id',           v_me.id,
        'display_name', v_me.full_name,
        'avatar_url',   v_me.avatar_url
      ),
      'progress', v_prog,
      'streak',   v_streak,
      'has_new',  v_hasnew
    )
  );
end;
$$;

-- ════════════════════════════════════════════════════════════════════════════
-- get_day_cards(p_user) → [{ id, consumption_id, name, meal_type, consumed_at,
--   photo_url, kcal, protein_g }]  (son 24 saat; erişim SUNUCUDA kesilir)
--   photo_url = user-media kovasındaki YOL (istemci imzalı URL üretir).
--   Görünürlük: kendisi → serbest; başkası → yalnız AÇIK hesap (gizli hesapta
--   takip doğrulanamadığı için güvenli tarafta boş döner; follows gelince gevşer).
-- ════════════════════════════════════════════════════════════════════════════
create or replace function public.get_day_cards(p_user uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid     uuid := auth.uid();
  v_private boolean;
  v_result  jsonb;
begin
  if v_uid is null then
    raise exception 'auth required';
  end if;

  if p_user <> v_uid then
    select coalesce(is_private, false) into v_private
      from public.profiles where id = p_user;
    if not found then
      return '[]'::jsonb;
    end if;
    -- Gizli hesap: takip/engelleme follows tablosu gelene kadar doğrulanamaz →
    -- güvenli taraf (boş). Açık hesap: paylaşılan kartlar görünür.
    if v_private then
      return '[]'::jsonb;
    end if;
  end if;

  select coalesce(jsonb_agg(
           jsonb_build_object(
             'id',             ds.id,
             'consumption_id', mc.id,
             'name',           mc.name,
             'meal_type',      mc.meal_type,
             'consumed_at',    mc.consumed_at,
             'photo_url',      mc.photo_path,
             'kcal',           mc.calories,
             'protein_g',      mc.protein
           ) order by mc.consumed_at desc
         ), '[]'::jsonb)
    into v_result
    from public.day_shares ds
    join public.meal_consumptions mc on mc.id = ds.consumption_id
   where ds.user_id = p_user
     and ds.expires_at > now();

  return v_result;
end;
$$;

-- ════════════════════════════════════════════════════════════════════════════
-- reserve_ai_scan(p_idempotency_key) → { ok bool, remaining int, reset_at tstz }
--   Atomik: usage satırı FOR UPDATE ile kilitlenir. Kullanıcı limiti + genel tavan
--   sunucuda. Aynı idempotency_key iki kez saymaz. Sıfırlama: Europe/Istanbul 00:00.
-- ════════════════════════════════════════════════════════════════════════════
create or replace function public.reserve_ai_scan(p_idempotency_key text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid        uuid    := auth.uid();
  v_today      date    := (now() at time zone 'Europe/Istanbul')::date;
  v_reset      timestamptz := ((v_today + 1)::timestamp) at time zone 'Europe/Istanbul';
  v_user_limit integer;
  v_global_cap integer;
  v_used       integer;
  v_global     integer;
  v_status     text;
begin
  if v_uid is null then
    raise exception 'auth required';
  end if;
  if coalesce(btrim(p_idempotency_key), '') = '' then
    raise exception 'idempotency_key gerekli';
  end if;

  select coalesce((value::text)::int, 3)
    into v_user_limit from public.app_settings where key = 'ai_scan_user_daily_limit';
  v_user_limit := coalesce(v_user_limit, 3);
  select coalesce((value::text)::int, 1000)
    into v_global_cap from public.app_settings where key = 'ai_scan_daily_cap';
  v_global_cap := coalesce(v_global_cap, 1000);

  -- Idempotency: aynı anahtar zaten 'reserved' ise tekrar sayma, mevcut durumu dön.
  select status into v_status
    from public.ai_scan_reservations where idempotency_key = p_idempotency_key;
  if v_status = 'reserved' then
    select coalesce(used, 0) into v_used
      from public.ai_scan_usage where user_id = v_uid and day = v_today;
    return jsonb_build_object('ok', true,
      'remaining', greatest(0, v_user_limit - coalesce(v_used, 0)),
      'reset_at', v_reset);
  end if;

  -- Usage satırını oluştur + kilitle (eşzamanlı rezervleri seri hale getirir).
  insert into public.ai_scan_usage (user_id, day, used)
  values (v_uid, v_today, 0)
  on conflict (user_id, day) do nothing;
  select used into v_used
    from public.ai_scan_usage where user_id = v_uid and day = v_today for update;

  if v_used >= v_user_limit then
    return jsonb_build_object('ok', false, 'remaining', 0, 'reset_at', v_reset);
  end if;

  -- Genel günlük tavan (maliyet koruması).
  select coalesce(sum(used), 0) into v_global
    from public.ai_scan_usage where day = v_today;
  if v_global >= v_global_cap then
    return jsonb_build_object('ok', false,
      'remaining', greatest(0, v_user_limit - v_used), 'reset_at', v_reset);
  end if;

  update public.ai_scan_usage set used = used + 1
   where user_id = v_uid and day = v_today;

  insert into public.ai_scan_reservations (idempotency_key, user_id, day, status)
  values (p_idempotency_key, v_uid, v_today, 'reserved')
  on conflict (idempotency_key) do update set status = 'reserved';

  return jsonb_build_object('ok', true,
    'remaining', greatest(0, v_user_limit - (v_used + 1)), 'reset_at', v_reset);
end;
$$;

-- ════════════════════════════════════════════════════════════════════════════
-- release_ai_scan(p_idempotency_key) → void
--   Başarısız analizde hakkı iade eder (status=released + sayacı azaltır).
--   Yalnız 'reserved' durumdaki, çağırana ait rezervasyon iade edilir (idempotent).
-- ════════════════════════════════════════════════════════════════════════════
create or replace function public.release_ai_scan(p_idempotency_key text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_day date;
  v_st  text;
begin
  if v_uid is null then
    raise exception 'auth required';
  end if;
  select day, status into v_day, v_st
    from public.ai_scan_reservations
   where idempotency_key = p_idempotency_key and user_id = v_uid
   for update;
  if not found or v_st <> 'reserved' then
    return;  -- yok veya zaten iade edilmiş → idempotent no-op
  end if;
  update public.ai_scan_reservations set status = 'released'
   where idempotency_key = p_idempotency_key;
  update public.ai_scan_usage set used = greatest(0, used - 1)
   where user_id = v_uid and day = v_day;
end;
$$;

-- ════════════════════════════════════════════════════════════════════════════
-- check_delivery_city(p_city) → { ok bool, message text }
--   Yalnız İzmir true (teslimat kapısı). Türkçe büyük/küçük harf normalize edilir.
-- ════════════════════════════════════════════════════════════════════════════
create or replace function public.check_delivery_city(p_city text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_norm text;
begin
  v_norm := lower(replace(replace(replace(btrim(coalesce(p_city, '')),
                                          'İ', 'i'), 'I', 'i'), 'ı', 'i'));
  if v_norm = 'izmir' then
    return jsonb_build_object('ok', true,  'message', 'İzmir''e teslimat yapıyoruz.');
  end if;
  return jsonb_build_object('ok', false,
    'message', 'Şu an yalnızca İzmir''e teslimat yapıyoruz.');
end;
$$;

-- ── Yetkiler: yalnız authenticated çağırır; anon/public yok ──────────────────
revoke all on function public.claim_handle(text)                          from public, anon;
revoke all on function public.update_public_profile(text, text, text)     from public, anon;
revoke all on function public.get_public_profile(text)                    from public, anon;
revoke all on function public.share_meal_to_day(uuid)                     from public, anon;
revoke all on function public.get_day_rings()                             from public, anon;
revoke all on function public.get_day_cards(uuid)                         from public, anon;
revoke all on function public.reserve_ai_scan(text)                       from public, anon;
revoke all on function public.release_ai_scan(text)                       from public, anon;
revoke all on function public.check_delivery_city(text)                   from public, anon;

grant execute on function public.claim_handle(text)                       to authenticated;
grant execute on function public.update_public_profile(text, text, text)  to authenticated;
grant execute on function public.get_public_profile(text)                 to authenticated;
grant execute on function public.share_meal_to_day(uuid)                  to authenticated;
grant execute on function public.get_day_rings()                          to authenticated;
grant execute on function public.get_day_cards(uuid)                      to authenticated;
grant execute on function public.reserve_ai_scan(text)                    to authenticated;
grant execute on function public.release_ai_scan(text)                    to authenticated;
grant execute on function public.check_delivery_city(text)               to authenticated;

commit;
