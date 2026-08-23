import React from 'react';
import { cn } from '@/lib/utils';
import { PackageOpen, Plus } from 'lucide-react';

export interface EmptyStateProps {
  icon?: React.ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

export default function EmptyState({
  icon: Icon = PackageOpen,
  title,
  description,
  actionLabel,
  onAction,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'glass-card p-12 text-center rounded-3xl border border-slate-200/80 bg-white flex flex-col items-center justify-center space-y-4 max-w-md mx-auto my-6',
        className
      )}
    >
      <div className="h-16 w-16 rounded-2xl bg-indigo-50/80 border border-indigo-100/80 flex items-center justify-center text-indigo-600 shadow-sm">
        <Icon className="h-8 w-8" />
      </div>

      <div className="space-y-1.5 max-w-sm">
        <h4 className="text-base font-extrabold text-slate-900 tracking-tight">
          {title}
        </h4>
        {description && (
          <p className="text-xs text-slate-500 font-medium leading-relaxed">
            {description}
          </p>
        )}
      </div>

      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="mt-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs rounded-lg shadow-xs transition-all flex items-center gap-2 active:scale-95"
        >
          <Plus className="h-4 w-4" />
          <span>{actionLabel}</span>
        </button>
      )}
    </div>
  );
}
