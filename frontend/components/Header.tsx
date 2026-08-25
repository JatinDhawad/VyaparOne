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
    <header className="bg-white/90 backdrop-blur-md border-b border-slate-200 px-4 sm:px-6 py-3.5 sm:py-4 flex items-center justify-between sticky top-0 z-20 shadow-xs">
      <div className="flex items-center gap-3 min-w-0">
        {/* Mobile Hamburger Menu Button (< 768px) */}
        <button
          onClick={toggleMobile}
          className="md:hidden p-1.5 -ml-1 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors shrink-0"
          title="Open Navigation Menu"
          aria-label="Open Navigation Menu"
        >
          <Menu className="h-5 w-5" />
        </button>

        <div className="min-w-0">
          <h1 className="page-title truncate">{title}</h1>
          {subtitle && <p className="text-xs font-normal text-slate-500 mt-0.5 truncate">{subtitle}</p>}
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        {/* Global Command Palette Trigger Button (Desktop & Tablet) */}
        <button
          onClick={openCommand}
          className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-slate-100/90 hover:bg-slate-200/70 border border-slate-200 text-slate-500 hover:text-slate-900 rounded-lg text-xs font-medium transition-all shadow-2xs group"
          title="Search or jump to... (Cmd+K)"
        >
          <Search className="h-3.5 w-3.5 text-slate-400 group-hover:text-indigo-600 transition-colors" />
          <span className="text-slate-500 font-normal">Search or jump to...</span>
          <kbd className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-mono font-semibold bg-white text-slate-600 border border-slate-200 rounded-md shadow-2xs">
            <span className="text-xs">⌘</span>K
          </kbd>
        </button>

        {/* Mobile Search Icon Button (< 640px) */}
        <button
          onClick={openCommand}
          className="sm:hidden p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-slate-100 rounded-md transition-colors shrink-0"
          title="Search or jump to..."
          aria-label="Open Command Palette"
        >
          <Search className="h-4 w-4" />
        </button>

        {/* Quick Action Button if supplied */}
        {onActionClick && actionLabel && (
          <button
            onClick={onActionClick}
            className="flex items-center gap-1.5 px-3 sm:px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg shadow-xs transition-all duration-200 active:scale-95 shrink-0"
            title={actionLabel}
          >
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">{actionLabel}</span>
          </button>
        )}

        {/* Live Status Badge */}
        <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-100 border border-slate-200 text-xs text-slate-700">
          <span className="h-2 w-2 rounded-full bg-emerald-500" />
          <span className="font-semibold text-[11px] text-slate-600">Online</span>
        </div>
      </div>
    </header>
  );
}
