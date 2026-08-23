'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowUpRight, ArrowDownLeft } from 'lucide-react';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import Modal from '@/components/Modal';
import { api } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';
import { toast } from 'sonner';
import { Skeleton, EmptyState, Badge } from '@/components/ui';

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
    onSuccess: (res: any) => {
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      queryClient.invalidateQueries({ queryKey: ['parties'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
      setIsModalOpen(false);
      const vNum = voucherNumber || res?.voucher_number || 'Voucher';
      toast.success(`${paymentType === 'RECEIPT' ? 'Receipt' : 'Payment'} voucher #${vNum} of ₹${formatCurrency(amount)} recorded successfully!`);
      resetForm();
    },
    onError: (err: any) => {
      const msg = err.message || 'Failed to record payment voucher.';
      setFormError(msg);
      toast.error(msg);
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
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Header 
          title="Payments & Receipts Vouchers" 
          onActionClick={() => setIsModalOpen(true)}
          actionLabel="New Voucher Entry"
        />

        <main className="p-4 sm:p-8 space-y-6 flex-1 overflow-y-auto">
          <div className="glass-panel rounded-2xl overflow-hidden border border-slate-200">
            <div className="p-4 border-b border-slate-100 font-bold text-slate-900 text-sm">Voucher History</div>
            <div className="max-h-[700px] overflow-y-auto overflow-x-auto">
              <table className="w-full min-w-[550px] text-left text-xs">
                <thead className="sticky top-0 z-10 bg-slate-100/95 backdrop-blur-xs text-slate-500 border-b border-slate-200 uppercase text-[10px] font-bold">
                  <tr>
                    <th className="p-4">Voucher #</th>
                    <th className="p-4">Type</th>
                    <th className="p-4">Date</th>
                    <th className="p-4">Mode</th>
                    <th className="p-4 text-right">Amount (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700 bg-white">
                  {isLoading ? (
                    [...Array(5)].map((_, i) => (
                      <tr key={i} className="animate-pulse">
                        <td className="p-4"><Skeleton className="h-5 w-24 rounded-lg" /></td>
                        <td className="p-4"><Skeleton className="h-6 w-16 rounded-xl" /></td>
                        <td className="p-4"><Skeleton className="h-5 w-20 rounded-lg" /></td>
                        <td className="p-4"><Skeleton className="h-5 w-16 rounded-lg" /></td>
                        <td className="p-4 text-right"><Skeleton className="h-5 w-20 rounded-lg ml-auto" /></td>
                      </tr>
                    ))
                  ) : payments.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-8">
                        <EmptyState
                          icon={ArrowUpRight}
                          title="No Vouchers Recorded"
                          description="Record incoming customer collections or outgoing supplier disbursements."
                          actionLabel="New Voucher Entry"
                          onAction={() => setIsModalOpen(true)}
                        />
                      </td>
                    </tr>
                  ) : (
                    payments.map((p: any) => (
                      <tr key={p.id} className="hover:bg-slate-50 transition-colors border-b border-slate-100">
                        <td className="p-4 font-mono font-bold text-indigo-700">{p.voucher_number}</td>
                        <td className="p-4">
                          <Badge
                            variant={p.payment_type === 'RECEIPT' ? 'success' : 'danger'}
                            size="sm"
                          >
                            {p.payment_type === 'RECEIPT' ? <ArrowDownLeft className="h-3 w-3" /> : <ArrowUpRight className="h-3 w-3" />}
                            {p.payment_type}
                          </Badge>
                        </td>
                        <td className="p-4 font-medium">{p.payment_date}</td>
                        <td className="p-4 font-bold text-slate-700">{p.payment_mode}</td>
                        <td className="p-4 text-right font-bold text-slate-900">₹{formatCurrency(p.amount)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </main>
      </div>

      {/* Modal */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Record New Payment Voucher">
        <form onSubmit={handleSubmit} className="space-y-4">
          {formError && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs font-medium">
              {formError}
            </div>
          )}

          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">Voucher Number</label>
            <input 
              type="text" 
              value={voucherNumber} 
              onChange={(e) => setVoucherNumber(e.target.value)} 
              placeholder="e.g. VOUCH-1001 (Auto-generated if blank)" 
              className="glass-input w-full p-2.5 rounded-xl text-xs font-mono" 
            />
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">Transaction Type</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setPaymentType('RECEIPT')}
                className={`py-2 rounded-xl text-xs font-bold border transition-all ${
                  paymentType === 'RECEIPT'
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-md'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
              >
                RECEIPT (From Customer)
              </button>
              <button
                type="button"
                onClick={() => setPaymentType('PAYMENT')}
                className={`py-2 rounded-xl text-xs font-bold border transition-all ${
                  paymentType === 'PAYMENT'
                    ? 'bg-rose-600 text-white border-rose-600 shadow-md'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
              >
                PAYMENT (To Supplier)
              </button>
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">Associated Party</label>
            <select 
              value={partyId} 
              onChange={(e) => setPartyId(e.target.value)} 
              className="glass-input w-full p-2.5 rounded-xl text-xs bg-white font-medium"
            >
              <option value="">-- General Account (No Specific Party) --</option>
              {parties.map((pt: any) => (
                <option key={pt.id} value={pt.id}>{pt.name} ({pt.party_type})</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">Amount (₹)</label>
            <input 
              type="number" 
              step="0.01" 
              value={amount} 
              onChange={(e) => setAmount(e.target.value)} 
              className="glass-input w-full p-2.5 rounded-xl text-xs font-bold" 
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
              <option value="UPI">UPI / Online Transfer</option>
              <option value="BANK">Bank Account / NEFT / RTGS</option>
              <option value="CASH">Cash In Hand</option>
              <option value="CHEQUE">Cheque</option>
            </select>
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
              {createMutation.isPending ? 'Recording...' : 'Record Voucher'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
