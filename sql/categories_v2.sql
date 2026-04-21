-- Categories v2 migration
-- Adds discount_type, discount_value, parent_id columns to categories
-- Safe: uses ADD COLUMN IF NOT EXISTS

ALTER TABLE public.categories
  ADD COLUMN IF NOT EXISTS discount_type  TEXT CHECK (discount_type IN ('percent', 'fixed')),
  ADD COLUMN IF NOT EXISTS discount_value NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS parent_id      UUID REFERENCES public.categories(id) ON DELETE SET NULL;

-- Index for filtering by parent
CREATE INDEX IF NOT EXISTS categories_parent_id_idx ON public.categories (parent_id);
