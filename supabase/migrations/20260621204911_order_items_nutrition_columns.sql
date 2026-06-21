-- order_items besin değeri SNAPSHOT kolonları (calories/protein/carbs/fat).
--
-- SORUN: src/lib/orders.ts order_items insert payload'una calories/protein/carbs/
-- fat yazıyordu ama bu kolonlar order_items tablosunda YOKTU -> PostgREST "column
-- does not exist" hatası -> isOrderItemsRelationIssue=true -> sessiz JSONB fallback
-- -> order_items satırı hiç oluşmuyordu -> TrackerScreen pantry ("Dolabındakiler")
-- order_items'tan beslendiği için boş kalıyordu. id 42→132 arası TÜM siparişler
-- (paytr/tosla/paynkolay) etkilendi (~21 Mayıs'tan beri). Son order_items alan #41.
--
-- TASARIM: Bu kolonlar sipariş anındaki besin değerini SABİTLER (snapshot). Ürün
-- sonradan güncellense bile o siparişin değeri korunur. Kod zaten yazmaya hazır;
-- tek eksik kolonların kendisiydi.
--
-- TİPLER: products tablosundaki karşılıklarıyla hizalı (products.calories=integer,
-- protein/carbs/fats=numeric). order_items kolonu 'fat' (tekil) — kod payload key'i
-- 'fat' olduğu için (products'taki 'fats' değil). Hepsi nullable (kod null geçebilir:
-- item.calories ?? null).

ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS calories integer,
  ADD COLUMN IF NOT EXISTS protein  numeric,
  ADD COLUMN IF NOT EXISTS carbs    numeric,
  ADD COLUMN IF NOT EXISTS fat      numeric;
