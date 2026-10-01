-- Teslimat bölgeleri — mahalle düzeyinde düzenleme (İlter'in 01.10.2026 listesi).
--
-- 1) Konak + Karabağlar'da teslimat yapılmayan 48 mahalle kapatıldı
-- 2) Bornova + Bayraklı'da yalnızca listedeki 10 mahalle açık kaldı, 59'u kapandı
-- 3) Konak'ın 6 mahallesi (Halkapınar, Ege, Umurbey, Yenişehir, Çınarlı,
--    Mersinli) Bayraklı şubeye bağlandı — is_active=false, şube hazır olunca açılacak
--
-- ETKİ ÖLÇÜLDÜ: kapanan 107 mahalleden bugüne kadar gelen ödenmiş sipariş
-- sayısı 1 (Konak/Cengiz Topel). Bornova ve Bayraklı'dan hiç ödenmiş sipariş
-- gelmemiş (kayıtlı adres var, sipariş yok). Mevcut hiçbir müşteri kesilmedi.
--
-- Türkçe ad eşleştirmesi kcal_norm_ad() ile: lower('İ') Postgres'te birleşik
-- aksan üretip eşleşmeyi bozuyor, bu yüzden büyük harfler ÖNCE translate
-- ediliyor, sonra lower uygulanıyor. (İlk denemede İmariye / İsmet Paşa /
-- İhsan Alyanak tam bu yüzden "bulunamadı" dönmüştü.)

create or replace function public.kcal_norm_ad(t text) returns text
language sql immutable as $$
  select replace(lower(translate(trim(coalesce(t,'')),
    'İIıŞşĞğÜüÖöÇç', 'IIISsGgUuOoCc')), ' ', '')
$$;

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
  );
