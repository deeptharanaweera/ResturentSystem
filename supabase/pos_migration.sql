-- ============================================
-- MIGRATION: POS Features
-- Run this in your Supabase SQL Editor
-- ============================================

-- 1. Add order_type column to orders table
-- Values: 'dine_in', 'takeaway', 'counter'
ALTER TABLE orders ADD COLUMN IF NOT EXISTS order_type TEXT DEFAULT 'dine_in';

-- 2. Add customer_name column to orders table (for takeaway identification)
ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_name TEXT;

-- 3. Make table_id nullable (takeaway and counter orders don't need a table)
ALTER TABLE orders ALTER COLUMN table_id DROP NOT NULL;

-- 4. Create invoice_has_payment table for multiple payment methods per invoice
CREATE TABLE IF NOT EXISTS invoice_has_payment (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    payment_method TEXT NOT NULL DEFAULT 'cash', -- 'cash', 'card', 'bank_transfer', 'other'
    amount DECIMAL(10,2) NOT NULL CHECK (amount > 0),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Enable RLS on the new table
ALTER TABLE invoice_has_payment ENABLE ROW LEVEL SECURITY;

-- 6. RLS Policies for invoice_has_payment
CREATE POLICY "Allow public read on invoice_has_payment" 
    ON invoice_has_payment FOR SELECT USING (true);

CREATE POLICY "Allow public insert on invoice_has_payment" 
    ON invoice_has_payment FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow authenticated full access on invoice_has_payment" 
    ON invoice_has_payment FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 7. Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE invoice_has_payment;
