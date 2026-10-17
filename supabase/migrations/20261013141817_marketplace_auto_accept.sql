-- Otomatik kabul (13.10.2026)
-- Trendyol siparişi geldiği anda poller 'picked' çağrısını yapar; mutfak
-- "Kabul Et"e basmak zorunda kalmaz. preparation_time_min, Trendyol'a
-- bildirilen hazırlık süresidir (müşteriye gösterilen ETA'yı etkiler).
ALTER TABLE public.marketplace_stores
  ADD COLUMN IF NOT EXISTS auto_accept          boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS preparation_time_min integer NOT NULL DEFAULT 25;

COMMENT ON COLUMN public.marketplace_stores.auto_accept IS
  'true: sipariş gelir gelmez Trendyol''a picked gönderilir';
COMMENT ON COLUMN public.marketplace_stores.preparation_time_min IS
  'picked çağrısında bildirilen hazırlık süresi (dakika)';;
