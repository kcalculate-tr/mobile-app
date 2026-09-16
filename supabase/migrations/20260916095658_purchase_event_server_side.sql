-- Görev 1.2 ek iş: `purchase` event'i istemciden sunucuya taşındı.
--
-- Neden: analytics_events RLS'i yalnızca "user_id = auth.uid()" kontrol
-- ediyor, `props` içeriğinin doğruluğunu doğrulamıyor — istemci taraflı bir
-- track('purchase', { price, order_id }) çağrısı teorik olarak sahte/yanlış
-- bir tutarla event yazabilir (gelir/funnel analitiğini kirletir). `purchase`
-- gelir-kritik bir conversion event'i olduğu için, `order_delivered` ile aynı
-- pattern'de (orders.status trigger'ı, bkz. 20260916110000) sunucu tarafında
-- ve orders.total_amount'tan üretiliyor. İstemcideki 4 `track('purchase', ...)`
-- çağrısı kaldırıldı (PaymentScreen.tsx); `payment_success` (PSP-akış sinyali,
-- düşük riskli) istemcide kalmaya devam ediyor.
--
-- Tetikleyici koşul (record_campaign_use ile aynı, bu repoda zaten "ödeme
-- tamamlandı" sinyali olarak kullanılan sütun): orders.status GERÇEKTEN
-- 'confirmed'e geçtiğinde. Tosla/PayTR/Paynkolay'ın üçü de başarılı ödemede
-- bu durumu yazıyor (completeOrder() / pollOrderConfirmed()).
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
