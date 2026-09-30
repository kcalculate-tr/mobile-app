-- Şube hizmet bölgeleri — ilk eşleme.
--
-- branch_service_areas tablosu ve fn_resolve_branch_for_order() zaten vardı ama
-- tablo BOŞTU; bu yüzden orders üzerindeki trg_orders_assign_branch_insert her
-- siparişi varsayılan şubeye (Basın Sitesi) yazıyordu. src/lib/orders.ts'teki
-- "sunucu district/neighbourhood'a göre atar" yorumu doğruydu ama atayacak
-- veri yoktu.
--
-- Çözücü mantığı (DEĞİŞTİRİLMEDİ): mahalle satırı ilçe satırını EZER, sonra
-- priority, sonra created_at. Eşleşme yoksa varsayılan şube.
-- Halkapınar bu yüzden ilçe olarak Konak'ta kalırken Bayraklı şubeye gidebiliyor.
--
-- KADEMELİ AÇILIŞ: Bayraklı şube satırları is_active = false giriyor. Çözücü
-- yalnızca is_active satırlara baktığı için bu migration BUGÜN HİÇBİR ŞEYİ
-- DEĞİŞTİRMEZ (Basın Sitesi satırları zaten varsayılan davranışın aynısı).
-- Şube hazır olduğunda:
--   update branch_service_areas set is_active = true
--    where branch_id = (select id from branches where slug = 'mansuroglu');

insert into public.branch_service_areas (branch_id, city, district, neighborhood, priority, is_active)
select b.id, 'İzmir', x.district, x.neighborhood, x.priority, x.is_active
from (values
  ('basinsitesi', 'Konak',      null::text,   0,  true),
  ('basinsitesi', 'Karabağlar', null,         0,  true),
  ('basinsitesi', 'Balçova',    null,         0,  true),
  ('basinsitesi', 'Narlıdere',  null,         0,  true),
  ('mansuroglu',  'Bayraklı',   null,         0,  false),
  ('mansuroglu',  'Bornova',    null,         0,  false),
  ('mansuroglu',  'Konak',      'Halkapınar', 10, false)
) as x(slug, district, neighborhood, priority, is_active)
join public.branches b on b.slug = x.slug
where not exists (
  select 1 from public.branch_service_areas s
   where s.branch_id = b.id
     and lower(trim(s.district)) = lower(x.district)
     and s.neighborhood is not distinct from x.neighborhood
);
