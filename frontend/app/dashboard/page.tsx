'use client';

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
  TrendingUp, 
  TrendingDown, 
  ShoppingBag, 
  ShoppingCart, 
  AlertTriangle, 
  CreditCard,
  Plus,
  ArrowUpRight,
  ArrowDownLeft,
  Calendar,
  Clock,
  Receipt,
  FileText,
  Package,
  Layers,
  ArrowRight,
  CheckCircle2,
  Filter
} from 'lucide-react';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import { api } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';
import Link from 'next/link';

type Period = '30d' | '90d' | '6m' | '1y' | 'all';
type TxFilter = 'ALL' | 'SALES' | 'PURCHASES' | 'PAYMENTS';

const PERIOD_OPTIONS: { value: Period; label: string }[] = [
  { value: '30d', label: 'Last 30 Days' },
  { value: '90d', label: 'Last 90 Days' },
  { value: '6m', label: 'Last 6 Months' },
  { value: '1y', label: 'Last 1 Year' },
  { value: 'all', label: 'All Time' },
];

export default function DashboardPage() {
  const [period, setPeriod] = useState<Period>('all');
  const [txFilter, setTxFilter] = useState<TxFilter>('ALL');
  const [txLimit, setTxLimit] = useState<number>(5);

  const { data: summary, isLoading: isSummaryLoading } = useQuery({
    queryKey: ['dashboard-summary', period],
    queryFn: () => api.getDashboardSummary(period),
  });

  const { data: sales = [], isLoading: isSalesLoading } = useQuery({
    queryKey: ['sales'],
    queryFn: () => api.getSales(),
  });

  const { data: purchases = [], isLoading: isPurchasesLoading } = useQuery({
    queryKey: ['purchases'],
    queryFn: () => api.getPurchases(),
  });

  const { data: payments = [] } = useQuery({
    queryKey: ['payments'],
    queryFn: () => api.getPayments(),
  });

  const { data: products = [] } = useQuery({
    queryKey: ['products'],
    queryFn: () => api.getProducts(),
  });

  // Combine and normalize recent transactions
  const normalizedTransactions = useMemo(() => {
    const list: any[] = [];

    sales.forEach((s: any) => {
      list.push({
        id: s.id,
        type: 'SALE',
        invoice_number: s.invoice_number,
        date: s.invoice_date,
        party_name: s.customer?.name || 'Walk-in Customer',
        party_id: s.customer_id,
        location: s.location,
        amount: parseFloat(s.grand_total || 0),
        amount_paid: parseFloat(s.amount_paid || 0),
        pending: parseFloat(s.pending_amount || 0),
        created_at: s.created_at || s.invoice_date,
        link: '/sales',
      });
    });

    purchases.forEach((p: any) => {
      list.push({
        id: p.id,
        type: 'PURCHASE',
        invoice_number: p.invoice_number,
        date: p.invoice_date,
        party_name: p.supplier?.name || 'Supplier / Vendor',
        party_id: p.supplier_id,
        location: null,
        amount: parseFloat(p.total_payable_amount || p.grand_total || 0),
        amount_paid: parseFloat(p.amount_paid || 0),
        pending: parseFloat(p.pending_amount || 0),
        created_at: p.created_at || p.invoice_date,
        link: '/purchases',
      });
    });

    payments.forEach((pm: any) => {
      list.push({
        id: pm.id,
        type: pm.payment_type || 'PAYMENT',
        invoice_number: pm.voucher_number || pm.reference_number || 'VOUCHER',
        date: pm.payment_date,
        party_name: pm.party?.name || 'Party Settlement',
        party_id: pm.party_id,
        location: null,
        amount: parseFloat(pm.amount || 0),
        amount_paid: parseFloat(pm.amount || 0),
        pending: 0,
        created_at: pm.created_at || pm.payment_date,
        link: '/payments',
      });
    });

    // Sort by date / created_at descending
    return list.sort((a, b) => new Date(b.date || b.created_at).getTime() - new Date(a.date || a.created_at).getTime());
  }, [sales, purchases, payments]);

  const filteredTransactions = useMemo(() => {
    if (txFilter === 'SALES') return normalizedTransactions.filter(t => t.type === 'SALE');
    if (txFilter === 'PURCHASES') return normalizedTransactions.filter(t => t.type === 'PURCHASE');
    if (txFilter === 'PAYMENTS') return normalizedTransactions.filter(t => t.type === 'PAYMENT' || t.type === 'RECEIPT');
    return normalizedTransactions;
  }, [normalizedTransactions, txFilter]);

  const recentTransactions = filteredTransactions.slice(0, txLimit);
  const isTxLoading = isSalesLoading || isPurchasesLoading;

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Header title="Executive Dashboard" />

        <main className="p-8 space-y-8 flex-1 overflow-y-auto">

          {/* Period Selector & Quick Actions Top Row */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Calendar className="h-4 w-4 text-slate-500" />
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">View Period:</span>
              <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-xl p-1 shadow-xs">
                {PERIOD_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setPeriod(opt.value)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      period === opt.value
                        ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20'
                        : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Quick Action Pills */}
            <div className="flex items-center gap-2">
              <Link
                href="/sales"
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>New Sale POS</span>
              </Link>
              <Link
                href="/purchases"
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-extrabold text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>New Purchase</span>
              </Link>
            </div>
          </div>

          {/* Top 4 KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            {/* Sales Card */}
            <div className="glass-card p-6 rounded-2xl relative overflow-hidden border-indigo-100 flex flex-col justify-between min-h-[140px] bg-white">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-indigo-700">Total Sales</span>
                <div className="h-10 w-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
                  <ShoppingCart className="h-5 w-5" />
                </div>
              </div>
              <div className="mt-4">
                <h3 className="text-2xl font-extrabold text-slate-900 tracking-tight">
                  ₹{isSummaryLoading ? '...' : formatCurrency(summary?.total_sales)}
                </h3>
              </div>
            </div>

            {/* Purchases Card — with billed/unbilled breakdown */}
            <div className="glass-card p-6 rounded-2xl relative overflow-hidden border-slate-200 flex flex-col justify-between min-h-[140px] bg-white">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-600">Total Purchases</span>
                <div className="h-10 w-10 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700">
                  <ShoppingBag className="h-5 w-5" />
                </div>
              </div>
              <div className="mt-4">
                <h3 className="text-2xl font-extrabold text-slate-900 tracking-tight">
                  ₹{isSummaryLoading ? '...' : formatCurrency(summary?.total_purchases)}
                </h3>
                <div className="mt-3 space-y-1 pt-2 border-t border-slate-100">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-600">Billed (GST Invoice)</span>
                    <span className="font-bold text-slate-900">₹{isSummaryLoading ? '...' : formatCurrency(summary?.total_billed_purchases)}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-amber-700">+ Unbilled (Non-GST)</span>
                    <span className="font-bold text-amber-800">₹{isSummaryLoading ? '...' : formatCurrency(summary?.total_unbilled_purchases)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Net Profit Card */}
            <div className="glass-card p-6 rounded-2xl relative overflow-hidden border-emerald-200 bg-gradient-to-br from-emerald-50/50 to-white glow-emerald flex flex-col justify-between min-h-[140px]">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-700">Net Profit</span>
                <div className="h-10 w-10 rounded-xl bg-emerald-100 border border-emerald-200 flex items-center justify-center text-emerald-600">
                  <TrendingUp className="h-5 w-5" />
                </div>
              </div>
              <div className="mt-4">
                <h3 className="text-2xl font-extrabold text-emerald-700 tracking-tight">
                  ₹{isSummaryLoading ? '...' : formatCurrency(summary?.net_profit)}
                </h3>
              </div>
            </div>

            {/* Operational Expenses Card */}
            <div className="glass-card p-6 rounded-2xl relative overflow-hidden border-rose-100 flex flex-col justify-between min-h-[140px] bg-white">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-rose-700">Expenses</span>
                <div className="h-10 w-10 rounded-xl bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600">
                  <TrendingDown className="h-5 w-5" />
                </div>
              </div>
              <div className="mt-4">
                <h3 className="text-2xl font-extrabold text-slate-900 tracking-tight">
                  ₹{isSummaryLoading ? '...' : formatCurrency(summary?.total_operational_expenses)}
                </h3>
              </div>
            </div>
          </div>

          {/* ── 2-Column Section: Recent Transactions Activity + Live Godown Stock ── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

            {/* Left 2 Columns: Recent Transactions Activity Feed */}
            <div className="lg:col-span-2 glass-card p-6 rounded-3xl border-slate-200 space-y-5 bg-white">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
                <div className="flex items-center gap-2.5">
                  <div className="h-9 w-9 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
                    <Clock className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-base font-extrabold text-slate-900 leading-none">Recent Transactions</h3>
                    <p className="text-[11px] text-slate-500 font-medium mt-1">Live feed of your latest sales, purchases & receipts</p>
                  </div>
                </div>

                {/* Filters & Limit Selector */}
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="flex bg-slate-100 p-0.5 rounded-xl border border-slate-200 text-xs">
                    {(['ALL', 'SALES', 'PURCHASES'] as TxFilter[]).map((f) => (
                      <button
                        key={f}
                        onClick={() => setTxFilter(f)}
                        className={`px-2.5 py-1 font-bold rounded-lg text-[11px] transition-all ${
                          txFilter === f
                            ? 'bg-white text-indigo-700 shadow-2xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        {f === 'ALL' ? 'All' : f === 'SALES' ? 'Sales' : 'Purchases'}
                      </button>
                    ))}
                  </div>

                  <div className="flex bg-slate-100 p-0.5 rounded-xl border border-slate-200 text-xs">
                    {[5, 10].map((lim) => (
                      <button
                        key={lim}
                        onClick={() => setTxLimit(lim)}
                        className={`px-2 py-1 font-bold rounded-lg text-[11px] transition-all ${
                          txLimit === lim
                            ? 'bg-indigo-600 text-white shadow-2xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        {lim}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Transaction List */}
              <div className="space-y-3">
                {isTxLoading ? (
                  <div className="py-12 text-center text-slate-400 text-xs">Loading transaction feed...</div>
                ) : recentTransactions.length === 0 ? (
                  <div className="py-12 text-center text-slate-400 text-xs">No transactions recorded yet.</div>
                ) : (
                  recentTransactions.map((tx) => {
                    const isSale = tx.type === 'SALE';
                    const isPurch = tx.type === 'PURCHASE';
                    const isSettled = tx.pending <= 0;

                    return (
                      <div
                        key={`${tx.type}-${tx.id}`}
                        className="p-3.5 rounded-2xl border border-slate-100 hover:border-indigo-200 hover:bg-indigo-50/20 transition-all flex items-center justify-between gap-4 group"
                      >
                        {/* Type Icon & Details */}
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={`h-10 w-10 rounded-2xl flex items-center justify-center shrink-0 border ${
                            isSale
                              ? 'bg-emerald-50 text-emerald-600 border-emerald-200'
                              : isPurch
                              ? 'bg-amber-50 text-amber-700 border-amber-200'
                              : 'bg-indigo-50 text-indigo-600 border-indigo-200'
                          }`}>
                            {isSale ? (
                              <ArrowDownLeft className="h-5 w-5" />
                            ) : isPurch ? (
                              <ArrowUpRight className="h-5 w-5" />
                            ) : (
                              <CreditCard className="h-5 w-5" />
                            )}
                          </div>

                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-xs font-extrabold text-slate-900 truncate">
                                #{tx.invoice_number}
                              </span>
                              <span className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-lg border ${
                                isSale
                                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                  : isPurch
                                  ? 'bg-amber-50 text-amber-800 border-amber-200'
                                  : 'bg-indigo-50 text-indigo-800 border-indigo-200'
                              }`}>
                                {tx.type}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-600 truncate">
                              <span className="font-semibold text-slate-800 truncate">{tx.party_name}</span>
                              <span className="text-slate-300">•</span>
                              <span className="text-slate-500 shrink-0 text-[11px]">{tx.date}</span>
                            </div>
                          </div>
                        </div>

                        {/* Amount & Status Badge */}
                        <div className="flex items-center gap-4 shrink-0">
                          <div className="text-right">
                            <div className={`text-sm font-black ${
                              isSale ? 'text-emerald-700' : isPurch ? 'text-slate-900' : 'text-indigo-700'
                            }`}>
                              {isSale ? '+' : isPurch ? '-' : ''}₹{formatCurrency(tx.amount)}
                            </div>
                            <div className="text-[10px] font-extrabold mt-0.5">
                              {isSettled ? (
                                <span className="text-emerald-600">✓ Settled</span>
                              ) : (
                                <span className="text-rose-600">Due: ₹{formatCurrency(tx.pending)}</span>
                              )}
                            </div>
                          </div>

                          <Link
                            href={tx.link}
                            className="p-2 rounded-xl bg-slate-100 hover:bg-indigo-50 text-slate-400 hover:text-indigo-600 transition-colors opacity-0 group-hover:opacity-100"
                            title="Go to billing page"
                          >
                            <ArrowRight className="h-4 w-4" />
                          </Link>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Bottom Link to Full Transactions */}
              <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                <span className="text-slate-500 font-medium">Showing {recentTransactions.length} of {filteredTransactions.length} transactions</span>
                <div className="flex items-center gap-3 font-bold text-indigo-600">
                  <Link href="/sales" className="hover:underline flex items-center gap-1">
                    All Sales <ArrowRight className="h-3 w-3" />
                  </Link>
                  <span className="text-slate-300">•</span>
                  <Link href="/purchases" className="hover:underline flex items-center gap-1">
                    All Purchases <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>
              </div>
            </div>

            {/* Right Column: Live Godown Stock Overview */}
            <div className="glass-card p-6 rounded-3xl border-slate-200 space-y-5 bg-white flex flex-col justify-between">
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2">
                    <Package className="h-4 w-4 text-violet-600" />
                    <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider">Live Inventory</h3>
                  </div>
                  <Link href="/products" className="text-xs text-indigo-600 hover:underline flex items-center gap-1 font-bold">
                    View All <ArrowUpRight className="h-3 w-3" />
                  </Link>
                </div>

                {/* Stock Items List */}
                <div className="space-y-3">
                  {products.map((prod: any) => {
                    const stock = prod.stock?.current_stock ?? 0;
                    const ppb = prod.packets_per_bag || 1;
                    const bags = ppb > 1 ? (stock / ppb).toFixed(1) : null;

                    return (
                      <div key={prod.id} className="p-3 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1.5">
                        <div className="flex items-start justify-between gap-2">
                          <span className="font-extrabold text-slate-900 text-xs leading-snug">{prod.name}</span>
                          <span className="text-[10px] font-extrabold text-slate-500 bg-white px-2 py-0.5 rounded-lg border border-slate-200 shrink-0">
                            1 Bag = {ppb} PKT
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-200/60">
                          <span className="text-[11px] text-slate-500 font-medium">Available Stock</span>
                          <div className="text-right">
                            <span className="font-black text-indigo-900 text-sm">{stock.toLocaleString()} {prod.unit}</span>
                            {bags && (
                              <span className="text-[10px] font-bold text-slate-500 block">({bags} Bags)</span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Inventory Summary Note */}
              <div className="p-3.5 rounded-2xl bg-gradient-to-br from-indigo-900 to-slate-900 text-white space-y-1">
                <span className="text-[10px] font-black uppercase tracking-widest text-indigo-300 block">Auto-Unpack Active</span>
                <p className="text-[11px] text-slate-300 font-medium">All new purchases automatically convert bag counts directly to packet stock.</p>
              </div>
            </div>

          </div>

          {/* Outstanding Receivables vs Payables & Alert Banner */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Receivables */}
            <div className="glass-card p-6 rounded-2xl border-slate-200 space-y-4 bg-white">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
                  <CreditCard className="h-4 w-4 text-emerald-600" />
                  Customer Receivables
                </span>
                <Link href="/reports" className="text-xs text-indigo-600 hover:underline flex items-center gap-1 font-bold">
                  View <ArrowUpRight className="h-3 w-3" />
                </Link>
              </div>
              <div>
                <p className="text-3xl font-extrabold text-slate-900">
                  ₹{isSummaryLoading ? '...' : formatCurrency(summary?.total_receivables)}
                </p>
              </div>
            </div>

            {/* Payables */}
            <div className="glass-card p-6 rounded-2xl border-slate-200 space-y-4 bg-white">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
                  <CreditCard className="h-4 w-4 text-rose-600" />
                  Supplier Payables
                </span>
                <Link href="/reports" className="text-xs text-indigo-600 hover:underline flex items-center gap-1 font-bold">
                  View <ArrowUpRight className="h-3 w-3" />
                </Link>
              </div>
              <div>
                <p className="text-3xl font-extrabold text-slate-900">
                  ₹{isSummaryLoading ? '...' : formatCurrency(summary?.total_payables)}
                </p>
              </div>
            </div>

            {/* Out of Stock Banner */}
            <div className="glass-card p-6 rounded-2xl border-amber-200 bg-amber-50/50 space-y-4">
              <div className="flex items-center justify-between border-b border-amber-100 pb-3">
                <span className="text-xs font-bold text-amber-800 uppercase tracking-wider flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                  Inventory Health
                </span>
                <Link href="/products" className="text-xs text-amber-700 hover:underline flex items-center gap-1 font-bold">
                  Manage <ArrowUpRight className="h-3 w-3" />
                </Link>
              </div>
              <div>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-extrabold text-amber-700">{isSummaryLoading ? '...' : summary?.low_stock_items_count || 0}</span>
                  <span className="text-xs font-bold text-slate-700">Out-of-Stock Items</span>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
