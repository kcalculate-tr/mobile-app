-- orders.coupon_id: campaigns(id) FK ile order'a uygulanan kampanya
-- referansını sayısal/uuid olarak tutar. coupon_code (string) zaten var,
-- ama campaign_uses tracking için id-based bağ gerekiyor.

alter table orders
  add column if not exists coupon_id uuid references campaigns(id) on delete set null;

-- NOT (2026-09-16 db push repair): canlıda bu isimle değil, aşağıdaki isim/
-- tanımla mevcut — muhtemelen elle uygulanmıştı. Dosya canlı gerçeğe göre
-- güncellendi (drift kapatıldı), efekt aynı (coupon_id dolu satırlarda hızlı arama).
create index if not exists idx_orders_coupon_id
  on orders (coupon_id) where coupon_id is not null;

-- campaign_uses unique constraint (yoksa) — trigger'ın ON CONFLICT için lazım.
-- NOT: canlıda "unique_campaign_order" adıyla mevcut (aynı kolonlar) — ON
-- CONFLICT (campaign_id, order_id) isme değil kolonlara bakar, sorun yok.
create unique index if not exists unique_campaign_order
  on campaign_uses (campaign_id, order_id);
