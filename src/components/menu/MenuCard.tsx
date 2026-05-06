'use client';

import React from 'react';
import { MenuItem } from '@/types/database';
import { formatCurrency, cn } from '@/lib/utils';
import { Plus, Minus } from 'lucide-react';

interface MenuCardProps {
  item: MenuItem;
  quantity: number;
  onAdd: () => void;
  onRemove: () => void;
}

export default function MenuCard({ item, quantity, onAdd, onRemove }: MenuCardProps) {
  return (
    <div
      className={cn(
        'group relative rounded-2xl glass overflow-hidden transition-all duration-300',
        'hover:shadow-lg hover:shadow-accent-primary/5 hover:-translate-y-0.5',
        quantity > 0 && 'ring-1 ring-accent-primary/40'
      )}
    >
      {/* Image */}
      <div className="relative h-40 overflow-hidden bg-bg-tertiary">
        {item.image_url ? (
          <img
            src={item.image_url}
            alt={item.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-text-muted">
            <svg className="w-12 h-12 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
        )}
        {!item.is_available && (
          <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
            <span className="text-sm font-medium text-red-400">Unavailable</span>
          </div>
        )}
        {quantity > 0 && (
          <div className="absolute top-2 right-2 w-7 h-7 rounded-full bg-accent-primary flex items-center justify-center text-white text-xs font-bold shadow-lg">
            {quantity}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-4 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-sm font-semibold text-text-primary leading-tight line-clamp-1">
            {item.name}
          </h3>
          <span className="text-sm font-bold gradient-text whitespace-nowrap">
            {formatCurrency(item.price)}
          </span>
        </div>

        {item.description && (
          <p className="text-xs text-text-muted line-clamp-2 leading-relaxed">
            {item.description}
          </p>
        )}

        {/* Add to Cart */}
        {item.is_available && (
          <div className="pt-1">
            {quantity === 0 ? (
              <button
                onClick={onAdd}
                className="w-full py-2 rounded-xl text-xs font-medium bg-gradient-to-r from-accent-primary to-accent-secondary text-white hover:brightness-110 active:scale-[0.98] transition-all duration-200 cursor-pointer"
              >
                Add to Cart
              </button>
            ) : (
              <div className="flex items-center justify-center gap-3">
                <button
                  onClick={onRemove}
                  className="w-8 h-8 rounded-lg bg-white/5 border border-border hover:bg-white/10 flex items-center justify-center text-text-primary transition-all cursor-pointer"
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>
                <span className="text-sm font-semibold text-text-primary w-6 text-center">
                  {quantity}
                </span>
                <button
                  onClick={onAdd}
                  className="w-8 h-8 rounded-lg bg-accent-primary/20 border border-accent-primary/30 hover:bg-accent-primary/30 flex items-center justify-center text-accent-primary transition-all cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
