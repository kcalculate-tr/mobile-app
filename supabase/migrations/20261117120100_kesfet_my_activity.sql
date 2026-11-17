-- 17 Kas — Keşfet "Etkinliğim": kullanıcının kaydettiği / beğendiği / yorum yaptığı gönderiler.
-- Yalnız OKUMA fonksiyonu (tablo/şema değişikliği yok). Geri alma: rollbacks/20261117120100_kesfet_my_activity_rollback.sql
create or replace function public.get_my_post_activity(p_kind text, p_limit integer default 50)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare
  v_uid   uuid := auth.uid();
  v_lim   int  := least(greatest(coalesce(p_limit, 50), 1), 100);
  v_items jsonb;
begin
  if v_uid is null then raise exception 'yetkisiz' using errcode = '42501'; end if;
  if p_kind not in ('save', 'like', 'comment') then raise exception 'gecersiz_tur'; end if;

  with acts as (
    select r.post_id, max(r.created_at) as acted_at, null::text as my_comment
      from public.post_reactions r
     where p_kind in ('save', 'like') and r.user_id = v_uid and r.kind = p_kind
     group by r.post_id
    union all
    select c.post_id, max(c.created_at), (array_agg(c.body order by c.created_at desc))[1]
      from public.post_comments c
     where p_kind = 'comment' and c.author_id = v_uid and c.status in ('published', 'pending')
     group by c.post_id
  ),
  rows_ as (
    select a.acted_at,
           jsonb_build_object(
             'id', p.id,
             'post_type', p.post_type,
             'body', p.body,
             'published_at', p.published_at,
             'acted_at', a.acted_at,
             'my_comment', a.my_comment,
             'meal_card', p.meal_card,
             'activity_card', p.activity_card,
             'media_url', (select m.url from public.post_media m where m.post_id = p.id order by m.sort, m.id limit 1),
             'author', jsonb_build_object(
               'id', p.author_id,
               'display_name', coalesce(
                 nullif(btrim(pr.full_name), ''),
                 nullif(btrim(coalesce(pr.first_name, '') || ' ' || coalesce(pr.last_name, '')), ''),
                 pr.handle, 'Kcalculate'),
               'handle', pr.handle,
               'avatar_url', pr.avatar_url)
           ) as item
      from acts a
      join public.posts p on p.id = a.post_id
      left join public.profiles pr on pr.id = p.author_id
     where p.status = 'published'
       and public.feed_can_view_author(v_uid, p.author_id)
     order by a.acted_at desc
     limit v_lim
  )
  select coalesce(jsonb_agg(item order by acted_at desc), '[]'::jsonb) into v_items from rows_;

  return jsonb_build_object('items', v_items);
end;
$function$;

revoke all on function public.get_my_post_activity(text, integer) from public, anon;
grant execute on function public.get_my_post_activity(text, integer) to authenticated;
