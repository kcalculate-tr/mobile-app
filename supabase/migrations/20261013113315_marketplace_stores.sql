-- Pazaryeri mağaza eşlemesi (13.10.2026)
-- Trendyol GO'da her MARKA ayrı satıcı hesabı (cari/supplier id), her ŞUBE ayrı
-- restoran (store) id. API anahtarı supplier başına tek; şubeyi storeId ayırır.
-- Anahtarlar burada DEĞİL — Edge Function secret'ında, secret_prefix ile.
CREATE TABLE IF NOT EXISTS public.marketplace_stores (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  platform       text NOT NULL DEFAULT 'trendyolgo',
  brand          text NOT NULL,
  supplier_id    text NOT NULL,
  store_id       text NOT NULL,
  branch_id      uuid NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  secret_prefix  text NOT NULL,
  is_active      boolean NOT NULL DEFAULT false,
  last_polled_at timestamptz,
  last_poll_error text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (platform, supplier_id, store_id)
);

ALTER TABLE public.marketplace_stores ENABLE ROW LEVEL SECURITY;

CREATE POLICY ms_select_staff ON public.marketplace_stores
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.admin_allowlist a WHERE a.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.branch_users bu
                WHERE bu.user_id = auth.uid() AND bu.branch_id = marketplace_stores.branch_id)
  );

INSERT INTO public.marketplace_stores (brand, supplier_id, store_id, branch_id, secret_prefix, is_active)
VALUES
  ('kcalculate',   '1078227', '468410', '921d0a7b-fe2f-47ce-95a9-f7bb5fb16bd0', 'TRENDYOLGO_KCALCULATE',   true),
  ('tera',         '6725507', '468415', '921d0a7b-fe2f-47ce-95a9-f7bb5fb16bd0', 'TRENDYOLGO_TERA',         true),
  ('breakingfast', '989799',  '468407', '921d0a7b-fe2f-47ce-95a9-f7bb5fb16bd0', 'TRENDYOLGO_BREAKINGFAST', true),
  ('kcalculate',   '1078227', '336068', 'aa8ef65d-a9aa-42fb-bc55-016ba2249dbd', 'TRENDYOLGO_KCALCULATE',   false),
  ('tera',         '6725507', '456386', 'aa8ef65d-a9aa-42fb-bc55-016ba2249dbd', 'TRENDYOLGO_TERA',         false),
  ('breakingfast', '989799',  '293817', 'aa8ef65d-a9aa-42fb-bc55-016ba2249dbd', 'TRENDYOLGO_BREAKINGFAST', false)
ON CONFLICT (platform, supplier_id, store_id) DO NOTHING;

-- Dış kanal siparişleri şube-stok kontrolünden geçmez: Trendyol ürün id'leri
-- bizim products.id ile aynı uzayda değil.
CREATE OR REPLACE FUNCTION public.fn_orders_branch_stock_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_kapali text;
BEGIN
  IF COALESCE(NEW.source, 'app') <> 'app' THEN
    RETURN NEW;
  END IF;

  IF NEW.branch_id IS NULL OR NEW.items IS NULL OR jsonb_typeof(NEW.items) <> 'array' THEN
    RETURN NEW;
  END IF;

  SELECT string_agg(DISTINCT p.name, ', ' ORDER BY p.name)
    INTO v_kapali
    FROM jsonb_array_elements(NEW.items) AS it
    JOIN public.products p ON p.id = NULLIF(it->>'id','')::bigint
    JOIN public.branch_product_stock s
      ON s.product_id = p.id AND s.branch_id = NEW.branch_id AND s.is_available = false;

  IF v_kapali IS NOT NULL THEN
    RAISE EXCEPTION 'Secilen urunler bu bolgeye hizmet veren subede tukendi: %', v_kapali
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
EXCEPTION
  WHEN check_violation THEN RAISE;
  WHEN OTHERS THEN
    RAISE WARNING 'fn_orders_branch_stock_guard failed: % (%)', SQLERRM, SQLSTATE;
    RETURN NEW;
END;
$$;
