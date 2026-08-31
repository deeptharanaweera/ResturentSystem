'use server';

import { createAdminClient } from '@/lib/supabase/admin';
import { UserProfile } from '@/types/database';
import { revalidatePath } from 'next/cache';

export async function getUserProfile(
  userId: string
): Promise<{ profile?: UserProfile; error?: string }> {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error && error.code !== 'PGRST116') throw error; // PGRST116 = no rows
    return { profile: data || undefined };
  } catch (err: any) {
    console.error('Error fetching user profile:', err);
    return { error: err.message || 'Failed to fetch profile' };
  }
}

export async function updateUserProfile(
  userId: string,
  updates: { display_name?: string; phone?: string }
): Promise<{ success?: boolean; error?: string }> {
  try {
    const supabase = createAdminClient();

    // Validate phone uniqueness if phone is being updated
    if (updates.phone) {
      const { data: existing } = await supabase
        .from('user_profiles')
        .select('user_id')
        .eq('phone', updates.phone)
        .neq('user_id', userId)
        .maybeSingle();

      if (existing) {
        return { error: 'This phone number is already registered to another user.' };
      }
    }

    // Check if profile exists
    const { data: profileExists } = await supabase
      .from('user_profiles')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle();

    if (profileExists) {
      // Update existing
      const { error } = await supabase
        .from('user_profiles')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('user_id', userId);
      if (error) throw error;
    } else {
      // Insert new
      const { error } = await supabase
        .from('user_profiles')
        .insert({
          user_id: userId,
          ...updates,
        });
      if (error) throw error;
    }

    revalidatePath('/admin/profile');
    revalidatePath('/admin/users');
    return { success: true };
  } catch (err: any) {
    console.error('Error updating user profile:', err);
    return { error: err.message || 'Failed to update profile' };
  }
}
