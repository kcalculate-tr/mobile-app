-- ════════════════════════════════════════════════════════════════════════════
-- `true` kosullu RLS politikalarinin sikilastirilmasi
-- Hepsi canli olarak dogrulandi (rollback'li testlerle):
--   anon  -> banners UPDATE/DELETE (5 satir), brands UPDATE (3), feedback DELETE (3)
--   kullanici -> settings UPDATE (magaza saatleri/min sepet/macro fiyati),
--                product_option_* tam CRUD, order_modifications tum kayitlari
--                gorme ve onaylama (8 satir), baskasina notifications INSERT
-- Okuma politikalarina dokunulmadi: anon yalnizca reviews/campaigns/settings
-- gorebiliyor, musteri verisi sizmiyordu.
-- ════════════════════════════════════════════════════════════════════════════

-- ── banners: panel (admin) yazar, uygulama okur ────────────────────────────
alter policy "banners_public_all" on public.banners
  using (public.is_admin()) with check (public.is_admin());
create policy "banners_public_read" on public.banners
  for select to public using (true);

-- ── brands ─────────────────────────────────────────────────────────────────
alter policy "brands_public_insert" on public.brands with check (public.is_admin());
alter policy "brands_public_write"  on public.brands
  using (public.is_admin()) with check (public.is_admin());

-- ── popups: adi "Admin full access" idi ama herkese aciktı ─────────────────
alter policy "Admin full access popups" on public.popups
  using (public.is_admin()) with check (public.is_admin());

-- ── feedback: musteri kendi geri bildirimini yazar, admin yonetir ──────────
alter policy "feedback_delete_all" on public.feedback using (public.is_admin());
alter policy "feedback_update_all" on public.feedback
  using (public.is_admin()) with check (public.is_admin());

-- ── settings: uygulama SADECE okuyor (kod tarandi), yazma admin'e ──────────
alter policy "settings_write_authenticated"  on public.settings with check (public.is_admin());
alter policy "settings_update_authenticated" on public.settings
  using (public.is_admin()) with check (public.is_admin());

-- ── notifications: uygulama hic yazmiyor, yalnizca panel ───────────────────
alter policy "Authenticated insert notifications" on public.notifications
  with check (public.is_admin());
alter policy "Staff can insert notifications" on public.notifications
  with check (public.is_admin());

-- ── urun opsiyon katalogu: yalnizca admin ──────────────────────────────────
alter policy "Authenticated can insert templates" on public.product_option_templates with check (public.is_admin());
alter policy "Authenticated can update templates" on public.product_option_templates
  using (public.is_admin()) with check (public.is_admin());
alter policy "Authenticated can delete templates" on public.product_option_templates using (public.is_admin());

alter policy "Authenticated can insert template values" on public.product_option_template_values with check (public.is_admin());
alter policy "Authenticated can update template values" on public.product_option_template_values
  using (public.is_admin()) with check (public.is_admin());
alter policy "Authenticated can delete template values" on public.product_option_template_values using (public.is_admin());

alter policy "Authenticated can insert links" on public.product_option_links with check (public.is_admin());
alter policy "Anyone authenticated can update links" on public.product_option_links
  using (public.is_admin()) with check (public.is_admin());
alter policy "Anyone authenticated can delete links" on public.product_option_links using (public.is_admin());

-- ── order_modifications: musteri kendi talebini olusturur/gorur,
--    onaylama admin veya ilgili subenin kullanicisina ait ───────────────────
alter policy "Authenticated can view all modifications" on public.order_modifications
  using (
    user_id = auth.uid()
    or public.is_admin()
    or exists (select 1 from public.orders o
                join public.branch_users bu on bu.branch_id = o.branch_id
               where o.id = order_modifications.order_id and bu.user_id = auth.uid())
  );
alter policy "Staff can view all modifications" on public.order_modifications
  using (
    user_id = auth.uid()
    or public.is_admin()
    or exists (select 1 from public.orders o
                join public.branch_users bu on bu.branch_id = o.branch_id
               where o.id = order_modifications.order_id and bu.user_id = auth.uid())
  );

alter policy "Authenticated can update modifications" on public.order_modifications
  using (
    public.is_admin()
    or exists (select 1 from public.orders o
                join public.branch_users bu on bu.branch_id = o.branch_id
               where o.id = order_modifications.order_id and bu.user_id = auth.uid())
  )
  with check (
    public.is_admin()
    or exists (select 1 from public.orders o
                join public.branch_users bu on bu.branch_id = o.branch_id
               where o.id = order_modifications.order_id and bu.user_id = auth.uid())
  );
alter policy "Staff can update modifications" on public.order_modifications
  using (
    public.is_admin()
    or exists (select 1 from public.orders o
                join public.branch_users bu on bu.branch_id = o.branch_id
               where o.id = order_modifications.order_id and bu.user_id = auth.uid())
  )
  with check (
    public.is_admin()
    or exists (select 1 from public.orders o
                join public.branch_users bu on bu.branch_id = o.branch_id
               where o.id = order_modifications.order_id and bu.user_id = auth.uid())
  );;
