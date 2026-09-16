-- Görev 1.2 küçük ek: sponsor (0 TL) kupon siparişlerinde `purchase`
-- event'inin props'una `is_free: true` eklensin — free-order-complete
-- Edge Function'ı payment_provider'ı 'sponsor' olarak yazıyor (bkz.
-- 20260916130000'daki araştırma notu). Bu, gerçek para tahsil edilmeyen
-- conversion'ları analitikte ayrıştırmayı sağlar; ciro raporunu (total_amount
-- zaten 0) bozmaz, sadece "kaç tanesi ücretsizdi" sorgulanabilir hale gelir.
--
-- NOT: Bu dosya `supabase db push` ile onaydan sonra uygulanacak — MCP
-- apply_migration kullanılmadı (dosya adı ↔ remote versiyon drift'ini
-- tekrarlamamak için).
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
          'is_free', (NEW.payment_provider = 'sponsor'),
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
