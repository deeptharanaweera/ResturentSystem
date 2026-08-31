'use client';

import React, { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { RestaurantTable, OrderWithItems } from '@/types/database';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import QRCodeDisplay from '@/components/tables/QRCodeDisplay';
import Modal from '@/components/ui/Modal';
import Badge from '@/components/ui/Badge';
import { QrCode, Plus, Power, PowerOff, Trash2, Eye, ShoppingCart, Loader2, Clock, ChefHat, CheckCircle, Check } from 'lucide-react';
import { toast } from 'sonner';
import { cn, formatCurrency } from '@/lib/utils';
import Link from 'next/link';
import { useBranch } from '@/context/BranchContext';

interface TableWithStatus extends RestaurantTable {
  active_orders_count: number;
  status: 'empty' | 'pending' | 'preparing' | 'completed' | 'served';
}

export default function TablesPage() {
  const supabase = createClient();
  const { currentBranch } = useBranch();
  const [tables, setTables] = useState<TableWithStatus[]>([]);
  const [newTableNumber, setNewTableNumber] = useState('');
  const [loading, setLoading] = useState(true);
  const [qrModal, setQrModal] = useState<{ tableId: string; tableNumber: number } | null>(null);
  const [viewOrdersModal, setViewOrdersModal] = useState<TableWithStatus | null>(null);
  const [tableOrders, setTableOrders] = useState<OrderWithItems[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [userRole, setUserRole] = useState<string | null>(null);
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  useEffect(() => {
    loadUser();
    fetchTables();

    // Subscribe to orders to update table status in real-time
    const channel = supabase
      .channel('table-status')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
        fetchTables();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentBranch]);

  async function loadUser() {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: roleData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .single();
      setUserRole(roleData?.role || null);
    }
  }

  async function fetchTables() {
    // Fetch tables scoped by branch
    let query = supabase
      .from('restaurant_tables')
      .select('*');

    if (currentBranch) {
      query = query.eq('branch_id', currentBranch.id);
    }

    const { data: tablesData } = await query.order('table_number', { ascending: true });

    if (!tablesData) return;

    // Fetch active orders to calculate status (only un-invoiced orders keep table occupied)
    const { data: ordersData } = await supabase
      .from('orders')
      .select('id, table_id, status, invoice_id')
      .in('status', ['pending', 'preparing', 'completed', 'served'])
      .is('invoice_id', null);

    const tableWithStatus = (tablesData as RestaurantTable[]).map(t => {
      const orders = ordersData?.filter(o => o.table_id === t.id) || [];
      const hasPreparing = orders.some(o => o.status === 'preparing');
      const hasPending = orders.some(o => o.status === 'pending');
      const hasCompleted = orders.some(o => o.status === 'completed');
      const hasServed = orders.some(o => o.status === 'served');

      return {
        ...t,
        active_orders_count: orders.length,
        status: hasPreparing ? 'preparing' : hasPending ? 'pending' : hasCompleted ? 'completed' : hasServed ? 'served' : 'empty'
      } as TableWithStatus;
    });

    setTables(tableWithStatus);
    setLoading(false);
  }

  async function fetchTableOrders(tableId: string) {
    setOrdersLoading(true);
    const { data } = await supabase
      .from('orders')
      .select(`
        *,
        restaurant_table:restaurant_tables(*),
        order_items(
          *,
          menu_item:menu_items(*)
        )
      `)
      .eq('table_id', tableId)
      .is('invoice_id', null)
      .in('status', ['pending', 'preparing', 'completed', 'served'])
      .order('created_at', { ascending: false });

    setTableOrders(data as unknown as OrderWithItems[] || []);
    setOrdersLoading(false);
  }

  async function handleMarkAsServed(orderId: string) {
    const { error } = await supabase
      .from('orders')
      .update({ status: 'served' })
      .eq('id', orderId);

    if (error) {
      toast.error('Failed to mark order as served');
    } else {
      toast.success('Order marked as served');
      if (viewOrdersModal) {
        fetchTableOrders(viewOrdersModal.id);
      }
      fetchTables();
    }
  }

  async function handleMarkAllAsServed() {
    const completedIds = tableOrders.filter(o => o.status === 'completed').map(o => o.id);
    if (completedIds.length === 0) return;

    const { error } = await supabase
      .from('orders')
      .update({ status: 'served' })
      .in('id', completedIds);

    if (error) {
      toast.error('Failed to mark orders as served');
    } else {
      toast.success('Completed orders marked as served');
      if (viewOrdersModal) {
        fetchTableOrders(viewOrdersModal.id);
      }
      fetchTables();
    }
  }

  async function addTable() {
    const num = parseInt(newTableNumber);
    if (!num || num <= 0) {
      toast.error('Enter a valid table number');
      return;
    }

    const { error } = await supabase.from('restaurant_tables').insert({
      branch_id: currentBranch?.id || null,
      table_number: num,
      is_active: true,
    });

    if (error) {
      toast.error(error.message.includes('duplicate') ? 'Table number already exists' : 'Failed to add table');
    } else {
      toast.success(`Table ${num} added`);
      setNewTableNumber('');
      fetchTables();
    }
  }

  async function toggleActive(id: string, currentActive: boolean) {
    const { error } = await supabase
      .from('restaurant_tables')
      .update({ is_active: !currentActive })
      .eq('id', id);

    if (!error) {
      toast.success(`Table ${currentActive ? 'deactivated' : 'activated'}`);
      fetchTables();
    }
  }

  async function deleteTable(id: string) {
    const { error } = await supabase.from('restaurant_tables').delete().eq('id', id);
    if (!error) {
      toast.success('Table deleted');
      fetchTables();
    } else {
      toast.error('Cannot delete table with existing orders');
    }
  }

  function handleViewOrders(table: TableWithStatus) {
    setViewOrdersModal(table);
    fetchTableOrders(table.id);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-accent-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Table Management</h1>
          <p className="text-sm text-text-muted mt-1">View active orders and manage tables</p>
        </div>

        {(userRole === 'admin' || userRole === 'super_admin') && (
          <div className="flex items-center gap-3">
            <Input
              placeholder="New Table #"
              type="number"
              value={newTableNumber}
              onChange={(e) => setNewTableNumber(e.target.value)}
              className="w-32"
            />
            <Button variant="primary" onClick={addTable} icon={<Plus className="w-4 h-4" />}>
              Add
            </Button>
          </div>
        )}
      </div>

      {/* Tables Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
        {tables.map((table) => (
          <Card
            key={table.id}
            className={cn(
              'relative flex flex-col items-center p-5 space-y-4 animate-slide-up transition-all duration-300',
              !table.is_active && 'opacity-40 grayscale',
              table.status === 'pending' && 'ring-2 ring-amber-500/50 bg-amber-500/5',
              table.status === 'preparing' && 'ring-2 ring-blue-500/50 bg-blue-500/5',
              table.status === 'completed' && 'ring-2 ring-teal-500/50 bg-teal-500/5',
              table.status === 'served' && 'ring-2 ring-emerald-500/50 bg-emerald-500/5'
            )}
          >
            {/* Table Number Circle */}
            <div className={cn(
              'w-16 h-16 rounded-full flex flex-col items-center justify-center border-2 transition-colors',
              table.status === 'empty' ? 'border-border text-text-muted' :
                table.status === 'pending' ? 'border-amber-500 text-amber-500 bg-amber-500/10' :
                  table.status === 'preparing' ? 'border-blue-500 text-blue-500 bg-blue-500/10' :
                    table.status === 'completed' ? 'border-teal-500 text-teal-400 bg-teal-500/10' :
                      'border-emerald-500 text-emerald-500 bg-emerald-500/10'
            )}>
              <span className="text-xs font-medium uppercase opacity-60">Table</span>
              <span className="text-2xl font-bold leading-none">{table.table_number}</span>
            </div>

            <div className="text-center space-y-1">
              <p className="text-xs font-semibold text-text-primary">
                {table.status === 'empty' ? 'Vacant' :
                  table.status === 'pending' ? 'Pending Order' :
                    table.status === 'preparing' ? 'Preparing' :
                      table.status === 'completed' ? 'Food Ready' : 'Served'}
              </p>
              {table.active_orders_count > 0 && (
                <p className="text-[10px] text-text-muted">{table.active_orders_count} active orders</p>
              )}
            </div>

            {/* Quick Actions - Design matched to user image */}
            <div className="grid grid-cols-2 gap-2 w-full pt-2">
              <button
                onClick={() => handleViewOrders(table)}
                className="flex flex-col items-center justify-center gap-2 p-3 rounded-2xl bg-white/[0.03] border border-white/5 hover:bg-white/10 hover:border-accent-primary/30 transition-all cursor-pointer group"
                title="View Orders"
              >
                <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-accent-primary/20 transition-colors">
                  <Eye className="w-5 h-5 text-text-secondary group-hover:text-accent-primary" />
                </div>
                <span className="text-[10px] font-semibold text-text-muted group-hover:text-text-primary">Orders</span>
              </button>
              <Link
                href={`/menu/${table.id}`}
                className="flex flex-col items-center justify-center gap-2 p-3 rounded-2xl bg-white/[0.03] border border-white/5 hover:bg-white/10 hover:border-accent-success/30 transition-all cursor-pointer group"
                title="Place Order"
              >
                <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-accent-success/20 transition-colors">
                  <ShoppingCart className="w-5 h-5 text-text-secondary group-hover:text-accent-success" />
                </div>
                <span className="text-[10px] font-semibold text-text-muted group-hover:text-text-primary">Order</span>
              </Link>
            </div>

            {/* Admin Actions Dropdown/Popover (Simulated) */}
            {(userRole === 'admin' || userRole === 'super_admin') && (
              <div className="absolute top-2 right-2 flex gap-1">
                <button
                  onClick={() => setQrModal({ tableId: table.id, tableNumber: table.table_number })}
                  className="p-1 rounded-md hover:bg-white/5 text-text-muted hover:text-accent-primary transition-all cursor-pointer"
                >
                  <QrCode className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => deleteTable(table.id)}
                  className="p-1 rounded-md hover:bg-white/5 text-text-muted hover:text-accent-danger transition-all cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </Card>
        ))}
      </div>

      {/* View Orders Modal */}
      <Modal
        isOpen={!!viewOrdersModal}
        onClose={() => setViewOrdersModal(null)}
        title={`Orders - Table ${viewOrdersModal?.table_number}`}
        size="lg"
      >
        {ordersLoading ? (
          <div className="py-12 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-accent-primary" /></div>
        ) : tableOrders.length === 0 ? (
          <div className="py-12 text-center text-text-muted text-sm">No active orders for this table</div>
        ) : (
          <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
            {tableOrders.some(o => o.status === 'completed') && (
              <div className="flex items-center justify-between p-3 rounded-xl bg-teal-500/10 border border-teal-500/20">
                <span className="text-xs text-teal-400 font-medium">Table has completed food ready to serve</span>
                <Button
                  variant="success"
                  size="sm"
                  onClick={handleMarkAllAsServed}
                  icon={<Check className="w-3.5 h-3.5" />}
                >
                  Mark All as Served
                </Button>
              </div>
            )}

            {tableOrders.map(order => (
              <Card key={order.id} padding="md" className="border-border/50 space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant={order.status as any}>
                      {order.status === 'completed' ? 'Food Ready (Completed)' : order.status}
                    </Badge>
                    <span className="text-xs text-text-muted">
                      Ordered {new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <span className="text-sm font-bold gradient-text">{formatCurrency(order.total_amount)}</span>
                </div>

                <div className="space-y-2">
                  {order.order_items.map(item => (
                    <div key={item.id} className="flex justify-between text-xs">
                      <span className="text-text-secondary">
                        {item.quantity}x {item.menu_item?.name}
                      </span>
                      <span className="text-text-muted">{formatCurrency(item.unit_price * item.quantity)}</span>
                    </div>
                  ))}
                </div>

                {order.status === 'completed' && (
                  <div className="pt-2 border-t border-border/50 flex justify-end">
                    <Button
                      variant="success"
                      size="sm"
                      onClick={() => handleMarkAsServed(order.id)}
                      icon={<CheckCircle className="w-3.5 h-3.5" />}
                    >
                      Mark as Served
                    </Button>
                  </div>
                )}
              </Card>
            ))}

            <div className="pt-4 border-t border-border">
              <Link href={`/menu/${viewOrdersModal?.id}`}>
                <Button variant="primary" className="w-full" icon={<ShoppingCart className="w-4 h-4" />}>
                  Place New Order
                </Button>
              </Link>
            </div>
          </div>
        )}
      </Modal>

      {/* QR Code Modal */}
      {qrModal && (
        <QRCodeDisplay
          isOpen={!!qrModal}
          onClose={() => setQrModal(null)}
          tableNumber={qrModal.tableNumber}
          tableId={qrModal.tableId}
          appUrl={appUrl}
        />
      )}
    </div>
  );
}
