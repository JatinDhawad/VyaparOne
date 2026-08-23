import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number | string | undefined | null): string {
  if (amount === undefined || amount === null || amount === '') return '0';
  const num = Number(amount);
  if (isNaN(num)) return '0';
  
  if (num % 1 !== 0) {
    return num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  return num.toLocaleString('en-IN', { maximumFractionDigits: 0 });
}

export function formatCompactCurrency(amount: number | string | undefined | null): string {
  if (amount === undefined || amount === null || amount === '') return '0';
  const num = Number(amount);
  if (isNaN(num)) return '0';

  if (Math.abs(num) >= 10000000) {
    return (num / 10000000).toFixed(1).replace(/\.0$/, '') + ' Cr';
  }
  if (Math.abs(num) >= 100000) {
    return (num / 100000).toFixed(1).replace(/\.0$/, '') + ' L';
  }
  if (Math.abs(num) >= 1000) {
    return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
  }
  return num.toString();
}
