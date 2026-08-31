'use client';

import React, { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { getUserProfile, updateUserProfile } from '@/app/actions/profile';
import { useBranch } from '@/context/BranchContext';
import { UserProfile, UserRoleType } from '@/types/database';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Badge from '@/components/ui/Badge';
import {
  UserCircle,
  User,
  Phone,
  Mail,
  Shield,
  Building2,
  Calendar,
  Save,
  Loader2,
  CheckCircle2,
  Clock,
  Edit3,
} from 'lucide-react';
import { toast } from 'sonner';
import { formatDate } from '@/lib/utils';

export default function ProfilePage() {
  const supabase = createClient();
  const { userRole, userBranches, refreshBranches } = useBranch();

  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [email, setEmail] = useState<string>('');
  const [createdDate, setCreatedDate] = useState<string>('');
  const [lastSignIn, setLastSignIn] = useState<string | null>(null);

  const [displayName, setDisplayName] = useState('');
  const [phone, setPhone] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadUserData();
  }, []);

  async function loadUserData() {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('Not authenticated');
        setLoading(false);
        return;
      }

      setUserId(user.id);
      setEmail(user.email || '');
      setCreatedDate(user.created_at || '');
      setLastSignIn(user.last_sign_in_at || null);

      // Fetch user profile row
      const res = await getUserProfile(user.id);
      if (res.profile) {
        setDisplayName(res.profile.display_name || '');
        setPhone(res.profile.phone || '');
      } else {
        // Fallback default display name from email prefix
        setDisplayName(user.email ? user.email.split('@')[0] : '');
      }
    } catch (err: any) {
      console.error('Error loading profile:', err);
      toast.error(err.message || 'Failed to load profile');
    }
    setLoading(false);
  }

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!userId) return;

    if (!displayName.trim()) {
      toast.error('Display Name cannot be empty');
      return;
    }

    setSaving(true);
    const res = await updateUserProfile(userId, {
      display_name: displayName.trim(),
      phone: phone.trim() || undefined,
    });
    setSaving(false);

    if (res.error) {
      toast.error(res.error);
    } else {
      toast.success('Profile updated successfully!');
      await refreshBranches(); // refresh context so sidebar name updates
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-80">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-accent-primary animate-spin" />
          <p className="text-xs text-text-muted">Loading user profile...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-full">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-text-primary">My Profile</h1>
        <p className="text-xs text-text-muted mt-0.5">
          View and update your personal information, unique phone number, and access credentials
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Profile Card */}
        <div className="md:col-span-1 rounded-3xl glass border border-border p-6 flex flex-col items-center text-center space-y-4 shadow-xl">
          <div className="w-24 h-24 rounded-full bg-gradient-to-br from-accent-primary to-accent-secondary flex items-center justify-center text-white shadow-xl shadow-accent-primary/20">
            <UserCircle className="w-16 h-16" />
          </div>

          <div className="space-y-1">
            <h2 className="text-lg font-bold text-text-primary">{displayName || email}</h2>
            <p className="text-xs text-text-muted">{email}</p>
          </div>

          <Badge
            variant={
              userRole === 'super_admin' || userRole === 'admin'
                ? 'completed'
                : userRole === 'pos'
                  ? 'default'
                  : userRole === 'kitchen'
                    ? 'preparing'
                    : 'served'
            }
            className="capitalize px-3 py-1 font-semibold text-xs"
          >
            <Shield className="w-3.5 h-3.5 mr-1" />
            {userRole === 'super_admin' ? 'Super Admin' : userRole === 'pos' ? 'POS Cashier' : userRole || 'Staff Member'}
          </Badge>

          <div className="w-full border-t border-border pt-4 text-left space-y-2 text-xs">
            <div className="flex items-center justify-between text-text-muted">
              <span className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5" />
                Joined:
              </span>
              <span className="font-medium text-text-primary">{createdDate ? formatDate(createdDate) : 'N/A'}</span>
            </div>

            <div className="flex items-center justify-between text-text-muted">
              <span className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" />
                Last Login:
              </span>
              <span className="font-medium text-text-primary">
                {lastSignIn ? formatDate(lastSignIn) : 'Current Session'}
              </span>
            </div>
          </div>
        </div>

        {/* Edit Form & Details */}
        <div className="md:col-span-2 space-y-6">
          {/* Edit Profile Details */}
          <form onSubmit={handleSaveProfile} className="rounded-3xl glass border border-border p-6 space-y-4 shadow-xl">
            <h3 className="text-sm font-bold text-text-primary flex items-center gap-2 border-b border-border pb-3">
              <Edit3 className="w-4 h-4 text-accent-primary" />
              Edit Personal Details
            </h3>

            <div className="space-y-4">
              <Input
                label="Full / Display Name *"
                placeholder="e.g. John Doe"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                icon={<User className="w-4 h-4" />}
                required
              />

              <Input
                label="Unique Phone Number (Can be used for Login)"
                placeholder="e.g. +94771234567 or 0771234567"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                icon={<Phone className="w-4 h-4" />}
              />

              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1">
                  Registered Email Address (Read-only)
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                  <input
                    type="text"
                    disabled
                    value={email}
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl text-xs bg-white/[0.03] border border-border text-text-muted cursor-not-allowed"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-3">
              <Button variant="primary" type="submit" loading={saving} icon={<Save className="w-4 h-4" />}>
                Save Profile Updates
              </Button>
            </div>
          </form>

          {/* Assigned Branches Info */}
          <div className="rounded-3xl glass border border-border p-6 space-y-3 shadow-xl">
            <h3 className="text-sm font-bold text-text-primary flex items-center gap-2 border-b border-border pb-3">
              <Building2 className="w-4 h-4 text-accent-primary" />
              Assigned Work Branches
            </h3>

            {userBranches.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {userBranches.map((b) => (
                  <div key={b.id} className="p-3 rounded-2xl bg-white/[0.03] border border-white/10 flex items-center gap-3">
                    <Building2 className="w-5 h-5 text-accent-primary shrink-0" />
                    <div>
                      <p className="font-bold text-xs text-text-primary">{b.name}</p>
                      <p className="font-mono text-[10px] text-text-muted">Code: {b.code}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-text-muted italic">Authorized for all active branches (Admin privilege).</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
