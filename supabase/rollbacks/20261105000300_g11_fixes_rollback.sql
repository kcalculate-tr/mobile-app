-- GERİ ALMA — 20261105000300_g11_fixes.sql. Her nesne G11 ÖNCESİ (g9_fixes/g8_social/
-- g5_rpcs) tanımına döndürülür. Bu dosya G6-APPLY listesinden UYGULANMAZ; yalnız geri
-- alma gerekirse elle çalıştırılır. İstemci (handle.ts) değişikliğini ayrıca git ile
-- geri al. Uygulama sırası: bu dosyayı en son uygulanan (#16) ÖNCE geri al.

begin;

-- ── 1 geri: claim_handle/check_handle → g9_fixes tanımı (rezerve kontrolü YOK).
create or replace function public.claim_handle(p_handle text)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  v_uid     uuid := auth.uid();
  v_handle  text;
  v_current text;
begin
  if v_uid is null then raise exception 'yetkisiz' using errcode = '42501'; end if;
  v_handle := lower(btrim(coalesce(p_handle, '')));
  if char_length(v_handle) < 3 or char_length(v_handle) > 30
     or v_handle !~ '^[a-z0-9_]+(\.[a-z0-9_]+)*$' then
    return jsonb_build_object('ok', false, 'reason', 'format');
  end if;
  select handle into v_current from public.profiles where id = v_uid;
  if v_current is not distinct from v_handle then
    return jsonb_build_object('ok', true, 'reason', null);
  end if;
  if exists (select 1 from public.profiles where handle = v_handle and id <> v_uid) then
    return jsonb_build_object('ok', false, 'reason', 'taken');
  end if;
  perform set_config('app.profile_rpc', 'on', true);
  update public.profiles set handle = v_handle where id = v_uid;
  return jsonb_build_object('ok', true, 'reason', null);
end;
$$;

create or replace function public.check_handle(p_handle text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_uid    uuid := auth.uid();
  v_handle text;
begin
  v_handle := lower(btrim(coalesce(p_handle, '')));
  if char_length(v_handle) < 3 or char_length(v_handle) > 30
     or v_handle !~ '^[a-z0-9_]+(\.[a-z0-9_]+)*$' then
    return jsonb_build_object('available', false, 'reason', 'format');
  end if;
  if exists (select 1 from public.profiles where handle = v_handle and id <> coalesce(v_uid, '00000000-0000-0000-0000-000000000000'::uuid)) then
    return jsonb_build_object('available', false, 'reason', 'taken');
  end if;
  return jsonb_build_object('available', true, 'reason', null);
end;
$$;

drop function if exists public.handle_is_reserved(text);

-- ── 2 geri: truncate/trigger/references yetkileri hardening amaçlıdır; geri alma
--    bunları YENİDEN VERMEZ (istemci hiç kullanmıyordu). Gerçekten gerekirse elle
--    `grant truncate, trigger, references on public.<tablo> to authenticated;`.

-- ── 3 geri: post-media çift politikası (creator_* + writer_*) birlikte geri gelir.
--    writer_* zaten yukarıdaki migration'da yeniden oluşturuldu; creator_*'ı
--    (g9_fixes gövdesiyle) geri ekle.
drop policy if exists post_media_creator_insert on storage.objects;
create policy post_media_creator_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'post-media'
    and (storage.foldername(name))[1] = 'posts'
    and (storage.foldername(name))[2] = auth.uid()::text
    and (public.feed_can_post(auth.uid()) or public.feed_flag_enabled('kesfet_paylasim'))
  );
drop policy if exists post_media_creator_update on storage.objects;
create policy post_media_creator_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'post-media'
    and (storage.foldername(name))[2] = auth.uid()::text
    and (public.feed_can_post(auth.uid()) or public.feed_flag_enabled('kesfet_paylasim'))
  )
  with check (
    bucket_id = 'post-media'
    and (storage.foldername(name))[2] = auth.uid()::text
    and (public.feed_can_post(auth.uid()) or public.feed_flag_enabled('kesfet_paylasim'))
  );
drop policy if exists post_media_creator_delete on storage.objects;
create policy post_media_creator_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'post-media'
    and (storage.foldername(name))[2] = auth.uid()::text
    and (public.feed_can_post(auth.uid()) or public.feed_flag_enabled('kesfet_paylasim'))
  );

-- ── 4 geri: posts_guard_protected_cols → g9_fixes tanımı (gövde dalı YOK);
--    update_my_post kaldır.
create or replace function public.posts_guard_protected_cols()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_claims   text := current_setting('request.jwt.claims', true);
  v_role     text := case when v_claims is null or v_claims = '' then null
                          else (v_claims::jsonb ->> 'role') end;
  v_post_rpc boolean := coalesce(current_setting('app.post_rpc', true), '') = 'on';
begin
  if v_role is null or v_role = 'service_role' then
    return NEW;
  end if;
  if public.feed_is_moderator(auth.uid()) or public.is_admin() then
    return NEW;
  end if;
  if not v_post_rpc then
    if NEW.status is distinct from OLD.status
       or NEW.pinned_until is distinct from OLD.pinned_until
       or NEW.author_id is distinct from OLD.author_id then
      raise exception 'posts_guard: status/pinned_until/author_id yalnızca moderatör veya ilgili RPC ile değiştirilebilir';
    end if;
  end if;
  return NEW;
end;
$$;

drop function if exists public.update_my_post(uuid, text);

-- ── 5 geri: search_products kaldır.
drop function if exists public.search_products(text, int);

-- ── 6 geri: bayrak yönetimi RPC'leri + audit tablosu kaldır.
drop function if exists public.admin_list_flags();
drop function if exists public.admin_set_flag(text, boolean, int, text, text[]);
drop function if exists public.admin_flag_unlock(text, uuid, boolean);
drop function if exists public.admin_find_user(text);
drop table    if exists public.feature_flag_audit;

-- ── 7 geri: yeni_kabuk bayrak satırını sil.
delete from public.feature_flags where key = 'yeni_kabuk';

commit;
