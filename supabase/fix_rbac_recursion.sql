-- ========================================================
-- MIGRATION: Fix RLS Recursion (Function-Based Approach)
-- This version uses SECURITY DEFINER to bypass recursion.
-- ========================================================

-- 1. Create a safe function to check roles
-- SECURITY DEFINER means it runs with the permissions of the creator (postgres)
-- thus it doesn't trigger RLS on itself.
CREATE OR REPLACE FUNCTION get_user_role(check_user_id UUID)
RETURNS TEXT AS $$
  SELECT role FROM public.user_roles WHERE user_id = check_user_id;
$$ LANGUAGE sql SECURITY DEFINER;

-- 2. Clean up old policies
DROP POLICY IF EXISTS "Users can read own role" ON user_roles;
DROP POLICY IF EXISTS "Admins manage roles" ON user_roles;
DROP POLICY IF EXISTS "Admins manage everything" ON user_roles;
DROP POLICY IF EXISTS "Admins can manage roles" ON user_roles;
DROP POLICY IF EXISTS "Admins can manage all" ON user_roles;

-- 3. Create NEW non-recursive policies
-- Standard SELECT policy
CREATE POLICY "Users can read own role" 
ON user_roles 
FOR SELECT 
USING (auth.uid() = user_id);

-- Admin policy using the safe function
CREATE POLICY "Admins manage everything" 
ON user_roles 
FOR ALL 
TO authenticated 
USING (get_user_role(auth.uid()) = 'admin');

-- 4. Ensure your admin user exists
INSERT INTO user_roles (user_id, role) 
VALUES ('60939c29-ff86-4338-b438-cca92caab416', 'admin')
ON CONFLICT (user_id) DO UPDATE SET role = 'admin';
