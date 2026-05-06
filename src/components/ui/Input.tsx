import React from 'react';
import { cn } from '@/lib/utils';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  icon?: React.ReactNode;
}

export default function Input({ label, error, icon, className, ...props }: InputProps) {
  return (
    <div className="space-y-1.5">
      {label && (
        <label className="block text-sm font-medium text-text-secondary">
          {label}
        </label>
      )}
      <div className="relative">
        {icon && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted">
            {icon}
          </div>
        )}
        <input
          className={cn(
            'w-full px-4 py-2.5 rounded-xl text-sm text-text-primary bg-bg-tertiary border border-border',
            'placeholder:text-text-muted',
            'focus:outline-none focus:border-accent-primary/50 focus:ring-2 focus:ring-accent-primary/20',
            'transition-all duration-200',
            !!icon && 'pl-10',
            error && 'border-accent-danger/50 focus:border-accent-danger/50 focus:ring-accent-danger/20',
            className
          )}
          {...props}
        />
      </div>
      {error && (
        <p className="text-xs text-accent-danger">{error}</p>
      )}
    </div>
  );
}
