'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BarChart3, FileText, CreditCard, PieChart, Landmark, TrendingUp } from 'lucide-react';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import { api } from '@/lib/api';

export default function ReportsPage() {
  const [activeTab, setActiveTab] = useState<'LEDGER' | 'RECEIVABLES' | 'PAYABLES' | 'PROFITABILITY' | 'GST'>('LEDGER');
  const [selectedAccountId, setSelectedAccountId] = useState('');

  const { data: accounts = [] } = useQuery({
    queryKey: ['ledger-accounts'],
    queryFn: () => api.getLedgerAccounts(),
  });

  const { data: statement } = useQuery({
    queryKey: ['ledger-statement', selectedAccountId],
    queryFn: () => api.getLedgerStatement(selectedAccountId),
    enabled: !!selectedAccountId,
  });

  const { data: receivables } = useQuery({
    queryKey: ['report-receivables'],
    queryFn: () => api.getReceivables(),
    enabled: activeTab === 'RECEIVABLES',
  });

  const { data: payables } = useQuery({
    queryKey: ['report-payables'],
    queryFn: () => api.getPayables(),
    enabled: activeTab === 'PAYABLES',
  });

  const { data: partyProf } = useQuery({
    queryKey: ['report-party-prof'],
    queryFn: () => api.getPartyProfitability(),
    enabled: activeTab === 'PROFITABILITY',
  });

  const { data: gst } = useQuery({
    queryKey: ['report-gst'],
    queryFn: () => api.getGSTSummary(),
    enabled: activeTab === 'GST',
  });

  return (
    <div className="flex min-h-screen bg-[#090d16]">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Header 
          title="Financial Reports & Analytics Center" 
          subtitle="Double-entry ledger statements, aging balances, customer profitability & GST tax liability" 
        />

        <main className="p-8 space-y-6 flex-1 overflow-y-auto">
          {/* Report Tab Selector */}
          <div className="glass-panel p-2 rounded-2xl flex flex-wrap gap-2">
            {[
              { id: 'LEDGER', label: 'General Ledger Statement', icon: FileText },
              { id: 'RECEIVABLES', label: 'Customer Receivables', icon: CreditCard },
              { id: 'PAYABLES', label: 'Supplier Payables', icon: CreditCard },
              { id: 'PROFITABILITY', label: 'Profitability & Margins', icon: TrendingUp },
              { id: 'GST', label: 'GST Tax Return', icon: Landmark },
            ].map((t) => {
              const Icon = t.icon;
              const isActive = activeTab === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setActiveTab(t.id as any)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
                    isActive
                      ? 'bg-gradient-to-r from-indigo-600 to-indigo-700 text-white shadow-md border border-indigo-500/30'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/40'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {t.label}
                </button>
              );
            })}
          </div>

          {/* TAB 1: LEDGER STATEMENT */}
          {activeTab === 'LEDGER' && (
            <div className="space-y-4">
              <div className="glass-panel p-4 rounded-2xl flex items-center gap-4">
                <label className="text-xs font-semibold text-slate-300">Select Ledger Account:</label>
                <select
                  value={selectedAccountId}
                  onChange={(e) => setSelectedAccountId(e.target.value)}
                  className="glass-input p-2 rounded-xl text-xs bg-slate-900 w-80"
                >
                  <option value="">-- Select Account --</option>
                  {accounts.map((a: any) => (
                    <option key={a.id} value={a.id}>{a.account_name} ({a.account_type})</option>
                  ))}
                </select>
              </div>

              {statement && (
                <div className="glass-panel rounded-2xl overflow-hidden border border-slate-800 space-y-4 p-5">
                  <div className="flex items-center justify-between border-b border-slate-800/80 pb-4">
                    <div>
                      <h3 className="font-bold text-white text-lg">{statement.account_name}</h3>
                      <span className="text-xs text-slate-400">Account Type: {statement.account_type}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-xs text-slate-400 block">Closing Balance</span>
                      <span className="text-xl font-extrabold text-emerald-400">₹{statement.closing_balance}</span>
                    </div>
                  </div>

                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-900/80 text-slate-400 border-b border-slate-800 uppercase text-[10px]">
                      <tr>
                        <th className="p-3">Date</th>
                        <th className="p-3">Voucher</th>
                        <th className="p-3">Debit (₹)</th>
                        <th className="p-3">Credit (₹)</th>
                        <th className="p-3">Running Balance (₹)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 text-slate-200">
                      {statement.lines.map((line: any) => (
                        <tr key={line.id} className="hover:bg-slate-800/30">
                          <td className="p-3">{line.transaction_date}</td>
                          <td className="p-3 font-mono font-bold text-indigo-400">{line.voucher_type}</td>
                          <td className="p-3 text-emerald-400 font-semibold">{parseFloat(line.debit_amount) > 0 ? `₹${line.debit_amount}` : '-'}</td>
                          <td className="p-3 text-rose-400 font-semibold">{parseFloat(line.credit_amount) > 0 ? `₹${line.credit_amount}` : '-'}</td>
                          <td className="p-3 font-bold text-white">₹{line.running_balance}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: RECEIVABLES */}
          {activeTab === 'RECEIVABLES' && receivables && (
            <div className="glass-panel p-6 rounded-2xl border border-slate-800 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
                <h3 className="font-bold text-white text-base">Customer Receivables Overview</h3>
                <span className="text-xl font-extrabold text-emerald-400">Total: ₹{receivables.total_receivables}</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {receivables.parties.map((p: any) => (
                  <div key={p.party_id} className="glass-card p-4 rounded-xl flex items-center justify-between">
                    <div>
                      <div className="font-bold text-white">{p.party_name}</div>
                      <div className="text-[10px] text-slate-400">{p.city} | Credit Days: {p.credit_days}</div>
                    </div>
                    <div className="font-extrabold text-emerald-400 text-base">₹{p.current_balance}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 3: PAYABLES */}
          {activeTab === 'PAYABLES' && payables && (
            <div className="glass-panel p-6 rounded-2xl border border-slate-800 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
                <h3 className="font-bold text-white text-base">Supplier Payables Overview</h3>
                <span className="text-xl font-extrabold text-rose-400">Total: ₹{payables.total_payables}</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {payables.parties.map((p: any) => (
                  <div key={p.party_id} className="glass-card p-4 rounded-xl flex items-center justify-between">
                    <div>
                      <div className="font-bold text-white">{p.party_name}</div>
                      <div className="text-[10px] text-slate-400">{p.city}</div>
                    </div>
                    <div className="font-extrabold text-rose-400 text-base">₹{p.current_balance}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 4: PROFITABILITY */}
          {activeTab === 'PROFITABILITY' && partyProf && (
            <div className="glass-panel p-6 rounded-2xl border border-slate-800 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
                <h3 className="font-bold text-white text-base">Customer & Party Margins</h3>
                <div className="text-right">
                  <span className="text-xs text-slate-400 block">Total Net Profit</span>
                  <span className="text-xl font-extrabold text-emerald-400">₹{partyProf.total_profit}</span>
                </div>
              </div>
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-900/80 text-slate-400 border-b border-slate-800 uppercase text-[10px]">
                  <tr>
                    <th className="p-3">Customer</th>
                    <th className="p-3">Revenue (₹)</th>
                    <th className="p-3">COGS (₹)</th>
                    <th className="p-3">Net Profit (₹)</th>
                    <th className="p-3">Margin %</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-200">
                  {partyProf.parties.map((pt: any) => (
                    <tr key={pt.party_id}>
                      <td className="p-3 font-bold text-white">{pt.party_name}</td>
                      <td className="p-3">₹{pt.total_revenue}</td>
                      <td className="p-3 text-slate-400">₹{pt.total_cogs}</td>
                      <td className="p-3 text-emerald-400 font-bold">₹{pt.net_profit}</td>
                      <td className="p-3 font-semibold text-indigo-400">{pt.profit_margin_percent}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* TAB 5: GST RETURN SUMMARY */}
          {activeTab === 'GST' && gst && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="glass-card p-6 rounded-2xl border-indigo-500/20">
                <span className="text-xs font-semibold uppercase text-indigo-400">Output GST (Sales)</span>
                <h3 className="text-2xl font-bold text-white mt-2">₹{gst.output_gst_amount}</h3>
                <p className="text-[11px] text-slate-400 mt-1">Taxable Turnover: ₹{gst.sales_taxable_amount}</p>
              </div>

              <div className="glass-card p-6 rounded-2xl border-emerald-500/20">
                <span className="text-xs font-semibold uppercase text-emerald-400">Input Tax Credit (ITC)</span>
                <h3 className="text-2xl font-bold text-white mt-2">₹{gst.input_gst_amount}</h3>
                <p className="text-[11px] text-slate-400 mt-1">Purchase Taxable: ₹{gst.purchase_taxable_amount}</p>
              </div>

              <div className="glass-card p-6 rounded-2xl border-amber-500/20 glow-amber">
                <span className="text-xs font-semibold uppercase text-amber-400">Net GST Liability</span>
                <h3 className="text-2xl font-extrabold text-amber-400 mt-2">₹{gst.net_gst_payable}</h3>
                <p className="text-[11px] text-slate-400 mt-1">Output GST minus Input Tax Credit</p>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
