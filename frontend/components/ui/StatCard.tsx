'use client';

import React, { useEffect, useState } from 'react';
import { cn, formatCurrency } from '@/lib/utils';
import Skeleton from './Skeleton';
import { TrendingUp, TrendingDown } from 'lucide-react';

export interface StatCardProps {
  label: string;
  value: number | string;
  prefix?: string;
  suffix?: string;
  icon?: React.ComponentType<{ className?: string }>;
  trend?: {
    value: string | number;
    isPositive?: boolean;
    label?: string;
  };
  subtext?: React.ReactNode;
  variant?: 'indigo' | 'emerald' | 'amber' | 'rose' | 'violet' | 'neutral';
  isLoading?: boolean;
  className?: string;
}

const variantStyles = {
  indigo: {
    card: 'border-slate-200 bg-white hover:border-slate-300',
    iconBg: 'bg-indigo-50 border-indigo-100 text-indigo-600',
    label: 'text-indigo-700',
  },
  emerald: {
    card: 'border-slate-200 bg-white hover:border-slate-300',
    iconBg: 'bg-emerald-50 border-emerald-100 text-emerald-600',
    label: 'text-emerald-700',
  },
  amber: {
    card: 'border-slate-200 bg-white hover:border-slate-300',
    iconBg: 'bg-amber-50 border-amber-100 text-amber-700',
    label: 'text-amber-800',
  },
  rose: {
    card: 'border-slate-200 bg-white hover:border-slate-300',
    iconBg: 'bg-rose-50 border-rose-100 text-rose-700',
    label: 'text-rose-800',
  },
  violet: {
    card: 'border-slate-200 bg-white hover:border-slate-300',
    iconBg: 'bg-violet-50 border-violet-100 text-violet-700',
    label: 'text-violet-800',
  },
  neutral: {
    card: 'border-slate-200 bg-white hover:border-slate-300',
    iconBg: 'bg-slate-50 border-slate-200 text-slate-700',
    label: 'text-slate-600',
  },
};

export default function StatCard({
  label,
  value,
  prefix = '₹',
  suffix = '',
  icon: Icon,
  trend,
  subtext,
  variant = 'neutral',
  isLoading = false,
  className,
}: StatCardProps) {
  const currentVariant = variantStyles[variant] || variantStyles.neutral;

  // Numeric animated counter with requestAnimationFrame
  const numericTarget = typeof value === 'number' ? value : parseFloat(String(value).replace(/[^0-9.-]/g, ''));
  const isNumeric = !isNaN(numericTarget) && isFinite(numericTarget);

  const [animatedVal, setAnimatedVal] = useState<number>(0);

  useEffect(() => {
    if (!isNumeric || isLoading) return;

    const duration = 650; // ms
    const startTime = performance.now();
    let animId: number;

    const step = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // easeOutCubic
      const ease = 1 - Math.pow(1 - progress, 3);
      setAnimatedVal(numericTarget * ease);

      if (progress < 1) {
        animId = requestAnimationFrame(step);
      } else {
        setAnimatedVal(numericTarget);
      }
    };

    animId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(animId);
  }, [numericTarget, isNumeric, isLoading]);

  if (isLoading) {
    return (
      <div className={cn('glass-card p-6 rounded-2xl flex flex-col justify-between min-h-[145px]', currentVariant.card, className)}>
        <div className="flex items-center justify-between">
          <Skeleton className="h-4 w-28 rounded-lg" />
          <Skeleton className="h-10 w-10 rounded-xl" />
        </div>
        <div className="mt-4 space-y-2">
          <Skeleton className="h-8 w-36 rounded-xl" />
          <Skeleton className="h-4 w-24 rounded-lg" />
        </div>
      </div>
    );
  }

  const displayValue = isNumeric
    ? `${prefix ? `${prefix}` : ''}${formatCurrency(animatedVal)}${suffix ? ` ${suffix}` : ''}`
    : `${prefix ? `${prefix}` : ''}${value}${suffix ? ` ${suffix}` : ''}`;

  return (
    <div className={cn('glass-card p-6 rounded-2xl flex flex-col justify-between min-h-[145px] transition-all duration-300', currentVariant.card, className)}>
      <div className="flex items-center justify-between">
        <span className={cn('text-xs font-extrabold uppercase tracking-wider', currentVariant.label)}>
          {label}
        </span>
        {Icon && (
          <div className={cn('h-10 w-10 rounded-xl border flex items-center justify-center shadow-2xs shrink-0', currentVariant.iconBg)}>
            <Icon className="h-5 w-5" />
          </div>
        )}
      </div>

      <div className="mt-3">
        <div className="flex items-baseline justify-between gap-2 flex-wrap">
          <h3 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            {displayValue}
          </h3>
          {trend && (
            <span
              className={cn(
                'inline-flex items-center gap-1 text-[11px] font-extrabold px-2 py-0.5 rounded-lg border',
                trend.isPositive !== false
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                  : 'bg-rose-50 text-rose-800 border-rose-200'
              )}
            >
              {trend.isPositive !== false ? (
                <TrendingUp className="h-3 w-3 text-emerald-600" />
              ) : (
                <TrendingDown className="h-3 w-3 text-rose-600" />
              )}
              {trend.value}
            </span>
          )}
        </div>

        {subtext && (
          <div className="mt-2 text-xs font-semibold text-slate-500 border-t border-slate-100 pt-1.5">
            {subtext}
          </div>
        )}
      </div>
    </div>
  );
}
