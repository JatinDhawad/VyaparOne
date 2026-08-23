'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Building2, Lock, Mail, ArrowRight, Sparkles } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuthStore } from '@/lib/auth-store';
import { toast } from 'sonner';

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

  const handleQuickLogin = (demoEmail: string, demoPass: string) => {
    setEmail(demoEmail);
    setPassword(demoPass);
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
          <p className="text-xs font-semibold text-slate-500 mt-1">FMCG Trading, Landed Cost & Double-Entry Accounting</p>
        </div>

        {/* Login Glass Card */}
        <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-xl space-y-6">
          <div className="space-y-1">
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">Sign In to Workspace</h2>
            <p className="text-xs text-slate-500">Enter your operational credentials below</p>
          </div>

          {error && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold">
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">Email Address</label>
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
              <label className="block text-xs font-bold text-slate-700 mb-1.5">Password</label>
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
              className="w-full flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-indigo-600 to-emerald-600 hover:from-indigo-500 hover:to-emerald-500 text-white font-bold text-sm rounded-xl shadow-lg shadow-indigo-500/20 transition-all duration-200 disabled:opacity-50"
            >
              {loading ? 'Authenticating...' : 'Sign In to ERP'}
              <ArrowRight className="h-4 w-4" />
            </button>
          </form>

          {/* Quick Demo Launchers */}
          <div className="pt-4 border-t border-slate-100">
            <div className="flex items-center gap-1 text-[11px] font-extrabold text-indigo-600 uppercase tracking-wider mb-3">
              <Sparkles className="h-3.5 w-3.5" />
              Quick Demo Launcher
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => handleQuickLogin('admin@vyaparone.com', 'adminpassword')}
                className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 hover:border-indigo-500/50 text-left transition-colors group"
              >
                <div className="text-xs font-extrabold text-slate-900 group-hover:text-indigo-600">ADMIN</div>
                <div className="text-[10px] font-medium text-slate-500 truncate">admin@vyaparone.com</div>
              </button>

              <button
                type="button"
                onClick={() => handleQuickLogin('owner@vyaparone.com', 'owner1234')}
                className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 hover:border-emerald-500/50 text-left transition-colors group"
              >
                <div className="text-xs font-extrabold text-slate-900 group-hover:text-emerald-600">BUSINESS OWNER</div>
                <div className="text-[10px] font-medium text-slate-500 truncate">owner@vyaparone.com</div>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
