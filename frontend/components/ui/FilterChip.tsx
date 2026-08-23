import React from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface FilterChipProps {
  label: string;
  value?: string;
  onRemove: () => void;
  className?: string;
}

export default function FilterChip({
  label,
  value,
  onRemove,
  className,
}: FilterChipProps) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onRemove();
      }}
      className={cn(
        'inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200/90 hover:bg-indigo-100 hover:border-indigo-300 transition-all shadow-2xs group focus:outline-hidden',
        className
      )}
      title={`Remove filter: ${label}${value ? ` (${value})` : ''}`}
    >
      <span className="text-indigo-500 font-semibold">{label}:</span>
      <span className="font-extrabold text-indigo-900">{value || ''}</span>
      <X className="h-3 w-3 text-indigo-400 group-hover:text-indigo-700 group-hover:scale-110 transition-all ml-0.5" />
    </button>
  );
}
