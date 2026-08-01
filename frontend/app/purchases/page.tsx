'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ShoppingBag, Plus, Search, Calendar, Truck, FileText } from 'lucide-react';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import Modal from '@/components/Modal';
import { api } from '@/lib/api';

export default function PurchasesPage() {
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formError, setFormError] = useState('');

  // Form State
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [freightCharges, setFreightCharges] = useState('0.00');
  const [notes, setNotes] = useState('');

  // Items State
  const [selectedProduct, setSelectedProduct] = useState('');
  const [billedQty, setBilledQty] = useState('100');
  const [freeQty, setFreeQty] = useState('0');
  const [unitPrice, setUnitPrice] = useState('100.00');
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

  const createMutation = useMutation({
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

  const resetForm = () => {
    setInvoiceNumber('');
    setSupplierId('');
    setFreightCharges('0.00');
    setNotes('');
    setItems([]);
    setFormError('');
  };

  const handleAddItem = () => {
    if (!selectedProduct) return;
    const prod = products.find((p: any) => p.id === selectedProduct);
    if (!prod) return;

    setItems([
      ...items,
      {
        product_id: selectedProduct,
        product_name: prod.name,
        billed_quantity: parseFloat(billedQty) || 0,
        free_quantity: parseFloat(freeQty) || 0,
        unit_purchase_price: parseFloat(unitPrice) || 0,
        discount_amount: 0,
        gst_rate: parseFloat(prod.gst_rate || 0),
      },
    ]);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!supplierId || items.length === 0) {
      setFormError('Please select a supplier and add at least one line item.');
      return;
    }

    createMutation.mutate({
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

  return (
    <div className="flex min-h-screen bg-[#090d16]">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Header 
          title="Purchase Bills & Inbound Stock" 
          subtitle="Vendor bill entry, freight expense tracking & stock landed cost recalculation" 
          onActionClick={() => setIsModalOpen(true)}
          actionLabel="New Purchase Entry"
        />

        <main className="p-8 space-y-6 flex-1 overflow-y-auto">
          {/* Purchase List Table */}
          <div className="glass-panel rounded-2xl overflow-hidden border border-slate-800">
            <div className="p-4 border-b border-slate-800/80 font-bold text-white text-sm">Recent Purchase Bills</div>
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-900/80 text-slate-400 border-b border-slate-800 uppercase text-[10px]">
                <tr>
                  <th className="p-4">Invoice #</th>
                  <th className="p-4">Date</th>
                  <th className="p-4">Supplier</th>
                  <th className="p-4">Subtotal</th>
                  <th className="p-4">Freight Charges</th>
                  <th className="p-4">Grand Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-200">
                {isLoading ? (
                  <tr><td colSpan={6} className="p-8 text-center text-slate-400">Loading purchase bills...</td></tr>
                ) : purchases.length === 0 ? (
                  <tr><td colSpan={6} className="p-8 text-center text-slate-400">No purchase invoices recorded yet.</td></tr>
                ) : (
                  purchases.map((p: any) => (
                    <tr key={p.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="p-4 font-mono font-bold text-indigo-400">{p.invoice_number}</td>
                      <td className="p-4">{p.invoice_date}</td>
                      <td className="p-4 font-semibold text-white">{p.supplier_id}</td>
                      <td className="p-4">₹{parseFloat(p.subtotal || 0).toFixed(2)}</td>
                      <td className="p-4 text-amber-400 font-semibold">₹{parseFloat(p.additional_expenses || 0).toFixed(2)}</td>
                      <td className="p-4 font-bold text-emerald-400">₹{parseFloat(p.grand_total || 0).toFixed(2)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </main>
      </div>

      {/* New Purchase Modal */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Record Vendor Purchase Bill">
        {formError && <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-semibold">{formError}</div>}
        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-slate-300 mb-1">Invoice / Bill Number *</label>
              <input required type="text" value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} placeholder="PUR-2026-001" className="w-full glass-input p-2.5 rounded-xl font-mono" />
            </div>

            <div>
              <label className="block font-semibold text-slate-300 mb-1">Select Supplier *</label>
              <select required value={supplierId} onChange={(e) => setSupplierId(e.target.value)} className="w-full glass-input p-2.5 rounded-xl bg-slate-900">
                <option value="">-- Choose Vendor --</option>
                {suppliers.map((s: any) => (
                  <option key={s.id} value={s.id}>{s.name} ({s.city || 'Vendor'})</option>
                ))}
              </select>
            </div>
          </div>

          {/* Item Add Bar */}
          <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 space-y-3">
            <span className="font-bold text-indigo-400 text-xs uppercase tracking-wider block">Add Product Line Item</span>
            <div className="grid grid-cols-4 gap-2">
              <div className="col-span-2">
                <select value={selectedProduct} onChange={(e) => setSelectedProduct(e.target.value)} className="w-full glass-input p-2 rounded-xl bg-slate-900">
                  <option value="">-- Select SKU --</option>
                  {products.map((p: any) => (
                    <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>
                  ))}
                </select>
              </div>

              <div>
                <input type="number" placeholder="Billed Qty" value={billedQty} onChange={(e) => setBilledQty(e.target.value)} className="w-full glass-input p-2 rounded-xl" />
              </div>

              <div>
                <input type="number" step="0.01" placeholder="Unit Price (₹)" value={unitPrice} onChange={(e) => setUnitPrice(e.target.value)} className="w-full glass-input p-2 rounded-xl" />
              </div>
            </div>

            <button type="button" onClick={handleAddItem} className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl border border-slate-700">
              + Add Item to Bill
            </button>
          </div>

          {/* Added Line Items List */}
          {items.length > 0 && (
            <div className="space-y-2">
              <span className="font-semibold text-slate-300 block">Bill Items ({items.length})</span>
              {items.map((it, idx) => (
                <div key={idx} className="flex items-center justify-between p-2.5 rounded-xl bg-slate-900/60 border border-slate-800">
                  <div>
                    <div className="font-bold text-white">{it.product_name}</div>
                    <div className="text-[10px] text-slate-400">Qty: {it.billed_quantity} | Price: ₹{it.unit_purchase_price}</div>
                  </div>
                  <div className="font-bold text-emerald-400">₹{(it.billed_quantity * it.unit_purchase_price).toFixed(2)}</div>
                </div>
              ))}
            </div>
          )}

          {/* Freight Charges (User specific feature requirement) */}
          <div className="p-3.5 rounded-xl bg-amber-500/5 border border-amber-500/20 space-y-1.5">
            <label className="block font-bold text-amber-400">Freight & Delivery Charges (₹)</label>
            <p className="text-[10px] text-slate-400">Freight charges will be added to total invoice amount without inflating unit purchase cost.</p>
            <input type="number" step="0.01" value={freightCharges} onChange={(e) => setFreightCharges(e.target.value)} className="w-full glass-input p-2.5 rounded-xl text-amber-400 font-bold" />
          </div>

          <button
            type="submit"
            disabled={createMutation.isPending}
            className="w-full py-3 bg-gradient-to-r from-indigo-600 to-emerald-500 hover:from-indigo-500 hover:to-emerald-400 text-white font-bold rounded-xl shadow-lg shadow-indigo-500/20 transition-all"
          >
            {createMutation.isPending ? 'Processing...' : 'Save Purchase Bill & Post Ledger'}
          </button>
        </form>
      </Modal>
    </div>
  );
}
