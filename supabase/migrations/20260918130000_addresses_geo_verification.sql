-- FAZ L: checkout'ta adres doğrulama için koordinat + doğrulama zaman damgası.
-- verified_at: kullanıcı haritada pin'i onaylayınca set edilir; adres
-- güncellenince (aşağıdaki trigger) otomatik null'a döner — tekrar doğrulama
-- gerekir. latitude/longitude olmadan doğrulama akışı çalışamaz.
alter table public.addresses
  add column if not exists latitude numeric,
  add column if not exists longitude numeric,
  add column if not exists verified_at timestamptz;

-- Adresin konumla ilgili alanlarından biri değişirse doğrulama düşer —
-- kullanıcı pin'i tekrar onaylamadan eski "doğrulanmış" durumu miras almasın.
create or replace function public.fn_addresses_reset_verification()
returns trigger
language plpgsql
as $$
begin
  if (new.full_address is distinct from old.full_address)
     or (new.district is distinct from old.district)
     or (new.neighbourhood is distinct from old.neighbourhood)
     or (new.street is distinct from old.street)
     or (new.building_no is distinct from old.building_no)
     or (new.latitude is distinct from old.latitude)
     or (new.longitude is distinct from old.longitude)
  then
    new.verified_at := null;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_addresses_reset_verification on public.addresses;
create trigger trg_addresses_reset_verification
  before update on public.addresses
  for each row
  execute function public.fn_addresses_reset_verification();

notify pgrst, 'reload schema';
