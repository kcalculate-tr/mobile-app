-- profiles: onboarding RegisterAddress upsert'i first_name/last_name'e yaziyor
alter table profiles
  add column if not exists first_name text,
  add column if not exists last_name  text;

-- Mevcut kullanicilar icin tek isim kolonu varsa backfill (name veya full_name)
do $$
begin
  if exists (select 1 from information_schema.columns
    where table_schema='public' and table_name='profiles' and column_name='name') then
    execute $bf$ update profiles
      set first_name = trim(split_part(coalesce(name,''),' ',1)),
          last_name  = trim(substring(coalesce(name,'') from position(' ' in coalesce(name,' '))+1))
      where first_name is null $bf$;
  elsif exists (select 1 from information_schema.columns
    where table_schema='public' and table_name='profiles' and column_name='full_name') then
    execute $bf$ update profiles
      set first_name = trim(split_part(coalesce(full_name,''),' ',1)),
          last_name  = trim(substring(coalesce(full_name,'') from position(' ' in coalesce(full_name,' '))+1))
      where first_name is null $bf$;
  end if;
end $$;

-- PostgREST schema cache reload (Dashboard > Settings > API > Reload ile esdeger)
notify pgrst, 'reload schema';
