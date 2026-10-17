-- Apple ile girişte ad/soyad profiles'a hiç geçmiyordu.
--
-- Sebep: signInWithIdToken auth.users'a INSERT atıyor ama Apple'ın kimlik
-- token'ı AD TAŞIMIYOR — o anda raw_user_meta_data boş. handle_new_user
-- yalnız AFTER INSERT olduğu için profiles.full_name null yazılıyor.
-- Uygulama hemen ardından updateUser({full_name}) çağırıyor; bu bir UPDATE,
-- tetikleyici tekrar çalışmıyor ve ad auth.users'da kalıyor.
--
-- Bu fonksiyon SADECE BOŞ ALANLARI doldurur. Kullanıcının uygulamada kendi
-- yazdığı adı asla ezmez — handle_new_user'daki coalesce(excluded.x, p.x)
-- kalıbı burada kullanılamazdı, çünkü o metadata'yı öncelikli sayıp
-- kullanıcının düzenlemesini geri alırdı.
create or replace function public.sync_profile_from_user_metadata()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  update public.profiles p
     set full_name = coalesce(nullif(p.full_name, ''), nullif(new.raw_user_meta_data->>'full_name', '')),
         phone     = coalesce(nullif(p.phone, ''),     nullif(new.raw_user_meta_data->>'phone', '')),
         email     = coalesce(nullif(p.email, ''),     nullif(new.email, ''))
   where p.id = new.id
     and (nullif(p.full_name, '') is null
       or nullif(p.phone, '') is null
       or nullif(p.email, '') is null);
  return new;
end;
$$;

drop trigger if exists on_auth_user_metadata_updated on auth.users;

create trigger on_auth_user_metadata_updated
after update of raw_user_meta_data on auth.users
for each row
when (old.raw_user_meta_data is distinct from new.raw_user_meta_data)
execute function public.sync_profile_from_user_metadata();;
