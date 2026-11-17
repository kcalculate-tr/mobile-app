-- Geri alma: 20261117220100_g59_hikaye.sql
-- report_content ve mod_resolve_report G10 gövdelerine (20261105000200_g10_fixes.sql) BİREBİR döner
-- (aşağıdaki iki gövde o dosyadan satır satır kopyalandı). Hikâye tabloları, RPC'ler, depolama
-- politikaları ve `hikaye` bayrağı kaldırılır.
-- DİKKAT: stories* tabloları silinir (hikâyeler, görüntülenmeler, tepkiler, anket oyları, öne çıkanlar).
-- post-media `stories/…` dosyaları depoda KALIR (gerekirse Storage'dan elle temizlenir).
-- meal_consumptions'ta source='story' satırı VARSA kısıt 'story'yi korur (kullanıcı günlüğü silinmez).

begin;

-- Depolama politikaları
drop policy if exists story_media_insert on storage.objects;
drop policy if exists story_media_delete on storage.objects;

-- RPC'ler
drop function if exists public.delete_story_highlight(uuid);
drop function if exists public.upsert_story_highlight(uuid, text, uuid[], uuid);
drop function if exists public.get_user_highlights(uuid);
drop function if exists public.get_my_story_archive(timestamptz, int);
drop function if exists public.get_story_viewers(uuid, text);
drop function if exists public.add_story_meal_to_day(uuid, text, text, numeric, text);
drop function if exists public.story_sticker_tap(uuid, text);
drop function if exists public.vote_story_poll(uuid, text, int);
drop function if exists public.react_story(uuid, text, boolean);
drop function if exists public.mark_story_viewed(uuid);
drop function if exists public.get_highlight_stories(uuid);
drop function if exists public.get_story_ring(uuid);
drop function if exists public.get_user_stories(uuid);
drop function if exists public.get_story_tray();
drop function if exists public.delete_my_story(uuid);
drop function if exists public.create_story(text, text, text, numeric, int, int, jsonb, jsonb, text);
drop function if exists public.story_json(public.stories, uuid);

-- Moderasyon: hikâye şikayet/kuyruk satırları silinir, kısıtlar G9/G10 hâline döner.
delete from public.moderation_queue where target_type = 'story';
delete from public.moderation_actions where target_type = 'story';
delete from public.content_reports where target_type = 'story';

alter table public.content_reports drop constraint if exists content_reports_target_type_check;
alter table public.content_reports add  constraint content_reports_target_type_check
  check (target_type in ('post', 'user', 'day_card', 'comment'));

alter table public.moderation_actions drop constraint if exists moderation_actions_target_type_check;
alter table public.moderation_actions add  constraint moderation_actions_target_type_check
  check (target_type in ('post', 'user', 'day_card', 'comment'));

alter table public.moderation_queue drop constraint if exists moderation_queue_target_type_check;
alter table public.moderation_queue add  constraint moderation_queue_target_type_check
  check (target_type in ('post', 'comment'));

-- report_content — G10 gövdesi (20261105000200_g10_fixes.sql)
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

-- mod_resolve_report — G10 gövdesi (20261105000200_g10_fixes.sql)
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

-- Tablolar (bağımlılık sırasıyla)
drop table if exists public.story_highlight_items;
drop table if exists public.story_highlights;
drop table if exists public.story_sticker_events;
drop table if exists public.story_poll_votes;
drop table if exists public.story_reactions;
drop table if exists public.story_views;
drop table if exists public.stories;

drop function if exists public.story_can_view(uuid, uuid);
drop function if exists public.story_is_official(uuid);
drop function if exists public.story_has_text(jsonb);
drop function if exists public.story_overlays_valid(jsonb);

-- meal_consumptions.source: 'story' kaldırılır (yalnız hiç 'story' satırı yoksa; varsa korunur).
do $$
declare
  vals text[];
begin
  select array_agg(v order by v) into vals
  from (
    select unnest(array['manual', 'pantry', 'post', 'ai_scan', 'day_card', 'barcode']) as v
    union
    select distinct source from public.meal_consumptions where source is not null
  ) s;
  alter table public.meal_consumptions drop constraint if exists meal_consumptions_source_check;
  execute format(
    'alter table public.meal_consumptions add constraint meal_consumptions_source_check check (source = any (%L::text[]))',
    vals
  );
end $$;

delete from public.feature_flags where key = 'hikaye';

commit;
