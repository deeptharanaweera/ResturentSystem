'use client';

import React, { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { formatCurrency, formatDate, formatTime } from '@/lib/utils';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Badge from '@/components/ui/Badge';
import { 
  BarChart3, 
  TrendingUp, 
  Users, 
  Receipt, 
  Calendar, 
  Search, 
  FileDown, 
  Printer, 
  ChevronRight,
  ArrowUpRight,
  ArrowDownRight,
  Loader2,
  Filter,
  Eye,
  Info
} from 'lucide-react';
import Modal from '@/components/ui/Modal';
import { toast } from 'sonner';
import { generateInvoicePDF } from '@/components/billing/InvoiceGenerator';

export default function ReportsPage() {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [startDate, setStartDate] = useState(new Date(new Date().setDate(new Date().getDate() - 7)).toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [viewInvoice, setViewInvoice] = useState<any | null>(null);
  
  // Stats
  const [stats, setStats] = useState({
    totalIncome: 0,
    invoiceCount: 0,
    avgValue: 0,
    taxCollected: 0
  });

  useEffect(() => {
    fetchInvoices();
  }, [startDate, endDate]);

  async function fetchInvoices() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('invoices')
        .select(`
          *,
          orders:orders!fk_orders_invoice(
            *,
            restaurant_table:restaurant_tables(*),
            order_items(*, menu_item:menu_items(*))
          )
        `)
        .gte('issued_at', `${startDate}T00:00:00`)
        .lte('issued_at', `${endDate}T23:59:59`)
        .order('issued_at', { ascending: false });

      if (error) throw error;

      const filteredInvoices = data || [];
      setInvoices(filteredInvoices);

      // Calculate stats
      const total = filteredInvoices.reduce((sum, inv) => sum + inv.grand_total, 0);
      const tax = filteredInvoices.reduce((sum, inv) => sum + inv.tax_amount, 0);
      
      setStats({
        totalIncome: total,
        invoiceCount: filteredInvoices.length,
        avgValue: filteredInvoices.length > 0 ? total / filteredInvoices.length : 0,
        taxCollected: tax
      });

    } catch (err) {
      console.error('Error fetching reports:', err);
      toast.error('Failed to load report data');
    } finally {
      setLoading(false);
    }
  }

  async function handlePrint(invoice: any) {
    const order = invoice.orders[0];
    if (!order) return;

    const allItems = invoice.orders.flatMap((o: any) => o.order_items.map((oi: any) => ({
      name: invoice.orders.length > 1 
        ? `${oi.menu_item?.name} (Ord ${o.id.slice(0, 4)})`
        : oi.menu_item?.name || 'Unknown',
      quantity: oi.quantity,
      unit_price: oi.unit_price,
    })));

    await generateInvoicePDF({
      invoiceNumber: invoice.invoice_number,
      orderId: invoice.orders.length > 1 ? `GROUP: ${invoice.orders.length}` : order.id,
      tableNumber: order.restaurant_table?.table_number || 0,
      items: allItems,
      subtotal: invoice.subtotal,
      taxAmount: invoice.tax_amount,
      grandTotal: invoice.grand_total,
      issuedAt: invoice.issued_at,
      mode: 'print',
    });
  }

  return (
    <div className="p-4 md:p-6 space-y-8">
      {/* Header & Filters */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-1">
          <h1 className="text-3xl font-black text-text-primary tracking-tight">Financial Reports</h1>
          <p className="text-text-muted">Track your restaurant's performance and income</p>
        </div>

        <div className="flex flex-wrap items-center gap-3 bg-bg-secondary p-2 rounded-2xl border border-border shadow-sm">
          <div className="flex items-center gap-2 px-3">
            <Calendar className="w-4 h-4 text-accent-primary" />
            <span className="text-xs font-bold uppercase text-text-muted">Range</span>
          </div>
          <Input 
            type="date" 
            value={startDate} 
            onChange={(e) => setStartDate(e.target.value)} 
            className="w-40 bg-transparent border-none focus:ring-0 text-sm"
          />
          <div className="text-text-muted font-bold">—</div>
          <Input 
            type="date" 
            value={endDate} 
            onChange={(e) => setEndDate(e.target.value)} 
            className="w-40 bg-transparent border-none focus:ring-0 text-sm"
          />
          <Button variant="ghost" size="sm" onClick={fetchInvoices} icon={<Filter className="w-4 h-4" />}>
            Apply
          </Button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Income', value: stats.totalIncome, icon: TrendingUp, color: 'text-accent-success', bg: 'bg-accent-success/10' },
          { label: 'Invoices Issued', value: stats.invoiceCount, icon: Receipt, color: 'text-accent-primary', bg: 'bg-accent-primary/10', isQty: true },
          { label: 'Average Order', value: stats.avgValue, icon: BarChart3, color: 'text-accent-secondary', bg: 'bg-accent-secondary/10' },
          { label: 'Tax Collected', value: stats.taxCollected, icon: Users, color: 'text-amber-500', bg: 'bg-amber-500/10' },
        ].map((item, i) => (
          <Card key={i} className="relative overflow-hidden group hover:shadow-xl transition-all duration-500 border-none bg-bg-secondary shadow-lg">
            <div className={`absolute top-0 right-0 w-24 h-24 -mr-8 -mt-8 rounded-full ${item.bg} blur-2xl group-hover:blur-xl transition-all`} />
            <div className="relative flex items-center gap-4">
              <div className={`w-12 h-12 rounded-2xl ${item.bg} flex items-center justify-center ${item.color}`}>
                <item.icon className="w-6 h-6" />
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] font-bold uppercase tracking-widest text-text-muted">{item.label}</span>
                <span className="text-2xl font-black text-text-primary">
                  {item.isQty ? item.value : formatCurrency(item.value)}
                </span>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 gap-6">
        <Card className="border-none shadow-xl bg-bg-secondary">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold flex items-center gap-2">
              <Receipt className="w-5 h-5 text-accent-primary" />
              Recent Billing Transactions
            </h3>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" icon={<FileDown className="w-4 h-4" />}>Export CSV</Button>
            </div>
          </div>

          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center gap-4">
              <Loader2 className="w-10 h-10 animate-spin text-accent-primary" />
              <p className="text-sm text-text-muted font-medium">Analyzing financial data...</p>
            </div>
          ) : invoices.length === 0 ? (
            <div className="py-20 text-center space-y-4">
              <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto text-text-muted/20">
                <Search className="w-8 h-8" />
              </div>
              <p className="text-text-muted text-sm">No transactions found for the selected date range.</p>
            </div>
          ) : (
            <div className="overflow-x-auto -mx-6">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-white/[0.02] text-text-muted text-[10px] uppercase font-bold tracking-wider">
                    <th className="px-6 py-4">Invoice</th>
                    <th className="px-6 py-4">Date & Time</th>
                    <th className="px-6 py-4">Table</th>
                    <th className="px-6 py-4">Items</th>
                    <th className="px-6 py-4 text-right">Total</th>
                    <th className="px-6 py-4 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {invoices.map((inv) => (
                    <tr key={inv.id} className="hover:bg-white/[0.02] transition-colors group">
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="text-sm font-bold text-text-primary">#{inv.invoice_number}</span>
                          <span className="text-[10px] text-text-muted font-mono">{inv.id.split('-')[0]}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="text-sm text-text-secondary">{formatDate(inv.issued_at)}</span>
                          <span className="text-[10px] text-text-muted">{formatTime(inv.issued_at)}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap gap-1">
                          {[...new Set(inv.orders.map((o: any) => o.restaurant_table?.table_number))].filter(Boolean).map((num: any) => (
                            <Badge key={num} variant="default" className="bg-accent-primary/10 text-accent-primary border-none text-[10px]">
                              T-{num}
                            </Badge>
                          ))}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="text-sm text-text-secondary font-bold">
                            {inv.orders.reduce((sum: number, o: any) => sum + o.order_items.length, 0)} items
                          </span>
                          {inv.orders.length > 1 && (
                            <span className="text-[10px] text-accent-primary font-medium animate-pulse">
                              {inv.orders.length} Orders Combined
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <span className="text-base font-bold text-accent-success">{formatCurrency(inv.grand_total)}</span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button 
                            onClick={() => setViewInvoice(inv)}
                            className="p-2 rounded-lg bg-white/5 text-text-muted hover:text-accent-primary hover:bg-accent-primary/10 transition-all cursor-pointer"
                            title="View Details"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => handlePrint(inv)}
                            className="p-2 rounded-lg bg-white/5 text-text-muted hover:text-accent-primary hover:bg-accent-primary/10 transition-all cursor-pointer"
                            title="Print Receipt"
                          >
                            <Printer className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
      {/* Detail Modal */}
      <Modal
        isOpen={!!viewInvoice}
        onClose={() => setViewInvoice(null)}
        title={`Invoice Details - #${viewInvoice?.invoice_number}`}
        size="lg"
      >
        {viewInvoice && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 rounded-2xl bg-white/5 border border-white/5">
                <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Date Issued</span>
                <p className="text-sm font-medium">{formatDate(viewInvoice.issued_at)} at {formatTime(viewInvoice.issued_at)}</p>
              </div>
              <div className="p-4 rounded-2xl bg-white/5 border border-white/5">
                <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Total Orders</span>
                <p className="text-sm font-medium">{viewInvoice.orders.length} orders combined</p>
              </div>
            </div>

            <div className="space-y-4">
              <h4 className="text-xs font-bold uppercase tracking-widest text-accent-primary">Itemized Breakdown</h4>
              <div className="space-y-3 max-h-[40vh] overflow-y-auto pr-2">
                {viewInvoice.orders.map((order: any, idx: number) => (
                  <div key={order.id} className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 space-y-3">
                    <div className="flex justify-between items-center border-b border-white/5 pb-2">
                      <span className="text-xs font-bold text-text-secondary">Order #{order.id.slice(0, 8).toUpperCase()}</span>
                      <Badge variant="default" className="bg-accent-primary/10 text-accent-primary border-none text-[10px]">Table {order.restaurant_table?.table_number}</Badge>
                    </div>
                    <div className="space-y-2">
                      {order.order_items.map((item: any) => (
                        <div key={item.id} className="flex justify-between text-xs">
                          <span className="text-text-muted">{item.quantity}x {item.menu_item?.name}</span>
                          <span className="font-medium">{formatCurrency(item.unit_price * item.quantity)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-4 border-t border-border space-y-2">
              <div className="flex justify-between text-sm text-text-muted">
                <span>Subtotal</span>
                <span>{formatCurrency(viewInvoice.subtotal)}</span>
              </div>
              <div className="flex justify-between text-sm text-text-muted">
                <span>Tax Amount</span>
                <span>{formatCurrency(viewInvoice.tax_amount)}</span>
              </div>
              <div className="flex justify-between text-xl font-bold text-text-primary pt-2">
                <span>Grand Total</span>
                <span className="text-accent-success">{formatCurrency(viewInvoice.grand_total)}</span>
              </div>
            </div>

            <Button 
              variant="primary" 
              className="w-full" 
              onClick={() => handlePrint(viewInvoice)}
              icon={<Printer className="w-4 h-4" />}
            >
              Reprint Receipt
            </Button>
          </div>
        )}
      </Modal>
    </div>
  );
}
