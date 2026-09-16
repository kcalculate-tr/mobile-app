-- Görev 1.2 ek düzeltme: `purchase` trigger'ının idempotency ve doğruluk açıkları.
--
-- Araştırma bulguları (admin-panel + Edge Functions taranarak):
-- 1) orders.status='confirmed' HER ZAMAN ödeme alınmış anlamına gelmiyor.
--    PSP callback'leri (paytr-callback, paynkolay-callback, payment-verify)
--    status+payment_status'u HER ZAMAN birlikte, aynı UPDATE'te 'confirmed'+
--    'paid' yazıyor — bunlar güvenli. Ama admin-panel'de AdminOrders.jsx ve
--    BossScheduledOrders.jsx, payment_status'a hiç dokunmadan, önceki duruma
--    bakmadan status'u serbestçe 'confirmed'e çekebiliyor (state machine yok).
--    Bu yüzden trigger'a `payment_status = 'paid'` şartı eklendi.
-- 2) confirmed → refunded/cancelled → tekrar confirmed (admin panelden manuel,
--    veya refund sonrası yeniden onay) döngüsünde eski trigger her seferinde
--    yeni bir 'purchase' satırı yazıyordu (idempotency guard yoktu — kardeş
--    trigger record_campaign_use'dan farklı olarak). Artık aynı order_id için
--    en fazla bir 'purchase' event'i yazılabiliyor: hem NOT EXISTS ön-kontrolü
--    hem partial unique index (eşzamanlı iki UPDATE için DB-seviyesi garanti).
-- 3) Analytics side-effect'i asıl orders UPDATE'ini ASLA bozmamalı — nadir bir
--    yarış durumunda unique_violation oluşursa exception yutulur.
--
-- payment_status='paid' şartı, admin panelin "her statüden her statüye"
-- geçişindeki tüm riski kapatmıyor (payment_status'u admin akışı zaten
-- değiştirmiyor, dolayısıyla eski değeri taşıyabilir) — ama pratikte en büyük
-- boşluğu (hiç ödenmemiş bir siparişin sahte 'purchase' üretmesi) kapatıyor.
-- Admin panelin status state-machine'i ayrı bir repo (admin-panel submodule),
-- bu migration kapsamı dışında.

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
