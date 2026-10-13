-- Şubede kapatılmış ürün sipariş edilemez (13.10.2026)
-- Eski app sürümleri de dahil HER istemciyi kapsar: sipariş INSERT'te,
-- ödeme alınmadan önce reddedilir.
CREATE OR REPLACE FUNCTION public.fn_orders_branch_stock_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_kapali text;
BEGIN
  IF NEW.branch_id IS NULL OR NEW.items IS NULL OR jsonb_typeof(NEW.items) <> 'array' THEN
    RETURN NEW;
  END IF;

  SELECT string_agg(DISTINCT p.name, ', ' ORDER BY p.name)
    INTO v_kapali
    FROM jsonb_array_elements(NEW.items) AS it
    JOIN public.products p
      ON p.id = NULLIF(it->>'id','')::bigint
    JOIN public.branch_product_stock s
      ON s.product_id = p.id
     AND s.branch_id  = NEW.branch_id
     AND s.is_available = false;

  IF v_kapali IS NOT NULL THEN
    RAISE EXCEPTION 'Secilen urunler bu bolgeye hizmet veren subede tukendi: %', v_kapali
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
EXCEPTION
  WHEN check_violation THEN
    RAISE;
  WHEN OTHERS THEN
    RAISE WARNING 'fn_orders_branch_stock_guard failed: % (%)', SQLERRM, SQLSTATE;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_orders_stock_guard_insert ON public.orders;
CREATE TRIGGER trg_orders_stock_guard_insert
  BEFORE INSERT ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.fn_orders_branch_stock_guard();
