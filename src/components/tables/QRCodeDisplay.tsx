'use client';

import React from 'react';
import QRCode from 'react-qr-code';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import { Download } from 'lucide-react';
import { RESTAURANT_NAME } from '@/lib/constants';

interface QRCodeDisplayProps {
  isOpen: boolean;
  onClose: () => void;
  tableNumber: number;
  tableId: string;
  appUrl: string;
}

export default function QRCodeDisplay({ isOpen, onClose, tableNumber, tableId, appUrl }: QRCodeDisplayProps) {
  const menuUrl = `${appUrl}/menu/${tableId}`;

  const handleDownload = () => {
    const svg = document.getElementById('qr-code-svg');
    if (!svg) return;

    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();

    img.onload = () => {
      canvas.width = 400;
      canvas.height = 500;
      if (ctx) {
        // White background
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Draw QR code centered
        ctx.drawImage(img, 50, 30, 300, 300);

        // Add text
        ctx.fillStyle = '#1a1a2e';
        ctx.font = 'bold 24px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(RESTAURANT_NAME, 200, 370);

        ctx.font = '16px Arial';
        ctx.fillStyle = '#64748b';
        ctx.fillText(`Table ${tableNumber}`, 200, 400);

        ctx.font = '11px Arial';
        ctx.fillStyle = '#94a3b8';
        ctx.fillText('Scan to view menu & order', 200, 430);

        // Download
        const link = document.createElement('a');
        link.download = `table-${tableNumber}-qr.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
      }
    };

    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`QR Code — Table ${tableNumber}`} size="sm">
      <div className="flex flex-col items-center gap-5">
        <div className="bg-white p-5 rounded-2xl">
          <QRCode id="qr-code-svg" value={menuUrl} size={200} level="H" />
        </div>

        <div className="text-center space-y-1">
          <p className="text-sm text-text-secondary">Scan to open menu for</p>
          <p className="text-lg font-bold text-text-primary">Table {tableNumber}</p>
          <p className="text-xs text-text-muted break-all">{menuUrl}</p>
        </div>

        <Button variant="secondary" size="md" onClick={handleDownload} icon={<Download className="w-4 h-4" />}>
          Download QR Code
        </Button>
      </div>
    </Modal>
  );
}
