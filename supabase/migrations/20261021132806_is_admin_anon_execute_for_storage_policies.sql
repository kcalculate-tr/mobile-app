-- Recovered from live DB history (supabase_migrations.schema_migrations) on 2026-11-02
-- version: 20261021132806  name: is_admin_anon_execute_for_storage_policies
-- Storage yazma politikalari public.is_admin() cagiriyor; anon bu fonksiyonu
-- calistiramadigi icin yazma denemeleri temiz bir RLS reddi yerine
-- "permission denied for function is_admin" hatasi veriyordu. Sonuc yine
-- engellemeydi ama hata yaniltici. is_admin() anon icin her zaman false
-- dondurur (admin_allowlist'te auth.uid() veya jwt e-postasi aranir) ve
-- hicbir veri sizdirmaz, bu yuzden execute yetkisi verilebilir.
grant execute on function public.is_admin() to anon;
