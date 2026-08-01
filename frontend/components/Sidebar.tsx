'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  LayoutDashboard, 
  Users, 
  Package, 
  ShoppingBag, 
  ShoppingCart, 
  CreditCard, 
  Receipt, 
  BarChart3, 
  Building2, 
  ShieldCheck, 
  LogOut 
} from 'lucide-react';
import { useAuthStore } from '@/lib/auth-store';

export default function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuthStore();

  const navItems = [
    { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { name: 'Parties Directory', href: '/parties', icon: Users },
    { name: 'Product Catalog', href: '/products', icon: Package },
    { name: 'Purchase Bills', href: '/purchases', icon: ShoppingBag },
    { name: 'Sales & POS', href: '/sales', icon: ShoppingCart },
    { name: 'Payments & Receipts', href: '/payments', icon: CreditCard },
    { name: 'Expenses', href: '/expenses', icon: Receipt },
    { name: 'Financial Reports', href: '/reports', icon: BarChart3 },
  ];

  const roleName = user?.role?.name || (user?.role_id === 1 ? 'ADMIN' : 'BUSINESS_OWNER');

  return (
    <aside className="w-64 glass-panel border-r border-slate-800/80 min-h-screen flex flex-col justify-between p-4 sticky top-0 h-screen z-30">
      <div>
        {/* Brand Header */}
        <div className="flex items-center gap-3 px-3 py-4 mb-6 border-b border-slate-800/60">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-emerald-400 flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <Building2 className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="font-bold text-xl tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
              Vyapar<span className="text-emerald-400 font-extrabold">One</span>
            </h1>
            <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-400">ERP & Trading</span>
          </div>
        </div>

        {/* Navigation Links */}
        <nav className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;

            return (
              <Link
                key={item.name}
                href={item.href}
                className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                  isActive
                    ? 'bg-gradient-to-r from-indigo-600/90 to-indigo-700/80 text-white shadow-md shadow-indigo-600/20 border border-indigo-500/30'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                }`}
              >
                <Icon className={`h-4 w-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                {item.name}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* User Info & Logout */}
      <div className="pt-4 border-t border-slate-800/60 space-y-3">
        <div className="glass-card p-3 rounded-xl flex items-center gap-3">
          <div className="h-9 w-9 rounded-full bg-slate-800 border border-indigo-500/30 flex items-center justify-center font-bold text-indigo-400 text-sm">
            {user?.full_name?.charAt(0) || 'A'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-white truncate">{user?.full_name || 'System Admin'}</p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <ShieldCheck className="h-3 w-3 text-emerald-400" />
              <span className="text-[10px] font-bold tracking-wider px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 uppercase">
                {roleName}
              </span>
            </div>
          </div>
        </div>

        <button
          onClick={logout}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-semibold text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 rounded-xl border border-rose-500/20 transition-colors"
        >
          <LogOut className="h-3.5 w-3.5" />
          Sign Out
        </button>
      </div>
    </aside>
  );
}
