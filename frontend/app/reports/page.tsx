'use client';

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FileText, CreditCard, Landmark, TrendingUp, BarChart3, Users } from 'lucide-react';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import { api } from '@/lib/api';
import { formatCurrency, formatCompactCurrency } from '@/lib/utils';
import { Skeleton, EmptyState, FilterChip } from '@/components/ui';
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

        <main className="p-4 sm:p-6 space-y-4 flex-1 overflow-y-auto">
          {/* Report Tab Selector */}
          <div className="space-y-2.5">
            <div className="glass-panel p-1.5 rounded-xl flex flex-wrap gap-1.5">
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
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                      isActive
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {t.label}
                  </button>
                );
              })}
            </div>

            {/* Active Report Filters */}
            {(activeTab !== 'LEDGER' || selectedAccountId !== '') && (
              <div className="flex items-center gap-2 flex-wrap animate-in fade-in slide-in-from-top-1">
                <span className="section-label">Active:</span>
                {activeTab !== 'LEDGER' && (
                  <FilterChip
                    label="Report View"
                    value={
                      activeTab === 'RECEIVABLES' ? 'Customer Receivables' :
                      activeTab === 'PAYABLES' ? 'Supplier Payables' :
                      activeTab === 'PROFITABILITY' ? 'Profitability & Margins' :
                      'GST Tax Return'
                    }
                    onRemove={() => setActiveTab('LEDGER')}
                  />
                )}
                {selectedAccountId !== '' && (
                  <FilterChip
                    label="Account"
                    value={accounts.find((a: any) => a.id === selectedAccountId)?.account_name || 'Selected'}
                    onRemove={() => setSelectedAccountId('')}
                  />
                )}
                <button
                  onClick={() => {
                    setActiveTab('LEDGER');
                    setSelectedAccountId('');
                  }}
                  className="text-xs font-semibold text-slate-400 hover:text-rose-600 underline ml-1 transition-colors"
                >
                  Reset to Ledger
                </button>
              </div>
            )}
          </div>

          {/* TAB 1: LEDGER STATEMENT */}
          {activeTab === 'LEDGER' && (
            <div className="space-y-3">
              <div className="glass-panel p-3 rounded-xl flex flex-col sm:flex-row items-start sm:items-center gap-3">
                <label className="text-xs font-bold text-slate-700 shrink-0">Select Ledger Account:</label>
                <select
                  value={selectedAccountId}
                  onChange={(e) => setSelectedAccountId(e.target.value)}
                  className="glass-input p-2 rounded-lg text-xs bg-white w-full sm:w-80 font-semibold border border-slate-200"
                >
                  <option value="">-- Select Account --</option>
                  {accounts.map((a: any) => (
                    <option key={a.id} value={a.id}>{a.account_name} ({a.account_type})</option>
                  ))}
                </select>
              </div>

              {isStatementLoading ? (
                <div className="glass-panel rounded-xl p-4 border border-slate-200 space-y-3">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                    <Skeleton className="h-6 w-48 rounded-md" />
                    <Skeleton className="h-6 w-32 rounded-md" />
                  </div>
                  <div className="space-y-2.5">
                    {[...Array(4)].map((_, i) => (
                      <Skeleton key={i} className="h-8 w-full rounded-md" />
                    ))}
                  </div>
                </div>
              ) : statement ? (
                <div className="glass-panel rounded-xl overflow-hidden border border-slate-200 space-y-3 p-3.5 sm:p-4">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <div>
                      <h3 className="font-bold text-slate-900 text-base">{statement.account_name}</h3>
                      <span className="text-xs text-slate-500 font-normal">Account Type: {statement.account_type}</span>
                    </div>
                    <div className="text-right">
                      <span className="section-label block text-slate-400">Closing Balance</span>
                      <span className="text-xl font-bold text-emerald-700">₹{formatCurrency(statement.closing_balance)}</span>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[550px] text-left text-xs">
                      <thead className="bg-slate-100/95 backdrop-blur-xs text-slate-500 border-b border-slate-200 uppercase text-[10px] font-semibold tracking-wider">
                        <tr>
                          <th className="px-3.5 py-2.5">Date</th>
                          <th className="px-3.5 py-2.5">Voucher</th>
                          <th className="px-3.5 py-2.5 text-right">Debit (₹)</th>
                          <th className="px-3.5 py-2.5 text-right">Credit (₹)</th>
                          <th className="px-3.5 py-2.5 text-right">Running Balance (₹)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-slate-700 bg-white">
                        {statement.lines.map((line: any) => (
                          <tr key={line.id} className="table-row-interactive transition-colors border-b border-slate-100">
                            <td className="px-3.5 py-2.5 font-medium">{line.transaction_date}</td>
                            <td className="px-3.5 py-2.5 font-mono font-bold text-indigo-700">{line.voucher_type}</td>
                            <td className="px-3.5 py-2.5 text-right text-emerald-700 font-semibold">
                              {parseFloat(line.debit_amount) > 0 ? `₹${formatCurrency(line.debit_amount)}` : '-'}
                            </td>
                            <td className="px-3.5 py-2.5 text-right text-rose-700 font-semibold">
                              {parseFloat(line.credit_amount) > 0 ? `₹${formatCurrency(line.credit_amount)}` : '-'}
                            </td>
                            <td className="px-3.5 py-2.5 text-right font-bold text-slate-900">₹{formatCurrency(line.running_balance)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : null}
            </div>
          )}

          {/* TAB 2: RECEIVABLES */}
          {activeTab === 'RECEIVABLES' && (
            <div className="space-y-4">
              <div className="glass-panel p-4 rounded-xl border border-slate-200 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                  <h3 className="font-bold text-slate-900 text-base">Customer Receivables Overview</h3>
                  {isReceivablesLoading ? (
                    <Skeleton className="h-6 w-32 rounded-md" />
                  ) : (
                    <span className="text-lg font-bold text-emerald-700">Total: ₹{formatCurrency(receivables?.total_receivables)}</span>
                  )}
                </div>

                {/* Receivables Bar Chart */}
                {!isReceivablesLoading && receivablesChartData.length > 0 && (
                  <div className="glass-card p-4 rounded-xl border border-slate-200 bg-white space-y-3">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                      <div>
                        <h4 className="font-bold text-slate-900 text-sm">Top Outstanding Balances by Customer</h4>
                        <p className="text-xs text-slate-500 font-normal mt-0.5">Customers with highest unpaid receivables</p>
                      </div>
                      <span className="text-xs font-semibold px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200">
                        {receivables?.parties?.length || 0} Debtors
                      </span>
                    </div>
                    <div className="h-[220px] w-full">
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
                          <Bar dataKey="balance" name="Outstanding Balance" fill="#059669" radius={[6, 6, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )}

                {/* Party Cards Grid */}
                {isReceivablesLoading ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {[...Array(4)].map((_, i) => (
                      <Skeleton key={i} className="h-16 w-full rounded-lg" />
                    ))}
                  </div>
                ) : receivables?.parties?.length === 0 ? (
                  <EmptyState
                    icon={CreditCard}
                    title="No Pending Receivables"
                    description="All customer accounts are currently settled."
                  />
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {receivables?.parties?.map((p: any) => (
                      <div key={p.party_id} className="glass-card p-3 rounded-lg flex items-center justify-between border border-slate-200">
                        <div>
                          <div className="font-semibold text-slate-900 text-sm">{p.party_name}</div>
                          <div className="text-xs text-slate-500 font-normal">{p.city} | Credit: {p.credit_days} days</div>
                        </div>
                        <div className="font-bold text-emerald-700 text-sm">₹{formatCurrency(p.current_balance)}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: PAYABLES */}
          {activeTab === 'PAYABLES' && (
            <div className="space-y-4">
              <div className="glass-panel p-4 rounded-xl border border-slate-200 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                  <h3 className="font-bold text-slate-900 text-base">Supplier Payables Overview</h3>
                  {isPayablesLoading ? (
                    <Skeleton className="h-6 w-32 rounded-md" />
                  ) : (
                    <span className="text-lg font-bold text-rose-700">Total: ₹{formatCurrency(payables?.total_payables)}</span>
                  )}
                </div>

                {/* Payables Bar Chart */}
                {!isPayablesLoading && payablesChartData.length > 0 && (
                  <div className="glass-card p-4 rounded-xl border border-slate-200 bg-white space-y-3">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                      <div>
                        <h4 className="font-bold text-slate-900 text-sm">Top Outstanding Dues by Supplier</h4>
                        <p className="text-xs text-slate-500 font-normal mt-0.5">Suppliers with highest pending payables</p>
                      </div>
                      <span className="text-xs font-semibold px-2.5 py-1 rounded-md bg-rose-50 text-rose-700 border border-rose-200">
                        {payables?.parties?.length || 0} Creditors
                      </span>
                    </div>
                    <div className="h-[220px] w-full">
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
                          <Bar dataKey="balance" name="Pending Payable" fill="#4f46e5" radius={[6, 6, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )}

                {/* Party Cards Grid */}
                {isPayablesLoading ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {[...Array(4)].map((_, i) => (
                      <Skeleton key={i} className="h-16 w-full rounded-lg" />
                    ))}
                  </div>
                ) : payables?.parties?.length === 0 ? (
                  <EmptyState
                    icon={CreditCard}
                    title="No Pending Payables"
                    description="All supplier dues are currently clear."
                  />
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {payables?.parties?.map((p: any) => (
                      <div key={p.party_id} className="glass-card p-3 rounded-lg flex items-center justify-between border border-slate-200">
                        <div>
                          <div className="font-semibold text-slate-900 text-sm">{p.party_name}</div>
                          <div className="text-xs text-slate-500 font-normal">{p.city}</div>
                        </div>
                        <div className="font-bold text-rose-700 text-sm">₹{formatCurrency(p.current_balance)}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 4: PROFITABILITY */}
          {activeTab === 'PROFITABILITY' && (
            <div className="space-y-4">
              {/* Horizontal Bar Chart: Top Parties by Profit & Revenue */}
              {!isProfLoading && profitabilityChartData.length > 0 && (
                <div className="glass-card p-4 rounded-xl border border-slate-200 bg-white space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-2.5">
                    <div>
                      <h4 className="font-bold text-slate-900 text-sm">Top Customers by Net Profit</h4>
                      <p className="text-xs text-slate-500 font-normal mt-0.5">Gross revenue vs net profit margin per customer</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-md">
                        <span className="h-2 w-2 rounded-full bg-indigo-600" />
                        <span>Revenue</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
                        <span className="h-2 w-2 rounded-full bg-emerald-600" />
                        <span>Net Profit</span>
                      </div>
                    </div>
                  </div>

                  <div className="h-[250px] w-full">
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
                          fontWeight="600"
                          tickLine={false}
                          axisLine={false}
                          width={110}
                        />
                        <RechartsTooltip content={<CustomReportTooltip />} />
                        <Bar dataKey="revenue" name="Total Revenue" fill="#4f46e5" radius={[0, 4, 4, 0]} barSize={10} />
                        <Bar dataKey="netProfit" name="Net Profit" fill="#059669" radius={[0, 4, 4, 0]} barSize={10} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {/* Data Table */}
              <div className="glass-panel p-4 rounded-xl border border-slate-200 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                  <h3 className="font-bold text-slate-900 text-base">Customer &amp; Party Margins</h3>
                  <div className="text-right">
                    <span className="section-label block text-slate-500">Total Net Profit</span>
                    {isProfLoading ? (
                      <Skeleton className="h-6 w-28 rounded-md" />
                    ) : (
                      <span className="text-lg font-bold text-emerald-700">₹{formatCurrency(partyProf?.total_profit)}</span>
                    )}
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[550px] text-left text-xs">
                    <thead className="bg-slate-100/95 backdrop-blur-xs text-slate-500 border-b border-slate-200 uppercase text-[10px] font-semibold tracking-wider">
                      <tr>
                        <th className="px-3.5 py-2.5">Customer</th>
                        <th className="px-3.5 py-2.5 text-right">Revenue (₹)</th>
                        <th className="px-3.5 py-2.5 text-right">COGS (₹)</th>
                        <th className="px-3.5 py-2.5 text-right">Net Profit (₹)</th>
                        <th className="px-3.5 py-2.5 text-right">Margin %</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700 bg-white">
                      {isProfLoading ? (
                        [...Array(4)].map((_, i) => (
                          <tr key={i} className="animate-pulse">
                            <td className="px-3.5 py-2.5"><Skeleton className="h-4.5 w-32 rounded-md" /></td>
                            <td className="px-3.5 py-2.5 text-right"><Skeleton className="h-4.5 w-20 rounded-md ml-auto" /></td>
                            <td className="px-3.5 py-2.5 text-right"><Skeleton className="h-4.5 w-20 rounded-md ml-auto" /></td>
                            <td className="px-3.5 py-2.5 text-right"><Skeleton className="h-4.5 w-20 rounded-md ml-auto" /></td>
                            <td className="px-3.5 py-2.5 text-right"><Skeleton className="h-4.5 w-16 rounded-md ml-auto" /></td>
                          </tr>
                        ))
                      ) : partyProf?.parties?.length === 0 ? (
                        <tr><td colSpan={5} className="p-6 text-center text-slate-500">No party sales recorded yet.</td></tr>
                      ) : (
                        partyProf?.parties?.map((pt: any) => (
                          <tr key={pt.party_id} className="table-row-interactive transition-colors border-b border-slate-100">
                            <td className="px-3.5 py-2.5 font-semibold text-slate-900">{pt.party_name}</td>
                            <td className="px-3.5 py-2.5 text-right font-normal">₹{formatCurrency(pt.total_revenue)}</td>
                            <td className="px-3.5 py-2.5 text-right text-slate-500 font-normal">₹{formatCurrency(pt.total_cogs)}</td>
                            <td className="px-3.5 py-2.5 text-right text-emerald-700 font-semibold">₹{formatCurrency(pt.net_profit)}</td>
                            <td className="px-3.5 py-2.5 text-right font-semibold text-indigo-700">{pt.profit_margin_percent}%</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: GST RETURN SUMMARY */}
          {activeTab === 'GST' && (
            <div className="space-y-4">
              {isGstLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {[...Array(3)].map((_, i) => (
                    <Skeleton key={i} className="h-28 w-full rounded-xl" />
                  ))}
                </div>
              ) : gst ? (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="glass-card p-4 rounded-xl border-slate-200 bg-white">
                      <span className="section-label block text-slate-500">Output GST (Sales)</span>
                      <h3 className="text-2xl font-bold text-slate-900 mt-1.5">₹{formatCurrency(gst.output_gst_amount)}</h3>
                      <p className="text-xs font-normal text-slate-500 mt-0.5">Taxable: ₹{formatCurrency(gst.sales_taxable_amount)}</p>
                    </div>

                    <div className="glass-card p-4 rounded-xl border-slate-200 bg-white">
                      <span className="section-label block text-slate-500">Input Tax Credit (ITC)</span>
                      <h3 className="text-2xl font-bold text-slate-900 mt-1.5">₹{formatCurrency(gst.input_gst_amount)}</h3>
                      <p className="text-xs font-normal text-slate-500 mt-0.5">Taxable: ₹{formatCurrency(gst.purchase_taxable_amount)}</p>
                    </div>

                    <div className="glass-card p-4 rounded-xl border-slate-200 bg-white">
                      <span className="section-label block text-slate-500">Net GST Liability</span>
                      <h3 className="text-2xl font-bold text-amber-800 mt-1.5">₹{formatCurrency(gst.net_gst_payable)}</h3>
                      <p className="text-xs font-normal text-slate-500 mt-0.5">Output GST minus Input Tax Credit</p>
                    </div>
                  </div>

                  {/* GST Tax Comparison Bar Chart */}
                  <div className="glass-card p-4 rounded-xl border border-slate-200 bg-white space-y-3">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                      <div>
                        <h4 className="font-bold text-slate-900 text-sm">GST Tax Settlement Summary</h4>
                        <p className="text-xs text-slate-500 font-normal mt-0.5">Comparison of tax collected on sales vs input tax credit paid on inward purchases</p>
                      </div>
                    </div>

                    <div className="h-[220px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={gstChartData} margin={{ top: 10, right: 20, left: 10, bottom: 5 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                          <XAxis
                            dataKey="name"
                            stroke="#94a3b8"
                            fontSize={11}
                            fontWeight="600"
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
                          <Bar dataKey="amount" name="Amount" radius={[6, 6, 0, 0]} barSize={40}>
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
