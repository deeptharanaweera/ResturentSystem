'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { MenuItem, CartItem, OrderType, PaymentMethod, OrderWithItems } from '@/types/database';
import { TAX_RATE } from '@/lib/constants';
import { formatCurrency, generateOrderNumber } from '@/lib/utils';
import { generateInvoicePDF } from '@/components/billing/InvoiceGenerator';
import POSMenuGrid from '@/components/pos/POSMenuGrid';
import POSCart from '@/components/pos/POSCart';
import POSPayment, { PaymentRow } from '@/components/pos/POSPayment';
import POSRecentInvoicesModal from '@/components/pos/POSRecentInvoicesModal';
import { toast } from 'sonner';
import { ArrowLeft, History, Maximize2, Minimize2 } from 'lucide-react';
import Link from 'next/link';

export default function POSPage() {
  const supabase = createClient();
  const [mounted, setMounted] = useState(false);
  const [reprintModalOpen, setReprintModalOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Cart state
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [orderType, setOrderType] = useState<OrderType>('dine_in');
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null);
  const [customerName, setCustomerName] = useState('');

  // Payment state
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [processing, setProcessing] = useState(false);

  // Ongoing orders state — ALL served orders across all tables
  const [allServedOrders, setAllServedOrders] = useState<OrderWithItems[]>([]);
  const [tableOrders, setTableOrders] = useState<OrderWithItems[]>([]);
  const [selectedOngoingOrderIds, setSelectedOngoingOrderIds] = useState<Set<string>>(new Set());
  const [ongoingPayments, setOngoingPayments] = useState<PaymentRow[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);

  // Mobile panel state
  const [mobilePanel, setMobilePanel] = useState<'menu' | 'cart' | 'payment'>('menu');

  // Fullscreen toggle
  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  }

  // Fullscreen change listener
  useEffect(() => {
    function handleFullscreenChange() {
      setIsFullscreen(Boolean(document.fullscreenElement));
    }
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // Fetch all served UNPAID orders on mount & subscribe to realtime changes
  useEffect(() => {
    setMounted(true);
    fetchAllServedOrders();

    const channel = supabase
      .channel('pos-orders-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders' },
        () => {
          fetchAllServedOrders();
          setRefreshKey((k) => k + 1);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  async function fetchAllServedOrders() {
    const { data } = await supabase
      .from('orders')
      .select(`
        *,
        restaurant_table:restaurant_tables(*),
        order_items(*, menu_item:menu_items(*)),
        invoice:invoices!fk_orders_invoice(*)
      `)
      .in('status', ['pending', 'preparing', 'served'])
      .eq('payment_status', 'unpaid')
      .is('invoice_id', null)
      .order('created_at', { ascending: false });

    setAllServedOrders((data || []) as unknown as OrderWithItems[]);
  }

  // --- Cart Actions ---
  const handleAddItem = useCallback((item: MenuItem) => {
    setCartItems((prev) => {
      const existing = prev.findIndex((ci) => ci.menuItem.id === item.id);
      if (existing >= 0) {
        const updated = [...prev];
        updated[existing] = { ...updated[existing], quantity: updated[existing].quantity + 1 };
        return updated;
      }
      return [...prev, { menuItem: item, quantity: 1, specialInstructions: '' }];
    });
  }, []);

  const handleUpdateQuantity = useCallback((index: number, delta: number) => {
    setCartItems((prev) => {
      const updated = [...prev];
      const newQty = updated[index].quantity + delta;
      if (newQty <= 0) {
        updated.splice(index, 1);
      } else {
        updated[index] = { ...updated[index], quantity: newQty };
      }
      return updated;
    });
  }, []);

  const handleRemoveItem = useCallback((index: number) => {
    setCartItems((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleUpdateInstructions = useCallback((index: number, value: string) => {
    setCartItems((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], specialInstructions: value };
      return updated;
    });
  }, []);

  // --- Payment Actions ---
  const handleAddPayment = useCallback(() => {
    setPayments((prev) => [...prev, { method: 'cash' as PaymentMethod, amount: '' }]);
  }, []);

  const handleRemovePayment = useCallback((index: number) => {
    setPayments((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleUpdatePayment = useCallback(
    (index: number, field: 'method' | 'amount', value: string) => {
      setPayments((prev) => {
        const updated = [...prev];
        if (field === 'method') {
          updated[index] = { ...updated[index], method: value as PaymentMethod };
        } else {
          updated[index] = { ...updated[index], amount: value };
        }
        return updated;
      });
    },
    []
  );

  const handleQuickPay = useCallback(
    (method: PaymentMethod) => {
      const subtotal = cartItems.reduce((sum, ci) => sum + ci.menuItem.price * ci.quantity, 0);
      const total = subtotal + subtotal * TAX_RATE;
      setPayments([{ method, amount: total.toFixed(2) }]);
    },
    [cartItems]
  );

  // --- Ongoing Order Actions ---
  const handleTableOrdersLoaded = useCallback((orders: OrderWithItems[]) => {
    setTableOrders(orders);
  }, []);

  const handleToggleOngoingOrder = useCallback((orderId: string) => {
    setSelectedOngoingOrderIds((prev) => {
      const next = new Set(prev);
      if (next.has(orderId)) next.delete(orderId);
      else next.add(orderId);
      return next;
    });
  }, []);

  const handleAddOngoingPayment = useCallback(() => {
    setOngoingPayments((prev) => [...prev, { method: 'cash' as PaymentMethod, amount: '' }]);
  }, []);

  const handleRemoveOngoingPayment = useCallback((index: number) => {
    setOngoingPayments((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleUpdateOngoingPayment = useCallback(
    (index: number, field: 'method' | 'amount', value: string) => {
      setOngoingPayments((prev) => {
        const updated = [...prev];
        if (field === 'method') {
          updated[index] = { ...updated[index], method: value as PaymentMethod };
        } else {
          updated[index] = { ...updated[index], amount: value };
        }
        return updated;
      });
    },
    []
  );

  const handleQuickPayOngoing = useCallback(
    (method: PaymentMethod) => {
      const selectedOrders = allServedOrders.filter((o) => selectedOngoingOrderIds.has(o.id));
      const subtotal = selectedOrders.reduce(
        (sum, o) => sum + o.order_items.reduce((s, oi) => s + oi.unit_price * oi.quantity, 0), 0
      );
      const total = subtotal + subtotal * TAX_RATE;
      setOngoingPayments([{ method, amount: total.toFixed(2) }]);
    },
    [allServedOrders, selectedOngoingOrderIds]
  );

  // --- Calculations ---
  const subtotal = cartItems.reduce((sum, ci) => sum + ci.menuItem.price * ci.quantity, 0);
  const tax = subtotal * TAX_RATE;
  const grandTotal = subtotal + tax;

  // --- Order Validation ---
  function validateOrder(): string | null {
    if (cartItems.length === 0) return 'Cart is empty';
    if (orderType === 'dine_in' && !selectedTableId) return 'Please select a table for dine-in orders';
    if (orderType === 'takeaway' && !customerName.trim() && !selectedTableId) {
      return 'Please enter customer name or select a table for takeaway orders';
    }
    return null;
  }

  // --- Reset ---
  function resetAll() {
    setCartItems([]);
    setPayments([]);
    setCustomerName('');
  }

  // --- Refresh everything ---
  async function refreshAfterAction() {
    await fetchAllServedOrders();
    if (selectedTableId) {
      refreshTableOrders(selectedTableId);
    }
  }

  // --- Place Order Only (no invoice) ---
  async function handlePlaceOrder() {
    const error = validateOrder();
    if (error) {
      toast.error(error);
      return;
    }

    setProcessing(true);
    try {
      const custName = customerName.trim() || (orderType === 'takeaway' && selectedTableId ? 'Table Takeaway' : null);

      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert({
          table_id: selectedTableId || null,
          total_amount: grandTotal,
          status: 'pending',
          payment_status: 'unpaid',
          order_type: orderType,
          customer_name: custName,
        })
        .select()
        .single();

      if (orderError) throw orderError;

      const orderItems = cartItems.map((ci) => ({
        order_id: order.id,
        item_id: ci.menuItem.id,
        quantity: ci.quantity,
        unit_price: ci.menuItem.price,
        special_instructions: ci.specialInstructions || null,
      }));

      const { error: itemsError } = await supabase.from('order_items').insert(orderItems);
      if (itemsError) throw itemsError;

      toast.success('Order placed successfully!');
      resetAll();
      await refreshAfterAction();
    } catch (err) {
      console.error(err);
      toast.error('Failed to place order');
    }
    setProcessing(false);
  }

  // --- Place Order + Invoice + Payments ---
  async function handlePlaceAndInvoice() {
    const error = validateOrder();
    if (error) {
      toast.error(error);
      return;
    }

    const totalPaid = payments.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
    if (totalPaid < grandTotal) {
      toast.error('Payment amount is insufficient');
      return;
    }
    if (payments.length === 0) {
      toast.error('Please add at least one payment method');
      return;
    }

    setProcessing(true);
    try {
      // 1. Create invoice
      const { data: invoice, error: invoiceError } = await supabase
        .from('invoices')
        .insert({ subtotal, tax_amount: tax, grand_total: grandTotal })
        .select()
        .single();
      if (invoiceError) throw invoiceError;

      // 2. Create payment records
      const paymentRows = payments
        .filter((p) => parseFloat(p.amount) > 0)
        .map((p) => ({
          invoice_id: invoice.id,
          payment_method: p.method,
          amount: parseFloat(p.amount),
        }));
      if (paymentRows.length > 0) {
        const { error: paymentError } = await supabase.from('invoice_has_payment').insert(paymentRows);
        if (paymentError) throw paymentError;
      }

      const custName = customerName.trim() || (orderType === 'takeaway' && selectedTableId ? 'Table Takeaway' : null);

      // 3. Create order (status: 'pending' so it goes to the kitchen for preparation)
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert({
          table_id: selectedTableId || null,
          total_amount: grandTotal,
          status: 'pending',
          payment_status: 'paid',
          invoice_id: invoice.id,
          order_type: orderType,
          customer_name: custName,
        })
        .select()
        .single();
      if (orderError) throw orderError;

      // 4. Create order items
      const orderItems = cartItems.map((ci) => ({
        order_id: order.id,
        item_id: ci.menuItem.id,
        quantity: ci.quantity,
        unit_price: ci.menuItem.price,
        special_instructions: ci.specialInstructions || null,
      }));
      const { error: itemsError } = await supabase.from('order_items').insert(orderItems);
      if (itemsError) throw itemsError;

      // 5. Generate PDF
      let tableNumber = 0;
      if (selectedTableId) {
        const { data: tableData } = await supabase
          .from('restaurant_tables')
          .select('table_number')
          .eq('id', selectedTableId)
          .single();
        tableNumber = tableData?.table_number || 0;
      }

      const orderNum = generateOrderNumber(order.id, order.order_number);
      const typeSummary = orderType === 'takeaway'
        ? (tableNumber ? `Take Away (Table ${tableNumber})` : 'Take Away')
        : orderType === 'counter'
          ? 'Counter'
          : `Dine In (Table ${tableNumber || '?'})`;

      await generateInvoicePDF({
        invoiceNumber: invoice.invoice_number,
        orderNumbers: [orderNum],
        tableNumber: tableNumber || null,
        customerName: custName,
        orderTypeSummary: typeSummary,
        items: cartItems.map((ci) => ({
          name: ci.menuItem.name,
          quantity: ci.quantity,
          unit_price: ci.menuItem.price,
        })),
        subtotal,
        taxAmount: tax,
        grandTotal,
        payments: payments
          .filter((p) => parseFloat(p.amount) > 0)
          .map((p) => ({ method: p.method, amount: parseFloat(p.amount) })),
        issuedAt: invoice.issued_at,
        mode: 'print',
      });

      toast.success('Order placed & invoice printed!');
      resetAll();
      await refreshAfterAction();
    } catch (err) {
      console.error(err);
      toast.error('Failed to process order');
    }
    setProcessing(false);
  }

  // --- Invoice Ongoing Orders (from ANY table) ---
  async function handleInvoiceOngoingOrders() {
    const selectedOrders = allServedOrders.filter(
      (o) => selectedOngoingOrderIds.has(o.id) && o.status === 'served'
    );
    if (selectedOrders.length === 0) {
      toast.error('No served orders selected');
      return;
    }

    const ongoingSubtotal = selectedOrders.reduce(
      (sum, o) => sum + o.order_items.reduce((s, oi) => s + oi.unit_price * oi.quantity, 0), 0
    );
    const ongoingTax = ongoingSubtotal * TAX_RATE;
    const ongoingTotal = ongoingSubtotal + ongoingTax;

    const totalPaid = ongoingPayments.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
    if (totalPaid < ongoingTotal) {
      toast.error('Payment amount is insufficient');
      return;
    }
    if (ongoingPayments.length === 0) {
      toast.error('Please add at least one payment method');
      return;
    }

    setProcessing(true);
    try {
      // 1. Create invoice
      const { data: invoice, error: invoiceError } = await supabase
        .from('invoices')
        .insert({
          subtotal: ongoingSubtotal,
          tax_amount: ongoingTax,
          grand_total: ongoingTotal,
        })
        .select()
        .single();
      if (invoiceError) throw invoiceError;

      // 2. Create payment records
      const paymentRows = ongoingPayments
        .filter((p) => parseFloat(p.amount) > 0)
        .map((p) => ({
          invoice_id: invoice.id,
          payment_method: p.method,
          amount: parseFloat(p.amount),
        }));
      if (paymentRows.length > 0) {
        const { error: paymentError } = await supabase.from('invoice_has_payment').insert(paymentRows);
        if (paymentError) throw paymentError;
      }

      // 3. Update all selected orders
      for (const order of selectedOrders) {
        const orderSub = order.order_items.reduce((s, oi) => s + oi.unit_price * oi.quantity, 0);
        const orderTotal = orderSub + orderSub * TAX_RATE;

        await supabase
          .from('orders')
          .update({
            status: 'completed',
            payment_status: 'paid',
            total_amount: orderTotal,
            invoice_id: invoice.id,
          })
          .eq('id', order.id);
      }

      // 4. Generate PDF — collect unique order numbers, tables, and types
      const orderNumbers = selectedOrders.map((o) => generateOrderNumber(o.id, o.order_number));
      const uniqueTables = [
        ...new Set(
          selectedOrders
            .map((o) => o.restaurant_table?.table_number)
            .filter((t): t is number => typeof t === 'number')
        ),
      ];
      const customerNames = selectedOrders.map((o) => o.customer_name).filter(Boolean).join(', ');

      const typeCounts: Record<string, number> = {};
      selectedOrders.forEach((o) => {
        typeCounts[o.order_type || 'dine_in'] = (typeCounts[o.order_type || 'dine_in'] || 0) + 1;
      });

      const orderTypeParts: string[] = [];
      if (typeCounts['dine_in']) orderTypeParts.push(`${typeCounts['dine_in']} Dine In`);
      if (typeCounts['takeaway']) orderTypeParts.push(`${typeCounts['takeaway']} Take Away`);
      if (typeCounts['counter']) orderTypeParts.push(`${typeCounts['counter']} Counter`);

      const orderTypeSummary = orderTypeParts.join(', ') || 'Dine In';

      const pdfItems = selectedOrders.flatMap((o) =>
        o.order_items.map((oi) => ({
          name:
            selectedOrders.length > 1
              ? `${oi.menu_item?.name} (${generateOrderNumber(o.id, o.order_number)})`
              : oi.menu_item?.name || 'Unknown',
          quantity: oi.quantity,
          unit_price: oi.unit_price,
        }))
      );

      await generateInvoicePDF({
        invoiceNumber: invoice.invoice_number,
        orderNumbers,
        tableNumbers: uniqueTables,
        customerName: customerNames || null,
        orderTypeSummary,
        items: pdfItems,
        subtotal: ongoingSubtotal,
        taxAmount: ongoingTax,
        grandTotal: ongoingTotal,
        payments: ongoingPayments
          .filter((p) => parseFloat(p.amount) > 0)
          .map((p) => ({ method: p.method, amount: parseFloat(p.amount) })),
        issuedAt: invoice.issued_at,
        mode: 'print',
      });

      toast.success('Invoice generated & printed!');
      setSelectedOngoingOrderIds(new Set());
      setOngoingPayments([]);
      await refreshAfterAction();
    } catch (err) {
      console.error(err);
      toast.error('Failed to invoice orders');
    }
    setProcessing(false);
  }

  // --- Refresh table orders ---
  async function refreshTableOrders(tableId: string) {
    const { data } = await supabase
      .from('orders')
      .select(`
        *,
        restaurant_table:restaurant_tables(*),
        order_items(*, menu_item:menu_items(*)),
        invoice:invoices!fk_orders_invoice(*)
      `)
      .eq('table_id', tableId)
      .eq('payment_status', 'unpaid')
      .is('invoice_id', null)
      .in('status', ['pending', 'preparing', 'served'])
      .order('created_at', { ascending: false });

    setTableOrders((data || []) as unknown as OrderWithItems[]);
  }

  const cartItemCount = cartItems.reduce((s, i) => s + i.quantity, 0);

  if (!mounted) {
    return (
      <div className="h-screen flex items-center justify-center bg-bg-primary">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-accent-primary border-t-transparent animate-spin" />
          <p className="text-xs text-text-muted">Loading POS...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-bg-primary">
      {/* Top Bar */}
      <div className="flex items-center gap-3 px-4 py-2 bg-bg-secondary border-b border-border shrink-0">
        <Link
          href="/admin"
          className="flex items-center gap-1.5 text-xs text-text-muted hover:text-text-primary transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="hidden sm:inline">Back to Admin</span>
        </Link>
        <div className="w-px h-5 bg-border" />
        <h1 className="text-sm font-bold gradient-text">Point of Sale</h1>

        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => setReprintModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-accent-primary/10 hover:bg-accent-primary/20 border border-accent-primary/25 text-accent-primary text-xs font-semibold transition-all cursor-pointer shadow-sm"
          >
            <History className="w-3.5 h-3.5" />
            <span>Recent Invoices & Reprint</span>
          </button>

          <button
            onClick={toggleFullscreen}
            className="p-2 rounded-xl glass glass-hover text-text-muted hover:text-text-primary transition-all cursor-pointer"
            title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen (POS Mode)'}
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>

          <div className="pulse-dot" />
        </div>
      </div>

      {/* Mobile Tab Bar */}
      <div className="lg:hidden flex border-b border-border shrink-0 bg-bg-secondary">
        <button
          onClick={() => setMobilePanel('menu')}
          className={`flex-1 py-3 text-xs font-semibold text-center transition-all cursor-pointer ${
            mobilePanel === 'menu'
              ? 'text-accent-primary border-b-2 border-accent-primary bg-accent-primary/5'
              : 'text-text-muted'
          }`}
        >
          Menu
        </button>
        <button
          onClick={() => setMobilePanel('cart')}
          className={`flex-1 py-3 text-xs font-semibold text-center transition-all cursor-pointer relative ${
            mobilePanel === 'cart'
              ? 'text-accent-primary border-b-2 border-accent-primary bg-accent-primary/5'
              : 'text-text-muted'
          }`}
        >
          Cart
          {cartItemCount > 0 && (
            <span className="absolute top-1.5 right-1/4 w-5 h-5 rounded-full bg-accent-primary text-white text-[10px] font-bold flex items-center justify-center">
              {cartItemCount}
            </span>
          )}
        </button>
        <button
          onClick={() => setMobilePanel('payment')}
          className={`flex-1 py-3 text-xs font-semibold text-center transition-all cursor-pointer ${
            mobilePanel === 'payment'
              ? 'text-accent-primary border-b-2 border-accent-primary bg-accent-primary/5'
              : 'text-text-muted'
          }`}
        >
          Payment
        </button>
      </div>

      {/* Desktop Layout: 3 panels */}
      <div className="flex-1 flex min-h-0">
        {/* Left: Menu Grid */}
        <div
          className={`${
            mobilePanel === 'menu' ? 'flex' : 'hidden'
          } lg:flex flex-col flex-1 min-w-0 border-r border-border`}
        >
          <POSMenuGrid onAddItem={handleAddItem} />
        </div>

        {/* Center: Cart */}
        <div
          className={`${
            mobilePanel === 'cart' ? 'flex' : 'hidden'
          } lg:flex flex-col w-full lg:w-80 xl:w-96 border-r border-border bg-bg-secondary/50`}
        >
          <POSCart
            items={cartItems}
            orderType={orderType}
            selectedTableId={selectedTableId}
            customerName={customerName}
            onUpdateQuantity={handleUpdateQuantity}
            onRemoveItem={handleRemoveItem}
            onUpdateInstructions={handleUpdateInstructions}
            onOrderTypeChange={setOrderType}
            onTableChange={setSelectedTableId}
            onCustomerNameChange={setCustomerName}
            tableOrders={tableOrders}
            onTableOrdersLoaded={handleTableOrdersLoaded}
            refreshKey={refreshKey}
          />
        </div>

        {/* Right: Payment */}
        <div
          className={`${
            mobilePanel === 'payment' ? 'flex' : 'hidden'
          } lg:flex flex-col w-full lg:w-72 xl:w-80 bg-bg-secondary/30`}
        >
          <POSPayment
            grandTotal={grandTotal}
            payments={payments}
            processing={processing}
            onAddPayment={handleAddPayment}
            onRemovePayment={handleRemovePayment}
            onUpdatePayment={handleUpdatePayment}
            onPlaceOrder={handlePlaceOrder}
            onPlaceAndInvoice={handlePlaceAndInvoice}
            onQuickPay={handleQuickPay}
            disabled={processing || cartItems.length === 0}
            allServedOrders={allServedOrders}
            selectedOngoingOrderIds={selectedOngoingOrderIds}
            onToggleOngoingOrder={handleToggleOngoingOrder}
            onInvoiceOngoingOrders={handleInvoiceOngoingOrders}
            onQuickPayOngoing={handleQuickPayOngoing}
            ongoingPayments={ongoingPayments}
            onAddOngoingPayment={handleAddOngoingPayment}
            onRemoveOngoingPayment={handleRemoveOngoingPayment}
            onUpdateOngoingPayment={handleUpdateOngoingPayment}
          />
        </div>
      </div>

      {/* Recent Invoices & Reprint Modal */}
      <POSRecentInvoicesModal
        isOpen={reprintModalOpen}
        onClose={() => setReprintModalOpen(false)}
      />
    </div>
  );
}
