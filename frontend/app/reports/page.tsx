'use client';

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FileText, CreditCard, Landmark, TrendingUp, BarChart3, Users } from 'lucide-react';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import { api } from '@/lib/api';
import { formatCurrency, formatCompactCurrency } from '@/lib/utils';
import { Skeleton, EmptyState } from '@/components/ui';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Cell,
  Legend,
} from 'recharts';

export default function ReportsPage() {
  const [activeTab, setActiveTab] = useState<'LEDGER' | 'RECEIVABLES' | 'PAYABLES' | 'PROFITABILITY' | 'GST'>('LEDGER');
  const [selectedAccountId, setSelectedAccountId] = useState('');

  const { data: accounts = [], isLoading: isAccountsLoading } = useQuery({
    queryKey: ['ledger-accounts'],
    queryFn: () => api.getLedgerAccounts(),
  });

  const { data: statement, isLoading: isStatementLoading } = useQuery({
    queryKey: ['ledger-statement', selectedAccountId],
    queryFn: () => api.getLedgerStatement(selectedAccountId),
    enabled: !!selectedAccountId,
  });

  const { data: receivables, isLoading: isReceivablesLoading } = useQuery({
    queryKey: ['report-receivables'],
    queryFn: () => api.getReceivables(),
    enabled: activeTab === 'RECEIVABLES',
  });

  const { data: payables, isLoading: isPayablesLoading } = useQuery({
    queryKey: ['report-payables'],
    queryFn: () => api.getPayables(),
    enabled: activeTab === 'PAYABLES',
  });

  const { data: partyProf, isLoading: isProfLoading } = useQuery({
    queryKey: ['report-party-prof'],
    queryFn: () => api.getPartyProfitability(),
    enabled: activeTab === 'PROFITABILITY',
  });

  const { data: gst, isLoading: isGstLoading } = useQuery({
    queryKey: ['report-gst'],
    queryFn: () => api.getGSTSummary(),
    enabled: activeTab === 'GST',
  });

  // ── Derived Chart Datasets ───────────────────────────────────────────────
  // 1. Receivables: Top Outstanding by Party
  const receivablesChartData = useMemo(() => {
    if (!receivables?.parties) return [];
    return [...receivables.parties]
      .sort((a, b) => parseFloat(b.current_balance || 0) - parseFloat(a.current_balance || 0))
      .slice(0, 7)
      .map(p => ({
        name: p.party_name,
        balance: parseFloat(p.current_balance || 0),
        city: p.city || 'Local',
      }));
  }, [receivables]);

  // 2. Payables: Top Outstanding by Supplier
  const payablesChartData = useMemo(() => {
    if (!payables?.parties) return [];
    return [...payables.parties]
      .sort((a, b) => parseFloat(b.current_balance || 0) - parseFloat(a.current_balance || 0))
      .slice(0, 7)
      .map(p => ({
        name: p.party_name,
        balance: parseFloat(p.current_balance || 0),
        city: p.city || 'Local',
      }));
  }, [payables]);

  // 3. Profitability: Top Parties by Profit & Margin
  const profitabilityChartData = useMemo(() => {
    if (!partyProf?.parties) return [];
    return [...partyProf.parties]
      .sort((a, b) => parseFloat(b.net_profit || 0) - parseFloat(a.net_profit || 0))
      .slice(0, 6)
      .map(p => ({
        name: p.party_name,
        netProfit: parseFloat(p.net_profit || 0),
        revenue: parseFloat(p.total_revenue || 0),
        margin: parseFloat(p.profit_margin_percent || 0),
      }));
  }, [partyProf]);

  // 4. GST Summary Comparison
  const gstChartData = useMemo(() => {
    if (!gst) return [];
    return [
      {
        name: 'Output GST (Sales)',
        amount: parseFloat(gst.output_gst_amount || 0),
        fill: '#6366f1',
      },
      {
        name: 'Input Credit (Purchases)',
        amount: parseFloat(gst.input_gst_amount || 0),
        fill: '#10b981',
      },
      {
        name: 'Net Liability',
        amount: Math.max(0, parseFloat(gst.net_gst_payable || 0)),
        fill: '#f59e0b',
      },
    ];
  }, [gst]);

  // ── Custom Tooltips ───────────────────────────────────────────────────────
  const CustomReportTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="glass-card p-3 rounded-2xl border border-slate-200/80 shadow-xl bg-white/95 backdrop-blur-md text-xs space-y-1.5 min-w-[170px]">
          <p className="font-extrabold text-slate-900 border-b border-slate-100 pb-1">{label || payload[0]?.payload?.name}</p>
          {payload.map((entry: any) => (
            <div key={entry.name || entry.dataKey} className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-1.5 text-slate-600 font-semibold">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: entry.color || entry.fill }} />
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

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Header title="Financial Reports & Analytics" />

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
                  className="glass-input p-2 rounded-xl text-xs bg-white w-80 font-semibold border border-slate-200"
                >
                  <option value="">-- Select Account --</option>
                  {accounts.map((a: any) => (
                    <option key={a.id} value={a.id}>{a.account_name} ({a.account_type})</option>
                  ))}
                </select>
              </div>

              {isStatementLoading ? (
                <div className="glass-panel rounded-2xl p-6 border border-slate-200 space-y-4">
                  <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                    <Skeleton className="h-7 w-48 rounded-xl" />
                    <Skeleton className="h-7 w-32 rounded-xl" />
                  </div>
                  <div className="space-y-3">
                    {[...Array(4)].map((_, i) => (
                      <Skeleton key={i} className="h-10 w-full rounded-xl" />
                    ))}
                  </div>
                </div>
              ) : statement ? (
                <div className="glass-panel rounded-2xl overflow-hidden border border-slate-200 space-y-4 p-5">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                    <div>
                      <h3 className="font-bold text-slate-900 text-lg">{statement.account_name}</h3>
                      <span className="text-xs text-slate-500 font-medium">Account Type: {statement.account_type}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-bold text-slate-400 block uppercase">Closing Balance</span>
                      <span className="text-xl font-extrabold text-emerald-700">₹{formatCurrency(statement.closing_balance)}</span>
                    </div>
                  </div>

                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100/80 text-slate-500 border-b border-slate-200 uppercase text-[10px] font-bold">
                      <tr>
                        <th className="p-3">Date</th>
                        <th className="p-3">Voucher</th>
                        <th className="p-3 text-right">Debit (₹)</th>
                        <th className="p-3 text-right">Credit (₹)</th>
                        <th className="p-3 text-right">Running Balance (₹)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                      {statement.lines.map((line: any) => (
                        <tr key={line.id} className="hover:bg-slate-100/50">
                          <td className="p-3 font-medium">{line.transaction_date}</td>
                          <td className="p-3 font-mono font-bold text-indigo-700">{line.voucher_type}</td>
                          <td className="p-3 text-right text-emerald-700 font-bold">
                            {parseFloat(line.debit_amount) > 0 ? `₹${formatCurrency(line.debit_amount)}` : '-'}
                          </td>
                          <td className="p-3 text-right text-rose-700 font-bold">
                            {parseFloat(line.credit_amount) > 0 ? `₹${formatCurrency(line.credit_amount)}` : '-'}
                          </td>
                          <td className="p-3 text-right font-extrabold text-slate-900">₹{formatCurrency(line.running_balance)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </div>
          )}

          {/* TAB 2: RECEIVABLES */}
          {activeTab === 'RECEIVABLES' && (
            <div className="space-y-6">
              <div className="glass-panel p-6 rounded-2xl border border-slate-200 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <h3 className="font-bold text-slate-900 text-base">Customer Receivables Overview</h3>
                  {isReceivablesLoading ? (
                    <Skeleton className="h-7 w-32 rounded-xl" />
                  ) : (
                    <span className="text-xl font-extrabold text-emerald-700">Total: ₹{formatCurrency(receivables?.total_receivables)}</span>
                  )}
                </div>

                {/* Receivables Bar Chart */}
                {!isReceivablesLoading && receivablesChartData.length > 0 && (
                  <div className="glass-card p-6 rounded-2xl border border-slate-200/80 bg-white space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                      <div>
                        <h4 className="font-extrabold text-slate-900 text-sm">Top Outstanding Balances by Customer</h4>
                        <p className="text-[11px] text-slate-500 font-medium mt-0.5">Customers with highest unpaid receivables</p>
                      </div>
                      <span className="text-xs font-extrabold px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200">
                        {receivables?.parties?.length || 0} Debtors
                      </span>
                    </div>
                    <div className="h-[240px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={receivablesChartData} margin={{ top: 10, right: 10, left: -10, bottom: 20 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                          <XAxis
                            dataKey="name"
                            stroke="#94a3b8"
                            fontSize={11}
                            tickLine={false}
                            axisLine={false}
                            interval={0}
                            angle={-20}
                            textAnchor="end"
                            height={40}
                          />
                          <YAxis
                            stroke="#94a3b8"
                            fontSize={11}
                            tickLine={false}
                            axisLine={false}
                            tickFormatter={(v) => '₹' + formatCompactCurrency(v)}
                          />
                          <RechartsTooltip content={<CustomReportTooltip />} />
                          <Bar dataKey="balance" name="Outstanding Balance" fill="#10b981" radius={[8, 8, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )}

                {/* Party Cards Grid */}
                {isReceivablesLoading ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {[...Array(4)].map((_, i) => (
                      <Skeleton key={i} className="h-20 w-full rounded-2xl" />
                    ))}
                  </div>
                ) : receivables?.parties?.length === 0 ? (
                  <EmptyState
                    icon={CreditCard}
                    title="No Pending Receivables"
                    description="All customer accounts are currently settled."
                  />
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {receivables?.parties?.map((p: any) => (
                      <div key={p.party_id} className="glass-card p-4 rounded-xl flex items-center justify-between">
                        <div>
                          <div className="font-bold text-slate-900">{p.party_name}</div>
                          <div className="text-[11px] text-slate-500 font-medium">{p.city} | Credit Days: {p.credit_days}</div>
                        </div>
                        <div className="font-extrabold text-emerald-700 text-base">₹{formatCurrency(p.current_balance)}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: PAYABLES */}
          {activeTab === 'PAYABLES' && (
            <div className="space-y-6">
              <div className="glass-panel p-6 rounded-2xl border border-slate-200 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <h3 className="font-bold text-slate-900 text-base">Supplier Payables Overview</h3>
                  {isPayablesLoading ? (
                    <Skeleton className="h-7 w-32 rounded-xl" />
                  ) : (
                    <span className="text-xl font-extrabold text-rose-700">Total: ₹{formatCurrency(payables?.total_payables)}</span>
                  )}
                </div>

                {/* Payables Bar Chart */}
                {!isPayablesLoading && payablesChartData.length > 0 && (
                  <div className="glass-card p-6 rounded-2xl border border-slate-200/80 bg-white space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                      <div>
                        <h4 className="font-extrabold text-slate-900 text-sm">Top Outstanding Dues by Supplier</h4>
                        <p className="text-[11px] text-slate-500 font-medium mt-0.5">Suppliers with highest pending payables</p>
                      </div>
                      <span className="text-xs font-extrabold px-2.5 py-1 rounded-lg bg-rose-50 text-rose-700 border border-rose-200">
                        {payables?.parties?.length || 0} Creditors
                      </span>
                    </div>
                    <div className="h-[240px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={payablesChartData} margin={{ top: 10, right: 10, left: -10, bottom: 20 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                          <XAxis
                            dataKey="name"
                            stroke="#94a3b8"
                            fontSize={11}
                            tickLine={false}
                            axisLine={false}
                            interval={0}
                            angle={-20}
                            textAnchor="end"
                            height={40}
                          />
                          <YAxis
                            stroke="#94a3b8"
                            fontSize={11}
                            tickLine={false}
                            axisLine={false}
                            tickFormatter={(v) => '₹' + formatCompactCurrency(v)}
                          />
                          <RechartsTooltip content={<CustomReportTooltip />} />
                          <Bar dataKey="balance" name="Pending Payable" fill="#6366f1" radius={[8, 8, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )}

                {/* Party Cards Grid */}
                {isPayablesLoading ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {[...Array(4)].map((_, i) => (
                      <Skeleton key={i} className="h-20 w-full rounded-2xl" />
                    ))}
                  </div>
                ) : payables?.parties?.length === 0 ? (
                  <EmptyState
                    icon={CreditCard}
                    title="No Pending Payables"
                    description="All supplier dues are currently clear."
                  />
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {payables?.parties?.map((p: any) => (
                      <div key={p.party_id} className="glass-card p-4 rounded-xl flex items-center justify-between">
                        <div>
                          <div className="font-bold text-slate-900">{p.party_name}</div>
                          <div className="text-[11px] text-slate-500 font-medium">{p.city}</div>
                        </div>
                        <div className="font-extrabold text-rose-700 text-base">₹{formatCurrency(p.current_balance)}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 4: PROFITABILITY */}
          {activeTab === 'PROFITABILITY' && (
            <div className="space-y-6">
              {/* Horizontal Bar Chart: Top Parties by Profit & Revenue */}
              {!isProfLoading && profitabilityChartData.length > 0 && (
                <div className="glass-card p-6 rounded-2xl border border-slate-200/80 bg-white space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                    <div>
                      <h4 className="font-extrabold text-slate-900 text-sm">Top Customers by Net Profit</h4>
                      <p className="text-[11px] text-slate-500 font-medium mt-0.5">Gross revenue vs net profit margin per customer</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 bg-indigo-50/70 border border-indigo-100 px-2.5 py-1 rounded-xl">
                        <span className="h-2.5 w-2.5 rounded-full bg-indigo-600" />
                        <span>Revenue</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 bg-emerald-50/70 border border-emerald-100 px-2.5 py-1 rounded-xl">
                        <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                        <span>Net Profit</span>
                      </div>
                    </div>
                  </div>

                  <div className="h-[280px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={profitabilityChartData}
                        layout="vertical"
                        margin={{ top: 5, right: 20, left: 20, bottom: 5 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                        <XAxis
                          type="number"
                          stroke="#94a3b8"
                          fontSize={11}
                          tickLine={false}
                          axisLine={false}
                          tickFormatter={(v) => '₹' + formatCompactCurrency(v)}
                        />
                        <YAxis
                          type="category"
                          dataKey="name"
                          stroke="#475569"
                          fontSize={11}
                          fontWeight="bold"
                          tickLine={false}
                          axisLine={false}
                          width={110}
                        />
                        <RechartsTooltip content={<CustomReportTooltip />} />
                        <Bar dataKey="revenue" name="Total Revenue" fill="#6366f1" radius={[0, 6, 6, 0]} barSize={12} />
                        <Bar dataKey="netProfit" name="Net Profit" fill="#10b981" radius={[0, 6, 6, 0]} barSize={12} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {/* Data Table */}
              <div className="glass-panel p-6 rounded-2xl border border-slate-200 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <h3 className="font-bold text-slate-900 text-base">Customer &amp; Party Margins</h3>
                  <div className="text-right">
                    <span className="text-xs text-slate-500 block font-semibold uppercase">Total Net Profit</span>
                    {isProfLoading ? (
                      <Skeleton className="h-7 w-28 rounded-xl" />
                    ) : (
                      <span className="text-xl font-extrabold text-emerald-700">₹{formatCurrency(partyProf?.total_profit)}</span>
                    )}
                  </div>
                </div>
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100/80 text-slate-500 border-b border-slate-200 uppercase text-[10px] font-bold">
                    <tr>
                      <th className="p-3">Customer</th>
                      <th className="p-3 text-right">Revenue (₹)</th>
                      <th className="p-3 text-right">COGS (₹)</th>
                      <th className="p-3 text-right">Net Profit (₹)</th>
                      <th className="p-3 text-right">Margin %</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700 bg-white">
                    {isProfLoading ? (
                      [...Array(4)].map((_, i) => (
                        <tr key={i} className="animate-pulse">
                          <td className="p-3"><Skeleton className="h-5 w-32 rounded-lg" /></td>
                          <td className="p-3 text-right"><Skeleton className="h-5 w-20 rounded-lg ml-auto" /></td>
                          <td className="p-3 text-right"><Skeleton className="h-5 w-20 rounded-lg ml-auto" /></td>
                          <td className="p-3 text-right"><Skeleton className="h-5 w-20 rounded-lg ml-auto" /></td>
                          <td className="p-3 text-right"><Skeleton className="h-5 w-16 rounded-lg ml-auto" /></td>
                        </tr>
                      ))
                    ) : partyProf?.parties?.length === 0 ? (
                      <tr><td colSpan={5} className="p-8 text-center text-slate-500">No party sales recorded yet.</td></tr>
                    ) : (
                      partyProf?.parties?.map((pt: any) => (
                        <tr key={pt.party_id} className="hover:bg-slate-50">
                          <td className="p-3 font-bold text-slate-900">{pt.party_name}</td>
                          <td className="p-3 text-right">₹{formatCurrency(pt.total_revenue)}</td>
                          <td className="p-3 text-right text-slate-500">₹{formatCurrency(pt.total_cogs)}</td>
                          <td className="p-3 text-right text-emerald-700 font-bold">₹{formatCurrency(pt.net_profit)}</td>
                          <td className="p-3 text-right font-bold text-indigo-700">{pt.profit_margin_percent}%</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 5: GST RETURN SUMMARY */}
          {activeTab === 'GST' && (
            <div className="space-y-6">
              {isGstLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {[...Array(3)].map((_, i) => (
                    <Skeleton key={i} className="h-32 w-full rounded-2xl" />
                  ))}
                </div>
              ) : gst ? (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="glass-card p-6 rounded-2xl border-indigo-100 bg-white">
                      <span className="text-xs font-bold uppercase text-indigo-700">Output GST (Sales)</span>
                      <h3 className="text-2xl font-bold text-slate-900 mt-2">₹{formatCurrency(gst.output_gst_amount)}</h3>
                      <p className="text-[11px] font-medium text-slate-500 mt-1">Taxable Turnover: ₹{formatCurrency(gst.sales_taxable_amount)}</p>
                    </div>

                    <div className="glass-card p-6 rounded-2xl border-emerald-100 bg-white">
                      <span className="text-xs font-bold uppercase text-emerald-700">Input Tax Credit (ITC)</span>
                      <h3 className="text-2xl font-bold text-slate-900 mt-2">₹{formatCurrency(gst.input_gst_amount)}</h3>
                      <p className="text-[11px] font-medium text-slate-500 mt-1">Purchase Taxable: ₹{formatCurrency(gst.purchase_taxable_amount)}</p>
                    </div>

                    <div className="glass-card p-6 rounded-2xl border-amber-200 bg-amber-50/50 glow-amber">
                      <span className="text-xs font-bold uppercase text-amber-800">Net GST Liability</span>
                      <h3 className="text-2xl font-extrabold text-amber-800 mt-2">₹{formatCurrency(gst.net_gst_payable)}</h3>
                      <p className="text-[11px] font-medium text-slate-500 mt-1">Output GST minus Input Tax Credit</p>
                    </div>
                  </div>

                  {/* GST Tax Comparison Bar Chart */}
                  <div className="glass-card p-6 rounded-2xl border border-slate-200/80 bg-white space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                      <div>
                        <h4 className="font-extrabold text-slate-900 text-sm">GST Tax Settlement Summary</h4>
                        <p className="text-[11px] text-slate-500 font-medium mt-0.5">Comparison of tax collected on sales vs input tax credit paid on inward purchases</p>
                      </div>
                    </div>

                    <div className="h-[240px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={gstChartData} margin={{ top: 10, right: 20, left: 10, bottom: 5 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                          <XAxis
                            dataKey="name"
                            stroke="#94a3b8"
                            fontSize={11}
                            fontWeight="bold"
                            tickLine={false}
                            axisLine={false}
                          />
                          <YAxis
                            stroke="#94a3b8"
                            fontSize={11}
                            tickLine={false}
                            axisLine={false}
                            tickFormatter={(v) => '₹' + formatCompactCurrency(v)}
                          />
                          <RechartsTooltip content={<CustomReportTooltip />} />
                          <Bar dataKey="amount" name="Amount" radius={[8, 8, 0, 0]} barSize={48}>
                            {gstChartData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.fill} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </>
              ) : null}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
