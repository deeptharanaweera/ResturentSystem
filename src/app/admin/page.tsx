'use client';

import React, { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import Card from '@/components/ui/Card';
import { UtensilsCrossed, ShoppingBag, Receipt, QrCode, TrendingUp, Clock } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

export default function AdminDashboard() {
  const supabase = createClient();
  const [stats, setStats] = useState({
    totalOrders: 0,
    pendingOrders: 0,
    totalRevenue: 0,
    activeTables: 0,
    menuItems: 0,
    todayOrders: 0,
  });

  useEffect(() => {
    loadStats();
  }, []);

  async function loadStats() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [ordersRes, tablesRes, menuRes, todayRes] = await Promise.all([
      supabase.from('orders').select('id, status, total_amount'),
      supabase.from('restaurant_tables').select('id').eq('is_active', true),
      supabase.from('menu_items').select('id').eq('is_available', true),
      supabase.from('orders').select('id').gte('created_at', today.toISOString()),
    ]);

    const orders = ordersRes.data || [];
    setStats({
      totalOrders: orders.length,
      pendingOrders: orders.filter((o) => o.status === 'pending' || o.status === 'preparing').length,
      totalRevenue: orders
        .filter((o) => o.status === 'completed')
        .reduce((sum, o) => sum + (o.total_amount || 0), 0),
      activeTables: tablesRes.data?.length || 0,
      menuItems: menuRes.data?.length || 0,
      todayOrders: todayRes.data?.length || 0,
    });
  }

  const statCards = [
    { label: 'Total Orders', value: stats.totalOrders, icon: ShoppingBag, color: 'text-accent-primary', bg: 'bg-accent-primary/15' },
    { label: 'Pending/Preparing', value: stats.pendingOrders, icon: Clock, color: 'text-accent-warning', bg: 'bg-accent-warning/15' },
    { label: 'Revenue', value: formatCurrency(stats.totalRevenue), icon: TrendingUp, color: 'text-accent-success', bg: 'bg-accent-success/15' },
    { label: 'Active Tables', value: stats.activeTables, icon: QrCode, color: 'text-accent-secondary', bg: 'bg-accent-secondary/15' },
    { label: 'Menu Items', value: stats.menuItems, icon: UtensilsCrossed, color: 'text-blue-400', bg: 'bg-blue-500/15' },
    { label: "Today's Orders", value: stats.todayOrders, icon: Receipt, color: 'text-emerald-400', bg: 'bg-emerald-500/15' },
  ];

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Dashboard</h1>
        <p className="text-sm text-text-muted mt-1">Overview of your restaurant operations</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4">
        {statCards.map((stat, i) => {
          const Icon = stat.icon;
          return (
            <Card key={i} hover className="animate-slide-up" padding="md">
              <div className="flex items-start justify-between">
                <div className="space-y-2">
                  <p className="text-xs text-text-muted">{stat.label}</p>
                  <p className="text-xl md:text-2xl font-bold text-text-primary">{stat.value}</p>
                </div>
                <div className={`w-10 h-10 rounded-xl ${stat.bg} flex items-center justify-center`}>
                  <Icon className={`w-5 h-5 ${stat.color}`} />
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
