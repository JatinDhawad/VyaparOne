'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import Modal from '@/components/Modal';
import { api } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';

export default function SalesPage() {
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formError, setFormError] = useState('');

  // Form State
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [deliveryCharges, setDeliveryCharges] = useState('0.00');
  const [salesmanCommission, setSalesmanCommission] = useState('0.00');
  const [notes, setNotes] = useState('');

  // Item Add State
  const [selectedProduct, setSelectedProduct] = useState('');
  const [qty, setQty] = useState('10');
  const [unitPrice, setUnitPrice] = useState('150.00');
  const [items, setItems] = useState<any[]>([]);

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
    setInvoiceNumber('');
    setCustomerId('');
    setDeliveryCharges('0.00');
    setSalesmanCommission('0.00');
    setNotes('');
    setItems([]);
    setFormError('');
  };

  const handleAddItem = () => {
    if (!selectedProduct) return;
    const prod = products.find((p: any) => p.id === selectedProduct);
    if (!prod) return;

    const existingIdx = items.findIndex((i) => i.product_id === selectedProduct);
    if (existingIdx >= 0) {
      const updated = [...items];
      updated[existingIdx].quantity += parseFloat(qty) || 0;
      setItems(updated);
    } else {
      setItems([
        ...items,
        {
          product_id: prod.id,
          product_name: prod.name,
          quantity: parseFloat(qty) || 0,
          unit_selling_price: parseFloat(unitPrice) || 0,
        },
      ]);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerId) {
      setFormError('Please select a customer.');
      return;
    }
    if (items.length === 0) {
      setFormError('Please add at least one product item.');
      return;
    }

    createMutation.mutate({
      invoice_number: invoiceNumber || `INV-${Date.now()}`,
      customer_id: customerId,
      invoice_date: new Date().toISOString().split('T')[0],
      delivery_charges: parseFloat(deliveryCharges) || 0,
      salesman_commission: parseFloat(salesmanCommission) || 0,
      notes,
      items: items.map((i) => ({
        product_id: i.product_id,
        quantity: i.quantity,
        unit_selling_price: i.unit_selling_price,
      })),
    });
  };

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Header 
          title="Sales & POS Billing" 
          onActionClick={() => setIsModalOpen(true)}
          actionLabel="New Sales POS"
        />

        <main className="p-8 space-y-6 flex-1 overflow-y-auto">
          <div className="glass-panel rounded-2xl overflow-hidden border border-slate-200">
            <div className="p-4 border-b border-slate-100 font-bold text-slate-900 text-sm">Recent Sales Invoices</div>
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100/80 text-slate-500 border-b border-slate-200 uppercase text-[10px] font-bold">
                <tr>
                  <th className="p-4">Invoice #</th>
                  <th className="p-4">Date</th>
                  <th className="p-4">Customer</th>
                  <th className="p-4 text-right">COGS (₹)</th>
                  <th className="p-4 text-right">Net Profit (₹)</th>
                  <th className="p-4 text-right">Grand Total (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {isLoading ? (
                  <tr><td colSpan={6} className="p-8 text-center text-slate-500">Loading sales invoices...</td></tr>
                ) : sales.length === 0 ? (
                  <tr><td colSpan={6} className="p-8 text-center text-slate-500">No sales invoices billed yet.</td></tr>
                ) : (
                  sales.map((s: any) => (
                    <tr key={s.id} className="hover:bg-slate-100/50 transition-colors">
                      <td className="p-4 font-mono font-bold text-indigo-700">{s.invoice_number}</td>
                      <td className="p-4 font-medium">{s.invoice_date}</td>
                      <td className="p-4 font-semibold text-slate-900">{s.customer?.name || s.customer_id}</td>
                      <td className="p-4 text-right text-slate-500">₹{formatCurrency(s.total_cost_of_goods)}</td>
                      <td className="p-4 text-right text-emerald-700 font-bold">₹{formatCurrency(s.net_profit)}</td>
                      <td className="p-4 text-right font-bold text-slate-900">₹{formatCurrency(s.grand_total)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </main>
      </div>

      {/* POS Billing Modal */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Generate Sales Tax Invoice (POS)">
        {formError && <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold">{formError}</div>}
        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="font-bold text-slate-700 block mb-1">Invoice #</label>
              <input 
                type="text" 
                value={invoiceNumber} 
                onChange={(e) => setInvoiceNumber(e.target.value)} 
                placeholder="e.g. INV-1001" 
                className="glass-input w-full p-2.5 rounded-xl font-mono" 
              />
            </div>
            <div>
              <label className="font-bold text-slate-700 block mb-1">Select Customer</label>
              <select 
                value={customerId} 
                onChange={(e) => setCustomerId(e.target.value)} 
                className="glass-input w-full p-2.5 rounded-xl bg-white font-medium" 
                required
              >
                <option value="">-- Choose Buyer --</option>
                {customers.map((c: any) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
            <span className="font-bold text-indigo-900 block text-xs">Add Line Item</span>
            <div className="grid grid-cols-3 gap-2">
              <select 
                value={selectedProduct} 
                onChange={(e) => {
                  setSelectedProduct(e.target.value);
                  const p = products.find((pr: any) => pr.id === e.target.value);
                  if (p) setUnitPrice(p.default_selling_price || '100');
                }} 
                className="glass-input p-2 rounded-xl bg-white col-span-1"
              >
                <option value="">Select Item</option>
                {products.map((p: any) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
              <input 
                type="number" 
                placeholder="Qty" 
                value={qty} 
                onChange={(e) => setQty(e.target.value)} 
                className="glass-input p-2 rounded-xl" 
              />
              <input 
                type="number" 
                placeholder="Price" 
                value={unitPrice} 
                onChange={(e) => setUnitPrice(e.target.value)} 
                className="glass-input p-2 rounded-xl" 
              />
            </div>
            <button 
              type="button" 
              onClick={handleAddItem} 
              className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-xs"
            >
              Add Item
            </button>
          </div>

          {items.length > 0 && (
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <div className="bg-slate-100 p-2 font-bold text-slate-700">Added Items ({items.length})</div>
              <div className="divide-y divide-slate-100 max-h-36 overflow-y-auto">
                {items.map((it, idx) => (
                  <div key={idx} className="p-2 flex items-center justify-between">
                    <div>
                      <div className="font-bold text-slate-900">{it.product_name}</div>
                      <div className="text-[10px] text-slate-500">{it.quantity} x ₹{formatCurrency(it.unit_selling_price)}</div>
                    </div>
                    <div className="font-bold text-emerald-700">₹{formatCurrency(it.quantity * it.unit_selling_price)}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button 
              type="button" 
              onClick={() => setIsModalOpen(false)} 
              className="px-4 py-2 font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
            >
              Cancel
            </button>
            <button 
              type="submit" 
              disabled={createMutation.isPending} 
              className="px-5 py-2 font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-md"
            >
              {createMutation.isPending ? 'Processing...' : 'Complete POS Bill'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
