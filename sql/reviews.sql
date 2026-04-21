-- ============================================================================
-- Yorumlar tablosu
-- Supabase Dashboard > SQL Editor'da çalıştırın
-- ============================================================================

CREATE TABLE IF NOT EXISTS reviews (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  admin_reply TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

-- Public okuma: sadece onaylananlar
CREATE POLICY "public_read_reviews" ON reviews
  FOR SELECT USING (status = 'approved');

-- Admin tam erişim
CREATE POLICY "admin_all_reviews" ON reviews FOR ALL
  USING (EXISTS (SELECT 1 FROM admin_allowlist WHERE user_id = auth.uid()));

-- Kullanıcı kendi yorumunu ekleyebilir
CREATE POLICY "user_insert_review" ON reviews
  FOR INSERT WITH CHECK (auth.uid() = user_id);
