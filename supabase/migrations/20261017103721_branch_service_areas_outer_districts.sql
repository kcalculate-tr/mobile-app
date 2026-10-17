-- 334 mahalle teslimata açıktı (yalnız randevulu) ama hiçbir şubeye bağlı
-- değildi. fn_resolve_branch_for_order kapsamı olmayan ilçede VARSAYILAN
-- şubeye düşüyor — yani Urla'dan gelen sipariş Basın Sitesi'ne iniyordu.
-- Buca'dan 6 sipariş bu şekilde gelmiş.
--
-- İlter'in dağılımı (17.10.2026):
--   Bayraklı     → Menemen, Karşıyaka, Çiğli
--   Basın Sitesi → Urla, Güzelbahçe, Buca, Menderes, Gaziemir
--   Torbalı      → kapatılıyor (hiçbir şubeye uzaklığı makul değil)
--
-- neighborhood NULL = ilçenin tamamı.

insert into public.branch_service_areas (branch_id, city, district, neighborhood, priority, is_active)
select b.id, 'İzmir', d.district, null, 0, true
from public.branches b
cross join (values ('Menemen'), ('Karşıyaka'), ('Çiğli')) as d(district)
where b.name = 'Bayraklı (Mansuroğlu)'
  and not exists (
    select 1 from public.branch_service_areas x
    where x.branch_id = b.id
      and lower(x.district) = lower(d.district)
      and x.neighborhood is null
  );

insert into public.branch_service_areas (branch_id, city, district, neighborhood, priority, is_active)
select b.id, 'İzmir', d.district, null, 0, true
from public.branches b
cross join (values ('Urla'), ('Güzelbahçe'), ('Buca'), ('Menderes'), ('Gaziemir')) as d(district)
where b.name = 'Karabağlar (Basın Sitesi)'
  and not exists (
    select 1 from public.branch_service_areas x
    where x.branch_id = b.id
      and lower(x.district) = lower(d.district)
      and x.neighborhood is null
  );;
