-- KRİTİK PII sızıntısı: "Profiles are viewable by everyone" (USING true,
-- roles=public) — test ettim, anon key (oturumsuz) ile TÜM kullanıcıların
-- phone/full_name/email'i okunabiliyordu (tam profiles tablosu dump'ı).
--
-- Tarama sonucu: mobile app (src/) profiles'ı yalnızca kendi user.id'siyle
-- okuyor, hiçbir ekran başka kullanıcının profilini göstermiyor — daraltma
-- mobile'ı kırmaz. admin-panel (BossMacro üye listesi, BossSupport push
-- token, BossDashboard sayaç, PushTestPanel hedef listesi, useCustomer360)
-- başka kullanıcıların profillerini okuyor ama bu sayfalar zaten yalnızca
-- admin_allowlist üyelerine açık (AdminRouteGuard) — bugünkü UPDATE
-- regresyonundan (20260916160000) ders alınarak SELECT politikasına da
-- admin_allowlist bypass'ı baştan eklendi.
drop policy if exists "Profiles are viewable by everyone" on public.profiles;

create policy "profiles_select_own_or_admin" on public.profiles
  for select
  using (
    id = auth.uid()
    or exists (select 1 from admin_allowlist a where a.user_id = auth.uid())
    or exists (select 1 from branch_users b where b.user_id = auth.uid())
  );
