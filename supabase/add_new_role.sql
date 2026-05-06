-- ========================================
-- User Roles Table (Role-Based Access Control)
-- ========================================

-- 1. Create the table if it doesn't exist
CREATE TABLE IF NOT EXISTS user_roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id)
);

-- 2. Update the check constraint to include 'waiter'
-- We drop the old one (if it exists) and add the new one
DO $$ 
BEGIN
    ALTER TABLE user_roles DROP CONSTRAINT IF EXISTS user_roles_role_check;
    ALTER TABLE user_roles ADD CONSTRAINT user_roles_role_check CHECK (role IN ('admin', 'kitchen', 'waiter'));
EXCEPTION
    WHEN undefined_object THEN
        -- If it didn't exist, we just add it
        ALTER TABLE user_roles ADD CONSTRAINT user_roles_role_check CHECK (role IN ('admin', 'kitchen', 'waiter'));
END $$;

-- 3. Enable RLS
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

-- 4. Safe Policy Creation
DO $$ 
BEGIN
    DROP POLICY IF EXISTS "Users can read own role" ON user_roles;
    CREATE POLICY "Users can read own role" ON user_roles
        FOR SELECT USING (auth.uid() = user_id);

    DROP POLICY IF EXISTS "Admins can manage roles" ON user_roles;
    CREATE POLICY "Admins can manage roles" ON user_roles
        FOR ALL TO authenticated
        USING (
            EXISTS (
                SELECT 1 FROM user_roles ur
                WHERE ur.user_id = auth.uid() AND ur.role = 'admin'
            )
        );
END $$;
