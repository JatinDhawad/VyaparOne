'use client';

import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  ArrowUpRight, 
  ArrowDownLeft, 
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
import { api } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';
import { toast } from 'sonner';
import { Skeleton, EmptyState, Badge } from '@/components/ui';

export default function PaymentsPage() {
  const queryClient = useQueryClient();

  // Filter & Search states
  const [activeTab, setActiveTab] = useState<'ALL' | 'RECEIPT' | 'PAYMENT'>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMode, setSelectedMode] = useState('ALL');

  // ── Queries ────────────────────────────────────────────────────────────────
  const { data: payments = [], isLoading, isFetching } = useQuery({
    queryKey: ['payments'],
    queryFn: () => api.getPayments(),
  });

  // ── Sync Mutation ──────────────────────────────────────────────────────────
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

  // ── Overall KPIs & Calculations ────────────────────────────────────────────
  const { totalReceived, totalPaid, netCashFlow } = useMemo(() => {
    let recSum = 0;
    let paySum = 0;

    for (const p of payments) {
      const amt = parseFloat(p.amount || 0);
      if (p.payment_type === 'RECEIPT') {
        recSum += amt;
      } else if (p.payment_type === 'PAYMENT') {
        paySum += amt;
      }
    }

    return {
      totalReceived: recSum,
      totalPaid: paySum,
      netCashFlow: recSum - paySum,
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
              className="flex items-center gap-2 px-3.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-bold transition-all shadow-2xs disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
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
                  Total Received
                </span>
                <span className="text-xl font-extrabold text-emerald-700 block mt-0.5">
                  ₹{formatCurrency(totalReceived)}
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
                  Total Paid
                </span>
                <span className="text-xl font-extrabold text-rose-700 block mt-0.5">
                  ₹{formatCurrency(totalPaid)}
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
              </div>
              <div className="h-11 w-11 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0">
                <Wallet className="h-5 w-5" />
              </div>
            </div>

            {/* Card 4: Total Transactions */}
            <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                  Total Transactions
                </span>
                <span className="text-xl font-extrabold text-slate-900 block mt-0.5">
                  {payments.length}
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
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
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
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                    activeTab === 'RECEIPT'
                      ? 'bg-emerald-600 text-white shadow-2xs'
                      : 'text-slate-600 hover:text-emerald-700'
                  }`}
                >
                  <ArrowDownLeft className="h-3.5 w-3.5" />
                  <span>Received (Receipts)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('PAYMENT')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                    activeTab === 'PAYMENT'
                      ? 'bg-rose-600 text-white shadow-2xs'
                      : 'text-slate-600 hover:text-rose-700'
                  }`}
                >
                  <ArrowUpRight className="h-3.5 w-3.5" />
                  <span>Paid (Payments)</span>
                </button>
              </div>

              {/* Payment Mode Selector */}
              <div className="flex items-center gap-2">
                <Filter className="h-3.5 w-3.5 text-slate-400" />
                <span className="text-xs text-slate-500 font-semibold">Mode:</span>
                <select
                  value={selectedMode}
                  onChange={(e) => setSelectedMode(e.target.value)}
                  className="px-2.5 py-1 text-xs font-bold bg-white border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="ALL">All Modes</option>
                  <option value="CASH">Cash</option>
                  <option value="UPI">UPI / Online</option>
                  <option value="BANK">Bank Transfer</option>
                  <option value="CHEQUE">Cheque</option>
                </select>
              </div>
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by party name, voucher #, bill #, reference, or description..."
                className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600 font-bold"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          {/* ── Transactions Table ─────────────────────────────────────────── */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700">
                Synchronized Transactions ({filteredPayments.length} of {payments.length})
              </span>
              {isFetching && !isLoading && (
                <span className="text-[11px] text-indigo-600 font-semibold flex items-center gap-1.5">
                  <RefreshCw className="h-3 w-3 animate-spin" />
                  Updating...
                </span>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50/75 text-slate-500 font-semibold border-b border-slate-100 uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">Party Name</th>
                    <th className="px-4 py-3">Voucher #</th>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Mode</th>
                    <th className="px-4 py-3">Reference / Notes</th>
                    <th className="px-4 py-3 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {isLoading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <tr key={i} className="animate-pulse">
                        <td className="px-4 py-3"><Skeleton className="h-5 w-16 rounded-md" /></td>
                        <td className="px-4 py-3"><Skeleton className="h-5 w-28 rounded-md" /></td>
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
                          title={payments.length === 0 ? "No Payments or Receipts Found" : "No Matching Transactions"}
                          description={
                            payments.length === 0
                              ? "Click 'Sync Payments & Receipts' to synchronize sales collections and purchase payments."
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
                        <tr key={p.id} className="hover:bg-slate-50/80 transition-colors">
                          {/* Type Badge */}
                          <td className="px-4 py-3 whitespace-nowrap">
                            {isReceipt ? (
                              <Badge variant="success" className="gap-1 font-bold">
                                <ArrowDownLeft className="h-3 w-3" />
                                RECEIPT
                              </Badge>
                            ) : (
                              <Badge variant="danger" className="gap-1 font-bold">
                                <ArrowUpRight className="h-3 w-3" />
                                PAYMENT
                              </Badge>
                            )}
                          </td>

                          {/* Party */}
                          <td className="px-4 py-3">
                            <div className="font-bold text-slate-900 flex items-center gap-1.5">
                              {partyName}
                              {partyType && (
                                <span className={`text-[10px] px-1.5 py-0.2 rounded font-semibold uppercase ${
                                  partyType === 'CUSTOMER' ? 'bg-blue-50 text-blue-700' : 'bg-amber-50 text-amber-800'
                                }`}>
                                  {partyType}
                                </span>
                              )}
                            </div>
                            {p.party?.phone && (
                              <div className="text-[11px] text-slate-400 font-mono">
                                {p.party.phone}
                              </div>
                            )}
                          </td>

                          {/* Voucher Number & Badge */}
                          <td className="px-4 py-3 whitespace-nowrap font-mono font-bold text-slate-800">
                            <div className="flex items-center gap-1.5">
                              {p.voucher_number}
                              {p.voucher_number?.startsWith('REC-') && (
                                <span className="text-[9px] px-1 py-0.5 rounded bg-emerald-50 text-emerald-700 font-sans font-bold">
                                  Auto-Sales
                                </span>
                              )}
                              {p.voucher_number?.startsWith('PAY-SUP-') && (
                                <span className="text-[9px] px-1 py-0.5 rounded bg-indigo-50 text-indigo-700 font-sans font-bold">
                                  Supplier Lumppay
                                </span>
                              )}
                              {p.voucher_number?.startsWith('PAY-PUR-') && (
                                <span className="text-[9px] px-1 py-0.5 rounded bg-amber-50 text-amber-800 font-sans font-bold">
                                  Bill Payment
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Date */}
                          <td className="px-4 py-3 whitespace-nowrap text-slate-600">
                            {p.payment_date || (p.created_at ? new Date(p.created_at).toISOString().split('T')[0] : '—')}
                          </td>

                          {/* Mode */}
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-semibold text-[11px]">
                              <CreditCard className="h-3 w-3 text-slate-500" />
                              {p.payment_mode || 'CASH'}
                            </span>
                          </td>

                          {/* Reference / Remarks */}
                          <td className="px-4 py-3 max-w-xs">
                            <div className="truncate text-slate-800 font-medium" title={p.remarks || p.reference_number || '—'}>
                              {p.remarks || p.reference_number || '—'}
                            </div>
                            {p.reference_number && p.remarks && p.remarks !== p.reference_number && (
                              <div className="text-[10px] text-slate-400 font-mono truncate" title={p.reference_number}>
                                Ref: {p.reference_number}
                              </div>
                            )}
                          </td>

                          {/* Amount */}
                          <td className="px-4 py-3 text-right whitespace-nowrap">
                            <span className={`text-sm font-extrabold ${isReceipt ? 'text-emerald-700' : 'text-rose-700'}`}>
                              {isReceipt ? '+' : '−'}₹{formatCurrency(p.amount || 0)}
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
    </div>
  );
}
