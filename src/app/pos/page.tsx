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
import {
  ArrowLeft,
  History,
  Maximize2,
  Minimize2,
  Building2,
  Monitor,
  Lock,
  CheckCircle2,
  Banknote,
  DollarSign,
  TrendingUp,
  AlertTriangle,
  Loader2,
  Power,
  Printer,
} from 'lucide-react';
import Link from 'next/link';
import { useBranch } from '@/context/BranchContext';
import { openDayShift, closeDayShift, getDayEndsWithUserDetails, DayEndWithUserDetails } from '@/app/actions/dayend';
import { generateDayEndPDF } from '@/components/billing/DayEndReportGenerator';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';

export default function POSPage() {
  const supabase = createClient();
  const { currentBranch, currentTerminal, userBranches, terminals, switchBranch, switchTerminal } = useBranch();
  const [mounted, setMounted] = useState(false);
  const [reprintModalOpen, setReprintModalOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Current user info
  const [currentUser, setCurrentUser] = useState<{ id: string; email: string } | null>(null);

  // Shift gate state
  const [activeShift, setActiveShift] = useState<DayEndWithUserDetails | null>(null);
  const [shiftChecked, setShiftChecked] = useState(false);
  const [openShiftLoading, setOpenShiftLoading] = useState(false);
  const [openOpeningCash, setOpenOpeningCash] = useState('0');
  const [openSelectedTerminalId, setOpenSelectedTerminalId] = useState<string>('');

  // Close shift modal state
  const [closeShiftModalOpen, setCloseShiftModalOpen] = useState(false);
  const [closeActualCash, setCloseActualCash] = useState('');
  const [closeNotes, setCloseNotes] = useState('');
  const [closeShiftLoading, setCloseShiftLoading] = useState(false);
  const [shiftSales, setShiftSales] = useState({
    grossSales: 0,
    totalCash: 0,
    totalCard: 0,
    totalOther: 0,
    totalTax: 0,
    totalInvoices: 0,
    totalOrders: 0,
  });

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
      document.documentElement.requestFullscreen().catch(() => { });
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => { });
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

  // Fetch current user
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setCurrentUser({ id: user.id, email: user.email || 'cashier' });
      }
    });
  }, []);

  // Check active shift & fetch all served UNPAID orders on mount / branch switch
  useEffect(() => {
    setMounted(true);
    checkActiveShift();
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
  }, [currentBranch]);

  // Only POS counter terminals for opening shift in POS
  const posTerminals = terminals.filter((t) => !t.terminal_type || t.terminal_type === 'pos');

  async function checkActiveShift() {
    if (!currentBranch) return;
    setShiftChecked(false);
    try {
      const res = await getDayEndsWithUserDetails(currentBranch.id);
      if (res.activeShift) {
        setActiveShift(res.activeShift);
        if (res.activeShift.terminal) {
          switchTerminal(res.activeShift.terminal);
        }
      } else {
        setActiveShift(null);
        // Default select first available POS terminal
        if (posTerminals.length > 0) {
          setOpenSelectedTerminalId(posTerminals[0].id);
        }
      }
    } catch (err) {
      console.error('Error checking active shift:', err);
    } finally {
      setShiftChecked(true);
    }
  }

  // Set default terminal when pos terminals list is loaded
  useEffect(() => {
    if (posTerminals.length > 0 && (!openSelectedTerminalId || !posTerminals.some((t) => t.id === openSelectedTerminalId))) {
      setOpenSelectedTerminalId(posTerminals[0].id);
    }
  }, [terminals]);

  async function handleOpenShiftSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!currentBranch) {
      toast.error('No branch selected');
      return;
    }
    if (!openSelectedTerminalId) {
      toast.error('Please select a workstation terminal');
      return;
    }

    const floatNum = parseFloat(openOpeningCash) || 0;
    if (floatNum < 0) {
      toast.error('Opening cash float cannot be negative');
      return;
    }

    setOpenShiftLoading(true);
    try {
      const res = await openDayShift({
        branch_id: currentBranch.id,
        terminal_id: openSelectedTerminalId,
        user_id: currentUser?.id || null,
        opening_cash: floatNum,
      });

      if (res.error) {
        toast.error(res.error);
      } else {
        toast.success('Shift opened successfully! POS unlocked.');
        const chosenTerm = terminals.find((t) => t.id === openSelectedTerminalId);
        if (chosenTerm) switchTerminal(chosenTerm);
        await checkActiveShift();
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to open shift');
    }
    setOpenShiftLoading(false);
  }

  async function handleOpenCloseShiftModal() {
    if (!activeShift || !currentBranch) return;
    setCloseShiftLoading(true);

    try {
      // Calculate live sales during this shift
      const { data: invoicesData } = await supabase
        .from('invoices')
        .select('id, subtotal, tax_amount, grand_total, issued_at')
        .eq('branch_id', currentBranch.id)
        .gte('issued_at', activeShift.opened_at);

      const invList = invoicesData || [];
      const invoiceIds = invList.map((i) => i.id);

      let cashSum = 0;
      let cardSum = 0;
      let otherSum = 0;

      if (invoiceIds.length > 0) {
        const { data: paymentsData } = await supabase
          .from('invoice_has_payment')
          .select('*')
          .in('invoice_id', invoiceIds);

        (paymentsData || []).forEach((p) => {
          const amt = Number(p.amount) || 0;
          if (p.payment_method === 'cash') cashSum += amt;
          else if (p.payment_method === 'card') cardSum += amt;
          else otherSum += amt;
        });
      }

      const gross = invList.reduce((sum, i) => sum + (Number(i.grand_total) || 0), 0);
      const tax = invList.reduce((sum, i) => sum + (Number(i.tax_amount) || 0), 0);

      const { count: orderCount } = await supabase
        .from('orders')
        .select('*', { count: 'exact', head: true })
        .eq('branch_id', currentBranch.id)
        .gte('created_at', activeShift.opened_at);

      setShiftSales({
        grossSales: gross,
        totalCash: cashSum,
        totalCard: cardSum,
        totalOther: otherSum,
        totalTax: tax,
        totalInvoices: invList.length,
        totalOrders: orderCount || 0,
      });

      const expectedCash = Number(activeShift.opening_cash) + cashSum;
      setCloseActualCash(expectedCash.toFixed(2));
      setCloseShiftModalOpen(true);
    } catch (err) {
      console.error(err);
      toast.error('Failed to prepare shift closing data');
    }
    setCloseShiftLoading(false);
  }

  async function handleCloseShiftSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!activeShift) return;

    const actual = parseFloat(closeActualCash);
    if (isNaN(actual) || actual < 0) {
      toast.error('Please enter a valid drawer cash amount');
      return;
    }

    const expectedCash = Number(activeShift.opening_cash) + shiftSales.totalCash;

    setCloseShiftLoading(true);
    try {
      const res = await closeDayShift({
        shift_id: activeShift.id,
        user_id: currentUser?.id || null,
        actual_cash: actual,
        expected_cash: expectedCash,
        total_sales: shiftSales.grossSales,
        total_cash: shiftSales.totalCash,
        total_card: shiftSales.totalCard,
        total_other: shiftSales.totalOther,
        total_tax: shiftSales.totalTax,
        total_orders: shiftSales.totalOrders,
        total_invoices: shiftSales.totalInvoices,
        notes: closeNotes,
      });

      if (res.error) {
        toast.error(res.error);
      } else {
        toast.success('Shift closed successfully!');
        setCloseShiftModalOpen(false);
        setActiveShift(null);

        // Prompt to print Z-Report
        if (res.shift) {
          await generateDayEndPDF(res.shift, 'print');
        }

        await checkActiveShift();
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to close shift');
    }
    setCloseShiftLoading(false);
  }

  async function fetchAllServedOrders() {
    let query = supabase
      .from('orders')
      .select(`
        *,
        restaurant_table:restaurant_tables(*),
        order_items(*, menu_item:menu_items(*)),
        invoice:invoices!fk_orders_invoice(*)
      `)
      .in('status', ['pending', 'preparing', 'completed', 'served'])
      .eq('payment_status', 'unpaid')
      .is('invoice_id', null);

    if (currentBranch) {
      query = query.eq('branch_id', currentBranch.id);
    }

    const { data } = await query.order('created_at', { ascending: false });
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
      const custName = customerName.trim() || null;

      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert({
          branch_id: currentBranch?.id || null,
          terminal_id: currentTerminal?.id || null,
          table_id: selectedTableId || null,
          total_amount: grandTotal,
          status: orderType === 'counter' ? 'served' : 'pending',
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
        .insert({
          branch_id: currentBranch?.id || null,
          terminal_id: currentTerminal?.id || null,
          subtotal,
          tax_amount: tax,
          grand_total: grandTotal,
        })
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

      const custName = customerName.trim() || null;

      // 3. Create order (status: 'pending' so it goes to the kitchen for preparation)
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert({
          branch_id: currentBranch?.id || null,
          terminal_id: currentTerminal?.id || null,
          table_id: selectedTableId || null,
          total_amount: grandTotal,
          status: orderType === 'counter' ? 'served' : 'pending',
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
          branch_id: currentBranch?.id || null,
          terminal_id: currentTerminal?.id || null,
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
      .in('status', ['pending', 'preparing', 'completed', 'served'])
      .order('created_at', { ascending: false });

    setTableOrders((data || []) as unknown as OrderWithItems[]);
  }

  const cartItemCount = cartItems.reduce((s, i) => s + i.quantity, 0);

  if (!mounted || !shiftChecked) {
    return (
      <div className="h-screen flex items-center justify-center bg-bg-primary">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-accent-primary border-t-transparent animate-spin" />
          <p className="text-xs text-text-muted">Loading POS & Shift Status...</p>
        </div>
      </div>
    );
  }

  // --- SHIFT GATE: POS CANNOT BE OPERATED WITHOUT AN OPEN SHIFT ---
  if (!activeShift) {
    return (
      <div className="min-h-screen bg-[#07080f] flex flex-col items-center justify-center p-4 relative overflow-hidden">
        {/* Background glow */}
        <div className="fixed inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 left-1/3 w-[500px] h-[500px] bg-accent-primary/10 rounded-full blur-3xl" />
          <div className="absolute bottom-1/4 right-1/3 w-[500px] h-[500px] bg-accent-secondary/10 rounded-full blur-3xl" />
        </div>

        {/* Top return link */}
        <div className="absolute top-6 left-6 z-10 flex items-center gap-4">
          <Link
            href="/admin"
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl glass glass-hover text-xs text-text-muted hover:text-text-primary transition-all"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Admin Dashboard</span>
          </Link>

          {currentBranch && userBranches.length > 1 && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl glass text-xs text-text-secondary">
              <Building2 className="w-3.5 h-3.5 text-accent-primary" />
              <select
                value={currentBranch.id}
                onChange={(e) => {
                  const b = userBranches.find((x) => x.id === e.target.value);
                  if (b) switchBranch(b);
                }}
                className="bg-transparent text-text-primary text-xs font-semibold focus:outline-none cursor-pointer"
              >
                {userBranches.map((b) => (
                  <option key={b.id} value={b.id} className="bg-bg-secondary text-text-primary">
                    {b.name} ({b.code})
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Open Shift Card */}
        <div className="relative w-full max-w-md animate-scale-in z-10">
          <div className="rounded-3xl glass p-8 border border-white/[0.08] shadow-2xl space-y-6">
            {/* Header */}
            <div className="text-center space-y-2">
              <div className="w-14 h-14 rounded-2xl bg-accent-primary/15 border border-accent-primary/25 flex items-center justify-center mx-auto text-accent-primary shadow-lg shadow-accent-primary/15">
                <Lock className="w-7 h-7" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center justify-center gap-2">
                  <h1 className="text-xl font-black tracking-tight gradient-text">Open Shift to Start POS</h1>
                  {currentBranch && (
                    <span className="font-mono text-[10px] font-bold text-accent-primary bg-accent-primary/10 px-2 py-0.5 rounded-full border border-accent-primary/20">
                      {currentBranch.code}
                    </span>
                  )}
                </div>
                <p className="text-xs text-text-muted">
                  Select your terminal and enter starting cash float to unlock the POS terminal.
                </p>
              </div>
            </div>

            {/* Cashier Info */}
            {currentUser && (
              <div className="p-3 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-between text-xs">
                <span className="text-text-muted">Logged In Cashier</span>
                <span className="font-semibold text-text-primary">{currentUser.email}</span>
              </div>
            )}

            <form onSubmit={handleOpenShiftSubmit} className="space-y-5">
              {/* Terminal Selection */}
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-text-secondary">
                  Workstation Terminal (POS Counters Only) <span className="text-accent-danger">*</span>
                </label>
                {posTerminals.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {posTerminals.map((t) => {
                      const isSelected = openSelectedTerminalId === t.id;
                      return (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => setOpenSelectedTerminalId(t.id)}
                          className={`p-3 rounded-2xl border text-left flex items-center justify-between transition-all cursor-pointer ${isSelected
                              ? 'bg-accent-primary/20 border-accent-primary text-text-primary shadow-md shadow-accent-primary/10'
                              : 'bg-white/[0.02] border-white/[0.08] text-text-muted hover:text-text-primary hover:bg-white/[0.04]'
                            }`}
                        >
                          <div className="flex items-center gap-2">
                            <Monitor className="w-4 h-4 text-accent-primary" />
                            <div>
                              <p className="font-bold text-xs text-text-primary">{t.code}</p>
                              <p className="text-[10px] text-text-muted truncate">{t.name}</p>
                            </div>
                          </div>
                          {isSelected && <CheckCircle2 className="w-4 h-4 text-accent-primary shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300">
                    No POS counter terminals configured for this branch. Please create a POS terminal under Branches &amp; Terminals.
                  </div>
                )}
              </div>

              {/* Opening Float Input */}
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-text-secondary">
                  Opening Cash Float ({currentBranch?.code || 'LKR'}) <span className="text-accent-danger">*</span>
                </label>
                <div className="relative">
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={openOpeningCash}
                    onChange={(e) => setOpenOpeningCash(e.target.value)}
                    icon={<Banknote className="w-4 h-4" />}
                    required
                  />
                </div>
                <p className="text-[10px] text-text-muted">
                  Physical cash currently in the till before processing orders.
                </p>
              </div>

              <Button
                type="submit"
                variant="primary"
                loading={openShiftLoading}
                className="w-full py-3 text-xs font-bold shadow-lg shadow-accent-primary/25"
                icon={<Power className="w-4 h-4" />}
              >
                Open Shift &amp; Start POS
              </Button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  // --- UNLOCKED POS INTERFACE ---
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

        {/* Branch & Terminal Indicator / Switcher */}
        {currentBranch && (
          <div className="hidden sm:flex items-center gap-2 ml-3 pl-3 border-l border-border">
            {userBranches.length > 1 ? (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-white/[0.04] border border-white/[0.08] text-xs">
                <Building2 className="w-3.5 h-3.5 text-accent-primary" />
                <select
                  value={currentBranch.id}
                  onChange={(e) => {
                    const b = userBranches.find((x) => x.id === e.target.value);
                    if (b) switchBranch(b);
                  }}
                  className="bg-transparent text-text-primary text-xs font-semibold focus:outline-none cursor-pointer"
                >
                  {userBranches.map((b) => (
                    <option key={b.id} value={b.id} className="bg-bg-secondary text-text-primary">
                      {b.name} ({b.code})
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <span className="flex items-center gap-1 text-xs font-semibold text-text-secondary px-2.5 py-1 rounded-xl bg-white/[0.04] border border-white/[0.08]">
                <Building2 className="w-3.5 h-3.5 text-accent-primary" />
                {currentBranch.name}
              </span>
            )}

            {currentTerminal && (
              <span className="hidden md:flex items-center gap-1 text-[11px] font-mono text-text-muted px-2 py-1 rounded-xl bg-white/[0.02] border border-white/[0.06]">
                <Monitor className="w-3 h-3 text-text-muted" />
                {currentTerminal.code}
              </span>
            )}
          </div>
        )}

        {/* Shift Active Badge */}
        {activeShift && (
          <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>Shift: {activeShift.terminal?.code || currentTerminal?.code || 'POS'}</span>
            <span className="text-[10px] text-emerald-500 font-normal">
              (Float: {formatCurrency(Number(activeShift.opening_cash))})
            </span>
          </div>
        )}

        <div className="ml-auto flex items-center gap-2">
          {/* Close Shift Button */}
          <button
            onClick={handleOpenCloseShiftModal}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-accent-danger/10 hover:bg-accent-danger/20 border border-accent-danger/25 text-accent-danger text-xs font-semibold transition-all cursor-pointer shadow-sm"
            title="Reconcile Cash & Close Shift"
          >
            <Lock className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Close Shift</span>
          </button>

          <button
            onClick={() => setReprintModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-accent-primary/10 hover:bg-accent-primary/20 border border-accent-primary/25 text-accent-primary text-xs font-semibold transition-all cursor-pointer shadow-sm"
          >
            <History className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Recent Invoices</span>
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
          className={`flex-1 py-3 text-xs font-semibold text-center transition-all cursor-pointer ${mobilePanel === 'menu'
              ? 'text-accent-primary border-b-2 border-accent-primary bg-accent-primary/5'
              : 'text-text-muted'
            }`}
        >
          Menu
        </button>
        <button
          onClick={() => setMobilePanel('cart')}
          className={`flex-1 py-3 text-xs font-semibold text-center transition-all cursor-pointer relative ${mobilePanel === 'cart'
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
          className={`flex-1 py-3 text-xs font-semibold text-center transition-all cursor-pointer ${mobilePanel === 'payment'
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
          className={`${mobilePanel === 'menu' ? 'flex' : 'hidden'
            } lg:flex flex-col flex-1 min-w-0 border-r border-border`}
        >
          <POSMenuGrid onAddItem={handleAddItem} />
        </div>

        {/* Center: Cart */}
        <div
          className={`${mobilePanel === 'cart' ? 'flex' : 'hidden'
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
          className={`${mobilePanel === 'payment' ? 'flex' : 'hidden'
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

      {/* CLOSE SHIFT & RECONCILE MODAL */}
      <Modal
        isOpen={closeShiftModalOpen}
        onClose={() => setCloseShiftModalOpen(false)}
        title={`Close Shift & Reconcile Drawer — ${currentBranch?.name}`}
      >
        <form onSubmit={handleCloseShiftSubmit} className="space-y-4">
          {/* Shift Sales Summary Box */}
          <div className="rounded-2xl bg-white/[0.03] border border-border p-4 space-y-2 text-xs">
            <div className="flex justify-between text-text-muted">
              <span>Opening Cash Float</span>
              <span className="font-mono">{formatCurrency(activeShift ? Number(activeShift.opening_cash) : 0)}</span>
            </div>
            <div className="flex justify-between text-text-muted">
              <span>Cash Sales Collected</span>
              <span className="font-mono text-emerald-400">+{formatCurrency(shiftSales.totalCash)}</span>
            </div>
            <div className="flex justify-between text-text-muted">
              <span>Card Sales Collected</span>
              <span className="font-mono text-blue-400">{formatCurrency(shiftSales.totalCard)}</span>
            </div>
            <div className="flex justify-between text-text-primary font-bold pt-2 border-t border-border">
              <span>Expected Cash in Drawer</span>
              <span className="font-mono">
                {formatCurrency((activeShift ? Number(activeShift.opening_cash) : 0) + shiftSales.totalCash)}
              </span>
            </div>
          </div>

          {/* Actual Cash Input */}
          <div>
            <label className="block text-xs font-semibold text-text-secondary mb-1.5">
              Counted Drawer Cash <span className="text-accent-danger">*</span>
            </label>
            <Input
              type="number"
              step="0.01"
              min="0"
              value={closeActualCash}
              onChange={(e) => setCloseActualCash(e.target.value)}
              placeholder="0.00"
              icon={<Banknote className="w-4 h-4" />}
              required
            />
          </div>

          {/* Live Variance Calculation */}
          {closeActualCash && !isNaN(parseFloat(closeActualCash)) && (
            <div
              className={`p-3 rounded-xl border text-xs flex items-center justify-between ${parseFloat(closeActualCash) - ((activeShift ? Number(activeShift.opening_cash) : 0) + shiftSales.totalCash) === 0
                  ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                  : parseFloat(closeActualCash) - ((activeShift ? Number(activeShift.opening_cash) : 0) + shiftSales.totalCash) > 0
                    ? 'bg-blue-500/10 border-blue-500/20 text-blue-400'
                    : 'bg-accent-danger/10 border-accent-danger/20 text-accent-danger'
                }`}
            >
              <span className="font-semibold">
                {parseFloat(closeActualCash) - ((activeShift ? Number(activeShift.opening_cash) : 0) + shiftSales.totalCash) === 0
                  ? 'Drawer Balanced'
                  : parseFloat(closeActualCash) - ((activeShift ? Number(activeShift.opening_cash) : 0) + shiftSales.totalCash) > 0
                    ? 'Cash Over'
                    : 'Cash Short'}
              </span>
              <span className="font-mono font-bold">
                {formatCurrency(
                  Math.abs(parseFloat(closeActualCash) - ((activeShift ? Number(activeShift.opening_cash) : 0) + shiftSales.totalCash))
                )}
              </span>
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold text-text-secondary mb-1.5">
              Closing Remarks (Optional)
            </label>
            <textarea
              value={closeNotes}
              onChange={(e) => setCloseNotes(e.target.value)}
              placeholder="e.g. Discrepancy reason or handover notes..."
              rows={2}
              className="w-full px-3 py-2 rounded-xl text-xs bg-bg-secondary border border-border text-text-primary focus:outline-none focus:border-accent-primary/50 transition-colors resize-none"
            />
          </div>

          <div className="pt-2 flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setCloseShiftModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              type="submit"
              loading={closeShiftLoading}
              icon={<Printer className="w-4 h-4" />}
            >
              Confirm Close &amp; Print Z-Report
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
