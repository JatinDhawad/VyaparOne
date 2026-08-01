'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { CreditCard, Plus, ArrowUpRight, ArrowDownLeft } from 'lucide-react';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import Modal from '@/components/Modal';
import { api } from '@/lib/api';

export default function PaymentsPage() {
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formError, setFormError] = useState('');

  const [voucherNumber, setVoucherNumber] = useState('');
  const [paymentType, setPaymentType] = useState('RECEIPT');
  const [partyId, setPartyId] = useState('');
  const [amount, setAmount] = useState('1000.00');
  const [paymentMode, setPaymentMode] = useState('UPI');

  const { data: payments = [], isLoading } = useQuery({
    queryKey: ['payments'],
    queryFn: () => api.getPayments(),
  });

  const { data: parties = [] } = useQuery({
    queryKey: ['all-parties'],
    queryFn: () => api.getParties(),
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => api.createPayment(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      setIsModalOpen(false);
      resetForm();
    },
    onError: (err: any) => {
      setFormError(err.message || 'Failed to record payment voucher.');
    },
  });

  const resetForm = () => {
    setVoucherNumber('');
    setPaymentType('RECEIPT');
    setPartyId('');
    setAmount('1000.00');
    setPaymentMode('UPI');
    setFormError('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate({
      voucher_number: voucherNumber || `VOUCH-${Date.now()}`,
      payment_type: paymentType,
      party_id: partyId || null,
      amount: parseFloat(amount) || 0,
      payment_mode: paymentMode,
      payment_date: new Date().toISOString().split('T')[0],
    });
  };

  return (
    <div className="flex min-h-screen bg-[#090d16]">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Header 
          title="Payments & Receipts Vouchers" 
          subtitle="Record customer payments & vendor receipts with real-time double-entry ledger posting" 
          onActionClick={() => setIsModalOpen(true)}
          actionLabel="New Voucher Entry"
        />

        <main className="p-8 space-y-6 flex-1 overflow-y-auto">
          <div className="glass-panel rounded-2xl overflow-hidden border border-slate-800">
            <div className="p-4 border-b border-slate-800/80 font-bold text-white text-sm">Voucher History</div>
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-900/80 text-slate-400 border-b border-slate-800 uppercase text-[10px]">
                <tr>
                  <th className="p-4">Voucher #</th>
                  <th className="p-4">Type</th>
                  <th className="p-4">Date</th>
                  <th className="p-4">Mode</th>
                  <th className="p-4">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-200">
                {isLoading ? (
                  <tr><td colSpan={5} className="p-8 text-center text-slate-400">Loading vouchers...</td></tr>
                ) : payments.length === 0 ? (
                  <tr><td colSpan={5} className="p-8 text-center text-slate-400">No vouchers recorded.</td></tr>
                ) : (
                  payments.map((p: any) => (
                    <tr key={p.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="p-4 font-mono font-bold text-indigo-400">{p.voucher_number}</td>
                      <td className="p-4">
                        <span className={`inline-flex items-center gap-1 text-[10px] font-extrabold px-2 py-0.5 rounded border ${
                          p.payment_type === 'RECEIPT'
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                            : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                        }`}>
                          {p.payment_type === 'RECEIPT' ? <ArrowDownLeft className="h-3 w-3" /> : <ArrowUpRight className="h-3 w-3" />}
                          {p.payment_type}
                        </span>
                      </td>
                      <td className="p-4">{p.payment_date}</td>
                      <td className="p-4 font-semibold text-slate-300">{p.payment_mode}</td>
                      <td className="p-4 font-bold text-white">₹{parseFloat(p.amount || 0).toFixed(2)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </main>
      </div>

      {/* Modal */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Record Payment / Receipt Voucher">
        {formError && <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-semibold">{formError}</div>}
        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-slate-300 mb-1">Voucher Number *</label>
              <input required type="text" value={voucherNumber} onChange={(e) => setVoucherNumber(e.target.value)} placeholder="VOUCH-101" className="w-full glass-input p-2.5 rounded-xl font-mono" />
            </div>

            <div>
              <label className="block font-semibold text-slate-300 mb-1">Voucher Type *</label>
              <select value={paymentType} onChange={(e) => setPaymentType(e.target.value)} className="w-full glass-input p-2.5 rounded-xl bg-slate-900">
                <option value="RECEIPT">RECEIPT (Customer pays us)</option>
                <option value="PAYMENT">PAYMENT (We pay Supplier)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-slate-300 mb-1">Party (Optional)</label>
              <select value={partyId} onChange={(e) => setPartyId(e.target.value)} className="w-full glass-input p-2.5 rounded-xl bg-slate-900">
                <option value="">-- Choose Party --</option>
                {parties.map((pt: any) => (
                  <option key={pt.id} value={pt.id}>{pt.name} ({pt.party_type})</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-300 mb-1">Amount (₹) *</label>
              <input required type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} className="w-full glass-input p-2.5 rounded-xl text-emerald-400 font-bold" />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-300 mb-1">Payment Mode</label>
            <select value={paymentMode} onChange={(e) => setPaymentMode(e.target.value)} className="w-full glass-input p-2.5 rounded-xl bg-slate-900">
              <option value="UPI">UPI / GPay</option>
              <option value="CASH">CASH</option>
              <option value="BANK">BANK / NEFT</option>
              <option value="CHEQUE">CHEQUE</option>
            </select>
          </div>

          <button
            type="submit"
            disabled={createMutation.isPending}
            className="w-full py-3 bg-gradient-to-r from-indigo-600 to-emerald-500 hover:from-indigo-500 hover:to-emerald-400 text-white font-bold rounded-xl shadow-lg transition-all"
          >
            {createMutation.isPending ? 'Saving...' : 'Save Voucher & Update Ledger'}
          </button>
        </form>
      </Modal>
    </div>
  );
}
