-- FAZ B ek: mobil app güncellenmeden önce oluşturulmuş siparişlerde (veya
-- ileride neighbourhood göndermeyen herhangi bir istemcide) orders.neighbourhood
-- boş kalabilir. district/neighbourhood boşsa artık NEW.address_id üzerinden
-- addresses tablosundaki değerlere düşülüyor — resolver'ın kendisi ve onu
-- çağıran her iki yer (trigger + guard) aynı sonucu üretmeli, aksi halde
-- orders_guard_protected_cols branch_id'yi haksız yere reddedebilir.

-- Eski 2 parametreli imza CREATE OR REPLACE ile değiştirilemez (parametre
-- sayısı değişiyor) — bırakılırsa 2 ve 3 parametreli sürüm birlikte var olur
-- ve 2-arg çağrılar belirsizlik hatası verir. Önce açıkça düşürülüyor.
drop function if exists public.fn_resolve_branch_for_order(text, text);

create or replace function public.fn_resolve_branch_for_order(
  p_district text,
  p_neighbourhood text,
  p_address_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_district text := trim(coalesce(p_district, ''));
  v_neighbourhood text := trim(coalesce(p_neighbourhood, ''));
  v_addr_district text;
  v_addr_neighbourhood text;
  v_branch_id uuid;
  v_branch_active boolean;
  v_default_branch_id uuid;
begin
  if p_address_id is not null and (v_district = '' or v_neighbourhood = '') then
    select trim(coalesce(a.district, '')), trim(coalesce(a.neighbourhood, ''))
      into v_addr_district, v_addr_neighbourhood
      from public.addresses a
     where a.id = p_address_id;

    if v_district = '' then
      v_district := coalesce(v_addr_district, '');
    end if;
    if v_neighbourhood = '' then
      v_neighbourhood := coalesce(v_addr_neighbourhood, '');
    end if;
  end if;

  select id into v_default_branch_id from public.branches where is_default limit 1;

  if v_district = '' then
    return v_default_branch_id;
  end if;

  select bsa.branch_id, b.is_active
    into v_branch_id, v_branch_active
    from public.branch_service_areas bsa
    join public.branches b on b.id = bsa.branch_id
   where bsa.is_active
     and lower(trim(bsa.district)) = lower(v_district)
     and (
       bsa.neighborhood is null
       or (v_neighbourhood <> '' and lower(trim(bsa.neighborhood)) = lower(v_neighbourhood))
     )
   order by
     (bsa.neighborhood is not null) desc,
     bsa.priority desc,
     bsa.created_at asc
   limit 1;

  if v_branch_id is null then
    return v_default_branch_id;
  end if;

  if not v_branch_active then
    return v_default_branch_id;
  end if;

  return v_branch_id;
end;
$$;

create or replace function public.fn_assign_order_branch()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  NEW.branch_id := public.fn_resolve_branch_for_order(NEW.district, NEW.neighbourhood, NEW.address_id);
  return NEW;
end;
$$;

create or replace function public.orders_guard_protected_cols()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_claims text := current_setting('request.jwt.claims', true);
  v_role   text := case when v_claims is null or v_claims = '' then null
                        else (v_claims::jsonb ->> 'role') end;
  v_priv   boolean;
begin
  if v_role is null or v_role = 'service_role' then
    return NEW;
  end if;

  v_priv := exists (select 1 from admin_allowlist a where a.user_id = auth.uid())
         or exists (select 1 from branch_users b where b.user_id = auth.uid());
  if v_priv then
    return NEW;
  end if;

  if NEW.payment_status = 'paid' and OLD.payment_status is distinct from 'paid' then
    raise exception 'orders_guard: payment_status=paid yalnızca sunucudan set edilebilir';
  end if;

  if NEW.status in ('confirmed','preparing','on_way','delivered')
     and OLD.status is distinct from NEW.status then
    raise exception 'orders_guard: "%" durumu yalnızca sunucudan/yönetimden set edilebilir', NEW.status;
  end if;

  if NEW.total_amount is distinct from OLD.total_amount
     or NEW.discount_amount is distinct from OLD.discount_amount
     or NEW.subtotal_amount is distinct from OLD.subtotal_amount
     or NEW.delivery_fee is distinct from OLD.delivery_fee
     or NEW.macro_discount_amount is distinct from OLD.macro_discount_amount then
    raise exception 'orders_guard: tutar alanları müşteri tarafından değiştirilemez';
  end if;

  if NEW.coupon_code is distinct from OLD.coupon_code
     or NEW.coupon_id is distinct from OLD.coupon_id then
    raise exception 'orders_guard: kupon alanları müşteri tarafından değiştirilemez';
  end if;

  if NEW.items is distinct from OLD.items then
    raise exception 'orders_guard: sipariş içeriği (items) müşteri tarafından değiştirilemez';
  end if;

  if NEW.adisyo_order_id is distinct from OLD.adisyo_order_id
     or NEW.adisyo_sync_status is distinct from OLD.adisyo_sync_status then
    raise exception 'orders_guard: adisyo alanları müşteri tarafından değiştirilemez';
  end if;

  if NEW.branch_id is distinct from OLD.branch_id
     and NEW.branch_id is distinct from public.fn_resolve_branch_for_order(NEW.district, NEW.neighbourhood, NEW.address_id) then
    raise exception 'orders_guard: branch_id yalnızca sunucu tarafından (adres bazlı) atanabilir';
  end if;

  return NEW;
end;
$$;
