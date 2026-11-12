-- G27-S1 md.3 (G26 SORULAR 3, İlter 11 Kas) — Sağlık verisi açık rızası user_consents'e AYRI satır.
-- DURUM: YALNIZ DOSYA (canlıya UYGULANMADI). İdempotent: tekrar çalıştırmak güvenli.
-- Rollback: supabase/rollbacks/20261111230100_g27_health_consent_rollback.sql
-- Önkoşul: 20261109210100_g20_s1_user_consents, 20261111100100_g24_coach (CHECK listeleri).
--
-- "Takibe başla › Seni tanıyalım" ekranında kullanıcı boy / kilo / yaş / cinsiyet için
-- KVKK m.6 açık rızasını işaretleyip devam edince istemci şu satırı ekler:
--   kind = 'health_data', source = 'takibe', granted = true, doc_slug/doc_version = NULL.
-- Ayarlar'dan geri alma (ileride) aynı kind ile source = 'settings', granted = false.
--
-- 1) user_consents CHECK: kind'a 'health_data', source'a 'takibe' eklenir (G24 listesi korunur).
-- 2) my_consent_status(): 'health_data' son değerini de döner (diğer alanlar AYNEN).
--
-- İstemci, bu migration uygulanmadan önce de güvenli: sağlık satırı ortak rıza kuyruğuna
-- KONMAZ (CHECK reddederse politika satırlarını tıkardı); ayrı yan kuyrukta bekler ve
-- migration uygulanınca bir sonraki oturumda yazılır (src/lib/consent/store.ts).
begin;

do $$
begin
  if to_regclass('public.user_consents') is null then
    raise notice 'g27_health_consent: user_consents yok — CHECK güncellemesi atlandı';
    return;
  end if;
  alter table public.user_consents drop constraint if exists user_consents_kind_check;
  alter table public.user_consents
    add constraint user_consents_kind_check
    check (kind in ('policy', 'ad_measurement', 'first_party', 'att', 'ai_photo', 'ai_coach', 'health_data'));
  alter table public.user_consents drop constraint if exists user_consents_source_check;
  alter table public.user_consents
    add constraint user_consents_source_check
    check (source in ('signup_email', 'signup_social', 'notice', 'reconsent', 'settings', 'att', 'scan', 'coach', 'takibe'));
end $$;

comment on column public.user_consents.kind is
  'policy · ad_measurement · first_party · att · ai_photo · ai_coach · health_data (G27: Takibe başla sağlık verisi açık rızası)';

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
    ),
    'health_data', (
      select c.granted from public.user_consents c
       where c.user_id = auth.uid() and c.kind = 'health_data'
       order by c.created_at desc limit 1
    )
  );
$$;

revoke all on function public.my_consent_status() from public, anon;
grant execute on function public.my_consent_status() to authenticated;

commit;
