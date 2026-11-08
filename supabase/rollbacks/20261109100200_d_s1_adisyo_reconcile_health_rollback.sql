-- D-S1 — 20261109100200_d_s1_adisyo_reconcile_health.sql geri alma. UYGULANMADI (yalnız dosya).
begin;
do $$
begin
  if to_regnamespace('cron') is not null then
    perform cron.unschedule(j.jobname) from cron.job j
     where j.jobname in ('adisyo-reconcile-nightly', 'adisyo-webhook-health');
  end if;
end $$;
drop function if exists public.fn_adisyo_reconcile_kick();
drop function if exists public.fn_adisyo_webhook_health_check(timestamptz);
drop function if exists public.adisyo_webhook_health_decide(timestamptz, timestamptz, jsonb);
delete from public.app_settings where key in ('adisyo_reconcile', 'adisyo_webhook_health');
commit;
