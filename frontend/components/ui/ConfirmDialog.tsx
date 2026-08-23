'use client';

import React from 'react';
import { AlertTriangle, AlertCircle, HelpCircle, X, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning' | 'primary';
  isLoading?: boolean;
}

const variantStyles = {
  danger: {
    icon: AlertTriangle,
    iconContainer: 'bg-rose-50 border-rose-200 text-rose-600',
    confirmBtn: 'bg-rose-600 hover:bg-rose-700 text-white shadow-rose-500/20',
  },
  warning: {
    icon: AlertCircle,
    iconContainer: 'bg-amber-50 border-amber-200 text-amber-600',
    confirmBtn: 'bg-amber-600 hover:bg-amber-700 text-white shadow-amber-500/20',
  },
  primary: {
    icon: HelpCircle,
    iconContainer: 'bg-indigo-50 border-indigo-200 text-indigo-600',
    confirmBtn: 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-500/20',
  },
};

export default function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'danger',
  isLoading = false,
}: ConfirmDialogProps) {
  if (!isOpen) return null;

  const currentVariant = variantStyles[variant] || variantStyles.danger;
  const Icon = currentVariant.icon;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-6 bg-slate-950/50 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-white rounded-3xl border border-slate-200 shadow-2xl flex flex-col overflow-hidden text-slate-900 animate-in zoom-in-95 duration-200">
        
        {/* Top Header Row with Close button */}
        <div className="flex items-center justify-between px-6 pt-5 pb-2">
          <div className={cn('h-11 w-11 rounded-2xl border flex items-center justify-center shadow-2xs shrink-0', currentVariant.iconContainer)}>
            <Icon className="h-5 w-5" />
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="p-2 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-100 transition-all"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Dialog Content */}
        <div className="px-6 py-3 space-y-2">
          <h3 className="text-lg font-extrabold text-slate-900 tracking-tight">
            {title}
          </h3>
          <div className="text-xs text-slate-500 font-medium leading-relaxed">
            {description}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3 px-6 py-5 bg-slate-50 border-t border-slate-100 mt-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="px-4 py-2.5 text-xs font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 rounded-xl transition-colors"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isLoading}
            className={cn(
              'px-5 py-2.5 text-xs font-extrabold rounded-xl shadow-md transition-all flex items-center gap-2 active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed',
              currentVariant.confirmBtn
            )}
          >
            {isLoading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            <span>{isLoading ? 'Processing...' : confirmLabel}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
