'use server';

import { createAdminClient } from '@/lib/supabase/admin';
import { UserRoleType, Branch } from '@/types/database';
import { revalidatePath } from 'next/cache';

export interface StaffUserRecord {
  user_id: string;
  email: string;
  role: UserRoleType;
  is_active: boolean;
  created_at: string;
  last_sign_in_at: string | null;
  branches: Branch[];
}

export async function getStaffUsersWithDetails(): Promise<{ users?: StaffUserRecord[]; error?: string }> {
  try {
    const supabase = createAdminClient();

    // 1. Fetch auth users
    const { data: authData, error: authError } = await supabase.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });

    if (authError) throw authError;

    // 2. Fetch roles
    const { data: rolesData, error: rolesError } = await supabase
      .from('user_roles')
      .select('*');

    if (rolesError) throw rolesError;

    // 3. Fetch user branches
    const { data: userBranchData } = await supabase
      .from('user_branches')
      .select('user_id, branch:branches(*)');

    const roleMap: Record<string, UserRoleType> = {};
    (rolesData || []).forEach((r) => {
      roleMap[r.user_id] = r.role;
    });

    const branchMap: Record<string, Branch[]> = {};
    (userBranchData || []).forEach((ub: any) => {
      if (!branchMap[ub.user_id]) branchMap[ub.user_id] = [];
      if (ub.branch) branchMap[ub.user_id].push(ub.branch);
    });

    // Merge only users who have a role in the system
    const staffUsers: StaffUserRecord[] = (authData.users || [])
      .filter((u) => roleMap[u.id])
      .map((u) => {
        const isBanned = Boolean(u.banned_until && new Date(u.banned_until) > new Date());
        const isActive = !isBanned && u.user_metadata?.is_active !== false;

        return {
          user_id: u.id,
          email: u.email || 'No email',
          role: roleMap[u.id] || 'waiter',
          is_active: isActive,
          created_at: u.created_at,
          last_sign_in_at: u.last_sign_in_at || null,
          branches: branchMap[u.id] || [],
        };
      })
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    return { users: staffUsers };
  } catch (err: any) {
    console.error('Error in getStaffUsersWithDetails:', err);
    return { error: err.message || 'Failed to fetch staff users' };
  }
}

export async function createStaffUser(
  email: string,
  password: string,
  role: UserRoleType,
  branchIds?: string[]
) {
  const supabase = createAdminClient();

  // 1. Create the user in Auth
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { is_active: true },
  });

  if (authError) {
    return { error: authError.message };
  }

  const userId = authData.user.id;

  // 2. Assign the role in user_roles table
  const { error: roleError } = await supabase
    .from('user_roles')
    .insert({
      user_id: userId,
      role: role,
    });

  if (roleError) {
    return { error: `User created but role assignment failed: ${roleError.message}` };
  }

  // 3. Assign branches in user_branches table if provided
  if (branchIds && branchIds.length > 0) {
    const userBranchRows = branchIds.map((bId, idx) => ({
      user_id: userId,
      branch_id: bId,
      is_default: idx === 0,
    }));
    await supabase.from('user_branches').insert(userBranchRows);
  }

  revalidatePath('/admin/users');
  return { success: true };
}

export async function updateStaffPassword(userId: string, newPassword: string) {
  try {
    const supabase = createAdminClient();

    if (!newPassword || newPassword.length < 6) {
      return { error: 'Password must be at least 6 characters long' };
    }

    const { error } = await supabase.auth.admin.updateUserById(userId, {
      password: newPassword,
    });

    if (error) throw error;

    revalidatePath('/admin/users');
    return { success: true };
  } catch (err: any) {
    console.error('Error updating staff password:', err);
    return { error: err.message || 'Failed to update password' };
  }
}

export async function toggleStaffActive(userId: string, active: boolean) {
  try {
    const supabase = createAdminClient();

    const { error } = await supabase.auth.admin.updateUserById(userId, {
      ban_duration: active ? 'none' : '876000h', // 100 years ban if inactive
      user_metadata: { is_active: active },
    });

    if (error) throw error;

    revalidatePath('/admin/users');
    return { success: true };
  } catch (err: any) {
    console.error('Error updating staff status:', err);
    return { error: err.message || 'Failed to update status' };
  }
}

export async function updateUserBranches(userId: string, branchIds: string[]) {
  try {
    const supabase = createAdminClient();

    // 1. Remove existing branch mappings
    await supabase.from('user_branches').delete().eq('user_id', userId);

    // 2. Insert new branch mappings
    if (branchIds.length > 0) {
      const userBranchRows = branchIds.map((bId, idx) => ({
        user_id: userId,
        branch_id: bId,
        is_default: idx === 0,
      }));
      const { error } = await supabase.from('user_branches').insert(userBranchRows);
      if (error) throw error;
    }

    revalidatePath('/admin/users');
    return { success: true };
  } catch (err: any) {
    console.error('Error in updateUserBranches:', err);
    return { error: err.message || 'Failed to update user branches' };
  }
}
