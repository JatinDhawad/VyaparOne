'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Search, PackageCheck, Layers, Tag, Pencil, Package } from 'lucide-react';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import Modal from '@/components/Modal';
import { api } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';

// ── Preset conversion ratios ──────────────────────────────────────────────────
const PACKET_PRESETS = [
  { label: 'Sweet Supari @5', ratio: 480 },
  { label: 'Sweet Supari @1', ratio: 300 },
  { label: 'Mouth Freshener @1', ratio: 240 },
  { label: 'Mouth Freshener @2', ratio: 360 },
];

export default function ProductsPage() {
  const queryClient = useQueryClient();

  const [searchTerm, setSearchTerm] = useState('');

  // ── Create Product modal ──────────────────────────────────────────────────
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createError, setCreateError] = useState('');
  const [name, setName] = useState('');
  const [hsnCode, setHsnCode] = useState('');
  const [unit, setUnit] = useState('BAG');
  const [purchasePrice, setPurchasePrice] = useState('500.00');
  const [sellingPrice, setSellingPrice] = useState('650.00');
  const [gstRate, setGstRate] = useState('5.00');
  const [packetsPerBag, setPacketsPerBag] = useState('0');

  // ── Edit Product modal ────────────────────────────────────────────────────
  const [editProduct, setEditProduct] = useState<any>(null);
  const [editError, setEditError] = useState('');
  const [editName, setEditName] = useState('');
  const [editHsn, setEditHsn] = useState('');
  const [editUnit, setEditUnit] = useState('BAG');
  const [editPurchasePrice, setEditPurchasePrice] = useState('');
  const [editSellingPrice, setEditSellingPrice] = useState('');
  const [editGstRate, setEditGstRate] = useState('');
  const [editPacketsPerBag, setEditPacketsPerBag] = useState('0');

  // ── Data ──────────────────────────────────────────────────────────────────
  const { data: products = [], isLoading } = useQuery({
    queryKey: ['products'],
    queryFn: () => api.getProducts(),
  });

  // ── Mutations ─────────────────────────────────────────────────────────────
  const createMutation = useMutation({
    mutationFn: (data: any) => api.createProduct(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      setIsCreateOpen(false);
      resetCreate();
    },
    onError: (err: any) => setCreateError(err.message || 'Failed to create product.'),
  });

  const editMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => api.updateProduct(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      setEditProduct(null);
    },
    onError: (err: any) => setEditError(err.message || 'Failed to update product.'),
  });

  // ── Helpers ───────────────────────────────────────────────────────────────
  const resetCreate = () => {
    setName(''); setHsnCode(''); setUnit('BAG');
    setPurchasePrice('500.00'); setSellingPrice('650.00');
    setGstRate('5.00'); setPacketsPerBag('0'); setCreateError('');
  };

  const openEdit = (p: any) => {
    setEditProduct(p);
    setEditName(p.name); setEditHsn(p.hsn_code || '');
    setEditUnit(p.unit || 'BAG');
    setEditPurchasePrice(String(p.default_purchase_price));
    setEditSellingPrice(String(p.default_selling_price));
    setEditGstRate(String(p.gst_rate));
    setEditPacketsPerBag(String(p.packets_per_bag || 0));
    setEditError('');
  };

  const filteredProducts = products.filter((p: any) =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (p.hsn_code && p.hsn_code.includes(searchTerm))
  );

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Header
          title="Product Catalog & Inventory"
          onActionClick={() => setIsCreateOpen(true)}
          actionLabel="Add Product SKU"
        />

        <main className="p-8 space-y-6 flex-1 overflow-y-auto">
          {/* Search bar */}
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
              Total SKUs: <span className="text-indigo-700 font-extrabold">{filteredProducts.length}</span>
            </div>
          </div>

          {/* Product Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {isLoading ? (
              <div className="col-span-full text-center py-12 text-slate-400 font-medium text-sm">Loading product catalog...</div>
            ) : filteredProducts.length === 0 ? (
              <div className="col-span-full glass-card p-12 text-center text-slate-500 rounded-3xl">
                No products found. Record a Purchase Bill or click &quot;Add Product SKU&quot;.
              </div>
            ) : (
              filteredProducts.map((p: any) => {
                const currentStock = p.stock?.current_stock ?? 0;
                return (
                  <div key={p.id} className="glass-card p-6 rounded-3xl space-y-4 hover:shadow-xl transition-all duration-300 border border-slate-200/80 bg-white flex flex-col justify-between">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <span className="inline-flex items-center gap-1 text-[11px] font-mono font-bold text-indigo-700 uppercase bg-indigo-50 px-2.5 py-1 rounded-xl border border-indigo-200/80">
                          <Tag className="h-3 w-3" />
                          HSN: {p.hsn_code || p.sku}
                        </span>
                        <h3 className="font-extrabold text-slate-900 text-base leading-snug mt-2 truncate">{p.name}</h3>
                        {p.packets_per_bag > 0 && (
                          <span className="inline-block text-[10px] font-extrabold text-violet-700 bg-violet-50 px-2.5 py-1 rounded-lg border border-violet-200">
                            1 Bag = {p.packets_per_bag} PKT (Auto-Unpacked)
                          </span>
                        )}
                      </div>
                      <span className="flex items-center gap-1.5 text-xs font-extrabold px-3 py-1.5 rounded-xl border bg-emerald-50 text-emerald-800 border-emerald-200/80 shadow-xs shrink-0">
                        <PackageCheck className="h-4 w-4 text-emerald-600" />
                        {currentStock} {p.packets_per_bag > 0 ? 'PKT' : p.unit}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-3 pt-3 border-t border-slate-100 text-xs">
                      <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100">
                        <span className="text-[10px] font-bold text-slate-400 block uppercase">Purchase Rate</span>
                        <span className="font-extrabold text-slate-900 text-sm">₹{formatCurrency(p.default_purchase_price)}</span>
                      </div>
                      <div className="p-3 rounded-2xl bg-emerald-50/50 border border-emerald-100">
                        <span className="text-[10px] font-bold text-emerald-700 block uppercase">Selling Rate</span>
                        <span className="font-extrabold text-emerald-800 text-sm">₹{formatCurrency(p.default_selling_price)}</span>
                      </div>
                      <div className="p-3 rounded-2xl bg-indigo-50/50 border border-indigo-100">
                        <span className="text-[10px] font-bold text-indigo-700 block uppercase">Avg Landed Cost / PKT</span>
                        <span className="font-extrabold text-indigo-800 text-sm">₹{formatCurrency(p.stock?.average_landed_cost)}</span>
                      </div>
                      <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100">
                        <span className="text-[10px] font-bold text-slate-400 block uppercase">GST Rate</span>
                        <span className="font-extrabold text-slate-700 text-sm">{p.gst_rate}%</span>
                      </div>
                    </div>

                    {/* Action button */}
                    <div className="pt-1">
                      <button
                        onClick={() => openEdit(p)}
                        className="w-full flex items-center justify-center gap-1.5 py-2 text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-xl transition-colors shadow-2xs"
                      >
                        <Pencil className="h-3.5 w-3.5" /> Edit Item Details
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </main>
      </div>

      {/* ── Create Product Modal ──────────────────────────────────────────────── */}
      <Modal isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} title="Create New Product Catalog Entry">
        <form onSubmit={(e) => { e.preventDefault(); createMutation.mutate({ name, hsn_code: hsnCode, unit, packets_per_bag: parseInt(packetsPerBag) || 0, default_purchase_price: parseFloat(purchasePrice) || 0, default_selling_price: parseFloat(sellingPrice) || 0, gst_rate: parseFloat(gstRate) || 0 }); }} className="space-y-4">
          {createError && <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs font-medium">{createError}</div>}
          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">Product Description / Trade Name</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Samosa Patti 10x10" className="glass-input w-full p-2.5 rounded-xl text-xs" required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">HSN / SAC Code</label>
              <input type="text" value={hsnCode} onChange={(e) => setHsnCode(e.target.value)} placeholder="21069030" className="glass-input w-full p-2.5 rounded-xl text-xs font-mono" required />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">Unit</label>
              <select value={unit} onChange={(e) => setUnit(e.target.value)} className="glass-input w-full p-2.5 rounded-xl text-xs bg-white">
                <option value="BAG">BAG</option>
                <option value="BOX">BOX</option>
                <option value="KG">KG</option>
                <option value="PCS">PCS</option>
                <option value="PKT">PACKET (PKT)</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">Purchase Rate (₹)</label>
              <input type="number" step="0.01" value={purchasePrice} onChange={(e) => setPurchasePrice(e.target.value)} className="glass-input w-full p-2.5 rounded-xl text-xs" required />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">Selling Rate (₹)</label>
              <input type="number" step="0.01" value={sellingPrice} onChange={(e) => setSellingPrice(e.target.value)} className="glass-input w-full p-2.5 rounded-xl text-xs" required />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">GST Rate (%)</label>
              <select value={gstRate} onChange={(e) => setGstRate(e.target.value)} className="glass-input w-full p-2.5 rounded-xl text-xs bg-white font-bold">
                <option value="0.00">0%</option>
                <option value="5.00">5%</option>
                <option value="12.00">12%</option>
                <option value="18.00">18%</option>
                <option value="28.00">28%</option>
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs font-bold text-violet-700 block mb-1">Packets per Bag <span className="text-slate-400 font-normal">(for bag → packet conversion; 0 = N/A)</span></label>
            <div className="flex gap-2 mb-1">
              {PACKET_PRESETS.map((pr) => (
                <button key={pr.ratio} type="button" onClick={() => setPacketsPerBag(String(pr.ratio))}
                  className="px-2 py-1 text-[10px] font-bold bg-violet-100 hover:bg-violet-200 text-violet-800 rounded-lg border border-violet-200 transition-colors">
                  {pr.label}: {pr.ratio}
                </button>
              ))}
            </div>
            <input type="number" value={packetsPerBag} onChange={(e) => setPacketsPerBag(e.target.value)} placeholder="e.g. 480" className="glass-input w-full p-2.5 rounded-xl text-xs" min="0" />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setIsCreateOpen(false)} className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors">Cancel</button>
            <button type="submit" disabled={createMutation.isPending} className="px-4 py-2 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-md transition-all">
              {createMutation.isPending ? 'Saving...' : 'Save Product SKU'}
            </button>
          </div>
        </form>
      </Modal>

      {/* ── Edit Product Modal ────────────────────────────────────────────────── */}
      {editProduct && (
        <Modal isOpen={!!editProduct} onClose={() => setEditProduct(null)} title={`Edit Stock Item — ${editProduct.name}`}>
          <form onSubmit={(e) => {
            e.preventDefault();
            editMutation.mutate({ id: editProduct.id, data: {
              name: editName, hsn_code: editHsn, unit: editUnit,
              packets_per_bag: parseInt(editPacketsPerBag) || 0,
              default_purchase_price: parseFloat(editPurchasePrice) || 0,
              default_selling_price: parseFloat(editSellingPrice) || 0,
              gst_rate: parseFloat(editGstRate) || 0,
            }});
          }} className="space-y-4 text-xs">
            {editError && <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs font-medium">{editError}</div>}
            <div>
              <label className="font-bold text-slate-700 block mb-1">Product Name</label>
              <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)} className="glass-input w-full p-2.5 rounded-xl" required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-bold text-slate-700 block mb-1">HSN Code</label>
                <input type="text" value={editHsn} onChange={(e) => setEditHsn(e.target.value)} className="glass-input w-full p-2.5 rounded-xl font-mono" />
              </div>
              <div>
                <label className="font-bold text-slate-700 block mb-1">Unit</label>
                <select value={editUnit} onChange={(e) => setEditUnit(e.target.value)} className="glass-input w-full p-2.5 rounded-xl bg-white">
                  <option value="BAG">BAG</option>
                  <option value="BOX">BOX</option>
                  <option value="KG">KG</option>
                  <option value="PCS">PCS</option>
                  <option value="PKT">PACKET (PKT)</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Purchase Rate (₹)</label>
                <input type="number" step="0.01" value={editPurchasePrice} onChange={(e) => setEditPurchasePrice(e.target.value)} className="glass-input w-full p-2.5 rounded-xl" />
              </div>
              <div>
                <label className="font-bold text-emerald-700 block mb-1">Selling Rate (₹)</label>
                <input type="number" step="0.01" value={editSellingPrice} onChange={(e) => setEditSellingPrice(e.target.value)} className="glass-input w-full p-2.5 rounded-xl" />
              </div>
              <div>
                <label className="font-bold text-slate-700 block mb-1">GST Rate (%)</label>
                <select value={editGstRate} onChange={(e) => setEditGstRate(e.target.value)} className="glass-input w-full p-2.5 rounded-xl bg-white font-bold">
                  <option value="0">0%</option>
                  <option value="5">5%</option>
                  <option value="12">12%</option>
                  <option value="18">18%</option>
                  <option value="28">28%</option>
                </select>
              </div>
            </div>
            <div>
              <label className="font-bold text-violet-700 block mb-1">Packets per Bag</label>
              <div className="flex gap-2 mb-1.5">
                {PACKET_PRESETS.map((pr) => (
                  <button key={pr.ratio} type="button" onClick={() => setEditPacketsPerBag(String(pr.ratio))}
                    className="px-2 py-1 text-[10px] font-bold bg-violet-100 hover:bg-violet-200 text-violet-800 rounded-lg border border-violet-200 transition-colors">
                    {pr.ratio}
                  </button>
                ))}
              </div>
              <input type="number" value={editPacketsPerBag} onChange={(e) => setEditPacketsPerBag(e.target.value)} className="glass-input w-full p-2.5 rounded-xl" min="0" />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={() => setEditProduct(null)} className="px-4 py-2 font-bold text-slate-600 hover:bg-slate-100 rounded-xl">Cancel</button>
              <button type="submit" disabled={editMutation.isPending} className="px-5 py-2 font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-md">
                {editMutation.isPending ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

