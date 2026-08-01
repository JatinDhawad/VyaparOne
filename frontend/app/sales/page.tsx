'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import Modal from '@/components/Modal';
import { api } from '@/lib/api';

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

    const availableStock = parseFloat(prod.stock?.current_stock || 0);
    const requestQty = parseFloat(qty) || 0;

    if (requestQty > availableStock) {
      setFormError(`Insufficient stock for '${prod.name}'. Available: ${availableStock}, Requested: ${requestQty}`);
      return;
    }
    setFormError('');

    setItems([
      ...items,
      {
        product_id: selectedProduct,
        product_name: prod.name,
        quantity: requestQty,
        unit_selling_price: parseFloat(unitPrice) || 0,
        discount_amount: 0,
        gst_rate: parseFloat(prod.gst_rate || 0),
      },
    ]);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerId || items.length === 0) {
      setFormError('Please select a customer and add at least one line item.');
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
        discount_amount: i.discount_amount,
        gst_rate: i.gst_rate,
      })),
    });
  };

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Header 
          title="Sales POS & Tax Invoices" 
          subtitle="Real-time stock validation, line profit calculation & customer ledger debiting" 
          onActionClick={() => setIsModalOpen(true)}
          actionLabel="New Sales POS Billing"
        />

        <main className="p-8 space-y-6 flex-1 overflow-y-auto">
          <div className="glass-panel rounded-2xl overflow-hidden border border-slate-200">
            <div className="p-4 border-b border-slate-100 font-bold text-slate-900 text-sm">Recent Sales Invoices</div>
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100/80 text-slate-500 border-b border-slate-200 uppercase text-[10px] font-bold">
                <tr>
                  <th className="p-4">Invoice #</th>
                  <th className="p-4">Date</th>
                  <th className="p-4">Customer ID</th>
                  <th className="p-4">COGS</th>
                  <th className="p-4">Net Profit</th>
                  <th className="p-4">Grand Total</th>
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
                      <td className="p-4">{s.invoice_date}</td>
                      <td className="p-4 font-semibold text-slate-900">{s.customer_id}</td>
                      <td className="p-4 text-slate-500">₹{parseFloat(s.total_cost_of_goods || 0).toFixed(2)}</td>
                      <td className="p-4 text-emerald-700 font-bold">₹{parseFloat(s.net_profit || 0).toFixed(2)}</td>
                      <td className="p-4 font-bold text-slate-900">₹{parseFloat(s.grand_total || 0).toFixed(2)}</td>
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
              <label className="block font-bold text-slate-700 mb-1">Invoice Number *</label>
              <input required type="text" value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} placeholder="INV-2026-001" className="w-full glass-input p-2.5 rounded-xl font-mono" />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Select Customer *</label>
              <select required value={customerId} onChange={(e) => setCustomerId(e.target.value)} className="w-full glass-input p-2.5 rounded-xl bg-white">
                <option value="">-- Choose Buyer --</option>
                {customers.map((c: any) => (
                  <option key={c.id} value={c.id}>{c.name} ({c.city || 'Customer'})</option>
                ))}
              </select>
            </div>
          </div>

          {/* Item Add Bar */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
            <span className="font-bold text-emerald-700 text-xs uppercase tracking-wider block">Add Items to Cart</span>
            <div className="grid grid-cols-4 gap-2">
              <div className="col-span-2">
                <select value={selectedProduct} onChange={(e) => setSelectedProduct(e.target.value)} className="w-full glass-input p-2 rounded-xl bg-white">
                  <option value="">-- Select SKU --</option>
                  {products.map((p: any) => (
                    <option key={p.id} value={p.id}>{p.name} (Stock: {p.stock?.current_stock || 0})</option>
                  ))}
                </select>
              </div>

              <div>
                <input type="number" placeholder="Qty" value={qty} onChange={(e) => setQty(e.target.value)} className="w-full glass-input p-2 rounded-xl" />
              </div>

              <div>
                <input type="number" step="0.01" placeholder="Selling Price (₹)" value={unitPrice} onChange={(e) => setUnitPrice(e.target.value)} className="w-full glass-input p-2 rounded-xl font-bold text-emerald-700" />
              </div>
            </div>

            <button type="button" onClick={handleAddItem} className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl shadow-md shadow-emerald-600/15">
              + Add to Invoice Cart
            </button>
          </div>

          {/* Cart Items */}
          {items.length > 0 && (
            <div className="space-y-2">
              <span className="font-bold text-slate-700 block">Cart Items ({items.length})</span>
              {items.map((it, idx) => (
                <div key={idx} className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                  <div>
                    <div className="font-bold text-slate-900">{it.product_name}</div>
                    <div className="text-[10px] text-slate-500">Qty: {it.quantity} | Rate: ₹{it.unit_selling_price}</div>
                  </div>
                  <div className="font-bold text-emerald-700">₹{(it.quantity * it.unit_selling_price).toFixed(2)}</div>
                </div>
              ))}
            </div>
          )}

          <button
            type="submit"
            disabled={createMutation.isPending}
            className="w-full py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold rounded-xl shadow-lg shadow-emerald-500/20 transition-all"
          >
            {createMutation.isPending ? 'Billing Invoice...' : 'Complete POS Bill & Post Ledger'}
          </button>
        </form>
      </Modal>
    </div>
  );
}
