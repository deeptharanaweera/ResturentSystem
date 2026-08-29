-- ==============================================================================
-- MIGRATION: SUPER ADMIN ROLE UPDATE
-- ==============================================================================

-- 1. Update user_roles constraint to support 'super_admin' role
ALTER TABLE public.user_roles 
    DROP CONSTRAINT IF EXISTS user_roles_role_check;

ALTER TABLE public.user_roles 
    ADD CONSTRAINT user_roles_role_check 
    CHECK (role IN ('super_admin', 'admin', 'kitchen', 'waiter', 'pos'));
