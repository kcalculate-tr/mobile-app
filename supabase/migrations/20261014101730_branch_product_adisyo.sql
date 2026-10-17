-- Şube bazlı Adisyo ürün eşlemesi (14.10.2026)
--
-- products.adisyo_product_unit_id TEK değerli ve merkez (Basın Sitesi) Adisyo
-- hesabının id'sini taşıyor. Bayraklı artık KENDİ Adisyo hesabına sahip ve o
-- hesabın productUnitId'leri bambaşka. Tek kolonla devam edilirse sipariş ya
-- unmapped_products ile düşer ya da id çakışırsa YANLIŞ ÜRÜN mutfağa iner.
--
-- Bu tablo yalnız merkez DIŞINDAKİ şubeler için doldurulur; merkez eskisi gibi
-- products.adisyo_product_unit_id'yi kullanmaya devam eder (regresyon yok).
CREATE TABLE IF NOT EXISTS public.branch_product_adisyo (
  branch_id             uuid   NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  product_id            bigint NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  adisyo_product_unit_id bigint NOT NULL,
  adisyo_product_code   text,
  -- 'code' | 'name' | 'manual' — isimle eşlenenler gözden geçirilebilsin.
  match_source          text,
  matched_name          text,
  updated_at            timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (branch_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_bpa_branch ON public.branch_product_adisyo (branch_id);

ALTER TABLE public.branch_product_adisyo ENABLE ROW LEVEL SECURITY;

-- Okuma yalnız yöneticiye; yazma service_role'a ait (edge function).
CREATE POLICY bpa_select_admin ON public.branch_product_adisyo
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.admin_allowlist a WHERE a.user_id = auth.uid())
  );

COMMENT ON TABLE public.branch_product_adisyo IS
  'Şube × ürün → o şubenin Adisyo hesabındaki productUnitId. Merkez şube bu tabloyu kullanmaz.';;
