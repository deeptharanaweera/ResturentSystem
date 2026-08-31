'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { useBranch } from '@/context/BranchContext';
import { useSystemSettings } from '@/context/SystemSettingsContext';
import Button from '@/components/ui/Button';
import {
  ShoppingBag,
  ChefHat,
  QrCode,
  Building2,
  Shield,
  RefreshCw,
  Settings,
  Loader2,
} from 'lucide-react';
import AdminExecutiveDashboard from '@/components/dashboard/AdminExecutiveDashboard';
import POSCashierDashboard from '@/components/dashboard/POSCashierDashboard';
import KitchenExecutiveDashboard from '@/components/dashboard/KitchenExecutiveDashboard';
import WaiterServiceDashboard from '@/components/dashboard/WaiterServiceDashboard';

export default function DynamicRoleDashboard() {
  const supabase = createClient();
  const { userRole, userProfile, currentBranch, loading: contextLoading } = useBranch();
  const { settings } = useSystemSettings();

  const [loading, setLoading] = useState(true);

  // Common stats
  const [stats, setStats] = useState({
    totalOrders: 0,
    pendingOrders: 0,
    preparingOrders: 0,
    servedOrders: 0,
    completedOrders: 0,
    totalRevenue: 0,
    todayRevenue: 0,
    activeTables: 0,
    totalTables: 0,
    todayInvoices: 0,
    todayCash: 0,
    todayCard: 0,
    delayedOrders: 0,
  });

  // Recent data feeds
  const [recentOrders, setRecentOrders] = useState<any[]>([]);
  const [recentInvoices, setRecentInvoices] = useState<any[]>([]);
  const [topItems, setTopItems] = useState<{ name: string; count: number; total: number }[]>([]);

  useEffect(() => {
    loadDashboardData();
  }, [currentBranch]);

  async function loadDashboardData() {
    setLoading(true);
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Build query filters based on current branch
      let ordersQuery = supabase.from('orders').select('*, order_items(*, menu_item:menu_items(*)), restaurant_table:restaurant_tables(*)').order('created_at', { ascending: false });
      let tablesQuery = supabase.from('restaurant_tables').select('*');
      let invoicesQuery = supabase.from('invoices').select('*, invoice_payments(*)').gte('issued_at', today.toISOString()).order('issued_at', { ascending: false });

      if (currentBranch) {
        ordersQuery = ordersQuery.eq('branch_id', currentBranch.id);
        tablesQuery = tablesQuery.eq('branch_id', currentBranch.id);
        invoicesQuery = invoicesQuery.eq('branch_id', currentBranch.id);
      }

      const [ordersRes, tablesRes, invoicesRes] = await Promise.all([
        ordersQuery,
        tablesQuery,
        invoicesQuery,
      ]);

      const orders = ordersRes.data || [];
      const tables = tablesRes.data || [];
      const invoices = invoicesRes.data || [];

      // Calculate today's figures
      const todayOrders = orders.filter((o) => new Date(o.created_at) >= today);
      const todayRev = todayOrders
        .filter((o) => o.status === 'completed' || o.payment_status === 'paid')
        .reduce((sum, o) => sum + (o.total_amount || 0), 0);

      const totalRev = orders
        .filter((o) => o.status === 'completed' || o.payment_status === 'paid')
        .reduce((sum, o) => sum + (o.total_amount || 0), 0);

      // Payments cash vs card today
      let todayCashVal = 0;
      let todayCardVal = 0;
      invoices.forEach((inv) => {
        (inv.invoice_payments || []).forEach((p: any) => {
          if (p.payment_method === 'cash') todayCashVal += Number(p.amount || 0);
          else if (p.payment_method === 'card') todayCardVal += Number(p.amount || 0);
        });
      });

      // Delayed orders (pending/preparing for > 15 mins)
      const now = new Date().getTime();
      const delayed = orders.filter((o) => {
        if (o.status === 'pending' || o.status === 'preparing') {
          const diffMins = (now - new Date(o.created_at).getTime()) / 60000;
          return diffMins > 15;
        }
        return false;
      }).length;

      setStats({
        totalOrders: orders.length,
        pendingOrders: orders.filter((o) => o.status === 'pending').length,
        preparingOrders: orders.filter((o) => o.status === 'preparing').length,
        servedOrders: orders.filter((o) => o.status === 'served').length,
        completedOrders: orders.filter((o) => o.status === 'completed').length,
        totalRevenue: totalRev,
        todayRevenue: todayRev,
        activeTables: tables.filter((t) => t.is_active).length,
        totalTables: tables.length,
        todayInvoices: invoices.length,
        todayCash: todayCashVal,
        todayCard: todayCardVal,
        delayedOrders: delayed,
      });

      setRecentOrders(orders.slice(0, 8));
      setRecentInvoices(invoices.slice(0, 6));

      // Calculate Top Items
      const itemMap: Record<string, { name: string; count: number; total: number }> = {};
      orders.forEach((o) => {
        (o.order_items || []).forEach((oi: any) => {
          const name = oi.menu_item?.name || 'Item';
          if (!itemMap[name]) itemMap[name] = { name, count: 0, total: 0 };
          itemMap[name].count += oi.quantity || 1;
          itemMap[name].total += (oi.quantity || 1) * (oi.unit_price || 0);
        });
      });

      const sortedTop = Object.values(itemMap)
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);
      setTopItems(sortedTop);
    } catch (err) {
      console.error('Error loading dashboard data:', err);
    }
    setLoading(false);
  }

  // Show a clean loading spinner while BranchContext resolves the user's role
  if (contextLoading || (loading && !userRole)) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-accent-primary animate-spin" />
          <p className="text-xs text-text-muted font-medium">Loading your operations dashboard...</p>
        </div>
      </div>
    );
  }

  const displayName = userProfile?.display_name || 'Staff Member';
  const roleLabel =
    userRole === 'super_admin'
      ? 'Super Admin'
      : userRole === 'admin'
      ? 'Administrator'
      : userRole === 'pos'
      ? 'POS Cashier'
      : userRole === 'kitchen'
      ? 'Kitchen Executive'
      : userRole === 'waiter'
      ? 'Dining Waiter'
      : 'User';

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Top Banner Greeting */}
      <div className="rounded-3xl glass border border-border p-6 bg-gradient-to-r from-accent-primary/15 via-purple-500/10 to-transparent flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xl">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-accent-primary/20 text-accent-primary border border-accent-primary/30 capitalize flex items-center gap-1">
              <Shield className="w-3 h-3" />
              {roleLabel}
            </span>
            {currentBranch && (
              <span className="text-xs font-semibold text-text-muted flex items-center gap-1">
                <Building2 className="w-3.5 h-3.5 text-accent-primary" />
                {currentBranch.name} ({currentBranch.code})
              </span>
            )}
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-text-primary tracking-tight">
            Welcome back, <span className="gradient-text">{displayName}</span>
          </h1>
          <p className="text-xs text-text-muted">
            Here is your live real-time operations dashboard for {settings?.restaurant_name || 'the restaurant'}.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={loadDashboardData}
            icon={<RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />}
          >
            Refresh
          </Button>

          {/* Direct Role Shortcuts */}
          {userRole === 'pos' && (
            <Link href="/pos">
              <Button variant="primary" size="sm" icon={<ShoppingBag className="w-4 h-4" />}>
                Open POS Station
              </Button>
            </Link>
          )}

          {userRole === 'kitchen' && (
            <Link href="/kitchen">
              <Button variant="primary" size="sm" icon={<ChefHat className="w-4 h-4" />}>
                Open Kitchen Display
              </Button>
            </Link>
          )}

          {userRole === 'waiter' && (
            <Link href="/admin/tables">
              <Button variant="primary" size="sm" icon={<QrCode className="w-4 h-4" />}>
                Manage Tables &amp; Orders
              </Button>
            </Link>
          )}

          {(userRole === 'admin' || userRole === 'super_admin') && (
            <Link href="/admin/settings">
              <Button variant="primary" size="sm" icon={<Settings className="w-4 h-4" />}>
                System Settings
              </Button>
            </Link>
          )}
        </div>
      </div>

      {/* RENDER SEPARATED DASHBOARD MODULES (STRICTLY BY ROLE) */}
      {(userRole === 'admin' || userRole === 'super_admin') && (
        <AdminExecutiveDashboard
          stats={stats}
          recentOrders={recentOrders}
          topItems={topItems}
        />
      )}

      {userRole === 'pos' && (
        <POSCashierDashboard
          stats={stats}
          recentOrders={recentOrders}
          recentInvoices={recentInvoices}
        />
      )}

      {userRole === 'kitchen' && (
        <KitchenExecutiveDashboard
          stats={stats}
          recentOrders={recentOrders}
        />
      )}

      {userRole === 'waiter' && (
        <WaiterServiceDashboard
          stats={stats}
          recentOrders={recentOrders}
        />
      )}
    </div>
  );
}
