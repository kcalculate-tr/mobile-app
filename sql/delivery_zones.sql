-- ============================================================================
-- Teslimat bölgeleri
-- Supabase Dashboard > SQL Editor'da çalıştırın
-- ============================================================================

CREATE TABLE IF NOT EXISTS delivery_zones (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  postal_codes TEXT[] DEFAULT '{}',
  min_order_amount DECIMAL(10,2) DEFAULT 0,
  delivery_fee DECIMAL(10,2) DEFAULT 0,
  estimated_minutes INTEGER DEFAULT 45,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE delivery_zones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public_read_zones" ON delivery_zones FOR SELECT USING (true);

CREATE POLICY "admin_all_zones" ON delivery_zones FOR ALL
  USING (EXISTS (SELECT 1 FROM admin_allowlist WHERE user_id = auth.uid()));
