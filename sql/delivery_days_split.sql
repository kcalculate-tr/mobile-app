ALTER TABLE public.delivery_zones ADD COLUMN IF NOT EXISTS delivery_days_immediate integer[] DEFAULT '{1,2,3,4,5}';
ALTER TABLE public.delivery_zones ADD COLUMN IF NOT EXISTS delivery_days_scheduled integer[] DEFAULT '{1,2,3,4,5}';

-- Copy existing delivery_days values into both new columns (one-time migration)
UPDATE public.delivery_zones SET
  delivery_days_immediate = COALESCE(delivery_days, '{1,2,3,4,5}'),
  delivery_days_scheduled = COALESCE(delivery_days, '{1,2,3,4,5}')
WHERE delivery_days_immediate IS NULL OR delivery_days_scheduled IS NULL;

COMMENT ON COLUMN public.delivery_zones.delivery_days_immediate IS 'Hemen teslimat günleri. 0=Paz..6=Cmt';
COMMENT ON COLUMN public.delivery_zones.delivery_days_scheduled IS 'Randevulu teslimat günleri. 0=Paz..6=Cmt';
