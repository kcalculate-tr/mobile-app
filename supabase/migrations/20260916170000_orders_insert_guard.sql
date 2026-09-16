-- KRİTİK: orders_guard_protected_cols yalnızca BEFORE UPDATE'te çalışıyordu,
-- INSERT'i hiç korumuyordu. Test ettim: authenticated kullanıcı kendi
-- user_id'siyle status='confirmed', payment_status='paid', total_amount=0
-- olan bir sipariş doğrudan INSERT edebiliyordu — bu, tüm ödeme akışını
-- atlayan bir ücretsiz-yemek açığıydı. INSERT ayrıca record_order_purchase_event
-- trigger'ını da tetikleyip sahte bir 'purchase' analytics event'i üretiyordu
-- (test ettim, gerçekten oluyor) — muhtemelen adisyo/push trigger'larını da
-- (aynı AFTER INSERT OR UPDATE deseni) tetikler.
--
-- Ayrıcalıksız (service_role/admin/branch olmayan) kullanıcı için INSERT'te
-- status yalnızca 'pending' / 'pending_payment', payment_status yalnızca
-- 'pending' olabilir — createOrderDraftForPayment'ın yazdığı gerçek değerler
-- (src/lib/orders.ts:255-256, 417-418).
create or replace function public.orders_guard_insert()
returns trigger
language plpgsql
security definer
set search_path to 'public'
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

  if NEW.status not in ('pending', 'pending_payment') then
    raise exception 'orders_guard: yeni sipariş yalnızca pending/pending_payment durumunda oluşturulabilir';
  end if;

  if NEW.payment_status is distinct from 'pending' then
    raise exception 'orders_guard: yeni siparişte payment_status yalnızca pending olabilir';
  end if;

  return NEW;
end;
$$;

drop trigger if exists trg_orders_guard_insert on public.orders;

create trigger trg_orders_guard_insert
  before insert on public.orders
  for each row
  execute function public.orders_guard_insert();
