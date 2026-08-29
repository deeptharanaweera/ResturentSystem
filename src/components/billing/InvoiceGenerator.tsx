'use client';

import { TAX_RATE, RESTAURANT_NAME, RESTAURANT_TAGLINE, CURRENCY_SYMBOL, PAYMENT_METHODS } from '@/lib/constants';
import { PaymentMethod } from '@/types/database';

export interface InvoiceItem {
  name: string;
  quantity: number;
  unit_price: number;
}

export interface InvoicePaymentInfo {
  method: PaymentMethod | string;
  amount: number;
}

export interface InvoiceData {
  invoiceNumber: number;
  orderNumbers: string[];
  tableNumbers?: (number | null | undefined)[];
  tableNumber?: number | null;
  customerName?: string | null;
  orderTypeSummary?: string; // e.g. "Dine In (Table 2)" or "2 Dine In, 1 Take Away"
  orderTypeCounts?: { dine_in?: number; takeaway?: number; counter?: number };
  items: InvoiceItem[];
  subtotal: number;
  taxAmount: number;
  grandTotal: number;
  payments?: InvoicePaymentInfo[];
  issuedAt: string;
  mode?: 'download' | 'print';
}

export async function generateInvoicePDF(data: InvoiceData) {
  const { jsPDF } = await import('jspdf');
  const { default: autoTable } = await import('jspdf-autotable');

  // Dynamic height calculation
  const baseHeight = 90;
  const itemsHeight = data.items.length * 6.5;
  const paymentsHeight = (data.payments?.length || 0) * 5;
  const orderNumsHeight = Math.ceil(data.orderNumbers.length / 2) * 4.5;
  const totalHeight = Math.max(140, baseHeight + itemsHeight + paymentsHeight + orderNumsHeight);

  // Standard POS 80mm roll width
  const doc = new jsPDF({
    unit: 'mm',
    format: [80, totalHeight],
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 5;
  const contentWidth = pageWidth - margin * 2;

  let y = 8;

  // --- 1. RESTAURANT HEADER ---
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(15, 23, 42); // slate-900
  doc.text(RESTAURANT_NAME.toUpperCase(), pageWidth / 2, y, { align: 'center' });
  y += 4.5;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105); // slate-600
  doc.text(RESTAURANT_TAGLINE, pageWidth / 2, y, { align: 'center' });
  y += 5;

  // Tax Invoice Badge
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);
  doc.text('TAX INVOICE / RECEIPT', pageWidth / 2, y, { align: 'center' });
  y += 3.5;

  // Double line separator
  doc.setDrawColor(30, 41, 59);
  doc.setLineWidth(0.3);
  doc.line(margin, y, pageWidth - margin, y);
  y += 4;

  // --- 2. INVOICE & ORDER METADATA ---
  doc.setFontSize(7.5);
  doc.setTextColor(30, 41, 59);

  // Row 1: Invoice # & Date
  doc.setFont('helvetica', 'bold');
  doc.text(`INV #${data.invoiceNumber}`, margin, y);
  doc.setFont('helvetica', 'normal');
  const dateStr = new Date(data.issuedAt).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
  doc.text(dateStr, pageWidth - margin, y, { align: 'right' });
  y += 4;

  // Row 2: Table / Destination & Time
  const timeStr = new Date(data.issuedAt).toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });

  const validTables = (data.tableNumbers || [data.tableNumber]).filter((t): t is number => typeof t === 'number' && t > 0);
  const tableDisplay = validTables.length > 1
    ? `Tables: ${validTables.join(', ')}`
    : validTables.length === 1
      ? `Table: ${validTables[0]}`
      : 'Counter / Takeaway';

  doc.setFont('helvetica', 'bold');
  doc.text(tableDisplay, margin, y);
  doc.setFont('helvetica', 'normal');
  doc.text(timeStr, pageWidth - margin, y, { align: 'right' });
  y += 4;

  // Row 3: Order Numbers
  const formattedOrderNums = data.orderNumbers.length > 0
    ? data.orderNumbers.join(', ')
    : 'N/A';
  doc.setFont('helvetica', 'bold');
  doc.text('Order(s):', margin, y);
  doc.setFont('helvetica', 'normal');
  doc.text(formattedOrderNums, margin + 14, y, { maxWidth: contentWidth - 14 });
  y += Math.max(4, Math.ceil(formattedOrderNums.length / 28) * 3.8);

  // Row 4: Order Types & Customer Name (if available)
  if (data.orderTypeSummary || data.customerName) {
    if (data.orderTypeSummary) {
      doc.setFont('helvetica', 'bold');
      doc.text('Type:', margin, y);
      doc.setFont('helvetica', 'normal');
      doc.text(data.orderTypeSummary, margin + 10, y);
      y += 3.8;
    }
    if (data.customerName) {
      doc.setFont('helvetica', 'bold');
      doc.text('Customer:', margin, y);
      doc.setFont('helvetica', 'normal');
      doc.text(data.customerName, margin + 14, y);
      y += 3.8;
    }
  }

  // --- 3. ITEMS TABLE ---
  const tableData = data.items.map((item) => [
    item.name,
    item.quantity.toString(),
    `${item.unit_price.toFixed(0)}`,
    `${(item.quantity * item.unit_price).toFixed(2)}`,
  ]);

  autoTable(doc, {
    startY: y,
    head: [['Item', 'Qty', 'Price', 'Amount']],
    body: tableData,
    theme: 'plain',
    styles: {
      fontSize: 7.5,
      cellPadding: 1,
      textColor: [15, 23, 42],
    },
    headStyles: {
      fontStyle: 'bold',
      textColor: [15, 23, 42],
      fillColor: [241, 245, 249], // slate-100
      lineWidth: 0.1,
      lineColor: [203, 213, 225],
    },
    columnStyles: {
      0: { cellWidth: 'auto' },
      1: { halign: 'center', cellWidth: 8 },
      2: { halign: 'right', cellWidth: 13 },
      3: { halign: 'right', cellWidth: 17 },
    },
    margin: { left: margin, right: margin },
  });

  let currentY = (doc as any).lastAutoTable.finalY + 3;

  // Dashed separator
  doc.setDrawColor(148, 163, 184);
  doc.setLineWidth(0.2);
  doc.setLineDashPattern([1, 1], 0);
  doc.line(margin, currentY, pageWidth - margin, currentY);
  doc.setLineDashPattern([], 0); // reset
  currentY += 4;

  // --- 4. TOTALS SECTION ---
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(51, 65, 85);

  doc.text('Subtotal:', margin, currentY);
  doc.text(`${CURRENCY_SYMBOL}${data.subtotal.toFixed(2)}`, pageWidth - margin, currentY, { align: 'right' });
  currentY += 3.8;

  if (data.taxAmount > 0 || TAX_RATE > 0) {
    doc.text(`Tax (${(TAX_RATE * 100).toFixed(0)}%):`, margin, currentY);
    doc.text(`${CURRENCY_SYMBOL}${data.taxAmount.toFixed(2)}`, pageWidth - margin, currentY, { align: 'right' });
    currentY += 3.8;
  }

  // Solid line for Grand Total
  doc.setDrawColor(15, 23, 42);
  doc.setLineWidth(0.3);
  doc.line(margin, currentY, pageWidth - margin, currentY);
  currentY += 4.5;

  doc.setFontSize(10.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text('GRAND TOTAL:', margin, currentY);
  doc.text(`${CURRENCY_SYMBOL}${data.grandTotal.toFixed(2)}`, pageWidth - margin, currentY, { align: 'right' });
  currentY += 5;

  // --- 5. PAYMENT METHODS BREAKDOWN ---
  if (data.payments && data.payments.length > 0) {
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.2);
    doc.line(margin, currentY, pageWidth - margin, currentY);
    currentY += 3.5;

    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(71, 85, 105);
    doc.text('PAYMENT BREAKDOWN:', margin, currentY);
    currentY += 3.2;

    doc.setFont('helvetica', 'normal');
    data.payments.forEach((p) => {
      const methodLabel = PAYMENT_METHODS[p.method as PaymentMethod]?.label || p.method.toUpperCase();
      doc.text(`• ${methodLabel}`, margin + 2, currentY);
      doc.text(`${CURRENCY_SYMBOL}${p.amount.toFixed(2)}`, pageWidth - margin, currentY, { align: 'right' });
      currentY += 3.2;
    });
  }

  // --- 6. FOOTER ---
  currentY += 3;
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.2);
  doc.line(margin, currentY, pageWidth - margin, currentY);
  currentY += 4.5;

  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text('Thank you for dining with us!', pageWidth / 2, currentY, { align: 'center' });
  currentY += 3.5;

  doc.setFontSize(6.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text('Please retain this receipt for your reference', pageWidth / 2, currentY, { align: 'center' });
  currentY += 3;
  doc.text(`Powered by ${RESTAURANT_NAME} POS`, pageWidth / 2, currentY, { align: 'center' });

  // Output
  if (data.mode === 'print') {
    doc.autoPrint();
    window.open(doc.output('bloburl'), '_blank');
  } else {
    doc.save(`receipt_INV_${data.invoiceNumber}.pdf`);
  }
}
