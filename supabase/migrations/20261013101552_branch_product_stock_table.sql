-- Şube bazlı ürün kapatma (13.10.2026)
-- Yalnız KAPALI olan tutulur: satır yoksa o şubede açıktır.
CREATE TABLE IF NOT EXISTS public.branch_product_stock (
  branch_id    uuid        NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  product_id   bigint      NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  is_available boolean     NOT NULL DEFAULT true,
  note         text,
  updated_at   timestamptz NOT NULL DEFAULT now(),
  updated_by   uuid,
  PRIMARY KEY (branch_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_bps_product_closed
  ON public.branch_product_stock (product_id)
  WHERE is_available = false;

ALTER TABLE public.branch_product_stock ENABLE ROW LEVEL SECURITY;

CREATE POLICY bps_select_all ON public.branch_product_stock
  FOR SELECT USING (true);

CREATE POLICY bps_insert_branch_or_admin ON public.branch_product_stock
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.branch_users bu
             WHERE bu.user_id = auth.uid() AND bu.branch_id = branch_product_stock.branch_id)
    OR EXISTS (SELECT 1 FROM public.admin_allowlist a WHERE a.user_id = auth.uid())
  );

CREATE POLICY bps_update_branch_or_admin ON public.branch_product_stock
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.branch_users bu
             WHERE bu.user_id = auth.uid() AND bu.branch_id = branch_product_stock.branch_id)
    OR EXISTS (SELECT 1 FROM public.admin_allowlist a WHERE a.user_id = auth.uid())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM public.branch_users bu
             WHERE bu.user_id = auth.uid() AND bu.branch_id = branch_product_stock.branch_id)
    OR EXISTS (SELECT 1 FROM public.admin_allowlist a WHERE a.user_id = auth.uid())
  );

CREATE POLICY bps_delete_branch_or_admin ON public.branch_product_stock
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.branch_users bu
             WHERE bu.user_id = auth.uid() AND bu.branch_id = branch_product_stock.branch_id)
    OR EXISTS (SELECT 1 FROM public.admin_allowlist a WHERE a.user_id = auth.uid())
  );
