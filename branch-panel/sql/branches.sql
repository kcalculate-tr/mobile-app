-- ============================================================================
-- Şubeler Migration (Güvenli — branches tablosu zaten var)
-- Supabase Dashboard > SQL Editor'da çalıştırın
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1) branches — eksik kolonları ekle (var olanları atlar)
-- ---------------------------------------------------------------------------
ALTER TABLE public.branches
  ADD COLUMN IF NOT EXISTS slug      TEXT,
  ADD COLUMN IF NOT EXISTS phone     TEXT,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- slug için unique index
CREATE UNIQUE INDEX IF NOT EXISTS branches_slug_key ON public.branches (slug);

-- ---------------------------------------------------------------------------
-- 2) branch_users — yeni tablo
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.branch_users (
  id        UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id   UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES public.branches(id) ON DELETE CASCADE,
  role      TEXT DEFAULT 'staff' CHECK (role IN ('manager', 'staff', 'kitchen')),
  UNIQUE (user_id, branch_id)
);

-- ---------------------------------------------------------------------------
-- 3) branch_stock — yeni tablo
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.branch_stock (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  branch_id    UUID REFERENCES public.branches(id) ON DELETE CASCADE,
  product_id   BIGINT REFERENCES public.products(id) ON DELETE CASCADE,
  is_available BOOLEAN DEFAULT true,
  UNIQUE (branch_id, product_id)
);

-- ---------------------------------------------------------------------------
-- 4) RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.branch_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.branch_stock ENABLE ROW LEVEL SECURITY;

-- branch_users: kullanıcı kendi kaydını görebilir
CREATE POLICY "branch_users_own" ON public.branch_users
  FOR SELECT USING (auth.uid() = user_id);

-- branch_stock: şube kullanıcısı okuyabilir
CREATE POLICY "branch_stock_read" ON public.branch_stock
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.branch_users
      WHERE branch_users.branch_id = branch_stock.branch_id
        AND branch_users.user_id = auth.uid()
    )
  );

-- branch_stock: şube kullanıcısı güncelleyebilir
CREATE POLICY "branch_stock_update" ON public.branch_stock
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.branch_users
      WHERE branch_users.branch_id = branch_stock.branch_id
        AND branch_users.user_id = auth.uid()
    )
  );

-- Admin tam erişim
CREATE POLICY "admin_all_branch_users" ON public.branch_users FOR ALL
  USING (EXISTS (SELECT 1 FROM public.admin_allowlist WHERE user_id = auth.uid()));

CREATE POLICY "admin_all_branch_stock" ON public.branch_stock FOR ALL
  USING (EXISTS (SELECT 1 FROM public.admin_allowlist WHERE user_id = auth.uid()));
