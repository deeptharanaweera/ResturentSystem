-- ==============================================================================
-- LATEST SYSTEM UPDATE MIGRATION (RUN THIS IN SUPABASE SQL EDITOR)
-- 
-- Includes:
-- 1. Multi-Branch & Terminals Management
-- 2. User-to-Branch Assignments
-- 3. Branch & Terminal Foreign Keys on Orders, Invoices, Tables
-- 4. Branchwise Day-End & Shift Management (with opened_by & closed_by audit)
-- 5. POS Cashier Role ('pos') in user_roles table
-- 6. Automatic Data Backfill and RLS Policies
-- ==============================================================================

-- 1. Enable UUID Extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Create Branches Table
CREATE TABLE IF NOT EXISTS public.branches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    code TEXT UNIQUE NOT NULL,
    address TEXT,
    phone TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Create Terminals Table
CREATE TABLE IF NOT EXISTS public.terminals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    code TEXT NOT NULL,
    terminal_type TEXT DEFAULT 'pos' CHECK (terminal_type IN ('pos', 'kitchen', 'display', 'admin', 'waiter')),
    ip_address TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(branch_id, code)
);

-- 4. Create User Branches Mapping Table
CREATE TABLE IF NOT EXISTS public.user_branches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
    is_default BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id, branch_id)
);

-- 5. Add Branch and Terminal Foreign Keys to Existing Tables
ALTER TABLE public.restaurant_tables 
    ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL;

ALTER TABLE public.orders 
    ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS terminal_id UUID REFERENCES public.terminals(id) ON DELETE SET NULL;

ALTER TABLE public.invoices 
    ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS terminal_id UUID REFERENCES public.terminals(id) ON DELETE SET NULL;

-- 6. Create Day-End Management Table (Shift & Day-End reconciliation)
CREATE TABLE IF NOT EXISTS public.day_ends (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
    terminal_id UUID REFERENCES public.terminals(id) ON DELETE SET NULL,
    opened_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    closed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    opened_at TIMESTAMPTZ DEFAULT now(),
    closed_at TIMESTAMPTZ,
    opening_cash NUMERIC(10,2) DEFAULT 0.00,
    total_sales NUMERIC(10,2) DEFAULT 0.00,
    total_cash NUMERIC(10,2) DEFAULT 0.00,
    total_card NUMERIC(10,2) DEFAULT 0.00,
    total_other NUMERIC(10,2) DEFAULT 0.00,
    total_tax NUMERIC(10,2) DEFAULT 0.00,
    total_orders INTEGER DEFAULT 0,
    total_invoices INTEGER DEFAULT 0,
    actual_cash NUMERIC(10,2) DEFAULT 0.00,
    cash_difference NUMERIC(10,2) DEFAULT 0.00,
    notes TEXT,
    status TEXT DEFAULT 'open' CHECK (status IN ('open', 'closed')),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Ensure opened_by exists if day_ends table was already created
ALTER TABLE public.day_ends ADD COLUMN IF NOT EXISTS opened_by UUID;

-- 7. Update User Roles Table to Allow 'pos' Role
ALTER TABLE public.user_roles DROP CONSTRAINT IF EXISTS user_roles_role_check;
ALTER TABLE public.user_roles ADD CONSTRAINT user_roles_role_check CHECK (role IN ('admin', 'kitchen', 'waiter', 'pos'));

-- 8. Seed Default 'Main Branch' and 'POS-01' Terminal if not present
INSERT INTO public.branches (id, name, code, address, phone, is_active)
VALUES (
    'a0000000-0000-0000-0000-000000000001',
    'Main Branch',
    'MAIN',
    'Main Restaurant Street',
    '+94 11 234 5678',
    true
)
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.terminals (id, branch_id, name, code, terminal_type, is_active)
VALUES (
    'b0000000-0000-0000-0000-000000000001',
    'a0000000-0000-0000-0000-000000000001',
    'Main POS Station',
    'POS-01',
    'pos',
    true
)
ON CONFLICT (branch_id, code) DO NOTHING;

INSERT INTO public.terminals (id, branch_id, name, code, terminal_type, is_active)
VALUES (
    'b0000000-0000-0000-0000-000000000002',
    'a0000000-0000-0000-0000-000000000001',
    'Kitchen Display Unit',
    'KITCHEN-01',
    'kitchen',
    true
)
ON CONFLICT (branch_id, code) DO NOTHING;

-- 9. Backfill existing records to Main Branch
UPDATE public.restaurant_tables 
SET branch_id = 'a0000000-0000-0000-0000-000000000001'
WHERE branch_id IS NULL;

UPDATE public.orders 
SET branch_id = 'a0000000-0000-0000-0000-000000000001',
    terminal_id = 'b0000000-0000-0000-0000-000000000001'
WHERE branch_id IS NULL;

UPDATE public.invoices 
SET branch_id = 'a0000000-0000-0000-0000-000000000001',
    terminal_id = 'b0000000-0000-0000-0000-000000000001'
WHERE branch_id IS NULL;

-- Automatically assign existing users to the Main Branch
INSERT INTO public.user_branches (user_id, branch_id, is_default)
SELECT id, 'a0000000-0000-0000-0000-000000000001', true
FROM auth.users
ON CONFLICT (user_id, branch_id) DO NOTHING;

-- 10. Enable Row Level Security (RLS) & Policies
ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.terminals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.day_ends ENABLE ROW LEVEL SECURITY;

-- Allow public / authenticated access (matches POS and Admin requirements)
DROP POLICY IF EXISTS "Public access to branches" ON public.branches;
CREATE POLICY "Public access to branches" ON public.branches FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public access to terminals" ON public.terminals;
CREATE POLICY "Public access to terminals" ON public.terminals FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public access to user_branches" ON public.user_branches;
CREATE POLICY "Public access to user_branches" ON public.user_branches FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public access to day_ends" ON public.day_ends;
CREATE POLICY "Public access to day_ends" ON public.day_ends FOR ALL USING (true) WITH CHECK (true);
