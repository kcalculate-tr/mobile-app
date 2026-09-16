-- Düzeltme: fn_assign_order_branch (BEFORE INSERT/UPDATE) NEW.branch_id'yi
-- ayarlarken branch_assignment_log'a da INSERT yapıyordu — ama BEFORE INSERT
-- sırasında orders satırı henüz TABLOYA yazılmamış oluyor (sadece NEW'de var),
-- bu yüzden branch_assignment_log.order_id FK'si anında başarısız oluyordu
-- (test sırasında yakalandı — canlı sipariş hiç oluşturulamıyordu). Çözüm:
-- atama (BEFORE, sadece NEW.branch_id set eder) ve loglama (AFTER, satır artık
-- var) iki ayrı trigger'a bölündü.

create or replace function public.fn_assign_order_branch()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  NEW.branch_id := public.fn_resolve_branch_for_order(NEW.district, NEW.neighbourhood);
  return NEW;
end;
$$;

create or replace function public.fn_log_branch_assignment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if TG_OP = 'INSERT' then
    insert into public.branch_assignment_log (order_id, from_branch_id, to_branch_id, reason)
      values (NEW.id, null, NEW.branch_id, 'auto_initial');
  elsif NEW.branch_id is distinct from OLD.branch_id then
    insert into public.branch_assignment_log (order_id, from_branch_id, to_branch_id, reason)
      values (NEW.id, OLD.branch_id, NEW.branch_id, 'auto_reassign');
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_orders_log_branch_insert on public.orders;
create trigger trg_orders_log_branch_insert
  after insert on public.orders
  for each row execute function public.fn_log_branch_assignment();

drop trigger if exists trg_orders_log_branch_update on public.orders;
create trigger trg_orders_log_branch_update
  after update on public.orders
  for each row execute function public.fn_log_branch_assignment();
