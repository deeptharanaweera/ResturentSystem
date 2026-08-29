import { PaymentMethod, OrderType } from '@/types/database';

export const TAX_RATE = 0; // 5% tax

export const ORDER_STATUS = {
  PENDING: 'pending',
  PREPARING: 'preparing',
  SERVED: 'served',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
} as const;

export const PAYMENT_STATUS = {
  UNPAID: 'unpaid',
  PAID: 'paid',
} as const;

export const ORDER_STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  preparing: 'Preparing',
  served: 'Served',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

export const ORDER_STATUS_COLORS: Record<string, string> = {
  pending: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  preparing: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  served: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  completed: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
  cancelled: 'bg-red-500/20 text-red-400 border-red-500/30',
};

export const PAYMENT_METHODS: Record<PaymentMethod, { label: string; color: string }> = {
  cash: { label: 'Cash', color: 'text-emerald-400' },
  card: { label: 'Card', color: 'text-blue-400' },
  bank_transfer: { label: 'Bank Transfer', color: 'text-purple-400' },
  other: { label: 'Other', color: 'text-amber-400' },
};

export const ORDER_TYPES: Record<OrderType, { label: string; color: string }> = {
  dine_in: { label: 'Dine In', color: 'text-accent-primary' },
  takeaway: { label: 'Take Away', color: 'text-amber-400' },
  counter: { label: 'Counter', color: 'text-emerald-400' },
};

export const RESTAURANT_NAME = 'Savoria';
export const RESTAURANT_TAGLINE = 'Fine Dining Experience';
export const CURRENCY_SYMBOL = 'Rs. ';
