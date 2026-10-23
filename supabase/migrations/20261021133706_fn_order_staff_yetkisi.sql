-- adisyo-status-forward fonksiyonunun yetki kontrolu icin:
-- kullanici admin mi, yoksa bu siparisin subesinin calisani mi?
create or replace function public.fn_order_staff_yetkisi(p_user_id uuid, p_order_id bigint)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select exists (select 1 from public.admin_allowlist a where a.user_id = p_user_id)
      or exists (
           select 1
             from public.orders o
             join public.branch_users bu on bu.branch_id = o.branch_id
            where o.id = p_order_id and bu.user_id = p_user_id
         );
$$;

revoke all on function public.fn_order_staff_yetkisi(uuid, bigint) from public, anon, authenticated;;
