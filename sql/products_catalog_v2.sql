-- Products catalog v2 migration
-- Adds allow_immediate, allow_scheduled, discount_type, discount_value columns to products
-- Safe: uses ADD COLUMN IF NOT EXISTS

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS allow_immediate  BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS allow_scheduled  BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS discount_type    TEXT CHECK (discount_type IN ('percent', 'fixed')),
  ADD COLUMN IF NOT EXISTS discount_value   NUMERIC(10,2);

-- Index for filtering by delivery type
CREATE INDEX IF NOT EXISTS products_allow_immediate_idx ON public.products (allow_immediate);
CREATE INDEX IF NOT EXISTS products_allow_scheduled_idx ON public.products (allow_scheduled);

-- Branches: add slug column if not exists
ALTER TABLE public.branches
  ADD COLUMN IF NOT EXISTS slug TEXT UNIQUE;

CREATE UNIQUE INDEX IF NOT EXISTS branches_slug_key ON public.branches (slug);

-- Settings table for key-value store (store_name, store_phone, etc.)
CREATE TABLE IF NOT EXISTS public.settings (
  key   TEXT PRIMARY KEY,
  value TEXT,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS for settings: admin read/write
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "settings_public_read"
  ON public.settings FOR SELECT
  USING (true);

CREATE POLICY IF NOT EXISTS "settings_admin_write"
  ON public.settings FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.admin_allowlist
      WHERE email = auth.email()
    )
  );
