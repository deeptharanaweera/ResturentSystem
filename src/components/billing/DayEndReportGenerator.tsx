'use client';

import { RESTAURANT_NAME, RESTAURANT_TAGLINE, CURRENCY_SYMBOL } from '@/lib/constants';
import { DayEnd } from '@/types/database';

export async function generateDayEndPDF(dayEnd: DayEnd, mode: 'print' | 'download' = 'print') {
  const { jsPDF } = await import('jspdf');

  // Fetch dynamic system settings from DB
  let settings: any = null;
  try {
    const { createClient } = await import('@/lib/supabase/client');
    const supabase = createClient();
    const { data: dbSettings } = await supabase.from('system_settings').select('*').limit(1).maybeSingle();
    if (dbSettings) {
      settings = dbSettings;
    }
  } catch (e) {
    console.warn('Could not fetch system settings for day-end PDF:', e);
  }

  const name = settings?.restaurant_name || RESTAURANT_NAME;
  const tagline = settings?.tagline || RESTAURANT_TAGLINE;
  const address = settings?.address || null;
  const phone = settings?.contact_phone || null;
  const email = settings?.contact_email || null;
  const logoUrl = settings?.logo_url || null;

  // Height estimate
  const totalHeight = 210;
  const doc = new jsPDF({
    unit: 'mm',
    format: [80, totalHeight],
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 5;
  const contentWidth = pageWidth - margin * 2;
  let y = 8;

  // 1. Restaurant Header
  if (logoUrl) {
    try {
      doc.addImage(logoUrl, 'PNG', (pageWidth - 12) / 2, y, 12, 12);
      y += 14;
    } catch (err) {
      // Ignore logo error
    }
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(15, 23, 42);
  doc.text(name.toUpperCase(), pageWidth / 2, y, { align: 'center' });
  y += 4.5;

  if (tagline) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(71, 85, 105);
    doc.text(tagline, pageWidth / 2, y, { align: 'center' });
    y += 4;
  }

  if (address) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.text(address, pageWidth / 2, y, { align: 'center', maxWidth: contentWidth });
    y += 3.8;
  }

  if (phone || email) {
    const contactStr = [phone && `Tel: ${phone}`, email && `Email: ${email}`].filter(Boolean).join(' | ');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(100, 116, 139);
    doc.text(contactStr, pageWidth / 2, y, { align: 'center', maxWidth: contentWidth });
    y += 3.8;
  }

  y += 1;

  // Title: DAY END / Z-REPORT
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(15, 23, 42);
  doc.text('DAY END CLOSING (Z-REPORT)', pageWidth / 2, y, { align: 'center' });
  y += 3.5;

  // Double Line
  doc.setDrawColor(15, 23, 42);
  doc.setLineWidth(0.4);
  doc.line(margin, y, pageWidth - margin, y);
  y += 4.5;

  // 2. Branch & Terminal Information
  doc.setFontSize(7.5);
  doc.setTextColor(30, 41, 59);

  doc.setFont('helvetica', 'bold');
  doc.text('Branch:', margin, y);
  doc.setFont('helvetica', 'normal');
  doc.text(`${dayEnd.branch?.name || 'Main Branch'} (${dayEnd.branch?.code || 'MAIN'})`, margin + 14, y);
  y += 3.8;

  if (dayEnd.terminal) {
    doc.setFont('helvetica', 'bold');
    doc.text('Terminal:', margin, y);
    doc.setFont('helvetica', 'normal');
    doc.text(`${dayEnd.terminal.name} (${dayEnd.terminal.code})`, margin + 14, y);
    y += 3.8;
  }

  // Shift Dates
  const openedStr = new Date(dayEnd.opened_at).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
  const closedStr = dayEnd.closed_at
    ? new Date(dayEnd.closed_at).toLocaleString('en-IN', {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      })
    : 'Active / In Progress';

  doc.setFont('helvetica', 'bold');
  doc.text('Opened:', margin, y);
  doc.setFont('helvetica', 'normal');
  doc.text(openedStr, margin + 14, y);
  y += 3.8;

  doc.setFont('helvetica', 'bold');
  doc.text('Closed:', margin, y);
  doc.setFont('helvetica', 'normal');
  doc.text(closedStr, margin + 14, y);
  y += 4;

  // Separator
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.2);
  doc.line(margin, y, pageWidth - margin, y);
  y += 4.5;

  // 3. Sales Breakdown
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text('SALES SUMMARY', margin, y);
  y += 4;

  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');

  doc.text('Total Invoices:', margin, y);
  doc.text(`${dayEnd.total_invoices}`, pageWidth - margin, y, { align: 'right' });
  y += 3.8;

  doc.text('Total Orders:', margin, y);
  doc.text(`${dayEnd.total_orders}`, pageWidth - margin, y, { align: 'right' });
  y += 3.8;

  doc.text('Cash Sales:', margin, y);
  doc.text(`${CURRENCY_SYMBOL}${Number(dayEnd.total_cash).toFixed(2)}`, pageWidth - margin, y, { align: 'right' });
  y += 3.8;

  doc.text('Card Sales:', margin, y);
  doc.text(`${CURRENCY_SYMBOL}${Number(dayEnd.total_card).toFixed(2)}`, pageWidth - margin, y, { align: 'right' });
  y += 3.8;

  if (Number(dayEnd.total_other) > 0) {
    doc.text('Bank / Other Sales:', margin, y);
    doc.text(`${CURRENCY_SYMBOL}${Number(dayEnd.total_other).toFixed(2)}`, pageWidth - margin, y, { align: 'right' });
    y += 3.8;
  }

  doc.text('Tax Collected:', margin, y);
  doc.text(`${CURRENCY_SYMBOL}${Number(dayEnd.total_tax).toFixed(2)}`, pageWidth - margin, y, { align: 'right' });
  y += 4.2;

  // Gross Sales
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('TOTAL GROSS SALES:', margin, y);
  doc.text(`${CURRENCY_SYMBOL}${Number(dayEnd.total_sales).toFixed(2)}`, pageWidth - margin, y, { align: 'right' });
  y += 5;

  // Separator
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.2);
  doc.line(margin, y, pageWidth - margin, y);
  y += 4.5;

  // 4. Cash Drawer Reconciliation
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text('CASH DRAWER AUDIT', margin, y);
  y += 4;

  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');

  doc.text('Opening Float:', margin, y);
  doc.text(`${CURRENCY_SYMBOL}${Number(dayEnd.opening_cash).toFixed(2)}`, pageWidth - margin, y, { align: 'right' });
  y += 3.8;

  doc.text('Cash Received:', margin, y);
  doc.text(`+ ${CURRENCY_SYMBOL}${Number(dayEnd.total_cash).toFixed(2)}`, pageWidth - margin, y, { align: 'right' });
  y += 3.8;

  const expectedCash = Number(dayEnd.opening_cash) + Number(dayEnd.total_cash);
  doc.text('Expected Drawer Cash:', margin, y);
  doc.text(`${CURRENCY_SYMBOL}${expectedCash.toFixed(2)}`, pageWidth - margin, y, { align: 'right' });
  y += 3.8;

  doc.setFont('helvetica', 'bold');
  doc.text('Actual Counted Cash:', margin, y);
  doc.text(`${CURRENCY_SYMBOL}${Number(dayEnd.actual_cash).toFixed(2)}`, pageWidth - margin, y, { align: 'right' });
  y += 4;

  // Variance
  const diff = Number(dayEnd.cash_difference);
  const diffLabel = diff === 0 ? 'BALANCED' : diff > 0 ? `OVER (+${CURRENCY_SYMBOL}${diff.toFixed(2)})` : `SHORT (${CURRENCY_SYMBOL}${Math.abs(diff).toFixed(2)})`;
  doc.setFontSize(8.5);
  doc.text('CASH VARIANCE:', margin, y);
  doc.text(diffLabel, pageWidth - margin, y, { align: 'right' });
  y += 5.5;

  // Notes
  if (dayEnd.notes) {
    doc.setFontSize(7);
    doc.setFont('helvetica', 'italic');
    doc.text(`Notes: ${dayEnd.notes}`, margin, y, { maxWidth: pageWidth - margin * 2 });
    y += 6;
  }

  // 5. Signature Lines
  y += 2;
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.2);
  doc.line(margin, y, pageWidth - margin, y);
  y += 7;

  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.text('Cashier Signature: ___________________', margin, y);
  y += 6;
  doc.text('Manager Signature: ___________________', margin, y);
  y += 6;

  // Footer
  doc.setFontSize(6.5);
  doc.setTextColor(148, 163, 184);
  doc.text(`Generated on ${new Date().toLocaleString('en-IN')}`, pageWidth / 2, y, { align: 'center' });

  if (mode === 'print') {
    doc.autoPrint();
    window.open(doc.output('bloburl'), '_blank');
  } else {
    doc.save(`day_end_${dayEnd.branch?.code || 'BRANCH'}_${dayEnd.id.slice(0, 6)}.pdf`);
  }
}
