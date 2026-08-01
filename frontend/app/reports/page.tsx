'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FileText, CreditCard, Landmark, TrendingUp } from 'lucide-react';
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
    <div className="flex min-h-screen bg-slate-50">
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
                      ? 'bg-gradient-to-r from-indigo-600 to-indigo-700 text-white shadow-md'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
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
                <label className="text-xs font-bold text-slate-700">Select Ledger Account:</label>
                <select
                  value={selectedAccountId}
                  onChange={(e) => setSelectedAccountId(e.target.value)}
                  className="glass-input p-2 rounded-xl text-xs bg-white w-80 font-semibold"
                >
                  <option value="">-- Select Account --</option>
                  {accounts.map((a: any) => (
                    <option key={a.id} value={a.id}>{a.account_name} ({a.account_type})</option>
                  ))}
                </select>
              </div>

              {statement && (
                <div className="glass-panel rounded-2xl overflow-hidden border border-slate-200 space-y-4 p-5">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                    <div>
                      <h3 className="font-bold text-slate-900 text-lg">{statement.account_name}</h3>
                      <span className="text-xs text-slate-500 font-medium">Account Type: {statement.account_type}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-bold text-slate-400 block uppercase">Closing Balance</span>
                      <span className="text-xl font-extrabold text-emerald-700">₹{statement.closing_balance}</span>
                    </div>
                  </div>

                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100/80 text-slate-500 border-b border-slate-200 uppercase text-[10px] font-bold">
                      <tr>
                        <th className="p-3">Date</th>
                        <th className="p-3">Voucher</th>
                        <th className="p-3">Debit (₹)</th>
                        <th className="p-3">Credit (₹)</th>
                        <th className="p-3">Running Balance (₹)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                      {statement.lines.map((line: any) => (
                        <tr key={line.id} className="hover:bg-slate-100/50">
                          <td className="p-3">{line.transaction_date}</td>
                          <td className="p-3 font-mono font-bold text-indigo-700">{line.voucher_type}</td>
                          <td className="p-3 text-emerald-700 font-bold">{parseFloat(line.debit_amount) > 0 ? `₹${line.debit_amount}` : '-'}</td>
                          <td className="p-3 text-rose-700 font-bold">{parseFloat(line.credit_amount) > 0 ? `₹${line.credit_amount}` : '-'}</td>
                          <td className="p-3 font-extrabold text-slate-900">₹{line.running_balance}</td>
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
            <div className="glass-panel p-6 rounded-2xl border border-slate-200 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="font-bold text-slate-900 text-base">Customer Receivables Overview</h3>
                <span className="text-xl font-extrabold text-emerald-700">Total: ₹{receivables.total_receivables}</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {receivables.parties.map((p: any) => (
                  <div key={p.party_id} className="glass-card p-4 rounded-xl flex items-center justify-between">
                    <div>
                      <div className="font-bold text-slate-900">{p.party_name}</div>
                      <div className="text-[10px] text-slate-500 font-medium">{p.city} | Credit Days: {p.credit_days}</div>
                    </div>
                    <div className="font-extrabold text-emerald-700 text-base">₹{p.current_balance}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 3: PAYABLES */}
          {activeTab === 'PAYABLES' && payables && (
            <div className="glass-panel p-6 rounded-2xl border border-slate-200 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="font-bold text-slate-900 text-base">Supplier Payables Overview</h3>
                <span className="text-xl font-extrabold text-rose-700">Total: ₹{payables.total_payables}</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {payables.parties.map((p: any) => (
                  <div key={p.party_id} className="glass-card p-4 rounded-xl flex items-center justify-between">
                    <div>
                      <div className="font-bold text-slate-900">{p.party_name}</div>
                      <div className="text-[10px] text-slate-500 font-medium">{p.city}</div>
                    </div>
                    <div className="font-extrabold text-rose-700 text-base">₹{p.current_balance}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 4: PROFITABILITY */}
          {activeTab === 'PROFITABILITY' && partyProf && (
            <div className="glass-panel p-6 rounded-2xl border border-slate-200 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="font-bold text-slate-900 text-base">Customer & Party Margins</h3>
                <div className="text-right">
                  <span className="text-xs text-slate-500 block font-semibold uppercase">Total Net Profit</span>
                  <span className="text-xl font-extrabold text-emerald-700">₹{partyProf.total_profit}</span>
                </div>
              </div>
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100/80 text-slate-500 border-b border-slate-200 uppercase text-[10px] font-bold">
                  <tr>
                    <th className="p-3">Customer</th>
                    <th className="p-3">Revenue (₹)</th>
                    <th className="p-3">COGS (₹)</th>
                    <th className="p-3">Net Profit (₹)</th>
                    <th className="p-3">Margin %</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {partyProf.parties.map((pt: any) => (
                    <tr key={pt.party_id}>
                      <td className="p-3 font-bold text-slate-900">{pt.party_name}</td>
                      <td className="p-3">₹{pt.total_revenue}</td>
                      <td className="p-3 text-slate-500">₹{pt.total_cogs}</td>
                      <td className="p-3 text-emerald-700 font-bold">₹{pt.net_profit}</td>
                      <td className="p-3 font-bold text-indigo-700">{pt.profit_margin_percent}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* TAB 5: GST RETURN SUMMARY */}
          {activeTab === 'GST' && gst && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="glass-card p-6 rounded-2xl border-indigo-100">
                <span className="text-xs font-bold uppercase text-indigo-700">Output GST (Sales)</span>
                <h3 className="text-2xl font-bold text-slate-900 mt-2">₹{gst.output_gst_amount}</h3>
                <p className="text-[11px] font-medium text-slate-500 mt-1">Taxable Turnover: ₹{gst.sales_taxable_amount}</p>
              </div>

              <div className="glass-card p-6 rounded-2xl border-emerald-100">
                <span className="text-xs font-bold uppercase text-emerald-700">Input Tax Credit (ITC)</span>
                <h3 className="text-2xl font-bold text-slate-900 mt-2">₹{gst.input_gst_amount}</h3>
                <p className="text-[11px] font-medium text-slate-500 mt-1">Purchase Taxable: ₹{gst.purchase_taxable_amount}</p>
              </div>

              <div className="glass-card p-6 rounded-2xl border-amber-200 bg-amber-50/50 glow-amber">
                <span className="text-xs font-bold uppercase text-amber-800">Net GST Liability</span>
                <h3 className="text-2xl font-extrabold text-amber-800 mt-2">₹{gst.net_gst_payable}</h3>
                <p className="text-[11px] font-medium text-slate-500 mt-1">Output GST minus Input Tax Credit</p>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
