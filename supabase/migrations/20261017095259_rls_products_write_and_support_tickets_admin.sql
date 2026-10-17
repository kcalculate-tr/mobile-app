-- ── 1) products: yazma yetkisi herkese açıktı ───────────────────────────
-- Politikalar INSERT/UPDATE/DELETE'i `public` rolüne `true` koşuluyla
-- veriyordu. public = anon dahil. Anon anahtar mobil uygulamanın paketinde
-- gömülü olduğu için pratikte menüyü ve fiyatları isteyen herkes
-- değiştirebilir, hatta tüm ürünleri silebilirdi.
--
-- Okuma (SELECT) açık kalıyor — menü zaten herkese görünmeli.
-- Yazan tek istemci boss paneli (Admin.jsx), o da admin_allowlist'te.
-- DROP yerine ALTER: politikayı silmeden koşulu daraltıyoruz.

alter policy "Products are insertable by authenticated users"
  on public.products to authenticated with check (public.is_admin());

alter policy "Products are editable by authenticated users"
  on public.products to authenticated using (public.is_admin()) with check (public.is_admin());

alter policy "Products are deletable by authenticated users"
  on public.products to authenticated using (public.is_admin());

-- ── 2) support_tickets: admin talepleri GÖREMİYORDU ─────────────────────
-- SELECT politikalarının ikisi de `user_id = auth.uid()`. Boss paneli
-- authenticated rolle bağlandığı için yalnızca kendi taleplerini görüyordu;
-- diğer 33 talep RLS tarafından gizleniyordu. reviews tablosunda
-- reviews_admin_read var, burada karşılığı hiç yazılmamış.
create policy tickets_admin_read
  on public.support_tickets for select to authenticated
  using (public.is_admin());

-- UPDATE politikası `public` rolüne `true` veriyordu: herhangi bir kullanıcı
-- BAŞKASININ talebini değiştirebilir, admin_reply yazabilir, kapatabilirdi.
alter policy tickets_update_all
  on public.support_tickets to authenticated
  using (public.is_admin()) with check (public.is_admin());;
