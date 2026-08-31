'use client';

import React, { useState, useEffect, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { OrderWithItems } from '@/types/database';
import { generateOrderNumber, formatTime, getTimeAgo, cn } from '@/lib/utils';
import { RESTAURANT_NAME, RESTAURANT_TAGLINE } from '@/lib/constants';
import { useBranch } from '@/context/BranchContext';
import {
  ChefHat,
  CheckCircle2,
  Clock,
  Volume2,
  VolumeX,
  Maximize2,
  Minimize2,
  UtensilsCrossed,
  Package,
  Store,
  Sparkles,
  Flame,
  Building2,
} from 'lucide-react';

export default function OrderDisplayPage() {
  const supabase = createClient();
  const { currentBranch, userBranches, switchBranch } = useBranch();
  const [mounted, setMounted] = useState(false);
  const [orders, setOrders] = useState<OrderWithItems[]>([]);
  const [currentTime, setCurrentTime] = useState<Date>(new Date());
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [newlyReadyIds, setNewlyReadyIds] = useState<Set<string>>(new Set());
  const previousServedIds = useRef<Set<string>>(new Set());

  // Clock ticker & mounted
  useEffect(() => {
    setMounted(true);
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch orders and subscribe to realtime
  useEffect(() => {
    fetchOrders();

    const channel = supabase
      .channel('display-orders-live')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders' },
        () => {
          fetchOrders();
        }
      )
      .subscribe();

    // Periodic backup refresh every 15 seconds
    const interval = setInterval(fetchOrders, 15000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, [currentBranch]);

  // Play audio chime when order becomes served/ready
  function playReadyChime() {
    if (!soundEnabled) return;
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const now = audioCtx.currentTime;

      // Note 1 (E5)
      const osc1 = audioCtx.createOscillator();
      const gain1 = audioCtx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(659.25, now);
      gain1.gain.setValueAtTime(0.3, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
      osc1.connect(gain1);
      gain1.connect(audioCtx.destination);
      osc1.start(now);
      osc1.stop(now + 0.6);

      // Note 2 (G#5)
      const osc2 = audioCtx.createOscillator();
      const gain2 = audioCtx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(830.61, now + 0.15);
      gain2.gain.setValueAtTime(0.35, now + 0.15);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.8);
      osc2.connect(gain2);
      gain2.connect(audioCtx.destination);
      osc2.start(now + 0.15);
      osc2.stop(now + 0.8);

      // Note 3 (B5)
      const osc3 = audioCtx.createOscillator();
      const gain3 = audioCtx.createGain();
      osc3.type = 'sine';
      osc3.frequency.setValueAtTime(987.77, now + 0.3);
      gain3.gain.setValueAtTime(0.4, now + 0.3);
      gain3.gain.exponentialRampToValueAtTime(0.001, now + 1.2);
      osc3.connect(gain3);
      gain3.connect(audioCtx.destination);
      osc3.start(now + 0.3);
      osc3.stop(now + 1.2);
    } catch {
      // Audio context might be restricted before user interaction
    }
  }

  async function fetchOrders() {
    let query = supabase
      .from('orders')
      .select(`
        *,
        restaurant_table:restaurant_tables(*),
        order_items(*, menu_item:menu_items(*)),
        invoice:invoices!fk_orders_invoice(*)
      `)
      .in('status', ['pending', 'preparing', 'completed', 'served']);

    if (currentBranch) {
      query = query.or(`branch_id.eq.${currentBranch.id},branch_id.is.null`);
    }

    const { data } = await query.order('created_at', { ascending: true });

    if (data) {
      const fetched = data as unknown as OrderWithItems[];
      setOrders(fetched);

      // Check for newly ready orders (completed in kitchen)
      const currentReady = fetched.filter((o) => o.status === 'completed');
      const currentReadyIds = new Set(currentReady.map((o) => o.id));

      const newIds = new Set<string>();
      currentReady.forEach((o) => {
        if (!previousServedIds.current.has(o.id) && previousServedIds.current.size > 0) {
          newIds.add(o.id);
        }
      });

      if (newIds.size > 0) {
        setNewlyReadyIds(newIds);
        playReadyChime();
        // Clear flash after 8 seconds
        setTimeout(() => {
          setNewlyReadyIds(new Set());
        }, 8000);
      }

      previousServedIds.current = currentReadyIds;
    }
  }

  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  }

  const preparingOrders = orders.filter((o) => o.status === 'pending' || o.status === 'preparing');
  const readyOrders = orders.filter((o) => o.status === 'completed');

  if (!mounted) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-[#07080f] text-white">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-full border-2 border-emerald-400 border-t-transparent animate-spin" />
          <p className="text-xs text-text-muted">Loading Live Display...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen flex flex-col bg-[#07080f] text-white p-4 lg:p-6 overflow-hidden">
      {/* Top Header Bar */}
      <header className="flex items-center justify-between px-6 py-4 rounded-3xl bg-white/[0.03] border border-white/[0.08] backdrop-blur-xl mb-4 shrink-0 shadow-2xl">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-accent-primary to-accent-secondary flex items-center justify-center shadow-lg shadow-accent-primary/25">
            <Flame className="w-6 h-6 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl lg:text-3xl font-black tracking-tight gradient-text">
                {RESTAURANT_NAME}
              </h1>
              {currentBranch && (
                <span className="font-mono text-xs font-bold text-accent-primary bg-accent-primary/10 px-2.5 py-0.5 rounded-xl border border-accent-primary/20">
                  {currentBranch.name} ({currentBranch.code})
                </span>
              )}
            </div>
            <p className="text-xs text-text-muted font-medium tracking-wide">
              Live Order Status Display &bull; {currentBranch ? currentBranch.name : 'All Locations'}
            </p>
          </div>
        </div>

        {/* Live Clock & Controls */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-white/[0.04] border border-white/[0.08]">
            <Clock className="w-4 h-4 text-accent-primary" />
            <span className="font-mono text-lg font-bold tracking-wider text-text-primary">
              {currentTime.toLocaleTimeString('en-IN', {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
              })}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setSoundEnabled((s) => !s)}
              className="p-3 rounded-2xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-text-muted hover:text-text-primary transition-all cursor-pointer"
              title={soundEnabled ? 'Mute Chime' : 'Unmute Chime'}
            >
              {soundEnabled ? <Volume2 className="w-5 h-5 text-emerald-400" /> : <VolumeX className="w-5 h-5 text-text-muted" />}
            </button>

            <button
              onClick={toggleFullscreen}
              className="p-3 rounded-2xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-text-muted hover:text-text-primary transition-all cursor-pointer"
              title="Toggle Fullscreen (TV Mode)"
            >
              {isFullscreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </header>

      {/* Main Dual-Column Live Grid */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6 min-h-0">
        {/* ============================================================ */}
        {/* LEFT COLUMN: PREPARING / IN THE KITCHEN                     */}
        {/* ============================================================ */}
        <section className="flex flex-col rounded-3xl bg-gradient-to-b from-amber-500/[0.04] to-transparent border border-amber-500/20 p-5 overflow-hidden shadow-2xl backdrop-blur-xl">
          {/* Section Header */}
          <div className="flex items-center justify-between pb-4 mb-4 border-b border-amber-500/20 shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center">
                <ChefHat className="w-5 h-5 animate-pulse" />
              </div>
              <div>
                <h2 className="text-xl lg:text-2xl font-black uppercase tracking-wider text-amber-400">
                  Preparing
                </h2>
                <p className="text-xs text-text-muted">Cooking in kitchen</p>
              </div>
            </div>
            <div className="px-4 py-1.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-400 font-bold text-sm">
              {preparingOrders.length} In Progress
            </div>
          </div>

          {/* Orders Scrollable Grid */}
          <div className="flex-1 overflow-y-auto pr-1">
            {preparingOrders.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-text-muted/40">
                <ChefHat className="w-16 h-16 mb-3 opacity-20" />
                <p className="text-base font-semibold">No orders currently preparing</p>
                <p className="text-xs mt-1">All orders are up to date</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {preparingOrders.map((order) => {
                  const isTakeaway = order.order_type === 'takeaway';
                  const isCounter = order.order_type === 'counter';
                  const orderNum = generateOrderNumber(order.id, order.order_number);

                  return (
                    <div
                      key={order.id}
                      className="group relative rounded-2xl bg-white/[0.03] hover:bg-white/[0.06] border border-amber-500/20 hover:border-amber-500/40 p-4 transition-all duration-300 shadow-lg animate-scale-in"
                    >
                      {/* Top row: Order Number */}
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-mono text-2xl lg:text-3xl font-black text-amber-400 tracking-tight">
                          {orderNum}
                        </span>
                        <div className="flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                          <span className="text-[11px] font-semibold text-amber-400/80">
                            {order.status === 'preparing' ? 'Cooking' : 'Queued'}
                          </span>
                        </div>
                      </div>

                      {/* Bottom row: Destination badge + time */}
                      <div className="flex items-center justify-between mt-2 pt-2 border-t border-white/[0.06]">
                        {isTakeaway ? (
                          <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-300">
                            <Package className="w-3.5 h-3.5" />
                            <span className="truncate max-w-[130px]">
                              {order.customer_name || 'Take Away'}
                              {order.restaurant_table ? ` (T${order.restaurant_table.table_number})` : ''}
                            </span>
                          </div>
                        ) : isCounter ? (
                          <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-300">
                            <Store className="w-3.5 h-3.5" />
                            <span>Counter</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 text-xs font-semibold text-accent-primary">
                            <UtensilsCrossed className="w-3.5 h-3.5" />
                            <span>Table {order.restaurant_table?.table_number || '?'}</span>
                          </div>
                        )}

                        <span className="text-[11px] text-text-muted font-mono">
                          {getTimeAgo(order.created_at)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        {/* ============================================================ */}
        {/* RIGHT COLUMN: READY FOR PICKUP / SERVED                     */}
        {/* ============================================================ */}
        <section className="flex flex-col rounded-3xl bg-gradient-to-b from-emerald-500/[0.06] to-transparent border border-emerald-500/30 p-5 overflow-hidden shadow-2xl backdrop-blur-xl">
          {/* Section Header */}
          <div className="flex items-center justify-between pb-4 mb-4 border-b border-emerald-500/25 shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shadow-lg shadow-emerald-500/20">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-xl lg:text-2xl font-black uppercase tracking-wider text-emerald-400">
                  Ready For Pickup
                </h2>
                <p className="text-xs text-text-muted">Please collect your order</p>
              </div>
            </div>
            <div className="px-4 py-1.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 font-bold text-sm shadow-lg shadow-emerald-500/20">
              {readyOrders.length} Ready
            </div>
          </div>

          {/* Orders Scrollable Grid */}
          <div className="flex-1 overflow-y-auto pr-1">
            {readyOrders.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-text-muted/40">
                <CheckCircle2 className="w-16 h-16 mb-3 opacity-20" />
                <p className="text-base font-semibold">No orders currently waiting for pickup</p>
                <p className="text-xs mt-1">Orders ready for collection will appear here</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {readyOrders.map((order) => {
                  const isTakeaway = order.order_type === 'takeaway';
                  const isCounter = order.order_type === 'counter';
                  const orderNum = generateOrderNumber(order.id, order.order_number);
                  const isNewlyReady = newlyReadyIds.has(order.id);

                  return (
                    <div
                      key={order.id}
                      className={cn(
                        'relative rounded-2xl p-4 transition-all duration-500 shadow-xl',
                        isNewlyReady
                          ? 'bg-gradient-to-br from-emerald-500/30 to-teal-500/30 border-2 border-emerald-400 scale-[1.03] shadow-emerald-500/30 animate-pulse'
                          : 'bg-emerald-500/[0.12] hover:bg-emerald-500/[0.18] border border-emerald-500/40 hover:border-emerald-400 shadow-emerald-500/10'
                      )}
                    >
                      {/* Glowing Header badge */}
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-mono text-3xl lg:text-4xl font-black text-emerald-300 tracking-tight drop-shadow-md">
                          {orderNum}
                        </span>
                        <span className="px-3 py-1 rounded-full text-xs font-black bg-emerald-400 text-slate-950 uppercase tracking-wider flex items-center gap-1 shadow-md shadow-emerald-400/30">
                          <Sparkles className="w-3 h-3" />
                          Ready
                        </span>
                      </div>

                      {/* Destination details */}
                      <div className="flex items-center justify-between mt-2 pt-2 border-t border-emerald-500/20">
                        {isTakeaway ? (
                          <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-200">
                            <Package className="w-4 h-4 text-emerald-400" />
                            <span className="truncate max-w-[140px]">
                              {order.customer_name ? `Customer: ${order.customer_name}` : 'Take Away'}
                              {order.restaurant_table ? ` (Table ${order.restaurant_table.table_number})` : ''}
                            </span>
                          </div>
                        ) : isCounter ? (
                          <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-200">
                            <Store className="w-4 h-4 text-emerald-400" />
                            <span>Counter Order</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-200">
                            <UtensilsCrossed className="w-4 h-4 text-emerald-400" />
                            <span>Table {order.restaurant_table?.table_number || '?'}</span>
                          </div>
                        )}

                        <span className="text-[11px] text-emerald-400/70 font-mono">
                          {formatTime(order.created_at)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      </div>

      {/* Bottom Announcement Bar */}
      <footer className="mt-4 px-6 py-2.5 rounded-2xl bg-white/[0.02] border border-white/[0.06] flex items-center justify-between text-xs text-text-muted shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
          <span className="font-medium text-text-secondary">
            Please watch the display. When your order number appears under Ready, collect your meal at the counter.
          </span>
        </div>
        <div className="hidden md:flex items-center gap-2 font-mono text-[11px] text-text-muted">
          <span>{RESTAURANT_NAME}</span>
          <span>•</span>
          <span>{RESTAURANT_TAGLINE}</span>
        </div>
      </footer>
    </div>
  );
}
