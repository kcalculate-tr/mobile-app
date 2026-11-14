-- G46-S1 md.3 — T1 kayıt teklifi kapatma onayı olayı. DURUM: YALNIZ DOSYA (canlıya UYGULANMADI).
-- İdempotent: tekrar çalıştırmak güvenli. Rollback: supabase/rollbacks/20261114100100_g46_paywall_dismiss_confirm_rollback.sql
-- Önkoşul: analytics_event_names (D-S1, yoksa atlanır). src/lib/metrics/events.ts ile birebir. Sağlık değeri prop'u YOK.
-- "Gösterildi" işareti için şema değişikliği YOK: cihazda AsyncStorage, hesapta auth user_metadata.kayit_offer_shown_at.
begin;

do $$
begin
  if to_regclass('public.analytics_event_names') is null then
    raise notice 'g46_paywall_dismiss_confirm: analytics_event_names yok — olay satırı atlandı';
    return;
  end if;
  insert into public.analytics_event_names
    (name, category, source, description_tr, description_en, props_hint, alias_of, is_kpi)
  values
    ('paywall_dismiss_confirm', 'commerce', 'client', 'Kayıt teklifi kapatma onayı', 'Signup offer dismiss confirmation', 'choice: stay|leave', null, false)
  on conflict (name) do nothing;
end $$;

commit;
