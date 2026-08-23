'use client';

import Link from 'next/link';
import { Building2, Home, ArrowLeft, FileQuestion, ShoppingCart, ShoppingBag } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background Soft Gradients */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-lg relative z-10 text-center space-y-6">
        {/* Brand Logo Header */}
        <div>
          <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-emerald-500 shadow-xl shadow-indigo-500/20 mb-3 border border-indigo-200">
            <Building2 className="h-9 w-9 text-white" />
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">
            Vyapar<span className="text-emerald-600">One</span> ERP
          </h1>
          <p className="text-xs font-semibold text-slate-500 mt-0.5">
            FMCG Trading, Landed Cost & Double-Entry Accounting
          </p>
        </div>

        {/* 404 Glass Card */}
        <div className="bg-white p-8 sm:p-10 rounded-3xl border border-slate-200/90 shadow-xl space-y-6">
          <div className="inline-flex items-center justify-center h-20 w-20 rounded-3xl bg-indigo-50 border border-indigo-100 text-indigo-600 shadow-inner">
            <FileQuestion className="h-10 w-10 text-indigo-600" />
          </div>

          <div className="space-y-2">
            <div className="inline-block px-3 py-1 rounded-full text-xs font-extrabold bg-indigo-50 text-indigo-700 border border-indigo-200 uppercase tracking-wider">
              404 — Page Not Found
            </div>
            <h2 className="text-2xl font-black text-slate-900">
              Lost in the Ledger?
            </h2>
            <p className="text-xs font-medium text-slate-500 max-w-sm mx-auto leading-relaxed">
              The financial record, transaction view, or dashboard page you requested does not exist or has been relocated.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/dashboard"
              className="w-full sm:w-auto px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs rounded-lg shadow-xs transition-all flex items-center justify-center gap-2"
            >
              <Home className="h-4 w-4" />
              <span>Back to Dashboard</span>
            </Link>
            <Link
              href="/sales"
              className="w-full sm:w-auto px-5 py-2.5 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs rounded-lg border border-slate-200 shadow-xs transition-all flex items-center justify-center gap-2"
            >
              <ShoppingCart className="h-4 w-4 text-slate-500" />
              <span>Sales POS</span>
            </Link>
          </div>
        </div>

        {/* Footer Subtext */}
        <p className="text-[11px] font-semibold text-slate-400">
          VyaparOne Financial Suite • Double-Entry Powered
        </p>
      </div>
    </div>
  );
}
