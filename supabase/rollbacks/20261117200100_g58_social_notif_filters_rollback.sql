-- G58-S1 rollback — 20261117200100_g58_social_notif_filters.sql öncesi gövdeler
-- (20261104002000_g8_social.sql ile birebir). İdempotent.

create or replace function public.social_notifications_guard()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if NEW.actor_id = NEW.user_id then
    return null;                         -- kendine bildirim yok
  end if;
  if public.feed_is_blocked(NEW.user_id, NEW.actor_id) then
    return null;                         -- çift yönlü engel → yok
  end if;
  if exists (
    select 1 from public.social_notifications n
    where n.user_id = NEW.user_id
      and n.actor_id = NEW.actor_id
      and n.kind = NEW.kind
      and n.post_id is not distinct from NEW.post_id
      and n.created_at > now() - interval '1 hour'
  ) then
    return null;                         -- hız sınırı / tekrar
  end if;
  return NEW;
end;
$$;

create or replace function public.list_social_notifications(
  p_cursor text default null,
  p_limit  int  default 30
)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_uid     uuid := auth.uid();
  v_lim     int  := least(greatest(coalesce(p_limit, 30), 1), 50);
  v_parts   text[];
  v_cur_ts  timestamptz;
  v_cur_id  uuid;
  v_result  jsonb;
begin
  if v_uid is null then raise exception 'yetkisiz' using errcode = '42501'; end if;

  if p_cursor is not null then
    v_parts  := string_to_array(convert_from(decode(p_cursor, 'base64'), 'utf8'), '|');
    v_cur_ts := to_timestamp((v_parts[1])::bigint / 1e6);
    v_cur_id := v_parts[2]::uuid;
  end if;

  with pageq as (
    select n.* from public.social_notifications n
    where n.user_id = v_uid
      and (p_cursor is null or (n.created_at, n.id) < (v_cur_ts, v_cur_id))
    order by n.created_at desc, n.id desc
    limit v_lim
  ),
  rows as (
    select n.created_at, n.id,
      jsonb_build_object(
        'id', n.id,
        'kind', n.kind,
        'post_id', n.post_id,
        'comment_id', n.comment_id,
        'created_at', n.created_at,
        'read_at', n.read_at,
        'actor', jsonb_build_object(
          'id', n.actor_id,
          'display_name', coalesce(
            pr.full_name,
            nullif(trim(coalesce(pr.first_name, '') || ' ' || coalesce(pr.last_name, '')), ''),
            pr.handle, 'Kcalculate'),
          'handle', pr.handle,
          'avatar_url', pr.avatar_url,
          'verified', exists (select 1 from public.creators cr
                              where cr.user_id = n.actor_id and cr.verified_at is not null)
        )
      ) as item
    from pageq n
    left join public.profiles pr on pr.id = n.actor_id
  ),
  agg as (
    select jsonb_agg(item order by created_at desc, id desc) as arr, count(*)::int as n from rows
  ),
  nxt as (
    select encode(convert_to(
             (extract(epoch from created_at) * 1e6)::bigint::text || '|' || id::text,
             'utf8'), 'base64') as c
    from rows order by created_at asc, id asc limit 1
  )
  select jsonb_build_object(
    'items', coalesce(agg.arr, '[]'::jsonb),
    'next_cursor', case when agg.n = v_lim then nxt.c else null end,
    'unread', (select count(*) from public.social_notifications
               where user_id = v_uid and read_at is null)
  ) into v_result
  from agg left join nxt on true;

  return coalesce(v_result, jsonb_build_object('items', '[]'::jsonb, 'next_cursor', null, 'unread', 0));
end;
$$;
