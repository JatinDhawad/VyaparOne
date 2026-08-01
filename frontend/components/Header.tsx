'use client';

import { Bell, Sparkles, Plus, RefreshCw } from 'lucide-react';

interface HeaderProps {
  title: string;
  subtitle?: string;
  onActionClick?: () => void;
  actionLabel?: string;
}

export default function Header({ title, subtitle, onActionClick, actionLabel }: HeaderProps) {
  return (
    <header className="glass-panel border-b border-slate-800/80 px-8 py-5 flex items-center justify-between sticky top-0 z-20">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white">{title}</h1>
        {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
      </div>

      <div className="flex items-center gap-4">
        {/* Quick Action Button if supplied */}
        {onActionClick && actionLabel && (
          <button
            onClick={onActionClick}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-indigo-600 to-emerald-500 hover:from-indigo-500 hover:to-emerald-400 text-white text-xs font-semibold rounded-xl shadow-lg shadow-indigo-500/20 border border-indigo-400/30 transition-all duration-200 active:scale-95"
          >
            <Plus className="h-4 w-4" />
            {actionLabel}
          </button>
        )}

        {/* Live Status Badge */}
        <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900/80 border border-emerald-500/20 text-xs text-emerald-400">
          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="font-semibold text-[11px]">System Online</span>
        </div>
      </div>
    </header>
  );
}
