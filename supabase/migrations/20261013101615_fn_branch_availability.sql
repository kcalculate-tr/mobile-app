-- Mobil app: teslimat adresi seçilince hangi şubeye düştüğünü ve o şubede
-- KAPALI olan ürünleri tek çağrıda alır.
CREATE OR REPLACE FUNCTION public.fn_branch_availability(
  p_district       text DEFAULT NULL,
  p_neighbourhood  text DEFAULT NULL,
  p_address_id     uuid DEFAULT NULL
)
RETURNS TABLE (branch_id uuid, branch_name text, closed_product_ids bigint[])
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_branch uuid;
BEGIN
  v_branch := public.fn_resolve_branch_for_order(p_district, p_neighbourhood, p_address_id);

  RETURN QUERY
  SELECT v_branch,
         (SELECT b.name FROM public.branches b WHERE b.id = v_branch),
         COALESCE(
           (SELECT array_agg(s.product_id ORDER BY s.product_id)
              FROM public.branch_product_stock s
             WHERE s.branch_id = v_branch AND s.is_available = false),
           ARRAY[]::bigint[]
         );
END;
$$;

GRANT EXECUTE ON FUNCTION public.fn_branch_availability(text, text, uuid) TO anon, authenticated;

-- Şube panelinin kapatma/açma işlemi (satır yoksa oluşturur, varsa güncellerse)
CREATE OR REPLACE FUNCTION public.fn_set_branch_product_availability(
  p_branch_id    uuid,
  p_product_id   bigint,
  p_is_available boolean
)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  IF NOT (
    EXISTS (SELECT 1 FROM public.branch_users bu
             WHERE bu.user_id = auth.uid() AND bu.branch_id = p_branch_id)
    OR EXISTS (SELECT 1 FROM public.admin_allowlist a WHERE a.user_id = auth.uid())
  ) THEN
    RAISE EXCEPTION 'Bu subenin stogunu degistirme yetkin yok';
  END IF;

  INSERT INTO public.branch_product_stock (branch_id, product_id, is_available, updated_at, updated_by)
  VALUES (p_branch_id, p_product_id, p_is_available, now(), auth.uid())
  ON CONFLICT (branch_id, product_id) DO UPDATE
    SET is_available = EXCLUDED.is_available,
        updated_at   = now(),
        updated_by   = EXCLUDED.updated_by;
END;
$$;

GRANT EXECUTE ON FUNCTION public.fn_set_branch_product_availability(uuid, bigint, boolean) TO authenticated;;
