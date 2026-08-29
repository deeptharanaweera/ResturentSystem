-- ==============================================================================
-- INCREMENTAL MIGRATION: POS ROLE & SHIFT AUDIT ENHANCEMENT
-- (Run this if you have already executed branch_terminal_migration.sql)
-- ==============================================================================

-- 1. Add 'opened_by' column to day_ends table to track who opened the shift
ALTER TABLE public.day_ends 
    ADD COLUMN IF NOT EXISTS opened_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- 2. Update user_roles table constraint to support the 'pos' (POS Cashier) role
ALTER TABLE public.user_roles 
    DROP CONSTRAINT IF EXISTS user_roles_role_check;

ALTER TABLE public.user_roles 
    ADD CONSTRAINT user_roles_role_check 
    CHECK (role IN ('admin', 'kitchen', 'waiter', 'pos'));
