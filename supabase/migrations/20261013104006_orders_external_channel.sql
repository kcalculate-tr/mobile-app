-- Dış pazaryeri kanalı (Trendyol GO) — 13.10.2026
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS source                   text NOT NULL DEFAULT 'app',
  ADD COLUMN IF NOT EXISTS external_order_id        text,
  ADD COLUMN IF NOT EXISTS external_code            text,
  ADD COLUMN IF NOT EXISTS external_store_id        text,
  ADD COLUMN IF NOT EXISTS external_status          text,
  ADD COLUMN IF NOT EXISTS external_payload         jsonb,
  ADD COLUMN IF NOT EXISTS external_sync_status     text,
  ADD COLUMN IF NOT EXISTS external_sync_error      text,
  ADD COLUMN IF NOT EXISTS external_last_attempt_at timestamptz;

COMMENT ON COLUMN public.orders.source IS 'app | trendyolgo | (ileride: migros, yemeksepeti…)';
COMMENT ON COLUMN public.orders.external_order_id IS 'Trendyol GO packageId (64 karakter)';

-- Aynı paketin iki kez yazılmasını engeller (poll tekrarına karşı idempotenlik)
CREATE UNIQUE INDEX IF NOT EXISTS uq_orders_external
  ON public.orders (source, external_order_id)
  WHERE external_order_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_orders_source_branch
  ON public.orders (source, branch_id)
  WHERE source <> 'app';

-- 1) Şube ataması: dış kanal siparişlerinde branch_id'yi EZME.
-- Trendyol adresi bizim mahalle eşlemelerimize uymaz (Model 2'de adres zaten
-- "Trendyol Yemek" olarak maskeli gelir); şubeyi storeId belirler.
CREATE OR REPLACE FUNCTION public.fn_assign_order_branch()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if COALESCE(NEW.source, 'app') <> 'app' and NEW.branch_id is not null then
    return NEW;
  end if;
  NEW.branch_id := public.fn_resolve_branch_for_order(NEW.district, NEW.neighbourhood, NEW.address_id);
  return NEW;
end;
$function$;

-- 2) branch_id koruması: dış kanal siparişlerinde adres bazlı doğrulama yapma.
CREATE OR REPLACE FUNCTION public.orders_guard_protected_cols()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

  if NEW.source is distinct from OLD.source
     or NEW.external_order_id is distinct from OLD.external_order_id then
    raise exception 'orders_guard: kanal alanları müşteri tarafından değiştirilemez';
  end if;

  if COALESCE(NEW.source, 'app') = 'app'
     and NEW.branch_id is distinct from OLD.branch_id
     and NEW.branch_id is distinct from public.fn_resolve_branch_for_order(NEW.district, NEW.neighbourhood, NEW.address_id) then
    raise exception 'orders_guard: branch_id yalnızca sunucu tarafından (adres bazlı) atanabilir';
  end if;

  return NEW;
end;
$function$;;
