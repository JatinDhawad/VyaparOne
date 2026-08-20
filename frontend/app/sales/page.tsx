'use client';

import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import Modal from '@/components/Modal';
import { api } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';


// ─── Helper ──────────────────────────────────────────────────────────────────
const n = (v: string) => parseFloat(v) || 0;

export default function SalesPage() {
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formError, setFormError] = useState('');

  // ── Header fields ────────────────────────────────────────────────────────
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [customerId, setCustomerId]       = useState('');
  const [location, setLocation]           = useState('');

  // ── Item builder ─────────────────────────────────────────────────────────
  const [selectedProduct, setSelectedProduct] = useState('');
  const [qty, setQty]                         = useState('');
  const [unitPrice, setUnitPrice]             = useState('');
  const [items, setItems]                     = useState<any[]>([]);

  // ── GST split (informational only) ───────────────────────────────────────
  const [gstBilledAmount, setGstBilledAmount]     = useState('');
  const [withoutGstAmount, setWithoutGstAmount]   = useState('');

  // ── Deductions ───────────────────────────────────────────────────────────
  const [lrCharges, setLrCharges]               = useState('');
  const [localFreight, setLocalFreight]         = useState('');
  const [salesmanComm, setSalesmanComm]         = useState('');
  const [schemeMoney, setSchemeMoney]           = useState('');

  // ── Payment ──────────────────────────────────────────────────────────────
  const [amountPaid, setAmountPaid]   = useState('');
  const [paymentMode, setPaymentMode] = useState('CASH');
  const [notes, setNotes]             = useState('');

  // ── Sort state ───────────────────────────────────────────────────────────
  const [sortField, setSortField] = useState<'date' | 'invoice' | 'total' | 'paid' | 'pending'>('date');
  const [sortDir, setSortDir]     = useState<'asc' | 'desc'>('desc');

  const toggleSort = (field: typeof sortField) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('desc'); }
  };

  // ── Data queries ─────────────────────────────────────────────────────────
  const { data: sales = [], isLoading } = useQuery({
    queryKey: ['sales'],
    queryFn: () => api.getSales(),
  });
  const { data: customers = [] } = useQuery({
    queryKey: ['customers'],
    queryFn: () => api.getParties('CUSTOMER'),
  });
  const { data: products = [] } = useQuery({
    queryKey: ['products'],
    queryFn: () => api.getProducts(),
  });

  // ── Sorted sales list ────────────────────────────────────────────────────
  const sortedSales = useMemo(() => {
    return [...sales].sort((a: any, b: any) => {
      let valA: any, valB: any;
      if (sortField === 'date')    { valA = a.invoice_date;   valB = b.invoice_date; }
      if (sortField === 'invoice') { valA = a.invoice_number; valB = b.invoice_number; }
      if (sortField === 'total')   { valA = parseFloat(a.grand_total || 0);   valB = parseFloat(b.grand_total || 0); }
      if (sortField === 'paid')    { valA = parseFloat(a.amount_paid || 0);   valB = parseFloat(b.amount_paid || 0); }
      if (sortField === 'pending') { valA = parseFloat(a.pending_amount || 0); valB = parseFloat(b.pending_amount || 0); }
      if (valA < valB) return sortDir === 'asc' ? -1 : 1;
      if (valA > valB) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
  }, [sales, sortField, sortDir]);

  // ── Derived totals (live preview) ────────────────────────────────────────
  const grossGoodsAmount = useMemo(
    () => items.reduce((acc, it) => acc + it.quantity * it.unit_selling_price, 0),
    [items]
  );

  const totalDeductions = useMemo(
    () => n(lrCharges) + n(localFreight) + n(salesmanComm) + n(schemeMoney),
    [lrCharges, localFreight, salesmanComm, schemeMoney]
  );

  const netGrandTotal   = Math.max(0, grossGoodsAmount - totalDeductions);
  const remainingBalance = Math.max(0, netGrandTotal - n(amountPaid));

  // ── Mutation ─────────────────────────────────────────────────────────────
  const createMutation = useMutation({
    mutationFn: (data: any) => api.createSale(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      setIsModalOpen(false);
      resetForm();
    },
    onError: (err: any) => {
      setFormError(err.message || 'Failed to create sales invoice.');
    },
  });

  const resetForm = () => {
    setInvoiceNumber(''); setCustomerId(''); setLocation('');
    setSelectedProduct(''); setQty(''); setUnitPrice('');
    setItems([]);
    setGstBilledAmount(''); setWithoutGstAmount('');
    setLrCharges(''); setLocalFreight(''); setSalesmanComm(''); setSchemeMoney('');
    setAmountPaid(''); setPaymentMode('CASH'); setNotes('');
    setFormError('');
  };

  // ── Add item to cart ──────────────────────────────────────────────────────
  const handleAddItem = () => {
    if (!selectedProduct || !qty || !unitPrice) return;
    const prod = products.find((p: any) => p.id === selectedProduct);
    if (!prod) return;

    const existingIdx = items.findIndex((i) => i.product_id === selectedProduct);
    if (existingIdx >= 0) {
      const updated = [...items];
      updated[existingIdx].quantity += parseFloat(qty);
      setItems(updated);
    } else {
      setItems([...items, {
        product_id: prod.id,
        product_name: prod.name,
        quantity: parseFloat(qty),
        unit_selling_price: parseFloat(unitPrice),
      }]);
    }
    setQty(''); setUnitPrice('');
  };

  const removeItem = (idx: number) => setItems(items.filter((_, i) => i !== idx));

  // ── GST split quick-fill buttons ─────────────────────────────────────────
  const setGstSplit = (mode: 'full' | 'none' | 'half') => {
    const g = grossGoodsAmount;
    if (mode === 'full')  { setGstBilledAmount(g.toFixed(2));         setWithoutGstAmount(''); }
    if (mode === 'none')  { setGstBilledAmount('');                  setWithoutGstAmount(g.toFixed(2)); }
    if (mode === 'half')  { setGstBilledAmount((g/2).toFixed(2));     setWithoutGstAmount((g/2).toFixed(2)); }
  };

  // ── Submit ────────────────────────────────────────────────────────────────
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerId) { setFormError('Please select a customer.'); return; }
    if (items.length === 0) { setFormError('Please add at least one item.'); return; }

    createMutation.mutate({
      invoice_number:     invoiceNumber || null,
      customer_id:        customerId,
      invoice_date:       new Date().toISOString().split('T')[0],
      location,
      gst_billed_amount:  n(gstBilledAmount),
      without_gst_amount: n(withoutGstAmount),
      lr_charges:         n(lrCharges),
      local_freight:      n(localFreight),
      salesman_commission: n(salesmanComm),
      scheme_money:       n(schemeMoney),
      delivery_charges:   0,
      amount_paid:        n(amountPaid),
      payment_mode:       paymentMode,
      notes,
      items: items.map((i) => ({
        product_id:         i.product_id,
        quantity:           i.quantity,
        unit_selling_price: i.unit_selling_price,
      })),
    });
  };

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Header
          title="Sales & POS Billing"
          onActionClick={() => setIsModalOpen(true)}
          actionLabel="New Sales Invoice"
        />

        {/* ── Invoice Table ────────────────────────────────────────────── */}
        <main className="p-8 space-y-6 flex-1 overflow-y-auto">
          <div className="glass-panel rounded-2xl overflow-hidden border border-slate-200">
            {/* Table header + sort controls */}
            <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <span className="font-bold text-slate-900 text-sm">Recent Sales Invoices</span>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Sort by:</span>
                {([['date','Date'],['invoice','Invoice #'],['total','Total'],['paid','Paid'],['pending','Pending']] as const).map(([f, label]) => (
                  <button
                    key={f}
                    onClick={() => toggleSort(f)}
                    className={`flex items-center gap-1 px-3 py-1.5 rounded-xl text-[10px] font-extrabold border transition-all ${
                      sortField === f
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-md'
                        : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300 hover:text-indigo-700'
                    }`}
                  >
                    {label}
                    {sortField === f
                      ? sortDir === 'desc' ? <ArrowDown className="h-3 w-3" /> : <ArrowUp className="h-3 w-3" />
                      : <ArrowUpDown className="h-3 w-3 opacity-40" />}
                  </button>
                ))}
              </div>
            </div>
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100/80 text-slate-500 border-b border-slate-200 uppercase text-[10px] font-bold">
                <tr>
                  <th className="p-4">Invoice #</th>
                  <th className="p-4">Date</th>
                  <th className="p-4">Customer</th>
                  <th className="p-4">Location</th>
                  <th className="p-4 text-right">Grand Total (₹)</th>
                  <th className="p-4 text-right">Paid (₹)</th>
                  <th className="p-4 text-right">Pending (₹)</th>
                  <th className="p-4 text-right">Net Profit (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {isLoading ? (
                  <tr><td colSpan={8} className="p-8 text-center text-slate-500">Loading...</td></tr>
                ) : sales.length === 0 ? (
                  <tr><td colSpan={8} className="p-8 text-center text-slate-500">No sales invoices yet.</td></tr>
                ) : (
                  sortedSales.map((s: any) => (
                    <tr key={s.id} className="hover:bg-slate-100/50 transition-colors">
                      <td className="p-4 font-mono font-bold text-indigo-700">{s.invoice_number}</td>
                      <td className="p-4 font-medium">{s.invoice_date}</td>
                      <td className="p-4 font-semibold text-slate-900">{s.customer?.name || '—'}</td>
                      <td className="p-4 text-slate-500">{s.location || '—'}</td>
                      <td className="p-4 text-right font-bold text-slate-900">₹{formatCurrency(s.grand_total)}</td>
                      <td className="p-4 text-right text-emerald-700 font-semibold">₹{formatCurrency(s.amount_paid)}</td>
                      <td className={`p-4 text-right font-bold ${s.pending_amount > 0 ? 'text-rose-600' : 'text-slate-400'}`}>
                        ₹{formatCurrency(s.pending_amount)}
                      </td>
                      <td className="p-4 text-right text-emerald-700 font-bold">₹{formatCurrency(s.net_profit)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </main>
      </div>

      {/* ── POS Billing Modal ──────────────────────────────────────────────── */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Generate Sales Invoice (POS)">
        {formError && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold">{formError}</div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5 text-xs">

          {/* ── SECTION 1: Customer & Location ─────────────────────────── */}
          <div className="space-y-2">
            <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">1 · Customer & Invoice</div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="font-bold text-slate-600 block mb-1">Invoice # <span className="text-slate-400 font-normal">(optional)</span></label>
                <input
                  type="text"
                  value={invoiceNumber}
                  onChange={(e) => setInvoiceNumber(e.target.value)}
                  placeholder="Auto-generated if blank"
                  className="glass-input w-full p-2.5 rounded-xl font-mono"
                />
              </div>
              <div>
                <label className="font-bold text-slate-600 block mb-1">Customer <span className="text-rose-500">*</span></label>
                <select
                  value={customerId}
                  onChange={(e) => setCustomerId(e.target.value)}
                  className="glass-input w-full p-2.5 rounded-xl bg-white font-medium"
                  required
                >
                  <option value="">-- Select Buyer --</option>
                  {customers.map((c: any) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="font-bold text-slate-600 block mb-1">Delivery Location</label>
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="e.g. Delhi Godown"
                  className="glass-input w-full p-2.5 rounded-xl"
                />
              </div>
            </div>
          </div>

          {/* ── SECTION 2: Item Cart Builder ────────────────────────────── */}
          <div className="space-y-2">
            <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">2 · Add Items (Qty × Rate, GST-inclusive)</div>
            <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
              <div className="grid grid-cols-3 gap-2">
                <select
                  value={selectedProduct}
                  onChange={(e) => {
                    setSelectedProduct(e.target.value);
                    const p = products.find((pr: any) => pr.id === e.target.value);
                    if (p) setUnitPrice(String(p.default_selling_price || ''));
                  }}
                  className="glass-input p-2.5 rounded-xl bg-white"
                >
                  <option value="">Select Product</option>
                  {products.map((p: any) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
                <input
                  type="text" inputMode="decimal"
                  placeholder="Qty (PKT / BAG)"
                  value={qty}
                  onChange={(e) => setQty(e.target.value)}
                  className="glass-input p-2.5 rounded-xl"
                 
                />
                <input
                  type="text" inputMode="decimal"
                  placeholder="Rate per unit (₹) incl. GST"
                  value={unitPrice}
                  onChange={(e) => setUnitPrice(e.target.value)}
                  className="glass-input p-2.5 rounded-xl"
                 
                />
              </div>
              <button
                type="button"
                onClick={handleAddItem}
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-sm transition-colors"
              >
                + Add to Cart
              </button>

              {/* Cart rows */}
              {items.length > 0 && (
                <div className="border border-slate-200 rounded-xl overflow-hidden mt-1">
                  <div className="bg-slate-100 px-3 py-1.5 text-[10px] font-bold text-slate-500 uppercase grid grid-cols-4 gap-2">
                    <span className="col-span-2">Item</span>
                    <span className="text-right">Qty × Rate</span>
                    <span className="text-right">Amount</span>
                  </div>
                  {items.map((it, idx) => (
                    <div key={idx} className="px-3 py-2 grid grid-cols-4 gap-2 items-center border-t border-slate-100">
                      <span className="col-span-2 font-semibold text-slate-800">{it.product_name}</span>
                      <span className="text-right text-slate-500">{it.quantity} × ₹{formatCurrency(it.unit_selling_price)}</span>
                      <div className="flex items-center justify-end gap-2">
                        <span className="font-bold text-slate-900">₹{formatCurrency(it.quantity * it.unit_selling_price)}</span>
                        <button
                          type="button"
                          onClick={() => removeItem(idx)}
                          className="text-rose-400 hover:text-rose-600 font-bold text-sm leading-none"
                        >×</button>
                      </div>
                    </div>
                  ))}
                  <div className="px-3 py-2 bg-indigo-50 border-t border-indigo-100 flex justify-between font-bold text-indigo-900">
                    <span>Gross Goods Amount</span>
                    <span>₹{formatCurrency(grossGoodsAmount)}</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ── SECTION 3: GST Split (Informational) ────────────────────── */}
          <div className="space-y-2">
            <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              3 · GST Split <span className="text-slate-300 font-normal normal-case">(informational — does not affect total)</span>
            </div>
            <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
              <div className="flex gap-2">
                <button type="button" onClick={() => setGstSplit('full')}
                  className="flex-1 py-1.5 rounded-lg bg-blue-100 hover:bg-blue-200 text-blue-800 font-bold text-[10px] transition-colors">
                  100% GST Bill
                </button>
                <button type="button" onClick={() => setGstSplit('none')}
                  className="flex-1 py-1.5 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-[10px] transition-colors">
                  100% Without GST
                </button>
                <button type="button" onClick={() => setGstSplit('half')}
                  className="flex-1 py-1.5 rounded-lg bg-violet-100 hover:bg-violet-200 text-violet-800 font-bold text-[10px] transition-colors">
                  50 / 50 Split
                </button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-blue-700 block mb-1">GST-Billed Amount (₹)</label>
                  <input type="text" inputMode="decimal" placeholder="0" value={gstBilledAmount}
                    onChange={(e) => setGstBilledAmount(e.target.value)}
                    className="glass-input w-full p-2 rounded-xl" />
                </div>
                <div>
                  <label className="font-bold text-slate-600 block mb-1">Without-GST / Cash (₹)</label>
                  <input type="text" inputMode="decimal" placeholder="0" value={withoutGstAmount}
                    onChange={(e) => setWithoutGstAmount(e.target.value)}
                    className="glass-input w-full p-2 rounded-xl" />
                </div>
              </div>
            </div>
          </div>

          {/* ── SECTION 4: Deductions ────────────────────────────────────── */}
          <div className="space-y-2">
            <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">4 · Deductions from Total</div>
            <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200 space-y-2">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-amber-800 block mb-1">LR / Bilty Charges (₹) −</label>
                  <input type="text" inputMode="decimal" placeholder="0" value={lrCharges}
                    onChange={(e) => setLrCharges(e.target.value)}
                    className="glass-input w-full p-2 rounded-xl" />
                </div>
                <div>
                  <label className="font-bold text-amber-800 block mb-1">Local Freight (₹) −</label>
                  <input type="text" inputMode="decimal" placeholder="0" value={localFreight}
                    onChange={(e) => setLocalFreight(e.target.value)}
                    className="glass-input w-full p-2 rounded-xl" />
                </div>
                <div>
                  <label className="font-bold text-amber-800 block mb-1">Salesman Commission (₹) −</label>
                  <input type="text" inputMode="decimal" placeholder="0" value={salesmanComm}
                    onChange={(e) => setSalesmanComm(e.target.value)}
                    className="glass-input w-full p-2 rounded-xl" />
                </div>
                <div>
                  <label className="font-bold text-amber-800 block mb-1">Scheme Money (₹) −</label>
                  <input type="text" inputMode="decimal" placeholder="0" value={schemeMoney}
                    onChange={(e) => setSchemeMoney(e.target.value)}
                    className="glass-input w-full p-2 rounded-xl" />
                </div>
              </div>
              {totalDeductions > 0 && (
                <div className="flex justify-between text-amber-900 font-bold pt-1 border-t border-amber-200">
                  <span>Total Deductions</span>
                  <span>− ₹{formatCurrency(totalDeductions)}</span>
                </div>
              )}
            </div>
          </div>

          {/* ── SECTION 5: Payment & Summary ────────────────────────────── */}
          <div className="rounded-2xl bg-slate-800 text-white p-4 space-y-3">
            <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">5 · Payment & Balance</div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-300">Gross Goods Amount</span>
              <span className="font-bold">₹{formatCurrency(grossGoodsAmount)}</span>
            </div>
            {totalDeductions > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-amber-400">Total Deductions</span>
                <span className="font-bold text-amber-400">− ₹{formatCurrency(totalDeductions)}</span>
              </div>
            )}
            <div className="flex justify-between text-base font-black border-t border-slate-600 pt-2">
              <span>Net Grand Total</span>
              <span className="text-emerald-400">₹{formatCurrency(netGrandTotal)}</span>
            </div>
            <div className="grid grid-cols-2 gap-3 pt-1">
              <div>
                <label className="font-bold text-slate-300 block mb-1">Payment Received (₹)</label>
                <input
                  type="text" inputMode="decimal"
                  value={amountPaid}
                  onChange={(e) => setAmountPaid(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-slate-700 border border-slate-600 text-white font-mono"
                 
                />
              </div>
              <div>
                <label className="font-bold text-slate-300 block mb-1">Payment Mode</label>
                <select
                  value={paymentMode}
                  onChange={(e) => setPaymentMode(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-slate-700 border border-slate-600 text-white font-medium"
                >
                  <option value="CASH">Cash</option>
                  <option value="CHEQUE">Cheque</option>
                  <option value="NEFT">NEFT / Bank Transfer</option>
                  <option value="UPI">UPI</option>
                  <option value="CREDIT">On Credit</option>
                </select>
              </div>
            </div>
            <div className="flex justify-between text-sm border-t border-slate-600 pt-2">
              <span className="text-slate-300">Remaining Balance</span>
              <span className={`font-black text-base ${remainingBalance > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                ₹{formatCurrency(remainingBalance)}
              </span>
            </div>
            <div>
              <label className="font-bold text-slate-300 block mb-1">Notes</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                placeholder="Optional remarks..."
                className="w-full p-2.5 rounded-xl bg-slate-700 border border-slate-600 text-white resize-none text-xs"
              />
            </div>
          </div>

          {/* ── Actions ─────────────────────────────────────────────────── */}
          <div className="flex justify-end gap-3 pt-1">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-5 py-2.5 font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="px-6 py-2.5 font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-md transition-colors disabled:opacity-60"
            >
              {createMutation.isPending ? 'Processing...' : '✓ Complete Sale'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
