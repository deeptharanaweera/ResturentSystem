-- MIGRATION: Update schema to support one invoice for multiple orders
-- Run this in your Supabase SQL Editor

-- 1. Add invoice_id to orders table
ALTER TABLE orders ADD COLUMN IF NOT EXISTS invoice_id UUID;

-- 2. Add foreign key constraint to link orders to invoices
ALTER TABLE orders 
ADD CONSTRAINT fk_orders_invoice 
FOREIGN KEY (invoice_id) 
REFERENCES invoices(id) 
ON DELETE SET NULL;

-- 3. (Optional) Remove order_id from invoices as it's now redundant
-- ALTER TABLE invoices DROP COLUMN IF EXISTS order_id;
