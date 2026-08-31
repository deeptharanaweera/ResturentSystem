'use client';

import React from 'react';
import Link from 'next/link';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import {
  TrendingUp,
  Receipt,
  Clock,
  ShoppingBag,
  QrCode,
  DollarSign,
  ArrowRight,
  Flame,
} from 'lucide-react';
import { formatCurrency, getTimeAgo, getOrderDisplay } from '@/lib/utils';

export default function AdminExecutiveDashboard({
  stats,
  recentOrders,
  topItems,
}: {
  stats: any;
  recentOrders: any[];
  topItems: any[];
}) {
  const statCards = [
    { label: "Today's Revenue", value: formatCurrency(stats.todayRevenue), icon: TrendingUp, color: 'text-accent-success', bg: 'bg-accent-success/15' },
    { label: 'Total Invoices Today', value: stats.todayInvoices, icon: Receipt, color: 'text-accent-primary', bg: 'bg-accent-primary/15' },
    { label: 'Live Orders Pending/Prep', value: stats.pendingOrders + stats.preparingOrders, icon: Clock, color: 'text-accent-warning', bg: 'bg-accent-warning/15' },
    { label: 'Total Orders Recorded', value: stats.totalOrders, icon: ShoppingBag, color: 'text-cyan-400', bg: 'bg-cyan-500/15' },
    { label: 'Active Dining Tables', value: `${stats.activeTables} / ${stats.totalTables}`, icon: QrCode, color: 'text-purple-400', bg: 'bg-purple-500/15' },
    { label: 'Total Revenue (Lifetime)', value: formatCurrency(stats.totalRevenue), icon: DollarSign, color: 'text-emerald-400', bg: 'bg-emerald-500/15' },
  ];

  return (
    <div className="space-y-6">
      {/* Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {statCards.map((stat, i) => {
          const Icon = stat.icon;
          return (
            <Card key={i} hover className="animate-slide-up" padding="md">
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <p className="text-[11px] text-text-muted font-medium">{stat.label}</p>
                  <p className="text-lg md:text-xl font-black text-text-primary">{stat.value}</p>
                </div>
                <div className={`w-8 h-8 rounded-xl ${stat.bg} flex items-center justify-center shrink-0`}>
                  <Icon className={`w-4 h-4 ${stat.color}`} />
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Live Orders Feed */}
        <div className="lg:col-span-2 rounded-3xl glass border border-border p-6 space-y-4 shadow-xl">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <h2 className="text-sm font-bold text-text-primary flex items-center gap-2">
              <ShoppingBag className="w-4 h-4 text-accent-primary" />
              Live Order Feed
            </h2>
            <Link href="/pos" className="text-xs text-accent-primary hover:underline font-semibold flex items-center gap-1">
              <span>View POS</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="divide-y divide-border overflow-hidden">
            {recentOrders.length === 0 ? (
              <p className="text-xs text-text-muted py-6 text-center">No orders recorded yet today.</p>
            ) : (
              recentOrders.map((o) => (
                <div key={o.id} className="py-3 flex items-center justify-between hover:bg-white/[0.02] transition-colors px-2 rounded-xl">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center font-mono font-bold text-xs">
                      {getOrderDisplay(o)}
                    </div>
                    <div>
                      <p className="text-xs font-bold text-text-primary">
                        {o.customer_name ? o.customer_name : o.restaurant_table ? `Table ${o.restaurant_table.table_number}` : 'Counter / Takeaway'}
                      </p>
                      <p className="text-[10px] text-text-muted">
                        {getTimeAgo(o.created_at)} • {(o.order_items || []).length} items
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="font-mono font-bold text-xs text-text-primary">{formatCurrency(o.total_amount)}</span>
                    <Badge
                      variant={
                        o.status === 'completed'
                          ? 'completed'
                          : o.status === 'preparing'
                          ? 'preparing'
                          : o.status === 'served'
                          ? 'served'
                          : 'default'
                      }
                      className="capitalize text-[10px]"
                    >
                      {o.status}
                    </Badge>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Top Best Selling Items */}
        <div className="rounded-3xl glass border border-border p-6 space-y-4 shadow-xl">
          <h2 className="text-sm font-bold text-text-primary flex items-center gap-2 border-b border-border pb-3">
            <Flame className="w-4 h-4 text-amber-400" />
            Top Selling Items
          </h2>

          <div className="space-y-3">
            {topItems.length === 0 ? (
              <p className="text-xs text-text-muted py-6 text-center">No sales item data available.</p>
            ) : (
              topItems.map((item, idx) => (
                <div key={idx} className="p-3 rounded-2xl bg-white/[0.03] border border-white/5 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-lg bg-accent-primary/10 text-accent-primary font-bold text-xs flex items-center justify-center">
                      #{idx + 1}
                    </span>
                    <div>
                      <p className="text-xs font-bold text-text-primary">{item.name}</p>
                      <p className="text-[10px] text-text-muted">{item.count} orders</p>
                    </div>
                  </div>
                  <span className="font-mono font-bold text-xs text-accent-primary">{formatCurrency(item.total)}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
