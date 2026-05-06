import React from 'react';
import { cn } from '@/lib/utils';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

const paddingStyles: Record<string, string> = {
  none: '',
  sm: 'p-3',
  md: 'p-5',
  lg: 'p-6',
};

export default function Card({ children, className, hover = false, padding = 'md' }: CardProps) {
  return (
    <div
      className={cn(
        'rounded-2xl glass transition-all duration-300',
        hover && 'glass-hover cursor-pointer hover:shadow-lg hover:shadow-accent-primary/5 hover:-translate-y-0.5',
        paddingStyles[padding],
        className
      )}
    >
      {children}
    </div>
  );
}
