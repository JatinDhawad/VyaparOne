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
  Filter,
  Users,
  Sparkles
} from 'lucide-react';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import { api } from '@/lib/api';
import { formatCurrency, formatCompactCurrency } from '@/lib/utils';
import Link from 'next/link';
import { Skeleton, FilterChip, Badge } from '@/components/ui';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

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

  const { data: products = [], isLoading: isProductsLoading } = useQuery({
    queryKey: ['products'],
    queryFn: () => api.getProducts(),
  });

  const { data: parties = [], isLoading: isPartiesLoading } = useQuery({
    queryKey: ['parties'],
    queryFn: () => api.getParties(),
  });

  // ── First-Run Onboarding Step Completion ──────────────────────────────────
  const hasParties = parties.length > 0;
  const hasProducts = products.length > 0;
  const hasPurchases = purchases.length > 0;
  const hasSales = sales.length > 0;

  const completedStepsCount = (hasParties ? 1 : 0) + (hasProducts ? 1 : 0) + (hasPurchases ? 1 : 0) + (hasSales ? 1 : 0);
  const isFirstRunSetup = !isSalesLoading && !isPurchasesLoading && !isProductsLoading && !isPartiesLoading && (sales.length === 0 && purchases.length === 0);

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

  // ── Derived Time-Series Trend Chart Data ──────────────────────────────────
  const trendData = useMemo(() => {
    const now = new Date();
    let cutoff = 0;
    if (period === '30d') cutoff = now.getTime() - 30 * 86400000;
    else if (period === '90d') cutoff = now.getTime() - 90 * 86400000;
    else if (period === '6m') cutoff = now.getTime() - 180 * 86400000;
    else if (period === '1y') cutoff = now.getTime() - 365 * 86400000;

    const dateMap: Record<string, { date: string; label: string; rawDate: Date; sales: number; purchases: number }> = {};

    sales.forEach((s: any) => {
      const d = new Date(s.invoice_date || s.created_at);
      if (isNaN(d.getTime())) return;
      if (cutoff > 0 && d.getTime() < cutoff) return;
      const key = d.toISOString().split('T')[0];
      if (!dateMap[key]) {
        dateMap[key] = {
          date: key,
          label: d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }),
          rawDate: d,
          sales: 0,
          purchases: 0,
        };
      }
      dateMap[key].sales += parseFloat(s.grand_total || 0);
    });

    purchases.forEach((p: any) => {
      const d = new Date(p.invoice_date || p.created_at);
      if (isNaN(d.getTime())) return;
      if (cutoff > 0 && d.getTime() < cutoff) return;
      const key = d.toISOString().split('T')[0];
      if (!dateMap[key]) {
        dateMap[key] = {
          date: key,
          label: d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }),
          rawDate: d,
          sales: 0,
          purchases: 0,
        };
      }
      dateMap[key].purchases += parseFloat(p.total_payable_amount || p.grand_total || 0);
    });

    return Object.values(dateMap).sort((a, b) => a.rawDate.getTime() - b.rawDate.getTime());
  }, [sales, purchases, period]);

  // ── Derived Receivables vs Payables Donut Data ───────────────────────────
  const donutData = useMemo(() => {
    const rec = parseFloat(summary?.total_receivables || 0);
    const pay = parseFloat(summary?.total_payables || 0);
    if (rec === 0 && pay === 0) return [];
    return [
      { name: 'Receivables (Owed to You)', value: rec, color: '#10b981' },
      { name: 'Payables (You Owe)', value: pay, color: '#6366f1' },
    ];
  }, [summary]);

  const netDues = (parseFloat(summary?.total_receivables || 0) - parseFloat(summary?.total_payables || 0));
  const isChartLoading = isSalesLoading || isPurchasesLoading;

  // ── Custom Tooltips for Recharts ──────────────────────────────────────────
  const CustomTrendTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="glass-card p-3 rounded-2xl border border-slate-200/80 shadow-xl bg-white/95 backdrop-blur-md text-xs space-y-1.5 min-w-[170px]">
          <p className="font-extrabold text-slate-900 border-b border-slate-100 pb-1">{label}</p>
          {payload.map((entry: any) => (
            <div key={entry.dataKey} className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-1.5 text-slate-600 font-semibold">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: entry.color }} />
                {entry.name}
              </span>
              <span className="font-extrabold text-slate-900">
                ₹{formatCurrency(entry.value)}
              </span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  const CustomDonutTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0];
      return (
        <div className="glass-card p-3 rounded-2xl border border-slate-200/80 shadow-xl bg-white/95 backdrop-blur-md text-xs space-y-1 min-w-[160px]">
          <p className="font-extrabold text-slate-900">{data.name}</p>
          <p className="font-extrabold text-base" style={{ color: data.payload.color }}>
            ₹{formatCurrency(data.value)}
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Header title="Executive Dashboard" />

        <main className="p-8 space-y-8 flex-1 overflow-y-auto">

          {/* Period Selector & Quick Actions Top Row */}
          <div className="space-y-3">
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

            {/* Active Period Filter Chip */}
            {period !== 'all' && (
              <div className="flex items-center gap-2 flex-wrap animate-in fade-in slide-in-from-top-1">
                <span className="text-[11px] font-bold text-slate-400">Active Filter:</span>
                <FilterChip
                  label="Period"
                  value={PERIOD_OPTIONS.find(o => o.value === period)?.label}
                  onRemove={() => setPeriod('all')}
                />
                <button
                  onClick={() => setPeriod('all')}
                  className="text-xs font-bold text-slate-400 hover:text-rose-600 underline ml-1 transition-colors"
                >
                  Reset
                </button>
              </div>
            )}
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
                {isSummaryLoading ? (
                  <Skeleton className="h-8 w-36 rounded-xl" />
                ) : (
                  <h3 className="text-2xl font-extrabold text-slate-900 tracking-tight">
                    ₹{formatCurrency(summary?.total_sales)}
                  </h3>
                )}
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
                {isSummaryLoading ? (
                  <div className="space-y-3">
                    <Skeleton className="h-8 w-36 rounded-xl" />
                    <Skeleton className="h-4 w-full rounded-lg" />
                  </div>
                ) : (
                  <>
                    <h3 className="text-2xl font-extrabold text-slate-900 tracking-tight">
                      ₹{formatCurrency(summary?.total_purchases)}
                    </h3>
                    <div className="mt-3 space-y-1 pt-2 border-t border-slate-100">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-slate-600">Billed (GST Invoice)</span>
                        <span className="font-bold text-slate-900">₹{formatCurrency(summary?.total_billed_purchases)}</span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-amber-700">+ Unbilled (Non-GST)</span>
                        <span className="font-bold text-amber-800">₹{formatCurrency(summary?.total_unbilled_purchases)}</span>
                      </div>
                    </div>
                  </>
                )}
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
                {isSummaryLoading ? (
                  <Skeleton className="h-8 w-36 rounded-xl" />
                ) : (
                  <h3 className="text-2xl font-extrabold text-emerald-700 tracking-tight">
                    ₹{formatCurrency(summary?.net_profit)}
                  </h3>
                )}
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
                {isSummaryLoading ? (
                  <Skeleton className="h-8 w-36 rounded-xl" />
                ) : (
                  <h3 className="text-2xl font-extrabold text-slate-900 tracking-tight">
                    ₹{formatCurrency(summary?.total_operational_expenses)}
                  </h3>
                )}
              </div>
            </div>
          </div>

          {/* ── Guided First-Run Setup Checklist ── */}
          {isFirstRunSetup && (
            <div className="glass-card p-6 sm:p-8 rounded-3xl border border-indigo-200/90 bg-gradient-to-br from-indigo-50/70 via-white to-emerald-50/50 shadow-xl space-y-6 animate-in fade-in slide-in-from-top-2">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
                <div className="flex items-start gap-3.5">
                  <div className="h-12 w-12 rounded-2xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-emerald-500 flex items-center justify-center text-white shadow-md shadow-indigo-500/20 shrink-0">
                    <Sparkles className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">
                      Getting Started with VyaparOne ERP
                    </h2>
                    <p className="text-xs font-semibold text-slate-500 mt-1">
                      Complete these 4 fundamental steps to configure your trading inventory and activate live double-entry ledgers.
                    </p>
                  </div>
                </div>

                <div className="flex flex-col items-start sm:items-end shrink-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-600">Setup Progress:</span>
                    <Badge variant={completedStepsCount === 4 ? 'success' : 'info'} size="sm">
                      {completedStepsCount} of 4 Completed
                    </Badge>
                  </div>
                  <div className="w-44 h-2.5 bg-slate-200/80 rounded-full overflow-hidden mt-2">
                    <div
                      className="h-full bg-gradient-to-r from-indigo-600 to-emerald-500 rounded-full transition-all duration-500"
                      style={{ width: `${Math.max(8, (completedStepsCount / 4) * 100)}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* 4 Guided Step Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Step 1: Parties */}
                <div className={`p-5 rounded-2xl border transition-all flex flex-col justify-between space-y-4 ${
                  hasParties
                    ? 'bg-emerald-50/50 border-emerald-200/80 shadow-2xs'
                    : 'bg-white border-slate-200 hover:border-indigo-300 hover:shadow-md'
                }`}>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${
                        hasParties ? 'bg-emerald-100 text-emerald-700' : 'bg-indigo-50 text-indigo-600 border border-indigo-100'
                      }`}>
                        <Users className="h-5 w-5" />
                      </div>
                      <span className="text-[10px] font-extrabold uppercase text-slate-400">Step 1</span>
                    </div>
                    <h4 className="font-extrabold text-slate-900 text-sm">Add First Party</h4>
                    <p className="text-[11px] text-slate-500 leading-relaxed font-medium">
                      Create customer accounts for sales billing or supplier profiles for purchases.
                    </p>
                  </div>

                  <div>
                    {hasParties ? (
                      <Badge variant="success" size="sm" dot className="w-full justify-center">
                        Party Created
                      </Badge>
                    ) : (
                      <Link
                        href="/parties?openModal=true"
                        className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs rounded-xl shadow-xs transition-all flex items-center justify-center gap-1.5"
                      >
                        <span>+ Add Party</span>
                        <ArrowRight className="h-3 w-3" />
                      </Link>
                    )}
                  </div>
                </div>

                {/* Step 2: Products */}
                <div className={`p-5 rounded-2xl border transition-all flex flex-col justify-between space-y-4 ${
                  hasProducts
                    ? 'bg-emerald-50/50 border-emerald-200/80 shadow-2xs'
                    : 'bg-white border-slate-200 hover:border-indigo-300 hover:shadow-md'
                }`}>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${
                        hasProducts ? 'bg-emerald-100 text-emerald-700' : 'bg-indigo-50 text-indigo-600 border border-indigo-100'
                      }`}>
                        <Package className="h-5 w-5" />
                      </div>
                      <span className="text-[10px] font-extrabold uppercase text-slate-400">Step 2</span>
                    </div>
                    <h4 className="font-extrabold text-slate-900 text-sm">Add a Product</h4>
                    <p className="text-[11px] text-slate-500 leading-relaxed font-medium">
                      Define items with bag-to-packet auto-unpacking ratios and HSN tax codes.
                    </p>
                  </div>

                  <div>
                    {hasProducts ? (
                      <Badge variant="success" size="sm" dot className="w-full justify-center">
                        Product Added
                      </Badge>
                    ) : (
                      <Link
                        href="/products?openModal=true"
                        className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs rounded-xl shadow-xs transition-all flex items-center justify-center gap-1.5"
                      >
                        <span>+ Add Product</span>
                        <ArrowRight className="h-3 w-3" />
                      </Link>
                    )}
                  </div>
                </div>

                {/* Step 3: Purchases */}
                <div className={`p-5 rounded-2xl border transition-all flex flex-col justify-between space-y-4 ${
                  hasPurchases
                    ? 'bg-emerald-50/50 border-emerald-200/80 shadow-2xs'
                    : 'bg-white border-slate-200 hover:border-indigo-300 hover:shadow-md'
                }`}>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${
                        hasPurchases ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-50 text-amber-700 border border-amber-100'
                      }`}>
                        <ShoppingBag className="h-5 w-5" />
                      </div>
                      <span className="text-[10px] font-extrabold uppercase text-slate-400">Step 3</span>
                    </div>
                    <h4 className="font-extrabold text-slate-900 text-sm">Record Purchase</h4>
                    <p className="text-[11px] text-slate-500 leading-relaxed font-medium">
                      Inward inventory bags with freight, unbilled non-GST costs, and GST.
                    </p>
                  </div>

                  <div>
                    {hasPurchases ? (
                      <Badge variant="success" size="sm" dot className="w-full justify-center">
                        Purchase Recorded
                      </Badge>
                    ) : (
                      <Link
                        href="/purchases?openModal=true"
                        className="w-full py-2 bg-amber-600 hover:bg-amber-700 text-white font-extrabold text-xs rounded-xl shadow-xs transition-all flex items-center justify-center gap-1.5"
                      >
                        <span>+ Record Purchase</span>
                        <ArrowRight className="h-3 w-3" />
                      </Link>
                    )}
                  </div>
                </div>

                {/* Step 4: Sales */}
                <div className={`p-5 rounded-2xl border transition-all flex flex-col justify-between space-y-4 ${
                  hasSales
                    ? 'bg-emerald-50/50 border-emerald-200/80 shadow-2xs'
                    : 'bg-white border-slate-200 hover:border-indigo-300 hover:shadow-md'
                }`}>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${
                        hasSales ? 'bg-emerald-100 text-emerald-700' : 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                      }`}>
                        <ShoppingCart className="h-5 w-5" />
                      </div>
                      <span className="text-[10px] font-extrabold uppercase text-slate-400">Step 4</span>
                    </div>
                    <h4 className="font-extrabold text-slate-900 text-sm">Make First Sale</h4>
                    <p className="text-[11px] text-slate-500 leading-relaxed font-medium">
                      Generate sales POS bills with real-time landed cost margins.
                    </p>
                  </div>

                  <div>
                    {hasSales ? (
                      <Badge variant="success" size="sm" dot className="w-full justify-center">
                        Sale Completed
                      </Badge>
                    ) : (
                      <Link
                        href="/sales?openModal=true"
                        className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl shadow-xs transition-all flex items-center justify-center gap-1.5"
                      >
                        <span>+ Make Sale POS</span>
                        <ArrowRight className="h-3 w-3" />
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── Visual Analytics & Performance Charts ── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Sales Revenue vs Purchase Cost Area Chart (2 Cols) */}
            <div className="lg:col-span-2 glass-card p-6 rounded-3xl border border-slate-200/80 bg-white space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
                <div className="flex items-center gap-2.5">
                  <div className="h-9 w-9 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shadow-2xs">
                    <TrendingUp className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-base font-extrabold text-slate-900 leading-none">Revenue vs Purchase Cost</h3>
                    <p className="text-[11px] text-slate-500 font-medium mt-1">Inward purchasing expenses compared against sales turnover</p>
                  </div>
                </div>

                {/* Legend Pills */}
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 bg-indigo-50/70 border border-indigo-100 px-2.5 py-1 rounded-xl">
                    <span className="h-2.5 w-2.5 rounded-full bg-indigo-600" />
                    <span>Sales Revenue</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 bg-emerald-50/70 border border-emerald-100 px-2.5 py-1 rounded-xl">
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                    <span>Purchase Cost</span>
                  </div>
                </div>
              </div>

              {/* Chart Container */}
              <div className="h-[280px] w-full pt-2">
                {isChartLoading ? (
                  <Skeleton className="h-full w-full rounded-2xl" />
                ) : trendData.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-slate-400 text-xs space-y-1.5 border border-dashed border-slate-200 rounded-2xl p-6">
                    <TrendingUp className="h-8 w-8 text-slate-300" />
                    <p className="font-bold text-slate-600 text-sm">No transaction activity for this period</p>
                    <p className="text-slate-400 text-[11px]">Record sales or purchase bills to generate trend graphs</p>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={trendData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#6366f1" stopOpacity={0.0} />
                        </linearGradient>
                        <linearGradient id="colorPurchases" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                      <XAxis
                        dataKey="label"
                        stroke="#94a3b8"
                        fontSize={11}
                        tickLine={false}
                        axisLine={false}
                        dy={5}
                      />
                      <YAxis
                        stroke="#94a3b8"
                        fontSize={11}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(v) => '₹' + formatCompactCurrency(v)}
                        dx={-5}
                      />
                      <RechartsTooltip content={<CustomTrendTooltip />} />
                      <Area
                        type="monotone"
                        dataKey="sales"
                        name="Sales Revenue"
                        stroke="#6366f1"
                        strokeWidth={2.5}
                        fillOpacity={1}
                        fill="url(#colorSales)"
                      />
                      <Area
                        type="monotone"
                        dataKey="purchases"
                        name="Purchase Cost"
                        stroke="#10b981"
                        strokeWidth={2.5}
                        fillOpacity={1}
                        fill="url(#colorPurchases)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* Receivables vs Payables Split Donut Chart (1 Col) */}
            <div className="glass-card p-6 rounded-3xl border border-slate-200/80 bg-white space-y-4 flex flex-col justify-between">
              <div className="flex items-center gap-2.5 border-b border-slate-100 pb-4">
                <div className="h-9 w-9 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 shadow-2xs">
                  <CreditCard className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900 leading-none">Receivables vs Payables</h3>
                  <p className="text-[11px] text-slate-500 font-medium mt-1">Working capital &amp; liquidity split</p>
                </div>
              </div>

              {/* Donut Chart or Skeleton */}
              <div className="h-[200px] w-full relative flex items-center justify-center">
                {isSummaryLoading ? (
                  <Skeleton className="h-full w-full rounded-2xl" />
                ) : donutData.length === 0 ? (
                  <div className="text-center text-slate-400 text-xs border border-dashed border-slate-200 rounded-2xl p-6 w-full">
                    <p className="font-bold text-slate-600">No outstanding dues</p>
                    <p className="text-[11px]">All receivables and payables are settled</p>
                  </div>
                ) : (
                  <>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <RechartsTooltip content={<CustomDonutTooltip />} />
                        <Pie
                          data={donutData}
                          cx="50%"
                          cy="50%"
                          innerRadius={55}
                          outerRadius={80}
                          paddingAngle={4}
                          dataKey="value"
                        >
                          {donutData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} strokeWidth={0} />
                          ))}
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                      <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Net Working</span>
                      <span className="text-sm font-black text-slate-900">
                        ₹{formatCompactCurrency(netDues)}
                      </span>
                    </div>
                  </>
                )}
              </div>

              {/* Bottom Breakdown Pills */}
              <div className="space-y-2 pt-2 border-t border-slate-100">
                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5 font-bold text-emerald-800">
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                    Receivables (Owed to You)
                  </span>
                  <span className="font-extrabold text-emerald-700">₹{formatCurrency(summary?.total_receivables)}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5 font-bold text-indigo-800">
                    <span className="h-2.5 w-2.5 rounded-full bg-indigo-600" />
                    Payables (You Owe)
                  </span>
                  <span className="font-extrabold text-indigo-700">₹{formatCurrency(summary?.total_payables)}</span>
                </div>
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

              {/* Active Transaction Filters */}
              {(txFilter !== 'ALL' || txLimit !== 5) && (
                <div className="flex items-center gap-2 flex-wrap pb-1 animate-in fade-in slide-in-from-top-1">
                  <span className="text-[11px] font-bold text-slate-400">Active:</span>
                  {txFilter !== 'ALL' && (
                    <FilterChip
                      label="Type"
                      value={txFilter === 'SALES' ? 'Sales' : 'Purchases'}
                      onRemove={() => setTxFilter('ALL')}
                    />
                  )}
                  {txLimit !== 5 && (
                    <FilterChip
                      label="Showing"
                      value={`${txLimit} entries`}
                      onRemove={() => setTxLimit(5)}
                    />
                  )}
                  <button
                    onClick={() => {
                      setTxFilter('ALL');
                      setTxLimit(5);
                    }}
                    className="text-xs font-bold text-slate-400 hover:text-rose-600 underline ml-1 transition-colors"
                  >
                    Reset
                  </button>
                </div>
              )}

              {/* Transaction List */}
              <div className="space-y-3">
                {isTxLoading ? (
                  <div className="space-y-3">
                    {[...Array(5)].map((_, i) => (
                      <Skeleton key={i} className="h-16 w-full rounded-2xl" />
                    ))}
                  </div>
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
                  {isProductsLoading ? (
                    <div className="space-y-3">
                      {[...Array(4)].map((_, i) => (
                        <Skeleton key={i} className="h-16 w-full rounded-2xl" />
                      ))}
                    </div>
                  ) : (
                    products.map((prod: any) => {
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
                    })
                  )}
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
                {isSummaryLoading ? (
                  <Skeleton className="h-9 w-40 rounded-xl" />
                ) : (
                  <p className="text-3xl font-extrabold text-slate-900">
                    ₹{formatCurrency(summary?.total_receivables)}
                  </p>
                )}
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
                {isSummaryLoading ? (
                  <Skeleton className="h-9 w-40 rounded-xl" />
                ) : (
                  <p className="text-3xl font-extrabold text-slate-900">
                    ₹{formatCurrency(summary?.total_payables)}
                  </p>
                )}
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
                  {isSummaryLoading ? (
                    <Skeleton className="h-9 w-16 rounded-xl" />
                  ) : (
                    <span className="text-3xl font-extrabold text-amber-700">{summary?.low_stock_items_count || 0}</span>
                  )}
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
