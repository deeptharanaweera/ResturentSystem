'use client';

import React, { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useBranch } from '@/context/BranchContext';
import { DayEnd } from '@/types/database';
import { generateDayEndPDF } from '@/components/billing/DayEndReportGenerator';
import { getDayEndsWithUserDetails, DayEndWithUserDetails, openDayShift, closeDayShift } from '@/app/actions/dayend';
import { getStaffUsersWithDetails, StaffUserRecord } from '@/app/actions/users';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Modal from '@/components/ui/Modal';
import {
  Calendar,
  CalendarDays,
  Clock,
  DollarSign,
  Printer,
  Download,
  AlertTriangle,
  CheckCircle2,
  Lock,
  Plus,
  RefreshCw,
  Receipt,
  CreditCard,
  Banknote,
  TrendingUp,
  Loader2,
  Building2,
  User,
  Monitor,
  History,
} from 'lucide-react';
import { toast } from 'sonner';
import { formatCurrency, formatDate, formatTime, cn } from '@/lib/utils';

export default function DayEndPage() {
  const supabase = createClient();
  const { currentBranch, currentTerminal, userBranches, switchBranch, loading: branchLoading } = useBranch();

  const [activeShift, setActiveShift] = useState<DayEndWithUserDetails | null>(null);
  const [pastShifts, setPastShifts] = useState<DayEndWithUserDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Available staff and POS terminals for this branch
  const [branchStaffUsers, setBranchStaffUsers] = useState<StaffUserRecord[]>([]);
  const [branchPosTerminals, setBranchPosTerminals] = useState<any[]>([]);

  // Open Shift Modal State
  const [openModalOpen, setOpenModalOpen] = useState(false);
  const [openingCashInput, setOpeningCashInput] = useState('0');
  const [selectedStaffUserId, setSelectedStaffUserId] = useState('');
  const [selectedTerminalId, setSelectedTerminalId] = useState('');
  const [submittingOpen, setSubmittingOpen] = useState(false);

  // Live shift sales metrics
  const [liveSales, setLiveSales] = useState({
    totalSales: 0,
    totalCash: 0,
    totalCard: 0,
    totalOther: 0,
    totalTax: 0,
    totalInvoices: 0,
    totalOrders: 0,
  });

  // Close Shift Modal State
  const [closeModalOpen, setCloseModalOpen] = useState(false);
  const [actualCashInput, setActualCashInput] = useState('');
  const [closingNotes, setClosingNotes] = useState('');
  const [submittingClose, setSubmittingClose] = useState(false);

  // Printing state
  const [printingId, setPrintingId] = useState<string | null>(null);

  useEffect(() => {
    if (currentBranch) {
      loadDayEndData();
    }
  }, [currentBranch]);

  async function loadDayEndData() {
    if (!currentBranch) return;
    setLoading(true);
    try {
      // 1. Fetch shifts with user details
      const res = await getDayEndsWithUserDetails(currentBranch.id);
      if (res.error) throw new Error(res.error);

      setActiveShift(res.activeShift || null);
      setPastShifts(res.pastShifts || []);

      if (res.activeShift) {
        await calculateLiveMetrics(res.activeShift.opened_at);
      }

      // 2. Fetch staff users assigned to this branch
      const staffRes = await getStaffUsersWithDetails();
      const allStaff = staffRes.users || [];
      const branchStaff = allStaff.filter(
        (u) => u.is_active && (u.role === 'super_admin' || u.role === 'admin' || u.role === 'pos' || u.branches.some((b) => b.id === currentBranch.id))
      );
      setBranchStaffUsers(branchStaff);

      // Default select current logged in user or first POS staff
      const { data: { user } } = await supabase.auth.getUser();
      const currentLoggedInStaff = branchStaff.find((u) => u.user_id === user?.id);
      if (currentLoggedInStaff) {
        setSelectedStaffUserId(currentLoggedInStaff.user_id);
      } else if (branchStaff.length > 0) {
        setSelectedStaffUserId(branchStaff[0].user_id);
      }

      // 3. Fetch POS counter terminals for this branch
      const { data: tData } = await supabase
        .from('terminals')
        .select('*')
        .eq('branch_id', currentBranch.id)
        .eq('is_active', true);

      const posTerms = (tData || []).filter((t: any) => !t.terminal_type || t.terminal_type === 'pos');
      setBranchPosTerminals(posTerms);
      if (posTerms.length > 0) {
        setSelectedTerminalId(posTerms[0].id);
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to load day-end data');
    } finally {
      setLoading(false);
    }
  }

  async function calculateLiveMetrics(openedAt: string) {
    if (!currentBranch) return;

    try {
      // Invoices since shift opened
      const { data: invoicesData } = await supabase
        .from('invoices')
        .select('id, subtotal, tax_amount, grand_total, issued_at')
        .eq('branch_id', currentBranch.id)
        .gte('issued_at', openedAt);

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

      const totalSales = invList.reduce((sum, i) => sum + Number(i.grand_total), 0);
      const totalTax = invList.reduce((sum, i) => sum + Number(i.tax_amount), 0);

      // Orders since shift opened
      const { count: orderCount } = await supabase
        .from('orders')
        .select('*', { count: 'exact', head: true })
        .eq('branch_id', currentBranch.id)
        .gte('created_at', openedAt);

      setLiveSales({
        totalSales,
        totalCash: cashSum,
        totalCard: cardSum,
        totalOther: otherSum,
        totalTax,
        totalInvoices: invList.length,
        totalOrders: orderCount || 0,
      });
    } catch (err) {
      console.error('Error calculating live shift metrics:', err);
    }
  }

  async function handleOpenShift() {
    if (!currentBranch) return;
    if (!selectedTerminalId) {
      toast.error('Please select a workstation terminal');
      return;
    }
    if (!selectedStaffUserId) {
      toast.error('Please select an assigned staff / POS cashier');
      return;
    }

    setSubmittingOpen(true);

    try {
      const res = await openDayShift({
        branch_id: currentBranch.id,
        terminal_id: selectedTerminalId,
        user_id: selectedStaffUserId,
        opening_cash: parseFloat(openingCashInput) || 0,
      });

      if (res.error) {
        toast.error(res.error);
      } else {
        toast.success('Shift / Day opened successfully!');
        setOpenModalOpen(false);
        setOpeningCashInput('0');
        await loadDayEndData();
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to open shift');
    }
    setSubmittingOpen(false);
  }

  async function handleCloseShift() {
    if (!activeShift || !currentBranch) return;
    setSubmittingClose(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      const actualCash = parseFloat(actualCashInput) || 0;
      const expectedCash = Number(activeShift.opening_cash) + liveSales.totalCash;
      const difference = actualCash - expectedCash;
      const closedAt = new Date().toISOString();

      const { data: closedShift, error } = await supabase
        .from('day_ends')
        .update({
          status: 'closed',
          closed_at: closedAt,
          closed_by: user?.id || null,
          total_sales: liveSales.totalSales,
          total_cash: liveSales.totalCash,
          total_card: liveSales.totalCard,
          total_other: liveSales.totalOther,
          total_tax: liveSales.totalTax,
          total_orders: liveSales.totalOrders,
          total_invoices: liveSales.totalInvoices,
          actual_cash: actualCash,
          cash_difference: difference,
          notes: closingNotes || null,
        })
        .eq('id', activeShift.id)
        .select(`
          *,
          branch:branches(*),
          terminal:terminals(*)
        `)
        .single();

      if (error) throw error;

      toast.success('Day / Shift closed successfully!');
      setCloseModalOpen(false);
      setActiveShift(null);
      setActualCashInput('');
      setClosingNotes('');

      // Prompt to print Z-Report
      if (closedShift) {
        await generateDayEndPDF(closedShift, 'print');
      }

      await loadDayEndData();
    } catch (err) {
      console.error(err);
      toast.error('Failed to close shift');
    }
    setSubmittingClose(false);
  }

  async function handlePrintShift(shift: DayEnd, mode: 'print' | 'download' = 'print') {
    setPrintingId(shift.id);
    try {
      await generateDayEndPDF(shift, mode);
      toast.success(mode === 'print' ? 'Z-Report sent to printer!' : 'Report downloaded!');
    } catch (err) {
      console.error(err);
      toast.error('Failed to generate report');
    }
    setPrintingId(null);
  }

  const countedCash = parseFloat(actualCashInput) || 0;
  const expectedDrawerCash = (activeShift ? Number(activeShift.opening_cash) : 0) + liveSales.totalCash;
  const liveVariance = countedCash - expectedDrawerCash;

  if (branchLoading || !currentBranch) {
    return (
      <div className="flex items-center justify-center h-80">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-accent-primary animate-spin" />
          <p className="text-xs text-text-muted">Loading branch configuration...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header with Branch Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-text-primary">Day-End Management</h1>
            <span className="font-mono text-xs font-bold text-accent-primary bg-accent-primary/10 px-2.5 py-0.5 rounded-full border border-accent-primary/20">
              {currentBranch.code}
            </span>
          </div>
          <p className="text-xs text-text-muted mt-0.5">
            Shift reconciliation, cash drawer audit, and Z-Reports for {currentBranch.name}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Branch Switcher Dropdown */}
          {userBranches.length > 1 && (
            <select
              value={currentBranch.id}
              onChange={(e) => {
                const b = userBranches.find((x) => x.id === e.target.value);
                if (b) switchBranch(b);
              }}
              className="px-3 py-2 rounded-xl text-xs bg-bg-secondary border border-border text-text-primary focus:outline-none cursor-pointer"
            >
              {userBranches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} ({b.code})
                </option>
              ))}
            </select>
          )}

          <Button
            variant="secondary"
            size="sm"
            onClick={loadDayEndData}
            disabled={loading}
            icon={<RefreshCw className={cn('w-3.5 h-3.5', loading && 'animate-spin')} />}
          >
            Refresh
          </Button>
        </div>
      </div>

      {/* ACTIVE SHIFT SECTION */}
      {activeShift ? (
        <div className="rounded-3xl glass p-6 border border-emerald-500/30 bg-emerald-500/[0.02] space-y-6 shadow-xl relative overflow-hidden">
          {/* Active Shift Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/[0.08]">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shadow-lg shadow-emerald-500/10">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-text-primary">Shift In Progress</h3>
                  <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    OPEN
                  </span>
                </div>
                <div className="flex items-center gap-2 flex-wrap text-xs text-text-muted mt-0.5">
                  <span>Opened on {formatDate(activeShift.opened_at)} at {formatTime(activeShift.opened_at)}</span>
                  {activeShift.opened_by_email && (
                    <>
                      <span>&bull;</span>
                      <span className="text-text-secondary font-medium">Cashier: {activeShift.opened_by_email}</span>
                    </>
                  )}
                  {activeShift.terminal && (
                    <>
                      <span>&bull;</span>
                      <span className="font-mono text-[10px] font-bold px-2 py-0.2 rounded bg-white/5 border border-white/10 text-accent-primary">
                        {activeShift.terminal.name || activeShift.terminal.code}
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>

            <Button
              variant="danger"
              onClick={() => {
                setActualCashInput(expectedDrawerCash.toFixed(2));
                setCloseModalOpen(true);
              }}
              icon={<Lock className="w-4 h-4" />}
              className="py-2.5 px-4 text-xs font-bold"
            >
              Close Shift / Day End
            </Button>
          </div>

          {/* Key Metrics Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {/* Opening Cash */}
            <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 space-y-1">
              <span className="text-[10px] uppercase font-bold text-text-muted tracking-wider">Opening Float</span>
              <p className="text-lg font-black text-text-primary font-mono">{formatCurrency(Number(activeShift.opening_cash))}</p>
            </div>

            {/* Total Gross Sales */}
            <div className="p-4 rounded-2xl bg-accent-primary/10 border border-accent-primary/20 space-y-1">
              <span className="text-[10px] uppercase font-bold text-accent-primary tracking-wider">Total Sales</span>
              <p className="text-lg font-black text-accent-primary font-mono">{formatCurrency(liveSales.totalSales)}</p>
            </div>

            {/* Cash Collected */}
            <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 space-y-1">
              <span className="text-[10px] uppercase font-bold text-emerald-400 tracking-wider">Cash Sales</span>
              <p className="text-lg font-black text-emerald-400 font-mono">{formatCurrency(liveSales.totalCash)}</p>
            </div>

            {/* Card Collected */}
            <div className="p-4 rounded-2xl bg-blue-500/10 border border-blue-500/20 space-y-1">
              <span className="text-[10px] uppercase font-bold text-blue-400 tracking-wider">Card Sales</span>
              <p className="text-lg font-black text-blue-400 font-mono">{formatCurrency(liveSales.totalCard)}</p>
            </div>
          </div>

          {/* Secondary Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
            <div className="p-3 rounded-xl bg-white/[0.02] text-xs space-y-1">
              <span className="text-text-muted">Total Invoices</span>
              <p className="font-bold text-text-primary">{liveSales.totalInvoices}</p>
            </div>
            <div className="p-3 rounded-xl bg-white/[0.02] text-xs space-y-1">
              <span className="text-text-muted">Total Orders</span>
              <p className="font-bold text-text-primary">{liveSales.totalOrders}</p>
            </div>
            <div className="p-3 rounded-xl bg-white/[0.02] text-xs space-y-1">
              <span className="text-text-muted">Tax Collected</span>
              <p className="font-bold text-text-primary font-mono">{formatCurrency(liveSales.totalTax)}</p>
            </div>
            <div className="p-3 rounded-xl bg-white/[0.02] text-xs space-y-1">
              <span className="text-text-muted">Expected Drawer Cash</span>
              <p className="font-bold text-text-primary font-mono">{formatCurrency(expectedDrawerCash)}</p>
            </div>
          </div>
        </div>
      ) : (
        /* NO ACTIVE SHIFT — PROMPT TO OPEN */
        <div className="rounded-3xl glass p-8 border border-border text-center space-y-4 max-w-xl mx-auto my-6">
          <div className="w-14 h-14 rounded-3xl bg-accent-primary/15 text-accent-primary flex items-center justify-center mx-auto shadow-lg shadow-accent-primary/20">
            <CalendarDays className="w-7 h-7" />
          </div>
          <div className="space-y-1">
            <h3 className="text-lg font-bold text-text-primary">No Active Shift for {currentBranch.name}</h3>
            <p className="text-xs text-text-muted max-w-sm mx-auto">
              Start the day by recording the opening cash float in the cash drawer.
            </p>
          </div>
          <Button
            variant="primary"
            onClick={() => setOpenModalOpen(true)}
            icon={<Plus className="w-4 h-4" />}
            className="py-3 px-6 text-sm font-bold"
          >
            Open New Shift / Day
          </Button>
        </div>
      )}

      {/* PAST CLOSED SHIFTS AUDIT HISTORY */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <History className="w-4 h-4 text-accent-primary" />
          <h3 className="text-base font-bold text-text-primary">Past Shift Closings & Z-Reports</h3>
        </div>

        {pastShifts.length === 0 ? (
          <div className="glass rounded-2xl p-8 text-center text-text-muted text-xs">
            No past shift records found for this branch.
          </div>
        ) : (
          <div className="space-y-3">
            {pastShifts.map((shift) => {
              const diff = Number(shift.cash_difference);
              const isBalanced = diff === 0;
              const isPrinting = printingId === shift.id;

              return (
                <div
                  key={shift.id}
                  className="rounded-2xl glass p-4 border border-border flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-white/[0.03] transition-all"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-sm font-bold text-text-primary">
                        {formatCurrency(Number(shift.total_sales))}
                      </span>
                      <span
                        className={cn(
                          'text-[10px] font-bold px-2 py-0.5 rounded-full',
                          isBalanced
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : diff > 0
                            ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                            : 'bg-accent-danger/10 text-accent-danger border border-accent-danger/20'
                        )}
                      >
                        {isBalanced
                          ? 'Balanced'
                          : diff > 0
                          ? `Over (+${formatCurrency(diff)})`
                          : `Short (${formatCurrency(Math.abs(diff))})`}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap text-xs text-text-muted">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        Closed: {formatDate(shift.closed_at || shift.created_at)} at{' '}
                        {formatTime(shift.closed_at || shift.created_at)}
                      </span>
                      <span>&bull;</span>
                      <span>Invoices: {shift.total_invoices}</span>
                      <span>&bull;</span>
                      <span>Cash: {formatCurrency(Number(shift.total_cash))}</span>
                    </div>

                    {/* Staff & Terminal Details */}
                    <div className="flex items-center gap-3 flex-wrap text-[11px] pt-1 border-t border-white/[0.04]">
                      <span className="text-text-secondary flex items-center gap-1">
                        <span className="text-text-muted">Opened by:</span>
                        <strong className="text-text-primary font-semibold">{shift.opened_by_email || 'Staff'}</strong>
                      </span>
                      {shift.closed_by_email && (
                        <span className="text-text-secondary flex items-center gap-1">
                          <span className="text-text-muted">Closed by:</span>
                          <strong className="text-text-primary font-semibold">{shift.closed_by_email}</strong>
                        </span>
                      )}
                      {shift.terminal && (
                        <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded bg-white/5 border border-white/10 text-accent-primary">
                          {shift.terminal.name || shift.terminal.code}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => handlePrintShift(shift, 'download')}
                      disabled={isPrinting}
                      className="text-xs py-1.5 px-3"
                      icon={<Download className="w-3.5 h-3.5" />}
                    >
                      PDF
                    </Button>
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => handlePrintShift(shift, 'print')}
                      loading={isPrinting}
                      disabled={isPrinting}
                      className="text-xs py-1.5 px-3 font-semibold"
                      icon={<Printer className="w-3.5 h-3.5" />}
                    >
                      Print Z-Report
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* OPEN SHIFT MODAL */}
      <Modal
        isOpen={openModalOpen}
        onClose={() => setOpenModalOpen(false)}
        title={`Open New Shift — ${currentBranch.name}`}
      >
        <div className="space-y-4">
          <p className="text-xs text-text-muted">
            Select the assigned POS cashier, workstation terminal, and enter the starting drawer cash float.
          </p>

          {/* Assigned Staff / POS Cashier Selection */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-text-secondary">
              Assigned Cashier / Staff User <span className="text-accent-danger">*</span>
            </label>
            {branchStaffUsers.length > 0 ? (
              <div className="relative">
                <select
                  value={selectedStaffUserId}
                  onChange={(e) => setSelectedStaffUserId(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl text-xs bg-bg-secondary border border-border text-text-primary focus:outline-none focus:border-accent-primary cursor-pointer"
                >
                  {branchStaffUsers.map((staff) => (
                    <option key={staff.user_id} value={staff.user_id} className="bg-bg-secondary text-text-primary">
                      {staff.email} ({staff.role === 'pos' ? 'POS Cashier' : staff.role.toUpperCase()})
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300">
                No active staff assigned to this branch. Please assign staff under Staff Management.
              </div>
            )}
          </div>

          {/* Workstation Terminal Selection */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-text-secondary">
              Workstation Terminal (POS Counters) <span className="text-accent-danger">*</span>
            </label>
            {branchPosTerminals.length > 0 ? (
              <div className="relative">
                <select
                  value={selectedTerminalId}
                  onChange={(e) => setSelectedTerminalId(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl text-xs bg-bg-secondary border border-border text-text-primary focus:outline-none focus:border-accent-primary cursor-pointer"
                >
                  {branchPosTerminals.map((t) => (
                    <option key={t.id} value={t.id} className="bg-bg-secondary text-text-primary">
                      {t.code} — {t.name}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300">
                No POS counter terminals created for this branch. Please add one under Branches &amp; Terminals.
              </div>
            )}
          </div>

          {/* Opening Float Input */}
          <div>
            <label className="block text-xs font-semibold text-text-secondary mb-1.5">
              Opening Cash Float ({currentBranch.code}) <span className="text-accent-danger">*</span>
            </label>
            <Input
              type="number"
              step="0.01"
              min="0"
              value={openingCashInput}
              onChange={(e) => setOpeningCashInput(e.target.value)}
              placeholder="0.00"
              icon={<Banknote className="w-4 h-4" />}
            />
          </div>

          <div className="pt-2 flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setOpenModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleOpenShift}
              loading={submittingOpen}
              icon={<CheckCircle2 className="w-4 h-4" />}
            >
              Start Shift
            </Button>
          </div>
        </div>
      </Modal>

      {/* CLOSE SHIFT MODAL */}
      <Modal
        isOpen={closeModalOpen}
        onClose={() => setCloseModalOpen(false)}
        title={`Close Shift & Reconcile — ${currentBranch.name}`}
      >
        <div className="space-y-4">
          {/* Summary Box */}
          <div className="rounded-2xl bg-white/[0.03] border border-border p-4 space-y-2 text-xs">
            <div className="flex justify-between text-text-muted">
              <span>Opening Float</span>
              <span className="font-mono">{formatCurrency(activeShift ? Number(activeShift.opening_cash) : 0)}</span>
            </div>
            <div className="flex justify-between text-text-muted">
              <span>Cash Sales Collected</span>
              <span className="font-mono text-emerald-400">+{formatCurrency(liveSales.totalCash)}</span>
            </div>
            <div className="flex justify-between text-text-primary font-bold pt-1 border-t border-border">
              <span>Expected Total Cash</span>
              <span className="font-mono">{formatCurrency(expectedDrawerCash)}</span>
            </div>
          </div>

          {/* Actual Cash Input */}
          <div>
            <label className="block text-xs font-semibold text-text-secondary mb-1.5">
              Actual Counted Cash in Drawer
            </label>
            <Input
              type="number"
              step="0.01"
              value={actualCashInput}
              onChange={(e) => setActualCashInput(e.target.value)}
              placeholder="0.00"
              icon={<Banknote className="w-4 h-4" />}
            />
          </div>

          {/* Live Variance Preview */}
          <div
            className={cn(
              'p-3 rounded-xl border flex items-center justify-between text-xs font-semibold',
              liveVariance === 0
                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                : liveVariance > 0
                ? 'bg-blue-500/10 border-blue-500/20 text-blue-400'
                : 'bg-accent-danger/10 border-accent-danger/20 text-accent-danger'
            )}
          >
            <span>Drawer Variance:</span>
            <span className="font-mono">
              {liveVariance === 0
                ? 'Balanced (Rs. 0.00)'
                : liveVariance > 0
                ? `Over (+${formatCurrency(liveVariance)})`
                : `Short (${formatCurrency(Math.abs(liveVariance))})`}
            </span>
          </div>

          {/* Closing Notes */}
          <div>
            <label className="block text-xs font-semibold text-text-secondary mb-1.5">
              Closing Notes / Remarks (Optional)
            </label>
            <textarea
              value={closingNotes}
              onChange={(e) => setClosingNotes(e.target.value)}
              placeholder="e.g. Minor cash discrepancy due to coin rounding..."
              rows={2}
              className="w-full px-3 py-2 rounded-xl text-xs bg-bg-secondary border border-border text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent-primary/50 transition-colors resize-none"
            />
          </div>

          <div className="pt-2 flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setCloseModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={handleCloseShift}
              loading={submittingClose}
              icon={<Lock className="w-4 h-4" />}
            >
              Confirm Close & Print Z-Report
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
