-- Düzeltme 2: trg_orders_assign_branch_update HER update'te koşulsuz
-- NEW.branch_id'yi yeniden hesaplıyordu — bu, Boss panelden yapılacak manuel
-- "şube değiştir" işlemini (district/neighbourhood değişmediği halde branch_id
-- elle seçiliyor) SESSİZCE geri alırdı. Görev sadece "INSERT'te ve ADRES
-- DEĞİŞİKLİĞİNDE" otomatik atama istiyordu — kapsam artık buna uygun.
--
-- İstemci (müşteri) tarafından district/neighbourhood değişmeden branch_id'yi
-- değiştirme girişimi hâlâ orders_guard_protected_cols tarafından reddedilir
-- (NEW.branch_id, fn_resolve_branch_for_order'ın ürettiği değere uymuyorsa) —
-- bu korumada değişiklik YOK, sadece otomatik-YENİDEN-HESAPLAMA'nın kapsamı
-- daraltıldı.
drop trigger if exists trg_orders_assign_branch_update on public.orders;
create trigger trg_orders_assign_branch_update
  before update on public.orders
  for each row
  when (
    NEW.district is distinct from OLD.district
    or NEW.neighbourhood is distinct from OLD.neighbourhood
  )
  execute function public.fn_assign_order_branch();
