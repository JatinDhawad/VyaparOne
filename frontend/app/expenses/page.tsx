'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import Modal from '@/components/Modal';
import { api } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';
import { toast } from 'sonner';
import { Skeleton, EmptyState, Badge } from '@/components/ui';
import { TrendingDown, Loader2 } from 'lucide-react';

export default function ExpensesPage() {
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formError, setFormError] = useState('');

  const [category, setCategory] = useState('Godown Maintenance');
  const [amount, setAmount] = useState('300.00');
  const [paymentMode, setPaymentMode] = useState('CASH');
  const [remarks, setRemarks] = useState('');

  const { data: expenses = [], isLoading } = useQuery({
    queryKey: ['expenses'],
    queryFn: () => api.getExpenses(),
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => api.createExpense(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
      setIsModalOpen(false);
      toast.success(`Expense of ₹${formatCurrency(amount)} (${category}) recorded successfully!`);
      resetForm();
    },
    onError: (err: any) => {
      const msg = err.message || 'Failed to record expense.';
      setFormError(msg);
      toast.error(msg);
    },
  });

  const resetForm = () => {
    setCategory('Godown Maintenance');
    setAmount('300.00');
    setPaymentMode('CASH');
    setRemarks('');
    setFormError('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate({
      category,
      amount: parseFloat(amount) || 0,
      payment_mode: paymentMode,
      expense_date: new Date().toISOString().split('T')[0],
      remarks,
    });
  };

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Header 
          title="Operational Expenses" 
          onActionClick={() => setIsModalOpen(true)}
          actionLabel="Record Expense"
        />

        <main className="p-4 sm:p-6 space-y-4 flex-1 overflow-y-auto">
          <div className="glass-panel rounded-xl overflow-hidden border border-slate-200">
            <div className="px-3.5 py-2.5 border-b border-slate-100 font-bold text-slate-900 text-sm">Expense Log</div>
            <div className="max-h-[700px] overflow-y-auto overflow-x-auto">
              <table className="w-full min-w-[500px] text-left text-xs">
                <thead className="sticky top-0 z-10 bg-slate-100/95 backdrop-blur-xs text-slate-500 border-b border-slate-200 uppercase text-[10px] font-semibold tracking-wider">
                  <tr>
                    <th className="px-3.5 py-2.5">Date</th>
                    <th className="px-3.5 py-2.5">Category</th>
                    <th className="px-3.5 py-2.5">Mode</th>
                    <th className="px-3.5 py-2.5 text-right">Amount (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700 bg-white">
                  {isLoading ? (
                    [...Array(5)].map((_, i) => (
                      <tr key={i} className="animate-pulse">
                        <td className="px-3.5 py-2.5"><Skeleton className="h-4.5 w-24 rounded-md" /></td>
                        <td className="px-3.5 py-2.5"><Skeleton className="h-4.5 w-32 rounded-md" /></td>
                        <td className="px-3.5 py-2.5"><Skeleton className="h-4.5 w-16 rounded-md" /></td>
                        <td className="px-3.5 py-2.5 text-right"><Skeleton className="h-4.5 w-20 rounded-md ml-auto" /></td>
                      </tr>
                    ))
                  ) : expenses.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="p-8">
                        <EmptyState
                          icon={TrendingDown}
                          title="No Expenses Logged"
                          description="Track your daily store and warehouse operational expenses."
                          actionLabel="Record Expense"
                          onAction={() => setIsModalOpen(true)}
                        />
                      </td>
                    </tr>
                  ) : (
                    expenses.map((e: any) => (
                      <tr key={e.id} className="table-row-interactive transition-colors border-b border-slate-100">
                        <td className="px-3.5 py-2.5 font-medium">{e.expense_date}</td>
                        <td className="px-3.5 py-2.5 font-bold text-slate-900">
                          <Badge variant="neutral" size="sm">
                            {e.category}
                          </Badge>
                        </td>
                        <td className="px-3.5 py-2.5 text-slate-600 font-medium">{e.payment_mode}</td>
                        <td className="px-3.5 py-2.5 text-right font-bold text-rose-700">₹{formatCurrency(e.amount)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </main>
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Record Operational Expense">
        <form onSubmit={handleSubmit} className="space-y-4">
          {formError && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs font-medium">
              {formError}
            </div>
          )}

          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">Expense Category</label>
            <input 
              type="text" 
              value={category} 
              onChange={(e) => setCategory(e.target.value)} 
              className="glass-input w-full p-2.5 rounded-xl text-xs" 
              required 
            />
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">Amount (₹)</label>
            <input 
              type="number" 
              step="0.01" 
              value={amount} 
              onChange={(e) => setAmount(e.target.value)} 
              className="glass-input w-full p-2.5 rounded-xl text-xs" 
              required 
            />
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">Payment Mode</label>
            <select 
              value={paymentMode} 
              onChange={(e) => setPaymentMode(e.target.value)} 
              className="glass-input w-full p-2.5 rounded-xl text-xs bg-white"
            >
              <option value="CASH">CASH</option>
              <option value="BANK">BANK / ONLINE</option>
              <option value="UPI">UPI</option>
              <option value="CHEQUE">CHEQUE</option>
            </select>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">Remarks / Purpose</label>
            <textarea 
              value={remarks} 
              onChange={(e) => setRemarks(e.target.value)} 
              className="glass-input w-full p-2.5 rounded-xl text-xs h-20" 
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button 
              type="button" 
              onClick={() => setIsModalOpen(false)} 
              className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button 
              type="submit" 
              disabled={createMutation.isPending} 
              className="px-4 py-2 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-md transition-all flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {createMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              <span>{createMutation.isPending ? 'Saving...' : 'Save Expense'}</span>
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
