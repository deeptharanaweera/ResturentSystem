'use client';

import React, { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter, useSearchParams } from 'next/navigation';
import { RESTAURANT_NAME } from '@/lib/constants';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { UtensilsCrossed, Mail, Lock, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

export default function LoginPage() {
  const supabase = createClient();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const redirectTo = searchParams.get('redirect') || '/admin';
  const errorParam = searchParams.get('error');

  useEffect(() => {
    if (errorParam === 'no_role') {
      setErrorMessage('Your account has no role assigned. Contact the admin.');
    } else if (errorParam === 'unauthorized') {
      setErrorMessage('You do not have permission to access that page.');
    }
  }, [errorParam]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErrorMessage(null);

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }

    // Check the user's role to determine redirect
    console.log('Attempting to fetch role for user ID:', data.user.id);
    
    const { data: userRole, error: roleError } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', data.user.id)
      .single();

    if (roleError) {
      console.error('Database error fetching role:', roleError);
      setErrorMessage(`Error checking role: ${roleError.message}`);
      setLoading(false);
      return;
    }

    if (!userRole) {
      console.warn('No role record found for user:', data.user.id);
      setErrorMessage('No role assigned to your account. Contact the admin.');
      await supabase.auth.signOut();
      setLoading(false);
      return;
    }

    console.log('Role found:', userRole.role);
    toast.success(`Welcome back! Role: ${userRole.role.charAt(0).toUpperCase() + userRole.role.slice(1)}`);

    // Redirect based on role
    if (userRole.role === 'kitchen') {
      router.push('/kitchen');
    } else if (userRole.role === 'admin') {
      router.push(redirectTo);
    } else if (userRole.role === 'waiter') {
      router.push('/admin/tables');
    } else {
      router.push('/');
    }

    setLoading(false);
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    toast.success('Signed out');
    setErrorMessage(null);
  }

  return (
    <div className="min-h-screen bg-bg-primary flex items-center justify-center p-4">
      {/* Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/3 left-1/3 w-[500px] h-[500px] bg-accent-primary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/3 right-1/3 w-[500px] h-[500px] bg-accent-secondary/5 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-sm animate-scale-in">
        <div className="glass rounded-3xl p-8 space-y-6">
          {/* Logo */}
          <div className="text-center space-y-3">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-accent-primary to-accent-secondary flex items-center justify-center mx-auto shadow-lg shadow-accent-primary/25">
              <UtensilsCrossed className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold gradient-text">{RESTAURANT_NAME}</h1>
              <p className="text-xs text-text-muted mt-1">Staff Login</p>
            </div>
          </div>

          {/* Error Banner */}
          {errorMessage && (
            <div className="flex items-start gap-2.5 px-4 py-3 rounded-xl bg-accent-danger/10 border border-accent-danger/20">
              <AlertTriangle className="w-4 h-4 text-accent-danger shrink-0 mt-0.5" />
              <p className="text-xs text-accent-danger">{errorMessage}</p>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleLogin} className="space-y-4">
            <Input
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="staff@restaurant.com"
              icon={<Mail className="w-4 h-4" />}
              required
            />
            <Input
              label="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              icon={<Lock className="w-4 h-4" />}
              required
            />
            <Button
              type="submit"
              variant="primary"
              size="lg"
              className="w-full"
              loading={loading}
            >
              Sign In
            </Button>
          </form>

          {/* Role Info */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-[10px] text-text-muted">
              <div className="h-px flex-1 bg-border" />
              <span>Access Levels</span>
              <div className="h-px flex-1 bg-border" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="text-center px-3 py-2 rounded-lg bg-accent-primary/5 border border-accent-primary/10">
                <p className="text-[10px] font-semibold text-accent-primary">Admin</p>
                <p className="text-[9px] text-text-muted mt-0.5">Full dashboard access</p>
              </div>
              <div className="text-center px-3 py-2 rounded-lg bg-accent-warning/5 border border-accent-warning/10">
                <p className="text-[10px] font-semibold text-accent-warning">Kitchen</p>
                <p className="text-[9px] text-text-muted mt-0.5">Kitchen orders only</p>
              </div>
            </div>
          </div>

          <p className="text-[10px] text-center text-text-muted">
            Powered by {RESTAURANT_NAME} Management System
          </p>
        </div>
      </div>
    </div>
  );
}
