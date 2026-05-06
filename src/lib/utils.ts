import { CURRENCY_SYMBOL } from './constants';

export function cn(...classes: (string | boolean | undefined | null)[]): string {
  return classes.filter(Boolean).join(' ');
}

export function formatCurrency(amount: number | undefined | null): string {
  const val = typeof amount === 'number' ? amount : 0;
  return `${CURRENCY_SYMBOL}${val.toFixed(2)}`;
}

export function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-IN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatTime(dateString: string): string {
  return new Date(dateString).toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function getTimeAgo(dateString: string): string {
  const now = new Date();
  const date = new Date(dateString);
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${Math.floor(diffHours / 24)}d ago`;
}

export function generateOrderNumber(id: string): string {
  return `#${id.slice(0, 8).toUpperCase()}`;
}
