-- Fix: orders.coupon_id was bigint in production despite earlier
-- migration (20260514000000) declaring it as uuid with FK to campaigns.id.
-- The "add column if not exists" guard silently skipped because an
-- older schema had already created coupon_id as bigint.
--
-- This patch idempotently force-converts to uuid when needed.
-- Safe because no rows had coupon_id set (mobile app's INSERT failed
-- with 22P02 invalid_text_representation, so the column was always null).

do $$
begin
  if exists (
    select 1 from information_schema.columns 
    where table_schema='public' and table_name='orders' 
      and column_name='coupon_id' and data_type='bigint'
  ) then
    alter table orders drop constraint if exists orders_coupon_id_fkey;
    alter table orders alter column coupon_id type uuid using null;
    alter table orders 
      add constraint orders_coupon_id_fkey 
      foreign key (coupon_id) references campaigns(id) on delete set null;
  end if;
end $$;
