-- Şube hizmet bölgeleri — ilk eşleme.
--
-- branch_service_areas tablosu ve fn_resolve_branch_for_order() zaten vardı ama
-- tablo BOŞTU; bu yüzden her sipariş varsayılan şubeye (Basın Sitesi) düşüyordu.
--
-- Çözücü mantığı (değiştirilmedi): mahalle satırı ilçe satırını EZER, sonra
-- priority, sonra created_at. Eşleşme yoksa varsayılan şube.
-- Halkapınar bu yüzden Konak'ta kalırken Bayraklı şubeye gidebiliyor.
--
-- KADEMELİ AÇILIŞ: Bayraklı şube satırları is_active = false olarak giriyor.
-- Çözücü yalnızca is_active satırlara bakar, yani BUGÜN HİÇBİR ŞEY DEĞİŞMİYOR
-- (Basın Sitesi satırları zaten varsayılan davranışın aynısı). Şube hazır
-- olduğunda tek bir UPDATE ile açılır.

insert into public.branch_service_areas (branch_id, city, district, neighborhood, priority, is_active)
select b.id, 'İzmir', x.district, x.neighborhood, x.priority, x.is_active
from (values
  -- Basın Sitesi (varsayılan şube) — bugünkü davranışın aynısı, hemen aktif
  ('basinsitesi', 'Konak',      null::text, 0, true),
  ('basinsitesi', 'Karabağlar', null,       0, true),
  ('basinsitesi', 'Balçova',    null,       0, true),
  ('basinsitesi', 'Narlıdere',  null,       0, true),
  -- Bayraklı (Mansuroğlu) — şube hazır olunca açılacak
  ('mansuroglu',  'Bayraklı',   null,       0, false),
  ('mansuroglu',  'Bornova',    null,       0, false),
  -- Halkapınar: ilçesi Konak ama şubesi Bayraklı. Mahalle satırı ilçe satırını ezer.
  ('mansuroglu',  'Konak',      'Halkapınar', 10, false)
) as x(slug, district, neighborhood, priority, is_active)
join public.branches b on b.slug = x.slug
where not exists (
  select 1 from public.branch_service_areas s
   where s.branch_id = b.id
     and lower(trim(s.district)) = lower(x.district)
     and s.neighborhood is not distinct from x.neighborhood
);;
