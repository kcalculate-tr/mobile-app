ALTER TABLE products ADD COLUMN is_crosssell boolean DEFAULT false;
CREATE INDEX idx_products_crosssell ON products(is_crosssell) WHERE is_crosssell = true;
