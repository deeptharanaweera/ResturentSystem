'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'success';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  icon?: React.ReactNode;
}

const variantStyles: Record<string, string> = {
  primary:
    'bg-gradient-to-r from-accent-primary to-accent-secondary text-white shadow-lg shadow-accent-primary/25 hover:shadow-accent-primary/40 hover:brightness-110',
  secondary:
    'glass glass-hover text-text-primary',
  danger:
    'bg-accent-danger/20 text-accent-danger border border-accent-danger/30 hover:bg-accent-danger/30',
  ghost:
    'text-text-secondary hover:text-text-primary hover:bg-white/5',
  success:
    'bg-accent-success/20 text-accent-success border border-accent-success/30 hover:bg-accent-success/30',
};

const sizeStyles: Record<string, string> = {
  sm: 'px-3 py-1.5 text-xs rounded-lg',
  md: 'px-4 py-2 text-sm rounded-xl',
  lg: 'px-6 py-3 text-base rounded-xl',
};

export default function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  icon,
  children,
  className,
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center gap-2 font-medium transition-all duration-200 cursor-pointer',
        'disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:brightness-100',
        'active:scale-[0.98]',
        variantStyles[variant],
        sizeStyles[size],
        className
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : icon ? (
        <span className="w-4 h-4">{icon}</span>
      ) : null}
      {children}
    </button>
  );
}
