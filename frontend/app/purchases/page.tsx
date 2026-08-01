'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, PackagePlus } from 'lucide-react';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import Modal from '@/components/Modal';
import { api } from '@/lib/api';

export default function PurchasesPage() {
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isQuickProductModalOpen, setIsQuickProductModalOpen] = useState(false);
  const [formError, setFormError] = useState('');

  // Main Form State
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [freightCharges, setFreightCharges] = useState('0.00');
  const [notes, setNotes] = useState('');

  // Item Add State
  const [selectedProduct, setSelectedProduct] = useState('');
  const [totalQty, setTotalQty] = useState('5');
  const [ratePerUnit, setRatePerUnit] = useState('500.00');
  const [items, setItems] = useState<any[]>([]);

  // Quick Product State
  const [quickName, setQuickName] = useState('');
  const [quickHsnCode, setQuickHsnCode] = useState('');
  const [quickUnit, setQuickUnit] = useState('BAG');
  const [quickPurchasePrice, setQuickPurchasePrice] = useState('500.00');
  const [quickSellingPrice, setQuickSellingPrice] = useState('650.00');
  const [quickGstRate, setQuickGstRate] = useState('12.00');
  const [quickError, setQuickError] = useState('');

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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchases'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      setIsModalOpen(false);
      resetForm();
    },
    onError: (err: any) => {
      setFormError(err.message || 'Failed to record purchase bill.');
    },
  });

  const createProductMutation = useMutation({
    mutationFn: (data: any) => api.createProduct(data),
    onSuccess: (newProd: any) => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      setIsQuickProductModalOpen(false);
      setSelectedProduct(newProd.id);
      setRatePerUnit(parseFloat(newProd.default_purchase_price || 500).toString());
      setQuickName('');
      setQuickHsnCode('');
      setQuickError('');
    },
    onError: (err: any) => {
      setQuickError(err.message || 'Failed to create new product.');
    },
  });

  const resetForm = () => {
    setInvoiceNumber('');
    setSupplierId('');
    setFreightCharges('0.00');
    setNotes('');
    setItems([]);
    setSelectedProduct('');
    setTotalQty('5');
    setRatePerUnit('500.00');
    setFormError('');
  };

  const handleProductSelectChange = (prodId: string) => {
    setSelectedProduct(prodId);
    if (!prodId) return;
    const prod = products.find((p: any) => p.id === prodId);
    if (prod) {
      setRatePerUnit(parseFloat(prod.default_purchase_price || 0).toString());
    }
  };

  const handleAddItem = () => {
    if (!selectedProduct) return;
    const prod = products.find((p: any) => p.id === selectedProduct);
    if (!prod) return;

    const qtyVal = parseFloat(totalQty) || 0;
    const rateVal = parseFloat(ratePerUnit) || 0;

    if (qtyVal <= 0) {
      setFormError('Quantity must be greater than 0');
      return;
    }

    setFormError('');

    setItems([
      ...items,
      {
        product_id: selectedProduct,
        product_name: prod.name,
        hsn_code: prod.hsn_code || prod.sku,
        unit: prod.unit || 'BAG',
        billed_quantity: qtyVal,
        free_quantity: 0,
        unit_purchase_price: rateVal,
        discount_amount: 0,
        gst_rate: parseFloat(prod.gst_rate || 0),
        total_amount: qtyVal * rateVal,
      },
    ]);

    setSelectedProduct('');
  };

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const handleCreateQuickProduct = (e: React.FormEvent) => {
    e.preventDefault();
    createProductMutation.mutate({
      name: quickName,
      hsn_code: quickHsnCode,
      sku: quickHsnCode,
      unit: quickUnit,
      default_purchase_price: parseFloat(quickPurchasePrice) || 0,
      default_selling_price: parseFloat(quickSellingPrice) || 0,
      gst_rate: parseFloat(quickGstRate) || 0,
      min_stock_alert: 0,
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!supplierId || items.length === 0) {
      setFormError('Please select a supplier and add at least one item.');
      return;
    }

    createPurchaseMutation.mutate({
      invoice_number: invoiceNumber || `PUR-${Date.now()}`,
      supplier_id: supplierId,
      invoice_date: new Date().toISOString().split('T')[0],
      additional_expenses: parseFloat(freightCharges) || 0,
      notes,
      items: items.map((i) => ({
        product_id: i.product_id,
        billed_quantity: i.billed_quantity,
        free_quantity: i.free_quantity,
        unit_purchase_price: i.unit_purchase_price,
        discount_amount: i.discount_amount,
        gst_rate: i.gst_rate,
      })),
    });
  };

  const calculatedLineTotal = (parseFloat(totalQty) || 0) * (parseFloat(ratePerUnit) || 0);

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Header 
          title="Purchase Bills & Inbound Stock" 
          subtitle="Vendor bill entry with HSN/SAC codes, unit rates & automatic stock creation" 
          onActionClick={() => setIsModalOpen(true)}
          actionLabel="New Purchase Entry"
        />

        <main className="p-8 space-y-6 flex-1 overflow-y-auto">
          {/* Purchase List Table */}
          <div className="glass-panel rounded-2xl overflow-hidden border border-slate-200">
            <div className="p-4 border-b border-slate-100 font-bold text-slate-900 text-sm">Recent Purchase Bills</div>
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100/80 text-slate-500 border-b border-slate-200 uppercase text-[10px] font-bold">
                <tr>
                  <th className="p-4">Invoice #</th>
                  <th className="p-4">Date</th>
                  <th className="p-4">Supplier ID</th>
                  <th className="p-4">Subtotal</th>
                  <th className="p-4">Freight Charges</th>
                  <th className="p-4">Grand Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {isLoading ? (
                  <tr><td colSpan={6} className="p-8 text-center text-slate-500">Loading purchase bills...</td></tr>
                ) : purchases.length === 0 ? (
                  <tr><td colSpan={6} className="p-8 text-center text-slate-500">No purchase invoices recorded yet.</td></tr>
                ) : (
                  purchases.map((p: any) => (
                    <tr key={p.id} className="hover:bg-slate-100/50 transition-colors">
                      <td className="p-4 font-mono font-bold text-indigo-700">{p.invoice_number}</td>
                      <td className="p-4">{p.invoice_date}</td>
                      <td className="p-4 font-semibold text-slate-900">{p.supplier_id}</td>
                      <td className="p-4">₹{parseFloat(p.subtotal || 0).toFixed(2)}</td>
                      <td className="p-4 text-amber-700 font-bold">₹{parseFloat(p.additional_expenses || 0).toFixed(2)}</td>
                      <td className="p-4 font-bold text-emerald-700">₹{parseFloat(p.grand_total || 0).toFixed(2)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </main>
      </div>

      {/* New Purchase Modal */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Record Purchase Entry (Direct Stock Creation)">
        {formError && <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold">{formError}</div>}
        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Invoice / Bill Number *</label>
              <input required type="text" value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} placeholder="PUR-2026-001" className="w-full glass-input p-2.5 rounded-xl font-mono" />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Select Supplier *</label>
              <select required value={supplierId} onChange={(e) => setSupplierId(e.target.value)} className="w-full glass-input p-2.5 rounded-xl bg-white">
                <option value="">-- Choose Vendor --</option>
                {suppliers.map((s: any) => (
                  <option key={s.id} value={s.id}>{s.name} ({s.city || 'Vendor'})</option>
                ))}
              </select>
            </div>
          </div>

          {/* Add Item Box */}
          <div className="p-4 rounded-2xl bg-indigo-50/50 border border-indigo-100 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-bold text-indigo-900 text-xs uppercase tracking-wider">Add HSN/SAC Product Item</span>
              <button 
                type="button" 
                onClick={() => setIsQuickProductModalOpen(true)} 
                className="text-xs font-bold text-indigo-700 hover:text-indigo-900 flex items-center gap-1 bg-white px-2.5 py-1 rounded-lg border border-indigo-200 shadow-sm"
              >
                <PackagePlus className="h-3.5 w-3.5" />
                + New Product
              </button>
            </div>

            <div className="grid grid-cols-12 gap-2 items-end">
              <div className="col-span-5">
                <label className="block text-[10px] font-bold text-slate-600 mb-1">Product (HSN/SAC)</label>
                <select value={selectedProduct} onChange={(e) => handleProductSelectChange(e.target.value)} className="w-full glass-input p-2 rounded-xl bg-white font-medium">
                  <option value="">-- Select Product --</option>
                  {products.map((p: any) => (
                    <option key={p.id} value={p.id}>
                      {p.name} (HSN: {p.hsn_code || p.sku})
                    </option>
                  ))}
                </select>
              </div>

              <div className="col-span-2">
                <label className="block text-[10px] font-bold text-slate-600 mb-1">Total Qty</label>
                <input type="number" placeholder="5" value={totalQty} onChange={(e) => setTotalQty(e.target.value)} className="w-full glass-input p-2 rounded-xl font-bold" />
              </div>

              <div className="col-span-3">
                <label className="block text-[10px] font-bold text-slate-600 mb-1">Rate per Unit (₹)</label>
                <input type="number" step="0.01" placeholder="500.00" value={ratePerUnit} onChange={(e) => setRatePerUnit(e.target.value)} className="w-full glass-input p-2 rounded-xl font-bold text-slate-800" />
              </div>

              <div className="col-span-2">
                <button type="button" onClick={handleAddItem} className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl shadow-md shadow-indigo-500/20">
                  + Add
                </button>
              </div>
            </div>

            {/* Calculated Preview */}
            {selectedProduct && (
              <div className="p-2.5 rounded-xl bg-white border border-indigo-200 flex items-center justify-between text-xs">
                <span className="text-slate-600 font-medium">Calculated Item Total:</span>
                <span className="font-extrabold text-indigo-700">
                  {totalQty} Unit × ₹{parseFloat(ratePerUnit || '0').toFixed(2)} = ₹{calculatedLineTotal.toFixed(2)}
                </span>
              </div>
            )}
          </div>

          {/* Added Items Table */}
          {items.length > 0 && (
            <div className="space-y-2">
              <span className="font-bold text-slate-700 block">Purchase Items ({items.length})</span>
              <div className="divide-y divide-slate-100 rounded-xl bg-white border border-slate-200 overflow-hidden">
                {items.map((it, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 hover:bg-slate-50">
                    <div>
                      <div className="font-bold text-slate-900">{it.product_name}</div>
                      <div className="text-[10px] text-slate-500 font-medium">
                        HSN: <span className="font-mono">{it.hsn_code}</span> | Qty: <span className="font-bold text-slate-800">{it.billed_quantity} {it.unit}</span> | Rate: ₹{it.unit_purchase_price}/{it.unit}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-extrabold text-emerald-700 text-sm">₹{it.total_amount.toFixed(2)}</span>
                      <button type="button" onClick={() => handleRemoveItem(idx)} className="text-rose-500 hover:text-rose-700 p-1">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Freight Charges */}
          <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 space-y-1.5">
            <label className="block font-bold text-amber-900">Freight & Transport Expenses (₹)</label>
            <input type="number" step="0.01" value={freightCharges} onChange={(e) => setFreightCharges(e.target.value)} className="w-full glass-input p-2.5 rounded-xl text-amber-900 font-bold" />
          </div>

          <button
            type="submit"
            disabled={createPurchaseMutation.isPending}
            className="w-full py-3.5 bg-gradient-to-r from-indigo-600 to-emerald-600 hover:from-indigo-500 hover:to-emerald-500 text-white font-extrabold rounded-xl shadow-lg shadow-indigo-500/20 transition-all text-sm"
          >
            {createPurchaseMutation.isPending ? 'Updating Stock...' : 'Save Purchase Entry & Directly Create Product Stock'}
          </button>
        </form>
      </Modal>

      {/* Quick Add Product Modal */}
      <Modal isOpen={isQuickProductModalOpen} onClose={() => setIsQuickProductModalOpen(false)} title="Quick Create HSN/SAC Product">
        {quickError && <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold mb-3">{quickError}</div>}
        <form onSubmit={handleCreateQuickProduct} className="space-y-4 text-xs">
          <div>
            <label className="block font-bold text-slate-700 mb-1">Product Name *</label>
            <input required type="text" value={quickName} onChange={(e) => setQuickName(e.target.value)} placeholder="e.g. Supari Bag 50kg" className="w-full glass-input p-2.5 rounded-xl" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 mb-1">HSN / SAC Code *</label>
              <input required type="text" value={quickHsnCode} onChange={(e) => setQuickHsnCode(e.target.value)} placeholder="HSN-210690" className="w-full glass-input p-2.5 rounded-xl font-mono uppercase" />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Packaging Unit *</label>
              <select value={quickUnit} onChange={(e) => setQuickUnit(e.target.value)} className="w-full glass-input p-2.5 rounded-xl bg-white font-bold">
                <option value="BAG">BAG</option>
                <option value="BOX">BOX</option>
                <option value="KG">KG</option>
                <option value="PKT">PKT</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Default Purchase Rate (₹)</label>
              <input type="number" step="0.01" value={quickPurchasePrice} onChange={(e) => setQuickPurchasePrice(e.target.value)} className="w-full glass-input p-2.5 rounded-xl font-bold" />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Selling Rate (₹)</label>
              <input type="number" step="0.01" value={quickSellingPrice} onChange={(e) => setQuickSellingPrice(e.target.value)} className="w-full glass-input p-2.5 rounded-xl text-emerald-700 font-bold" />
            </div>
          </div>

          <button
            type="submit"
            disabled={createProductMutation.isPending}
            className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl shadow-md shadow-indigo-500/20"
          >
            {createProductMutation.isPending ? 'Creating...' : 'Create Product SKU & Add to Purchase'}
          </button>
        </form>
      </Modal>
    </div>
  );
}
