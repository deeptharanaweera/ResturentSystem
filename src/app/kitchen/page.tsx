'use client';

import React, { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { OrderWithItems } from '@/types/database';
import KitchenCard from '@/components/orders/KitchenCard';
import { ChefHat, Clock, CheckCircle, Loader2, RefreshCw, LogOut, User, Shield } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';
import { RESTAURANT_NAME } from '@/lib/constants';

export default function KitchenPage() {
  const supabase = createClient();
  const router = useRouter();
  const [orders, setOrders] = useState<OrderWithItems[]>([]);
  const [loading, setLoading] = useState(true);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);

  useEffect(() => {
    loadUser();
    fetchOrders();

    // Subscribe to realtime changes on orders table
    const channel = supabase
      .channel('kitchen-orders')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders' },
        () => {
          fetchOrders();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'order_items' },
        () => {
          fetchOrders();
        }
      )
      .subscribe();

    // Auto-refresh every 30s as backup
    const interval = setInterval(fetchOrders, 30000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
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
    toast.success('Signed out');
    router.push('/login');
  }

  async function fetchOrders() {
    const { data, error } = await supabase
      .from('orders')
      .select(`
        *,
        restaurant_table:restaurant_tables(*),
        order_items(
          *,
          menu_item:menu_items(*)
        )
      `)
      .in('status', ['pending', 'preparing', 'served'])
      .order('created_at', { ascending: true });

    if (!error && data) {
      setOrders(data as unknown as OrderWithItems[]);
    }
    setLoading(false);
  }

  async function handleStatusChange(orderId: string, newStatus: string) {
    const { error } = await supabase
      .from('orders')
      .update({ status: newStatus })
      .eq('id', orderId);

    if (error) {
      toast.error('Failed to update order status');
    } else {
      toast.success(`Order ${newStatus === 'preparing' ? 'started' : 'marked as served'}`);
      fetchOrders();
    }
  }

  const pendingOrders = orders.filter((o) => o.status === 'pending');
  const preparingOrders = orders.filter((o) => o.status === 'preparing');
  const servedOrders = orders.filter((o) => o.status === 'served');

  if (loading) {
    return (
      <div className="min-h-screen bg-bg-primary flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-accent-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg-primary">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-bg-primary/80 backdrop-blur-xl border-b border-border px-4 md:px-6 py-4">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-accent-primary to-accent-secondary flex items-center justify-center">
              <ChefHat className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-text-primary">Kitchen Dashboard</h1>
              <div className="flex items-center gap-1.5 text-xs text-text-muted">
                <div className="pulse-dot" />
                <span>Live — {orders.length} active orders</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* User info */}
            {userEmail && (
              <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-xl glass">
                <User className="w-3.5 h-3.5 text-text-muted" />
                <span className="text-xs text-text-secondary truncate max-w-[120px]">{userEmail}</span>
                <div className="flex items-center gap-1">
                  <Shield className="w-3 h-3 text-text-muted" />
                  <span className={cn(
                    'text-[10px] font-medium capitalize',
                    userRole === 'admin' ? 'text-accent-primary' : 'text-accent-warning'
                  )}>
                    {userRole}
                  </span>
                </div>
              </div>
            )}

            {/* Refresh */}
            <button
              onClick={fetchOrders}
              className="p-2.5 rounded-xl glass glass-hover text-text-secondary hover:text-text-primary transition-all cursor-pointer"
              title="Refresh orders"
            >
              <RefreshCw className="w-4 h-4" />
            </button>

            {/* Sign Out */}
            <button
              onClick={handleSignOut}
              className="p-2.5 rounded-xl glass glass-hover text-text-secondary hover:text-accent-danger transition-all cursor-pointer"
              title="Sign out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Kanban Columns */}
      <div className="max-w-7xl mx-auto p-4 md:p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
          {/* Pending Column */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 px-1">
              <Clock className="w-4 h-4 text-amber-400" />
              <h2 className="text-sm font-semibold text-text-primary">Pending</h2>
              <span className="ml-auto text-xs text-text-muted bg-amber-500/10 px-2 py-0.5 rounded-full">
                {pendingOrders.length}
              </span>
            </div>
            <div className="space-y-3">
              {pendingOrders.length === 0 ? (
                <div className="glass rounded-2xl p-6 text-center">
                  <p className="text-xs text-text-muted">No pending orders</p>
                </div>
              ) : (
                pendingOrders.map((order) => (
                  <KitchenCard key={order.id} order={order} onStatusChange={handleStatusChange} />
                ))
              )}
            </div>
          </div>

          {/* Preparing Column */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 px-1">
              <ChefHat className="w-4 h-4 text-blue-400" />
              <h2 className="text-sm font-semibold text-text-primary">Preparing</h2>
              <span className="ml-auto text-xs text-text-muted bg-blue-500/10 px-2 py-0.5 rounded-full">
                {preparingOrders.length}
              </span>
            </div>
            <div className="space-y-3">
              {preparingOrders.length === 0 ? (
                <div className="glass rounded-2xl p-6 text-center">
                  <p className="text-xs text-text-muted">No orders being prepared</p>
                </div>
              ) : (
                preparingOrders.map((order) => (
                  <KitchenCard key={order.id} order={order} onStatusChange={handleStatusChange} />
                ))
              )}
            </div>
          </div>

          {/* Served Column */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 px-1">
              <CheckCircle className="w-4 h-4 text-emerald-400" />
              <h2 className="text-sm font-semibold text-text-primary">Served</h2>
              <span className="ml-auto text-xs text-text-muted bg-emerald-500/10 px-2 py-0.5 rounded-full">
                {servedOrders.length}
              </span>
            </div>
            <div className="space-y-3">
              {servedOrders.length === 0 ? (
                <div className="glass rounded-2xl p-6 text-center">
                  <p className="text-xs text-text-muted">No served orders</p>
                </div>
              ) : (
                servedOrders.map((order) => (
                  <KitchenCard key={order.id} order={order} onStatusChange={handleStatusChange} />
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
