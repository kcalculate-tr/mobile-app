-- ════════════════════════════════════════════════════════════════════════════
-- G2-S1 Güvenlik — RLS politikası olmayan 10 tablo için AÇIK "erişim yok" politikası
-- version: 20261103000100  name: security_rls_policies
-- Hazırlayan: gece-2 güvenlik oturumu (night2/security). STAGING'DE TEST EDİLMEDİ.
-- ════════════════════════════════════════════════════════════════════════════
-- Supabase security advisor (2026-11-02) `rls_enabled_no_policy` ile 10 tabloyu
-- işaretledi: RLS açık ama hiç politika yok. Bu, PostgREST üzerinden anon ve
-- authenticated için zaten "hepsini reddet" demektir; service_role RLS'i baypas
-- ettiği için çalışan akışlar bundan etkilenmez. Kod taraması (G2-S1-SECURITY.md
-- bölüm 1) 10 tablonun TAMAMINA yalnızca service_role'lü edge function'lardan
-- erişildiğini doğruladı — src/ (mobil), admin-panel/, branch-panel/ hiçbiri
-- bu tablolara anon/authenticated ile dokunmuyor. validate_coupon() gibi
-- SECURITY DEFINER fonksiyonlar deleted_account_fingerprints'i okur ama sahip
-- (definer) bağlamında çalıştığı için çağıranın RLS'i onları da engellemez.
--
-- Bu yüzden en dar ve KIRMAYAN düzeltme: anon + authenticated için AÇIKÇA
-- "erişim yok" (using/with check = false) politikası eklemek. Davranış bugünküyle
-- birebir aynı kalır (zaten reddediliyordu); tek fark advisor uyarısının kapanması
-- ve niyetin kod olarak kaydedilmesi. Yeni erişim AÇILMAZ (geriye uyumlu).
--
-- NOT: İleride bir ekran kullanıcının KENDİ satırlarını (ör. kendi failed_payments
-- veya user_known_devices kayıtları) göstermek isterse, o zaman ilgili tabloya
-- `using (user_id = auth.uid())` kapsamlı bir SELECT politikası EKLENİR. Bugün
-- hiçbir akış bunu yapmadığı için eklemiyoruz (en dar politika ilkesi).
-- ════════════════════════════════════════════════════════════════════════════

begin;

-- adisyo_api_log — Adisyo API çağrı logları; yalnızca adisyo-* edge function'ları (service_role) yazar
create policy "adisyo_api_log_no_client_access" on public.adisyo_api_log
  for all to anon, authenticated using (false) with check (false);

-- adisyo_webhook_events — Adisyo webhook kayıtları; yalnızca adisyo-webhook-receiver (service_role)
create policy "adisyo_webhook_events_no_client_access" on public.adisyo_webhook_events
  for all to anon, authenticated using (false) with check (false);

-- deleted_account_fingerprints — silinen hesap hash'leri (dolandırıcılık önleme); delete-account (service_role) yazar, validate_coupon() (definer) okur
create policy "deleted_account_fingerprints_no_client_access" on public.deleted_account_fingerprints
  for all to anon, authenticated using (false) with check (false);

-- failed_payments — başarısız ödeme kayıtları; payment-verify/tosla-callback/paynkolay-cards (service_role)
create policy "failed_payments_no_client_access" on public.failed_payments
  for all to anon, authenticated using (false) with check (false);

-- push_notifications — eski/kullanılmayan tablo (0 satır, kodda referans yok); yine de kilitli tutulur
create policy "push_notifications_no_client_access" on public.push_notifications
  for all to anon, authenticated using (false) with check (false);

-- refunds — iade denetim kayıtları (finansal); yalnızca paynkolay-refund (service_role)
create policy "refunds_no_client_access" on public.refunds
  for all to anon, authenticated using (false) with check (false);

-- sweep_locks — sistem kilit tablosu; acquire/release_sweep_lock() (service_role) + pg_cron
create policy "sweep_locks_no_client_access" on public.sweep_locks
  for all to anon, authenticated using (false) with check (false);

-- user_apple_tokens — Apple refresh token'ları; apple-link-token + delete-account (service_role)
create policy "user_apple_tokens_no_client_access" on public.user_apple_tokens
  for all to anon, authenticated using (false) with check (false);

-- user_card_secrets — tokenleştirilmiş kart verisi (yüksek hassasiyet); paynkolay-cards (service_role)
create policy "user_card_secrets_no_client_access" on public.user_card_secrets
  for all to anon, authenticated using (false) with check (false);

-- user_known_devices — dolandırıcılık tespiti (bilinen cihazlar); paynkolay-cards (service_role)
create policy "user_known_devices_no_client_access" on public.user_known_devices
  for all to anon, authenticated using (false) with check (false);

commit;
