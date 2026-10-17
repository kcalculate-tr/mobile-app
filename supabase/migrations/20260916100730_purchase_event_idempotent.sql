create unique index if not exists analytics_events_purchase_order_id_uq
  on public.analytics_events (((props->>'order_id')::bigint))
  where event_name = 'purchase';

create or replace function public.record_order_purchase_event()
returns trigger
language plpgsql
security definer
as $$
begin
  if NEW.status = 'confirmed'
     and NEW.payment_status = 'paid'
     and (TG_OP = 'INSERT' or OLD.status is distinct from NEW.status)
     and not exists (
       select 1 from public.analytics_events
       where event_name = 'purchase'
         and (props->>'order_id')::bigint = NEW.id
     )
  then
    begin
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
    exception when unique_violation then
      null;
    end;
  end if;
  return NEW;
end;
$$;
;
