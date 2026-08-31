'use client';

import React, { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { CartItem, MenuItem, RestaurantTable, OrderType, OrderWithItems } from '@/types/database';
import { formatCurrency, cn, formatTime, generateOrderNumber } from '@/lib/utils';
import { ORDER_TYPES, TAX_RATE } from '@/lib/constants';
import {
  Minus,
  Plus,
  Trash2,
  ShoppingCart,
  UtensilsCrossed,
  Package as PackageIcon,
  Store,
  ChevronDown,
  User,
  MessageSquare,
  Clock,
  Receipt,
  AlertCircle,
} from 'lucide-react';
import Badge from '@/components/ui/Badge';

interface TableWithOrders extends RestaurantTable {
  activeOrderCount: number;
  unpaidCount: number;
  paidCount: number;
}

interface POSCartProps {
  items: CartItem[];
  orderType: OrderType;
  selectedTableId: string | null;
  customerName: string;
  onUpdateQuantity: (index: number, delta: number) => void;
  onRemoveItem: (index: number) => void;
  onUpdateInstructions: (index: number, value: string) => void;
  onOrderTypeChange: (type: OrderType) => void;
  onTableChange: (tableId: string | null) => void;
  onCustomerNameChange: (name: string) => void;
  tableOrders: OrderWithItems[];
  onTableOrdersLoaded: (orders: OrderWithItems[]) => void;
  refreshKey?: number;
}

const orderTypeIcons: Record<OrderType, React.ReactNode> = {
  dine_in: <UtensilsCrossed className="w-4 h-4" />,
  takeaway: <PackageIcon className="w-4 h-4" />,
  counter: <Store className="w-4 h-4" />,
};

export default function POSCart({
  items,
  orderType,
  selectedTableId,
  customerName,
  onUpdateQuantity,
  onRemoveItem,
  onUpdateInstructions,
  onOrderTypeChange,
  onTableChange,
  onCustomerNameChange,
  tableOrders,
  onTableOrdersLoaded,
  refreshKey,
}: POSCartProps) {
  const supabase = createClient();
  const [tables, setTables] = useState<TableWithOrders[]>([]);
  const [editingInstructions, setEditingInstructions] = useState<number | null>(null);
  const [loadingOrders, setLoadingOrders] = useState(false);

  useEffect(() => {
    fetchTablesWithOrders();
  }, [refreshKey]);

  useEffect(() => {
    if (selectedTableId) {
      fetchTableOrders(selectedTableId);
    } else {
      onTableOrdersLoaded([]);
    }
  }, [selectedTableId, orderType, refreshKey]);

  async function fetchTablesWithOrders() {
    // Fetch all active tables
    const { data: tablesData } = await supabase
      .from('restaurant_tables')
      .select('*')
      .eq('is_active', true)
      .order('table_number');

    // Fetch all active unpaid/un-invoiced orders (pending, preparing, completed, served)
    const { data: ordersData } = await supabase
      .from('orders')
      .select('table_id, payment_status, invoice_id')
      .in('status', ['pending', 'preparing', 'completed', 'served'])
      .is('invoice_id', null);

    const unpaidCounts: Record<string, number> = {};

    (ordersData || []).forEach((o: any) => {
      if (o.table_id) {
        unpaidCounts[o.table_id] = (unpaidCounts[o.table_id] || 0) + 1;
      }
    });

    const tablesWithCounts: TableWithOrders[] = (tablesData || []).map((t: any) => {
      const unpaid = unpaidCounts[t.id] || 0;
      return {
        ...t,
        activeOrderCount: unpaid,
        unpaidCount: unpaid,
        paidCount: 0,
      };
    });

    setTables(tablesWithCounts);
  }

  async function fetchTableOrders(tableId: string) {
    setLoadingOrders(true);
    // Fetch all active un-invoiced orders for this table
    const { data } = await supabase
      .from('orders')
      .select(`
        *,
        restaurant_table:restaurant_tables(*),
        order_items(*, menu_item:menu_items(*)),
        invoice:invoices!fk_orders_invoice(*)
      `)
      .eq('table_id', tableId)
      .is('invoice_id', null)
      .in('status', ['pending', 'preparing', 'completed', 'served'])
      .order('created_at', { ascending: false });

    onTableOrdersLoaded((data || []) as unknown as OrderWithItems[]);
    setLoadingOrders(false);
  }

  const subtotal = items.reduce((sum, ci) => sum + ci.menuItem.price * ci.quantity, 0);
  const tax = subtotal * TAX_RATE;
  const total = subtotal + tax;

  const hasUnpaidOrders = tableOrders.some(
    (o) => o.payment_status === 'unpaid' && !o.invoice_id
  );

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-3 border-b border-border shrink-0">
        <div className="flex items-center gap-2 mb-3">
          <ShoppingCart className="w-4 h-4 text-accent-primary" />
          <h2 className="text-sm font-bold text-text-primary">Current Order</h2>
          {items.length > 0 && (
            <span className="ml-auto px-2 py-0.5 rounded-full bg-accent-primary/15 text-accent-primary text-[10px] font-bold">
              {items.reduce((s, i) => s + i.quantity, 0)} items
            </span>
          )}
        </div>

        {/* Order Type Selector */}
        <div className="flex gap-1 p-1 rounded-xl bg-bg-tertiary">
          {(Object.keys(ORDER_TYPES) as OrderType[]).map((type) => (
            <button
              key={type}
              onClick={() => onOrderTypeChange(type)}
              className={cn(
                'flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer',
                orderType === type
                  ? 'bg-accent-primary text-white shadow-md'
                  : 'text-text-muted hover:text-text-secondary hover:bg-white/5'
              )}
            >
              {orderTypeIcons[type]}
              <span className="hidden sm:inline">{ORDER_TYPES[type].label}</span>
            </button>
          ))}
        </div>

        {/* Table Selector (for dine-in) */}
        {orderType === 'dine_in' && (
          <div className="mt-2 relative">
            <select
              value={selectedTableId || ''}
              onChange={(e) => onTableChange(e.target.value || null)}
              className="w-full px-3 py-2 rounded-xl text-sm bg-bg-tertiary border border-border text-text-primary focus:outline-none focus:border-accent-primary/50 appearance-none cursor-pointer"
            >
              <option value="">Select Table...</option>
              {tables.map((t) => {
                let statusLabel = 'Available';
                if (t.unpaidCount > 0 && t.paidCount > 0) {
                  statusLabel = `Occupied (${t.unpaidCount} unpaid, ${t.paidCount} paid)`;
                } else if (t.unpaidCount > 0) {
                  statusLabel = `Occupied (${t.unpaidCount} unpaid)`;
                } else if (t.paidCount > 0) {
                  statusLabel = `Occupied (Paid)`;
                }
                return (
                  <option key={t.id} value={t.id}>
                    Table {t.table_number} — {statusLabel}
                  </option>
                );
              })}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted pointer-events-none" />
          </div>
        )}

        {/* Customer Name & Optional Table (for takeaway & counter) */}
        {(orderType === 'takeaway' || orderType === 'counter') && (
          <div className="mt-2 space-y-2">
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
              <input
                type="text"
                placeholder="Customer name (optional)..."
                value={customerName}
                onChange={(e) => onCustomerNameChange(e.target.value)}
                className="w-full pl-10 pr-4 py-2 rounded-xl text-sm bg-bg-tertiary border border-border text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent-primary/50 transition-all"
              />
            </div>

            <div className="relative">
              <select
                value={selectedTableId || ''}
                onChange={(e) => onTableChange(e.target.value || null)}
                className="w-full px-3 py-2 rounded-xl text-sm bg-bg-tertiary border border-border text-text-primary focus:outline-none focus:border-accent-primary/50 appearance-none cursor-pointer"
              >
                <option value="">Attach to Table (Optional)...</option>
                {tables.map((t) => {
                  let statusLabel = 'Available';
                  if (t.unpaidCount > 0) {
                    statusLabel = `Occupied (${t.unpaidCount} unpaid)`;
                  }
                  return (
                    <option key={t.id} value={t.id}>
                      Table {t.table_number} — {statusLabel}
                    </option>
                  );
                })}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted pointer-events-none" />
            </div>
          </div>
        )}
      </div>

      {/* Ongoing Table Orders */}
      {selectedTableId && tableOrders.length > 0 && (
        <div className="p-3 border-b border-border shrink-0">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-3.5 h-3.5 text-accent-primary" />
            <p className="text-xs font-bold text-text-primary">
              Active Orders on Table ({tableOrders.length})
            </p>
          </div>
          <div className="space-y-1.5 max-h-32 overflow-y-auto">
            {tableOrders.map((order) => {
              const orderTotal = order.order_items.reduce(
                (s, oi) => s + oi.unit_price * oi.quantity, 0
              );
              const isPaid = order.payment_status === 'paid' || Boolean(order.invoice_id);
              const isTakeawayOrder = order.order_type === 'takeaway';
              return (
                <div
                  key={order.id}
                  className="flex items-center justify-between px-2.5 py-2 rounded-lg bg-white/[0.03] text-xs"
                >
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-mono text-text-muted font-medium">
                      {generateOrderNumber(order.id, order.order_number)}
                    </span>
                    {isTakeawayOrder && (
                      <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-500/15 text-amber-400 border border-amber-500/20">
                        T/A
                      </span>
                    )}
                    <Badge variant={order.status as any} className="text-[9px] py-0 px-1.5">
                      {order.status}
                    </Badge>
                    {isPaid ? (
                      <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">
                        PAID
                      </span>
                    ) : (
                      <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-500/15 text-amber-400 border border-amber-500/20">
                        UNPAID
                      </span>
                    )}
                  </div>
                  <span className="font-medium text-text-secondary">
                    {formatCurrency(orderTotal)}
                  </span>
                </div>
              );
            })}
          </div>
          <p className="text-[10px] text-text-muted mt-1.5 flex items-center gap-1">
            <AlertCircle className="w-3 h-3" />
            {hasUnpaidOrders
              ? 'Select unpaid served orders in Payment panel to invoice'
              : 'All active orders on this table are paid'}
          </p>
        </div>
      )}

      {/* Cart Items */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-text-muted">
            <ShoppingCart className="w-10 h-10 mb-2 opacity-20" />
            <p className="text-sm">Cart is empty</p>
            <p className="text-xs mt-1">Click menu items to add</p>
          </div>
        ) : (
          items.map((ci, index) => (
            <div
              key={`${ci.menuItem.id}-${index}`}
              className="group rounded-xl glass p-3 space-y-2 transition-all duration-200 hover:bg-white/[0.06]"
            >
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-text-primary truncate">
                    {ci.menuItem.name}
                  </p>
                  <p className="text-xs text-text-muted mt-0.5">
                    {formatCurrency(ci.menuItem.price)} each
                  </p>
                </div>
                <p className="text-sm font-bold text-text-primary whitespace-nowrap">
                  {formatCurrency(ci.menuItem.price * ci.quantity)}
                </p>
              </div>

              <div className="flex items-center justify-between">
                {/* Quantity Controls */}
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => onUpdateQuantity(index, -1)}
                    className="w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center text-text-muted hover:bg-accent-danger/15 hover:text-accent-danger transition-all cursor-pointer"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <span className="w-8 text-center text-sm font-bold text-text-primary">
                    {ci.quantity}
                  </span>
                  <button
                    onClick={() => onUpdateQuantity(index, 1)}
                    className="w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center text-text-muted hover:bg-accent-primary/15 hover:text-accent-primary transition-all cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="flex items-center gap-1">
                  {/* Instructions toggle */}
                  <button
                    onClick={() =>
                      setEditingInstructions(editingInstructions === index ? null : index)
                    }
                    className={cn(
                      'w-7 h-7 rounded-lg flex items-center justify-center transition-all cursor-pointer',
                      ci.specialInstructions
                        ? 'bg-accent-warning/15 text-accent-warning'
                        : 'bg-white/5 text-text-muted hover:bg-white/10'
                    )}
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                  </button>
                  {/* Remove */}
                  <button
                    onClick={() => onRemoveItem(index)}
                    className="w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center text-text-muted hover:bg-accent-danger/15 hover:text-accent-danger transition-all cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Special Instructions */}
              {editingInstructions === index && (
                <input
                  type="text"
                  placeholder="Special instructions..."
                  value={ci.specialInstructions}
                  onChange={(e) => onUpdateInstructions(index, e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg text-xs bg-bg-tertiary border border-border text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent-warning/50 transition-all"
                  autoFocus
                />
              )}
            </div>
          ))
        )}
      </div>

      {/* Totals */}
      {items.length > 0 && (
        <div className="p-3 border-t border-border shrink-0 space-y-2">
          <div className="flex justify-between text-xs text-text-muted">
            <span>Subtotal</span>
            <span>{formatCurrency(subtotal)}</span>
          </div>
          {TAX_RATE > 0 && (
            <div className="flex justify-between text-xs text-text-muted">
              <span>Tax ({(TAX_RATE * 100).toFixed(0)}%)</span>
              <span>{formatCurrency(tax)}</span>
            </div>
          )}
          <div className="flex justify-between text-base font-bold text-text-primary pt-1 border-t border-border">
            <span>Total</span>
            <span className="text-accent-primary">{formatCurrency(total)}</span>
          </div>
        </div>
      )}
    </div>
  );
}
