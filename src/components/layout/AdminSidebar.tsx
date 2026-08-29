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
  BarChart3,
  ShoppingCart,
  Tv,
  Building2,
  CalendarDays,
} from 'lucide-react';
import { toast } from 'sonner';
import { useBranch } from '@/context/BranchContext';

const navItems = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/pos', label: 'POS', icon: ShoppingCart },
  { href: '/kitchen', label: 'Kitchen', icon: ChefHat },
  { href: '/display', label: 'Order Display', icon: Tv },
  { href: '/admin/day-end', label: 'Day-End Shift', icon: CalendarDays },
  { href: '/admin/tables', label: 'Tables & QR', icon: QrCode },
  { href: '/admin/billing', label: 'Billing', icon: Receipt },
  { href: '/admin/reports', label: 'Reports', icon: BarChart3 },
  { href: '/admin/menu-management', label: 'Menu Items', icon: UtensilsCrossed },
  { href: '/admin/branches', label: 'Branches & Terminals', icon: Building2 },
  { href: '/admin/users', label: 'Staff Management', icon: User },
];

export default function AdminSidebar({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const { currentBranch, userBranches, switchBranch } = useBranch();
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
        <div className="p-4 border-b border-border space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-accent-primary to-accent-secondary flex items-center justify-center">
                <UtensilsCrossed className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-base font-bold gradient-text">{RESTAURANT_NAME}</h1>
                <p className="text-[10px] text-text-muted">Enterprise POS</p>
              </div>
            </div>
            <button onClick={() => setSidebarOpen(false)} className="lg:hidden p-1.5 rounded-lg hover:bg-white/5 text-text-muted cursor-pointer">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Active Branch Switcher */}
          {currentBranch && (
            <div className="flex items-center gap-2 p-2 rounded-xl bg-white/[0.03] border border-white/[0.06]">
              <Building2 className="w-4 h-4 text-accent-primary shrink-0" />
              <div className="flex-1 min-w-0">
                {userBranches.length > 1 ? (
                  <select
                    value={currentBranch.id}
                    onChange={(e) => {
                      const b = userBranches.find((x) => x.id === e.target.value);
                      if (b) switchBranch(b);
                    }}
                    className="w-full text-xs font-bold text-text-primary bg-transparent focus:outline-none cursor-pointer truncate"
                  >
                    {userBranches.map((b) => (
                      <option key={b.id} value={b.id} className="bg-bg-secondary text-text-primary">
                        {b.name} ({b.code})
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-text-primary truncate">{currentBranch.name}</span>
                    <span className="font-mono text-[9px] font-bold text-accent-primary bg-accent-primary/10 px-1.5 py-0.2 rounded">
                      {currentBranch.code}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {navItems
            .filter((item) => {
              if (userRole === 'admin' || userRole === 'super_admin') return true;
              if (userRole === 'pos') return item.href === '/pos' || item.href === '/display';
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
                    'text-[10px] font-semibold capitalize',
                    userRole === 'super_admin'
                      ? 'text-fuchsia-400 font-bold'
                      : userRole === 'admin'
                      ? 'text-accent-primary'
                      : userRole === 'pos'
                      ? 'text-cyan-400'
                      : 'text-accent-warning'
                  )}>
                    {userRole === 'super_admin' ? 'Super Admin' : userRole === 'pos' ? 'POS Cashier' : userRole || 'Unknown'}
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
