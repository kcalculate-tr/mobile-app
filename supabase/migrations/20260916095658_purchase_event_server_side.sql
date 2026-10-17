create or replace function public.record_order_purchase_event()
returns trigger
language plpgsql
security definer
as $$
begin
  if NEW.status = 'confirmed'
     and (TG_OP = 'INSERT' or OLD.status is distinct from NEW.status)
  then
    insert into public.analytics_events (user_id, event_name, props)
    values (
      NEW.user_id,
      'purchase',
      jsonb_build_object(
        'order_id', NEW.id,
        'price', NEW.total_amount,
        'branch_id', NEW.branch_id,
        'payment_method', NEW.payment_provider,
        'source', 'order_status_trigger'
      )
    );
  end if;
  return NEW;
end;
$$;

drop trigger if exists orders_record_purchase_event on public.orders;

create trigger orders_record_purchase_event
  after insert or update of status on public.orders
  for each row
  execute function public.record_order_purchase_event();
;
