-- Teslimat bölgeleri — mahalle düzeyinde düzenleme (İlter'in 01.10.2026 listesi).
--
-- 1) Konak + Karabağlar'da teslimat yapılmayan 48 mahalle kapatılıyor
-- 2) Bornova + Bayraklı'da yalnızca listedeki 10 mahalle açık kalıyor, kalan 59'u kapanıyor
-- 3) Konak'ın 6 mahallesi (Halkapınar dahil) Bayraklı şubeye bağlanıyor
--
-- ETKİ ÖLÇÜLDÜ: kapanan 107 mahalleden bugüne kadar gelen ödenmiş sipariş
-- sayısı 1 (Konak/Cengiz Topel). Bornova ve Bayraklı'dan hiç ödenmiş sipariş
-- gelmemiş. Yani bu düzenleme mevcut hiçbir müşteriyi kesmiyor.
--
-- Türkçe ad eşleştirmesi kcal_norm_ad() ile yapılıyor: lower('İ') Postgres'te
-- birleşik aksan üretip eşleşmeyi bozduğu için büyük harfler ÖNCE translate
-- ediliyor, sonra lower uygulanıyor.

create or replace function public.kcal_norm_ad(t text) returns text
language sql immutable as $$
  select replace(lower(translate(trim(coalesce(t,'')),
    'İIıŞşĞğÜüÖöÇç', 'IIISsGgUuOoCc')), ' ', '')
$$;

-- ── 1 · Konak + Karabağlar: tamamen kapatılacak mahalleler ──────────────────
with kapat(ilce, ad) as (values
 ('Konak','oğuzlar'),('Konak','kocakapı'),('Konak','akarcalı'),('Konak','ballıkuyu'),
 ('Konak','kosova'),('Konak','yeşildere'),('Konak','mirali'),('Konak','kadifekale'),
 ('Konak','imariye'),('Konak','vezirağa'),('Konak','19 mayıs'),('Konak','lale'),
 ('Konak','mehtap'),('Konak','ismet paşa'),('Konak','küçükada'),('Konak','ferahlı'),
 ('Konak','ulubatlı'),('Konak','26 ağustos'),('Konak','zeytinlik'),('Konak','yenidoğan'),
 ('Konak','levent'),('Konak','boğaziçi'),('Konak','yavuz selim'),('Konak','zeybek'),
 ('Konak','huzur'),('Konak','emir sultan'),('Konak','mehmet akif'),('Konak','çınartepe'),
 ('Konak','saygı'),('Konak','anadolu'),('Konak','cengiz topel'),('Konak','millet'),
 ('Konak','atamer'),('Konak','murat'),('Konak','trakya'),('Konak','hilal'),
 ('Karabağlar','yaşar kemal'),('Karabağlar','cennetçeşme'),('Karabağlar','yurdoğlu'),
 ('Karabağlar','yüzbaşı şerafettin'),('Karabağlar','özgür'),('Karabağlar','gazi'),
 ('Karabağlar','uzundere'),('Karabağlar','peker'),('Karabağlar','aydın'),
 ('Karabağlar','ihsan alyanak'),('Karabağlar','abdi ipekçi'),('Karabağlar','devrim')
)
update public.delivery_zones z
   set is_active = false, allow_immediate = false, allow_scheduled = false,
       updated_at = now()
  from kapat k
 where z.district = k.ilce
   and public.kcal_norm_ad(z.neighborhood) = public.kcal_norm_ad(k.ad);

-- ── 2 · Bornova + Bayraklı: listede OLMAYAN mahalleler kapanıyor ────────────
with acik(ilce, ad) as (values
 ('Bornova','kazımdirik'),('Bornova','çınar'),('Bornova','yıldırım beyazıt'),('Bornova','ergene'),
 ('Bayraklı','mansuroğlu'),('Bayraklı','manavkuyu'),('Bayraklı','adalet'),
 ('Bayraklı','tepekule'),('Bayraklı','bayraklı'),('Bayraklı','osmangazi')
)
update public.delivery_zones z
   set is_active = false, allow_immediate = false, allow_scheduled = false,
       updated_at = now()
 where z.district in ('Bornova','Bayraklı')
   and not exists (
     select 1 from acik k
      where k.ilce = z.district
        and public.kcal_norm_ad(k.ad) = public.kcal_norm_ad(z.neighborhood)
   );

-- ── 3 · Konak'ın Bayraklı şubeye bağlanacak mahalleleri ─────────────────────
-- Halkapınar önceki migration'da girilmişti; kalan 5'i ekleniyor.
-- Hepsi is_active = false — şube hazır olunca tek UPDATE ile açılacak.
insert into public.branch_service_areas (branch_id, city, district, neighborhood, priority, is_active)
select b.id, 'İzmir', 'Konak', z.neighborhood, 10, false
from public.branches b
cross join lateral (
  select distinct dz.neighborhood
    from public.delivery_zones dz
   where dz.district = 'Konak'
     and public.kcal_norm_ad(dz.neighborhood) in (
       public.kcal_norm_ad('umurbey'), public.kcal_norm_ad('ege'),
       public.kcal_norm_ad('yenişehir'), public.kcal_norm_ad('halkapınar'),
       public.kcal_norm_ad('çınarlı'), public.kcal_norm_ad('mersinli')
     )
) z
where b.slug = 'mansuroglu'
  and not exists (
    select 1 from public.branch_service_areas s
     where s.branch_id = b.id and s.district = 'Konak'
       and public.kcal_norm_ad(s.neighborhood) = public.kcal_norm_ad(z.neighborhood)
  );;
