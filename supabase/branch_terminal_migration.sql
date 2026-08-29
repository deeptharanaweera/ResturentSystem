-- ==============================================================================
-- MULTI-BRANCH, MULTI-TERMINAL & DAY-END MANAGEMENT MIGRATION
-- ==============================================================================

-- 1. Create Branches Table
CREATE TABLE IF NOT EXISTS public.branches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    code TEXT UNIQUE NOT NULL,
    address TEXT,
    phone TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Create Terminals Table
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

-- 3. Create User Branches Mapping Table
CREATE TABLE IF NOT EXISTS public.user_branches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
    is_default BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id, branch_id)
);

-- 4. Add branch_id and terminal_id to Restaurant Tables, Orders, and Invoices
ALTER TABLE public.restaurant_tables 
    ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL;

ALTER TABLE public.orders 
    ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS terminal_id UUID REFERENCES public.terminals(id) ON DELETE SET NULL;

ALTER TABLE public.invoices 
    ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS terminal_id UUID REFERENCES public.terminals(id) ON DELETE SET NULL;

-- 5. Create Day-End Management Table
CREATE TABLE IF NOT EXISTS public.day_ends (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
    terminal_id UUID REFERENCES public.terminals(id) ON DELETE SET NULL,
    closed_by UUID,
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

-- Enable RLS and full policies
ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.terminals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.day_ends ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    DROP POLICY IF EXISTS "Allow public all access on branches" ON public.branches;
    CREATE POLICY "Allow public all access on branches" ON public.branches FOR ALL USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS "Allow public all access on terminals" ON public.terminals;
    CREATE POLICY "Allow public all access on terminals" ON public.terminals FOR ALL USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS "Allow public all access on user_branches" ON public.user_branches;
    CREATE POLICY "Allow public all access on user_branches" ON public.user_branches FOR ALL USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS "Allow public all access on day_ends" ON public.day_ends;
    CREATE POLICY "Allow public all access on day_ends" ON public.day_ends FOR ALL USING (true) WITH CHECK (true);
END $$;

-- 6. Seed Default Main Branch & POS-01 Terminal if not exists
DO $$ 
DECLARE
    main_branch_id UUID;
    main_pos_id UUID;
    main_kitchen_id UUID;
BEGIN
    -- Check or Insert Main Branch
    SELECT id INTO main_branch_id FROM public.branches WHERE code = 'MAIN' LIMIT 1;
    IF main_branch_id IS NULL THEN
        INSERT INTO public.branches (name, code, address, phone, is_active)
        VALUES ('Main Branch', 'MAIN', '123 Gourmet Street, Colombo', '+94 11 234 5678', true)
        RETURNING id INTO main_branch_id;
    END IF;

    -- Check or Insert POS-01 Terminal
    SELECT id INTO main_pos_id FROM public.terminals WHERE branch_id = main_branch_id AND code = 'POS-01' LIMIT 1;
    IF main_pos_id IS NULL THEN
        INSERT INTO public.terminals (branch_id, name, code, terminal_type, is_active)
        VALUES (main_branch_id, 'Main POS 1', 'POS-01', 'pos', true)
        RETURNING id INTO main_pos_id;
    END IF;

    -- Check or Insert Kitchen Display Terminal
    SELECT id INTO main_kitchen_id FROM public.terminals WHERE branch_id = main_branch_id AND code = 'KITCHEN-01' LIMIT 1;
    IF main_kitchen_id IS NULL THEN
        INSERT INTO public.terminals (branch_id, name, code, terminal_type, is_active)
        VALUES (main_branch_id, 'Kitchen Display 1', 'KITCHEN-01', 'kitchen', true)
        RETURNING id INTO main_kitchen_id;
    END IF;

    -- 7. Backfill existing records to Main Branch
    UPDATE public.restaurant_tables SET branch_id = main_branch_id WHERE branch_id IS NULL;
    UPDATE public.orders SET branch_id = main_branch_id WHERE branch_id IS NULL;
    UPDATE public.orders SET terminal_id = main_pos_id WHERE terminal_id IS NULL;
    UPDATE public.invoices SET branch_id = main_branch_id WHERE branch_id IS NULL;
    UPDATE public.invoices SET terminal_id = main_pos_id WHERE terminal_id IS NULL;

    -- Assign all existing users to Main Branch
    INSERT INTO public.user_branches (user_id, branch_id, is_default)
    SELECT DISTINCT user_id, main_branch_id, true
    FROM public.user_roles
    ON CONFLICT (user_id, branch_id) DO NOTHING;
END $$;
