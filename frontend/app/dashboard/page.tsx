'use client';

import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  ShoppingBag, 
  ShoppingCart, 
  AlertTriangle, 
  Users, 
  CreditCard,
  Plus,
  ArrowUpRight
} from 'lucide-react';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import { api } from '@/lib/api';
import Link from 'next/link';

export default function DashboardPage() {
  const { data: summary, isLoading } = useQuery({
    queryKey: ['dashboard-summary'],
    queryFn: () => api.getDashboardSummary(),
  });

  return (
    <div className="flex min-h-screen bg-[#090d16]">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Header 
          title="Executive Dashboard" 
          subtitle="Real-time trading economics, inventory valuation & profit margins" 
        />

        <main className="p-8 space-y-8 flex-1 overflow-y-auto">
          {/* Top 4 KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            {/* Sales Card */}
            <div className="glass-card p-6 rounded-2xl relative overflow-hidden border-indigo-500/20">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-indigo-400">Total Sales</span>
                <div className="h-10 w-10 rounded-xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                  <ShoppingCart className="h-5 w-5" />
                </div>
              </div>
              <div className="mt-4">
                <h3 className="text-2xl font-bold text-white tracking-tight">
                  ₹{isLoading ? '...' : (summary?.total_sales || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </h3>
                <p className="text-[11px] text-slate-400 mt-1">Gross sales invoices billing</p>
              </div>
            </div>

            {/* Purchases Card */}
            <div className="glass-card p-6 rounded-2xl relative overflow-hidden border-slate-700">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Total Purchases</span>
                <div className="h-10 w-10 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300">
                  <ShoppingBag className="h-5 w-5" />
                </div>
              </div>
              <div className="mt-4">
                <h3 className="text-2xl font-bold text-white tracking-tight">
                  ₹{isLoading ? '...' : (summary?.total_purchases || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </h3>
                <p className="text-[11px] text-slate-400 mt-1">Supplier inbound stock cost</p>
              </div>
            </div>

            {/* Net Profit Card */}
            <div className="glass-card p-6 rounded-2xl relative overflow-hidden border-emerald-500/30 glow-emerald">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400">Net Profit</span>
                <div className="h-10 w-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                  <TrendingUp className="h-5 w-5" />
                </div>
              </div>
              <div className="mt-4">
                <h3 className="text-2xl font-extrabold text-emerald-400 tracking-tight">
                  ₹{isLoading ? '...' : (summary?.net_profit || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </h3>
                <p className="text-[11px] text-slate-400 mt-1">Gross profit minus operational expenses</p>
              </div>
            </div>

            {/* Operational Expenses Card */}
            <div className="glass-card p-6 rounded-2xl relative overflow-hidden border-rose-500/20">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-rose-400">Expenses</span>
                <div className="h-10 w-10 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400">
                  <TrendingDown className="h-5 w-5" />
                </div>
              </div>
              <div className="mt-4">
                <h3 className="text-2xl font-bold text-white tracking-tight">
                  ₹{isLoading ? '...' : (summary?.total_operational_expenses || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </h3>
                <p className="text-[11px] text-slate-400 mt-1">Fuel, rent, godown maintenance</p>
              </div>
            </div>
          </div>

          {/* Quick POS & Billing Launcher */}
          <div className="glass-panel p-6 rounded-2xl border border-indigo-500/20 flex flex-col md:flex-row items-center justify-between gap-4 bg-gradient-to-r from-slate-900/90 via-indigo-950/20 to-slate-900/90">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <ShoppingCart className="h-5 w-5 text-emerald-400" />
                Quick Billing & Transactions Launcher
              </h3>
              <p className="text-xs text-slate-400 mt-1">Generate new Sales Tax Invoice or record Supplier Purchase Bill with automatic double-entry ledger posting.</p>
            </div>
            <div className="flex items-center gap-3">
              <Link
                href="/sales"
                className="px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-emerald-500/20 transition-all flex items-center gap-2"
              >
                <Plus className="h-4 w-4" />
                New Sales POS
              </Link>
              <Link
                href="/purchases"
                className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded-xl border border-slate-700 transition-all flex items-center gap-2"
              >
                <Plus className="h-4 w-4" />
                New Purchase Bill
              </Link>
            </div>
          </div>

          {/* Outstanding Receivables vs Payables & Alert Banner */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Receivables */}
            <div className="glass-card p-6 rounded-2xl border-slate-800 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
                <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                  <CreditCard className="h-4 w-4 text-emerald-400" />
                  Customer Receivables
                </span>
                <Link href="/reports" className="text-xs text-indigo-400 hover:underline flex items-center gap-1 font-semibold">
                  View <ArrowUpRight className="h-3 w-3" />
                </Link>
              </div>
              <div>
                <p className="text-3xl font-extrabold text-white">
                  ₹{isLoading ? '...' : (summary?.total_receivables || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </p>
                <p className="text-xs text-slate-400 mt-1">Outstanding payments owed by buyers</p>
              </div>
            </div>

            {/* Payables */}
            <div className="glass-card p-6 rounded-2xl border-slate-800 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
                <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                  <CreditCard className="h-4 w-4 text-rose-400" />
                  Supplier Payables
                </span>
                <Link href="/reports" className="text-xs text-indigo-400 hover:underline flex items-center gap-1 font-semibold">
                  View <ArrowUpRight className="h-3 w-3" />
                </Link>
              </div>
              <div>
                <p className="text-3xl font-extrabold text-white">
                  ₹{isLoading ? '...' : (summary?.total_payables || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </p>
                <p className="text-xs text-slate-400 mt-1">Outstanding bills owed to vendors</p>
              </div>
            </div>

            {/* Low Stock Banner */}
            <div className="glass-card p-6 rounded-2xl border-amber-500/30 bg-amber-500/5 space-y-4">
              <div className="flex items-center justify-between border-b border-amber-500/20 pb-3">
                <span className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-400" />
                  Inventory Health
                </span>
                <Link href="/products" className="text-xs text-amber-400 hover:underline flex items-center gap-1 font-semibold">
                  Manage <ArrowUpRight className="h-3 w-3" />
                </Link>
              </div>
              <div>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-extrabold text-amber-400">{isLoading ? '...' : summary?.low_stock_items_count || 0}</span>
                  <span className="text-xs font-semibold text-slate-300">Items below minimum stock threshold</span>
                </div>
                <p className="text-xs text-slate-400 mt-2">Reorder fast-moving FMCG stock to prevent out-of-stock billing delays.</p>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
