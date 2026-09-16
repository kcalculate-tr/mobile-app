-- Düzeltme 3: fn_log_branch_assignment, HER branch_id değişikliğini
-- 'auto_reassign' olarak logluyordu — Boss panelden manuel "şube değiştir"
-- (district/neighbourhood DEĞİŞMEDEN branch_id elle seçilir) de bu genel
-- etikete karışıyordu. Artık district/neighbourhood da değiştiyse
-- 'auto_reassign', değişmediyse 'manual' olarak ayrıştırılır — bu, tetikleyen
-- SQL statement'ından çıkarılabilen tek güvenilir ayrım (Boss panelin ayrıca
-- kendi INSERT'ini yapmasına gerek YOK, tekilleştirme burada). changed_by da
-- artık auth.uid() ile kaydediliyor (Boss panel oturumunda admin'in id'si).
create or replace function public.fn_log_branch_assignment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if TG_OP = 'INSERT' then
    insert into public.branch_assignment_log (order_id, from_branch_id, to_branch_id, reason, changed_by)
      values (NEW.id, null, NEW.branch_id, 'auto_initial', auth.uid());
  elsif NEW.branch_id is distinct from OLD.branch_id then
    insert into public.branch_assignment_log (order_id, from_branch_id, to_branch_id, reason, changed_by)
      values (
        NEW.id, OLD.branch_id, NEW.branch_id,
        case
          when NEW.district is distinct from OLD.district
            or NEW.neighbourhood is distinct from OLD.neighbourhood
          then 'auto_reassign'
          else 'manual'
        end,
        auth.uid()
      );
  end if;
  return NEW;
end;
$$;
