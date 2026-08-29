'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Branch, Terminal, UserRoleType } from '@/types/database';
import { toast } from 'sonner';

interface BranchContextType {
  currentBranch: Branch | null;
  currentTerminal: Terminal | null;
  userBranches: Branch[];
  terminals: Terminal[];
  loading: boolean;
  userRole: UserRoleType | null;
  switchBranch: (branch: Branch) => Promise<void>;
  switchTerminal: (terminal: Terminal) => void;
  refreshBranches: () => Promise<void>;
}

const BranchContext = createContext<BranchContextType>({
  currentBranch: null,
  currentTerminal: null,
  userBranches: [],
  terminals: [],
  loading: true,
  userRole: null,
  switchBranch: async () => {},
  switchTerminal: () => {},
  refreshBranches: async () => {},
});

export function BranchProvider({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const [currentBranch, setCurrentBranch] = useState<Branch | null>(null);
  const [currentTerminal, setCurrentTerminal] = useState<Terminal | null>(null);
  const [userBranches, setUserBranches] = useState<Branch[]>([]);
  const [terminals, setTerminals] = useState<Terminal[]>([]);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<UserRoleType | null>(null);

  const fetchTerminalsForBranch = useCallback(async (branchId: string) => {
    try {
      const { data, error } = await supabase
        .from('terminals')
        .select('*')
        .eq('branch_id', branchId)
        .eq('is_active', true)
        .order('name');

      if (error) {
        console.error('Error fetching terminals:', error);
        return [];
      }

      setTerminals(data || []);

      // Auto-select saved terminal or first terminal
      const savedTerminalId = typeof window !== 'undefined' ? localStorage.getItem('selected_terminal_id') : null;
      const found = (data || []).find((t) => t.id === savedTerminalId);
      if (found) {
        setCurrentTerminal(found);
      } else if (data && data.length > 0) {
        setCurrentTerminal(data[0]);
        if (typeof window !== 'undefined') {
          localStorage.setItem('selected_terminal_id', data[0].id);
        }
      } else {
        setCurrentTerminal(null);
      }

      return data || [];
    } catch (err) {
      console.error(err);
      return [];
    }
  }, [supabase]);

  const refreshBranches = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        // Unauthenticated or guest view: load active branches
        const { data: allBranches } = await supabase
          .from('branches')
          .select('*')
          .eq('is_active', true)
          .order('name');

        const branchesList = allBranches || [];
        setUserBranches(branchesList);

        if (branchesList.length > 0) {
          const savedBranchId = typeof window !== 'undefined' ? localStorage.getItem('selected_branch_id') : null;
          const found = branchesList.find((b) => b.id === savedBranchId) || branchesList[0];
          setCurrentBranch(found);
          await fetchTerminalsForBranch(found.id);
        }
        setLoading(false);
        return;
      }

      // Check user role
      const { data: roleData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .single();

      const role = (roleData?.role as UserRoleType) || null;
      setUserRole(role);

      let branchesList: Branch[] = [];

      // If admin or super_admin, fetch all active branches
      if (role === 'admin' || role === 'super_admin') {
        const { data: allBranches } = await supabase
          .from('branches')
          .select('*')
          .eq('is_active', true)
          .order('name');
        branchesList = allBranches || [];
      } else {
        // Fetch user assigned branches
        const { data: userBranchData } = await supabase
          .from('user_branches')
          .select('branch:branches(*)')
          .eq('user_id', user.id);

        if (userBranchData && userBranchData.length > 0) {
          branchesList = userBranchData
            .map((ub: any) => ub.branch)
            .filter((b: any): b is Branch => b && b.is_active);
        }

        // Fallback: If no assignment, get all active branches
        if (branchesList.length === 0) {
          const { data: fallbackBranches } = await supabase
            .from('branches')
            .select('*')
            .eq('is_active', true)
            .order('name');
          branchesList = fallbackBranches || [];
        }
      }

      setUserBranches(branchesList);

      if (branchesList.length > 0) {
        const savedBranchId = typeof window !== 'undefined' ? localStorage.getItem('selected_branch_id') : null;
        const matched = branchesList.find((b) => b.id === savedBranchId) || branchesList[0];
        setCurrentBranch(matched);
        if (typeof window !== 'undefined') {
          localStorage.setItem('selected_branch_id', matched.id);
        }
        await fetchTerminalsForBranch(matched.id);
      } else {
        setCurrentBranch(null);
        setCurrentTerminal(null);
      }
    } catch (err) {
      console.error('Error in BranchContext refreshBranches:', err);
    } finally {
      setLoading(false);
    }
  }, [supabase, fetchTerminalsForBranch]);

  useEffect(() => {
    refreshBranches();
  }, [refreshBranches]);

  const switchBranch = async (branch: Branch) => {
    setCurrentBranch(branch);
    if (typeof window !== 'undefined') {
      localStorage.setItem('selected_branch_id', branch.id);
    }
    toast.success(`Switched to ${branch.name}`);
    await fetchTerminalsForBranch(branch.id);
  };

  const switchTerminal = (terminal: Terminal) => {
    setCurrentTerminal(terminal);
    if (typeof window !== 'undefined') {
      localStorage.setItem('selected_terminal_id', terminal.id);
    }
    toast.success(`Active Terminal: ${terminal.name}`);
  };

  return (
    <BranchContext.Provider
      value={{
        currentBranch,
        currentTerminal,
        userBranches,
        terminals,
        loading,
        userRole,
        switchBranch,
        switchTerminal,
        refreshBranches,
      }}
    >
      {children}
    </BranchContext.Provider>
  );
}

export function useBranch() {
  const context = useContext(BranchContext);
  if (!context) {
    throw new Error('useBranch must be used within a BranchProvider');
  }
  return context;
}
