'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { MenuItem, Category } from '@/types/database';
import { formatCurrency, cn } from '@/lib/utils';
import { Search, Plus, Loader2, Package } from 'lucide-react';

interface POSMenuGridProps {
  onAddItem: (item: MenuItem) => void;
}

export default function POSMenuGrid({ onAddItem }: POSMenuGridProps) {
  const supabase = createClient();
  const [categories, setCategories] = useState<Category[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    const [catRes, itemRes] = await Promise.all([
      supabase.from('categories').select('*').order('display_order'),
      supabase.from('menu_items').select('*').eq('is_available', true).order('name'),
    ]);
    setCategories(catRes.data || []);
    setMenuItems(itemRes.data || []);
    setLoading(false);
  }

  const filteredItems = useMemo(() => {
    let items = menuItems;
    if (activeCategory) {
      items = items.filter((i) => i.category_id === activeCategory);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      items = items.filter((i) => i.name.toLowerCase().includes(q));
    }
    return items;
  }, [menuItems, activeCategory, search]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-6 h-6 text-accent-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Search */}
      <div className="p-3 border-b border-border shrink-0">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
          <input
            type="text"
            placeholder="Search menu items..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl text-sm text-text-primary bg-bg-tertiary border border-border placeholder:text-text-muted focus:outline-none focus:border-accent-primary/50 focus:ring-2 focus:ring-accent-primary/20 transition-all"
          />
        </div>
      </div>

      {/* Category Tabs */}
      <div className="p-3 border-b border-border shrink-0 overflow-x-auto">
        <div className="flex gap-2">
          <button
            onClick={() => setActiveCategory(null)}
            className={cn(
              'px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer',
              !activeCategory
                ? 'bg-accent-primary text-white shadow-lg shadow-accent-primary/25'
                : 'bg-white/5 text-text-secondary hover:bg-white/10'
            )}
          >
            All Items
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={cn(
                'px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer',
                activeCategory === cat.id
                  ? 'bg-accent-primary text-white shadow-lg shadow-accent-primary/25'
                  : 'bg-white/5 text-text-secondary hover:bg-white/10'
              )}
            >
              {cat.name}
            </button>
          ))}
        </div>
      </div>

      {/* Items Grid */}
      <div className="flex-1 overflow-y-auto p-3">
        {filteredItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-text-muted">
            <Package className="w-10 h-10 mb-2 opacity-30" />
            <p className="text-sm">No items found</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 xl:grid-cols-3 gap-2">
            {filteredItems.map((item) => (
              <button
                key={item.id}
                onClick={() => onAddItem(item)}
                className="group relative flex flex-col p-3 rounded-xl glass glass-hover transition-all duration-200 text-left cursor-pointer hover:shadow-lg hover:shadow-accent-primary/5 hover:-translate-y-0.5 active:scale-[0.98]"
              >
                {/* Item Image or Placeholder */}
                {item.image_url ? (
                  <div className="w-full h-20 rounded-lg overflow-hidden mb-2 bg-bg-tertiary">
                    <img
                      src={item.image_url}
                      alt={item.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  </div>
                ) : (
                  <div className="w-full h-20 rounded-lg mb-2 bg-gradient-to-br from-accent-primary/10 to-accent-secondary/10 flex items-center justify-center">
                    <Package className="w-6 h-6 text-accent-primary/40" />
                  </div>
                )}

                <p className="text-sm font-medium text-text-primary truncate w-full">
                  {item.name}
                </p>
                <p className="text-xs font-bold text-accent-primary mt-1">
                  {formatCurrency(item.price)}
                </p>

                {/* Quick add indicator */}
                <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-accent-primary/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <Plus className="w-3.5 h-3.5 text-accent-primary" />
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
