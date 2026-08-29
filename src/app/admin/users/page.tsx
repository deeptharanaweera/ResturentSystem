'use client';

import React, { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { UserRoleType, Branch } from '@/types/database';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Badge from '@/components/ui/Badge';
import Modal from '@/components/ui/Modal';
import {
  UserPlus,
  Shield,
  User,
  Mail,
  Lock,
  Loader2,
  Building2,
  Check,
  Edit2,
  KeyRound,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Search,
  Eye,
  EyeOff,
  Clock,
} from 'lucide-react';
import { toast } from 'sonner';
import { useBranch } from '@/context/BranchContext';
import {
  getStaffUsersWithDetails,
  createStaffUser,
  updateStaffPassword,
  toggleStaffActive,
  updateUserBranches,
  StaffUserRecord,
} from '@/app/actions/users';
import { cn, formatDate } from '@/lib/utils';

export default function UsersManagementPage() {
  const supabase = createClient();
  const { userRole } = useBranch();
  const isSuperAdmin = userRole === 'super_admin';

  const [users, setUsers] = useState<StaffUserRecord[]>([]);
  const [allBranches, setAllBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Add Staff Modal
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [form, setForm] = useState({
    email: '',
    password: '',
    role: 'waiter' as UserRoleType,
    selectedBranchIds: [] as string[],
  });

  // Edit Branch Modal
  const [editBranchUser, setEditBranchUser] = useState<StaffUserRecord | null>(null);
  const [selectedBranchIdsForEdit, setSelectedBranchIdsForEdit] = useState<string[]>([]);
  const [savingBranches, setSavingBranches] = useState(false);

  // Reset Password Modal
  const [resetPassUser, setResetPassUser] = useState<StaffUserRecord | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  // Status toggle in progress
  const [togglingId, setTogglingId] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    try {
      // 1. Fetch active branches
      const { data: bData } = await supabase.from('branches').select('*').eq('is_active', true).order('name');
      const branchList = bData || [];
      setAllBranches(branchList);

      // Default select first branch for new user form
      if (branchList.length > 0 && form.selectedBranchIds.length === 0) {
        setForm((f) => ({ ...f, selectedBranchIds: [branchList[0].id] }));
      }

      // 2. Fetch staff users with emails via server action
      const res = await getStaffUsersWithDetails();
      if (res.error) throw new Error(res.error);
      setUsers(res.users || []);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Failed to load staff members');
    }
    setLoading(false);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!form.email || !form.password) {
      toast.error('Email and password required');
      return;
    }
    if (form.password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }

    if (form.role === 'super_admin' && !isSuperAdmin) {
      toast.error('Only Super Admins can create Super Admin accounts');
      return;
    }

    setIsSubmitting(true);
    const result = await createStaffUser(form.email, form.password, form.role, form.selectedBranchIds);
    setIsSubmitting(false);

    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success('Staff user created successfully');
      setAddModalOpen(false);
      setForm({
        email: '',
        password: '',
        role: 'waiter',
        selectedBranchIds: allBranches.length > 0 ? [allBranches[0].id] : [],
      });
      fetchData();
    }
  }

  async function handleToggleStatus(user: StaffUserRecord) {
    if (user.role === 'super_admin' && !isSuperAdmin) {
      toast.error('Only Super Admins can modify Super Admin accounts');
      return;
    }

    const newStatus = !user.is_active;
    setTogglingId(user.user_id);
    const res = await toggleStaffActive(user.user_id, newStatus);
    setTogglingId(null);

    if (res.error) {
      toast.error(res.error);
    } else {
      toast.success(`Account for ${user.email} marked ${newStatus ? 'Active' : 'Inactive'}`);
      setUsers((prev) =>
        prev.map((u) => (u.user_id === user.user_id ? { ...u, is_active: newStatus } : u))
      );
    }
  }

  function openPasswordModal(user: StaffUserRecord) {
    if (user.role === 'super_admin' && !isSuperAdmin) {
      toast.error('Only Super Admins can reset Super Admin passwords');
      return;
    }
    setResetPassUser(user);
    setNewPassword('');
    setConfirmPassword('');
    setShowPassword(false);
  }

  async function handleSavePassword(e: React.FormEvent) {
    e.preventDefault();
    if (!resetPassUser) return;
    if (resetPassUser.role === 'super_admin' && !isSuperAdmin) {
      toast.error('Only Super Admins can reset Super Admin passwords');
      return;
    }

    if (!newPassword || newPassword.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    setSavingPassword(true);
    const res = await updateStaffPassword(resetPassUser.user_id, newPassword);
    setSavingPassword(false);

    if (res.error) {
      toast.error(res.error);
    } else {
      toast.success(`Password updated for ${resetPassUser.email}`);
      setResetPassUser(null);
    }
  }

  function openEditBranches(user: StaffUserRecord) {
    if (user.role === 'super_admin' && !isSuperAdmin) {
      toast.error('Only Super Admins can edit Super Admin branch assignments');
      return;
    }
    setEditBranchUser(user);
    setSelectedBranchIdsForEdit(user.branches.map((b) => b.id));
  }

  async function handleSaveUserBranches() {
    if (!editBranchUser) return;
    if (editBranchUser.role === 'super_admin' && !isSuperAdmin) {
      toast.error('Only Super Admins can edit Super Admin branch assignments');
      return;
    }
    setSavingBranches(true);
    const res = await updateUserBranches(editBranchUser.user_id, selectedBranchIdsForEdit);
    setSavingBranches(false);

    if (res.error) {
      toast.error(res.error);
    } else {
      toast.success('Branch assignments updated!');
      setEditBranchUser(null);
      fetchData();
    }
  }

  function toggleFormBranch(branchId: string) {
    setForm((prev) => {
      const exists = prev.selectedBranchIds.includes(branchId);
      if (exists) {
        return { ...prev, selectedBranchIds: prev.selectedBranchIds.filter((id) => id !== branchId) };
      } else {
        return { ...prev, selectedBranchIds: [...prev.selectedBranchIds, branchId] };
      }
    });
  }

  function toggleEditBranch(branchId: string) {
    setSelectedBranchIdsForEdit((prev) => {
      if (prev.includes(branchId)) {
        return prev.filter((id) => id !== branchId);
      } else {
        return [...prev, branchId];
      }
    });
  }

  const filteredUsers = users.filter((u) => {
    // Only super admin can see super admin accounts
    if (!isSuperAdmin && u.role === 'super_admin') {
      return false;
    }

    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      u.email.toLowerCase().includes(q) ||
      u.role.toLowerCase().includes(q) ||
      u.branches.some((b) => b.name.toLowerCase().includes(q) || b.code.toLowerCase().includes(q))
    );
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-80">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-accent-primary animate-spin" />
          <p className="text-xs text-text-muted">Loading staff accounts...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-text-primary">Staff Management</h1>
          <p className="text-xs text-text-muted mt-0.5">
            Manage employee access, roles, branches, status, and manual password resets
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={fetchData}
            icon={<RefreshCw className="w-3.5 h-3.5" />}
          >
            Refresh
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => setAddModalOpen(true)}
            icon={<UserPlus className="w-4 h-4" />}
          >
            Add Staff Member
          </Button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative max-w-md">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
        <input
          type="text"
          placeholder="Search staff by email, role, or branch..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 rounded-xl text-xs bg-bg-secondary border border-border text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent-primary/50 transition-colors"
        />
      </div>

      {/* Staff Table */}
      <div className="rounded-3xl glass border border-border overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-border bg-white/[0.02] text-text-muted uppercase font-bold tracking-wider text-[10px]">
                <th className="py-3.5 px-4">Staff Member / Email</th>
                <th className="py-3.5 px-4">Role</th>
                <th className="py-3.5 px-4">Assigned Branches</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4">Created Date</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-text-muted">
                    <User className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    <p className="font-semibold text-sm">No staff users found</p>
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => {
                  const isToggling = togglingId === user.user_id;

                  return (
                    <tr key={user.user_id} className="hover:bg-white/[0.02] transition-colors">
                      {/* Email / User */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-accent-primary/15 text-accent-primary flex items-center justify-center font-bold text-xs shrink-0">
                            {user.email.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="font-bold text-text-primary truncate">{user.email}</p>
                            <span className="font-mono text-[10px] text-text-muted">
                              ID: {user.user_id.substring(0, 8)}...
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Role */}
                      <td className="py-3.5 px-4">
                        <Badge
                          variant={
                            user.role === 'super_admin' || user.role === 'admin'
                              ? 'completed'
                              : user.role === 'pos'
                              ? 'default'
                              : user.role === 'kitchen'
                              ? 'preparing'
                              : 'served'
                          }
                          className={cn(
                            'capitalize font-semibold text-[10px]',
                            user.role === 'super_admin' && 'bg-fuchsia-500/10 text-fuchsia-400 border border-fuchsia-500/25 font-bold',
                            user.role === 'pos' && 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20'
                          )}
                        >
                          {user.role === 'super_admin' ? 'Super Admin' : user.role === 'pos' ? 'POS Cashier' : user.role}
                        </Badge>
                      </td>

                      {/* Branches */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1.5 flex-wrap max-w-xs">
                          {user.branches.length > 0 ? (
                            user.branches.map((b) => (
                              <span
                                key={b.id}
                                className="font-mono text-[10px] font-bold px-2 py-0.5 rounded bg-white/5 border border-white/10 text-text-secondary"
                              >
                                {b.name} ({b.code})
                              </span>
                            ))
                          ) : (
                            <span className="text-[11px] text-text-muted italic">All Branches</span>
                          )}
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4">
                        <span
                          className={cn(
                            'inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold',
                            user.is_active
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              : 'bg-accent-danger/10 text-accent-danger border border-accent-danger/20'
                          )}
                        >
                          <span
                            className={cn(
                              'w-1.5 h-1.5 rounded-full',
                              user.is_active ? 'bg-emerald-400' : 'bg-accent-danger'
                            )}
                          />
                          {user.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>

                      {/* Created Date */}
                      <td className="py-3.5 px-4 text-text-muted text-[11px]">
                        {formatDate(user.created_at)}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Active / Inactive Toggle Button */}
                          <button
                            onClick={() => handleToggleStatus(user)}
                            disabled={isToggling}
                            className={cn(
                              'px-2.5 py-1.5 rounded-xl border text-[11px] font-semibold transition-all cursor-pointer flex items-center gap-1',
                              user.is_active
                                ? 'bg-white/[0.03] border-border text-text-muted hover:text-accent-danger hover:border-accent-danger/30 hover:bg-accent-danger/10'
                                : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20'
                            )}
                            title={user.is_active ? 'Deactivate user' : 'Activate user'}
                          >
                            {isToggling ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : user.is_active ? (
                              <>
                                <XCircle className="w-3 h-3 text-accent-danger" />
                                <span>Deactivate</span>
                              </>
                            ) : (
                              <>
                                <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                                <span>Activate</span>
                              </>
                            )}
                          </button>

                          {/* Branches Assignment Button */}
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => openEditBranches(user)}
                            className="py-1 px-2.5 text-[11px]"
                            icon={<Building2 className="w-3 h-3 text-accent-primary" />}
                          >
                            Branches
                          </Button>

                          {/* Password Reset Button */}
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => openPasswordModal(user)}
                            className="py-1 px-2.5 text-[11px]"
                            icon={<KeyRound className="w-3 h-3 text-amber-400" />}
                          >
                            Reset Password
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* RESET PASSWORD MODAL */}
      <Modal
        isOpen={Boolean(resetPassUser)}
        onClose={() => setResetPassUser(null)}
        title={`Reset Password — ${resetPassUser?.email}`}
      >
        <form onSubmit={handleSavePassword} className="space-y-4">
          <p className="text-xs text-text-muted">
            Manually enter a new secure password for <strong>{resetPassUser?.email}</strong>.
          </p>

          <div className="relative">
            <label className="block text-xs font-semibold text-text-secondary mb-1.5">
              New Password <span className="text-accent-danger">*</span>
            </label>
            <div className="relative">
              <Input
                type={showPassword ? 'text' : 'password'}
                placeholder="Enter new password (min 6 characters)"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                icon={<Lock className="w-4 h-4" />}
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary transition-colors cursor-pointer"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-text-secondary mb-1.5">
              Confirm New Password <span className="text-accent-danger">*</span>
            </label>
            <Input
              type={showPassword ? 'text' : 'password'}
              placeholder="Re-type new password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              icon={<Lock className="w-4 h-4" />}
              required
            />
          </div>

          <div className="flex justify-end gap-2 pt-3">
            <Button variant="ghost" onClick={() => setResetPassUser(null)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" loading={savingPassword} icon={<KeyRound className="w-4 h-4" />}>
              Save New Password
            </Button>
          </div>
        </form>
      </Modal>

      {/* ASSIGN BRANCHES MODAL */}
      <Modal
        isOpen={Boolean(editBranchUser)}
        onClose={() => setEditBranchUser(null)}
        title={`Branch Access — ${editBranchUser?.email}`}
      >
        <div className="space-y-4">
          <p className="text-xs text-text-muted">
            Select the branch locations <strong>{editBranchUser?.email}</strong> is authorized to access:
          </p>

          <div className="grid grid-cols-1 gap-2">
            {allBranches.map((branch) => {
              const isSelected = selectedBranchIdsForEdit.includes(branch.id);
              return (
                <button
                  key={branch.id}
                  type="button"
                  onClick={() => toggleEditBranch(branch.id)}
                  className={cn(
                    'p-3 rounded-xl text-xs font-medium border text-left flex items-center justify-between transition-all cursor-pointer',
                    isSelected
                      ? 'bg-accent-primary/15 border-accent-primary text-text-primary shadow-sm'
                      : 'bg-bg-secondary border-border text-text-muted hover:text-text-primary'
                  )}
                >
                  <div className="flex items-center gap-2.5">
                    <Building2 className="w-4 h-4 text-accent-primary" />
                    <div>
                      <p className="font-bold text-text-primary">{branch.name}</p>
                      <p className="font-mono text-[10px] text-text-muted">
                        {branch.code} {branch.address ? `• ${branch.address}` : ''}
                      </p>
                    </div>
                  </div>
                  {isSelected && <Check className="w-4 h-4 text-accent-primary" />}
                </button>
              );
            })}
          </div>

          <div className="flex justify-end gap-2 pt-3">
            <Button variant="ghost" onClick={() => setEditBranchUser(null)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleSaveUserBranches} loading={savingBranches}>
              Save Branch Access
            </Button>
          </div>
        </div>
      </Modal>

      {/* ADD STAFF MEMBER MODAL */}
      <Modal isOpen={addModalOpen} onClose={() => setAddModalOpen(false)} title="Add Staff Member" size="md">
        <form onSubmit={handleCreate} className="space-y-4">
          <Input
            label="Email Address"
            type="email"
            placeholder="staff@restaurant.com"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            icon={<Mail className="w-4 h-4" />}
            required
          />
          <Input
            label="Initial Password (min 6 chars)"
            type="password"
            placeholder="••••••••"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            icon={<Lock className="w-4 h-4" />}
            required
          />

          {/* Role Selection */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-text-secondary">Role</label>
            <div className={cn('grid gap-2', isSuperAdmin ? 'grid-cols-2 sm:grid-cols-5' : 'grid-cols-2 sm:grid-cols-4')}>
              {(
                (isSuperAdmin
                  ? ['super_admin', 'admin', 'pos', 'kitchen', 'waiter']
                  : ['admin', 'pos', 'kitchen', 'waiter']) as UserRoleType[]
              ).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setForm({ ...form, role: r })}
                  className={cn(
                    'px-2 py-2 rounded-xl text-xs font-semibold border transition-all cursor-pointer capitalize text-center',
                    form.role === r
                      ? 'bg-accent-primary/10 border-accent-primary text-accent-primary'
                      : 'bg-bg-tertiary border-border text-text-muted hover:border-text-muted/30'
                  )}
                >
                  {r === 'super_admin' ? 'Super Admin' : r === 'pos' ? 'POS Cashier' : r}
                </button>
              ))}
            </div>
          </div>

          {/* Branch Assignments */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-text-secondary">
              Assign Branches
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {allBranches.map((branch) => {
                const isSelected = form.selectedBranchIds.includes(branch.id);
                return (
                  <button
                    key={branch.id}
                    type="button"
                    onClick={() => toggleFormBranch(branch.id)}
                    className={cn(
                      'p-2.5 rounded-xl text-xs font-medium border text-left flex items-center justify-between transition-all cursor-pointer',
                      isSelected
                        ? 'bg-accent-primary/15 border-accent-primary text-text-primary'
                        : 'bg-bg-tertiary border-border text-text-muted hover:text-text-primary'
                    )}
                  >
                    <div>
                      <p className="font-semibold text-text-primary">{branch.name}</p>
                      <p className="font-mono text-[10px] text-text-muted">{branch.code}</p>
                    </div>
                    {isSelected && <Check className="w-4 h-4 text-accent-primary" />}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button variant="ghost" onClick={() => setAddModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" loading={isSubmitting}>
              Create User
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
