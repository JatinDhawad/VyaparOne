'use client';

import { Plus, Menu } from 'lucide-react';
import { useSidebarStore } from '@/lib/sidebar-store';

interface HeaderProps {
  title: string;
  subtitle?: string;
  onActionClick?: () => void;
  actionLabel?: string;
}

export default function Header({ title, subtitle, onActionClick, actionLabel }: HeaderProps) {
  const { toggleMobile } = useSidebarStore();

  return (
    <header className="bg-white/90 backdrop-blur-md border-b border-slate-200 px-4 sm:px-8 py-4 sm:py-5 flex items-center justify-between sticky top-0 z-20 shadow-xs">
      <div className="flex items-center gap-3 min-w-0">
        {/* Mobile Hamburger Menu Button (< 768px) */}
        <button
          onClick={toggleMobile}
          className="md:hidden p-2 -ml-1 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors shrink-0"
          title="Open Navigation Menu"
          aria-label="Open Navigation Menu"
        >
          <Menu className="h-5 w-5" />
        </button>

        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 truncate">{title}</h1>
          {subtitle && <p className="text-xs font-medium text-slate-500 mt-0.5 truncate">{subtitle}</p>}
        </div>
      </div>

      <div className="flex items-center gap-3 shrink-0">
        {/* Quick Action Button if supplied */}
        {onActionClick && actionLabel && (
          <button
            onClick={onActionClick}
            className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-gradient-to-r from-indigo-600 to-emerald-600 hover:from-indigo-500 hover:to-emerald-500 text-white text-xs font-bold rounded-xl shadow-md shadow-indigo-500/15 border border-indigo-400/30 transition-all duration-200 active:scale-95"
          >
            <Plus className="h-4 w-4" />
            <span className="hidden xs:inline">{actionLabel}</span>
          </button>
        )}

        {/* Live Status Badge */}
        <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100 border border-emerald-300 text-xs text-emerald-700">
          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="font-bold text-[11px]">System Online</span>
        </div>
      </div>
    </header>
  );
}
