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
import { Receipt, FileDown, CreditCard, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function BillingPage() {
  const supabase = createClient();
  const [orders, setOrders] = useState<OrderWithItems[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [selectedOrderIds, setSelectedOrderIds] = useState<Set<string>>(new Set());

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
        .in('status', ['pending', 'preparing', 'served', 'completed'])
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

  async function handleCheckout(order: OrderWithItems) {
    setProcessingId(order.id);
    try {
      const subtotal = order.order_items.reduce(
        (sum, oi) => sum + oi.unit_price * oi.quantity, 0
      );
      const taxAmount = subtotal * TAX_RATE;
      const grandTotal = subtotal + taxAmount;

      // Create invoice
      const { data: invoice, error: invoiceError } = await supabase
        .from('invoices')
        .insert({
          subtotal,
          tax_amount: taxAmount,
          grand_total: grandTotal,
        })
        .select()
        .single();

      if (invoiceError) throw invoiceError;

      // Update order with invoice reference
      if (invoice) {
        await supabase
          .from('orders')
          .update({
            status: 'completed',
            payment_status: 'paid',
            total_amount: grandTotal,
            invoice_id: invoice.id,
          })
          .eq('id', order.id);
      }

      // Generate PDF
      if (invoice) {
        await generateInvoicePDF({
          invoiceNumber: invoice.invoice_number,
          orderId: order.id,
          tableNumber: order.restaurant_table?.table_number || 0,
          items: order.order_items.map((oi) => ({
            name: oi.menu_item?.name || 'Unknown',
            quantity: oi.quantity,
            unit_price: oi.unit_price,
          })),
          subtotal,
          taxAmount,
          grandTotal,
          issuedAt: invoice.issued_at,
        });
      }

      toast.success('Invoice generated and downloaded!');
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

  const handleBulkCheckout = async () => {
    const selectedOrders = orders.filter((o) => selectedOrderIds.has(o.id));
    if (selectedOrders.length === 0) return;

    setProcessingId('bulk');
    try {
      let totalSubtotal = 0;
      let totalTaxAmount = 0;
      let totalGrandTotal = 0;
      const allItems: any[] = [];

      // Process each order
      for (const order of selectedOrders) {
        const subtotal = order.order_items.reduce(
          (sum, oi) => sum + oi.unit_price * oi.quantity, 0
        );
        const taxAmount = subtotal * TAX_RATE;
        const grandTotal = subtotal + taxAmount;

        totalSubtotal += subtotal;
        totalTaxAmount += taxAmount;
        totalGrandTotal += grandTotal;
        allItems.push(...order.order_items);

        // Update individual order
        await supabase
          .from('orders')
          .update({
            status: 'completed',
            payment_status: 'paid',
            total_amount: grandTotal,
          })
          .eq('id', order.id);
      }

      // Create ONE combined invoice record
      const { data: invoice, error: invoiceError } = await supabase
        .from('invoices')
        .insert({
          subtotal: totalSubtotal,
          tax_amount: totalTaxAmount,
          grand_total: totalGrandTotal,
        })
        .select()
        .single();

      if (invoiceError) throw invoiceError;

      // Update ALL orders with the SAME invoice ID
      if (invoice) {
        for (const order of selectedOrders) {
          const subtotal = order.order_items.reduce(
            (sum, oi) => sum + oi.unit_price * oi.quantity, 0
          );
          const taxAmount = subtotal * TAX_RATE;
          const grandTotal = subtotal + taxAmount;

          await supabase
            .from('orders')
            .update({
              status: 'completed',
              payment_status: 'paid',
              total_amount: grandTotal,
              invoice_id: invoice.id,
            })
            .eq('id', order.id);
        }

        // Generate ONE PDF for the whole group
        const pdfItems = selectedOrders.flatMap(o => 
          o.order_items.map(oi => ({
            name: `${oi.menu_item?.name} (Ord ${generateOrderNumber(o.id).slice(1)})`,
            quantity: oi.quantity,
            unit_price: oi.unit_price,
          }))
        );

        await generateInvoicePDF({
          invoiceNumber: invoice.invoice_number,
          orderId: `GROUP: ${selectedOrders.length} ORDERS`,
          tableNumber: selectedOrders[0].restaurant_table?.table_number || 0,
          items: pdfItems,
          subtotal: totalSubtotal,
          taxAmount: totalTaxAmount,
          grandTotal: totalGrandTotal,
          issuedAt: invoice.issued_at,
        });
      }

      toast.success(`Combined invoice for ${selectedOrders.length} orders generated!`);
      setSelectedOrderIds(new Set());
      fetchOrders();
    } catch (err) {
      toast.error('Bulk checkout failed');
      console.error(err);
    }
    setProcessingId(null);
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
                        <Badge variant="pending">{pending.length} Active</Badge>
                        <Badge variant="completed">{completedGroups.length} Paid Bills</Badge>
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

                          {!isSelected && (
                            <Button
                              variant="primary"
                              size="sm"
                              className="w-full"
                              loading={processingId === order.id}
                              onClick={() => handleCheckout(order)}
                              icon={<CreditCard className="w-4 h-4" />}
                            >
                              Checkout
                            </Button>
                          )}
                        </div>
                      </Card>
                    );
                  })}

                  {/* Completed (Paid) Bills */}
                  {completedGroups.map((group, idx) => {
                    const isGroup = group.orders.length > 1;
                    const allGroupItems = group.orders.flatMap((o: any) => o.order_items);
                    
                    return (
                      <Card 
                        key={idx} 
                        className="bg-emerald-500/5 border-emerald-500/20 relative"
                      >
                        <div className="absolute top-3 right-3">
                          <Badge variant="completed">Paid</Badge>
                        </div>
                        
                        <div className="space-y-4">
                          <div className="flex flex-col gap-1">
                            <span className="text-xs font-mono text-text-muted">
                              Invoice #{group.invoice_number}
                            </span>
                            <span className="text-xs text-text-muted">
                              {isGroup ? `${group.orders.length} Orders Combined` : `Order ${generateOrderNumber(group.orders[0].id)}`}
                            </span>
                          </div>

                          <div className="space-y-2 max-h-32 overflow-y-auto pr-2 scrollbar-hide">
                            {allGroupItems.map((oi: any, i: number) => (
                              <div key={i} className="flex justify-between text-xs text-text-secondary italic">
                                <span>{oi.quantity}× {oi.menu_item?.name}</span>
                                <span>{formatCurrency(oi.unit_price * oi.quantity)}</span>
                              </div>
                            ))}
                          </div>

                          <div className="pt-4 border-t border-emerald-500/10 flex items-center justify-between">
                            <div className="flex flex-col">
                              <span className="text-[10px] text-text-muted">Paid at {formatTime(group.issued_at)}</span>
                              <span className="text-xl font-black text-emerald-500">{formatCurrency(group.grand_total)}</span>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => downloadInvoice(group.orders[0], 'download')}
                              icon={<FileDown className="w-4 h-4" />}
                            >
                              PDF
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => downloadInvoice(group.orders[0], 'print')}
                              icon={<Receipt className="w-4 h-4" />}
                            >
                              Print
                            </Button>
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
              onClick={handleBulkCheckout}
              icon={<CreditCard className="w-5 h-5" />}
            >
              Confirm & Generate Bill
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
