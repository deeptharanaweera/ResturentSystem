'use client';

import React, { useState, useEffect, use } from 'react';
import { createClient } from '@/lib/supabase/client';
import { MenuItem, Category, CartItem, RestaurantTable } from '@/types/database';
import { formatCurrency } from '@/lib/utils';
import { RESTAURANT_NAME } from '@/lib/constants';
import MenuCard from '@/components/menu/MenuCard';
import CategoryFilter from '@/components/menu/CategoryFilter';
import CartDrawer from '@/components/menu/CartDrawer';
import OrderSummary from '@/components/orders/OrderSummary';
import { ShoppingBag, UtensilsCrossed, Search, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface PageProps {
  params: Promise<{ table_id: string }>;
}

export default function MenuPage({ params }: PageProps) {
  const { table_id } = use(params);
  const supabase = createClient();

  const [table, setTable] = useState<RestaurantTable | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [orderPlaced, setOrderPlaced] = useState<{
    orderId: string;
    items: { name: string; quantity: number; price: number }[];
    total: number;
    createdAt: string;
  } | null>(null);

  useEffect(() => {
    loadData();
  }, [table_id]);

  async function loadData() {
    setLoading(true);
    try {
      // Fetch table
      const { data: tableData, error: tableError } = await supabase
        .from('restaurant_tables')
        .select('*')
        .eq('id', table_id)
        .eq('is_active', true)
        .single();

      if (tableError || !tableData) {
        setError('Table not found or is inactive.');
        setLoading(false);
        return;
      }
      setTable(tableData);

      // Fetch categories
      const { data: catData } = await supabase
        .from('categories')
        .select('*')
        .order('display_order', { ascending: true });
      setCategories(catData || []);

      // Fetch menu items
      const { data: itemData } = await supabase
        .from('menu_items')
        .select('*')
        .eq('is_available', true)
        .order('name', { ascending: true });
      setMenuItems(itemData || []);
    } catch {
      setError('Failed to load menu.');
    }
    setLoading(false);
  }

  // Cart helpers
  const addToCart = (item: MenuItem) => {
    setCart((prev) => {
      const existing = prev.find((c) => c.menuItem.id === item.id);
      if (existing) {
        return prev.map((c) =>
          c.menuItem.id === item.id ? { ...c, quantity: c.quantity + 1 } : c
        );
      }
      return [...prev, { menuItem: item, quantity: 1, specialInstructions: '' }];
    });
  };

  const removeFromCart = (itemId: string) => {
    setCart((prev) => {
      const existing = prev.find((c) => c.menuItem.id === itemId);
      if (existing && existing.quantity > 1) {
        return prev.map((c) =>
          c.menuItem.id === itemId ? { ...c, quantity: c.quantity - 1 } : c
        );
      }
      return prev.filter((c) => c.menuItem.id !== itemId);
    });
  };

  const updateQuantity = (itemId: string, quantity: number) => {
    if (quantity <= 0) {
      setCart((prev) => prev.filter((c) => c.menuItem.id !== itemId));
    } else {
      setCart((prev) =>
        prev.map((c) => (c.menuItem.id === itemId ? { ...c, quantity } : c))
      );
    }
  };

  const updateInstructions = (itemId: string, instructions: string) => {
    setCart((prev) =>
      prev.map((c) =>
        c.menuItem.id === itemId ? { ...c, specialInstructions: instructions } : c
      )
    );
  };

  const removeItem = (itemId: string) => {
    setCart((prev) => prev.filter((c) => c.menuItem.id !== itemId));
  };

  const getItemQuantity = (itemId: string) => {
    return cart.find((c) => c.menuItem.id === itemId)?.quantity || 0;
  };

  const cartTotal = cart.reduce((sum, c) => sum + c.menuItem.price * c.quantity, 0);
  const cartCount = cart.reduce((sum, c) => sum + c.quantity, 0);

  // Place order
  const placeOrder = async () => {
    if (cart.length === 0) return;

    try {
      // Create order
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert({
          table_id: table_id,
          total_amount: cartTotal,
          status: 'pending',
          payment_status: 'unpaid',
        })
        .select()
        .single();

      if (orderError) throw orderError;

      // Create order items
      const orderItems = cart.map((c) => ({
        order_id: order.id,
        item_id: c.menuItem.id,
        quantity: c.quantity,
        unit_price: c.menuItem.price,
        special_instructions: c.specialInstructions || null,
      }));

      const { error: itemsError } = await supabase.from('order_items').insert(orderItems);
      if (itemsError) throw itemsError;

      // Show success
      setOrderPlaced({
        orderId: order.id,
        items: cart.map((c) => ({
          name: c.menuItem.name,
          quantity: c.quantity,
          price: c.menuItem.price,
        })),
        total: cartTotal,
        createdAt: order.created_at,
      });

      setCart([]);
      setCartOpen(false);
      toast.success('Order placed successfully!');
    } catch (err) {
      toast.error('Failed to place order. Please try again.');
      console.error(err);
    }
  };

  // Filter items
  const filteredItems = menuItems.filter((item) => {
    const matchesCategory = !activeCategory || item.category_id === activeCategory;
    const matchesSearch = !searchQuery || item.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-bg-primary flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="w-8 h-8 text-accent-primary animate-spin mx-auto" />
          <p className="text-text-muted text-sm">Loading menu...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-bg-primary flex items-center justify-center p-4">
        <div className="text-center space-y-4 glass rounded-2xl p-8 max-w-sm">
          <div className="w-14 h-14 rounded-full bg-accent-danger/20 flex items-center justify-center mx-auto">
            <UtensilsCrossed className="w-7 h-7 text-accent-danger" />
          </div>
          <h2 className="text-lg font-semibold text-text-primary">Oops!</h2>
          <p className="text-sm text-text-muted">{error}</p>
        </div>
      </div>
    );
  }

  // Order placed state
  if (orderPlaced && table) {
    return (
      <OrderSummary
        orderId={orderPlaced.orderId}
        items={orderPlaced.items}
        total={orderPlaced.total}
        tableNumber={table.table_number}
        createdAt={orderPlaced.createdAt}
        onNewOrder={() => setOrderPlaced(null)}
      />
    );
  }

  return (
    <div className="min-h-screen bg-bg-primary pb-24">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-bg-primary/80 backdrop-blur-xl border-b border-border px-4 pt-4 pb-3 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold gradient-text">{RESTAURANT_NAME}</h1>
            <p className="text-xs text-text-muted">Table {table?.table_number}</p>
          </div>
          <button
            onClick={() => setCartOpen(true)}
            className="relative p-2.5 rounded-xl glass glass-hover transition-all cursor-pointer"
          >
            <ShoppingBag className="w-5 h-5 text-text-primary" />
            {cartCount > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-accent-primary text-white text-[10px] font-bold flex items-center justify-center">
                {cartCount}
              </span>
            )}
          </button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
          <input
            type="text"
            placeholder="Search menu..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 rounded-xl text-sm bg-bg-tertiary border border-border text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent-primary/40 transition-colors"
          />
        </div>

        {/* Categories */}
        <CategoryFilter
          categories={categories}
          activeCategory={activeCategory}
          onSelect={setActiveCategory}
        />
      </div>

      {/* Menu Grid */}
      <div className="p-4">
        {filteredItems.length === 0 ? (
          <div className="text-center py-12">
            <UtensilsCrossed className="w-10 h-10 text-text-muted/30 mx-auto mb-3" />
            <p className="text-text-muted text-sm">No items found</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {filteredItems.map((item, i) => (
              <div key={item.id} className="animate-slide-up" style={{ animationDelay: `${i * 0.03}s` }}>
                <MenuCard
                  item={item}
                  quantity={getItemQuantity(item.id)}
                  onAdd={() => addToCart(item)}
                  onRemove={() => removeFromCart(item.id)}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Floating Cart Button */}
      {cartCount > 0 && !cartOpen && (
        <div className="fixed bottom-4 left-4 right-4 z-30 animate-slide-up">
          <button
            onClick={() => setCartOpen(true)}
            className="w-full flex items-center justify-between px-5 py-3.5 rounded-2xl bg-gradient-to-r from-accent-primary to-accent-secondary text-white shadow-xl shadow-accent-primary/30 hover:brightness-110 active:scale-[0.99] transition-all cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <ShoppingBag className="w-5 h-5" />
              <span className="text-sm font-medium">{cartCount} item{cartCount !== 1 ? 's' : ''}</span>
            </div>
            <span className="text-sm font-bold">{formatCurrency(cartTotal)}</span>
          </button>
        </div>
      )}

      {/* Cart Drawer */}
      <CartDrawer
        isOpen={cartOpen}
        onClose={() => setCartOpen(false)}
        items={cart}
        onUpdateQuantity={updateQuantity}
        onUpdateInstructions={updateInstructions}
        onRemoveItem={removeItem}
        onPlaceOrder={placeOrder}
      />
    </div>
  );
}
