'use server';

import { createAdminClient } from '@/lib/supabase/admin';
import { DayEnd } from '@/types/database';
import { revalidatePath } from 'next/cache';

export interface DayEndWithUserDetails extends DayEnd {
  opened_by_email?: string | null;
  closed_by_email?: string | null;
}

export async function getDayEndsWithUserDetails(branchId?: string): Promise<{
  activeShift?: DayEndWithUserDetails | null;
  pastShifts?: DayEndWithUserDetails[];
  error?: string;
}> {
  try {
    const supabase = createAdminClient();

    // 1. Fetch auth users to map IDs to emails
    const { data: authData } = await supabase.auth.admin.listUsers({ perPage: 1000 });
    const userEmailMap: Record<string, string> = {};
    (authData?.users || []).forEach((u) => {
      userEmailMap[u.id] = u.email || 'No email';
    });

    // 2. Fetch active shift for branch
    let openQuery = supabase
      .from('day_ends')
      .select(`
        *,
        branch:branches(*),
        terminal:terminals(*)
      `)
      .eq('status', 'open')
      .order('opened_at', { ascending: false })
      .limit(1);

    if (branchId) {
      openQuery = openQuery.eq('branch_id', branchId);
    }

    const { data: openShiftData } = await openQuery.maybeSingle();

    let activeShift: DayEndWithUserDetails | null = null;
    if (openShiftData) {
      activeShift = {
        ...openShiftData,
        opened_by_email: openShiftData.opened_by ? userEmailMap[openShiftData.opened_by] || null : null,
        closed_by_email: openShiftData.closed_by ? userEmailMap[openShiftData.closed_by] || null : null,
      };
    }

    // 3. Fetch past closed shifts
    let pastQuery = supabase
      .from('day_ends')
      .select(`
        *,
        branch:branches(*),
        terminal:terminals(*)
      `)
      .eq('status', 'closed')
      .order('closed_at', { ascending: false })
      .limit(30);

    if (branchId) {
      pastQuery = pastQuery.eq('branch_id', branchId);
    }

    const { data: pastShiftsData } = await pastQuery;

    const pastShifts: DayEndWithUserDetails[] = (pastShiftsData || []).map((s) => ({
      ...s,
      opened_by_email: s.opened_by ? userEmailMap[s.opened_by] || null : null,
      closed_by_email: s.closed_by ? userEmailMap[s.closed_by] || null : null,
    }));

    return { activeShift, pastShifts };
  } catch (err: any) {
    console.error('Error in getDayEndsWithUserDetails:', err);
    return { error: err.message || 'Failed to fetch day ends' };
  }
}

export async function openDayShift(data: {
  branch_id: string;
  terminal_id: string | null;
  user_id: string | null;
  opening_cash: number;
}) {
  try {
    const supabase = createAdminClient();

    // Check if an open shift already exists for this branch
    const { data: existing } = await supabase
      .from('day_ends')
      .select('id')
      .eq('branch_id', data.branch_id)
      .eq('status', 'open')
      .limit(1)
      .maybeSingle();

    if (existing) {
      return { error: 'An active shift is already open for this branch' };
    }

    const { data: newShift, error } = await supabase
      .from('day_ends')
      .insert({
        branch_id: data.branch_id,
        terminal_id: data.terminal_id,
        opened_by: data.user_id,
        closed_by: null,
        opened_at: new Date().toISOString(),
        opening_cash: data.opening_cash,
        status: 'open',
      })
      .select(`
        *,
        branch:branches(*),
        terminal:terminals(*)
      `)
      .single();

    if (error) throw error;

    revalidatePath('/pos');
    revalidatePath('/admin/day-end');
    return { success: true, shift: newShift };
  } catch (err: any) {
    console.error('Error opening shift:', err);
    return { error: err.message || 'Failed to open shift' };
  }
}

export async function closeDayShift(data: {
  shift_id: string;
  user_id: string | null;
  actual_cash: number;
  expected_cash: number;
  total_sales: number;
  total_cash: number;
  total_card: number;
  total_other: number;
  total_tax: number;
  total_orders: number;
  total_invoices: number;
  notes?: string | null;
}) {
  try {
    const supabase = createAdminClient();
    const difference = data.actual_cash - data.expected_cash;

    const { data: closedShift, error } = await supabase
      .from('day_ends')
      .update({
        status: 'closed',
        closed_at: new Date().toISOString(),
        closed_by: data.user_id,
        total_sales: data.total_sales,
        total_cash: data.total_cash,
        total_card: data.total_card,
        total_other: data.total_other,
        total_tax: data.total_tax,
        total_orders: data.total_orders,
        total_invoices: data.total_invoices,
        actual_cash: data.actual_cash,
        cash_difference: difference,
        notes: data.notes || null,
      })
      .eq('id', data.shift_id)
      .select(`
        *,
        branch:branches(*),
        terminal:terminals(*)
      `)
      .single();

    if (error) throw error;

    revalidatePath('/pos');
    revalidatePath('/admin/day-end');
    return { success: true, shift: closedShift };
  } catch (err: any) {
    console.error('Error closing shift:', err);
    return { error: err.message || 'Failed to close shift' };
  }
}
