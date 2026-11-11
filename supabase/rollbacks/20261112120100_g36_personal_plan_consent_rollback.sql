-- G36-S1 md.8 — 20261112120100_g36_personal_plan_consent geri alma.
-- user_consents source CHECK: G33 listesine dön. Rıza geçmişi DEĞİŞTİRİLMEZ: var olan
-- 'personal_plan' satırları kalır (NOT VALID → yalnız yeni satırlar denetlenir). Geri alma sonrası
-- istemcinin yazdığı yeni 'personal_plan' satırları yan kuyrukta bekler (diğer satırları tıkamaz).
begin;

do $$
begin
  if to_regclass('public.user_consents') is null then
    return;
  end if;
  alter table public.user_consents drop constraint if exists user_consents_source_check;
  alter table public.user_consents
    add constraint user_consents_source_check
    check (source in ('signup_email', 'signup_social', 'notice', 'reconsent', 'settings', 'att', 'scan', 'coach', 'takibe', 'meal_plan')) not valid;
  comment on column public.user_consents.source is null;
end $$;


commit;
