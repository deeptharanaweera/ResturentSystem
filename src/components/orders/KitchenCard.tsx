'use client';

import React from 'react';
import { OrderWithItems } from '@/types/database';
import { formatCurrency, getTimeAgo, generateOrderNumber, cn } from '@/lib/utils';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import { Clock, ChefHat, CheckCircle, UtensilsCrossed } from 'lucide-react';

interface KitchenCardProps {
  order: OrderWithItems;
  onStatusChange: (orderId: string, newStatus: string) => void;
}

export default function KitchenCard({ order, onStatusChange }: KitchenCardProps) {
  const timeAgo = getTimeAgo(order.created_at);
  const diffMins = Math.floor((Date.now() - new Date(order.created_at).getTime()) / 60000);
  const isUrgent = order.status === 'pending' && diffMins > 10;
  const isCritical = order.status === 'pending' && diffMins > 20;

  return (
    <div className={cn(
      'rounded-2xl glass p-4 space-y-3 transition-all duration-300 animate-slide-up',
      isCritical && 'ring-1 ring-accent-danger/50 shadow-lg shadow-accent-danger/10',
      isUrgent && !isCritical && 'ring-1 ring-accent-warning/50 shadow-lg shadow-accent-warning/10'
    )}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-text-muted">{generateOrderNumber(order.id)}</span>
          <Badge variant={order.status as 'pending' | 'preparing' | 'served'}>
            {order.status === 'pending' && <Clock className="w-3 h-3" />}
            {order.status === 'preparing' && <ChefHat className="w-3 h-3" />}
            {order.status === 'served' && <CheckCircle className="w-3 h-3" />}
            {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
          </Badge>
        </div>
        <div className={cn('text-xs', isCritical ? 'text-accent-danger font-medium' : isUrgent ? 'text-accent-warning' : 'text-text-muted')}>
          {timeAgo}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-accent-primary/15 flex items-center justify-center">
          <UtensilsCrossed className="w-4 h-4 text-accent-primary" />
        </div>
        <span className="text-sm font-semibold text-text-primary">
          Table {order.restaurant_table?.table_number || '?'}
        </span>
      </div>

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

      <div className="flex gap-2 pt-1">
        {order.status === 'pending' && (
          <Button variant="primary" size="sm" className="flex-1" onClick={() => onStatusChange(order.id, 'preparing')}
            icon={<ChefHat className="w-3.5 h-3.5" />}>Start Preparing</Button>
        )}
        {order.status === 'preparing' && (
          <Button variant="success" size="sm" className="flex-1" onClick={() => onStatusChange(order.id, 'served')}
            icon={<CheckCircle className="w-3.5 h-3.5" />}>Mark as Served</Button>
        )}
      </div>
    </div>
  );
}
