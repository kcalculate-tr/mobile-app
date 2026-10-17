-- ─────────────────────────────────────────────────────────────────────────────
-- YORUMLAR BOSS PANELDE HİÇ GÖRÜNMÜYORDU — üç ayrı sebep, üçü de burada.
--
-- 26.09.2026 tespiti: 8 yorum var (2'si yazılı, ortalama 5/5) ama panel boş.
--
-- 1) admin_reply kolonu YOK. BossReviews.jsx onu select ediyor ve update
--    ediyor; PostgREST "column does not exist" ile 400 dönüyor, liste hiç
--    yüklenmiyor. Kolon ekleniyor.
--
-- 2) RLS admini dışarıda bırakıyordu. reviews_read_approved_or_owner:
--    "is_approved = true OR auth.uid() = user_id". Admin için politika yok;
--    8 yorumun tamamı onaysız olduğu için panel kolon düzelse bile SIFIR
--    satır görecekti.
--
-- 3) UPDATE politikası da yalnız sahibine açıktı — "Onayla" butonu RLS'e
--    takılırdı. Yani yorumlar onaylanamıyor, onaylanmadığı için de
--    müşteriye hiç görünmüyordu. Kısır döngü.
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.reviews add column if not exists admin_reply text;

-- Politika içinden admin_allowlist okunacak; o tablonun kendi RLS'i araya
-- girmesin diye SECURITY DEFINER bir yardımcı kullanılıyor.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select exists (
    select 1 from public.admin_allowlist a
    where a.user_id = auth.uid()
       or (a.email is not null and a.email = (auth.jwt() ->> 'email'))
  );
$$;

revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

drop policy if exists reviews_admin_read on public.reviews;
create policy reviews_admin_read on public.reviews
  for select to authenticated
  using (public.is_admin());

drop policy if exists reviews_admin_update on public.reviews;
create policy reviews_admin_update on public.reviews
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists review_item_feedback_admin_read on public.review_item_feedback;
create policy review_item_feedback_admin_read on public.review_item_feedback
  for select to authenticated
  using (public.is_admin());;
