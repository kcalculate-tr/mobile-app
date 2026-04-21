-- ============================================================================
-- vitrin_v2.sql — banners ve campaigns tablolarını gerçek uygulama schema'sına
-- uygun hale getiren migration.
-- Supabase Dashboard > SQL Editor'da çalıştırın.
-- ============================================================================

-- ─── BANNERS ─────────────────────────────────────────────────────────────────
-- Orijinal vitrin.sql: link_url, order_index — uygulama bunları link, order olarak bekliyor.

ALTER TABLE public.banners
  ADD COLUMN IF NOT EXISTS title        TEXT,
  ADD COLUMN IF NOT EXISTS link         TEXT,
  ADD COLUMN IF NOT EXISTS "order"      INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS image_url    TEXT;

-- Eski kolonları yeni isimlere taşı (veriler varsa)
DO $$
BEGIN
  -- link_url → link
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name='banners' AND column_name='link_url') THEN
    UPDATE public.banners SET link = link_url WHERE link IS NULL;
  END IF;
  -- order_index → order
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name='banners' AND column_name='order_index') THEN
    UPDATE public.banners SET "order" = order_index WHERE "order" = 0;
  END IF;
END $$;

-- ─── CAMPAIGNS ────────────────────────────────────────────────────────────────
-- Orijinal vitrin.sql: name, discount_percent, min_order_amount, starts_at, ends_at
-- Uygulama: title, code, badge, discount_type, discount_value, max_discount,
--           min_cart_total, start_date, end_date, order, image_url, color_from,
--           color_via, color_to

ALTER TABLE public.campaigns
  ADD COLUMN IF NOT EXISTS title           TEXT,
  ADD COLUMN IF NOT EXISTS code            TEXT,
  ADD COLUMN IF NOT EXISTS badge           TEXT,
  ADD COLUMN IF NOT EXISTS description     TEXT,
  ADD COLUMN IF NOT EXISTS discount_type   TEXT    DEFAULT 'percent',
  ADD COLUMN IF NOT EXISTS discount_value  NUMERIC DEFAULT 0   NOT NULL,
  ADD COLUMN IF NOT EXISTS max_discount    NUMERIC DEFAULT 0   NOT NULL,
  ADD COLUMN IF NOT EXISTS min_cart_total  NUMERIC DEFAULT 0   NOT NULL,
  ADD COLUMN IF NOT EXISTS start_date      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS end_date        TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "order"         INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS image_url       TEXT,
  ADD COLUMN IF NOT EXISTS color_from      TEXT,
  ADD COLUMN IF NOT EXISTS color_via       TEXT,
  ADD COLUMN IF NOT EXISTS color_to        TEXT;

-- max_discount: NOT NULL değilse DEFAULT 0 ile zorla
ALTER TABLE public.campaigns
  ALTER COLUMN max_discount SET DEFAULT 0,
  ALTER COLUMN max_discount SET NOT NULL;

ALTER TABLE public.campaigns
  ALTER COLUMN discount_value SET DEFAULT 0,
  ALTER COLUMN discount_value SET NOT NULL;

ALTER TABLE public.campaigns
  ALTER COLUMN min_cart_total SET DEFAULT 0,
  ALTER COLUMN min_cart_total SET NOT NULL;

-- Eski kolonları taşı
DO $$
BEGIN
  -- name → title
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name='campaigns' AND column_name='name') THEN
    UPDATE public.campaigns SET title = name WHERE title IS NULL;
  END IF;
  -- discount_percent → discount_value
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name='campaigns' AND column_name='discount_percent') THEN
    UPDATE public.campaigns
      SET discount_value = discount_percent, discount_type = 'percent'
    WHERE discount_value = 0 AND discount_percent IS NOT NULL;
  END IF;
  -- min_order_amount → min_cart_total
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name='campaigns' AND column_name='min_order_amount') THEN
    UPDATE public.campaigns
      SET min_cart_total = min_order_amount
    WHERE min_cart_total = 0 AND min_order_amount IS NOT NULL;
  END IF;
  -- starts_at → start_date
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name='campaigns' AND column_name='starts_at') THEN
    UPDATE public.campaigns SET start_date = starts_at WHERE start_date IS NULL;
  END IF;
  -- ends_at → end_date
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name='campaigns' AND column_name='ends_at') THEN
    UPDATE public.campaigns SET end_date = ends_at WHERE end_date IS NULL;
  END IF;
END $$;

-- İndeksler
CREATE INDEX IF NOT EXISTS banners_order_idx   ON public.banners ("order");
CREATE INDEX IF NOT EXISTS campaigns_order_idx  ON public.campaigns ("order");
CREATE INDEX IF NOT EXISTS campaigns_code_idx   ON public.campaigns (code);
CREATE INDEX IF NOT EXISTS campaigns_active_idx ON public.campaigns (is_active);
