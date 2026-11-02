-- ROLLBACK — 20261103000100_security_rls_policies
-- Eklenen 10 "erişim yok" politikasını kaldırır. Tablolar RLS açık + politikasız
-- (orijinal) duruma döner: davranış yine birebir aynı (anon/authenticated reddedilir,
-- service_role baypas eder). Veri değişmez.

begin;

drop policy if exists "adisyo_api_log_no_client_access" on public.adisyo_api_log;
drop policy if exists "adisyo_webhook_events_no_client_access" on public.adisyo_webhook_events;
drop policy if exists "deleted_account_fingerprints_no_client_access" on public.deleted_account_fingerprints;
drop policy if exists "failed_payments_no_client_access" on public.failed_payments;
drop policy if exists "push_notifications_no_client_access" on public.push_notifications;
drop policy if exists "refunds_no_client_access" on public.refunds;
drop policy if exists "sweep_locks_no_client_access" on public.sweep_locks;
drop policy if exists "user_apple_tokens_no_client_access" on public.user_apple_tokens;
drop policy if exists "user_card_secrets_no_client_access" on public.user_card_secrets;
drop policy if exists "user_known_devices_no_client_access" on public.user_known_devices;

commit;
