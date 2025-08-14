-- Product inventory schema for POS system
-- Extends the existing UPP database schema

-- Products table for inventory management
CREATE TABLE IF NOT EXISTS products (
  id VARCHAR(255) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  price DECIMAL(10,2) NOT NULL,
  cost DECIMAL(10,2) DEFAULT 0.00,
  sku VARCHAR(100) UNIQUE NOT NULL,
  category VARCHAR(100) NOT NULL,
  stock INTEGER NOT NULL DEFAULT 0,
  min_stock INTEGER DEFAULT 0,
  max_stock INTEGER DEFAULT 1000,
  barcode VARCHAR(255),
  image_url TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Product categories table
CREATE TABLE IF NOT EXISTS product_categories (
  id VARCHAR(255) PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  parent_category_id VARCHAR(255) REFERENCES product_categories(id),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Product variants table (for different sizes, colors, etc.)
CREATE TABLE IF NOT EXISTS product_variants (
  id VARCHAR(255) PRIMARY KEY,
  product_id VARCHAR(255) REFERENCES products(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  sku VARCHAR(100) UNIQUE NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  cost DECIMAL(10,2) DEFAULT 0.00,
  stock INTEGER NOT NULL DEFAULT 0,
  attributes JSONB,
  barcode VARCHAR(255),
  image_url TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Stock movements table for tracking inventory changes
CREATE TABLE IF NOT EXISTS stock_movements (
  id VARCHAR(255) PRIMARY KEY,
  product_id VARCHAR(255) REFERENCES products(id) ON DELETE CASCADE,
  variant_id VARCHAR(255) REFERENCES product_variants(id) ON DELETE CASCADE,
  movement_type VARCHAR(50) NOT NULL CHECK (movement_type IN ('sale', 'purchase', 'adjustment', 'return', 'transfer', 'damage')),
  quantity INTEGER NOT NULL,
  reference_id VARCHAR(255),
  reference_type VARCHAR(50),
  notes TEXT,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Supplier table
CREATE TABLE IF NOT EXISTS suppliers (
  id VARCHAR(255) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  contact_name VARCHAR(255),
  email VARCHAR(255),
  phone VARCHAR(50),
  address TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Product suppliers relationship
CREATE TABLE IF NOT EXISTS product_suppliers (
  product_id VARCHAR(255) REFERENCES products(id) ON DELETE CASCADE,
  supplier_id VARCHAR(255) REFERENCES suppliers(id) ON DELETE CASCADE,
  cost DECIMAL(10,2) NOT NULL,
  lead_time INTEGER DEFAULT 0,
  minimum_order_quantity INTEGER DEFAULT 1,
  is_preferred BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (product_id, supplier_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);
CREATE INDEX IF NOT EXISTS idx_products_is_active ON products(is_active);
CREATE INDEX IF NOT EXISTS idx_products_stock ON products(stock);
CREATE INDEX IF NOT EXISTS idx_products_created_at ON products(created_at);

CREATE INDEX IF NOT EXISTS idx_product_variants_product_id ON product_variants(product_id);
CREATE INDEX IF NOT EXISTS idx_product_variants_sku ON product_variants(sku);
CREATE INDEX IF NOT EXISTS idx_product_variants_is_active ON product_variants(is_active);

CREATE INDEX IF NOT EXISTS idx_stock_movements_product_id ON stock_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_variant_id ON stock_movements(variant_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_movement_type ON stock_movements(movement_type);
CREATE INDEX IF NOT EXISTS idx_stock_movements_created_at ON stock_movements(created_at);

CREATE INDEX IF NOT EXISTS idx_product_categories_parent_id ON product_categories(parent_category_id);
CREATE INDEX IF NOT EXISTS idx_product_suppliers_product_id ON product_suppliers(product_id);
CREATE INDEX IF NOT EXISTS idx_product_suppliers_supplier_id ON product_suppliers(supplier_id);

-- Triggers for updated_at timestamps
CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_product_categories_updated_at BEFORE UPDATE ON product_categories
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_product_variants_updated_at BEFORE UPDATE ON product_variants
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_suppliers_updated_at BEFORE UPDATE ON suppliers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert sample products for development
INSERT INTO products (id, name, description, price, cost, sku, category, stock, min_stock, max_stock) VALUES
  ('1', 'Hawaiian Coffee', 'Premium Kona coffee', 12.99, 8.50, 'COF-001', 'Beverages', 50, 10, 100),
  ('2', 'Macadamia Nuts', 'Roasted macadamia nuts', 8.50, 5.00, 'NUT-001', 'Snacks', 30, 5, 50),
  ('3', 'Pineapple Juice', 'Fresh pineapple juice', 3.99, 2.00, 'JUI-001', 'Beverages', 100, 20, 200),
  ('4', 'Coconut Water', 'Natural coconut water', 2.99, 1.50, 'COC-001', 'Beverages', 75, 15, 150),
  ('5', 'Taro Chips', 'Crispy taro chips', 4.99, 3.00, 'CHI-001', 'Snacks', 40, 10, 80),
  ('6', 'Mango Salsa', 'Spicy mango salsa', 5.99, 3.50, 'SAL-001', 'Condiments', 25, 5, 50),
  ('7', 'Hawaiian Honey', 'Raw Hawaiian honey', 15.99, 10.00, 'HON-001', 'Condiments', 20, 5, 40),
  ('8', 'Kona Chocolate', 'Dark chocolate with Kona coffee', 9.99, 6.00, 'CHO-001', 'Snacks', 35, 10, 70);

-- Insert sample categories
INSERT INTO product_categories (id, name, description) VALUES
  ('beverages', 'Beverages', 'Drinks and beverages'),
  ('snacks', 'Snacks', 'Snacks and treats'),
  ('condiments', 'Condiments', 'Sauces, spreads, and condiments');

-- Insert sample supplier
INSERT INTO suppliers (id, name, contact_name, email, phone) VALUES
  ('supplier-001', 'Hawaii Food Co', 'John Doe', 'contact@hawaiifoodco.com', '+1-808-555-0100');

-- Link products to supplier
INSERT INTO product_suppliers (product_id, supplier_id, cost, is_preferred) VALUES
  ('1', 'supplier-001', 8.50, true),
  ('2', 'supplier-001', 5.00, true),
  ('3', 'supplier-001', 2.00, true),
  ('4', 'supplier-001', 1.50, true),
  ('5', 'supplier-001', 3.00, true),
  ('6', 'supplier-001', 3.50, true),
  ('7', 'supplier-001', 10.00, true),
  ('8', 'supplier-001', 6.00, true);
