-- Saklı kart ödemesinde ne hash ne PfTransactionReportList hemen teyit
-- edemediğinde (needs_manual_review) siparişi "belirsiz" işaretlemek için.
-- Order durumu (status/payment_status) DEĞİŞMEZ — sadece bu bayrak açılır;
-- 5dk'lık pg_cron sweep (paynkolay-review-sweep) veya destek ekibi sonuçlandırır.
alter table public.orders
  add column if not exists payment_review_pending boolean not null default false,
  add column if not exists payment_review_started_at timestamptz;

create index if not exists orders_payment_review_pending_idx
  on public.orders (payment_review_pending)
  where payment_review_pending;

-- 'expire-abandoned-orders' cron'u (her 5dk, 10dk'dan eski pending_payment
-- siparişleri 'expired' yapıyordu) artık review-pending siparişleri HARİÇ
-- tutuyor — yoksa incelemedeki bir ödeme "expired" görünüp müşteri kafası
-- karışır, sweep de zaten status'u DEĞİŞTİRMEYECEK şekilde tasarlandı ama
-- expire cron'u status'u ayrıca kendi başına eziyordu.
select cron.schedule(
  'expire-abandoned-orders',
  '*/5 * * * *',
  $$
    UPDATE public.orders
       SET status='expired', updated_at=now()
     WHERE status='pending_payment'
       AND payment_status <> 'paid'
       AND payment_review_pending = false
       AND created_at < now() - interval '10 minutes'
  $$
);

-- paynkolay-review-sweep: 5dk'da bir, en fazla 24 saat boyunca, review-pending
-- siparişleri PfTransactionReportList ile tekrar dener. 'service_role_key'
-- vault secret'ı zaten var (push-campaign-dispatcher ile aynı, proje geneli
-- service role key — Adisyo'ya özgü değil).
select cron.schedule(
  'paynkolay-review-sweep',
  '*/5 * * * *',
  $$
    SELECT net.http_post(
      url := 'https://xtjakvinklthlvsfcncu.supabase.co/functions/v1/paynkolay-review-sweep',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || COALESCE(
          (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key' LIMIT 1),
          ''
        )
      ),
      body := '{}'::jsonb
    )
    WHERE EXISTS (
      SELECT 1 FROM public.orders
       WHERE payment_review_pending = true
         AND payment_review_started_at > now() - interval '24 hours'
    )
  $$
);
