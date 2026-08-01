'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Search, AlertTriangle, CheckCircle } from 'lucide-react';
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
  const [sku, setSku] = useState('');
  const [hsnCode, setHsnCode] = useState('');
  const [unit, setUnit] = useState('BOX');
  const [purchasePrice, setPurchasePrice] = useState('100.00');
  const [sellingPrice, setSellingPrice] = useState('150.00');
  const [gstRate, setGstRate] = useState('12.00');
  const [minStockAlert, setMinStockAlert] = useState('10');
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
    setSku('');
    setHsnCode('');
    setUnit('BOX');
    setPurchasePrice('100.00');
    setSellingPrice('150.00');
    setGstRate('12.00');
    setMinStockAlert('10');
    setFormError('');
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate({
      name,
      sku,
      hsn_code: hsnCode || null,
      unit,
      default_purchase_price: parseFloat(purchasePrice) || 0,
      default_selling_price: parseFloat(sellingPrice) || 0,
      gst_rate: parseFloat(gstRate) || 0,
      min_stock_alert: parseInt(minStockAlert) || 10,
    });
  };

  const filteredProducts = products.filter((p: any) => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.sku.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Header 
          title="Product Catalog & Inventory" 
          subtitle="SKU management, real-time Godown stock levels & weighted landed cost" 
          onActionClick={isAdmin ? () => setIsModalOpen(true) : undefined}
          actionLabel="Add New SKU"
        />

        <main className="p-8 space-y-6 flex-1 overflow-y-auto">
          {/* Controls Bar */}
          <div className="glass-panel p-4 rounded-2xl flex items-center justify-between gap-4">
            <div className="relative w-full md:w-96">
              <Search className="absolute left-3.5 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search products by SKU or Name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full glass-input pl-10 pr-4 py-2 rounded-xl text-xs"
              />
            </div>

            <div className="text-xs text-slate-500 font-semibold">
              Total SKUs: <span className="text-slate-900 font-bold">{products.length}</span>
            </div>
          </div>

          {/* Product Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {isLoading ? (
              <div className="col-span-full py-12 text-center text-slate-500 text-sm">Loading catalog...</div>
            ) : filteredProducts.length === 0 ? (
              <div className="col-span-full py-12 text-center text-slate-500 text-sm">No products found.</div>
            ) : (
              filteredProducts.map((p: any) => {
                const currentStock = parseFloat(p.stock?.current_stock || 0);
                const isLowStock = currentStock <= p.min_stock_alert;

                return (
                  <div key={p.id} className="glass-card p-5 rounded-2xl space-y-4 border-slate-200">
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="text-[10px] font-mono font-bold text-indigo-700 uppercase bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                          {p.sku}
                        </span>
                        <h3 className="font-bold text-slate-900 text-base leading-snug mt-1.5">{p.name}</h3>
                      </div>

                      {/* Stock Health Badge */}
                      <span className={`flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded border ${
                        isLowStock 
                          ? 'bg-amber-50 text-amber-700 border-amber-200' 
                          : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      }`}>
                        {isLowStock ? <AlertTriangle className="h-3 w-3" /> : <CheckCircle className="h-3 w-3" />}
                        {currentStock} {p.unit}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-3 border-t border-slate-100 text-xs">
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 block uppercase">Default Purchase</span>
                        <span className="font-extrabold text-slate-800">₹{parseFloat(p.default_purchase_price || 0).toFixed(2)}</span>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 block uppercase">Selling Price</span>
                        <span className="font-extrabold text-emerald-700">₹{parseFloat(p.default_selling_price || 0).toFixed(2)}</span>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 block uppercase">Avg Landed Cost</span>
                        <span className="font-extrabold text-indigo-600">₹{parseFloat(p.stock?.average_landed_cost || 0).toFixed(2)}</span>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 block uppercase">GST Rate</span>
                        <span className="font-bold text-slate-700">{p.gst_rate}%</span>
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
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Create New Product SKU">
        {formError && <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold">{formError}</div>}
        <form onSubmit={handleCreate} className="space-y-4 text-xs">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Product Name *</label>
              <input required type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Everest Garam Masala 100g" className="w-full glass-input p-2.5 rounded-xl" />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">SKU Code *</label>
              <input required type="text" value={sku} onChange={(e) => setSku(e.target.value)} placeholder="EVRT-GM-100" className="w-full glass-input p-2.5 rounded-xl font-mono uppercase" />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Purchase Price (₹)</label>
              <input type="number" step="0.01" value={purchasePrice} onChange={(e) => setPurchasePrice(e.target.value)} className="w-full glass-input p-2.5 rounded-xl" />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Selling Price (₹)</label>
              <input type="number" step="0.01" value={sellingPrice} onChange={(e) => setSellingPrice(e.target.value)} className="w-full glass-input p-2.5 rounded-xl text-emerald-700 font-bold" />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">GST Rate (%)</label>
              <input type="number" step="0.01" value={gstRate} onChange={(e) => setGstRate(e.target.value)} className="w-full glass-input p-2.5 rounded-xl" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Packaging Unit</label>
              <select value={unit} onChange={(e) => setUnit(e.target.value)} className="w-full glass-input p-2.5 rounded-xl bg-white">
                <option value="BOX">BOX</option>
                <option value="KG">KG</option>
                <option value="PKT">PKT</option>
                <option value="BAG">BAG</option>
              </select>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Min Stock Alert Threshold</label>
              <input type="number" value={minStockAlert} onChange={(e) => setMinStockAlert(e.target.value)} className="w-full glass-input p-2.5 rounded-xl" />
            </div>
          </div>

          <button
            type="submit"
            disabled={createMutation.isPending}
            className="w-full py-3 bg-gradient-to-r from-indigo-600 to-emerald-600 hover:from-indigo-500 hover:to-emerald-500 text-white font-bold rounded-xl shadow-lg shadow-indigo-500/20 transition-all"
          >
            {createMutation.isPending ? 'Saving...' : 'Save Product & Initialize Stock'}
          </button>
        </form>
      </Modal>
    </div>
  );
}
