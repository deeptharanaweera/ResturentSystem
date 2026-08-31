'use server';

import { createAdminClient } from '@/lib/supabase/admin';
import { SystemSettings, SidebarMenuItem, RoleMenuPermission } from '@/types/database';
import { revalidatePath } from 'next/cache';

// ─── System Settings ─────────────────────────────────────────────────────────

export async function getSystemSettings(): Promise<{ settings?: SystemSettings; error?: string }> {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from('system_settings')
      .select('*')
      .limit(1)
      .single();

    if (error) throw error;
    return { settings: data };
  } catch (err: any) {
    console.error('Error fetching system settings:', err);
    return { error: err.message || 'Failed to fetch system settings' };
  }
}

export async function updateSystemSettings(
  updates: Partial<Pick<SystemSettings, 'restaurant_name' | 'tagline' | 'address' | 'contact_phone' | 'contact_email' | 'logo_url'>>
): Promise<{ success?: boolean; error?: string }> {
  try {
    const supabase = createAdminClient();

    // Get existing row ID
    const { data: existing } = await supabase
      .from('system_settings')
      .select('id')
      .limit(1)
      .single();

    if (!existing) {
      // Insert if no row exists
      const { error } = await supabase
        .from('system_settings')
        .insert({ ...updates, updated_at: new Date().toISOString() });
      if (error) throw error;
    } else {
      // Update existing row
      const { error } = await supabase
        .from('system_settings')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', existing.id);
      if (error) throw error;
    }

    revalidatePath('/');
    revalidatePath('/admin');
    revalidatePath('/admin/settings');
    return { success: true };
  } catch (err: any) {
    console.error('Error updating system settings:', err);
    return { error: err.message || 'Failed to update system settings' };
  }
}

// ─── Sidebar Menu Items ──────────────────────────────────────────────────────

export async function getSidebarMenuItems(): Promise<{ items?: SidebarMenuItem[]; error?: string }> {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from('sidebar_menu_items')
      .select('*')
      .order('display_order', { ascending: true });

    if (error) throw error;
    return { items: data || [] };
  } catch (err: any) {
    console.error('Error fetching sidebar menu items:', err);
    return { error: err.message || 'Failed to fetch sidebar items' };
  }
}

// ─── Role Permissions ────────────────────────────────────────────────────────

export async function getRolePermissions(): Promise<{ permissions?: RoleMenuPermission[]; error?: string }> {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from('role_menu_permissions')
      .select('*');

    if (error) throw error;
    return { permissions: data || [] };
  } catch (err: any) {
    console.error('Error fetching role permissions:', err);
    return { error: err.message || 'Failed to fetch role permissions' };
  }
}

export async function updateRolePermissions(
  role: string,
  menuItemIds: string[]
): Promise<{ success?: boolean; error?: string }> {
  try {
    const supabase = createAdminClient();

    // 1. Remove all existing permissions for this role
    const { error: deleteError } = await supabase
      .from('role_menu_permissions')
      .delete()
      .eq('role', role);

    if (deleteError) throw deleteError;

    // 2. Insert new permissions
    if (menuItemIds.length > 0) {
      const rows = menuItemIds.map((menuItemId) => ({
        role,
        menu_item_id: menuItemId,
      }));

      const { error: insertError } = await supabase
        .from('role_menu_permissions')
        .insert(rows);

      if (insertError) throw insertError;
    }

    revalidatePath('/admin/settings');
    return { success: true };
  } catch (err: any) {
    console.error('Error updating role permissions:', err);
    return { error: err.message || 'Failed to update role permissions' };
  }
}
