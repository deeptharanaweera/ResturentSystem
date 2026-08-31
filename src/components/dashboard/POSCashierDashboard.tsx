'use client';

import React from 'react';
import Link from 'next/link';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import {
  Banknote,
  CreditCard,
  Clock,
  Receipt,
  ShoppingBag,
  ArrowRight,
  CalendarDays,
  AlertCircle,
} from 'lucide-react';
import { formatCurrency, formatDate, getOrderDisplay } from '@/lib/utils';

export default function POSCashierDashboard({
  stats,
  recentOrders,
  recentInvoices,
}: {
  stats: any;
  recentOrders: any[];
  recentInvoices: any[];
}) {
  const pendingCheckout = recentOrders.filter((o) => o.payment_status === 'unpaid');

  return (
    <div className="space-y-6">
      {/* Cashier Quick Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        <Card hover padding="md">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs text-text-muted">Today's Cash Collected</p>
              <p className="text-xl font-black text-emerald-400">{formatCurrency(stats.todayCash)}</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center">
              <Banknote className="w-5 h-5" />
            </div>
          </div>
        </Card>

        <Card hover padding="md">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs text-text-muted">Today's Card Payments</p>
              <p className="text-xl font-black text-blue-400">{formatCurrency(stats.todayCard)}</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-blue-500/15 text-blue-400 flex items-center justify-center">
              <CreditCard className="w-5 h-5" />
            </div>
          </div>
        </Card>

        <Card hover padding="md">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs text-text-muted">Pending Checkout Bills</p>
              <p className="text-xl font-black text-amber-400">{pendingCheckout.length}</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-amber-500/15 text-amber-400 flex items-center justify-center">
              <Clock className="w-5 h-5" />
            </div>
          </div>
        </Card>

        <Card hover padding="md">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs text-text-muted">Completed Invoices Today</p>
              <p className="text-xl font-black text-accent-primary">{stats.todayInvoices}</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-accent-primary/15 text-accent-primary flex items-center justify-center">
              <Receipt className="w-5 h-5" />
            </div>
          </div>
        </Card>
      </div>

      {/* POS Quick Control Buttons */}
      <div className="flex items-center gap-4 flex-wrap">
        <Link href="/pos" className="flex-1 min-w-[200px]">
          <div className="p-4 rounded-2xl bg-gradient-to-r from-accent-primary to-accent-secondary text-white font-bold text-sm flex items-center justify-between shadow-lg shadow-accent-primary/20 hover:scale-[1.01] transition-transform cursor-pointer">
            <div className="flex items-center gap-3">
              <ShoppingBag className="w-5 h-5" />
              <span>Launch POS Checkout Terminal</span>
            </div>
            <ArrowRight className="w-5 h-5" />
          </div>
        </Link>

        <Link href="/pos" className="min-w-[180px]">
          <div className="p-4 rounded-2xl bg-white/5 border border-white/10 text-text-primary hover:bg-white/10 font-bold text-sm flex items-center gap-2 cursor-pointer transition-colors">
            <CalendarDays className="w-5 h-5 text-amber-400" />
            <span>Manage POS Day Shift</span>
          </div>
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pending Unpaid Orders */}
        <div className="rounded-3xl glass border border-border p-6 space-y-4 shadow-xl">
          <h2 className="text-sm font-bold text-text-primary flex items-center gap-2 border-b border-border pb-3">
            <AlertCircle className="w-4 h-4 text-amber-400" />
            Orders Awaiting Payment &amp; Checkout
          </h2>

          <div className="space-y-2">
            {pendingCheckout.length === 0 ? (
              <p className="text-xs text-text-muted py-8 text-center">No pending unpaid orders right now.</p>
            ) : (
              pendingCheckout.map((o) => (
                <div key={o.id} className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/5 flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-xs text-text-primary">{getOrderDisplay(o)}</span>
                      <span className="text-xs font-semibold text-accent-primary">
                        {o.restaurant_table ? `Table ${o.restaurant_table.table_number}` : 'Counter'}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="font-mono font-bold text-sm text-emerald-400">{formatCurrency(o.total_amount)}</span>
                    <Link href="/pos">
                      <Button variant="primary" size="sm" className="py-1 text-xs">
                        Checkout
                      </Button>
                    </Link>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Recent Invoices Printed */}
        <div className="rounded-3xl glass border border-border p-6 space-y-4 shadow-xl">
          <h2 className="text-sm font-bold text-text-primary flex items-center gap-2 border-b border-border pb-3">
            <Receipt className="w-4 h-4 text-accent-primary" />
            Recent Issued Receipts &amp; Invoices
          </h2>

          <div className="space-y-2">
            {recentInvoices.length === 0 ? (
              <p className="text-xs text-text-muted py-8 text-center">No invoices printed today.</p>
            ) : (
              recentInvoices.map((inv) => (
                <div key={inv.id} className="p-3 rounded-2xl bg-white/[0.03] border border-white/5 flex items-center justify-between">
                  <div>
                    <p className="font-mono font-bold text-xs text-text-primary">INV #{inv.invoice_number}</p>
                    <p className="text-[10px] text-text-muted">{formatDate(inv.issued_at)}</p>
                  </div>

                  <div className="text-right">
                    <p className="font-mono font-bold text-xs text-emerald-400">{formatCurrency(inv.grand_total)}</p>
                    <span className="text-[10px] text-accent-primary font-semibold">Paid</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
