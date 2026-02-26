-- ============================================================================
-- Ürün Seçenekleri / Varyasyon Sistemi (Idempotent Migration)
-- Hedef: public.option_groups, public.option_items, public.product_option_groups
-- Not: products.id için BIGINT varsayımıyla hazırlanmıştır (INT/BIGINT uyumlu).
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1) option_groups
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.option_groups (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  min_selection INTEGER NOT NULL DEFAULT 0,
  max_selection INTEGER NOT NULL DEFAULT 1,
  is_required BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.option_groups
  ADD COLUMN IF NOT EXISTS name TEXT,
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS min_selection INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS max_selection INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS is_required BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'option_groups_min_nonnegative'
      AND conrelid = 'public.option_groups'::regclass
  ) THEN
    ALTER TABLE public.option_groups
      ADD CONSTRAINT option_groups_min_nonnegative CHECK (min_selection >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'option_groups_max_gte_min'
      AND conrelid = 'public.option_groups'::regclass
  ) THEN
    ALTER TABLE public.option_groups
      ADD CONSTRAINT option_groups_max_gte_min CHECK (max_selection >= min_selection);
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 2) option_items
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.option_items (
  id BIGSERIAL PRIMARY KEY,
  group_id BIGINT NOT NULL,
  name TEXT NOT NULL,
  price_adjustment NUMERIC(10,2) NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_available BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.option_items
  ADD COLUMN IF NOT EXISTS group_id BIGINT,
  ADD COLUMN IF NOT EXISTS name TEXT,
  ADD COLUMN IF NOT EXISTS price_adjustment NUMERIC(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_available BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'option_items_price_nonnegative'
      AND conrelid = 'public.option_items'::regclass
  ) THEN
    ALTER TABLE public.option_items
      ADD CONSTRAINT option_items_price_nonnegative CHECK (price_adjustment >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'option_items_sort_nonnegative'
      AND conrelid = 'public.option_items'::regclass
  ) THEN
    ALTER TABLE public.option_items
      ADD CONSTRAINT option_items_sort_nonnegative CHECK (sort_order >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'option_items_group_id_fk'
      AND conrelid = 'public.option_items'::regclass
  ) THEN
    ALTER TABLE public.option_items
      ADD CONSTRAINT option_items_group_id_fk
      FOREIGN KEY (group_id)
      REFERENCES public.option_groups(id)
      ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_option_items_group_sort
  ON public.option_items (group_id, sort_order, id);

-- ---------------------------------------------------------------------------
-- 3) product_option_groups
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.product_option_groups (
  id BIGSERIAL PRIMARY KEY,
  product_id BIGINT NOT NULL,
  group_id BIGINT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.product_option_groups
  ADD COLUMN IF NOT EXISTS product_id BIGINT,
  ADD COLUMN IF NOT EXISTS group_id BIGINT,
  ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'product_option_groups_sort_nonnegative'
      AND conrelid = 'public.product_option_groups'::regclass
  ) THEN
    ALTER TABLE public.product_option_groups
      ADD CONSTRAINT product_option_groups_sort_nonnegative CHECK (sort_order >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'product_option_groups_product_fk'
      AND conrelid = 'public.product_option_groups'::regclass
  ) THEN
    ALTER TABLE public.product_option_groups
      ADD CONSTRAINT product_option_groups_product_fk
      FOREIGN KEY (product_id)
      REFERENCES public.products(id)
      ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'product_option_groups_group_fk'
      AND conrelid = 'public.product_option_groups'::regclass
  ) THEN
    ALTER TABLE public.product_option_groups
      ADD CONSTRAINT product_option_groups_group_fk
      FOREIGN KEY (group_id)
      REFERENCES public.option_groups(id)
      ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'product_option_groups_unique_product_group'
      AND conrelid = 'public.product_option_groups'::regclass
  ) THEN
    ALTER TABLE public.product_option_groups
      ADD CONSTRAINT product_option_groups_unique_product_group
      UNIQUE (product_id, group_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_product_option_groups_product_sort
  ON public.product_option_groups (product_id, sort_order, id);

-- ---------------------------------------------------------------------------
-- 4) RLS / Policies
--  - SELECT: herkese açık (müşteri ProductDetail okuyabilsin)
--  - Yazma: admin_allowlist.user_id ile sınırlı
-- ---------------------------------------------------------------------------
ALTER TABLE public.option_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.option_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_option_groups ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  -- SELECT policies
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'option_groups' AND policyname = 'option_groups_select_public'
  ) THEN
    CREATE POLICY option_groups_select_public
      ON public.option_groups
      FOR SELECT
      USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'option_items' AND policyname = 'option_items_select_public'
  ) THEN
    CREATE POLICY option_items_select_public
      ON public.option_items
      FOR SELECT
      USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'product_option_groups' AND policyname = 'product_option_groups_select_public'
  ) THEN
    CREATE POLICY product_option_groups_select_public
      ON public.product_option_groups
      FOR SELECT
      USING (true);
  END IF;
END $$;

DO $$
DECLARE
  has_allowlist boolean;
  has_user_id boolean;
  has_email boolean;
  write_check_expression text;
BEGIN
  SELECT EXISTS(
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'admin_allowlist'
  ) INTO has_allowlist;

  SELECT EXISTS(
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'admin_allowlist' AND column_name = 'user_id'
  ) INTO has_user_id;

  SELECT EXISTS(
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'admin_allowlist' AND column_name = 'email'
  ) INTO has_email;

  IF has_allowlist AND has_user_id THEN
    write_check_expression := 'EXISTS (SELECT 1 FROM public.admin_allowlist a WHERE a.user_id = auth.uid())';
  ELSIF has_allowlist AND has_email THEN
    write_check_expression := 'EXISTS (SELECT 1 FROM public.admin_allowlist a WHERE lower(a.email) = lower(coalesce(auth.jwt() ->> ''email'', '''')))';
  END IF;

  IF write_check_expression IS NOT NULL THEN
    -- option_groups write policies
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public' AND tablename = 'option_groups' AND policyname = 'option_groups_insert_admin'
    ) THEN
      EXECUTE format(
        'CREATE POLICY option_groups_insert_admin ON public.option_groups FOR INSERT WITH CHECK (%s)',
        write_check_expression
      );
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public' AND tablename = 'option_groups' AND policyname = 'option_groups_update_admin'
    ) THEN
      EXECUTE format(
        'CREATE POLICY option_groups_update_admin ON public.option_groups FOR UPDATE USING (%1$s) WITH CHECK (%1$s)',
        write_check_expression
      );
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public' AND tablename = 'option_groups' AND policyname = 'option_groups_delete_admin'
    ) THEN
      EXECUTE format(
        'CREATE POLICY option_groups_delete_admin ON public.option_groups FOR DELETE USING (%s)',
        write_check_expression
      );
    END IF;

    -- option_items write policies
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public' AND tablename = 'option_items' AND policyname = 'option_items_insert_admin'
    ) THEN
      EXECUTE format(
        'CREATE POLICY option_items_insert_admin ON public.option_items FOR INSERT WITH CHECK (%s)',
        write_check_expression
      );
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public' AND tablename = 'option_items' AND policyname = 'option_items_update_admin'
    ) THEN
      EXECUTE format(
        'CREATE POLICY option_items_update_admin ON public.option_items FOR UPDATE USING (%1$s) WITH CHECK (%1$s)',
        write_check_expression
      );
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public' AND tablename = 'option_items' AND policyname = 'option_items_delete_admin'
    ) THEN
      EXECUTE format(
        'CREATE POLICY option_items_delete_admin ON public.option_items FOR DELETE USING (%s)',
        write_check_expression
      );
    END IF;

    -- product_option_groups write policies
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public' AND tablename = 'product_option_groups' AND policyname = 'product_option_groups_insert_admin'
    ) THEN
      EXECUTE format(
        'CREATE POLICY product_option_groups_insert_admin ON public.product_option_groups FOR INSERT WITH CHECK (%s)',
        write_check_expression
      );
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public' AND tablename = 'product_option_groups' AND policyname = 'product_option_groups_update_admin'
    ) THEN
      EXECUTE format(
        'CREATE POLICY product_option_groups_update_admin ON public.product_option_groups FOR UPDATE USING (%1$s) WITH CHECK (%1$s)',
        write_check_expression
      );
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public' AND tablename = 'product_option_groups' AND policyname = 'product_option_groups_delete_admin'
    ) THEN
      EXECUTE format(
        'CREATE POLICY product_option_groups_delete_admin ON public.product_option_groups FOR DELETE USING (%s)',
        write_check_expression
      );
    END IF;
  ELSE
    RAISE NOTICE 'admin_allowlist.user_id veya admin_allowlist.email bulunamadı. Write policy oluşturulmadı.';
  END IF;
END $$;

COMMIT;
