'use client';

import React from 'react';
import { TAX_RATE, RESTAURANT_NAME, RESTAURANT_TAGLINE, CURRENCY_SYMBOL } from '@/lib/constants';

interface InvoiceItem {
  name: string;
  quantity: number;
  unit_price: number;
}

interface InvoiceData {
  invoiceNumber: number;
  orderId: string;
  tableNumber: number;
  items: InvoiceItem[];
  subtotal: number;
  taxAmount: number;
  grandTotal: number;
  issuedAt: string;
  mode?: 'download' | 'print';
}

export async function generateInvoicePDF(data: InvoiceData) {
  const { jsPDF } = await import('jspdf');
  const { default: autoTable } = await import('jspdf-autotable');

  // Estimate height: Header (35) + Details (30) + Table (items * 7 + 10) + Totals (30) + Footer (20)
  const estimatedHeight = 35 + 30 + (data.items.length * 7 + 10) + 30 + 20;
  
  // Standard POS width is 80mm
  const doc = new jsPDF({ 
    unit: 'mm', 
    format: [80, Math.max(150, estimatedHeight)] 
  });
  
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 5;

  // Restaurant name (No heavy graphics for thermal printers)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(0, 0, 0);
  doc.text(RESTAURANT_NAME, pageWidth / 2, 10, { align: 'center' });

  // Tagline
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text(RESTAURANT_TAGLINE, pageWidth / 2, 15, { align: 'center' });

  // Invoice label
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('TAX INVOICE', pageWidth / 2, 22, { align: 'center' });

  // Divider
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.1);
  doc.line(margin, 25, pageWidth - margin, 25);

  // Invoice details
  doc.setFontSize(8);
  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'normal');
  
  const detailsY = 30;
  doc.text(`Inv: #${data.invoiceNumber}`, margin, detailsY);
  doc.text(`Date: ${new Date(data.issuedAt).toLocaleDateString()}`, pageWidth - margin, detailsY, { align: 'right' });
  doc.text(`Table: ${data.tableNumber}`, margin, detailsY + 5);
  doc.text(`Time: ${new Date(data.issuedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`, pageWidth - margin, detailsY + 5, { align: 'right' });

  const orderDisplay = data.orderId.startsWith('GROUP') 
    ? data.orderId 
    : `#${data.orderId.slice(0, 8).toUpperCase()}`;
  doc.text(`Order: ${orderDisplay}`, margin, detailsY + 10);

  // Items table
  const tableData = data.items.map(item => [
    item.name,
    item.quantity.toString(),
    `${item.unit_price.toFixed(0)}`,
    `${(item.quantity * item.unit_price).toFixed(0)}`
  ]);

  autoTable(doc, {
    startY: detailsY + 15,
    head: [['Item', 'Qty', 'Prc', 'Amt']],
    body: tableData,
    theme: 'plain',
    styles: {
      fontSize: 8,
      cellPadding: 1,
      textColor: [0, 0, 0],
    },
    headStyles: {
      fontStyle: 'bold',
      textColor: [0, 0, 0],
      borderBottom: { width: 0.1, color: [0, 0, 0] },
    },
    columnStyles: {
      0: { cellWidth: 'auto' },
      1: { halign: 'center', cellWidth: 8 },
      2: { halign: 'right', cellWidth: 12 },
      3: { halign: 'right', cellWidth: 15 },
    },
    margin: { left: margin, right: margin },
  });

  // Totals
  const finalY = (doc as any).lastAutoTable.finalY + 5;
  
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.1);
  doc.line(margin, finalY, pageWidth - margin, finalY);

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text('Subtotal:', margin, finalY + 5);
  doc.text(`${CURRENCY_SYMBOL}${data.subtotal.toFixed(2)}`, pageWidth - margin, finalY + 5, { align: 'right' });

  doc.text(`Tax (${(TAX_RATE * 100).toFixed(0)}%):`, margin, finalY + 9);
  doc.text(`${CURRENCY_SYMBOL}${data.taxAmount.toFixed(2)}`, pageWidth - margin, finalY + 9, { align: 'right' });

  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('Grand Total:', margin, finalY + 15);
  doc.text(`${CURRENCY_SYMBOL}${data.grandTotal.toFixed(2)}`, pageWidth - margin, finalY + 15, { align: 'right' });

  // Divider before footer
  doc.setDrawColor(200, 200, 200);
  doc.line(margin, finalY + 20, pageWidth - margin, finalY + 20);

  // Footer
  const footerY = finalY + 25;
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text('Thank you! Come again.', pageWidth / 2, footerY, { align: 'center' });
  doc.text('Powered by Savoria', pageWidth / 2, footerY + 5, { align: 'center' });
  
  if (data.mode === 'print') {
    doc.autoPrint();
    window.open(doc.output('bloburl'), '_blank');
  } else {
    doc.save(`receipt_${data.invoiceNumber}.pdf`);
  }
}
