-- Teslimattan 30 dk sonra geri bildirim push'u. Mevcut davranışsal cron'larla
-- (push-macro-reminder / push-coupon-expiring) birebir aynı desen:
-- trigger_behavioral_push + notification_sends üzerinden idempotency.
select cron.schedule(
  'push-order-feedback',
  '*/10 * * * *',
  $CRON$
  DO $body$
  DECLARE
    v_order record;
  BEGIN
    FOR v_order IN
      SELECT o.id, o.user_id
        FROM public.orders o
       WHERE o.status = 'delivered'
         AND o.user_id IS NOT NULL
         AND o.updated_at BETWEEN now() - interval '6 hours' AND now() - interval '30 minutes'
         AND NOT EXISTS (
           SELECT 1 FROM public.reviews r WHERE r.order_id = o.id
         )
         AND NOT EXISTS (
           SELECT 1 FROM public.notification_sends ns
            WHERE ns.user_id      = o.user_id
              AND ns.template_key = 'order_feedback'
              AND ns.created_at   > now() - interval '24 hours'
         )
    LOOP
      PERFORM public.trigger_behavioral_push(v_order.user_id, 'order_feedback');
    END LOOP;
  END
  $body$;
  $CRON$
);
