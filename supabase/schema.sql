-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Tables (Physical Restaurant Layout)
CREATE TABLE restaurant_tables (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    table_number INT UNIQUE NOT NULL,
    qr_code_url TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Categories
CREATE TABLE categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    display_order INT DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Menu Items
CREATE TABLE menu_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    category_id UUID REFERENCES categories(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    price DECIMAL(10,2) NOT NULL,
    image_url TEXT,
    is_available BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Orders (The Header)
-- Statuses: 'pending', 'preparing', 'served', 'completed', 'cancelled'
CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    table_id UUID REFERENCES restaurant_tables(id),
    total_amount DECIMAL(10,2) DEFAULT 0.00,
    status TEXT DEFAULT 'pending',
    payment_status TEXT DEFAULT 'unpaid', -- 'unpaid', 'paid'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Order Items (The Line Items)
CREATE TABLE order_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
    item_id UUID REFERENCES menu_items(id),
    quantity INT NOT NULL CHECK (quantity > 0),
    unit_price DECIMAL(10,2) NOT NULL,
    special_instructions TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. Billing/Invoices (For historical records)
CREATE TABLE invoices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID REFERENCES orders(id),
    invoice_number SERIAL,
    subtotal DECIMAL(10,2) NOT NULL,
    tax_amount DECIMAL(10,2) DEFAULT 0.00,
    grand_total DECIMAL(10,2) NOT NULL,
    issued_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ========================================
-- Row Level Security (RLS) Policies
-- ========================================

-- Enable RLS on all tables
ALTER TABLE restaurant_tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

-- Public read access for customer-facing tables
CREATE POLICY "Allow public read on restaurant_tables" ON restaurant_tables FOR SELECT USING (true);
CREATE POLICY "Allow public read on categories" ON categories FOR SELECT USING (true);
CREATE POLICY "Allow public read on menu_items" ON menu_items FOR SELECT USING (true);

-- Public insert for orders (customers can place orders without auth)
CREATE POLICY "Allow public insert on orders" ON orders FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public read on orders" ON orders FOR SELECT USING (true);
CREATE POLICY "Allow public update on orders" ON orders FOR UPDATE USING (true);

CREATE POLICY "Allow public insert on order_items" ON order_items FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public read on order_items" ON order_items FOR SELECT USING (true);

-- Admin-only policies (authenticated users)
CREATE POLICY "Allow authenticated full access on restaurant_tables" ON restaurant_tables FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow authenticated full access on categories" ON categories FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow authenticated full access on menu_items" ON menu_items FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow authenticated full access on invoices" ON invoices FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow public insert on invoices" ON invoices FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public read on invoices" ON invoices FOR SELECT USING (true);

-- ========================================
-- Enable Realtime on orders
-- ========================================
ALTER PUBLICATION supabase_realtime ADD TABLE orders;
ALTER PUBLICATION supabase_realtime ADD TABLE order_items;
