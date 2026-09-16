-- Güvenlik raporu bulguları — onaylanan düzeltmeler.
--
-- 1) profiles_update_all: USING(true) WITH CHECK(true), roles={public} —
--    test edildi, kullanıcı A kullanıcı B'nin profilini (role dahil)
--    değiştirebiliyordu. Satır bazlı kendi profiliyle sınırlandırıldı.
--    (Not: sütun bazlı bir kısıt eklenmedi — role/macro_balance gibi alanlar
--    hâlâ sahibi tarafından değiştirilebilir; bu ayrı bir takip konusu.)
--
-- 2) trg_orders_guard_protected_cols (repo'da migration'ı yoktu, canlıda
--    untracked var — bu dosya onu repo'ya kazandırıyor + kapsamını
--    genişletiyor): status/payment_status/total_amount/discount_amount/
--    adisyo_* zaten korunuyordu; subtotal_amount, delivery_fee,
--    macro_discount_amount, coupon_code, items test edildi ve serbestçe
--    değiştirilebildiği görüldü — bunlar da korunan alanlara eklendi.

drop policy if exists "profiles_update_all" on public.profiles;

create policy "profiles_update_own" on public.profiles
  for update
  using (id = auth.uid())
  with check (id = auth.uid());

create or replace function public.orders_guard_protected_cols()
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
  -- Sunucu (service_role) veya istek-bağlamı yoksa (internal) -> serbest
  if v_role is null or v_role = 'service_role' then
    return NEW;
  end if;

  -- Admin / şube kullanıcısı -> serbest (boss panel sipariş durumunu yönetir)
  v_priv := exists (select 1 from admin_allowlist a where a.user_id = auth.uid())
         or exists (select 1 from branch_users b where b.user_id = auth.uid());
  if v_priv then
    return NEW;
  end if;

  -- Buradan sonrası: normal MÜŞTERİ. Korunan geçişleri reddet.
  if NEW.payment_status = 'paid' and OLD.payment_status is distinct from 'paid' then
    raise exception 'orders_guard: payment_status=paid yalnızca sunucudan set edilebilir';
  end if;

  if NEW.status in ('confirmed','preparing','on_way','delivered')
     and OLD.status is distinct from NEW.status then
    raise exception 'orders_guard: "%" durumu yalnızca sunucudan/yönetimden set edilebilir', NEW.status;
  end if;

  if NEW.total_amount is distinct from OLD.total_amount
     or NEW.discount_amount is distinct from OLD.discount_amount
     or NEW.subtotal_amount is distinct from OLD.subtotal_amount
     or NEW.delivery_fee is distinct from OLD.delivery_fee
     or NEW.macro_discount_amount is distinct from OLD.macro_discount_amount then
    raise exception 'orders_guard: tutar alanları müşteri tarafından değiştirilemez';
  end if;

  if NEW.coupon_code is distinct from OLD.coupon_code
     or NEW.coupon_id is distinct from OLD.coupon_id then
    raise exception 'orders_guard: kupon alanları müşteri tarafından değiştirilemez';
  end if;

  if NEW.items is distinct from OLD.items then
    raise exception 'orders_guard: sipariş içeriği (items) müşteri tarafından değiştirilemez';
  end if;

  if NEW.adisyo_order_id is distinct from OLD.adisyo_order_id
     or NEW.adisyo_sync_status is distinct from OLD.adisyo_sync_status then
    raise exception 'orders_guard: adisyo alanları müşteri tarafından değiştirilemez';
  end if;

  return NEW;
end;
$$;

drop trigger if exists trg_orders_guard_protected_cols on public.orders;

create trigger trg_orders_guard_protected_cols
  before update on public.orders
  for each row
  execute function public.orders_guard_protected_cols();
