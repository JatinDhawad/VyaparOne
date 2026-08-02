'use client';

import { useState } from 'react';
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
  Calendar
} from 'lucide-react';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import { api } from '@/lib/api';
import Link from 'next/link';

type Period = '30d' | '90d' | '6m' | '1y' | 'all';

const PERIOD_OPTIONS: { value: Period; label: string }[] = [
  { value: '30d', label: 'Last 30 Days' },
  { value: '90d', label: 'Last 90 Days' },
  { value: '6m', label: 'Last 6 Months' },
  { value: '1y', label: 'Last 1 Year' },
  { value: 'all', label: 'All Time' },
];

export default function DashboardPage() {
  const [period, setPeriod] = useState<Period>('all');

  const { data: summary, isLoading } = useQuery({
    queryKey: ['dashboard-summary', period],
    queryFn: () => api.getDashboardSummary(period),
  });

  const fmt = (v: number | undefined) =>
    (v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 });

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Header 
          title="Executive Dashboard" 
          subtitle="Real-time trading economics, inventory valuation & profit margins" 
        />

        <main className="p-8 space-y-8 flex-1 overflow-y-auto">

          {/* Period Selector */}
          <div className="flex items-center gap-3">
            <Calendar className="h-4 w-4 text-slate-500" />
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">View Period:</span>
            <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-xl p-1 shadow-sm">
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

          {/* Top 4 KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            {/* Sales Card */}
            <div className="glass-card p-6 rounded-2xl relative overflow-hidden border-indigo-100">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-indigo-700">Total Sales</span>
                <div className="h-10 w-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
                  <ShoppingCart className="h-5 w-5" />
                </div>
              </div>
              <div className="mt-4">
                <h3 className="text-2xl font-bold text-slate-900 tracking-tight">
                  ₹{isLoading ? '...' : fmt(summary?.total_sales)}
                </h3>
                <p className="text-[11px] font-medium text-slate-500 mt-1">Gross sales invoices billing</p>
              </div>
            </div>

            {/* Purchases Card — with billed/unbilled breakdown */}
            <div className="glass-card p-6 rounded-2xl relative overflow-hidden border-slate-200">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-600">Total Purchases</span>
                <div className="h-10 w-10 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700">
                  <ShoppingBag className="h-5 w-5" />
                </div>
              </div>
              <div className="mt-4">
                <h3 className="text-2xl font-bold text-slate-900 tracking-tight">
                  ₹{isLoading ? '...' : fmt(summary?.total_purchases)}
                </h3>
                <div className="mt-2 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-semibold text-slate-500">Billed (GST Invoice)</span>
                    <span className="text-[10px] font-bold text-slate-700">₹{isLoading ? '...' : fmt(summary?.total_billed_purchases)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-semibold text-amber-600">+ Unbilled (Non-GST)</span>
                    <span className="text-[10px] font-bold text-amber-700">₹{isLoading ? '...' : fmt(summary?.total_unbilled_purchases)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Net Profit Card */}
            <div className="glass-card p-6 rounded-2xl relative overflow-hidden border-emerald-200 bg-gradient-to-br from-emerald-50/50 to-white glow-emerald">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-700">Net Profit</span>
                <div className="h-10 w-10 rounded-xl bg-emerald-100 border border-emerald-200 flex items-center justify-center text-emerald-600">
                  <TrendingUp className="h-5 w-5" />
                </div>
              </div>
              <div className="mt-4">
                <h3 className="text-2xl font-extrabold text-emerald-700 tracking-tight">
                  ₹{isLoading ? '...' : fmt(summary?.net_profit)}
                </h3>
                <p className="text-[11px] font-medium text-slate-500 mt-1">Gross profit minus operational expenses</p>
              </div>
            </div>

            {/* Operational Expenses Card */}
            <div className="glass-card p-6 rounded-2xl relative overflow-hidden border-rose-100">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-rose-700">Expenses</span>
                <div className="h-10 w-10 rounded-xl bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600">
                  <TrendingDown className="h-5 w-5" />
                </div>
              </div>
              <div className="mt-4">
                <h3 className="text-2xl font-bold text-slate-900 tracking-tight">
                  ₹{isLoading ? '...' : fmt(summary?.total_operational_expenses)}
                </h3>
                <p className="text-[11px] font-medium text-slate-500 mt-1">Fuel, rent, godown maintenance</p>
              </div>
            </div>
          </div>

          {/* Quick POS & Billing Launcher */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 flex flex-col md:flex-row items-center justify-between gap-4 shadow-sm">
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <ShoppingCart className="h-5 w-5 text-emerald-600" />
                Quick Billing & Transactions Launcher
              </h3>
              <p className="text-xs font-medium text-slate-500 mt-1">Generate new Sales Tax Invoice or record Supplier Purchase Bill with automatic double-entry ledger posting.</p>
            </div>
            <div className="flex items-center gap-3">
              <Link
                href="/sales"
                className="px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs rounded-xl shadow-md shadow-emerald-500/15 transition-all flex items-center gap-2"
              >
                <Plus className="h-4 w-4" />
                New Sales POS
              </Link>
              <Link
                href="/purchases"
                className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-xl border border-slate-200 transition-all flex items-center gap-2"
              >
                <Plus className="h-4 w-4" />
                New Purchase Bill
              </Link>
            </div>
          </div>

          {/* Outstanding Receivables vs Payables & Alert Banner */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Receivables */}
            <div className="glass-card p-6 rounded-2xl border-slate-200 space-y-4">
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
                  ₹{isLoading ? '...' : fmt(summary?.total_receivables)}
                </p>
                <p className="text-xs font-medium text-slate-500 mt-1">Outstanding payments owed by buyers</p>
              </div>
            </div>

            {/* Payables */}
            <div className="glass-card p-6 rounded-2xl border-slate-200 space-y-4">
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
                  ₹{isLoading ? '...' : fmt(summary?.total_payables)}
                </p>
                <p className="text-xs font-medium text-slate-500 mt-1">Outstanding bills owed to vendors</p>
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
                  <span className="text-3xl font-extrabold text-amber-700">{isLoading ? '...' : summary?.low_stock_items_count || 0}</span>
                  <span className="text-xs font-bold text-slate-700">Out-of-Stock Items (0 stock balance)</span>
                </div>
                <p className="text-xs font-medium text-slate-500 mt-2">Record purchase bills to directly create and increment product stock.</p>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
