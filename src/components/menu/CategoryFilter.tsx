'use client';

import React from 'react';
import { Category } from '@/types/database';
import { cn } from '@/lib/utils';

interface CategoryFilterProps {
  categories: Category[];
  activeCategory: string | null;
  onSelect: (categoryId: string | null) => void;
}

export default function CategoryFilter({ categories, activeCategory, onSelect }: CategoryFilterProps) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none no-print">
      <button
        onClick={() => onSelect(null)}
        className={cn(
          'px-4 py-2 rounded-full text-xs font-medium whitespace-nowrap transition-all duration-200 cursor-pointer shrink-0',
          activeCategory === null
            ? 'bg-gradient-to-r from-accent-primary to-accent-secondary text-white shadow-lg shadow-accent-primary/25'
            : 'glass glass-hover text-text-secondary hover:text-text-primary'
        )}
      >
        All Items
      </button>
      {categories.map((category) => (
        <button
          key={category.id}
          onClick={() => onSelect(category.id)}
          className={cn(
            'px-4 py-2 rounded-full text-xs font-medium whitespace-nowrap transition-all duration-200 cursor-pointer shrink-0',
            activeCategory === category.id
              ? 'bg-gradient-to-r from-accent-primary to-accent-secondary text-white shadow-lg shadow-accent-primary/25'
              : 'glass glass-hover text-text-secondary hover:text-text-primary'
          )}
        >
          {category.name}
        </button>
      ))}
    </div>
  );
}
