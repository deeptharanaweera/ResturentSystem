import Link from 'next/link';
import {
  UtensilsCrossed,
  ArrowRight,
  ShieldCheck,
  Sparkles,
  LogIn,
  Store,
  Tv,
  ChefHat,
  ShoppingCart,
  QrCode,
  Receipt,
} from 'lucide-react';
import { RESTAURANT_NAME, RESTAURANT_TAGLINE } from '@/lib/constants';

export default function HomePage() {
  const features = [
    {
      icon: ShoppingCart,
      title: 'Smart Point of Sale',
      desc: 'Blazing fast order entry, multi-terminal cashier floats, and instant invoice printing.',
      badge: 'POS Station',
      gradient: 'from-accent-primary/20 to-purple-500/10',
      border: 'border-accent-primary/30',
      iconColor: 'text-accent-primary',
    },
    {
      icon: ChefHat,
      title: 'Kitchen Display System',
      desc: 'Real-time kitchen order tracking, course prioritization, and instant preparation statuses.',
      badge: 'KDS Live',
      gradient: 'from-amber-500/20 to-orange-500/10',
      border: 'border-amber-500/30',
      iconColor: 'text-amber-400',
    },
    {
      icon: Tv,
      title: 'Customer Order Board',
      desc: 'Full-screen TV display keeping diners updated with real-time order readiness & pickup numbers.',
      badge: 'TV Screen',
      gradient: 'from-emerald-500/20 to-teal-500/10',
      border: 'border-emerald-500/30',
      iconColor: 'text-emerald-400',
    },
    {
      icon: Store,
      title: 'Multi-Branch & Terminals',
      desc: 'Manage unlimited restaurant outlets, assigned terminals, and branch-specific staff privileges.',
      badge: 'Multi-Location',
      gradient: 'from-cyan-500/20 to-blue-500/10',
      border: 'border-cyan-500/30',
      iconColor: 'text-cyan-400',
    },
    {
      icon: Receipt,
      title: 'Day-End Reconciliation',
      desc: 'Automated shift closures, drawer cash balancing (Over/Short audits), and 80mm Z-Reports.',
      badge: 'Shift Audit',
      gradient: 'from-fuchsia-500/20 to-pink-500/10',
      border: 'border-fuchsia-500/30',
      iconColor: 'text-fuchsia-400',
    },
    {
      icon: QrCode,
      title: 'Digital QR Table Ordering',
      desc: 'Seamless self-service mobile ordering directly from guest dining tables.',
      badge: 'QR Menu',
      gradient: 'from-indigo-500/20 to-violet-500/10',
      border: 'border-indigo-500/30',
      iconColor: 'text-indigo-400',
    },
  ];

  return (
    <div className="min-h-screen bg-bg-primary text-text-primary flex flex-col justify-between selection:bg-accent-primary/30 relative overflow-hidden">
      {/* Dynamic ambient backdrop lights */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none -z-10">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-accent-primary/10 rounded-full blur-[120px]" />
        <div className="absolute top-1/3 -left-40 w-[500px] h-[500px] bg-cyan-500/10 rounded-full blur-[140px]" />
        <div className="absolute bottom-10 right-10 w-[600px] h-[600px] bg-fuchsia-500/10 rounded-full blur-[150px]" />
      </div>

      {/* Top Navigation Bar */}
      <header className="w-full max-w-7xl mx-auto px-6 py-6 flex items-center justify-between z-20">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-accent-primary to-accent-secondary flex items-center justify-center shadow-lg shadow-accent-primary/25 border border-white/10">
            <UtensilsCrossed className="w-5 h-5 text-white" />
          </div>
          <div>
            <span className="text-base font-black tracking-tight gradient-text">{RESTAURANT_NAME}</span>
            <span className="block text-[10px] text-text-muted font-semibold tracking-wider uppercase">
              Management Suite
            </span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            <span className="w-2 h-2 rounded-full bg-emerald-400 -ml-4" />
            <span>Systems Online</span>
          </div>

          <Link
            href="/login"
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-white/[0.05] border border-white/10 text-text-primary hover:bg-white/[0.1] hover:border-accent-primary/50 transition-all cursor-pointer shadow-sm"
          >
            <LogIn className="w-4 h-4 text-accent-primary" />
            <span>Staff Login</span>
          </Link>
        </div>
      </header>

      {/* Main Hero Section */}
      <main className="w-full max-w-6xl mx-auto px-6 py-12 space-y-16 flex-1 flex flex-col justify-center z-10">
        {/* Hero Headline */}
        <div className="text-center space-y-6 max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/[0.04] border border-white/10 text-text-muted text-xs font-medium backdrop-blur-xl shadow-inner">
            <Sparkles className="w-3.5 h-3.5 text-accent-primary" />
            <span className="text-text-secondary font-semibold">Enterprise Restaurant &amp; Operations ERP</span>
          </div>

          <h1 className="text-4xl sm:text-6xl md:text-7xl font-black tracking-tight leading-[1.1]">
            Transforming Modern <br />
            <span className="gradient-text">Restaurant Dining</span>
          </h1>

          <p className="text-sm sm:text-base md:text-lg text-text-muted max-w-2xl mx-auto leading-relaxed">
            The complete operating system engineered for fast-paced restaurants. Seamlessly connect your front-of-house
            POS, kitchen displays, live customer queue boards, multi-branch operations, and automated daily audits.
          </p>

          {/* Primary CTA Button */}
          <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/login"
              className="group relative inline-flex items-center justify-center gap-3 px-9 py-4 rounded-2xl bg-gradient-to-r from-accent-primary via-fuchsia-600 to-accent-secondary text-white font-bold text-base shadow-xl shadow-accent-primary/30 hover:shadow-accent-primary/50 hover:scale-[1.02] active:scale-[0.98] transition-all duration-300 cursor-pointer w-full sm:w-auto"
            >
              <LogIn className="w-5 h-5" />
              <span>Enter Staff Portal</span>
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1.5 transition-transform" />
            </Link>
          </div>
        </div>

        {/* System Capabilities Bento Grid */}
        <div className="space-y-6">
          <div className="text-center space-y-1">
            <h2 className="text-lg font-bold tracking-tight text-text-primary">
              Unified Operating Ecosystem
            </h2>
            <p className="text-xs text-text-muted">
              Everything required to run a high-volume food &amp; beverage business
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {features.map((f, i) => {
              const Icon = f.icon;
              return (
                <div
                  key={i}
                  className={`rounded-3xl p-6 glass border ${f.border} bg-gradient-to-br ${f.gradient} space-y-4 hover:border-white/30 transition-all duration-300 hover:translate-y-[-2px] shadow-lg`}
                >
                  <div className="flex items-center justify-between">
                    <div className={`w-11 h-11 rounded-2xl bg-white/10 flex items-center justify-center ${f.iconColor}`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-text-muted">
                      {f.badge}
                    </span>
                  </div>

                  <div className="space-y-1.5">
                    <h3 className="text-base font-bold text-text-primary">{f.title}</h3>
                    <p className="text-xs text-text-muted leading-relaxed">{f.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full max-w-7xl mx-auto px-6 py-8 border-t border-white/[0.06] flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-text-muted z-20">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span>Role-Based Protected • Bank-Grade Security</span>
        </div>
        <p className="text-center sm:text-right">
          &copy; {new Date().getFullYear()} {RESTAURANT_NAME} Management System. All rights reserved.
        </p>
      </footer>
    </div>
  );
}
