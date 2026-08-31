'use client';

import React from 'react';
import Link from 'next/link';
import Card from '@/components/ui/Card';
import {
  CheckCircle2,
  QrCode,
  Clock,
  UtensilsCrossed,
  ArrowRight,
} from 'lucide-react';

export default function WaiterServiceDashboard({
  stats,
  recentOrders,
}: {
  stats: any;
  recentOrders: any[];
}) {
  const readyToServe = recentOrders.filter((o) => o.status === 'completed' || o.status === 'served');

  return (
    <div className="space-y-6">
      {/* Waiter Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        <Card hover padding="md">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs text-text-muted">Ready to Serve</p>
              <p className="text-xl font-black text-emerald-400">{readyToServe.length}</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>
        </Card>

        <Card hover padding="md">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs text-text-muted">Active Dining Tables</p>
              <p className="text-xl font-black text-accent-primary">{stats.activeTables}</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-accent-primary/15 text-accent-primary flex items-center justify-center">
              <QrCode className="w-5 h-5" />
            </div>
          </div>
        </Card>

        <Card hover padding="md">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs text-text-muted">Pending Orders</p>
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
              <p className="text-xs text-text-muted">Orders Served Today</p>
              <p className="text-xl font-black text-purple-400">{stats.servedOrders + stats.completedOrders}</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-purple-500/15 text-purple-400 flex items-center justify-center">
              <UtensilsCrossed className="w-5 h-5" />
            </div>
          </div>
        </Card>
      </div>

      {/* Waiter Actions */}
      <div className="flex items-center gap-4">
        <Link href="/admin/tables" className="flex-1">
          <div className="p-4 rounded-2xl bg-gradient-to-r from-accent-primary to-purple-600 text-white font-bold text-sm flex items-center justify-between shadow-lg cursor-pointer">
            <div className="flex items-center gap-3">
              <QrCode className="w-5 h-5" />
              <span>Tables Floor Plan &amp; QR Table Ordering</span>
            </div>
            <ArrowRight className="w-5 h-5" />
          </div>
        </Link>
      </div>

      {/* Ready to Serve Feed */}
      <div className="rounded-3xl glass border border-border p-6 space-y-4 shadow-xl">
        <h2 className="text-sm font-bold text-text-primary flex items-center gap-2 border-b border-border pb-3">
          <UtensilsCrossed className="w-4 h-4 text-emerald-400" />
          Orders Ready for Table Delivery ({readyToServe.length})
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {readyToServe.length === 0 ? (
            <div className="col-span-full py-8 text-center text-text-muted">
              <p className="text-xs font-semibold">No orders currently waiting for table delivery.</p>
            </div>
          ) : (
            readyToServe.map((o) => (
              <div key={o.id} className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold text-xs text-text-primary">{o.order_number || `#${o.id.slice(0, 8)}`}</span>
                  <span className="font-bold text-xs text-emerald-400">
                    {o.restaurant_table ? `Table ${o.restaurant_table.table_number}` : 'Counter'}
                  </span>
                </div>

                <div className="space-y-1">
                  {(o.order_items || []).map((item: any, i: number) => (
                    <p key={i} className="text-xs font-medium text-text-primary">
                      {item.quantity}x {item.menu_item?.name || 'Item'}
                    </p>
                  ))}
                </div>

                <div className="pt-2 border-t border-emerald-500/20 text-right">
                  <span className="text-[10px] text-emerald-400 font-bold">Ready to Serve</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
