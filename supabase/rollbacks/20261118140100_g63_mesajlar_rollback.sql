-- G63-S1 — Mesajlar (DM) GERİ ALMA. version: 20261118140100
--
-- Önce bayrak kapatılır (push ve RPC'ler durur). Tablolar VERİ SİLMEMEK için varsayılan olarak KALIR;
-- yalnız tetikleyiciler, RPC'ler ve yayın kaldırılır, moderasyon fonksiyonları G59 gövdelerine döner.
-- Tam temizlik (mesaj verisini kalıcı siler) en alttaki yorum bloğunda — yalnız İlter onayıyla.

begin;

update public.feature_flags set enabled = false, rollout_percent = 0 where key = 'mesajlar';

-- Realtime yayını
do $$
begin
  if exists (select 1 from pg_publication_tables
              where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'messages') then
    execute 'alter publication supabase_realtime drop table public.messages';
  end if;
end $$;

-- Tetikleyiciler
drop trigger if exists trg_push_dm_message on public.messages;
drop trigger if exists trg_dm_on_message_sent on public.messages;
drop function if exists public.fn_push_dm_message();
drop function if exists public.dm_on_message_sent();

-- RPC'ler
drop function if exists public.dm_open(uuid);
drop function if exists public.dm_send(uuid, text, text, jsonb, text);
drop function if exists public.dm_inbox(text, text, int);
drop function if exists public.dm_unread_count();
drop function if exists public.dm_thread(uuid, timestamptz, int);
drop function if exists public.dm_mark_read(uuid);
drop function if exists public.dm_accept_request(uuid);
drop function if exists public.dm_decline_request(uuid);
drop function if exists public.dm_leave(uuid);
drop function if exists public.dm_mute(uuid, boolean);
drop function if exists public.dm_delete_message(uuid);
drop function if exists public.dm_search_people(text);
drop function if exists public.dm_message_json(public.messages, uuid);
drop function if exists public.dm_person_json(uuid, uuid);
drop function if exists public.dm_can_message(uuid, uuid);
drop function if exists public.dm_mutual(uuid, uuid);
drop function if exists public.dm_other_member(uuid, uuid);
drop function if exists public.dm_display_name(uuid);

-- RLS: okuma politikaları kalkar → tablolar RLS açık + politika yok = istemciye kapalı.
drop policy if exists messages_select on public.messages;
drop policy if exists conversation_members_select on public.conversation_members;
drop policy if exists conversations_select on public.conversations;
drop function if exists public.dm_can_read(uuid, uuid);

-- Moderasyon: G63 hedeflerine ait açık kayıtlar kapatılır (silinmez), kısıtlar G62 listesine döner.
update public.moderation_queue set status = 'done' where target_type = 'message';
-- content_reports / moderation_actions'ta 'message' / 'conversation' satırı varsa kısıt eklenemez →
-- önce arşiv tablosuna taşı (veri kaybı yok).
create table if not exists public.g63_reports_archive as
  select * from public.content_reports where false;
insert into public.g63_reports_archive
  select * from public.content_reports where target_type in ('message', 'conversation');
delete from public.content_reports where target_type in ('message', 'conversation');
create table if not exists public.g63_mod_actions_archive as
  select * from public.moderation_actions where false;
insert into public.g63_mod_actions_archive
  select * from public.moderation_actions where target_type in ('message', 'conversation');
delete from public.moderation_actions where target_type in ('message', 'conversation');
create table if not exists public.g63_mod_queue_archive as
  select * from public.moderation_queue where false;
insert into public.g63_mod_queue_archive
  select * from public.moderation_queue where target_type = 'message';
delete from public.moderation_queue where target_type = 'message';

alter table public.content_reports drop constraint if exists content_reports_target_type_check;
alter table public.content_reports add  constraint content_reports_target_type_check
  check (target_type in ('post', 'user', 'day_card', 'comment', 'story', 'review'));
alter table public.moderation_actions drop constraint if exists moderation_actions_target_type_check;
alter table public.moderation_actions add  constraint moderation_actions_target_type_check
  check (target_type in ('post', 'user', 'day_card', 'comment', 'story', 'review'));
alter table public.moderation_queue drop constraint if exists moderation_queue_target_type_check;
alter table public.moderation_queue add  constraint moderation_queue_target_type_check
  check (target_type in ('post', 'comment', 'story', 'review'));

-- report_content — G59 gövdesi (G63 dalları yok).
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
  if p_target_type not in ('post', 'user', 'day_card', 'comment', 'story') then
    raise exception 'gecersiz_hedef';
  end if;
  if coalesce(trim(p_reason), '') = '' then raise exception 'sebep_zorunlu'; end if;

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
  elsif p_target_type = 'story' then
    v_visible := exists (
      select 1 from public.stories s
       where s.id = p_target and s.author_id <> v_uid
         and public.story_can_view(v_uid, s.id)
    );
  elsif p_target_type = 'user' then
    v_visible := exists (select 1 from public.profiles pr where pr.id = p_target)
                 and p_target is distinct from v_uid
                 and not public.feed_is_blocked(v_uid, p_target);
  end if;

  if not v_visible then
    raise exception 'bulunamadi' using errcode = '42501';
  end if;

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

-- mod_resolve_report — G59 gövdesi.
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

  perform set_config('app.post_rpc', 'on', true);

  if p_action = 'remove' then
    if r.target_type = 'post' then
      update public.posts set status = 'removed' where id = r.target_id;
    elsif r.target_type = 'comment' then
      update public.post_comments set status = 'removed' where id = r.target_id;
    elsif r.target_type = 'day_card' then
      update public.day_shares set expires_at = now() - interval '1 second' where id = r.target_id;
    elsif r.target_type = 'story' then
      update public.stories set status = 'removed' where id = r.target_id;
    end if;
  elsif p_action = 'dismiss' then
    if r.target_type = 'post' then
      update public.posts set status = 'published' where id = r.target_id and status = 'pending';
    elsif r.target_type = 'comment' then
      update public.post_comments set status = 'published' where id = r.target_id and status = 'pending';
    elsif r.target_type = 'story' then
      update public.stories set status = 'published' where id = r.target_id and status = 'pending';
    end if;
  end if;

  if r.target_type in ('post', 'comment', 'story') then
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

commit;

-- ─── TAM TEMİZLİK (VERİ SİLER — yalnız onayla, ayrı çalıştır) ───────────────────
-- begin;
--   drop table if exists public.messages;
--   drop table if exists public.conversation_members;
--   drop table if exists public.conversations;
--   drop table if exists public.g63_reports_archive;
--   drop table if exists public.g63_mod_actions_archive;
--   drop table if exists public.g63_mod_queue_archive;
--   delete from public.feature_flags where key = 'mesajlar';
-- commit;
