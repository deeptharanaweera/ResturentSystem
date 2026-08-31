'use client';

import React from 'react';
import { OrderWithItems } from '@/types/database';
import { formatCurrency, getTimeAgo, generateOrderNumber, cn } from '@/lib/utils';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import { Clock, ChefHat, CheckCircle, UtensilsCrossed, Package, Store, Check } from 'lucide-react';

interface KitchenCardProps {
  order: OrderWithItems;
  onStatusChange: (orderId: string, newStatus: string) => void;
}

export default function KitchenCard({ order, onStatusChange }: KitchenCardProps) {
  const timeAgo = getTimeAgo(order.created_at);
  const diffMins = Math.floor((Date.now() - new Date(order.created_at).getTime()) / 60000);
  const isUrgent = order.status === 'pending' && diffMins > 10;
  const isCritical = order.status === 'pending' && diffMins > 20;

  const isTakeaway = order.order_type === 'takeaway';
  const isCounter = order.order_type === 'counter';

  return (
    <div className={cn(
      'rounded-2xl glass p-4 space-y-3 transition-all duration-300 animate-slide-up',
      isCritical && 'ring-1 ring-accent-danger/50 shadow-lg shadow-accent-danger/10',
      isUrgent && !isCritical && 'ring-1 ring-accent-warning/50 shadow-lg shadow-accent-warning/10'
    )}>
      {/* Header with order number, status, and payment tag */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs font-mono font-bold text-text-primary bg-white/5 px-2 py-0.5 rounded-lg border border-white/10">
            {generateOrderNumber(order.id, order.order_number)}
          </span>
          <Badge variant={order.status as 'pending' | 'preparing' | 'completed' | 'served'}>
            {order.status === 'pending' && <Clock className="w-3 h-3" />}
            {order.status === 'preparing' && <ChefHat className="w-3 h-3" />}
            {order.status === 'completed' && <CheckCircle className="w-3 h-3" />}
            {order.status === 'served' && <Check className="w-3 h-3" />}
            {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
          </Badge>
          {order.payment_status === 'paid' ? (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/25">
              PAID
            </span>
          ) : (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-400 border border-amber-500/25">
              UNPAID
            </span>
          )}
        </div>
        <div className={cn('text-xs shrink-0', isCritical ? 'text-accent-danger font-medium' : isUrgent ? 'text-accent-warning' : 'text-text-muted')}>
          {timeAgo}
        </div>
      </div>

      {/* Order Type & Location Banner */}
      <div className="flex items-center gap-2.5 p-2 rounded-xl bg-white/[0.04] border border-white/[0.06]">
        {isTakeaway ? (
          <>
            <div className="w-8 h-8 rounded-lg bg-amber-500/15 text-amber-400 flex items-center justify-center shrink-0">
              <Package className="w-4 h-4" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400">Take Away</span>
                {order.restaurant_table?.table_number && (
                  <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-accent-primary/15 text-accent-primary border border-accent-primary/20">
                    Table {order.restaurant_table.table_number}
                  </span>
                )}
              </div>
              <span className="text-sm font-semibold text-text-primary truncate block">
                {order.customer_name ? `Customer: ${order.customer_name}` : order.restaurant_table ? `Table ${order.restaurant_table.table_number} Takeaway` : 'Take Away Customer'}
              </span>
            </div>
          </>
        ) : isCounter ? (
          <>
            <div className="w-8 h-8 rounded-lg bg-emerald-500/15 text-emerald-400 flex items-center justify-center shrink-0">
              <Store className="w-4 h-4" />
            </div>
            <div className="min-w-0 flex-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 block">Counter</span>
              <span className="text-sm font-semibold text-text-primary truncate block">
                Counter Order
              </span>
            </div>
          </>
        ) : (
          <>
            <div className="w-8 h-8 rounded-lg bg-accent-primary/15 text-accent-primary flex items-center justify-center shrink-0">
              <UtensilsCrossed className="w-4 h-4" />
            </div>
            <div className="min-w-0 flex-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-accent-primary block">Dine In</span>
              <span className="text-sm font-semibold text-text-primary">
                Table {order.restaurant_table?.table_number || '?'}
              </span>
            </div>
          </>
        )}
      </div>

      {/* Item List */}
      <div className="space-y-1.5 bg-bg-primary/40 rounded-xl p-3">
        {order.order_items.map((oi) => (
          <div key={oi.id} className="flex items-start justify-between gap-2 text-sm">
            <div className="flex-1 min-w-0">
              <span className="text-text-primary">
                <span className="font-semibold text-accent-primary">{oi.quantity}×</span>{' '}
                {oi.menu_item?.name || 'Unknown Item'}
              </span>
              {oi.special_instructions && (
                <p className="text-xs text-accent-warning mt-0.5 italic">→ {oi.special_instructions}</p>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Action Buttons */}
      <div className="flex flex-col gap-2 pt-1">
        {order.status === 'pending' && (
          <Button variant="primary" size="sm" className="w-full" onClick={() => onStatusChange(order.id, 'preparing')}
            icon={<ChefHat className="w-3.5 h-3.5" />}>Start Preparing</Button>
        )}
        {order.status === 'preparing' && (
          <Button variant="success" size="sm" className="w-full bg-teal-600 hover:bg-teal-700 text-white border-teal-500/30" onClick={() => onStatusChange(order.id, 'completed')}
            icon={<CheckCircle className="w-3.5 h-3.5" />}>
            Mark as Complete
          </Button>
        )}
        {order.status === 'completed' && (
          (isTakeaway || isCounter || !order.table_id) ? (
            <Button variant="primary" size="sm" className="w-full bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => onStatusChange(order.id, 'served')}
              icon={<Check className="w-3.5 h-3.5" />}>
              Mark as Served
            </Button>
          ) : (
            <div className="w-full text-center py-2 px-3 rounded-xl bg-white/[0.04] border border-white/10 text-xs text-text-muted font-medium">
              Mark as Served in Table Management
            </div>
          )
        )}
      </div>
    </div>
  );
}

