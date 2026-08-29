'use client';

import React, { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { formatCurrency, formatDate, formatTime, generateOrderNumber, cn } from '@/lib/utils';
import { generateInvoicePDF, InvoiceItem, InvoicePaymentInfo } from '@/components/billing/InvoiceGenerator';
import {
  Receipt,
  Printer,
  Download,
  Search,
  X,
  Clock,
  UtensilsCrossed,
  Package,
  Store,
  Calendar,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import { toast } from 'sonner';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';

interface InvoiceRecord {
  id: string;
  invoice_number: number;
  subtotal: number;
  tax_amount: number;
  grand_total: number;
  issued_at: string;
  payments: { payment_method: string; amount: number }[];
  orders: {
    id: string;
    order_number: string | null;
    order_type: string;
    customer_name: string | null;
    table_id: string | null;
    restaurant_table?: { table_number: number } | null;
    order_items: {
      quantity: number;
      unit_price: number;
      menu_item?: { name: string } | null;
    }[];
  }[];
}

interface POSRecentInvoicesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function POSRecentInvoicesModal({ isOpen, onClose }: POSRecentInvoicesModalProps) {
  const supabase = createClient();
  const [invoices, setInvoices] = useState<InvoiceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [printingId, setPrintingId] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      fetchRecentInvoices();
    }
  }, [isOpen]);

  async function fetchRecentInvoices() {
    setLoading(true);
    try {
      // 1. Fetch recent invoices
      const { data: invoicesData, error: invError } = await supabase
        .from('invoices')
        .select('*')
        .order('issued_at', { ascending: false })
        .limit(30);

      if (invError) throw invError;
      if (!invoicesData || invoicesData.length === 0) {
        setInvoices([]);
        setLoading(false);
        return;
      }

      const invoiceIds = invoicesData.map((inv) => inv.id);

      // 2. Fetch payments for these invoices
      const { data: paymentsData } = await supabase
        .from('invoice_has_payment')
        .select('*')
        .in('invoice_id', invoiceIds);

      // 3. Fetch orders linked to these invoices
      const { data: ordersData } = await supabase
        .from('orders')
        .select(`
          id,
          order_number,
          order_type,
          customer_name,
          table_id,
          invoice_id,
          restaurant_table:restaurant_tables(table_number),
          order_items(
            quantity,
            unit_price,
            menu_item:menu_items(name)
          )
        `)
        .in('invoice_id', invoiceIds);

      // Group payments and orders by invoice_id
      const paymentsByInv: Record<string, any[]> = {};
      (paymentsData || []).forEach((p) => {
        if (!paymentsByInv[p.invoice_id]) paymentsByInv[p.invoice_id] = [];
        paymentsByInv[p.invoice_id].push(p);
      });

      const ordersByInv: Record<string, any[]> = {};
      (ordersData || []).forEach((o: any) => {
        if (!ordersByInv[o.invoice_id]) ordersByInv[o.invoice_id] = [];
        ordersByInv[o.invoice_id].push(o);
      });

      const fullInvoices: InvoiceRecord[] = invoicesData.map((inv) => ({
        ...inv,
        payments: paymentsByInv[inv.id] || [],
        orders: ordersByInv[inv.id] || [],
      }));

      setInvoices(fullInvoices);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load recent invoices');
    }
    setLoading(false);
  }

  async function handlePrintInvoice(invoice: InvoiceRecord, mode: 'print' | 'download' = 'print') {
    setPrintingId(invoice.id);
    try {
      // Gather order numbers
      const orderNumbers = invoice.orders.map((o) => generateOrderNumber(o.id, o.order_number));

      // Gather table numbers
      const tableNumbers = invoice.orders
        .map((o) => o.restaurant_table?.table_number)
        .filter((t): t is number => typeof t === 'number');

      // Customer names
      const customerNames = invoice.orders
        .map((o) => o.customer_name)
        .filter(Boolean)
        .join(', ');

      // Order type summary
      const typeCounts: Record<string, number> = {};
      invoice.orders.forEach((o) => {
        typeCounts[o.order_type || 'dine_in'] = (typeCounts[o.order_type || 'dine_in'] || 0) + 1;
      });

      const orderTypeParts: string[] = [];
      if (typeCounts['dine_in']) orderTypeParts.push(`${typeCounts['dine_in']} Dine In`);
      if (typeCounts['takeaway']) orderTypeParts.push(`${typeCounts['takeaway']} Take Away`);
      if (typeCounts['counter']) orderTypeParts.push(`${typeCounts['counter']} Counter`);

      const orderTypeSummary = orderTypeParts.join(', ') || 'Standard';

      // Gather all items
      const items: InvoiceItem[] = [];
      invoice.orders.forEach((o) => {
        o.order_items.forEach((oi) => {
          items.push({
            name: oi.menu_item?.name || 'Item',
            quantity: oi.quantity,
            unit_price: oi.unit_price,
          });
        });
      });

      // Payments
      const payments: InvoicePaymentInfo[] = invoice.payments.map((p) => ({
        method: p.payment_method,
        amount: Number(p.amount),
      }));

      await generateInvoicePDF({
        invoiceNumber: invoice.invoice_number,
        orderNumbers,
        tableNumbers,
        customerName: customerNames || null,
        orderTypeSummary,
        items,
        subtotal: Number(invoice.subtotal),
        taxAmount: Number(invoice.tax_amount),
        grandTotal: Number(invoice.grand_total),
        payments: payments.length > 0 ? payments : undefined,
        issuedAt: invoice.issued_at,
        mode,
      });

      toast.success(mode === 'print' ? 'Receipt sent to printer!' : 'Receipt downloaded!');
    } catch (err) {
      console.error(err);
      toast.error('Failed to generate receipt');
    }
    setPrintingId(null);
  }

  // Filtered invoices
  const filteredInvoices = invoices.filter((inv) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;

    // Check invoice number
    if (inv.invoice_number.toString().includes(q)) return true;

    // Check order numbers
    const matchOrder = inv.orders.some(
      (o) =>
        o.order_number?.toLowerCase().includes(q) ||
        o.id.toLowerCase().includes(q) ||
        o.customer_name?.toLowerCase().includes(q) ||
        o.restaurant_table?.table_number?.toString() === q
    );
    if (matchOrder) return true;

    return false;
  });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-3xl max-h-[88vh] rounded-3xl bg-bg-secondary border border-border flex flex-col shadow-2xl overflow-hidden animate-scale-in">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border bg-white/[0.02]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-accent-primary/15 text-accent-primary flex items-center justify-center">
              <Receipt className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-text-primary">Recent Invoices & Reprint</h2>
              <p className="text-xs text-text-muted">View past invoices and reprint receipts</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={fetchRecentInvoices}
              disabled={loading}
              className="p-2.5 rounded-xl glass glass-hover text-text-muted hover:text-text-primary transition-all cursor-pointer disabled:opacity-40"
              title="Refresh invoices"
            >
              <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
            </button>
            <button
              onClick={onClose}
              className="p-2.5 rounded-xl glass glass-hover text-text-muted hover:text-text-primary transition-all cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Search Bar */}
        <div className="p-4 border-b border-border bg-bg-tertiary/30">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
            <input
              type="text"
              placeholder="Search by Invoice # (e.g. 17), Order # (e.g. 260829-0001), Table #, or Customer..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl text-xs bg-bg-secondary border border-border text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent-primary/50 transition-colors"
            />
          </div>
        </div>

        {/* Invoices List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 text-text-muted">
              <Loader2 className="w-8 h-8 text-accent-primary animate-spin mb-3" />
              <p className="text-xs">Loading recent invoices...</p>
            </div>
          ) : filteredInvoices.length === 0 ? (
            <div className="text-center py-16 text-text-muted">
              <Receipt className="w-12 h-12 mx-auto mb-3 opacity-20" />
              <p className="text-sm font-semibold">No invoices found</p>
              <p className="text-xs mt-1">Invoices will appear here once orders are billed</p>
            </div>
          ) : (
            filteredInvoices.map((invoice) => {
              const isPrinting = printingId === invoice.id;
              const orderNums = invoice.orders.map((o) => generateOrderNumber(o.id, o.order_number));
              const tables = [
                ...new Set(
                  invoice.orders
                    .map((o) => o.restaurant_table?.table_number)
                    .filter((t): t is number => typeof t === 'number')
                ),
              ];
              const customerNames = invoice.orders
                .map((o) => o.customer_name)
                .filter(Boolean)
                .join(', ');

              return (
                <div
                  key={invoice.id}
                  className="rounded-2xl glass p-4 space-y-3 transition-all duration-200 hover:bg-white/[0.04] border border-border"
                >
                  {/* Row 1: Invoice #, Total, Date & Time */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-base font-black text-accent-primary bg-accent-primary/10 px-2.5 py-1 rounded-xl border border-accent-primary/20">
                        INV #{invoice.invoice_number}
                      </span>
                      {tables.length > 0 && (
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-lg bg-white/5 border border-white/10 text-text-secondary flex items-center gap-1">
                          <UtensilsCrossed className="w-3 h-3 text-accent-primary" />
                          Table {tables.join(', ')}
                        </span>
                      )}
                      {customerNames && (
                        <span className="text-xs font-medium px-2 py-0.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300">
                          {customerNames}
                        </span>
                      )}
                    </div>

                    <div className="text-right shrink-0">
                      <span className="text-base font-black text-text-primary">
                        {formatCurrency(Number(invoice.grand_total))}
                      </span>
                      <p className="text-[10px] text-text-muted mt-0.5 flex items-center justify-end gap-1">
                        <Clock className="w-3 h-3" />
                        {formatDate(invoice.issued_at)}
                      </p>
                    </div>
                  </div>

                  {/* Row 2: Linked Orders & Payments */}
                  <div className="flex items-center justify-between gap-2 pt-2 border-t border-white/[0.06] text-xs">
                    <div className="flex items-center gap-1.5 flex-wrap text-text-muted">
                      <span className="text-[11px] font-semibold text-text-secondary">Orders:</span>
                      {orderNums.length > 0 ? (
                        orderNums.map((num, i) => (
                          <span
                            key={i}
                            className="font-mono text-[11px] px-2 py-0.5 rounded bg-bg-tertiary border border-border text-text-primary font-medium"
                          >
                            {num}
                          </span>
                        ))
                      ) : (
                        <span className="text-xs text-text-muted">N/A</span>
                      )}

                      {/* Payment Methods */}
                      {invoice.payments.length > 0 && (
                        <div className="flex items-center gap-1 ml-2">
                          <span className="text-[11px] text-text-muted">• Paid:</span>
                          {invoice.payments.map((p, i) => (
                            <span key={i} className="text-[10px] font-semibold uppercase px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                              {p.payment_method}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => handlePrintInvoice(invoice, 'download')}
                        disabled={isPrinting}
                        className="py-1.5 px-2.5 text-xs text-text-muted hover:text-text-primary"
                        icon={<Download className="w-3.5 h-3.5" />}
                      >
                        PDF
                      </Button>
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => handlePrintInvoice(invoice, 'print')}
                        loading={isPrinting}
                        disabled={isPrinting}
                        className="py-1.5 px-3 text-xs"
                        icon={<Printer className="w-3.5 h-3.5" />}
                      >
                        Reprint Receipt
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
