'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Building2, ShieldCheck, Lock, Mail, ArrowRight, Sparkles } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuthStore } from '@/lib/auth-store';

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
      // Fetch user profile
      localStorage.setItem('vyaparone_token', res.access_token);
      const userRes = await api.getMe();
      setAuth(res.access_token, userRes);
      router.push('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Login failed. Please check credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickLogin = (demoEmail: string, demoPass: string) => {
    setEmail(demoEmail);
    setPassword(demoPass);
  };

  return (
    <div className="min-h-screen bg-[#090d16] flex items-center justify-center p-4 relative overflow-hidden">
      {/* Glow Backdrops */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-indigo-600/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-emerald-600/20 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md relative z-10">
        {/* Brand Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-emerald-400 shadow-xl shadow-indigo-500/30 mb-4 border border-indigo-400/30">
            <Building2 className="h-9 w-9 text-white" />
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white">
            Vyapar<span className="text-emerald-400">One</span> ERP
          </h1>
          <p className="text-xs text-slate-400 mt-1">FMCG Trading, Landed Cost & Double-Entry Accounting</p>
        </div>

        {/* Login Glass Card */}
        <div className="glass-card p-8 rounded-3xl border border-slate-800 shadow-2xl space-y-6">
          <div className="space-y-1">
            <h2 className="text-xl font-bold text-white tracking-tight">Sign In to Workspace</h2>
            <p className="text-xs text-slate-400">Enter your operational credentials below</p>
          </div>

          {error && (
            <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-semibold">
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@vyaparone.com"
                  className="w-full glass-input pl-10 pr-4 py-2.5 rounded-xl text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">Password</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full glass-input pl-10 pr-4 py-2.5 rounded-xl text-sm"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-indigo-600 to-emerald-500 hover:from-indigo-500 hover:to-emerald-400 text-white font-bold text-sm rounded-xl shadow-lg shadow-indigo-500/25 transition-all duration-200 disabled:opacity-50"
            >
              {loading ? 'Authenticating...' : 'Sign In to ERP'}
              <ArrowRight className="h-4 w-4" />
            </button>
          </form>

          {/* Quick Demo Launchers */}
          <div className="pt-4 border-t border-slate-800/80">
            <div className="flex items-center gap-1 text-[11px] font-bold text-indigo-400 uppercase tracking-wider mb-3">
              <Sparkles className="h-3.5 w-3.5" />
              Quick Demo Launcher
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => handleQuickLogin('admin@vyaparone.com', 'adminpassword')}
                className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-700/60 hover:border-indigo-500/50 text-left transition-colors group"
              >
                <div className="text-xs font-bold text-white group-hover:text-indigo-400">ADMIN</div>
                <div className="text-[10px] text-slate-400 truncate">admin@vyaparone.com</div>
              </button>

              <button
                type="button"
                onClick={() => handleQuickLogin('owner@vyaparone.com', 'owner1234')}
                className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-700/60 hover:border-emerald-500/50 text-left transition-colors group"
              >
                <div className="text-xs font-bold text-white group-hover:text-emerald-400">BUSINESS OWNER</div>
                <div className="text-[10px] text-slate-400 truncate">owner@vyaparone.com</div>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
