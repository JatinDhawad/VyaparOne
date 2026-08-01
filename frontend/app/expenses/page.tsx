'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import Modal from '@/components/Modal';
import { api } from '@/lib/api';

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
          subtitle="Record fuel, rent, godown maintenance & operational expenses" 
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
                  <th className="p-4">Amount</th>
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
                      <td className="p-4">{e.expense_date}</td>
                      <td className="p-4 font-bold text-slate-900">{e.category}</td>
                      <td className="p-4 text-slate-600">{e.payment_mode}</td>
                      <td className="p-4 font-bold text-rose-700">₹{parseFloat(e.amount || 0).toFixed(2)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </main>
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Record Operational Expense">
        {formError && <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold">{formError}</div>}
        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block font-bold text-slate-700 mb-1">Expense Category *</label>
            <input required type="text" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Vehicle Fuel, Rent, Maintenance" className="w-full glass-input p-2.5 rounded-xl" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Amount (₹) *</label>
              <input required type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} className="w-full glass-input p-2.5 rounded-xl text-rose-700 font-bold" />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Payment Mode</label>
              <select value={paymentMode} onChange={(e) => setPaymentMode(e.target.value)} className="w-full glass-input p-2.5 rounded-xl bg-white">
                <option value="CASH">CASH</option>
                <option value="UPI">UPI</option>
                <option value="BANK">BANK</option>
              </select>
            </div>
          </div>

          <button
            type="submit"
            disabled={createMutation.isPending}
            className="w-full py-3 bg-gradient-to-r from-rose-600 to-indigo-600 hover:from-rose-500 hover:to-indigo-500 text-white font-bold rounded-xl shadow-lg transition-all"
          >
            {createMutation.isPending ? 'Processing...' : 'Save Expense & Debit Ledger'}
          </button>
        </form>
      </Modal>
    </div>
  );
}
