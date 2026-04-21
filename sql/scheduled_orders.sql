-- Scheduled orders migration
-- Adds scheduled_date, scheduled_time, delivery_type columns to orders
-- Safe: uses ADD COLUMN IF NOT EXISTS

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS scheduled_date DATE,
  ADD COLUMN IF NOT EXISTS scheduled_time TIME,
  ADD COLUMN IF NOT EXISTS delivery_type TEXT DEFAULT 'immediate';

CREATE INDEX IF NOT EXISTS orders_scheduled_date_idx
  ON public.orders (scheduled_date);

CREATE INDEX IF NOT EXISTS orders_delivery_type_idx
  ON public.orders (delivery_type);
