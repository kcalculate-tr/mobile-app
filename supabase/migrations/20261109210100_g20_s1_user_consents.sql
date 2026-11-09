-- G20-S1 — Rıza ve politika kaydı.
-- DURUM: CANLIDA (Claude 9 Kas uyguladı; bu dosya G20-S3 md.0'da canlıyla EŞİTLENDİ:
--   kind'a 'ai_photo', source'a 'scan', requires_acceptance canlı slug'larla,
--   my_consent_status() 'ai_photo' döner). Yeniden çalıştırılabilir (idempotent).
-- Rollback: supabase/rollbacks/20261109210100_g20_s1_user_consents_rollback.sql
--
-- 1) legal_documents.version (int, varsayılan 1). Canlı 4 satır (kullanim-kosullari,
--    gizlilik-politikasi, kvkk, mesafeli-satis — src/lib/legal/slugs.ts ve
--    src/data/contractsData.ts ile aynı slug'lar) sürüm 1 olur. Yeni sürüm
--    yayınlamak = metni güncelle + version'ı 1 artır → istemci bir sonraki
--    açılışta tekrar kabul sheet'i gösterir.
--    requires_acceptance: kabul zorunlu belgeler (kullanim-kosullari,
--    gizlilik-politikasi). kvkk yalnız bilgilendirme (aydınlatma metni kabul
--    edilmez, okunur).
-- 2) user_consents — yalnız EKLEME yapılan kayıt defteri (append-only):
--    kimin, hangi belgenin hangi sürümünü / hangi izni, ne zaman, nereden verdiği.
--    RLS: kullanıcı yalnız KENDİ satırlarını okur ve ekler; güncelleme/silme yok
--    (hesap silinince auth.users ON DELETE CASCADE ile gider).
-- 3) my_consent_status() — istemcinin "tekrar kabul gerekiyor mu?" sorusu:
--    zorunlu her belge için güncel sürüm + kullanıcının kabul ettiği en yüksek sürüm,
--    ve reklam / kullanım ölçümü / yapay zekâ fotoğraf analizi izinlerinin son değeri.
begin;

-- 1) Sürüm alanı ------------------------------------------------------------
alter table public.legal_documents
  add column if not exists version integer not null default 1,
  add column if not exists requires_acceptance boolean not null default false;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'legal_documents_version_pos_chk') then
    alter table public.legal_documents
      add constraint legal_documents_version_pos_chk check (version >= 1);
  end if;
end $$;

update public.legal_documents
   set requires_acceptance = true
 where slug in ('kullanim-kosullari', 'gizlilik-politikasi')
   and requires_acceptance = false;

-- 2) Rıza kayıt defteri -------------------------------------------------------
create table if not exists public.user_consents (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  -- policy: belge kabulü (doc_slug + doc_version dolu)
  -- ad_measurement: Meta reklam ölçümü · first_party: uygulama içi kullanım ölçümü
  -- att: iOS App Tracking Transparency sonucu (granted = izin verildi)
  -- ai_photo: Tara fotoğrafının yapay zekâ hizmet sağlayıcısına (ABD) gönderilmesi
  --           izni (Apple 5.1.2(i), G20-S3 md.2)
  kind        text not null check (kind in ('policy', 'ad_measurement', 'first_party', 'att', 'ai_photo')),
  doc_slug    text,
  doc_version integer,
  granted     boolean not null,
  -- signup_email · signup_social · notice (mevcut kullanıcı bilgilendirmesi)
  -- reconsent (yeni sürüm) · settings · att · scan (Tara ilk tarama izni)
  source      text not null check (source in ('signup_email', 'signup_social', 'notice', 'reconsent', 'settings', 'att', 'scan')),
  platform    text check (platform in ('ios', 'android', 'web')),
  app_version text,
  created_at  timestamptz not null default now(),
  constraint user_consents_policy_doc_chk check (
    (kind = 'policy' and doc_slug is not null and doc_version is not null and doc_version >= 1)
    or (kind <> 'policy' and doc_slug is null and doc_version is null)
  )
);

-- Tablo zaten varsa (canlı) CHECK listeleri de güncel olsun (ai_photo / scan).
alter table public.user_consents drop constraint if exists user_consents_kind_check;
alter table public.user_consents
  add constraint user_consents_kind_check
  check (kind in ('policy', 'ad_measurement', 'first_party', 'att', 'ai_photo'));
alter table public.user_consents drop constraint if exists user_consents_source_check;
alter table public.user_consents
  add constraint user_consents_source_check
  check (source in ('signup_email', 'signup_social', 'notice', 'reconsent', 'settings', 'att', 'scan'));

create index if not exists user_consents_user_kind_idx
  on public.user_consents (user_id, kind, created_at desc);

alter table public.user_consents enable row level security;

drop policy if exists user_consents_select_own on public.user_consents;
create policy user_consents_select_own on public.user_consents
  for select to authenticated
  using (user_id = auth.uid());

drop policy if exists user_consents_insert_own on public.user_consents;
create policy user_consents_insert_own on public.user_consents
  for insert to authenticated
  with check (user_id = auth.uid());

-- Güncelleme / silme politikası YOK → istemci kaydı değiştiremez.
revoke update, delete on public.user_consents from anon, authenticated;
grant select, insert on public.user_consents to authenticated;

-- 3) Durum sorgusu ------------------------------------------------------------
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
