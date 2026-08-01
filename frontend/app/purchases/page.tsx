'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Plus, 
  Trash2, 
  PackageCheck, 
  Receipt, 
  DollarSign, 
  ShoppingBag, 
  FileText, 
  Search, 
  Truck,
  Sparkles,
  CreditCard,
  Pencil
} from 'lucide-react';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import Modal from '@/components/Modal';
import { api } from '@/lib/api';

export default function PurchasesPage() {
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [formError, setFormError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Main Form State
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split('T')[0]);
  
  // Itemized Expenses & Deductions
  const [lrCharges, setLrCharges] = useState('0.00');
  const [localFreight, setLocalFreight] = useState('0.00');
  const [salesmanExpense, setSalesmanExpense] = useState('0.00'); // Deducted (reimbursed by supplier)
  const [schemeMoney, setSchemeMoney] = useState('0.00'); // Deducted

  // Unbilled & Payment Given
  const [unbilledNonGst, setUnbilledNonGst] = useState('0.00');
  const [amountPaid, setAmountPaid] = useState('0.00');
  const [notes, setNotes] = useState('');

  // Item Add State
  const [selectedProduct, setSelectedProduct] = useState('');
  const [productName, setProductName] = useState('');
  const [hsnCode, setHsnCode] = useState('');
  const [unit, setUnit] = useState('BAG');
  const [billedQty, setBilledQty] = useState('5');
  const [unitPrice, setUnitPrice] = useState('4800.00');
  const [gstRate, setGstRate] = useState('5.00');

  // Items Array
  const [items, setItems] = useState<any[]>([]);

  const { data: purchases = [], isLoading } = useQuery({
    queryKey: ['purchases'],
    queryFn: () => api.getPurchases(),
  });

  const { data: suppliers = [] } = useQuery({
    queryKey: ['suppliers'],
    queryFn: () => api.getParties('SUPPLIER'),
  });

  const { data: products = [] } = useQuery({
    queryKey: ['products'],
    queryFn: () => api.getProducts(),
  });

  const createPurchaseMutation = useMutation({
    mutationFn: (data: any) => api.createPurchase(data),
    onSuccess: (res: any) => {
      queryClient.invalidateQueries({ queryKey: ['purchases'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      setIsModalOpen(false);
      setSuccessMessage(`Purchase bill #${invoiceNumber || res.invoice_number} saved! Stock levels updated.`);
      setTimeout(() => setSuccessMessage(''), 6000);
      resetForm();
    },
    onError: (err: any) => {
      setFormError(err.message || 'Failed to record purchase bill.');
    },
  });

  const resetForm = () => {
    setInvoiceNumber('');
    setSupplierId('');
    setInvoiceDate(new Date().toISOString().split('T')[0]);
    setLrCharges('0.00');
    setLocalFreight('0.00');
    setSalesmanExpense('0.00');
    setSchemeMoney('0.00');
    setUnbilledNonGst('0.00');
    setAmountPaid('0.00');
    setNotes('');
    setItems([]);
    setSelectedProduct('');
    setProductName('');
    setHsnCode('');
    setUnit('BAG');
    setBilledQty('5');
    setUnitPrice('4800.00');
    setGstRate('5.00');
    setFormError('');
  };

  const handleProductSelect = (prodId: string) => {
    setSelectedProduct(prodId);
    if (!prodId) {
      setProductName('');
      setHsnCode('');
      setUnitPrice('4800.00');
      return;
    }
    const prod = products.find((p: any) => p.id === prodId);
    if (prod) {
      setProductName(prod.name);
      setHsnCode(prod.hsn_code || prod.sku);
      setUnit(prod.unit || 'BAG');
      setUnitPrice(parseFloat(prod.default_purchase_price || 0).toString());
      setGstRate(parseFloat(prod.gst_rate || 0).toString());
    }
  };

  const handleAddItem = () => {
    const qtyVal = parseFloat(billedQty) || 0;
    const priceVal = parseFloat(unitPrice) || 0;
    const rateGst = parseFloat(gstRate) || 0;

    if (qtyVal <= 0) {
      setFormError('Quantity must be greater than 0.');
      return;
    }

    if (!productName && !selectedProduct) {
      setFormError('Please select or enter a product description.');
      return;
    }

    setFormError('');

    const taxable = qtyVal * priceVal;
    const gstAmt = taxable * (rateGst / 100);
    const lineTotal = taxable + gstAmt;

    setItems([
      ...items,
      {
        product_id: selectedProduct || null,
        product_name: productName || `Item ${hsnCode}`,
        hsn_code: hsnCode || '21069030',
        unit: unit || 'BAG',
        billed_quantity: qtyVal,
        unit_purchase_price: priceVal,
        gst_rate: rateGst,
        taxable_amount: taxable,
        gst_amount: gstAmt,
        line_total: lineTotal,
      },
    ]);

    setSelectedProduct('');
    setProductName('');
    setHsnCode('');
    setBilledQty('5');
  };

  const handleEditItem = (index: number) => {
    const itemToEdit = items[index];
    setSelectedProduct(itemToEdit.product_id || '');
    setProductName(itemToEdit.product_name || '');
    setHsnCode(itemToEdit.hsn_code || '');
    setUnit(itemToEdit.unit || 'BAG');
    setBilledQty(itemToEdit.billed_quantity.toString());
    setUnitPrice(itemToEdit.unit_purchase_price.toString());
    setGstRate(itemToEdit.gst_rate.toString());
    setItems(items.filter((_, i) => i !== index));
  };

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!supplierId) {
      setFormError('Please select a supplier vendor.');
      return;
    }
    if (items.length === 0) {
      setFormError('Please add at least one line item to the purchase bill.');
      return;
    }

    createPurchaseMutation.mutate({
      invoice_number: invoiceNumber || `PUR-${Date.now()}`,
      supplier_id: supplierId,
      invoice_date: invoiceDate,
      lr_charges: parseFloat(lrCharges) || 0,
      local_freight: parseFloat(localFreight) || 0,
      salesman_expense: parseFloat(salesmanExpense) || 0,
      scheme_money: parseFloat(schemeMoney) || 0,
      unbilled_nongst_amount: parseFloat(unbilledNonGst) || 0,
      amount_paid: parseFloat(amountPaid) || 0,
      notes,
      items: items.map((i) => ({
        product_id: i.product_id,
        product_name: i.product_name,
        hsn_code: i.hsn_code,
        unit: i.unit,
        billed_quantity: i.billed_quantity,
        unit_purchase_price: i.unit_purchase_price,
        discount_amount: 0,
        gst_rate: i.gst_rate,
      })),
    });
  };

  // Calculations: LR Charges, Local Freight, Salesman Expense & Scheme Money are all deducted
  const calculatedSubtotal = items.reduce((sum, i) => sum + i.taxable_amount, 0);
  const calculatedTaxAmount = items.reduce((sum, i) => sum + i.gst_amount, 0);

  const numLr = parseFloat(lrCharges) || 0;
  const numLocalFr = parseFloat(localFreight) || 0;
  const numSalesExp = parseFloat(salesmanExpense) || 0;
  const numScheme = parseFloat(schemeMoney) || 0;

  const totalBilledExpenses = - (numLr + numLocalFr + numSalesExp + numScheme);
  const officialBilledTotal = calculatedSubtotal + calculatedTaxAmount + totalBilledExpenses;

  const unbilledPayable = parseFloat(unbilledNonGst) || 0;
  const totalPayableAmount = officialBilledTotal + unbilledPayable;

  const numPaid = parseFloat(amountPaid) || 0;
  const pendingBalanceOwed = totalPayableAmount - numPaid;

  // Filtered List
  const filteredPurchases = purchases.filter((p: any) =>
    (p.invoice_number && p.invoice_number.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  // Overall Totals
  const totalPurchasesValue = purchases.reduce((sum: number, p: any) => sum + parseFloat(p.grand_total || 0), 0);
  const totalPendingOwed = purchases.reduce((sum: number, p: any) => sum + parseFloat(p.pending_amount || 0), 0);

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Header 
          title="Purchase Bills & Inventory Stock" 
          subtitle="Vendor Tax Invoices, LR/Freight expenses, partial payments & stock creation" 
          onActionClick={() => setIsModalOpen(true)}
          actionLabel="New Purchase Entry"
        />

        <main className="p-8 space-y-8 flex-1 overflow-y-auto">
          {successMessage && (
            <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-sm font-bold shadow-sm flex items-center gap-3 animate-in fade-in duration-300">
              <PackageCheck className="h-6 w-6 text-emerald-600 shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* Top Metric Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="glass-card p-6 rounded-3xl relative overflow-hidden border-indigo-100 glow-indigo">
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold uppercase tracking-wider text-indigo-700">Total Purchases Billed</span>
                <div className="h-11 w-11 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shadow-sm">
                  <ShoppingBag className="h-5 w-5" />
                </div>
              </div>
              <div className="mt-4">
                <h3 className="text-3xl font-extrabold text-slate-900 tracking-tight">
                  ₹{isLoading ? '...' : totalPurchasesValue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </h3>
                <p className="text-xs font-semibold text-slate-500 mt-1">Official GST Vendor Invoices</p>
              </div>
            </div>

            <div className="glass-card p-6 rounded-3xl relative overflow-hidden border-slate-200">
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold uppercase tracking-wider text-slate-600">Recorded Invoices</span>
                <div className="h-11 w-11 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700 shadow-sm">
                  <FileText className="h-5 w-5" />
                </div>
              </div>
              <div className="mt-4">
                <h3 className="text-3xl font-extrabold text-slate-900 tracking-tight">
                  {isLoading ? '...' : purchases.length} <span className="text-sm font-bold text-slate-500">Bills</span>
                </h3>
                <p className="text-xs font-semibold text-slate-500 mt-1">Direct stock creation entries</p>
              </div>
            </div>

            <div className="glass-card p-6 rounded-3xl relative overflow-hidden border-rose-200 bg-gradient-to-br from-rose-50/40 to-white glow-amber">
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold uppercase tracking-wider text-rose-800">Total Pending Owed</span>
                <div className="h-11 w-11 rounded-2xl bg-rose-100 border border-rose-200 flex items-center justify-center text-rose-700 shadow-sm">
                  <CreditCard className="h-5 w-5" />
                </div>
              </div>
              <div className="mt-4">
                <h3 className="text-3xl font-extrabold text-rose-800 tracking-tight">
                  ₹{isLoading ? '...' : totalPendingOwed.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </h3>
                <p className="text-xs font-semibold text-rose-700/80 mt-1">Supplier balance payable after payments</p>
              </div>
            </div>
          </div>

          {/* Table Panel */}
          <div className="glass-panel p-6 rounded-3xl space-y-6 border border-slate-200">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="relative w-full md:w-96">
                <Search className="absolute left-4 top-3.5 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search by Invoice Number..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full glass-input pl-11 pr-4 py-2.5 rounded-2xl text-xs font-medium"
                />
              </div>

              <button
                onClick={() => setIsModalOpen(true)}
                className="w-full md:w-auto px-6 py-3 bg-gradient-to-r from-indigo-600 to-emerald-600 hover:from-indigo-500 hover:to-emerald-500 text-white font-extrabold text-xs rounded-2xl shadow-lg shadow-indigo-500/20 transition-all flex items-center justify-center gap-2"
              >
                <Plus className="h-4 w-4" />
                New Purchase Entry
              </button>
            </div>

            {/* Purchase List Table */}
            <div className="rounded-2xl overflow-hidden border border-slate-200/80 shadow-sm">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100/90 text-slate-600 border-b border-slate-200 uppercase text-[10px] font-extrabold tracking-wider">
                  <tr>
                    <th className="p-4">Invoice #</th>
                    <th className="p-4">Date</th>
                    <th className="p-4">Billed Total</th>
                    <th className="p-4 text-amber-800">Unbilled</th>
                    <th className="p-4">Total Payable</th>
                    <th className="p-4 text-emerald-800">Amount Paid</th>
                    <th className="p-4 text-rose-800">Pending Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700 bg-white">
                  {isLoading ? (
                    <tr><td colSpan={7} className="p-8 text-center text-slate-500 text-sm">Loading purchase bills...</td></tr>
                  ) : filteredPurchases.length === 0 ? (
                    <tr><td colSpan={7} className="p-8 text-center text-slate-500 text-sm">No purchase invoices found.</td></tr>
                  ) : (
                    filteredPurchases.map((p: any) => {
                      const bTotal = parseFloat(p.grand_total || 0);
                      const unbilled = parseFloat(p.unbilled_nongst_amount || 0);
                      const payable = parseFloat(p.total_payable_amount || bTotal + unbilled);
                      const paid = parseFloat(p.amount_paid || 0);
                      const pending = parseFloat(p.pending_amount || payable - paid);

                      return (
                        <tr key={p.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="p-4 font-mono font-extrabold text-indigo-700 text-sm">{p.invoice_number}</td>
                          <td className="p-4 font-medium text-slate-600">{p.invoice_date}</td>
                          <td className="p-4 font-extrabold text-slate-900">₹{bTotal.toFixed(2)}</td>
                          <td className="p-4 text-amber-800 font-bold">₹{unbilled.toFixed(2)}</td>
                          <td className="p-4 font-extrabold text-slate-900">₹{payable.toFixed(2)}</td>
                          <td className="p-4 text-emerald-700 font-extrabold">₹{paid.toFixed(2)}</td>
                          <td className="p-4">
                            <span className={`px-2.5 py-1 rounded-xl text-xs font-extrabold border ${
                              pending <= 0 
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                                : 'bg-rose-50 text-rose-700 border-rose-200'
                            }`}>
                              {pending <= 0 ? 'Fully Paid' : `₹${pending.toFixed(2)} Owed`}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </main>
      </div>

      {/* New Purchase Modal (Wide max-w-5xl, Ultra-Spacious Layout) */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Record Vendor Purchase Entry (Direct Stock Creation)" maxWidth="max-w-5xl">
        {formError && <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-extrabold mb-4">{formError}</div>}
        <form onSubmit={handleSubmit} className="space-y-6 text-xs">
          
          {/* SECTION 1: Supplier & Bill Metadata */}
          <div className="p-6 rounded-3xl bg-slate-50/80 border border-slate-200 space-y-4">
            <span className="font-extrabold text-slate-800 text-xs uppercase tracking-wider block flex items-center gap-2">
              <FileText className="h-4 w-4 text-indigo-600" />
              1. Supplier & Invoice Header Details
            </span>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <div>
                <label className="block font-bold text-slate-700 mb-1.5">Invoice Number *</label>
                <input required type="text" value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} placeholder="e.g. 43" className="w-full glass-input p-3 rounded-2xl font-mono text-sm font-bold" />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1.5">Select Supplier Vendor *</label>
                <select required value={supplierId} onChange={(e) => setSupplierId(e.target.value)} className="w-full glass-input p-3 rounded-2xl bg-white text-xs font-bold text-slate-900">
                  <option value="">-- Choose Vendor --</option>
                  {suppliers.map((s: any) => (
                    <option key={s.id} value={s.id}>{s.name} ({s.city || 'Vendor'})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1.5">Invoice Date *</label>
                <input required type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} className="w-full glass-input p-3 rounded-2xl font-semibold" />
              </div>
            </div>
          </div>

          {/* SECTION 2: Goods & Stock Items Builder */}
          <div className="p-6 rounded-3xl bg-indigo-50/40 border border-indigo-100 space-y-5">
            <span className="font-extrabold text-indigo-900 text-xs uppercase tracking-wider block flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-indigo-600" />
              2. Add Goods Item (Auto-Creates Missing Products & Updates Stock)
            </span>

            <div className="grid grid-cols-12 gap-3 items-end">
              <div className="col-span-12 md:col-span-5 space-y-2">
                <label className="block text-xs font-extrabold text-slate-700">Select Existing Product OR Type Description</label>
                <select value={selectedProduct} onChange={(e) => handleProductSelect(e.target.value)} className="w-full glass-input p-3 rounded-2xl bg-white text-xs font-bold text-indigo-950 shadow-sm">
                  <option value="">-- Pick Existing SKU Catalog --</option>
                  {products.map((p: any) => (
                    <option key={p.id} value={p.id}>{p.name} (HSN: {p.hsn_code || p.sku})</option>
                  ))}
                </select>
                <input 
                  type="text" 
                  placeholder="Item Description (e.g. MOUTH FRESHNER @ 1/-)" 
                  value={productName} 
                  onChange={(e) => setProductName(e.target.value)} 
                  className="w-full glass-input p-3 rounded-2xl text-xs font-extrabold text-slate-900" 
                />
              </div>

              <div className="col-span-6 md:col-span-2">
                <label className="block text-xs font-bold text-slate-700 mb-1.5">HSN/SAC Code</label>
                <input type="text" placeholder="21069030" value={hsnCode} onChange={(e) => setHsnCode(e.target.value)} className="w-full glass-input p-3 rounded-2xl font-mono uppercase text-xs font-bold" />
              </div>

              <div className="col-span-6 md:col-span-2">
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Quantity & Unit</label>
                <div className="flex gap-1.5">
                  <input type="number" placeholder="5" value={billedQty} onChange={(e) => setBilledQty(e.target.value)} className="w-full glass-input p-3 rounded-2xl font-extrabold text-xs" />
                  <select value={unit} onChange={(e) => setUnit(e.target.value)} className="glass-input p-3 rounded-2xl bg-white text-xs font-extrabold">
                    <option value="BAG">BAG</option>
                    <option value="BOX">BOX</option>
                    <option value="KG">KG</option>
                    <option value="PKT">PKT</option>
                  </select>
                </div>
              </div>

              <div className="col-span-6 md:col-span-2">
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Rate / Unit (₹)</label>
                <input type="number" step="0.01" placeholder="4800.00" value={unitPrice} onChange={(e) => setUnitPrice(e.target.value)} className="w-full glass-input p-3 rounded-2xl font-extrabold text-xs text-slate-900" />
              </div>

              <div className="col-span-6 md:col-span-1">
                <button type="button" onClick={handleAddItem} className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold rounded-2xl shadow-md shadow-indigo-600/20 text-xs transition-all">
                  + Add
                </button>
              </div>
            </div>

            {/* Added Invoice Items List Table */}
            {items.length > 0 && (
              <div className="space-y-2 pt-2">
                <span className="font-extrabold text-slate-800 block text-xs">Invoice Items Cart ({items.length})</span>
                <div className="rounded-2xl bg-white border border-slate-200 overflow-hidden shadow-sm text-xs">
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-slate-100/90 text-slate-500 uppercase text-[10px] font-extrabold">
                      <tr>
                        <th className="p-3.5">Item Description</th>
                        <th className="p-3.5">HSN/SAC</th>
                        <th className="p-3.5">Quantity</th>
                        <th className="p-3.5">Rate per Unit</th>
                        <th className="p-3.5">GST %</th>
                        <th className="p-3.5">Taxable Value</th>
                        <th className="p-3.5">Line Total</th>
                        <th className="p-3.5 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-800">
                      {items.map((it, idx) => (
                        <tr key={idx} className="hover:bg-slate-50">
                          <td className="p-3.5 font-bold text-slate-900">{it.product_name}</td>
                          <td className="p-3.5 font-mono text-indigo-700 font-bold">{it.hsn_code}</td>
                          <td className="p-3.5 font-extrabold text-slate-900">{it.billed_quantity} {it.unit}</td>
                          <td className="p-3.5 font-semibold">₹{it.unit_purchase_price.toFixed(2)}</td>
                          <td className="p-3.5 font-bold text-slate-600">{it.gst_rate}%</td>
                          <td className="p-3.5 font-semibold text-slate-800">₹{it.taxable_amount.toFixed(2)}</td>
                          <td className="p-3.5 font-extrabold text-indigo-900 text-sm">₹{it.line_total.toFixed(2)}</td>
                          <td className="p-3.5 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button type="button" onClick={() => handleEditItem(idx)} title="Edit Item" className="text-indigo-600 hover:text-indigo-800 p-1.5 rounded-lg hover:bg-indigo-50 transition-colors">
                                <Pencil className="h-4 w-4" />
                              </button>
                              <button type="button" onClick={() => handleRemoveItem(idx)} title="Delete Item" className="text-rose-500 hover:text-rose-700 p-1.5 rounded-lg hover:bg-rose-50 transition-colors">
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          {/* SECTION 3: Financial Breakdown, Payments & Pending Balance Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 pt-2">
            {/* Card A: Itemized Billed Expenses & Invoice Total */}
            <div className="p-5 rounded-3xl bg-indigo-50/70 border border-indigo-200 space-y-2.5 text-xs shadow-sm">
              <span className="font-extrabold text-indigo-950 text-xs uppercase tracking-wider block flex items-center gap-1.5">
                <Receipt className="h-4 w-4 text-indigo-700" />
                Billed Invoice & Expenses
              </span>

              <div className="flex justify-between text-slate-700 py-0.5">
                <span>Subtotal (Taxable):</span>
                <span className="font-extrabold text-slate-900">₹{calculatedSubtotal.toFixed(2)}</span>
              </div>

              <div className="flex justify-between text-slate-700 py-0.5">
                <span>GST Tax Amount (5%):</span>
                <span className="font-extrabold text-slate-900">₹{calculatedTaxAmount.toFixed(2)}</span>
              </div>

              <div className="space-y-1.5 pt-1 border-t border-indigo-100">
                <div className="flex justify-between items-center text-slate-700">
                  <span>LR Charges (-) (Deducted):</span>
                  <input type="number" step="0.01" value={lrCharges} onChange={(e) => setLrCharges(e.target.value)} className="w-24 glass-input p-1 rounded-lg text-right font-bold text-xs text-emerald-700" />
                </div>
                <div className="flex justify-between items-center text-slate-700">
                  <span>Local Freight (-) (Deducted):</span>
                  <input type="number" step="0.01" value={localFreight} onChange={(e) => setLocalFreight(e.target.value)} className="w-24 glass-input p-1 rounded-lg text-right font-bold text-xs text-emerald-700" />
                </div>
                <div className="flex justify-between items-center text-slate-700">
                  <span>Salesman Exp (-) (Deducted):</span>
                  <input type="number" step="0.01" value={salesmanExpense} onChange={(e) => setSalesmanExpense(e.target.value)} className="w-24 glass-input p-1 rounded-lg text-right font-bold text-xs text-emerald-700" />
                </div>
                <div className="flex justify-between items-center text-slate-700">
                  <span>Scheme Credit (-) (Deducted):</span>
                  <input type="number" step="0.01" value={schemeMoney} onChange={(e) => setSchemeMoney(e.target.value)} className="w-24 glass-input p-1 rounded-lg text-right font-bold text-xs text-emerald-700" />
                </div>
              </div>

              <div className="flex justify-between text-indigo-950 font-extrabold text-sm border-t-2 border-indigo-200 pt-2">
                <span>Official Billed Total:</span>
                <span>₹{officialBilledTotal.toFixed(2)}</span>
              </div>
            </div>

            {/* Card B: Unbilled Cash / Non-GST Amount */}
            <div className="p-5 rounded-3xl bg-amber-50/70 border border-amber-200 space-y-2.5 text-xs shadow-sm flex flex-col justify-between">
              <div>
                <span className="font-extrabold text-amber-950 text-xs uppercase tracking-wider block flex items-center gap-1.5 mb-2">
                  <DollarSign className="h-4 w-4 text-amber-700" />
                  Unbilled Non-GST Payment
                </span>

                <p className="text-[11px] text-amber-800 font-medium mb-3">Off-the-record unbilled payment amount to be paid (not written on official GST tax bill).</p>

                <div>
                  <label className="block font-bold text-amber-950 mb-1">Unbilled Non-GST Amount (₹)</label>
                  <input type="number" step="0.01" value={unbilledNonGst} onChange={(e) => setUnbilledNonGst(e.target.value)} className="w-full glass-input p-2.5 rounded-xl text-amber-950 font-extrabold text-sm border-amber-300" />
                </div>
              </div>

              <div className="flex justify-between text-slate-900 font-extrabold text-sm border-t-2 border-amber-200 pt-2">
                <span>Total Purchase Payable:</span>
                <span className="text-amber-900">₹{totalPayableAmount.toFixed(2)}</span>
              </div>
            </div>

            {/* Card C: Partial Payment & Pending Balance Owed */}
            <div className="p-5 rounded-3xl bg-emerald-50/70 border border-emerald-200 space-y-2.5 text-xs shadow-sm flex flex-col justify-between">
              <div>
                <span className="font-extrabold text-emerald-950 text-xs uppercase tracking-wider block flex items-center gap-1.5 mb-2">
                  <CreditCard className="h-4 w-4 text-emerald-700" />
                  Supplier Payment & Balance
                </span>

                <div>
                  <label className="block font-bold text-slate-800 mb-1">Amount Paid / Money Given (₹)</label>
                  <input type="number" step="0.01" value={amountPaid} onChange={(e) => setAmountPaid(e.target.value)} placeholder="0.00" className="w-full glass-input p-2.5 rounded-xl text-emerald-800 font-extrabold text-sm border-emerald-300" />
                </div>
              </div>

              <div className="space-y-1 border-t-2 border-emerald-200 pt-2">
                <span className="text-[10px] font-bold text-slate-500 uppercase block">Pending Balance Owed</span>
                <div className="flex items-center justify-between">
                  <span className={`text-base font-extrabold ${pendingBalanceOwed > 0 ? 'text-rose-700' : 'text-emerald-700'}`}>
                    ₹{pendingBalanceOwed.toFixed(2)}
                  </span>
                  <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-lg border ${
                    pendingBalanceOwed <= 0 ? 'bg-emerald-100 text-emerald-800 border-emerald-200' : 'bg-rose-100 text-rose-800 border-rose-200'
                  }`}>
                    {pendingBalanceOwed <= 0 ? 'Fully Settled' : 'Pending Owed'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={createPurchaseMutation.isPending}
            className="w-full py-4 bg-gradient-to-r from-indigo-600 via-teal-600 to-emerald-600 hover:from-indigo-500 hover:to-emerald-500 text-white font-extrabold rounded-2xl shadow-xl shadow-indigo-500/25 transition-all text-sm uppercase tracking-wider mt-4"
          >
            {createPurchaseMutation.isPending ? 'Processing Purchase & Updating Stock...' : 'Save Purchase Entry & Directly Create/Update Product Stock'}
          </button>
        </form>
      </Modal>
    </div>
  );
}
