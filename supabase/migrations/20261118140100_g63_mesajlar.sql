-- G63-S1 — Mesajlar (DM): 1:1 sohbet + istek kutusu + moderasyon + push. Grup sohbeti YALNIZ veri modeli.
-- version: 20261118140100  name: g63_mesajlar
--
-- DURUM: YALNIZ DOSYA. Hiçbir yere uygulanmadı (gece kuralı). Geri alma:
--   supabase/rollbacks/20261118140100_g63_mesajlar_rollback.sql
--
-- Önkoşul: G5–G11 Keşfet katmanı (profiles.is_private, follows, follow_requests, user_blocks, creators,
-- posts, content_reports, moderation_queue, moderation_actions, feed_is_blocked, feed_can_view_author,
-- feed_flag_enabled, feed_is_moderator, content_report_risk), G59 stories + story_can_view +
-- report_content / mod_resolve_report gövdeleri, G62 hedef listesi ('review'), Vault `service_role_key`,
-- pg_net, Realtime yayını `supabase_realtime`.
--
-- KURALLAR (istemci aynası: src/modules/mesajlar/rules.ts — tek kaynak bu dosya, istemci yalnız gösterir):
--   • Yazma YALNIZ RPC'lerden (SECURITY DEFINER). Doğrudan insert/update/delete politikası YOK.
--   • Okuma (RLS): yalnız sohbet üyeleri (state 'active' | 'request'); engel (iki yön) varsa görme yok;
--     'pending' / 'blocked' mesajı yalnız göndereni görür; silinen (deleted_at) kimse görmez.
--   • İstek: karşılıklı takip yoksa ilk mesaj alıcıda 'request' durumunda düşer. Kabul edilene kadar
--     okundu bilgisi (other_last_read_at) dönmez; yazıyor göstergesi istemcide aynı kuralla kapalı.
--     Alıcı kabul eder ('active') ya da siler ('declined' — gönderene bildirilmez).
--   • Gizli hesap: alıcı gizliyse ve gönderen onaylı takipçisi değilse mesaj atılamaz ('gizli_hesap').
--   • Engel (mevcut user_blocks): iki yönde gönderim yok ('engel'), sohbet listede ve okumada yok.
--   • Hız sınırı (sunucu): kişi başı dakikada 20 mesaj; günde (Europe/Istanbul) 30 yeni istek.
--     Aşımda RPC hata FIRLATMAZ, {error:'rate_limited', scope:'minute'|'requests'} döner.
--   • Silme: yalnız kendi mesajın, gönderimden sonra 15 dakika içinde ('sure_doldu').
--   • Moderasyon: metinli mesaj 'pending' yazılır + moderation_queue('message'); istemci hemen
--     moderate-content'i çağırır → izin: 'sent' (alıcı o an görür, push o an gider); ret: 'blocked'
--     (alıcı hiç görmez, gönderene nötr hata). Metinsiz paylaşım (gönderi/öğün kartı) doğrudan 'sent'.
--   • Bayrak `mesajlar` KAPALI → bütün RPC'ler 'kapali' fırlatır, push gitmez.
--
-- İçindekiler:
--   1) Bayrak `mesajlar` (KAPALI)
--   2) Tablolar: conversations, conversation_members, messages (+ dizinler)
--   3) Yardımcılar: dm_display_name, dm_can_read, dm_other_member, dm_mutual, dm_can_message, dm_person_json
--   4) RLS + Realtime yayını (messages)
--   5) Tetikleyiciler: son mesaj zamanı, push (sosyal push deseni)
--   6) RPC'ler: dm_open, dm_send, dm_inbox, dm_unread_count, dm_thread, dm_mark_read,
--      dm_accept_request, dm_decline_request, dm_leave, dm_mute, dm_delete_message, dm_search_people
--   7) Moderasyon: hedef türü += 'message', 'conversation'; report_content + mod_resolve_report
--   8) EXECUTE yetkileri
-- ═════════════════════════════════════════════════════════════════════════════

begin;

-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ 1) Bayrak — KAPALI                                                          ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝
insert into public.feature_flags (key, enabled, rollout_percent, min_app_version, description)
values (
  'mesajlar', false, 0, '1.1.0',
  'G63-S1: Mesajlar (DM) — gelen kutusu, istekler, 1:1 sohbet, hikâye yanıtı, gönderiyi mesajla gönder. Kapalıyken giriş yok, push yok. Native yok → OTA.'
)
on conflict (key) do nothing;

-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ 2) Tablolar                                                                ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝
create table if not exists public.conversations (
  id              uuid        primary key default gen_random_uuid(),
  kind            text        not null check (kind in ('1to1', 'group')),
  -- 1:1 tekilliği: '<küçük uuid>:<büyük uuid>'. Grupta null.
  pair_key        text        unique,
  -- Grup için (bu turda ekran yok): başlık + bağlı meydan okuma.
  title           text        check (title is null or char_length(title) <= 80),
  created_by      uuid        references auth.users(id) on delete set null,
  created_at      timestamptz not null default now(),
  last_message_at timestamptz,
  check ((kind = '1to1' and pair_key is not null) or (kind = 'group' and pair_key is null))
);

create table if not exists public.conversation_members (
  conversation_id uuid        not null references public.conversations(id) on delete cascade,
  user_id         uuid        not null references auth.users(id) on delete cascade,
  role            text        not null default 'member' check (role in ('owner', 'admin', 'member')),
  state           text        not null default 'active' check (state in ('active', 'request', 'declined', 'left')),
  last_read_at    timestamptz,
  muted           boolean     not null default false,
  joined_at       timestamptz not null default now(),
  -- İstek hız sınırı: bu üyeye isteği kim, ne zaman açtı (ilk mesajda yazılır).
  request_from    uuid        references auth.users(id) on delete set null,
  request_at      timestamptz,
  primary key (conversation_id, user_id)
);

create table if not exists public.messages (
  id              uuid        primary key default gen_random_uuid(),
  conversation_id uuid        not null references public.conversations(id) on delete cascade,
  sender_id       uuid        references auth.users(id) on delete set null,
  body            text        check (body is null or char_length(body) <= 1000),
  kind            text        not null default 'text' check (kind in ('text', 'post', 'story_reply', 'meal')),
  ref             jsonb,
  -- Moderasyon durumu (G63 kararı: brifteki sütunlara ek). 'pending' yalnız göndereni görür.
  status          text        not null default 'sent' check (status in ('pending', 'sent', 'blocked')),
  idempotency_key text,
  created_at      timestamptz not null default now(),
  deleted_at      timestamptz,
  check (kind <> 'text' or (body is not null and char_length(btrim(body)) > 0))
);

create unique index if not exists messages_sender_idem_uq on public.messages (sender_id, idempotency_key)
  where idempotency_key is not null;
create index if not exists messages_conv_created_idx on public.messages (conversation_id, created_at desc);
create index if not exists messages_sender_created_idx on public.messages (sender_id, created_at desc);
create index if not exists conversation_members_user_idx on public.conversation_members (user_id, state);
create index if not exists conversation_members_request_idx on public.conversation_members (request_from, request_at)
  where request_from is not null;
create index if not exists conversations_last_msg_idx on public.conversations (last_message_at desc nulls last);

-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ 3) Yardımcılar                                                             ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝
create or replace function public.dm_display_name(p_user uuid)
returns text language sql stable security definer set search_path = public as $$
  select coalesce(
           nullif(btrim(pr.full_name), ''),
           nullif(btrim(coalesce(pr.first_name, '') || ' ' || coalesce(pr.last_name, '')), ''),
           pr.handle, 'Biri')
    from public.profiles pr where pr.id = p_user;
$$;

-- Okuma yetkisi: üye ve durumu 'active' | 'request'.
create or replace function public.dm_can_read(p_uid uuid, p_conversation uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select p_uid is not null and exists (
    select 1 from public.conversation_members m
     where m.conversation_id = p_conversation and m.user_id = p_uid and m.state in ('active', 'request')
  );
$$;

-- 1:1'de karşı taraf (grupta null).
create or replace function public.dm_other_member(p_conversation uuid, p_uid uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select m.user_id
    from public.conversation_members m
    join public.conversations c on c.id = m.conversation_id and c.kind = '1to1'
   where m.conversation_id = p_conversation and m.user_id <> p_uid
   limit 1;
$$;

create or replace function public.dm_mutual(a uuid, b uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.follows f where f.follower_id = a and f.following_id = b)
     and exists (select 1 from public.follows f where f.follower_id = b and f.following_id = a);
$$;

-- Gönderebilir mi? null = evet; aksi hâlde neden kodu (istemci rules.ts `canMessage` ile aynı sıra):
--   'kendine' → 'bulunamadi' → 'engel' (iki yön) → 'gizli_hesap' (gizli + takipçi değil).
create or replace function public.dm_can_message(p_sender uuid, p_recipient uuid)
returns text language sql stable security definer set search_path = public as $$
  select case
    when p_sender is null or p_recipient is null then 'bulunamadi'
    when p_sender = p_recipient then 'kendine'
    when not exists (select 1 from public.profiles pr where pr.id = p_recipient) then 'bulunamadi'
    when public.feed_is_blocked(p_sender, p_recipient) then 'engel'
    when coalesce((select pr.is_private from public.profiles pr where pr.id = p_recipient), false)
         and not exists (select 1 from public.follows f
                          where f.follower_id = p_sender and f.following_id = p_recipient) then 'gizli_hesap'
    else null
  end;
$$;

create or replace function public.dm_person_json(p_user uuid, p_viewer uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'id',           pr.id,
    'display_name', public.dm_display_name(pr.id),
    'handle',       pr.handle,
    'avatar_url',   pr.avatar_url,
    'role',         coalesce(cr.role, 'user'),
    'verified',     (cr.verified_at is not null),
    'is_private',   coalesce(pr.is_private, false),
    'i_follow',     exists (select 1 from public.follows f where f.follower_id = p_viewer and f.following_id = pr.id),
    'follows_me',   exists (select 1 from public.follows f where f.follower_id = pr.id and f.following_id = p_viewer)
  )
    from public.profiles pr
    left join public.creators cr on cr.user_id = pr.id
   where pr.id = p_user;
$$;

-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ 4) RLS — yazma yalnız RPC; okuma yalnız üyeler. Realtime yayını: messages. ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝
alter table public.conversations        enable row level security;
alter table public.conversation_members enable row level security;
alter table public.messages             enable row level security;

drop policy if exists conversations_select on public.conversations;
create policy conversations_select on public.conversations
  for select to authenticated
  using (public.dm_can_read(auth.uid(), id));

-- Üye satırları: YALNIZ kendi satırın (karşı tarafın last_read_at'i istekte sızmasın diye RPC verir).
drop policy if exists conversation_members_select on public.conversation_members;
create policy conversation_members_select on public.conversation_members
  for select to authenticated
  using (user_id = auth.uid());

drop policy if exists messages_select on public.messages;
create policy messages_select on public.messages
  for select to authenticated
  using (
    public.dm_can_read(auth.uid(), conversation_id)
    and deleted_at is null
    and (status = 'sent' or sender_id = auth.uid())
    and (sender_id is null or sender_id = auth.uid() or not public.feed_is_blocked(auth.uid(), sender_id))
  );

-- Realtime: postgres_changes RLS'e uyar (yalnız okuyabilen üye olayı alır). Yayın yoksa atla.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables
                      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'messages') then
    execute 'alter publication supabase_realtime add table public.messages';
  end if;
end $$;

-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ 5) Tetikleyiciler                                                          ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝
-- Son mesaj zamanı yalnız mesaj 'sent' olunca ilerler (pending/blocked sırayı değiştirmez).
create or replace function public.dm_on_message_sent()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if NEW.status = 'sent' and NEW.deleted_at is null
     and (TG_OP = 'INSERT' or OLD.status is distinct from 'sent') then
    update public.conversations
       set last_message_at = greatest(coalesce(last_message_at, NEW.created_at), NEW.created_at)
     where id = NEW.conversation_id;
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_dm_on_message_sent on public.messages;
create trigger trg_dm_on_message_sent
  after insert or update of status on public.messages
  for each row execute function public.dm_on_message_sent();

-- Push (fn_push_social_notification deseni; metinler İlter onayı bekler — LOG "SORULAR"):
--   sohbet : "%{ad}: %{mesajın ilk 60 karakteri}"
--   istek  : "%{ad} sana mesaj göndermek istiyor"   (isteğin YALNIZ ilk mesajında)
-- İstemci sabiti: src/modules/mesajlar/push.ts (DM_PUSH_TEXT) — metinler birebir aynı (birim testi).
-- Bayrak kapalı → push yok. Sessize alınmış, engelli, reddedilmiş/ayrılmış alıcıya push yok.
create or replace function public.fn_push_dm_message()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_key     text;
  v_name    text;
  v_body    text;
  v_snip    text;
  v_req     bigint;
  r         record;
begin
  if not (NEW.status = 'sent' and NEW.deleted_at is null
          and (TG_OP = 'INSERT' or OLD.status is distinct from 'sent')) then
    return NEW;
  end if;
  if not public.feed_flag_enabled('mesajlar') then
    return NEW;
  end if;

  v_name := coalesce(public.dm_display_name(NEW.sender_id), 'Biri');
  v_snip := nullif(btrim(regexp_replace(coalesce(NEW.body, ''), '\s+', ' ', 'g')), '');
  if v_snip is not null and char_length(v_snip) > 60 then
    v_snip := left(v_snip, 60);
  end if;
  if v_snip is null then
    v_snip := case NEW.kind
      when 'post' then 'Bir gönderi paylaştı'
      when 'meal' then 'Bir öğün paylaştı'
      when 'story_reply' then 'Hikâyene yanıt verdi'
      else 'Yeni mesaj'
    end;
  end if;

  select decrypted_secret into v_key
    from vault.decrypted_secrets where name = 'service_role_key' limit 1;
  if v_key is null then
    raise warning 'fn_push_dm_message: service_role_key Vault''ta yok';
    return NEW;
  end if;

  for r in
    select m.user_id, m.state
      from public.conversation_members m
     where m.conversation_id = NEW.conversation_id
       and m.user_id <> NEW.sender_id
       and m.state in ('active', 'request')
       and not m.muted
       and not public.feed_is_blocked(m.user_id, NEW.sender_id)
  loop
    if r.state = 'request' then
      -- İstek push'u yalnız ilk mesajda (gönderenin bu sohbette 'sent' başka mesajı yoksa).
      if exists (select 1 from public.messages x
                  where x.conversation_id = NEW.conversation_id and x.sender_id = NEW.sender_id
                    and x.status = 'sent' and x.id <> NEW.id) then
        continue;
      end if;
      v_body := v_name || ' sana mesaj göndermek istiyor';
    else
      v_body := v_name || ': ' || v_snip;
    end if;

    select net.http_post(
      url := 'https://xtjakvinklthlvsfcncu.supabase.co/functions/v1/send-notification',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || v_key
      ),
      body := jsonb_build_object(
        'mode', 'by_content',
        'user_ids', jsonb_build_array(r.user_id),
        'title', 'Kcalculate',
        'body', v_body,
        'deep_link', 'kcal://dm/' || NEW.conversation_id::text,
        'category', 'behavioral',
        'data', jsonb_build_object('kind', 'dm', 'conversation_id', NEW.conversation_id, 'request', r.state = 'request')
      )
    ) into v_req;
  end loop;
  return NEW;
exception when others then
  raise warning 'fn_push_dm_message failed: % (%)', sqlerrm, sqlstate;
  return NEW;
end;
$function$;

drop trigger if exists trg_push_dm_message on public.messages;
create trigger trg_push_dm_message
  after insert or update of status on public.messages
  for each row execute function public.fn_push_dm_message();

-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ 6) RPC'ler                                                                  ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

-- Mesaj satırı biçimi (istemci src/modules/mesajlar/client.ts `normalizeMessage`).
create or replace function public.dm_message_json(m public.messages, p_viewer uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'id',              m.id,
    'conversation_id', m.conversation_id,
    'sender_id',       m.sender_id,
    'mine',            m.sender_id = p_viewer,
    'body',            m.body,
    'kind',            m.kind,
    'ref',             m.ref,
    'status',          m.status,
    'created_at',      m.created_at
  );
$$;

-- dm_open — 1:1 sohbet varsa döner, yoksa oluşturur (mesaj yokken alıcının kutusunda görünmez).
-- Karşı taraf: karşılıklı takip → 'active', değilse 'request'.
create or replace function public.dm_open(p_user uuid)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  v_uid    uuid := auth.uid();
  v_reason text;
  v_key    text;
  v_conv   uuid;
  v_new    boolean := false;
begin
  if v_uid is null then raise exception 'yetkisiz' using errcode = '42501'; end if;
  if not public.feed_flag_enabled('mesajlar') then raise exception 'kapali' using errcode = '42501'; end if;
  v_reason := public.dm_can_message(v_uid, p_user);
  if v_reason is not null then raise exception '%', v_reason using errcode = '42501'; end if;

  v_key := least(v_uid::text, p_user::text) || ':' || greatest(v_uid::text, p_user::text);
  select id into v_conv from public.conversations where pair_key = v_key;

  if v_conv is null then
    insert into public.conversations (kind, pair_key, created_by)
    values ('1to1', v_key, v_uid)
    on conflict (pair_key) do nothing
    returning id into v_conv;
    if v_conv is null then
      select id into v_conv from public.conversations where pair_key = v_key;
    else
      v_new := true;
      insert into public.conversation_members (conversation_id, user_id, role, state)
      values (v_conv, v_uid, 'member', 'active'),
             (v_conv, p_user, 'member', case when public.dm_mutual(v_uid, p_user) then 'active' else 'request' end)
      on conflict do nothing;
    end if;
  end if;

  -- Kendi tarafım: ayrıldıysam/reddettiysem açınca geri gelir.
  update public.conversation_members
     set state = 'active'
   where conversation_id = v_conv and user_id = v_uid and state in ('left', 'declined');

  return jsonb_build_object('conversation_id', v_conv, 'created', v_new);
end;
$$;

-- dm_send — tek yazma yolu. Dönüş: {id, status, created_at, needs_moderation} ya da {error:'rate_limited', scope}.
create or replace function public.dm_send(
  p_conversation uuid,
  p_body         text,
  p_kind         text default 'text',
  p_ref          jsonb default null,
  p_idem         text default null
)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  v_uid      uuid := auth.uid();
  v_conv     public.conversations%rowtype;
  v_me       public.conversation_members%rowtype;
  v_other    uuid;
  v_ostate   text;
  v_reason   text;
  v_body     text := nullif(btrim(coalesce(p_body, '')), '');
  v_kind     text := coalesce(p_kind, 'text');
  v_ref      jsonb := null;
  v_status   text;
  v_existing public.messages%rowtype;
  v_msg      public.messages%rowtype;
  v_cnt      int;
  v_first    boolean;
  v_target   uuid;
  v_author   uuid;
begin
  if v_uid is null then raise exception 'yetkisiz' using errcode = '42501'; end if;
  if not public.feed_flag_enabled('mesajlar') then raise exception 'kapali' using errcode = '42501'; end if;
  if p_idem is null or length(btrim(p_idem)) = 0 or length(p_idem) > 80 then raise exception 'idempotency_key_zorunlu'; end if;

  -- Aynı anahtar → aynı sonuç (ağ tekrarında çift mesaj yok).
  select * into v_existing from public.messages where sender_id = v_uid and idempotency_key = p_idem;
  if found then
    return jsonb_build_object('id', v_existing.id, 'status', v_existing.status,
                              'created_at', v_existing.created_at, 'needs_moderation', v_existing.status = 'pending',
                              'duplicate', true);
  end if;

  select * into v_conv from public.conversations where id = p_conversation;
  if not found then raise exception 'bulunamadi' using errcode = '42501'; end if;
  select * into v_me from public.conversation_members where conversation_id = p_conversation and user_id = v_uid;
  if not found then raise exception 'bulunamadi' using errcode = '42501'; end if;

  if v_kind not in ('text', 'post', 'story_reply', 'meal') then raise exception 'gecersiz_tur'; end if;
  if v_body is not null and char_length(v_body) > 1000 then raise exception 'cok_uzun'; end if;
  if v_kind in ('text', 'story_reply') and v_body is null then raise exception 'bos_mesaj'; end if;

  if v_conv.kind = '1to1' then
    v_other := public.dm_other_member(p_conversation, v_uid);
    v_reason := public.dm_can_message(v_uid, v_other);
    if v_reason is not null then raise exception '%', v_reason using errcode = '42501'; end if;
    select state into v_ostate from public.conversation_members where conversation_id = p_conversation and user_id = v_other;
  elsif v_me.state not in ('active', 'request') then
    raise exception 'bulunamadi' using errcode = '42501';
  end if;

  -- Ek içerik doğrulama (beyaz liste; istemcinin gönderdiği fazla alan saklanmaz).
  if v_kind = 'post' then
    begin v_target := (p_ref->>'post_id')::uuid; exception when others then v_target := null; end;
    if v_target is null then raise exception 'gecersiz_ref'; end if;
    select p.author_id into v_author from public.posts p
     where p.id = v_target and p.status = 'published' and public.feed_can_view_author(v_uid, p.author_id);
    if not found then raise exception 'gecersiz_ref'; end if;
    v_ref := jsonb_build_object('post_id', v_target);
  elsif v_kind = 'story_reply' then
    begin v_target := (p_ref->>'story_id')::uuid; exception when others then v_target := null; end;
    if v_target is null then raise exception 'gecersiz_ref'; end if;
    select s.author_id into v_author from public.stories s where s.id = v_target;
    if not found or not public.story_can_view(v_uid, v_target) then raise exception 'gecersiz_ref'; end if;
    if v_conv.kind <> '1to1' or v_author is distinct from v_other then raise exception 'gecersiz_ref'; end if;
    v_ref := jsonb_build_object('story_id', v_target);
  elsif v_kind = 'meal' then
    if p_ref is null or coalesce(btrim(p_ref->>'name'), '') = '' then raise exception 'gecersiz_ref'; end if;
    v_ref := jsonb_strip_nulls(jsonb_build_object(
      'name',      left(btrim(p_ref->>'name'), 80),
      'kcal',      case when (p_ref->>'kcal') ~ '^\d{1,5}$' then (p_ref->>'kcal')::int end,
      'protein_g', case when (p_ref->>'protein_g') ~ '^\d{1,4}$' then (p_ref->>'protein_g')::int end
    ));
  end if;

  -- Hız sınırı 1: dakikada 20 mesaj (gönderen başına, tüm sohbetler).
  select count(*) into v_cnt from public.messages
   where sender_id = v_uid and created_at > now() - interval '1 minute';
  if v_cnt >= 20 then
    return jsonb_build_object('error', 'rate_limited', 'scope', 'minute');
  end if;

  -- İstek mi? Karşı taraf 'request' ve karşılıklı takip oluştuysa → 'active' (artık istek değil).
  if v_conv.kind = '1to1' and v_ostate = 'request' and public.dm_mutual(v_uid, v_other) then
    update public.conversation_members set state = 'active'
     where conversation_id = p_conversation and user_id = v_other;
    v_ostate := 'active';
  end if;

  if v_conv.kind = '1to1' and v_ostate = 'request' then
    v_first := not exists (select 1 from public.messages x
                            where x.conversation_id = p_conversation and x.sender_id = v_uid);
    if v_first then
      -- Hız sınırı 2: günde (İstanbul) 30 yeni istek.
      select count(*) into v_cnt from public.conversation_members
       where request_from = v_uid
         and (request_at at time zone 'Europe/Istanbul')::date = (now() at time zone 'Europe/Istanbul')::date;
      if v_cnt >= 30 then
        return jsonb_build_object('error', 'rate_limited', 'scope', 'requests');
      end if;
      update public.conversation_members set request_from = v_uid, request_at = now()
       where conversation_id = p_conversation and user_id = v_other;
    end if;
  end if;

  -- Ayrılmış karşı taraf yeni mesajla geri gelir; reddetmiş taraf 'declined' kalır (görmez, haber verilmez).
  if v_conv.kind = '1to1' and v_ostate = 'left' then
    update public.conversation_members set state = 'active'
     where conversation_id = p_conversation and user_id = v_other;
  end if;

  -- Gönderen yazdıysa istek/ayrılma kendi tarafında biter.
  if v_me.state <> 'active' then
    update public.conversation_members set state = 'active'
     where conversation_id = p_conversation and user_id = v_uid;
  end if;

  v_status := case when v_body is not null then 'pending' else 'sent' end;

  insert into public.messages (conversation_id, sender_id, body, kind, ref, status, idempotency_key)
  values (p_conversation, v_uid, v_body, v_kind, v_ref, v_status, p_idem)
  returning * into v_msg;

  if v_status = 'pending' then
    insert into public.moderation_queue (target_type, target_id)
    values ('message', v_msg.id)
    on conflict do nothing;
  end if;

  -- Gönderen kendi mesajını okumuş sayılır.
  update public.conversation_members set last_read_at = v_msg.created_at
   where conversation_id = p_conversation and user_id = v_uid;

  return jsonb_build_object('id', v_msg.id, 'status', v_msg.status, 'created_at', v_msg.created_at,
                            'needs_moderation', v_status = 'pending');
end;
$$;

-- dm_inbox — p_tab 'all' (Sohbetler) | 'requests' (İstekler). İmleç: base64('<µs>|<uuid>').
create or replace function public.dm_inbox(p_tab text default 'all', p_cursor text default null, p_limit int default 30)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_uid    uuid := auth.uid();
  v_lim    int  := least(greatest(coalesce(p_limit, 30), 1), 50);
  v_state  text;
  v_parts  text[];
  v_cur_ts timestamptz;
  v_cur_id uuid;
  v_items  jsonb;
  v_last   record;
  v_next   text;
begin
  if v_uid is null then raise exception 'yetkisiz' using errcode = '42501'; end if;
  if not public.feed_flag_enabled('mesajlar') then raise exception 'kapali' using errcode = '42501'; end if;
  if coalesce(p_tab, 'all') not in ('all', 'requests') then raise exception 'gecersiz_sekme'; end if;
  v_state := case when p_tab = 'requests' then 'request' else 'active' end;

  if p_cursor is not null then
    v_parts  := string_to_array(convert_from(decode(p_cursor, 'base64'), 'utf8'), '|');
    v_cur_ts := to_timestamp((v_parts[1])::bigint / 1e6);
    v_cur_id := v_parts[2]::uuid;
  end if;

  with rows as (
    select c.id, c.kind, c.last_message_at, m.muted, m.last_read_at,
           public.dm_other_member(c.id, v_uid) as other_id
      from public.conversation_members m
      join public.conversations c on c.id = m.conversation_id
     where m.user_id = v_uid
       and m.state = v_state
       and c.last_message_at is not null
       and (v_cur_ts is null or (c.last_message_at, c.id) < (v_cur_ts, v_cur_id))
     order by c.last_message_at desc, c.id desc
  ), visible as (
    select r.* from rows r
     where r.other_id is null or not public.feed_is_blocked(v_uid, r.other_id)
     order by r.last_message_at desc, r.id desc
     limit v_lim + 1
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'conversation_id', v.id,
           'kind',            v.kind,
           'muted',           v.muted,
           'last_message_at', v.last_message_at,
           'other',           case when v.other_id is not null then public.dm_person_json(v.other_id, v_uid) end,
           'last',            (select public.dm_message_json(x, v_uid) from public.messages x
                                where x.conversation_id = v.id and x.deleted_at is null
                                  and (x.status = 'sent' or x.sender_id = v_uid)
                                order by x.created_at desc limit 1),
           'unread',          (select count(*) from public.messages x
                                where x.conversation_id = v.id and x.deleted_at is null and x.status = 'sent'
                                  and x.sender_id <> v_uid
                                  and x.created_at > coalesce(v.last_read_at, 'epoch'::timestamptz))
         ) order by v.last_message_at desc, v.id desc), '[]'::jsonb)
    into v_items
    from visible v;

  if jsonb_array_length(v_items) > v_lim then
    v_items := v_items - v_lim;
    v_next := encode(convert_to(
      (extract(epoch from ((v_items->(v_lim - 1))->>'last_message_at')::timestamptz) * 1e6)::bigint::text
        || '|' || ((v_items->(v_lim - 1))->>'conversation_id'), 'utf8'), 'base64');
  end if;

  return jsonb_build_object('items', v_items, 'next_cursor', v_next) || public.dm_unread_count();
end;
$$;

-- Rozet: okunmamış mesajı olan, sessize alınmamış aktif sohbet sayısı + bekleyen istek sayısı.
create or replace function public.dm_unread_count()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_unread int;
  v_req int;
begin
  if v_uid is null then raise exception 'yetkisiz' using errcode = '42501'; end if;
  if not public.feed_flag_enabled('mesajlar') then
    return jsonb_build_object('unread', 0, 'requests', 0);
  end if;
  select count(*) into v_unread
    from public.conversation_members m
    join public.conversations c on c.id = m.conversation_id
   where m.user_id = v_uid and m.state = 'active' and not m.muted and c.last_message_at is not null
     and exists (select 1 from public.messages x
                  where x.conversation_id = m.conversation_id and x.deleted_at is null and x.status = 'sent'
                    and x.sender_id <> v_uid and not public.feed_is_blocked(v_uid, x.sender_id)
                    and x.created_at > coalesce(m.last_read_at, 'epoch'::timestamptz));
  select count(*) into v_req
    from public.conversation_members m
    join public.conversations c on c.id = m.conversation_id
   where m.user_id = v_uid and m.state = 'request' and c.last_message_at is not null
     and (public.dm_other_member(c.id, v_uid) is null
          or not public.feed_is_blocked(v_uid, public.dm_other_member(c.id, v_uid)));
  return jsonb_build_object('unread', v_unread, 'requests', v_req);
end;
$$;

-- dm_thread — sohbet başlığı + sayfa (eskiden yeniye). Okundu bilgisi YALNIZ iki taraf da 'active' iken.
create or replace function public.dm_thread(p_conversation uuid, p_before timestamptz default null, p_limit int default 40)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_uid    uuid := auth.uid();
  v_lim    int  := least(greatest(coalesce(p_limit, 40), 1), 100);
  v_conv   public.conversations%rowtype;
  v_me     public.conversation_members%rowtype;
  v_other  uuid;
  v_om     public.conversation_members%rowtype;
  v_msgs   jsonb;
  v_more   boolean;
begin
  if v_uid is null then raise exception 'yetkisiz' using errcode = '42501'; end if;
  if not public.feed_flag_enabled('mesajlar') then raise exception 'kapali' using errcode = '42501'; end if;
  select * into v_conv from public.conversations where id = p_conversation;
  if not found or not public.dm_can_read(v_uid, p_conversation) then raise exception 'bulunamadi' using errcode = '42501'; end if;
  select * into v_me from public.conversation_members where conversation_id = p_conversation and user_id = v_uid;
  v_other := public.dm_other_member(p_conversation, v_uid);
  if v_other is not null and public.feed_is_blocked(v_uid, v_other) then raise exception 'engel' using errcode = '42501'; end if;
  if v_other is not null then
    select * into v_om from public.conversation_members where conversation_id = p_conversation and user_id = v_other;
  end if;

  with page as (
    select m.id
      from public.messages m
     where m.conversation_id = p_conversation and m.deleted_at is null
       and (m.status = 'sent' or m.sender_id = v_uid)
       and (p_before is null or m.created_at < p_before)
     order by m.created_at desc
     limit v_lim + 1
  )
  select coalesce(jsonb_agg(public.dm_message_json(x, v_uid) order by x.created_at asc), '[]'::jsonb),
         count(*) > v_lim
    into v_msgs, v_more
    from public.messages x
    join page on page.id = x.id;
  if v_more then
    -- En eski fazlalığı at (dizi eskiden yeniye).
    v_msgs := v_msgs - 0;
  end if;

  return jsonb_build_object(
    'conversation', jsonb_build_object(
      'id',          v_conv.id,
      'kind',        v_conv.kind,
      'my_state',    v_me.state,
      'muted',       v_me.muted,
      'other',       case when v_other is not null then public.dm_person_json(v_other, v_uid) end,
      -- Karşı taraf isteği henüz kabul etmediyse gönderen bunu "beklemede" diye bilmez; yalnız okundu gizlenir.
      'other_last_read_at', case when v_me.state = 'active' and v_om.state = 'active' then v_om.last_read_at end,
      'can_send',    v_other is null or public.dm_can_message(v_uid, v_other) is null,
      'cannot_reason', case when v_other is not null then public.dm_can_message(v_uid, v_other) end
    ),
    'messages', v_msgs,
    'has_more', v_more
  );
end;
$$;

create or replace function public.dm_mark_read(p_conversation uuid)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'yetkisiz' using errcode = '42501'; end if;
  if not public.feed_flag_enabled('mesajlar') then raise exception 'kapali' using errcode = '42501'; end if;
  update public.conversation_members set last_read_at = now()
   where conversation_id = p_conversation and user_id = v_uid and state in ('active', 'request');
  if not found then raise exception 'bulunamadi' using errcode = '42501'; end if;
  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.dm_accept_request(p_conversation uuid)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_other uuid;
begin
  if v_uid is null then raise exception 'yetkisiz' using errcode = '42501'; end if;
  if not public.feed_flag_enabled('mesajlar') then raise exception 'kapali' using errcode = '42501'; end if;
  v_other := public.dm_other_member(p_conversation, v_uid);
  if v_other is not null and public.feed_is_blocked(v_uid, v_other) then raise exception 'engel' using errcode = '42501'; end if;
  update public.conversation_members set state = 'active', last_read_at = now()
   where conversation_id = p_conversation and user_id = v_uid and state = 'request';
  if not found then raise exception 'istek_yok'; end if;
  return jsonb_build_object('ok', true);
end;
$$;

-- "Sil" (istek): reddet — gönderene bildirilmez, sonraki mesajları da görülmez.
create or replace function public.dm_decline_request(p_conversation uuid)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'yetkisiz' using errcode = '42501'; end if;
  if not public.feed_flag_enabled('mesajlar') then raise exception 'kapali' using errcode = '42501'; end if;
  update public.conversation_members set state = 'declined'
   where conversation_id = p_conversation and user_id = v_uid and state = 'request';
  if not found then raise exception 'istek_yok'; end if;
  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.dm_leave(p_conversation uuid)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'yetkisiz' using errcode = '42501'; end if;
  if not public.feed_flag_enabled('mesajlar') then raise exception 'kapali' using errcode = '42501'; end if;
  update public.conversation_members set state = 'left', last_read_at = now()
   where conversation_id = p_conversation and user_id = v_uid and state in ('active', 'request');
  if not found then raise exception 'bulunamadi' using errcode = '42501'; end if;
  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.dm_mute(p_conversation uuid, p_on boolean)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'yetkisiz' using errcode = '42501'; end if;
  if not public.feed_flag_enabled('mesajlar') then raise exception 'kapali' using errcode = '42501'; end if;
  update public.conversation_members set muted = coalesce(p_on, false)
   where conversation_id = p_conversation and user_id = v_uid;
  if not found then raise exception 'bulunamadi' using errcode = '42501'; end if;
  return jsonb_build_object('ok', true, 'muted', coalesce(p_on, false));
end;
$$;

-- Yalnız kendi mesajın, 15 dakika içinde.
create or replace function public.dm_delete_message(p_message uuid)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_msg public.messages%rowtype;
begin
  if v_uid is null then raise exception 'yetkisiz' using errcode = '42501'; end if;
  if not public.feed_flag_enabled('mesajlar') then raise exception 'kapali' using errcode = '42501'; end if;
  select * into v_msg from public.messages where id = p_message for update;
  if not found or v_msg.sender_id is distinct from v_uid or v_msg.deleted_at is not null then
    raise exception 'bulunamadi' using errcode = '42501';
  end if;
  if v_msg.created_at < now() - interval '15 minutes' then raise exception 'sure_doldu'; end if;
  update public.messages set deleted_at = now() where id = p_message;
  return jsonb_build_object('ok', true);
end;
$$;

-- Kişi arama (Yeni mesaj › Kime). q < 2 karakter → öneriler (karşılıklı → takip ettiğim → beni takip eden).
-- Yalnız mesaj atılabilen kişiler (engel yok, gizliyse takipçisiyim). En çok 24.
create or replace function public.dm_search_people(q text default null)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_uid   uuid := auth.uid();
  v_pat   text := public.search_like_pattern(q);
  v_exact text := lower(ltrim(btrim(coalesce(q, '')), '@'));
  v_items jsonb;
begin
  if v_uid is null then raise exception 'yetkisiz' using errcode = '42501'; end if;
  if not public.feed_flag_enabled('mesajlar') then raise exception 'kapali' using errcode = '42501'; end if;

  if v_pat is null then
    select coalesce(jsonb_agg(public.dm_person_json(s.id, v_uid) || jsonb_build_object('mutual_count', 0)
                              order by s.rnk, s.sort_name), '[]'::jsonb)
      into v_items
      from (
        select p.id,
               case when public.dm_mutual(v_uid, p.id) then 0
                    when exists (select 1 from public.follows f where f.follower_id = v_uid and f.following_id = p.id) then 1
                    else 2 end as rnk,
               lower(coalesce(p.full_name, p.handle)) as sort_name
          from public.profiles p
         where p.id <> v_uid and p.handle is not null
           and (exists (select 1 from public.follows f where f.follower_id = v_uid and f.following_id = p.id)
                or exists (select 1 from public.follows f where f.follower_id = p.id and f.following_id = v_uid))
           and public.dm_can_message(v_uid, p.id) is null
         order by rnk, sort_name
         limit 8
      ) s;
    return jsonb_build_object('items', v_items, 'suggested', true);
  end if;

  select coalesce(jsonb_agg(public.dm_person_json(r.id, v_uid) || jsonb_build_object('mutual_count', r.mutual_count)
                            order by r.rnk, r.sort_name), '[]'::jsonb)
    into v_items
    from (
      select p.id,
             case
               when lower(p.handle) = v_exact then 0
               when lower(p.handle) like lower(ltrim(v_pat, '%')) escape '\' then 1
               when cr.verified_at is not null then 2
               else 3
             end as rnk,
             lower(coalesce(p.full_name, p.handle)) as sort_name,
             (select count(*) from public.follows a
                join public.follows b on b.follower_id = a.following_id and b.following_id = p.id
               where a.follower_id = v_uid)::int as mutual_count
        from public.profiles p
        left join public.creators cr on cr.user_id = p.id
       where p.handle is not null
         and p.id <> v_uid
         and (p.handle ilike v_pat escape '\'
              or p.full_name ilike v_pat escape '\'
              or (coalesce(p.first_name, '') || ' ' || coalesce(p.last_name, '')) ilike v_pat escape '\')
         and public.dm_can_message(v_uid, p.id) is null
       order by rnk, sort_name
       limit 24
    ) r;
  return jsonb_build_object('items', v_items, 'suggested', false);
end;
$$;

-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ 7) Moderasyon — 'message' (+ 'conversation' = sohbeti bildir)               ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝
alter table public.content_reports drop constraint if exists content_reports_target_type_check;
alter table public.content_reports add  constraint content_reports_target_type_check
  check (target_type in ('post', 'user', 'day_card', 'comment', 'story', 'review', 'message', 'conversation'));

alter table public.moderation_actions drop constraint if exists moderation_actions_target_type_check;
alter table public.moderation_actions add  constraint moderation_actions_target_type_check
  check (target_type in ('post', 'user', 'day_card', 'comment', 'story', 'review', 'message', 'conversation'));

alter table public.moderation_queue drop constraint if exists moderation_queue_target_type_check;
alter table public.moderation_queue add  constraint moderation_queue_target_type_check
  check (target_type in ('post', 'comment', 'story', 'review', 'message'));

-- report_content — G59 gövdesi BİREBİR + 'message' (okuyabildiğin, başkasının mesajı) + 'conversation' (üyesi olduğun).
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
  if p_target_type not in ('post', 'user', 'day_card', 'comment', 'story', 'message', 'conversation') then
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
    -- G59: kendi hikâyeni bildiremezsin; görülebilen (aktif ya da öne çıkan) hikâye.
    v_visible := exists (
      select 1 from public.stories s
       where s.id = p_target and s.author_id <> v_uid
         and public.story_can_view(v_uid, s.id)
    );
  elsif p_target_type = 'message' then
    -- G63: üyesi olduğun sohbetteki başkasının (gönderilmiş) mesajı. Engelledikten sonra da bildirilebilir.
    v_visible := exists (
      select 1 from public.messages m
       join public.conversation_members cm on cm.conversation_id = m.conversation_id and cm.user_id = v_uid
       where m.id = p_target and m.sender_id is distinct from v_uid and m.status = 'sent'
    );
  elsif p_target_type = 'conversation' then
    v_visible := exists (
      select 1 from public.conversation_members cm
       where cm.conversation_id = p_target and cm.user_id = v_uid
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

-- mod_resolve_report — G59 gövdesi BİREBİR + 'message' (kaldır = deleted_at; yayınla = pending/blocked → sent).
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
    elsif r.target_type = 'message' then
      update public.messages set deleted_at = coalesce(deleted_at, now()) where id = r.target_id;
    end if;
  elsif p_action = 'dismiss' then
    if r.target_type = 'post' then
      update public.posts set status = 'published' where id = r.target_id and status = 'pending';
    elsif r.target_type = 'comment' then
      update public.post_comments set status = 'published' where id = r.target_id and status = 'pending';
    elsif r.target_type = 'story' then
      update public.stories set status = 'published' where id = r.target_id and status = 'pending';
    elsif r.target_type = 'message' then
      update public.messages set status = 'sent' where id = r.target_id and status in ('pending', 'blocked');
    end if;
  end if;

  if r.target_type in ('post', 'comment', 'story', 'message') then
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

-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ 8) EXECUTE yetkileri                                                         ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝
revoke all on function public.dm_display_name(uuid)                 from public, anon;
revoke all on function public.dm_can_read(uuid, uuid)               from public, anon;
revoke all on function public.dm_other_member(uuid, uuid)           from public, anon;
revoke all on function public.dm_mutual(uuid, uuid)                 from public, anon;
revoke all on function public.dm_can_message(uuid, uuid)            from public, anon;
revoke all on function public.dm_person_json(uuid, uuid)            from public, anon;
revoke all on function public.dm_message_json(public.messages, uuid) from public, anon;
revoke all on function public.dm_on_message_sent()                  from public, anon, authenticated;
revoke all on function public.fn_push_dm_message()                  from public, anon, authenticated;
revoke all on function public.dm_open(uuid)                         from public, anon;
revoke all on function public.dm_send(uuid, text, text, jsonb, text) from public, anon;
revoke all on function public.dm_inbox(text, text, int)             from public, anon;
revoke all on function public.dm_unread_count()                     from public, anon;
revoke all on function public.dm_thread(uuid, timestamptz, int)     from public, anon;
revoke all on function public.dm_mark_read(uuid)                    from public, anon;
revoke all on function public.dm_accept_request(uuid)               from public, anon;
revoke all on function public.dm_decline_request(uuid)              from public, anon;
revoke all on function public.dm_leave(uuid)                        from public, anon;
revoke all on function public.dm_mute(uuid, boolean)                from public, anon;
revoke all on function public.dm_delete_message(uuid)               from public, anon;
revoke all on function public.dm_search_people(text)                from public, anon;

-- RLS politikalarında kullanılan yardımcılar authenticated'a açık (yalnız boolean döner).
grant execute on function public.dm_can_read(uuid, uuid)               to authenticated;
grant execute on function public.dm_open(uuid)                         to authenticated;
grant execute on function public.dm_send(uuid, text, text, jsonb, text) to authenticated;
grant execute on function public.dm_inbox(text, text, int)             to authenticated;
grant execute on function public.dm_unread_count()                     to authenticated;
grant execute on function public.dm_thread(uuid, timestamptz, int)     to authenticated;
grant execute on function public.dm_mark_read(uuid)                    to authenticated;
grant execute on function public.dm_accept_request(uuid)               to authenticated;
grant execute on function public.dm_decline_request(uuid)              to authenticated;
grant execute on function public.dm_leave(uuid)                        to authenticated;
grant execute on function public.dm_mute(uuid, boolean)                to authenticated;
grant execute on function public.dm_delete_message(uuid)               to authenticated;
grant execute on function public.dm_search_people(text)                to authenticated;

commit;
