-- ============================================================================
-- banner_grid_system.sql
-- Yeni "banner grid" sistemi — hero (carousel) + promo (grid) için tek kaynak.
-- Mevcut banners + campaigns tabloları dokunulmuyor, arşivde kalır.
--
-- Link modeli: mevcut `banners` tablosunun gerçek kolonları `link` (serbest
-- URL/path) + `navigate_to` (mobil screen adı veya `CategoryProducts:<name>`
-- deep-link). Aynı isimler tekrarlandı — mobile tarafında yeni tabloyu
-- mevcut banners'la birebir aynı mantıkla tüketebilirsin.
--
-- Admin yetkisi: diğer kullanıcı-uygulama tablolarında (option_groups,
-- order_modifications, delivery_zones vb.) olduğu gibi `admin_allowlist`
-- defensive pattern ile. service_role policy EKLENMEDİ çünkü admin paneli
-- authenticated user session kullanıyor (publishable key + Supabase auth).
--
-- Supabase Dashboard > SQL Editor'da çalıştırın. İdempotent, tekrar
-- koşulabilir.
-- ============================================================================

BEGIN;

-- ─── 1) SATIRLAR (banner_rows) ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.banner_rows (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type       text NOT NULL CHECK (type IN ('hero', 'promo')),
  grid_size  integer NOT NULL DEFAULT 1 CHECK (grid_size BETWEEN 1 AND 6),
  "order"    integer NOT NULL DEFAULT 0,
  is_active  boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_banner_rows_type_active_order
  ON public.banner_rows (type, is_active, "order");

-- Hero satırlarında grid_size her zaman 1 (carousel pozisyonu 0 tek hücre)
CREATE OR REPLACE FUNCTION public.enforce_hero_grid_size()
RETURNS trigger AS $$
BEGIN
  IF NEW.type = 'hero' AND NEW.grid_size <> 1 THEN
    NEW.grid_size := 1;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS banner_rows_enforce_hero_grid ON public.banner_rows;
CREATE TRIGGER banner_rows_enforce_hero_grid
  BEFORE INSERT OR UPDATE ON public.banner_rows
  FOR EACH ROW EXECUTE FUNCTION public.enforce_hero_grid_size();


-- ─── 2) HÜCRELER (banner_cells) ─────────────────────────────────────────────
-- Link kolonları MEVCUT banners ile birebir aynı:
--   link         TEXT — serbest URL/path (opsiyonel, ör. "/teklifler")
--   navigate_to  TEXT — mobil screen adı, ör. "Home", "Categories",
--                       "Offers", "ProfileOrders", "Subscriptions",
--                       "NutritionProfile", "ProfileSupport", veya
--                       dinamik "CategoryProducts:<category_name>"
CREATE TABLE IF NOT EXISTS public.banner_cells (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  row_id      uuid NOT NULL REFERENCES public.banner_rows(id) ON DELETE CASCADE,
  position    integer NOT NULL CHECK (position BETWEEN 0 AND 5),
  image_url   text,
  title       text,
  link        text,
  navigate_to text DEFAULT 'Home',
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE(row_id, position)
);

CREATE INDEX IF NOT EXISTS idx_banner_cells_row
  ON public.banner_cells (row_id);
CREATE INDEX IF NOT EXISTS idx_banner_cells_active
  ON public.banner_cells (is_active);


-- ─── 3) updated_at auto-update ──────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS banner_rows_touch_updated ON public.banner_rows;
CREATE TRIGGER banner_rows_touch_updated
  BEFORE UPDATE ON public.banner_rows
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS banner_cells_touch_updated ON public.banner_cells;
CREATE TRIGGER banner_cells_touch_updated
  BEFORE UPDATE ON public.banner_cells
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();


-- ─── 4) RLS ─────────────────────────────────────────────────────────────────
ALTER TABLE public.banner_rows  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.banner_cells ENABLE ROW LEVEL SECURITY;

-- Public SELECT: tüm satırlar (mevcut `banners` policy'si ile aynı).
-- Admin UI inactive satırları görüp tekrar aktif edebilmeli — USING(true).
-- Mobile tarafı sorgularında `.eq('is_active', true)` filtresini uygulasın.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='banner_rows' AND policyname='banner_rows_select_public'
  ) THEN
    CREATE POLICY banner_rows_select_public
      ON public.banner_rows
      FOR SELECT
      USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='banner_cells' AND policyname='banner_cells_select_public'
  ) THEN
    CREATE POLICY banner_cells_select_public
      ON public.banner_cells
      FOR SELECT
      USING (true);
  END IF;
END $$;

-- Admin write — admin_allowlist defensive pattern (user_id öncelikli, email fallback)
-- Codebase'te option_system.sql, delivery_zones.sql vb. aynı kalıbı kullanıyor.
DO $$
DECLARE
  has_allowlist boolean;
  has_user_id   boolean;
  has_email     boolean;
  write_expr    text;
BEGIN
  SELECT EXISTS(
    SELECT 1 FROM information_schema.tables
    WHERE table_schema='public' AND table_name='admin_allowlist'
  ) INTO has_allowlist;

  SELECT EXISTS(
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='admin_allowlist' AND column_name='user_id'
  ) INTO has_user_id;

  SELECT EXISTS(
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='admin_allowlist' AND column_name='email'
  ) INTO has_email;

  IF has_allowlist AND has_user_id THEN
    write_expr := 'EXISTS (SELECT 1 FROM public.admin_allowlist a WHERE a.user_id = auth.uid())';
  ELSIF has_allowlist AND has_email THEN
    write_expr := 'EXISTS (SELECT 1 FROM public.admin_allowlist a WHERE lower(a.email) = lower(coalesce(auth.jwt() ->> ''email'', '''')))';
  END IF;

  IF write_expr IS NOT NULL THEN
    -- banner_rows
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='banner_rows' AND policyname='banner_rows_insert_admin') THEN
      EXECUTE format('CREATE POLICY banner_rows_insert_admin ON public.banner_rows FOR INSERT WITH CHECK (%s)', write_expr);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='banner_rows' AND policyname='banner_rows_update_admin') THEN
      EXECUTE format('CREATE POLICY banner_rows_update_admin ON public.banner_rows FOR UPDATE USING (%1$s) WITH CHECK (%1$s)', write_expr);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='banner_rows' AND policyname='banner_rows_delete_admin') THEN
      EXECUTE format('CREATE POLICY banner_rows_delete_admin ON public.banner_rows FOR DELETE USING (%s)', write_expr);
    END IF;

    -- banner_cells
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='banner_cells' AND policyname='banner_cells_insert_admin') THEN
      EXECUTE format('CREATE POLICY banner_cells_insert_admin ON public.banner_cells FOR INSERT WITH CHECK (%s)', write_expr);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='banner_cells' AND policyname='banner_cells_update_admin') THEN
      EXECUTE format('CREATE POLICY banner_cells_update_admin ON public.banner_cells FOR UPDATE USING (%1$s) WITH CHECK (%1$s)', write_expr);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='banner_cells' AND policyname='banner_cells_delete_admin') THEN
      EXECUTE format('CREATE POLICY banner_cells_delete_admin ON public.banner_cells FOR DELETE USING (%s)', write_expr);
    END IF;
  ELSE
    RAISE NOTICE 'admin_allowlist bulunamadı — banner_rows/banner_cells write policy oluşturulmadı. admin_allowlist tablosunu ekledikten sonra bu dosyayı tekrar çalıştırın.';
  END IF;
END $$;

COMMIT;


-- ============================================================================
-- SEED (OPSİYONEL) — İlter test etmek isterse aşağıyı uncomment edip çalıştırır
-- ============================================================================
--
-- WITH rows AS (
--   INSERT INTO public.banner_rows (type, grid_size, "order") VALUES
--     ('hero',  1, 0),
--     ('hero',  1, 1),
--     ('promo', 2, 0),   -- 2 hücre yan yana
--     ('promo', 1, 1),   -- 1 hücre tam genişlik
--     ('promo', 3, 2)    -- 3 hücre
--   RETURNING id, type, grid_size, "order"
-- )
-- INSERT INTO public.banner_cells (row_id, position, image_url, title, navigate_to)
-- SELECT r.id, 0,
--        'https://placehold.co/1600x800/png',
--        CASE r.type WHEN 'hero' THEN 'Hero ' ELSE 'Promo ' END || r."order",
--        'Home'
-- FROM rows r
-- WHERE r."order" = 0 AND r.type = 'hero'
-- UNION ALL
-- SELECT r.id, gs.position,
--        'https://placehold.co/800x500/png',
--        'Promo cell ' || gs.position,
--        'Offers'
-- FROM rows r
-- CROSS JOIN LATERAL generate_series(0, r.grid_size - 1) AS gs(position)
-- WHERE r.type = 'promo';
