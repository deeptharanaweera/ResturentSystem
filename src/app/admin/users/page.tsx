'use client';

import React, { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { UserRole, UserRoleType } from '@/types/database';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Badge from '@/components/ui/Badge';
import Modal from '@/components/ui/Modal';
import { UserPlus, Trash2, Shield, User, Mail, Lock, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { createStaffUser, deleteStaffUser } from '@/app/actions/users';
import { cn } from '@/lib/utils';

export default function UsersManagementPage() {
  const supabase = createClient();
  const [users, setUsers] = useState<(UserRole & { email?: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [form, setForm] = useState({
    email: '',
    password: '',
    role: 'waiter' as UserRoleType,
  });

  useEffect(() => {
    fetchUsers();
  }, []);

  async function fetchUsers() {
    // Note: We can't fetch emails from auth.users via the standard client.
    // However, for this UI, we'll fetch from user_roles and then maybe the admin 
    // needs to look at the Supabase dashboard for details, OR we could have a server 
    // component fetch them. For simplicity in this demo, we'll just show the roles.
    // To show emails, we'd need a server-side fetch.
    
    // I'll update this to a server-side fetch in a real app, but for now 
    // let's at least get the roles and maybe the user ID.
    const { data, error } = await supabase
      .from('user_roles')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error) {
      setUsers(data as any);
    }
    setLoading(false);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!form.email || !form.password) {
      toast.error('Email and password required');
      return;
    }

    setIsSubmitting(true);
    const result = await createStaffUser(form.email, form.password, form.role);
    setIsSubmitting(false);

    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success('Staff user created successfully');
      setModalOpen(false);
      setForm({ email: '', password: '', role: 'waiter' });
      fetchUsers();
    }
  }

  async function handleDelete(userId: string) {
    if (!confirm('Are you sure you want to delete this user?')) return;
    
    const result = await deleteStaffUser(userId);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success('User deleted');
      fetchUsers();
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-accent-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Staff Management</h1>
          <p className="text-sm text-text-muted mt-1">Manage admin, kitchen, and waiter accounts</p>
        </div>
        <Button variant="primary" onClick={() => setModalOpen(true)} icon={<UserPlus className="w-4 h-4" />}>
          Add Staff
        </Button>
      </div>

      <div className="space-y-3">
        {users.length === 0 ? (
          <Card className="text-center py-12">
            <User className="w-10 h-10 text-text-muted/30 mx-auto mb-3" />
            <p className="text-text-muted text-sm">No staff users found</p>
          </Card>
        ) : (
          users.map((user) => (
            <Card key={user.id} className="animate-slide-up">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-accent-primary/10 flex items-center justify-center">
                  <User className="w-5 h-5 text-accent-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-text-primary truncate">
                      User ID: {user.user_id.substring(0, 8)}...
                    </p>
                    <Badge 
                      variant={user.role === 'admin' ? 'completed' : user.role === 'kitchen' ? 'preparing' : 'served'}
                    >
                      {user.role}
                    </Badge>
                  </div>
                  <p className="text-xs text-text-muted">Joined {new Date(user.created_at).toLocaleDateString()}</p>
                </div>
                <button
                  onClick={() => handleDelete(user.user_id)}
                  className="p-2 rounded-lg glass glass-hover text-text-muted hover:text-accent-danger transition-all cursor-pointer"
                  title="Delete User"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </Card>
          ))
        )}
      </div>

      {/* Add Staff Modal */}
      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title="Add Staff Member" size="md">
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
            label="Initial Password"
            type="password"
            placeholder="••••••••"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            icon={<Lock className="w-4 h-4" />}
            required
          />
          
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-text-secondary">Role</label>
            <div className="grid grid-cols-3 gap-2">
              {(['admin', 'kitchen', 'waiter'] as UserRoleType[]).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setForm({ ...form, role: r })}
                  className={cn(
                    'px-3 py-2 rounded-xl text-xs font-medium border transition-all cursor-pointer capitalize',
                    form.role === r
                      ? 'bg-accent-primary/10 border-accent-primary text-accent-primary'
                      : 'bg-bg-tertiary border-border text-text-muted hover:border-text-muted/30'
                  )}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button variant="ghost" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button variant="primary" type="submit" loading={isSubmitting}>
              Create User
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
