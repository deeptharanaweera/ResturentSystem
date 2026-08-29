'use client';

import React, { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useBranch } from '@/context/BranchContext';
import { Branch, Terminal, TerminalType } from '@/types/database';
import {
  Building2,
  Monitor,
  Plus,
  Edit2,
  Trash2,
  CheckCircle2,
  XCircle,
  MapPin,
  Phone,
  Layers,
  Search,
  Loader2,
  RefreshCw,
  Tv,
  ChefHat,
  ShoppingCart,
  Shield,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Modal from '@/components/ui/Modal';

export default function BranchesAdminPage() {
  const supabase = createClient();
  const { refreshBranches, userRole } = useBranch();
  const isSuperAdmin = userRole === 'super_admin';

  const [branches, setBranches] = useState<Branch[]>([]);
  const [terminals, setTerminals] = useState<Terminal[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBranchForTerminals, setSelectedBranchForTerminals] = useState<Branch | null>(null);

  // Branch Modal
  const [branchModalOpen, setBranchModalOpen] = useState(false);
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null);
  const [branchName, setBranchName] = useState('');
  const [branchCode, setBranchCode] = useState('');
  const [branchAddress, setBranchAddress] = useState('');
  const [branchPhone, setBranchPhone] = useState('');
  const [branchSaving, setBranchSaving] = useState(false);

  // Terminal Modal
  const [terminalModalOpen, setTerminalModalOpen] = useState(false);
  const [editingTerminal, setEditingTerminal] = useState<Terminal | null>(null);
  const [terminalName, setTerminalName] = useState('');
  const [terminalCode, setTerminalCode] = useState('');
  const [terminalType, setTerminalType] = useState<TerminalType>('pos');
  const [terminalSaving, setTerminalSaving] = useState(false);

  useEffect(() => {
    loadAllData();
  }, []);

  async function loadAllData() {
    setLoading(true);
    try {
      const { data: bData, error: bErr } = await supabase
        .from('branches')
        .select('*')
        .order('name');
      if (bErr) throw bErr;

      const { data: tData, error: tErr } = await supabase
        .from('terminals')
        .select('*')
        .order('name');
      if (tErr) throw tErr;

      setBranches(bData || []);
      setTerminals(tData || []);

      if (bData && bData.length > 0 && !selectedBranchForTerminals) {
        setSelectedBranchForTerminals(bData[0]);
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to load branches and terminals');
    } finally {
      setLoading(false);
    }
  }

  // --- Branch CRUD ---
  function openNewBranchModal() {
    setEditingBranch(null);
    setBranchName('');
    setBranchCode('');
    setBranchAddress('');
    setBranchPhone('');
    setBranchModalOpen(true);
  }

  function openEditBranchModal(b: Branch) {
    setEditingBranch(b);
    setBranchName(b.name);
    setBranchCode(b.code);
    setBranchAddress(b.address || '');
    setBranchPhone(b.phone || '');
    setBranchModalOpen(true);
  }

  async function handleSaveBranch() {
    if (!isSuperAdmin) {
      toast.error('Only Super Admins can create or update branches');
      return;
    }

    if (!branchName.trim() || !branchCode.trim()) {
      toast.error('Branch Name and Code are required');
      return;
    }

    setBranchSaving(true);
    try {
      if (editingBranch) {
        const { error } = await supabase
          .from('branches')
          .update({
            name: branchName.trim(),
            code: branchCode.trim().toUpperCase(),
            address: branchAddress.trim() || null,
            phone: branchPhone.trim() || null,
          })
          .eq('id', editingBranch.id);
        if (error) throw error;
        toast.success('Branch updated!');
      } else {
        const { data: newB, error } = await supabase
          .from('branches')
          .insert({
            name: branchName.trim(),
            code: branchCode.trim().toUpperCase(),
            address: branchAddress.trim() || null,
            phone: branchPhone.trim() || null,
            is_active: true,
          })
          .select()
          .single();
        if (error) throw error;

        // Auto-create default POS terminal for new branch
        if (newB) {
          await supabase.from('terminals').insert({
            branch_id: newB.id,
            name: 'Main POS 1',
            code: 'POS-01',
            terminal_type: 'pos',
            is_active: true,
          });
        }
        toast.success('Branch created with default terminal!');
      }

      setBranchModalOpen(false);
      await loadAllData();
      await refreshBranches();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Failed to save branch');
    }
    setBranchSaving(false);
  }

  async function toggleBranchStatus(branch: Branch) {
    if (!isSuperAdmin) {
      toast.error('Only Super Admins can modify branch status');
      return;
    }

    try {
      const { error } = await supabase
        .from('branches')
        .update({ is_active: !branch.is_active })
        .eq('id', branch.id);
      if (error) throw error;

      toast.success(`Branch ${branch.is_active ? 'deactivated' : 'activated'}`);
      await loadAllData();
      await refreshBranches();
    } catch (err) {
      console.error(err);
      toast.error('Failed to update status');
    }
  }

  // --- Terminal CRUD ---
  function openNewTerminalModal(branch: Branch) {
    setSelectedBranchForTerminals(branch);
    setEditingTerminal(null);
    setTerminalName('');
    setTerminalCode('');
    setTerminalType('pos');
    setTerminalModalOpen(true);
  }

  function openEditTerminalModal(t: Terminal) {
    setEditingTerminal(t);
    setTerminalName(t.name);
    setTerminalCode(t.code);
    setTerminalType(t.terminal_type);
    setTerminalModalOpen(true);
  }

  async function handleSaveTerminal() {
    if (!isSuperAdmin) {
      toast.error('Only Super Admins can create or update terminals');
      return;
    }

    if (!selectedBranchForTerminals || !terminalName.trim() || !terminalCode.trim()) {
      toast.error('Name and Code are required');
      return;
    }

    setTerminalSaving(true);
    try {
      if (editingTerminal) {
        const { error } = await supabase
          .from('terminals')
          .update({
            name: terminalName.trim(),
            code: terminalCode.trim().toUpperCase(),
            terminal_type: terminalType,
          })
          .eq('id', editingTerminal.id);
        if (error) throw error;
        toast.success('Terminal updated!');
      } else {
        const { error } = await supabase.from('terminals').insert({
          branch_id: selectedBranchForTerminals.id,
          name: terminalName.trim(),
          code: terminalCode.trim().toUpperCase(),
          terminal_type: terminalType,
          is_active: true,
        });
        if (error) throw error;
        toast.success('Terminal added!');
      }

      setTerminalModalOpen(false);
      await loadAllData();
      await refreshBranches();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Failed to save terminal');
    }
    setTerminalSaving(false);
  }

  async function toggleTerminalStatus(terminal: Terminal) {
    if (!isSuperAdmin) {
      toast.error('Only Super Admins can modify terminal status');
      return;
    }

    try {
      const { error } = await supabase
        .from('terminals')
        .update({ is_active: !terminal.is_active })
        .eq('id', terminal.id);
      if (error) throw error;

      toast.success(`Terminal ${terminal.is_active ? 'deactivated' : 'activated'}`);
      await loadAllData();
      await refreshBranches();
    } catch (err) {
      console.error(err);
      toast.error('Failed to update status');
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-80">
        <Loader2 className="w-8 h-8 text-accent-primary animate-spin" />
      </div>
    );
  }

  const branchTerminals = terminals.filter((t) => t.branch_id === selectedBranchForTerminals?.id);

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-text-primary">Branches & Terminals</h1>
          <p className="text-xs text-text-muted mt-0.5">
            Manage multi-branch locations, workstation terminals, and operating configurations
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={loadAllData}
            icon={<RefreshCw className="w-3.5 h-3.5" />}
          >
            Refresh
          </Button>
          {isSuperAdmin ? (
            <Button
              variant="primary"
              size="sm"
              onClick={openNewBranchModal}
              icon={<Plus className="w-4 h-4" />}
            >
              Add Branch
            </Button>
          ) : (
            <span className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs bg-white/[0.04] border border-white/10 text-text-muted">
              <Shield className="w-3.5 h-3.5 text-fuchsia-400" />
              Super Admin Only
            </span>
          )}
        </div>
      </div>

      {/* Grid Layout: Branches on Left, Terminals on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Branches List (5 cols) */}
        <div className="lg:col-span-5 space-y-3">
          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-bold uppercase tracking-wider text-text-muted">
              All Branches ({branches.length})
            </span>
          </div>

          <div className="space-y-3">
            {branches.map((branch) => {
              const isSelected = selectedBranchForTerminals?.id === branch.id;
              const countTerminals = terminals.filter((t) => t.branch_id === branch.id).length;

              return (
                <div
                  key={branch.id}
                  onClick={() => setSelectedBranchForTerminals(branch)}
                  className={cn(
                    'rounded-2xl p-4 border transition-all cursor-pointer space-y-3 relative overflow-hidden',
                    isSelected
                      ? 'bg-accent-primary/10 border-accent-primary shadow-lg shadow-accent-primary/5'
                      : 'glass glass-hover border-border hover:border-white/20'
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <div
                        className={cn(
                          'w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm',
                          isSelected
                            ? 'bg-accent-primary text-white shadow-md shadow-accent-primary/30'
                            : 'bg-white/5 text-text-muted'
                        )}
                      >
                        <Building2 className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-bold text-text-primary">{branch.name}</h3>
                          <span className="font-mono text-[10px] font-bold text-text-muted bg-white/5 px-1.5 py-0.2 rounded border border-white/10">
                            {branch.code}
                          </span>
                        </div>
                        <span className="text-[11px] text-text-muted">
                          {countTerminals} terminal(s) configured
                        </span>
                      </div>
                    </div>

                    {isSuperAdmin && (
                      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => openEditBranchModal(branch)}
                          className="p-1.5 rounded-lg hover:bg-white/10 text-text-muted hover:text-text-primary transition-colors cursor-pointer"
                          title="Edit Branch"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => toggleBranchStatus(branch)}
                          className={cn(
                            'p-1.5 rounded-lg transition-colors cursor-pointer',
                            branch.is_active
                              ? 'text-emerald-400 hover:bg-emerald-500/10'
                              : 'text-text-muted hover:bg-white/10'
                          )}
                          title={branch.is_active ? 'Active' : 'Inactive'}
                        >
                          {branch.is_active ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                        </button>
                      </div>
                    )}
                  </div>

                  {(branch.address || branch.phone) && (
                    <div className="pt-2 border-t border-white/[0.06] text-xs text-text-muted space-y-1">
                      {branch.address && (
                        <p className="flex items-center gap-2 truncate">
                          <MapPin className="w-3 h-3 text-text-muted shrink-0" />
                          <span className="truncate">{branch.address}</span>
                        </p>
                      )}
                      {branch.phone && (
                        <p className="flex items-center gap-2">
                          <Phone className="w-3 h-3 text-text-muted shrink-0" />
                          <span>{branch.phone}</span>
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Terminals for Selected Branch (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          {selectedBranchForTerminals ? (
            <div className="rounded-3xl glass p-6 border border-border space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border">
                <div>
                  <div className="flex items-center gap-2">
                    <Monitor className="w-5 h-5 text-accent-primary" />
                    <h2 className="text-base font-bold text-text-primary">
                      Terminals for {selectedBranchForTerminals.name}
                    </h2>
                  </div>
                  <p className="text-xs text-text-muted mt-0.5">
                    POS counters, Kitchen displays, and order monitors operating under {selectedBranchForTerminals.code}
                  </p>
                </div>

                {isSuperAdmin && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => openNewTerminalModal(selectedBranchForTerminals)}
                    icon={<Plus className="w-4 h-4" />}
                  >
                    Add Terminal
                  </Button>
                )}
              </div>

              {branchTerminals.length === 0 ? (
                <div className="text-center py-12 text-text-muted text-xs space-y-2">
                  <Monitor className="w-8 h-8 mx-auto opacity-30" />
                  <p>No terminals configured for this branch yet.</p>
                  {isSuperAdmin && (
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => openNewTerminalModal(selectedBranchForTerminals)}
                      icon={<Plus className="w-3.5 h-3.5" />}
                    >
                      Add First Terminal
                    </Button>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {branchTerminals.map((terminal) => {
                    const TypeIcon =
                      terminal.terminal_type === 'pos'
                        ? ShoppingCart
                        : terminal.terminal_type === 'kitchen'
                        ? ChefHat
                        : terminal.terminal_type === 'display'
                        ? Tv
                        : Shield;

                    return (
                      <div
                        key={terminal.id}
                        className="rounded-2xl bg-white/[0.02] border border-border p-4 space-y-3 hover:bg-white/[0.04] transition-all"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-xl bg-accent-primary/15 text-accent-primary flex items-center justify-center">
                              <TypeIcon className="w-4 h-4" />
                            </div>
                            <div>
                              <p className="text-xs font-bold text-text-primary">{terminal.name}</p>
                              <span className="font-mono text-[10px] text-text-muted uppercase font-bold">
                                {terminal.code}
                              </span>
                            </div>
                          </div>

                          {isSuperAdmin && (
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => openEditTerminalModal(terminal)}
                                className="p-1 rounded-lg hover:bg-white/10 text-text-muted hover:text-text-primary transition-colors cursor-pointer"
                                title="Edit Terminal"
                              >
                                <Edit2 className="w-3 h-3" />
                              </button>
                              <button
                                onClick={() => toggleTerminalStatus(terminal)}
                                className={cn(
                                  'p-1 rounded-lg transition-colors cursor-pointer',
                                  terminal.is_active ? 'text-emerald-400' : 'text-text-muted'
                                )}
                                title={terminal.is_active ? 'Active' : 'Inactive'}
                              >
                                {terminal.is_active ? (
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                ) : (
                                  <XCircle className="w-3.5 h-3.5" />
                                )}
                              </button>
                            </div>
                          )}
                        </div>

                        <div className="pt-2 border-t border-white/[0.04] flex items-center justify-between text-[11px] text-text-muted">
                          <span className="capitalize">{terminal.terminal_type} Workstation</span>
                          <span
                            className={cn(
                              'px-2 py-0.5 rounded-full text-[10px] font-bold',
                              terminal.is_active
                                ? 'bg-emerald-500/10 text-emerald-400'
                                : 'bg-white/5 text-text-muted'
                            )}
                          >
                            {terminal.is_active ? 'Active' : 'Disabled'}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            <div className="glass rounded-3xl p-12 text-center text-text-muted text-xs">
              Select a branch on the left to view its terminals.
            </div>
          )}
        </div>
      </div>

      {/* BRANCH MODAL */}
      <Modal
        isOpen={branchModalOpen}
        onClose={() => setBranchModalOpen(false)}
        title={editingBranch ? 'Edit Branch Location' : 'Add New Branch Location'}
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-text-secondary mb-1.5">
              Branch Name <span className="text-accent-danger">*</span>
            </label>
            <Input
              value={branchName}
              onChange={(e) => setBranchName(e.target.value)}
              placeholder="e.g. City Center Branch"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-text-secondary mb-1.5">
              Branch Code (Unique) <span className="text-accent-danger">*</span>
            </label>
            <Input
              value={branchCode}
              onChange={(e) => setBranchCode(e.target.value.toUpperCase())}
              placeholder="e.g. CC01, MAIN, DOWNTOWN"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-text-secondary mb-1.5">
              Address (Optional)
            </label>
            <Input
              value={branchAddress}
              onChange={(e) => setBranchAddress(e.target.value)}
              placeholder="e.g. 45 Galleria Mall, Level 2"
              icon={<MapPin className="w-4 h-4" />}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-text-secondary mb-1.5">
              Phone Number (Optional)
            </label>
            <Input
              value={branchPhone}
              onChange={(e) => setBranchPhone(e.target.value)}
              placeholder="e.g. +94 11 987 6543"
              icon={<Phone className="w-4 h-4" />}
            />
          </div>

          <div className="pt-2 flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setBranchModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleSaveBranch} loading={branchSaving}>
              Save Branch
            </Button>
          </div>
        </div>
      </Modal>

      {/* TERMINAL MODAL */}
      <Modal
        isOpen={terminalModalOpen}
        onClose={() => setTerminalModalOpen(false)}
        title={
          editingTerminal
            ? 'Edit Terminal Workstation'
            : `Add Terminal to ${selectedBranchForTerminals?.name || 'Branch'}`
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-text-secondary mb-1.5">
              Terminal Name <span className="text-accent-danger">*</span>
            </label>
            <Input
              value={terminalName}
              onChange={(e) => setTerminalName(e.target.value)}
              placeholder="e.g. POS Counter 1, Kitchen Screen 2"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-text-secondary mb-1.5">
              Terminal Code <span className="text-accent-danger">*</span>
            </label>
            <Input
              value={terminalCode}
              onChange={(e) => setTerminalCode(e.target.value.toUpperCase())}
              placeholder="e.g. POS-01, KITCHEN-01, DISPLAY-01"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-text-secondary mb-1.5">
              Terminal Type
            </label>
            <select
              value={terminalType}
              onChange={(e) => setTerminalType(e.target.value as TerminalType)}
              className="w-full px-3.5 py-2.5 rounded-xl text-xs bg-bg-secondary border border-border text-text-primary focus:outline-none focus:border-accent-primary/50 cursor-pointer"
            >
              <option value="pos">POS Counter Workstation</option>
              <option value="kitchen">Kitchen Display Screen (KDS)</option>
              <option value="display">Customer Live Order Display</option>
              <option value="waiter">Waiter Order Tablet</option>
              <option value="admin">Manager / Admin Terminal</option>
            </select>
          </div>

          <div className="pt-2 flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setTerminalModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleSaveTerminal} loading={terminalSaving}>
              Save Terminal
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
