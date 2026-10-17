-- DÜZELTME (13.10.2026): uq_orders_external KISMİ indeksti
--   (... WHERE external_order_id IS NOT NULL)
-- Postgres kısmi bir tekil indeksi ON CONFLICT çıkarımında ancak sorgu aynı
-- WHERE koşulunu da içerirse kullanır; supabase-js upsert'ü bunu yazamıyor,
-- dolayısıyla her Trendyol siparişi "no unique or exclusion constraint
-- matching the ON CONFLICT specification" ile düşüyordu.
--
-- Koşulsuz tekil indeks aynı korumayı veriyor: NULL'lar birbirinden farklı
-- sayıldığı için external_order_id'si boş olan (source='app') satırlar
-- sınırsızca var olabilir.
CREATE UNIQUE INDEX IF NOT EXISTS uq_orders_external_full
  ON public.orders (source, external_order_id);;
