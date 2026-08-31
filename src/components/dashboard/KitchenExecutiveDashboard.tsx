'use client';

import React from 'react';
import Link from 'next/link';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import {
  Clock,
  ChefHat,
  AlertCircle,
  CheckCircle2,
  ArrowRight,
} from 'lucide-react';
import { getTimeAgo, getOrderDisplay } from '@/lib/utils';

export default function KitchenExecutiveDashboard({
  stats,
  recentOrders,
}: {
  stats: any;
  recentOrders: any[];
}) {
  const activeKitchenOrders = recentOrders.filter((o) => o.status === 'pending' || o.status === 'preparing');

  return (
    <div className="space-y-6">
      {/* Kitchen Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        <Card hover padding="md">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs text-text-muted">Pending Tickets</p>
              <p className="text-xl font-black text-amber-400">{stats.pendingOrders}</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-amber-500/15 text-amber-400 flex items-center justify-center">
              <Clock className="w-5 h-5" />
            </div>
          </div>
        </Card>

        <Card hover padding="md">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs text-text-muted">Preparing Now</p>
              <p className="text-xl font-black text-blue-400">{stats.preparingOrders}</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-blue-500/15 text-blue-400 flex items-center justify-center">
              <ChefHat className="w-5 h-5" />
            </div>
          </div>
        </Card>

        <Card hover padding="md">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs text-text-muted">Urgent / Delayed (&gt;15m)</p>
              <p className="text-xl font-black text-accent-danger">{stats.delayedOrders}</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-accent-danger/15 text-accent-danger flex items-center justify-center">
              <AlertCircle className="w-5 h-5" />
            </div>
          </div>
        </Card>

        <Card hover padding="md">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs text-text-muted">Completed Today</p>
              <p className="text-xl font-black text-emerald-400">{stats.completedOrders}</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>
        </Card>
      </div>

      {/* KDS Banner */}
      <Link href="/kitchen">
        <div className="p-6 rounded-3xl bg-gradient-to-r from-amber-500/20 via-orange-500/10 to-transparent border border-amber-500/30 flex items-center justify-between shadow-xl cursor-pointer hover:border-amber-500/50 transition-colors">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold">
              <ChefHat className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-base font-bold text-text-primary">Launch Live Fullscreen KDS Order Board</h2>
              <p className="text-xs text-text-muted">Real-time order statuses, dish preparation timer, and bump features.</p>
            </div>
          </div>
          <Button variant="primary" icon={<ArrowRight className="w-4 h-4" />}>
            Open KDS Board
          </Button>
        </div>
      </Link>

      {/* Active Kitchen Tickets List */}
      <div className="rounded-3xl glass border border-border p-6 space-y-4 shadow-xl">
        <h2 className="text-sm font-bold text-text-primary flex items-center gap-2 border-b border-border pb-3">
          <ChefHat className="w-4 h-4 text-amber-400" />
          Active Live Kitchen Tickets Queue ({activeKitchenOrders.length})
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {activeKitchenOrders.length === 0 ? (
            <div className="col-span-full py-12 text-center text-text-muted">
              <CheckCircle2 className="w-10 h-10 mx-auto mb-2 text-emerald-400 opacity-50" />
              <p className="font-semibold text-sm">All Kitchen Orders Cleared!</p>
            </div>
          ) : (
            activeKitchenOrders.map((o) => (
              <div key={o.id} className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 space-y-3">
                <div className="flex items-center justify-between border-b border-border pb-2">
                  <div>
                    <span className="font-mono font-bold text-xs text-text-primary">{getOrderDisplay(o)}</span>
                    <p className="text-[10px] text-text-muted">
                      {o.restaurant_table ? `Table ${o.restaurant_table.table_number}` : 'Takeaway'}
                    </p>
                  </div>
                  <Badge variant={o.status === 'preparing' ? 'preparing' : 'default'} className="capitalize text-[10px]">
                    {o.status}
                  </Badge>
                </div>

                <div className="space-y-1">
                  {(o.order_items || []).map((item: any, i: number) => (
                    <div key={i} className="flex items-center justify-between text-xs text-text-secondary">
                      <span className="font-bold text-text-primary">{item.quantity}x {item.menu_item?.name || 'Item'}</span>
                      {item.special_instructions && (
                        <span className="text-[10px] text-accent-warning italic">{item.special_instructions}</span>
                      )}
                    </div>
                  ))}
                </div>

                <p className="text-[10px] text-text-muted text-right pt-2 border-t border-white/5">
                  Ordered {getTimeAgo(o.created_at)}
                </p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
