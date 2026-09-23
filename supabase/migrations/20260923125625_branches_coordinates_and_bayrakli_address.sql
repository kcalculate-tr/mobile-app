-- Şubelere yaklaşık koordinat + Bayraklı şubesinin gerçek adı/adresi.
--
-- Koordinatlar YALNIZCA "kullanıcıya en yakın şube" sıralaması için.
-- Haritadaki pin bu değerlerden değil, address metninin Google tarafından
-- geocode edilmesinden gelir; böylece pin gerçek kapı numarasında durur.
alter table public.branches
  add column if not exists latitude  double precision,
  add column if not exists longitude double precision;

comment on column public.branches.latitude  is 'Şube yaklaşık enlem — sadece "en yakın şube" sıralaması için. Harita pini address alanından geocode edilir.';
comment on column public.branches.longitude is 'Şube yaklaşık boylam — sadece "en yakın şube" sıralaması için.';

update public.branches
   set name = 'Bayraklı (Mansuroğlu)',
       address = 'Mansuroğlu Mah. 271. Sk. No:6A Bayraklı İzmir',
       latitude = 38.4585,
       longitude = 27.1795
 where slug = 'mansuroglu';

update public.branches
   set latitude = 38.3820,
       longitude = 27.1215
 where slug = 'basinsitesi';
