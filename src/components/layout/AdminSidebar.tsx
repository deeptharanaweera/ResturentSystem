'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import { RESTAURANT_NAME } from '@/lib/constants';
import { UserRoleType } from '@/types/database';
import {
  LayoutDashboard,
  ChefHat,
  UtensilsCrossed,
  QrCode,
  Receipt,
  Menu,
  X,
  LogOut,
  User,
  Shield,
} from 'lucide-react';
import { toast } from 'sonner';

const navItems = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/kitchen', label: 'Kitchen', icon: ChefHat },
  { href: '/admin/tables', label: 'Tables & QR', icon: QrCode },
  { href: '/admin/billing', label: 'Billing', icon: Receipt },
  { href: '/admin/menu-management', label: 'Menu Items', icon: UtensilsCrossed },
  { href: '/admin/users', label: 'Staff Management', icon: User },
];

export default function AdminSidebar({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<UserRoleType | null>(null);

  useEffect(() => {
    loadUser();
  }, []);

  async function loadUser() {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setUserEmail(user.email || null);
      const { data: roleData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .single();
      setUserRole(roleData?.role || null);
    }
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    toast.success('Signed out successfully');
    router.push('/login');
  }

  return (
    <div className="flex h-screen bg-bg-primary">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={cn(
        'fixed lg:static inset-y-0 left-0 z-50 w-64 bg-bg-secondary border-r border-border flex flex-col transition-transform duration-300 lg:translate-x-0',
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      )}>
        {/* Logo */}
        <div className="p-5 border-b border-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-accent-primary to-accent-secondary flex items-center justify-center">
                <UtensilsCrossed className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-base font-bold gradient-text">{RESTAURANT_NAME}</h1>
                <p className="text-[10px] text-text-muted">Management System</p>
              </div>
            </div>
            <button onClick={() => setSidebarOpen(false)} className="lg:hidden p-1.5 rounded-lg hover:bg-white/5 text-text-muted cursor-pointer">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {navItems
            .filter((item) => {
              if (userRole === 'admin') return true;
              if (userRole === 'waiter') return item.href === '/admin/tables' || item.href === '/kitchen';
              if (userRole === 'kitchen') return item.href === '/kitchen';
              return false;
            })
            .map((item) => {
              const isActive = pathname === item.href || (item.href !== '/admin' && pathname.startsWith(item.href));
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setSidebarOpen(false)}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200',
                    isActive
                      ? 'bg-accent-primary/15 text-accent-primary shadow-sm'
                      : 'text-text-secondary hover:text-text-primary hover:bg-white/5'
                  )}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  {item.label}
                </Link>
              );
            })}
        </nav>

        {/* User Info + Sign Out */}
        <div className="p-3 border-t border-border space-y-2">
          {/* User card */}
          {userEmail && (
            <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-white/[0.03]">
              <div className="w-8 h-8 rounded-lg bg-accent-primary/15 flex items-center justify-center shrink-0">
                <User className="w-4 h-4 text-accent-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-text-primary truncate">{userEmail}</p>
                <div className="flex items-center gap-1 mt-0.5">
                  <Shield className="w-3 h-3 text-text-muted" />
                  <span className={cn(
                    'text-[10px] font-medium capitalize',
                    userRole === 'admin' ? 'text-accent-primary' : 'text-accent-warning'
                  )}>
                    {userRole || 'Unknown'}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Sign out */}
          <button
            onClick={handleSignOut}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-text-muted hover:text-accent-danger hover:bg-accent-danger/5 transition-all cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        {/* Top bar (mobile) */}
        <header className="lg:hidden flex items-center justify-between px-4 py-3 bg-bg-secondary border-b border-border shrink-0">
          <button onClick={() => setSidebarOpen(true)} className="p-2 rounded-xl hover:bg-white/5 text-text-secondary cursor-pointer">
            <Menu className="w-5 h-5" />
          </button>
          <span className="text-sm font-semibold gradient-text">{RESTAURANT_NAME}</span>
          <div className="w-9" />
        </header>

        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
