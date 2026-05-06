import Link from 'next/link';
import { UtensilsCrossed, ChefHat, QrCode, Receipt, ArrowRight } from 'lucide-react';
import { RESTAURANT_NAME, RESTAURANT_TAGLINE } from '@/lib/constants';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-bg-primary flex flex-col items-center justify-center p-6">
      {/* Background decorations */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-accent-primary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-accent-secondary/5 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 text-center space-y-8 max-w-2xl">
        {/* Logo */}
        <div className="flex justify-center">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-accent-primary to-accent-secondary flex items-center justify-center shadow-lg shadow-accent-primary/25 animate-scale-in">
            <UtensilsCrossed className="w-8 h-8 text-white" />
          </div>
        </div>

        {/* Title */}
        <div className="space-y-3 animate-slide-up">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight">
            <span className="gradient-text">{RESTAURANT_NAME}</span>
          </h1>
          <p className="text-text-secondary text-lg">{RESTAURANT_TAGLINE}</p>
          <p className="text-text-muted text-sm max-w-md mx-auto">
            Complete restaurant management with real-time kitchen tracking, digital menus, QR ordering, and automated billing.
          </p>
        </div>

        {/* Quick Links */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-lg mx-auto animate-slide-up" style={{ animationDelay: '0.1s' }}>
          <Link
            href="/admin"
            className="group flex items-center gap-3 p-4 rounded-2xl glass glass-hover transition-all duration-300"
          >
            <div className="w-10 h-10 rounded-xl bg-accent-primary/15 flex items-center justify-center group-hover:bg-accent-primary/25 transition-colors">
              <ChefHat className="w-5 h-5 text-accent-primary" />
            </div>
            <div className="text-left flex-1">
              <p className="text-sm font-semibold text-text-primary">Admin Panel</p>
              <p className="text-xs text-text-muted">Manage everything</p>
            </div>
            <ArrowRight className="w-4 h-4 text-text-muted group-hover:text-accent-primary group-hover:translate-x-0.5 transition-all" />
          </Link>

          <Link
            href="/kitchen"
            className="group flex items-center gap-3 p-4 rounded-2xl glass glass-hover transition-all duration-300"
          >
            <div className="w-10 h-10 rounded-xl bg-accent-warning/15 flex items-center justify-center group-hover:bg-accent-warning/25 transition-colors">
              <ChefHat className="w-5 h-5 text-accent-warning" />
            </div>
            <div className="text-left flex-1">
              <p className="text-sm font-semibold text-text-primary">Kitchen View</p>
              <p className="text-xs text-text-muted">Real-time orders</p>
            </div>
            <ArrowRight className="w-4 h-4 text-text-muted group-hover:text-accent-warning group-hover:translate-x-0.5 transition-all" />
          </Link>

          <Link
            href="/admin/tables"
            className="group flex items-center gap-3 p-4 rounded-2xl glass glass-hover transition-all duration-300"
          >
            <div className="w-10 h-10 rounded-xl bg-accent-success/15 flex items-center justify-center group-hover:bg-accent-success/25 transition-colors">
              <QrCode className="w-5 h-5 text-accent-success" />
            </div>
            <div className="text-left flex-1">
              <p className="text-sm font-semibold text-text-primary">Table & QR</p>
              <p className="text-xs text-text-muted">Manage tables</p>
            </div>
            <ArrowRight className="w-4 h-4 text-text-muted group-hover:text-accent-success group-hover:translate-x-0.5 transition-all" />
          </Link>

          <Link
            href="/admin/billing"
            className="group flex items-center gap-3 p-4 rounded-2xl glass glass-hover transition-all duration-300"
          >
            <div className="w-10 h-10 rounded-xl bg-accent-secondary/15 flex items-center justify-center group-hover:bg-accent-secondary/25 transition-colors">
              <Receipt className="w-5 h-5 text-accent-secondary" />
            </div>
            <div className="text-left flex-1">
              <p className="text-sm font-semibold text-text-primary">Billing</p>
              <p className="text-xs text-text-muted">Invoices & checkout</p>
            </div>
            <ArrowRight className="w-4 h-4 text-text-muted group-hover:text-accent-secondary group-hover:translate-x-0.5 transition-all" />
          </Link>
        </div>
      </div>
    </div>
  );
}
