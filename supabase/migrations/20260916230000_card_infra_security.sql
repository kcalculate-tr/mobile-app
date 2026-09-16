-- Sprint 2 / Görev 2.0: Kart altyapısını güvenli hale getir (özellik inşa
-- edilmeden önce). user_cards hâlâ 0 satır — veri kaybı riski yok.
--
-- 1) user_card_secrets: token'lar buraya taşınıyor, RLS açık + POLİTİKA YOK
--    (failed_payments ile aynı desen) — yalnızca service_role erişir.
create table public.user_card_secrets (
  card_id    uuid primary key references public.user_cards(id) on delete cascade,
  card_token text not null,
  updated_at timestamptz not null default now()
);
alter table public.user_card_secrets enable row level security;

-- 2) user_cards: card_token kaldırılıyor (tablo boş, veri taşınacak bir şey yok).
alter table public.user_cards drop column if exists card_token;

-- 3) user_cards RLS: istemci artık yalnızca KENDİ satırını okuyabilir.
--    Tüm yazma (insert/update/delete) Edge Function'a (service_role) taşınıyor.
drop policy if exists "cards_insert_own" on public.user_cards;
drop policy if exists "cards_update_own" on public.user_cards;
drop policy if exists "cards_delete_own" on public.user_cards;
-- cards_select_own (SELECT, user_id = auth.uid()) korunuyor.

-- 4) profiles.payment_customer_key: 11 haneli rastgele SAYISAL, benzersiz,
--    kullanıcı başına bir kez üretilir, bir daha değişmez.
alter table public.profiles
  add column if not exists payment_customer_key text;

create unique index if not exists profiles_payment_customer_key_uniq
  on public.profiles (payment_customer_key)
  where payment_customer_key is not null;

create or replace function public.generate_payment_customer_key()
returns text
language plpgsql
as $$
declare
  v_key text;
begin
  loop
    v_key := lpad(floor(random() * 100000000000)::bigint::text, 11, '0');
    exit when not exists (
      select 1 from public.profiles where payment_customer_key = v_key
    );
  end loop;
  return v_key;
end;
$$;

-- handle_new_user: yeni kullanıcıda üret; ON CONFLICT UPDATE'e KASITLI OLARAK
-- eklenmedi — böylece mevcut satırların key'i asla ezilmez (immutable).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
as $$
begin
  insert into public.profiles (id, full_name, phone, email, role, created_at, payment_customer_key)
  values (
    new.id,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'phone',
    new.email,
    'customer',
    now(),
    public.generate_payment_customer_key()
  )
  on conflict (id) do update set
    full_name = coalesce(excluded.full_name, profiles.full_name),
    phone     = coalesce(excluded.phone, profiles.phone),
    email     = coalesce(excluded.email, profiles.email);
  return new;
end;
$$;

-- Mevcut kullanıcılar için doldur (her satır generate_payment_customer_key()'i
-- ayrı ayrı çağırır -> her biri farklı bir değer alır).
update public.profiles
set payment_customer_key = public.generate_payment_customer_key()
where payment_customer_key is null;

-- 5) profiles guard: payment_customer_key de artık yalnızca sunucu/admin
-- tarafından değiştirilebilsin (kullanıcı kendi anahtarını değiştiremesin).
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
     or NEW.branch_id is distinct from OLD.branch_id
     or NEW.payment_customer_key is distinct from OLD.payment_customer_key then
    raise exception 'profiles_guard: bu alanlar yalnızca sunucudan/yönetimden değiştirilebilir';
  end if;

  return NEW;
end;
$$;
