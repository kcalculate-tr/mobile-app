-- ============================================================================
-- Vitrin tabloları: banners, campaigns, popups
-- Supabase Dashboard > SQL Editor'da çalıştırın
-- ============================================================================

CREATE TABLE IF NOT EXISTS banners (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  image_url TEXT,
  link_url TEXT,
  order_index INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS campaigns (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  discount_percent DECIMAL(5,2),
  min_order_amount DECIMAL(10,2),
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS popups (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT,
  image_url TEXT,
  button_text TEXT,
  button_url TEXT,
  show_frequency TEXT DEFAULT 'every_visit',
  is_active BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE banners ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE popups ENABLE ROW LEVEL SECURITY;

-- Public read policies
CREATE POLICY "public_read_banners" ON banners FOR SELECT USING (true);
CREATE POLICY "public_read_campaigns" ON campaigns FOR SELECT USING (true);
CREATE POLICY "public_read_popups" ON popups FOR SELECT USING (true);

-- Admin write policies
CREATE POLICY "admin_all_banners" ON banners FOR ALL
  USING (EXISTS (SELECT 1 FROM admin_allowlist WHERE user_id = auth.uid()));
CREATE POLICY "admin_all_campaigns" ON campaigns FOR ALL
  USING (EXISTS (SELECT 1 FROM admin_allowlist WHERE user_id = auth.uid()));
CREATE POLICY "admin_all_popups" ON popups FOR ALL
  USING (EXISTS (SELECT 1 FROM admin_allowlist WHERE user_id = auth.uid()));
