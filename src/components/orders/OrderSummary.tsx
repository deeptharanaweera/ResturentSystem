'use client';

import React from 'react';
import { formatCurrency, formatTime, generateOrderNumber } from '@/lib/utils';
import { RESTAURANT_NAME } from '@/lib/constants';
import { CheckCircle, Clock, UtensilsCrossed } from 'lucide-react';
import Card from '@/components/ui/Card';

interface OrderSummaryProps {
  orderId: string;
  items: { name: string; quantity: number; price: number }[];
  total: number;
  tableNumber: number;
  createdAt: string;
  onNewOrder: () => void;
}

export default function OrderSummary({
  orderId,
  items,
  total,
  tableNumber,
  createdAt,
  onNewOrder,
}: OrderSummaryProps) {
  return (
    <div className="min-h-screen bg-bg-primary flex items-center justify-center p-4">
      <div className="w-full max-w-md animate-scale-in">
        <Card className="text-center space-y-6">
          {/* Success Icon */}
          <div className="flex justify-center">
            <div className="w-16 h-16 rounded-full bg-accent-success/20 flex items-center justify-center animate-scale-in">
              <CheckCircle className="w-8 h-8 text-accent-success" />
            </div>
          </div>

          <div>
            <h2 className="text-xl font-bold text-text-primary">Order Placed!</h2>
            <p className="text-text-muted text-sm mt-1">
              Your order has been sent to the kitchen
            </p>
          </div>

          {/* Order Details */}
          <div className="glass rounded-xl p-4 text-left space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-text-muted">Order ID</span>
              <span className="font-mono text-text-primary">{generateOrderNumber(orderId)}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-text-muted">Table</span>
              <span className="text-text-primary font-medium">Table {tableNumber}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-text-muted">Time</span>
              <span className="text-text-primary">{formatTime(createdAt)}</span>
            </div>

            <div className="border-t border-border pt-3 space-y-2">
              {items.map((item, i) => (
                <div key={i} className="flex items-center justify-between text-sm">
                  <span className="text-text-secondary">
                    {item.quantity}× {item.name}
                  </span>
                  <span className="text-text-primary">{formatCurrency(item.price * item.quantity)}</span>
                </div>
              ))}
            </div>

            <div className="border-t border-border pt-3 flex items-center justify-between">
              <span className="text-sm font-medium text-text-primary">Total</span>
              <span className="text-lg font-bold gradient-text">{formatCurrency(total)}</span>
            </div>
          </div>

          {/* Status */}
          <div className="flex items-center justify-center gap-2 text-amber-400 text-sm">
            <Clock className="w-4 h-4" />
            <span>Preparing your order...</span>
          </div>

          {/* New Order Button */}
          <button
            onClick={onNewOrder}
            className="w-full py-3 rounded-xl text-sm font-medium glass glass-hover text-text-primary transition-all cursor-pointer"
          >
            <div className="flex items-center justify-center gap-2">
              <UtensilsCrossed className="w-4 h-4" />
              <span>Order More Items</span>
            </div>
          </button>

          <p className="text-[10px] text-text-muted">{RESTAURANT_NAME}</p>
        </Card>
      </div>
    </div>
  );
}
