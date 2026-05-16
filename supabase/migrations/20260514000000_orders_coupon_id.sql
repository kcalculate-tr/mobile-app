-- orders.coupon_id: campaigns(id) FK ile order'a uygulanan kampanya
-- referansını sayısal/uuid olarak tutar. coupon_code (string) zaten var,
-- ama campaign_uses tracking için id-based bağ gerekiyor.

alter table orders
  add column if not exists coupon_id uuid references campaigns(id) on delete set null;

create index if not exists orders_coupon_id_idx on orders (coupon_id);

-- campaign_uses unique constraint (yoksa) — trigger'ın ON CONFLICT için lazım.
create unique index if not exists campaign_uses_campaign_id_order_id_uniq
  on campaign_uses (campaign_id, order_id);
