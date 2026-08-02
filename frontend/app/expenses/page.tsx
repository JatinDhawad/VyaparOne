'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import Modal from '@/components/Modal';
import { api } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';

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
      setIsModalOpen(false);
      resetForm();
    },
    onError: (err: any) => {
      setFormError(err.message || 'Failed to record expense.');
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

        <main className="p-8 space-y-6 flex-1 overflow-y-auto">
          <div className="glass-panel rounded-2xl overflow-hidden border border-slate-200">
            <div className="p-4 border-b border-slate-100 font-bold text-slate-900 text-sm">Expense Log</div>
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100/80 text-slate-500 border-b border-slate-200 uppercase text-[10px] font-bold">
                <tr>
                  <th className="p-4">Date</th>
                  <th className="p-4">Category</th>
                  <th className="p-4">Mode</th>
                  <th className="p-4 text-right">Amount (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {isLoading ? (
                  <tr><td colSpan={4} className="p-8 text-center text-slate-500">Loading expenses...</td></tr>
                ) : expenses.length === 0 ? (
                  <tr><td colSpan={4} className="p-8 text-center text-slate-500">No operational expenses recorded.</td></tr>
                ) : (
                  expenses.map((e: any) => (
                    <tr key={e.id} className="hover:bg-slate-100/50 transition-colors">
                      <td className="p-4 font-medium">{e.expense_date}</td>
                      <td className="p-4 font-bold text-slate-900">{e.category}</td>
                      <td className="p-4 text-slate-600">{e.payment_mode}</td>
                      <td className="p-4 text-right font-bold text-rose-700">₹{formatCurrency(e.amount)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
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
              className="px-4 py-2 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-md transition-all"
            >
              {createMutation.isPending ? 'Saving...' : 'Save Expense'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
