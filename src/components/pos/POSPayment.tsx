'use client';

import React, { useMemo } from 'react';
import { PaymentMethod, OrderWithItems } from '@/types/database';
import { formatCurrency, cn, generateOrderNumber } from '@/lib/utils';
import { PAYMENT_METHODS, CURRENCY_SYMBOL, TAX_RATE } from '@/lib/constants';
import {
  Banknote,
  CreditCard,
  Building2,
  MoreHorizontal,
  Plus,
  Trash2,
  Printer,
  Receipt,
  Zap,
  Clock,
  CheckSquare,
  Square,
} from 'lucide-react';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';

export interface PaymentRow {
  method: PaymentMethod;
  amount: string;
}

interface POSPaymentProps {
  // New order payment
  grandTotal: number;
  payments: PaymentRow[];
  processing: boolean;
  onAddPayment: () => void;
  onRemovePayment: (index: number) => void;
  onUpdatePayment: (index: number, field: 'method' | 'amount', value: string) => void;
  onPlaceOrder: () => void;
  onPlaceAndInvoice: () => void;
  onQuickPay: (method: PaymentMethod) => void;
  disabled: boolean;
  // All served orders across ALL tables
  allServedOrders: OrderWithItems[];
  selectedOngoingOrderIds: Set<string>;
  onToggleOngoingOrder: (orderId: string) => void;
  onInvoiceOngoingOrders: () => void;
  onQuickPayOngoing: (method: PaymentMethod) => void;
  ongoingPayments: PaymentRow[];
  onAddOngoingPayment: () => void;
  onRemoveOngoingPayment: (index: number) => void;
  onUpdateOngoingPayment: (index: number, field: 'method' | 'amount', value: string) => void;
}

const methodIcons: Record<PaymentMethod, React.ReactNode> = {
  cash: <Banknote className="w-4 h-4" />,
  card: <CreditCard className="w-4 h-4" />,
  bank_transfer: <Building2 className="w-4 h-4" />,
  other: <MoreHorizontal className="w-4 h-4" />,
};

function PaymentRows({
  payments,
  disabled,
  onAdd,
  onRemove,
  onUpdate,
}: {
  payments: PaymentRow[];
  disabled: boolean;
  onAdd: () => void;
  onRemove: (i: number) => void;
  onUpdate: (i: number, f: 'method' | 'amount', v: string) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-[10px] uppercase tracking-wider text-text-muted font-bold">
          Split Payment
        </p>
        <button
          onClick={onAdd}
          disabled={disabled}
          className="flex items-center gap-1 text-[10px] font-semibold text-accent-primary hover:text-accent-secondary transition-colors cursor-pointer disabled:opacity-40"
        >
          <Plus className="w-3 h-3" />
          Add
        </button>
      </div>
      {payments.map((payment, index) => (
        <div
          key={index}
          className="flex items-center gap-2 p-2 rounded-xl glass animate-scale-in"
        >
          <div className="relative flex-shrink-0">
            <select
              value={payment.method}
              onChange={(e) => onUpdate(index, 'method', e.target.value)}
              disabled={disabled}
              className="appearance-none pl-8 pr-2 py-2 rounded-lg text-xs bg-bg-tertiary border border-border text-text-primary focus:outline-none focus:border-accent-primary/50 cursor-pointer w-28"
            >
              {(Object.keys(PAYMENT_METHODS) as PaymentMethod[]).map((m) => (
                <option key={m} value={m}>
                  {PAYMENT_METHODS[m].label}
                </option>
              ))}
            </select>
            <div className="absolute left-2 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none">
              {methodIcons[payment.method]}
            </div>
          </div>
          <div className="relative flex-1">
            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-text-muted">
              {CURRENCY_SYMBOL.trim()}
            </span>
            <input
              type="number"
              placeholder="0.00"
              value={payment.amount}
              onChange={(e) => onUpdate(index, 'amount', e.target.value)}
              disabled={disabled}
              min="0"
              step="0.01"
              className="w-full pl-8 pr-2 py-2 rounded-lg text-xs text-right font-mono bg-bg-tertiary border border-border text-text-primary focus:outline-none focus:border-accent-primary/50 transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
          </div>
          <button
            onClick={() => onRemove(index)}
            disabled={disabled}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-text-muted hover:bg-accent-danger/15 hover:text-accent-danger transition-all cursor-pointer disabled:opacity-40 shrink-0"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}

interface TableGroup {
  tableNumber: number | null;
  tableId: string | null;
  orders: OrderWithItems[];
}

export default function POSPayment({
  grandTotal,
  payments,
  processing,
  onAddPayment,
  onRemovePayment,
  onUpdatePayment,
  onPlaceOrder,
  onPlaceAndInvoice,
  onQuickPay,
  disabled,
  allServedOrders,
  selectedOngoingOrderIds,
  onToggleOngoingOrder,
  onInvoiceOngoingOrders,
  onQuickPayOngoing,
  ongoingPayments,
  onAddOngoingPayment,
  onRemoveOngoingPayment,
  onUpdateOngoingPayment,
}: POSPaymentProps) {
  const totalPaid = payments.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
  const remaining = grandTotal - totalPaid;
  const change = totalPaid > grandTotal ? totalPaid - grandTotal : 0;
  const isFullyPaid = totalPaid >= grandTotal && grandTotal > 0;

  // Group served orders by table
  const servedOrdersByTable = useMemo(() => {
    const servedOnly = allServedOrders.filter((o) => o.status === 'served');
    const groups: Record<string, TableGroup> = {};

    servedOnly.forEach((order) => {
      const key = order.table_id || 'no-table';
      if (!groups[key]) {
        groups[key] = {
          tableNumber: order.restaurant_table?.table_number ?? null,
          tableId: order.table_id,
          orders: [],
        };
      }
      groups[key].orders.push(order);
    });

    // Sort: tables with numbers first (ascending), then no-table
    return Object.values(groups).sort((a, b) => {
      if (a.tableNumber === null) return 1;
      if (b.tableNumber === null) return -1;
      return a.tableNumber - b.tableNumber;
    });
  }, [allServedOrders]);

  const hasServedOrders = servedOrdersByTable.some((g) => g.orders.length > 0);

  // Ongoing orders calculations
  const selectedOngoingOrders = allServedOrders.filter(
    (o) => selectedOngoingOrderIds.has(o.id) && o.status === 'served'
  );
  const ongoingSubtotal = selectedOngoingOrders.reduce(
    (sum, o) => sum + o.order_items.reduce((s, oi) => s + oi.unit_price * oi.quantity, 0), 0
  );
  const ongoingTax = ongoingSubtotal * TAX_RATE;
  const ongoingTotal = ongoingSubtotal + ongoingTax;
  const ongoingTotalPaid = ongoingPayments.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
  const ongoingIsFullyPaid = ongoingTotalPaid >= ongoingTotal && ongoingTotal > 0;

  // Count unique tables in selection
  const selectedTableCount = new Set(
    selectedOngoingOrders.map((o) => o.table_id || 'none')
  ).size;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-3 border-b border-border shrink-0">
        <div className="flex items-center gap-2">
          <Receipt className="w-4 h-4 text-accent-primary" />
          <h2 className="text-sm font-bold text-text-primary">Payment</h2>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* ================================ */}
        {/* SECTION: Invoice Served Orders   */}
        {/* (from ALL tables)                */}
        {/* ================================ */}
        {hasServedOrders && (
          <div className="border-b border-border">
            <div className="p-3">
              <div className="flex items-center gap-2 mb-3">
                <Clock className="w-3.5 h-3.5 text-amber-400" />
                <p className="text-xs font-bold text-amber-400">Invoice Served Orders</p>
                <span className="ml-auto text-[10px] text-text-muted">
                  Select from any table
                </span>
              </div>

              {/* Orders grouped by table */}
              <div className="space-y-3 mb-3 max-h-48 overflow-y-auto">
                {servedOrdersByTable.map((group) => (
                  <div key={group.tableId || 'no-table'}>
                    {/* Table header */}
                    <p className="text-[10px] uppercase tracking-wider text-text-muted font-bold mb-1.5 flex items-center gap-1.5">
                      <span className="w-5 h-5 rounded bg-accent-primary/10 flex items-center justify-center text-accent-primary text-[9px] font-black">
                        {group.tableNumber ?? '?'}
                      </span>
                      {group.tableNumber !== null ? `Table ${group.tableNumber}` : 'No Table'}
                      <span className="text-text-muted/50">({group.orders.length})</span>
                    </p>

                    {/* Selectable orders */}
                    <div className="space-y-1">
                      {group.orders.map((order) => {
                        const orderTotal = order.order_items.reduce(
                          (s, oi) => s + oi.unit_price * oi.quantity, 0
                        );
                        const isSelected = selectedOngoingOrderIds.has(order.id);
                        return (
                          <button
                            key={order.id}
                            onClick={() => onToggleOngoingOrder(order.id)}
                            className={cn(
                              'w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs transition-all cursor-pointer text-left',
                              isSelected
                                ? 'bg-accent-primary/10 border border-accent-primary/30'
                                : 'bg-white/[0.03] border border-transparent hover:bg-white/[0.06]'
                            )}
                          >
                            {isSelected ? (
                              <CheckSquare className="w-4 h-4 text-accent-primary shrink-0" />
                            ) : (
                              <Square className="w-4 h-4 text-text-muted shrink-0" />
                            )}
                            <span className="font-mono text-text-muted font-medium">
                              {generateOrderNumber(order.id, order.order_number)}
                            </span>
                            <Badge variant="served" className="text-[9px] py-0 px-1.5">
                              served
                            </Badge>
                            <span className="ml-auto font-medium text-text-secondary">
                              {formatCurrency(orderTotal)}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>

              {/* Show payment options when orders are selected */}
              {selectedOngoingOrders.length > 0 && (
                <div className="space-y-3">
                  {/* Total */}
                  <div className="rounded-xl bg-amber-500/10 border border-amber-500/20 p-3 text-center">
                    <p className="text-[9px] uppercase tracking-widest text-text-muted font-bold mb-0.5">
                      Selected: {selectedOngoingOrders.length} order{selectedOngoingOrders.length > 1 ? 's' : ''}
                      {selectedTableCount > 1 ? ` from ${selectedTableCount} tables` : ''}
                    </p>
                    <p className="text-xl font-black text-amber-400">
                      {formatCurrency(ongoingTotal)}
                    </p>
                  </div>

                  {/* Quick Pay */}
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      onClick={() => onQuickPayOngoing('cash')}
                      disabled={processing}
                      className="flex items-center justify-center gap-1.5 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-semibold hover:bg-emerald-500/20 transition-all cursor-pointer disabled:opacity-40"
                    >
                      <Banknote className="w-3.5 h-3.5" />
                      Cash
                    </button>
                    <button
                      onClick={() => onQuickPayOngoing('card')}
                      disabled={processing}
                      className="flex items-center justify-center gap-1.5 py-2 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400 text-[10px] font-semibold hover:bg-blue-500/20 transition-all cursor-pointer disabled:opacity-40"
                    >
                      <CreditCard className="w-3.5 h-3.5" />
                      Card
                    </button>
                  </div>

                  {/* Split payments for ongoing */}
                  <PaymentRows
                    payments={ongoingPayments}
                    disabled={processing}
                    onAdd={onAddOngoingPayment}
                    onRemove={onRemoveOngoingPayment}
                    onUpdate={onUpdateOngoingPayment}
                  />

                  {/* Ongoing payment summary */}
                  {ongoingPayments.length > 0 && (
                    <div className="space-y-1">
                      <div className="flex justify-between text-[11px] text-text-muted">
                        <span>Paid</span>
                        <span className="font-mono">{formatCurrency(ongoingTotalPaid)}</span>
                      </div>
                      {ongoingTotalPaid < ongoingTotal && (
                        <div className="flex justify-between text-[11px] text-accent-danger font-semibold">
                          <span>Remaining</span>
                          <span className="font-mono">{formatCurrency(ongoingTotal - ongoingTotalPaid)}</span>
                        </div>
                      )}
                      {ongoingTotalPaid > ongoingTotal && (
                        <div className="flex justify-between text-[11px] text-accent-success font-semibold">
                          <span>Change</span>
                          <span className="font-mono">{formatCurrency(ongoingTotalPaid - ongoingTotal)}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Invoice Button */}
                  <Button
                    variant="primary"
                    className="w-full py-2.5 text-xs bg-gradient-to-r from-amber-500 to-orange-500 shadow-amber-500/25"
                    disabled={processing || !ongoingIsFullyPaid}
                    loading={processing}
                    onClick={onInvoiceOngoingOrders}
                    icon={<Printer className="w-3.5 h-3.5" />}
                  >
                    Invoice & Print ({selectedOngoingOrders.length} order{selectedOngoingOrders.length > 1 ? 's' : ''}
                    {selectedTableCount > 1 ? `, ${selectedTableCount} tables` : ''})
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ========================== */}
        {/* SECTION: New Order Payment */}
        {/* ========================== */}
        <div className="p-3 space-y-3">
          {hasServedOrders && (
            <div className="flex items-center gap-2 mb-1">
              <Zap className="w-3.5 h-3.5 text-accent-primary" />
              <p className="text-xs font-bold text-accent-primary">New Order</p>
            </div>
          )}

          {/* Grand Total Display */}
          <div className="rounded-2xl bg-gradient-to-br from-accent-primary/15 to-accent-secondary/15 border border-accent-primary/20 p-4 text-center">
            <p className="text-[10px] uppercase tracking-widest text-text-muted font-bold mb-1">
              Total Amount
            </p>
            <p className="text-3xl font-black text-accent-primary">
              {formatCurrency(grandTotal)}
            </p>
          </div>

          {/* Quick Pay Buttons */}
          <div>
            <p className="text-[10px] uppercase tracking-wider text-text-muted font-bold mb-2">
              Quick Pay
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => onQuickPay('cash')}
                disabled={disabled || grandTotal <= 0}
                className="flex items-center justify-center gap-2 py-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold hover:bg-emerald-500/20 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Banknote className="w-4 h-4" />
                Full Cash
              </button>
              <button
                onClick={() => onQuickPay('card')}
                disabled={disabled || grandTotal <= 0}
                className="flex items-center justify-center gap-2 py-2.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-semibold hover:bg-blue-500/20 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <CreditCard className="w-4 h-4" />
                Full Card
              </button>
            </div>
          </div>

          {/* Payment Rows */}
          <PaymentRows
            payments={payments}
            disabled={disabled}
            onAdd={onAddPayment}
            onRemove={onRemovePayment}
            onUpdate={onUpdatePayment}
          />
        </div>
      </div>

      {/* Summary & Actions - pinned to bottom */}
      <div className="p-3 border-t border-border shrink-0 space-y-3">
        {/* Payment Summary */}
        {payments.length > 0 && (
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs text-text-muted">
              <span>Total Paid</span>
              <span className="font-mono">{formatCurrency(totalPaid)}</span>
            </div>
            {remaining > 0 && (
              <div className="flex justify-between text-xs text-accent-danger font-semibold">
                <span>Remaining</span>
                <span className="font-mono">{formatCurrency(remaining)}</span>
              </div>
            )}
            {change > 0 && (
              <div className="flex justify-between text-xs text-accent-success font-semibold">
                <span>Change</span>
                <span className="font-mono">{formatCurrency(change)}</span>
              </div>
            )}
          </div>
        )}

        {/* Action Buttons */}
        <div className="space-y-2">
          <Button
            variant="primary"
            className="w-full py-3 text-sm"
            disabled={disabled || grandTotal <= 0 || !isFullyPaid}
            loading={processing}
            onClick={onPlaceAndInvoice}
            icon={<Printer className="w-4 h-4" />}
          >
            Place Order & Print Invoice
          </Button>
          <Button
            variant="secondary"
            className="w-full py-2.5 text-xs"
            disabled={disabled || grandTotal <= 0}
            loading={processing}
            onClick={onPlaceOrder}
            icon={<Zap className="w-3.5 h-3.5" />}
          >
            Place Order Only (No Invoice)
          </Button>
        </div>
      </div>
    </div>
  );
}
