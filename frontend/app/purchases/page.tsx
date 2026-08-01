'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, PackageCheck, Receipt, DollarSign } from 'lucide-react';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import Modal from '@/components/Modal';
import { api } from '@/lib/api';

export default function PurchasesPage() {
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formError, setFormError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Main Form State
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split('T')[0]);
  const [freightCharges, setFreightCharges] = useState('0.00'); // Billed freight
  const [unbilledNonGst, setUnbilledNonGst] = useState('0.00'); // Unbilled Non-GST cash amount to pay
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
      setSuccessMessage(`Purchase invoice #${invoiceNumber || res.invoice_number} recorded successfully! Stock quantities created & updated.`);
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
    setFreightCharges('0.00');
    setUnbilledNonGst('0.00');
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
      setFormError('Please enter a product description / name.');
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

    // Reset item add row
    setSelectedProduct('');
    setProductName('');
    setHsnCode('');
    setBilledQty('5');
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
      setFormError('Please add at least one line item to the bill.');
      return;
    }

    createPurchaseMutation.mutate({
      invoice_number: invoiceNumber || `PUR-${Date.now()}`,
      supplier_id: supplierId,
      invoice_date: invoiceDate,
      additional_expenses: parseFloat(freightCharges) || 0,
      unbilled_nongst_amount: parseFloat(unbilledNonGst) || 0,
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

  // Calculations
  const calculatedSubtotal = items.reduce((sum, i) => sum + i.taxable_amount, 0);
  const calculatedTaxAmount = items.reduce((sum, i) => sum + i.gst_amount, 0);
  const billedFreight = parseFloat(freightCharges) || 0;
  const officialBilledTotal = calculatedSubtotal + calculatedTaxAmount + billedFreight;
  const unbilledPayable = parseFloat(unbilledNonGst) || 0;
  const totalPayableAmount = officialBilledTotal + unbilledPayable;

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Header 
          title="Purchase Bills & Inbound Stock" 
          subtitle="Vendor bill entry, unbilled Non-GST tracking & direct product stock creation" 
          onActionClick={() => setIsModalOpen(true)}
          actionLabel="New Purchase Entry"
        />

        <main className="p-8 space-y-6 flex-1 overflow-y-auto">
          {successMessage && (
            <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold shadow-sm flex items-center gap-2">
              <PackageCheck className="h-5 w-5 text-emerald-600" />
              {successMessage}
            </div>
          )}

          {/* Purchase List Table */}
          <div className="glass-panel rounded-2xl overflow-hidden border border-slate-200">
            <div className="p-4 border-b border-slate-100 font-bold text-slate-900 text-sm flex items-center justify-between">
              <span>Recent Purchase Bills</span>
              <span className="text-xs text-slate-500 font-medium">Total Invoices: {purchases.length}</span>
            </div>
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100/80 text-slate-500 border-b border-slate-200 uppercase text-[10px] font-bold">
                <tr>
                  <th className="p-4">Invoice #</th>
                  <th className="p-4">Date</th>
                  <th className="p-4">Supplier</th>
                  <th className="p-4">Subtotal</th>
                  <th className="p-4">GST Tax</th>
                  <th className="p-4">Billed Total</th>
                  <th className="p-4 text-amber-700">Unbilled (Non-GST)</th>
                  <th className="p-4 text-emerald-700">Total Payable</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {isLoading ? (
                  <tr><td colSpan={8} className="p-8 text-center text-slate-500">Loading purchase bills...</td></tr>
                ) : purchases.length === 0 ? (
                  <tr><td colSpan={8} className="p-8 text-center text-slate-500">No purchase invoices recorded yet.</td></tr>
                ) : (
                  purchases.map((p: any) => {
                    const bTotal = parseFloat(p.grand_total || 0);
                    const unbilled = parseFloat(p.unbilled_nongst_amount || 0);
                    const payable = parseFloat(p.total_payable_amount || bTotal + unbilled);

                    return (
                      <tr key={p.id} className="hover:bg-slate-100/50 transition-colors">
                        <td className="p-4 font-mono font-bold text-indigo-700">{p.invoice_number}</td>
                        <td className="p-4">{p.invoice_date}</td>
                        <td className="p-4 font-semibold text-slate-900">{p.supplier_id}</td>
                        <td className="p-4">₹{parseFloat(p.subtotal || 0).toFixed(2)}</td>
                        <td className="p-4 text-slate-600">₹{parseFloat(p.tax_amount || 0).toFixed(2)}</td>
                        <td className="p-4 font-extrabold text-slate-900">₹{bTotal.toFixed(2)}</td>
                        <td className="p-4 text-amber-700 font-bold">₹{unbilled.toFixed(2)}</td>
                        <td className="p-4 font-extrabold text-emerald-700">₹{payable.toFixed(2)}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </main>
      </div>

      {/* New Purchase Modal */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Record Vendor Purchase Entry (Direct Stock Creation)">
        {formError && <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold mb-3">{formError}</div>}
        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {/* Header Row */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Invoice Number *</label>
              <input required type="text" value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} placeholder="e.g. 43" className="w-full glass-input p-2.5 rounded-xl font-mono" />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Select Supplier *</label>
              <select required value={supplierId} onChange={(e) => setSupplierId(e.target.value)} className="w-full glass-input p-2.5 rounded-xl bg-white font-medium">
                <option value="">-- Choose Vendor --</option>
                {suppliers.map((s: any) => (
                  <option key={s.id} value={s.id}>{s.name} ({s.city || 'Vendor'})</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Invoice Date *</label>
              <input required type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} className="w-full glass-input p-2.5 rounded-xl" />
            </div>
          </div>

          {/* Item Add Section */}
          <div className="p-4 rounded-2xl bg-slate-100/70 border border-slate-200 space-y-3">
            <span className="font-bold text-indigo-900 text-xs uppercase tracking-wider block">Add Goods Item (Auto-Creates Product & Updates Stock)</span>
            
            <div className="grid grid-cols-12 gap-2">
              <div className="col-span-5">
                <label className="block text-[10px] font-bold text-slate-600 mb-1">Select Existing or Type Name</label>
                <select value={selectedProduct} onChange={(e) => handleProductSelect(e.target.value)} className="w-full glass-input p-2 rounded-xl bg-white text-xs mb-1.5">
                  <option value="">-- Or Pick Existing Product --</option>
                  {products.map((p: any) => (
                    <option key={p.id} value={p.id}>{p.name} (HSN: {p.hsn_code || p.sku})</option>
                  ))}
                </select>
                <input type="text" placeholder="Description of Goods (e.g. MOUTH FRESHNER @ 1/-)" value={productName} onChange={(e) => setProductName(e.target.value)} className="w-full glass-input p-2 rounded-xl text-xs font-semibold" />
              </div>

              <div className="col-span-2">
                <label className="block text-[10px] font-bold text-slate-600 mb-1">HSN/SAC Code</label>
                <input type="text" placeholder="21069030" value={hsnCode} onChange={(e) => setHsnCode(e.target.value)} className="w-full glass-input p-2 rounded-xl font-mono uppercase text-xs" />
              </div>

              <div className="col-span-2">
                <label className="block text-[10px] font-bold text-slate-600 mb-1">Quantity</label>
                <div className="flex gap-1">
                  <input type="number" placeholder="5" value={billedQty} onChange={(e) => setBilledQty(e.target.value)} className="w-full glass-input p-2 rounded-xl font-bold text-xs" />
                  <select value={unit} onChange={(e) => setUnit(e.target.value)} className="glass-input p-1 rounded-xl bg-white text-[10px] font-bold">
                    <option value="BAG">BAG</option>
                    <option value="BOX">BOX</option>
                    <option value="KG">KG</option>
                    <option value="PKT">PKT</option>
                  </select>
                </div>
              </div>

              <div className="col-span-2">
                <label className="block text-[10px] font-bold text-slate-600 mb-1">Rate / Unit (₹)</label>
                <input type="number" step="0.01" placeholder="4800.00" value={unitPrice} onChange={(e) => setUnitPrice(e.target.value)} className="w-full glass-input p-2 rounded-xl font-bold text-xs" />
              </div>

              <div className="col-span-1 flex items-end">
                <button type="button" onClick={handleAddItem} className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl shadow-sm text-xs">
                  + Add
                </button>
              </div>
            </div>
          </div>

          {/* Items List Table */}
          {items.length > 0 && (
            <div className="space-y-2">
              <span className="font-bold text-slate-700 block">Invoice Items ({items.length})</span>
              <div className="divide-y divide-slate-100 rounded-xl bg-white border border-slate-200 overflow-hidden text-xs">
                {items.map((it, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 hover:bg-slate-50">
                    <div>
                      <div className="font-bold text-slate-900">{it.product_name}</div>
                      <div className="text-[10px] text-slate-500 font-medium">
                        HSN: <span className="font-mono">{it.hsn_code}</span> | Qty: <span className="font-bold text-slate-800">{it.billed_quantity} {it.unit}</span> | Rate: ₹{it.unit_purchase_price}/{it.unit} | GST: {it.gst_rate}%
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <div className="font-extrabold text-slate-900">₹{it.line_total.toFixed(2)}</div>
                        <div className="text-[10px] text-slate-400">Taxable ₹{it.taxable_amount.toFixed(2)} + GST ₹{it.gst_amount.toFixed(2)}</div>
                      </div>
                      <button type="button" onClick={() => handleRemoveItem(idx)} className="text-rose-500 hover:text-rose-700 p-1">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Calculation & Payment Summary Cards */}
          <div className="grid grid-cols-2 gap-3 pt-2">
            {/* Official Billed Tax Invoice Card */}
            <div className="p-4 rounded-2xl bg-indigo-50/60 border border-indigo-200 space-y-2 text-xs">
              <span className="font-extrabold text-indigo-900 uppercase tracking-wider block flex items-center gap-1.5">
                <Receipt className="h-4 w-4 text-indigo-700" />
                Official Billed Tax Invoice
              </span>

              <div className="flex justify-between text-slate-600">
                <span>Subtotal (Taxable Value):</span>
                <span className="font-bold">₹{calculatedSubtotal.toFixed(2)}</span>
              </div>

              <div className="flex justify-between text-slate-600">
                <span>GST Tax Amount (5%):</span>
                <span className="font-bold">₹{calculatedTaxAmount.toFixed(2)}</span>
              </div>

              <div className="flex justify-between items-center text-slate-600 pt-1">
                <span>Billed Freight / Logistics (₹):</span>
                <input type="number" step="0.01" value={freightCharges} onChange={(e) => setFreightCharges(e.target.value)} className="w-24 glass-input p-1 rounded-lg text-right font-bold text-xs" />
              </div>

              <div className="flex justify-between text-indigo-950 font-extrabold text-sm border-t border-indigo-200 pt-2">
                <span>Billed Invoice Total:</span>
                <span>₹{officialBilledTotal.toFixed(2)}</span>
              </div>
            </div>

            {/* Unbilled Non-GST & Total Payable Card */}
            <div className="p-4 rounded-2xl bg-amber-50/60 border border-amber-200 space-y-2 text-xs">
              <span className="font-extrabold text-amber-900 uppercase tracking-wider block flex items-center gap-1.5">
                <DollarSign className="h-4 w-4 text-amber-700" />
                Unbilled Cash / Non-GST Payment
              </span>

              <p className="text-[10px] text-amber-800">Unbilled payment amount to be paid (not written on official GST bill).</p>

              <div>
                <label className="block font-bold text-amber-900 mb-1">Unbilled Non-GST Amount to Pay (₹)</label>
                <input type="number" step="0.01" value={unbilledNonGst} onChange={(e) => setUnbilledNonGst(e.target.value)} className="w-full glass-input p-2 rounded-xl text-amber-900 font-extrabold text-sm" />
              </div>

              <div className="flex justify-between text-emerald-900 font-extrabold text-sm border-t border-amber-200 pt-2">
                <span>Total Payable Amount:</span>
                <span className="text-emerald-700">₹{totalPayableAmount.toFixed(2)}</span>
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={createPurchaseMutation.isPending}
            className="w-full py-3.5 bg-gradient-to-r from-indigo-600 to-emerald-600 hover:from-indigo-500 hover:to-emerald-500 text-white font-extrabold rounded-xl shadow-lg shadow-indigo-500/20 transition-all text-sm mt-2"
          >
            {createPurchaseMutation.isPending ? 'Processing Purchase & Updating Stock...' : 'Save Purchase Entry & Directly Create/Update Product Stock'}
          </button>
        </form>
      </Modal>
    </div>
  );
}
