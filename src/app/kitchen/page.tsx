'use client';

import React, { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { OrderWithItems } from '@/types/database';
import KitchenCard from '@/components/orders/KitchenCard';
import { ChefHat, Clock, CheckCircle, Loader2, RefreshCw, LogOut, User, Shield, Maximize2, Minimize2, Building2, Volume2, VolumeX } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';
import { RESTAURANT_NAME } from '@/lib/constants';
import { useBranch } from '@/context/BranchContext';

export default function KitchenPage() {
  const supabase = createClient();
  const router = useRouter();
  const { currentBranch, userBranches, switchBranch } = useBranch();
  const [orders, setOrders] = useState<OrderWithItems[]>([]);
  const [loading, setLoading] = useState(true);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Play audio chime when kitchen marks an order as complete
  function playCompleteChime() {
    if (!soundEnabled) return;
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const now = audioCtx.currentTime;

      // Note 1 (E5: 659.25 Hz)
      const osc1 = audioCtx.createOscillator();
      const gain1 = audioCtx.createGain();
      osc1.type = 'triangle';
      osc1.frequency.setValueAtTime(659.25, now);
      gain1.gain.setValueAtTime(0.35, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
      osc1.connect(gain1);
      gain1.connect(audioCtx.destination);
      osc1.start(now);
      osc1.stop(now + 0.4);

      // Note 2 (A5: 880.00 Hz)
      const osc2 = audioCtx.createOscillator();
      const gain2 = audioCtx.createGain();
      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(880.00, now + 0.12);
      gain2.gain.setValueAtTime(0.4, now + 0.12);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
      osc2.connect(gain2);
      gain2.connect(audioCtx.destination);
      osc2.start(now + 0.12);
      osc2.stop(now + 0.6);

      // Note 3 (C#6: 1108.73 Hz - bright completion tone)
      const osc3 = audioCtx.createOscillator();
      const gain3 = audioCtx.createGain();
      osc3.type = 'sine';
      osc3.frequency.setValueAtTime(1108.73, now + 0.24);
      gain3.gain.setValueAtTime(0.45, now + 0.24);
      gain3.gain.exponentialRampToValueAtTime(0.001, now + 0.9);
      osc3.connect(gain3);
      gain3.connect(audioCtx.destination);
      osc3.start(now + 0.24);
      osc3.stop(now + 0.9);
    } catch {
      // Audio context might be restricted before user gesture
    }
  }

  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => { });
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => { });
      setIsFullscreen(false);
    }
  }

  useEffect(() => {
    function handleFullscreenChange() {
      setIsFullscreen(Boolean(document.fullscreenElement));
    }
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

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
  }, [currentBranch]);

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
    let query = supabase
      .from('orders')
      .select(`
        *,
        restaurant_table:restaurant_tables(*),
        order_items(
          *,
          menu_item:menu_items(*)
        )
      `)
      .in('status', ['pending', 'preparing', 'completed']);

    if (currentBranch) {
      query = query.or(`branch_id.eq.${currentBranch.id},branch_id.is.null`);
    }

    const { data, error } = await query.order('created_at', { ascending: true });

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
      if (newStatus === 'preparing') {
        toast.success('Order preparation started');
      } else if (newStatus === 'completed') {
        playCompleteChime();
        toast.success('Order marked as complete');
      } else if (newStatus === 'served') {
        toast.success('Order marked as served');
      } else {
        toast.success(`Order status updated to ${newStatus}`);
      }
      fetchOrders();
    }
  }

  const pendingOrders = orders.filter((o) => o.status === 'pending');
  const preparingOrders = orders.filter((o) => o.status === 'preparing');
  const completedOrders = orders.filter((o) => o.status === 'completed');

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
        <div className="flex items-center justify-between max-w-full mx-auto">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-accent-primary to-accent-secondary flex items-center justify-center">
              <ChefHat className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold text-text-primary">Kitchen Dashboard</h1>
                {currentBranch && (
                  userBranches.length > 1 ? (
                    <select
                      value={currentBranch.id}
                      onChange={(e) => {
                        const b = userBranches.find((x) => x.id === e.target.value);
                        if (b) switchBranch(b);
                      }}
                      className="px-2 py-0.5 rounded-lg text-xs font-bold bg-accent-primary/10 border border-accent-primary/20 text-accent-primary focus:outline-none cursor-pointer"
                    >
                      {userBranches.map((b) => (
                        <option key={b.id} value={b.id} className="bg-bg-secondary text-text-primary">
                          {b.name} ({b.code})
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span className="font-mono text-xs font-bold text-accent-primary bg-accent-primary/10 px-2 py-0.5 rounded-lg border border-accent-primary/20">
                      {currentBranch.code}
                    </span>
                  )
                )}
              </div>
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
                    'text-[10px] font-semibold capitalize',
                    userRole === 'super_admin'
                      ? 'text-fuchsia-400 font-bold'
                      : userRole === 'admin'
                      ? 'text-accent-primary'
                      : userRole === 'pos'
                      ? 'text-cyan-400'
                      : 'text-accent-warning'
                  )}>
                    {userRole === 'super_admin' ? 'Super Admin' : userRole}
                  </span>
                </div>
              </div>
            )}

            {/* Sound Toggle */}
            <button
              onClick={() => {
                const next = !soundEnabled;
                setSoundEnabled(next);
                if (next) playCompleteChime();
                toast.info(`Sound ${next ? 'enabled' : 'muted'}`);
              }}
              className={cn(
                'p-2.5 rounded-xl glass glass-hover transition-all cursor-pointer',
                soundEnabled ? 'text-teal-400 hover:text-teal-300' : 'text-text-muted hover:text-text-primary'
              )}
              title={soundEnabled ? 'Mute Completion Sound' : 'Enable Completion Sound'}
            >
              {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>

            {/* Fullscreen */}
            <button
              onClick={toggleFullscreen}
              className="p-2.5 rounded-xl glass glass-hover text-text-secondary hover:text-text-primary transition-all cursor-pointer"
              title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen (Kitchen Mode)'}
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>

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
      <div className="max-w-full mx-auto p-4 md:p-6">
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

          {/* Completed Column */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 px-1">
              <CheckCircle className="w-4 h-4 text-teal-400" />
              <h2 className="text-sm font-semibold text-text-primary">Completed</h2>
              <span className="ml-auto text-xs text-text-muted bg-teal-500/10 px-2 py-0.5 rounded-full">
                {completedOrders.length}
              </span>
            </div>
            <div className="space-y-3">
              {completedOrders.length === 0 ? (
                <div className="glass rounded-2xl p-6 text-center">
                  <p className="text-xs text-text-muted">No completed orders</p>
                </div>
              ) : (
                completedOrders.map((order) => (
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
