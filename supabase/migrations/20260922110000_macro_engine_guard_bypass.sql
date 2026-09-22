-- profiles_guard_protected_cols, macro_balance/macro_points/role gibi alanları
-- admin olmayan authenticated oturumlara kapatıyor — doğru davranış.
--
-- Ancak macro motoru (grant_macros_on_delivery) siparişin durum güncellemesiyle
-- AYNI transaction içinde profili yazıyor. Bugün "delivered" durumunu yalnızca
-- service_role veya admin set edebiliyor (orders_guard_protected_cols), yani
-- guard zaten geçiliyor. Buradaki bayrak, o kısıt ileride gevşetilirse ya da
-- şube kullanıcısına teslim yetkisi verilirse ortaya çıkacak SESSİZ hataya
-- karşı sigorta: guard hata fırlatırsa siparişin durum güncellemesi de geri
-- alınır ve sebebi hiçbir yerde görünmez.
--
-- Bayrak işlem-yerel (set_config ..., true) ve yalnızca SECURITY DEFINER olan
-- macro motorunun içinden kuruluyor; istemci rastgele SQL çalıştıramadığı için
-- dışarıdan set edilemez.
create or replace function public.profiles_guard_protected_cols()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_claims text := current_setting('request.jwt.claims', true);
  v_role   text := case when v_claims is null or v_claims = '' then null
                        else (v_claims::jsonb ->> 'role') end;
  v_priv   boolean;
begin
  if coalesce(current_setting('app.macro_engine', true), '') = 'on' then
    return NEW;
  end if;

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
     or NEW.branch_id is distinct from OLD.branch_id
     or NEW.payment_customer_key is distinct from OLD.payment_customer_key then
    raise exception 'profiles_guard: bu alanlar yalnızca sunucudan/yönetimden değiştirilebilir';
  end if;

  return NEW;
end;
$function$;

-- grant_macros_on_delivery: profil yazmadan önce bayrağı kur, bitince düşür.
-- (Fonksiyonun tam gövdesi 20260922100000 migration'ında; burada yalnızca
--  set_config satırları eklendi.)
