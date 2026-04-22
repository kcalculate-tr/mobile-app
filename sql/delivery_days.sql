-- delivery_zones: per-district delivery days
-- integer[] where 0=Sunday .. 6=Saturday (JS Date.getDay() convention)
ALTER TABLE public.delivery_zones
  ADD COLUMN IF NOT EXISTS delivery_days integer[] DEFAULT '{1,2,3,4,5}';

COMMENT ON COLUMN public.delivery_zones.delivery_days IS
  'Teslimat yapılan günler. 0=Pazar, 1=Pazartesi, 2=Salı, 3=Çarşamba, 4=Perşembe, 5=Cuma, 6=Cumartesi. Varsayılan hafta içi.';
