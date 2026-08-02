'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Search, PackageCheck, Plus, Layers, Tag } from 'lucide-react';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import Modal from '@/components/Modal';
import { api } from '@/lib/api';
import { useAuthStore } from '@/lib/auth-store';
import { formatCurrency } from '@/lib/utils';

export default function ProductsPage() {
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);

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
      unit,
      default_purchase_price: parseFloat(purchasePrice) || 0,
      default_selling_price: parseFloat(sellingPrice) || 0,
      gst_rate: parseFloat(gstRate) || 0,
    });
  };

  const filteredProducts = products.filter((p: any) => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (p.hsn_code && p.hsn_code.includes(searchTerm))
  );

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Header 
          title="Product Catalog & Inventory" 
          onActionClick={() => setIsModalOpen(true)}
          actionLabel="Add Product SKU"
        />

        <main className="p-8 space-y-6 flex-1 overflow-y-auto">
          {/* Top Bar: Search & Counter */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="relative w-full sm:w-96">
              <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search product by name or HSN code..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="glass-input pl-10 pr-4 py-2.5 rounded-xl w-full text-xs font-medium"
              />
            </div>
            
            <div className="flex items-center gap-2 text-xs font-bold text-slate-600 bg-white px-4 py-2 rounded-xl border border-slate-200 shadow-xs">
              <Layers className="h-4 w-4 text-indigo-600" />
              Total Catalog SKUs: <span className="text-indigo-700 font-extrabold">{filteredProducts.length}</span>
            </div>
          </div>

          {/* Product Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {isLoading ? (
              <div className="col-span-full text-center py-12 text-slate-400 font-medium text-sm">Loading product catalog...</div>
            ) : filteredProducts.length === 0 ? (
              <div className="col-span-full glass-card p-12 text-center text-slate-500 rounded-3xl">
                No products found matching &quot;{searchTerm}&quot;. Record a Purchase Bill or click &quot;Add Product SKU&quot; to populate your catalog.
              </div>
            ) : (
              filteredProducts.map((p: any) => {
                const currentStock = p.stock?.current_stock ?? 0;
                return (
                  <div key={p.id} className="glass-card p-6 rounded-3xl space-y-4 hover:shadow-xl transition-all duration-300 border border-slate-200/80 bg-white flex flex-col justify-between">
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
                        <span className="font-extrabold text-slate-900 text-sm">₹{formatCurrency(p.default_purchase_price)}</span>
                      </div>

                      <div className="p-3 rounded-2xl bg-emerald-50/50 border border-emerald-100">
                        <span className="text-[10px] font-bold text-emerald-700 block uppercase">Selling Rate / {p.unit}</span>
                        <span className="font-extrabold text-emerald-800 text-sm">₹{formatCurrency(p.default_selling_price)}</span>
                      </div>

                      <div className="p-3 rounded-2xl bg-indigo-50/50 border border-indigo-100">
                        <span className="text-[10px] font-bold text-indigo-700 block uppercase">Avg Landed Cost</span>
                        <span className="font-extrabold text-indigo-800 text-sm">₹{formatCurrency(p.stock?.average_landed_cost)}</span>
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

      {/* Modal */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Create New Product Catalog Entry">
        <form onSubmit={handleCreate} className="space-y-4">
          {formError && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs font-medium">
              {formError}
            </div>
          )}

          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">Product Description / Trade Name</label>
            <input 
              type="text" 
              value={name} 
              onChange={(e) => setName(e.target.value)} 
              placeholder="e.g. Samosa Patti 10x10" 
              className="glass-input w-full p-2.5 rounded-xl text-xs" 
              required 
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">HSN / SAC Code</label>
              <input 
                type="text" 
                value={hsnCode} 
                onChange={(e) => setHsnCode(e.target.value)} 
                placeholder="21069030" 
                className="glass-input w-full p-2.5 rounded-xl text-xs font-mono" 
                required 
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">Unit of Measurement</label>
              <select 
                value={unit} 
                onChange={(e) => setUnit(e.target.value)} 
                className="glass-input w-full p-2.5 rounded-xl text-xs bg-white"
              >
                <option value="BAG">BAG</option>
                <option value="BOX">BOX</option>
                <option value="KG">KG</option>
                <option value="PCS">PCS</option>
                <option value="PACKET">PACKET</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">Purchase Rate (₹)</label>
              <input 
                type="number" 
                step="0.01" 
                value={purchasePrice} 
                onChange={(e) => setPurchasePrice(e.target.value)} 
                className="glass-input w-full p-2.5 rounded-xl text-xs" 
                required 
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">Selling Rate (₹)</label>
              <input 
                type="number" 
                step="0.01" 
                value={sellingPrice} 
                onChange={(e) => setSellingPrice(e.target.value)} 
                className="glass-input w-full p-2.5 rounded-xl text-xs" 
                required 
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">GST Tax Rate (%)</label>
              <select 
                value={gstRate} 
                onChange={(e) => setGstRate(e.target.value)} 
                className="glass-input w-full p-2.5 rounded-xl text-xs bg-white font-bold"
              >
                <option value="0.00">0% (EXEMPT)</option>
                <option value="5.00">5%</option>
                <option value="12.00">12%</option>
                <option value="18.00">18%</option>
                <option value="28.00">28%</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button 
              type="button" 
              onClick={() => setIsModalOpen(false)} 
              className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button 
              type="submit" 
              disabled={createMutation.isPending} 
              className="px-4 py-2 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-md transition-all"
            >
              {createMutation.isPending ? 'Saving...' : 'Save Product SKU'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
