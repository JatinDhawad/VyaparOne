'use client';

import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  ArrowUpRight, 
  ArrowDownLeft, 
  Loader2, 
  RefreshCw, 
  Search, 
  Wallet, 
  Receipt, 
  CreditCard, 
  Building2, 
  CheckCircle2, 
  Filter 
} from 'lucide-react';
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

  // Manual voucher modal state
  const [voucherNumber, setVoucherNumber] = useState('');
  const [paymentType, setPaymentType] = useState('RECEIPT');
  const [partyId, setPartyId] = useState('');
  const [amount, setAmount] = useState('1000.00');
  const [paymentMode, setPaymentMode] = useState('UPI');

  // Filter & Search states
  const [activeTab, setActiveTab] = useState<'ALL' | 'RECEIPT' | 'PAYMENT'>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMode, setSelectedMode] = useState('ALL');

  // ── Queries ────────────────────────────────────────────────────────────────
  const { data: payments = [], isLoading, isFetching } = useQuery({
    queryKey: ['payments'],
    queryFn: () => api.getPayments(),
  });

  const { data: parties = [] } = useQuery({
    queryKey: ['all-parties'],
    queryFn: () => api.getParties(),
  });

  // ── Mutations ──────────────────────────────────────────────────────────────
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

  const syncMutation = useMutation({
    mutationFn: () => api.syncPayments(),
    onSuccess: (res: any) => {
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      queryClient.invalidateQueries({ queryKey: ['parties'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
      toast.success(res?.message || 'Payments and receipts synchronized successfully!');
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to sync payments.');
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

  // ── Overall KPIs & Calculations ────────────────────────────────────────────
  const { totalReceived, totalPaid, netCashFlow, receiptsCount, paymentsCount } = useMemo(() => {
    let recSum = 0;
    let paySum = 0;
    let recCnt = 0;
    let payCnt = 0;

    for (const p of payments) {
      const amt = parseFloat(p.amount || 0);
      if (p.payment_type === 'RECEIPT') {
        recSum += amt;
        recCnt += 1;
      } else if (p.payment_type === 'PAYMENT') {
        paySum += amt;
        payCnt += 1;
      }
    }

    return {
      totalReceived: recSum,
      totalPaid: paySum,
      netCashFlow: recSum - paySum,
      receiptsCount: recCnt,
      paymentsCount: payCnt,
    };
  }, [payments]);

  // ── Filtered List ──────────────────────────────────────────────────────────
  const filteredPayments = useMemo(() => {
    return payments.filter((p: any) => {
      // Tab filter
      if (activeTab !== 'ALL' && p.payment_type !== activeTab) return false;
      // Mode filter
      if (selectedMode !== 'ALL' && (p.payment_mode || '').toUpperCase() !== selectedMode) return false;
      // Search term
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const vNum = (p.voucher_number || '').toLowerCase();
        const partyName = (p.party?.name || '').toLowerCase();
        const remarks = (p.remarks || '').toLowerCase();
        const ref = (p.reference_number || '').toLowerCase();
        const mode = (p.payment_mode || '').toLowerCase();
        if (
          !vNum.includes(q) &&
          !partyName.includes(q) &&
          !remarks.includes(q) &&
          !ref.includes(q) &&
          !mode.includes(q)
        ) {
          return false;
        }
      }
      return true;
    });
  }, [payments, activeTab, selectedMode, searchTerm]);

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Header 
          title="Payments & Receipts" 
          subtitle="Real-time synchronized collections & disbursements across Sales, Purchases & Vouchers"
          onActionClick={() => setIsModalOpen(true)}
          actionLabel="New Voucher Entry"
        />

        <main className="p-4 sm:p-6 space-y-4 flex-1 overflow-y-auto">
          {/* ── Top Action & Sync Banner ────────────────────────────────────── */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-2xl bg-white border border-slate-200 shadow-2xs">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              <span>Auto-Synchronized: Automatically pulls payments from Sales POS, Purchase Bills & Supplier Transfers.</span>
            </div>

            <button
              type="button"
              disabled={syncMutation.isPending || isFetching}
              onClick={() => syncMutation.mutate()}
              className="flex items-center gap-2 px-3.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-bold transition-all shadow-2xs disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${syncMutation.isPending || isFetching ? 'animate-spin text-indigo-600' : ''}`} />
              <span>{syncMutation.isPending ? 'Syncing...' : 'Sync Payments & Receipts'}</span>
            </button>
          </div>

          {/* ── 4 KPI Summary Cards ────────────────────────────────────────── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Card 1: Total Received */}
            <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                  Total Received (Collections)
                </span>
                <span className="text-xl font-extrabold text-emerald-700 block mt-0.5">
                  ₹{formatCurrency(totalReceived)}
                </span>
                <span className="text-[10px] text-slate-500 font-medium">
                  {receiptsCount} customer receipts recorded
                </span>
              </div>
              <div className="h-11 w-11 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 shrink-0">
                <ArrowDownLeft className="h-5 w-5" />
              </div>
            </div>

            {/* Card 2: Total Paid */}
            <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                  Total Paid (Disbursements)
                </span>
                <span className="text-xl font-extrabold text-rose-700 block mt-0.5">
                  ₹{formatCurrency(totalPaid)}
                </span>
                <span className="text-[10px] text-slate-500 font-medium">
                  {paymentsCount} supplier & bill payments
                </span>
              </div>
              <div className="h-11 w-11 rounded-2xl bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600 shrink-0">
                <ArrowUpRight className="h-5 w-5" />
              </div>
            </div>

            {/* Card 3: Net Cash Flow */}
            <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                  Net Cash Flow
                </span>
                <span className={`text-xl font-extrabold block mt-0.5 ${netCashFlow >= 0 ? 'text-indigo-900' : 'text-amber-800'}`}>
                  {netCashFlow >= 0 ? '+' : ''}₹{formatCurrency(netCashFlow)}
                </span>
                <span className="text-[10px] text-slate-500 font-medium">
                  Received minus Paid
                </span>
              </div>
              <div className="h-11 w-11 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0">
                <Wallet className="h-5 w-5" />
              </div>
            </div>

            {/* Card 4: Total Vouchers */}
            <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                  Total Vouchers
                </span>
                <span className="text-xl font-extrabold text-slate-900 block mt-0.5">
                  {payments.length}
                </span>
                <span className="text-[10px] text-slate-500 font-medium">
                  All synced transactions
                </span>
              </div>
              <div className="h-11 w-11 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700 shrink-0">
                <Receipt className="h-5 w-5" />
              </div>
            </div>
          </div>

          {/* ── Filter Tabs & Search Controls ──────────────────────────────── */}
          <div className="glass-panel p-3.5 rounded-2xl border border-slate-200 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              {/* Filter Tabs */}
              <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl">
                <button
                  type="button"
                  onClick={() => setActiveTab('ALL')}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                    activeTab === 'ALL'
                      ? 'bg-white text-slate-900 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  All Transactions ({payments.length})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('RECEIPT')}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1 ${
                    activeTab === 'RECEIPT'
                      ? 'bg-emerald-600 text-white shadow-2xs'
                      : 'text-slate-600 hover:text-emerald-700'
                  }`}
                >
                  <ArrowDownLeft className="h-3 w-3" />
                  Received ({receiptsCount})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('PAYMENT')}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1 ${
                    activeTab === 'PAYMENT'
                      ? 'bg-rose-600 text-white shadow-2xs'
                      : 'text-slate-600 hover:text-rose-700'
                  }`}
                >
                  <ArrowUpRight className="h-3 w-3" />
                  Paid ({paymentsCount})
                </button>
              </div>

              {/* Mode filter & count */}
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 text-xs">
                  <Filter className="h-3.5 w-3.5 text-slate-400" />
                  <span className="text-slate-500 font-medium">Mode:</span>
                </div>
                <select
                  value={selectedMode}
                  onChange={(e) => setSelectedMode(e.target.value)}
                  className="glass-input py-1 px-2.5 rounded-xl text-xs font-semibold bg-white border border-slate-200"
                >
                  <option value="ALL">All Modes</option>
                  <option value="CASH">CASH</option>
                  <option value="UPI">UPI</option>
                  <option value="BANK">BANK / NEFT</option>
                  <option value="CHEQUE">CHEQUE</option>
                </select>
              </div>
            </div>

            {/* Search Input Bar */}
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search by party name, voucher #, bill #, reference, or description..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full glass-input pl-10 pr-4 py-2 rounded-xl text-xs bg-white border border-slate-200 placeholder:text-slate-400 focus:border-indigo-500"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600"
                >
                  ✕ Clear
                </button>
              )}
            </div>
          </div>

          {/* ── Transactions Table ─────────────────────────────────────────── */}
          <div className="glass-panel rounded-2xl overflow-hidden border border-slate-200 bg-white">
            <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
              <div className="font-bold text-slate-900 text-xs">
                Synchronized Vouchers ({filteredPayments.length} of {payments.length})
              </div>
              <span className="text-[11px] text-slate-500 font-medium">
                Showing newest first
              </span>
            </div>

            <div className="max-h-[700px] overflow-y-auto overflow-x-auto">
              <table className="w-full min-w-[700px] text-left text-xs">
                <thead className="sticky top-0 z-10 bg-slate-50/95 backdrop-blur-xs text-slate-500 border-b border-slate-200 uppercase text-[10px] font-bold tracking-wider">
                  <tr>
                    <th className="px-4 py-3">Voucher #</th>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">Party (Customer / Supplier)</th>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Mode</th>
                    <th className="px-4 py-3">Description / Remarks</th>
                    <th className="px-4 py-3 text-right">Amount (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700 bg-white">
                  {isLoading ? (
                    [...Array(6)].map((_, i) => (
                      <tr key={i} className="animate-pulse">
                        <td className="px-4 py-3"><Skeleton className="h-4 w-28 rounded-md" /></td>
                        <td className="px-4 py-3"><Skeleton className="h-5 w-20 rounded-md" /></td>
                        <td className="px-4 py-3"><Skeleton className="h-4 w-36 rounded-md" /></td>
                        <td className="px-4 py-3"><Skeleton className="h-4 w-24 rounded-md" /></td>
                        <td className="px-4 py-3"><Skeleton className="h-4 w-16 rounded-md" /></td>
                        <td className="px-4 py-3"><Skeleton className="h-4 w-44 rounded-md" /></td>
                        <td className="px-4 py-3 text-right"><Skeleton className="h-4.5 w-24 rounded-md ml-auto" /></td>
                      </tr>
                    ))
                  ) : filteredPayments.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-8">
                        <EmptyState
                          icon={Receipt}
                          title={payments.length === 0 ? "No Payments or Receipts Found" : "No Matching Vouchers"}
                          description={
                            payments.length === 0
                              ? "Click 'Sync Payments & Receipts' to synchronize existing sales collections and purchase payments, or create a manual voucher."
                              : "No transactions match your current search and filter criteria."
                          }
                          actionLabel={payments.length === 0 ? "Sync Payments Now" : "Clear Filters"}
                          onAction={() => {
                            if (payments.length === 0) {
                              syncMutation.mutate();
                            } else {
                              setActiveTab('ALL');
                              setSelectedMode('ALL');
                              setSearchTerm('');
                            }
                          }}
                        />
                      </td>
                    </tr>
                  ) : (
                    filteredPayments.map((p: any) => {
                      const isReceipt = p.payment_type === 'RECEIPT';
                      const partyName = p.party?.name || 'General / Cash Account';
                      const partyType = p.party?.party_type;

                      return (
                        <tr key={p.id} className="hover:bg-slate-50/80 transition-colors border-b border-slate-100">
                          {/* Voucher Number & Badge */}
                          <td className="px-4 py-3">
                            <span className="font-mono font-bold text-indigo-700 block">
                              {p.voucher_number}
                            </span>
                            {p.reference_number && (
                              <span className="text-[10px] text-slate-400 font-mono truncate block max-w-[120px]">
                                Ref: {p.reference_number}
                              </span>
                            )}
                          </td>

                          {/* Type */}
                          <td className="px-4 py-3">
                            <Badge
                              variant={isReceipt ? 'success' : 'danger'}
                              size="sm"
                              className="font-bold gap-1"
                            >
                              {isReceipt ? <ArrowDownLeft className="h-3 w-3" /> : <ArrowUpRight className="h-3 w-3" />}
                              <span>{isReceipt ? 'Received' : 'Paid'}</span>
                            </Badge>
                          </td>

                          {/* Associated Party */}
                          <td className="px-4 py-3">
                            <div className="flex flex-col">
                              <span className="font-bold text-slate-900 block truncate max-w-[180px]">
                                {partyName}
                              </span>
                              {partyType && (
                                <span className={`text-[10px] font-semibold w-fit px-1.5 py-0.2 rounded ${
                                  partyType === 'CUSTOMER' ? 'bg-blue-50 text-blue-700' : 'bg-amber-50 text-amber-800'
                                }`}>
                                  {partyType}
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Date */}
                          <td className="px-4 py-3 font-medium text-slate-600 whitespace-nowrap">
                            {p.payment_date}
                          </td>

                          {/* Payment Mode */}
                          <td className="px-4 py-3">
                            <span className="px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200 font-bold text-[11px] text-slate-700">
                              {p.payment_mode}
                            </span>
                          </td>

                          {/* Description / Remarks */}
                          <td className="px-4 py-3 text-slate-600 max-w-[240px]">
                            <span className="truncate block" title={p.remarks || '—'}>
                              {p.remarks || '—'}
                            </span>
                          </td>

                          {/* Amount */}
                          <td className="px-4 py-3 text-right">
                            <span className={`text-sm font-extrabold ${isReceipt ? 'text-emerald-700' : 'text-rose-700'}`}>
                              {isReceipt ? '+' : '−'}₹{formatCurrency(p.amount)}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </main>
      </div>

      {/* ── Record New Voucher Entry Modal ─────────────────────────────────── */}
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
              className="px-4 py-2 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-md transition-all flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {createMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              <span>{createMutation.isPending ? 'Recording...' : 'Record Voucher'}</span>
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
