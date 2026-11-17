-- Önceki tanım (yalnız handle).
create or replace function public.get_public_profile(p_handle text)
returns jsonb language plpgsql stable security definer set search_path to 'public' as $function$
declare
  v_uid uuid := auth.uid(); p public.profiles%rowtype; v_following boolean; v_requested boolean; v_me text;
begin
  select * into p from public.profiles where lower(handle) = lower(btrim(coalesce(p_handle, '')));
  if not found then return null; end if;
  v_following := v_uid is not null and exists (select 1 from public.follows where follower_id = v_uid and following_id = p.id);
  v_requested := v_uid is not null and exists (select 1 from public.follow_requests where requester_id = v_uid and target_id = p.id);
  v_me := case when v_following then 'following' when v_requested then 'requested' else 'none' end;
  return jsonb_build_object('id', p.id, 'display_name', p.full_name, 'handle', p.handle, 'avatar_url', p.avatar_url,
    'bio', p.bio, 'role', p.role,
    'verified', exists (select 1 from public.creators c where c.user_id = p.id and c.verified_at is not null),
    'is_private', coalesce(p.is_private, false),
    'followers', (select count(*)::int from public.follows where following_id = p.id),
    'following', (select count(*)::int from public.follows where follower_id = p.id),
    'posts', (select count(*)::int from public.posts where author_id = p.id and status = 'published'),
    'me_following', v_me, 'me_requested', v_requested);
end; $function$;
