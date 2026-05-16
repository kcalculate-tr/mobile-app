-- orders.status='confirmed' yazıldığında campaign_uses tablosuna
-- otomatik insert. ON CONFLICT (campaign_id, order_id) sayesinde
-- aynı order için tekrar denemede no-op (idempotent).

create or replace function record_campaign_use()
returns trigger
language plpgsql
security definer
as $$
begin
  if NEW.status = 'confirmed'
     and NEW.coupon_id is not null
     and NEW.user_id is not null
     and (TG_OP = 'INSERT' or OLD.status is distinct from NEW.status)
  then
    insert into campaign_uses (campaign_id, user_id, order_id)
    values (NEW.coupon_id, NEW.user_id, NEW.id)
    on conflict (campaign_id, order_id) do nothing;
  end if;
  return NEW;
end;
$$;

drop trigger if exists orders_record_campaign_use on orders;

create trigger orders_record_campaign_use
  after insert or update of status on orders
  for each row
  execute function record_campaign_use();
