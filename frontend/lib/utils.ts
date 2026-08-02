export function formatCurrency(amount: number | string | undefined | null): string {
  if (amount === undefined || amount === null || amount === '') return '0';
  const num = Number(amount);
  if (isNaN(num)) return '0';
  
  // If the number has fractional part (not an integer), format with 2 decimal places.
  // Otherwise, format with 0 decimal places.
  if (num % 1 !== 0) {
    return num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  return num.toLocaleString('en-IN', { maximumFractionDigits: 0 });
}
