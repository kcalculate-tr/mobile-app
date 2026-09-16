-- KVKK: 20260916180000'de eklenen profiles_select_own_or_admin, branch_users
-- üyelerine TÜM profilleri (her şubeden tüm müşterilerin phone/email/full_name'i)
-- açıyordu — orders'daki admin/branch bypass pattern'i kopyalanırken branch
-- tarafı kapsamsız bırakılmıştı. Şube personeli yalnızca KENDİ şubesine
-- sipariş vermiş müşterilerin profilini görebilmeli.
drop policy if exists "profiles_select_own_or_admin" on public.profiles;

create policy "profiles_select_own_or_admin" on public.profiles
  for select
  using (
    id = auth.uid()
    or exists (select 1 from admin_allowlist a where a.user_id = auth.uid())
    or exists (
      select 1 from branch_users bu
      join orders o on o.branch_id = bu.branch_id
      where bu.user_id = auth.uid() and o.user_id = profiles.id
    )
  );
