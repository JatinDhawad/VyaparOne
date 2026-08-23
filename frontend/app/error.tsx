'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { Building2, Home, RefreshCw, AlertTriangle } from 'lucide-react';

export default function RootErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Unhandled Application Exception caught by root Error Boundary:', error);
  }, [error]);

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background Soft Gradients */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-rose-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-lg relative z-10 text-center space-y-6">
        {/* Brand Logo Header */}
        <div>
          <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-gradient-to-tr from-rose-600 via-rose-500 to-amber-500 shadow-xl shadow-rose-500/20 mb-3 border border-rose-200">
            <Building2 className="h-9 w-9 text-white" />
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">
            Vyapar<span className="text-emerald-600">One</span> ERP
          </h1>
          <p className="text-xs font-semibold text-slate-500 mt-0.5">
            FMCG Trading, Landed Cost & Double-Entry Accounting
          </p>
        </div>

        {/* Error Glass Card */}
        <div className="bg-white p-8 sm:p-10 rounded-3xl border border-slate-200/90 shadow-xl space-y-6">
          <div className="inline-flex items-center justify-center h-20 w-20 rounded-3xl bg-rose-50 border border-rose-100 text-rose-600 shadow-inner">
            <AlertTriangle className="h-10 w-10 text-rose-600" />
          </div>

          <div className="space-y-2">
            <div className="inline-block px-3 py-1 rounded-full text-xs font-extrabold bg-rose-50 text-rose-700 border border-rose-200 uppercase tracking-wider">
              Application Error Occurred
            </div>
            <h2 className="text-2xl font-black text-slate-900">
              Something went wrong
            </h2>
            <p className="text-xs font-medium text-slate-500 max-w-sm mx-auto leading-relaxed">
              An unexpected runtime error occurred while processing your request. Your transaction data remains safe.
            </p>

            {error?.message && (
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-[11px] font-mono text-slate-600 max-w-md mx-auto truncate">
                {error.message}
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              onClick={() => reset()}
              className="w-full sm:w-auto px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs rounded-lg shadow-xs transition-all flex items-center justify-center gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              <span>Try Again</span>
            </button>
            <Link
              href="/dashboard"
              className="w-full sm:w-auto px-5 py-2.5 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs rounded-lg border border-slate-200 shadow-xs transition-all flex items-center justify-center gap-2"
            >
              <Home className="h-4 w-4 text-slate-500" />
              <span>Back to Dashboard</span>
            </Link>
          </div>
        </div>

        {/* Footer Subtext */}
        <p className="text-[11px] font-semibold text-slate-400">
          VyaparOne System Error Boundary • Self-Healing Architecture
        </p>
      </div>
    </div>
  );
}
