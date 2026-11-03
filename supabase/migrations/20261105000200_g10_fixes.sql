-- G10-S1 — Son güvenlik düzeltmeleri (test ortamı bulguları). Tek migration.
-- version: 20261105000200  name: g10_fixes
--
-- DURUM: YALNIZ DOSYA. Hiçbir yere uygulanmadı (gece kuralı). Geri alma:
--   supabase/rollbacks/20261105000200_g10_fixes_rollback.sql
-- Önkoşul (G6-APPLY sırası): #1–#14 (özellikle #6 ai_scan, #4 post-media storage,
--   #12 moderation_queue/post_comments, #14 g9_fixes posts guard) uygulanmış olmalı.
--   EN SON bu uygulanır (#15).
--
-- Bu dosya aşağıdaki DOĞRULANMIŞ hataları kapatır (G10-S1 görev maddeleri 1–6):
--   1. reserve_ai_scan idempotency araması kullanıcıya bakmıyordu → başka
--      kullanıcının anahtarıyla çağıran kota harcamadan 'ok' alıyordu. Arama
--      user_id = auth.uid() ile sınırlandı; başkasına ait anahtar → hata.
--      release_ai_scan zaten yalnız kendi rezervasyonunu bırakıyor (doğrulandı,
--      değişiklik yok).
--   2. post_media_read SELECT politikası public rolüne koşulsuzdu → kova içeriği
--      anonim LİSTELENEBİLİYORDU (gizli/pending/removed gönderi medyası bulunabilir).
--      Kova public kalır (doğrudan CDN URL'i RLS'siz çalışır); geniş SELECT kaldırıldı,
--      listeleme yalnız sahibine ve moderatör/admin'e açık. (İstemci/panel storage
--      LİSTELEME kullanmıyor — grep ile doğrulandı; yalnız public URL okur.)
--   3. report_content hedefi görebilme kontrolü yapmıyordu (pending/gizli/engelli
--      hedef yoklanabiliyordu). Hedef türüne göre görünürlük kapısı + 'comment'
--      desteği + kullanıcı başına günde 50 şikayet sınırı eklendi.
--   4. mod_resolve_report: pending hedef yayına/kaldırmaya alınırken moderation_queue
--      satırı 'done' işaretlenmiyordu → cron o hedefi yeniden denemeye devam ederdi.
--      dismiss→published (post + comment, G9 3f, doğrulandı) + her iki aksiyonda
--      moderation_queue 'done'.
--   5. post_comments.status doğrudan UPDATE ile değiştirilebiliyordu (post_comments_update
--      RLS'i yazara UPDATE verir). posts'taki G9 3c koruması TRIGGER'dı (yeterli);
--      post_comments için AYNI BEFORE UPDATE guard eklendi (status/author_id/post_id/
--      parent_id); delete_my_comment işlem-yerel app.post_rpc bayrağını açar.
--      profiles zaten profiles_guard_protected_cols trigger'ıyla korunuyor (yeterli).
--   6. get_user_day_progress yetki kapısı (G9 3h) auth.uid() NULL olduğunda da
--      çalışıyordu → rolsüz/servis (definer) çağrıları hatalı reddedilebilirdi.
--      Kapı yalnız auth.uid() DOLUYKEN uygulanır (p_uid = auth.uid() or
--      feed_can_view_author). EXECUTE zaten authenticated/anon/public'ten revoke'lu.

begin;

-- ════════════════════════════════════════════════════════════════════════════
-- 1 — reserve_ai_scan: idempotency anahtarı araması KULLANICIYA sınırlı. Başka
--     kullanıcının anahtarıyla çağıran rezervasyonu BULAMAZ (kota aşımı kapandı);
--     anahtar başkasına aitse açıkça hata. Gövde g5_rpcs ile birebir; yalnız anahtar
--     araması user_id = v_uid ile sınırlandı + sahiplik kontrolü eklendi.
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
  v_owner      uuid;
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

  -- Anahtar sahipliği: aynı anahtar varsa SAHİBİ çağıran olmalı. Başkasına aitse
  -- (idempotency anahtarları gizli değildir; sızıntı/çakışma durumunda) reddet —
  -- böylece başka kullanıcının anahtarıyla kota harcamadan 'ok' alınamaz.
  select user_id, status into v_owner, v_status
    from public.ai_scan_reservations where idempotency_key = p_idempotency_key;
  if found and v_owner is distinct from v_uid then
    raise exception 'baskasinin_anahtari' using errcode = '42501';
  end if;

  -- Idempotency: aynı kullanıcının anahtarı zaten 'reserved' ise tekrar sayma.
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
-- 2 — post-media kovası: geniş public SELECT politikası kaldırılıyor. Kova public
--     KALIR → yayımlanmış gönderi görselleri doğrudan CDN public URL'i ile RLS'siz
--     servis edilir (storage.objects SELECT'i yalnız LİSTELEME/imzalı okuma yolunu
--     etkiler). Listeleme yalnız kendi klasörünün sahibine (posts/{uid}/...) ve
--     moderatör/admin'e açık. (İstemci media.ts ve panel storage LİSTELEME
--     kullanmıyor; yalnız getPublicUrl — grep ile doğrulandı.)
-- ════════════════════════════════════════════════════════════════════════════
drop policy if exists post_media_read on storage.objects;
create policy post_media_read on storage.objects
  for select to authenticated
  using (
    bucket_id = 'post-media'
    and (
      (storage.foldername(name))[2] = auth.uid()::text
      or public.feed_is_moderator(auth.uid())
      or public.is_admin()
    )
  );

-- ════════════════════════════════════════════════════════════════════════════
-- 3 — report_content: hedefi GÖREBİLME kapısı + 'comment' desteği + günde 50 sınır.
--     Görülemeyen (pending/gizli/engelli/süresi geçmiş) hedef → 'bulunamadi'; böylece
--     içerik varlığı yoklanamaz. İmza g6_fixes ile aynı; gövde genişletildi.
-- ════════════════════════════════════════════════════════════════════════════
create or replace function public.report_content(p_target_type text, p_target uuid, p_reason text)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_uid     uuid := auth.uid();
  v_risk    smallint;
  v_daycnt  int;
  v_visible boolean := false;
begin
  if v_uid is null then raise exception 'yetkisiz' using errcode = '42501'; end if;
  if p_target_type not in ('post', 'user', 'day_card', 'comment') then
    raise exception 'gecersiz_hedef';
  end if;
  if coalesce(trim(p_reason), '') = '' then raise exception 'sebep_zorunlu'; end if;

  -- Hedefi görebilme kapısı (SECURITY DEFINER → RLS baypas; elle kontrol). ÖNCE
  -- görünürlük: görülemeyen hedef için limit bilgisi bile sızdırılmaz ('bulunamadi').
  if p_target_type = 'post' then
    v_visible := exists (
      select 1 from public.posts p
       where p.id = p_target and p.status = 'published'
         and public.feed_can_view_author(v_uid, p.author_id)
    );
  elsif p_target_type = 'comment' then
    v_visible := exists (
      select 1 from public.post_comments c
       join public.posts p on p.id = c.post_id
       where c.id = p_target and c.status = 'published' and p.status = 'published'
         and public.feed_can_view_author(v_uid, c.author_id)
         and public.feed_can_view_author(v_uid, p.author_id)
    );
  elsif p_target_type = 'day_card' then
    v_visible := exists (
      select 1 from public.day_shares d
       where d.id = p_target and d.expires_at > now()
         and public.feed_can_view_author(v_uid, d.user_id)
    );
  elsif p_target_type = 'user' then
    -- Kendini şikayet edemez; karşılıklı engel yoksa görülebilir sayılır.
    v_visible := exists (select 1 from public.profiles pr where pr.id = p_target)
                 and p_target is distinct from v_uid
                 and not public.feed_is_blocked(v_uid, p_target);
  end if;

  if not v_visible then
    raise exception 'bulunamadi' using errcode = '42501';
  end if;

  -- Görünürlükten SONRA: kullanıcı başına günde (Europe/Istanbul) 50 şikayet sınırı.
  -- Mevcut bir hedefi tekrar şikayet (on conflict → güncelleme) yeni satır açmaz;
  -- yalnız bugünkü farklı satırlar sayılır, o yüzden mevcut hedefe tekrar izin verilir.
  select count(*) into v_daycnt
    from public.content_reports
   where reporter_id = v_uid
     and source = 'user'
     and (created_at at time zone 'Europe/Istanbul')::date
         = (now() at time zone 'Europe/Istanbul')::date;
  if v_daycnt >= 50
     and not exists (
       select 1 from public.content_reports
        where reporter_id = v_uid and target_type = p_target_type and target_id = p_target
     ) then
    raise exception 'cok_fazla_sikayet' using errcode = '42901';
  end if;

  v_risk := public.content_report_risk(p_reason);

  insert into public.content_reports (reporter_id, target_type, target_id, reason, status, risk)
  values (v_uid, p_target_type, p_target, left(p_reason, 500), 'open', v_risk)
  on conflict (reporter_id, target_type, target_id)
  do update set reason = excluded.reason, created_at = now(), status = 'open', risk = excluded.risk;
end;
$$;

-- ════════════════════════════════════════════════════════════════════════════
-- 4 — mod_resolve_report: pending hedef yayına/kaldırmaya alınınca moderation_queue
--     satırını 'done' işaretle (cron 10 dk'dan eski 'pending' hedefi yeniden dener;
--     done olmazsa moderatör kararı sonrası tekrar AI'ya gider). dismiss→published
--     (post + comment, G9 3f) korunur. Gövde g9_fixes ile birebir; yalnız queue
--     'done' bloğu eklendi.
-- ════════════════════════════════════════════════════════════════════════════
create or replace function public.mod_resolve_report(
  p_report bigint,
  p_action text,
  p_reason text
)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  r     public.content_reports%rowtype;
begin
  if not (public.feed_is_moderator(v_uid) or public.is_admin()) then
    raise exception 'yetkisiz' using errcode = '42501';
  end if;
  if p_action not in ('remove', 'warn', 'dismiss') then raise exception 'gecersiz_aksiyon'; end if;
  if coalesce(btrim(p_reason), '') = '' then raise exception 'sebep_zorunlu'; end if;

  select * into r from public.content_reports where id = p_report;
  if not found then raise exception 'rapor_yok' using errcode = '42501'; end if;

  perform set_config('app.post_rpc', 'on', true); -- posts/comments guard: moderatör yayını/kaldırması

  if p_action = 'remove' then
    if r.target_type = 'post' then
      update public.posts set status = 'removed' where id = r.target_id;
    elsif r.target_type = 'comment' then
      update public.post_comments set status = 'removed' where id = r.target_id;
    elsif r.target_type = 'day_card' then
      update public.day_shares set expires_at = now() - interval '1 second' where id = r.target_id;
    end if;
    -- 'user' hedefi için remove içerik silmez; şikayetler kapatılır + kayıt tutulur.
  elsif p_action = 'dismiss' then
    -- "Yayınla" kararı: AI/şikayet beklettiği pending hedefi yayına al.
    if r.target_type = 'post' then
      update public.posts set status = 'published' where id = r.target_id and status = 'pending';
    elsif r.target_type = 'comment' then
      update public.post_comments set status = 'published' where id = r.target_id and status = 'pending';
    end if;
  end if;

  -- Moderatör kararı verildi → AI denetim kuyruğundaki satırı kapat (cron yeniden
  -- denemesin). Yalnız kuyruğa giren türler (post/comment) için anlamlı.
  if r.target_type in ('post', 'comment') then
    update public.moderation_queue
       set status = 'done', last_attempt_at = now()
     where target_type = r.target_type and target_id = r.target_id;
  end if;

  update public.content_reports
     set status = 'resolved'
   where target_type = r.target_type and target_id = r.target_id and status = 'open';

  insert into public.moderation_actions (actor_id, report_id, target_type, target_id, action, reason)
  values (v_uid, r.id, r.target_type, r.target_id, p_action, left(p_reason, 500));

  return jsonb_build_object('ok', true);
end;
$$;

-- ════════════════════════════════════════════════════════════════════════════
-- 5 — post_comments.status koruması. post_comments_update RLS'i yazara UPDATE verir;
--     yazar status (pending'i kendi yayınlama / removed'ı geri getirme), author_id,
--     post_id, parent_id DEĞİŞTİREMEMELİ. posts_guard_protected_cols ile aynı desen:
--     servis rolü + moderatör/admin + işlem-yerel app.post_rpc bayrağı serbest.
-- ════════════════════════════════════════════════════════════════════════════
create or replace function public.post_comments_guard_protected_cols()
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
  -- Servis rolü (edge fn moderate-content) ve rolsüz bağlam (superuser/migration/cron) serbest.
  if v_role is null or v_role = 'service_role' then
    return NEW;
  end if;
  -- Moderatör/admin tüm kolonları değiştirebilir (mod_resolve_report / delete_my_comment).
  if public.feed_is_moderator(auth.uid()) or public.is_admin() then
    return NEW;
  end if;
  -- Yazarın doğrudan UPDATE'i: korunan kolonlar yalnız işlem-yerel bayrakla
  -- (delete_my_comment) değişebilir.
  if not v_post_rpc then
    if NEW.status is distinct from OLD.status
       or NEW.author_id is distinct from OLD.author_id
       or NEW.post_id is distinct from OLD.post_id
       or NEW.parent_id is distinct from OLD.parent_id then
      raise exception 'post_comments_guard: status/author_id/post_id/parent_id yalnızca moderatör veya ilgili RPC ile değiştirilebilir';
    end if;
  end if;
  return NEW;
end;
$$;

drop trigger if exists post_comments_guard_protected_cols on public.post_comments;
create trigger post_comments_guard_protected_cols
  before update on public.post_comments
  for each row execute function public.post_comments_guard_protected_cols();

-- delete_my_comment — status='removed' değişimi için işlem-yerel bayrağı aç (guard
-- yazarın kendi yorumunu silmesine izin versin). Gövde g8_social ile birebir; yalnız
-- set_config satırı eklendi.
create or replace function public.delete_my_comment(p_comment uuid)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_n int;
begin
  if v_uid is null then raise exception 'yetkisiz' using errcode = '42501'; end if;
  perform set_config('app.post_rpc', 'on', true); -- post_comments guard: yalnız bu işlem boyunca
  update public.post_comments set status = 'removed'
   where id = p_comment
     and status <> 'removed'
     and (author_id = v_uid or public.feed_is_moderator(v_uid));
  get diagnostics v_n = row_count;
  if v_n = 0 and not exists (
    select 1 from public.post_comments
    where id = p_comment and (author_id = v_uid or public.feed_is_moderator(v_uid))
  ) then
    raise exception 'bulunamadi' using errcode = '42501';
  end if;
  return jsonb_build_object('ok', true);
end;
$$;

-- ════════════════════════════════════════════════════════════════════════════
-- 6 — get_user_day_progress: yetki kapısı (G9 3h) yalnız auth.uid() DOLUYKEN uygulanır.
--     Rolsüz/servis (definer) çağrılarında auth.uid() NULL → kapı atlanır (iç
--     çağrılar kırılmaz). EXECUTE zaten authenticated/anon/public'ten revoke'lu
--     (sızıntı yok; bu savunma amaçlı iç kapı). Gövde g9_fixes ile birebir; yalnız
--     kapı koşuluna `auth.uid() is not null` eklendi.
-- ════════════════════════════════════════════════════════════════════════════
create or replace function public.get_user_day_progress(p_uid uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_today  date := (now() at time zone 'Europe/Istanbul')::date;
  v_target numeric;
  v_cal    numeric;
  v_prog   numeric := 0;
  v_streak integer := 0;
  v_day    date;
  v_hasnew boolean;
begin
  -- Yetki kapısı yalnız oturum açmış çağrıda (auth.uid() dolu): başkasının ilerlemesi
  -- yalnız görebilen kullanıcıya (engel + takip + gizlilik) ya da moderatör/admin'e.
  -- auth.uid() NULL ise (rolsüz/servis/definer iç çağrı) kapı atlanır.
  if auth.uid() is not null
     and p_uid is distinct from auth.uid()
     and not public.feed_can_view_author(auth.uid(), p_uid)
     and not (public.feed_is_moderator(auth.uid()) or public.is_admin()) then
    raise exception 'yetkisiz' using errcode = '42501';
  end if;

  select coalesce(
           nullif(case when use_custom_macros then custom_calories else target_calories end, 0),
           nullif(target_calories, 0)
         )::numeric
    into v_target
    from public.user_nutrition_profiles
   where user_id = p_uid;

  select coalesce(sum(calories), 0)::numeric
    into v_cal
    from public.meal_consumptions
   where user_id = p_uid
     and (consumed_at at time zone 'Europe/Istanbul')::date = v_today;

  if v_target is not null and v_target > 0 then
    v_prog := least(1.0, round(v_cal / v_target, 4));
  end if;

  v_day := v_today;
  if not exists (select 1 from public.meal_consumptions
                 where user_id = p_uid
                   and (consumed_at at time zone 'Europe/Istanbul')::date = v_day) then
    v_day := v_today - 1;
  end if;
  loop
    if exists (select 1 from public.meal_consumptions
               where user_id = p_uid
                 and (consumed_at at time zone 'Europe/Istanbul')::date = v_day) then
      v_streak := v_streak + 1;
      v_day := v_day - 1;
    else
      exit;
    end if;
  end loop;

  v_hasnew := exists (select 1 from public.day_shares
                      where user_id = p_uid and expires_at > now());

  return jsonb_build_object('progress', v_prog, 'streak', v_streak, 'has_new', v_hasnew);
end;
$$;

revoke all on function public.get_user_day_progress(uuid) from public, anon, authenticated;

commit;
