-- ACİL hotfix: 20260916150000'de profiles_update_all -> profiles_update_own
-- daraltmasının regresyonu. admin-panel/src/pages/admin/BossMacro.jsx
-- (adjustMacro + ManualMacroForm.save) boss panelden BAŞKA bir kullanıcının
-- macro_balance/privileged_until'ını günceller — admin panel service_role
-- değil, admin'in kendi JWT'siyle (anon/publishable key) çalışıyor, yani
-- RLS'e tabi. profiles_update_own bunu 0 satıra düşürüyordu (canlıda test
-- ederek doğruladım). admin_allowlist üyeleri için ayrı bir UPDATE politikası
-- eklendi (orders_update_admin_branch'teki admin bypass pattern'iyle aynı).
--
-- Test edildi: admin -> başka kullanıcının profili güncellenebiliyor;
-- normal kullanıcı -> hâlâ başkasının profilini değiştiremiyor (0 satır).
create policy "profiles_update_admin" on public.profiles
  for update
  using (exists (select 1 from admin_allowlist a where a.user_id = auth.uid()))
  with check (exists (select 1 from admin_allowlist a where a.user_id = auth.uid()));
