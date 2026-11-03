-- G11-S1 — Son sunucu düzeltmeleri + yeni RPC'ler. Tek migration.
-- version: 20261105000300  name: g11_fixes
--
-- DURUM: YALNIZ DOSYA. Hiçbir yere uygulanmadı (gece kuralı). Geri alma:
--   supabase/rollbacks/20261105000300_g11_fixes_rollback.sql
-- Önkoşul (G6-APPLY sırası): #0–#15 uygulanmış olmalı. EN SON (#16) bu uygulanır.
--
-- Bu dosya 7 sunucu maddesini kapatır (G11-S1 görevi, G11-CONTRACT ile birebir):
--   1. Ayrılmış kullanıcı adları: public.handle_is_reserved() + claim_handle/
--      check_handle rezerve kontrolü (istemci handle.ts ile ortak liste/kural).
--   2. Yetki sıkılaştırma: tüm G5–G8 sosyal tablolarında anon/authenticated'tan
--      truncate/trigger/references revoke (defense-in-depth).
--   3. Yinelenen post-media storage politikaları: creator_*/writer_* çifti tek
--      writer_* politikasına indirildi (davranış aynı).
--   4. Gövde düzenleme yeniden denetim: update_my_post + posts guard'ına gövde
--      değişimi dalı (yayındaki gönderinin gövdesi değişirse status=pending +
--      moderation_queue; doğrudan UPDATE açığı da kapanır).
--   5. search_products(p_q, p_limit): aktif ürün arama (SECURITY INVOKER —
--      products herkese okunur; kolon eşlemesi aşağıda + LOG + CANLI-SIRA).
--   6. Bayrak yönetimi RPC'leri (admin_list_flags/admin_set_flag/admin_flag_unlock/
--      admin_find_user) + feature_flag_audit tablosu + RLS (yalnız admin okur).
--   7. yeni_kabuk bayrak satırı (enabled=false, rollout_percent=0,
--      min_app_version='1.1.0'). get_my_features min_app_version'ı zaten uygular
--      (doğrulandı; SQL değişikliği yok, yalnız bayrak satırı).
--
-- search_products kolon eşlemesi (CANLI DOĞRULAMA GEREKLİ — bkz. G11-CANLI-SIRA):
-- Canlı okuma harness güvenlik sınıflandırıcısı tarafından bloklandı; eşleme
-- repodaki istemci sorgusundan (src/lib/categories.ts:102) çıkarıldı:
--   public.products(id, name, img, calories, protein, carbs, fats, is_available)
--   search_products dönüşü: id→id, name→name, image_url→img, kcal→calories,
--   protein_g→protein, carbs_g→carbs, fat_g→fats. Aktiflik: is_available=true.
--   RLS: products SELECT herkese açık (20261017095259 notu) → SECURITY INVOKER.

begin;

-- ════════════════════════════════════════════════════════════════════════════
-- 1 — Ayrılmış kullanıcı adları. G9 (3d) claim_handle/check_handle yalnız biçim
--     + benzersizlik denetliyordu; rezerve ad listesi YOKTU (kcalculate, kcal,
--     admin alınabiliyordu). Tek kaynaklı public.handle_is_reserved() eklenir ve
--     iki RPC de çağırır. İstemci src/modules/profil/handle.ts aynı liste/kuralı
--     uygular (ortak test vektörü).
--
--     Kural: (a) tam eşleşme (23 ad) VEYA (b) 'kcal'/'eatkcal' önekiyle başlayıp
--     ardından [a-z0-9] gelen ad (impersonation: kcalofficial). Noktalı/alt
--     çizgili türevler (kcal.official, kcal_) ayrılmış DEĞİL (önekten sonra ayraç).
--     Not: profiles tablosuna CHECK EKLENMEZ — canlıda zaten var olabilecek
--     kurumsal satırları (ör. kcalculate resmi hesabı) kırmamak için; kapı
--     yalnız yeni sahiplenmede (claim_handle) ve kontrolde (check_handle).
-- ════════════════════════════════════════════════════════════════════════════
create or replace function public.handle_is_reserved(p_handle text)
returns boolean
language sql
immutable
set search_path = public
as $$
  select
    lower(btrim(coalesce(p_handle, ''))) in (
      'admin', 'administrator', 'kcal', 'kcalai', 'kcalculate', 'kcalculateai',
      'eatkcal', 'support', 'destek', 'yardim', 'help', 'root', 'null',
      'undefined', 'system', 'sistem', 'moderator', 'mod', 'official', 'resmi',
      'api', 'www', 'app'
    )
    -- 'kcal' öneki 'kcalculate'/'kcalai'yı da kapsar; 'eatkcal' ayrı.
    or lower(btrim(coalesce(p_handle, ''))) ~ '^(kcal|eatkcal)[a-z0-9]';
$$;

comment on function public.handle_is_reserved(text) is
  'Ayrılmış kullanıcı adı mı (tam eşleşme + kcal/eatkcal marka öneki). İstemci handle.ts isReservedHandle() ile birebir.';

create or replace function public.claim_handle(p_handle text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
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

  -- İdempotent: aynı kullanıcı aynı handle'ı tekrar isterse hata verme (rezerve
  -- kontrolünden ÖNCE — canlıda grandfathered kurumsal hesap kendi adını
  -- güncellemeye devam edebilsin).
  select handle into v_current from public.profiles where id = v_uid;
  if v_current is not distinct from v_handle then
    return jsonb_build_object('ok', true, 'reason', null);
  end if;

  -- Rezerve ad: yeni sahiplenme reddedilir.
  if public.handle_is_reserved(v_handle) then
    return jsonb_build_object('ok', false, 'reason', 'reserved');
  end if;

  if exists (select 1 from public.profiles where handle = v_handle and id <> v_uid) then
    return jsonb_build_object('ok', false, 'reason', 'taken');
  end if;

  perform set_config('app.profile_rpc', 'on', true); -- yalnız bu işlem boyunca
  update public.profiles set handle = v_handle where id = v_uid;
  return jsonb_build_object('ok', true, 'reason', null);
end;
$$;

create or replace function public.check_handle(p_handle text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid    uuid := auth.uid();
  v_handle text;
begin
  v_handle := lower(btrim(coalesce(p_handle, '')));
  if char_length(v_handle) < 3 or char_length(v_handle) > 30
     or v_handle !~ '^[a-z0-9_]+(\.[a-z0-9_]+)*$' then
    return jsonb_build_object('available', false, 'reason', 'format');
  end if;
  -- Rezerve ad: sahibi zaten o değilse (grandfathered) ayrılmış sayılır.
  if public.handle_is_reserved(v_handle)
     and not exists (select 1 from public.profiles where id = v_uid and handle = v_handle) then
    return jsonb_build_object('available', false, 'reason', 'reserved');
  end if;
  if exists (select 1 from public.profiles where handle = v_handle and id <> coalesce(v_uid, '00000000-0000-0000-0000-000000000000'::uuid)) then
    return jsonb_build_object('available', false, 'reason', 'taken');
  end if;
  return jsonb_build_object('available', true, 'reason', null);
end;
$$;

revoke all on function public.handle_is_reserved(text) from public, anon;
grant  execute on function public.handle_is_reserved(text) to authenticated;
-- claim_handle/check_handle EXECUTE yetkileri g5/g6'da verildi; korunur.

-- ════════════════════════════════════════════════════════════════════════════
-- 2 — Yetki sıkılaştırma. G5–G8'de açılan sosyal tablolarda, bazı migration'lar
--     `grant all`/`grant ... to authenticated` kullanmış olabilir; istemcinin
--     ASLA ihtiyaç duymadığı truncate/trigger/references yetkileri anon ve
--     authenticated'tan geri alınır (varsa). Tablo verisine erişim RLS + mevcut
--     select/insert/update/delete grant'leriyle değişmez — yalnız bu üç DDL-yan
--     yetki kapatılır. Idempotent (yetki yoksa revoke no-op).
-- ════════════════════════════════════════════════════════════════════════════
do $$
declare
  t text;
  tbls text[] := array[
    'activity_logs', 'ai_scan_reservations', 'ai_scan_usage', 'app_settings',
    'content_reports', 'creators', 'day_shares', 'feature_flags',
    'follow_requests', 'follows', 'moderation_actions', 'moderation_queue',
    'post_comments', 'post_media', 'post_meal_adds', 'post_reactions', 'posts',
    'social_notifications', 'user_blocks', 'user_feature_unlocks'
  ];
begin
  foreach t in array tbls loop
    if to_regclass('public.' || t) is not null then
      execute format('revoke truncate, trigger, references on public.%I from anon, authenticated', t);
    end if;
  end loop;
end $$;

-- ════════════════════════════════════════════════════════════════════════════
-- 3 — Yinelenen post-media storage politikaları. Uygulama zincirinde #4 creator_*
--     oluşturdu, #12 (g8) writer_*'a taşıdı (creator_*'ı drop etti), #14 (g9)
--     creator_*'ı YENİDEN oluşturdu (writer_*'ı drop etmedi) → tam zincir sonrası
--     creator_* VE writer_* birlikte yaşıyor (aynı davranış: posts/{uid}/ +
--     (feed_can_post VEYA kesfet_paylasim)). Çiftler tek writer_* politikasına
--     indirilir; creator_* kaldırılır. Davranış değişmez (idempotent yeniden
--     oluşturma, uygulama sırasından bağımsız).
-- ════════════════════════════════════════════════════════════════════════════
drop policy if exists post_media_creator_insert on storage.objects;
drop policy if exists post_media_creator_update on storage.objects;
drop policy if exists post_media_creator_delete on storage.objects;

drop policy if exists post_media_writer_insert on storage.objects;
create policy post_media_writer_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'post-media'
    and (storage.foldername(name))[1] = 'posts'
    and (storage.foldername(name))[2] = auth.uid()::text
    and (public.feed_flag_enabled('kesfet_paylasim') or public.feed_can_post(auth.uid()))
  );

drop policy if exists post_media_writer_update on storage.objects;
create policy post_media_writer_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'post-media'
    and (storage.foldername(name))[2] = auth.uid()::text
    and (public.feed_flag_enabled('kesfet_paylasim') or public.feed_can_post(auth.uid()))
  )
  with check (
    bucket_id = 'post-media'
    and (storage.foldername(name))[2] = auth.uid()::text
    and (public.feed_flag_enabled('kesfet_paylasim') or public.feed_can_post(auth.uid()))
  );

drop policy if exists post_media_writer_delete on storage.objects;
create policy post_media_writer_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'post-media'
    and (storage.foldername(name))[2] = auth.uid()::text
    and (public.feed_flag_enabled('kesfet_paylasim') or public.feed_can_post(auth.uid()))
  );
-- Okuma (post_media_read) #15/g10 ile sahip+moderatör'e daraltıldı — DOKUNULMAZ.

-- ════════════════════════════════════════════════════════════════════════════
-- 4 — Gövde düzenleme yeniden denetim. (a) update_my_post RPC: yazar kendi
--     gönderisinin gövdesini düzenler; gönderi 'published' ve gövde GERÇEKTEN
--     değiştiyse status='pending' + moderation_queue satırı (moderasyon akışıyla
--     aynı). (b) posts BEFORE UPDATE guard'ına (G9 3c) gövde dalı eklenir: yazar
--     gövdeyi HANGİ YOLDAN (doğrudan PostgREST UPDATE) değiştirirse değiştirsin
--     aynı yeniden denetim uygulanır → RPC'yi atlayan doğrudan UPDATE açığı kapanır.
--     Gövde g9 ile birebir; yalnız gövde dalı eklendi.
-- ════════════════════════════════════════════════════════════════════════════
create or replace function public.posts_guard_protected_cols()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_claims   text := current_setting('request.jwt.claims', true);
  v_role     text := case when v_claims is null or v_claims = '' then null
                          else (v_claims::jsonb ->> 'role') end;
  v_post_rpc boolean := coalesce(current_setting('app.post_rpc', true), '') = 'on';
begin
  -- Servis rolü (edge fn) ve rolsüz bağlam (superuser/migration/cron) serbest.
  if v_role is null or v_role = 'service_role' then
    return NEW;
  end if;
  -- Moderatör/admin tüm kolonları değiştirebilir (panel + mod_resolve_report).
  if public.feed_is_moderator(auth.uid()) or public.is_admin() then
    return NEW;
  end if;
  -- Yazarın doğrudan UPDATE'i: korunan kolonlar yalnız işlem-yerel bayrakla
  -- (delete_my_post / mod_resolve_report / update_my_post) değişebilir.
  if not v_post_rpc then
    if NEW.status is distinct from OLD.status
       or NEW.pinned_until is distinct from OLD.pinned_until
       or NEW.author_id is distinct from OLD.author_id then
      raise exception 'posts_guard: status/pinned_until/author_id yalnızca moderatör veya ilgili RPC ile değiştirilebilir';
    end if;
    -- G11-4: yazar YAYINDAKİ gönderinin gövdesini doğrudan değiştirirse yeniden
    -- denetime düşsün (status pending + kuyruk). (status burada OLD ile eşit
    -- geldiği için yukarıdaki raise tetiklenmedi; pending'e BURADA alıyoruz.)
    if NEW.body is distinct from OLD.body and OLD.status = 'published' then
      NEW.status := 'pending';
      insert into public.moderation_queue (target_type, target_id)
      values ('post', NEW.id) on conflict do nothing;
    end if;
  end if;
  return NEW;
end;
$$;

-- Trigger G9'da oluşturuldu; fonksiyon create or replace ile güncellendi (trigger
-- aynı fonksiyonu işaret ettiği için yeniden create gerekmez). Idempotentlik için
-- yine de garanti altına al:
drop trigger if exists posts_guard_protected_cols on public.posts;
create trigger posts_guard_protected_cols
  before update on public.posts
  for each row execute function public.posts_guard_protected_cols();

create or replace function public.update_my_post(p_post uuid, p_body text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_uid        uuid := auth.uid();
  r            public.posts%rowtype;
  v_new_status text;
  v_changed    boolean;
begin
  if v_uid is null then raise exception 'yetkisiz' using errcode = '42501'; end if;
  -- Gövde sınırı create_post ile aynı (1000).
  if char_length(coalesce(p_body, '')) > 1000 then raise exception 'metin_cok_uzun'; end if;

  select * into r from public.posts where id = p_post and author_id = v_uid;
  if not found or r.status = 'removed' then
    raise exception 'bulunamadi' using errcode = '42501';
  end if;

  v_changed    := coalesce(r.body, '') is distinct from coalesce(p_body, '');
  v_new_status := r.status;
  if r.status = 'published' and v_changed then
    v_new_status := 'pending';
  end if;

  perform set_config('app.post_rpc', 'on', true); -- guard: status değişimine izin
  update public.posts
     set body = coalesce(p_body, ''), status = v_new_status
   where id = p_post and author_id = v_uid;

  -- Yayındaki gönderi yeniden denetime düştüyse kuyruğa al (RPC kendi ekler;
  -- guard dalı v_post_rpc=on olduğu için burada çalışmaz → çift ekleme yok).
  if v_new_status = 'pending' and r.status = 'published' then
    insert into public.moderation_queue (target_type, target_id)
    values ('post', p_post) on conflict do nothing;
  end if;

  return jsonb_build_object('ok', true, 'status', v_new_status);
end;
$$;

revoke all on function public.update_my_post(uuid, text) from public, anon;
grant  execute on function public.update_my_post(uuid, text) to authenticated;

-- ════════════════════════════════════════════════════════════════════════════
-- 5 — search_products. Aktif/satışta ürünlerde ad araması. products SELECT
--     herkese açık (RLS, 20261017095259 notu) → SECURITY INVOKER (çağıranın
--     RLS'i; kolon beyaz listesi dönüş şeklinde zaten var). p_q >= 2 karakter,
--     en fazla 20 sonuç. Dönüş şekli G11-CONTRACT: { items: [{ id, name,
--     image_url, kcal, protein_g, carbs_g, fat_g }] }.
-- ════════════════════════════════════════════════════════════════════════════
create or replace function public.search_products(p_q text, p_limit int default 12)
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  select jsonb_build_object(
    'items',
    coalesce(jsonb_agg(t.item order by t.name_sort), '[]'::jsonb)
  )
  from (
    select
      jsonb_build_object(
        'id',        pr.id,
        'name',      pr.name,
        'image_url', pr.img,
        'kcal',      pr.calories,
        'protein_g', pr.protein,
        'carbs_g',   pr.carbs,
        'fat_g',     pr.fats
      ) as item,
      lower(pr.name) as name_sort
    from public.products pr
    where pr.is_available = true
      and char_length(btrim(coalesce(p_q, ''))) >= 2
      and pr.name ilike '%' || btrim(p_q) || '%'
    order by lower(pr.name)
    limit least(greatest(coalesce(p_limit, 12), 1), 20)
  ) t;
$$;

comment on function public.search_products(text, int) is
  'Aktif ürün adı araması → { items:[{id,name,image_url,kcal,protein_g,carbs_g,fat_g}] }. p_q>=2, <=20 sonuç. Kolon eşlemesi: image_url=products.img, kcal=calories, fat_g=fats.';

revoke all on function public.search_products(text, int) from public, anon;
grant  execute on function public.search_products(text, int) to authenticated;

-- ════════════════════════════════════════════════════════════════════════════
-- 6 — Bayrak yönetimi: feature_flag_audit tablosu + admin RPC'leri. Admin yetkisi
--     mevcut admin_allowlist deseniyle (G7/G8 admin_* ile aynı). Her bayrak
--     değişikliği (set_flag/flag_unlock) audit satırı yazar (before/after jsonb).
-- ════════════════════════════════════════════════════════════════════════════
create table if not exists public.feature_flag_audit (
  id         bigint generated always as identity primary key,
  flag_key   text        not null,
  actor_id   uuid,
  before     jsonb,
  after      jsonb,
  created_at timestamptz not null default now()
);
create index if not exists feature_flag_audit_key_idx
  on public.feature_flag_audit (flag_key, created_at desc);

comment on table public.feature_flag_audit is
  'Bayrak değişiklik denetim kaydı (admin_set_flag/admin_flag_unlock). Yalnız admin okur; yazma definer RPC üzerinden.';

alter table public.feature_flag_audit enable row level security;
drop policy if exists feature_flag_audit_admin_read on public.feature_flag_audit;
create policy feature_flag_audit_admin_read
  on public.feature_flag_audit
  for select to authenticated
  using (public.is_admin());
-- Yazma politikası YOK → istemciden insert/update/delete reddedilir (definer RPC
-- RLS'i baypas eder).
revoke all    on public.feature_flag_audit from anon, authenticated, public;
grant  select on public.feature_flag_audit to authenticated;

-- admin_list_flags() → tüm bayraklar + kullanıcı kilidi sayısı.
create or replace function public.admin_list_flags()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare v_result jsonb;
begin
  if not exists (select 1 from public.admin_allowlist a where a.user_id = auth.uid()) then
    raise exception 'yetkisiz' using errcode = '42501';
  end if;
  select coalesce(jsonb_agg(
           jsonb_build_object(
             'key',             ff.key,
             'enabled',         ff.enabled,
             'rollout_percent', ff.rollout_percent,
             'min_app_version', ff.min_app_version,
             'platforms',       ff.platforms,
             'description',     ff.description,
             'updated_at',      ff.updated_at,
             'unlock_count',    (select count(*) from public.user_feature_unlocks u where u.flag_key = ff.key)
           ) order by ff.key
         ), '[]'::jsonb)
    into v_result
    from public.feature_flags ff;
  return v_result;
end;
$$;

-- admin_set_flag → {ok}. Bayrağın TÜM yapılandırmasını set eder (min_app_version
-- / platforms null = temizle). Geçersiz anahtar (bayrak yok) veya yüzde aralık
-- dışı → hata. Audit satırı yazar.
create or replace function public.admin_set_flag(
  p_key             text,
  p_enabled         boolean,
  p_rollout_percent int,
  p_min_app_version text default null,
  p_platforms       text[] default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_uid    uuid := auth.uid();
  v_before jsonb;
  v_after  jsonb;
begin
  if not exists (select 1 from public.admin_allowlist a where a.user_id = v_uid) then
    raise exception 'yetkisiz' using errcode = '42501';
  end if;
  if p_rollout_percent is null or p_rollout_percent < 0 or p_rollout_percent > 100 then
    raise exception 'gecersiz_yuzde';
  end if;

  select to_jsonb(ff) into v_before from public.feature_flags ff where ff.key = p_key;
  if v_before is null then
    raise exception 'gecersiz_anahtar';
  end if;

  update public.feature_flags
     set enabled         = coalesce(p_enabled, false),
         rollout_percent = p_rollout_percent,
         min_app_version = p_min_app_version,
         platforms       = p_platforms,
         updated_at      = now()
   where key = p_key
  returning to_jsonb(feature_flags) into v_after;

  insert into public.feature_flag_audit (flag_key, actor_id, before, after)
  values (p_key, v_uid, v_before, v_after);

  return jsonb_build_object('ok', true);
end;
$$;

-- admin_flag_unlock → {ok}. Kullanıcı bazlı kilit aç/kapat (user_feature_unlocks,
-- source 'manual'; test kullanıcıları için). Audit satırı yazar.
create or replace function public.admin_flag_unlock(
  p_key  text,
  p_user uuid,
  p_on   boolean
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare v_uid uuid := auth.uid();
begin
  if not exists (select 1 from public.admin_allowlist a where a.user_id = v_uid) then
    raise exception 'yetkisiz' using errcode = '42501';
  end if;
  if not exists (select 1 from public.feature_flags ff where ff.key = p_key) then
    raise exception 'gecersiz_anahtar';
  end if;
  if p_user is null then raise exception 'kullanici_zorunlu'; end if;

  if coalesce(p_on, false) then
    insert into public.user_feature_unlocks (user_id, flag_key, source)
    values (p_user, p_key, 'manual')
    on conflict (user_id, flag_key) do nothing;
  else
    delete from public.user_feature_unlocks where user_id = p_user and flag_key = p_key;
  end if;

  insert into public.feature_flag_audit (flag_key, actor_id, before, after)
  values (
    p_key, v_uid,
    jsonb_build_object('unlock_user', p_user, 'on', not coalesce(p_on, false)),
    jsonb_build_object('unlock_user', p_user, 'on', coalesce(p_on, false))
  );

  return jsonb_build_object('ok', true);
end;
$$;

-- admin_find_user(p_q) → [{ id, handle, display_name, email_masked }] (handle veya
-- e-posta ile, en fazla 10; e-posta maskeli). p_q >= 2 karakter.
create or replace function public.admin_find_user(p_q text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_q      text := btrim(coalesce(p_q, ''));
  v_result jsonb;
begin
  if not exists (select 1 from public.admin_allowlist a where a.user_id = auth.uid()) then
    raise exception 'yetkisiz' using errcode = '42501';
  end if;
  if char_length(v_q) < 2 then
    return '[]'::jsonb;
  end if;

  select coalesce(jsonb_agg(row_to_json(t)::jsonb order by t.handle nulls last), '[]'::jsonb)
    into v_result
  from (
    select
      p.id,
      p.handle,
      coalesce(
        p.full_name,
        nullif(trim(coalesce(p.first_name, '') || ' ' || coalesce(p.last_name, '')), ''),
        p.handle,
        'Kcalculate'
      ) as display_name,
      case
        when u.email is null or u.email = '' then null
        else left(u.email, 1) || '***@' || split_part(u.email, '@', 2)
      end as email_masked
    from public.profiles p
    join auth.users u on u.id = p.id
    where p.handle ilike '%' || v_q || '%'
       or u.email ilike '%' || v_q || '%'
    order by p.handle nulls last
    limit 10
  ) t;

  return v_result;
end;
$$;

revoke all on function public.admin_list_flags()                               from public, anon;
revoke all on function public.admin_set_flag(text, boolean, int, text, text[]) from public, anon;
revoke all on function public.admin_flag_unlock(text, uuid, boolean)           from public, anon;
revoke all on function public.admin_find_user(text)                            from public, anon;
grant  execute on function public.admin_list_flags()                               to authenticated;
grant  execute on function public.admin_set_flag(text, boolean, int, text, text[]) to authenticated;
grant  execute on function public.admin_flag_unlock(text, uuid, boolean)           to authenticated;
grant  execute on function public.admin_find_user(text)                            to authenticated;

-- ════════════════════════════════════════════════════════════════════════════
-- 7 — yeni_kabuk bayrak satırı. enabled=false, rollout_percent=0,
--     min_app_version='1.1.0'. get_my_features min_app_version'ı zaten uygular
--     (20261103000500 satır: _ff_version_gte(p_app_version, min_app_version);
--     istemci FlagsProvider.tsx p_app_version=Constants.expoConfig.version gönderir
--     → 1.0.7 cihazlar bayrağı almaz). SQL düzeltmesi GEREKMEZ; yalnız satır.
--     on conflict do nothing: canlıda varsa dokunma.
-- ════════════════════════════════════════════════════════════════════════════
insert into public.feature_flags (key, enabled, rollout_percent, min_app_version, description)
values (
  'yeni_kabuk', false, 0, '1.1.0',
  'Yeni tab-bar kabuğu (G11). Kapalıyken uygulama 1.0.7 ile aynı; 1.1.0+ gerekir.'
)
on conflict (key) do nothing;

commit;
