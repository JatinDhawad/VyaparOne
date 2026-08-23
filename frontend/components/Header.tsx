'use client';

import { Plus, Menu, Search } from 'lucide-react';
import { useSidebarStore } from '@/lib/sidebar-store';

interface HeaderProps {
  title: string;
  subtitle?: string;
  onActionClick?: () => void;
  actionLabel?: string;
}

export default function Header({ title, subtitle, onActionClick, actionLabel }: HeaderProps) {
  const { toggleMobile, openCommand } = useSidebarStore();

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

      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        {/* Global Command Palette Trigger Button (Desktop & Tablet) */}
        <button
          onClick={openCommand}
          className="hidden sm:flex items-center gap-2.5 px-3 py-1.5 bg-slate-100/90 hover:bg-slate-200/70 border border-slate-200 text-slate-500 hover:text-slate-900 rounded-xl text-xs font-semibold transition-all shadow-2xs group"
          title="Search or jump to... (Cmd+K)"
        >
          <Search className="h-3.5 w-3.5 text-slate-400 group-hover:text-indigo-600 transition-colors" />
          <span className="text-slate-500 font-medium">Search or jump to...</span>
          <kbd className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-mono font-bold bg-white text-slate-600 border border-slate-200 rounded-md shadow-2xs">
            <span className="text-xs">⌘</span>K
          </kbd>
        </button>

        {/* Mobile Search Icon Button (< 640px) */}
        <button
          onClick={openCommand}
          className="sm:hidden p-2 text-slate-500 hover:text-indigo-600 hover:bg-slate-100 rounded-xl transition-colors shrink-0"
          title="Search or jump to..."
          aria-label="Open Command Palette"
        >
          <Search className="h-4 w-4" />
        </button>

        {/* Quick Action Button if supplied */}
        {onActionClick && actionLabel && (
          <button
            onClick={onActionClick}
            className="flex items-center gap-1.5 px-3 sm:px-4 py-2 bg-gradient-to-r from-indigo-600 to-emerald-600 hover:from-indigo-500 hover:to-emerald-500 text-white text-xs font-bold rounded-xl shadow-md shadow-indigo-500/15 border border-indigo-400/30 transition-all duration-200 active:scale-95 shrink-0"
            title={actionLabel}
          >
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">{actionLabel}</span>
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
