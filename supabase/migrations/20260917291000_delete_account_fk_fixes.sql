-- Hesap silme (App Store 5.1.1(v)) auth.admin.deleteUser() ile yapılacak.
-- auth.users'a NO ACTION ile bağlı 2 tablo bu çağrıyı FK ihlaliyle
-- durdurabiliyordu (kullanıcının analytics event'i veya Boss/branch panelden
-- yaptığı bir manuel şube değişikliği varsa). Bu iki kayıt kullanıcı kimliğini
-- taşımak için değil, denetim/analitik amaçlı — kullanıcı silinince referans
-- NULL'a düşer, satırların kendisi (ve dolayısı ile geçmiş) kalır.
alter table public.analytics_events
  drop constraint analytics_events_user_id_fkey,
  add constraint analytics_events_user_id_fkey
    foreign key (user_id) references auth.users(id) on delete set null;

alter table public.branch_assignment_log
  drop constraint branch_assignment_log_changed_by_fkey,
  add constraint branch_assignment_log_changed_by_fkey
    foreign key (changed_by) references auth.users(id) on delete set null;
