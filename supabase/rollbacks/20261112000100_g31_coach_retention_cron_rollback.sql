-- G31-S1 md.5 — 20261112000100_g31_coach_retention_cron GERİ ALMA.
-- 1) pg_cron işi 'coach-retention-daily' kaldırılır (cron yoksa atlanır), 2) fonksiyon silinir.
-- Silinmiş coach_messages satırları GERİ GELMEZ. coach-chat'in çağrı anındaki kendi saklama
-- temizliği (index.ts) etkilenmez.
begin;

do $$
begin
  if to_regnamespace('cron') is null then
    return;
  end if;
  perform cron.unschedule(j.jobname) from cron.job j where j.jobname = 'coach-retention-daily';
end $$;

drop function if exists public.fn_coach_retention_purge();

commit;
