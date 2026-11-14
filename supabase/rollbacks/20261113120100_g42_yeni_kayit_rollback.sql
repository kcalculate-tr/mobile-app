-- G42-S1 — 20261113120100_g42_yeni_kayit GERİ ALMA.
-- Bayrak satırı silinince istemcide `yeni_kayit` yerel varsayılanı KAPALI → bugünkü onboarding.
-- Kullanıcı verisine dokunmaz (yeni tablo/kolon açılmadı; plan G34 kolonlarında kalır).
begin;

delete from public.feature_flags where key = 'yeni_kayit';
delete from public.app_settings where key in ('kayit_muscle_surplus_kcal', 'kayit_plan_email_enabled');
do $$
begin
  if to_regclass('public.analytics_event_names') is not null then
    delete from public.analytics_event_names
      where name in ('onb_step_view', 'onb_path_choice', 'reg_q_answer', 'plan_ready', 'reg_signup_method', 'meta_consent', 'paywall_view_reg', 'trial_start_reg');
  end if;
end $$;

commit;
