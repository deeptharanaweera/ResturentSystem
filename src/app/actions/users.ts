'use server';

import { createAdminClient } from '@/lib/supabase/admin';
import { UserRoleType } from '@/types/database';
import { revalidatePath } from 'next/cache';

export async function createStaffUser(email: string, password: string, role: UserRoleType) {
  const supabase = createAdminClient();

  // 1. Create the user in Auth
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
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
    // Cleanup: if role assignment fails, we might want to delete the auth user? 
    // Or just report the error.
    return { error: `User created but role assignment failed: ${roleError.message}` };
  }

  revalidatePath('/admin/users');
  return { success: true };
}

export async function deleteStaffUser(userId: string) {
  const supabase = createAdminClient();

  // Delete from Auth (will cascade to user_roles due to FK REFERENCES auth.users(id) ON DELETE CASCADE)
  const { error } = await supabase.auth.admin.deleteUser(userId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath('/admin/users');
  return { success: true };
}
