import React from 'react';
import { cn } from '@/lib/utils';

interface BadgeProps {
  children: React.ReactNode;
  className?: string;
  variant?: 'default' | 'pending' | 'preparing' | 'served' | 'completed' | 'cancelled';
}

const variantStyles: Record<string, string> = {
  default: 'bg-white/10 text-text-secondary border-white/10',
  pending: 'bg-amber-500/15 text-amber-400 border-amber-500/25',
  preparing: 'bg-blue-500/15 text-blue-400 border-blue-500/25',
  served: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25',
  completed: 'bg-slate-500/15 text-slate-300 border-slate-500/25',
  cancelled: 'bg-red-500/15 text-red-400 border-red-500/25',
};

export default function Badge({ children, className, variant = 'default' }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full border',
        variantStyles[variant],
        className
      )}
    >
      {children}
    </span>
  );
}
