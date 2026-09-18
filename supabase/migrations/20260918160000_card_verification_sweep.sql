-- Kart Ekle — sweep altyapısı (aşama 4).
--  1) card_verifications: çekilen tutar + PaynKolay rapor kontrol takibi kolonları
--  2) sweep_locks: sweep'in aynı anda iki kez çalışmasını engelleyen atomik, TTL'li kilit
--  3) pg_cron: card-verification-sweep (5 dk'da bir; yalnız işi varsa HTTP çağrısı atar)

-- 1) Kolonlar
alter table public.card_verifications
  add column if not exists charged_amount     numeric(10,2),   -- gerçekten çekilen tutar (iade bu tutar üzerinden)
  add column if not exists report_checked_at  timestamptz,     -- son PaynKolay rapor kontrolü
  add column if not exists report_check_count integer not null default 0 check (report_check_count >= 0);

comment on column public.card_verifications.charged_amount is
  'PaynKolay''ın gerçekten çektiği tutar (amount_mismatch durumunda amount''tan farklı olabilir); iade bu tutar üzerinden yapılır.';
comment on column public.card_verifications.report_check_count is
  'initiated / failed(timeout|cancelled) kayıtlar için PaynKolay raporundan yapılan kontrol sayısı (geri çekilmeli aralıkla, en fazla 6).';

-- 2) Kilit tablosu + fonksiyonlar (yalnız service_role)
create table if not exists public.sweep_locks (
  name         text primary key,
  locked_until timestamptz not null,
  locked_by    text
);
alter table public.sweep_locks enable row level security;  -- politika YOK: yalnız service_role/security definer

-- Kilit alındıysa true. Süresi dolmuş kilit devralınır (sweep çökerse TTL sonunda kendiliğinden açılır).
create or replace function public.acquire_sweep_lock(p_name text, p_ttl_seconds integer, p_owner text default null)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_got boolean;
begin
  insert into public.sweep_locks as l (name, locked_until, locked_by)
  values (p_name, now() + make_interval(secs => p_ttl_seconds), p_owner)
  on conflict (name) do update
    set locked_until = excluded.locked_until, locked_by = excluded.locked_by
    where l.locked_until < now()
  returning true into v_got;
  return coalesce(v_got, false);
end;
$$;

create or replace function public.release_sweep_lock(p_name text, p_owner text default null)
returns void
language sql
security definer
set search_path = public
as $$
  update public.sweep_locks
     set locked_until = now() - interval '1 second'
   where name = p_name and (p_owner is null or locked_by = p_owner);
$$;

revoke all on function public.acquire_sweep_lock(text, integer, text) from public, anon, authenticated;
revoke all on function public.release_sweep_lock(text, text) from public, anon, authenticated;
grant execute on function public.acquire_sweep_lock(text, integer, text) to service_role;
grant execute on function public.release_sweep_lock(text, text) to service_role;

-- 3) Cron: 5 dk'da bir. Sweep fonksiyonu her satırın kendi zamanlamasını uygular
--    (refund_pending için son denemeden 1 saat, rapor kontrolü için geri çekilme) —
--    yani iade denemeleri SAATLİK, tarama/rapor mutabakatı ise 5 dk'lık granülarite.
--    Aşağıdaki WHERE EXISTS, sweep'in ele aldığı kümenin ÜST KÜMESİDİR (iş yoksa HTTP yok).
select cron.schedule(
  'card-verification-sweep',
  '*/5 * * * *',
  $$
    SELECT net.http_post(
      url := 'https://xtjakvinklthlvsfcncu.supabase.co/functions/v1/paynkolay-verification-sweep',
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
      SELECT 1 FROM public.card_verifications v
       WHERE (v.status = 'initiated' AND v.created_at < now() - interval '15 minutes')
          OR (v.status = 'failed' AND v.note IN ('timeout','cancelled')
              AND v.created_at > now() - interval '24 hours' AND v.report_check_count < 6)
          OR (v.status = 'refund_pending')
          OR (v.status = 'succeeded' AND v.refund_attempts = 0 AND v.updated_at < now() - interval '5 minutes')
    )
  $$
);
