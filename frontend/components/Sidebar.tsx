'use client';

import { useEffect } from 'react';
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
  LogOut,
  ChevronLeft,
  ChevronRight,
  X
} from 'lucide-react';
import { useAuthStore } from '@/lib/auth-store';
import { useSidebarStore } from '@/lib/sidebar-store';
import { cn } from '@/lib/utils';

export default function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuthStore();
  const { isMobileOpen, closeMobile, isCollapsed, toggleCollapse, setCollapsed } = useSidebarStore();

  // Auto collapse on tablet (768px - 1023px) on initial mount or resize
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768 && window.innerWidth < 1024) {
        setCollapsed(true);
      } else if (window.innerWidth >= 1024) {
        setCollapsed(false);
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [setCollapsed]);

  // Auto close mobile drawer on route navigation
  useEffect(() => {
    closeMobile();
  }, [pathname, closeMobile]);

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
    <>
      {/* ── Mobile Backdrop Overlay ─────────────────────────────────────── */}
      {isMobileOpen && (
        <div
          onClick={closeMobile}
          className="md:hidden fixed inset-0 z-40 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-200"
          aria-hidden="true"
        />
      )}

      {/* ── Mobile Off-Canvas Drawer (< 768px) ─────────────────────────── */}
      <aside
        className={cn(
          'md:hidden fixed top-0 left-0 bottom-0 w-72 bg-white z-50 shadow-2xl flex flex-col justify-between p-4 transition-transform duration-300 ease-in-out',
          isMobileOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div>
          {/* Mobile Header with Close Button */}
          <div className="flex items-center justify-between px-3 py-3 mb-5 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-emerald-500 flex items-center justify-center shadow-lg shadow-indigo-500/20">
                <Building2 className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="font-bold text-lg tracking-tight text-slate-900">
                  Vyapar<span className="text-emerald-600 font-extrabold">One</span>
                </h1>
                <span className="text-[10px] uppercase tracking-wider font-bold text-slate-400">ERP &amp; Trading</span>
              </div>
            </div>
            <button
              onClick={closeMobile}
              className="p-2 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-100 transition-colors"
              aria-label="Close Sidebar"
            >
              <X className="h-5 w-5" />
            </button>
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
                  onClick={closeMobile}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold transition-all duration-150',
                    isActive
                      ? 'bg-indigo-50 text-indigo-900 border-l-[3px] border-indigo-600 shadow-2xs font-semibold'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80 border-l-[3px] border-transparent'
                  )}
                >
                  <Icon className={cn('h-4.5 w-4.5 shrink-0', isActive ? 'text-indigo-600' : 'text-slate-500')} />
                  <span>{item.name}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* User / Bottom info */}
        <div className="p-4 border-t border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center font-bold text-slate-700 text-xs">
              {user?.full_name?.charAt(0) || 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-bold text-slate-900 truncate">{user?.full_name || 'Admin User'}</div>
              <div className="text-[10px] font-medium text-slate-500 truncate">{user?.email || 'admin@vyaparone.com'}</div>
            </div>
            <button
              onClick={logout}
              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
              title="Sign Out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* ── DESKTOP & TABLET PERSISTENT SIDEBAR (>= 768px) ────────────────────────── */}
      <aside
        className={cn(
          'hidden md:flex flex-col bg-white border-r border-slate-200 transition-all duration-300 z-30 sticky top-0 h-screen select-none shrink-0',
          isCollapsed ? 'w-16' : 'w-64'
        )}
      >
        {/* Brand Header */}
        <div className={cn('p-4 border-b border-slate-100 flex items-center', isCollapsed ? 'justify-center' : 'justify-between')}>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-emerald-500 flex items-center justify-center shadow-lg shadow-indigo-500/20 shrink-0">
              <Building2 className="h-5 w-5 text-white" />
            </div>
            {!isCollapsed && (
              <div>
                <h1 className="font-extrabold text-base tracking-tight text-slate-900">VyaparOne</h1>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Enterprise ERP</p>
              </div>
            )}
          </div>

          {/* Expand/Collapse Toggle Button (Visible only on Desktop >= 1024px) */}
          {!isCollapsed && (
            <button
              onClick={toggleCollapse}
              className="hidden lg:flex p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
              title="Collapse sidebar"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Collapsed Expand Toggle for Tablet/Desktop */}
        {isCollapsed && (
          <div className="p-2 border-b border-slate-100 flex justify-center">
            <button
              onClick={toggleCollapse}
              className="p-2 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
              title="Expand sidebar"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Navigation Items */}
        <div className="flex-1 px-3 py-4 overflow-y-auto">
          {!isCollapsed && (
            <div className="px-3 mb-2 text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
              Core Modules
            </div>
          )}
          <nav className="space-y-1.5">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;

              return (
                <div key={item.name} className="relative group">
                  <Link
                    href={item.href}
                    className={cn(
                      'flex items-center rounded-lg text-sm font-semibold transition-all duration-150',
                      isCollapsed ? 'justify-center p-3' : 'gap-3 px-3 py-2',
                      isActive
                        ? 'bg-indigo-50 text-indigo-900 border-l-[3px] border-indigo-600 shadow-2xs font-semibold'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80 border-l-[3px] border-transparent'
                    )}
                  >
                    <Icon className={cn('h-4.5 w-4.5 shrink-0', isActive ? 'text-indigo-600' : 'text-slate-500')} />
                    {!isCollapsed && <span className="truncate">{item.name}</span>}
                  </Link>

                  {/* Tooltip on Hover (Shown only in Collapsed Mode) */}
                  {isCollapsed && (
                    <span className="absolute left-full ml-3.5 top-1/2 -translate-y-1/2 px-3 py-1.5 bg-slate-900 text-white text-xs font-bold rounded-lg shadow-xl whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-all duration-150 z-50">
                      {item.name}
                    </span>
                  )}
                </div>
              );
            })}
          </nav>
        </div>

        {/* User Info & Logout */}
        <div className="pt-4 border-t border-slate-100 space-y-3">
          {isCollapsed ? (
            <div className="flex flex-col items-center gap-2">
              <div
                className="h-10 w-10 rounded-full bg-indigo-100 border border-indigo-200 flex items-center justify-center font-bold text-indigo-700 text-sm shadow-2xs cursor-default"
                title={`${user?.full_name || 'Admin'} (${roleName})`}
              >
                {user?.full_name?.charAt(0) || 'A'}
              </div>
              <button
                onClick={logout}
                className="p-2.5 text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-xl border border-rose-200 transition-colors"
                title="Sign Out"
                aria-label="Sign Out"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <>
              <div className="bg-slate-50 border border-slate-200 p-3 rounded-xl flex items-center gap-3">
                <div className="h-9 w-9 rounded-full bg-indigo-100 border border-indigo-200 flex items-center justify-center font-bold text-indigo-700 text-sm shrink-0">
                  {user?.full_name?.charAt(0) || 'A'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-slate-900 truncate">{user?.full_name || 'System Admin'}</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <ShieldCheck className="h-3 w-3 text-emerald-600 shrink-0" />
                    <span className="text-[10px] font-bold tracking-wider px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-700 border border-emerald-200 uppercase truncate">
                      {roleName}
                    </span>
                  </div>
                </div>
              </div>

              <button
                onClick={logout}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-bold text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-xl border border-rose-200 transition-colors"
              >
                <LogOut className="h-3.5 w-3.5" />
                Sign Out
              </button>
            </>
          )}
        </div>
      </aside>
    </>
  );
}
