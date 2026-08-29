'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useBranch } from '@/context/BranchContext';
import { RESTAURANT_NAME } from '@/lib/constants';
import {
  Building2,
  Monitor,
  ShoppingCart,
  ChefHat,
  Tv,
  LayoutDashboard,
  ArrowRight,
  CheckCircle2,
  Sparkles,
  MapPin,
  Phone,
  LogOut,
  Loader2,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import Button from '@/components/ui/Button';

export default function SelectBranchPage() {
  const router = useRouter();
  const supabase = createClient();
  const { currentBranch, currentTerminal, userBranches, terminals, switchBranch, switchTerminal, loading, userRole } = useBranch();
  const [selectedBranchId, setSelectedBranchId] = useState<string>('');
  const [selectedTerminalId, setSelectedTerminalId] = useState<string>('');
  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUserEmail(user?.email || null);
    });
  }, [supabase]);

  useEffect(() => {
    if (currentBranch) {
      setSelectedBranchId(currentBranch.id);
    }
  }, [currentBranch]);

  useEffect(() => {
    if (currentTerminal) {
      setSelectedTerminalId(currentTerminal.id);
    }
  }, [currentTerminal]);

  async function handleSelectBranch(branchId: string) {
    const branch = userBranches.find((b) => b.id === branchId);
    if (branch) {
      setSelectedBranchId(branch.id);
      await switchBranch(branch);
    }
  }

  function handleSelectTerminal(terminalId: string) {
    const terminal = terminals.find((t) => t.id === terminalId);
    if (terminal) {
      setSelectedTerminalId(terminal.id);
      switchTerminal(terminal);
    }
  }

  function handleContinue(destination: string = '/admin') {
    if (!selectedBranchId) {
      toast.error('Please select a branch');
      return;
    }
    router.push(destination);
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    toast.success('Signed out');
    router.push('/login');
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-bg-primary flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-accent-primary animate-spin" />
          <p className="text-xs text-text-muted">Loading available branches...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg-primary flex flex-col justify-between p-4 md:p-8">
      {/* Background Glow */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/3 w-[600px] h-[600px] bg-accent-primary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/3 w-[600px] h-[600px] bg-accent-secondary/5 rounded-full blur-3xl" />
      </div>

      {/* Header */}
      <header className="relative z-10 flex items-center justify-between max-w-5xl w-full mx-auto mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-accent-primary to-accent-secondary flex items-center justify-center shadow-lg shadow-accent-primary/25">
            <Building2 className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-black gradient-text">{RESTAURANT_NAME}</h1>
            <p className="text-xs text-text-muted">Select Branch & Terminal</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {userEmail && (
            <span className="text-xs text-text-muted hidden sm:inline">
              Logged in as <strong className="text-text-primary">{userEmail}</strong>
            </span>
          )}
          <button
            onClick={handleSignOut}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl glass glass-hover text-xs text-text-muted hover:text-accent-danger transition-colors cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 max-w-5xl w-full mx-auto flex-1 flex flex-col justify-center my-6 space-y-8">
        <div className="text-center space-y-2 max-w-lg mx-auto">
          <span className="text-[11px] font-bold uppercase tracking-widest text-accent-primary bg-accent-primary/10 px-3 py-1 rounded-full border border-accent-primary/20">
            Workstation Setup
          </span>
          <h2 className="text-2xl md:text-3xl font-black text-text-primary tracking-tight">
            Choose Your Operating Branch
          </h2>
          <p className="text-xs text-text-muted">
            All orders, invoices, tables, and reports will be scoped to this location.
          </p>
        </div>

        {/* Branch Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {userBranches.map((branch) => {
            const isSelected = selectedBranchId === branch.id;
            return (
              <div
                key={branch.id}
                onClick={() => handleSelectBranch(branch.id)}
                className={cn(
                  'rounded-3xl p-5 border transition-all duration-300 cursor-pointer relative overflow-hidden group',
                  isSelected
                    ? 'bg-gradient-to-br from-accent-primary/15 via-bg-secondary to-accent-secondary/15 border-accent-primary shadow-xl shadow-accent-primary/10 scale-[1.02]'
                    : 'glass glass-hover border-border hover:border-white/20'
                )}
              >
                {isSelected && (
                  <div className="absolute top-4 right-4 text-accent-primary">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                )}

                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div
                      className={cn(
                        'w-11 h-11 rounded-2xl flex items-center justify-center transition-colors',
                        isSelected
                          ? 'bg-accent-primary text-white shadow-lg shadow-accent-primary/30'
                          : 'bg-white/5 text-text-muted group-hover:text-text-primary'
                      )}
                    >
                      <Building2 className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-text-primary group-hover:text-accent-primary transition-colors">
                        {branch.name}
                      </h3>
                      <span className="font-mono text-[10px] font-bold text-text-muted bg-white/5 px-2 py-0.5 rounded border border-white/10">
                        {branch.code}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-1.5 text-xs text-text-muted pt-2 border-t border-border">
                    {branch.address && (
                      <p className="flex items-center gap-2 truncate">
                        <MapPin className="w-3.5 h-3.5 shrink-0 text-text-muted" />
                        <span className="truncate">{branch.address}</span>
                      </p>
                    )}
                    {branch.phone && (
                      <p className="flex items-center gap-2">
                        <Phone className="w-3.5 h-3.5 shrink-0 text-text-muted" />
                        <span>{branch.phone}</span>
                      </p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Terminal Selection (if branch is selected) */}
        {selectedBranchId && terminals.length > 0 && (
          <div className="rounded-3xl glass p-6 border border-border space-y-4 animate-slide-up">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Monitor className="w-4 h-4 text-accent-primary" />
                <h4 className="text-sm font-bold text-text-primary">Assign Active Terminal</h4>
              </div>
              <span className="text-[10px] text-text-muted">
                {terminals.length} available terminal(s)
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
              {terminals.map((terminal) => {
                const isTermSelected = selectedTerminalId === terminal.id;
                return (
                  <button
                    key={terminal.id}
                    onClick={() => handleSelectTerminal(terminal.id)}
                    className={cn(
                      'p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-2',
                      isTermSelected
                        ? 'bg-accent-primary/20 border-accent-primary text-text-primary shadow-sm'
                        : 'bg-white/[0.02] border-border text-text-muted hover:text-text-primary hover:bg-white/5'
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-white/5">
                        {terminal.code}
                      </span>
                      {isTermSelected && <CheckCircle2 className="w-3.5 h-3.5 text-accent-primary" />}
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-text-primary">{terminal.name}</p>
                      <p className="text-[10px] text-text-muted capitalize">{terminal.terminal_type} Terminal</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Launch Destination Actions */}
        <div className="pt-4 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-text-muted text-center sm:text-left">
            Ready to start operating? Choose your workstation view:
          </p>

          <div className="flex items-center gap-2.5 flex-wrap justify-center">
            <Button
              variant="primary"
              onClick={() => handleContinue('/pos')}
              icon={<ShoppingCart className="w-4 h-4" />}
              className="py-2.5 px-4 text-xs font-bold"
            >
              Open POS
            </Button>

            <Button
              variant="secondary"
              onClick={() => handleContinue('/kitchen')}
              icon={<ChefHat className="w-4 h-4 text-amber-400" />}
              className="py-2.5 px-4 text-xs"
            >
              Kitchen Display
            </Button>

            <Button
              variant="secondary"
              onClick={() => handleContinue('/display')}
              icon={<Tv className="w-4 h-4 text-emerald-400" />}
              className="py-2.5 px-4 text-xs"
            >
              Live Order Board
            </Button>

            {(userRole === 'admin' || userRole === 'super_admin') && (
              <Button
                variant="ghost"
                onClick={() => handleContinue('/admin')}
                icon={<LayoutDashboard className="w-4 h-4" />}
                className="py-2.5 px-4 text-xs text-text-muted hover:text-text-primary"
              >
                Admin Panel
              </Button>
            )}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 text-center py-4 text-[11px] text-text-muted">
        &copy; {new Date().getFullYear()} {RESTAURANT_NAME} &bull; Multi-Branch Enterprise POS
      </footer>
    </div>
  );
}
