'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Search, PackageCheck, Plus, Layers, Tag } from 'lucide-react';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import Modal from '@/components/Modal';
import { api } from '@/lib/api';
import { useAuthStore } from '@/lib/auth-store';

export default function ProductsPage() {
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const isAdmin = user?.role?.name === 'ADMIN' || user?.role_id === 1;

  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Form State
  const [name, setName] = useState('');
  const [hsnCode, setHsnCode] = useState('');
  const [unit, setUnit] = useState('BAG');
  const [purchasePrice, setPurchasePrice] = useState('500.00');
  const [sellingPrice, setSellingPrice] = useState('650.00');
  const [gstRate, setGstRate] = useState('12.00');
  const [formError, setFormError] = useState('');

  const { data: products = [], isLoading } = useQuery({
    queryKey: ['products'],
    queryFn: () => api.getProducts(),
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => api.createProduct(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      setIsModalOpen(false);
      resetForm();
    },
    onError: (err: any) => {
      setFormError(err.message || 'Failed to create product.');
    },
  });

  const resetForm = () => {
    setName('');
    setHsnCode('');
    setUnit('BAG');
    setPurchasePrice('500.00');
    setSellingPrice('650.00');
    setGstRate('12.00');
    setFormError('');
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate({
      name,
      hsn_code: hsnCode,
      sku: hsnCode,
      unit,
      default_purchase_price: parseFloat(purchasePrice) || 0,
      default_selling_price: parseFloat(sellingPrice) || 0,
      gst_rate: parseFloat(gstRate) || 0,
      min_stock_alert: 0,
    });
  };

  const filteredProducts = products.filter((p: any) => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (p.hsn_code && p.hsn_code.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (p.sku && p.sku.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Header 
          title="Product Catalog & Inventory" 
          subtitle="HSN/SAC catalog management, real-time Godown stock levels & landed cost" 
          onActionClick={isAdmin ? () => setIsModalOpen(true) : undefined}
          actionLabel="Add New Product (HSN/SAC)"
        />

        <main className="p-8 space-y-8 flex-1 overflow-y-auto">
          {/* Controls Bar */}
          <div className="glass-panel p-6 rounded-3xl flex flex-col md:flex-row items-center justify-between gap-4 border border-slate-200">
            <div className="relative w-full md:w-96">
              <Search className="absolute left-4 top-3.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search by HSN/SAC Code or Product Name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full glass-input pl-11 pr-4 py-2.5 rounded-2xl text-xs font-medium"
              />
            </div>

            <div className="text-xs text-slate-600 font-bold flex items-center gap-2">
              <Layers className="h-4 w-4 text-indigo-600" />
              Total Catalog SKUs: <span className="text-slate-900 font-extrabold text-sm">{products.length}</span>
            </div>
          </div>

          {/* Product Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {isLoading ? (
              <div className="col-span-full py-16 text-center text-slate-500 text-sm">Loading catalog...</div>
            ) : filteredProducts.length === 0 ? (
              <div className="col-span-full py-16 text-center text-slate-500 text-sm">No products found in catalog.</div>
            ) : (
              filteredProducts.map((p: any) => {
                const currentStock = parseFloat(p.stock?.current_stock || 0);

                return (
                  <div key={p.id} className="glass-card p-6 rounded-3xl space-y-5 border-slate-200">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <span className="inline-flex items-center gap-1 text-[11px] font-mono font-bold text-indigo-700 uppercase bg-indigo-50 px-2.5 py-1 rounded-xl border border-indigo-200/80">
                          <Tag className="h-3 w-3" />
                          HSN: {p.hsn_code || p.sku}
                        </span>
                        <h3 className="font-extrabold text-slate-900 text-lg leading-snug mt-2">{p.name}</h3>
                      </div>

                      {/* Stock Quantity Badge */}
                      <span className="flex items-center gap-1.5 text-xs font-extrabold px-3 py-1.5 rounded-xl border bg-emerald-50 text-emerald-800 border-emerald-200/80 shadow-xs shrink-0">
                        <PackageCheck className="h-4 w-4 text-emerald-600" />
                        {currentStock} {p.unit}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-3 pt-4 border-t border-slate-100 text-xs">
                      <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100">
                        <span className="text-[10px] font-bold text-slate-400 block uppercase">Purchase Rate / {p.unit}</span>
                        <span className="font-extrabold text-slate-900 text-sm">₹{parseFloat(p.default_purchase_price || 0).toFixed(2)}</span>
                      </div>

                      <div className="p-3 rounded-2xl bg-emerald-50/50 border border-emerald-100">
                        <span className="text-[10px] font-bold text-emerald-700 block uppercase">Selling Rate / {p.unit}</span>
                        <span className="font-extrabold text-emerald-800 text-sm">₹{parseFloat(p.default_selling_price || 0).toFixed(2)}</span>
                      </div>

                      <div className="p-3 rounded-2xl bg-indigo-50/50 border border-indigo-100">
                        <span className="text-[10px] font-bold text-indigo-700 block uppercase">Avg Landed Cost</span>
                        <span className="font-extrabold text-indigo-800 text-sm">₹{parseFloat(p.stock?.average_landed_cost || 0).toFixed(2)}</span>
                      </div>

                      <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100">
                        <span className="text-[10px] font-bold text-slate-400 block uppercase">GST Rate</span>
                        <span className="font-extrabold text-slate-700 text-sm">{p.gst_rate}%</span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </main>
      </div>

      {/* Add Product Modal */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Create New Product (HSN/SAC Catalog)" maxWidth="max-w-3xl">
        {formError && <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold mb-4">{formError}</div>}
        <form onSubmit={handleCreate} className="space-y-6 text-xs">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block font-bold text-slate-700 mb-1.5">Product Name *</label>
              <input required type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Basmati Rice 50kg Bag" className="w-full glass-input p-3 rounded-2xl text-xs font-semibold" />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1.5">HSN / SAC Code *</label>
              <input required type="text" value={hsnCode} onChange={(e) => setHsnCode(e.target.value)} placeholder="e.g. 100630" className="w-full glass-input p-3 rounded-2xl font-mono uppercase text-xs font-bold" />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div>
              <label className="block font-bold text-slate-700 mb-1.5">Default Purchase Rate (₹)</label>
              <input type="number" step="0.01" value={purchasePrice} onChange={(e) => setPurchasePrice(e.target.value)} className="w-full glass-input p-3 rounded-2xl text-xs font-bold" />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1.5">Default Selling Rate (₹)</label>
              <input type="number" step="0.01" value={sellingPrice} onChange={(e) => setSellingPrice(e.target.value)} className="w-full glass-input p-3 rounded-2xl text-xs font-bold text-emerald-700" />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1.5">GST Tax Rate (%)</label>
              <input type="number" step="0.01" value={gstRate} onChange={(e) => setGstRate(e.target.value)} className="w-full glass-input p-3 rounded-2xl text-xs font-bold" />
            </div>
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1.5">Packaging Unit *</label>
            <select value={unit} onChange={(e) => setUnit(e.target.value)} className="w-full glass-input p-3 rounded-2xl bg-white font-bold text-xs">
              <option value="BAG">BAG</option>
              <option value="BOX">BOX</option>
              <option value="KG">KG</option>
              <option value="PKT">PKT</option>
            </select>
          </div>

          <button
            type="submit"
            disabled={createMutation.isPending}
            className="w-full py-4 bg-gradient-to-r from-indigo-600 via-teal-600 to-emerald-600 hover:from-indigo-500 hover:to-emerald-500 text-white font-extrabold rounded-2xl shadow-xl shadow-indigo-500/20 transition-all text-xs uppercase tracking-wider mt-4"
          >
            {createMutation.isPending ? 'Saving Product...' : 'Save Product & Initialize Stock Record'}
          </button>
        </form>
      </Modal>
    </div>
  );
}
