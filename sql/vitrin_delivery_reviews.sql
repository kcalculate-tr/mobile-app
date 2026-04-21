-- ============================================================================
-- Vitrin, Teslimat Bölgeleri ve Yorumlar — Migration
-- Supabase Dashboard > SQL Editor'da çalıştırın
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1) banners
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.banners (
  id          BIGSERIAL PRIMARY KEY,
  title       TEXT,
  image_url   TEXT NOT NULL,
  link_url    TEXT,
  order_index INTEGER NOT NULL DEFAULT 0,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.banners
  ADD COLUMN IF NOT EXISTS title       TEXT,
  ADD COLUMN IF NOT EXISTS image_url   TEXT,
  ADD COLUMN IF NOT EXISTS link_url    TEXT,
  ADD COLUMN IF NOT EXISTS order_index INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS created_at  TIMESTAMPTZ NOT NULL DEFAULT now();

ALTER TABLE public.banners ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'banners' AND policyname = 'banners_select_public') THEN
    CREATE POLICY banners_select_public ON public.banners FOR SELECT USING (true);
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 2) campaigns
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.campaigns (
  id                 BIGSERIAL PRIMARY KEY,
  name               TEXT NOT NULL,
  description        TEXT,
  discount_percent   NUMERIC(5,2) NOT NULL DEFAULT 0,
  min_order_amount   NUMERIC(10,2) NOT NULL DEFAULT 0,
  starts_at          TIMESTAMPTZ,
  ends_at            TIMESTAMPTZ,
  is_active          BOOLEAN NOT NULL DEFAULT TRUE,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.campaigns
  ADD COLUMN IF NOT EXISTS name             TEXT,
  ADD COLUMN IF NOT EXISTS description      TEXT,
  ADD COLUMN IF NOT EXISTS discount_percent NUMERIC(5,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS min_order_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS starts_at        TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS ends_at          TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS is_active        BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS created_at       TIMESTAMPTZ NOT NULL DEFAULT now();

ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'campaigns' AND policyname = 'campaigns_select_public') THEN
    CREATE POLICY campaigns_select_public ON public.campaigns FOR SELECT USING (true);
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 3) popups
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.popups (
  id             BIGSERIAL PRIMARY KEY,
  title          TEXT NOT NULL,
  content        TEXT,
  image_url      TEXT,
  button_text    TEXT,
  button_url     TEXT,
  show_frequency TEXT NOT NULL DEFAULT 'every_visit',
  is_active      BOOLEAN NOT NULL DEFAULT FALSE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.popups
  ADD COLUMN IF NOT EXISTS title          TEXT,
  ADD COLUMN IF NOT EXISTS content        TEXT,
  ADD COLUMN IF NOT EXISTS image_url      TEXT,
  ADD COLUMN IF NOT EXISTS button_text    TEXT,
  ADD COLUMN IF NOT EXISTS button_url     TEXT,
  ADD COLUMN IF NOT EXISTS show_frequency TEXT NOT NULL DEFAULT 'every_visit',
  ADD COLUMN IF NOT EXISTS is_active      BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS created_at     TIMESTAMPTZ NOT NULL DEFAULT now();

-- show_frequency CHECK
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'popups_show_frequency_check' AND conrelid = 'public.popups'::regclass
  ) THEN
    ALTER TABLE public.popups
      ADD CONSTRAINT popups_show_frequency_check
      CHECK (show_frequency IN ('every_visit', 'once', 'once_per_day'));
  END IF;
END $$;

ALTER TABLE public.popups ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'popups' AND policyname = 'popups_select_public') THEN
    CREATE POLICY popups_select_public ON public.popups FOR SELECT USING (true);
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 4) delivery_zones
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.delivery_zones (
  id                 BIGSERIAL PRIMARY KEY,
  name               TEXT NOT NULL,
  postal_codes       TEXT[] NOT NULL DEFAULT '{}',
  min_order_amount   NUMERIC(10,2) NOT NULL DEFAULT 0,
  delivery_fee       NUMERIC(10,2) NOT NULL DEFAULT 0,
  estimated_minutes  INTEGER NOT NULL DEFAULT 0,
  is_active          BOOLEAN NOT NULL DEFAULT TRUE,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.delivery_zones
  ADD COLUMN IF NOT EXISTS name              TEXT,
  ADD COLUMN IF NOT EXISTS postal_codes      TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS min_order_amount  NUMERIC(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS delivery_fee      NUMERIC(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS estimated_minutes INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_active         BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS created_at        TIMESTAMPTZ NOT NULL DEFAULT now();

ALTER TABLE public.delivery_zones ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'delivery_zones' AND policyname = 'delivery_zones_select_public') THEN
    CREATE POLICY delivery_zones_select_public ON public.delivery_zones FOR SELECT USING (true);
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 5) reviews
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.reviews (
  id          BIGSERIAL PRIMARY KEY,
  user_id     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  order_id    BIGINT,
  rating      SMALLINT NOT NULL DEFAULT 5,
  comment     TEXT,
  status      TEXT NOT NULL DEFAULT 'pending',
  admin_reply TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.reviews
  ADD COLUMN IF NOT EXISTS user_id     UUID,
  ADD COLUMN IF NOT EXISTS order_id    BIGINT,
  ADD COLUMN IF NOT EXISTS rating      SMALLINT NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS comment     TEXT,
  ADD COLUMN IF NOT EXISTS status      TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS admin_reply TEXT,
  ADD COLUMN IF NOT EXISTS created_at  TIMESTAMPTZ NOT NULL DEFAULT now();

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'reviews_rating_range' AND conrelid = 'public.reviews'::regclass
  ) THEN
    ALTER TABLE public.reviews ADD CONSTRAINT reviews_rating_range CHECK (rating BETWEEN 1 AND 5);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'reviews_status_check' AND conrelid = 'public.reviews'::regclass
  ) THEN
    ALTER TABLE public.reviews ADD CONSTRAINT reviews_status_check
      CHECK (status IN ('pending', 'approved', 'rejected'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_reviews_status ON public.reviews (status, created_at DESC);

ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'reviews' AND policyname = 'reviews_select_approved') THEN
    CREATE POLICY reviews_select_approved ON public.reviews FOR SELECT USING (status = 'approved');
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 6) Admin write policies (banners, campaigns, popups, delivery_zones, reviews)
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  has_user_id boolean;
  check_expr  text;
BEGIN
  SELECT EXISTS(
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'admin_allowlist' AND column_name = 'user_id'
  ) INTO has_user_id;

  IF has_user_id THEN
    check_expr := 'EXISTS (SELECT 1 FROM public.admin_allowlist a WHERE a.user_id = auth.uid())';
  ELSE
    check_expr := 'EXISTS (SELECT 1 FROM public.admin_allowlist a WHERE lower(a.email) = lower(coalesce(auth.jwt() ->> ''email'', '''')))';
  END IF;

  -- Helper: create write policies for a table
  -- banners
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'banners' AND policyname = 'banners_write_admin') THEN
    EXECUTE format('CREATE POLICY banners_write_admin ON public.banners FOR ALL USING (%1$s) WITH CHECK (%1$s)', check_expr);
  END IF;
  -- campaigns
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'campaigns' AND policyname = 'campaigns_write_admin') THEN
    EXECUTE format('CREATE POLICY campaigns_write_admin ON public.campaigns FOR ALL USING (%1$s) WITH CHECK (%1$s)', check_expr);
  END IF;
  -- popups
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'popups' AND policyname = 'popups_write_admin') THEN
    EXECUTE format('CREATE POLICY popups_write_admin ON public.popups FOR ALL USING (%1$s) WITH CHECK (%1$s)', check_expr);
  END IF;
  -- delivery_zones
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'delivery_zones' AND policyname = 'delivery_zones_write_admin') THEN
    EXECUTE format('CREATE POLICY delivery_zones_write_admin ON public.delivery_zones FOR ALL USING (%1$s) WITH CHECK (%1$s)', check_expr);
  END IF;
  -- reviews (admin full access, kullanıcı kendi yorumunu ekleyebilir)
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'reviews' AND policyname = 'reviews_admin_all') THEN
    EXECUTE format('CREATE POLICY reviews_admin_all ON public.reviews FOR ALL USING (%1$s) WITH CHECK (%1$s)', check_expr);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'reviews' AND policyname = 'reviews_user_insert') THEN
    CREATE POLICY reviews_user_insert ON public.reviews FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

COMMIT;
