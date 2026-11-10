-- G27-S1 md.3 — 20261111230100_g27_health_consent GERİ ALMA.
-- 1) kind 'health_data' / source 'takibe' satırları CHECK'e uymayacağı için ÖNCE silinir
--    (sağlık verisi açık rıza kayıtları KAYBOLUR — gerekirse önce dışa aktar).
-- 2) CHECK listeleri G24 hâline döner.
-- 3) my_consent_status() G20-S1 hâline döner ('health_data' alanı gider).
-- İstemci geri alma sonrası da güvenli: yazım reddedilirse satır yan kuyrukta bekler.
begin;

do $$
begin
  if to_regclass('public.user_consents') is not null then
    delete from public.user_consents where kind = 'health_data' or source = 'takibe';
    alter table public.user_consents drop constraint if exists user_consents_kind_check;
    alter table public.user_consents
      add constraint user_consents_kind_check
      check (kind in ('policy', 'ad_measurement', 'first_party', 'att', 'ai_photo', 'ai_coach'));
    alter table public.user_consents drop constraint if exists user_consents_source_check;
    alter table public.user_consents
      add constraint user_consents_source_check
      check (source in ('signup_email', 'signup_social', 'notice', 'reconsent', 'settings', 'att', 'scan', 'coach'));
    comment on column public.user_consents.kind is null;
  end if;
end $$;

create or replace function public.my_consent_status()
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  select jsonb_build_object(
    'docs', coalesce((
      select jsonb_agg(jsonb_build_object(
               'slug', d.slug,
               'version', d.version,
               'accepted_version', (
                 select max(c.doc_version) from public.user_consents c
                  where c.user_id = auth.uid() and c.kind = 'policy'
                    and c.doc_slug = d.slug and c.granted
               )
             ) order by d.slug)
        from public.legal_documents d
       where d.requires_acceptance
    ), '[]'::jsonb),
    'ad_measurement', (
      select c.granted from public.user_consents c
       where c.user_id = auth.uid() and c.kind = 'ad_measurement'
       order by c.created_at desc limit 1
    ),
    'first_party', (
      select c.granted from public.user_consents c
       where c.user_id = auth.uid() and c.kind = 'first_party'
       order by c.created_at desc limit 1
    ),
    'ai_photo', (
      select c.granted from public.user_consents c
       where c.user_id = auth.uid() and c.kind = 'ai_photo'
       order by c.created_at desc limit 1
    )
  );
$$;

revoke all on function public.my_consent_status() from public, anon;
grant execute on function public.my_consent_status() to authenticated;

commit;
