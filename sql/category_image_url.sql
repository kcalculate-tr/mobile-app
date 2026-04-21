-- ============================================================================
-- categories tablosuna image_url kolonu ekleme
-- Çalıştır: Supabase Dashboard > SQL Editor
-- ============================================================================

-- 1) Kolonu ekle (zaten varsa atla)
ALTER TABLE public.categories
  ADD COLUMN IF NOT EXISTS image_url TEXT;

-- 2) Supabase Storage: 'images' bucket içinde 'categories/' klasörü kullanılıyor.
--    Alternatif olarak ayrı bir bucket isterseniz:
--
--    INSERT INTO storage.buckets (id, name, public)
--    VALUES ('category-images', 'category-images', true)
--    ON CONFLICT (id) DO NOTHING;
--
--    Ardından Storage > Policies bölümünden public okuma + admin yazma policy'si ekleyin.

-- 3) RLS policy (yazma için admin kontrolü) — opsiyonel, mevcut categories policy'si yeterliyse atlayın
-- Örnek:
-- CREATE POLICY categories_update_image_admin ON public.categories
--   FOR UPDATE
--   USING (EXISTS (SELECT 1 FROM public.admin_allowlist WHERE user_id = auth.uid()))
--   WITH CHECK (EXISTS (SELECT 1 FROM public.admin_allowlist WHERE user_id = auth.uid()));
