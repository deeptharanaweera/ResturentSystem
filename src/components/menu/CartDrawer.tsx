'use client';

import React, { useState } from 'react';
import { CartItem } from '@/types/database';
import { formatCurrency, cn } from '@/lib/utils';
import { RESTAURANT_NAME } from '@/lib/constants';
import { X, ShoppingBag, Minus, Plus, Trash2, MessageSquare, Loader2 } from 'lucide-react';
import Button from '@/components/ui/Button';

interface CartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  items: CartItem[];
  onUpdateQuantity: (itemId: string, quantity: number) => void;
  onUpdateInstructions: (itemId: string, instructions: string) => void;
  onRemoveItem: (itemId: string) => void;
  onPlaceOrder: () => Promise<void>;
}

export default function CartDrawer({
  isOpen,
  onClose,
  items,
  onUpdateQuantity,
  onUpdateInstructions,
  onRemoveItem,
  onPlaceOrder,
}: CartDrawerProps) {
  const [loading, setLoading] = useState(false);
  const [editingInstructions, setEditingInstructions] = useState<string | null>(null);

  const subtotal = items.reduce(
    (sum, item) => sum + item.menuItem.price * item.quantity,
    0
  );

  const handlePlaceOrder = async () => {
    setLoading(true);
    try {
      await onPlaceOrder();
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 animate-fade-in"
          onClick={onClose}
        />
      )}

      {/* Drawer */}
      <div
        className={cn(
          'fixed bottom-0 left-0 right-0 z-50 max-h-[85vh] rounded-t-3xl bg-bg-secondary border-t border-border-light shadow-2xl transition-transform duration-300 ease-out flex flex-col',
          isOpen ? 'translate-y-0' : 'translate-y-full'
        )}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1 shrink-0">
          <div className="w-10 h-1 rounded-full bg-white/20" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 pb-4 border-b border-border shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-accent-primary/20 flex items-center justify-center">
              <ShoppingBag className="w-4 h-4 text-accent-primary" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-text-primary">Your Order</h3>
              <p className="text-xs text-text-muted">{items.length} item{items.length !== 1 ? 's' : ''}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-white/5 text-text-muted hover:text-text-primary transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Items */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          {items.length === 0 ? (
            <div className="text-center py-8">
              <ShoppingBag className="w-12 h-12 mx-auto text-text-muted/30 mb-3" />
              <p className="text-text-muted text-sm">Your cart is empty</p>
              <p className="text-text-muted/60 text-xs mt-1">Add items from the menu to get started</p>
            </div>
          ) : (
            items.map((item) => (
              <div
                key={item.menuItem.id}
                className="glass rounded-xl p-3 space-y-2"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-medium text-text-primary truncate">
                      {item.menuItem.name}
                    </h4>
                    <p className="text-xs text-text-muted mt-0.5">
                      {formatCurrency(item.menuItem.price)} each
                    </p>
                  </div>
                  <p className="text-sm font-semibold gradient-text whitespace-nowrap">
                    {formatCurrency(item.menuItem.price * item.quantity)}
                  </p>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() =>
                        item.quantity <= 1
                          ? onRemoveItem(item.menuItem.id)
                          : onUpdateQuantity(item.menuItem.id, item.quantity - 1)
                      }
                      className="w-7 h-7 rounded-lg bg-white/5 border border-border hover:bg-white/10 flex items-center justify-center transition-all cursor-pointer"
                    >
                      {item.quantity <= 1 ? (
                        <Trash2 className="w-3 h-3 text-accent-danger" />
                      ) : (
                        <Minus className="w-3 h-3 text-text-primary" />
                      )}
                    </button>
                    <span className="text-sm font-medium text-text-primary w-5 text-center">
                      {item.quantity}
                    </span>
                    <button
                      onClick={() => onUpdateQuantity(item.menuItem.id, item.quantity + 1)}
                      className="w-7 h-7 rounded-lg bg-accent-primary/15 border border-accent-primary/25 hover:bg-accent-primary/25 flex items-center justify-center transition-all cursor-pointer"
                    >
                      <Plus className="w-3 h-3 text-accent-primary" />
                    </button>
                  </div>

                  <button
                    onClick={() =>
                      setEditingInstructions(
                        editingInstructions === item.menuItem.id ? null : item.menuItem.id
                      )
                    }
                    className={cn(
                      'p-1.5 rounded-lg transition-colors cursor-pointer',
                      item.specialInstructions
                        ? 'text-accent-primary bg-accent-primary/10'
                        : 'text-text-muted hover:text-text-secondary hover:bg-white/5'
                    )}
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Special Instructions */}
                {editingInstructions === item.menuItem.id && (
                  <input
                    type="text"
                    placeholder="Special instructions (e.g., no onions)"
                    value={item.specialInstructions}
                    onChange={(e) => onUpdateInstructions(item.menuItem.id, e.target.value)}
                    className="w-full px-3 py-2 rounded-lg text-xs bg-bg-tertiary border border-border text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent-primary/40 transition-colors"
                  />
                )}
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        {items.length > 0 && (
          <div className="px-5 py-4 border-t border-border space-y-3 shrink-0">
            <div className="flex items-center justify-between">
              <span className="text-sm text-text-secondary">Subtotal</span>
              <span className="text-base font-bold gradient-text">{formatCurrency(subtotal)}</span>
            </div>
            <Button
              variant="primary"
              size="lg"
              className="w-full"
              loading={loading}
              onClick={handlePlaceOrder}
            >
              {loading ? 'Placing Order...' : `Place Order • ${formatCurrency(subtotal)}`}
            </Button>
            <p className="text-[10px] text-center text-text-muted">
              Powered by {RESTAURANT_NAME}
            </p>
          </div>
        )}
      </div>
    </>
  );
}
