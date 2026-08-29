-- ============================================================
-- MIGRATION: Sequential Daily Order Number (Format: YYMMDD-XXXX)
-- Run this in your Supabase SQL Editor
-- ============================================================

-- 1. Add order_number column to orders table
ALTER TABLE orders ADD COLUMN IF NOT EXISTS order_number TEXT;

-- 2. Create index on order_number for quick lookups
CREATE INDEX IF NOT EXISTS idx_orders_order_number ON orders(order_number);

-- 3. Function to automatically generate YYMMDD-XXXX order number
CREATE OR REPLACE FUNCTION generate_daily_order_number()
RETURNS TRIGGER AS $$
DECLARE
    date_prefix TEXT;
    seq_num INT;
BEGIN
    -- Only generate if order_number is not explicitly provided
    IF NEW.order_number IS NULL OR NEW.order_number = '' THEN
        -- Current date in YYMMDD format
        date_prefix := to_char(NOW() AT TIME ZONE 'UTC', 'YYMMDD');
        
        -- Get the highest sequential number for today
        SELECT COALESCE(MAX(
            CASE 
                WHEN order_number ~ ('^' || date_prefix || '-[0-9]{4}$') 
                THEN SUBSTRING(order_number FROM 8 FOR 4)::INT 
                ELSE 0 
            END
        ), 0) + 1
        INTO seq_num
        FROM orders
        WHERE order_number LIKE date_prefix || '-%';

        -- Set the formatted order number (e.g. 260829-0001)
        NEW.order_number := date_prefix || '-' || LPAD(seq_num::TEXT, 4, '0');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. Create trigger to auto-assign order_number BEFORE INSERT on orders
DROP TRIGGER IF EXISTS trg_generate_order_number ON orders;
CREATE TRIGGER trg_generate_order_number
BEFORE INSERT ON orders
FOR EACH ROW
EXECUTE FUNCTION generate_daily_order_number();

-- 5. Backfill existing orders that do not have order_number (using created_at date)
DO $$
DECLARE
    r RECORD;
    d_prefix TEXT;
    seq INT;
BEGIN
    FOR r IN SELECT id, created_at FROM orders WHERE order_number IS NULL ORDER BY created_at ASC LOOP
        d_prefix := to_char(r.created_at AT TIME ZONE 'UTC', 'YYMMDD');
        
        SELECT COALESCE(MAX(
            CASE 
                WHEN order_number ~ ('^' || d_prefix || '-[0-9]{4}$') 
                THEN SUBSTRING(order_number FROM 8 FOR 4)::INT 
                ELSE 0 
            END
        ), 0) + 1
        INTO seq
        FROM orders
        WHERE order_number LIKE d_prefix || '-%';

        UPDATE orders 
        SET order_number = d_prefix || '-' || LPAD(seq::TEXT, 4, '0')
        WHERE id = r.id;
    END LOOP;
END $$;
