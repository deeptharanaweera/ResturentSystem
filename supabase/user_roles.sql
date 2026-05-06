-- ========================================
-- User Roles Table (Role-Based Access Control)
-- ========================================
-- Run this AFTER the main schema.sql

CREATE TABLE user_roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('admin', 'kitchen', 'waiter')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id) -- one role per user
);

-- Enable RLS
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

-- Allow users to read their own role
CREATE POLICY "Users can read own role" ON user_roles
    FOR SELECT USING (auth.uid() = user_id);

-- Allow admins to manage all roles
CREATE POLICY "Admins can manage roles" ON user_roles
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM user_roles ur
            WHERE ur.user_id = auth.uid() AND ur.role = 'admin'
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM user_roles ur
            WHERE ur.user_id = auth.uid() AND ur.role = 'admin'
        )
    );

-- ========================================
-- IMPORTANT: After creating users in Supabase Auth,
-- insert their roles here. Example:
--
-- INSERT INTO user_roles (user_id, role) VALUES
--   ('YOUR_ADMIN_USER_UUID', 'admin'),
--   ('YOUR_KITCHEN_USER_UUID', 'kitchen');
-- ========================================
