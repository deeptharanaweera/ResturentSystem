'use server';

import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Look up a user's email by their phone number.
 * Used for phone-based login: the client sends phone + password,
 * we resolve the phone → email, then the client signs in with email + password.
 */
export async function getEmailByPhone(
  phone: string
): Promise<{ email?: string; error?: string }> {
  try {
    const supabase = createAdminClient();

    // 1. Find user_id from user_profiles by phone
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('user_id')
      .eq('phone', phone)
      .maybeSingle();

    if (profileError) throw profileError;

    if (!profile) {
      return { error: 'No account found with this phone number.' };
    }

    // 2. Get the email from auth.users via admin API
    const { data: authUser, error: authError } = await supabase.auth.admin.getUserById(
      profile.user_id
    );

    if (authError) throw authError;

    if (!authUser?.user?.email) {
      return { error: 'Could not resolve account email.' };
    }

    return { email: authUser.user.email };
  } catch (err: any) {
    console.error('Error in getEmailByPhone:', err);
    return { error: err.message || 'Failed to look up phone number.' };
  }
}
