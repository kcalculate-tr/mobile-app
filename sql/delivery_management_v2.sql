-- ============================================================================
-- Delivery management v2 — per-district overrides
-- Supabase Dashboard > SQL Editor'da çalıştırın.
-- ============================================================================
-- Per-district override columns. NULL means "use global default from delivery_settings".
ALTER TABLE public.delivery_zones ADD COLUMN IF NOT EXISTS delivery_fee_immediate         numeric;
ALTER TABLE public.delivery_zones ADD COLUMN IF NOT EXISTS delivery_fee_scheduled         numeric;
ALTER TABLE public.delivery_zones ADD COLUMN IF NOT EXISTS free_shipping_above_immediate  numeric;
ALTER TABLE public.delivery_zones ADD COLUMN IF NOT EXISTS free_shipping_above_scheduled  numeric;
ALTER TABLE public.delivery_zones ADD COLUMN IF NOT EXISTS min_order_immediate            numeric;
ALTER TABLE public.delivery_zones ADD COLUMN IF NOT EXISTS min_order_scheduled            numeric;
ALTER TABLE public.delivery_zones ADD COLUMN IF NOT EXISTS estimated_delivery_minutes     integer;

COMMENT ON COLUMN public.delivery_zones.delivery_fee_immediate        IS 'NULL = global default (delivery_settings ''__GLOBAL__'' row)';
COMMENT ON COLUMN public.delivery_zones.delivery_fee_scheduled        IS 'NULL = global default (delivery_settings ''__GLOBAL__'' row)';
COMMENT ON COLUMN public.delivery_zones.free_shipping_above_immediate IS 'NULL = global default (delivery_settings ''__GLOBAL__'' row)';
COMMENT ON COLUMN public.delivery_zones.free_shipping_above_scheduled IS 'NULL = global default (delivery_settings ''__GLOBAL__'' row)';
COMMENT ON COLUMN public.delivery_zones.min_order_immediate           IS 'NULL = global default (delivery_settings ''__GLOBAL__'' row)';
COMMENT ON COLUMN public.delivery_zones.min_order_scheduled           IS 'NULL = global default (delivery_settings ''__GLOBAL__'' row)';
COMMENT ON COLUMN public.delivery_zones.estimated_delivery_minutes    IS 'Tahmini teslimat süresi (dakika). NULL = belirtilmedi.';

-- Not: delivery_settings tablosunda district = '__GLOBAL__' satırı,
-- BossDeliveryManagement sayfası tarafından genel (varsayılan) kargo kuralları
-- için kullanılır. Mevcut BossDelivery.jsx arayüzü ilçe-bazlı cargo_rules
-- satırlarını yazmaya devam eder; iki kullanım birbirine dokunmaz.
