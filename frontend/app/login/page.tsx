'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Building2, Lock, Mail, ArrowRight, Sparkles, Loader2 } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuthStore } from '@/lib/auth-store';
import { toast } from 'sonner';

// ---------------------------------------------------------------------------
// DEMO MODE
// This block is evaluated at build time by Next.js / the bundler.
// When NEXT_PUBLIC_DEMO_MODE is not "true" (i.e. in production), the entire
// if-branch is treated as dead code and tree-shaken out of the JS bundle,
// so no credential strings are ever shipped to the browser.
//
// To enable locally: add NEXT_PUBLIC_DEMO_MODE=true to .env.local
// NEVER set this in a production environment or in Vercel production env vars.
// ---------------------------------------------------------------------------
const IS_DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === 'true';

// Demo accounts are only defined when the build flag is active.
// They do not exist as strings in non-demo builds.
const DEMO_ACCOUNTS = IS_DEMO_MODE
  ? [
      { label: 'ADMIN', email: process.env.NEXT_PUBLIC_DEMO_ADMIN_EMAIL ?? '', password: process.env.NEXT_PUBLIC_DEMO_ADMIN_PASS ?? '', accent: 'indigo' },
      { label: 'BUSINESS OWNER', email: process.env.NEXT_PUBLIC_DEMO_OWNER_EMAIL ?? '', password: process.env.NEXT_PUBLIC_DEMO_OWNER_PASS ?? '', accent: 'emerald' },
    ]
  : [];

export default function LoginPage() {
  const router = useRouter();
  const setAuth = useAuthStore((state) => state.setAuth);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await api.login({ email, password });
      localStorage.setItem('vyaparone_token', res.access_token);
      const userRes = await api.getMe();
      setAuth(res.access_token, userRes);
      toast.success(`Welcome back, ${userRes?.full_name || 'Admin'}!`);
      router.push('/dashboard');
    } catch (err: any) {
      const msg = err.message || 'Login failed. Please check credentials.';
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background Soft Gradients */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md relative z-10">
        {/* Brand Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-emerald-500 shadow-xl shadow-indigo-500/20 mb-4 border border-indigo-200">
            <Building2 className="h-9 w-9 text-white" />
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
            Vyapar<span className="text-emerald-600">One</span> ERP
          </h1>
          <p className="text-xs font-semibold text-slate-500 mt-1">FMCG Trading, Landed Cost &amp; Double-Entry Accounting</p>
        </div>

        {/* Login Glass Card */}
        <div className="bg-white p-6 sm:p-7 rounded-xl border border-slate-200 shadow-xl space-y-5">
          <div className="space-y-1">
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">Sign In to Workspace</h2>
            <p className="text-xs text-slate-500">Enter your operational credentials below</p>
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold">
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@vyaparone.com"
                  className="w-full glass-input pl-9 pr-3 py-2 rounded-lg text-xs"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full glass-input pl-9 pr-3 py-2 rounded-lg text-xs font-mono"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs rounded-lg shadow-xs transition-all flex items-center justify-center gap-2 active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Authenticating...</span>
                </>
              ) : (
                <>
                  <span>Sign In to ERP</span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>

          {/* Quick Demo Launcher — only rendered (and only compiled) in DEMO_MODE builds */}
          {IS_DEMO_MODE && DEMO_ACCOUNTS.length > 0 && (
            <div className="pt-4 border-t border-slate-100">
              <div className="flex items-center gap-1 text-[11px] font-extrabold text-indigo-600 uppercase tracking-wider mb-3">
                <Sparkles className="h-3.5 w-3.5" />
                Quick Demo Launcher
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                {DEMO_ACCOUNTS.map((account) => (
                  <button
                    key={account.label}
                    type="button"
                    onClick={() => { setEmail(account.email); setPassword(account.password); }}
                    className={`p-2.5 rounded-xl bg-slate-50 border border-slate-200 hover:border-${account.accent}-500/50 text-left transition-colors group`}
                  >
                    <div className={`text-xs font-extrabold text-slate-900 group-hover:text-${account.accent}-600`}>{account.label}</div>
                    <div className="text-[10px] font-medium text-slate-500 truncate">{account.email}</div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
