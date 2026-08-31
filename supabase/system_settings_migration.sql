-- ==============================================================================
-- MIGRATION: SYSTEM SETTINGS, USER PROFILES, DYNAMIC SIDEBAR PRIVILEGES
-- Run this in Supabase SQL Editor
-- ==============================================================================

-- 1. System Settings Table (single-row, stores restaurant branding)
CREATE TABLE IF NOT EXISTS public.system_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_name TEXT NOT NULL DEFAULT 'Savoria',
    tagline TEXT DEFAULT 'Fine Dining Experience',
    address TEXT,
    contact_phone TEXT,
    contact_email TEXT,
    logo_url TEXT,
    updated_at TIMESTAMPTZ DEFAULT now(),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. User Profiles Table (extends auth.users with display_name + unique phone)
CREATE TABLE IF NOT EXISTS public.user_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    display_name TEXT,
    phone TEXT,
    avatar_url TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id),
    UNIQUE(phone)
);

-- 3. Sidebar Menu Items Table (all available sidebar navigation items)
CREATE TABLE IF NOT EXISTS public.sidebar_menu_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key TEXT UNIQUE NOT NULL,
    label TEXT NOT NULL,
    href TEXT NOT NULL,
    icon_name TEXT NOT NULL DEFAULT 'LayoutDashboard',
    display_order INT DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Role Menu Permissions Table (which roles can see which menu items)
CREATE TABLE IF NOT EXISTS public.role_menu_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    role TEXT NOT NULL,
    menu_item_id UUID NOT NULL REFERENCES public.sidebar_menu_items(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(role, menu_item_id)
);

-- ==============================================================================
-- ENABLE RLS
-- ==============================================================================

ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sidebar_menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_menu_permissions ENABLE ROW LEVEL SECURITY;

-- ==============================================================================
-- RLS POLICIES
-- ==============================================================================

-- System settings: everyone can read, only authenticated can modify
DROP POLICY IF EXISTS "Public read system_settings" ON public.system_settings;
CREATE POLICY "Public read system_settings" ON public.system_settings
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Auth manage system_settings" ON public.system_settings;
CREATE POLICY "Auth manage system_settings" ON public.system_settings
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- User profiles: users can read/update their own, admins can manage all
DROP POLICY IF EXISTS "Users read own profile" ON public.user_profiles;
CREATE POLICY "Users read own profile" ON public.user_profiles
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users update own profile" ON public.user_profiles;
CREATE POLICY "Users update own profile" ON public.user_profiles
    FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Auth insert profiles" ON public.user_profiles;
CREATE POLICY "Auth insert profiles" ON public.user_profiles
    FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Admin manage profiles" ON public.user_profiles;
CREATE POLICY "Admin manage profiles" ON public.user_profiles
    FOR ALL TO authenticated USING (
        EXISTS (
            SELECT 1 FROM public.user_roles ur
            WHERE ur.user_id = auth.uid() AND ur.role IN ('admin', 'super_admin')
        )
    ) WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.user_roles ur
            WHERE ur.user_id = auth.uid() AND ur.role IN ('admin', 'super_admin')
        )
    );

-- Sidebar menu items: everyone can read, only authenticated can modify
DROP POLICY IF EXISTS "Public read sidebar_menu_items" ON public.sidebar_menu_items;
CREATE POLICY "Public read sidebar_menu_items" ON public.sidebar_menu_items
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Auth manage sidebar_menu_items" ON public.sidebar_menu_items;
CREATE POLICY "Auth manage sidebar_menu_items" ON public.sidebar_menu_items
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Role menu permissions: everyone can read, only authenticated can modify
DROP POLICY IF EXISTS "Public read role_menu_permissions" ON public.role_menu_permissions;
CREATE POLICY "Public read role_menu_permissions" ON public.role_menu_permissions
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Auth manage role_menu_permissions" ON public.role_menu_permissions;
CREATE POLICY "Auth manage role_menu_permissions" ON public.role_menu_permissions
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ==============================================================================
-- SEED: Default System Settings
-- ==============================================================================

INSERT INTO public.system_settings (restaurant_name, tagline, address, contact_phone, contact_email)
SELECT 'Savoria', 'Fine Dining Experience', 'Main Restaurant Street', '+94 11 234 5678', 'info@savoria.com'
WHERE NOT EXISTS (SELECT 1 FROM public.system_settings LIMIT 1);

-- ==============================================================================
-- SEED: Default Sidebar Menu Items
-- ==============================================================================

INSERT INTO public.sidebar_menu_items (key, label, href, icon_name, display_order) VALUES
    ('dashboard',       'Dashboard',             '/admin',                'LayoutDashboard', 1),
    ('pos',             'POS',                   '/pos',                  'ShoppingCart',    2),
    ('kitchen',         'Kitchen',               '/kitchen',              'ChefHat',         3),
    ('order_display',   'Order Display',         '/display',              'Tv',              4),
    ('day_end',         'Day-End Shift',         '/admin/day-end',        'CalendarDays',    5),
    ('tables_qr',       'Tables & QR',           '/admin/tables',         'QrCode',          6),
    ('billing',         'Billing',               '/admin/billing',        'Receipt',         7),
    ('reports',         'Reports',               '/admin/reports',        'BarChart3',       8),
    ('menu_items',      'Menu Items',            '/admin/menu-management','UtensilsCrossed', 9),
    ('branches',        'Branches & Terminals',  '/admin/branches',       'Building2',       10),
    ('staff',           'Staff Management',      '/admin/users',          'User',            11),
    ('settings',        'System Settings',       '/admin/settings',       'Settings',        12)
ON CONFLICT (key) DO NOTHING;

-- ==============================================================================
-- SEED: Default Role → Menu Permissions (matching current hardcoded logic)
-- ==============================================================================

-- Super Admin & Admin: access to ALL items
INSERT INTO public.role_menu_permissions (role, menu_item_id)
SELECT r.role, smi.id
FROM (VALUES ('super_admin'), ('admin')) AS r(role)
CROSS JOIN public.sidebar_menu_items smi
ON CONFLICT (role, menu_item_id) DO NOTHING;

-- POS role: POS + Order Display
INSERT INTO public.role_menu_permissions (role, menu_item_id)
SELECT 'pos', smi.id
FROM public.sidebar_menu_items smi
WHERE smi.key IN ('pos', 'order_display')
ON CONFLICT (role, menu_item_id) DO NOTHING;

-- Waiter role: Tables & QR + Kitchen
INSERT INTO public.role_menu_permissions (role, menu_item_id)
SELECT 'waiter', smi.id
FROM public.sidebar_menu_items smi
WHERE smi.key IN ('tables_qr', 'kitchen')
ON CONFLICT (role, menu_item_id) DO NOTHING;

-- Kitchen role: Kitchen only
INSERT INTO public.role_menu_permissions (role, menu_item_id)
SELECT 'kitchen', smi.id
FROM public.sidebar_menu_items smi
WHERE smi.key IN ('kitchen')
ON CONFLICT (role, menu_item_id) DO NOTHING;

-- ==============================================================================
-- SEED: Create user_profiles for existing auth users (if not already present)
-- ==============================================================================

INSERT INTO public.user_profiles (user_id, display_name)
SELECT id, COALESCE(raw_user_meta_data->>'display_name', split_part(email, '@', 1))
FROM auth.users
WHERE NOT EXISTS (
    SELECT 1 FROM public.user_profiles up WHERE up.user_id = auth.users.id
);

-- ==============================================================================
-- Enable Realtime (optional)
-- ==============================================================================
-- ALTER PUBLICATION supabase_realtime ADD TABLE system_settings;
