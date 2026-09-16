-- profiles_update_own (20260916150000) satırı kendi id'sine sınırlandırdı
-- ama HANGİ SÜTUNLARIN değişebileceğine dair kısıt yoktu — kullanıcı kendi
-- role/macro_balance/macro_points/privileged_until/total_macros_purchased/
-- branch_id alanlarını serbestçe değiştirebilir (rol yükseltme, macro
-- bakiyesi sahteciliği). Taradım: bu alanlara client'tan meşru bir yazma
-- yolu yok — src/lib/macros.ts'teki completeMacroPurchase/processOrderMacroEarn
-- fonksiyonları tanımlı ama hiçbir yerden çağrılmıyor (dead code).
-- orders_guard_protected_cols ile aynı desen: service_role/admin -> serbest,
-- normal kullanıcı -> korunan alanlar reddedilir.
create or replace function public.profiles_guard_protected_cols()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_claims text := current_setting('request.jwt.claims', true);
  v_role   text := case when v_claims is null or v_claims = '' then null
                        else (v_claims::jsonb ->> 'role') end;
  v_priv   boolean;
begin
  if v_role is null or v_role = 'service_role' then
    return NEW;
  end if;

  v_priv := exists (select 1 from admin_allowlist a where a.user_id = auth.uid());
  if v_priv then
    return NEW;
  end if;

  if NEW.role is distinct from OLD.role
     or NEW.macro_balance is distinct from OLD.macro_balance
     or NEW.macro_points is distinct from OLD.macro_points
     or NEW.privileged_until is distinct from OLD.privileged_until
     or NEW.total_macros_purchased is distinct from OLD.total_macros_purchased
     or NEW.branch_id is distinct from OLD.branch_id then
    raise exception 'profiles_guard: bu alanlar yalnızca sunucudan/yönetimden değiştirilebilir';
  end if;

  return NEW;
end;
$$;

drop trigger if exists trg_profiles_guard_protected_cols on public.profiles;

create trigger trg_profiles_guard_protected_cols
  before update on public.profiles
  for each row
  execute function public.profiles_guard_protected_cols();
