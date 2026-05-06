'use client';

import React, { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { OrderWithItems } from '@/types/database';
import { TAX_RATE } from '@/lib/constants';
import { formatCurrency, formatDate, formatTime, generateOrderNumber, cn } from '@/lib/utils';
import { generateInvoicePDF } from '@/components/billing/InvoiceGenerator';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import { Receipt, FileDown, CreditCard, Loader2, Trash2, CheckCircle, AlertCircle, Printer, X } from 'lucide-react';
import { toast } from 'sonner';
import Modal from '@/components/ui/Modal';

export default function BillingPage() {
  const supabase = createClient();
  const [orders, setOrders] = useState<OrderWithItems[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [selectedOrderIds, setSelectedOrderIds] = useState<Set<string>>(new Set());
  const [checkoutModal, setCheckoutModal] = useState<{ orders: OrderWithItems[] } | null>(null);
  const [checkoutStep, setCheckoutStep] = useState<1 | 2>(1);

  useEffect(() => {
    fetchOrders();
  }, []);
  async function fetchOrders() {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          restaurant_table:restaurant_tables(*),
          order_items(*, menu_item:menu_items(*)),
          invoice:invoices!fk_orders_invoice(*)
        `)
        .in('status', ['pending', 'preparing', 'served'])
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching orders:', error);
        toast.error('Failed to fetch orders');
      }
      
      setOrders((data || []) as unknown as OrderWithItems[]);
    } catch (err) {
      console.error('Unexpected error in fetchOrders:', err);
      toast.error('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  }

  async function handleCancelOrder(orderId: string) {
    if (!confirm('Are you sure you want to cancel this order?')) return;
    
    setProcessingId(orderId);
    try {
      const { error } = await supabase
        .from('orders')
        .update({ status: 'cancelled' })
        .eq('id', orderId);
      
      if (error) throw error;
      toast.success('Order cancelled successfully');
      fetchOrders();
    } catch (err) {
      toast.error('Failed to cancel order');
      console.error(err);
    }
    setProcessingId(null);
  }

  async function handleCheckout(ordersToCheckout: OrderWithItems[]) {
    setProcessingId('processing');
    try {
      const totalSubtotal = ordersToCheckout.reduce((sum, order) => 
        sum + order.order_items.reduce((s, oi) => s + oi.unit_price * oi.quantity, 0), 0
      );
      const taxAmount = totalSubtotal * TAX_RATE;
      const grandTotal = totalSubtotal + taxAmount;

      // Create invoice
      const { data: invoice, error: invoiceError } = await supabase
        .from('invoices')
        .insert({
          subtotal: totalSubtotal,
          tax_amount: taxAmount,
          grand_total: grandTotal,
        })
        .select()
        .single();

      if (invoiceError) throw invoiceError;

      // Update all orders
      if (invoice) {
        for (const order of ordersToCheckout) {
          const sub = order.order_items.reduce((s, oi) => s + oi.unit_price * oi.quantity, 0);
          const tax = sub * TAX_RATE;
          const total = sub + tax;

          await supabase
            .from('orders')
            .update({
              status: 'completed',
              payment_status: 'paid',
              total_amount: total,
              invoice_id: invoice.id,
            })
            .eq('id', order.id);
        }

        // Prepare items for PDF
        const pdfItems = ordersToCheckout.flatMap(o => 
          o.order_items.map(oi => ({
            name: ordersToCheckout.length > 1 
              ? `${oi.menu_item?.name} (Ord ${generateOrderNumber(o.id).slice(1)})`
              : oi.menu_item?.name || 'Unknown',
            quantity: oi.quantity,
            unit_price: oi.unit_price,
          }))
        );

        // Generate and Print
        await generateInvoicePDF({
          invoiceNumber: invoice.invoice_number,
          orderId: ordersToCheckout.length > 1 
            ? `GROUP: ${ordersToCheckout.length} ORDERS` 
            : generateOrderNumber(ordersToCheckout[0].id),
          tableNumber: ordersToCheckout[0].restaurant_table?.table_number || 0,
          items: pdfItems,
          subtotal: totalSubtotal,
          taxAmount,
          grandTotal,
          issuedAt: invoice.issued_at,
          mode: 'print',
        });
      }

      toast.success('Invoice generated and sent to printer!');
      setCheckoutModal(null);
      setSelectedOrderIds(new Set());
      fetchOrders();
    } catch (err) {
      toast.error('Checkout failed');
      console.error(err);
    }
    setProcessingId(null);
  }

  async function downloadInvoice(order: OrderWithItems, mode: 'download' | 'print' = 'download') {
    if (!order.invoice_id) {
      toast.error('Invoice not found.');
      return;
    }

    const { data: invoice } = await supabase
      .from('invoices')
      .select('*')
      .eq('id', order.invoice_id)
      .maybeSingle();

    if (invoice) {
      // Find all orders associated with this invoice
      const { data: siblingOrders } = await supabase
        .from('orders')
        .select('*, order_items(*, menu_item:menu_items(*))')
        .eq('invoice_id', invoice.id);

      let allItems: any[] = [];
      let displayOrderId = generateOrderNumber(order.id);

      if (siblingOrders && siblingOrders.length > 1) {
        allItems = (siblingOrders as unknown as OrderWithItems[]).flatMap(o => o.order_items.map(oi => ({
          name: `${oi.menu_item?.name} (Ord ${generateOrderNumber(o.id).slice(1)})`,
          quantity: oi.quantity,
          unit_price: oi.unit_price,
        })));
        displayOrderId = `GROUP: ${siblingOrders.length} ORDERS`;
      } else {
        allItems = order.order_items.map(oi => ({
          name: oi.menu_item?.name || 'Unknown',
          quantity: oi.quantity,
          unit_price: oi.unit_price,
        }));
      }

      await generateInvoicePDF({
        invoiceNumber: invoice.invoice_number,
        orderId: displayOrderId,
        tableNumber: order.restaurant_table?.table_number || 0,
        items: allItems,
        subtotal: invoice.subtotal,
        taxAmount: invoice.tax_amount,
        grandTotal: invoice.grand_total,
        issuedAt: invoice.issued_at,
        mode,
      });
    } else {
      toast.error('Invoice record not found.');
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-accent-primary animate-spin" />
      </div>
    );
  }

  const groupedOrders = orders.reduce((groups, order) => {
    const tableId = order.table_id || 'unknown';
    if (!groups[tableId]) {
      groups[tableId] = {
        table: order.restaurant_table,
        pending: [],
        completedGroups: [],
      };
    }

    if (order.status !== 'completed') {
      groups[tableId].pending.push(order);
    } else {
      // Group by invoice_id for completed orders
      const invoiceData = (order as any).invoice;
      const invoice = Array.isArray(invoiceData) ? invoiceData[0] : invoiceData;
      
      if (invoice) {
        let group = groups[tableId].completedGroups.find(g => g.id === invoice.id);
        if (group) {
          group.orders.push(order);
        } else {
          groups[tableId].completedGroups.push({
            ...invoice,
            orders: [order],
          });
        }
      }
    }
    return groups;
  }, {} as Record<string, { table: any; pending: OrderWithItems[]; completedGroups: any[] }>);

  const toggleOrderSelection = (orderId: string) => {
    setSelectedOrderIds((prev) => {
      const next = new Set(prev);
      if (next.has(orderId)) {
        next.delete(orderId);
      } else {
        next.add(orderId);
      }
      return next;
    });
  };

  const toggleTableSelection = (tableOrders: OrderWithItems[], isSelected: boolean) => {
    setSelectedOrderIds((prev) => {
      const next = new Set(prev);
      tableOrders.forEach((o) => {
        if (o.status !== 'completed') {
          if (isSelected) next.add(o.id);
          else next.delete(o.id);
        }
      });
      return next;
    });
  };

  const handleBulkCheckoutInit = () => {
    const selectedOrders = orders.filter((o) => selectedOrderIds.has(o.id));
    if (selectedOrders.length === 0) return;
    
    // Check if all are served
    const nonServed = selectedOrders.filter(o => o.status !== 'served');
    if (nonServed.length > 0) {
      toast.error('Only served orders can be checked out');
      return;
    }

    setCheckoutModal({ orders: selectedOrders });
    setCheckoutStep(1);
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Billing & Invoices</h1>
        <p className="text-sm text-text-muted mt-1">Checkout served orders and generate invoices</p>
      </div>

      {orders.length === 0 ? (
        <Card className="text-center py-12">
          <Receipt className="w-10 h-10 text-text-muted/30 mx-auto mb-3" />
          <p className="text-text-muted text-sm">No orders to bill</p>
        </Card>
      ) : (
        <div className="space-y-12">
          {Object.values(groupedOrders).map(({ table, pending, completedGroups }) => {
            const allSelected = pending.length > 0 && pending.every(o => selectedOrderIds.has(o.id));
            
            return (
              <div key={table?.id || 'unknown'} className="space-y-6">
                <div className="flex items-center justify-between border-b border-text-muted/10 pb-4">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-accent-primary/10 flex items-center justify-center text-accent-primary font-bold text-xl shadow-inner">
                      {table?.table_number || '?'}
                    </div>
                    <div>
                      <h2 className="font-bold text-text-primary text-lg">Table {table?.table_number || 'Unknown'}</h2>
                      <div className="flex items-center gap-2">
                        <Badge variant="pending">{pending.length} Active Orders</Badge>
                      </div>
                    </div>
                  </div>
                  {pending.length > 0 && (
                    <button 
                      onClick={() => toggleTableSelection(pending, !allSelected)}
                      className="px-4 py-2 rounded-lg bg-accent-primary/5 text-accent-primary text-sm font-semibold hover:bg-accent-primary/10 transition-colors"
                    >
                      {allSelected ? 'Deselect Table' : 'Select All for Table'}
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {/* Pending Orders */}
                  {pending.map((order) => {
                    const subtotal = order.order_items.reduce(
                      (sum, oi) => sum + oi.unit_price * oi.quantity, 0
                    );
                    const isSelected = selectedOrderIds.has(order.id);

                    return (
                      <Card 
                        key={order.id} 
                        className={cn(
                          "relative group transition-all duration-300",
                          isSelected && "ring-2 ring-accent-primary bg-accent-primary/5 shadow-xl scale-[1.03]"
                        )}
                      >
                        <div className="space-y-4">
                          <div className="flex justify-between items-start">
                            <div className="flex flex-col gap-1">
                              <span className="text-sm font-mono text-text-muted">
                                {generateOrderNumber(order.id)}
                              </span>
                              <Badge variant={order.status as any} className="capitalize text-[10px] py-0 px-2 w-fit">{order.status}</Badge>
                            </div>
                            <input
                              type="checkbox"
                              className="w-6 h-6 rounded-lg border-text-muted/30 text-accent-primary focus:ring-accent-primary bg-background-secondary cursor-pointer"
                              checked={isSelected}
                              onChange={() => toggleOrderSelection(order.id)}
                            />
                          </div>

                          <div className="space-y-3">
                            {order.order_items.map((oi) => (
                              <div key={oi.id} className="flex justify-between items-center">
                                <div className="flex items-center gap-2">
                                  <span className="w-5 h-5 rounded bg-text-muted/10 flex items-center justify-center text-[10px] font-bold">
                                    {oi.quantity}
                                  </span>
                                  <span className="text-sm text-text-secondary">{oi.menu_item?.name}</span>
                                </div>
                                <span className="text-xs text-text-muted">{formatCurrency(oi.unit_price * oi.quantity)}</span>
                              </div>
                            ))}
                          </div>

                          <div className="pt-4 border-t border-text-muted/10 flex items-center justify-between">
                            <span className="text-xs text-text-muted">{formatTime(order.created_at)}</span>
                            <span className="text-lg font-bold text-text-primary">{formatCurrency(subtotal)}</span>
                          </div>

                          <div className="flex gap-2">
                            {order.status === 'pending' && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="flex-1 text-accent-danger hover:bg-accent-danger/5"
                                loading={processingId === order.id}
                                onClick={() => handleCancelOrder(order.id)}
                                icon={<Trash2 className="w-4 h-4" />}
                              >
                                Cancel
                              </Button>
                            )}
                            {order.status === 'served' && (
                              <Button
                                variant="primary"
                                size="sm"
                                className="flex-1"
                                onClick={() => {
                                  setCheckoutModal({ orders: [order] });
                                  setCheckoutStep(1);
                                }}
                                icon={<CreditCard className="w-4 h-4" />}
                              >
                                Checkout
                              </Button>
                            )}
                            {order.status !== 'served' && order.status !== 'pending' && (
                              <div className="w-full text-center py-2 px-3 rounded-lg bg-white/5 text-[10px] text-text-muted font-medium italic">
                                Wait for "Served" status to bill
                              </div>
                            )}
                          </div>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Checkout Modal */}
      <Modal
        isOpen={!!checkoutModal}
        onClose={() => !processingId && setCheckoutModal(null)}
        title={checkoutStep === 1 ? "Review Invoice" : "Confirm Payment"}
        size="lg"
      >
        {checkoutModal && (
          <div className="space-y-6">
            {checkoutStep === 1 ? (
              <>
                <div className="space-y-4 max-h-[40vh] overflow-y-auto pr-2">
                  {checkoutModal.orders.flatMap(o => o.order_items).map((item, i) => (
                    <div key={i} className="flex justify-between items-center text-sm">
                      <div className="flex items-center gap-3">
                        <span className="w-6 h-6 rounded bg-accent-primary/10 text-accent-primary flex items-center justify-center font-bold text-xs">
                          {item.quantity}
                        </span>
                        <span className="text-text-secondary">{item.menu_item?.name}</span>
                      </div>
                      <span className="font-medium">{formatCurrency(item.unit_price * item.quantity)}</span>
                    </div>
                  ))}
                </div>

                <div className="pt-4 border-t border-border space-y-2">
                  <div className="flex justify-between text-sm text-text-muted">
                    <span>Subtotal</span>
                    <span>{formatCurrency(checkoutModal.orders.reduce((sum, o) => sum + o.order_items.reduce((s, oi) => s + oi.unit_price * oi.quantity, 0), 0))}</span>
                  </div>
                  <div className="flex justify-between text-sm text-text-muted">
                    <span>Tax ({(TAX_RATE * 100).toFixed(0)}%)</span>
                    <span>{formatCurrency(checkoutModal.orders.reduce((sum, o) => sum + o.order_items.reduce((s, oi) => s + oi.unit_price * oi.quantity, 0), 0) * TAX_RATE)}</span>
                  </div>
                  <div className="flex justify-between text-xl font-bold text-text-primary pt-2">
                    <span>Grand Total</span>
                    <span className="text-accent-primary">
                      {formatCurrency(checkoutModal.orders.reduce((sum, o) => sum + o.order_items.reduce((s, oi) => s + oi.unit_price * oi.quantity, 0), 0) * (1 + TAX_RATE))}
                    </span>
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <Button variant="ghost" className="flex-1" onClick={() => setCheckoutModal(null)}>Cancel</Button>
                  <Button variant="primary" className="flex-1" onClick={() => setCheckoutStep(2)}>Next Step</Button>
                </div>
              </>
            ) : (
              <div className="space-y-8 py-4">
                <div className="flex flex-col items-center text-center space-y-4">
                  <div className="w-20 h-20 rounded-full bg-accent-success/10 flex items-center justify-center text-accent-success animate-bounce-subtle">
                    <CheckCircle className="w-10 h-10" />
                  </div>
                  <div>
                    <h4 className="text-xl font-bold">Confirm Payment</h4>
                    <p className="text-text-muted text-sm px-8">
                      Confirming will mark the orders as paid and generate a tax invoice for the printer.
                    </p>
                  </div>
                </div>

                <div className="bg-white/5 rounded-2xl p-6 flex justify-between items-center">
                  <div className="flex flex-col">
                    <span className="text-xs text-text-muted uppercase font-bold tracking-wider">Amount to Pay</span>
                    <span className="text-3xl font-black text-accent-primary">
                      {formatCurrency(checkoutModal.orders.reduce((sum, o) => sum + o.order_items.reduce((s, oi) => s + oi.unit_price * oi.quantity, 0), 0) * (1 + TAX_RATE))}
                    </span>
                  </div>
                  <Printer className="w-10 h-10 text-text-muted/20" />
                </div>

                <div className="flex gap-3">
                  <Button variant="ghost" className="flex-1" onClick={() => setCheckoutStep(1)} disabled={processingId === 'processing'}>Back</Button>
                  <Button 
                    variant="primary" 
                    className="flex-1 py-6" 
                    loading={processingId === 'processing'} 
                    onClick={() => handleCheckout(checkoutModal.orders)}
                    icon={<Printer className="w-5 h-5" />}
                  >
                    Confirm & Print
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Bulk Action Bar */}
      {selectedOrderIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[95%] max-w-4xl bg-background-secondary/80 backdrop-blur-md border border-accent-primary/20 rounded-2xl shadow-2xl p-6 flex flex-col md:flex-row items-center justify-between animate-slide-up z-50 gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-accent-primary flex items-center justify-center text-white shadow-lg shadow-accent-primary/20">
              <Receipt className="w-6 h-6" />
            </div>
            <div className="flex flex-col">
              <span className="text-lg font-bold text-text-primary">
                {selectedOrderIds.size} {selectedOrderIds.size === 1 ? 'Order' : 'Orders'} Selected
              </span>
              <span className="text-sm text-text-muted">
                Total Amount: <span className="text-accent-primary font-bold">{formatCurrency(
                  orders.filter(o => selectedOrderIds.has(o.id)).reduce((sum, o) => sum + o.order_items.reduce((s, oi) => s + oi.unit_price * oi.quantity, 0), 0) * (1 + TAX_RATE)
                )}</span>
              </span>
            </div>
          </div>
          <div className="flex items-center gap-3 w-full md:w-auto">
            <Button
              variant="ghost"
              className="flex-1 md:flex-none"
              onClick={() => setSelectedOrderIds(new Set())}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              className="flex-1 md:flex-none py-6 px-8 text-base"
              loading={processingId === 'bulk'}
              onClick={handleBulkCheckoutInit}
              icon={<CreditCard className="w-5 h-5" />}
            >
              Checkout Selected
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
