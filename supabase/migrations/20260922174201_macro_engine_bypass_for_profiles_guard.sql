-- profiles_guard_protected_cols, macro_balance/macro_points gibi alanları
-- admin olmayan authenticated oturumlara kapatıyor. Doğru davranış; ancak
-- siparişi "delivered" yapan kişi çoğunlukla ŞUBE kullanıcısı (authenticated,
-- admin_allowlist'te değil). Bu durumda grant_macros_on_delivery trigger'ı
-- profili güncellemeye çalışınca guard hata fırlatır ve SİPARİŞİN DURUM
-- GÜNCELLEMESİ DE GERİ ALINIR.
--
-- Çözüm: macro motoru, profili güncellemeden hemen önce işlem-yerel (local)
-- bir bayrak kuruyor; guard yalnızca bu bayrak varken geçiş veriyor. Bayrak
-- transaction sonunda otomatik düşer, istemciden set edilemez (SECURITY
-- DEFINER fonksiyonun içinde kuruluyor).
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
  -- Macro motoru (grant_macros_on_delivery) tarafından kurulan işlem-yerel
  -- bayrak. Yalnızca o fonksiyonun içinden set edilir.
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
$function$;;
